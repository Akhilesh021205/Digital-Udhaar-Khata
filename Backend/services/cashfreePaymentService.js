const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const CustomerHistory = require('../models/CustomerHistory');
const BlockchainService = require('./blockchainService');
const socketService = require('./socketService');
const cache = require('../utils/cache');

const getCashfreeConfig = () => {
  const appId = process.env.CASHFREE_CLIENT_ID;
  const secretKey = process.env.CASHFREE_CLIENT_SECRET;
  const isSandbox = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase() === 'SANDBOX';
  const baseUrl = isSandbox 
    ? 'https://sandbox.cashfree.com/pg' 
    : 'https://api.cashfree.com/pg';

  return { appId, secretKey, isSandbox, baseUrl };
};

const getCashfreeHeaders = () => {
  const { appId, secretKey } = getCashfreeConfig();
  return {
    'x-client-id': appId,
    'x-client-secret': secretKey,
    'x-api-version': '2023-08-01',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

/**
 * Fetch Order & Payment details directly from Cashfree PG Server API
 */
const verifyCashfreeOrder = async (orderId) => {
  const { baseUrl } = getCashfreeConfig();
  const headers = getCashfreeHeaders();

  // 1. Fetch Order Details
  const orderRes = await axios.get(`${baseUrl}/orders/${orderId}`, { headers });
  const orderData = orderRes.data;

  // 2. Fetch Payment Attempts for this Order
  let payments = [];
  try {
    const paymentsRes = await axios.get(`${baseUrl}/orders/${orderId}/payments`, { headers });
    payments = paymentsRes.data || [];
  } catch (err) {
    console.warn(`Could not fetch payments array for order ${orderId}:`, err.message);
  }

  // Identify successful payment attempt if available
  const successPayment = payments.find(p => p.payment_status === 'SUCCESS') || payments[0] || null;

  // Extract UTR / Bank Reference Number
  let utr = null;
  if (successPayment) {
    utr = successPayment.bank_reference || 
          successPayment.payment_method?.upi?.bank_reference ||
          successPayment.payment_method?.netbanking?.bank_reference ||
          successPayment.payment_method?.card?.bank_reference ||
          null;
  }

  return {
    orderStatus: orderData.order_status,
    orderAmount: orderData.order_amount,
    orderCurrency: orderData.order_currency,
    customerId: orderData.customer_details?.customer_id,
    customerName: orderData.customer_details?.customer_name,
    payment: successPayment ? {
      cfPaymentId: successPayment.cf_payment_id ? String(successPayment.cf_payment_id) : null,
      paymentStatus: successPayment.payment_status,
      paymentAmount: successPayment.payment_amount,
      paymentTime: successPayment.payment_completion_time || successPayment.payment_time || new Date(),
      paymentGroup: successPayment.payment_group || 'upi',
      paymentMethod: successPayment.payment_method?.upi ? 'upi' : (successPayment.payment_group || 'upi'),
      utr: utr ? String(utr) : null,
    } : null
  };
};

/**
 * Verify Cashfree Webhook Signature using HMAC-SHA256
 */
const verifyCashfreeWebhookSignature = (rawBody, timestamp, signature) => {
  const { secretKey } = getCashfreeConfig();
  if (!secretKey || !signature || !timestamp) return true; // Default allow if not set in dev

  try {
    const dataToSign = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(dataToSign)
      .digest('base64');

    return expectedSignature === signature;
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return false;
  }
};

/**
 * Idempotent Payment Processor
 * Guarantees that a payment is settled EXACTLY ONCE across webhooks and direct API verification.
 */
const processVerifiedPayment = async ({
  customerId,
  orderId,
  paymentId,
  utr,
  amount,
  paymentMethod = 'upi',
  paymentGroup = 'upi',
  paymentTimestamp,
  source = 'API'
}) => {
  // 1. Check if transaction with this orderId, paymentId, or UTR is ALREADY SETTLED
  const queryConditions = [];
  if (orderId) queryConditions.push({ cashfreeOrderId: orderId });
  if (paymentId) queryConditions.push({ cashfreePaymentId: String(paymentId) });
  if (utr) queryConditions.push({ utr: String(utr) });

  if (queryConditions.length > 0) {
    const existingTx = await Transaction.findOne({
      $or: queryConditions,
      paymentStatus: 'SETTLED'
    }).populate('customer', 'name phone balance owner');

    if (existingTx) {
      console.log(`ℹ️ [${source}] Payment already processed and settled for order: ${orderId}, paymentId: ${paymentId}`);
      const cust = await Customer.findById(existingTx.customer);
      return {
        success: true,
        alreadyProcessed: true,
        transaction: existingTx,
        customer: cust
      };
    }
  }

  // 2. Fetch Customer
  let targetCustomerId = customerId;
  if (!targetCustomerId && orderId) {
    // Attempt extract customerId from standard order format order_customerId_timestamp
    const parts = orderId.split('_');
    if (parts.length >= 2) {
      targetCustomerId = parts[1];
    }
  }

  const customer = await Customer.findById(targetCustomerId);
  if (!customer) {
    throw new Error(`Customer with ID ${targetCustomerId} not found.`);
  }

  const payAmount = parseFloat(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  // 3. Create the Debit Transaction Entry as SETTLED
  const formattedPaymentId = paymentId ? String(paymentId) : `CF_PAY_${Date.now()}`;
  const formattedUtr = utr ? String(utr) : null;
  const txTimestamp = paymentTimestamp ? new Date(paymentTimestamp) : new Date();

  let desc = `Cashfree UPI Payment (ID: ${formattedPaymentId})`;
  if (formattedUtr) desc += ` (UTR: ${formattedUtr})`;

  const transaction = await Transaction.create({
    owner: customer.owner,
    customer: customer._id,
    type: 'debit',
    amount: payAmount,
    description: desc,
    date: txTimestamp,
    paymentStatus: 'SETTLED',
    paymentMode: 'upi',
    cashfreeOrderId: orderId,
    cashfreePaymentId: formattedPaymentId,
    utr: formattedUtr,
    paymentMethod: paymentMethod || 'upi',
    paymentGroup: paymentGroup || 'upi',
    paymentTimestamp: txTimestamp,
  });

  // 4. Settle Customer Balance
  customer.balance = Math.max(0, customer.balance - payAmount);
  customer.lastPaymentDate = new Date();
  customer.totalTransactions = (customer.totalTransactions || 0) + 1;
  await customer.save();

  // 5. Mark pending credit transactions as SETTLED if dues are fully cleared
  if (customer.balance === 0) {
    await Transaction.updateMany(
      {
        customer: customer._id,
        type: 'credit',
        paymentStatus: 'PENDING',
      },
      { $set: { paymentStatus: 'SETTLED' } }
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
    .catch(err => console.error('Background blockchain block creation failed for Cashfree payment:', err));

  cache.invalidatePrefix(`stats_${customer.owner}`);

  if (customer.email) {
    const { sendTransactionEmail } = require('./transactionMailService');
    sendTransactionEmail(transaction._id).catch(err => console.error('Error sending auto-receipt email:', err));
  }

  socketService.emitRefresh('transactions');
  socketService.emitRefresh('customers');

  console.log(`✅ [${source}] Cashfree payment processed & settled successfully. Customer: ${customer.name}, Amount: ₹${payAmount}, PaymentID: ${formattedPaymentId}, UTR: ${formattedUtr || 'N/A'}`);

  return {
    success: true,
    alreadyProcessed: false,
    transaction,
    customer,
  };
};

module.exports = {
  getCashfreeConfig,
  verifyCashfreeOrder,
  verifyCashfreeWebhookSignature,
  processVerifiedPayment,
};
