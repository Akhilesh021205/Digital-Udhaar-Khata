import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { 
  HiOutlineHome, 
  HiOutlineUsers, 
  HiOutlineCog, 
  HiOutlineBell, 
  HiOutlineBookOpen, 
  HiOutlineClock, 
  HiOutlineShieldCheck, 
  HiOutlineX,
  HiOutlineCheckCircle,
  HiOutlineSparkles,
  HiOutlineMicrophone,
  HiOutlineDatabase
} from 'react-icons/hi';
import Logo from '../Common/Logo';

const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [showVersionModal, setShowVersionModal] = useState(false);

  const links = [
    { to: '/', icon: <HiOutlineHome size={19} />, label: t('dashboard') || 'Dashboard' },
    { to: '/customers', icon: <HiOutlineUsers size={19} />, label: t('customers') || 'Customers' },
    { to: '/cashbook', icon: <HiOutlineBookOpen size={19} />, label: t('cashbook') || 'Cashbook' },
    { to: '/reminders', icon: <HiOutlineBell size={19} />, label: t('reminders') || 'Reminders' },
    { to: '/settings', icon: <HiOutlineCog size={19} />, label: t('settings') || 'Settings' },
    { to: '/history', icon: <HiOutlineClock size={19} />, label: t('transactionHistory') || 'History' },
  ];

  const versionFeatures = [
    {
      title: 'Biometric & PIN Security',
      desc: '4-Digit PIN lock, WebAuthn Fingerprint, AI Face ID, and 1-minute inactivity protection.',
      icon: <HiOutlineShieldCheck className="text-emerald-500 text-lg shrink-0 mt-0.5" />
    },
    {
      title: 'AI Voice Ledger Entries',
      desc: 'Hands-free voice entry supporting Hindi, Telugu, and English.',
      icon: <HiOutlineMicrophone className="text-rose-500 text-lg shrink-0 mt-0.5" />
    },
    {
      title: 'Real-time Udhar & Jama Ledger',
      desc: 'Instant balance tracking with automated risk prediction (Trusted, Delay, Risky).',
      icon: <HiOutlineBookOpen className="text-indigo-500 text-lg shrink-0 mt-0.5" />
    },
    {
      title: '1-Tap WhatsApp & Email Reminders',
      desc: 'Direct payment reminder messages sent via WhatsApp web and Email.',
      icon: <HiOutlineBell className="text-amber-500 text-lg shrink-0 mt-0.5" />
    },
    {
      title: 'Encrypted Cloud & Auto Backup',
      desc: 'Secure data synchronization with automated database backup.',
      icon: <HiOutlineDatabase className="text-blue-500 text-lg shrink-0 mt-0.5" />
    },
    {
      title: 'Adaptive Light & Dark Mode',
      desc: 'Seamless theme switching optimized for all lighting conditions.',
      icon: <HiOutlineSparkles className="text-purple-500 text-lg shrink-0 mt-0.5" />
    }
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-deep-navy/40 backdrop-blur-xs z-40 md:hidden transition-opacity" 
          onClick={onClose} 
        />
      )}
      <aside 
        className={`fixed left-0 top-0 bottom-0 w-64 p-5 bg-pure-white dark:bg-slate-900 border-r border-soft-gray dark:border-slate-800 flex flex-col z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-2 mb-7 pt-1 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 flex items-center justify-center p-1.5 shadow-xs shrink-0">
              <Logo />
            </div>
            <div className="text-left">
              <div className="text-sm font-extrabold text-deep-navy dark:text-white leading-tight font-outfit">AI Digital Khata</div>
              <span className="text-[9px] text-slate-gray font-semibold block mt-0.5 uppercase tracking-wider">{t('digitalLedger') || 'Digital Ledger'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-gray hover:text-deep-navy dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-none bg-none cursor-pointer"
          >
            <HiOutlineX size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto flex flex-col gap-1.5 mt-2 pr-1">
          <span className="text-[10px] font-bold text-slate-gray/70 dark:text-slate-400 uppercase tracking-widest px-3.5 mb-1 shrink-0">Navigation Menu</span>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 ${isActive
                  ? 'text-white bg-rose-600 shadow-md shadow-rose-600/25 scale-[1.01]'
                  : 'text-slate-gray dark:text-slate-300 hover:text-deep-navy dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`
              }
              onClick={onClose}
            >
              <span className="text-base shrink-0">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer badge */}
        <div className="pt-4 border-t border-soft-gray/60 dark:border-slate-800/80 px-1">
          <div 
            onClick={() => setShowVersionModal(true)}
            className="p-3 bg-light-cream/40 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-xl border border-soft-gray/40 dark:border-slate-700/60 flex items-center justify-between gap-2 transition-all cursor-pointer group"
            title="Click to view app version & features"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 flex items-center justify-center p-1 shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Logo />
              </div>
              <div className="text-left min-w-0">
                <span className="text-[11px] font-bold text-deep-navy dark:text-white block leading-tight truncate">AI Digital Khata v2.0</span>
                <span className="text-[9px] text-slate-gray block mt-0.5 font-medium">Secure & Reliable</span>
              </div>
            </div>
            <span className="text-[9px] bg-rose-600/10 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-600/20 shrink-0">
              v2.0
            </span>
          </div>
        </div>
      </aside>

      {/* App Version & Features Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep-navy/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full relative z-10 animate-in zoom-in-95 duration-200 text-left space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center p-2 shadow-xs shrink-0">
                  <Logo />
                </div>
                <div>
                  <h3 className="text-lg font-black text-deep-navy dark:text-white leading-tight font-outfit">
                    AI Digital Khata v2.0
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <HiOutlineCheckCircle className="text-xs" /> v2.0.4 (Latest)
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowVersionModal(false)}
                className="p-1.5 rounded-xl text-slate-gray hover:text-deep-navy dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-none bg-transparent cursor-pointer"
              >
                <HiOutlineX size={20} />
              </button>
            </div>

            {/* Version Description */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-soft-gray/60 dark:border-slate-800 rounded-2xl text-xs text-slate-gray dark:text-slate-300 leading-relaxed font-medium">
              AI Digital Khata v2.0 is an intelligent digital ledger designed for Indian small business owners and shopkeepers to manage customer balances, track cashbook transactions, and secure business records.
            </div>

            {/* Included Features List */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-deep-navy dark:text-white uppercase tracking-wider block">
                Features in v2.0
              </span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {versionFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2.5 bg-pure-white dark:bg-slate-800/60 border border-soft-gray/50 dark:border-slate-800 rounded-xl">
                    {feat.icon}
                    <div>
                      <h4 className="text-xs font-bold text-deep-navy dark:text-white">{feat.title}</h4>
                      <p className="text-[11px] text-slate-gray dark:text-slate-400 mt-0.5 font-normal leading-snug">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Close Button */}
            <div className="pt-2 border-t border-soft-gray/50 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowVersionModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl border-none cursor-pointer transition-colors shadow-xs"
              >
                Close Version Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
