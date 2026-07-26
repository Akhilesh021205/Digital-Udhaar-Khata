import { useState, useEffect } from 'react';
import API from '../api/axios';
import { toast } from 'react-toastify';
import { 
  HiOutlineShieldCheck, 
  HiOutlineExclamation, 
  HiOutlineRefresh, 
  HiOutlineCube, 
  HiOutlineCheckCircle, 
  HiOutlineKey,
  HiOutlineLockClosed,
  HiOutlineSearch
} from 'react-icons/hi';
import Loader from '../components/Common/Loader';

const BlockchainPage = () => {
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [chainData, setChainData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBlockchain = async () => {
    try {
      setLoading(true);
      const res = await API.get('/blockchain/chain');
      if (res.data?.success) {
        setChainData(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load private blockchain ledger.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    try {
      setAuditing(true);
      const res = await API.get('/blockchain/verify');
      if (res.data?.success) {
        setChainData(res.data.data);
        if (res.data.data.isValid) {
          toast.success('Blockchain Audit Passed: All records are 100% verified & tamper-evident!');
        } else {
          toast.error(`Audit Alert: Detected ${res.data.data.tamperedCount} tampered block(s)!`);
        }
      }
    } catch (error) {
      toast.error('Error conducting blockchain audit.');
    } finally {
      setAuditing(false);
    }
  };

  useEffect(() => {
    fetchBlockchain();
  }, []);

  const filteredBlocks = chainData?.chain?.filter((block) => {
    const term = searchTerm.toLowerCase();
    return (
      block.index.toString().includes(term) ||
      block.hash.toLowerCase().includes(term) ||
      block.previousHash.toLowerCase().includes(term) ||
      JSON.stringify(block.data).toLowerCase().includes(term)
    );
  }) || [];

  if (loading) return <Loader fullPage={false} />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-deep-navy via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-8 -translate-y-8 pointer-events-none">
          <HiOutlineShieldCheck size={260} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <HiOutlineLockClosed className="text-emerald-400" size={14} /> Private Enterprise Ledger
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Private Blockchain Audit Ledger</h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Every financial transaction recorded in Digital Udhaar Khata is cryptographically anchored using SHA-256 block hashing. Any attempt to modify amounts directly in the database will break the cryptographic chain and trigger an instant tamper alert.
            </p>
          </div>

          <button
            onClick={handleRunAudit}
            disabled={auditing}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <HiOutlineRefresh className={auditing ? 'animate-spin' : ''} size={20} />
            <span>{auditing ? 'Verifying Hashes...' : 'Run Integrity Audit'}</span>
          </button>
        </div>
      </div>

      {/* Status Overview Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-soft-gray shadow-xs flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            chainData?.isValid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
          }`}>
            {chainData?.isValid ? <HiOutlineShieldCheck size={28} /> : <HiOutlineExclamation size={28} />}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-gray">Ledger Status</div>
            <div className={`text-base font-bold ${chainData?.isValid ? 'text-emerald-600' : 'text-red-600'}`}>
              {chainData?.isValid ? 'Immutable & Verified' : 'Tamper Detected'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-soft-gray shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <HiOutlineCube size={28} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-gray">Total Mined Blocks</div>
            <div className="text-base font-bold text-deep-navy">{chainData?.totalBlocks || 0} Blocks</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-soft-gray shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <HiOutlineKey size={28} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-gray">Hash Algorithm</div>
            <div className="text-base font-bold text-deep-navy">SHA-256 Cryptographic</div>
          </div>
        </div>
      </div>

      {/* Block Explorer */}
      <div className="bg-white rounded-2xl border border-soft-gray shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-deep-navy">Block Explorer</h2>
            <p className="text-xs text-slate-gray">Sequential record of all blocks stored in your private ledger</p>
          </div>

          <div className="relative w-full sm:w-72">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-gray" size={18} />
            <input
              type="text"
              placeholder="Search by block #, hash, or data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-light-cream/40 border border-soft-gray rounded-xl text-xs text-deep-navy focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Blocks List */}
        <div className="space-y-4">
          {filteredBlocks.length === 0 ? (
            <div className="text-center py-12 text-slate-gray text-sm">
              No blocks found matching your query.
            </div>
          ) : (
            filteredBlocks.map((block) => {
              const isGenesis = block.index === 0;
              return (
                <div 
                  key={block.index}
                  className={`p-5 rounded-xl border transition-all ${
                    isGenesis 
                      ? 'bg-amber-500/5 border-amber-500/30' 
                      : 'bg-white border-soft-gray hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-soft-gray/60">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide ${
                        isGenesis ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
                      }`}>
                        BLOCK #{block.index}
                      </span>
                      {isGenesis && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px]">
                          GENESIS BLOCK
                        </span>
                      )}
                      <span className="text-xs text-slate-gray font-medium">
                        {new Date(block.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <HiOutlineCheckCircle size={16} /> Block Hash Verified
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
                    <div>
                      <span className="text-slate-gray font-semibold block mb-1">Current Block SHA-256 Hash:</span>
                      <code className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg block font-mono text-[11px] break-all select-all">
                        {block.hash}
                      </code>
                    </div>

                    <div>
                      <span className="text-slate-gray font-semibold block mb-1">Previous Block Hash:</span>
                      <code className="bg-slate-900 text-slate-300 p-2.5 rounded-lg block font-mono text-[11px] break-all select-all">
                        {block.previousHash}
                      </code>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-soft-gray/40">
                    <span className="text-slate-gray font-semibold block mb-1.5 text-xs">Block Transaction Payload Data:</span>
                    <pre className="bg-slate-100 dark:bg-slate-900 dark:text-slate-200 text-deep-navy p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(block.data, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockchainPage;
