const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const CustomerHistory = require('../models/CustomerHistory');
const BlockchainService = require('./blockchainService');
const socketService = require('./socketService');
const cache = require('../utils/cache');

const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return { keyId, keySecret };
};

const getRazorpayInstance = () => {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay API keys are missing in backend environment variables.');
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * Create Razorpay Order
 * @param {number} amountInRupees - Amount in INR (e.g. 500.50)
 * @param {string} customerId - Target Customer ID
 * @param {object} metadata - Additional notes
 */
const createRazorpayOrder = async (amountInRupees, customerId, metadata = {}) => {
  const rzp = getRazorpayInstance();
  const amountInPaise = Math.round(amountInRupees * 100);

  const receipt = `rcpt_${customerId.slice(-6)}_${Date.now().toString().slice(-6)}`;
  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: receipt,
    notes: {
      customerId,
      ...metadata,
    },
  };

  const order = await rzp.orders.create(options);
  return {
    orderId: order.id,
    amount: order.amount, // in paise
    currency: order.currency,
    receipt: order.receipt,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

/**
 * Verify Razorpay Signature (HMAC-SHA256)
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const { keySecret } = getRazorpayConfig();
  if (!keySecret || !orderId || !paymentId || !signature) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
};

/**
 * Verify Razorpay Webhook Signature
 */
const verifyRazorpayWebhookSignature = (rawBody, signature, webhookSecret) => {
  if (!webhookSecret || !signature) return true;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expectedSignature === signature;
  } catch (err) {
    console.error('Razorpay Webhook signature verification error:', err);
    return false;
  }
};

/**
 * Process and Settle Verified Razorpay Payment Idempotently
 */
const processVerifiedRazorpayPayment = async ({
  customerId,
  orderId,
  paymentId,
  signature,
  amount,
  source = 'Razorpay API',
}) => {
  // 1. Check if transaction with razorpayPaymentId or razorpayOrderId is already settled
  const queryConditions = [];
  if (paymentId) queryConditions.push({ razorpayPaymentId: String(paymentId) });
  if (orderId) queryConditions.push({ razorpayOrderId: String(orderId) });

  if (queryConditions.length > 0) {
    const existingTx = await Transaction.findOne({
      $or: queryConditions,
      paymentStatus: 'SETTLED',
    }).populate('customer', 'name phone balance owner');

    if (existingTx) {
      console.log(`ℹ️ [${source}] Razorpay Payment already settled for order: ${orderId}, paymentId: ${paymentId}`);
      const cust = await Customer.findById(existingTx.customer);
      return {
        success: true,
        alreadyProcessed: true,
        transaction: existingTx,
        customer: cust,
      };
    }
  }

  // 2. Fetch Customer
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error(`Customer with ID ${customerId} not found.`);
  }

  const payAmount = parseFloat(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  const formattedPaymentId = String(paymentId || `RZP_PAY_${Date.now()}`);
  const txTimestamp = new Date();
  const desc = `Razorpay Online Payment (ID: ${formattedPaymentId})`;

  // 3. Create Debit Transaction Entry as SETTLED
  const transaction = await Transaction.create({
    owner: customer.owner,
    customer: customer._id,
    type: 'debit',
    amount: payAmount,
    description: desc,
    date: txTimestamp,
    paymentStatus: 'SETTLED',
    paymentMode: 'online',
    razorpayOrderId: orderId || null,
    razorpayPaymentId: formattedPaymentId,
    utr: formattedPaymentId,
    paymentMethod: 'razorpay',
    paymentGroup: 'card/upi/netbanking',
    paymentTimestamp: txTimestamp,
  });

  // 4. Settle Customer Balance
  customer.balance = Math.max(0, customer.balance - payAmount);
  customer.lastPaymentDate = new Date();
  customer.totalTransactions = (customer.totalTransactions || 0) + 1;
  await customer.save();

  // 5. Mark pending credit transactions as SETTLED if balance reached zero
  if (customer.balance === 0) {
    await Transaction.updateMany(
      {
        customer: customer._id,
        type: 'credit',
        paymentStatus: 'PENDING',
      },
      { $set: { paymentStatus: 'PAID' } }
    );
  }

  // 6. Log to Customer Permanent History
  await CustomerHistory.create({
    owner: customer.owner,
    customerId: customer._id,
    customerName: customer.name,
    customerPhone: customer.phone,
    transactionId: transaction._id,
    type: 'debit',
    amount: payAmount,
    description: desc,
    date: txTimestamp,
    action: 'CREATE',
  });

  // 7. Background Async Tasks (Blockchain block, Cache invalidation, Email, Socket event)
  BlockchainService.createBlock(customer.owner, transaction._id, customer._id, transaction.amount, 'debit')
    .catch(err => console.error('Background blockchain block creation failed for Razorpay payment:', err));

  cache.invalidatePrefix(`stats_${customer.owner}`);

  if (customer.email) {
    const { sendTransactionEmail } = require('./transactionMailService');
    sendTransactionEmail(transaction._id).catch(err => console.error('Error sending auto-receipt email:', err));
  }

  socketService.emitRefresh('transactions');
  socketService.emitRefresh('customers');

  console.log(`✅ [${source}] Razorpay payment processed & settled successfully. Customer: ${customer.name}, Amount: ₹${payAmount}, PaymentID: ${formattedPaymentId}`);

  return {
    success: true,
    alreadyProcessed: false,
    transaction,
    customer,
  };
};

module.exports = {
  getRazorpayConfig,
  getRazorpayInstance,
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  processVerifiedRazorpayPayment,
};
