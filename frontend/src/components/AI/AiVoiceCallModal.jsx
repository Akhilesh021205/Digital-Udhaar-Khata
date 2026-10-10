import { useState, useEffect } from 'react';
import API from '../../api/axios';
import Modal from '../Common/Modal';
import { toast } from 'react-toastify';
import { useSocketSync } from '../../hooks/useSocketSync';
import {
  HiOutlineSparkles, HiOutlinePhone, HiOutlineUser,
  HiOutlineChatAlt2, HiOutlineExclamationCircle, HiOutlineX,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlinePhoneOutgoing,
  HiOutlinePhoneMissedCall
} from 'react-icons/hi';
import { FaPhoneAlt } from 'react-icons/fa';

const langLabels = {
  'te-IN': 'Telugu (తెలుగు)',
  'hi-IN': 'Hindi (हिंदी)',
  'en-IN': 'English',
  'ta-IN': 'Tamil (தமிழ்)',
  'kn-IN': 'Kannada (కన్నడ)',
};

const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const clean = phone.toString().trim().replace(/\s+/g, '');
  if (clean.startsWith('+')) {
    return clean.replace(/^(\+\d{2})(\d+)$/, '$1 $2');
  }
  if (clean.length === 10) {
    return `+91 ${clean}`;
  }
  return clean;
};

