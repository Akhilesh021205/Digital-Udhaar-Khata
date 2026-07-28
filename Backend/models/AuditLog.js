const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    device: {
      type: String,
      default: 'Unknown',
    },
    status: {
      type: String,
      default: 'SUCCESS',
    },
  },
  {
    timestamps: true,
    collection: 'AuditLogs', // Explicitly name the collection as required
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
