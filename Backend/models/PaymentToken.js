const mongoose = require('mongoose');

const paymentTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup upon expiry
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'USED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentTokenSchema.index({ customer: 1, status: 1 });
paymentTokenSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentToken', paymentTokenSchema);
