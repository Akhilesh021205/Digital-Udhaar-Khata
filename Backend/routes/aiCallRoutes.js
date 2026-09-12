const express = require('express');
const router = express.Router();
const { startAiCall, sendAiSms } = require('../controllers/aiCallController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/start', startAiCall);
router.post('/send-sms', sendAiSms);

module.exports = router;
