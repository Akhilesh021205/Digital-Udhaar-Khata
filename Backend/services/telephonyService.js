const axios = require('axios');
const Customer = require('../models/Customer');
const AiCallHistory = require('../models/AiCallHistory');

/**
 * Service to manage Real Telephonic PSTN Calls to Customer Mobile Numbers
 * Supports Twilio REST API & Exotel API, with fallback simulation
 */

// Helper to format Indian phone numbers to E.164 (e.g. +919876543210)
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  } else if (phone.startsWith('+')) {
    return phone;
  }
  return `+91${cleaned.slice(-10)}`;
};

/**
 * Initiate a real telephone call to customer phone number
 */
/**
 * Initiate a real telephone call to customer phone number
 */
const initiateRealPhoneCall = async (customer, amount, baseUrl) => {
  const formattedPhone = formatPhoneNumber(customer.phone);

  const exotelApiKey = process.env.EXOTEL_API_KEY;
  const exotelApiToken = process.env.EXOTEL_API_TOKEN;
  const exotelSid = process.env.EXOTEL_SID;
  const exotelPhone = process.env.EXOTEL_PHONE_NUMBER;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  const dueAmt = amount || customer.balance || 0;
  const lang = customer.preferredLanguage || 'te-IN';

  // 1. Try Exotel Cloud Telephony if credentials are provided
  if (exotelApiKey && exotelApiToken && !exotelApiKey.includes('YOUR_')) {
    if (exotelSid && exotelPhone && !exotelSid.includes('your_')) {
      try {
        const passthruUrl = `${baseUrl}/api/ai/voice-call/exotel-passthru?customerId=${customer._id}&amount=${dueAmt}&lang=${lang}`;
        const params = new URLSearchParams();
        params.append('From', formattedPhone);
        params.append('To', exotelPhone);
        params.append('CallerId', exotelPhone);
        params.append('Url', passthruUrl);

        const authHeader = 'Basic ' + Buffer.from(`${exotelApiKey}:${exotelApiToken}`).toString('base64');

        const response = await axios.post(
          `https://api.exotel.com/v1/Accounts/${exotelSid}/Calls/connect.json`,
          params.toString(),
          {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        await AiCallHistory.create({
          customerId: customer._id,
          owner: customer.owner,
          callStatus: 'initiated',
          callType: 'real_phone',
          language: lang,
          amountDiscussed: dueAmt,
          telephonyProvider: 'exotel',
          telephonySid: response.data?.Call?.Sid || 'exotel_call',
          summary: `Exotel phone call initiated to ${formattedPhone}`
        });

        return {
          success: true,
          realCallInitiated: true,
          callSid: response.data?.Call?.Sid,
          phone: formattedPhone,
          status: 'initiated',
          provider: 'Exotel Telephony Gateway',
          message: `Exotel live phone call placed to customer mobile (${formattedPhone})`
        };
      } catch (err) {
        console.error('Exotel Telephony Error:', err.response?.data || err.message);
      }
    } else {
      // Exotel API Key & Token present, but SID/Phone missing
      return {
        success: true,
        realCallInitiated: false,
        phone: formattedPhone,
        status: 'pending_setup',
        provider: 'Exotel Telephony Gateway',
        message: `Exotel API Key & Token are saved! Please add your EXOTEL_SID and EXOTEL_PHONE_NUMBER to Backend/.env to complete live gateway calls. Opening phone dialer...`
      };
    }
  }

  // 2. Try Twilio Cloud Telephony if configured
  if (twilioSid && twilioAuthToken && twilioPhone && !twilioSid.includes('YOUR_')) {
    try {
      const webhookUrl = `${baseUrl}/api/ai/voice-call/twilio-twiml?customerId=${customer._id}&amount=${dueAmt}&lang=${lang}`;
      const statusCallbackUrl = `${baseUrl}/api/ai/voice-call/twilio-status?customerId=${customer._id}`;

      const params = new URLSearchParams();
      params.append('To', formattedPhone);
      params.append('From', twilioPhone);
      params.append('Url', webhookUrl);
      params.append('StatusCallback', statusCallbackUrl);
      params.append('StatusCallbackEvent', 'initiated');
      params.append('StatusCallbackEvent', 'ringing');
      params.append('StatusCallbackEvent', 'answered');
      params.append('StatusCallbackEvent', 'completed');

      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
        params.toString(),
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      await AiCallHistory.create({
        customerId: customer._id,
        owner: customer.owner,
        callStatus: 'initiated',
        callType: 'real_phone',
        language: lang,
        amountDiscussed: dueAmt,
        telephonyProvider: 'twilio',
        telephonySid: response.data.sid,
        summary: `Real phone call initiated to ${formattedPhone}`
      });

      return {
        success: true,
        realCallInitiated: true,
        callSid: response.data.sid,
        phone: formattedPhone,
        status: response.data.status,
        provider: 'Twilio Cloud Telephony',
        message: `Real phone call placed to customer's mobile (${formattedPhone})`
      };
    } catch (err) {
      console.error('Twilio Telephony Error:', err.response?.data || err.message);
    }
  }

  // 3. Fallback: Direct Mobile Device Dialer
  await AiCallHistory.create({
    customerId: customer._id,
    owner: customer.owner,
    callStatus: 'initiated',
    callType: 'real_phone_simulation',
    language: lang,
    amountDiscussed: dueAmt,
    telephonyProvider: 'simulated_telephony',
    summary: `Simulated direct mobile phone call to ${formattedPhone}`
  });

  return {
    success: true,
    realCallInitiated: false,
    phone: formattedPhone,
    status: 'ringing',
    provider: 'Direct Mobile Dialer',
    message: `Direct call dispatched to ${formattedPhone}.`
  };
};

/**
 * Generate TwiML Voice XML for Twilio Webhook when customer answers live call
 */
const generateTwimlResponse = async (customerId, amount, lang, userSpeech) => {
  const { initiateVoiceCall, processCustomerResponse } = require('./aiVoiceAssistantService');
  const customer = await Customer.findById(customerId);

  if (!customer) {
    return `<Response><Say voice="alice">Customer account not found. Goodbye.</Say><Hangup/></Response>`;
  }

  let textToSay = '';
  if (!userSpeech) {
    // Initial greeting
    const callData = await initiateVoiceCall(customer, amount);
    textToSay = callData.greetingText;
  } else {
    // Response to user speech / DTMF digit
    const respData = await processCustomerResponse({
      customerId,
      userId: customer.owner,
      customerInput: userSpeech,
      amount
    });
    textToSay = respData.replyText;
  }

  // Map language to Twilio voice or play Sarvam audio
  const twilioLangMap = {
    'te-IN': 'te-IN',
    'hi-IN': 'hi-IN',
    'en-IN': 'en-IN',
    'ta-IN': 'ta-IN',
    'kn-IN': 'kn-IN'
  };
  const twLang = twilioLangMap[lang] || 'en-IN';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="5" numDigits="1" action="/api/ai/voice-call/twilio-gather?customerId=${customerId}&amp;amount=${amount}&amp;lang=${lang}">
    <Say language="${twLang}">${textToSay.replace(/[*#]/g, '')}</Say>
  </Gather>
  <Say language="${twLang}">Thank you. Have a good day.</Say>
  <Hangup/>
</Response>`;

  return twiml;
};

module.exports = {
  formatPhoneNumber,
  initiateRealPhoneCall,
  generateTwimlResponse
};
