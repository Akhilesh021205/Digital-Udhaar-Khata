const WebSocket = require('ws');
const { getCallSession, updateCallSession, removeCallSession } = require('../services/callSessionStore');
const { transcribeAudio, generateSpeech } = require('../services/sarvamService');
const Customer = require('../models/Customer');
const AiCallHistory = require('../models/AiCallHistory');

/**
 * Exotel Voicebot Bidirectional WebSocket Server Stream Handler (/exotel/voicebot)
 */

// Helper to classify customer intent from natural voice speech
const classifyCustomerIntent = (text, lang) => {
  if (!text || text.trim().length === 0) {
    return { status: 'NO_RESPONSE', summary: 'No response received from customer' };
  }

  const lower = text.toLowerCase().trim();
  const now = new Date();

  // 1. PAID (Already paid / payment completed)
  if (
    lower.includes('already paid') || lower.includes('paid') || lower.includes('payment done') ||
    lower.includes('చెల్లించాను') || lower.includes('పే చేసాను') || lower.includes('కట్టేసాను') ||
    lower.includes('पे कर दिया') || lower.includes('भुगतान कर दिया') || lower.includes('दे दिया')
  ) {
    return {
      status: 'PAID',
      summary: 'Customer claims payment was already made'
    };
  }

  // 2. PROMISE TO PAY - TOMORROW
  if (lower.includes('tomorrow') || lower.includes('రేపు') || lower.includes('कल')) {
    const promisedDate = new Date(now);
    promisedDate.setDate(promisedDate.getDate() + 1);
    return {
      status: 'PROMISE_TO_PAY',
      promisedDate,
      summary: 'Customer promised to pay tomorrow'
    };
  }

  // 3. PROMISE TO PAY - TODAY
  if (lower.includes('today') || lower.includes('ఈరోజు') || lower.includes('आज')) {
    const promisedDate = new Date(now);
    return {
      status: 'PROMISE_TO_PAY',
      promisedDate,
      summary: 'Customer promised to pay today'
    };
  }

  // 4. PROMISE TO PAY - MONDAY
  if (lower.includes('monday') || lower.includes('సోమవారం') || lower.includes('సోమవారం') || lower.includes('सोमवार')) {
    const promisedDate = new Date(now);
    const day = promisedDate.getDay();
    const diff = (1 + 7 - day) % 7 || 7;
    promisedDate.setDate(promisedDate.getDate() + diff);
    return {
      status: 'PROMISE_TO_PAY',
      promisedDate,
      summary: 'Customer promised to pay on Monday'
    };
  }

  // 5. PROMISE TO PAY - IN A FEW DAYS / NEXT WEEK
  if (lower.includes('week') || lower.includes('వారం') || lower.includes('हफ्ते') || lower.includes('days')) {
    const promisedDate = new Date(now);
    promisedDate.setDate(promisedDate.getDate() + 7);
    return {
      status: 'PROMISE_TO_PAY',
      promisedDate,
      summary: 'Customer promised to pay within a week'
    };
  }

  // 6. CALL BACK LATER
  if (
    lower.includes('call me later') || lower.includes('call later') || lower.includes('busy') ||
    lower.includes('తర్వాత చేయండి') || lower.includes('బిజీ') || lower.includes('పనిలో ఉన్నాను') ||
    lower.includes('बाद में') || lower.includes('बिजी')
  ) {
    return {
      status: 'CALL_BACK_LATER',
      summary: 'Customer requested to call back later'
    };
  }

  // 7. DISPUTE (Wrong amount / bill dispute)
  if (
    lower.includes('wrong amount') || lower.includes('dispute') || lower.includes('not my') ||
    lower.includes('తప్పు') || lower.includes('నా బిల్ కాదు') || lower.includes('गलत')
  ) {
    return {
      status: 'DISPUTE',
      summary: 'Customer disputed the payment amount'
    };
  }

  // 8. NEEDS MORE TIME
  if (
    lower.includes('more time') || lower.includes('no money') || lower.includes('time కావాలి') ||
    lower.includes('డబ్బులు లేవు') || lower.includes('समय चाहिए') || lower.includes('पैसे नहीं')
  ) {
    return {
      status: 'NEEDS_MORE_TIME',
      summary: 'Customer requested more time to arrange funds'
    };
  }

  // 9. TRANSFER TO OWNER
  if (
    lower.includes('owner') || lower.includes('shopkeeper') || lower.includes('యజమాని') ||
    lower.includes('మాట్లాడుతాను') || lower.includes('మాట్లాడాలి') || lower.includes('मालिक')
  ) {
    return {
      status: 'TRANSFER_TO_OWNER',
      summary: 'Customer requested to speak directly to shop owner'
    };
  }

  return {
    status: 'PROMISE_TO_PAY',
    promisedDate: null,
    summary: `Customer response: "${text}"`
  };
};

