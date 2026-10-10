const crypto = require('crypto');
const PaymentToken = require('../models/PaymentToken');
const { getFrontendUrl } = require('../utils/urlHelper');

const DEFAULT_EXPIRY_HOURS = parseInt(process.env.PAYMENT_LINK_EXPIRES_IN_HOURS || '72', 10);

const hashToken = (rawToken) => {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
};

/**
 * Generate a cryptographically secure, customer-specific payment link token.
 * Stores only a sha256 hash in the database, enforces expiry, and associates
 * with the correct customer and shopkeeper.
 */
const generatePaymentLink = async (customerId, ownerId, options = {}) => {
  const expiryHours = options.expiryHours || DEFAULT_EXPIRY_HOURS;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  const doc = await PaymentToken.create({
    tokenHash,
    customer: customerId,
    owner: ownerId,
    amount: options.amount || null,
    expiresAt,
    status: 'ACTIVE',
  });

  const frontendUrl = getFrontendUrl();
  const paymentUrl = `${frontendUrl}/pay/${rawToken}`;

  return {
    rawToken,
    tokenHash,
    paymentUrl,
    expiresAt,
    paymentTokenId: doc._id,
  };
};

/**
 * Validates a payment token.
 * Checks existence, expiry, and status.
 * Rejects expired, tampered, or used tokens.
 */
const validatePaymentToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, message: 'Valid payment token is required.' };
  }

  const cleanToken = rawToken.trim();
  const tokenHash = hashToken(cleanToken);

  const tokenDoc = await PaymentToken.findOne({
    tokenHash,
  }).populate('customer').populate('owner');

  if (!tokenDoc) {
    return { valid: false, message: 'Invalid payment link. Link not found or unauthorized.' };
  }

  if (tokenDoc.status === 'USED') {
    return {
      valid: false,
      isUsed: true,
      message: 'This payment link has already been used and settled.',
      tokenDoc,
      customer: tokenDoc.customer,
    };
  }

  if (new Date() > tokenDoc.expiresAt || tokenDoc.status === 'EXPIRED') {
    if (tokenDoc.status !== 'EXPIRED') {
      tokenDoc.status = 'EXPIRED';
      await tokenDoc.save().catch(() => {});
    }
    return {
      valid: false,
      isExpired: true,
      message: 'This payment link has expired. Please request a new payment reminder from the merchant.',
      tokenDoc,
      customer: tokenDoc.customer,
    };
  }

  if (!tokenDoc.customer) {
    return { valid: false, message: 'Associated customer profile could not be found.' };
  }

  return {
    valid: true,
    tokenDoc,
    customer: tokenDoc.customer,
    owner: tokenDoc.owner,
  };
};

/**
 * Mark token as USED after a successful payment settlement
 */
const markTokenUsed = async (rawTokenOrHash, transactionId) => {
  if (!rawTokenOrHash) return;
  try {
    const rawStr = String(rawTokenOrHash).trim();
    const hash = hashToken(rawStr);

    await PaymentToken.findOneAndUpdate(
      {
        $or: [{ tokenHash: rawStr }, { tokenHash: hash }],
        status: 'ACTIVE',
      },
      {
        $set: {
          status: 'USED',
          usedAt: new Date(),
          transaction: transactionId || null,
        },
      }
    );
  } catch (err) {
    console.error('Error marking payment token as used:', err.message);
  }
};

module.exports = {
  generatePaymentLink,
  validatePaymentToken,
  markTokenUsed,
  hashToken,
};
