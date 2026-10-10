import { useState, useEffect } from 'react';
import API from '../api/axios';
import Header from '../components/Layout/Header';
import { useSocketSync } from '../hooks/useSocketSync';
import Loader from '../components/Common/Loader';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'react-toastify';
import { 
  HiOutlineSearch, 
  HiOutlineClock, 
  HiOutlinePlusCircle, 
  HiOutlinePencilAlt, 
  HiOutlineTrash, 
  HiOutlineClipboardCopy,
  HiOutlineChevronRight,
  HiOutlinePhotograph,
  HiOutlineEye,
  HiOutlineX,
  HiOutlinePhone
} from 'react-icons/hi';

const PermanentHistoryPage = () => {
  const { t } = useLanguage();
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'CREATE', 'UPDATE', 'DELETE'

  const fetchHistory = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await API.get('/history', { params });
      setHistoryLogs(data.data);
    } catch (err) {
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [search]);

  useSocketSync(fetchHistory, ['customers', 'transactions']);

  // Client-side filtering based on activeFilter
  const filteredLogs = historyLogs.filter(log => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'CREATE') return log.action === 'CREATE';
    if (activeFilter === 'UPDATE') return log.action === 'UPDATE';
    if (activeFilter === 'DELETE') return log.action === 'DELETE' || log.action === 'CUSTOMER_DELETED';
    return true;
  });

  // Count stats
  const totalCount = historyLogs.length;
  const createCount = historyLogs.filter(log => log.action === 'CREATE').length;
  const editCount = historyLogs.filter(log => log.action === 'UPDATE').length;
  const deleteCount = historyLogs.filter(log => log.action === 'DELETE' || log.action === 'CUSTOMER_DELETED').length;

  return (
    <>
      <Header 
        title="Transaction History" 
        subtitle="Undeletable audit record of all customers and transactions" 
      />

      {/* Audit Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-pure-white border border-soft-gray p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-xs flex items-center gap-2.5 sm:gap-4 transition-all hover:shadow-sm min-w-0">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-orange/10 flex items-center justify-center text-orange shrink-0">
            <HiOutlineClock className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-gray block truncate">Total Logs</span>
            <h4 className="text-sm sm:text-xl font-extrabold text-deep-navy m-0 mt-0.5 truncate">{totalCount}</h4>
          </div>
        </div>

        <div className="bg-pure-white border border-soft-gray p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-xs flex items-center gap-2.5 sm:gap-4 transition-all hover:shadow-sm min-w-0">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
            <HiOutlinePlusCircle className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-gray block truncate">New Records</span>
            <h4 className="text-sm sm:text-xl font-extrabold text-deep-navy m-0 mt-0.5 truncate">{createCount}</h4>
          </div>
        </div>

        <div className="bg-pure-white border border-soft-gray p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-xs flex items-center gap-2.5 sm:gap-4 transition-all hover:shadow-sm min-w-0">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-warning-pending/10 flex items-center justify-center text-warning-pending shrink-0">
            <HiOutlinePencilAlt className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-gray block truncate">Updates & Edits</span>
            <h4 className="text-sm sm:text-xl font-extrabold text-deep-navy m-0 mt-0.5 truncate">{editCount}</h4>
          </div>
        </div>

        <div className="bg-pure-white border border-soft-gray p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-xs flex items-center gap-2.5 sm:gap-4 transition-all hover:shadow-sm min-w-0">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-red-give/10 flex items-center justify-center text-red-give shrink-0">
            <HiOutlineTrash className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-gray block truncate">Deletions</span>
            <h4 className="text-sm sm:text-xl font-extrabold text-deep-navy m-0 mt-0.5 truncate">{deleteCount}</h4>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-pure-white border border-soft-gray p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xs mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray/70" size={16} />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-soft-white border border-soft-gray rounded-xl text-xs text-deep-navy focus:outline-none focus:border-orange focus:ring-4 focus:ring-orange/5 transition-all placeholder:text-slate-gray/40 font-medium"
            placeholder="Search by customer name, phone, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Action filter pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeFilter === 'ALL'
                ? 'bg-orange text-white shadow-sm'
                : 'bg-soft-white border border-soft-gray text-slate-gray hover:bg-orange/5 hover:text-orange'
            }`}
          >
            All Logs ({totalCount})
          </button>
          <button
            onClick={() => setActiveFilter('CREATE')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeFilter === 'CREATE'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-soft-white border border-soft-gray text-slate-gray hover:bg-green-500/5 hover:text-green-600'
            }`}
          >
            Creates ({createCount})
          </button>
          <button
            onClick={() => setActiveFilter('UPDATE')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeFilter === 'UPDATE'
                ? 'bg-warning-pending text-white shadow-sm'
                : 'bg-soft-white border border-soft-gray text-slate-gray hover:bg-warning-pending/5 hover:text-warning-pending'
            }`}
          >
            Edits ({editCount})
          </button>
          <button
            onClick={() => setActiveFilter('DELETE')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeFilter === 'DELETE'
                ? 'bg-red-give text-white shadow-sm'
                : 'bg-soft-white border border-soft-gray text-slate-gray hover:bg-red-give/5 hover:text-red-give'
            }`}
          >
            Deletes ({deleteCount})
          </button>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : filteredLogs.length === 0 ? (
        <div className="bg-pure-white border border-soft-gray rounded-2xl p-16 text-center shadow-sm space-y-4 max-w-xl mx-auto">
          <HiOutlineClock className="mx-auto text-slate-gray/20" size={56} />
          <h3 className="text-lg font-bold text-deep-navy">No Transaction History Found</h3>
          <p className="text-xs text-slate-gray max-w-sm mx-auto leading-relaxed">
      Every time you create, edit, or delete a ledger entry, an transaction record will appear here.
          </p>
        </div>
      ) : (
        <div className="mb-24 space-y-4">
          {/* Mobile Card Feed (md:hidden) - Distinct separated cards with date headers */}
          <div className="md:hidden space-y-3">
            {filteredLogs.map((log, index) => {
              const logDate = new Date(log.date || log.createdAt);
              const formattedDate = logDate.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Date header separator logic
              const getDayLabel = (d) => {
                const dateObj = new Date(d);
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);

                if (dateObj.toDateString() === today.toDateString()) return 'Today';
                if (dateObj.toDateString() === yesterday.toDateString()) return 'Yesterday';
                return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              };

              const currentDayLabel = getDayLabel(log.date || log.createdAt);
              const prevDayLabel = index > 0 ? getDayLabel(filteredLogs[index - 1].date || filteredLogs[index - 1].createdAt) : null;
              const isNewDay = currentDayLabel !== prevDayLabel;

              let badgeClass = 'bg-slate-gray/10 text-slate-gray';
              let actionLabel = log.action;
              let icon = <HiOutlineClock size={11} />;
              let leftBorderClass = 'border-l-4 border-l-slate-300';

              if (log.action === 'CREATE') {
                if (log.type === 'customer_created') {
                  badgeClass = 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
                  actionLabel = 'CUSTOMER CREATE';
                  leftBorderClass = 'border-l-4 border-l-blue-500';
                } else {
                  badgeClass = 'bg-green-get/10 text-green-get border border-green-get/20';
                  actionLabel = 'TRANSACTION CREATE';
                  leftBorderClass = 'border-l-4 border-l-emerald-500';
                }
                icon = <HiOutlinePlusCircle size={11} />;
              } else if (log.action === 'UPDATE') {
                badgeClass = 'bg-warning-pending/10 text-warning-pending border border-warning-pending/20';
                actionLabel = 'TRANSACTION EDIT';
                leftBorderClass = 'border-l-4 border-l-amber-500';
                icon = <HiOutlinePencilAlt size={11} />;
              } else if (log.action === 'DELETE') {
                badgeClass = 'bg-red-give/10 text-red-give border border-red-give/20';
                actionLabel = 'TRANSACTION DELETE';
                leftBorderClass = 'border-l-4 border-l-rose-500';
                icon = <HiOutlineTrash size={11} />;
              } else if (log.action === 'CUSTOMER_DELETED') {
                badgeClass = 'bg-red-give/20 text-red-give border border-red-give/30 font-bold';
                actionLabel = 'CUSTOMER DELETE';
                leftBorderClass = 'border-l-4 border-l-rose-600';
                icon = <HiOutlineTrash size={11} />;
              }

              const initials = log.customerName
                ? log.customerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : 'C';

              return (
                <div key={log._id} className="space-y-2">
                  {/* Date section separator pill */}
                  {isNewDay && (
                    <div className="flex items-center gap-3 pt-3 pb-1">
                      <div className="h-px bg-soft-gray/80 flex-1" />
                      <span className="px-3 py-0.5 rounded-full bg-slate-100 border border-soft-gray text-slate-gray text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                        {currentDayLabel}
                      </span>
                      <div className="h-px bg-soft-gray/80 flex-1" />
                    </div>
                  )}

                  {/* Discrete elevated card */}
                  <div
                    onClick={() => {
                      setSelectedLog(log);
                      setShowModal(true);
                    }}
                    className={`bg-pure-white rounded-2xl border border-soft-gray/80 ${leftBorderClass} shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-4 space-y-3 cursor-pointer active:scale-[0.99] transition-all hover:shadow-md`}
                  >
                    {/* Top: Customer & Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange/20 to-orange/10 text-orange font-bold text-xs flex items-center justify-center shrink-0 border border-orange/20">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-extrabold text-deep-navy block truncate">
                            {log.customerName}
                          </span>
                          <span className="text-xs text-slate-gray font-medium block truncate">
                            {log.customerPhone || 'No Phone'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {log.amount > 0 ? (
                          <span className={`text-base font-black block ${
                            log.action === 'DELETE' || log.action === 'CUSTOMER_DELETED' 
                              ? 'text-slate-gray line-through' 
                              : 'text-deep-navy'
                          }`}>
                            ₹{log.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md">
                            Audit Entry
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Badge & Timestamp */}
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase ${badgeClass}`}>
                        {icon}
                        {actionLabel}
                      </span>
                      <span className="text-slate-gray font-semibold text-[11px] flex items-center gap-1">
                        <HiOutlineClock size={12} className="text-slate-400" />
                        {formattedDate}
                      </span>
                    </div>

                    {/* Description Note Box */}
                    {log.description && (
                      <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 text-xs text-slate-800 font-medium leading-relaxed break-words">
                        {log.description}
                      </div>
                    )}

                    {/* Card Footer with clear demarcation */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {log.billImageUrl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImg(log.billImageUrl);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 shadow-2xs hover:bg-blue-100 cursor-pointer transition-colors"
                        >
                          <HiOutlinePhotograph size={13} className="text-blue-600" />
                          <span>View Proof Screenshot</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono font-medium text-slate-400">
                          Record ID: #{log._id ? log._id.slice(-6).toUpperCase() : 'AUDIT'}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange/10 hover:bg-orange/20 text-orange rounded-lg text-[11px] font-bold transition-colors ml-auto">
                        Details <HiOutlineChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block bg-pure-white border border-soft-gray rounded-2xl shadow-xs overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-soft-white border-b border-soft-gray">
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80">Date & Time</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80">Customer</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80">Phone</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80 text-center">Action</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80">Log Detail</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80 text-right">Amount (₹)</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-gray/80 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft-gray/30">
                {filteredLogs.map((log) => {
                  const formattedDate = new Date(log.date || log.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Set Action badges
                  let badgeClass = 'bg-slate-gray/10 text-slate-gray';
                  let actionLabel = log.action;
                  let icon = <HiOutlineClock size={12} />;

                  if (log.action === 'CREATE') {
                    badgeClass = log.type === 'customer_created' 
                      ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                      : 'bg-green-get/10 text-green-get border border-green-get/20';
                    actionLabel = log.type === 'customer_created' ? 'CUSTOMER CREATE' : 'TRANSACTION CREATE';
                    icon = <HiOutlinePlusCircle size={12} />;
                  } else if (log.action === 'UPDATE') {
                    badgeClass = 'bg-warning-pending/10 text-warning-pending border border-warning-pending/20';
                    actionLabel = 'TRANSACTION EDIT';
                    icon = <HiOutlinePencilAlt size={12} />;
                  } else if (log.action === 'DELETE') {
                    badgeClass = 'bg-red-give/10 text-red-give border border-red-give/20';
                    actionLabel = 'TRANSACTION DELETE';
                    icon = <HiOutlineTrash size={12} />;
                  } else if (log.action === 'CUSTOMER_DELETED') {
                    badgeClass = 'bg-red-give/20 text-red-give border border-red-give/30 font-bold';
                    actionLabel = 'CUSTOMER DELETE';
                    icon = <HiOutlineTrash size={12} />;
                  }

                  // Initials for avatar
                  const initials = log.customerName
                    ? log.customerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'C';

                  return (
                    <tr 
                      key={log._id} 
                      onClick={() => {
                        setSelectedLog(log);
                        setShowModal(true);
                      }}
                      className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4.5 text-xs text-slate-gray font-medium">{formattedDate}</td>
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange/20 to-orange/10 text-orange font-bold text-[10px] flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <span className="text-xs font-bold text-deep-navy group-hover:text-orange transition-colors">
                            {log.customerName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-xs text-slate-gray font-semibold">{log.customerPhone || '—'}</td>
                      <td className="px-6 py-4.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase ${badgeClass}`}>
                          {icon}
                          {actionLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-xs text-deep-navy/80 font-medium max-w-[300px]" title={log.description}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-[200px]">{log.description || '—'}</span>
                          {log.billImageUrl && (
                            <span className="inline-flex items-center gap-1 text-[9px] text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md font-bold border border-blue-200 shadow-2xs shrink-0">
                              <HiOutlinePhotograph size={12} />
                              Screenshot
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-xs font-bold text-right text-deep-navy">
                        {log.amount > 0 ? (
                          <span className={log.action === 'DELETE' || log.action === 'CUSTOMER_DELETED' ? 'text-slate-gray line-through' : ''}>
                            ₹{log.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4.5 text-center shrink-0 w-10">
                        <HiOutlineChevronRight className="text-slate-gray/30 group-hover:text-orange transition-colors group-hover:translate-x-0.5 transition-transform" size={16} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Premium Detail Modal with Glassmorphism / Transitions */}
      {showModal && selectedLog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-deep-navy/40 backdrop-blur-md"
            onClick={() => {
              setShowModal(false);
              setSelectedLog(null);
            }}
          />
          
          {/* Modal Container */}
          <div className="relative bg-pure-white border border-soft-gray rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-250">
            {/* Modal Header */}
            <div className="bg-[#0f172a] text-white p-5 flex justify-between items-center border-b border-soft-gray/10">
              <div>
                <h3 className="text-md font-bold tracking-tight m-0 text-white">Audit Record Details</h3>
                <p className="text-[9px] text-slate-gray/80 font-bold m-0 mt-0.5 uppercase tracking-wider">Undeletable Ledger History</p>
              </div>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setSelectedLog(null);
                }} 
                className="bg-transparent border-none text-white/80 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-pure-white/10 transition-colors flex items-center justify-center"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-[#f8fafc] border border-soft-gray/60 rounded-2xl p-5 divide-y divide-soft-gray/40 space-y-4">
                {/* Customer Details */}
                <div className="flex justify-between items-center pb-4">
                  <div>
                    <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Customer</span>
                    <span className="text-sm font-extrabold text-deep-navy block mt-0.5">{selectedLog.customerName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Phone</span>
                    <span className="text-xs font-semibold text-deep-navy block mt-0.5">{selectedLog.customerPhone || '—'}</span>
                  </div>
                </div>

                {/* Audit Action & Record Type */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Audit Action</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase mt-1 ${
                      selectedLog.action === 'CREATE' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                      selectedLog.action === 'UPDATE' ? 'bg-orange/10 text-orange border border-orange/20' :
                      'bg-red-500/10 text-red-600 border border-red-500/20'
                    }`}>
                      {selectedLog.action === 'CREATE' ? (selectedLog.type === 'customer_created' ? 'CUSTOMER CREATE' : 'TRANSACTION CREATE') :
                       selectedLog.action === 'UPDATE' ? 'TRANSACTION EDIT' :
                       selectedLog.action === 'DELETE' ? 'TRANSACTION DELETE' :
                       selectedLog.action === 'CUSTOMER_DELETED' ? 'CUSTOMER DELETE' : selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Record Type</span>
                    <span className="text-xs font-bold text-deep-navy block mt-1.5 uppercase">
                      {selectedLog.type === 'customer_created' ? 'New Customer' :
                       selectedLog.type === 'customer_deleted' ? 'Deleted Customer' :
                       selectedLog.type}
                    </span>
                  </div>
                </div>

                {/* Transaction ID */}
                {selectedLog.transactionId && (
                  <div className="flex justify-between items-center pt-4">
                    <div>
                      <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Transaction ID</span>
                      <span className="text-[11px] font-mono text-deep-navy font-semibold block mt-0.5">{selectedLog.transactionId}</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLog.transactionId);
                        toast.success('Transaction ID copied!');
                      }}
                      className="px-2.5 py-1.5 bg-white border border-soft-gray hover:border-orange hover:text-orange text-slate-gray rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-2xs flex items-center gap-1"
                    >
                      <HiOutlineClipboardCopy size={12} />
                      Copy ID
                    </button>
                  </div>
                )}

                {/* Date & Time */}
                <div className="pt-4">
                  <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Date & Time</span>
                  <span className="text-xs font-semibold text-deep-navy block mt-0.5">
                    {new Date(selectedLog.date || selectedLog.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>

                {/* Description */}
                <div className="pt-4">
                  <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block">Log Description</span>
                  <p className="text-xs text-deep-navy font-medium leading-relaxed m-0 mt-1 whitespace-pre-line text-left">
                    {selectedLog.description || '—'}
                  </p>
                </div>

                {/* Amount */}
                {selectedLog.amount > 0 && (
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-xs font-bold text-deep-navy">Transaction Amount</span>
                    <span className="text-lg font-black text-orange">₹{selectedLog.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {/* Payment Screenshot Preview Card */}
                {selectedLog.billImageUrl && (
                  <div className="pt-4">
                    <span className="text-[9px] text-slate-gray font-extrabold uppercase tracking-wider block mb-2 flex items-center gap-1">
                      <HiOutlinePhotograph size={12} className="text-orange" />
                      Payment Screenshot / Receipt Proof
                    </span>
                    <div className="relative group overflow-hidden rounded-xl border border-soft-gray bg-slate-900/5 p-3 flex flex-col items-center justify-center">
                      <img
                        src={selectedLog.billImageUrl}
                        alt="Payment Screenshot Proof"
                        className="max-h-56 w-auto object-contain rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-[1.02] cursor-pointer"
                        onClick={() => setLightboxImg(selectedLog.billImageUrl)}
                      />
                      <div className="mt-3 flex items-center gap-2 w-full justify-center">
                        <button
                          type="button"
                          onClick={() => setLightboxImg(selectedLog.billImageUrl)}
                          className="px-3.5 py-1.5 bg-orange text-white text-[11px] font-bold rounded-lg hover:bg-orange/90 cursor-pointer shadow-xs flex items-center gap-1 border-none"
                        >
                          <HiOutlineEye size={14} /> View Full Screenshot
                        </button>
                        <a
                          href={selectedLog.billImageUrl}
                          download={`payment_screenshot_${selectedLog._id}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 bg-white border border-soft-gray text-slate-gray hover:text-deep-navy text-[11px] font-bold rounded-lg cursor-pointer shadow-2xs flex items-center gap-1 no-underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Compliance Text */}
              <p className="text-[9px] text-slate-gray/50 text-center m-0 leading-normal font-medium">
                This is a permanent system audit record. Under tax regulations, this record cannot be modified or deleted.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#f8fafc] border-t border-soft-gray/40 p-4 flex justify-end">
              <button 
                onClick={() => {
                  setShowModal(false);
                  setSelectedLog(null);
                }} 
                className="py-2.5 px-6 bg-deep-navy hover:bg-[#1e293b] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-950 p-2 border border-slate-800 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute top-3 right-3 z-10 bg-slate-800/90 text-white hover:bg-slate-700 p-2 rounded-full border-none cursor-pointer shadow-md transition-colors"
            >
              <HiOutlineX size={20} />
            </button>
            <img
              src={lightboxImg}
              alt="Payment Screenshot Full Preview"
              className="max-h-[82vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default PermanentHistoryPage;

