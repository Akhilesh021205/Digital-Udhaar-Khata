import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import API from '../api/axios';
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaArrowLeft, 
  FaLock, 
  FaCheck, 
  FaDownload, 
  FaPrint, 
  FaShieldAlt 
} from 'react-icons/fa';
import { toast } from 'react-toastify';

export default function PaymentCheckoutPage() {
  const { customerId, token } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  // The identifier can be in route params (:customerId / :token) or in query (?token=...)
  const paymentToken = token || queryParams.get('token') || customerId;
  const urlOrderId = queryParams.get('order_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyingStatusMsg, setVerifyingStatusMsg] = useState('Confirming payment with bank...');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [isPaid, setIsPaid] = useState(false);

  // Auto-launch Cashfree state
  const [autoLaunchStatus, setAutoLaunchStatus] = useState('idle'); // 'idle' | 'opening' | 'blocked' | 'cancelled' | 'failed'
  const autoLaunchAttemptedRef = useRef(false);

  // Amount & partial payment states
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' | 'partial'

  // Receipt details
  const [receiptNo, setReceiptNo] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentTime, setPaymentTime] = useState('');
  const [paymentId, setPaymentId] = useState('');

  // Dynamically load Cashfree JS SDK v3 if not yet loaded
  const loadCashfreeScript = () => {
    return new Promise((resolve) => {
      if (window.Cashfree) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Launch Official Cashfree Checkout Modal
  const launchCashfreeCheckout = async (targetAmount = null, isAuto = false) => {
    if (!data) return;

    const outstandingBalance = parseFloat(data.balance || 0);
    if (outstandingBalance <= 0) {
      toast.info('Your outstanding balance is already ₹0.00. No payment required.');
      return;
    }

    const payVal = targetAmount !== null 
      ? parseFloat(targetAmount) 
      : (paymentMode === 'full' ? outstandingBalance : (parseFloat(amountPaid) || outstandingBalance));

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
      const isLoaded = await loadCashfreeScript();
      if (!isLoaded || !window.Cashfree) {
        toast.error('Cashfree SDK failed to load. Please check your internet connection.');
        setSubmitting(false);
        setAutoLaunchStatus('blocked');
        return;
      }

      // 1. Create order on backend (backend validates DB balance & token)
      const response = await API.post(`/reminders/checkout/${paymentToken}/create-order`, {
        amount: payVal,
      });

      if (response.data?.success && response.data?.payment_session_id) {
        const { payment_session_id, order_id, isSandbox } = response.data;

        // 2. Initialize Cashfree instance
        const cashfree = window.Cashfree({
          mode: isSandbox ? 'sandbox' : 'production',
        });

        // 3. Open official Cashfree Checkout Modal
        cashfree.checkout({
          paymentSessionId: payment_session_id,
          redirectTarget: '_modal',
        }).then(async (result) => {
          if (result.error) {
            console.warn('Cashfree checkout modal closed/dismissed:', result.error);
            setAutoLaunchStatus('cancelled');
            setSubmitting(false);
          }

          if (result.paymentDetails) {
            // Customer finished payment session - verify against backend
            setVerifyingPayment(true);
            setVerifyingStatusMsg('Confirming payment with bank & updating ledger...');
            try {
              const verifyRes = await API.get(`/reminders/checkout/${paymentToken}/verify-payment/${order_id}`);
              if (verifyRes.data?.success && verifyRes.data?.status === 'PAID') {
                toast.success('Payment verified and Paid successfully!');
                setIsPaid(true);
                setAutoLaunchStatus('idle');

                const txData = verifyRes.data.data;
                const dateObj = txData?.date ? new Date(txData.date) : new Date();
                setPaymentId(txData?.paymentId || txData?.utr || order_id);
                setAmountPaid((txData?.amount || payVal).toString());
                setReceiptNo(`RCP-${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-4).toUpperCase()}`);
                setPaymentDate(dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
                setPaymentTime(dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));

                // Refresh customer checkout state to sync balance
                try {
                  const refreshed = await API.get(`/reminders/checkout/${paymentToken}`);
                  if (refreshed.data?.success) {
                    setData(refreshed.data.data);
                  }
                } catch {
                  // ignore
                }
              } else {
                toast.error(verifyRes.data?.message || 'Payment verification could not be confirmed.');
                setAutoLaunchStatus('failed');
              }
            } catch (vErr) {
              toast.error(vErr.response?.data?.message || 'Error verifying payment with server.');
              setAutoLaunchStatus('failed');
            } finally {
              setVerifyingPayment(false);
              setSubmitting(false);
            }
          }
        }).catch((err) => {
          console.warn('Cashfree checkout error:', err);
          setAutoLaunchStatus('blocked');
          setSubmitting(false);
        });
      } else {
        toast.error(response.data?.message || 'Failed to initialize payment order.');
        setAutoLaunchStatus('blocked');
        setSubmitting(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error connecting to payment gateway.');
      setAutoLaunchStatus('blocked');
      setSubmitting(false);
    }
  };

  // Helper to verify order if redirected back with ?order_id=...
  const verifyExistingOrder = async (orderIdToVerify) => {
    setVerifyingPayment(true);
    setVerifyingStatusMsg('Verifying completed payment details...');
    try {
      const verifyRes = await API.get(`/reminders/checkout/${paymentToken}/verify-payment/${orderIdToVerify}`);
      if (verifyRes.data?.success && verifyRes.data?.status === 'PAID') {
        toast.success('Payment verified and Paid successfully!');
        setIsPaid(true);
        const txData = verifyRes.data.data;
        const dateObj = txData?.date ? new Date(txData.date) : new Date();
        setPaymentId(txData?.paymentId || txData?.utr || orderIdToVerify);
        setAmountPaid((txData?.amount || 0).toString());
        setReceiptNo(`RCP-${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-4).toUpperCase()}`);
        setPaymentDate(dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
        setPaymentTime(dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
      }
    } catch (err) {
      console.warn('Error verifying returned order_id:', err);
    } finally {
      setVerifyingPayment(false);
    }
  };

  // Fetch store checkout info on mount
  useEffect(() => {
    if (!paymentToken) {
      setError('Invalid payment checkout link. No payment token found.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchCheckoutInfo = async () => {
      try {
        // If returning with ?order_id=..., verify first
        if (urlOrderId) {
          await verifyExistingOrder(urlOrderId);
        }

        const response = await API.get(`/reminders/checkout/${paymentToken}`);
        if (response.data?.success && isMounted) {
          const fetchedData = response.data.data;
          setData(fetchedData);
          setAmountPaid(fetchedData.balance ? fetchedData.balance.toString() : '0');

          if (fetchedData.balance <= 0) {
            setIsPaid(true);
            if (fetchedData.lastPayment) {
              setPaymentId(fetchedData.lastPayment.paymentId || fetchedData.lastPayment.utr || '');
              setAmountPaid(fetchedData.lastPayment.amount ? fetchedData.lastPayment.amount.toString() : '0');
              const dateObj = new Date(fetchedData.lastPayment.date || Date.now());
              setReceiptNo(`RCP-${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-4).toUpperCase()}`);
              setPaymentDate(dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
              setPaymentTime(dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
            }
          } else if (fetchedData.balance > 0 && !urlOrderId && !autoLaunchAttemptedRef.current) {
            // Automatic checkout opening from email payment link when browser permits
            autoLaunchAttemptedRef.current = true;
            setTimeout(() => {
              launchCashfreeCheckout(fetchedData.balance, true);
            }, 600);
          }
        } else if (isMounted) {
          setError(response.data?.message || 'Invalid or payment link.');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Failed to load checkout details. The link may have expired.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCheckoutInfo();

    return () => {
      isMounted = false;
    };
  }, [paymentToken]);

  // Loading Screen
  if (verifyingPayment || loading) {
    return (
      <div 
        className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-800 antialiased"
        style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <div className="flex flex-col items-center gap-3 text-center max-w-sm w-full bg-white p-8 rounded-3xl shadow-sm border border-slate-200/80">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-900 font-bold text-base">
            {verifyingPayment ? 'Verifying Payment...' : 'Loading Checkout...'}
          </p>
          <p className="text-slate-500 font-medium text-xs leading-relaxed">
            {verifyingPayment ? verifyingStatusMsg : 'Fetching statement and account details...'}
          </p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error) {
    return (
      <div 
        className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-800 antialiased"
        style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <div className="max-w-sm w-full bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-sm space-y-5">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-100">
            <FaTimesCircle size={32} className="text-rose-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Payment Link Unavailable</h2>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              {error}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 text-left border border-slate-100">
            Payment links expire after Paid or security timeout. Please contact the shopkeeper for a new link if needed.
          </div>
          <Link
            to="/"
            className="inline-block w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all no-underline shadow-sm"
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
  const balance = data?.balance || 0;

  // Render Clean Success / Receipt View when Paid
  if ((isPaid || balance <= 0) && data) {
    const amountVal = parseFloat(amountPaid) || data.lastPayment?.amount || 0;
    const activeReceiptNo = receiptNo || `RCP-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(paymentToken).slice(-4).toUpperCase()}`;
    const activeDate = paymentDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const activeTime = paymentTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const activePaymentId = paymentId || data.lastPayment?.paymentId || data.lastPayment?.utr || '';

    const wasAlreadyPaidOnLoad = (data.balance <= 0);
    const finalBalanceVal = wasAlreadyPaidOnLoad ? Math.max(0, balance) : Math.max(0, balance - amountVal);

    return (
      <div 
        className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between items-center py-6 sm:py-10 px-4 font-sans text-slate-800 antialiased print:bg-white print:p-0"
        style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <div className="w-full max-w-md flex items-center justify-between text-xs text-slate-500 mb-2 print:hidden">
          <Link 
            to="/"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium transition-colors no-underline"
          >
            <FaArrowLeft size={11} />
            <span>AI Digital Khata</span>
          </Link>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
            <FaCheck size={9} />
            <span>Payment Done</span>
          </span>
        </div>

        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0">
          {/* Success Banner */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <FaCheckCircle size={32} className="text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payment Verified & Paid</h1>
            <p className="text-xs text-slate-500 font-medium">Your udhaar account balance has been updated.</p>
          </div>

          {/* Amount Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 divide-y divide-slate-200/60 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2.5 first:pt-0">
              <span className="text-slate-500 font-medium">Amount Paid</span>
              <span className="text-base font-extrabold text-emerald-600">₹{amountVal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500 font-medium">Remaining Due Balance</span>
              <span className="text-xs font-bold text-slate-800">
                ₹{finalBalanceVal.toFixed(2)} {finalBalanceVal === 0 ? '(All Dues Cleared)' : ''}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500 font-medium">Receipt No.</span>
              <span className="font-mono text-slate-800 font-medium">{activeReceiptNo}</span>
            </div>
            {activePaymentId && (
              <div className="flex justify-between items-center py-2.5">
                <span className="text-slate-500 font-medium">Transaction Ref ID</span>
                <span className="font-mono text-[11px] text-slate-800 font-medium truncate max-w-[180px]">{activePaymentId}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2.5">
              <span className="text-slate-500 font-medium">Date & Time</span>
              <span className="text-slate-700 font-medium">{activeDate}, {activeTime}</span>
            </div>
          </div>

          {/* Customer & Store Info */}
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Store</span>
              <span className="font-semibold text-slate-800">{storeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Customer</span>
              <span className="font-semibold text-slate-800">{customerName}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2 print:hidden">
            <a
              href={`${API.defaults.baseURL}/reminders/checkout/${paymentToken}/receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm no-underline"
            >
              <FaDownload size={12} />
              <span>Download Official PDF Receipt</span>
            </a>
            <button
              onClick={() => window.print()}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-200 cursor-pointer"
            >
              <FaPrint size={12} />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>

        <footer className="w-full max-w-md text-center py-4 text-[11px] text-slate-400 font-medium print:hidden">
          AI Digital Khata &bull; Official Payment Receipt
        </footer>
      </div>
    );
  }

  // Active Checkout State
  const outstandingBalance = balance;
  const currentPayAmount = paymentMode === 'full' 
    ? outstandingBalance 
    : (parseFloat(amountPaid) || outstandingBalance);

  return (
    <div 
      className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between items-center py-6 sm:py-10 px-4 font-sans text-slate-800 antialiased"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* Top minimal brand / navigation */}
      <div className="w-full max-w-md flex items-center justify-between text-xs text-slate-500 mb-2">
        <Link 
          to="/"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium transition-colors no-underline"
        >
          <FaArrowLeft size={11} />
          <span>AI Digital Khata</span>
        </Link>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <FaShieldAlt size={10} className="text-emerald-600" />
          <span>Verified Merchant</span>
        </span>
      </div>

      {/* Main Clean Fintech Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Store Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-extrabold text-lg flex items-center justify-center mx-auto shadow-sm">
            {(storeName || 'S').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{storeName}</h1>
            <p className="text-xs text-slate-500 font-medium">Pay Your Dues</p>
          </div>
        </div>

        {/* Visual Focus: Outstanding Balance */}
        <div className="text-center py-4 px-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Balance
          </span>
          <div className="text-4xl sm:text-5xl font-black text-slate-800">
            ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Essential Information Only */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Customer Name</span>
            <span className="text-slate-900 font-semibold">{customerName}</span>
          </div>
        </div>

        {/* Optional Partial Payment Selection */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Payment Amount</span>
            {outstandingBalance > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (paymentMode === 'full') {
                    setPaymentMode('partial');
                    setAmountPaid((Math.round(outstandingBalance / 2)).toString());
                  } else {
                    setPaymentMode('full');
                    setAmountPaid(outstandingBalance.toString());
                  }
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer border-none bg-transparent p-0"
              >
                {paymentMode === 'full' ? 'Pay custom' : 'Pay full amount'}
              </button>
            )}
          </div>

          {paymentMode === 'partial' ? (
            <div className="space-y-2 animate-fadeIn">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={outstandingBalance}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Pay:</span>
                <div className="flex gap-1.5">
                  {[0.25, 0.5, 0.75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAmountPaid(Math.max(1, Math.round(outstandingBalance * pct)).toString())}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer border-none"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Cancelled / Dismissed Feedback */}
        {autoLaunchStatus === 'cancelled' && (
          <div className="text-center text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100 leading-relaxed">
            Checkout was closed. Click <strong>Pay Now</strong> below to proceed.
          </div>
        )}

        {/* ONE Prominent Hero Pay Now Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            id="pay-now-button"
            onClick={() => launchCashfreeCheckout(currentPayAmount, false)}
            disabled={submitting || verifyingPayment}
            className="w-full py-3.5 sm:py-4 px-6 bg-red-900 hover:bg-red-600 active:scale-[0.99] text-white rounded-2xl font-bold text-base transition-all shadow-sm shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer border-none"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Opening Cashfree...</span>
              </>
            ) : (
              <>
                <span>Pay ₹{currentPayAmount.toFixed(2)} Now</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center font-medium flex items-center justify-center gap-1">
            <span>Secured by Cashfree Payments</span>
          </p>
        </div>
      </div>

      {/* Global Minimal Footer */}
      <footer className="w-full max-w-md text-center py-4 text-[11px] text-slate-400 font-medium">
        AI Digital Khata
      </footer>
    </div>
  );
}
