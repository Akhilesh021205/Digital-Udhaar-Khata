import { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { 
  HiOutlineChatAlt2, 
  HiOutlineX, 
  HiOutlinePaperAirplane, 
  HiOutlineMicrophone, 
  HiOutlineSparkles, 
  HiOutlineLightBulb,
  HiOutlineClipboardCopy,
  HiOutlineCheck,
  HiOutlineRefresh,
  HiOutlineArrowsExpand
} from 'react-icons/hi';
import { FiTrendingUp, FiAlertTriangle, FiDollarSign, FiClock } from 'react-icons/fi';
import { toast } from 'react-toastify';

const AIChatAssistant = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [firstCustomerName, setFirstCustomerName] = useState('Ravi');
  const [messages, setMessages] = useState([]);
  const [speechLangOverride, setSpeechLangOverride] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const chatEndRef = useRef(null);

  // Fetch a customer name for personalized starter suggestions
  useEffect(() => {
    if (!isOpen) return;
    const fetchFirstCustomer = async () => {
      try {
        const { data } = await API.get('/customers?limit=1');
        if (data.data && data.data.length > 0) {
          setFirstCustomerName(data.data[0].name);
        }
      } catch (err) {
        // Fallback
      }
    };
    fetchFirstCustomer();
  }, [isOpen]);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: `Hello ${user?.name ? user.name : 'Merchant'}! I am **KhataGPT** 🤖\n\nI have real-time access to your ledger, customers, cashbook, and transactions for **${user?.storeName || 'your store'}**.\n\nYou can ask me questions or speak in Hindi/Telugu/English:`,
        suggestions: [
          `How much udhar does ${firstCustomerName || 'customer'} have?`,
          'Show this month collection',
          'Who has highest due?',
          'Who are the risky customers?'
        ],
        time: new Date()
      }
    ]);
  }, [firstCustomerName, user?.name, user?.storeName]);

  // Indian locales based on active language or override
  const speechLang = speechLangOverride || (lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN');
  
  const {
    isListening,
    startListening,
    stopListening,
    isSupported: isSpeechSupported
  } = useSpeechToText({
    lang: speechLang,
    onResult: (text) => {
      setInputValue(text);
      handleSendMessage(text);
    },
    onInterimResult: (text) => {
      setInputValue(text);
    },
    onEnd: () => {
      // Done listening
    }
  });

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date()
    };

    const historyToSend = messages
      .filter(m => m.id !== 'welcome')
      .slice(-6)
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: typeof m.text === 'string' ? m.text : JSON.stringify(m.text)
      }));

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const { data } = await API.post('/ai/chat', { 
        message: text,
        history: historyToSend,
        lang: lang
      });

      const responseText = data?.response || data?.message || (typeof data === 'string' ? data : 'I processed your ledger query.');
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: responseText,
        suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
        time: new Date()
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('KhataGPT chat error:', err);
      const fallbackError = err.response?.data?.message || 'Sorry, I am having trouble connecting right now. Please try again in a moment.';
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: fallbackError,
        suggestions: [
          `How much udhar does ${firstCustomerName || 'customer'} have?`,
          'Show this month collection',
          'Who has highest due?'
        ],
        time: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const handleCopyMessage = (id, text) => {
    try {
      const plainText = typeof text === 'string' ? text : JSON.stringify(text);
      navigator.clipboard.writeText(plainText);
      setCopiedId(id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      toast.error('Failed to copy');
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: `Conversation restarted! I am ready for your next question about **${user?.storeName || 'your ledger'}**.`,
        suggestions: [
          `How much udhar does ${firstCustomerName || 'customer'} have?`,
          'Show this month collection',
          'Who has highest due?',
          'Who are the risky customers?'
        ],
        time: new Date()
      }
    ]);
    toast.info('Chat history refreshed');
  };

  // Helper to safely render markdown formatted text
  const renderMessageText = (text) => {
    if (!text) return null;
    const textStr = typeof text === 'string' ? text : typeof text === 'object' ? (text.response || text.message || JSON.stringify(text)) : String(text);
    
    return textStr.split('\n').map((line, lineIdx) => {
      let content = line;
      
      // Check for bullet points
      const isBullet = content.startsWith('* ') || content.startsWith('- ') || content.startsWith('• ');
      if (isBullet) {
        content = content.replace(/^[\*\-•]\s*/, '');
      }

      // Check for bold text **text**
      const parts = content.split('**');
      const renderedLine = parts.map((part, idx) => {
        if (idx % 2 === 1) {
          return <strong key={idx} className="font-extrabold text-slate-900 dark:text-white">{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={lineIdx} className="ml-5 list-disc text-xs sm:text-sm leading-relaxed my-1 text-slate-700 dark:text-slate-300">
            {renderedLine}
          </li>
        );
      }

      return (
        <p key={lineIdx} className="text-xs sm:text-sm leading-relaxed my-1 text-slate-700 dark:text-slate-300">
          {renderedLine}
        </p>
      );
    });
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-13 h-13 lg:w-14 lg:h-14 bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 hover:from-rose-600 hover:to-red-600 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-none cursor-pointer group active:scale-95"
        title="Open KhataGPT Full Screen"
        id="ai-chat-btn"
      >
        {isOpen ? (
          <HiOutlineX className="w-6 h-6 animate-in spin-in-90 duration-200" />
        ) : (
          <div className="relative flex items-center justify-center">
            <HiOutlineSparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-300"></span>
            </span>
          </div>
        )}
      </button>

      {/* Full-Screen Immersive Chat Canvas Overlay */}
      {isOpen && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950 transition-all duration-300 ${
            isFullscreen ? 'p-0' : 'p-3 sm:p-6 md:p-8 bg-slate-950/60 backdrop-blur-md'
          }`}
        >
          {/* Main Chat Container Box */}
          <div 
            className={`relative w-full h-full bg-white dark:bg-slate-900 flex flex-col overflow-hidden transition-all duration-300 ${
              isFullscreen 
                ? 'rounded-none shadow-none border-none' 
                : 'max-w-5xl mx-auto rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {/* Ambient Background Glow Effect */}
            <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-r from-red-500/10 via-rose-500/5 to-amber-500/10 blur-3xl rounded-full" />
            
            {/* Top Navigation & Status Bar */}
            <header className="relative px-4 sm:px-6 py-3.5 sm:py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 z-10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-600/20 shrink-0">
                  <HiOutlineSparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-outfit m-0 leading-tight">
                      KhataGPT
                    </h2>
                    <span className="text-[10px] bg-gradient-to-r from-red-600 to-rose-600 text-white font-black px-2 py-0.5 rounded-full shadow-2xs tracking-wider uppercase">
                      AI v2.0
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 truncate font-medium">
                    {user?.storeName ? `🏪 Store: ${user.storeName}` : 'AI Ledger & Business Intelligence Assistant'}
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Clear Chat Button */}
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Clear Conversation"
                >
                  <HiOutlineRefresh className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">New Chat</span>
                </button>

                {/* Fullscreen / Windowed View Toggle */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs"
                  title={isFullscreen ? "Windowed Mode" : "Full Screen Mode"}
                >
                  <HiOutlineArrowsExpand className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 transition-all cursor-pointer border border-transparent shadow-2xs"
                  title="Close Assistant"
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Centered Scrollable Conversation Canvas */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              <div className="max-w-4xl w-full mx-auto space-y-6">
                
                {/* Starter Capability Cards (Only visible when starting or on welcome) */}
                {messages.length <= 1 && (
                  <div className="mb-8 p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-50 via-rose-50/20 to-amber-50/20 dark:from-slate-900 dark:via-rose-950/10 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 uppercase tracking-wider">
                        Khata Intelligence
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Instant Insights
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-outfit m-0">
                      What would you like to explore today?
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 mb-5 leading-relaxed font-normal">
                      Click any card below or speak naturally in your language to query dues, totals, or record ledger entries.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => handleSendMessage("Who has highest due?")}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-red-400 hover:shadow-md dark:hover:border-red-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <FiDollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Highest Dues</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Find who owes the most</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage("Show this month collection")}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400 hover:shadow-md dark:hover:border-emerald-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <FiTrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Total Collection</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Monthly cashflow summary</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage("Who are the risky customers?")}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400 hover:shadow-md dark:hover:border-amber-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <FiAlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Risk Predictions</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Customers delaying payments</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage(`How much udhar does ${firstCustomerName || 'Ravi'} have?`)}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 hover:shadow-md dark:hover:border-indigo-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <FiClock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Customer Balance</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Specific customer check</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Conversation Messages */}
                {messages.map((msg) => {
                  const isAI = msg.sender === 'ai';
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${isAI ? 'items-start' : 'items-end'} animate-in fade-in duration-200`}
                    >
                      {/* Message Content Container */}
                      <div className={`relative max-w-full sm:max-w-[85%] md:max-w-[80%] rounded-2xl p-4 sm:p-5 transition-all ${
                        isAI 
                          ? 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs shadow-sm shadow-slate-200/40 dark:shadow-black/20' 
                          : 'bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-tr-xs shadow-md shadow-rose-600/20'
                      }`}>
                        
                        {/* AI Author Header */}
                        {isAI && (
                          <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
                                <HiOutlineSparkles className="w-3 h-3" />
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white font-outfit">
                                KhataGPT
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.text)}
                              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-1 rounded-md"
                              title="Copy Response"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <HiOutlineCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-emerald-500 font-semibold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <HiOutlineClipboardCopy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Text Content */}
                        {isAI ? (
                          <div className="space-y-1">
                            {renderMessageText(msg.text)}
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm leading-relaxed m-0 font-medium text-white">
                            {msg.text}
                          </p>
                        )}

                        {/* Timestamp */}
                        <div className={`text-[10px] font-medium mt-2 flex items-center gap-1 ${
                          isAI ? 'text-slate-400 dark:text-slate-500' : 'text-white/80 justify-end'
                        }`}>
                          <span>
                            {new Date(msg.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      </div>

                      {/* Suggestions (AI Only) */}
                      {isAI && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 max-w-[95%]">
                          {msg.suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs inline-flex items-center gap-1.5 hover:-translate-y-0.5 hover:border-red-300 dark:hover:border-red-800"
                            >
                              <HiOutlineLightBulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{suggestion}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Thinking / Loading State */}
                {loading && (
                  <div className="flex items-start animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-sm shadow-slate-200/40 dark:shadow-black/20 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                        <HiOutlineSparkles className="w-4 h-4 animate-spin" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mt-1">
                          {lang === 'hi' ? 'खाता रिकॉर्ड्स का विश्लेषण कर रहा हूँ...' : lang === 'te' ? 'లెడ్జర్ రికార్డులను పరిశీలిస్తున్నాను...' : 'Analyzing ledger records...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Bottom Input Console */}
            <footer className="relative p-4 sm:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shrink-0 z-10">
              <div className="max-w-4xl w-full mx-auto space-y-3">
                
                {/* Voice Listening Bar */}
                {isListening && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-red-600/10 via-rose-600/10 to-amber-500/10 border border-red-500/20 rounded-2xl animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                      </span>
                      <span className="text-xs font-extrabold text-red-600 dark:text-red-400 tracking-wide uppercase">
                        {speechLang === 'hi-IN' ? 'सुन रहा हूँ... बोलिए' : speechLang === 'te-IN' ? 'వింటున్నాను... మాట్లాడండి' : 'Listening... Speak your ledger query'}
                      </span>
                    </div>
                    
                    {/* Sound Waves */}
                    <div className="flex items-center gap-0.5 h-4 shrink-0">
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-2" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-3.5" style={{ animationDelay: '0.3s' }} />
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-2" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-4" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}

                {/* Speech Language Selector Pill Bar */}
                {isSpeechSupported && (
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 select-none flex-wrap gap-2">
                    <span className="font-semibold text-[11px] sm:text-xs">
                      Speech Input Language:
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSpeechLangOverride('en-IN')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          speechLang === 'en-IN' 
                            ? 'bg-red-600 text-white shadow-xs scale-105' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLangOverride('hi-IN')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          speechLang === 'hi-IN' 
                            ? 'bg-red-600 text-white shadow-xs scale-105' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        हिन्दी (Hindi)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLangOverride('te-IN')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          speechLang === 'te-IN' 
                            ? 'bg-red-600 text-white shadow-xs scale-105' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        తెలుగు (Telugu)
                      </button>
                    </div>
                  </div>
                )}

                {/* Floating Input Field Bar */}
                <div className="relative flex items-center gap-2 p-1.5 sm:p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm focus-within:border-red-500/50 focus-within:ring-4 focus-within:ring-red-500/10 transition-all">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isListening ? (lang === 'hi' ? 'बोलिए...' : lang === 'te' ? 'మాట్లాడండి...' : 'Listening...') : "Ask about customer debts, collection totals, or type 'Ravi took 500 rupees udhar'..."}
                    disabled={loading || isListening}
                    className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-transparent border-none text-xs sm:text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white font-medium"
                  />
                  
                  {/* Microphone Button */}
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleMic}
                      disabled={loading}
                      className={`p-2.5 sm:p-3 rounded-xl border-none cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                        isListening 
                          ? 'bg-red-600 text-white animate-pulse shadow-md' 
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-600 shadow-2xs'
                      }`}
                      title={isListening ? "Stop Listening" : "Voice Input (Telugu / Hindi / English)"}
                    >
                      {isListening ? <HiOutlineX className="w-5 h-5" /> : <HiOutlineMicrophone className="w-5 h-5" />}
                    </button>
                  )}

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={loading || isListening || !inputValue.trim()}
                    className="p-2.5 sm:p-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-rose-600 hover:to-red-600 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl border-none cursor-pointer transition-all flex items-center justify-center shadow-md hover:shadow-lg disabled:shadow-none hover:scale-105 active:scale-95 shrink-0"
                    title="Send Message"
                  >
                    <HiOutlinePaperAirplane className="w-5 h-5 rotate-45" />
                  </button>
                </div>

                {/* Footer Micro Disclaimer */}
                <div className="text-center text-[10px] text-slate-400 dark:text-slate-500">
                  KhataGPT analyzes your shop ledger records securely in real time • Powered by Groq AI
                </div>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatAssistant;
