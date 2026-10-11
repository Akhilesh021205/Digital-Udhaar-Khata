import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import API from '../api/axios';
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaExclamationTriangle, 
  FaArrowLeft, 
  FaQrcode, 
  FaLock, 
  FaCheck, 
  FaCreditCard, 
  FaUser, 
  FaRegClock, 
  FaDownload, 
  FaWhatsapp, 
  FaPrint, 
  FaRegCopy, 
  FaPhoneAlt, 
  FaEnvelope,
  FaShieldAlt,
  FaBolt
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// High-fidelity Logo Assets with clean height & styling
const PhonePeLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <img 
      src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" 
      alt="PhonePe" 
      className="h-4 object-contain" 
      loading="lazy"
    />
  </div>
);

const GPayLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <img 
      src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" 
      alt="Google Pay" 
      className="h-4 object-contain" 
      loading="lazy"
    />
  </div>
);

const PaytmLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <img 
      src="https://img.icons8.com/color/100/paytm.png" 
      alt="Paytm" 
      className="h-4 object-contain" 
      loading="lazy"
    />
  </div>
);

const BhimUpiLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <img 
      src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" 
      alt="UPI" 
      className="h-3.5 object-contain" 
      loading="lazy"
    />
  </div>
);

const VisaLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/320px-Visa_Inc._logo.svg.png"
      alt="Visa"
      className="h-3.5 object-contain"
      loading="lazy"
    />
  </div>
);

const MastercardLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png"
      alt="Mastercard"
      className="h-4 object-contain"
      loading="lazy"
    />
  </div>
);

const RupayLogo = () => (
  <div className="h-7 px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center shadow-2xs hover:border-slate-300 transition-all">
    <svg className="h-4 w-auto" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="20" rx="3" fill="#0A3E8A" />
      <text x="2" y="13" fill="#FF8F00" fontFamily="sans-serif" fontWeight="900" fontStyle="italic" fontSize="8">Ru</text>
      <text x="12" y="13" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontStyle="italic" fontSize="8">Pay</text>
    </svg>
  </div>
);

