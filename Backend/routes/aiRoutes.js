const express = require('express');
const router = express.Router();
const {
  voiceEntry,
  chatAssistant,
  initiateAiVoiceCall,
  respondAiVoiceCall,
  getAiCallHistory,
  makeRealPhoneCall,
  handleTwilioTwiml,
  handleTwilioGather,
  handleTwilioStatus,
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// Public Webhooks for Cloud Telephony (Twilio / Exotel)
router.all('/voice-call/twilio-twiml', handleTwilioTwiml);
router.all('/voice-call/twilio-gather', handleTwilioGather);
router.post('/voice-call/twilio-status', handleTwilioStatus);

// Protected Routes
router.use(protect);

router.post('/voice-entry', voiceEntry);
router.post('/chat', chatAssistant);
router.post('/voice-call/initiate', initiateAiVoiceCall);
router.post('/voice-call/respond', respondAiVoiceCall);
router.post('/voice-call/make-real-call', makeRealPhoneCall);
router.get('/voice-call/history/:customerId', getAiCallHistory);

module.exports = router;

