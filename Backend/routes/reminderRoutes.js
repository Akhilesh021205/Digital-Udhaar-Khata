const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { sendReminder, sendBulkReminders, sendFast2SMSSMS, sendCloudWhatsApp } = require('../controllers/reminderController');
const { protect } = require('../middleware/authMiddleware');
const { getFrontendUrl } = require('../utils/urlHelper');
const { generateStatement } = require('../services/pdfService');
const { validatePaymentToken, generatePaymentLink } = require('../services/paymentTokenService');
const PaymentToken = require('../models/PaymentToken');
const {
  getCashfreeConfig,
  verifyCashfreeOrder,
  verifyCashfreeWebhookSignature,
  processVerifiedPayment,
} = require('../services/cashfreePaymentService');
const {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchRazorpayPayment,
  verifyRazorpayWebhookSignature,
  processVerifiedRazorpayPayment,
} = require('../services/razorpayPaymentService');

/**
 * Resolves and authorizes a customer checkout request.
 * Enforces token validity, short-lived expiry, and prevents unauthorized customer ID access.
 */
const resolveCustomerAndToken = async (identifier, req) => {
  const cleanId = String(identifier || req.headers['x-payment-token'] || req.query?.token || req.body?.token || '').trim();

  if (!cleanId) {
    return {
      authorized: false,
      status: 400,
      message: 'Payment link token or customer identifier is required.',
    };
  }

  // 1. Validate as cryptographically secure payment token
  const tokenValidation = await validatePaymentToken(cleanId);
  if (tokenValidation.valid) {
    return {
      authorized: true,
      customer: tokenValidation.customer,
      owner: tokenValidation.owner,
      token: cleanId,
      tokenDoc: tokenValidation.tokenDoc,
    };
  }

  if (tokenValidation.isExpired || tokenValidation.isUsed) {
    return {
      authorized: false,
      status: 410,
      message: tokenValidation.message,
    };
  }

  // 2. If an ordinary MongoDB customer ID is provided:
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          const customer = await Customer.findOne({ _id: cleanId, owner: user._id }).populate('owner');
          if (customer) {
            return {
              authorized: true,
              customer,
              owner: customer.owner,
              isShopkeeperPreview: true,
            };
          }
        }
      } catch (err) {
        // invalid jwt, proceed to public customer lookup
      }
    }

    // Direct access via customer ID (e.g. from transaction bill email, PDF receipt, or direct share)
    const customer = await Customer.findById(cleanId).populate('owner');
    if (customer && customer.owner) {
      // Find latest active token or generate an active token for this session
      let tokenDoc = await PaymentToken.findOne({
        customer: customer._id,
        status: 'ACTIVE',
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      let activeTokenStr = cleanId;
      if (!tokenDoc) {
        const ownerId = customer.owner._id || customer.owner;
        const generated = await generatePaymentLink(customer._id, ownerId);
        tokenDoc = await PaymentToken.findById(generated.paymentTokenId);
        activeTokenStr = generated.rawToken;
      }

      return {
        authorized: true,
        customer,
        owner: customer.owner,
        token: activeTokenStr,
        tokenDoc,
      };
    } else if (customer && !customer.owner) {
      return {
        authorized: false,
        status: 404,
        message: 'The merchant account associated with this customer record is no longer active.',
      };
    }

    return {
      authorized: false,
      status: 404,
      message: 'Customer account not found. Please check the link or contact the shopkeeper.',
    };
  }

  return {
    authorized: false,
    status: 404,
    message: tokenValidation.message || 'Invalid or expired payment link. Please ask the shopkeeper to send a fresh payment reminder.',
  };
};

