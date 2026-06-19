import { NavLink } from 'react-router-dom';
import { HiOutlineHome, HiOutlineUsers, HiOutlineBookOpen, HiOutlineBell, HiOutlineCog } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const MobileBottomNav = () => {
  const { t } = useLanguage();

  const tabs = [
    { to: '/', icon: HiOutlineHome, label: t('dashboard') || 'Home', end: true },
    { to: '/customers', icon: HiOutlineUsers, label: t('customers') || 'Customers' },
    { to: '/cashbook', icon: HiOutlineBookOpen, label: t('cashbook') || 'Cashbook' },
    { to: '/reminders', icon: HiOutlineBell, label: t('reminders') || 'Reminders' },
    { to: '/settings', icon: HiOutlineCog, label: t('settings') || 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] safe-area-bottom">
      <div className="flex items-stretch h-16">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-tight transition-colors duration-150 select-none ${
                isActive ? 'text-[#E22D34]' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150 ${isActive ? 'bg-red-50 scale-110' : ''}`}>
                  <Icon size={20} />
                </span>
                <span className={isActive ? 'text-[#E22D34]' : 'text-gray-400'}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
