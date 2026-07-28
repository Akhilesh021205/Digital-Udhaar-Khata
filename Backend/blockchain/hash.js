const crypto = require('crypto');

/**
 * Generate SHA-256 hash for blockchain block
 * Formula: previousHash + transactionId + customerId + amount + transactionType + timestamp + nonce
 * @param {string} previousHash 
 * @param {string} transactionId 
 * @param {string} customerId 
 * @param {number} amount 
 * @param {string} transactionType 
 * @param {string} timestamp 
 * @param {number} nonce 
 * @returns {string} Hex hash string
 */
function calculateBlockHash(previousHash, transactionId, customerId, amount, transactionType, timestamp, nonce = 0) {
  const input = 
    String(previousHash) + 
    String(transactionId) + 
    String(customerId) + 
    String(amount) + 
    String(transactionType) + 
    String(timestamp) + 
    String(nonce);
    
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = {
  calculateBlockHash,
};
