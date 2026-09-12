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

  return (
    <>
      <header className="fixed top-0 right-0 left-0 md:left-64 h-18 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-light-cream/70 dark:bg-slate-900/80 backdrop-blur-md border-b border-soft-gray dark:border-slate-800 shadow-xs z-30 transition-all duration-300">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle button */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-xl text-slate-gray hover:text-deep-navy dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-none bg-none cursor-pointer"
          >
            <HiOutlineMenuAlt2 size={22} />
          </button>

          <div>
            <h1 className="text-base lg:text-lg font-bold text-deep-navy dark:text-white leading-tight tracking-tight font-outfit">{title}</h1>
            {subtitle && (
              <p className="hidden sm:block text-[10px] lg:text-xs text-slate-gray dark:text-slate-400 mt-0.5 leading-none font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0" id="header-actions">
          {/* Theme toggle button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 hover:bg-light-cream/50 dark:hover:bg-slate-700/60 rounded-full cursor-pointer text-slate-gray dark:text-slate-300 hover:text-deep-navy dark:hover:text-white transition-all flex items-center justify-center shadow-xs outline-none"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <HiOutlineSun className="text-amber-400 animate-pulse" size={18} />
            ) : (
              <HiOutlineMoon className="text-indigo-600" size={18} />
            )}
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-2.5 p-1 pr-3 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-full cursor-pointer hover:bg-light-cream/30 hover:border-orange/30 transition-all text-deep-navy dark:text-white outline-none"
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
              <div className="absolute top-full mt-2 right-0 min-w-48 p-1.5 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 bg-transparent border-0 text-slate-gray dark:text-slate-300 cursor-pointer rounded-lg text-sm transition-colors hover:bg-slate-gray/5 dark:hover:bg-slate-800 hover:text-deep-navy dark:hover:text-white text-left font-medium"
                >
                  <HiOutlineUser className="shrink-0 text-slate-gray" size={16} /> Profile & Settings
                </button>
                <div className="h-px bg-soft-gray dark:bg-slate-800 my-1.5 mx-2" />
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
