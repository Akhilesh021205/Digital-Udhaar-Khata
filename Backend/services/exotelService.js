const axios = require('axios');

/**
 * Reusable Exotel Telephony Service
 * Manages Outbound Calls via Exotel Flow 1340037 and Payment Reminder SMS
 */

const getExotelConfig = () => {
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const sid = process.env.EXOTEL_SID || 'aidigitalkhata1';
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  const flowId = process.env.EXOTEL_FLOW_ID || '1340037';
  const phone = process.env.EXOTEL_PHONE_NUMBER || '04041895190';

  if (!apiKey || !apiToken || apiKey.includes('YOUR_')) {
    return { isConfigured: false, reason: 'EXOTEL_API_KEY or EXOTEL_API_TOKEN missing in Backend/.env' };
  }

  if (!sid || sid.includes('your_')) {
    return { isConfigured: false, reason: 'EXOTEL_SID (Account SID) missing in Backend/.env' };
  }

  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
  return {
    isConfigured: true,
    apiKey,
    apiToken,
    sid,
    subdomain,
    flowId,
    phone,
    authHeader
  };
};

/**
 * Format phone number to standard Indian 10-digit / E.164 format
 */
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
 * Initiate an outbound call to customer phone line using Exotel Flow 1340037
 */
const initiateOutboundCall = async ({ toPhone, callSessionId, customerName, shopName, amount, language }) => {
  const config = getExotelConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      realCallInitiated: false,
      error: config.reason,
      message: config.reason
    };
  }

  if (!config.phone || config.phone.trim() === '' || config.phone.includes('your_')) {
    return {
      success: false,
      realCallInitiated: false,
      error: 'ExoPhone Virtual Number Missing',
      message: 'ExoPhone Virtual Number is not set in Backend/.env (EXOTEL_PHONE_NUMBER). Please set EXOTEL_PHONE_NUMBER to your assigned Exotel landline/virtual number to enable direct PSTN calls.'
    };
  }

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    return {
      success: false,
      realCallInitiated: false,
      error: 'Invalid customer phone number'
    };
  }

  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SERVER_URL;
    const exomlCallbackUrl = baseUrl 
      ? `${baseUrl}/api/ai-calls/exoml?callSessionId=${encodeURIComponent(callSessionId)}` 
      : `http://my.exotel.com/${config.sid}/exoml/start_voice/${config.flowId}`;

    const apiUrl = `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/connect.json`;
    const callerId = config.phone && !config.phone.includes('your_') ? config.phone : formattedPhone;

    const params = new URLSearchParams();
    params.append('From', formattedPhone);
    params.append('To', callerId);
    params.append('CallerId', callerId);
    params.append('Url', exomlCallbackUrl);
    params.append('CustomField', JSON.stringify({ callSessionId, customerName, shopName, amount, language }));

    console.log(`[EXOTEL] Calling API: ${apiUrl} (Flow ${config.flowId}, SID: ${config.sid})`);

    const response = await axios.post(apiUrl, params.toString(), {
      headers: {
        'Authorization': config.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 12000
    });

    const callSid = response.data?.Call?.Sid || response.data?.sid || 'EXO_CALL_' + Date.now();

    return {
      success: true,
      realCallInitiated: true,
      callSid,
      phone: formattedPhone,
      status: response.data?.Call?.Status || 'initiated',
      provider: 'Exotel Telephony Gateway',
      message: `Outbound AI reminder call placed to customer line (${formattedPhone})`
    };
  } catch (err) {
    const safeErrorMsg = err.response?.data?.RestException?.Message || err.response?.data?.message || err.message || 'Exotel API call failed';
    console.error('[EXOTEL] Outbound call error:', safeErrorMsg);
    return {
      success: false,
      realCallInitiated: false,
      error: safeErrorMsg,
      message: `Exotel Call Error: ${safeErrorMsg}`
    };
  }
};

/**
 * Send Payment Reminder SMS via Exotel SMS API
 */
const sendPaymentReminderSMS = async ({ toPhone, text }) => {
  const config = getExotelConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      error: config.reason,
      message: config.reason
    };
  }

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    return {
      success: false,
      error: 'Invalid customer phone number'
    };
  }

  try {
    const apiUrl = `https://${config.subdomain}/v1/Accounts/${config.sid}/Sms/send.json`;

    const params = new URLSearchParams();
    params.append('From', config.phone || 'UDHAAR');
    params.append('To', formattedPhone);
    params.append('Body', text);

    console.log(`[EXOTEL] Sending payment reminder SMS to ${formattedPhone}`);

    const response = await axios.post(apiUrl, params.toString(), {
      headers: {
        'Authorization': config.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    const smsSid = response.data?.SMSMessage?.Sid || response.data?.sid || 'EXO_SMS_' + Date.now();

    return {
      success: true,
      smsSid,
      phone: formattedPhone,
      status: response.data?.SMSMessage?.Status || 'sent',
      message: `Payment reminder SMS sent to ${formattedPhone}`
    };
  } catch (err) {
    const safeErrorMsg = err.response?.data?.RestException?.Message || err.message || 'Exotel SMS API request failed';
    console.error('[EXOTEL] SMS error:', safeErrorMsg);
    return {
      success: false,
      error: safeErrorMsg,
      message: `Failed to send SMS via Exotel: ${safeErrorMsg}`
    };
  }
};

module.exports = {
  getExotelConfig,
  formatPhoneNumber,
  initiateOutboundCall,
  sendPaymentReminderSMS
};
