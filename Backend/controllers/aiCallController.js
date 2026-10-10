const Customer = require('../models/Customer');
const { initiateOutboundCall, sendPaymentReminderSMS } = require('../services/exotelService');
const { createCallSession, getCallSession } = require('../services/callSessionStore');
const { generateSpeech, createWavBuffer } = require('../services/sarvamService');
const AiCallHistory = require('../models/AiCallHistory');

/**
 * @desc    Start an automated AI Payment Reminder Phone Call via Exotel Flow 1340037
 * @route   POST /api/ai-calls/start
 * @access  Private (Authenticated Shop Owner)
 */
const startAiCall = async (req, res, next) => {
  try {
    const { customerId, language: requestedLanguage } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'customerId is required'
      });
    }

    // Retrieve customer securely from database and verify ownership
    const customer = await Customer.findOne({
      _id: customerId,
      owner: req.user._id,
      isDeleted: { $ne: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or unauthorized'
      });
    }

    if (!customer.phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer does not have a valid phone number'
      });
    }

    if (customer.aiReminderEnabled === false) {
      return res.status(400).json({
        success: false,
        message: 'AI Voice Reminders are disabled for this customer'
      });
    }

    if (requestedLanguage) {
      customer.preferredLanguage = requestedLanguage;
      await customer.save();
    }

    const selectedLanguage = requestedLanguage || customer.preferredLanguage || 'te-IN';
    const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const dueAmount = customer.balance || 0;
    const shopName = req.user?.storeName || req.user?.name || 'Digital Udhaar Khata';

    // Prepare native speech text script in selected language
    let reminderText = `నమస్కారం ${customer.name} గారు. మీ ఖాతాలో ₹${dueAmount} పెండింగ్లో ఉంది. ఈ చెల్లింపు గురించి మీకు గుర్తు చేయడానికి కాల్ చేశాను. మీరు ఈరోజు చెల్లించగలరా?`;

    if (selectedLanguage === 'hi-IN' || selectedLanguage === 'hi') {
      reminderText = `नमस्ते ${customer.name} जी। आपके खाते में ₹${dueAmount} बकाया है। मैं इस भुगतान की याद दिलाने के लिए कॉल कर रहा हूँ। क्या आप आज भुगतान कर सकते हैं?`;
    } else if (selectedLanguage === 'en-IN' || selectedLanguage === 'en') {
      reminderText = `Hello ${customer.name}. You have an outstanding payment of ₹${dueAmount}. I am calling to remind you about this payment. Can you make the payment today?`;
    } else if (selectedLanguage === 'ta-IN' || selectedLanguage === 'ta') {
      reminderText = `வணக்கம் ${customer.name}. உங்கள் கணக்கில் ₹${dueAmount} நிலுவையில் உள்ளது. இந்த பணத்தை நினைவூட்ட அழைக்கிறோம். இன்று செலுத்த முடியுமா?`;
    } else if (selectedLanguage === 'kn-IN' || selectedLanguage === 'kn') {
      reminderText = `ನಮಸ್ಕಾರ ${customer.name} ಅವರೇ. ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ₹${dueAmount} ಬಾಕಿ ಇದೆ. ಈ ಪಾವತಿಯನ್ನು ನೆನಪಿಸಲು ಕರೆ ಮಾಡುತ್ತಿದ್ದೇವೆ. ಇಂದು ಪಾವತಿಸಬಹುದೇ?`;
    }

    // Store call session context securely for Exotel Voicebot lookup
    const sessionObj = createCallSession({
      sessionId,
      customerId: customer._id.toString(),
      ownerId: req.user._id.toString(),
      customerName: customer.name,
      shopName,
      phone: customer.phone,
      language: selectedLanguage,
      amount: dueAmount,
      speechText: reminderText
    });

    // Asynchronously pre-generate Sarvam TTS audio buffer while Exotel initiates phone call
    generateSpeech(reminderText, selectedLanguage, 8000).then(({ wavBuffer, pcmBuffer, audioBuffer }) => {
      const finalBuffer = wavBuffer || (pcmBuffer ? createWavBuffer(pcmBuffer, 8000) : audioBuffer);
      if (finalBuffer && finalBuffer.length > 0) {
        const { updateCallSession } = require('../services/callSessionStore');
        updateCallSession(sessionId, { wavBuffer: finalBuffer });
        console.log(`[PRE-GEN TTS] Successfully pre-cached Sarvam audio buffer for session ${sessionId} (${finalBuffer.length} bytes WAV)`);
      }
    }).catch(err => {
      console.error('[PRE-GEN TTS ERROR] Asynchronous pre-generation failed:', err.message);
    });

    // Request Exotel to initiate call using ExoML Webhook
    const result = await initiateOutboundCall({
      toPhone: customer.phone,
      callSessionId: sessionId,
      customerName: customer.name,
      shopName,
      amount: dueAmount,
      language: selectedLanguage
    });

    // Update customer last AI call state
    customer.lastAiCall = new Date();
    customer.lastAiCallStatus = result.realCallInitiated ? 'calling' : 'failed';
    await customer.save();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to start AI call via Exotel'
      });
    }

    res.status(200).json({
      success: true,
      message: result.message || 'AI payment reminder call started',
      callId: sessionId,
      data: {
        realCallInitiated: result.realCallInitiated,
        status: result.status,
        provider: result.provider,
        phone: result.phone
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send Payment Reminder SMS via Exotel SMS API
 * @route   POST /api/ai-calls/send-sms
 * @access  Private (Authenticated Shop Owner)
 */
const sendAiSms = async (req, res, next) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'customerId is required'
      });
    }

    // Retrieve customer securely from database and verify ownership
    const customer = await Customer.findOne({
      _id: customerId,
      owner: req.user._id,
      isDeleted: { $ne: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or unauthorized'
      });
    }

    if (!customer.phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer does not have a valid phone number'
      });
    }

    const dueAmount = customer.balance || 0;
    const smsMessage = `Hi ${customer.name}, this is a payment reminder from your shop. Your pending amount is ₹${dueAmount.toLocaleString('en-IN')}. Please make the payment when convenient. Thank you.`;

    const result = await sendPaymentReminderSMS({
      toPhone: customer.phone,
      text: smsMessage
    });

    res.status(200).json({
      success: result.success,
      message: result.message || 'Payment reminder SMS sent successfully',
      data: {
        phone: result.phone,
        smsSid: result.smsSid
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    ExoML Passthrough webhook for Exotel calls (Plays speech & gathers DTMF)
 * @route   GET/POST /api/ai-calls/exoml
 * @access  Public (Exotel Server Callback)
 */
const handleExomlPassthru = async (req, res) => {
  try {
    const callSessionId = req.query.callSessionId || req.body.callSessionId || req.query.sessionId || req.body.sessionId || req.query.CustomField || req.body.CustomField;
    const phone = req.query.From || req.body.From || req.query.CallerId || req.body.CallerId;
    
    let session = getCallSession(callSessionId) || getCallSession(phone);

    const customerName = session ? session.customerName : 'Customer';
    const shopName = session ? session.shopName : 'Digital Udhaar Khata';
    const amount = session ? Math.abs(session.amount) : 0;
    const language = session ? session.language : 'te-IN';

    console.log(`[EXOML WEBHOOK] Customer Answered Phone Call -> SessionId: ${callSessionId || phone || 'unknown'} (${customerName}, ${language}, Balance: ₹${amount})`);

    // Prepare native script message in selected language
    let text = session?.speechText || `నమస్కారం ${customerName} గారు. మీ ఖాతాలో ₹${amount} పెండింగ్లో ఉంది. ఈ చెల్లింపు గురించి మీకు గుర్తు చేయడానికి కాల్ చేశాను. మీరు ఈరోజు చెల్లించగలరా?`;

    if (!session?.speechText) {
      if (language === 'hi-IN' || language === 'hi') {
        text = `नमस्ते ${customerName} जी। आपके खाते में ₹${amount} बकाया है। मैं इस भुगतान की याद दिलाने के लिए कॉल कर रहा हूँ। क्या आप आज भुगतान कर सकते हैं?`;
      } else if (language === 'en-IN' || language === 'en') {
        text = `Hello ${customerName}. You have an outstanding payment of ₹${amount}. I am calling to remind you about this payment. Can you make the payment today?`;
      } else if (language === 'ta-IN' || language === 'ta') {
        text = `வணக்கம் ${customerName}. உங்கள் கணக்கில் ₹${amount} நிலுவையில் உள்ளது. இந்த பணத்தை நினைவூட்ட அழைக்கிறோம். இன்று செலுத்த முடியுமா?`;
      } else if (language === 'kn-IN' || language === 'kn') {
        text = `ನಮಸ್ಕಾರ ${customerName} ಅವರೇ. ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ₹${amount} ಬಾಕಿ ಇದೆ. ಈ ಪಾವತಿಯನ್ನು ನೆನಪಿಸಲು ಕರೆ ಮಾಡುತ್ತಿದ್ದೇವೆ. ಇಂದು ಪಾವತಿಸಬಹುದೇ?`;
      }
    }

    const host = req.get('host') || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;

    const sessionKey = session ? session.sessionId : (callSessionId || '');
    const gatherActionUrl = `${baseUrl}/api/ai-calls/gather-response?sessionId=${encodeURIComponent(sessionKey)}`;
    // Note: XML requires ampersands in attributes to be escaped as &amp;
    const ttsAudioUrl = `${baseUrl}/api/ai-calls/tts-audio.wav?sessionId=${encodeURIComponent(sessionKey)}&amp;lang=${encodeURIComponent(language)}&amp;text=${encodeURIComponent(text)}`;

    console.log(`[EXOML INSTRUCTIONS GENERATED] Sending ExoML <Gather> with audio URL: ${ttsAudioUrl}`);

    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather action="${gatherActionUrl}" method="POST" numDigits="1" timeout="10">
        <Play>${ttsAudioUrl}</Play>
    </Gather>
    <Say voice="female" language="en-IN">Thank you. Have a great day.</Say>
</Response>`);
  } catch (err) {
    console.error('[EXOML PASSTHRU ERROR] Failed to process webhook:', err.message);
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="female">Hello, this is an automated payment reminder from Digital Udhaar Khata. Thank you.</Say>
</Response>`);
  }
};

/**
 * @desc    Serve synthesized Sarvam AI TTS audio file for Exotel <Play> tag
 * @route   GET /api/ai-calls/tts-audio /api/ai-calls/tts-audio.wav
 * @access  Public
 */
const handleTtsAudio = async (req, res) => {
  const startTime = Date.now();
  try {
    const sessionId = req.query.sessionId || req.query.callSessionId;
    const session = sessionId ? getCallSession(sessionId) : null;

    // Check if pre-generated audio buffer exists in session
    if (session && session.wavBuffer && Buffer.isBuffer(session.wavBuffer) && session.wavBuffer.length > 0) {
      console.log(`[EXOTEL TTS SUCCESS] Serving pre-cached Sarvam WAV buffer instantly (0ms) -> Session: ${sessionId}`);
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': session.wavBuffer.length,
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      });
      return res.send(session.wavBuffer);
    }

    const text = req.query.text || session?.speechText || 'Hello, this is an automated payment reminder.';
    const lang = req.query.lang || session?.language || 'te-IN';

    console.log(`[EXOTEL TTS REQUEST] Dynamic Sarvam TTS generation -> Lang: ${lang}, Text: "${text}"`);

    const { audioBuffer, wavBuffer, pcmBuffer } = await generateSpeech(text, lang, 8000);
    const finalWavBuffer = wavBuffer || (pcmBuffer ? createWavBuffer(pcmBuffer, 8000) : audioBuffer);

    if (finalWavBuffer && finalWavBuffer.length > 0) {
      console.log(`[EXOTEL TTS SUCCESS] Dynamic audio generated in ${Date.now() - startTime}ms (${finalWavBuffer.length} bytes WAV)`);
      if (session) {
        session.wavBuffer = finalWavBuffer;
      }
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': finalWavBuffer.length,
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      });
      return res.send(finalWavBuffer);
    }

    console.error(`[EXOTEL TTS FAIL] No audio buffer returned from Sarvam TTS`);
    return res.status(404).send('Audio generation failed');
  } catch (err) {
    console.error('[EXOTEL TTS ERROR] Exception in handleTtsAudio:', err.message);
    res.status(500).send('Server Error');
  }
};

