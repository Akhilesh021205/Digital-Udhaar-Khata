const { generateSpeech } = require('./sarvamService');
const AiCallHistory = require('../models/AiCallHistory');
const Customer = require('../models/Customer');
const CustomerHistory = require('../models/CustomerHistory');
const socketService = require('./socketService');

/**
 * Initiates simulated AI Voice Call and generates opening greeting
 */
const initiateVoiceCall = async (customer, amount) => {
  const name = customer.name || 'Customer';
  const lang = customer.preferredLanguage || 'te-IN';
  const dueAmount = parseFloat(amount || customer.balance || 0);

  let greetingText = '';

  switch (lang) {
    case 'hi-IN':
      greetingText = `नमस्ते ${name} जी। डिजिटल उधार खाता से कॉल कर रहे हैं। आपके खाते में ₹${dueAmount} बकाया है। आप इसका भुगतान कब तक करेंगे?`;
      break;
    case 'en-IN':
      greetingText = `Hello ${name}. Calling from Digital Udhaar. You have an outstanding balance of ₹${dueAmount}. When can you make the payment?`;
      break;
    case 'ta-IN':
      greetingText = `வணக்கம் ${name}. டிஜிட்டல் உதார் கணக்கிலிருந்து அழைக்கிறோம். உங்கள் கணக்கில் ₹${dueAmount} நிலுவையில் உள்ளது. எப்போது செலுத்த முடியும்?`;
      break;
    case 'kn-IN':
      greetingText = `ನಮಸ್ಕಾರ ${name} ಅವರೇ. ಡಿಜಿಟಲ್ ಉಧಾರ್ ಖಾತೆಯಿಂದ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇವೆ. ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ₹${dueAmount} ಬಾಕಿ ಇದೆ. ಯಾವಾಗ ಪಾವತಿಸುತ್ತೀರಿ?`;
      break;
    case 'te-IN':
    default:
      greetingText = `నమస్కారం ${name} గారు. డిజిటల్ ఉధార్ ఖాతా నుండి కాల్ చేస్తున్నాము. మీ ఖాతాలో ₹${dueAmount} చెల్లించాల్సి ఉంది. మీరు ఎప్పుడు చెల్లించగలరు?`;
      break;
  }

  // Generate TTS Audio via Sarvam AI
  let audioBase64 = null;
  try {
    audioBase64 = await generateSpeech(greetingText, lang);
  } catch (err) {
    console.warn('Sarvam TTS greeting audio failed, fallback to client speech synthesis:', err.message);
  }

  return {
    success: true,
    greetingText,
    audioBase64,
    language: lang,
    phoneType: customer.phoneType || 'smartphone',
    customerName: name,
    amount: dueAmount,
  };
};

/**
 * Processes customer speech or IVR keypad input, determines intent, updates DB & returns AI response
 */
