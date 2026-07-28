const BlockchainService = require('../services/blockchainService');

/**
 * Middleware to verify blockchain integrity on requests.
 * Runs verification transparently. If tampering is detected,
 * it records audit logs (handled in verifyChain) and prints a warning,
 * but lets the application keep running normally.
 */
const verifyBlockchain = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const device = req.headers['user-agent'] || 'Unknown Device';

      // Perform validation synchronously for safety but catch errors
      const result = await BlockchainService.verifyChain(req.user._id, {
        ipAddress,
        device,
      });

      if (!result.isValid) {
        console.warn(
          `⚠️ [SECURITY WARNING] Private ledger tampering detected for User: ${req.user._id}. Mismatched hashes: ${result.failedBlocks.length}.`
        );
      }
    }
    next();
  } catch (error) {
    // Fail-safe: keep application running even if verification errors out
    console.error('❌ Error during request blockchain verification:', error.message);
    next();
  }
};

module.exports = verifyBlockchain;
