const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const CustomerHistory = require('../models/CustomerHistory');
const BlockchainService = require('./blockchainService');
const socketService = require('./socketService');
const cache = require('../utils/cache');
const { markTokenUsed } = require('./paymentTokenService');

const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return { keyId, keySecret };
};

const getRazorpayInstance = () => {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay API keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in backend environment variables.');
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
  const numAmount = parseFloat(amountInRupees);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid payment amount: ${amountInRupees}`);
  }

  const amountInPaise = Math.round(numAmount * 100);
  const receipt = `rcpt_${String(customerId).slice(-6)}_${Date.now().toString().slice(-6)}`;

  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: receipt,
    notes: {
      customerId: String(customerId),
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
 * Verify Razorpay Payment Signature (HMAC-SHA256)
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const { keySecret } = getRazorpayConfig();
  if (!keySecret || !orderId || !paymentId || !signature) {
    return false;
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (err) {
    console.error('Razorpay signature verification error:', err.message);
    return false;
  }
};

/**
 * Fetch and verify payment record directly from Razorpay API
 */
const fetchRazorpayPayment = async (paymentId) => {
  if (!paymentId) {
    throw new Error('Payment ID is required to fetch Razorpay payment');
  }
  const rzp = getRazorpayInstance();
  return await rzp.payments.fetch(paymentId);
};

/**
 * Verify Razorpay Webhook Signature (HMAC-SHA256)
 * Fails closed if webhook secret or signature is missing.
 */
const verifyRazorpayWebhookSignature = (rawBody, signature, webhookSecret) => {
  if (!webhookSecret || !signature || !rawBody) {
    console.warn('⚠️ Webhook verification rejected: webhook secret, signature, or raw body missing (failing closed).');
    return false;
  }
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (err) {
    console.error('Razorpay Webhook signature verification error:', err.message);
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
  token,
  source = 'Razorpay API',
}) => {
  const formattedPaymentId = String(paymentId || `RZP_PAY_${Date.now()}`);

  // 1. Check if transaction with razorpayPaymentId or razorpayOrderId is already settled
  const queryConditions = [];
  if (paymentId) queryConditions.push({ razorpayPaymentId: formattedPaymentId });
  if (orderId) queryConditions.push({ razorpayOrderId: String(orderId) });

  if (queryConditions.length > 0) {
    const existingTx = await Transaction.findOne({
      $or: queryConditions,
      paymentStatus: 'SETTLED',
    }).populate('customer', 'name phone balance owner');

    if (existingTx) {
      console.log(`ℹ️ [${source}] Razorpay Payment already settled for order: ${orderId}, paymentId: ${formattedPaymentId}`);
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

  // 3. Ensure verified payment amount does not exceed customer's outstanding balance
  if (payAmount > customer.balance) {
    console.warn(`⚠️ Payment amount (₹${payAmount}) exceeds customer outstanding balance (₹${customer.balance}). Clamping or rejecting.`);
    if (customer.balance <= 0) {
      throw new Error(`Customer ${customer.name} already has zero outstanding balance.`);
    }
  }

  const txTimestamp = new Date();
  const desc = `Razorpay Online Payment (ID: ${formattedPaymentId})`;

  // 4. Create Debit Transaction Entry as SETTLED (handling concurrency race via unique indexes)
  let transaction;
  try {
    transaction = await Transaction.create({
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
  } catch (err) {
    // Unique index conflict on duplicate submission / concurrent webhook
    if (err.code === 11000) {
      console.log(`ℹ️ [${source}] Concurrent duplicate caught by database unique index for ${formattedPaymentId}`);
      const existingTx = await Transaction.findOne({
        $or: [{ razorpayPaymentId: formattedPaymentId }, { razorpayOrderId: orderId }],
        paymentStatus: 'SETTLED',
      });
      if (existingTx) {
        const cust = await Customer.findById(existingTx.customer);
        return {
          success: true,
          alreadyProcessed: true,
          transaction: existingTx,
          customer: cust,
        };
      }
    }
    throw err;
  }

  // 5. Atomically Settle Customer Balance (prevent balance < 0 under concurrent payments)
  const updatedCustomer = await Customer.findOneAndUpdate(
    {
      _id: customer._id,
      balance: { $gte: payAmount },
    },
    {
      $inc: { balance: -payAmount, totalTransactions: 1 },
      $set: { lastPaymentDate: txTimestamp },
    },
    { new: true }
  );

  if (updatedCustomer) {
    customer.balance = updatedCustomer.balance;
  } else {
    // If balance was less than payAmount due to prior concurrent settlement, clamp to 0 safely
    customer.balance = Math.max(0, customer.balance - payAmount);
    customer.lastPaymentDate = txTimestamp;
    customer.totalTransactions = (customer.totalTransactions || 0) + 1;
    await customer.save();
  }

  // 6. Mark pending credit transactions as PAID if balance reached zero
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

  // 7. Consume associated payment token if present
  if (token) {
    await markTokenUsed(token, transaction._id);
  }

  // 8. Log to Customer Permanent History
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

  // 9. Background Async Tasks (Blockchain block, Cache invalidation, Email, Socket event)
  BlockchainService.createBlock(customer.owner, transaction._id, customer._id, transaction.amount, 'debit')
    .catch(err => console.error('Background blockchain block creation failed for Razorpay payment:', err.message));

  cache.invalidatePrefix(`stats_${customer.owner}`);

  if (customer.email) {
    const { sendTransactionEmail } = require('./transactionMailService');
    sendTransactionEmail(transaction._id).catch(err => console.error('Error sending auto-receipt email:', err.message));
  }

  socketService.emitRefresh('transactions');
  socketService.emitRefresh('customers');

  console.log(`✅ [${source}] Razorpay payment processed & settled successfully. Customer: ${customer.name}, Amount: ₹${payAmount}, PaymentID: ${formattedPaymentId}, New Balance: ₹${customer.balance}`);

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
  fetchRazorpayPayment,
  verifyRazorpayWebhookSignature,
  processVerifiedRazorpayPayment,
};
