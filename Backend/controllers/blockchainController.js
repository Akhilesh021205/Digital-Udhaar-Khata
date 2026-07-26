const { BlockchainService } = require('../services/blockchainService');

// @desc    Get complete blockchain for authenticated owner
// @route   GET /api/blockchain/chain
const getChain = async (req, res, next) => {
  try {
    const auditResult = await BlockchainService.validateChain(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        isValid: auditResult.isValid,
        totalBlocks: auditResult.totalBlocks,
        tamperedCount: auditResult.tamperedCount,
        tamperedBlocks: auditResult.tamperedBlocks,
        chain: auditResult.chain,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Audit & validate blockchain integrity
// @route   GET /api/blockchain/verify
const verifyChain = async (req, res, next) => {
  try {
    const auditResult = await BlockchainService.validateChain(req.user._id);

    res.status(200).json({
      success: true,
      message: auditResult.isValid
        ? 'Blockchain audit passed: All financial record blocks are verified and immutable.'
        : 'Blockchain audit alert: Tampered or corrupted blocks detected in financial records!',
      data: auditResult,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify a single transaction's block integrity
// @route   GET /api/blockchain/verify-transaction/:id
const verifyTransaction = async (req, res, next) => {
  try {
    const result = await BlockchainService.verifyTransactionIntegrity(req.params.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChain,
  verifyChain,
  verifyTransaction,
};