const processCustomerResponse = async ({ customerId, userId, customerInput, amount }) => {
  const customer = await Customer.findOne({ _id: customerId, owner: userId, isDeleted: { $ne: true } });
  if (!customer) {
    throw new Error('Customer not found');
  }

  const name = customer.name;
  const lang = customer.preferredLanguage || 'te-IN';
  const inputStr = (customerInput || '').toString().trim();

  let resultStatus = 'PROMISE_TO_PAY';
  let promisedDate = new Date(Date.now() + 86400000); // Default tomorrow
  let replyText = '';
  let summary = '';

  // 1. IVR Keypad Option Matching
  if (inputStr === '1') {
    resultStatus = 'PAID_TODAY_PROMISE';
    promisedDate = new Date();
    summary = 'Customer selected IVR option 1: Will pay today.';
  } else if (inputStr === '2') {
    resultStatus = 'PROMISE_TO_PAY';
    promisedDate = new Date(Date.now() + 86400000);
    summary = 'Customer selected IVR option 2: Will pay tomorrow.';
  } else if (inputStr === '3') {
    resultStatus = 'NEEDS_MORE_TIME';
    promisedDate = new Date(Date.now() + 3 * 86400000);
    summary = 'Customer selected IVR option 3: Needs more time.';
  } else if (inputStr === '4') {
    resultStatus = 'TRANSFER_TO_OWNER';
    promisedDate = null;
    summary = 'Customer selected IVR option 4: Requested to speak with shop owner.';
  } else {
    // 2. Multilingual Voice Text Intent Extraction
    const lower = inputStr.toLowerCase();

    if (lower.includes('today') || lower.includes('ఈరోజు') || lower.includes('आज') || lower.includes('இன்று') || lower.includes('ಇಂದು') || lower.includes('eeoju') || lower.includes('aaj')) {
      resultStatus = 'PAID_TODAY_PROMISE';
      promisedDate = new Date();
      summary = 'Customer said they will pay today.';
    } else if (lower.includes('tomorrow') || lower.includes('రేపు') || lower.includes('कल') || lower.includes('நாளை') || lower.includes('ನಾಳೆ') || lower.includes('repu') || lower.includes('kal')) {
      resultStatus = 'PROMISE_TO_PAY';
      promisedDate = new Date(Date.now() + 86400000);
      summary = 'Customer said they will pay tomorrow.';
    } else if (lower.includes('time') || lower.includes('సమయం') || lower.includes('వారంలో') || lower.includes('समय') || lower.includes('நேரம்') || lower.includes('ಸಮಯ') || lower.includes('week') || lower.includes('days')) {
      resultStatus = 'NEEDS_MORE_TIME';
      promisedDate = new Date(Date.now() + 3 * 86400000);
      summary = 'Customer requested additional time to make payment.';
    } else if (lower.includes('wrong') || lower.includes('తప్పు') || lower.includes('गलत') || lower.includes('தவறு') || lower.includes('dispute') || lower.includes('not paid') || lower.includes('no debt')) {
      resultStatus = 'DISPUTE';
      promisedDate = null;
      summary = 'Customer disputed the outstanding amount.';
    } else if (lower.includes('owner') || lower.includes('యజమాని') || lower.includes('मालिक') || lower.includes('உரிமையாளர்') || lower.includes('మాట్లాడాలి') || lower.includes('speak')) {
      resultStatus = 'TRANSFER_TO_OWNER';
      promisedDate = null;
      summary = 'Customer requested to talk directly with the shop owner.';
    } else {
      resultStatus = 'PROMISE_TO_PAY';
      promisedDate = new Date(Date.now() + 86400000);
      summary = `Customer responded: "${inputStr}". Recorded as promise to pay.`;
    }
  }

  // 3. Build Multilingual Response Text
  switch (lang) {
    case 'hi-IN':
      if (resultStatus === 'PAID_TODAY_PROMISE') {
        replyText = `धन्यवाद ${name} जी। हम आज आपके भुगतान का इंतजार करेंगे।`;
      } else if (resultStatus === 'PROMISE_TO_PAY') {
        replyText = `धन्यवाद ${name} जी। आप कल भुगतान कर सकते हैं। हमने नोट कर लिया है।`;
      } else if (resultStatus === 'NEEDS_MORE_TIME') {
        replyText = `ठीक है ${name} जी। कृपया जल्द से जल्द भुगतान करने का प्रयास करें।`;
      } else if (resultStatus === 'DISPUTE') {
        replyText = `क्षमा करें ${name} जी। हम दुकान मालिक को इस बारे में सूचित करेंगे।`;
      } else if (resultStatus === 'TRANSFER_TO_OWNER') {
        replyText = `ठीक है ${name} जी। दुकान मालिक आपसे जल्द ही बात करेंगे।`;
      } else {
        replyText = `धन्यवाद ${name} जी। आपकी प्रतिक्रिया नोट कर ली गई है।`;
      }
      break;

    case 'en-IN':
      if (resultStatus === 'PAID_TODAY_PROMISE') {
        replyText = `Thank you ${name}. We will await your payment today.`;
      } else if (resultStatus === 'PROMISE_TO_PAY') {
        replyText = `Thank you ${name}. You can make the payment tomorrow.`;
      } else if (resultStatus === 'NEEDS_MORE_TIME') {
        replyText = `Okay ${name}. Please try to pay as soon as possible.`;
      } else if (resultStatus === 'DISPUTE') {
        replyText = `Sorry ${name}. We will inform the shop owner about this dispute.`;
      } else if (resultStatus === 'TRANSFER_TO_OWNER') {
        replyText = `Okay ${name}. The shop owner will connect with you shortly.`;
      } else {
        replyText = `Thank you ${name}. Your response has been recorded.`;
      }
      break;

    case 'ta-IN':
      if (resultStatus === 'PAID_TODAY_PROMISE') {
        replyText = `நன்றி ${name}. இன்று உங்கள் பணத்திற்காக காத்திருக்கிறோம்.`;
      } else if (resultStatus === 'PROMISE_TO_PAY') {
        replyText = `நன்றி ${name}. நீங்கள் நாளை செலுத்தலாம். பதிவு செய்துள்ளோம்.`;
      } else if (resultStatus === 'NEEDS_MORE_TIME') {
        replyText = `சரி ${name}. தயவுசெய்து விரைவில் செலுத்துங்கள்.`;
      } else if (resultStatus === 'DISPUTE') {
        replyText = `மன்னிக்கவும் ${name}. கடை உரிமையாளரிடம் தெரிவிக்கிறோம்.`;
      } else if (resultStatus === 'TRANSFER_TO_OWNER') {
        replyText = `சரி ${name}. கடை உரிமையாளர் உங்களிடம் பேசுவார்.`;
      } else {
        replyText = `நன்றி ${name}. உங்கள் பதிவு ஏற்றுக்கொள்ளப்பட்டது.`;
      }
      break;

    case 'kn-IN':
      if (resultStatus === 'PAID_TODAY_PROMISE') {
        replyText = `ಧನ್ಯವಾದಗಳು ${name}. ಇಂದು ನಿಮ್ಮ ಪಾವತಿಗಾಗಿ ಕಾಯುತ್ತಿದ್ದೇವೆ.`;
      } else if (resultStatus === 'PROMISE_TO_PAY') {
        replyText = `ಧನ್ಯವಾದಗಳು ${name}. ನೀವು ನಾಳೆ ಪಾವತಿಸಬಹುದು.`;
      } else if (resultStatus === 'NEEDS_MORE_TIME') {
        replyText = `ಸರಿ ${name}. ದಯವಿಟ್ಟು ಬೇಗನೆ ಪಾವತಿಸಿ.`;
      } else if (resultStatus === 'DISPUTE') {
        replyText = `ಕ್ಷಮಿಸಿ ${name}. ನಾವು ಮಾಲೀಕರಿಗೆ ತಿಳಿಸುತ್ತೇವೆ.`;
      } else if (resultStatus === 'TRANSFER_TO_OWNER') {
        replyText = `ಸರಿ ${name}. ಮಾಲೀಕರು ನಿಮ್ಮೊಂದಿಗೆ ಮಾತನಾಡುತ್ತಾರೆ.`;
      } else {
        replyText = `ಧನ್ಯವಾದಗಳು ${name}. ದಾಖಲಿಸಲಾಗಿದೆ.`;
      }
      break;

    case 'te-IN':
    default:
      if (resultStatus === 'PAID_TODAY_PROMISE') {
        replyText = `ధన్యవాదాలు ${name} గారు. ఈరోజు మీ చెల్లింపు కోసం వేచి ఉంటాము.`;
      } else if (resultStatus === 'PROMISE_TO_PAY') {
        replyText = `ధన్యవాదాలు ${name} గారు. మీరు రేపు చెల్లించవచ్చు. రికార్డ్ చేసాము.`;
      } else if (resultStatus === 'NEEDS_MORE_TIME') {
        replyText = `సరే ${name} గారు. దయచేసి వీలైనంత త్వరగా చెల్లించడానికి ప్రయత్నించండి.`;
      } else if (resultStatus === 'DISPUTE') {
        replyText = `క్షమించండి ${name} గారు. షాప్ యజమానికి ఈ విషయం తెలియజేస్తాము.`;
      } else if (resultStatus === 'TRANSFER_TO_OWNER') {
        replyText = `సరే ${name} గారు. షాప్ యజమాని మీతో త్వరలో మాట్లాడతారు.`;
      } else {
        replyText = `ధన్యవాదాలు ${name} గారు. మీ సమాధానం నమోదు చేయబడింది.`;
      }
      break;
  }

  // Generate TTS Audio for AI reply via Sarvam AI
  let replyAudio = null;
  try {
    replyAudio = await generateSpeech(replyText, lang);
  } catch (err) {
    console.warn('Sarvam TTS reply audio generation failed:', err.message);
  }

  // Save to AiCallHistory database model
  const callRecord = await AiCallHistory.create({
    customerId: customer._id,
    owner: userId,
    customerName: customer.name,
    phone: customer.phone || '',
    language: lang,
    phoneType: customer.phoneType || 'smartphone',
    amount: parseFloat(amount || customer.balance || 0),
    callDate: new Date(),
    callStatus: 'completed',
    customerResponse: inputStr,
    aiSummary: summary,
    resultStatus,
    promisedDate,
  });

  // Update Customer fields
  customer.lastAiCall = new Date();
  customer.lastAiCallStatus = 'completed';
  customer.lastAiResponse = inputStr;
  customer.lastAiResultStatus = resultStatus;
  customer.promiseToPayDate = promisedDate;
  if (promisedDate) {
    customer.paymentDueDate = promisedDate;
  }
  await customer.save();

  // Log to permanent CustomerHistory
  await CustomerHistory.create({
    owner: userId,
    customerId: customer._id,
    customerName: customer.name,
    customerPhone: customer.phone,
    type: 'ai_voice_reminder',
    amount: parseFloat(amount || customer.balance || 0),
    description: `AI Voice Call completed (${lang}): ${summary}`,
    date: new Date(),
    action: 'CREATE',
  });

  // Notify frontend clients via socket
  socketService.emitRefresh('customers');
  socketService.emitRefresh('transactions');

  return {
    success: true,
    replyText,
    replyAudio,
    resultStatus,
    promisedDate,
    summary,
    callRecord,
  };
};

module.exports = {
  initiateVoiceCall,
  processCustomerResponse,
};