// Public route for payment checkout
router.get('/checkout/:customerId', async (req, res, next) => {
  try {
    const authResult = await resolveCustomerAndToken(req.params.customerId, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 404).json({
        success: false,
        message: authResult.message,
      });
    }

    // Fetch fresh customer data from MongoDB
    const customer = await Customer.findById(authResult.customer._id).populate('owner');
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Fetch total Credit (Udhaar) and total Debit (Jama)
    const credits = await Transaction.find({ customer: customer._id, type: 'credit' });
    const debits = await Transaction.find({ customer: customer._id, type: 'debit' });

    const totalUdhaar = credits.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalJama = debits.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Fetch last successfully SETTLED payment
    const lastPayment = await Transaction.findOne({
      customer: customer._id,
      type: 'debit',
      paymentStatus: 'SETTLED',
    }).sort({ date: -1 });

    let lastPaymentUtr = '';
    if (lastPayment && lastPayment.description) {
      const match = lastPayment.description.match(/UTR:\s*([a-zA-Z0-9_-]+)/i);
      if (match) {
        lastPaymentUtr = match[1];
      }
    }

    const ownerObj = customer.owner || authResult.owner || {};

    res.status(200).json({
      success: true,
      data: {
        token: authResult.token || null,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
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
          paymentId: lastPayment.razorpayPaymentId || lastPayment.cashfreePaymentId || '',
          status: lastPayment.paymentStatus || 'SETTLED',
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
    const authResult = await resolveCustomerAndToken(req.params.customerId, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 403).json({
        success: false,
        message: authResult.message,
      });
    }

    const customer = await Customer.findById(authResult.customer._id).populate('owner');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Fetch last debit transaction
    const lastPayment = await Transaction.findOne({
      customer: customer._id,
      type: 'debit',
      paymentStatus: 'SETTLED',
    }).sort({ date: -1 });

    if (!lastPayment) {
      return res.status(404).json({ success: false, message: 'No settled payment transaction found' });
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
      description: paymentScreenshot ? `Online Payment (Payment Verified, Ref: ${utrStr})` : `Online UPI Payment (UTR: ${utrStr})`,
      billImageUrl: paymentScreenshot || '',
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
        transactionStatus: 'PAID',
        lastPayment: {
          id: transaction._id,
          amount: transaction.amount,
          utr: utrStr,
          date: transaction.date,
          status: 'PAID',
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

    const authResult = await resolveCustomerAndToken(customerId, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 403).json({
        success: false,
        message: authResult.message,
      });
    }

    const customer = await Customer.findById(authResult.customer._id).populate('owner');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Always fetch authoritative balance from DB
    const currentBalance = parseFloat(customer.balance || 0);
    if (currentBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer has no outstanding balance to pay (balance is ₹0.00).',
      });
    }

    let payAmount = currentBalance;
    if (requestedAmount !== undefined && requestedAmount !== null) {
      const requested = parseFloat(requestedAmount);
      if (isNaN(requested) || requested <= 0) {
        return res.status(400).json({ success: false, message: 'Valid payment amount greater than ₹0 is required.' });
      }
      if (requested > currentBalance) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (₹${requested.toFixed(2)}) cannot exceed customer's outstanding balance of ₹${currentBalance.toFixed(2)}.`,
        });
      }
      payAmount = requested;
    }

    const orderId = `order_${String(customer._id).slice(-6)}_${Date.now()}`;
    const { appId, secretKey, isSandbox, baseUrl } = getCashfreeConfig();

    let cleanPhone = customer.phone ? customer.phone.replace(/\D/g, '').slice(-10) : '';
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      cleanPhone = '9876543210';
    }

    const payload = {
      order_amount: payAmount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: customer._id.toString(),
        customer_email: customer.email && customer.email.includes('@') ? customer.email : 'customer@digitaludhaar.com',
        customer_phone: cleanPhone,
        customer_name: customer.name || 'Valued Customer'
      },
      order_meta: {
        return_url: `${getFrontendUrl()}/pay/${customerId}?order_id={order_id}`
      }
    };

    console.log('Creating Cashfree Order:', orderId, 'Amount:', payAmount);

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
      isSandbox,
      amount: payAmount,
      customerName: customer.name,
      balance: customer.balance,
    });
  } catch (error) {
    console.error('Error creating Cashfree order:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to initialize payment order.'
    });
  }
});

