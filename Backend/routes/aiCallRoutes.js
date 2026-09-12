const express = require('express');
const router = express.Router();
const {
  startAiCall,
  sendAiSms,
  handleExomlPassthru,
  handleTtsAudio,
  handleGatherResponse
} = require('../controllers/aiCallController');
const { protect } = require('../middleware/authMiddleware');

// Public Exotel Webhook Callbacks (Unauthenticated for Exotel Server HTTP GET/POST)
router.all('/exoml', handleExomlPassthru);
router.all('/passthru', handleExomlPassthru);
router.all('/tts-audio', handleTtsAudio);
router.all('/gather-response', handleGatherResponse);

// Protected API Routes (Requires Shop Owner Authentication)
router.post('/start', protect, startAiCall);
router.post('/send-sms', protect, sendAiSms);

module.exports = router;

