const mongoose = require('mongoose');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
  : crypto.scryptSync(process.env.JWT_SECRET || 'fallback_secret_for_digital_udhaar_khata', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  // If already encrypted, don't encrypt again
  if (text.includes(':') && text.split(':').length === 2) {
    return text;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return '';
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return text;
  }
}

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    phoneHash: {
      type: String,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    creditScore: {
      type: Number,
      default: 750,
    },
    duePrediction: {
      type: String,
      enum: ['trusted', 'delay', 'risky'],
      default: 'trusted',
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    paymentDueDate: {
      type: Date,
      default: null,
    },
    lastAutoReminderSentDate: {
      type: Date,
      default: null,
    },
    avatar: {
      type: String,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Encrypt sensitive fields & calculate blind index for phone
customerSchema.pre('save', function (next) {
  if (this.isModified('phone') && this.phone) {
    // Generate deterministic blind index for exact matches/duplicates
    this.phoneHash = crypto.createHmac('sha256', ENCRYPTION_KEY).update(this.phone).digest('hex');
    this.phone = encrypt(this.phone);
  }
  if (this.isModified('address') && this.address) {
    this.address = encrypt(this.address);
  }
  if (this.isModified('notes') && this.notes) {
    this.notes = encrypt(this.notes);
  }
  next();
});

// Post-init hook: Decrypt sensitive fields when loaded from DB
customerSchema.post('init', function (doc) {
  if (doc.phone) doc.phone = decrypt(doc.phone);
  if (doc.address) doc.address = decrypt(doc.address);
  if (doc.notes) doc.notes = decrypt(doc.notes);
});

// Post-save hook: Decrypt fields in memory after save
customerSchema.post('save', function (doc) {
  if (doc.phone) doc.phone = decrypt(doc.phone);
  if (doc.address) doc.address = decrypt(doc.address);
  if (doc.notes) doc.notes = decrypt(doc.notes);
});

// Index for faster queries by owner
customerSchema.index({ owner: 1, name: 1 });

const CustomerModel = mongoose.model('Customer', customerSchema);
module.exports = CustomerModel;
module.exports.decryptCustomerField = decrypt;
