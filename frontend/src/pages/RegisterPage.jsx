import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Common/Logo';
import { HiOutlineEye, HiOutlineEyeOff, HiPlus, HiOutlineX, HiOutlineCheckCircle, HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineBell, HiOutlineDocumentText, HiCheck } from 'react-icons/hi';
import { useGoogleLogin } from '@react-oauth/google';

const passwordRules = [
  {
    id: 'length',
    label: 'At least 8 characters long',
    test: (pw) => pw.length >= 8
  },
  {
    id: 'uppercase',
    label: '1 Capital letter (A-Z)',
    test: (pw) => /[A-Z]/.test(pw)
  },
  {
    id: 'lowercase',
    label: '1 Small letter (a-z)',
    test: (pw) => /[a-z]/.test(pw)
  },
  {
    id: 'number',
    label: '1 Number (0-9)',
    test: (pw) => /[0-9]/.test(pw)
  },
  {
    id: 'special',
    label: '1 Special character (!@#$%^&*)',
    test: (pw) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw)
  }
];

const mockGoogleAccounts = [
  {
    name: 'Akhilesh Goud',
    email: 'akhilesh.goud@mock.digitaludhaar.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150'
  },
  {
    name: 'Punju Store Owner',
    email: 'punju.store@mock.digitaludhaar.com',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150'
  },
  {
    name: 'Demo Merchant',
    email: 'demo.merchant@mock.digitaludhaar.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150'
  }
];

// Helper to safely convert raw ASCII SVG to a standard Base64 Data URL
const svgToBase64 = (svgMarkup) => {
  return `data:image/svg+xml;base64,${btoa(svgMarkup.trim())}`;
};

const storeSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#E0F2FE"/>
  <rect x="25" y="55" width="50" height="25" rx="2" fill="#0EA5E9"/>
  <path d="M20 45h60l-5 12H25l-5-12z" fill="#0284C7"/>
  <path d="M20 45l5-8h50l5 8H20z" fill="#0369A1"/>
  <rect x="42" y="62" width="16" height="18" rx="1" fill="#F8FAFC"/>
  <circle cx="46" cy="71" r="1.5" fill="#64748B"/>
  <rect x="29" y="62" width="10" height="10" rx="1" fill="#38BDF8"/>
  <rect x="61" y="62" width="10" height="10" rx="1" fill="#38BDF8"/>
</svg>
`;

const maleSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#E6F4F1"/>
  <path d="M22 82c0-8 8-15 17-17h22c9 0 17 7 17 15v6H22v-6z" fill="#0D9488"/>
  <rect x="45" y="52" width="10" height="12" fill="#F3B395"/>
  <circle cx="50" cy="42" r="16" fill="#F8C4AD"/>
  <path d="M34 38c2-10 10-14 16-14s14 4 16 14c-1-5-6-8-16-8s-15 3-16 8z" fill="#2E2219"/>
  <path d="M33 38c0-3 3-8 8-10h18c5 2 8 7 8 10v4h-4c-2-3-6-4-10-4s-8 1-10 4h-2v-4z" fill="#2E2219"/>
  <circle cx="45" cy="42" r="1.8" fill="#2E2219"/>
  <circle cx="55" cy="42" r="1.8" fill="#2E2219"/>
  <path d="M47 48.5c1.5 1.5 4.5 1.5 6 0" stroke="#2E2219" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`;

const femaleSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#FDF2F8"/>
  <path d="M22 82c0-8 8-15 17-17h22c9 0 17 7 17 15v6H22v-6z" fill="#EC4899"/>
  <rect x="45" y="52" width="10" height="12" fill="#F3B395"/>
  <circle cx="50" cy="42" r="16" fill="#F8C4AD"/>
  <path d="M34 44c-1-8 4-16 16-16s17 8 16 16c0 10-2 15-4 17-2-6-5-9-12-9s-10 3-12 9c-2-2-4-7-4-17z" fill="#4B3621"/>
  <path d="M34 35c3-6 10-7 16-7s13 1 16 7" stroke="#4B3621" stroke-width="3" stroke-linecap="round"/>
  <circle cx="45" cy="42" r="1.8" fill="#2E2219"/>
  <circle cx="55" cy="42" r="1.8" fill="#2E2219"/>
  <path d="M47 48.5c1.5 1.5 4.5 1.5 6 0" stroke="#2E2219" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`;

const ledgerSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#FFFBEB"/>
  <rect x="30" y="28" width="40" height="48" rx="4" fill="#F59E0B"/>
  <rect x="34" y="28" width="36" height="48" rx="2" fill="#D97706"/>
  <rect x="26" y="34" width="8" height="3" rx="1.5" fill="#9CA3AF"/>
  <rect x="26" y="44" width="8" height="3" rx="1.5" fill="#9CA3AF"/>
  <rect x="26" y="54" width="8" height="3" rx="1.5" fill="#9CA3AF"/>
  <rect x="26" y="64" width="8" height="3" rx="1.5" fill="#9CA3AF"/>
  <path d="M44 42h12M44 47h9M49 42c3.5 0 5 2 5 4s-1.5 4-5 4h-4l6 7" stroke="#FFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const presets = [
  { label: 'Store', value: svgToBase64(storeSvg) },
  { label: 'Male Merchant', value: svgToBase64(maleSvg) },
  { label: 'Female Merchant', value: svgToBase64(femaleSvg) },
  { label: 'Ledger Book', value: svgToBase64(ledgerSvg) }
];

const RegisterPage = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    storeName: '',
    phone: '',
    avatar: presets[0].value
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMockChooser, setShowMockChooser] = useState(false);
  const { register, googleSignIn, mockGoogleSignIn } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const googleLoginTrigger = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError('');
      setLoading(true);
      try {
        await googleSignIn(tokenResponse.access_token);
        navigate('/');
      } catch (err) {
        setError(err.response?.data?.message || 'Google Sign-In failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setShowMockChooser(true);
    }
  });

  const handleGoogleClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId.includes('dummy')) {
      setShowMockChooser(true);
      return;
    }
    try {
      googleLoginTrigger();
    } catch (err) {
      setShowMockChooser(true);
    }
  };

  const handleMockSelect = async (mockAccount) => {
    setShowMockChooser(false);
    setError('');
    setLoading(true);
    try {
      await mockGoogleSignIn(mockAccount.email, mockAccount.name, mockAccount.avatar);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Simulated Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const phoneParam = query.get('phone');
    if (phoneParam) {
      setForm(prev => ({ ...prev, phone: `+91 ${phoneParam}` }));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Check all password security requirements
    const failedRules = passwordRules.filter(rule => !rule.test(form.password));
    if (failedRules.length > 0) {
      setError('Password must contain at least 8 characters, 1 capital letter, 1 small letter, 1 number, and 1 special character.');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center udhaar-page-bg p-4 sm:p-6 lg:p-10 relative overflow-hidden py-8 sm:py-12">
      {/* Decorative Ambient Background Glows */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-96 h-96 bg-[#DC2626]/10 rounded-full blur-3xl -z-10" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl -z-10" />

      {/* Side-by-Side Responsive Card */}
      <div className="w-full max-w-5xl bg-pure-white border border-soft-gray rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        {/* LEFT COLUMN: Feature Highlights Showcase */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 bg-[#DC2626]/25 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 w-64 h-64 bg-rose-600/15 rounded-full blur-3xl" />

          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6 sm:mb-8 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-11 h-11 flex items-center justify-center p-2 text-white">
                <Logo />
              </div>
              <div>
                <span className="font-extrabold text-xl text-white tracking-tight leading-none block font-jakarta">
                  AI Digital Khata
                </span>
                <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                  Smart Credits. Simple Business.
                </span>
              </div>
            </div>

            {/* Headline */}
            <h2 className="text-2xl sm:text-3xl font-extrabold font-jakarta text-white leading-tight mb-3 sm:mb-4 drop-shadow-sm">
              Start managing your credits digitally today
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 sm:mb-8 font-medium">
              Join thousands of Kirana shopkeepers and business owners managing customer records, reminders, and daily payments with total peace of mind.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-3.5 sm:space-y-4 mb-6 sm:mb-8">
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-9 h-9 rounded-xl bg-rose-500/25 text-rose-300 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/30">
                  <HiOutlineDocumentText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm font-jakarta text-white">Instant Credit Management</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Manage money given or received with date, notes & totals.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/25 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                  <HiOutlineBell size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm font-jakarta text-white">Automated Reminders</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Send polite WhatsApp & SMS notices with direct UPI payment links.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-9 h-9 rounded-xl bg-blue-500/25 text-blue-300 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
                  <HiOutlineShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm font-jakarta text-white">Cloud & Biometric Security</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Your store data is always backed up and protected with fingerprint/PIN lock.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="relative z-10 pt-5 border-t border-slate-700/70 flex items-center gap-2 text-xs font-bold text-emerald-400">
            <HiOutlineCheckCircle size={20} className="shrink-0 text-emerald-400" />
            <span>100% Free Setup &bull; No Credit Card Required</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Registration Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-pure-white">
          <div>
            {/* Header */}
            <div className="text-left mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1 font-jakarta tracking-tight">
                Create Account
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Fill in your details to start managing your store</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5 text-[#DC2626] text-sm text-center font-semibold animate-pulse shadow-xs">
                {error}
              </div>
            )}

            {/* Registration Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              
              {/* Profile Picture Selector */}
              <div className="flex flex-col gap-1.5 mb-2 text-left">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Profile Picture
                </label>
                <div className="flex items-center gap-3.5 p-3 bg-slate-50/80 border border-slate-200 rounded-2xl w-full">
                  {/* Avatar Preview */}
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border-2 border-[#DC2626] flex items-center justify-center overflow-hidden cursor-pointer shadow-sm hover:scale-105 transition-transform"
                      onClick={() => fileInputRef.current.click()}
                    >
                      {form.avatar ? (
                        <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">Upload</span>
                      )}
                    </div>
                    {/* Plus badge */}
                    <div className="absolute bottom-0 right-0 bg-[#DC2626] w-5 h-5 rounded-full flex items-center justify-center text-white border-2 border-white pointer-events-none shadow-xs">
                      <HiPlus size={12} />
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Presets Selection */}
                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    <span className="text-[11px] text-slate-600 font-semibold">
                      Select preset avatar or click photo to upload:
                    </span>
                    <div className="flex gap-2 items-center overflow-x-auto pb-1 max-w-full scrollbar-none">
                      {presets.map((p, idx) => {
                        const isSelected = form.avatar === p.value;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setForm({ ...form, avatar: p.value })}
                            className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full border cursor-pointer flex items-center justify-center overflow-hidden p-0 transition-all ${
                              isSelected
                                ? 'border-2 border-[#DC2626] scale-105 ring-2 ring-[#DC2626]/20 shadow-xs'
                                : 'border-slate-200 hover:scale-105 hover:border-slate-300'
                            }`}
                          >
                            <img src={p.value} alt={p.label} className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid 2 Columns for Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all"
                    placeholder="Rajesh Kumar"
                    required
                    value={form.name}
                    onChange={update('name')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Name
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all"
                    placeholder="Kumar General Store"
                    required
                    value={form.storeName}
                    onChange={update('storeName')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={form.email}
                    onChange={update('email')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all"
                    placeholder="+91 9876543210"
                    value={form.phone}
                    onChange={update('phone')}
                  />
                </div>
              </div>

              <div className="text-left space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white outline-none transition-all pr-12 ${
                      form.password.length > 0 && passwordRules.every(r => r.test(form.password))
                        ? 'border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                        : 'border-slate-200 focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters (e.g. Abc@1234)"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={update('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 cursor-pointer p-1 flex items-center justify-center hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                  </button>
                </div>

                {/* Password Requirements Checklist & Ticks */}
                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-600 uppercase tracking-wider">Password Requirements:</span>
                    <span className={
                      form.password.length === 0 ? 'text-slate-400 font-semibold' :
                      passwordRules.filter(r => r.test(form.password)).length <= 2 ? 'text-red-600 font-bold' :
                      passwordRules.filter(r => r.test(form.password)).length <= 4 ? 'text-amber-600 font-bold' :
                      'text-emerald-600 font-extrabold'
                    }>
                      {form.password.length === 0 ? 'Not Started' :
                       passwordRules.filter(r => r.test(form.password)).length <= 2 ? 'Weak' :
                       passwordRules.filter(r => r.test(form.password)).length <= 4 ? 'Medium' :
                       'Strong & Secure ✓'}
                    </span>
                  </div>

                  {/* Visual Strength Progress Line */}
                  <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordRules.filter(r => r.test(form.password)).length <= 2 ? 'bg-red-500' :
                        passwordRules.filter(r => r.test(form.password)).length <= 4 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${(passwordRules.filter(r => r.test(form.password)).length / 5) * 100}%` }}
                    />
                  </div>

                  {/* Checklist Items with Dynamic Live Ticks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60">
                    {passwordRules.map((rule) => {
                      const isPassed = rule.test(form.password);
                      return (
                        <div
                          key={rule.id}
                          className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                            isPassed ? 'text-emerald-700 font-bold' : 'text-slate-400 font-medium'
                          }`}
                        >
                          {isPassed ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-500/40 flex items-center justify-center shrink-0">
                              <HiCheck className="w-3 h-3 text-emerald-600 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0 text-[9px] text-slate-400 font-extrabold">
                              &bull;
                            </div>
                          )}
                          <span className="truncate">{rule.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                className="w-full py-3.5 px-6 font-extrabold text-sm rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3 font-jakarta tracking-wide"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleClick}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer"
            >
              {/* Official Google G Logo */}
              <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="text-center mt-5 text-xs sm:text-sm text-slate-500 font-medium">
            Already have an account? <Link to="/login" className="text-[#DC2626] font-extrabold hover:underline ml-1">Sign in</Link>
          </div>
        </div>
      </div>

      {showMockChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-pure-white rounded-3xl p-6 shadow-2xl border border-soft-gray max-w-sm w-full relative">
            <button
              onClick={() => setShowMockChooser(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition-colors p-1 rounded-full hover:bg-light-cream cursor-pointer"
            >
              <HiOutlineX size={20} />
            </button>

            <div className="text-center mb-6">
              {/* Official Google G Logo */}
              <div className="w-10 h-10 mx-auto mb-3 flex items-center justify-center bg-light-cream border border-soft-gray rounded-xl p-2 shadow-inner">
                <svg width="24" height="24" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-deep-navy font-jakarta">Sign in with Google</h2>
              <p className="text-xs text-slate-gray mt-1">Select an account to login</p>
            </div>

            <div className="space-y-2.5">
              {mockGoogleAccounts.map((account, idx) => (
                <button
                  key={idx}
                  onClick={() => handleMockSelect(account)}
                  className="w-full flex items-center gap-3 p-3 text-left border border-soft-gray rounded-2xl hover:bg-light-cream active:scale-[0.98] transition-all cursor-pointer bg-transparent"
                >
                  <img src={account.avatar} alt={account.name} className="w-10 h-10 rounded-full object-cover border border-soft-gray" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-deep-navy truncate">{account.name}</p>
                    <p className="text-xs text-slate-gray truncate">{account.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
