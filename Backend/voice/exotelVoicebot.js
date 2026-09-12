const WebSocket = require('ws');
const { getCallSession, updateCallSession, removeCallSession } = require('../services/callSessionStore');
const { transcribeAudio, generateSpeech } = require('../services/sarvamService');
const Customer = require('../models/Customer');
const AiCallHistory = require('../models/AiCallHistory');

/**
 * Exotel Voicebot Bidirectional WebSocket Server Stream Handler (/exotel/voicebot)
 * Streams Linear16 8000 Hz Raw PCM Audio directly to Exotel
 */

// Send Linear16 8000 Hz PCM audio buffer to Exotel in 3200-byte (100ms) chunks
const sendLinear16PcmInChunks = async (ws, streamSid, pcmBuffer) => {
  if (!pcmBuffer || pcmBuffer.length === 0) return;

  const chunkSize = 3200; // 100ms at 8kHz 16-bit mono PCM (multiples of 320 bytes)
  const totalChunks = Math.ceil(pcmBuffer.length / chunkSize);

  for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
    if (ws.readyState !== WebSocket.OPEN) break;
    const chunkNum = Math.floor(i / chunkSize) + 1;
    const chunk = pcmBuffer.subarray(i, i + chunkSize);
    const base64Chunk = chunk.toString('base64');

    console.log(`[VOICEBOT] Sending audio chunk ${chunkNum}`);

    ws.send(JSON.stringify({
      event: 'media',
      stream_sid: streamSid,
      media: {
        payload: base64Chunk
      }
    }));

    // Pace chunks with ~95ms delay for smooth 8kHz playback
    await new Promise((resolve) => setTimeout(resolve, 95));
  }
  console.log('[VOICEBOT] Finished sending audio');
};

