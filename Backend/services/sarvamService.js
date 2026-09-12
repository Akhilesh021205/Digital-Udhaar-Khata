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
 * Text-to-Speech via Sarvam AI API
 * @param {string} text - Text to synthesize into speech
 * @param {string} languageCode - 'te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN'
 * @param {number} sampleRate - 8000 (telephony default) or 16000
 * @returns {Promise<{ base64Audio: string|null, audioBuffer: Buffer|null }>}
 */
const generateSpeech = async (text, languageCode = 'te-IN', sampleRate = 8000) => {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || !text || text.trim().length === 0) {
    return { base64Audio: null, audioBuffer: null };
  }

  try {
    const validLanguages = ['te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN'];
    const targetLang = validLanguages.includes(languageCode) ? languageCode : 'te-IN';

    const payload = {
      inputs: [text.trim()],
      target_language_code: targetLang,
      speaker: 'kavya',
      pitch: 0,
      pace: 1.05,
      loudness: 1.5,
      speech_sample_rate: sampleRate || 8000,
      enable_preprocessing: true,
      model: 'bulbul:v3',
    };

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
      const audioBuffer = Buffer.from(rawBase64, 'base64');
      const base64Audio = `data:audio/wav;base64,${rawBase64}`;

      console.log(`[SARVAM] TTS completed (${targetLang}, ${audioBuffer.length} bytes)`);
      return { base64Audio, rawBase64, audioBuffer };
    }

    return { base64Audio: null, audioBuffer: null };
  } catch (err) {
    const safeError = err.response?.data?.message || err.message || 'Sarvam TTS Failed';
    console.error('[SARVAM] TTS error:', safeError);
    return { base64Audio: null, audioBuffer: null };
  }
};

module.exports = {
  transcribeAudio,
  generateSpeech,
};
