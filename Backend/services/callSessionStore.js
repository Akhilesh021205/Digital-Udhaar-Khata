/**
 * Temporary Call Session Store
 * Maps Call Session ID / Phone to Customer Context for Exotel Voicebot WebSocket
 */

const callSessions = new Map();

const createCallSession = ({ sessionId, customerId, ownerId, customerName, shopName, phone, language, amount }) => {
  const sessionData = {
    sessionId,
    customerId,
    ownerId,
    customerName,
    shopName: shopName || 'Digital Udhaar Khata',
    phone,
    language: language || 'te-IN',
    amount: amount || 0,
    status: 'INITIATED',
    createdAt: new Date(),
    history: []
  };

  callSessions.set(sessionId, sessionData);
  if (phone) {
    callSessions.set(phone, sessionData);
    // Also store without leading + or 91
    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    callSessions.set(cleanPhone, sessionData);
  }
  return sessionData;
};

const getCallSession = (identifier) => {
  if (!identifier) return null;
  if (callSessions.has(identifier)) {
    return callSessions.get(identifier);
  }
  const clean = identifier.toString().replace(/\D/g, '').slice(-10);
  if (clean && callSessions.has(clean)) {
    return callSessions.get(clean);
  }
  return null;
};

const updateCallSession = (sessionId, updates) => {
  const session = getCallSession(sessionId);
  if (session) {
    Object.assign(session, updates);
    return session;
  }
  return null;
};

const removeCallSession = (sessionId) => {
  const session = getCallSession(sessionId);
  if (session) {
    callSessions.delete(session.sessionId);
    if (session.phone) {
      callSessions.delete(session.phone);
      const cleanPhone = session.phone.toString().replace(/\D/g, '').slice(-10);
      callSessions.delete(cleanPhone);
    }
  }
};

module.exports = {
  createCallSession,
  getCallSession,
  updateCallSession,
  removeCallSession
};