/**
 * @desc    Handle Customer DTMF Keypress (1: Pay Today, 2: Pay Tomorrow, 3: Need Time)
 * @route   POST/GET /api/ai-calls/gather-response
 * @access  Public (Exotel Webhook Callback)
 */
const handleGatherResponse = async (req, res) => {
  try {
    const digits = req.query.Digits || req.body.Digits || req.query.digits || req.body.digits;
    const sessionId = req.query.sessionId || req.body.sessionId || req.query.CustomField || req.body.CustomField;
    const phone = req.query.From || req.body.From;

    console.log(`[CUSTOMER DTMF KEYPRESS] Received key: ${digits} for session ${sessionId || phone}`);

    const session = getCallSession(sessionId) || getCallSession(phone);
    let replyText = 'Thank you for your response. Have a great day!';
    let language = session ? session.language : 'te-IN';

    if (session && session.customerId) {
      const now = new Date();
      let promisedDate = null;
      let status = 'PROMISE_TO_PAY';
      let summary = `Customer pressed keypad key ${digits}`;

      if (digits === '1') {
        promisedDate = now;
        summary = 'Customer promised to pay today (Key 1 pressed)';
        replyText = language.startsWith('te') 
          ? 'ధన్యవాదాలు. మీరు ఈరోజు చెల్లింపు చేస్తారని నమోదు చేసాము.' 
          : 'Thank you. We have recorded that you will make the payment today.';
      } else if (digits === '2') {
        promisedDate = new Date(now);
        promisedDate.setDate(promisedDate.getDate() + 1);
        summary = 'Customer promised to pay tomorrow (Key 2 pressed)';
        replyText = language.startsWith('te')
          ? 'ధన్యవాదాలు. మీరు రేపు చెల్లింపు చేస్తారని నమోదు చేసాము.'
          : 'Thank you. We have recorded that you will make the payment tomorrow.';
      } else if (digits === '3') {
        status = 'NEEDS_MORE_TIME';
        summary = 'Customer requested more time (Key 3 pressed)';
        replyText = language.startsWith('te')
          ? 'సరేనండి. మీకు మరికొంత సమయం కావాలని నమోదు చేసాము.'
          : 'Thank you. We have noted that you need more time.';
      }

      await Customer.findByIdAndUpdate(session.customerId, {
        lastAiCall: now,
        lastAiCallStatus: 'completed',
        lastAiResponse: summary,
        lastAiResultStatus: status,
        ...(promisedDate && { promiseToPayDate: promisedDate })
      });

      await AiCallHistory.create({
        customerId: session.customerId,
        owner: session.ownerId,
        callStatus: 'completed',
        callType: 'exotel_voicebot',
        language: session.language || 'te-IN',
        amountDiscussed: session.amount,
        resultStatus: status,
        promisedDate,
        summary,
        rawTranscript: `DTMF Key ${digits}`
      });
    }

    const host = req.get('host') || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
    const replyAudioUrl = `${baseUrl}/api/ai-calls/tts-audio?text=${encodeURIComponent(replyText)}&lang=${encodeURIComponent(language)}`;

    console.log(`[AI RESPONSE AUDIO] Replying to DTMF key ${digits} with TTS: "${replyText}"`);

    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${replyAudioUrl}</Play>
</Response>`);
  } catch (err) {
    console.error('[DTMF GATHER ERROR]:', err.message);
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="female">Thank you for your response. Goodbye.</Say>
</Response>`);
  }
};

/**
 * @desc    Terminate an active AI Call via Exotel API
 * @route   POST /api/ai-calls/stop
 * @access  Private
 */
const stopAiCall = async (req, res, next) => {
  try {
    const { callSid } = req.body;
    const { hangupCall } = require('../services/exotelService');

    let result = { success: true, message: 'Call ended' };
    if (callSid) {
      result = await hangupCall(callSid);
    }

    res.status(200).json({
      success: true,
      message: result.message || 'AI Call ended successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startAiCall,
  sendAiSms,
  stopAiCall,
  handleExomlPassthru,
  handleTtsAudio,
  handleGatherResponse
};

