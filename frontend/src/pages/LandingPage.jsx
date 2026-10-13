import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  HiOutlineArrowRight,
  HiOutlineBadgeCheck,
  HiOutlineBell,
  HiOutlineBookOpen,
  HiOutlineCheck,
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineLockClosed,
  HiOutlineMoon,
  HiOutlinePhone,
  HiOutlineSearch,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineSun,
  HiOutlineTrendingUp,
  HiOutlineUserAdd,
  HiOutlineMicrophone,
  HiOutlineQrcode,
} from 'react-icons/hi';
import Logo from '../components/Common/Logo';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const LandingPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tiltStyle, setTiltStyle] = useState({});
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const handleGetStarted = (e) => {
    e.preventDefault();
    if (!phoneNumber) {
      toast.error('Please enter a phone number to get started.');
      return;
    }
    navigate(`/register?phone=${encodeURIComponent(phoneNumber)}`);
  };

  useEffect(() => {
    const revealItems = document.querySelectorAll('.uk-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('uk-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 80}ms`;
      observer.observe(item);
    });

    return () => observer.disconnect();
  }, []);

  const handleTilt = (event) => {
    if (window.matchMedia('(max-width: 1024px)').matches) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    setTiltStyle({
      transform: `rotateY(${x * -10 - 8}deg) rotateX(${y * 8 + 4}deg) translateY(-8px)`,
    });
  };

  const resetTilt = () => setTiltStyle({});

  const rupee = '\u20B9';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fff9f5] text-[#101525] transition-colors duration-300 dark:bg-[#0f1523] dark:text-[#f8fafc]">
      <style>
        {`
          @keyframes uk-rise {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes uk-float-large {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }

          @keyframes uk-pulse-soft {
            0%, 100% { box-shadow: 0 0 0 6px rgba(185, 28, 28, 0.15); }
            50% { box-shadow: 0 0 0 12px rgba(185, 28, 28, 0); }
          }

          @keyframes uk-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }

          .uk-rise { animation: uk-rise 800ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .uk-float-large { animation: uk-float-large 6s ease-in-out infinite; }
          .uk-pulse-soft { animation: uk-pulse-soft 2.4s ease-in-out infinite; }
          .uk-reveal { opacity: 0; transform: translateY(18px); transition: opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1); }
          .uk-reveal.uk-visible { opacity: 1; transform: translateY(0); }

          .uk-card-hover {
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
          }
          .uk-card-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 35px -10px rgba(185, 28, 28, 0.12);
          }
        `}
      </style>

      {/* TOP HEADER NAVIGATION */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/10 bg-white/90 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/90">
        <div className="w-full max-w-[1500px] mx-auto flex h-16 sm:h-20 items-center justify-between gap-3 px-4 sm:px-8 md:px-12 lg:px-16">
          
          {/* Logo Branding */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex cursor-pointer items-center gap-2 sm:gap-3 border-0 bg-transparent p-0 text-left"
          >
            <span className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
              <Logo />
            </span>
            <div>
              <span className="font-outfit text-base sm:text-xl font-black tracking-wide text-[#101525] dark:text-white block leading-tight">
                AI Digital Khata
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                Smarter Credit. Simpler Business.
              </span>
            </div>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 sm:h-10 sm:w-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white text-[#463cff] shadow-sm transition-all hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-slate-900"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <HiOutlineSun className="text-amber-400" size={17} /> : <HiOutlineMoon size={17} />}
            </button>

            {user ? (
              <button
                className="cursor-pointer flex items-center gap-1.5 rounded-xl border-0 bg-gradient-to-r from-[#B91C1C] to-[#991B1B] hover:from-[#991B1B] hover:to-[#7F1D1D] px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
                onClick={() => navigate('/dashboard')}
                type="button"
              >
                <span>Dashboard</span>
                <HiOutlineArrowRight size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  className="cursor-pointer rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95"
                  onClick={() => navigate('/login')}
                  type="button"
                >
                  Log In
                </button>
                <button
                  className="cursor-pointer rounded-xl border-0 bg-gradient-to-r from-[#B91C1C] to-[#991B1B] hover:from-[#991B1B] hover:to-[#7F1D1D] px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
                  onClick={() => navigate('/register')}
                  type="button"
                >
                  Start Free
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="overflow-x-hidden pt-16 sm:pt-20">
        <section className="w-full max-w-[1500px] mx-auto grid min-h-[640px] grid-cols-1 items-center gap-8 lg:gap-12 px-4 sm:px-8 md:px-12 lg:px-16 pt-8 sm:pt-14 pb-12 lg:grid-cols-12">
          
          {/* Left Column Content */}
          <div className="uk-rise text-left lg:col-span-6 xl:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/40 px-3 py-1 mb-4 text-[11px] sm:text-xs font-bold text-red-700 dark:text-red-300">
              <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />
              <span>India's Smartest AI Digital Ledger</span>
            </div>

            <h1 className="font-outfit text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-[#101525] dark:text-white">
              Udhaar ka hisaab,
              <span className="block text-[#B91C1C]">ab bilkul easy.</span>
            </h1>

            <p className="mt-3 sm:mt-4 text-base sm:text-lg font-bold leading-relaxed text-[#2b3242] dark:text-slate-100">
              Track customer credit, collect 3x faster via WhatsApp reminders, and settle payments effortlessly.
            </p>

            <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-[#667085] dark:text-slate-400">
              Built for Kirana shops, supermarkets, wholesale dealers, and service providers. No more bulky bahi-khatas or forgotten debts.
            </p>

            {/* Registration / Dashboard Action */}
            {user ? (
              <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#B91C1C] to-[#991B1B] hover:from-[#991B1B] hover:to-[#7F1D1D] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
                >
                  <span>Open My Khata Dashboard</span>
                  <HiOutlineArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-5 py-3.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition-all active:scale-95"
                >
                  <span>Customers</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleGetStarted} className="mt-6 flex flex-col sm:flex-row items-center gap-2.5 max-w-md">
                <div className="flex items-center w-full rounded-xl border border-black/15 bg-white dark:bg-slate-900 dark:border-white/15 px-3.5 py-3 shadow-sm">
                  <span className="text-xs font-bold text-slate-400 mr-2 border-r border-slate-200 dark:border-slate-700 pr-2">+91</span>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto cursor-pointer whitespace-nowrap rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-red-600/25 transition-all hover:scale-105 active:scale-95"
                >
                  Get Started →
                </button>
              </form>
            )}

            {/* Trust Badges */}
            <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">
                <HiOutlineShieldCheck size={15} /> 100% Safe & Backed Up
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-300">
                <HiOutlineBell size={15} /> WhatsApp Reminders
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-blue-700 dark:text-blue-300">
                <HiOutlineLockClosed size={15} /> Biometric Protected
              </span>
            </div>
          </div>

          {/* Right Column Visual Mockup */}
          <div className="uk-rise lg:col-span-6 xl:col-span-6">
            
            {/* 1. DEDICATED MOBILE APP PREVIEW CARD (Optimized for Mobile Screens) */}
            <div className="block lg:hidden w-full max-w-sm sm:max-w-md mx-auto">
              <div className="rounded-[26px] border-4 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-5 relative overflow-hidden">
                {/* Mobile Top Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-700 text-white font-black text-xs flex items-center justify-center">
                      SK
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">Sharma Kirana Store</div>
                      <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Online • Sync OK</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full">
                    3 Due
                  </span>
                </div>

                {/* Mobile Financial Summary Pills */}
                <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                  <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-2.5 text-left">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block uppercase tracking-wider">Lene Hain (Get)</span>
                    <span className="text-base sm:text-lg font-black text-red-700 dark:text-red-300 block mt-0.5">{rupee}1,45,200</span>
                  </div>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-left">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">Dene Hain (Pay)</span>
                    <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 block mt-0.5">{rupee}28,400</span>
                  </div>
                </div>

                {/* Mobile Quick Action Chips */}
                <div className="flex items-center gap-2 mb-3.5 overflow-x-auto pb-1 text-[11px] font-black">
                  <button
                    type="button"
                    onClick={() => navigate(user ? '/customers' : '/login')}
                    className="cursor-pointer shrink-0 rounded-lg bg-red-600 text-white px-2.5 py-1.5 flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <HiOutlineUserAdd size={13} />
                    <span>+ Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(user ? '/reminders' : '/login')}
                    className="cursor-pointer shrink-0 rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <HiOutlineBell size={13} />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(user ? '/dashboard' : '/login')}
                    className="cursor-pointer shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 flex items-center gap-1 active:scale-95"
                  >
                    <HiOutlineMicrophone size={13} />
                    <span>Voice</span>
                  </button>
                </div>

                {/* Mobile Ledger Customers List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200 text-xs font-black flex items-center justify-center">
                        R
                      </span>
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">Ramesh Kumar</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Kirana items • Due today</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-red-600 dark:text-red-400">{rupee}1,450</div>
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        SMS Sent
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200 text-xs font-black flex items-center justify-center">
                        P
                      </span>
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">Priya Sharma</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">GPay UPI • Settled</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">+{rupee}650</div>
                      <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                        Settled ✅
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200 text-xs font-black flex items-center justify-center">
                        V
                      </span>
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">Vikram Traders</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Grain bags • Overdue</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-red-600 dark:text-red-400">{rupee}3,800</div>
                      <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                        Follow Up 🔔
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Bottom Badge */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black">
                    <HiOutlineBadgeCheck size={14} /> Instant UPI & WhatsApp
                  </span>
                  <span>NPCI Secured</span>
                </div>
              </div>
            </div>

            {/* 2. DESKTOP WIDESCREEN PREVIEW (Displayed on Desktop Screens) */}
            <div
              className="hidden lg:block relative min-h-[460px] [perspective:1200px]"
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
            >
              <div className="uk-float-large relative w-full max-w-[700px] ml-auto">
                <div
                  className="overflow-hidden rounded-[24px] border-[6px] border-[#111a2f] bg-[#fbfdff] dark:bg-slate-900 shadow-[0_24px_70px_rgba(16,21,37,0.16)] transition-all duration-300 ease-out"
                  style={tiltStyle}
                >
                  <div className="grid min-h-[390px] grid-cols-[70px_1fr]">
                    <aside className="border-r border-[#edf0f4] dark:border-slate-800 bg-gradient-to-b from-white to-[#fbf7f6] dark:from-slate-900 dark:to-slate-950 px-3 py-5">
                      <div className="mx-auto mb-4 h-8 w-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 text-white flex items-center justify-center font-black text-xs">
                        UD
                      </div>
                      <div className="mx-auto mb-3 h-2.5 w-10 rounded-full bg-red-200 dark:bg-red-900" />
                      <div className="mx-auto mb-3 h-2.5 w-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="mx-auto h-2.5 w-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                    </aside>

                    <div className="p-5">
                      <div className="mb-4 flex items-center justify-between gap-3 font-black">
                        <span className="text-sm font-black text-slate-900 dark:text-white">Business Dashboard</span>
                        <div className="h-8 w-[45%] flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-3 text-xs font-bold text-slate-400">
                          <HiOutlineSearch size={13} />
                          <span>Search customers...</span>
                        </div>
                        <span className="uk-pulse-soft h-4 w-4 rounded-full bg-[#B91C1C]" />
                      </div>

                      <div className="mb-4 grid grid-cols-3 gap-2.5">
                        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-3 text-[10px] font-black uppercase text-[#B91C1C] text-left">
                          You will get
                          <span className="mt-1 block text-base text-[#101525] dark:text-white">
                            {rupee}2,45,000
                          </span>
                        </div>
                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 text-left">
                          You will give
                          <span className="mt-1 block text-base text-[#101525] dark:text-white">
                            {rupee}76,500
                          </span>
                        </div>
                        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 p-3 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 text-left">
                          Net balance
                          <span className="mt-1 block text-base text-[#101525] dark:text-white">
                            {rupee}1,68,500
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">
                        <div className="flex h-36 items-end gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 p-3 pt-5">
                          {[58, 82, 45, 72, 66, 92].map((height, index) => (
                            <span
                              key={index}
                              className={`flex-1 rounded-t-md ${index === 1 || index === 4 ? 'bg-emerald-500' : index === 2 ? 'bg-blue-500' : 'bg-red-500'}`}
                              style={{ height: `${height}%` }}
                            />
                          ))}
                        </div>

                        <div className="grid gap-2">
                          <DashboardRow initial="R" name="Ramesh Kumar" status="Due today" amount={`${rupee}12,500`} tone="red" />
                          <DashboardRow initial="S" name="Suresh Traders" status="Paid via UPI" amount={`+${rupee}8,000`} tone="green" />
                          <DashboardRow initial="A" name="Anil Store" status="Reminder sent" amount={`${rupee}5,600`} tone="red" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>


        {/* FEATURES GRID */}
        <section className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 py-10 sm:py-16" id="features">
          <SectionHead
            kicker="Powerful Features"
            title="Everything your counter needs to run smoothly every day."
            text="Fast entries, clear balances, timely reminders, and automatic cloud backups make daily business stress-free."
          />

          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<HiOutlineDocumentText size={24} />}
              title="AI Digital Khata Register"
              text="Add credit and debit entries in 2 seconds with customer-wise ledger history, dates, notes, and total balances."
            />
            <FeatureCard
              icon={<HiOutlineBell size={24} />}
              title="Smart WhatsApp Reminders"
              text="Send polite automatic payment reminders with instant UPI pay links directly on WhatsApp. No awkward calls."
            />
            <FeatureCard
              icon={<HiOutlineTrendingUp size={24} />}
              title="Real-Time Business Reports"
              text="Know exactly who owes what, track daily cashflow, and export neat PDF reports before closing shop."
            />
            <FeatureCard
              icon={<HiOutlineShieldCheck size={24} />}
              title="Biometric & Cloud Security"
              text="Your customer books are safely encrypted with Face ID, Fingerprint Lock, and instant cloud sync."
            />
          </div>
        </section>

        {/* WORKFLOW STEPS */}
        <section className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 py-10 sm:py-16" id="how-it-works">
          <SectionHead
            kicker="Simple 3-Step Flow"
            title="From customer credit entry to full collection in minutes."
            text="Designed for speed behind busy store counters. Tap, record, and let AI handle the reminders."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <StepCard
              number="1"
              title="Add Customer Once"
              text="Save customer name, phone number, and opening credit in 5 seconds. Stored securely forever."
            />
            <StepCard
              number="2"
              title="Record Daily Udhaar"
              text="Type amount or use Voice Entry. Ledger calculates pending dues and updates balances automatically."
            />
            <StepCard
              number="3"
              title="Collect Faster via UPI"
              text="Customers receive an automated WhatsApp notification with a one-tap UPI link to pay you directly."
            />
          </div>
        </section>

        {/* CUSTOMER REVIEWS */}
        <section className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 py-10 sm:py-16" id="reviews">
          <SectionHead
            kicker="Loved by Shopkeepers"
            title="Real stories from real businesses across India."
          />

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            <ReviewCard
              initials="RK"
              name="Ravi Kirana"
              role="Retail Store Owner • Delhi"
              quote="Earlier I lost track of small bills in rough notebooks. Now every rupee is clear on my phone, and customers pay quickly when they receive the WhatsApp reminder."
            />
            <ReviewCard
              initials="MT"
              name="Meena Textiles"
              role="Wholesale Business • Surat"
              quote="Payment reminders saved me hours of awkward calling. My pending collection improved by 40% in just two weeks of using AI Digital Khata."
            />
            <ReviewCard
              initials="AS"
              name="Anil General Store"
              role="Supermarket • Hyderabad"
              quote="The biometric face unlock and fingerprint protection give total peace of mind at the counter. Fast, reliable, and very simple to use."
            />
          </div>
        </section>

        {/* BOTTOM CTA BANNER */}
        <section className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 pt-6 pb-16">
          <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white p-6 sm:p-12 md:p-14 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
            <div className="text-left max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-full bg-red-600/30 text-red-300 text-[11px] font-black uppercase tracking-wider mb-2">
                100% Free Forever
              </span>
              <h2 className="font-outfit text-2xl sm:text-4xl font-black text-white leading-tight">
                Start your AI Digital Khata today
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Join thousands of store owners simplifying credit, stopping ledger losses, and growing their business.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="cursor-pointer rounded-xl bg-white text-slate-950 hover:bg-slate-100 px-6 py-3.5 text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Open My Dashboard</span>
                  <HiOutlineArrowRight size={15} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="cursor-pointer rounded-xl bg-white text-slate-950 hover:bg-slate-100 px-6 py-3.5 text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 flex-1"
                  >
                    <span>Get Started Free</span>
                    <HiOutlineArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="cursor-pointer rounded-xl border border-white/30 bg-transparent hover:bg-white/10 text-white px-6 py-3.5 text-xs sm:text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-2 flex-1"
                  >
                    <span>Log In</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-8 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950">
        <div className="w-full max-w-[1500px] mx-auto flex flex-col justify-between gap-4 px-4 sm:px-8 md:px-12 lg:px-16 text-xs font-bold text-slate-500 md:flex-row md:items-center text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <span className="w-8 h-8 flex items-center justify-center shrink-0">
              <Logo />
            </span>
            <span className="font-outfit text-sm font-black text-slate-900 dark:text-white">AI Digital Khata</span>
          </div>
          <span className="text-[11px] sm:text-xs">
            © {new Date().getFullYear()} AI Digital Khata. Made for Indian Retailers & Merchants.
          </span>
        </div>
      </footer>
    </div>
  );
};

const DashboardRow = ({ initial, name, status, amount, tone }) => (
  <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-[11px] font-black text-slate-900 dark:text-white">
    <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] ${tone === 'green' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
      {initial}
    </span>
    <span className="truncate text-left">
      {name}
      <span className="block text-[9px] font-bold text-slate-400 truncate">{status}</span>
    </span>
    <strong className={`whitespace-nowrap ${tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {amount}
    </strong>
  </div>
);

const SectionHead = ({ kicker, title, text }) => (
  <div className="mb-6 sm:mb-10 flex flex-col justify-between gap-3 sm:gap-5 lg:flex-row lg:items-end text-left">
    <div>
      <p className="mb-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#B91C1C]">{kicker}</p>
      <h2 className="font-outfit max-w-3xl text-2xl sm:text-3xl md:text-4xl font-black leading-tight text-[#101525] dark:text-white">
        {title}
      </h2>
    </div>
    {text && <p className="max-w-lg text-xs sm:text-sm font-semibold leading-relaxed text-[#667085] dark:text-slate-300">{text}</p>}
  </div>
);

const FeatureCard = ({ icon, title, text }) => (
  <article className="uk-reveal uk-card-hover rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 text-left">
    <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
      {icon}
    </div>
    <h3 className="font-outfit mb-2 text-base font-black text-[#101525] dark:text-white">{title}</h3>
    <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#667085] dark:text-slate-400">{text}</p>
  </article>
);

const StepCard = ({ number, title, text }) => (
  <article className="uk-reveal uk-card-hover rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 text-left">
    <span className="mb-3.5 grid h-8 w-8 place-items-center rounded-xl bg-[#B91C1C] text-xs font-black text-white shadow-sm shadow-red-600/30">
      {number}
    </span>
    <h3 className="font-outfit mb-2 text-base font-black text-[#101525] dark:text-white">{title}</h3>
    <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#667085] dark:text-slate-400">{text}</p>
  </article>
);

const ReviewCard = ({ initials, name, role, quote }) => (
  <article className="uk-reveal uk-card-hover rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 text-left flex flex-col justify-between">
    <div>
      <div className="mb-3.5 flex gap-1 text-amber-400">
        {[...Array(5)].map((_, index) => (
          <HiOutlineStar key={index} size={15} />
        ))}
      </div>
      <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#2b3242] dark:text-slate-300">"{quote}"</p>
    </div>
    <div className="mt-5 flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#B91C1C] to-[#991B1B] text-xs font-black text-white">
        {initials}
      </span>
      <div>
        <h4 className="font-outfit text-xs font-black text-[#101525] dark:text-white">{name}</h4>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{role}</p>
      </div>
    </div>
  </article>
);

export default LandingPage;
