import { NavLink } from 'react-router-dom';
import { HiOutlineHome, HiOutlineUsers, HiOutlineBookOpen, HiOutlineClock, HiOutlineCog } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const MobileBottomNav = () => {
  const { t } = useLanguage();

  const tabs = [
    { to: '/', icon: HiOutlineHome, label: t('dashboard') || 'Home', end: true },
    { to: '/customers', icon: HiOutlineUsers, label: t('customers') || 'Customers' },
    { to: '/cashbook', icon: HiOutlineBookOpen, label: t('cashbook') || 'Cashbook' },
    { to: '/history', icon: HiOutlineClock, label: 'History' },
    { to: '/settings', icon: HiOutlineCog, label: t('settings') || 'Settings' },
  ];

  const prefetchRoute = (to) => {
    if (to === '/') import('../../pages/DashboardPage');
    else if (to === '/customers') import('../../pages/CustomersPage');
    else if (to === '/cashbook') import('../../pages/CashbookPage');
    else if (to === '/history') import('../../pages/PermanentHistoryPage');
    else if (to === '/settings') import('../../pages/SettingsPage');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-pure-white border-t border-soft-gray shadow-[0_-2px_12px_rgba(15,23,42,0.08)] safe-area-bottom">
      <div className="flex items-stretch min-h-16">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onMouseEnter={() => prefetchRoute(to)}
            onTouchStart={() => prefetchRoute(to)}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold tracking-tight transition-colors duration-150 select-none ${
                isActive ? 'text-[#E22D34]' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150 ${isActive ? 'bg-red-50 scale-110' : ''}`}>
                  <Icon size={20} />
                </span>
                <span className={`truncate max-w-[64px] text-center whitespace-nowrap ${isActive ? 'text-[#E22D34]' : 'text-gray-400'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
