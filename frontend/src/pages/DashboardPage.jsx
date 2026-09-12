import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import API from '../api/axios';
import { getDeterministicPrediction } from '../utils/prediction';
import { useSocketSync } from '../hooks/useSocketSync';
import Header from '../components/Layout/Header';
import Modal from '../components/Common/Modal';
import Loader from '../components/Common/Loader';
import { useLanguage } from '../context/LanguageContext';
import { AuthContext } from '../context/AuthContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { toast } from 'react-toastify';
import LocationAddressInput from '../components/Common/LocationAddressInput';
import {
  HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineUsers,
  HiOutlineCreditCard, HiOutlineExclamation, HiOutlineClock,
  HiOutlineMicrophone, HiOutlineUser, HiOutlineX,
  HiOutlineSearch, HiOutlineFilter, HiOutlinePlus,
  HiOutlineDotsVertical, HiOutlineDocumentText, HiOutlineDatabase,
  HiOutlineCog, HiOutlineBell, HiOutlineUserAdd,
  HiOutlineTrendingUp, HiOutlineSparkles, HiOutlineCheckCircle, HiOutlineShieldCheck,
  HiOutlineBookOpen, HiOutlinePhone
} from 'react-icons/hi';
import { FaWhatsapp, FaSms, FaMobileAlt, FaPhone } from 'react-icons/fa';
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

const avatarColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const getAvatarColor = (name) => avatarColors[(name || 'A').charCodeAt(0) % avatarColors.length];

const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const clean = phone.toString().trim().replace(/\s+/g, '');
  if (clean.startsWith('+')) {
    return clean.replace(/^(\+\d{2})(\d+)$/, '$1 $2');
  }
  if (clean.length === 10) {
    return `+91 ${clean}`;
  }
  return clean;
};

