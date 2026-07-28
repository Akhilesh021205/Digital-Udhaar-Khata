const crypto = require('crypto');
const Transaction = require('../models/Transaction');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a Merkle Root hash from a list of strings (transaction IDs or block hashes)
 * @param {string[]} leaves Array of string data (like transaction IDs)
 * @returns {string} Merkle Root hash
 */
function generateMerkleRoot(leaves) {
  if (!leaves || leaves.length === 0) {
    return sha256('no_transactions');
  }

  // Hash each leaf first
  let level = leaves.map(leaf => sha256(leaf.toString()));

  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        // Pair two adjacent hashes
        nextLevel.push(sha256(level[i] + level[i + 1]));
      } else {
        // Duplicate the last leaf if there is an odd number of items
        nextLevel.push(sha256(level[i] + level[i]));
      }
    }
    level = nextLevel;
  }

  return level[0];
}

/**
 * Compute the Merkle Root of all transactions for a specific day and owner
 * @param {ObjectId} ownerId 
 * @param {Date|string} date 
 * @returns {Promise<string>} Merkle Root hash
 */
async function getDailyMerkleRoot(ownerId, date) {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const transactions = await Transaction.find({
    owner: ownerId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).sort({ date: 1 });

  const txIds = transactions.map(tx => tx._id.toString());
  return generateMerkleRoot(txIds);
}

module.exports = {
  generateMerkleRoot,
  getDailyMerkleRoot,
};
