const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sendReminder, sendBulkReminders, sendFast2SMSSMS, sendCloudWhatsApp } = require('../controllers/reminderController');
const { protect } = require('../middleware/authMiddleware');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { generateStatement } = require('../services/pdfService');
const {
  getCashfreeConfig,
  verifyCashfreeOrder,
  verifyCashfreeWebhookSignature,
  processVerifiedPayment,
} = require('../services/cashfreePaymentService');
const {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  processVerifiedRazorpayPayment,
} = require('../services/razorpayPaymentService');

// Public route for payment checkout (no authentication required)
router.get('/checkout/:customerId', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const cleanId = req.params.customerId ? req.params.customerId.toString().trim() : '';

    if (!cleanId || !mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid payment checkout link or customer not found',
      });
    }

    const customer = await Customer.findById(cleanId).populate('owner');
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Fetch total Credit (Udhaar) and total Debit (Jama)
    const Transaction = require('../models/Transaction');
    const credits = await Transaction.find({ customer: customer._id, type: 'credit' });
    const debits = await Transaction.find({ customer: customer._id, type: 'debit' });

    const totalUdhaar = credits.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalJama = debits.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Fetch last successfully SETTLED payment only
    const lastPayment = await Transaction.findOne({
      customer: customer._id,
      type: 'debit',
      paymentStatus: 'SETTLED',
    }).sort({ date: -1 });

    let lastPaymentUtr = '';
    if (lastPayment && lastPayment.description) {
      const match = lastPayment.description.match(/UTR:\s*(\d+)/i);
      if (match) {
        lastPaymentUtr = match[1];
      }
    }

    const ownerObj = customer.owner || {};

    res.status(200).json({
      success: true,
      data: {
        customerName: customer.name,
        customerPhone: customer.phone || '',
        customerAddress: customer.address || 'Ghatkesar Rd',
        balance: customer.balance || 0,
        storeName: ownerObj.storeName || ownerObj.name || 'AI Digital Khata',
        upiId: ownerObj.upiId || '',
        ownerName: ownerObj.name || 'Merchant',
        ownerPhone: ownerObj.phone || '',
        totalUdhaar,
        totalJama,
        lastPayment: lastPayment ? {
          amount: lastPayment.amount,
          date: lastPayment.date,
          utr: lastPaymentUtr || lastPayment.utr || '',
          status: lastPayment.paymentStatus || 'SUCCESS',
        } : null,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Public route to download receipt PDF
router.get('/checkout/:customerId/receipt', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.customerId).populate('owner');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Fetch last debit transaction
    const lastPayment = await Transaction.findOne({
      customer: customer._id,
      type: 'debit',
    }).sort({ date: -1 });

    if (!lastPayment) {
      return res.status(404).json({ success: false, message: 'No payment transaction found' });
    }

    // Fetch all customer transactions
    const customerTransactions = await Transaction.find({ customer: customer._id });

    // Generate the premium PDF receipt buffer
    const store = {
      storeName: customer.owner.storeName || 'AI Digital Khata',
      name: customer.owner.name || 'Merchant',
      phone: customer.owner.phone || '',
      upiId: customer.owner.upiId || '',
    };

    const { generateReceiptPDFBuffer } = require('../services/pdfService');
    const pdfBuffer = await generateReceiptPDFBuffer(
      store,
      customer,
      lastPayment,
      customerTransactions
    );

    const dateObj = new Date(lastPayment.date);
    const receiptNo = `RCP-${dateObj.getFullYear()}${(dateObj.getMonth()+1).toString().padStart(2,'0')}${dateObj.getDate().toString().padStart(2,'0')}-${customer._id.toString().slice(-3).toUpperCase()}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${receiptNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

router.post('/checkout/:customerId/confirm-payment', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    let { utr, amount, paymentScreenshot } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.',
      });
    }

    const payAmount = amount ? parseFloat(amount) : customer.balance;
    if (payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required.',
      });
    }

    let utrStr = (utr || '').toString().trim();
    if (!utrStr || utrStr.toUpperCase() === 'AUTO') {
      if (!paymentScreenshot) {
        return res.status(400).json({
          success: false,
          message: 'Please provide either a valid 12-digit UPI UTR or upload a payment screenshot.',
        });
      }
      // Extract real UTR / Ref No from payment screenshot via Tesseract OCR
      const { extractUtrFromScreenshot } = require('../services/ocrService');
      const ocrUtr = await extractUtrFromScreenshot(paymentScreenshot);
      
      if (ocrUtr) {
        utrStr = ocrUtr;
        console.log(`🎯 Real UTR extracted from screenshot via OCR: ${utrStr}`);
      } else {
        const timePart = Date.now().toString().slice(-8);
        const randPart = Math.floor(1000 + Math.random() * 9000).toString();
        utrStr = `${timePart}${randPart}`;
      }
    } else if (utrStr.length < 8 || utrStr.length > 22 || !/^[a-zA-Z0-9]+$/.test(utrStr)) {
      return res.status(400).json({
        success: false,
        message: 'Valid UPI Ref / Transaction UTR number (8 to 22 alphanumeric characters) is required.',
      });
    }

    // 1. Check for duplicate UTR if manual UTR entered
    const Transaction = require('../models/Transaction');
    if (utrStr && !utrStr.startsWith('SS')) {
      const existingTx = await Transaction.findOne({
        description: new RegExp(`UTR:\\s*${utrStr}`, 'i'),
      });
      if (existingTx) {
        return res.status(400).json({
          success: false,
          message: 'This Transaction UTR has already been submitted and verified. Duplicate entries are blocked.',
        });
      }
    }

    // Create the transaction as SETTLED
    const transaction = await Transaction.create({
      owner: customer.owner,
      customer: customer._id,
      type: 'debit',
      amount: payAmount,
      description: paymentScreenshot 
        ? `Online Payment (Screenshot Verified, Ref: ${utrStr})` 
        : `Online UPI Payment (UTR: ${utrStr})`,
      billImageUrl: paymentScreenshot || '',
      date: new Date(),
      paymentStatus: 'SETTLED',
      paymentMode: 'upi',
      utr: utrStr,
    });

    // ── Mark all pending credit (Udhaar) transactions as SETTLED ──
    await Transaction.updateMany(
      {
        customer: customer._id,
        type: 'credit',
        paymentStatus: 'PENDING',
      },
      { $set: { paymentStatus: 'SETTLED' } }
    );

    // Settle balance
    customer.balance = Math.max(0, customer.balance - payAmount);
    customer.lastPaymentDate = new Date();
    customer.totalTransactions = (customer.totalTransactions || 0) + 1;
    await customer.save();

    // Trigger auto email via AI Bot
    if (customer.email) {
      const { sendTransactionEmail } = require('../services/transactionMailService');
      sendTransactionEmail(transaction._id).catch(err => console.error('Error sending auto-receipt:', err));
    }

    // Log to permanent customer history
    const CustomerHistory = require('../models/CustomerHistory');
    await CustomerHistory.create({
      owner: customer.owner,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      transactionId: transaction._id,
      type: 'debit',
      amount: parseFloat(amount),
      description: paymentScreenshot ? `Online Payment (Screenshot Verified, Ref: ${utrStr})` : `Online UPI Payment (UTR: ${utrStr})`,
      date: new Date(),
      action: 'CREATE',
    });

    // Real-time socket notification to shopkeeper dashboard
    const socketService = require('../services/socketService');
    socketService.emitRefresh('transactions');
    socketService.emitRefresh('customers');
    if (paymentScreenshot) {
      socketService.emitEvent('payment_screenshot_received', {
        customerId: customer._id,
        customerName: customer.name,
        amount: payAmount,
        utr: utrStr,
        billImageUrl: paymentScreenshot,
        storeOwnerId: customer.owner._id || customer.owner,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and receipt generated successfully.',
      data: {
        balance: customer.balance,
        transactionStatus: 'SETTLED',
        lastPayment: {
          id: transaction._id,
          amount: transaction.amount,
          utr: utrStr,
          date: transaction.date,
          status: 'SETTLED',
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── CASHFREE CREATE ORDER ───
router.post('/checkout/:customerId/create-order', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { amount: requestedAmount } = req.body || {};
    const customer = await Customer.findById(customerId).populate('owner');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const amount = requestedAmount ? parseFloat(requestedAmount) : parseFloat(customer.balance);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    const orderId = `order_${customerId}_${Date.now()}`;
    const { appId, secretKey, isSandbox, baseUrl } = getCashfreeConfig();

    const payload = {
      order_amount: amount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: customer._id.toString(),
        customer_email: customer.email || 'customer@digitaludhaar.com',
        customer_phone: customer.phone ? customer.phone.replace(/\D/g, '').slice(-10) : '9999999999',
        customer_name: customer.name || 'Valued Customer'
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay/${customerId}?order_id={order_id}`
      }
    };

    console.log('Creating Cashfree Order:', orderId, 'Amount:', amount);

    const response = await axios.post(
      `${baseUrl}/orders`,
      payload,
      {
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      order_id: orderId,
      payment_session_id: response.data.payment_session_id,
      isSandbox
    });
  } catch (error) {
    console.error('Error creating Cashfree order:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to initialize payment gateway order.'
    });
  }
});

