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
  HiOutlineLockClosed
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

  // UPI Modal States
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [isUpiUnlocked, setIsUpiUnlocked] = useState(false);
  const [upiView, setUpiView] = useState('lock'); // 'lock' | 'otp' | 'form'
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [upiIdInput, setUpiIdInput] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [deviceSupportsBio, setDeviceSupportsBio] = useState(false);

  useEffect(() => {
    const checkBiometricSupport = async () => {
      if (window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setDeviceSupportsBio(available);
        } catch (e) {
          setDeviceSupportsBio(false);
        }
      }
    };
    checkBiometricSupport();
  }, []);

  useEffect(() => {
    if (showUpiModal) {
      setUpiIdInput(user?.upiId || '');
      setIsUpiUnlocked(false);
      setUpiView('lock');
      setVerifyPasswordInput('');
      setOtpInput('');
      setShowModalPassword(false);
    }
  }, [showUpiModal, user]);

  const verifyBiometricOnServer = async (credentialId) => {
    setVerifyingPassword(true);
    try {
      await API.post('/auth/verify-biometric', { credentialId });
      setIsUpiUnlocked(true);
      setUpiView('form');
      toast.success('UPI ID settings unlocked');
    } catch {
      toast.error('Biometric authentication failed');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (!user?.isBiometricEnabled) return;

    if (deviceSupportsBio) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        let credentialIdBuffer;
        if (user.biometricCredentialId.startsWith('mock-')) {
          credentialIdBuffer = new TextEncoder().encode(user.biometricCredentialId);
        } else {
          try {
            credentialIdBuffer = base64urlToUint8Array(user.biometricCredentialId);
          } catch {
            credentialIdBuffer = new TextEncoder().encode(user.biometricCredentialId);
          }
        }

        const getOptions = {
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            allowCredentials: [{
              id: credentialIdBuffer,
              type: 'public-key'
            }],
            userVerification: 'required',
            timeout: 60000
          }
        };

        const credential = await navigator.credentials.get(getOptions);
        if (credential) {
          await verifyBiometricOnServer(user.biometricCredentialId);
        }
      } catch (err) {
        console.warn("WebAuthn verification error:", err);
      }
    }
  };

  useEffect(() => {
    if (showUpiModal && upiView === 'lock' && user?.isBiometricEnabled) {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showUpiModal, upiView, user]);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setVerifyingPassword(true);
    try {
      await API.post('/auth/verify-password', { password: verifyPasswordInput });
      setIsUpiUnlocked(true);
      setUpiView('form');
      toast.success('UPI ID settings unlocked');
    } catch (err) {
      if (err.response?.data?.requireEmailOtp) {
        setUpiView('otp');
        setOtpInput('');
        toast.info('Verification OTP sent to your registered email address.');
      } else {
        toast.error(err.response?.data?.message || 'Incorrect password.');
      }
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setVerifyingOtp(true);
    try {
      await API.post('/auth/verify-email-otp', { otp: otpInput });
      setIsUpiUnlocked(true);
      setUpiView('form');
      toast.success('UPI ID settings unlocked');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSaveUpi = async (e) => {
    e.preventDefault();
    setSavingUpi(true);
    try {
      const { data } = await API.put('/auth/me', {
        name: user.name,
        storeName: user.storeName,
        phone: user.phone,
        avatar: user.avatar,
        upiId: upiIdInput
      });
      updateUser(data.data);
      toast.success('UPI ID updated successfully');
      setShowUpiModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update UPI ID');
    } finally {
      setSavingUpi(false);
    }
  };

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
      <header className="fixed top-0 right-0 left-0 h-18 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-soft-white/80 backdrop-blur-md border-b border-soft-gray z-40">
      <div className="flex items-center">
        <button 
          className="lg:hidden mr-3 p-2 text-slate-gray hover:bg-slate-gray/10 rounded-lg cursor-pointer flex items-center justify-center border-none bg-none" 
          onClick={toggleSidebar}
          id="menu-toggle"
        >
          <HiOutlineMenuAlt2 size={22} />
        </button>

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

        {/* Vertical Divider */}
        <div className="hidden lg:block w-px h-8 bg-soft-gray/80 mx-4" />

        <div>
          <h1 className="text-base lg:text-lg font-bold text-deep-navy leading-none">{title}</h1>
          {subtitle && (
            <p className="text-[10px] lg:text-xs text-slate-gray mt-1 leading-none">
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
        {/* UPI QR Settings Button */}
        <button
          onClick={() => setShowUpiModal(true)}
          className="w-9 h-9 bg-pure-white border border-soft-gray hover:bg-light-cream/50 rounded-full cursor-pointer text-slate-gray hover:text-deep-navy transition-all flex items-center justify-center shadow-xs outline-none"
          title="UPI Payments QR Setup"
        >
          <FaQrcode className="text-deep-navy" size={16} />
        </button>

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

    {/* UPI QR Settings Modal */}
    {showUpiModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep-navy/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-pure-white border border-soft-gray p-6 rounded-2xl shadow-2xl flex flex-col gap-4 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 font-sans text-deep-navy text-left">
          
          {/* Modal Header */}
          <div className="flex justify-between items-center pb-2 border-b border-soft-gray/50">
            <h3 className="text-base font-bold text-deep-navy m-0 flex items-center gap-2">
              <FaQrcode className="text-[#DC2626]" size={18} />
              <span>UPI Payment Settings</span>
            </h3>
            <button
              onClick={() => setShowUpiModal(false)}
              className="p-1 hover:bg-soft-gray/20 rounded-lg cursor-pointer transition-colors border-none bg-none text-slate-gray"
            >
              <HiOutlineX size={18} />
            </button>
          </div>

          {/* Lock View */}
          {upiView === 'lock' && (
            <form onSubmit={handleVerifyPassword} className="space-y-4 text-left">
              <div className="flex items-center gap-3 p-3 bg-light-cream/40 border border-soft-gray rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-orange/10 flex items-center justify-center text-orange flex-shrink-0">
                  <HiOutlineLockClosed size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-deep-navy m-0">Security Unlock Required</h4>
                  <p className="text-[10px] text-slate-gray m-0 mt-0.5">Please enter your login password to unlock and edit UPI ID settings.</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray uppercase tracking-wider">Account Password</label>
                <div className="relative flex items-center">
                  <input
                    type={showModalPassword ? "text" : "password"}
                    required
                    placeholder="Enter login password"
                    value={verifyPasswordInput}
                    onChange={(e) => setVerifyPasswordInput(e.target.value)}
                    className="w-full pl-4 pr-12 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-3 text-slate-gray/70 hover:text-deep-navy cursor-pointer flex items-center justify-center p-1.5 hover:bg-soft-gray/20 rounded-lg transition-all border-none bg-none"
                  >
                    {showModalPassword ? <HiEye size={18} /> : <HiEyeOff size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyingPassword}
                className="w-full py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow-sm transition-colors flex items-center justify-center"
              >
                {verifyingPassword ? (
                  <span className="w-4 h-4 border-2 border-pure-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Verify & Unlock'
                )}
              </button>

              {user?.isBiometricEnabled && (
                <div className="flex flex-col items-center justify-center pt-3 border-t border-soft-gray/50 mt-3">
                  <span className="text-[10px] font-bold text-slate-gray uppercase tracking-wider mb-2">Or Unlock With Biometrics</span>
                  <button
                    type="button"
                    onClick={handleBiometricAuth}
                    disabled={verifyingPassword}
                    className="w-12 h-12 rounded-full bg-orange/10 border border-orange/20 flex items-center justify-center text-orange hover:bg-orange hover:text-white hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="Unlock with Fingerprint or Face ID"
                  >
                    <HiOutlineFingerPrint size={24} />
                  </button>
                </div>
              )}
            </form>
          )}

          {/* OTP Verification View */}
          {upiView === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
              <div className="flex items-center gap-3 p-3 bg-red-give/10 border border-red-give/20 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-red-give/10 flex items-center justify-center text-red-give flex-shrink-0">
                  <HiOutlineLockClosed size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-deep-navy m-0">Email verification required</h4>
                  <p className="text-[10px] text-slate-gray m-0 mt-0.5">Please check your email. Enter the 6-digit verification code sent to your account.</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray uppercase tracking-wider">6-Digit Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm text-center font-bold tracking-[8px] focus:outline-none focus:border-orange transition-all"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="flex-1 py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow-sm transition-colors flex items-center justify-center"
                >
                  {verifyingOtp ? (
                    <span className="w-4 h-4 border-2 border-pure-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Verify Code'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setUpiView('lock')}
                  className="flex-1 py-2.5 bg-transparent border border-soft-gray text-slate-gray font-semibold text-xs rounded-xl cursor-pointer hover:bg-soft-white transition-colors"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {/* Unlocked Form / QR View */}
          {upiView === 'form' && (
            <form onSubmit={handleSaveUpi} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Your UPI ID (VPA)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., storeowner@upi"
                  value={upiIdInput}
                  onChange={(e) => setUpiIdInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
                  autoFocus
                />
                <p className="text-[9px] text-slate-gray">Used to automatically generate secure QR links for ledger settlements.</p>
              </div>

              {/* QR Code Preview Block */}
              {upiIdInput && (
                <div className="p-3 bg-light-cream/40 border border-soft-gray rounded-xl flex flex-col items-center gap-2.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="bg-pure-white border border-soft-gray/60 p-2 rounded-xl shadow-xs">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=${upiIdInput}&pn=${encodeURIComponent(user?.storeName || 'Merchant')}&cu=INR`
                      )}`} 
                      alt="Store UPI QR Code" 
                      className="w-28 h-28 object-contain block bg-pure-white rounded-lg"
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-deep-navy block">Store Payment QR Preview</span>
                    <span className="text-[9px] text-slate-gray mt-0.5 block font-mono font-bold text-orange">{upiIdInput}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="flex-1 py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow-sm transition-colors flex items-center justify-center"
                >
                  {savingUpi ? (
                    <span className="w-4 h-4 border-2 border-pure-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  className="flex-1 py-2.5 bg-transparent border border-soft-gray text-slate-gray font-semibold text-xs rounded-xl cursor-pointer hover:bg-soft-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    )}
    </>
  );
};

export default Header;
