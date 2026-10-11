import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { 
  HiOutlineHome, 
  HiOutlineUsers, 
  HiOutlineCog, 
  HiOutlineBell, 
  HiOutlineBookOpen, 
  HiOutlineClock
} from 'react-icons/hi';
import Logo from '../Common/Logo';

const Sidebar = () => {
  const { t } = useLanguage();

  const links = [
    { to: '/', icon: <HiOutlineHome size={19} />, label: t('dashboard') || 'Dashboard' },
    { to: '/customers', icon: <HiOutlineUsers size={19} />, label: t('customers') || 'Customers' },
    { to: '/cashbook', icon: <HiOutlineBookOpen size={19} />, label: t('cashbook') || 'Cashbook' },
    { to: '/reminders', icon: <HiOutlineBell size={19} />, label: t('reminders') || 'Reminders' },
    { to: '/history', icon: <HiOutlineClock size={19} />, label: t('transactionHistory') || 'History' },
    { to: '/settings', icon: <HiOutlineCog size={19} />, label: t('settings') || 'Settings' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 p-5 bg-pure-white dark:bg-slate-900 border-r border-soft-gray dark:border-slate-800 flex-col z-40">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 mb-7 pt-1 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 flex items-center justify-center p-1.5 shadow-xs shrink-0">
          <Logo />
        </div>
        <div className="text-left">
          <div className="text-sm font-extrabold text-deep-navy dark:text-white leading-tight font-outfit">AI Digital Khata</div>
          <span className="text-[9px] text-slate-gray font-semibold block mt-0.5 uppercase tracking-wider">{t('digitalLedger') || 'Digital Ledger'}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-1 overflow-y-auto flex-col gap-1.5 mt-2 pr-1">
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
          >
            <span className="text-base shrink-0">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
