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

// High-fidelity Logo Assets
const PhonePeLogo = () => (
  <img 
    src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" 
    alt="PhonePe" 
    className="h-5 md:h-6 object-contain" 
    loading="lazy"
  />
);

const GPayLogo = () => (
  <img 
    src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" 
    alt="Google Pay" 
    className="h-5 md:h-6 object-contain" 
    loading="lazy"
  />
);

const PaytmLogo = () => (
  <img 
    src="https://img.icons8.com/color/100/paytm.png" 
    alt="Paytm" 
    className="h-4 md:h-5 object-contain" 
    loading="lazy"
  />
);

const BhimUpiLogo = () => (
  <img 
    src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" 
    alt="UPI" 
    className="h-5 md:h-6 object-contain" 
    loading="lazy"
  />
);

const VisaLogo = () => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/320px-Visa_Inc._logo.svg.png"
    alt="Visa"
    className="h-5 object-contain"
    loading="lazy"
  />
);

const MastercardLogo = () => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png"
    alt="Mastercard"
    className="h-6 object-contain"
    loading="lazy"
  />
);

const RupayLogo = () => (
  <svg className="w-10 h-6 shrink-0" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="20" rx="3" fill="#0A3E8A" />
    <text x="2" y="13" fill="#FF8F00" fontFamily="sans-serif" fontWeight="900" fontStyle="italic" fontSize="8">Ru</text>
    <text x="12" y="13" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontStyle="italic" fontSize="8">Pay</text>
  </svg>
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

  // Active Tab Menu for Fallback Options
  const [activeTab, setActiveTab] = useState('razorpay'); // 'razorpay' | 'upi' | 'card'

  // Form States
  const [utr, setUtr] = useState('');
  const [cashfreePaymentId, setCashfreePaymentId] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');

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
            // AUTOMATIC CHECKOUT LAUNCH: When customer clicks Pay Now from email,
            // open Razorpay Checkout automatically as soon as page and order are ready.
            autoLaunchAttemptedRef.current = true;
            setTimeout(() => {
              launchRazorpayCheckout(fetchedData.balance, true);
            }, 600);
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
            <h2 className="text-2xl font-black text-slate-850 tracking-tight">Payment Link Unavailable</h2>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              {error}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-1">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Security Notice:</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Payment reminder links are cryptographically secured and expire automatically to safeguard your account. Please ask the shopkeeper to send you a fresh payment reminder email.
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
                <h1 className="text-2xl font-black text-slate-850 tracking-tight">{storeName}</h1>
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
                className="flex-1 py-3 px-4 bg-slate-850 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md text-decoration-none"
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-700 antialiased" style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Top Navbar Header */}
      <div className="w-full bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 shrink-0 shadow-sm print:hidden">
        <Link 
          to="/"
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-all py-1 no-underline"
        >
          <FaArrowLeft /> AI Digital Khata
        </Link>

        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight">{storeName}</h1>
          <p className="text-slate-400 text-[10px] font-bold tracking-wide uppercase mt-0.5">
            Automatic Secure Checkout
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full font-bold text-xs border border-emerald-100 shadow-sm">
          <FaShieldAlt className="text-emerald-500" size={12} />
          <span>Razorpay Test Mode</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-6 items-stretch print:hidden">
        {/* Left Column: Account Details & Amount Selection */}
        <div className="w-full md:w-1/2 bg-white rounded-3xl shadow-lg border border-slate-100 p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-[#F97316] uppercase block">AI Digital Khata &bull; Ledger Payment</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Settle Your Outstanding Udhaar</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Clear your dues securely via Razorpay. Your ledger balance updates immediately upon verified payment.
              </p>
            </div>

            {/* Total Balance Card */}
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 p-6 text-center shadow-xl relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-[#F97316]/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Total Outstanding Dues</p>
              <p className="text-4xl md:text-5xl font-light text-white tracking-tight">₹{outstandingBalance.toFixed(2)}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Payment Due
                </span>
                <span className="text-slate-400 text-xs font-semibold">Store: <strong className="text-white">{storeName}</strong></span>
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 divide-y divide-slate-100">
              <div className="flex justify-between items-center py-2 text-xs">
                <span className="text-slate-400 font-semibold">Customer Name</span>
                <span className="text-slate-800 font-black">{customerName}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-xs">
                <span className="text-slate-400 font-semibold">Registered Phone</span>
                <span className="text-slate-800 font-black">{customerPhone || 'Not specified'}</span>
              </div>
              {upiId && (
                <div className="flex justify-between items-center py-2 text-xs">
                  <span className="text-slate-400 font-semibold">Merchant UPI</span>
                  <span className="text-slate-800 font-black font-mono">{upiId}</span>
                </div>
              )}
            </div>

            {/* Partial / Full Payment Amount Selector */}
            <div className="space-y-3 pt-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Select Payment Amount:
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('full');
                    setAmountPaid(outstandingBalance.toString());
                  }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    paymentMode === 'full'
                      ? 'bg-orange-50 border-[#F97316] text-[#F97316] shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Pay Full (₹{outstandingBalance.toFixed(2)})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('partial');
                    if (paymentMode !== 'partial') {
                      setAmountPaid((Math.round(outstandingBalance / 2)).toString());
                    }
                  }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    paymentMode === 'partial'
                      ? 'bg-orange-50 border-[#F97316] text-[#F97316] shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Pay Partial Amount
                </button>
              </div>

              {paymentMode === 'partial' && (
                <div className="space-y-1 animate-fadeIn">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max={outstandingBalance}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="Enter custom amount"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 text-slate-800"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Max: ₹{outstandingBalance.toFixed(2)} (cannot exceed remaining balance)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-center gap-1.5">
              <FaShieldAlt className="text-emerald-500" size={11} /> 256-Bit SSL Secured Payment via Razorpay
            </span>
          </div>
        </div>

        {/* Right Column: Checkout Action Panel */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col justify-between flex-1">
            <div className="h-2 w-full bg-gradient-to-r from-[#072654] via-[#0b3b80] to-[#F97316]" />

            <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-[#F97316] uppercase block">Instant Payment</span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Razorpay Checkout</h2>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Support for UPI (GPay, PhonePe, Paytm, BHIM), Debit/Credit Cards, Net Banking, and Wallets.
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
                    Click the prominent <strong>Pay Now</strong> button below to open Razorpay Checkout with one click.
                  </div>
                </div>
              )}

              {/* Primary Prominent Razorpay Pay Button */}
              <div className="space-y-4">
                <button
                  type="button"
                  id="razorpay-pay-now-button"
                  onClick={() => launchRazorpayCheckout(currentPayAmount, false)}
                  disabled={submitting || verifyingPayment}
                  className="w-full py-5 px-6 bg-gradient-to-r from-[#072654] via-[#0b3b80] to-[#072654] hover:from-[#0b3b80] hover:to-[#0f4ca8] active:scale-[0.98] disabled:bg-slate-300 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-blue-900/25 flex items-center justify-center gap-3 cursor-pointer border-none"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Opening Razorpay Checkout...</span>
                    </>
                  ) : (
                    <>
                      <FaLock size={15} />
                      <span>Pay ₹{currentPayAmount.toFixed(2)} with Razorpay Now &rarr;</span>
                    </>
                  )}
                </button>

                {/* Accepted Payment Brand Icons */}
                <div className="pt-2 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Accepted Payment Methods</p>
                  <div className="flex justify-center items-center gap-4 flex-wrap">
                    <PhonePeLogo />
                    <GPayLogo />
                    <PaytmLogo />
                    <BhimUpiLogo />
                    <VisaLogo />
                    <MastercardLogo />
                    <RupayLogo />
                  </div>
                </div>
              </div>

              {/* Secondary Fallback Option: Direct QR / Screenshot Upload */}
              <div className="border-t border-slate-100 pt-4">
                <details className="group" open={Boolean(screenshotPreview)}>
                  <summary className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer list-none flex items-center justify-between py-1">
                    <span className="flex items-center gap-1.5">
                      <FaQrcode className="text-[#F97316]" size={12} />
                      Alternative: Pay via Direct Store QR / Upload Screenshot
                    </span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>

                  <form onSubmit={handleConfirmPayment} className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Upload Payment Screenshot
                      </label>
                      {screenshotPreview ? (
                        <div className="relative rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3 flex items-center gap-3">
                          <img 
                            src={screenshotPreview} 
                            alt="Screenshot Preview" 
                            className="w-14 h-14 object-cover rounded-xl border border-emerald-200 shadow-sm"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <span className="text-xs font-bold text-emerald-800 block truncate">✓ Screenshot Attached</span>
                            <span className="text-[10px] text-emerald-600 font-semibold block">Ready for verification</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setScreenshotPreview('')}
                            className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-[#F97316] bg-slate-50/50 hover:bg-orange-50/30 rounded-2xl p-3.5 cursor-pointer transition-all text-center">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleScreenshotChange} 
                            className="hidden" 
                          />
                          <span className="text-xs font-bold text-slate-700 block">Click to attach screenshot</span>
                          <span className="text-[10px] text-slate-400 font-semibold block">Supports PNG, JPG, WEBP</span>
                        </label>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        UPI Ref / UTR (Optional)
                      </label>
                      <input 
                        type="text"
                        maxLength={22}
                        value={utr}
                        onChange={(e) => setUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                        placeholder="12-digit UPI UTR"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:outline-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-[#F97316] hover:bg-[#ea6c10] text-white rounded-xl font-bold text-xs cursor-pointer transition-all border-none shadow-sm"
                    >
                      {submitting ? 'Submitting...' : 'Submit Screenshot'}
                    </button>
                  </form>
                </details>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2">
                <FaLock size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-emerald-700 text-[10px] leading-relaxed font-semibold">
                  Safe & encrypted checkout. Verified payments instantly reduce your udhaar ledger balance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full text-center py-4 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-400 font-semibold shrink-0 print:hidden">
        AI Digital Khata &bull; Secure Customer Payment Portal &bull; Powered by Razorpay Test Gateway
      </div>
    </div>
  );
}
