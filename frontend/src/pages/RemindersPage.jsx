import { useState, useEffect } from 'react';
import API, { getCachedData } from '../api/axios';
import Header from '../components/Layout/Header';
import Loader from '../components/Common/Loader';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'react-toastify';
import { HiOutlinePaperAirplane, HiOutlineCheckCircle, HiOutlineMail } from 'react-icons/hi';
import { FaWhatsapp, FaRegCopy, FaCheck } from 'react-icons/fa';

const RemindersPage = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState(() => {
    const cached = getCachedData('/customers?sort=balance-high') || getCachedData('/customers');
    const raw = cached?.data || [];
    return raw.filter(c => c.balance > 0);
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCachedData('/customers?sort=balance-high') || getCachedData('/customers');
    return !(cached?.data && cached.data.length > 0);
  });
  const [sending, setSending] = useState({});
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data } = await API.get('/customers?sort=balance-high');
        setCustomers(data.data.filter(c => c.balance > 0));
      } catch (err) { 
        console.error(err);
        toast.error('Failed to load customers'); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchCustomers();
  }, []);

  const sendEmailRemind = async (customer) => {
    if (!customer.email) {
      toast.warning(`Please edit ${customer.name} and add an email address first.`);
      return;
    }
    setSending(p => ({ ...p, [customer._id]: true }));
    try {
      const { data } = await API.post(`/reminders/send/${customer._id}`);
      toast.success(data.message || `Email Reminder sent to ${customer.name}!`);
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Failed to send reminder'); 
    } finally { 
      setSending(p => ({ ...p, [customer._id]: false })); 
    }
  };

  const copyPaymentLink = async (customer) => {
    setCopying(p => ({ ...p, [customer._id]: true }));
    try {
      const { data } = await API.post(`/reminders/generate-link/${customer._id}`);
      const link = data?.data?.token
        ? `${window.location.origin}/pay/${data.data.token}`
        : (data?.data?.paymentUrl || `${window.location.origin}/pay/${customer._id}`);
      await navigator.clipboard.writeText(link);
      setCopiedId(customer._id);
      setTimeout(() => setCopiedId(null), 2500);
      toast.success(`✓ Payment link copied for ${customer.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate payment link');
    } finally {
      setCopying(p => ({ ...p, [customer._id]: false }));
    }
  };

  const shareViaWhatsApp = async (customer) => {
    try {
      const phone = customer.phone?.replace(/[^0-9]/g, '');
      let link = '';
      try {
        const { data } = await API.post(`/reminders/generate-link/${customer._id}`);
        link = data?.data?.token
          ? `${window.location.origin}/pay/${data.data.token}`
          : (data?.data?.paymentUrl || `${window.location.origin}/pay/${customer._id}`);
      } catch {
        link = `${window.location.origin}/pay/${customer._id}`;
      }
      const due = Math.abs(customer.balance || 0);
      const message = `Namaste ${customer.name}, your total outstanding balance at our store is ₹${due.toLocaleString('en-IN')}.\n\nPlease click here to settle online via UPI, Cards, or NetBanking:\n${link}\n\nThank you!`;
      const formattedPhone = phone ? (phone.startsWith('91') && phone.length === 12 ? phone : `91${phone}`) : '';
      const url = formattedPhone 
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to open WhatsApp reminder');
    }
  };

  const sendBulk = async () => {
    const customersWithEmail = customers.filter(c => c.email);
    if (customersWithEmail.length === 0) {
      toast.error('No customers with registered email addresses found.');
      return;
    }
    setBulkSending(true);
    try {
      const { data } = await API.post('/reminders/send-bulk');
      toast.success(data.message || 'Bulk Email Reminders sent successfully!');
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Bulk send failed'); 
    } finally { 
      setBulkSending(false); 
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title={t('reminders')} subtitle={t('sendPaymentReminders')} />
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-36 bg-soft-gray/40 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title={t('reminders')} subtitle={t('sendPaymentReminders')} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-gray">
            {customers.length} {t('customersWithDues')} ({customers.filter(c => c.email).length} with Email)
          </span>
        </div>
        <button 
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange hover:bg-orange-hover text-white rounded-xl text-sm font-bold border-none cursor-pointer transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed" 
          onClick={sendBulk} 
          disabled={bulkSending || customers.filter(c => c.email).length === 0}
        >
          <HiOutlinePaperAirplane className="rotate-45" size={15} /> 
          {bulkSending ? t('sending') : 'Send Email to All'}
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="bg-pure-white border border-soft-gray rounded-2xl p-12 text-center shadow-sm max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-get/10 text-green-get flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-deep-navy mb-0">{t('noPendingDues')}</h3>
          <p className="text-sm text-slate-gray mt-0">{t('noPendingDuesMsg')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Reminders Feed (md:hidden) */}
          <div className="md:hidden divide-y divide-soft-gray/30 rounded-2xl border border-soft-gray bg-pure-white overflow-hidden shadow-xs">
            {customers.map((c) => (
              <div key={c._id} className="p-3.5 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-deep-navy block truncate">{c.name}</span>
                    <span className="text-xs text-slate-gray font-medium block truncate">{c.phone}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-gray font-bold uppercase block text-[10px]">Pending Due</span>
                    <span className="text-sm font-black text-red-give">₹{c.balance.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-soft-gray/30">
                  <div className="min-w-0 flex-1">
                    {c.email ? (
                      <span className="text-xs font-semibold text-deep-navy block truncate">{c.email}</span>
                    ) : (
                      <span className="text-[11px] text-slate-gray/50 italic">No Email Added</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                      title="Send WhatsApp Reminder"
                      onClick={() => shareViaWhatsApp(c)}
                    >
                      <FaWhatsapp size={13} />
                    </button>
                    <button
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
                      title="Copy Payment Link"
                      onClick={() => copyPaymentLink(c)}
                      disabled={copying[c._id]}
                    >
                      {copiedId === c._id ? <FaCheck size={12} className="text-emerald-600" /> : <FaRegCopy size={12} />}
                    </button>
                    <button 
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange hover:bg-orange-hover text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-colors shadow-2xs disabled:opacity-40" 
                      title="Send Email Reminder" 
                      onClick={() => sendEmailRemind(c)}
                      disabled={sending[c._id] || !c.email}
                    >
                      {sending[c._id] ? (
                        <span className="w-3 h-3 border-2 border-pure-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <HiOutlineMail size={13} />
                      )}
                      Email
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block bg-pure-white border border-soft-gray rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-soft-white border-b border-soft-gray">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-gray">{t('customerName')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-gray">Email Address</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-gray">{t('phone')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-gray">{t('pendingAmount')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-gray">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft-gray/30">
                {customers.map((c) => (
                  <tr key={c._id} className="border-b border-soft-gray/50 hover:bg-light-cream/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-deep-navy align-middle">{c.name}</td>
                    <td className="px-6 py-4 text-sm align-middle text-deep-navy">
                      {c.email ? (
                        <span className="font-semibold text-deep-navy">{c.email}</span>
                      ) : (
                        <span className="text-xs text-slate-gray/50 italic">No Email Added</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm align-middle text-deep-navy">{c.phone}</td>
                    <td className="px-6 py-4 text-sm align-middle font-bold text-red-give">₹{c.balance.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm align-middle">
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                          title="Send WhatsApp Reminder with Payment Link"
                          onClick={() => shareViaWhatsApp(c)}
                        >
                          <FaWhatsapp size={14} />
                          WhatsApp
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                          title="Copy Direct Payment Link"
                          onClick={() => copyPaymentLink(c)}
                          disabled={copying[c._id]}
                        >
                          {copiedId === c._id ? (
                            <>
                              <FaCheck size={12} className="text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <FaRegCopy size={12} />
                              Copy Link
                            </>
                          )}
                        </button>
                        <button 
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange hover:bg-orange-hover text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-colors shadow-sm disabled:opacity-40" 
                          title="Send Email Reminder" 
                          onClick={() => sendEmailRemind(c)}
                          disabled={sending[c._id] || !c.email}
                        >
                          {sending[c._id] ? (
                            <span className="w-3.5 h-3.5 border-2 border-pure-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <HiOutlineMail size={14} />
                          )}
                          Email
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};

export default RemindersPage;
