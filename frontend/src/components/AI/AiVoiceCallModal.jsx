import { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import Modal from '../Common/Modal';
import { toast } from 'react-toastify';
import {
  HiOutlineMicrophone, HiOutlinePhoneMissedCall,
  HiOutlineCheckCircle, HiOutlineClock,
  HiOutlineSparkles, HiOutlinePhone, HiOutlineUser,
  HiOutlineChatAlt2, HiOutlineExclamationCircle, HiOutlineX
} from 'react-icons/hi';
import { FaPhoneAlt, FaMobileAlt } from 'react-icons/fa';

const langLabels = {
  'te-IN': 'Telugu (తెలుగు)',
  'hi-IN': 'Hindi (हिंदी)',
  'en-IN': 'English',
  'ta-IN': 'Tamil (தமிழ்)',
  'kn-IN': 'Kannada (కన్నడ)',
};

const formatPhoneDisplay = (phone) => {
  if (!phone) return '+91 9849228937';
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

  const [callState, setCallState] = useState('idle'); // 'idle', 'initiating', 'calling', 'connected', 'active', 'completed', 'failed'
  const [errorMessage, setErrorMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeAudio, setActiveAudio] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [resultData, setResultData] = useState(null);
  const [mode, setMode] = useState('real_phone'); // 'real_phone', 'smartphone', 'basic'
  const [selectedLanguage, setSelectedLanguage] = useState(customer.preferredLanguage || 'te-IN');
  const [smsSending, setSmsSending] = useState(false);

  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);
  const phoneDisplay = formatPhoneDisplay(customer.phone);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset modal state on open or customer change
  useEffect(() => {
    if (!isOpen || !customer) return;

    setCallState('idle');
    setErrorMessage(null);
    setMessages([]);
    setRecognizedText('');
    setResultData(null);
    setSelectedLanguage(customer.preferredLanguage || 'te-IN');

    // If demo mode is selected, fetch greeting text for local browser voice test
    if (mode === 'smartphone' || mode === 'basic') {
      const initDemoCall = async () => {
        try {
          const { data } = await API.post('/ai/voice-call/initiate', {
            customerId: customer._id,
            amount: customer.balance || 500,
          });

          if (data.success) {
            const { greetingText, audioBase64, language } = data.data;
            setMessages([
              { sender: 'ai', text: greetingText, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
            ]);
            if (mode === 'smartphone') {
              setCallState('active');
              playAudio(audioBase64, greetingText, language);
            }
          }
        } catch (err) {
          console.warn('AI Demo init warning:', err.message);
        }
      };
      initDemoCall();
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [isOpen, customer, mode]);

  // Trigger Real AI Call via Backend Exotel API (/api/ai-calls/start)
  const handleTriggerRealCall = async () => {
    setErrorMessage(null);
    setCallState('calling');
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    setMessages([
      {
        sender: 'ai',
        text: `Starting Exotel Flow 1340037 AI payment call to customer phone (${phoneDisplay})...`,
        time: timeStr
      }
    ]);

    try {
      const { data } = await API.post('/ai-calls/start', {
        customerId: customer._id,
        language: selectedLanguage
      });

      if (data.success) {
        toast.success(data.message || `AI call initiated to ${phoneDisplay}`);
        setCallState('connected');

        setMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            text: `Ringing customer's mobile SIM (${phoneDisplay}). When customer picks up, Exotel Voicebot Stream (/exotel/voicebot) will run Sarvam AI dialogue naturally.`,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        setTimeout(() => {
          setCallState('active');
        }, 1800);

        setResultData({
          resultStatus: 'CALL_DISPATCHED',
          summary: data.message || `AI call started for ${customer.name}`
        });

        if (onCallCompleted) onCallCompleted();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start AI call via Exotel';
      setErrorMessage(msg);
      setCallState('failed');
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Call Status: ${msg}`,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // Trigger Reminder SMS via Exotel SMS API (/api/ai-calls/send-sms)
  const handleSendReminderSMS = async () => {
    setSmsSending(true);
    setErrorMessage(null);
    try {
      const { data } = await API.post('/ai-calls/send-sms', {
        customerId: customer._id
      });
      if (data.success) {
        toast.success(`Payment reminder SMS sent to ${phoneDisplay}`);
        setMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            text: `Payment reminder SMS successfully dispatched to ${phoneDisplay} via Exotel.`,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send SMS';
      setErrorMessage(msg);
    } finally {
      setSmsSending(false);
    }
  };

  // Play Audio or Web Speech Fallback for Demo Mode
  const playAudio = (audioBase64, fallbackText, langCode) => {
    try {
      if (activeAudio) {
        activeAudio.pause();
        setActiveAudio(null);
      }

      if (audioBase64) {
        const audio = new Audio(audioBase64);
        setActiveAudio(audio);
        audio.onended = () => {
          setCallState('listening');
          startMicListening(langCode);
        };
        audio.play().catch((err) => {
          console.warn('Audio autoplay prevented, using Web Speech fallback:', err);
          speakWebSpeech(fallbackText, langCode);
        });
      } else {
        speakWebSpeech(fallbackText, langCode);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
      setCallState('listening');
      startMicListening(langCode);
    }
  };

  const speakWebSpeech = (text, langCode) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode || customer.preferredLanguage || 'te-IN';
      utterance.onend = () => {
        setCallState('listening');
        startMicListening(langCode);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setCallState('listening');
    }
  };

  // Web Speech Microphone Listener for Demo Mode
  const startMicListening = (langCode) => {
    if (mode === 'basic' || mode === 'real_phone') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = langCode || customer.preferredLanguage || 'te-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setCallState('listening');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setRecognizedText(transcript);
        if (event.results[0].isFinal) {
          handleSendResponse(transcript);
        }
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err.error);
        setCallState('listening');
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err.message);
    }
  };

  // Handle Demo Mode Customer Response
  const handleSendResponse = async (inputStr) => {
    if (!inputStr || inputStr.trim().length === 0) return;

    if (recognitionRef.current) recognitionRef.current.stop();
    setCallState('processing');

    const customerMsg = {
      sender: 'customer',
      text: inputStr,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, customerMsg]);
    setRecognizedText('');

    try {
      const { data } = await API.post('/ai/voice-call/respond', {
        customerId: customer._id,
        customerInput: inputStr,
        amount: customer.balance || 500,
      });

      if (data.success) {
        const { replyText, replyAudio, resultStatus, promisedDate, summary } = data.data;

        setMessages(prev => [
          ...prev,
          { sender: 'ai', text: replyText, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
        ]);

        setResultData({ resultStatus, promisedDate, summary });
        setCallState('completed');

        if (replyAudio && mode === 'smartphone') {
          const audio = new Audio(replyAudio);
          audio.play().catch(() => {});
        }

        toast.success(`Demo AI Call completed: ${summary}`);
        if (onCallCompleted) onCallCompleted();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Error processing response');
      setCallState('completed');
    }
  };

  const handleEndCall = () => {
    if (activeAudio) activeAudio.pause();
    if (recognitionRef.current) recognitionRef.current.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    onClose();
  };

  const dueAmount = customer.balance || 0;
  const langDisplay = langLabels[customer.preferredLanguage] || 'Telugu (తెలుగు)';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleEndCall}
      maxWidth="sm:max-w-lg"
      title={
        <div className="flex items-center gap-2">
          <HiOutlineSparkles className="text-orange" size={20} />
          <span>AI Payment Reminder Voice Call</span>
        </div>
      }
    >
      <div className="space-y-3 text-deep-navy dark:text-white">

        {/* Customer Info Header Card */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-md border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-orange/80 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0">
                {customer.avatar ? (
                  <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
                ) : (
                  <HiOutlineUser size={20} className="text-orange" />
                )}
              </div>

              <div>
                <h4 className="font-bold text-sm text-white tracking-tight flex items-center gap-2 m-0">
                  {customer.name}
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="text-[10px] font-bold bg-slate-800 text-orange px-2 py-1 rounded-lg border border-orange/40 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange font-sans"
                  >
                    <option value="te-IN">Telugu (తెలుగు)</option>
                    <option value="hi-IN">Hindi (हिंदी)</option>
                    <option value="en-IN">English</option>
                    <option value="ta-IN">Tamil (தமிழ்)</option>
                    <option value="kn-IN">Kannada (కన్నడ)</option>
                  </select>
                </h4>
                <p className="text-xs text-slate-300 font-mono flex items-center gap-1 mt-0.5 m-0">
                  <HiOutlinePhone size={12} className="text-orange" />
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

          {/* Mode Switcher & Status Bar */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MODE:</span>

              <button
                type="button"
                onClick={() => { setMode('real_phone'); setErrorMessage(null); }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  mode === 'real_phone' ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <FaPhoneAlt size={10} /> Real Phone Call (Exotel)
              </button>

              <button
                type="button"
                onClick={() => { setMode('smartphone'); setErrorMessage(null); }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  mode === 'smartphone' ? 'bg-orange text-white border-orange shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <FaMobileAlt size={10} /> Demo Browser Mic
              </button>

              <button
                type="button"
                onClick={() => { setMode('basic'); setErrorMessage(null); }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  mode === 'basic' ? 'bg-orange text-white border-orange shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <HiOutlinePhone size={10} /> Demo Keypad IVR
              </button>
            </div>

            {/* Clean Live Status Indicator Badge */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                callState === 'calling' || callState === 'initiating' ? 'bg-blue-400 animate-ping' :
                callState === 'connected' || callState === 'active' || callState === 'listening' ? 'bg-emerald-400 animate-ping' :
                callState === 'completed' ? 'bg-green-400' :
                callState === 'failed' ? 'bg-amber-400' : 'bg-emerald-500'
              }`} />
              <span className="text-[10px] font-bold text-slate-200">
                {callState === 'idle' ? 'Ready to Call' :
                 callState === 'initiating' ? 'Starting...' :
                 callState === 'calling' ? 'Calling Mobile SIM...' :
                 callState === 'connected' ? 'Connected...' :
                 callState === 'active' ? 'AI Voicebot Active' :
                 callState === 'listening' ? 'Listening...' :
                 callState === 'completed' ? 'Call Completed' : 'Call Notice'}
              </span>
            </div>
          </div>
        </div>

        {/* Inline Error / Notice Banner inside Modal */}
        {errorMessage && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-200 shadow-sm animate-in fade-in duration-200">
            <HiOutlineExclamationCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <h6 className="font-bold m-0 text-red-300 text-xs">Exotel Call Status / Notice</h6>
              <p className="m-0 text-[11px] text-red-200/90 mt-0.5 leading-relaxed font-sans">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white border-none bg-transparent cursor-pointer p-0"
            >
              <HiOutlineX size={16} />
            </button>
          </div>
        )}

        {/* Real Exotel Voicebot Stream Action Card */}
        {mode === 'real_phone' && (
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2.5 border border-emerald-500/40 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <FaPhoneAlt size={12} />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-white m-0">Exotel + Sarvam AI Voice Call</h5>
                  <p className="text-[10px] text-emerald-400 font-mono m-0">Exotel Flow ID: 1340037</p>
                </div>
              </div>

              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                WSS Stream Ready
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-normal m-0">
              Triggers a direct mobile SIM call to <span className="font-bold text-white">{customer.name} ({phoneDisplay})</span>. The customer receives a normal phone call on their mobile SIM and speaks naturally in <span className="text-orange font-bold">{langDisplay}</span>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleTriggerRealCall}
                disabled={callState === 'calling'}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <FaPhoneAlt size={12} />
                {callState === 'calling' ? 'Placing Call...' : 'Start AI Reminder Call'}
              </button>

              <button
                type="button"
                onClick={handleSendReminderSMS}
                disabled={smsSending}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold border border-slate-700 cursor-pointer transition-all flex items-center justify-center gap-1.5 text-center disabled:opacity-50"
              >
                <HiOutlineChatAlt2 size={14} className="text-orange" />
                {smsSending ? 'Sending SMS...' : 'Send Reminder SMS'}
              </button>
            </div>
          </div>
        )}

        {/* Live Conversation / Transcript Box */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 min-h-[120px] max-h-[160px] overflow-y-auto space-y-2 shadow-inner">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500 space-y-1">
              <div className="w-8 h-8 rounded-full bg-orange/10 flex items-center justify-center text-orange animate-bounce">
                <FaPhoneAlt size={14} />
              </div>
              <p className="text-xs font-medium m-0">Ready to initiate AI Payment Reminder call</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-orange text-white flex items-center justify-center text-[10px] shrink-0 shadow-sm font-bold mt-0.5">
                    <HiOutlineSparkles size={12} />
                  </div>
                )}

                <div className={`max-w-[85%] p-2.5 rounded-xl text-xs font-medium leading-normal shadow-sm ${
                  msg.sender === 'customer'
                    ? 'bg-orange text-white rounded-br-none'
                    : 'bg-white border border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white rounded-bl-none'
                }`}>
                  <p className="m-0 font-outfit">{msg.text}</p>
                  <span className={`text-[8px] block mt-0.5 text-right font-mono ${msg.sender === 'customer' ? 'text-white/70' : 'text-slate-400'}`}>
                    {msg.time}
                  </span>
                </div>

                {msg.sender === 'customer' && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] shrink-0 shadow-sm font-bold mt-0.5">
                    <HiOutlineUser size={12} />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Final Result Card when Call Completes */}
        {callState === 'completed' && resultData && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <HiOutlineCheckCircle size={15} /> AI Call Summary
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-mono">
                {resultData.resultStatus}
              </span>
            </div>

            <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 m-0">
              "{resultData.summary}"
            </p>

            {resultData.promisedDate && (
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <HiOutlineClock size={12} />
                Promised Date set to: {new Date(resultData.promisedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {/* End Call Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleEndCall}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <HiOutlinePhoneMissedCall size={16} />
            {callState === 'completed' ? 'Close Assistant' : 'End AI Call'}
          </button>
        </div>

      </div>
    </Modal>
  );
};

export default AiVoiceCallModal;
