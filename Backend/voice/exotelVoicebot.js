const WebSocket = require('ws');
const { getCallSession, updateCallSession, removeCallSession } = require('../services/callSessionStore');
const { transcribeAudio, generateSpeech } = require('../services/sarvamService');
const Customer = require('../models/Customer');
const AiCallHistory = require('../models/AiCallHistory');

/**
 * Exotel Voicebot Bidirectional WebSocket Server Stream Handler (/exotel/voicebot)
 * Supports G.711 mulaw (PCMU) and 16-bit Linear PCM (s16le) Telephony Audio Encodings
 */

// Helper to strip 44-byte WAV header if present and return raw 16-bit Linear PCM (s16le) at 8kHz mono
const extractRawPcmS16le = (buffer) => {
  if (!buffer || buffer.length === 0) return Buffer.alloc(0);

  // Check for RIFF header
  if (buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    const dataSubchunkIndex = buffer.indexOf('data');
    if (dataSubchunkIndex !== -1 && buffer.length > dataSubchunkIndex + 8) {
      return buffer.subarray(dataSubchunkIndex + 8);
    }
    return buffer.subarray(44);
  }
  return buffer;
};

// G.711 mulaw (PCMU) Encoder
const pcmSampleToMulaw = (pcmSample) => {
  const BIAS = 0x84;
  const CLIP = 32635;

  let sign = (pcmSample >> 8) & 0x80;
  if (sign !== 0) pcmSample = -pcmSample;
  if (pcmSample > CLIP) pcmSample = CLIP;
  pcmSample = pcmSample + BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (pcmSample & mask) === 0 && exponent > 0; mask >>= 1) {
    exponent--;
  }
  let mantissa = (pcmSample >> (exponent + 3)) & 0x0F;
  let mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return mulawByte;
};

const pcmToMulawBuffer = (pcmBuffer) => {
  const rawPcm = extractRawPcmS16le(pcmBuffer);
  const mulawBuffer = Buffer.alloc(Math.floor(rawPcm.length / 2));
  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = rawPcm.readInt16LE(i * 2);
    mulawBuffer[i] = pcmSampleToMulaw(sample);
  }
  return mulawBuffer;
};

// G.711 mulaw (PCMU) Decoder
const mulawToPcmSample = (mulawByte) => {
  mulawByte = ~mulawByte & 0xFF;
  let sign = mulawByte & 0x80;
  let exponent = (mulawByte & 0x70) >> 4;
  let mantissa = mulawByte & 0x0F;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
};

const mulawToPcmBuffer = (mulawBuffer) => {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = mulawToPcmSample(mulawBuffer[i]);
    pcmBuffer.writeInt16LE(sample, i * 2);
  }
  return pcmBuffer;
};

// Helper to chunk audio and send over WebSocket in the requested telephony encoding (mulaw or PCM)
const sendAudioInChunks = async (ws, streamSid, pcmBuffer, encoding = 'mulaw') => {
  const rawPcm = extractRawPcmS16le(pcmBuffer);
  if (!rawPcm || rawPcm.length === 0) return;

  const encLower = (encoding || 'mulaw').toLowerCase();
  const isMulaw = encLower.includes('mulaw') || encLower.includes('ulaw') || encLower.includes('pcmu');

  if (isMulaw) {
    const mulawBuf = pcmToMulawBuffer(rawPcm);
    const chunkSize = 800; // 100ms at 8kHz 8-bit mulaw
    const totalChunks = Math.ceil(mulawBuf.length / chunkSize);
    console.log(`[VOICEBOT] Sending audio to Exotel (mulaw format, ${mulawBuf.length} bytes, ${totalChunks} chunks)`);

    for (let i = 0; i < mulawBuf.length; i += chunkSize) {
      if (ws.readyState !== WebSocket.OPEN) break;
      const chunk = mulawBuf.subarray(i, i + chunkSize);
      const base64Chunk = chunk.toString('base64');

      ws.send(JSON.stringify({
        event: 'media',
        stream_sid: streamSid,
        media: { payload: base64Chunk }
      }));

      await new Promise((resolve) => setTimeout(resolve, 95));
    }
  } else {
    const chunkSize = 3200; // 100ms at 8kHz 16-bit PCM
    const totalChunks = Math.ceil(rawPcm.length / chunkSize);
    console.log(`[VOICEBOT] Sending audio to Exotel (PCM format, ${rawPcm.length} bytes, ${totalChunks} chunks)`);

    for (let i = 0; i < rawPcm.length; i += chunkSize) {
      if (ws.readyState !== WebSocket.OPEN) break;
      const chunk = rawPcm.subarray(i, i + chunkSize);
      const base64Chunk = chunk.toString('base64');

      ws.send(JSON.stringify({
        event: 'media',
        stream_sid: streamSid,
        media: { payload: base64Chunk }
      }));

      await new Promise((resolve) => setTimeout(resolve, 95));
    }
  }
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
    let streamEncoding = 'mulaw';
    let audioBuffers = [];
    let initialGreetingSent = false;
    let mediaLogCounter = 0;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString('utf8'));
        const event = data.event || data.type;

        switch (event) {
          case 'connected': {
            console.log('[VOICEBOT] Connected event received');
            break;
          }

          case 'start': {
            streamSid = data.stream_sid || data.streamSid || data.start?.streamSid || data.sid || data.call_sid;
            streamEncoding = data.start?.mediaFormat?.encoding || data.mediaFormat?.encoding || data.encoding || 'mulaw';
            console.log(`[VOICEBOT] Start event received (streamSid: ${streamSid || 'active'}, encoding: ${streamEncoding})`);

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
              const name = session ? session.customerName : 'Customer';
              const due = session ? Math.abs(session.amount) : 0;
              const shop = session ? session.shopName : 'Digital Udhaar Khata';

              let greeting = `నమస్కారం ${name} గారు, ఇది ${shop} నుండి ఆటోమేటిక్ పేమెంట్ రిమైండర్ కాల్. మీకు ప్రస్తుతం ₹${due} బకాయి ఉంది. మీరు ఎప్పుడు చెల్లించగలరు?`;
              if (lang === 'hi-IN' || lang === 'hi') {
                greeting = `नमस्ते ${name} जी, यह ${shop} की ओर से भुगतान अनुस्मारक कॉल है। आपका ₹${due} बकाया है। आप भुगतान कब कर पाएंगे?`;
              } else if (lang === 'en-IN' || lang === 'en') {
                greeting = `Hello ${name}, this is an automated payment reminder from ${shop}. Your outstanding amount is ${due} rupees. When would you be able to make the payment?`;
              }

              console.log(`[VOICEBOT] Generating initial greeting TTS: "${greeting}"`);
              const { audioBuffer } = await generateSpeech(greeting, lang, 8000);
              if (audioBuffer && audioBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
                await sendAudioInChunks(ws, streamSid, audioBuffer, streamEncoding);
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
              const rawPayload = Buffer.from(data.media.payload, 'base64');
              const isMulaw = (streamEncoding || 'mulaw').toLowerCase().includes('mulaw') || (streamEncoding || 'mulaw').toLowerCase().includes('ulaw') || (streamEncoding || 'mulaw').toLowerCase().includes('pcmu');

              const pcmChunk = isMulaw ? mulawToPcmBuffer(rawPayload) : rawPayload;
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

                  const { audioBuffer } = await generateSpeech(replyMsg, lang, 8000);
                  if (audioBuffer && audioBuffer.length > 0) {
                    await sendAudioInChunks(ws, streamSid, audioBuffer, streamEncoding);
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