export default function PaymentCheckoutPage() {
  const { customerId, token } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  // The identifier can be in route params (:customerId / :token) or in query (?token=...)
  const paymentToken = token || queryParams.get('token') || customerId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyingStatusMsg, setVerifyingStatusMsg] = useState('Payment completed. Confirming your payment with bank...');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(''); // 'PENDING' or 'SETTLED'
  
  // Auto-launch Razorpay state
  const [autoLaunchStatus, setAutoLaunchStatus] = useState('idle'); // 'idle' | 'opening' | 'blocked' | 'cancelled' | 'failed'
  const autoLaunchAttemptedRef = useRef(false);

  // Amount & partial payment states
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' or 'partial'

  // Receipt dates (fixed on load after payment complete)
  const [receiptNo, setReceiptNo] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentTime, setPaymentTime] = useState('');

  // Active Tab Menu for Payment Options: 'upi' (default) or 'razorpay'
  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'razorpay'

  // Form States
  const [utr, setUtr] = useState('');
  const [cashfreePaymentId, setCashfreePaymentId] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  const handleCopyUpi = () => {
    if (!data?.upiId) return;
    navigator.clipboard.writeText(data.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
    toast.success('✓ Merchant UPI ID copied to clipboard!');
  };

  // Dynamically load Razorpay SDK
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle Payment Screenshot Upload
  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size exceeds 8MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result);
      toast.success('✓ Payment screenshot attached!');
    };
    reader.readAsDataURL(file);
  };

  // Launch Razorpay Checkout Modal
  const launchRazorpayCheckout = async (targetAmount = null, isAuto = false) => {
    if (!data) return;

    const outstandingBalance = parseFloat(data.balance || 0);
    if (outstandingBalance <= 0) {
      toast.info('Your outstanding balance is already ₹0.00. No payment required.');
      return;
    }

    const payVal = targetAmount !== null 
      ? parseFloat(targetAmount) 
      : (parseFloat(amountPaid) || outstandingBalance);

    if (isNaN(payVal) || payVal <= 0) {
      toast.error('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (payVal > outstandingBalance) {
      toast.error(`Payment amount cannot exceed outstanding balance of ₹${outstandingBalance.toFixed(2)}.`);
      return;
    }

    setSubmitting(true);
    if (isAuto) setAutoLaunchStatus('opening');

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Razorpay SDK failed to load. Please check your internet connection.');
        setSubmitting(false);
        setAutoLaunchStatus('blocked');
        return;
      }

      // 1. Create order on backend (backend enforces balance and token validation)
      const response = await API.post(`/reminders/checkout/${paymentToken}/create-razorpay-order`, {
        amount: payVal,
      });

      if (response.data?.success) {
        const { order_id, amount, currency, key_id } = response.data;

        // 2. Configure Razorpay Checkout options
        const options = {
          key: key_id,
          amount: amount,
          currency: currency || 'INR',
          name: data.storeName || 'AI Digital Khata',
          description: `Udhaar Clearance - ${data.customerName || 'Customer'}`,
          image: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg',
          order_id: order_id,
          method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: true,
          },
          modal: {
            ondismiss: function () {
              console.log('Razorpay Checkout closed by user.');
              setAutoLaunchStatus('cancelled');
              setSubmitting(false);
              toast.info('Payment window closed. Click "Pay Now" whenever you are ready.');
            },
            escape: true,
            backdropclose: false,
          },
          handler: async function (res) {
            setVerifyingPayment(true);
            setVerifyingStatusMsg('Verifying Razorpay payment & updating ledger...');
            try {
              const verifyRes = await API.post(`/reminders/checkout/${paymentToken}/verify-razorpay-payment`, {
                razorpay_order_id: res.razorpay_order_id,
                razorpay_payment_id: res.razorpay_payment_id,
                razorpay_signature: res.razorpay_signature,
                amount: payVal,
              });

              if (verifyRes.data?.success) {
                toast.success('✓ Razorpay payment verified & settled successfully!');
                setIsPaid(true);
                setPaymentStatus('SETTLED');
                setAutoLaunchStatus('idle');

                const txData = verifyRes.data.data;
                if (txData) {
                  if (txData.paymentId) setCashfreePaymentId(txData.paymentId);
                  if (txData.utr) setUtr(txData.utr);
                  if (txData.amount) setAmountPaid(txData.amount.toString());

                  const dateObj = txData.date ? new Date(txData.date) : new Date();
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const code = `RCP-${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-3).toUpperCase()}`;

                  setReceiptNo(code);
                  setPaymentDate(dateStr);
                  setPaymentTime(timeStr);
                }

                // Refresh customer checkout state
                try {
                  const refreshed = await API.get(`/reminders/checkout/${paymentToken}`);
                  if (refreshed.data?.success) {
                    setData(refreshed.data.data);
                  }
                } catch {
                  // ignore
                }
              } else {
                toast.error(verifyRes.data?.message || 'Razorpay payment verification failed.');
                setAutoLaunchStatus('failed');
              }
            } catch (vErr) {
              toast.error(vErr.response?.data?.message || 'Error verifying Razorpay payment on server.');
              setAutoLaunchStatus('failed');
            } finally {
              setVerifyingPayment(false);
              setSubmitting(false);
            }
          },
          prefill: {
            name: data.customerName || '',
            contact: data.customerPhone ? data.customerPhone.replace(/\D/g, '').slice(-10) : '',
            email: data.customerEmail || '',
          },
          theme: {
            color: '#F97316',
          },
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', function (resp) {
          console.warn('Razorpay payment failed:', resp.error);
          setAutoLaunchStatus('failed');
          toast.error(`Payment Failed: ${resp.error?.description || 'Transaction cancelled'}`);
          setSubmitting(false);
        });

        // Trigger open
        try {
          rzp.open();
        } catch (openErr) {
          console.warn('Automatic popup opening was blocked by browser:', openErr);
          setAutoLaunchStatus('blocked');
          setSubmitting(false);
        }
      } else {
        toast.error(response.data?.message || 'Failed to initialize Razorpay payment order.');
        setAutoLaunchStatus('blocked');
        setSubmitting(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error starting Razorpay checkout.');
      setAutoLaunchStatus('blocked');
      setSubmitting(false);
    }
  };

  // Fetch store checkout info & automatically launch Razorpay
  useEffect(() => {
    if (!paymentToken) {
      setError('Invalid payment checkout link. No payment token found.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchCheckoutInfo = async () => {
      try {
        const orderId = queryParams.get('order_id');

        // Cashfree auto-verify flow if redirect returned with order_id
        if (orderId) {
          if (isMounted) setVerifyingPayment(true);
          console.log('Auto-verifying payment for order:', orderId);

          let verified = false;
          let attempts = 0;
          const maxAttempts = 10;

          while (isMounted && !verified && attempts < maxAttempts) {
            attempts++;
            try {
              const verifyResponse = await API.get(`/reminders/checkout/${paymentToken}/verify-payment/${orderId}`);
              if (verifyResponse.data?.success && verifyResponse.data?.status === 'PAID') {
                verified = true;
                toast.success('✓ Payment confirmed & settled successfully!');
                if (isMounted) {
                  setIsPaid(true);
                  setPaymentStatus('SETTLED');
                  
                  const txData = verifyResponse.data.data;
                  if (txData) {
                    if (txData.utr) setUtr(txData.utr);
                    if (txData.paymentId) setCashfreePaymentId(txData.paymentId);
                    if (txData.amount) setAmountPaid(txData.amount.toString());

                    const dateObj = txData.date ? new Date(txData.date) : new Date();
                    const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const code = `RCP-${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-3).toUpperCase()}`;

                    setReceiptNo(code);
                    setPaymentDate(dateStr);
                    setPaymentTime(timeStr);
                  }

                  window.history.replaceState({}, document.title, window.location.pathname);
                }
                break;
              } else if (verifyResponse.data?.status === 'FAILED' || verifyResponse.data?.status === 'CANCELLED') {
                if (isMounted) setError(`Payment failed or was cancelled by gateway (${verifyResponse.data.status}).`);
                break;
              }
            } catch (vErr) {
              console.warn(`Payment auto-verification attempt ${attempts} failed:`, vErr.message);
            }

            if (isMounted && !verified && attempts < maxAttempts) {
              setVerifyingStatusMsg(`Confirming payment with bank... (attempt ${attempts}/${maxAttempts})`);
              await new Promise((r) => setTimeout(r, 2000));
            }
          }

          if (isMounted) setVerifyingPayment(false);
        }

        // Fetch customer & store checkout info from backend
        const response = await API.get(`/reminders/checkout/${paymentToken}`);
        if (response.data?.success && isMounted) {
          const fetchedData = response.data.data;
          setData(fetchedData);
          setAmountPaid(fetchedData.balance ? fetchedData.balance.toString() : '0');

          if (fetchedData.lastPayment && !paymentStatus) {
            setPaymentStatus(fetchedData.lastPayment.status || 'SETTLED');
          }

          // If customer has already cleared balance, show settled state
          if (fetchedData.balance <= 0 && fetchedData.lastPayment && fetchedData.lastPayment.status === 'SETTLED') {
            setIsPaid(true);
            if (fetchedData.lastPayment.utr) setUtr(fetchedData.lastPayment.utr);
            if (fetchedData.lastPayment.amount) setAmountPaid(fetchedData.lastPayment.amount.toString());
            
            const dateObj = new Date(fetchedData.lastPayment.date || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const code = `RCP-${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-3).toUpperCase()}`;
            
            setReceiptNo(code);
            setPaymentDate(dateStr);
            setPaymentTime(timeStr);
          } else if (fetchedData.balance > 0 && !autoLaunchAttemptedRef.current && !orderId) {
            // Only auto-launch Razorpay modal if explicitly requested in URL (?gateway=razorpay)
            autoLaunchAttemptedRef.current = true;
            if (queryParams.get('gateway') === 'razorpay') {
              setTimeout(() => {
                launchRazorpayCheckout(fetchedData.balance, true);
              }, 600);
            }
          }
        } else if (isMounted) {
          setError(response.data?.message || 'Invalid or expired payment checkout link.');
        }
      } catch (err) {
        if (isMounted) {
          const msg = err.response?.data?.message || 'Failed to initialize payment portal. Link may be expired or invalid.';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setVerifyingPayment(false);
        }
      }
    };

    fetchCheckoutInfo();

    return () => {
      isMounted = false;
    };
  }, [paymentToken]);

  // Handle Manual UPI UTR / Screenshot Confirmation Submit
  const handleConfirmPayment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const targetUtr = (utr || '').trim();

    if (!screenshotPreview && (!targetUtr || targetUtr.toUpperCase() === 'AUTO' || targetUtr.length < 8 || targetUtr.length > 22)) {
      toast.error('Please upload a payment screenshot OR enter a valid 12-digit UPI Ref/UTR number.');
      return;
    }
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.post(`/reminders/checkout/${paymentToken}/confirm-payment`, {
        utr: targetUtr || null,
        amount: parseFloat(amountPaid),
        paymentScreenshot: screenshotPreview || null,
      });

      if (response.data?.success) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const code = `RCP-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;
        setReceiptNo(code);
        setPaymentDate(dateStr);
        setPaymentTime(timeStr);

        const status = response.data.data?.transactionStatus || 'SETTLED';
        const finalUtr = response.data.data?.lastPayment?.utr || targetUtr || 'SCREENSHOT';
        setUtr(finalUtr);
        setPaymentStatus(status);
        toast.success('✓ Payment verified & receipt generated successfully!');
        setIsPaid(true);
      } else {
        toast.error(response.data?.message || 'Verification failed. Please try again.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating payment status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Copy transaction ID to clipboard
  const copyTransactionId = () => {
    const textToCopy = cashfreePaymentId || utr;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    toast.success('Transaction ID / UTR copied to clipboard!');
  };

  if (verifyingPayment || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <div className="w-14 h-14 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-800 font-black text-lg">
            {verifyingPayment ? 'Confirming Payment...' : 'Loading Secure Checkout...'}
          </p>
          <p className="text-slate-500 font-semibold text-xs leading-relaxed">
            {verifyingPayment ? verifyingStatusMsg : 'Verifying your payment link & outstanding balance with the bank...'}
          </p>
        </div>
      </div>
    );
  }

  // Error screen for invalid or expired link
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}>
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm border border-rose-100">
            <FaTimesCircle size={44} className="text-rose-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Payment Link Unavailable</h2>
            <p className="text-slate-600 text-xs leading-relaxed font-medium">
              {error}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-1">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Security Notice:</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Payment reminder links are secured and may expire. Contact the shopkeeper for a new link if needed.
            </p>
          </div>
          <Link
            to="/"
            className="inline-block w-full py-3 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all shadow-md"
          >
            Return to AI Digital Khata
          </Link>
        </div>
      </div>
    );
  }

  const storeName = data?.storeName || 'AI Digital Khata';
  const customerName = data?.customerName || 'Valued Customer';
  const customerPhone = data?.customerPhone || '';
  const customerAddress = data?.customerAddress || 'Ghatkesar Rd';
  const ownerName = data?.ownerName || 'Merchant';
  const ownerPhone = data?.ownerPhone || '';
  const upiId = data?.upiId;
  const balance = data?.balance || 0;

  // Render Premium Receipt Page if Payment is completed or balance cleared
  if ((isPaid || balance <= 0) && data) {
    const firstLetter = customerName ? customerName.charAt(0).toUpperCase() : 'C';
    const amountVal = parseFloat(amountPaid) || data.lastPayment?.amount || 0;
    const activeReceiptNo = receiptNo || `RCP-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-3).toUpperCase()}`;
    const activeDate = paymentDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const activeTime = paymentTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const wasAlreadyPaidOnLoad = (data.balance <= 0);
    const totalUdhaarVal = data.totalUdhaar || Math.abs(balance);
    const totalJamaVal = wasAlreadyPaidOnLoad 
      ? (data.totalJama || amountVal) 
      : ((data.totalJama || 0) + amountVal);
    const finalBalanceVal = wasAlreadyPaidOnLoad ? Math.max(0, balance) : Math.max(0, balance - amountVal);

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-6 px-4 font-sans text-slate-800 antialiased print:p-0 print:bg-white" style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}>
        <div className="max-w-[800px] w-full mx-auto bg-white rounded-3xl shadow-xl border border-slate-150 overflow-hidden relative print:shadow-none print:border-none print:my-0">
          {/* Top Brand Stripe */}
          <div className="w-full h-2 bg-gradient-to-r from-[#F97316] to-[#EA580C]"></div>

          <div className="p-8 space-y-6 print:p-4">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-11 bg-[#F97316] rounded-l-md rounded-r-xs flex items-center justify-start pl-1 relative shadow-sm">
                  <div className="w-1.5 h-full bg-white opacity-25"></div>
                  <div className="absolute right-1 top-2.5 w-1.5 h-1 bg-white rounded-sm"></div>
                  <div className="absolute right-1 top-5 w-1.5 h-1 bg-white rounded-sm"></div>
                </div>
                <div className="leading-tight text-left">
                  <span className="text-[#F97316] font-black text-sm block tracking-tighter uppercase">Udhaar</span>
                  <span className="text-slate-800 font-black text-sm block tracking-tighter uppercase">Khata</span>
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{storeName}</h1>
                <p className="text-slate-400 text-[11px] font-bold tracking-wide uppercase">AI Digital Khata &bull; Official Payment Receipt</p>
                <div className="flex justify-center items-center gap-4 text-slate-500 text-[11px] font-semibold mt-1">
                  <span className="flex items-center gap-1.5"><FaUser size={11} className="text-slate-400 shrink-0" /> Owner: {ownerName}</span>
                  {ownerPhone && <span className="flex items-center gap-1.5"><FaPhoneAlt size={10} className="text-slate-400 shrink-0" /> {ownerPhone}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full font-bold text-[10px] border border-emerald-100 shadow-xs">
                <FaShieldAlt className="text-emerald-500" size={11} />
                <span>Verified by Razorpay</span>
              </div>
            </div>

            {/* Success Card banner */}
            <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-5 text-center flex flex-col items-center justify-center space-y-1">
              <FaCheckCircle size={32} className="text-[#10B981] animate-bounce" />
              <h2 className="text-[#065F46] font-black text-xl">Payment Verified & Settled!</h2>
              <p className="text-[#065F46]/80 text-xs font-semibold">Your udhaar account has been credited and updated in the permanent ledger.</p>
            </div>

            {/* Receipt info dashboard row */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-0.5 border-r border-slate-200/65 last:border-0 md:block">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Receipt No.</span>
                <span className="text-xs font-black text-slate-800 block truncate">{activeReceiptNo}</span>
              </div>
              <div className="space-y-0.5 md:border-r border-slate-200/65 last:border-0 block">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date</span>
                <span className="text-xs font-black text-slate-800 block">{activeDate}</span>
              </div>
              <div className="space-y-0.5 border-r border-slate-200/65 last:border-0 block">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Time</span>
                <span className="text-xs font-black text-slate-800 block">{activeTime}</span>
              </div>
              <div className="space-y-0.5 last:border-0 block">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                <span className="text-xs font-black text-emerald-600 block uppercase">SETTLED</span>
              </div>
            </div>

            {/* Customer detail card block */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative flex justify-between items-center gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2">
                  <FaUser className="text-[#F97316]" size={13} />
                  <h3 className="text-xs font-black uppercase tracking-wider">Customer Details</h3>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-y-1.5 text-xs">
                  <span className="text-slate-400 font-bold">Name</span>
                  <span className="text-slate-700 font-black">: {customerName}</span>
                  
                  <span className="text-slate-400 font-bold">Phone</span>
                  <span className="text-slate-700 font-black">: {customerPhone || 'Not provided'}</span>
                  
                  <span className="text-slate-400 font-bold">Address</span>
                  <span className="text-slate-700 font-black">: {customerAddress}</span>
                </div>
              </div>
              
              <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-full flex items-center justify-center font-black text-2xl text-[#F97316] shadow-sm shrink-0">
                {firstLetter}
              </div>
            </div>

            {/* Payment & Summary Card Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3 text-slate-800">
                    <FaCreditCard className="text-[#F97316]" size={13} />
                    <h3 className="text-xs font-black uppercase tracking-wider">Payment Details</h3>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Amount Paid</span>
                      <span className="text-emerald-600 font-black text-base">₹{amountVal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Gateway</span>
                      <span className="text-slate-800 font-black">Razorpay Checkout</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Payment Status</span>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-bold text-[10px] tracking-wide uppercase">
                        SETTLED &bull; VERIFIED
                      </span>
                    </div>
                  </div>
                </div>

                {(utr || cashfreePaymentId) && (
                  <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Razorpay Payment ID / UTR</span>
                      <span className="text-xs font-black text-slate-700 block tracking-wider truncate max-w-[240px]">
                        {cashfreePaymentId || utr}
                      </span>
                    </div>
                    <button 
                      onClick={copyTransactionId} 
                      className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all cursor-pointer shadow-xs border border-slate-100"
                      title="Copy Payment ID"
                    >
                      <FaRegCopy size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3 text-slate-800">
                    <FaRegClock className="text-[#F97316]" size={13} />
                    <h3 className="text-xs font-black uppercase tracking-wider">Khata Balance Summary</h3>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Total Udhaar (Credit)</span>
                      <span className="text-slate-700 font-bold">₹{totalUdhaarVal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Total Jama (Debit)</span>
                      <span className="text-slate-700 font-bold">₹{totalJamaVal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center">
                  <div className="text-left">
                    <span className="text-xs font-black text-emerald-600 block">Remaining Due Balance</span>
                    <span className="text-[9px] text-emerald-600 font-bold block">
                      {finalBalanceVal === 0 ? '(All Dues Cleared)' : '(Partial Balance Remaining)'}
                    </span>
                  </div>
                  <span className="text-xl font-black text-[#10B981]">
                    ₹{finalBalanceVal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: PDF Receipt Download & WhatsApp Share */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 print:hidden">
              <a
                href={`${API.defaults.baseURL}/reminders/checkout/${paymentToken}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md text-decoration-none"
              >
                <FaDownload size={13} /> Download PDF Receipt
              </a>
              <button
                onClick={() => window.print()}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-200 cursor-pointer"
              >
                <FaPrint size={13} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Current balance to clear
  const outstandingBalance = balance;
  const currentPayAmount = parseFloat(amountPaid) || outstandingBalance;

  return (
    <div 
      className="min-h-screen bg-slate-50/70 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] flex flex-col justify-between font-sans text-slate-800 antialiased" 
      style={{ 
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      {/* Top Executive Header Bar */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-3.5 flex justify-between items-center z-20 shrink-0 shadow-xs sticky top-0 print:hidden">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs transition-colors no-underline border border-slate-200/80"
        >
          <FaArrowLeft size={11} className="text-slate-600" />
          <span>AI Digital Khata</span>
        </Link>

        {/* Center: Store Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0 border border-slate-700">
            {(storeName || 'S').charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">{storeName}</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                <FaShieldAlt size={9} className="text-emerald-600" /> Verified Merchant
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 tracking-normal mt-0.5">
              Official Checkout Portal &bull; Direct Settlement
            </p>
          </div>
        </div>

        {/* Right: Security Trust Badges */}
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-xs shadow-2xs">
            <FaShieldAlt className="text-emerald-600" size={11} />
            <span>256-Bit SSL Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-xs shadow-2xs">
            <FaLock className="text-blue-600" size={10} />
            <span>Razorpay Verified</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-6 items-stretch print:hidden">
        {/* Left Column: Account Details & Amount Selection */}
        <div className="w-full md:w-1/2 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/90 p-6 sm:p-7 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200/80 rounded-full text-[10px] font-black tracking-wider uppercase">
                  Verified Udhaar Statement
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Real-Time Ledger Settlement
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Settle Outstanding Balance</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed font-medium">
                Review your verified account balance below. Your merchant ledger updates immediately upon payment verification.
              </p>
            </div>

            {/* Total Balance Card (Obsidian Titanium Style) */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">
                  Total Outstanding Due
                </span>
                <span className="px-2.5 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                  Payment Due
                </span>
              </div>

              <div className="my-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-orange-400">₹</span>
                <span className="text-5xl sm:text-6xl font-black tracking-tight text-white font-sans">
                  {outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span>Store:</span>
                  <strong className="text-white font-bold">{storeName}</strong>
                </span>
                <span className="font-mono text-xs text-slate-300 bg-slate-800/90 px-2.5 py-0.5 rounded border border-slate-700/80">
                  REF: #{String(paymentToken).slice(-6).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Customer & Merchant Information Sheet */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 divide-y divide-slate-200/70 space-y-2.5">
              <div className="flex justify-between items-center text-xs sm:text-sm pt-1 first:pt-0">
                <span className="text-slate-600 font-bold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <FaUser size={10} />
                  </div>
                  Customer Name
                </span>
                <span className="text-slate-900 font-black text-sm">{customerName}</span>
              </div>

              <div className="flex justify-between items-center text-xs sm:text-sm pt-2.5">
                <span className="text-slate-600 font-bold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <FaPhoneAlt size={10} />
                  </div>
                  Registered Phone
                </span>
                <span className="text-slate-900 font-bold text-xs font-mono">{customerPhone || 'Not specified'}</span>
              </div>

              {upiId && (
                <div className="flex justify-between items-center text-xs sm:text-sm pt-2.5">
                  <span className="text-slate-600 font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <FaQrcode size={10} />
                    </div>
                    Merchant UPI ID
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-900 font-bold text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200/90">
                      {upiId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer border-none"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <FaCheck size={11} className="text-emerald-600" /> : <FaRegCopy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-xs sm:text-sm pt-2.5">
                <span className="text-slate-600 font-bold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                    <FaShieldAlt size={10} />
                  </div>
                  Store Owner
                </span>
                <span className="text-slate-900 font-bold text-xs">{ownerName}</span>
              </div>
            </div>

            {/* Payment Amount Selection Segment */}
            <div className="space-y-2.5 pt-1">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Select Payment Amount
              </label>

              <div className="grid grid-cols-2 gap-2.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('full');
                    setAmountPaid(outstandingBalance.toString());
                  }}
                  className={`py-3 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border-none flex flex-col items-center justify-center gap-0.5 ${
                    paymentMode === 'full'
                      ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                      : 'text-slate-600 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  <span>Pay Full Balance</span>
                  <span className={paymentMode === 'full' ? 'text-orange-600 font-black' : 'text-slate-700 font-bold'}>
                    ₹{outstandingBalance.toFixed(2)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('partial');
                    if (paymentMode !== 'partial') {
                      setAmountPaid((Math.round(outstandingBalance / 2)).toString());
                    }
                  }}
                  className={`py-3 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border-none flex flex-col items-center justify-center gap-0.5 ${
                    paymentMode === 'partial'
                      ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                      : 'text-slate-600 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  <span>Custom / Partial</span>
                  <span className={paymentMode === 'partial' ? 'text-orange-600 font-black' : 'text-slate-700 font-bold'}>
                    {paymentMode === 'partial' ? `₹${parseFloat(amountPaid || 0).toFixed(2)}` : 'Choose Amount'}
                  </span>
                </button>
              </div>

              {paymentMode === 'partial' && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-base">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={outstandingBalance}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="Enter custom amount"
                      className="w-full pl-9 pr-4 py-3 bg-white border-2 border-orange-500/50 rounded-xl font-black text-base focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 text-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Quick:</span>
                      {[0.25, 0.5, 0.75].map((pct) => {
                        const quickVal = Math.max(1, Math.round(outstandingBalance * pct));
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setAmountPaid(quickVal.toString())}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
                          >
                            {pct * 100}% (₹{quickVal})
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs text-slate-600 font-semibold">
                      Max: ₹{outstandingBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-500 font-semibold flex items-center justify-center gap-1.5">
              <FaShieldAlt className="text-emerald-500" size={12} /> 256-Bit SSL Encrypted &bull; Direct Merchant Settlement
            </span>
          </div>
        </div>

        {/* Right Column: Checkout Action Panel with Dual Tabs (UPI & Razorpay) */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/90 overflow-hidden flex flex-col justify-between flex-1">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-blue-600 to-orange-500" />

            <div className="p-6 sm:p-7 space-y-5 flex-1 flex flex-col justify-between">
              {/* Payment Method Selector Tabs */}
              <div>
                <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upi')}
                    className={`flex-1 py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                      activeTab === 'upi'
                        ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900 bg-transparent'
                    }`}
                  >
                    <FaQrcode size={14} className={activeTab === 'upi' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>UPI / QR Code</span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md uppercase">Zero Fee</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('razorpay')}
                    className={`flex-1 py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                      activeTab === 'razorpay'
                        ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900 bg-transparent'
                    }`}
                  >
                    <FaCreditCard size={14} className={activeTab === 'razorpay' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Cards & NetBanking</span>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md uppercase">Razorpay</span>
                  </button>
                </div>

                {/* TAB 1: INSTANT UPI & QR CODE */}
                {activeTab === 'upi' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="text-left">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-black text-emerald-700 uppercase tracking-wider block">
                          Instant UPI Settlement &bull; Direct to Merchant
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Pay via Any UPI App or QR Code</h2>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed font-medium">
                        Scan the dynamic QR code with Google Pay, PhonePe, Paytm, or BHIM. Pre-filled with ₹{currentPayAmount.toFixed(2)}.
                      </p>
                    </div>

                    {/* Dynamic QR Code Card */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                      <div className="p-2 bg-white rounded-2xl border-2 border-slate-200 shadow-sm shrink-0">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                            `upi://pay?pa=${upiId || '9849228937@axl'}&pn=${encodeURIComponent(storeName)}&am=${currentPayAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Udhaar Settlement')}`
                          )}`}
                          alt="Merchant UPI QR Code"
                          className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-xl"
                        />
                      </div>

                      <div className="space-y-2 flex-1 min-w-0">
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Merchant UPI ID</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-sm font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 truncate block">
                              {upiId || '9849228937@axl'}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyUpi}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer shrink-0"
                              title="Copy UPI ID"
                            >
                              {copiedUpi ? <FaCheck size={11} className="text-emerald-600 inline mr-1" /> : <FaRegCopy size={11} className="inline mr-1" />}
                              <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Supported Apps</span>
                          <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                            <PhonePeLogo />
                            <GPayLogo />
                            <PaytmLogo />
                            <BhimUpiLogo />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 1-Tap Mobile Launch Link */}
                    <div className="space-y-2">
                      <a
                        href={`upi://pay?pa=${encodeURIComponent(upiId || '9849228937@axl')}&pn=${encodeURIComponent(storeName)}&am=${currentPayAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Udhaar Settlement')}`}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-xl transition-all no-underline cursor-pointer"
                      >
                        <FaBolt size={14} className="text-emerald-200" />
                        <span>Open in UPI App (GPay / PhonePe / Paytm) &rarr;</span>
                      </a>
                    </div>

                    {/* Submit Proof & Verify */}
                    <form onSubmit={handleConfirmPayment} className="pt-2 border-t border-slate-100 space-y-3">
                      <div className="text-left">
                        <span className="text-xs font-black text-slate-800 block">Confirm Your UPI Payment</span>
                        <p className="text-[11px] text-slate-500 font-medium">After paying in your UPI app, upload your screenshot or enter the 12-digit UTR to update your ledger balance.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Screenshot (Optional)
                          </label>
                          {screenshotPreview ? (
                            <div className="relative rounded-xl border border-emerald-300 bg-emerald-50/50 p-2 flex items-center gap-2">
                              <img src={screenshotPreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
                              <span className="text-xs font-bold text-emerald-800 truncate flex-1">Attached</span>
                              <button
                                type="button"
                                onClick={() => setScreenshotPreview('')}
                                className="text-xs text-rose-600 font-bold hover:underline cursor-pointer bg-transparent border-none p-1"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 rounded-xl p-2.5 cursor-pointer text-center text-xs font-bold text-slate-700 transition-all">
                              <input type="file" accept="image/*" onChange={handleScreenshotChange} className="hidden" />
                              <span>Attach Screenshot</span>
                            </label>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            12-Digit UPI UTR
                          </label>
                          <input
                            type="text"
                            maxLength={22}
                            value={utr}
                            onChange={(e) => setUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                            placeholder="e.g. 428192837192"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:outline-none focus:border-slate-400"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer transition-all border-none shadow-md"
                      >
                        {submitting ? 'Confirming Payment...' : 'Confirm & Settle Udhaar Ledger'}
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 2: RAZORPAY GATEWAY */}
                {activeTab === 'razorpay' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="text-left">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        <span className="text-xs font-black text-blue-700 uppercase tracking-wider block">
                          Razorpay Card & NetBanking Gateway
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Razorpay Secure Checkout</h2>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed font-medium">
                        Pay via Debit/Credit Cards (Visa, Mastercard, RuPay), Net Banking from all Indian banks, or Wallets.
                      </p>
                    </div>

                    {/* Status Banner when auto-launch was blocked or cancelled */}
                    {(autoLaunchStatus === 'blocked' || autoLaunchStatus === 'cancelled' || autoLaunchStatus === 'failed') && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <FaBolt className="text-[#F97316] shrink-0 mt-0.5" size={15} />
                        <div className="text-left text-xs text-amber-900 leading-relaxed">
                          <strong className="font-bold block">
                            {autoLaunchStatus === 'cancelled' ? 'Checkout window was closed.' : 'Automatic opening was prevented by your browser.'}
                          </strong>
                          Click the button below to open Razorpay Checkout.
                        </div>
                      </div>
                    )}

                    {/* Primary Prominent Razorpay Pay Button */}
                    <button
                      type="button"
                      id="razorpay-pay-now-button"
                      onClick={() => launchRazorpayCheckout(currentPayAmount, false)}
                      disabled={submitting || verifyingPayment}
                      className="w-full py-4.5 px-6 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 hover:from-slate-900 hover:to-slate-850 active:scale-[0.99] text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-slate-900/20 hover:shadow-2xl flex items-center justify-between gap-3 cursor-pointer border border-slate-800 group"
                    >
                      {submitting ? (
                        <div className="w-full flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span className="font-extrabold">Opening Razorpay Checkout...</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                              <FaLock size={13} />
                            </div>
                            <div className="text-left leading-tight">
                              <div className="text-[11px] font-black text-slate-300 uppercase tracking-wider">Instant 1-Click Pay</div>
                              <div className="text-base font-black text-white">Pay ₹{currentPayAmount.toFixed(2)} with Razorpay</div>
                            </div>
                          </div>
                          <span className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-1 transition-all group-hover:translate-x-0.5 shadow-sm">
                            Pay Now &rarr;
                          </span>
                        </>
                      )}
                    </button>

                    {/* Accepted Payment Brand Icons */}
                    <div className="pt-2 text-center">
                      <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2.5">
                        Accepted Gateway Methods
                      </p>
                      <div className="flex justify-center items-center gap-2 flex-wrap">
                        <VisaLogo />
                        <MastercardLogo />
                        <RupayLogo />
                        <PhonePeLogo />
                        <GPayLogo />
                        <PaytmLogo />
                        <BhimUpiLogo />
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-left text-xs text-blue-900">
                      <span className="font-bold block text-blue-950">Looking for UPI?</span>
                      <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed font-medium">
                        You can pay directly using the <strong>UPI / QR Code</strong> tab above. In Razorpay test mode, UPI is toggled in your Razorpay Dashboard under <em>Account & Settings &gt; Payment Methods</em>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Trust Banner */}
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                  <FaShieldAlt size={14} />
                </div>
                <div className="text-left text-xs">
                  <span className="font-black text-emerald-950 block text-xs sm:text-sm">Bank-Grade Protection & Instant Ledger Settlement</span>
                  <p className="text-emerald-800/90 text-xs mt-0.5 leading-relaxed font-semibold">
                    Your transaction is processed via encrypted 256-bit SSL. Once completed, your Kirana ledger balance reduces automatically with an instant digital receipt.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Global Trust Footer */}
      <footer className="w-full text-center py-4 bg-slate-100/90 border-t border-slate-200 text-xs text-slate-600 font-semibold shrink-0 print:hidden">
        AI Digital Khata &bull; Official Customer Payment Portal &bull; 256-Bit TLS Secured &bull; Powered by Razorpay Gateway
      </footer>
    </div>
  );
}
