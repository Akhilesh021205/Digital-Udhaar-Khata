const crypto = require('crypto');
const BlockModel = require('../models/Block');
const TransactionModel = require('../models/Transaction');

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const stringToHash = this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash;
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
  }
}

class BlockchainService {
  /**
   * Calculate SHA-256 hash for block components
   */
  static calculateHash(index, timestamp, data, previousHash) {
    const stringToHash = index + timestamp + JSON.stringify(data) + previousHash;
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
  }

  /**
   * Get or initialize Genesis Block for an owner
   */
  static async getOrCreateGenesisBlock(ownerId) {
    let genesisBlock = await BlockModel.findOne({ owner: ownerId, index: 0 });

    if (!genesisBlock) {
      const timestamp = new Date('2026-01-01T00:00:00.000Z').toISOString();
      const genesisData = { message: 'Genesis Block - Digital Udhaar Khata Private Ledger' };
      const previousHash = '0';
      const hash = this.calculateHash(0, timestamp, genesisData, previousHash);

      genesisBlock = await BlockModel.create({
        owner: ownerId,
        index: 0,
        timestamp,
        data: genesisData,
        previousHash,
        hash,
      });
    }

    return genesisBlock;
  }

  /**
   * Get latest block for an owner
   */
  static async getLatestBlock(ownerId) {
    let latest = await BlockModel.findOne({ owner: ownerId }).sort({ index: -1 });
    if (!latest) {
      latest = await this.getOrCreateGenesisBlock(ownerId);
    }
    return latest;
  }

  /**
   * Mine/Create a new block for a transaction and save to MongoDB
   */
  static async addTransactionBlock(ownerId, transactionData, transactionId) {
    try {
      const latestBlock = await this.getLatestBlock(ownerId);
      const nextIndex = latestBlock.index + 1;
      const timestamp = new Date().toISOString();
      const previousHash = latestBlock.hash;

      const payload = {
        transactionId: transactionId.toString(),
        customerId: transactionData.customer ? transactionData.customer.toString() : '',
        type: transactionData.type,
        amount: transactionData.amount,
        description: transactionData.description || '',
        paymentStatus: transactionData.paymentStatus || 'PENDING',
        paymentMode: transactionData.paymentMode || 'none',
        date: transactionData.date ? new Date(transactionData.date).toISOString() : timestamp,
      };

      const newBlockObj = new Block(nextIndex, timestamp, payload, previousHash);

      // Save block to DB
      const blockDoc = await BlockModel.create({
        owner: ownerId,
        index: newBlockObj.index,
        timestamp: newBlockObj.timestamp,
        data: newBlockObj.data,
        previousHash: newBlockObj.previousHash,
        hash: newBlockObj.hash,
        transactionId: transactionId,
      });

      // Update Transaction document with block metadata
      if (transactionId) {
        await TransactionModel.findByIdAndUpdate(transactionId, {
          blockIndex: newBlockObj.index,
          previousHash: newBlockObj.previousHash,
          blockHash: newBlockObj.hash,
          blockTimestamp: newBlockObj.timestamp,
        });
      }

      return blockDoc;
    } catch (error) {
      console.error('Error adding transaction block to private blockchain:', error);
      throw error;
    }
  }

  /**
   * Validate entire blockchain for a store owner
   */
  static async validateChain(ownerId) {
    try {
      // Ensure genesis block exists
      await this.getOrCreateGenesisBlock(ownerId);

      const chain = await BlockModel.find({ owner: ownerId }).sort({ index: 1 });
      const tamperedBlocks = [];
      let isValid = true;

      for (let i = 0; i < chain.length; i++) {
        const currentBlock = chain[i];

        // 1. Recalculate block hash
        const recalculatedHash = this.calculateHash(
          currentBlock.index,
          currentBlock.timestamp,
          currentBlock.data,
          currentBlock.previousHash
        );

        if (currentBlock.hash !== recalculatedHash) {
          isValid = false;
          tamperedBlocks.push({
            index: currentBlock.index,
            reason: 'Block hash mismatch (Payload or hash modified)',
            expectedHash: recalculatedHash,
            actualHash: currentBlock.hash,
          });
        }

        // 2. Validate hash chain link (for blocks > 0)
        if (i > 0) {
          const previousBlock = chain[i - 1];
          if (currentBlock.previousHash !== previousBlock.hash) {
            isValid = false;
            tamperedBlocks.push({
              index: currentBlock.index,
              reason: 'Chain link broken (previousHash does not match previous block hash)',
              expectedPreviousHash: previousBlock.hash,
              actualPreviousHash: currentBlock.previousHash,
            });
          }
        }
      }

      return {
        isValid,
        totalBlocks: chain.length,
        tamperedCount: tamperedBlocks.length,
        tamperedBlocks,
        chain,
      };
    } catch (error) {
      console.error('Error validating blockchain:', error);
      throw error;
    }
  }

  /**
   * Verify integrity of a single transaction against its block
   */
  static async verifyTransactionIntegrity(transactionId) {
    const transaction = await TransactionModel.findById(transactionId);
    if (!transaction || transaction.blockIndex === null) {
      return { isVerified: false, reason: 'Transaction has no associated blockchain block.' };
    }

    const block = await BlockModel.findOne({
      transactionId: transaction._id,
      index: transaction.blockIndex,
    });

    if (!block) {
      return { isVerified: false, reason: 'Block document missing from blockchain ledger.' };
    }

    // Verify block hash matches transaction metadata
    if (transaction.blockHash !== block.hash) {
      return { isVerified: false, reason: 'Transaction metadata does not match block hash.' };
    }

    // Verify payload matches block data
    const recalculatedHash = this.calculateHash(
      block.index,
      block.timestamp,
      block.data,
      block.previousHash
    );

    if (recalculatedHash !== block.hash) {
      return { isVerified: false, reason: 'Block payload tampered.' };
    }

    return { isVerified: true, blockIndex: block.index, blockHash: block.hash, timestamp: block.timestamp };
  }
}

module.exports = {
  Block,
  BlockchainService,
};
