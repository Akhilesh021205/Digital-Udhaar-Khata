import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import API, { getCachedCustomer, getCachedData } from '../api/axios';
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
import MapPickerModal from '../components/Common/MapPickerModal';
import { geocodeAddressText, buildAddressQuery } from '../utils/geocoder';
import {
  HiOutlineArrowLeft, HiOutlineArrowUp, HiOutlineArrowDown,
  HiOutlineDocumentDownload, HiOutlineTrash,
  HiOutlinePhone, HiOutlineLocationMarker, HiOutlineCalendar,
  HiOutlineExclamation, HiOutlineCheckCircle, HiOutlinePencil,
  HiOutlineMicrophone, HiOutlineSparkles, HiOutlineLightBulb,
  HiOutlineX, HiOutlineClock, HiOutlineMail, HiOutlineCamera, HiOutlineXCircle,
  HiOutlineMap, HiOutlineExternalLink, HiOutlineSearch,
  HiOutlineSwitchVertical, HiOutlinePhotograph, HiOutlineDocumentText,
  HiOutlineQrcode, HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineDownload
} from 'react-icons/hi';
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

const CustomerDetailPage = () => {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const chatEndRef = useRef(null);
  const { user } = useContext(AuthContext);
  const [customer, setCustomer] = useState(() => {
    const cached = getCachedCustomer(id);
    if (cached) {
      const prediction = getDeterministicPrediction(cached);
      const isSettledOrNew = cached.balance === 0 || (cached.totalTransactions || 0) === 0;
      return {
        ...cached,
        duePrediction: isSettledOrNew ? prediction.duePrediction : (cached.duePrediction || prediction.duePrediction),
        creditScore: cached.creditScore || prediction.creditScore,
        riskLevel: cached.riskLevel || prediction.riskLevel
      };
    }
    return null;
  });
  const [transactions, setTransactions] = useState(() => {
    const cached = getCachedData(`/transactions?customer=${id}&limit=200`) || getCachedData(`/transactions?customer=${id}`);
    return cached?.data || [];
  });
  const [loading, setLoading] = useState(() => !getCachedCustomer(id));

  // Voice Entry configuration
  const speechLang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';

  const {
    isListening,
    startListening,
    stopListening,
    isSupported: isSpeechSupported
  } = useSpeechToText({
    lang: speechLang,
    onResult: async (text) => {
      try {
        toast.info(`Processing voice: "${text}"...`);
        const { data } = await API.post('/ai/voice-entry', { text, customerId: id });
        toast.success(data.message);
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to parse voice entry');
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
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnType, setTxnType] = useState('credit');
  const [txnForm, setTxnForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0], paymentMode: 'cash' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '', date: '', paymentStatus: 'PENDING', paymentMode: '' });
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [showAiCallModal, setShowAiCallModal] = useState(false);
  const [showAddressDetails, setShowAddressDetails] = useState(true);
  const [txnFilter, setTxnFilter] = useState('all');
  const [txnSortOrder, setTxnSortOrder] = useState('desc');
  const [txnSearch, setTxnSearch] = useState('');

  // Address Verification state & handlers
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsResult, setGpsResult] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDirectMapModal, setShowDirectMapModal] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState('verified');
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyEvidence, setVerifyEvidence] = useState('');
  const [verifyingSubmitting, setVerifyingSubmitting] = useState(false);
  const evidenceFileInputRef = useRef(null);
  const [isEditGeocoding, setIsEditGeocoding] = useState(false);
  const [editGeocodeDetectedAddr, setEditGeocodeDetectedAddr] = useState('');

  const handleCheckGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    if (!customer?.latitude || !customer?.longitude) {
      toast.info('Customer map location coordinates are not set yet. Opening Google Maps picker...');
      setShowDirectMapModal(true);
      return;
    }
    setGpsLoading(true);
    setGpsResult(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await API.post(`/customers/${id}/check-gps`, {
            gpsLatitude: pos.coords.latitude,
            gpsLongitude: pos.coords.longitude,
            thresholdMeters: 200,
          });
          setGpsResult(data.data);
          if (data.data.isMatch) {
            toast.success(`GPS Location Matched! Customer is ~${data.data.distanceMeters}m away.`);
          } else {
            toast.warning(`GPS Location Mismatch! Customer is ~${(data.data.distanceMeters / 1000).toFixed(2)}km away.`);
          }
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to compare GPS location.');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        toast.error('GPS Permission denied or location unavailable.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleDirectMapLocationSelect = async (details) => {
    try {
      toast.info('Saving customer location coordinates...');
      const updatePayload = {
        address: details.address || customer.address,
        latitude: details.latitude,
        longitude: details.longitude,
        houseNumber: details.houseNumber || customer.houseNumber,
        street: details.street || customer.street,
        area: details.area || customer.area,
        city: details.city || customer.city,
        state: details.state || customer.state,
        pincode: details.pincode || customer.pincode,
      };
      const { data } = await API.put(`/customers/${id}`, updatePayload);
      setCustomer(data.data);
      toast.success('Google Maps location saved for customer! You can now run live GPS proximity checks.');
      setShowDirectMapModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save location');
    }
  };

  const handleOpenVerifyModal = () => {
    setVerifyStatus(customer?.addressVerificationStatus || 'verified');
    setVerifyNote(customer?.verificationNote || '');
    setVerifyEvidence(customer?.verificationEvidence || '');
    setShowVerifyModal(true);
  };

  const handleVerifyAddressSubmit = async (e) => {
    e.preventDefault();
    setVerifyingSubmitting(true);
    try {
      await API.put(`/customers/${id}/verify-address`, {
        status: verifyStatus,
        note: verifyNote,
        evidence: verifyEvidence,
      });
      toast.success(`Address verification status updated to ${verifyStatus.toUpperCase()}!`);
      setShowVerifyModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update verification status');
    } finally {
      setVerifyingSubmitting(false);
    }
  };

  const handleEvidenceFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVerifyEvidence(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [customerForm, setCustomerForm] = useState({
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
    riskLevel: 'low',
    avatar: '',
    paymentDueDate: '',
    preferredLanguage: 'te-IN',
    phoneType: 'smartphone',
    aiReminderEnabled: true
  });
  const customerFileInputRef = useRef(null);

  // Auto-detect location of house number & area when customer edit address fields change
  useEffect(() => {
    if (!showEditCustomer) return;

    const query = buildAddressQuery({
      houseNumber: customerForm.houseNumber,
      street: customerForm.street,
      area: customerForm.area,
      city: customerForm.city,
      state: customerForm.state,
      pincode: customerForm.pincode
    });

    if (!query || query.trim().length < 3) {
      setEditGeocodeDetectedAddr('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsEditGeocoding(true);
      const result = await geocodeAddressText(query);
      setIsEditGeocoding(false);
      if (result) {
        setCustomerForm(prev => ({
          ...prev,
          latitude: result.lat,
          longitude: result.lng,
          address: prev.address || result.displayName
        }));
        setEditGeocodeDetectedAddr(result.displayName);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [customerForm.houseNumber, customerForm.street, customerForm.area, customerForm.city, customerForm.state, customerForm.pincode, showEditCustomer]);

  const handleEditLocationDetailsSelect = (details) => {
    setCustomerForm(prev => ({
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
      setEditGeocodeDetectedAddr(details.address);
    }
  };

  const handleCustomerFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomerForm(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const [billImageBase64, setBillImageBase64] = useState('');
  const [editBillImageBase64, setEditBillImageBase64] = useState('');

  const compressAndSetImage = (file, isEdit = false) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max_width = 800;
        const max_height = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > max_width) {
            height *= max_width / width;
            width = max_width;
          }
        } else {
          if (height > max_height) {
            width *= max_height / height;
            height = max_height;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (isEdit) {
          setEditBillImageBase64(compressedDataUrl);
        } else {
          setBillImageBase64(compressedDataUrl);
        }
      };
    };
  };

  const handleTxnPhotoChange = (e) => {
    const file = e.target.files[0];
    compressAndSetImage(file, false);
  };

  const handleEditTxnPhotoChange = (e) => {
    const file = e.target.files[0];
    compressAndSetImage(file, true);
  };

  const openEditCustomerModal = () => {
    if (!customer) return;
    setCustomerForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      houseNumber: customer.houseNumber || '',
      street: customer.street || '',
      area: customer.area || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      latitude: customer.latitude !== undefined ? customer.latitude : null,
      longitude: customer.longitude !== undefined ? customer.longitude : null,
      riskLevel: customer.riskLevel || 'low',
      avatar: customer.avatar || '',
      paymentDueDate: customer.paymentDueDate ? new Date(customer.paymentDueDate).toISOString().split('T')[0] : '',
      preferredLanguage: customer.preferredLanguage || 'te-IN',
      phoneType: customer.phoneType || 'smartphone',
      aiReminderEnabled: customer.aiReminderEnabled !== undefined ? customer.aiReminderEnabled : true,
    });
    setShowEditCustomer(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await API.put(`/customers/${id}`, customerForm);
      setCustomer(data.data);
      toast.success('Customer profile updated successfully');
      setShowEditCustomer(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update customer');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      const [custRes, txnRes] = await Promise.all([
        API.get(`/customers/${id}`),
        API.get(`/transactions?customer=${id}&limit=200`),
      ]);
      const custData = custRes.data.data.customer;
      const prediction = getDeterministicPrediction(custData);
      const isSettledOrNew = custData.balance === 0 || (custData.totalTransactions || 0) === 0;
      const enrichedCust = {
        ...custData,
        duePrediction: isSettledOrNew ? prediction.duePrediction : (custData.duePrediction || prediction.duePrediction),
        creditScore: custData.creditScore || prediction.creditScore,
        riskLevel: custData.riskLevel || prediction.riskLevel
      };
      setCustomer(enrichedCust);
      setTransactions(txnRes.data?.data || []);
    } catch (err) { toast.error('Failed to load customer'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  useSocketSync(fetchData, ['customers', 'transactions']);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transactions]);

  const handleAddTxn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Send the full ISO datetime so the server stores the exact time of the transaction
      const now = new Date();
      const dateValue = txnForm.date && txnForm.date !== now.toISOString().split('T')[0]
        ? new Date(txnForm.date).toISOString()   // user picked a past date → midnight of that day
        : now.toISOString();                       // default → exact current time
      await API.post('/transactions', {
        customer: id, type: txnType,
        amount: txnForm.amount, description: txnForm.description, date: dateValue,
        paymentMode: txnForm.paymentMode,
        billImageUrl: billImageBase64,
      });
      toast.success(txnType === 'credit' ? t('udhaarRecorded') : t('paymentRecorded'));
      setShowTxnModal(false);
      setTxnForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0], paymentMode: 'cash' });
      setBillImageBase64('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/transactions/${deleteId}`);
      toast.success(t('transactionDeleted'));
      setDeleteId(null);
      fetchData();
    } catch (err) { toast.error('Delete failed'); }
  };

  const openEditModal = (txn) => {
    setEditingTxn(txn);
    setEditForm({
      amount: txn.amount,
      description: txn.description || '',
      date: txn.date ? new Date(txn.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      paymentStatus: txn.paymentStatus || 'PENDING',
      paymentMode: txn.paymentMode || 'none',
    });
    setEditBillImageBase64(txn.billImageUrl || '');
    setShowEditModal(true);
  };

  const handleEditTxn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.put(`/transactions/${editingTxn._id}`, {
        amount: editForm.amount,
        description: editForm.description,
        date: editForm.date,
        paymentStatus: editForm.paymentStatus,
        paymentMode: editForm.paymentMode,
        billImageUrl: editBillImageBase64,
      });
      if (editForm.paymentStatus === 'SETTLED') {
        toast.success(t('transactionMarkedAsPaid'));
      } else {
        toast.success('Transaction updated successfully');
      }
      setShowEditModal(false);
      setEditingTxn(null);
      setEditBillImageBase64('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (txnId) => {
    try {
      await API.put(`/transactions/${txnId}/settle`);
      toast.success(t('transactionMarkedAsPaid'));
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  const handleApprovePayment = async (txnId) => {
    try {
      await API.put(`/transactions/${txnId}/approve`);
      toast.success('UPI Payment Approved & Ledger Settled!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve payment'); }
  };

  const handleDeclinePayment = async (txnId) => {
    try {
      await API.put(`/transactions/${txnId}/decline`);
      toast.success('UPI Payment Declined / Verification Failed!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to decline payment'); }
  };

  const handleEmailReminder = async () => {
    if (!customer) return;
    if (!customer.email) {
      toast.warning('Please add an email address to this customer first.');
      return;
    }

    setSendingEmail(true);
    try {
      const { data } = await API.post(`/reminders/send/${customer._id}`);
      toast.success(data.message || `Email Reminder sent to ${customer.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send Email reminder');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await API.get(`/reminder/statement/${id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${customer.name}-statement.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('downloadStatement'));
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const handleDownloadExcel = () => {
    try {
      const csvHeader = ['Date', 'Customer', 'Phone', 'Type', 'Amount (INR)', 'Payment Mode', 'Remarks'].join(',');
      const rows = (transactions || []).map(t => [
        `"${new Date(t.date || t.createdAt).toLocaleDateString('en-IN')}"`,
        `"${(customer?.name || '').replace(/"/g, '""')}"`,
        `"${customer?.phone || ''}"`,
        `"${t.type === 'give' ? 'Debit (You Gave)' : 'Credit (You Got)'}"`,
        t.amount,
        `"${t.paymentMode || 'cash'}"`,
        `"${(t.description || t.remarks || '').replace(/"/g, '""')}"`
      ].join(','));

      const csvContent = [csvHeader, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(customer?.name || 'customer').replace(/\s+/g, '_')}_statement_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Excel statement downloaded successfully!");
    } catch (err) {
      toast.error('Failed to export Excel statement');
    }
  };

  const handleViewPDF = async () => {
    try {
      const response = await API.get(`/reminder/statement/${id}`, { responseType: 'blob' });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (err) {
      toast.error('Failed to load viewer');
    }
  };

  const openTxnModal = (type) => {
    setTxnType(type);
    setTxnForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    setBillImageBase64('');
    setShowTxnModal(true);
  };

  // Helper for transaction timestamps
  const getTxnTimestamp = (txn) => new Date(txn.createdAt || txn.date);

  const filteredTransactions = transactions.filter(t => {
    if (txnFilter === 'credit' && t.type !== 'credit') return false;
    if (txnFilter === 'debit' && t.type !== 'debit') return false;
    if (txnFilter === 'pending' && t.paymentStatus === 'SETTLED') return false;
    if (txnFilter === 'settled' && t.paymentStatus !== 'SETTLED') return false;
    if (txnFilter === 'bill' && !(t.billImageUrl || t.screenshot || t.screenshotUrl || t.paymentScreenshot || t.image)) return false;
    if (txnSearch.trim()) {
      const q = txnSearch.trim().toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const amt = String(t.amount);
      const utr = (t.utr || '').toLowerCase();
      const payId = (t.cashfreePaymentId || '').toLowerCase();
      const mode = (t.paymentMode || '').toLowerCase();
      return desc.includes(q) || amt.includes(q) || utr.includes(q) || payId.includes(q) || mode.includes(q);
    }
    return true;
  });

  const groupedTransactions = () => {
    const sorted = [...filteredTransactions].sort((a, b) => {
      const diff = getTxnTimestamp(b) - getTxnTimestamp(a);
      return txnSortOrder === 'desc' ? diff : -diff;
    });
    const groups = [];
    let currentDate = '';
    for (const txn of sorted) {
      const ts = getTxnTimestamp(txn);
      const dateStr = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ type: 'date', label: dateStr });
      }
      groups.push({ type: 'txn', data: txn });
    }
    return groups;
  };

  if (loading && !customer) return <><Header title={t('loading')} /><Loader fullPage /></>;
  if (!customer) return <><Header title="Not Found" /><div className="bg-pure-white border border-soft-gray rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto mt-12"><h3>Customer not found</h3></div></>;

  const riskBadgeClasses = {
    low: 'bg-green-get/10 text-green-get',
    medium: 'bg-warning-pending/10 text-warning-pending',
    high: 'bg-red-give/10 text-red-give'
  };

  const totalGave = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPaid = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const creditTxnsCount = transactions.filter(t => t.type === 'credit').length;
  const debitTxnsCount = transactions.filter(t => t.type === 'debit').length;
  const pendingTxnsCount = transactions.filter(t => t.paymentStatus !== 'SETTLED').length;
  const hasBillCount = transactions.filter(t => Boolean(t.billImageUrl || t.screenshot || t.screenshotUrl || t.paymentScreenshot || t.image)).length;

  return (
    <>
      <Header title={customer.name} subtitle={customer.phone} />

      {/* Top Nav Action Row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link to="/customers" className="inline-flex items-center gap-1.5 text-slate-gray hover:text-deep-navy font-semibold text-xs sm:text-sm transition-colors decoration-none">
          <HiOutlineArrowLeft /> {t('backToCustomers')}
        </Link>
        <div className="flex items-center gap-2">
          {customer.balance > 0 && (
            <button
              type="button"
              onClick={handleEmailReminder}
              disabled={sendingEmail}
              className="px-2.5 py-1.5 bg-orange/10 hover:bg-orange/20 text-orange font-bold text-xs rounded-lg transition-colors flex items-center gap-1 border border-orange/20 cursor-pointer shadow-xs"
              title="Send Email Reminder"
            >
              {sendingEmail ? (
                <span className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />
              ) : (
                <HiOutlineMail size={13} />
              )}
              <span className="hidden sm:inline">Send Reminder</span>
            </button>
          )}
          <button
            type="button"
            onClick={openEditCustomerModal}
            className="px-2.5 py-1.5 bg-soft-white hover:bg-slate-gray/10 text-slate-gray hover:text-deep-navy border border-soft-gray font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Edit Customer Profile"
          >
            <HiOutlinePencil size={13} />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="px-2.5 py-1.5 bg-soft-white hover:bg-red-50 text-slate-gray hover:text-red-600 border border-soft-gray font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            title="Download PDF Statement"
          >
            <HiOutlineDocumentDownload size={14} className="text-red-600" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="px-2.5 py-1.5 bg-soft-white hover:bg-emerald-50 text-slate-gray hover:text-emerald-600 border border-soft-gray font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            title="Download Excel Statement"
          >
            <HiOutlineDownload size={14} className="text-emerald-600" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Unified High-Density Customer Hub Card */}
      <div className="bg-pure-white border border-soft-gray rounded-2xl p-4 sm:p-5 shadow-sm mb-5">
        {/* Profile + Status Badges Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-soft-gray/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-orange/25 overflow-hidden flex items-center justify-center bg-light-cream shadow-xs shrink-0">
              {customer.avatar ? (
                <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl sm:text-2xl font-black text-orange uppercase">{customer.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-deep-navy m-0 truncate">{customer.name}</h3>
                {(() => {
                  const badges = getCustomerBadges(customer);
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1.5 border ${badges.statusClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badges.statusDotColor}`} />
                      {badges.statusLabel}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-gray mt-0.5 flex-wrap">
                <a href={`tel:${customer.phone}`} className="font-semibold text-deep-navy hover:text-orange inline-flex items-center gap-1 decoration-none">
                  <HiOutlinePhone size={12} className="text-slate-gray/70" /> {customer.phone}
                </a>
                {customer.email && (
                  <span className="hidden md:inline-flex items-center gap-1 truncate max-w-[200px]" title={customer.email}>
                    <HiOutlineMail size={12} className="text-slate-gray/70" /> {customer.email}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <HiOutlineCalendar size={12} className="text-slate-gray/70" /> Since {new Date(customer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Badges: Address & Credit Score */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end text-xs">
            {customer.address && (
              <button
                type="button"
                onClick={() => navigateToAddress(customer.address)}
                className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title={customer.address}
              >
                <HiOutlineLocationMarker size={12} />
                <span className="max-w-[130px] sm:max-w-[170px] truncate">{customer.city || customer.address}</span>
                <HiOutlineExternalLink size={10} />
              </button>
            )}
            <div className="inline-flex items-center gap-1 py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-soft-gray rounded-lg text-[11px] font-bold">
              <HiOutlineLightBulb size={12} className="text-orange" />
              <span className="text-slate-gray">Score:</span>
              <span className={customer.creditScore >= 700 ? 'text-green-get' : customer.creditScore >= 550 ? 'text-warning-pending' : 'text-red-give'}>
                {customer.totalTransactions > 0 ? customer.creditScore : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 my-3">
          <div className={`p-3 sm:p-4 rounded-xl border flex flex-col justify-between ${customer.balance > 0 ? 'bg-red-give/5 border-red-give/15' : 'bg-green-get/5 border-green-get/15'
            }`}>
            <div className="flex justify-between items-center">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-gray">Remaining Due</span>
              {customer.paymentDueDate && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${new Date(customer.paymentDueDate) <= new Date() ? 'bg-red-give/15 text-red-give' : 'bg-slate-100 text-slate-600'
                  }`}>
                  Due: {new Date(customer.paymentDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${customer.balance > 0 ? 'text-red-give' : 'text-green-get'}`}>
              ₹{customer.balance > 0 ? customer.balance.toLocaleString('en-IN') : 0}
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl border bg-green-get/5 border-green-get/15 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-gray">Total Paid (Got)</span>
            <div className="text-xl sm:text-2xl font-black text-green-get mt-1">
              ₹{totalPaid.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-3 sm:p-4 rounded-xl border bg-slate-50/80 dark:bg-slate-800/40 border-soft-gray flex sm:flex-col justify-between items-center sm:items-start">
            <div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-gray">Total Udhaar Given</span>
              <div className="text-lg sm:text-xl font-bold text-deep-navy dark:text-white mt-0.5 sm:mt-1">
                ₹{totalGave.toLocaleString('en-IN')}
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-gray/70 bg-soft-gray/30 px-2 py-0.5 rounded-full">
              {transactions.length} Txns
            </span>
          </div>
        </div>

        {/* Primary Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-soft-gray/40">
          <button
            type="button"
            onClick={() => openTxnModal('credit')}
            className="flex-1 min-w-[125px] py-2.5 px-3 bg-red-give hover:bg-red-hover text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm border-none cursor-pointer transition-all active:scale-[0.98]"
          >
            <HiOutlineArrowUp size={16} /> {t('youGave')}
          </button>

          <button
            type="button"
            onClick={() => openTxnModal('debit')}
            className="flex-1 min-w-[125px] py-2.5 px-3 bg-green-get hover:bg-green-hover text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm border-none cursor-pointer transition-all active:scale-[0.98]"
          >
            <HiOutlineArrowDown size={16} /> {t('youGot')}
          </button>

          {isSpeechSupported && (
            <button
              type="button"
              onClick={toggleVoiceEntry}
              className={`p-2.5 rounded-xl shadow-xs flex items-center justify-center border-none cursor-pointer transition-all active:scale-[0.98] ${isListening ? 'bg-red-give text-white animate-pulse' : 'bg-orange text-white hover:bg-orange-hover'
                }`}
              title={isListening ? "Stop Listening" : "Voice Transaction Entry (Telugu/Hindi/English)"}
            >
              {isListening ? <HiOutlineX size={18} /> : <HiOutlineMicrophone size={18} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAiCallModal(true)}
            className="py-2.5 px-3 bg-gradient-to-r from-orange to-orange-hover text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 border-none cursor-pointer transition-all active:scale-[0.98]"
            title="Start AI Voice Call"
          >
            <HiOutlineSparkles size={15} />
            <span>AI Call</span>
          </button>
        </div>
      </div>



      {/* Address Verification Section */}
      <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-soft-gray/50 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-orange/10 dark:bg-orange-950/30 rounded-xl text-orange">
                <HiOutlineLocationMarker size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-deep-navy dark:text-white m-0">Address Verification</h3>
                <p className="text-xs text-slate-gray dark:text-slate-400 m-0">Secure address validation</p>
              </div>
            </div>

            {/* Verification Status Pill Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${customer.addressVerificationStatus === 'verified'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/80'
                : customer.addressVerificationStatus === 'mismatch'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80'
                  : customer.addressVerificationStatus === 'rejected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300/80'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-300/80'
                }`}>
                {customer.addressVerificationStatus === 'verified' && <HiOutlineCheckCircle size={16} />}
                {customer.addressVerificationStatus === 'mismatch' && <HiOutlineExclamation size={16} />}
                {customer.addressVerificationStatus === 'rejected' && <HiOutlineXCircle size={16} />}
                {customer.addressVerificationStatus === 'pending' && <HiOutlineClock size={16} />}
                <span>
                  {customer.addressVerificationStatus === 'verified' ? 'Address Verified' : customer.addressVerificationStatus === 'mismatch' ? 'Location Mismatch' : customer.addressVerificationStatus === 'rejected' ? 'Address Rejected' : 'Pending Verification'}
                </span>
              </span>

              <button
                type="button"
                onClick={handleOpenVerifyModal}
                className="px-3.5 py-1.5 bg-orange hover:bg-orange-hover text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                Verify Address
              </button>

              <button
                type="button"
                onClick={() => setShowAddressDetails(prev => !prev)}
                className="p-1.5 rounded-lg bg-soft-white dark:bg-slate-800 border border-soft-gray text-slate-gray hover:text-deep-navy dark:hover:text-white cursor-pointer transition-colors"
                title={showAddressDetails ? "Collapse Address Details" : "Expand Address Details"}
              >
                {showAddressDetails ? <HiOutlineChevronUp size={16} /> : <HiOutlineChevronDown size={16} />}
              </button>
            </div>
          </div>

          {showAddressDetails && (
            <div className="space-y-4">
              {/* Structured Address Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-soft-white dark:bg-slate-800/60 border border-soft-gray/60 dark:border-slate-700/60 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider block">House / Flat / Door No.</span>
              <span className="font-bold text-deep-navy dark:text-white text-sm">
                {customer.houseNumber ? customer.houseNumber : <span className="text-amber-600 dark:text-amber-400 italic font-medium">Not specified</span>}
              </span>
            </div>

            <div className="p-3 bg-soft-white dark:bg-slate-800/60 border border-soft-gray/60 dark:border-slate-700/60 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider block">Street / Colony / Landmark</span>
              <span className="font-semibold text-deep-navy dark:text-white">
                {customer.street ? customer.street : (customer.area || <span className="text-slate-gray/50 italic">Not set</span>)}
              </span>
            </div>

            <div className="p-3 bg-soft-white dark:bg-slate-800/60 border border-soft-gray/60 dark:border-slate-700/60 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider block">City / State</span>
              <span className="font-semibold text-deep-navy dark:text-white">
                {[customer.city, customer.state].filter(Boolean).join(', ') || <span className="text-slate-gray/50 italic">Not set</span>}
              </span>
            </div>

            <div className="p-3 bg-soft-white dark:bg-slate-800/60 border border-soft-gray/60 dark:border-slate-700/60 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider block">PIN Code</span>
              <span className="font-mono font-bold text-deep-navy dark:text-white">
                {customer.pincode ? customer.pincode : <span className="text-slate-gray/50 italic">Not set</span>}
              </span>
            </div>
          </div>

          {/* Full Address & Google Maps Location details */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-soft-gray/80 dark:border-slate-700/80 rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-gray dark:text-slate-400 uppercase tracking-wider block">Full Formatted Address</span>
                <span className="text-xs font-semibold text-deep-navy dark:text-white block mt-0.5">
                  {customer.address || 'No address saved for customer'}
                </span>
              </div>
              {customer.address && (
                <button
                  type="button"
                  onClick={() => navigateToAddress(customer.address)}
                  className="px-3.5 py-2 bg-pure-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:underline flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                >
                  <HiOutlineMap size={14} /> Open Google Maps <HiOutlineExternalLink size={12} />
                </button>
              )}
            </div>

            {customer.latitude && customer.longitude && (
              <div className="pt-2 border-t border-soft-gray/50 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-gray dark:text-slate-400">Google Maps Pin Coordinates:</span>
                  <span className="font-mono font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-deep-navy dark:text-slate-100">
                    ({customer.latitude.toFixed(5)}, {customer.longitude.toFixed(5)})
                  </span>
                </div>
                <span className="text-[10px] text-slate-gray italic">
                  Note: Map coordinates indicate location pin only; house number requires manual verification.
                </span>
              </div>
            )}
          </div>

          {/* Live GPS Verification Tool */}
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <HiOutlineLocationMarker className="text-blue-600 dark:text-blue-400" size={16} /> GPS Proximity Check
                </span>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 m-0 mt-0.5">
                  Compare current live GPS coordinates against customer's saved map pin position.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(!customer?.latitude || !customer?.longitude) && (
                  <button
                    type="button"
                    onClick={() => setShowDirectMapModal(true)}
                    className="px-3.5 py-2 bg-orange hover:bg-orange-hover text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <HiOutlineLocationMarker size={14} />
                    <span>Set Map Location</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCheckGps}
                  disabled={gpsLoading}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <HiOutlineLocationMarker size={14} />
                  <span>{gpsLoading ? 'Capturing GPS...' : 'Check Live GPS Proximity'}</span>
                </button>
              </div>
            </div>

            {(!customer?.latitude || !customer?.longitude) && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300/80 dark:border-amber-800/80 rounded-lg text-xs flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5">
                  <HiOutlineExclamation size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[11px] font-medium">
                    Map coordinates not set. Click <strong>"Set Map Location"</strong> to pin location on Google Maps.
                  </span>
                </div>
              </div>
            )}

            {gpsResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${gpsResult.isMatch
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
                }`}>
                <div className="flex items-center gap-2">
                  {gpsResult.isMatch ? <HiOutlineCheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" /> : <HiOutlineExclamation size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                  <div>
                    <span className="font-bold block">
                      {gpsResult.isMatch ? 'GPS Location Matched' : 'GPS Location Mismatch'}
                    </span>
                    <span className="text-[11px] opacity-90">
                      Live GPS distance is ~{gpsResult.distanceMeters < 1000 ? `${gpsResult.distanceMeters} meters` : `${(gpsResult.distanceMeters / 1000).toFixed(2)} km`} from customer pin (Threshold: {gpsResult.thresholdMeters}m).
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${gpsResult.isMatch ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100' : 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                  }`}>
                  {gpsResult.isMatch ? 'Matched' : 'Mismatch'}
                </span>
              </div>
            )}
          </div>

          {/* Verification Metadata & Evidence */}
          {customer.addressVerificationStatus !== 'pending' && (
            <div className="p-3.5 bg-soft-white dark:bg-slate-800/40 border border-soft-gray/60 dark:border-slate-700/60 rounded-xl space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-gray dark:text-slate-300">
                <span>
                  Verified by: <strong className="text-deep-navy dark:text-white">{customer.verifiedBy?.name || 'Shopkeeper'}</strong>
                </span>
                {customer.verifiedAt && (
                  <span>Verified on: <strong className="text-deep-navy dark:text-white">{new Date(customer.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></span>
                )}
              </div>
              {customer.verificationNote && (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-1 border-t border-soft-gray/30 dark:border-slate-700/40">
                  Verification Note: "{customer.verificationNote}"
                </div>
              )}
              {customer.verificationEvidence && (
                <div className="pt-2 border-t border-soft-gray/30 dark:border-slate-700/40 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-gray dark:text-slate-300">Address Proof Document Uploaded:</span>
                  <button
                    type="button"
                    onClick={() => setLightboxImg(customer.verificationEvidence)}
                    className="px-3 py-1 bg-orange/10 hover:bg-orange/20 text-orange dark:text-orange-300 border border-orange/30 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                  >
                    View Uploaded Evidence Document
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Digital Khata Ledger & Passbook */}
      <div className="bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          {/* Ledger Toolbar & Controls */}
          <div className="p-3.5 sm:p-4 border-b border-soft-gray/60 dark:border-slate-800 space-y-3">
            {/* Title & Sort Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange/10 text-orange rounded-xl flex items-center justify-center shrink-0">
                  <HiOutlineDocumentText size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-deep-navy dark:text-white m-0">Transaction History</h3>
                  <p className="text-[11px] text-slate-gray m-0">
                    Showing {filteredTransactions.length} of {transactions.length} records
                  </p>
                </div>
              </div>

              {/* Actions & Sort Toggle */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="py-1 px-2 sm:px-2.5 bg-soft-white dark:bg-slate-800 hover:bg-red-50 text-slate-gray hover:text-red-600 border border-soft-gray dark:border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Download PDF Statement"
                >
                  <HiOutlineDocumentDownload size={13} className="text-red-600" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="py-1 px-2 sm:px-2.5 bg-soft-white dark:bg-slate-800 hover:bg-emerald-50 text-slate-gray hover:text-emerald-600 border border-soft-gray dark:border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Download Excel Statement"
                >
                  <HiOutlineDownload size={13} className="text-emerald-600" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTxnSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="py-1 px-2 sm:px-2.5 bg-soft-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-gray hover:text-deep-navy dark:text-slate-300 border border-soft-gray dark:border-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                  title={`Sort: ${txnSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}`}
                >
                  <HiOutlineSwitchVertical size={13} className="text-orange" />
                  <span className="text-[11px] hidden sm:inline">{txnSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Chips & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setTxnFilter('all')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${txnFilter === 'all'
                    ? 'bg-deep-navy text-white border-deep-navy shadow-xs'
                    : 'bg-soft-white dark:bg-slate-800 text-slate-gray border-soft-gray dark:border-slate-700 hover:bg-slate-100'
                    }`}
                >
                  All ({transactions.length})
                </button>

                <button
                  type="button"
                  onClick={() => setTxnFilter('credit')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${txnFilter === 'credit'
                    ? 'bg-red-give text-white border-red-give shadow-xs'
                    : 'bg-red-give/5 text-red-give border-red-give/20 hover:bg-red-give/10'
                    }`}
                >
                  + Udhaar ({creditTxnsCount})
                </button>

                <button
                  type="button"
                  onClick={() => setTxnFilter('debit')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${txnFilter === 'debit'
                    ? 'bg-green-get text-white border-green-get shadow-xs'
                    : 'bg-green-get/5 text-green-get border-green-get/20 hover:bg-green-get/10'
                    }`}
                >
                  - Paid ({debitTxnsCount})
                </button>

                {pendingTxnsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTxnFilter('pending')}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer whitespace-nowrap flex items-center gap-1 ${txnFilter === 'pending'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                      }`}
                  >
                    <HiOutlineClock size={12} /> Pending ({pendingTxnsCount})
                  </button>
                )}

                {hasBillCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTxnFilter('bill')}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer whitespace-nowrap flex items-center gap-1 ${txnFilter === 'bill'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                      }`}
                  >
                    <HiOutlinePhotograph size={12} /> Screenshot / Bill ({hasBillCount})
                  </button>
                )}
              </div>

              {/* Search Field */}
              <div className="relative min-w-[140px] sm:w-48">
                <HiOutlineSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-gray/60" size={13} />
                <input
                  type="text"
                  placeholder="Search note, UTR..."
                  value={txnSearch}
                  onChange={(e) => setTxnSearch(e.target.value)}
                  className="w-full pl-7 pr-6 py-1 bg-soft-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-lg text-xs outline-none focus:border-orange text-deep-navy dark:text-white"
                />
                {txnSearch && (
                  <button
                    type="button"
                    onClick={() => setTxnSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-gray hover:text-deep-navy text-xs border-none bg-transparent cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Ledger Records Container */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-gray">
                <HiOutlineDocumentText size={24} />
              </div>
              <h4 className="text-sm font-bold text-deep-navy dark:text-white m-0">No Transactions Found</h4>
              <p className="text-xs text-slate-gray max-w-xs mx-auto">
                {txnSearch || txnFilter !== 'all'
                  ? 'No records match your selected filter. Clear filters to see all.'
                  : 'Start by recording the first transaction using the buttons below.'}
              </p>
              {(txnSearch || txnFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setTxnFilter('all'); setTxnSearch(''); }}
                  className="px-3 py-1 bg-orange/10 text-orange font-bold text-xs rounded-lg border border-orange/20 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-soft-gray/40 dark:divide-slate-800/80 max-h-[550px] overflow-y-auto">
              {groupedTransactions().map((item, i) => {
                if (item.type === 'date') {
                  return (
                    <div
                      key={`date-${i}`}
                      className="px-4 py-1.5 bg-slate-50/95 dark:bg-slate-800/80 sticky top-0 z-10 border-y border-soft-gray/40 dark:border-slate-700/50 flex items-center justify-between text-[11px] font-bold text-slate-gray shadow-2xs"
                    >
                      <span className="flex items-center gap-1.5 text-deep-navy dark:text-white font-extrabold">
                        <HiOutlineCalendar size={12} className="text-orange" /> {item.label}
                      </span>
                    </div>
                  );
                }

                const txn = item.data;
                const isCredit = txn.type === 'credit';
                const isSettled = txn.paymentStatus === 'SETTLED';
                const utrMatch = txn.description ? txn.description.match(/(?:UTR|Order|ID):\s*([a-zA-Z0-9_-]+)/i) : null;
                const displayUtr = txn.utr || (utrMatch ? utrMatch[1] : null);
                const displayPayId = txn.cashfreePaymentId || null;
                const proofImage = txn.billImageUrl || txn.screenshot || txn.screenshotUrl || txn.image || txn.paymentScreenshot;
                const txnTime = new Date(txn.createdAt || txn.date).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit', hour12: true
                });

                return (
                  <div
                    key={txn._id}
                    className="p-3 sm:p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                  >
                    {/* Left: Direction Icon + Details */}
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                      {/* Direction Icon Badge */}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${isCredit
                        ? 'bg-red-give/10 border-red-give/20 text-red-give'
                        : 'bg-green-get/10 border-green-get/20 text-green-get'
                        }`}>
                        {isCredit ? <HiOutlineArrowUp size={18} /> : <HiOutlineArrowDown size={18} />}
                      </div>

                      {/* Info & Metadata */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs sm:text-sm font-black ${isCredit ? 'text-red-give' : 'text-green-get'}`}>
                            {isCredit ? t('youGave') : t('youGot')}
                          </span>
                          {txn.paymentMode && txn.paymentMode !== 'none' && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-soft-gray/30 text-slate-gray">
                              {txn.paymentMode}
                            </span>
                          )}
                          {proofImage && (
                            <button
                              type="button"
                              onClick={() => setLightboxImg(proofImage)}
                              className="px-2 py-0.5 rounded-md bg-orange/15 hover:bg-orange/25 text-orange border border-orange/30 text-[9px] font-black inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="View Attached Screenshot / Bill"
                            >
                              <HiOutlinePhotograph size={11} /> Proof Attached
                            </button>
                          )}
                        </div>

                        {/* Description note */}
                        {txn.description && (
                          <p className="text-xs text-deep-navy/80 dark:text-slate-300 font-medium m-0 truncate max-w-[190px] sm:max-w-md" title={txn.description}>
                            {txn.description}
                          </p>
                        )}

                        {/* Clearly visible payment screenshot / bill preview & dedicated button */}
                        {proofImage && (
                          <div className="mt-2 p-2 rounded-xl bg-orange/5 dark:bg-orange-950/20 border border-orange/20 flex items-center gap-2.5 sm:gap-3 max-w-sm">
                            <div
                              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 border-orange/30 shrink-0 cursor-pointer group bg-black/5 shadow-2xs"
                              onClick={() => setLightboxImg(proofImage)}
                              title="Click to view full size screenshot / bill"
                            >
                              <img
                                src={proofImage}
                                alt="Payment Screenshot / Bill"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <HiOutlinePhotograph size={16} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="text-[10px] sm:text-[11px] font-extrabold text-deep-navy dark:text-white block truncate">
                                Uploaded Payment Screenshot
                              </span>
                              <button
                                type="button"
                                onClick={() => setLightboxImg(proofImage)}
                                className="px-2.5 py-1 bg-gradient-to-r from-orange to-orange-hover hover:scale-[1.01] active:scale-[0.99] text-white text-[10px] sm:text-[11px] font-extrabold rounded-lg transition-all border-none cursor-pointer shadow-xs inline-flex items-center gap-1"
                              >
                                <HiOutlinePhotograph size={12} /> View Screenshot / Bill <HiOutlineExternalLink size={9} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Time & Reference Tags */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-gray flex-wrap pt-0.5">
                          <span>{txnTime}</span>
                          {displayUtr && (
                            <span className="font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 px-1 rounded text-[9px] font-bold">
                              UTR: {displayUtr}
                            </span>
                          )}
                          {displayPayId && (
                            <span className="font-mono text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 px-1 rounded text-[9px]">
                              PayID: {displayPayId}
                            </span>
                          )}
                          <span className="font-mono text-slate-gray/50 text-[9px]">
                            #{txn._id.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount, Status, and Actions */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Amount */}
                      <div className={`text-base sm:text-lg font-black tracking-tight ${(isSettled || !isCredit) ? 'text-green-get' : 'text-red-give'
                        }`}>
                        {isCredit ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                      </div>

                      {/* Status & 1-Click Settlement / Approval */}
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isSettled
                          ? 'bg-green-get/10 text-green-get'
                          : 'bg-warning-pending/10 text-warning-pending'
                          }`}>
                          {isSettled ? t('settled') : t('pending')}
                        </span>

                        {isCredit && !isSettled && (
                          <button
                            type="button"
                            onClick={() => handleSettle(txn._id)}
                            className="px-2 py-0.5 bg-orange/10 hover:bg-orange/20 text-orange border border-orange/30 text-[9px] font-bold rounded-md cursor-pointer transition-colors inline-flex items-center gap-0.5"
                          >
                            <HiOutlineCheckCircle size={10} /> Settle
                          </button>
                        )}

                        {!isCredit && !isSettled && (
                          <div className="flex gap-1 items-center">
                            <button
                              type="button"
                              onClick={() => handleApprovePayment(txn._id)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-1.5 py-0.5 cursor-pointer text-[8px] font-bold inline-flex items-center gap-0.5"
                            >
                              <HiOutlineCheckCircle size={9} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclinePayment(txn._id)}
                              className="bg-red-500 hover:bg-red-600 text-white rounded px-1.5 py-0.5 cursor-pointer text-[8px] font-bold inline-flex items-center gap-0.5"
                            >
                              <HiOutlineXCircle size={9} /> Decline
                            </button>
                          </div>
                        )}

                        {/* Edit & Delete Action Buttons */}
                        <button
                          type="button"
                          onClick={() => openEditModal(txn)}
                          className="p-1 text-slate-gray hover:text-deep-navy dark:hover:text-white bg-transparent border-none cursor-pointer rounded transition-colors"
                          title="Edit Transaction"
                        >
                          <HiOutlinePencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(txn._id)}
                          className="p-1 text-slate-gray hover:text-red-give bg-transparent border-none cursor-pointer rounded transition-colors"
                          title={t('delete')}
                        >
                          <HiOutlineTrash size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Quick Transaction Action Footer */}
          <div className="p-3 bg-soft-white dark:bg-slate-800/60 border-t border-soft-gray/60 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => openTxnModal('credit')}
                className="flex-1 py-2 px-3 bg-red-give hover:bg-red-hover text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5 font-bold text-xs border-none cursor-pointer transition-all active:scale-[0.98]"
              >
                <HiOutlineArrowUp size={14} /> {t('youGave')}
              </button>
              <button
                type="button"
                onClick={() => openTxnModal('debit')}
                className="flex-1 py-2 px-3 bg-green-get hover:bg-green-hover text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5 font-bold text-xs border-none cursor-pointer transition-all active:scale-[0.98]"
              >
                <HiOutlineArrowDown size={14} /> {t('youGot')}
              </button>
            </div>
            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleVoiceEntry}
                className={`p-2 rounded-xl shadow-xs flex items-center justify-center border-none cursor-pointer transition-all ${isListening ? 'bg-red-give text-white animate-pulse' : 'bg-orange text-white hover:bg-orange-hover'
                  }`}
                title={isListening ? "Stop Listening" : "Voice Transaction Entry"}
              >
                {isListening ? <HiOutlineX size={16} /> : <HiOutlineMicrophone size={16} />}
              </button>
            )}
          </div>
        </div>

      {/* Add Transaction Modal */}
      <Modal isOpen={showTxnModal} onClose={() => setShowTxnModal(false)}
        title={txnType === 'credit' ? t('youGave') : t('youGot')}>
        <form onSubmit={handleAddTxn} className="space-y-4">
          {/* Credit Safety Warning Banner */}
          {txnType === 'credit' && customer?.addressVerificationStatus !== 'verified' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl space-y-1 text-amber-900 dark:text-amber-200 shadow-xs">
              <div className="flex items-center justify-between font-bold text-xs">
                <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <HiOutlineExclamation size={16} /> Address Verification Warning
                </span>
                <span className="uppercase text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                  Status: {customer?.addressVerificationStatus || 'pending'}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                Address is not verified. Please verify the customer's address before approving high credit.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('amount')} *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-gray font-extrabold text-base">₹</span>
              <input
                className="w-full pl-8 pr-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all font-bold text-deep-navy"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={txnForm.amount}
                onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('description')}</label>
            <input
              className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
              value={txnForm.description}
              onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
              placeholder="e.g., Rice 10kg, Atta 5kg"
            />
          </div>
          {txnType === 'debit' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Payment Mode *</label>
              <select
                className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
                value={txnForm.paymentMode || 'cash'}
                onChange={(e) => setTxnForm({ ...txnForm, paymentMode: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="online">Online Transfer</option>
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('date')}</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setTxnForm({ ...txnForm, date: new Date().toISOString().split('T')[0] })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${txnForm.date === new Date().toISOString().split('T')[0]
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
                  setTxnForm({ ...txnForm, date: yesterday.toISOString().split('T')[0] });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${txnForm.date === new Date(Date.now() - 86400000).toISOString().split('T')[0]
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
              value={txnForm.date}
              onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
            />
          </div>

          {/* Add Image (camera / gallery) button */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Product / Bill Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id="txn-camera-input"
              className="hidden"
              onChange={handleTxnPhotoChange}
            />
            {!billImageBase64 ? (
              <button
                type="button"
                onClick={() => document.getElementById('txn-camera-input').click()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-orange text-gray-600 hover:text-orange rounded-xl text-sm font-medium cursor-pointer transition-colors"
              >
                <HiOutlineCamera size={18} className="text-orange" />
                <span>Add Image</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 shrink-0 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={billImageBase64}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById('txn-camera-input').click()}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors border-none"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillImageBase64('')}
                    className="px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer transition-colors border-none"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Card */}
          {customer && txnForm.amount && parseFloat(txnForm.amount) > 0 && (() => {
            const currentBal = customer.balance;
            const txnAmount = parseFloat(txnForm.amount) || 0;
            const isCredit = txnType === 'credit';
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
              onClick={() => setShowTxnModal(false)}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors shadow-sm disabled:opacity-50 ${txnType === 'credit' ? 'bg-red-give hover:bg-red-hover text-white' : 'bg-green-get hover:bg-green-hover text-white'
                }`}
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Transaction">
        <form onSubmit={handleEditTxn} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('amount')} (₹) *</label>
            <input
              className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-lg focus:outline-none focus:border-orange transition-all text-center font-bold"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              placeholder="Enter amount"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('description')}</label>
            <input
              className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="e.g., Rice 10kg, Atta 5kg"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('date')}</label>
            <input
              className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all"
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Payment Status *</label>
            <select
              className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-colors"
              required
              value={editForm.paymentStatus}
              onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}
            >
              <option value="PENDING">{t('pending')}</option>
              <option value="SETTLED">{t('settled')}</option>
            </select>
          </div>
          {editingTxn?.type === 'debit' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Payment Mode *</label>
              <select
                className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-colors"
                required
                value={editForm.paymentMode || 'cash'}
                onChange={(e) => setEditForm({ ...editForm, paymentMode: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="online">Online Transfer</option>
              </select>
            </div>
          )}

          {/* Add Image (camera / gallery) button – edit modal */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Product / Bill Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id="edit-txn-camera-input"
              className="hidden"
              onChange={handleEditTxnPhotoChange}
            />
            {!editBillImageBase64 ? (
              <button
                type="button"
                onClick={() => document.getElementById('edit-txn-camera-input').click()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-orange text-gray-600 hover:text-orange rounded-xl text-sm font-medium cursor-pointer transition-colors"
              >
                <HiOutlineCamera size={18} className="text-orange" />
                <span>Add Image</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 shrink-0 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={editBillImageBase64}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById('edit-txn-camera-input').click()}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors border-none"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditBillImageBase64('')}
                    className="px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer transition-colors border-none"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-soft-gray">
            <button
              type="button"
              className="px-4 py-2.5 bg-transparent border border-soft-gray text-slate-gray hover:bg-slate-gray/5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              onClick={() => setShowEditModal(false)}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-colors shadow-sm"
              disabled={submitting}
            >
              {submitting ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Profile Modal */}
      <Modal isOpen={showEditCustomer} onClose={() => setShowEditCustomer(false)} title="Edit Customer Profile">
        <form onSubmit={handleUpdateCustomer} className="space-y-4">
          {/* Profile Picture Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider mb-2">Profile Photo</label>
            <div className="flex items-center gap-4 p-3 bg-soft-white border border-soft-gray rounded-xl w-full">
              {/* Avatar Preview */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full bg-pure-white border-2 border-orange flex items-center justify-center overflow-hidden cursor-pointer shadow-sm hover:scale-105 transition-transform"
                  onClick={() => customerFileInputRef.current.click()}
                  type="button"
                >
                  {customerForm.avatar ? (
                    <img src={customerForm.avatar} alt="Avatar" className="w-full h-full object-cover" />
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
                  ref={customerFileInputRef}
                  onChange={handleCustomerFileChange}
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
                    const isSelected = customerForm.avatar === p.value;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all p-0 cursor-pointer ${isSelected ? 'border-orange scale-110 shadow-sm' : 'border-soft-gray opacity-70 hover:opacity-100'
                          }`}
                        onClick={() => setCustomerForm(prev => ({ ...prev, avatar: p.value }))}
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
            <input className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" required value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('phone')} *</label>
            <input className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" required value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="+91 9876543210" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Email Address</label>
            <input type="email" className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" value={customerForm.email || ''} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="customer@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Payment Due Date</label>
            <input type="date" className="w-full px-4 py-2.5 bg-pure-white border border-soft-gray rounded-xl text-sm focus:outline-none focus:border-orange transition-all" value={customerForm.paymentDueDate || ''} onChange={(e) => setCustomerForm({ ...customerForm, paymentDueDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">{t('address')} & Map Location</label>
            <LocationAddressInput
              value={customerForm.address}
              onChange={(val) => setCustomerForm({ ...customerForm, address: val })}
              onSelectLocationDetails={handleEditLocationDetailsSelect}
              latitude={customerForm.latitude}
              longitude={customerForm.longitude}
              placeholder="Enter address manually or select on Google Maps"
            />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-soft-gray dark:border-slate-700 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-soft-gray/50 pb-1">
              <span className="text-[11px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider">
                Structured Address Verification Details
              </span>
              <div className="flex items-center gap-2">
                {isEditGeocoding && (
                  <span className="text-[10px] font-bold text-orange flex items-center gap-1 animate-pulse">
                    <span className="w-2.5 h-2.5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                    Auto-Detecting...
                  </span>
                )}
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                  Edits Reset Status to Pending
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">House / Flat / Door No. *</label>
                <input
                  type="text"
                  value={customerForm.houseNumber}
                  onChange={(e) => setCustomerForm({ ...customerForm, houseNumber: e.target.value })}
                  placeholder="e.g. House No. 12"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">Street / Road / Colony</label>
                <input
                  type="text"
                  value={customerForm.street}
                  onChange={(e) => setCustomerForm({ ...customerForm, street: e.target.value })}
                  placeholder="e.g. MG Road, ABC Colony"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">Area / Landmark</label>
                <input
                  type="text"
                  value={customerForm.area}
                  onChange={(e) => setCustomerForm({ ...customerForm, area: e.target.value })}
                  placeholder="e.g. Near Water Tank"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">City / Town</label>
                <input
                  type="text"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                  placeholder="e.g. Hyderabad"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">State</label>
                <input
                  type="text"
                  value={customerForm.state}
                  onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                  placeholder="e.g. Telangana"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-gray dark:text-slate-300 uppercase">PIN Code (6 Digits)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={customerForm.pincode}
                  onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g. 500001"
                  className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
                />
              </div>
            </div>

            {customerForm.latitude && customerForm.longitude && (
              <div className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 p-2.5 rounded-lg border border-green-200/50 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold">
                    <HiOutlineCheckCircle size={14} className="text-green-600" />
                    <span>Location Auto-Detected & Pinned</span>
                  </span>
                  <span className="font-mono font-bold text-[10px] bg-green-200/60 dark:bg-green-900/60 px-2 py-0.5 rounded">
                    {customerForm.latitude.toFixed(4)}, {customerForm.longitude.toFixed(4)}
                  </span>
                </div>
                {editGeocodeDetectedAddr && (
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                    {editGeocodeDetectedAddr}
                  </span>
                )}
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 italic">
                  Marker location is set. Click "Select Location" on map anytime to drag pin or refine.
                </span>
              </div>
            )}
          </div>

          {/* AI Voice Assistant Settings in Edit Form */}
          <div className="p-3 bg-orange/5 dark:bg-orange-950/20 border border-orange/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-deep-navy dark:text-white flex items-center gap-1.5">
                AI Voice Assistant Settings
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={customerForm.aiReminderEnabled}
                  onChange={(e) => setCustomerForm({ ...customerForm, aiReminderEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange"></div>
                <span className="ml-2 text-xs font-bold text-slate-gray">
                  {customerForm.aiReminderEnabled ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-gray uppercase tracking-wider">Preferred Language</label>
                <select
                  className="w-full px-3 py-2 bg-pure-white border border-soft-gray rounded-lg text-xs font-semibold focus:outline-none focus:border-orange"
                  value={customerForm.preferredLanguage}
                  onChange={(e) => setCustomerForm({ ...customerForm, preferredLanguage: e.target.value })}
                >
                  <option value="te-IN">Telugu (తెలుగు)</option>
                  <option value="hi-IN">Hindi (हिंदी)</option>
                  <option value="en-IN">English</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                  <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-gray uppercase tracking-wider">Phone Type</label>
                <select
                  className="w-full px-3 py-2 bg-pure-white border border-soft-gray rounded-lg text-xs font-semibold focus:outline-none focus:border-orange"
                  value={customerForm.phoneType}
                  onChange={(e) => setCustomerForm({ ...customerForm, phoneType: e.target.value })}
                >
                  <option value="smartphone">Smartphone</option>
                  <option value="basic">Basic Phone (Feature)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-soft-gray">
            <button type="button" className="px-4 py-2.5 bg-transparent border border-soft-gray text-slate-gray hover:bg-slate-gray/5 rounded-xl text-sm font-semibold cursor-pointer transition-colors" onClick={() => setShowEditCustomer(false)}>{t('cancel')}</button>
            <button type="submit" className="px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-colors shadow-sm" disabled={submitting}>{submitting ? t('saving') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* Shopkeeper Address Verification Modal */}
      <Modal isOpen={showVerifyModal} onClose={() => setShowVerifyModal(false)} title="Address Verification — Shopkeeper Portal">
        <form onSubmit={handleVerifyAddressSubmit} className="space-y-4">
          {/* Summary Header */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-soft-gray dark:border-slate-700 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-deep-navy dark:text-white">Customer: {customer?.name}</span>
              <span className="text-xs font-mono text-slate-gray">{customer?.phone}</span>
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              <strong>Entered Address:</strong> {customer?.houseNumber ? `House No. ${customer.houseNumber}, ` : ''}{customer?.address || 'No address saved'}
            </div>
          </div>

          {/* Verification Status Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Select Verification Action *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setVerifyStatus('verified')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${verifyStatus === 'verified'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-pure-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-soft-gray dark:border-slate-700 hover:border-emerald-500'
                  }`}
              >
                <HiOutlineCheckCircle size={18} />
                <span>Verify Address</span>
              </button>

              <button
                type="button"
                onClick={() => setVerifyStatus('mismatch')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${verifyStatus === 'mismatch'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-pure-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-soft-gray dark:border-slate-700 hover:border-amber-500'
                  }`}
              >
                <HiOutlineExclamation size={18} />
                <span>Mark Mismatch</span>
              </button>

              <button
                type="button"
                onClick={() => setVerifyStatus('rejected')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${verifyStatus === 'rejected'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-pure-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-soft-gray dark:border-slate-700 hover:border-red-500'
                  }`}
              >
                <HiOutlineXCircle size={18} />
                <span>Reject Address</span>
              </button>

              <button
                type="button"
                onClick={() => setVerifyStatus('pending')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${verifyStatus === 'pending'
                  ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                  : 'bg-pure-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-soft-gray dark:border-slate-700 hover:border-yellow-500'
                  }`}
              >
                <HiOutlineClock size={18} />
                <span>Keep Pending</span>
              </button>
            </div>
          </div>

          {/* Verification Note Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Verification Note / Remarks</label>
            <textarea
              rows={2}
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              placeholder="Add verification notes (e.g., Checked electricity bill, house number matches door plate)"
              className="w-full px-3.5 py-2.5 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-xl text-xs font-medium text-deep-navy dark:text-white focus:outline-none focus:border-orange"
            />
          </div>

          {/* Optional Document Upload / Photo Evidence */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-gray uppercase tracking-wider">Address Proof Document / House Photo (Optional)</label>
            <input
              type="file"
              ref={evidenceFileInputRef}
              onChange={handleEvidenceFileUpload}
              accept="image/*"
              className="hidden"
            />
            {!verifyEvidence ? (
              <button
                type="button"
                onClick={() => evidenceFileInputRef.current.click()}
                className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-dashed border-soft-gray dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <HiOutlineCamera size={18} className="text-orange" />
                <span>Upload Address Proof Document / Door Plate Photo</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 p-2.5 border border-soft-gray dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900">
                <img src={verifyEvidence} alt="Evidence Document" className="w-14 h-14 object-cover rounded-lg border border-soft-gray" />
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Document Evidence Attached</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => evidenceFileInputRef.current.click()}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer border-none"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifyEvidence('')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer border-none"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-soft-gray dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowVerifyModal(false)}
              className="px-4 py-2.5 bg-transparent border border-soft-gray dark:border-slate-700 text-slate-gray dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifyingSubmitting}
              className="px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors shadow-md disabled:opacity-50"
            >
              {verifyingSubmitting ? 'Saving Status...' : 'Save Verification Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* AI Voice Assistant Call Simulator Modal */}
      <AiVoiceCallModal
        isOpen={showAiCallModal}
        onClose={() => setShowAiCallModal(false)}
        customer={customer}
        onCallCompleted={fetchData}
      />

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 bg-deep-navy/80 z-50 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Bill" className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" />
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title={t('deleteTransaction')} message={t('deleteTransactionMsg')} />

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
                {lang === 'hi' ? 'बोलिए (जैसे: "300 रुपये लिए")' : lang === 'te' ? 'మాట్లాడండి (ఉదాహరణకు: "300 రూపాయలు తీసుకున్నాడు")' : 'Speak now (e.g., "took 300 rupees")'}
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

      {/* Direct Google Maps Picker Modal for setting customer pin */}
      <MapPickerModal
        isOpen={showDirectMapModal}
        onClose={() => setShowDirectMapModal(false)}
        onSelectLocation={() => { }}
        onSelectLocationDetails={handleDirectMapLocationSelect}
        initialAddress={customer?.address || ''}
      />
    </>
  );
};

export default CustomerDetailPage;
