const express = require('express');
const router = express.Router();
const { getChain, verifyChain, verifyTransaction } = require('../controllers/blockchainController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/chain', getChain);
router.get('/verify', verifyChain);
router.get('/verify-transaction/:id', verifyTransaction);

module.exports = router;
