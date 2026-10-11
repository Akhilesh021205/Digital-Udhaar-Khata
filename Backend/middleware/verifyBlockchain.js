const BlockchainService = require('../services/blockchainService');

// Throttle map to prevent repeated verification on rapid requests
const lastVerifiedMap = new Map();

/**
 * Middleware to verify blockchain integrity transparently.
 * Non-blocking: calls next() immediately so navigation/API responses are never delayed.
 * Executes background audit throttled to once every 10 minutes per user.
 */
const verifyBlockchain = (req, res, next) => {
  // Always unblock the request pipeline immediately for high-performance response times
  next();

  try {
    if (req.user && req.user._id) {
      const userIdStr = req.user._id.toString();
      const lastRun = lastVerifiedMap.get(userIdStr) || 0;
      const TEN_MINUTES = 10 * 60 * 1000;

      // Only perform background verification if 10 minutes have elapsed since last check
      if (Date.now() - lastRun > TEN_MINUTES) {
        lastVerifiedMap.set(userIdStr, Date.now());

        const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        const device = req.headers['user-agent'] || 'Unknown Device';

        setImmediate(async () => {
          try {
            const result = await BlockchainService.verifyChain(req.user._id, {
              ipAddress,
              device,
            });

            if (!result.isValid) {
              const failedCount = typeof result.failedBlocks === 'number' 
                ? result.failedBlocks 
                : (Array.isArray(result.failedBlocks) ? result.failedBlocks.length : 0);
              console.warn(
                `⚠️ [SECURITY WARNING] Private ledger tampering detected for User: ${userIdStr}. Mismatched hashes: ${failedCount}.`
              );
            }
          } catch (err) {
            console.error('❌ Background blockchain verification error:', err.message);
          }
        });
      }
    }
  } catch (error) {
    // Fail-safe
  }
};

module.exports = verifyBlockchain;

