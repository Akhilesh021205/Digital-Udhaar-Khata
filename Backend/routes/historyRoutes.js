const express = require('express');
const router = express.Router();
const CustomerHistory = require('../models/CustomerHistory');
const { protect } = require('../middleware/authMiddleware');

// Authenticate all routes
router.use(protect);

// @desc    Get permanent customer ledger history logs
// @route   GET /api/history
router.get('/', async (req, res, next) => {
  try {
    const { search, customerId } = req.query;
    let query = { owner: req.user._id };

    if (customerId) {
      query.customerId = customerId;
    }

    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const history = await CustomerHistory.find(query)
      .populate('transactionId', 'billImageUrl')
      .sort({ date: -1 })
      .lean();

    const enrichedHistory = history.map((item) => {
      const billUrl = item.billImageUrl || (item.transactionId && item.transactionId.billImageUrl) || '';
      return {
        ...item,
        billImageUrl: billUrl,
        transactionId: item.transactionId?._id || item.transactionId || null,
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedHistory.length,
      data: enrichedHistory,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