const AiVoiceCallModal = ({ isOpen, onClose, customer, onCallCompleted }) => {
  if (!customer) return null;

  const [callState, setCallState] = useState('idle'); // 'idle', 'initiating', 'calling', 'ringing', 'connected', 'active', 'completed', 'failed'
  const [errorMessage, setErrorMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeCallSid, setActiveCallSid] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(customer.preferredLanguage || 'te-IN');
  const [smsSending, setSmsSending] = useState(false);

  const phoneDisplay = formatPhoneDisplay(customer.phone);
  const dueAmount = customer.balance || 0;

  // Poll call history for real call status updates from Exotel
  const pollCallStatus = async () => {
    if (!customer || !isOpen) return;
    try {
      const { data } = await API.get(`/ai/voice-call/history/${customer._id}`);
      if (data.success && data.data && data.data.length > 0) {
        const latestCall = data.data[0];
        if (latestCall.telephonySid === activeCallSid || latestCall.callStatus === 'completed') {
          if (latestCall.callStatus === 'completed') {
            setCallState('completed');
            setResultData({
              resultStatus: latestCall.resultStatus || 'COMPLETED',
              summary: latestCall.aiSummary || latestCall.summary || 'Call completed successfully',
              promisedDate: latestCall.promisedDate
            });
          } else if (latestCall.callStatus === 'in-progress' || latestCall.callStatus === 'answered') {
            setCallState('connected');
          } else if (latestCall.callStatus === 'ringing') {
            setCallState('ringing');
          }
        }
      }
    } catch (err) {
      console.warn('Status poll warning:', err.message);
    }
  };

  useSocketSync(pollCallStatus, ['customers', 'transactions']);

  // Reset modal state when opened
  useEffect(() => {
    if (!isOpen || !customer) return;
    setCallState('idle');
    setErrorMessage(null);
    setMessages([]);
    setActiveCallSid(null);
    setResultData(null);
    setSelectedLanguage(customer.preferredLanguage || 'te-IN');
  }, [isOpen, customer]);

  // Trigger Real Exotel Outbound Call to Customer Mobile SIM
  const handleStartRealPhoneCall = async () => {
    setErrorMessage(null);
    setCallState('calling');
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    setMessages([
      {
        sender: 'system',
        text: `Dispatching real PSTN outbound call to ${customer.name}'s mobile SIM (${phoneDisplay})...`,
        time: timeStr
      }
    ]);

    try {
      const { data } = await API.post('/ai-calls/start', {
        customerId: customer._id,
        language: selectedLanguage
      });

      if (data.success) {
        const callSid = data.callId || data.data?.callSid;
        setActiveCallSid(callSid);
        setCallState('ringing');

        toast.success(data.message || `Phone call placed to ${phoneDisplay}`);

        setMessages(prev => [
          ...prev,
          {
            sender: 'system',
            text: `Ringing customer's mobile line (${phoneDisplay}). When customer answers, Exotel AI Voicebot will speak in ${langLabels[selectedLanguage] || 'Telugu'}.`,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        if (onCallCompleted) onCallCompleted();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to place real phone call';
      setErrorMessage(msg);
      setCallState('failed');
      setMessages(prev => [
        ...prev,
        {
          sender: 'system',
          text: `Call Status: ${msg}`,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // Terminate Live Call via Exotel API
  const handleEndCall = async () => {
    if (activeCallSid && (callState === 'calling' || callState === 'ringing' || callState === 'connected' || callState === 'active')) {
      try {
        await API.post('/ai-calls/stop', { callSid: activeCallSid });
        toast.info('Live phone call ended.');
      } catch (err) {
        console.warn('Call terminate notice:', err.message);
      }
    }
    onClose();
  };

  // Send Reminder SMS
  const handleSendReminderSMS = async () => {
    setSmsSending(true);
    setErrorMessage(null);
    try {
      const { data } = await API.post('/ai-calls/send-sms', { customerId: customer._id });
      if (data.success) {
        toast.success(`Payment reminder SMS sent to ${phoneDisplay}`);
        setMessages(prev => [
          ...prev,
          {
            sender: 'system',
            text: `Payment reminder SMS successfully dispatched to ${phoneDisplay}.`,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to send SMS');
    } finally {
      setSmsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleEndCall}
      maxWidth="sm:max-w-lg"
      title={
        <div className="flex items-center gap-2">
          <HiOutlineSparkles className="text-orange" size={20} />
          <span>AI Payment Reminder Phone Call</span>
        </div>
      }
    >
      <div className="space-y-3.5 text-deep-navy dark:text-white">

        {/* Customer Header Card */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full border-2 border-orange overflow-hidden bg-slate-800 flex items-center justify-center shrink-0">
                {customer.avatar ? (
                  <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
                ) : (
                  <HiOutlineUser size={22} className="text-orange" />
                )}
              </div>

              <div>
                <h4 className="font-bold text-base text-white tracking-tight m-0 flex items-center gap-2">
                  {customer.name}
                </h4>
                <p className="text-xs text-slate-300 font-mono flex items-center gap-1 mt-0.5 m-0">
                  <HiOutlinePhone size={13} className="text-orange" />
                  {phoneDisplay}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pending Amount</span>
              <span className="text-base font-extrabold text-red-400 font-mono">
                ₹{Math.abs(dueAmount).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Language Selector */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Call Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={callState === 'calling' || callState === 'ringing' || callState === 'connected'}
              className="text-xs font-bold bg-slate-800 text-orange px-3 py-1.5 rounded-lg border border-orange/40 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange"
            >
              <option value="te-IN">Telugu (తెలుగు)</option>
              <option value="hi-IN">Hindi (हिंदी)</option>
              <option value="en-IN">English</option>
              <option value="ta-IN">Tamil (தமிழ்)</option>
              <option value="kn-IN">Kannada (కన్నడ)</option>
            </select>
          </div>
        </div>

        {/* Real Call Status Bar */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              callState === 'calling' || callState === 'initiating' ? 'bg-blue-500 animate-ping' :
              callState === 'ringing' ? 'bg-amber-400 animate-ping' :
              callState === 'connected' || callState === 'active' ? 'bg-emerald-500 animate-ping' :
              callState === 'completed' ? 'bg-green-500' :
              callState === 'failed' ? 'bg-red-500' : 'bg-emerald-500'
            }`} />
            <span className="text-xs font-bold">
              {callState === 'idle' ? 'Ready to Call Customer SIM' :
               callState === 'initiating' ? 'Initiating Call...' :
               callState === 'calling' ? 'Placing Real Outbound Call...' :
               callState === 'ringing' ? `Ringing Customer Phone (${phoneDisplay})...` :
               callState === 'connected' || callState === 'active' ? 'Call Connected - AI Voice Active' :
               callState === 'completed' ? 'Call Completed' : 'Call Failed / Notice'}
            </span>
          </div>

          <span className="text-[10px] font-mono text-slate-500">Exotel Gateway</span>
        </div>

        {/* Inline Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-200">
            <HiOutlineExclamationCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <h6 className="font-bold m-0 text-xs">Exotel Call Status</h6>
              <p className="m-0 text-[11px] mt-0.5 leading-relaxed font-sans">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-700 border-none bg-transparent cursor-pointer p-0"
            >
              <HiOutlineX size={16} />
            </button>
          </div>
        )}

        {/* Primary Outbound Call Trigger Card */}
        <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 border border-emerald-500/40 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <FaPhoneAlt size={13} />
              </div>
              <div>
                <h5 className="font-bold text-xs text-white m-0">Real Mobile Phone Call</h5>
                <p className="text-[10px] text-emerald-400 font-mono m-0">Exotel PSTN + Sarvam AI Voice</p>
              </div>
            </div>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
              Live PSTN Call
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-normal m-0">
            Triggers a real phone call to <span className="font-bold text-white">{customer.name} ({phoneDisplay})</span>. The customer's mobile phone will ring, and the AI speaks in <span className="text-orange font-bold">{langLabels[selectedLanguage]}</span> regarding their pending balance of <span className="text-emerald-400 font-bold">₹{dueAmount}</span>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleStartRealPhoneCall}
              disabled={callState === 'calling' || callState === 'ringing' || callState === 'connected'}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold border-none cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <FaPhoneAlt size={12} />
              {callState === 'calling' || callState === 'ringing' ? 'Ringing Phone...' : 'Start AI Voice Call'}
            </button>

            <button
              type="button"
              onClick={handleSendReminderSMS}
              disabled={smsSending}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold border border-slate-700 cursor-pointer transition-all flex items-center justify-center gap-2 text-center disabled:opacity-50"
            >
              <HiOutlineChatAlt2 size={15} className="text-orange" />
              {smsSending ? 'Sending SMS...' : 'Send Reminder SMS'}
            </button>
          </div>
        </div>

        {/* Live Call Event Log */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 min-h-[110px] max-h-[140px] overflow-y-auto space-y-2 shadow-inner">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 text-center text-slate-500 space-y-1">
              <HiOutlinePhoneOutgoing size={20} className="text-orange animate-bounce" />
              <p className="text-xs font-medium m-0">Click "Start AI Voice Call" to place real phone call</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-orange/20 text-orange flex items-center justify-center text-[10px] shrink-0 font-bold mt-0.5">
                  <HiOutlineSparkles size={11} />
                </div>
                <div className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                  <p className="m-0 text-xs leading-normal">{msg.text}</p>
                  <span className="text-[8px] text-slate-400 block mt-0.5 text-right font-mono">{msg.time}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Call Completion Result Card */}
        {resultData && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <HiOutlineCheckCircle size={15} /> Real Call Summary
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-mono">
                {resultData.resultStatus}
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 m-0">"{resultData.summary}"</p>
            {resultData.promisedDate && (
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <HiOutlineClock size={12} />
                Promised Date: {new Date(resultData.promisedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {/* End Call / Close Modal Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleEndCall}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <HiOutlinePhoneMissedCall size={16} />
            {callState === 'completed' ? 'Close Assistant' : 'End Phone Call'}
          </button>
        </div>

      </div>
    </Modal>
  );
};

export default AiVoiceCallModal;