const createExotelVoicebotServer = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws, req) => {
    console.log('[VOICEBOT] Connected to Exotel Voicebot WSS stream');

    let session = null;
    let streamSid = null;
    let audioBuffers = [];

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString('utf8'));
        const event = data.event || data.type;

        switch (event) {
          case 'connected':
          case 'start': {
            streamSid = data.stream_sid || data.streamSid || data.sid;
            const phone = data.from || data.caller || data.phone;
            const customField = data.custom_field ? (typeof data.custom_field === 'string' ? JSON.parse(data.custom_field) : data.custom_field) : {};

            const sessionId = customField.callSessionId || data.call_sid || streamSid;
            session = getCallSession(sessionId) || getCallSession(phone);

            if (!session) {
              console.log(`[VOICEBOT] Incoming call session identified (Phone: ${phone || 'unknown'})`);
            } else {
              console.log(`[VOICEBOT] Session matched for customer ${session.customerName} at ${session.shopName} (Dues: ₹${session.amount})`);
              updateCallSession(session.sessionId, { status: 'CONNECTED', streamSid });
            }

            // Generate initial outbound payment reminder greeting dynamically
            const lang = session ? session.language : 'te-IN';
            const name = session ? session.customerName : 'Customer';
            const due = session ? Math.abs(session.amount) : 0;
            const shop = session ? session.shopName : 'Digital Udhaar Khata';

            let greeting = `నమస్కారం ${name} గారు, ఇది ${shop} నుండి ఆటోమేటిక్ పేమెంట్ రిమైండర్ కాల్. మీకు ప్రస్తుతం ₹${due} బకాయి ఉంది. మీరు ఎప్పుడు చెల్లించగలరు?`;

            if (lang === 'hi-IN' || lang === 'hi') {
              greeting = `नमस्ते ${name} जी, यह ${shop} की ओर से भुगतान अनुस्मारक कॉल है। आपका ₹${due} बकाया है। आप भुगतान कब कर पाएंगे?`;
            } else if (lang === 'en-IN' || lang === 'en') {
              greeting = `Hello ${name}, this is an automated payment reminder from ${shop}. You currently have an outstanding amount of ₹${due}. When would you be able to make the payment?`;
            } else if (lang === 'ta-IN' || lang === 'ta') {
              greeting = `வணக்கம் ${name} அவர்களே, இது ${shop} இலிருந்து வரவழைக்கப்பட்ட தானியங்கி கட்டண நினைவூட்டல் அழைப்பு. உங்களுக்கு தற்போது ₹${due} நிலுவையில் உள்ளது. எப்போது கட்டணம் செலுத்துவீர்கள்?`;
            } else if (lang === 'kn-IN' || lang === 'kn') {
              greeting = `నమస్కార ${name} అవరే, ఇది ${shop} రింద అటొమాటిక్ పావతి నేపిన కాలు. నిమ్మ ఖాతాయల్లి ₹${due} భాకి ఇదె. నీవు యావాగ పావతి మాడుత్తీరా?`;
            }

            const { rawBase64 } = await generateSpeech(greeting, lang, 8000);
            if (rawBase64 && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                event: 'media',
                stream_sid: streamSid,
                media: { payload: rawBase64 }
              }));
              console.log('[SARVAM] Dynamic TTS initial payment reminder greeting sent over Exotel Voicebot stream');
            }
            break;
          }

          case 'media': {
            if (data.media && data.media.payload) {
              const pcmChunk = Buffer.from(data.media.payload, 'base64');
              audioBuffers.push(pcmChunk);

              // Process audio snippet when accumulated ~3 seconds (48000 bytes at 8kHz 16bit)
              const totalLength = audioBuffers.reduce((acc, b) => acc + b.length, 0);
              if (totalLength >= 48000) {
                const fullPcm = Buffer.concat(audioBuffers);
                audioBuffers = [];

                const lang = session ? session.language : 'te-IN';
                console.log('[VOICEBOT] Customer speech received, running Sarvam STT...');

                const transcribedText = await transcribeAudio(fullPcm, lang);
                if (transcribedText && transcribedText.trim().length > 0) {
                  console.log(`[SARVAM] STT output: "${transcribedText}"`);

                  const classified = classifyCustomerIntent(transcribedText, lang);
                  let replyMsg = `ధన్యవాదాలు. మీ ప్రతిస్పందన నమోదయ్యాయి.`;
                  if (lang === 'hi-IN' || lang === 'hi') replyMsg = `धन्यवाद। आपकी जानकारी दर्ज कर ली गई है।`;
                  else if (lang === 'en-IN' || lang === 'en') replyMsg = `Thank you. Your response has been recorded.`;
                  else if (lang === 'ta-IN' || lang === 'ta') replyMsg = `நன்றி. உங்கள் தகவல் பதிவு செய்யப்பட்டது.`;
                  else if (lang === 'kn-IN' || lang === 'kn') replyMsg = `ధన్యవాదగళు. నిమ్మ మాహితి దాఖలాగిదె.`;

                  if (session && session.customerId) {
                    await updateCustomerAiRecord(session.customerId, classified, transcribedText);
                  }

                  const { rawBase64 } = await generateSpeech(replyMsg, lang, 8000);
                  if (rawBase64 && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      event: 'media',
                      stream_sid: streamSid,
                      media: { payload: rawBase64 }
                    }));
                  }
                }
              }
            }
            break;
          }

          case 'dtmf': {
            const digit = data.dtmf ? data.dtmf.digit : data.digit;
            console.log(`[VOICEBOT] DTMF digit received: ${digit}`);

            let dtmfIntent = { status: 'PROMISE_TO_PAY', summary: 'Pressed Keypad Option' };
            let replyText = 'Thank you for your response.';

            if (digit === '1') {
              dtmfIntent = { status: 'PROMISE_TO_PAY', promisedDate: new Date(), summary: 'Pressed 1: Pay today' };
              replyText = 'Thank you. You selected to pay today.';
            } else if (digit === '2') {
              const tom = new Date();
              tom.setDate(tom.getDate() + 1);
              dtmfIntent = { status: 'PROMISE_TO_PAY', promisedDate: tom, summary: 'Pressed 2: Pay tomorrow' };
              replyText = 'Thank you. You selected to pay tomorrow.';
            } else if (digit === '3') {
              dtmfIntent = { status: 'NEEDS_MORE_TIME', summary: 'Pressed 3: Need more time' };
              replyText = 'Thank you. We have noted that you need more time.';
            } else if (digit === '4') {
              dtmfIntent = { status: 'TRANSFER_TO_OWNER', summary: 'Pressed 4: Talk to owner' };
              replyText = 'Connecting you to the shop owner. Please hold.';
            }

            if (session && session.customerId) {
              await updateCustomerAiRecord(session.customerId, dtmfIntent, `DTMF Key ${digit}`);
            }

            const lang = session ? session.language : 'te-IN';
            const { rawBase64 } = await generateSpeech(replyText, lang, 8000);
            if (rawBase64 && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                event: 'media',
                stream_sid: streamSid,
                media: { payload: rawBase64 }
              }));
            }
            break;
          }

          case 'stop':
          case 'clear':
          case 'close': {
            console.log('[VOICEBOT] Call ended');
            if (session) {
              removeCallSession(session.sessionId);
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[VOICEBOT] Error handling message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('[VOICEBOT] WebSocket disconnected');
      if (session) removeCallSession(session.sessionId);
    });
  });

  return wss;
};

// Helper function to update Customer database record upon call response
const updateCustomerAiRecord = async (customerId, intentResult, rawText) => {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return;

    customer.lastAiCall = new Date();
    customer.lastAiCallStatus = 'completed';
    customer.lastAiResponse = intentResult.summary || rawText;
    customer.lastAiResultStatus = intentResult.status;

    if (intentResult.promisedDate) {
      customer.promiseToPayDate = intentResult.promisedDate;
    }

    await customer.save();

    await AiCallHistory.create({
      customerId: customer._id,
      owner: customer.owner,
      callStatus: 'completed',
      callType: 'exotel_voicebot',
      language: customer.preferredLanguage || 'te-IN',
      amountDiscussed: customer.balance,
      resultStatus: intentResult.status,
      promisedDate: intentResult.promisedDate || null,
      summary: intentResult.summary,
      rawTranscript: rawText
    });

    console.log(`[AI CALL] Updated customer ${customer.name} record with status: ${intentResult.status}`);
  } catch (err) {
    console.error('[AI CALL] Error updating customer record:', err.message);
  }
};

module.exports = {
  createExotelVoicebotServer,
  classifyCustomerIntent
};
