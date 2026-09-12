const Customer = require('../models/Customer');
const { initiateOutboundCall, sendPaymentReminderSMS } = require('../services/exotelService');
const { createCallSession, getCallSession } = require('../services/callSessionStore');
const { generateSpeech } = require('../services/sarvamService');
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

    // Store call session context securely for Exotel Voicebot lookup
    createCallSession({
      sessionId,
      customerId: customer._id.toString(),
      ownerId: req.user._id.toString(),
      customerName: customer.name,
      shopName,
      phone: customer.phone,
      language: selectedLanguage,
      amount: dueAmount
    });

    // Request Exotel to initiate call using Flow 1340037 / ExoML Webhook
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

    console.log(`[EXOML PASSTHRU] Incoming call session: ${callSessionId || phone || 'unknown'} (${customerName}, ${language})`);

    // Prepare clear message in selected language
    let text = `Namaskaram ${customerName} garu, idhi ${shopName} nundi payment reminder call. Meeku ${amount} roopayalu bakayi undhi. Kripachesi twaraga chellinchandi. Eeroju kattedhaniki 1 nokkandi, repati kosam 2 nokkandi, leda samayam kavalante 3 nokkandi. Dhanyavadamulu.`;

    if (language === 'hi-IN' || language === 'hi') {
      text = `Namaste ${customerName} ji, yeh ${shopName} ki taraf se bhugtan reminder call hai. Aapka ${amount} rupaye baaki hai. Kripya jald bhugtan karein. Aaj pay karne ke liye 1 dabayein, kal ke liye 2 dabayein, ya samay chahiye toh 3 dabayein. Dhanyawad.`;
    } else if (language === 'en-IN' || language === 'en') {
      text = `Hello ${customerName}, this is an automated payment reminder from ${shopName}. You have a pending amount of rupees ${amount}. Please pay at your earliest convenience. Press 1 to pay today, press 2 for tomorrow, or press 3 if you need more time. Thank you.`;
    }

    const host = req.get('host') || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;

    const gatherActionUrl = `${baseUrl}/api/ai-calls/gather-response?sessionId=${encodeURIComponent(session ? session.sessionId : callSessionId || '')}`;
    const ttsAudioUrl = `${baseUrl}/api/ai-calls/tts-audio?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(language)}`;

    // Try Sarvam AI TTS audio stream
    const { base64Audio } = await generateSpeech(text, language, 8000);

    res.set('Content-Type', 'text/xml');
    if (base64Audio) {
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather action="${gatherActionUrl}" method="POST" numDigits="1" timeout="8">
        <Play>${ttsAudioUrl}</Play>
    </Gather>
    <Say voice="female" language="en-IN">Thank you. Have a great day.</Say>
</Response>`);
    } else {
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather action="${gatherActionUrl}" method="POST" numDigits="1" timeout="8">
        <Say voice="female" language="${language === 'hi-IN' ? 'hi-IN' : 'en-IN'}">${text}</Say>
    </Gather>
    <Say voice="female" language="en-IN">Thank you. Have a great day.</Say>
</Response>`);
    }
  } catch (err) {
    console.error('[EXOML PASSTHRU] Error:', err.message);
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="female">Hello, this is an automated payment reminder from Digital Udhaar Khata. Thank you.</Say>
</Response>`);
  }
};

/**
 * @desc    Serve synthesized Sarvam AI TTS audio file for Exotel <Play> tag
 * @route   GET /api/ai-calls/tts-audio
 * @access  Public
 */
const handleTtsAudio = async (req, res) => {
  try {
    const text = req.query.text || 'Hello, this is an automated payment reminder.';
    const lang = req.query.lang || 'te-IN';

    const { audioBuffer } = await generateSpeech(text, lang, 8000);
    if (audioBuffer) {
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length
      });
      return res.send(audioBuffer);
    }

    return res.status(404).send('Audio generation failed');
  } catch (err) {
    console.error('[TTS AUDIO] Error serving audio:', err.message);
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

    console.log(`[DTMF GATHER] Customer pressed key: ${digits} for session ${sessionId || phone}`);

    const session = getCallSession(sessionId) || getCallSession(phone);
    let replyText = 'Thank you for your response. Have a great day!';

    if (session && session.customerId) {
      const now = new Date();
      let promisedDate = null;
      let status = 'PROMISE_TO_PAY';
      let summary = `Customer pressed keypad key ${digits}`;

      if (digits === '1') {
        promisedDate = now;
        summary = 'Customer promised to pay today (Key 1 pressed)';
        replyText = 'Thank you. We have recorded that you will make the payment today.';
      } else if (digits === '2') {
        promisedDate = new Date(now);
        promisedDate.setDate(promisedDate.getDate() + 1);
        summary = 'Customer promised to pay tomorrow (Key 2 pressed)';
        replyText = 'Thank you. We have recorded that you will make the payment tomorrow.';
      } else if (digits === '3') {
        status = 'NEEDS_MORE_TIME';
        summary = 'Customer requested more time (Key 3 pressed)';
        replyText = 'Thank you. We have noted that you need more time.';
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

    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="female" language="en-IN">${replyText}</Say>
</Response>`);
  } catch (err) {
    console.error('[DTMF GATHER] Error:', err.message);
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="female">Thank you for your response. Goodbye.</Say>
</Response>`);
  }
};

module.exports = {
  startAiCall,
  sendAiSms,
  handleExomlPassthru,
  handleTtsAudio,
  handleGatherResponse
};

