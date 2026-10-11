const express = require('express');
const router = express.Router();
const CustomerHistory = require('../models/CustomerHistory');
const { protect } = require('../middleware/authMiddleware');
const cache = require('../utils/cache');

// Authenticate all routes
router.use(protect);

// @desc    Get permanent customer ledger history logs
// @route   GET /api/history
router.get('/', async (req, res, next) => {
  try {
    const { search, customerId, limit } = req.query;
    const queryLimit = parseInt(limit) || 100;

    // Check Cache (15s TTL)
    const cacheKey = `history_${req.user._id}_${search || ''}_${customerId || ''}_${queryLimit}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

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
      .limit(queryLimit)
      .lean();

    const enrichedHistory = history.map((item) => {
      const billUrl = item.billImageUrl || (item.transactionId && item.transactionId.billImageUrl) || '';
      return {
        ...item,
        billImageUrl: billUrl,
        transactionId: item.transactionId?._id || item.transactionId || null,
      };
    });

    const payload = {
      success: true,
      count: enrichedHistory.length,
      data: enrichedHistory,
    };

    cache.set(cacheKey, payload, 15000);

    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
