const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Sarvam AI STT & TTS Service for Telephony & Exotel Voicebot
 */

/**
 * Speech-to-Text via Sarvam AI API
 * @param {Buffer|string} audioInput - PCM/WAV Audio Buffer or Base64 string
 * @param {string} languageCode - 'te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN'
 * @returns {Promise<string|null>} - Transcribed text
 */
const transcribeAudio = async (audioInput, languageCode = 'te-IN') => {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.warn('[SARVAM] SARVAM_API_KEY is missing in process.env');
    return null;
  }

  try {
    const formData = new FormData();

    let buffer;
    if (Buffer.isBuffer(audioInput)) {
      buffer = audioInput;
    } else if (typeof audioInput === 'string' && audioInput.startsWith('data:audio')) {
      const base64Data = audioInput.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (typeof audioInput === 'string' && fs.existsSync(audioInput)) {
      buffer = fs.readFileSync(audioInput);
    } else if (typeof audioInput === 'string') {
      buffer = Buffer.from(audioInput, 'base64');
    } else {
      throw new Error('Invalid audio input format');
    }

    formData.append('file', buffer, { filename: 'audio.wav', contentType: 'audio/wav' });
    formData.append('language_code', languageCode || 'te-IN');
    formData.append('model', 'saarika:v2');

    const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
      headers: {
        ...formData.getHeaders(),
        'api-subscription-key': apiKey,
      },
      timeout: 15000,
    });

    if (response.data && response.data.transcript) {
      console.log(`[SARVAM] STT completed (${languageCode})`);
      return response.data.transcript;
    }

    return null;
  } catch (err) {
    const safeError = err.response?.data?.message || err.message || 'Sarvam STT Failed';
    console.error('[SARVAM] STT error:', safeError);
    return null;
  }
};

/**
 * Helper to construct a valid 44-byte WAV RIFF Header for raw 16-bit Mono PCM audio
 * @param {Buffer} pcmBuffer - Raw PCM Audio Bytes
 * @param {number} sampleRate - 8000 or 16000 Hz
 * @returns {Buffer|null} - Complete WAV File Buffer with RIFF header
 */
const createWavBuffer = (pcmBuffer, sampleRate = 8000) => {
  if (!pcmBuffer || !Buffer.isBuffer(pcmBuffer) || pcmBuffer.length === 0) {
    return null;
  }
  const numChannels = 1;
  const bitDepth = 16;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk (PCM format)
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 for uncompressed PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28); // ByteRate
  header.writeUInt16LE(numChannels * (bitDepth / 8), 32); // BlockAlign
  header.writeUInt16LE(bitDepth, 34); // BitsPerSample

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
};

/**
 * Text-to-Speech via Sarvam AI API
 * @param {string} text - Text to synthesize into speech
 * @param {string} languageCode - 'te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN'
 * @param {number} sampleRate - 8000 (telephony default) or 16000
 * @returns {Promise<{ base64Audio: string|null, audioBuffer: Buffer|null, pcmBuffer: Buffer|null, wavBuffer: Buffer|null }>}
 */
const generateSpeech = async (text, languageCode = 'te-IN', sampleRate = 8000) => {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || !text || text.trim().length === 0) {
    return { base64Audio: null, audioBuffer: null, pcmBuffer: null, wavBuffer: null };
  }

  try {
    const validLanguages = ['te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN'];
    const targetLang = validLanguages.includes(languageCode) ? languageCode : 'te-IN';
    const rate = sampleRate || 8000;

    const payload = {
      inputs: [text.trim()],
      target_language_code: targetLang,
      speaker: 'shubh',
      pitch: 0,
      pace: 1.05,
      loudness: 1.5,
      speech_sample_rate: rate,
      output_audio_codec: 'linear16',
      enable_preprocessing: true,
      model: 'bulbul:v3',
    };

    console.log(`[VOICEBOT] Calling Sarvam TTS (${targetLang}, ${rate}Hz)`);

    const response = await axios.post('https://api.sarvam.ai/text-to-speech', payload, {
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      timeout: 15000,
    });

    if (response.data && response.data.audios && response.data.audios.length > 0) {
      let rawBase64 = response.data.audios[0];
      if (rawBase64.startsWith('data:audio')) {
        rawBase64 = rawBase64.split(',')[1];
      }
      const pcmBuffer = Buffer.from(rawBase64, 'base64');
      const wavBuffer = createWavBuffer(pcmBuffer, rate);
      const wavDataUri = wavBuffer ? `data:audio/wav;base64,${wavBuffer.toString('base64')}` : null;

      console.log(`[VOICEBOT] Sarvam response received. PCM: ${pcmBuffer.length} bytes, WAV: ${wavBuffer ? wavBuffer.length : 0} bytes`);

      return {
        base64Audio: wavDataUri || rawBase64,
        audioBuffer: wavBuffer || pcmBuffer,
        pcmBuffer,
        wavBuffer
      };
    }

    return { base64Audio: null, audioBuffer: null, pcmBuffer: null, wavBuffer: null };
  } catch (err) {
    const safeError = err.response?.data?.message || err.message || 'Sarvam TTS Failed';
    console.error('[VOICEBOT] Sarvam TTS error:', safeError);
    return { base64Audio: null, audioBuffer: null, pcmBuffer: null, wavBuffer: null };
  }
};

module.exports = {
  createWavBuffer,
  transcribeAudio,
  generateSpeech,
};

