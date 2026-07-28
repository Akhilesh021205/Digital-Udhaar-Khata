const mongoose = require('mongoose');

const blockchainSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    index: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    previousHash: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
    nonce: {
      type: Number,
      default: 0,
      required: true,
    },
    verificationStatus: {
      type: Boolean,
      default: true,
    },
    signature: {
      type: String,
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'Blockchain', // Explicitly name the collection as required
  }
);

// Ensure index uniqueness per owner
blockchainSchema.index({ owner: 1, index: 1 }, { unique: true });

module.exports = mongoose.model('Blockchain', blockchainSchema);
