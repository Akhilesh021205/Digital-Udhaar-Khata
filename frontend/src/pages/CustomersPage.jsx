import { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import API, { getCachedData } from '../api/axios';
import { getDeterministicPrediction, getCustomerBadges } from '../utils/prediction';
import { useSocketSync } from '../hooks/useSocketSync';
import Header from '../components/Layout/Header';
import Modal from '../components/Common/Modal';
import Loader from '../components/Common/Loader';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import { useLanguage } from '../context/LanguageContext';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';
import LocationAddressInput, { navigateToAddress } from '../components/Common/LocationAddressInput';
import { geocodeAddressText, buildAddressQuery } from '../utils/geocoder';
import { HiOutlinePlus, HiOutlineSearch, HiOutlineTrash, HiOutlineMicrophone, HiOutlineX, HiOutlineCheckCircle, HiOutlineExclamation, HiOutlineClock, HiOutlineMail, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineLocationMarker, HiOutlineExternalLink, HiOutlineSparkles, HiOutlinePhone, HiOutlineChevronRight, HiOutlineLightBulb } from 'react-icons/hi';
import { FaWhatsapp, FaSms, FaMobileAlt, FaPhone } from 'react-icons/fa';
import { useSpeechToText } from '../hooks/useSpeechToText';
import AiVoiceCallModal from '../components/AI/AiVoiceCallModal';

const defaultUserSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#E2E8F0"/>
  <path d="M22 82c0-8 8-15 17-17h22c9 0 17 7 17 15v6H22v-6z" fill="#64748B"/>
  <circle cx="50" cy="40" r="16" fill="#94A3B8"/>
</svg>
`;

const maleUserSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#E0F2FE"/>
  <path d="M22 82c0-8 8-15 17-17h22c9 0 17 7 17 15v6H22v-6z" fill="#0284C7"/>
  <rect x="45" y="52" width="10" height="12" fill="#F3B395"/>
  <circle cx="50" cy="42" r="16" fill="#F8C4AD"/>
  <path d="M34 38c2-10 10-14 16-14s14 4 16 14c-1-5-6-8-16-8s-15 3-16 8z" fill="#1E293B"/>
  <circle cx="45" cy="42" r="1.8" fill="#1E293B"/>
  <circle cx="55" cy="42" r="1.8" fill="#1E293B"/>
  <path d="M47 48.5c1.5 1.5 4.5 1.5 6 0" stroke="#1E293B" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`;

const femaleUserSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#FCE7F3"/>
  <path d="M22 82c0-8 8-15 17-17h22c9 0 17 7 17 15v6H22v-6z" fill="#DB2777"/>
  <rect x="45" y="52" width="10" height="12" fill="#F3B395"/>
  <circle cx="50" cy="42" r="16" fill="#F8C4AD"/>
  <path d="M34 44c-1-8 4-16 16-16s17 8 16 16c0 10-2 15-4 17-2-6-5-9-12-9s-10 3-12 9c-2-2-4-7-4-17z" fill="#312E81"/>
  <circle cx="45" cy="42" r="1.8" fill="#2E2219"/>
  <circle cx="55" cy="42" r="1.8" fill="#2E2219"/>
  <path d="M47 48.5c1.5 1.5 4.5 1.5 6 0" stroke="#2E2219" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`;

const shopUserSvg = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="50" fill="#FEF3C7"/>
  <rect x="25" y="55" width="50" height="25" rx="2" fill="#D97706"/>
  <path d="M20 45h60l-5 12H25l-5-12z" fill="#B45309"/>
  <path d="M20 45l5-8h50l5 8H20z" fill="#78350F"/>
  <rect x="42" y="62" width="16" height="18" rx="1" fill="#F8FAFC"/>
  <rect x="29" y="62" width="10" height="10" rx="1" fill="#FBBF24"/>
  <rect x="61" y="62" width="10" height="10" rx="1" fill="#FBBF24"/>
</svg>
`;

const svgToBase64 = (svgMarkup) => {
  return `data:image/svg+xml;base64,${btoa(svgMarkup.trim())}`;
};

const customerPresets = [
  { label: 'Standard', value: svgToBase64(defaultUserSvg) },
  { label: 'Male', value: svgToBase64(maleUserSvg) },
  { label: 'Female', value: svgToBase64(femaleUserSvg) },
  { label: 'Business', value: svgToBase64(shopUserSvg) }
];

const CustomersPage = () => {
  const { t, lang } = useLanguage();
  const { user } = useContext(AuthContext);
  const [customers, setCustomers] = useState(() => {
    const cached = getCachedData('/customers') || getCachedData('/customers?sort=balance-high');
    const raw = cached?.data || [];
    if (raw.length > 0) {
      return raw.map(c => {
        const prediction = getDeterministicPrediction(c);
        const isSettledOrNew = c.balance === 0 || (c.totalTransactions || 0) === 0;
        return {
          ...c,
          duePrediction: isSettledOrNew ? prediction.duePrediction : (c.duePrediction || prediction.duePrediction),
          creditScore: c.creditScore || prediction.creditScore,
          riskLevel: c.riskLevel || prediction.riskLevel
        };
      });
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCachedData('/customers') || getCachedData('/customers?sort=balance-high');
    return !(cached?.data && cached.data.length > 0);
  });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedCallCustomer, setSelectedCallCustomer] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    houseNumber: '',
    street: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null,
    longitude: null,
    avatar: customerPresets[0].value,
    preferredLanguage: 'te-IN',
    phoneType: 'smartphone',
    aiReminderEnabled: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeDetectedAddr, setGeocodeDetectedAddr] = useState('');
  const fileInputRef = useRef(null);

  // Auto-detect location of house number & area when address fields change
  useEffect(() => {
    if (!showForm) return;

    const query = buildAddressQuery({
      houseNumber: form.houseNumber,
      street: form.street,
      area: form.area,
      city: form.city,
      state: form.state,
      pincode: form.pincode
    });

    if (!query || query.trim().length < 3) {
      setGeocodeDetectedAddr('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      const result = await geocodeAddressText(query);
      setIsGeocoding(false);
      if (result) {
        setForm(prev => ({
          ...prev,
          latitude: result.lat,
          longitude: result.lng,
          address: prev.address || result.displayName
        }));
        setGeocodeDetectedAddr(result.displayName);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [form.houseNumber, form.street, form.area, form.city, form.state, form.pincode, showForm]);

  const handleLocationDetailsSelect = (details) => {
    setForm(prev => ({
      ...prev,
      address: details.address || prev.address,
      latitude: details.latitude !== undefined ? details.latitude : prev.latitude,
      longitude: details.longitude !== undefined ? details.longitude : prev.longitude,
      houseNumber: details.houseNumber || prev.houseNumber,
      street: details.street || prev.street,
      area: details.area || prev.area,
      city: details.city || prev.city,
      state: details.state || prev.state,
      pincode: details.pincode || prev.pincode
    }));
    if (details.address) {
      setGeocodeDetectedAddr(details.address);
    }
  };

  // Quick transaction state
  const [quickTxn, setQuickTxn] = useState(null); // { customer, type }
  const [quickForm, setQuickForm] = useState({ amount: '', description: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0] });
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const openQuickTxn = (e, customer, type) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickTxn({ customer, type });
    setQuickForm({ amount: '', description: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0] });
  };

  const handleQuickTxn = async (e) => {
    e.preventDefault();
    if (!quickTxn) return;
    setQuickSubmitting(true);
    try {
      await API.post('/transactions', {
        customer: quickTxn.customer._id,
        type: quickTxn.type,
        amount: quickForm.amount,
        description: quickForm.description,
        date: quickForm.date ? new Date(quickForm.date).toISOString() : new Date().toISOString(),
        paymentMode: quickTxn.type === 'debit' ? quickForm.paymentMode : 'none',
      });
      toast.success(quickTxn.type === 'credit' ? `Udhaar recorded for ${quickTxn.customer.name}!` : `Payment received from ${quickTxn.customer.name}!`);
      setQuickTxn(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add transaction');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const speechLang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';

  const {
    isListening,
    startListening,
    stopListening,
    isSupported: isSpeechSupported
  } = useSpeechToText({
    version: '1.0',
    lang: speechLang,
    onResult: (text) => {
      let cleaned = text.trim();
      cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
      const prefixRegex = /^(search\s+for|find|search|go\s+to|show)\s+/i;
      cleaned = cleaned.replace(prefixRegex, "").trim();

      if (cleaned) {
        setSearchInput(cleaned);
        toast.success(`Searching for "${cleaned}"`);
      }
    }
  });

  const toggleVoiceEntry = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchCustomers = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await API.get('/customers', { params });
      const rawCustomers = data?.data || [];
      const enriched = rawCustomers.map(c => {
        const prediction = getDeterministicPrediction(c);
        const isSettledOrNew = c.balance === 0 || (c.totalTransactions || 0) === 0;
        return {
          ...c,
          duePrediction: isSettledOrNew ? prediction.duePrediction : (c.duePrediction || prediction.duePrediction),
          creditScore: c.creditScore || prediction.creditScore,
          riskLevel: c.riskLevel || prediction.riskLevel
        };
      });
      setCustomers(enriched);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  // Debounce search input changes by 300ms
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => { fetchCustomers(); }, [search]);

  useSocketSync(fetchCustomers, ['customers', 'transactions']);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.post('/customers', form);
      toast.success(t('customerAdded'));
      setShowForm(false);
      setForm({ name: '', phone: '', email: '', address: '', avatar: customerPresets[0].value });
      fetchCustomers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/customers/${deleteId}`);
      toast.success(t('customerDeleted'));
      setDeleteId(null);
      fetchCustomers();
    } catch (err) { toast.error('Delete failed'); }
  };

  const handleEmailRemind = async (e, customer) => {
    e.preventDefault();
    e.stopPropagation();

    if (!customer.email) {
      toast.warning('Please edit this customer and add an email address first.');
      return;
    }

    setSendingEmail(prev => ({ ...prev, [customer._id]: true }));
    try {
      const { data } = await API.post(`/reminders/send/${customer._id}`);
      toast.success(data.message || `Email Reminder sent to ${customer.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send Email reminder');
    } finally {
      setSendingEmail(prev => ({ ...prev, [customer._id]: false }));
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title={t('customers')} subtitle={t('manageCustomers')} />
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
          <div className="h-12 bg-soft-gray/40 dark:bg-slate-800 rounded-xl w-full max-w-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-36 bg-soft-gray/40 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const customerList = Array.isArray(customers) ? customers : [];

  const renderCustomerCard = (c) => {
    const badges = getCustomerBadges(c);
    return (
    <div
      key={c._id}
      className={`bg-pure-white border border-soft-gray ${badges.leftBorder} rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 group`}
    >
      {/* Top Header: Avatar, Name & Phone, and Balance */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full border border-soft-gray overflow-hidden flex items-center justify-center bg-light-cream flex-shrink-0">
            {c.avatar ? (
              <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-extrabold text-orange uppercase">{c.name?.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              to={`/customers/${c._id}`}
              className="text-deep-navy font-bold text-base hover:text-orange transition-colors decoration-none truncate block"
            >
              {c.name}
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-slate-gray mt-0.5">
              <span>{c.phone}</span>
            </div>
          </div>
        </div>

        {/* Balance Display */}
        <div className="text-right flex-shrink-0">
          <div className={`text-base font-extrabold ${c.balance > 0 ? 'text-red-give' : c.balance < 0 ? 'text-purple-600' : 'text-slate-600'}`}>
            ₹{Math.abs(c.balance).toLocaleString('en-IN')}
          </div>
          <div className="mt-0.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badges.balanceTypeClass}`}>
              {badges.balanceTypeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Contact: Email & Address (Uniform height on every card) */}
      <div className="flex flex-col gap-1.5 text-xs text-slate-gray bg-soft-white/70 rounded-xl p-2.5 border border-soft-gray/40 min-h-[58px] justify-center">
        {c.email ? (
          <div className="flex items-center gap-1.5 truncate">
            <HiOutlineMail size={13} className="text-slate-gray shrink-0" />
            <span className="truncate select-all text-[11px] font-medium">{c.email}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-gray/40 italic text-[11px]">
            <HiOutlineMail size={13} className="shrink-0 opacity-40" />
            <span>No email registered</span>
          </div>
        )}

        {c.address ? (
          <div className="flex items-center gap-1.5">
            <HiOutlineLocationMarker size={13} className="text-blue-500 shrink-0" />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToAddress(c.address);
              }}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold truncate max-w-full text-left bg-transparent border-none p-0 cursor-pointer flex items-center gap-1"
              title={`Navigate to ${c.address}`}
            >
              <span className="truncate">{c.address}</span>
              <HiOutlineExternalLink size={10} className="shrink-0" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-gray/40 italic text-[11px]">
            <HiOutlineLocationMarker size={13} className="shrink-0 opacity-40" />
            <span>No address registered</span>
          </div>
        )}
      </div>

      {/* Score & Status Badge */}
      <div className="flex items-center justify-between pt-1 border-t border-soft-gray/40 text-xs">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 font-bold text-[10px] px-2.5 py-0.5 rounded-full border ${badges.statusClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badges.statusDotColor}`} />
            {badges.statusLabel}
          </span>
          {c.totalTransactions > 0 && (
            <span className="text-[10px] text-slate-gray/80 font-medium">
              Score: <strong className={
                c.creditScore >= 700 ? 'text-green-get' :
                c.creditScore >= 550 ? 'text-warning-pending' :
                'text-red-give'
              }>{c.creditScore}</strong>
            </span>
          )}
        </div>

        <Link
          to={`/customers/${c._id}`}
          className="text-[11px] font-bold text-orange hover:text-orange-hover flex items-center gap-0.5 decoration-none"
        >
          View Ledger <HiOutlineChevronRight size={12} />
        </Link>
      </div>

      {/* Action Buttons: Identical options on EVERY customer card */}
      <div className="flex flex-col gap-2 pt-2.5 border-t border-soft-gray/40">
        {/* Row 1: Primary Ledger Transactions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            title="You Gave — Record Udhaar"
            onClick={(e) => openQuickTxn(e, c, 'credit')}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-red-give/10 hover:bg-red-give/20 text-red-give text-xs font-bold rounded-xl border-none cursor-pointer transition-colors shadow-2xs"
          >
            <HiOutlineArrowUp size={13} /> You Gave
          </button>
          <button
            title="You Got — Record Payment"
            onClick={(e) => openQuickTxn(e, c, 'debit')}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-green-get/10 hover:bg-green-get/20 text-green-get text-xs font-bold rounded-xl border-none cursor-pointer transition-colors shadow-2xs"
          >
            <HiOutlineArrowDown size={13} /> You Got
          </button>
        </div>

        {/* Row 2: Communication, Statement & Delete */}
        <div className="flex items-center gap-2">
          <button
            title="Start AI Voice Call Assistant"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedCallCustomer(c);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-orange to-orange-hover hover:from-orange-hover hover:to-orange text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-all shadow-xs hover:shadow"
          >
            <HiOutlinePhone size={13} /> AI Call
          </button>
          <button
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-orange/10 hover:bg-orange/20 text-orange text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
            title="Send Email Statement / Reminder"
            onClick={(e) => handleEmailRemind(e, c)}
            disabled={sendingEmail[c._id]}
          >
            {sendingEmail[c._id] ? (
              <span className="w-3.5 h-3.5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
            ) : (
              <HiOutlineMail size={13} />
            )}
            Email
          </button>
          <button
            className="p-2 text-slate-gray hover:text-red-give hover:bg-red-give/10 rounded-xl cursor-pointer flex items-center justify-center border-none bg-transparent transition-colors shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDeleteId(c._id);
            }}
            title={t('delete')}
          >
            <HiOutlineTrash size={16} />
          </button>
        </div>
      </div>
    </div>
    );
  };

  return (
    <>
      <Header title={t('customers')} subtitle={t('manageCustomers')} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray" size={18} />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all placeholder:text-slate-gray/50"
              placeholder={`${t('search')} ...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {isSpeechSupported && (
            <button
              onClick={toggleVoiceEntry}
              className={`p-2.5 rounded-xl border-none cursor-pointer transition-all flex items-center justify-center shrink-0 shadow-sm ${isListening ? 'bg-red-give text-white animate-pulse' : 'bg-pure-white border border-soft-gray hover:bg-orange/10 text-slate-gray hover:text-orange'
                }`}
              title={isListening ? "Stop Listening" : "Search customer by name using voice"}
            >
              {isListening ? <HiOutlineX size={18} /> : <HiOutlineMicrophone size={18} />}
            </button>
          )}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-all shadow-sm hover:shadow"
          onClick={() => setShowForm(true)}
        >
          <HiOutlinePlus size={16} /> {t('addCustomer')}
        </button>
      </div>

      {customerList.length === 0 ? (
        search ? (
          <div className="bg-pure-white border border-soft-gray rounded-2xl p-12 text-center shadow-sm space-y-4 max-w-xl mx-auto">
            <h3 className="text-lg font-bold text-deep-navy mb-0">No customer found matching "{search}"</h3>
            <p className="text-sm text-slate-gray mt-0">Would you like to add them to your ledger?</p>
            <button
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-all shadow-sm hover:shadow"
              onClick={() => {
                setForm(prev => ({ ...prev, name: search }));
                setShowForm(true);
              }}
            >
              <HiOutlinePlus size={16} /> Add "{search}"
            </button>
          </div>
        ) : (
          <div className="bg-pure-white border border-soft-gray rounded-2xl p-12 text-center shadow-sm space-y-4 max-w-xl mx-auto">
            <h3 className="text-lg font-bold text-deep-navy mb-0">{t('noCustomers')}</h3>
            <p className="text-sm text-slate-gray mt-0">{t('addFirstCustomer')}</p>
            <button
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-all shadow-sm hover:shadow"
              onClick={() => setShowForm(true)}
            >
              <HiOutlinePlus size={16} /> {t('addCustomer')}
            </button>
          </div>
        )
      ) : (
        <div className="w-full min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 w-full">
            {customerList.map(renderCustomerCard)}
          </div>
        </div>
      )}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={t('addCustomer')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Picture Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider mb-2">Profile Photo</label>
            <div className="flex items-center gap-4 p-3 bg-soft-white border border-soft-gray rounded-xl w-full">
              {/* Avatar Preview */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full bg-pure-white border-2 border-orange flex items-center justify-center overflow-hidden cursor-pointer shadow-sm hover:scale-105 transition-transform"
                  onClick={() => fileInputRef.current.click()}
                  type="button"
                >
                  {form.avatar ? (
                    <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-gray font-extrabold uppercase">Upload</span>
                  )}
                </div>
                {/* Plus badge */}
                <div className="absolute bottom-0 right-0 bg-orange w-5 h-5 rounded-full flex items-center justify-center text-white border border-pure-white cursor-pointer shadow pointer-events-none">
                  <span className="text-xs font-bold">+</span>
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
              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-bold text-slate-gray mb-1 block">
                  Select Preset or Upload Custom
                </span>
                <div className="flex gap-2 flex-wrap">
                  {customerPresets.map((p, idx) => {
                    const isSelected = form.avatar === p.value;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all p-0 cursor-pointer ${isSelected ? 'border-orange scale-110 shadow-sm' : 'border-soft-gray opacity-70 hover:opacity-100'
                          }`}
                        onClick={() => setForm(prev => ({ ...prev, avatar: p.value }))}
                      >
                        <img src={p.value} alt={p.label} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('customerName')} *</label>
            <input className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('phone')} *</label>
            <input className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Email Address</label>
            <input type="email" className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('address')} & Map Location</label>
            <LocationAddressInput
              value={form.address}
              onChange={(val) => setForm({ ...form, address: val })}
              onSelectLocationDetails={handleLocationDetailsSelect}
              latitude={form.latitude}
              longitude={form.longitude}
              placeholder="Enter address manually or select on Google Maps"
            />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-soft-gray dark:border-slate-700 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-soft-gray/50 pb-1">
              <span className="text-[11px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider">
                Structured Address Verification Details
              </span>
              {isGeocoding && (
                <span className="text-[10px] font-bold text-orange flex items-center gap-1 animate-pulse">
                  <span className="w-2.5 h-2.5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                  Auto-Detecting Location...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">House / Flat / Door No. *</label>
                <input
                  type="text"
                  value={form.houseNumber}
                  onChange={(e) => setForm({ ...form, houseNumber: e.target.value })}
                  placeholder="e.g. House No. 12"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">Street / Road / Colony</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  placeholder="e.g. MG Road, ABC Colony"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">Area / Landmark</label>
                <input
                  type="text"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  placeholder="e.g. Near Water Tank"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">City / Town</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g. Hyderabad"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="e.g. Telangana"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">PIN Code (6 Digits)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g. 500001"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>
            </div>

            {form.latitude && form.longitude && (
              <div className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 p-2.5 rounded-lg border border-green-200/50 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold">
                    <HiOutlineCheckCircle size={14} className="text-green-600" />
                    <span>Location Auto-Detected & Pinned</span>
                  </span>
                  <span className="font-mono font-bold text-[10px] bg-green-200/60 dark:bg-green-900/60 px-2 py-0.5 rounded">
                    {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                  </span>
                </div>
                {geocodeDetectedAddr && (
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate inline-flex items-center gap-1">
                    <HiOutlineLocationMarker size={12} className="text-orange shrink-0" />
                    <span className="truncate">{geocodeDetectedAddr}</span>
                  </span>
                )}
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 italic inline-flex items-center gap-1">
                  <HiOutlineLightBulb size={12} className="text-amber-500 shrink-0" />
                  <span>location is set. Click "Select Location" on map anytime to drag pin</span>
                </span>
              </div>
            )}
          </div>

          {/* AI Voice Assistant Configuration */}
          <div className="p-3 bg-orange/5 dark:bg-orange-950/20 border border-orange/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-deep-navy dark:text-white flex items-center gap-1.5">
                <HiOutlineSparkles size={16} className="text-orange" /> AI Voice Assistant Settings
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.aiReminderEnabled}
                  onChange={(e) => setForm({ ...form, aiReminderEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange"></div>
                <span className="ml-2 text-xs font-bold text-slate-gray">
                  {form.aiReminderEnabled ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 min-w-0">
                <label className="block text-[11px] font-bold text-slate-gray uppercase tracking-wider">
                  Preferred Language
                </label>
                <select
                  className="w-full min-w-0 px-3 py-2 bg-pure-white border border-soft-gray rounded-lg text-xs font-semibold focus:outline-none focus:border-orange"
                  value={form.preferredLanguage}
                  onChange={(e) =>
                    setForm({ ...form, preferredLanguage: e.target.value })
                  }
                >
                  <option value="te-IN">Telugu (తెలుగు)</option>
                  <option value="hi-IN">Hindi (हिंदी)</option>
                  <option value="en-IN">English</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                  <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>

              <div className="space-y-1 min-w-0">
                <label className="block text-[11px] font-bold text-slate-gray uppercase tracking-wider">Phone Type</label>
                <select
                  className="w-full px-3 py-2 bg-pure-white border border-soft-gray rounded-lg text-xs font-semibold focus:outline-none focus:border-orange"
                  value={form.phoneType}
                  onChange={(e) => setForm({ ...form, phoneType: e.target.value })}
                >
                  <option value="smartphone">Smartphone</option>
                  <option value="basic">Basic Phone (Feature)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-soft-gray">
            <button type="button" className="px-4 py-2.5 bg-transparent border border-soft-gray text-slate-gray hover:bg-slate-gray/5 rounded-xl text-sm font-semibold cursor-pointer transition-colors" onClick={() => setShowForm(false)}>{t('cancel')}</button>
            <button type="submit" className="px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-colors shadow-sm" disabled={submitting}>{submitting ? t('saving') : t('save')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title={t('deleteCustomer')} message={t('deleteCustomerMsg')} />

      {/* Quick Add Transaction Modal */}
      <Modal
        isOpen={!!quickTxn}
        onClose={() => setQuickTxn(null)}
        title={quickTxn?.type === 'credit'
          ? `Udhaar — ${quickTxn?.customer?.name}`
          : `Payment Received — ${quickTxn?.customer?.name}`}
      >
        {quickTxn && (
          <form onSubmit={handleQuickTxn} className="space-y-4">
            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden border border-soft-gray">
              <button
                type="button"
                onClick={() => setQuickTxn(prev => ({ ...prev, type: 'credit' }))}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-none cursor-pointer transition-colors ${quickTxn.type === 'credit'
                  ? 'bg-red-give text-white'
                  : 'bg-transparent text-slate-gray hover:bg-red-give/5'
                  }`}
              >
                <HiOutlineArrowUp size={13} /> You Gave
              </button>
              <button
                type="button"
                onClick={() => setQuickTxn(prev => ({ ...prev, type: 'debit' }))}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-none cursor-pointer transition-colors ${quickTxn.type === 'debit'
                  ? 'bg-green-get text-white'
                  : 'bg-transparent text-slate-gray hover:bg-green-get/5'
                  }`}
              >
                <HiOutlineArrowDown size={13} /> You Got
              </button>
            </div>

            {/* Credit Safety Warning Banner */}
            {quickTxn.type === 'credit' && quickTxn.customer.addressVerificationStatus !== 'verified' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl space-y-1 text-amber-900 dark:text-amber-200 shadow-xs">
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <HiOutlineExclamation size={16} /> Address Not Verified
                  </span>
                  <span className="uppercase text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                    Status: {quickTxn.customer.addressVerificationStatus || 'pending'}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                  Address is not verified. Please verify the customer's address before approving high credit.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Amount *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-gray font-extrabold text-base">₹</span>
                <input
                  className="w-full pl-8 pr-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all font-bold text-deep-navy"
                  type="number" min="0.01" step="0.01" required autoFocus
                  value={quickForm.amount}
                  onChange={(e) => setQuickForm({ ...quickForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Description</label>
              <input
                className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
                value={quickForm.description}
                onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
                placeholder={quickTxn.type === 'credit' ? 'e.g. Rice 5kg, Atta 2kg' : 'e.g. Cash payment'}
              />
            </div>

            {quickTxn.type === 'debit' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Payment Mode</label>
                <select
                  className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
                  value={quickForm.paymentMode}
                  onChange={(e) => setQuickForm({ ...quickForm, paymentMode: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="online">Online Transfer</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('date') || 'Date'}</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setQuickForm({ ...quickForm, date: new Date().toISOString().split('T')[0] })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${quickForm.date === new Date().toISOString().split('T')[0]
                    ? 'bg-orange text-white border-orange shadow-xs'
                    : 'bg-soft-white text-slate-gray border-soft-gray hover:bg-slate-gray/5'
                    }`}
                >
                  Today ({new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setQuickForm({ ...quickForm, date: yesterday.toISOString().split('T')[0] });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${quickForm.date === new Date(Date.now() - 86400000).toISOString().split('T')[0]
                    ? 'bg-orange text-white border-orange shadow-xs'
                    : 'bg-soft-white text-slate-gray border-soft-gray hover:bg-slate-gray/5'
                    }`}
                >
                  Yesterday
                </button>
              </div>
              <input
                className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
                type="date"
                value={quickForm.date || ''}
                onChange={(e) => setQuickForm({ ...quickForm, date: e.target.value })}
              />
            </div>

            {/* Live Preview Card */}
            {quickForm.amount && parseFloat(quickForm.amount) > 0 && (() => {
              const currentBal = quickTxn.customer.balance;
              const txnAmount = parseFloat(quickForm.amount) || 0;
              const isCredit = quickTxn.type === 'credit';
              const newBal = isCredit ? (currentBal + txnAmount) : (currentBal - txnAmount);
              return (
                <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-soft-gray/80 rounded-2xl p-4 space-y-3 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-gray/70 uppercase tracking-widest border-b border-soft-gray/30 pb-2 flex items-center justify-between">
                    <span>Balance Preview</span>
                    <span className="text-[9px] bg-slate-200/60 dark:bg-slate-800 text-slate-gray px-2 py-0.5 rounded-md font-semibold">Live Preview</span>
                  </div>

                  <div className="flex justify-between items-center gap-1.5 text-center relative">
                    {/* Card 1: Current */}
                    <div className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl">
                      <span className="text-[9px] text-slate-gray font-bold uppercase tracking-wider">Current</span>
                      <span className="text-xs font-mono font-bold text-deep-navy mt-1">
                        ₹{Math.abs(currentBal).toLocaleString('en-IN')}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 ${currentBal >= 0 ? 'bg-red-give/10 text-red-give' : 'bg-green-get/10 text-green-get'
                        }`}>
                        {currentBal >= 0 ? 'Due' : 'Advance'}
                      </span>
                    </div>

                    {/* Arrow 1 */}
                    <span className="text-slate-gray/30 text-xs shrink-0 select-none">➜</span>

                    {/* Card 2: Transaction */}
                    <div className="flex-1 flex flex-col items-center justify-center p-2 bg-pure-white border border-soft-gray/50 rounded-xl shadow-xs">
                      <span className="text-[9px] text-slate-gray font-bold uppercase tracking-wider">Transaction</span>
                      <span className={`text-xs font-mono font-black mt-1 ${isCredit ? 'text-red-give' : 'text-green-get'}`}>
                        {isCredit ? '+' : '-'}₹{txnAmount.toLocaleString('en-IN')}
                      </span>
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded-md mt-1 text-white ${isCredit ? 'bg-red-give' : 'bg-green-get'
                        }`}>
                        {isCredit ? 'Gave' : 'Got'}
                      </span>
                    </div>

                    {/* Arrow 2 */}
                    <span className="text-slate-gray/30 text-xs shrink-0 select-none">➜</span>

                    {/* Card 3: New Balance */}
                    <div className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl">
                      <span className="text-[9px] text-slate-gray font-bold uppercase tracking-wider">New Balance</span>
                      <span className={`text-xs font-mono font-extrabold mt-1 ${newBal >= 0 ? 'text-red-give' : 'text-green-get'
                        }`}>
                        ₹{Math.abs(newBal).toLocaleString('en-IN')}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 ${newBal >= 0 ? 'bg-red-give/10 text-red-give' : 'bg-green-get/10 text-green-get'
                        }`}>
                        {newBal >= 0 ? 'Due' : 'Advance'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 pt-3 border-t border-soft-gray">
              <button
                type="button"
                className="px-4 py-2.5 bg-transparent border border-soft-gray text-slate-gray hover:bg-slate-gray/5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                onClick={() => setQuickTxn(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickSubmitting}
                className={`px-5 py-2.5 text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-colors shadow-sm disabled:opacity-50 ${quickTxn.type === 'credit' ? 'bg-red-give hover:bg-red-hover' : 'bg-green-get hover:bg-green-hover'
                  }`}
              >
                {quickSubmitting ? 'Adding...' : 'Add Transaction'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {isListening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/30 p-8 rounded-3xl shadow-[0_20px_50px_rgba(239,68,68,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-6 max-w-sm w-full mx-4 text-center animate-in zoom-in-95 duration-300">
            {/* Pulsing Glowing Circle */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-red-500/10 dark:bg-red-500/5 animate-ping" />
              <span className="absolute -inset-2 rounded-full bg-gradient-to-tr from-red-500/20 to-orange-500/20 blur-md animate-pulse" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 relative z-10">
                <HiOutlineMicrophone size={36} className="animate-pulse" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-extrabold font-outfit text-deep-navy dark:text-white tracking-tight">
                {lang === 'hi' ? 'सुन रहा हूँ...' : lang === 'te' ? 'వింటున్నాను...' : 'Listening...'}
              </h3>
              <p className="text-xs text-slate-gray dark:text-slate-400 mt-1.5 font-medium max-w-[260px] leading-relaxed mx-auto">
                {lang === 'hi' ? 'बोलिए (जैसे: "रवि ने 300 रुपये दिए")' : lang === 'te' ? 'మాట్లాడండి (ఉదాహరణకు: "రవి 300 రూపాయలు తీసుకున్నాడు")' : 'Speak now (e.g., "Ravi took 300 rupees")'}
              </p>
              <span className="inline-block mt-3.5 text-[9px] bg-red-500/5 dark:bg-red-950/20 border border-red-500/10 dark:border-red-900/30 px-3 py-1 rounded-full text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">
                Hindi / Telugu / English
              </span>
            </div>

            {/* Visualizer Waveform */}
            <div className="flex items-center gap-1.5 h-10 my-1 justify-center">
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-4" style={{ animationDelay: '0.1s' }} />
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-8" style={{ animationDelay: '0.3s' }} />
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-5" style={{ animationDelay: '0.5s' }} />
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-10" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-6" style={{ animationDelay: '0.4s' }} />
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-9" style={{ animationDelay: '0.1s' }} />
              <span className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-orange-500 animate-bounce h-4" style={{ animationDelay: '0.3s' }} />
            </div>

            <button
              onClick={stopListening}
              className="mt-1 w-full py-3 px-5 bg-deep-navy dark:bg-white text-white dark:text-deep-navy font-bold text-sm rounded-2xl border-none cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <HiOutlineX size={18} />
              {lang === 'hi' ? 'रोकें (Stop)' : lang === 'te' ? 'ఆపండి (Stop)' : 'Stop Listening'}
            </button>
          </div>
        </div>
      )}
      {/* AI Voice Call Simulator Modal */}
      <AiVoiceCallModal
        isOpen={!!selectedCallCustomer}
        onClose={() => setSelectedCallCustomer(null)}
        customer={selectedCallCustomer}
        onCallCompleted={fetchCustomers}
      />
    </>
  );
};

export default CustomersPage;