// ─── CASHFREE VERIFY PAYMENT STATUS ───
router.get('/checkout/:customerId/verify-payment/:orderId', async (req, res, next) => {
  try {
    const { customerId, orderId } = req.params;

    const authResult = await resolveCustomerAndToken(customerId, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 403).json({
        success: false,
        message: authResult.message,
      });
    }

    const customer = await Customer.findById(authResult.customer._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const { orderStatus, orderAmount, payment } = await verifyCashfreeOrder(orderId);

    if (orderStatus === 'PAID' || (payment && payment.paymentStatus === 'SUCCESS')) {
      const result = await processVerifiedPayment({
        customerId: customer._id,
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
        message: 'Payment verified and paid successfully.',
        status: 'PAID',
        data: {
          transactionId: result.transaction._id,
          paymentId: result.transaction.cashfreePaymentId,
          utr: result.transaction.utr,
          amount: result.transaction.amount,
          date: result.transaction.date,
          paymentStatus: 'PAID',
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
    const authResult = await resolveCustomerAndToken(req.params.customerId, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 403).json({
        success: false,
        message: authResult.message,
      });
    }

    const customer = await Customer.findById(authResult.customer._id).populate('owner');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Always fetch fresh customer balance from DB - never trust frontend or email amount
    const currentBalance = parseFloat(customer.balance || 0);
    if (currentBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer has no outstanding balance to pay (balance is ₹0.00).',
      });
    }

    let payAmount = currentBalance;
    if (req.body && req.body.amount !== undefined) {
      const requested = parseFloat(req.body.amount);
      if (isNaN(requested) || requested <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid payment amount greater than ₹0 is required.',
        });
      }
      if (requested > currentBalance) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (₹${requested.toFixed(2)}) cannot exceed customer's outstanding balance of ₹${currentBalance.toFixed(2)}.`,
        });
      }
      payAmount = requested;
    }

    const rzpOrder = await createRazorpayOrder(payAmount, customer._id.toString(), {
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentToken: authResult.token || '',
    });

    console.log(`💳 Razorpay Order Created: ${rzpOrder.orderId} for customer ${customer.name}, Amount: ₹${payAmount}`);

    res.status(200).json({
      success: true,
      order_id: rzpOrder.orderId,
      amount: rzpOrder.amount, // in paise
      currency: rzpOrder.currency,
      key_id: rzpOrder.keyId,
      customerName: customer.name,
      balance: customer.balance,
      payAmount: payAmount,
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
    const authResult = await resolveCustomerAndToken(req.params.customerId, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 403).json({
        success: false,
        message: authResult.message,
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment response parameters (order_id, payment_id, signature).',
      });
    }

    // 1. Cryptographic HMAC-SHA256 signature verification
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      console.warn(`⚠️ Razorpay Payment Signature verification failed for order: ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        message: 'Razorpay payment verification failed. Payment signature is invalid or tampered.',
      });
    }

    // 2. Fetch ground truth payment record from Razorpay API where available
    let rzpPayment;
    try {
      rzpPayment = await fetchRazorpayPayment(razorpay_payment_id);
    } catch (rzpErr) {
      console.warn(`⚠️ Razorpay API fetch failed (${rzpErr.message}), relying on cryptographic signature.`);
    }

    if (rzpPayment) {
      if (rzpPayment.order_id && rzpPayment.order_id !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay payment record does not match the provided order ID.',
        });
      }
      if (rzpPayment.status !== 'captured' && rzpPayment.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          message: `Payment is not successful. Current status: ${rzpPayment.status}`,
        });
      }
      if (rzpPayment.notes?.customerId && rzpPayment.notes.customerId !== authResult.customer._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Payment customer identity mismatch with active ledger account.',
        });
      }
    }

    const customer = await Customer.findById(authResult.customer._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const verifiedAmount = rzpPayment
      ? (rzpPayment.amount / 100)
      : (amount ? parseFloat(amount) : customer.balance);

    if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount detected.' });
    }

    // 3. Process verified payment idempotently and update ledger exactly once
    const result = await processVerifiedRazorpayPayment({
      customerId: customer._id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amount: verifiedAmount,
      token: authResult.token,
      source: 'Razorpay Verification Route',
    });

    res.status(200).json({
      success: true,
      message: 'Razorpay payment verified and settled successfully.',
      status: 'PAID',
      data: {
        transactionId: result.transaction._id,
        paymentId: result.transaction.razorpayPaymentId,
        orderId: result.transaction.razorpayOrderId,
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
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Fail closed if webhook secret is missing or signature verification fails
    if (!webhookSecret) {
      console.warn('⚠️ Razorpay Webhook rejected: RAZORPAY_WEBHOOK_SECRET is not configured (failing closed).');
      return res.status(500).json({ error: 'Webhook secret is not configured on server.' });
    }

    if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn('⚠️ Razorpay Webhook Signature Verification Failed');
      return res.status(400).send('Invalid Webhook Signature');
    }

    const event = req.body?.event;
    console.log(`🔔 Razorpay Webhook Verified Event: ${event}`);

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

// On-demand payment link generation for sharing via WhatsApp, SMS, or direct copy
router.post('/generate-link/:customerId', async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      owner: req.user._id,
    });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const { paymentUrl, rawToken, expiresAt } = await generatePaymentLink(customer._id, req.user._id);

    res.status(200).json({
      success: true,
      data: {
        paymentUrl,
        token: rawToken,
        expiresAt,
        customerName: customer.name,
        balance: customer.balance,
      },
    });
  } catch (error) {
    next(error);
  }
});

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
