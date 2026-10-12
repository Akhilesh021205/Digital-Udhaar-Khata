import { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { 
  Bot, 
  Store, 
  ArrowLeft, 
  X, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Send, 
  Mic, 
  Copy, 
  Check, 
  Lightbulb, 
  Sparkles,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Clock
} from 'lucide-react';
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

  // Global Escape key listener to exit AI freely from anywhere
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

  // Initial welcome message (clean, professional, emoji-free)
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: `Hello ${user?.name ? user.name : 'Merchant'}! I am **KhataGPT**.\n\nI have real-time access to your ledger, customers, cashbook, and transactions for **${user?.storeName || 'your store'}**.\n\nYou can ask me questions or speak in Hindi, Telugu, or English:`,
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
      const res = await API.post('/ai/chat', {
        message: text,
        history: historyToSend
      });

      const aiReply = res.data.reply;
      const suggestions = res.data.suggestions || [];

      // Check if a transaction was auto-recorded
      if (res.data.transactionRecorded) {
        toast.success(`Entry Recorded: ₹${res.data.transactionRecorded.amount}`);
      }

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiReply,
        suggestions,
        time: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Sorry, I encountered an issue connecting to the AI ledger engine. Please check your network or try again shortly.',
        suggestions: ['Show current balances', 'View recent transactions'],
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
          <li key={lineIdx} className="ml-4 sm:ml-5 list-disc text-xs sm:text-sm leading-relaxed my-0.5 sm:my-1 text-slate-700 dark:text-slate-300">
            {renderedLine}
          </li>
        );
      }

      return (
        <p key={lineIdx} className="text-xs sm:text-sm leading-relaxed my-0.5 sm:my-1 text-slate-700 dark:text-slate-300">
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
      {/* Floating Action Button (Elevated above mobile bottom navigation) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 hover:from-rose-600 hover:to-red-600 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-none cursor-pointer group active:scale-95 touch-manipulation"
        title="Open KhataGPT Assistant"
        id="ai-chat-btn"
      >
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6 animate-in spin-in-90 duration-200" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-300"></span>
            </span>
          </div>
        )}
      </button>

      {/* Full-Screen Immersive Chat Canvas Overlay (Optimized with 100dvh for mobile address bars) */}
      {isOpen && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950 transition-all duration-300 h-dvh max-h-dvh overflow-hidden ${
            isFullscreen ? 'p-0' : 'p-0 sm:p-6 md:p-8 bg-slate-950/60 backdrop-blur-md'
          }`}
        >
          {/* Main Chat Container Box */}
          <div 
            className={`relative w-full h-full bg-white dark:bg-slate-900 flex flex-col overflow-hidden transition-all duration-300 ${
              isFullscreen 
                ? 'rounded-none shadow-none border-none' 
                : 'max-w-5xl mx-auto sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {/* Ambient Background Glow Effect */}
            <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-r from-red-500/10 via-rose-500/5 to-amber-500/10 blur-3xl rounded-full" />
            
            {/* Top Navigation & Status Bar (Mobile-optimized padding & spacing) */}
            <header className="relative px-3 sm:px-6 py-2.5 sm:py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 z-10 shrink-0">
              
              {/* Left Side: Exit/Back Button + Branding */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile & Desktop Exit Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-2xs group shrink-0 active:scale-95"
                  title="Exit Khata AI (Esc)"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  <span className="hidden sm:inline">Exit</span>
                  <span className="sm:hidden font-medium">Exit</span>
                  <kbd className="hidden md:inline-block text-[10px] px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-400 font-mono">Esc</kbd>
                </button>

                {/* AI Avatar */}
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-600/20 shrink-0">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                {/* Brand & Store Name */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white font-outfit m-0 leading-tight">
                      KhataGPT
                    </h2>
                    <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-red-600 to-rose-600 text-white font-black px-1.5 py-0.5 rounded-full shadow-2xs tracking-wider uppercase">
                      AI v2.0
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    <Store className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
                      {user?.storeName ? user.storeName : 'Digital Udhaar Khata'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Action Toolbar */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Clear Chat / New Chat Button */}
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Clear Conversation & Start New Chat"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">New Chat</span>
                </button>

                {/* Fullscreen / Windowed View Toggle (Desktop only) */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden sm:flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs"
                  title={isFullscreen ? "Windowed Mode" : "Full Screen Mode"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Secondary Quick Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer border border-red-200/80 dark:border-red-800/80 shadow-2xs active:scale-95"
                  title="Exit KhataGPT"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Centered Scrollable Conversation Canvas */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 overscroll-contain">
              <div className="max-w-4xl w-full mx-auto space-y-4 sm:space-y-6">
                
                {/* Starter Capability Cards (2x2 grid on mobile for optimal thumb reach) */}
                {messages.length <= 1 && (
                  <div className="mb-4 sm:mb-8 p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-50 via-rose-50/20 to-amber-50/20 dark:from-slate-900 dark:via-rose-950/10 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 uppercase tracking-wider">
                        Khata Intelligence
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Instant Insights
                      </span>
                    </div>
                    <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white font-outfit m-0">
                      What would you like to explore today?
                    </h3>
                    <p className="text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 mt-1 mb-3.5 sm:mb-5 leading-relaxed font-normal">
                      Tap any card or speak naturally to query balances, cash totals, or record ledger entries.
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => handleSendMessage("Who has highest due?")}
                        className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-red-400 hover:shadow-md dark:hover:border-red-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs active:scale-98"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div>
                          <div className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white leading-tight">Highest Dues</div>
                          <div className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">Find top debt</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage("Show this month collection")}
                        className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400 hover:shadow-md dark:hover:border-emerald-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs active:scale-98"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div>
                          <div className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white leading-tight">Collection</div>
                          <div className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">Monthly cashflow</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage("Who are the risky customers?")}
                        className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400 hover:shadow-md dark:hover:border-amber-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs active:scale-98"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div>
                          <div className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white leading-tight">Risky Accounts</div>
                          <div className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">Delayed payments</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage(`How much udhar does ${firstCustomerName || 'Ravi'} have?`)}
                        className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 hover:shadow-md dark:hover:border-indigo-500/50 transition-all text-left cursor-pointer group flex flex-col justify-between shadow-2xs active:scale-98"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div>
                          <div className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white leading-tight">Balance Check</div>
                          <div className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">Customer dues</div>
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
                      <div className={`relative max-w-[90%] sm:max-w-[85%] md:max-w-[80%] rounded-2xl p-3.5 sm:p-5 transition-all ${
                        isAI 
                          ? 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs shadow-sm shadow-slate-200/40 dark:shadow-black/20' 
                          : 'bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-tr-xs shadow-md shadow-rose-600/20'
                      }`}>
                        
                        {/* AI Author Header */}
                        {isAI && (
                          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
                                <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </span>
                              <span className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white font-outfit">
                                KhataGPT
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.text)}
                              className="text-[10px] sm:text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-1 rounded-md active:scale-95"
                              title="Copy Response"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
                                  <span className="text-emerald-500 font-semibold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
                        <div className={`text-[9px] sm:text-[10px] font-medium mt-1.5 flex items-center gap-1 ${
                          isAI ? 'text-slate-400 dark:text-slate-500' : 'text-white/80 justify-end'
                        }`}>
                          <span>
                            {new Date(msg.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      </div>

                      {/* Suggestions (AI Only, scrollable/wrapped cleanly for mobile) */}
                      {isAI && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2.5 max-w-full">
                          {msg.suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs inline-flex items-center gap-1.5 active:scale-95 hover:border-red-300 dark:hover:border-red-800 text-left"
                            >
                              <Lightbulb className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate max-w-[220px] xs:max-w-none">{suggestion}</span>
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
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl rounded-tl-xs p-3.5 sm:p-5 shadow-sm shadow-slate-200/40 dark:shadow-black/20 flex items-center gap-2.5 sm:gap-3">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mt-1">
                          {lang === 'hi' ? 'खाता रिकॉर्ड्स का विश्लेषण कर रहा हूँ...' : lang === 'te' ? 'లెడ్జర్ రికార్డులను పరిశీలిస్తున్నాను...' : 'Analyzing ledger records...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Bottom Input Console (Padded for mobile bottom gesture safe area) */}
            <footer className="relative p-2.5 sm:p-4 md:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shrink-0">
              <div className="max-w-4xl w-full mx-auto space-y-2 sm:space-y-3">
                
                {/* Active Voice Listening Banner */}
                {isListening && (
                  <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 shadow-xs animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-red-600"></span>
                      </span>
                      <span className="text-[11px] sm:text-xs font-extrabold text-red-600 dark:text-red-400 tracking-wide uppercase">
                        {speechLang === 'hi-IN' ? 'सुन रहा हूँ... बोलिए' : speechLang === 'te-IN' ? 'వింటున్నాను... మాట్లాడండి' : 'Listening... Speak your ledger query'}
                      </span>
                    </div>
                    
                    {/* Sound Waves */}
                    <div className="flex items-center gap-0.5 h-3.5 sm:h-4 shrink-0">
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-2" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-3 sm:h-3.5" style={{ animationDelay: '0.3s' }} />
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-2" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1 rounded-full bg-red-600 animate-bounce h-3.5 sm:h-4" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}

                {/* Speech Language Selector Pill Bar (Clean horizontal scroll for mobile) */}
                {isSpeechSupported && (
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 select-none gap-2 flex-wrap sm:flex-nowrap">
                    <span className="font-semibold text-[10px] sm:text-xs shrink-0">
                      Speech Language:
                    </span>
                    <div className="flex gap-1 sm:gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSpeechLangOverride('en-IN')}
                        className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all active:scale-95 ${
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
                        className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all active:scale-95 ${
                          speechLang === 'hi-IN' 
                            ? 'bg-red-600 text-white shadow-xs scale-105' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        हिन्दी
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLangOverride('te-IN')}
                        className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all active:scale-95 ${
                          speechLang === 'te-IN' 
                            ? 'bg-red-600 text-white shadow-xs scale-105' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        తెలుగు
                      </button>
                    </div>
                  </div>
                )}

                {/* Floating Input Field Bar (Touch optimized) */}
                <div className="relative flex items-center gap-1.5 sm:gap-2 p-1 sm:p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl sm:rounded-2xl shadow-sm focus-within:border-red-500/50 focus-within:ring-2 sm:focus-within:ring-4 focus-within:ring-red-500/10 transition-all">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isListening ? (lang === 'hi' ? 'बोलिए...' : lang === 'te' ? 'మాట్లాడండి...' : 'Listening...') : "Ask balance, collection, or enter dues..."}
                    disabled={loading || isListening}
                    className="flex-1 px-2.5 sm:px-4 py-2 sm:py-3 bg-transparent border-none text-xs sm:text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white font-medium"
                  />
                  
                  {/* Microphone Button */}
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleMic}
                      disabled={loading}
                      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl border-none cursor-pointer transition-all flex items-center justify-center shrink-0 w-8 h-8 sm:w-10 sm:h-10 active:scale-95 ${
                        isListening 
                          ? 'bg-red-600 text-white animate-pulse shadow-md' 
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-600 shadow-2xs'
                      }`}
                      title={isListening ? "Stop Listening" : "Voice Input (Telugu / Hindi / English)"}
                    >
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={loading || isListening || !inputValue.trim()}
                    className="p-2 sm:p-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-rose-600 hover:to-red-600 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-lg sm:rounded-xl border-none cursor-pointer transition-all flex items-center justify-center shadow-md hover:shadow-lg disabled:shadow-none hover:scale-105 active:scale-95 shrink-0 w-8 h-8 sm:w-10 sm:h-10"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Footer Micro Disclaimer with quick Exit reminder */}
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 px-1">
                  <span className="truncate max-w-[200px] xs:max-w-none">KhataGPT analyzes ledger records in real time</span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="hover:text-red-500 underline transition-colors cursor-pointer bg-transparent border-none p-0 shrink-0 ml-2"
                  >
                    Exit (Esc)
                  </button>
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
