const { calculateBlockHash } = require('./hash');
const { sign, getPublicKey } = require('./signature');

class Block {
  constructor(index, timestamp, transactionId, customerId, previousHash, hash, nonce, signature, publicKey) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactionId = transactionId;
    this.customerId = customerId;
    this.previousHash = previousHash;
    this.hash = hash;
    this.nonce = nonce;
    this.signature = signature;
    this.publicKey = publicKey;
    this.verificationStatus = true;
  }
}

class PrivateBlockchain {
  constructor(difficulty = 2) {
    this.difficulty = difficulty;
  }

  /**
   * Mine a new block (Proof of Work)
   */
  mineBlock(index, timestamp, transactionId, customerId, amount, transactionType, previousHash) {
    let nonce = 0;
    let hash = '';
    const prefix = '0'.repeat(this.difficulty);

    const timestampStr = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();

    do {
      hash = calculateBlockHash(
        previousHash,
        transactionId.toString(),
        customerId.toString(),
        amount,
        transactionType,
        timestampStr,
        nonce
      );
      if (!hash.startsWith(prefix)) {
        nonce++;
      }
    } while (!hash.startsWith(prefix));

    // Sign the mined hash
    const blockSignature = sign(hash);
    const publicKey = getPublicKey();

    return new Block(
      index,
      timestamp,
      transactionId,
      customerId,
      previousHash,
      hash,
      nonce,
      blockSignature,
      publicKey
    );
  }

  /**
   * Create genesis block for a user/owner
   */
  createGenesisBlock(ownerId) {
    const index = 0;
    const timestamp = new Date('2026-01-01T00:00:00.000Z');
    // Using a valid 24-character hex string for dummy ObjectIds
    const dummyId = '000000000000000000000000';
    const previousHash = '0';
    const amount = 0;
    const transactionType = 'GENESIS';

    const timestampStr = timestamp.toISOString();
    const hash = calculateBlockHash(
      previousHash,
      dummyId,
      dummyId,
      amount,
      transactionType,
      timestampStr,
      0
    );

    const blockSignature = sign(hash);
    const publicKey = getPublicKey();

    const block = new Block(
      index,
      timestamp,
      dummyId,
      dummyId,
      previousHash,
      hash,
      0,
      blockSignature,
      publicKey
    );

    block.owner = ownerId;
    return block;
  }
}

module.exports = {
  Block,
  PrivateBlockchain,
};
