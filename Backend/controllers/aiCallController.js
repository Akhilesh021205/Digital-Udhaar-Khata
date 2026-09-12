const Customer = require('../models/Customer');
const { initiateOutboundCall, sendPaymentReminderSMS } = require('../services/exotelService');
const { createCallSession } = require('../services/callSessionStore');

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

    // Store call session context securely for Exotel Voicebot WebSocket stream lookup
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

    // Request Exotel to initiate call using Flow 1340037
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

module.exports = {
  startAiCall,
  sendAiSms
};
