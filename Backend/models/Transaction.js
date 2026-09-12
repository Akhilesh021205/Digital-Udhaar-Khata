const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: [true, 'Transaction type is required'],
      // credit = customer took goods on udhaar (balance increases)
      // debit  = customer paid back (balance decreases)
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    billImageUrl: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SETTLED', 'FAILED', 'Cancelled', 'CANCELLED'],
      default: 'PENDING',
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'online', 'none'],
      default: 'none',
    },
    cashfreeOrderId: {
      type: String,
      trim: true,
    },
    cashfreePaymentId: {
      type: String,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    utr: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: '',
    },
    paymentGroup: {
      type: String,
      trim: true,
      default: '',
    },
    paymentTimestamp: {
      type: Date,
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // Blockchain Metadata (select: false prevents returning to frontend)
    blockIndex: {
      type: Number,
      default: null,
      select: false,
    },
    previousHash: {
      type: String,
      default: '',
      select: false,
    },
    blockHash: {
      type: String,
      default: '',
      select: false,
    },
    blockTimestamp: {
      type: String,
      default: '',
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for queries
transactionSchema.index({ customer: 1, date: -1 });
transactionSchema.index({ owner: 1, date: -1 });
transactionSchema.index({ cashfreeOrderId: 1 }, { unique: true, partialFilterExpression: { cashfreeOrderId: { $type: 'string' } } });
transactionSchema.index({ cashfreePaymentId: 1 }, { unique: true, partialFilterExpression: { cashfreePaymentId: { $type: 'string' } } });
transactionSchema.index({ razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: 'string' } } });
transactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } });
transactionSchema.index({ utr: 1 }, { unique: true, partialFilterExpression: { utr: { $type: 'string' } } });

module.exports = mongoose.model('Transaction', transactionSchema);