// Helper to classify customer intent from speech transcription
const classifyCustomerIntent = (text, lang) => {
  if (!text || text.trim().length === 0) {
    return { status: 'NO_RESPONSE', summary: 'No response received' };
  }

  const lower = text.toLowerCase().trim();
  const now = new Date();

  if (
    lower.includes('already paid') || lower.includes('paid') || lower.includes('payment done') ||
    lower.includes('చేసాను') || lower.includes('పే చేసాను') || lower.includes('కట్టేసాను') ||
    lower.includes('पे कर दिया') || lower.includes('दे दिया')
  ) {
    return { status: 'PAID', summary: 'Customer claims payment was already made' };
  }

  if (lower.includes('tomorrow') || lower.includes('రేపు') || lower.includes('कल')) {
    const promisedDate = new Date(now);
    promisedDate.setDate(promisedDate.getDate() + 1);
    return { status: 'PROMISE_TO_PAY', promisedDate, summary: 'Customer promised to pay tomorrow' };
  }

  if (lower.includes('today') || lower.includes('ఈరోజు') || lower.includes('आज')) {
    return { status: 'PROMISE_TO_PAY', promisedDate: now, summary: 'Customer promised to pay today' };
  }

  if (
    lower.includes('more time') || lower.includes('no money') || lower.includes('time కావాలి') ||
    lower.includes('డబ్బులు లేవు') || lower.includes('समय चाहिए') || lower.includes('पैसे नहीं')
  ) {
    return { status: 'NEEDS_MORE_TIME', summary: 'Customer requested more time' };
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
    console.log('[VOICEBOT] WebSocket connected');

    let session = null;
    let streamSid = null;
    let audioBuffers = [];
    let initialGreetingSent = false;
    let mediaLogCounter = 0;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString('utf8'));
        const event = data.event || data.type;

        switch (event) {
          case 'connected': {
            console.log('[VOICEBOT] Connected event');
            break;
          }

          case 'start': {
            console.log('[VOICEBOT] Start event');
            streamSid = data.stream_sid || data.streamSid || data.start?.streamSid || data.sid || data.call_sid;
            console.log(`[VOICEBOT] Stream SID received: ${streamSid || 'active'}`);

            const phone = data.from || data.caller || data.phone || data.start?.from;
            const customField = data.custom_field || data.start?.customField ? 
              (typeof (data.custom_field || data.start?.customField) === 'string' ? JSON.parse(data.custom_field || data.start?.customField) : (data.custom_field || data.start?.customField)) : {};

            const sessionId = customField.callSessionId || data.call_sid || streamSid;
            session = getCallSession(sessionId) || getCallSession(phone);

            if (session) {
              updateCallSession(session.sessionId, { status: 'CONNECTED', streamSid });
            }

            if (!initialGreetingSent) {
              initialGreetingSent = true;
              const lang = session ? session.language : 'te-IN';
              const name = session ? session.customerName : 'Ravi';
              const due = session ? Math.abs(session.amount) : 500;

              let greeting = `నమస్కారం ${name} గారు. ఇది AI Digital Khata నుండి కాల్. మీ ఖాతాలో ${due} రూపాయలు చెల్లించాల్సి ఉంది. మీరు ఈరోజు చెల్లించగలరా?`;
              if (lang === 'hi-IN' || lang === 'hi') {
                greeting = `नमस्ते ${name} जी। यह AI Digital Khata से कॉल है। आपके खाते में ${due} रुपये का भुगतान बाकी है। क्या आप आज भुगतान कर सकते हैं?`;
              } else if (lang === 'en-IN' || lang === 'en') {
                greeting = `Hello ${name}. This is AI Digital Khata. You have an outstanding payment of ${due} rupees. Would you be able to pay today?`;
              }

              // Call Sarvam AI TTS (linear16, 8000 Hz)
              const { pcmBuffer } = await generateSpeech(greeting, lang, 8000);
              if (pcmBuffer && pcmBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
                await sendLinear16PcmInChunks(ws, streamSid, pcmBuffer);
              }
            }
            break;
          }

          case 'media': {
            mediaLogCounter++;
            if (mediaLogCounter % 50 === 1) {
              console.log('[VOICEBOT] Media received');
            }

            if (data.media && data.media.payload) {
              const pcmChunk = Buffer.from(data.media.payload, 'base64');
              audioBuffers.push(pcmChunk);

              // Accumulate ~3s of audio (48000 bytes at 8kHz 16bit)
              const totalLength = audioBuffers.reduce((acc, b) => acc + b.length, 0);
              if (totalLength >= 48000) {
                const fullPcm = Buffer.concat(audioBuffers);
                audioBuffers = [];

                const lang = session ? session.language : 'te-IN';
                console.log('[VOICEBOT] Processing customer speech with Sarvam STT...');

                const transcribedText = await transcribeAudio(fullPcm, lang);
                if (transcribedText && transcribedText.trim().length > 0) {
                  console.log(`[SARVAM STT] Result: "${transcribedText}"`);

                  const classified = classifyCustomerIntent(transcribedText, lang);
                  let replyMsg = `ధన్యవాదాలు. మీ సమాచారం నమోదయింది.`;
                  if (lang === 'hi-IN' || lang === 'hi') replyMsg = `धन्यवाद। आपकी जानकारी दर्ज कर ली गई है।`;
                  else if (lang === 'en-IN' || lang === 'en') replyMsg = `Thank you. We have recorded your response.`;

                  if (session && session.customerId) {
                    await updateCustomerAiRecord(session.customerId, classified, transcribedText);
                  }

                  const { pcmBuffer } = await generateSpeech(replyMsg, lang, 8000);
                  if (pcmBuffer && pcmBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
                    await sendLinear16PcmInChunks(ws, streamSid, pcmBuffer);
                  }
                }
              }
            }
            break;
          }

          case 'stop':
          case 'clear':
          case 'close': {
            console.log('[VOICEBOT] Stop event received');
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
      console.log('[VOICEBOT] Stop event received');
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

    console.log(`[AI CALL] Saved customer record status: ${intentResult.status}`);
  } catch (err) {
    console.error('[AI CALL] Error saving customer record:', err.message);
  }
};

module.exports = {
  createExotelVoicebotServer,
  classifyCustomerIntent
};