// ─── CASHFREE VERIFY PAYMENT STATUS ───
router.get('/checkout/:customerId/verify-payment/:orderId', async (req, res, next) => {
  try {
    const { customerId, orderId } = req.params;
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const { orderStatus, orderAmount, payment } = await verifyCashfreeOrder(orderId);

    if (orderStatus === 'PAID' || (payment && payment.paymentStatus === 'SUCCESS')) {
      const result = await processVerifiedPayment({
        customerId,
        orderId,
        paymentId: payment?.cfPaymentId,
        utr: payment?.utr,
        amount: orderAmount || customer.balance,
        paymentMethod: payment?.paymentMethod || 'upi',
        paymentGroup: payment?.paymentGroup || 'upi',
        paymentTimestamp: payment?.paymentTime,
        source: 'API Verification'
      });

      return res.status(200).json({
        success: true,
        message: 'Payment verified and settled successfully.',
        status: 'PAID',
        data: {
          transactionId: result.transaction._id,
          paymentId: result.transaction.cashfreePaymentId,
          utr: result.transaction.utr,
          amount: result.transaction.amount,
          date: result.transaction.date,
          paymentStatus: 'SETTLED',
          balance: result.customer.balance,
          alreadyProcessed: result.alreadyProcessed
        }
      });
    }

    res.status(200).json({
      success: false,
      message: `Payment status: ${orderStatus}`,
      status: orderStatus
    });
  } catch (error) {
    console.error('Error verifying Cashfree payment:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to verify payment status.'
    });
  }
});