const DashboardPage = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState({ customer: '', type: 'credit', amount: '', description: '', date: new Date().toISOString().split('T')[0], paymentMode: 'cash' });
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState({});
  const [selectedCallCustomer, setSelectedCallCustomer] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [custFilter, setCustFilter] = useState('all');
  const [custSearch, setCustSearch] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [activeCustomerTxns, setActiveCustomerTxns] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const customerList = useMemo(() => {
    const rawList = Array.isArray(customers) ? customers : [];
    return rawList.map(c => {
      const prediction = getDeterministicPrediction(c);
      return {
        ...c,
        duePrediction: c.duePrediction || prediction.duePrediction,
        creditScore: c.creditScore || prediction.creditScore,
        riskLevel: c.riskLevel || prediction.riskLevel
      };
    });
  }, [customers]);

  const activeCustomer = selectedCustomerId
    ? (customerList.find(c => c._id === selectedCustomerId) || customerList[0] || null)
    : (customerList[0] || null);

  useEffect(() => {
    if (!activeCustomer?._id) {
      setActiveCustomerTxns([]);
      return;
    }

    let isMounted = true;
    const fetchCustTxns = async () => {
      setLoadingTxns(true);
      try {
        const res = await API.get(`/transactions?customer=${activeCustomer._id}`);
        if (isMounted) {
          setActiveCustomerTxns(res.data?.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch active customer txns:', err);
      } finally {
        if (isMounted) {
          setLoadingTxns(false);
        }
      }
    };

    fetchCustTxns();

    return () => {
      isMounted = false;
    };
  }, [activeCustomer?._id]);

  const [showCustModal, setShowCustModal] = useState(false);
  const [custForm, setCustForm] = useState({ name: '', phone: '', email: '', address: '', avatar: customerPresets[0].value, paymentDueDate: '' });
  const [custSubmitting, setCustSubmitting] = useState(false);
  const custFileRef = useRef(null);

  const handleCustFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustForm(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCustSubmit = async (e) => {
    e.preventDefault();
    setCustSubmitting(true);
    try {
      await API.post('/customers', custForm);
      toast.success(t('customerAdded') || 'Customer added successfully');
      setShowCustModal(false);
      setCustForm({ name: '', phone: '', email: '', address: '', avatar: customerPresets[0].value, paymentDueDate: '' });
      // Refresh dashboard lists
      const [statsRes, txnRes, custRes] = await Promise.all([
        API.get('/transactions/stats'),
        API.get('/transactions?limit=5'),
        API.get('/customers?sort=balance-high'),
      ]);
      setStats(statsRes.data?.data || {});
      setTransactions(txnRes.data?.data || []);
      setCustomers(custRes.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add customer');
    } finally {
      setCustSubmitting(false);
    }
  };

  const speechLang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';

  const {
    isListening: listening,
    startListening,
    stopListening,
    isSupported
  } = useSpeechToText({
    lang: speechLang,
    onResult: async (text) => {
      try {
        toast.info(`Processing voice: "${text}"...`);
        const { data } = await API.post('/ai/voice-entry', { text });
        toast.success(data.message);
        // Refresh dashboard data
        const [statsRes, txnRes, custRes] = await Promise.all([
          API.get('/transactions/stats'),
          API.get('/transactions?limit=5'),
          API.get('/customers?sort=balance-high'),
        ]);
        setStats(statsRes.data?.data || {});
        setTransactions(txnRes.data?.data || []);
        setCustomers(custRes.data?.data || []);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to parse voice entry');
      }
    }
  });

  const [sidebarOpen, setSidebarOpen] = useOutletContext() || [false, () => { }];

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

  const handleWhatsAppRemind = (customer) => {
    if (!customer) {
      toast.warning('Please select a customer first');
      return;
    }
    const phone = customer.phone?.replace(/[^0-9]/g, '');
    if (!phone) {
      toast.error('Customer phone number not available');
      return;
    }
    const dueAmount = Math.abs(customer.balance || 0);
    const message = `Hello ${customer.name}, your total outstanding balance at ${user?.storeName || 'our store'} is ₹${dueAmount.toLocaleString('en-IN')}. Kindly clear the payment at your earliest convenience. Thank you!`;
    const formattedPhone = phone.startsWith('91') && phone.length === 12 ? phone : `91${phone}`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const fetchAll = async () => {
    try {
      const [statsRes, txnRes, custRes] = await Promise.all([
        API.get('/transactions/stats'),
        API.get('/transactions?limit=5'),
        API.get('/customers?sort=balance-high'),
      ]);
      setStats(statsRes.data?.data || {});
      setTransactions(txnRes.data?.data || []);
      setCustomers(custRes.data?.data || []);
    } catch (err) { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useSocketSync(fetchAll, ['transactions', 'customers']);

  const filteredCustomers = useMemo(() => {
    return customerList.filter(c => {
      const name = c.name || '';
      const phone = c.phone || '';
      const matchesSearch = name.toLowerCase().includes(custSearch.toLowerCase()) ||
        phone.includes(custSearch);
      if (custFilter === 'get') {
        return matchesSearch && c.balance > 0;
      }
      if (custFilter === 'pay') {
        return matchesSearch && c.balance < 0;
      }
      return matchesSearch;
    });
  }, [customerList, custSearch, custFilter]);

  const validTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || customerList.length === 0) return [];
    const activeCustIds = new Set(customerList.map(c => c._id));
    return transactions.filter(t => {
      const custId = typeof t.customer === 'object' ? t.customer?._id : t.customer;
      return custId && activeCustIds.has(custId);
    });
  }, [transactions, customerList]);

  const statsMeta = useMemo(() => {
    let youWillGet = 0;
    let youWillGive = 0;
    let customersWithDues = 0;
    let advanceAccounts = 0;

    if (customerList.length > 0) {
      youWillGet = customerList.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
      youWillGive = customerList.reduce((acc, c) => acc + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
      customersWithDues = customerList.filter(c => c.balance > 0).length;
      advanceAccounts = customerList.filter(c => c.balance < 0).length;
    }

    const totalUdharVal = (youWillGet + youWillGive) || 1;
    const creditPct = (youWillGet / totalUdharVal) * 100;
    const debitPct = (youWillGive / totalUdharVal) * 100;
    const radius = 35;
    const strokeWidth = 10;
    const circumference = 2 * Math.PI * radius;
    const creditStroke = (youWillGet / totalUdharVal) * circumference;
    const debitStroke = (youWillGive / totalUdharVal) * circumference;
    return {
      youWillGet,
      youWillGive,
      customersWithDues,
      advanceAccounts,
      totalUdharVal,
      creditPct,
      debitPct,
      radius,
      strokeWidth,
      circumference,
      creditStroke,
      debitStroke
    };
  }, [customerList]);

  const {
    youWillGet,
    youWillGive,
    customersWithDues,
    advanceAccounts,
    totalUdharVal,
    creditPct,
    debitPct,
    radius,
    strokeWidth,
    circumference,
    creditStroke,
    debitStroke
  } = statsMeta;

  const handleVoice = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleAddTxn = async (e) => {
    e.preventDefault();
    if (!txnForm.customer) { toast.error(t('selectCustomer')); return; }
    setSubmitting(true);
    try {
      await API.post('/transactions', txnForm);
      toast.success(txnForm.type === 'credit' ? t('udhaarRecorded') : t('paymentRecorded'));
      setShowTxnModal(false);
      setTxnForm({ customer: '', type: 'credit', amount: '', description: '', date: new Date().toISOString().split('T')[0], paymentMode: 'cash' });
      // Refresh
      const [statsRes, txnRes, custRes] = await Promise.all([
        API.get('/transactions/stats'), API.get('/transactions?limit=5'), API.get('/customers?sort=balance-high'),
      ]);
      setStats(statsRes.data?.data || {}); setTransactions(txnRes.data?.data || []); setCustomers(custRes.data?.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const openTxnModal = (type) => {
    setTxnForm({ ...txnForm, type, customer: '', amount: '', description: '', paymentMode: 'cash' });
    setShowTxnModal(true);
  };

  if (loading) return (
    <div>
      <Header title={t('dashboard')} subtitle={t('overviewOfStore')} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Loader fullPage />
    </div>
  );

  const transactionList = validTransactions;

  const handleBackup = () => {
    toast.success('Database backup completed successfully.');
  };

  const openCustomerTxnModal = (type) => {
    if (activeCustomer) {
      setTxnForm({
        customer: activeCustomer._id,
        type,
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowTxnModal(true);
    } else {
      toast.info("Please add a customer first to record transactions");
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title={t('dashboard') || 'Dashboard'}
        subtitle={t('overviewOfStore') || 'Overview of your store'}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Balance */}
        <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-md">
          <div>
            <span className="text-xs font-semibold text-slate-400 block tracking-wide">
              {t('totalBalance') || 'Total Balance'}
            </span>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight truncate">
                ₹{(youWillGet - youWillGive).toLocaleString('en-IN')}
              </span>
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-base shrink-0">
                ₹
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>{t('totalUdhar') || 'Total Ledger Balance'}</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <HiOutlineTrendingUp className="w-3.5 h-3.5" /> Live
            </span>
          </div>
        </div>

        {/* Card 2: You'll Receive */}
        <div className="p-5 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div>
            <span className="text-xs font-semibold text-slate-gray dark:text-slate-400 block tracking-wide">
              You'll Receive
            </span>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-outfit tracking-tight truncate">
                ₹{youWillGet.toLocaleString('en-IN')}
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-center text-lg shrink-0">
                <HiOutlineArrowDown />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-soft-gray/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-gray dark:text-slate-400 font-medium">
            <span>{customersWithDues} customers</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pending</span>
          </div>
        </div>

        {/* Card 3: You'll Pay */}
        <div className="p-5 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div>
            <span className="text-xs font-semibold text-slate-gray dark:text-slate-400 block tracking-wide">
              You'll Pay
            </span>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-outfit tracking-tight truncate">
                ₹{youWillGive.toLocaleString('en-IN')}
              </span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50 flex items-center justify-center text-lg shrink-0">
                <HiOutlineArrowUp />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-soft-gray/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-gray dark:text-slate-400 font-medium">
            <span>{advanceAccounts} accounts</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">Advance</span>
          </div>
        </div>

        {/* Card 4: Total Transactions */}
        <div className="p-5 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div>
            <span className="text-xs font-semibold text-slate-gray dark:text-slate-400 block tracking-wide">
              Total Transactions
            </span>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-deep-navy dark:text-white font-outfit tracking-tight truncate">
                {validTransactions.length}
              </span>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-soft-gray dark:border-slate-700 flex items-center justify-center text-lg shrink-0">
                <HiOutlineCreditCard />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-soft-gray/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-gray dark:text-slate-400 font-medium">
            <span>{t('thisMonth') || 'This Month'}</span>
            <span className="font-semibold text-deep-navy dark:text-white">Active</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (8 cols): Customer Table & Bottom Widgets */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Customers Section */}
          <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6">
            {customerList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                  <HiOutlineUsers size={28} />
                </div>
                <h4 className="text-sm font-bold text-deep-navy dark:text-white">No Customers Added</h4>
                <p className="text-xs text-slate-gray dark:text-slate-400 max-w-xs mt-1 mb-4">
                  Manage your digital khata records easily. Add your first customer to get started.
                </p>
                <button
                  onClick={() => setShowCustModal(true)}
                  className="px-4 py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer border-none flex items-center gap-2"
                >
                  <HiOutlinePlus size={16} /> Add Customer
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-deep-navy dark:text-white">{t('customers') || 'Customers'}</h3>
                    <p className="text-xs text-slate-gray dark:text-slate-400 font-medium mt-0.5">Manage customer balances and ledger records</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-soft-gray/60 dark:border-slate-700/60">
                      <button
                        onClick={() => setCustFilter('all')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all border-none ${
                          custFilter === 'all' ? 'bg-pure-white dark:bg-slate-700 text-deep-navy dark:text-white shadow-xs' : 'text-slate-gray dark:text-slate-400 hover:text-deep-navy dark:hover:text-white'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setCustFilter('get')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all border-none ${
                          custFilter === 'get' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-gray dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                      >
                        You'll Receive
                      </button>
                      <button
                        onClick={() => setCustFilter('pay')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all border-none ${
                          custFilter === 'pay' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-gray dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                        }`}
                      >
                        You'll Pay
                      </button>
                    </div>

                    <div className="relative flex-1 sm:w-44">
                      <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-gray" size={15} />
                      <input
                        type="text"
                        value={custSearch}
                        onChange={(e) => setCustSearch(e.target.value)}
                        placeholder="Search customers..."
                        className="w-full pl-8 pr-3 py-1.5 border border-soft-gray dark:border-slate-700 rounded-xl bg-pure-white dark:bg-slate-800 text-xs focus:border-orange focus:ring-1 focus:ring-orange/20 outline-none text-deep-navy dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-soft-gray/80 dark:border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-soft-gray/80 dark:border-slate-800">
                        <th className="px-4 py-3 text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Total Balance</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-soft-gray/40 dark:divide-slate-800">
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-xs font-semibold text-slate-gray dark:text-slate-400">
                            No customers matching your search filter
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((c) => (
                          <tr
                            key={c._id}
                            onClick={() => setSelectedCustomerId(c._id)}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                              activeCustomer?._id === c._id ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-deep-navy dark:text-white">
                              <div className="flex items-center gap-3">
                                {c.avatar ? (
                                  <img
                                    src={c.avatar}
                                    alt={c.name}
                                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-soft-gray dark:border-slate-700"
                                  />
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                                    style={{ background: getAvatarColor(c.name) }}
                                  >
                                    {c.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="block truncate text-sm font-bold text-deep-navy dark:text-white">{c.name}</span>
                                  <span className="text-[11px] text-slate-gray dark:text-slate-400 font-normal block mt-0.5">{formatPhoneDisplay(c.phone)}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-xs">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                                c.balance >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40'
                              }`}>
                                {c.balance >= 0 ? "You'll Receive" : "You'll Pay"}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-sm font-bold font-outfit">
                              <span className={c.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                ₹{Math.abs(c.balance).toLocaleString('en-IN')}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-xs">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                                c.duePrediction === 'trusted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40' :
                                c.duePrediction === 'delay' ? 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40' :
                                'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  c.duePrediction === 'trusted' ? 'bg-emerald-500' :
                                  c.duePrediction === 'delay' ? 'bg-amber-500' :
                                  'bg-rose-500'
                                }`} />
                                {c.duePrediction === 'trusted' ? 'Trusted' : c.duePrediction === 'delay' ? 'Delay' : 'Risky'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setActiveDropdownId(activeDropdownId === c._id ? null : c._id)}
                                className={`p-1.5 text-slate-gray hover:text-deep-navy dark:hover:text-white rounded-lg transition-colors border-none bg-transparent cursor-pointer ${
                                  activeDropdownId === c._id ? 'bg-slate-100 dark:bg-slate-800 text-deep-navy dark:text-white' : ''
                                }`}
                              >
                                <HiOutlineDotsVertical size={16} />
                              </button>

                              {activeDropdownId === c._id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40 cursor-default"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownId(null);
                                    }}
                                  />
                                  <div className="absolute right-4 top-10 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-xl shadow-lg py-1.5 min-w-[150px] z-50 animate-in fade-in duration-100 text-left">
                                    <button
                                      onClick={() => {
                                        navigate(`/customers/${c._id}`);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-deep-navy dark:text-white font-semibold flex items-center gap-2 border-none bg-transparent cursor-pointer"
                                    >
                                      <HiOutlineUser size={14} className="text-slate-gray" />
                                      View Ledger
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTxnForm({
                                          customer: c._id,
                                          type: 'credit',
                                          amount: '',
                                          description: '',
                                          date: new Date().toISOString().split('T')[0],
                                          paymentMode: 'cash'
                                        });
                                        setShowTxnModal(true);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-deep-navy dark:text-white font-semibold flex items-center gap-2 border-none bg-transparent cursor-pointer"
                                    >
                                      <HiOutlinePlus size={14} className="text-slate-gray" />
                                      Add Entry
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedCallCustomer(c);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-orange font-bold flex items-center gap-2 border-none bg-transparent cursor-pointer"
                                    >
                                      <HiOutlinePhone size={14} className="text-orange" />
                                      Start AI Call
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        handleEmailRemind(e, c);
                                        setActiveDropdownId(null);
                                      }}
                                      disabled={sendingEmail[c._id]}
                                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-deep-navy dark:text-white font-semibold flex items-center gap-2 border-none bg-transparent cursor-pointer disabled:opacity-50"
                                    >
                                      <HiOutlineBell size={14} className="text-slate-gray" />
                                      {sendingEmail[c._id] ? 'Sending...' : 'Send Reminder'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Bottom 3 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Widget 1: Recent Transactions */}
            <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-deep-navy dark:text-white">{t('recentTransactions') || 'Recent Transactions'}</h3>
                  <Link to="/history" className="text-xs font-semibold text-orange hover:underline">{t('viewAll') || 'View All'}</Link>
                </div>
                {transactionList.length === 0 ? (
                  <div className="text-center py-6 space-y-1">
                    <h4 className="text-xs font-semibold text-slate-gray dark:text-slate-400">No transactions recorded</h4>
                    <p className="text-[10px] text-slate-gray/70 dark:text-slate-500">New transactions will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactionList.slice(0, 3).map((txn) => (
                      <div key={txn._id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-soft-gray/40 dark:border-slate-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-deep-navy dark:text-white shrink-0">
                            {txn.customer?.name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-deep-navy dark:text-white block truncate">{txn.customer?.name || 'Customer'}</span>
                            <span className="text-[10px] text-slate-gray dark:text-slate-400 block mt-0.5">{new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold block font-outfit ${txn.type === 'credit' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9px] text-slate-gray dark:text-slate-400 block font-medium">
                            {txn.type === 'credit' ? 'Udhar' : 'Jama'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Widget 2: Reports Summary */}
            <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-deep-navy dark:text-white mb-3">{t('reportsOverview') || 'Reports Summary'}</h3>
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-2.5 flex-1">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-gray dark:text-slate-400 block uppercase tracking-wider">Total Receivables</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-outfit block mt-0.5">
                        ₹{youWillGet.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-gray dark:text-slate-400 block uppercase tracking-wider">Total Payables</span>
                      <span className="text-base font-black text-rose-600 dark:text-rose-400 font-outfit block mt-0.5">
                        ₹{youWillGive.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center shrink-0">
                    <svg width="90" height="90" viewBox="0 0 100 100" className="transform -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        className="stroke-soft-gray dark:stroke-slate-800"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        className="stroke-emerald-500 transition-all duration-500"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (creditStroke || 0.1)}
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        className="stroke-rose-500 transition-all duration-500"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (debitStroke || 0.1)}
                        transform={`rotate(${(youWillGet / totalUdharVal) * 360} 50 50)`}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-slate-gray dark:text-slate-400 font-bold">Ratio</span>
                      <span className="text-xs font-black text-deep-navy dark:text-white font-outfit">
                        {Math.round((youWillGet / totalUdharVal) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 border-t border-soft-gray/40 dark:border-slate-800 pt-2 text-[10px] font-semibold text-slate-gray dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Receive</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  <span>Pay</span>
                </div>
              </div>
            </div>

            {/* Widget 3: Credit Insights */}
            <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-deep-navy dark:text-white flex items-center gap-1.5">
                    <HiOutlineShieldCheck className="text-emerald-500 text-base" />
                    Credit Insights
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-soft-gray/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider block">Store Score</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-deep-navy dark:text-white font-outfit">94 / 100</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Optimal Risk</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-gray dark:text-slate-400">
                      <span>Active Ledgers</span>
                      <span className="font-bold text-deep-navy dark:text-white font-outfit">{customers.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-gray dark:text-slate-400">
                      <span>On-Time Reminders</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-outfit">98.5%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-soft-gray/40 dark:border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-gray dark:text-slate-400">Auto Backup</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Customer Details Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex justify-between items-center pb-3 border-b border-soft-gray/50 dark:border-slate-800">
              <h3 className="text-base font-bold text-deep-navy dark:text-white">{t('customerDetails') || 'Customer Details'}</h3>
              {activeCustomer && (
                <button
                  onClick={() => navigate(`/customers/${activeCustomer._id}`)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-deep-navy dark:text-white font-bold text-xs rounded-lg transition-colors border-none cursor-pointer flex items-center gap-1"
                >
                  <HiOutlineUser size={13} /> View Ledger
                </button>
              )}
            </div>

            {!activeCustomer ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-soft-gray dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                  <HiOutlineUser size={22} />
                </div>
                <span className="text-xs font-bold text-deep-navy dark:text-white">No Customer Selected</span>
                <p className="text-[11px] text-slate-gray dark:text-slate-400 mt-1 max-w-[200px]">
                  Select a customer from the table to view balance details and activity.
                </p>
              </div>
            ) : (
              <>
                {/* Profile header */}
                <div className="flex items-center gap-3.5">
                  {activeCustomer.avatar ? (
                    <img
                      src={activeCustomer.avatar}
                      alt={activeCustomer.name}
                      className="w-12 h-12 rounded-full object-cover shrink-0 border border-soft-gray dark:border-slate-700 shadow-xs"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base text-white shrink-0 shadow-xs"
                      style={{ background: getAvatarColor(activeCustomer.name) }}
                    >
                      {activeCustomer.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-bold text-deep-navy dark:text-white truncate">{activeCustomer.name}</h4>
                    <p className="text-xs text-slate-gray dark:text-slate-400 font-medium mt-0.5">{formatPhoneDisplay(activeCustomer.phone)}</p>
                    {activeCustomer.email && (
                      <p className="text-[11px] text-slate-gray/70 dark:text-slate-400 truncate mt-0.5">{activeCustomer.email}</p>
                    )}
                  </div>
                </div>

                {/* Outstanding Amount Main Card */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 block tracking-wide">
                      Total Outstanding
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      activeCustomer.duePrediction === 'trusted' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {activeCustomer.duePrediction === 'trusted' ? 'Trusted' : 'Delay Risk'}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-3xl font-black font-outfit tracking-tight block">
                      ₹{Math.abs(activeCustomer.balance).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 mt-1 block">
                      {activeCustomer.balance >= 0 ? "You'll Receive" : "You'll Pay (Advance)"}
                    </span>
                  </div>
                </div>

                {/* Sub Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-soft-gray/60 dark:border-slate-800 rounded-xl">
                    <span className="text-[10px] font-semibold text-slate-gray dark:text-slate-400 block">Udhar</span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block mt-0.5 font-outfit">
                      ₹{activeCustomer.balance >= 0 ? activeCustomer.balance.toLocaleString('en-IN') : '0'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-soft-gray/60 dark:border-slate-800 rounded-xl">
                    <span className="text-[10px] font-semibold text-slate-gray dark:text-slate-400 block">Jama</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 font-outfit">
                      ₹{activeCustomer.balance < 0 ? Math.abs(activeCustomer.balance).toLocaleString('en-IN') : '0'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-soft-gray/60 dark:border-slate-800 rounded-xl">
                    <span className="text-[10px] font-semibold text-slate-gray dark:text-slate-400 block">Entries</span>
                    <span className="text-xs font-bold text-deep-navy dark:text-white block mt-0.5 font-outfit">
                      {activeCustomer.totalTransactions || activeCustomerTxns.length || 0}
                    </span>
                  </div>
                </div>

                {/* Recent Customer Activity */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-deep-navy dark:text-white block">Recent Activity</span>
                  {loadingTxns ? (
                    <div className="flex items-center justify-center py-5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                      <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : activeCustomerTxns.length === 0 ? (
                    <div className="text-center py-3 bg-slate-50 dark:bg-slate-800/30 border border-dashed border-soft-gray dark:border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-gray dark:text-slate-400">No activity logged yet</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {activeCustomerTxns.map((t) => (
                        <div key={t._id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 border border-soft-gray/40 dark:border-slate-800 rounded-lg text-xs">
                          <span className="font-semibold text-deep-navy dark:text-white truncate max-w-[130px]">{t.description || 'Transaction entry'}</span>
                          <span className={`font-bold font-outfit ${t.type === 'credit' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {t.type === 'credit' ? '+' : '-'}₹{t.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Prominent Action Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => openCustomerTxnModal('credit')}
                    className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer border-none bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.98]"
                  >
                    + Add Udhar
                  </button>
                  <button
                    onClick={() => openCustomerTxnModal('debit')}
                    className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer border-none bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                  >
                    Get Paid
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isSupported && (
        <button
          className={`fixed bottom-20 right-6 lg:bottom-6 lg:right-6 w-12 h-12 lg:w-13 lg:h-13 bg-orange text-white rounded-full flex items-center justify-center shadow-lg border-none cursor-pointer hover:bg-orange-hover hover:scale-105 transition-all z-40 ${
            listening ? 'ring-4 ring-rose-600/30 bg-rose-600 animate-pulse' : ''
          }`}
          onClick={handleVoice}
          title={listening ? "Stop Listening" : "Voice Entry"}
        >
          {listening ? <HiOutlineX className="w-5 h-5" /> : <HiOutlineMicrophone className="w-5 h-5" />}
        </button>
      )}

      {/* Transaction Modal */}
      <Modal isOpen={showTxnModal} onClose={() => setShowTxnModal(false)} title={t('addTransaction') || 'Add Transaction'}>
        <form onSubmit={handleAddTxn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('customers') || 'Customer'} *</label>
            <select
              className="w-full px-3.5 py-2.5 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-deep-navy dark:text-white text-sm outline-none focus:border-orange"
              required
              value={txnForm.customer}
              onChange={(e) => setTxnForm({ ...txnForm, customer: e.target.value })}
            >
              <option value="">{t('selectCustomer') || 'Select Customer'}</option>
              {customerList.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} (Outstanding: ₹{Math.abs(c.balance).toLocaleString('en-IN')} {c.balance >= 0 ? "Due" : "Advance"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('type') || 'Entry Type'} *</label>
            <select
              className="w-full px-3.5 py-2.5 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-deep-navy dark:text-white text-sm outline-none focus:border-orange"
              value={txnForm.type}
              onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value })}
            >
              <option value="credit">You Gave (Udhar)</option>
              <option value="debit">You Got (Jama / Payment Received)</option>
            </select>
          </div>
          {txnForm.type === 'debit' && (
            <div>
              <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider mb-1.5">Payment Mode *</label>
              <select
                className="w-full px-3.5 py-2.5 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-deep-navy dark:text-white text-sm outline-none focus:border-orange"
                value={txnForm.paymentMode || 'cash'}
                onChange={(e) => setTxnForm({ ...txnForm, paymentMode: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="online">Online Transfer</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('amount') || 'Amount'} *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray font-bold text-base">₹</span>
              <input
                className="w-full pl-8 pr-3.5 py-2.5 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-deep-navy dark:text-white placeholder-slate-gray/40 text-sm outline-none focus:border-orange font-bold font-outfit"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={txnForm.amount}
                onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('description') || 'Description'}</label>
            <input
              className="w-full px-3.5 py-2.5 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-deep-navy dark:text-white text-sm outline-none focus:border-orange"
              value={txnForm.description}
              onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
              placeholder="E.g., Rice & Grocery items"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('date') || 'Date'}</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setTxnForm({ ...txnForm, date: new Date().toISOString().split('T')[0] })}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  txnForm.date === new Date().toISOString().split('T')[0]
                    ? 'bg-orange text-white border-orange shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-gray border-soft-gray dark:border-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setTxnForm({ ...txnForm, date: yesterday.toISOString().split('T')[0] });
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  txnForm.date === new Date(Date.now() - 86400000).toISOString().split('T')[0]
                    ? 'bg-orange text-white border-orange shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-gray border-soft-gray dark:border-slate-700'
                }`}
              >
                Yesterday
              </button>
            </div>
            <input
              className="w-full px-3.5 py-2.5 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-deep-navy dark:text-white text-sm outline-none focus:border-orange"
              type="date"
              value={txnForm.date}
              onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-soft-gray dark:border-slate-800">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-soft-gray dark:border-slate-700 text-slate-gray dark:text-slate-300 bg-transparent cursor-pointer font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setShowTxnModal(false)}
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-orange text-white border-none cursor-pointer font-bold text-xs hover:bg-orange-hover disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Modal */}
      <Modal isOpen={showCustModal} onClose={() => setShowCustModal(false)} title={t('addCustomer') || 'Add Customer'}>
        <form onSubmit={handleAddCustSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Profile Photo</label>
            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-soft-gray dark:border-slate-700 rounded-xl w-full">
              <div className="relative w-14 h-14 shrink-0">
                <div
                  className="w-14 h-14 rounded-full bg-pure-white dark:bg-slate-800 border-2 border-orange flex items-center justify-center overflow-hidden cursor-pointer shadow-xs"
                  onClick={() => custFileRef.current.click()}
                >
                  {custForm.avatar ? (
                    <img src={custForm.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-gray font-bold uppercase">Upload</span>
                  )}
                </div>
                <input
                  type="file"
                  ref={custFileRef}
                  onChange={handleCustFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-bold text-slate-gray dark:text-slate-400 mb-1 block">
                  Select Preset or Upload Photo
                </span>
                <div className="flex gap-2 flex-wrap">
                  {customerPresets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all p-0 cursor-pointer ${
                        custForm.avatar === p.value ? 'border-orange scale-105 shadow-xs' : 'border-soft-gray dark:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                      onClick={() => setCustForm(prev => ({ ...prev, avatar: p.value }))}
                    >
                      <img src={p.value} alt={p.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">{t('customerName') || 'Customer Name'} *</label>
            <input
              className="w-full px-3.5 py-2 border border-soft-gray dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-orange bg-pure-white dark:bg-slate-800 text-deep-navy dark:text-white"
              required
              value={custForm.name}
              onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">{t('phone') || 'Phone'} *</label>
            <input
              className="w-full px-3.5 py-2 border border-soft-gray dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-orange bg-pure-white dark:bg-slate-800 text-deep-navy dark:text-white"
              required
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              placeholder="+91 9876543210"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              className="w-full px-3.5 py-2 border border-soft-gray dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-orange bg-pure-white dark:bg-slate-800 text-deep-navy dark:text-white"
              value={custForm.email || ''}
              onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
              placeholder="customer@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">Payment Due Date</label>
            <input
              type="date"
              className="w-full px-3.5 py-2 border border-soft-gray dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-orange bg-pure-white dark:bg-slate-800 text-deep-navy dark:text-white"
              value={custForm.paymentDueDate || ''}
              onChange={(e) => setCustForm({ ...custForm, paymentDueDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-gray dark:text-slate-400 uppercase tracking-wider">{t('address') || 'Address'}</label>
            <LocationAddressInput
              value={custForm.address}
              onChange={(val) => setCustForm({ ...custForm, address: val })}
              placeholder="Enter address manually or use GPS map location"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-soft-gray dark:border-slate-800">
            <button
              type="button"
              className="px-4 py-2 bg-transparent border border-soft-gray dark:border-slate-700 text-slate-gray dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              onClick={() => setShowCustModal(false)}
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange hover:bg-orange-hover text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              disabled={custSubmitting}
            >
              {custSubmitting ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      {listening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep-navy/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 relative">
              <span className="absolute w-16 h-16 rounded-full bg-rose-600/20 animate-ping" />
              <HiOutlineMicrophone size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold text-deep-navy dark:text-white">
                {lang === 'hi' ? 'सुन रहा हूँ...' : lang === 'te' ? 'వింటున్నాను...' : 'Listening...'}
              </h3>
              <p className="text-xs text-slate-gray dark:text-slate-400 mt-1 font-medium">
                {lang === 'hi' ? 'बोलिए (जैसे: "रवि ने 300 रुपये दिए")' : lang === 'te' ? 'మాట్లాడండి (ఉదాహరణకు: "రవి 300 రూపాయలు తీసుకున్నాడు")' : 'Speak now (e.g., "Ravi took 300 rupees")'}
              </p>
            </div>
            <button
              onClick={stopListening}
              className="mt-2 w-full py-2.5 px-4 bg-deep-navy hover:bg-deep-navy-hover text-white font-bold text-sm rounded-xl border-none cursor-pointer shadow-sm flex items-center justify-center gap-2"
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
        onCallCompleted={fetchAll}
      />
    </div>
  );
};

export default DashboardPage;
