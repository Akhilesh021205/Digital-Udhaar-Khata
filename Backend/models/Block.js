const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema(
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
      type: String,
      required: true,
    },
    data: {
      type: Object,
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
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure index uniqueness per owner
blockSchema.index({ owner: 1, index: 1 }, { unique: true });

module.exports = mongoose.model('Block', blockSchema);
