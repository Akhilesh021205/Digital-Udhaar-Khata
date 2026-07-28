const { calculateBlockHash } = require('./hash');
const { verify: verifySignature } = require('./signature');
const Blockchain = require('../models/Blockchain');
const AuditLog = require('../models/AuditLog');

/**
 * Verify if a single block's hash and signature are intact
 * @param {object} block Mongoose Blockchain document
 * @returns {boolean}
 */
function verifyBlock(block) {
  // 1. Recalculate block hash
  const recalculatedHash = calculateBlockHash(
    block.previousHash,
    block.transactionId,
    block.customerId,
    block.amount || 0, // In case amount is stored inside block
    block.transactionType || '', // In case transactionType is stored inside block
    block.timestamp.toISOString ? block.timestamp.toISOString() : new Date(block.timestamp).toISOString(),
    block.nonce
  );

  if (block.hash !== recalculatedHash) {
    return false;
  }

  // 2. Verify digital signature
  const isSignatureValid = verifySignature(block.hash, block.signature, block.publicKey);
  if (!isSignatureValid) {
    return false;
  }

  return true;
}

/**
 * Verify entire blockchain ledger for a specific owner/user
 * @param {ObjectId} ownerId 
 * @param {object} options Optional IP and device info for AuditLog
 * @returns {Promise<object>}
 */
async function verifyChain(ownerId, options = {}) {
  const ipAddress = options.ipAddress || '127.0.0.1';
  const device = options.device || 'System Cron';
  
  try {
    const chain = await Blockchain.find({ owner: ownerId }).sort({ index: 1 });
    let isValid = true;
    const tamperedBlocks = [];
    const verifiedBlocks = [];
    const failedBlocks = [];

    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];
      let blockValid = true;
      let reason = '';

      // 1. Check current block hash and signature integrity
      // For block data hashing, we need transaction parameters.
      // Since some transaction details (amount, type) are needed for the hash formula,
      // let's query the transaction if it is not embedded in the block.
      // Wait, let's load transaction details to rebuild the hash input.
      const Transaction = require('../models/Transaction');
      const tx = await Transaction.findById(block.transactionId);
      
      if (!tx) {
        blockValid = false;
        reason = 'Associated transaction not found';
      } else {
        const timestampStr = block.timestamp.toISOString ? block.timestamp.toISOString() : new Date(block.timestamp).toISOString();
        
        // Recalculate hash using the exact formula
        const recalculatedHash = calculateBlockHash(
          block.previousHash,
          block.transactionId.toString(),
          block.customerId.toString(),
          tx.amount,
          tx.type,
          timestampStr,
          block.nonce
        );

        if (block.hash !== recalculatedHash) {
          blockValid = false;
          reason = `Hash mismatch (Stored: ${block.hash}, Recalculated: ${recalculatedHash})`;
        } else {
          // Verify digital signature
          const isSigValid = verifySignature(block.hash, block.signature, block.publicKey);
          if (!isSigValid) {
            blockValid = false;
            reason = 'Digital signature invalid';
          }
        }
      }

      // 2. Verify chain linkage (if index > 0)
      if (blockValid && i > 0) {
        const previousBlock = chain[i - 1];
        if (block.previousHash !== previousBlock.hash) {
          blockValid = false;
          reason = `Chain broken: previousHash ${block.previousHash} does not match previous block hash ${previousBlock.hash}`;
        }
      }

      if (!blockValid) {
        isValid = false;
        failedBlocks.push(block.index);
        tamperedBlocks.push({ index: block.index, reason });

        // Update block's verificationStatus to false if it was true
        if (block.verificationStatus !== false) {
          block.verificationStatus = false;
          await block.save();

          // Save Audit Log
          await AuditLog.create({
            action: 'TAMPER_DETECTED',
            userId: ownerId,
            transactionId: block.transactionId,
            ipAddress,
            device,
            status: 'ALERT_TAMPERED',
          });
        }
      } else {
        verifiedBlocks.push(block.index);
        // Ensure verificationStatus is true if it was false
        if (block.verificationStatus !== true) {
          block.verificationStatus = true;
          await block.save();
        }
      }
    }

    return {
      isValid,
      totalBlocks: chain.length,
      verifiedBlocks: verifiedBlocks.length,
      failedBlocks: failedBlocks.length,
      tamperedBlocks,
    };
  } catch (error) {
    console.error('Error during blockchain verification:', error);
    throw error;
  }
}

module.exports = {
  verifyBlock,
  verifyChain,
};
