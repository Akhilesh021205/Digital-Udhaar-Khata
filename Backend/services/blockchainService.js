const BlockchainModel = require('../models/Blockchain');
const TransactionModel = require('../models/Transaction');
const { PrivateBlockchain } = require('../blockchain/blockchain');
const { calculateBlockHash } = require('../blockchain/hash');
const { verifyChain } = require('../blockchain/verify');

const blockchainInstance = new PrivateBlockchain(2); // Difficulty = 2

class BlockchainService {
  /**
   * Calculate hash for block components (Wrapper)
   */
  static calculateHash(previousHash, transactionId, customerId, amount, transactionType, timestamp, nonce) {
    return calculateBlockHash(previousHash, transactionId, customerId, amount, transactionType, timestamp, nonce);
  }

  /**
   * Get latest block for an owner
   * @param {ObjectId} ownerId 
   * @returns {Promise<object>}
   */
  static async getLatestBlock(ownerId) {
    let latest = await BlockchainModel.findOne({ owner: ownerId }).sort({ index: -1 });
    if (!latest) {
      latest = await this.createGenesisBlock(ownerId);
    }
    return latest;
  }

  /**
   * Create and save Genesis Block for an owner
   * @param {ObjectId} ownerId 
   * @returns {Promise<object>}
   */
  static async createGenesisBlock(ownerId) {
    let genesisBlock = await BlockchainModel.findOne({ owner: ownerId, index: 0 });

    if (!genesisBlock) {
      const blockData = blockchainInstance.createGenesisBlock(ownerId);

      genesisBlock = await BlockchainModel.create({
        owner: ownerId,
        index: blockData.index,
        timestamp: blockData.timestamp,
        transactionId: blockData.transactionId,
        customerId: blockData.customerId,
        previousHash: blockData.previousHash,
        hash: blockData.hash,
        nonce: blockData.nonce,
        verificationStatus: blockData.verificationStatus,
        signature: blockData.signature,
        publicKey: blockData.publicKey,
      });
    }

    return genesisBlock;
  }

  /**
   * Mine and create a new block for a transaction, then save to MongoDB
   * @param {ObjectId} ownerId 
   * @param {ObjectId} transactionId 
   * @param {ObjectId} customerId 
   * @param {number} amount 
   * @param {string} transactionType 
   * @returns {Promise<object>}
   */
  static async createBlock(ownerId, transactionId, customerId, amount, transactionType) {
    try {
      const latestBlock = await this.getLatestBlock(ownerId);
      const nextIndex = latestBlock.index + 1;
      const timestamp = new Date();
      const previousHash = latestBlock.hash;

      // Mine block using Proof of Work
      const minedBlock = blockchainInstance.mineBlock(
        nextIndex,
        timestamp,
        transactionId,
        customerId,
        amount,
        transactionType,
        previousHash
      );

      // Save block to collection named 'Blockchain'
      const blockDoc = await BlockchainModel.create({
        owner: ownerId,
        index: minedBlock.index,
        timestamp: minedBlock.timestamp,
        transactionId: minedBlock.transactionId,
        customerId: minedBlock.customerId,
        previousHash: minedBlock.previousHash,
        hash: minedBlock.hash,
        nonce: minedBlock.nonce,
        verificationStatus: minedBlock.verificationStatus,
        signature: minedBlock.signature,
        publicKey: minedBlock.publicKey,
      });

      // Update Transaction document with new block metadata (invisible updates)
      if (transactionId) {
        await TransactionModel.findByIdAndUpdate(transactionId, {
          blockIndex: minedBlock.index,
          previousHash: minedBlock.previousHash,
          blockHash: minedBlock.hash,
          blockTimestamp: minedBlock.timestamp.toISOString(),
        });
      }

      return blockDoc;
    } catch (error) {
      console.error('Error creating block in blockchainService:', error);
      throw error;
    }
  }

  /**
   * Verify the entire blockchain for an owner
   * @param {ObjectId} ownerId 
   * @param {object} options Optional IP and device details
   * @returns {Promise<object>}
   */
  static async verifyChain(ownerId, options = {}) {
    return await verifyChain(ownerId, options);
  }

  /**
   * Scheduled cron verification for all users
   */
  static async runScheduledAudit() {
    try {
      const User = require('../models/User');
      const users = await User.find({});
      
      for (const user of users) {
        const result = await verifyChain(user._id, {
          ipAddress: '127.0.0.1',
          device: 'System Scheduler',
        });

        if (!result.isValid) {
          console.warn(
            `⚠️ [SECURITY CRITICAL] Scheduled audit detected ledger tampering for user: ${user.email} (${user._id}). Mismatched blocks: ${result.failedBlocks.length}.`
          );
        }
      }
    } catch (error) {
      console.error('❌ Error during scheduled blockchain verification:', error.message);
    }
  }
}

module.exports = BlockchainService;