// ─── CASHFREE WEBHOOK ROUTE ───
router.post('/webhook/cashfree', async (req, res) => {
  try {
    console.log('🔔 Cashfree Webhook Received:', req.body);
    const { type, data } = req.body || {};

    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    const rawBody = JSON.stringify(req.body);

    if (signature && !verifyCashfreeWebhookSignature(rawBody, timestamp, signature)) {
      console.warn('⚠️ Cashfree Webhook Signature Verification Failed');
      return res.status(400).send('Invalid Webhook Signature');
    }

    if (type === 'PAYMENT_SUCCESS_WEBHOOK' || data?.payment?.payment_status === 'SUCCESS') {
      const orderId = data?.order?.order_id;
      const amount = data?.order?.order_amount;
      const paymentId = data?.payment?.cf_payment_id;
      const utr = data?.payment?.bank_reference || data?.payment?.payment_method?.upi?.bank_reference;
      const customerId = data?.customer_details?.customer_id;
      const paymentTime = data?.payment?.payment_completion_time || data?.payment?.payment_time;

      if (orderId && amount) {
        await processVerifiedPayment({
          customerId,
          orderId,
          paymentId,
          utr,
          amount,
          paymentMethod: data?.payment?.payment_group || 'upi',
          paymentGroup: data?.payment?.payment_group || 'upi',
          paymentTimestamp: paymentTime,
          source: 'Webhook'
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error handling Cashfree webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ─── RAZORPAY CREATE ORDER ───
router.post('/checkout/:customerId/create-razorpay-order', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { amount: requestedAmount } = req.body || {};
    const customer = await Customer.findById(customerId).populate('owner');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const amount = requestedAmount ? parseFloat(requestedAmount) : parseFloat(customer.balance);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    const rzpOrder = await createRazorpayOrder(amount, customerId, {
      customerName: customer.name,
      customerPhone: customer.phone,
    });

    console.log(`💳 Razorpay Order Created: ${rzpOrder.orderId} for customer ${customer.name}, Amount: ₹${amount}`);

    res.status(200).json({
      success: true,
      order_id: rzpOrder.orderId,
      amount: rzpOrder.amount, // in paise
      currency: rzpOrder.currency,
      key_id: rzpOrder.keyId,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize Razorpay payment order.',
    });
  }
});

// ─── RAZORPAY VERIFY PAYMENT ───
router.post('/checkout/:customerId/verify-razorpay-payment', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment response parameters.',
      });
    }

    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      console.warn(`⚠️ Razorpay Payment Signature verification failed for order: ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        message: 'Razorpay payment signature verification failed. Transaction invalid.',
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const payAmount = amount ? parseFloat(amount) : customer.balance;
    const result = await processVerifiedRazorpayPayment({
      customerId,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amount: payAmount,
      source: 'Razorpay Verification Route',
    });

    res.status(200).json({
      success: true,
      message: 'Razorpay payment verified and settled successfully.',
      status: 'PAID',
      data: {
        transactionId: result.transaction._id,
        paymentId: result.transaction.razorpayPaymentId,
        utr: result.transaction.utr,
        amount: result.transaction.amount,
        date: result.transaction.date,
        paymentStatus: 'SETTLED',
        balance: result.customer.balance,
        alreadyProcessed: result.alreadyProcessed,
      },
    });
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify Razorpay payment.',
    });
  }
});

// ─── RAZORPAY WEBHOOK ───
router.post('/webhook/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = JSON.stringify(req.body);
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn('⚠️ Razorpay Webhook Signature Verification Failed');
      return res.status(400).send('Invalid Webhook Signature');
    }

    const event = req.body.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      if (paymentEntity) {
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;
        const amountInRupees = paymentEntity.amount / 100;
        const customerId = paymentEntity.notes?.customerId;

        if (customerId && orderId) {
          await processVerifiedRazorpayPayment({
            customerId,
            orderId,
            paymentId,
            amount: amountInRupees,
            source: 'Razorpay Webhook',
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error handling Razorpay webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.use(protect);

// Reminders
router.post('/send/:customerId', sendReminder);
router.post('/send-bulk', sendBulkReminders);
router.post('/send-sms', sendFast2SMSSMS);
router.post('/send-whatsapp', sendCloudWhatsApp);

// PDF statement download
router.get('/statement/:customerId', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const customer = await Customer.findOne({
      _id: req.params.customerId,
      owner: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const transactions = await Transaction.find({
      customer: customer._id,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    const store = {
      storeName: req.user.storeName,
      name: req.user.name,
      phone: req.user.phone,
      upiId: req.user.upiId || '',
    };

    const dateRange = {
      startDate: start.toLocaleDateString('en-IN'),
      endDate: end.toLocaleDateString('en-IN'),
    };

    generateStatement(store, customer, transactions, dateRange, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
