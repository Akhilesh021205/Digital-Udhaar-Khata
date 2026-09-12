const mongoose = require('mongoose');

const aiCallHistorySchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      enum: ['te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN'],
      default: 'te-IN',
    },
    phoneType: {
      type: String,
      enum: ['smartphone', 'basic'],
      default: 'smartphone',
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    callDate: {
      type: Date,
      default: Date.now,
    },
    callStatus: {
      type: String,
      enum: ['completed', 'failed', 'no_answer'],
      default: 'completed',
    },
    customerResponse: {
      type: String,
      default: '',
    },
    aiSummary: {
      type: String,
      default: '',
    },
    resultStatus: {
      type: String,
      enum: ['PAID_TODAY_PROMISE', 'PROMISE_TO_PAY', 'NEEDS_MORE_TIME', 'DISPUTE', 'TRANSFER_TO_OWNER', 'NO_RESPONSE'],
      default: 'PROMISE_TO_PAY',
    },
    promisedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

aiCallHistorySchema.index({ customerId: 1, callDate: -1 });
aiCallHistorySchema.index({ owner: 1, callDate: -1 });

module.exports = mongoose.model('AiCallHistory', aiCallHistorySchema);
