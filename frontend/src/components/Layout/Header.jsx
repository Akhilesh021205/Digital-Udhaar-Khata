import { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate, useOutletContext, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  HiOutlineMenuAlt2, 
  HiOutlineUser, 
  HiOutlineLogout, 
  HiOutlineSun, 
  HiOutlineMoon,
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineCog,
  HiOutlineBell,
  HiOutlineBookOpen,
  HiOutlineClock,
  HiEye,
  HiEyeOff,
  HiOutlineFingerPrint,
  HiOutlineX,
  HiOutlineLockClosed,
  HiOutlineShieldCheck
} from 'react-icons/hi';
import { FaQrcode } from 'react-icons/fa';
import Logo from '../Common/Logo';
import { SidebarContext } from './Layout';
import API from '../../api/axios';
import { toast } from 'react-toastify';

const base64urlToUint8Array = (base64url) => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const Header = ({ title, subtitle, onToggleSidebar }) => {
  const { user, logout, updateUser } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const sidebarCtx = useContext(SidebarContext);
  const context = sidebarCtx || useOutletContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);



  const toggleSidebar = () => {
    if (context && Array.isArray(context)) {
      const [sidebarOpen, setSidebarOpen] = context;
      setSidebarOpen(!sidebarOpen);
    } else if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const links = [
    { to: '/', icon: <HiOutlineHome size={18} />, label: t('dashboard') },
    { to: '/customers', icon: <HiOutlineUsers size={18} />, label: t('customers') },
    { to: '/cashbook', icon: <HiOutlineBookOpen size={18} />, label: t('cashbook') },
    { to: '/reminders', icon: <HiOutlineBell size={18} />, label: t('reminders') },
    { to: '/settings', icon: <HiOutlineCog size={18} />, label: t('settings') },
    { to: '/history', icon: <HiOutlineClock size={18} />, label: 'History' },
  ];

  return (
    <>
      <header className="fixed top-0 right-0 left-0 h-18 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm z-40">
      <div className="flex items-center gap-3">
        {/* Logo and App Name (Desktop only) */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pure-white border border-soft-gray flex items-center justify-center p-1.5 shadow-sm shrink-0">
            <Logo />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-deep-navy leading-tight">Udhaar Khata</div>
            <span className="text-[9px] text-slate-gray font-normal block mt-0.5">{t('digitalLedger') || 'Digital Ledger'}</span>
          </div>
        </div>

        {/* Mobile: show logo icon */}
        <div className="lg:hidden w-9 h-9 rounded-xl bg-pure-white border border-soft-gray flex items-center justify-center p-1.5 shadow-sm shrink-0">
          <Logo />
        </div>

        {/* Vertical Divider – desktop only */}
        <div className="hidden lg:block w-px h-8 bg-soft-gray/80 mx-1" />

        <div>
          <h1 className="text-base lg:text-lg font-semibold text-deep-navy leading-tight tracking-tight">{title}</h1>
          {subtitle && (
            <p className="hidden sm:block text-[10px] lg:text-xs text-slate-gray mt-0.5 leading-none">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Horizontal Navigation Links */}
      <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => 
              `flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive 
                  ? 'text-white bg-[#DC2626] shadow-md shadow-red-600/20' 
                  : 'text-slate-gray hover:text-deep-navy hover:bg-light-cream'
              }`
            }
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="flex items-center gap-3" id="header-actions">

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 bg-pure-white border border-soft-gray hover:bg-light-cream/50 rounded-full cursor-pointer text-slate-gray hover:text-deep-navy transition-all flex items-center justify-center shadow-xs outline-none"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <HiOutlineSun className="text-amber-500 animate-pulse" size={18} />
          ) : (
            <HiOutlineMoon className="text-indigo-600" size={18} />
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2.5 p-1 pr-3 bg-pure-white border border-soft-gray rounded-full cursor-pointer hover:bg-light-cream/30 hover:border-orange/30 transition-all text-deep-navy outline-none"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange to-orange-hover flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0 shadow-inner">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold leading-tight">{user?.name || 'User'}</div>
              <div className="text-[10px] text-slate-gray leading-none mt-0.5">{user?.storeName || 'Store'}</div>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-2 right-0 min-w-48 p-1.5 bg-pure-white border border-soft-gray rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 bg-transparent border-0 text-slate-gray cursor-pointer rounded-lg text-sm transition-colors hover:bg-slate-gray/5 hover:text-deep-navy text-left font-medium"
              >
                <HiOutlineUser className="shrink-0 text-slate-gray" size={16} /> Profile & Settings
              </button>
              <div className="h-px bg-soft-gray my-1.5 mx-2" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 py-2 bg-transparent border-0 text-red-give cursor-pointer rounded-lg text-sm transition-colors hover:bg-red-give/10 text-left font-medium"
              >
                <HiOutlineLogout className="shrink-0 text-red-give" size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    </>
  );
};

export default Header;
