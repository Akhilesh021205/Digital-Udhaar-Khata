import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import Logo from '../components/Common/Logo';
import { HiOutlineEye, HiOutlineEyeOff, HiCheck } from 'react-icons/hi';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';

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

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const failedRules = passwordRules.filter(rule => !rule.test(form.password));
    if (failedRules.length > 0) {
      setError('Password must contain at least 8 characters, 1 capital letter, 1 small letter, 1 number, and 1 special character.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await API.post(`/auth/reset-password/${token}`, { password: form.password });
      setSuccess(response.data.message || 'Password has been reset successfully!');
      toast.success('Password reset successful!');
      
      // Clear session/logout so they can log in properly with the new password
      logout();

      // Redirect to login page after 2.5 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center udhaar-page-bg p-5 relative overflow-hidden">
      <div className="w-full max-w-md p-8 sm:p-10 bg-pure-white border border-soft-gray rounded-3xl shadow-xl relative z-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center p-3 shadow-md">
            <Logo />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1 font-jakarta">Reset Password</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Choose a strong new password for your account</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-4 text-[#DC2626] text-sm text-center font-semibold animate-pulse shadow-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 text-emerald-700 text-sm text-center font-bold">
            {success} <br/>
            <span className="text-xs text-slate-500 font-medium">Redirecting to login page...</span>
          </div>
        )}
        
        <form className="space-y-4 text-left" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all pr-12"
                type={showPassword ? 'text' : 'password'} 
                placeholder="Min 8 characters (e.g. Abc@1234)" 
                required
                disabled={loading || !!success}
                value={form.password} 
                onChange={(e) => setForm({...form, password: e.target.value})} 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 cursor-pointer p-1 flex items-center justify-center hover:text-slate-700 transition-colors"
                disabled={loading || !!success}
              >
                {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
              </button>
            </div>

            {/* Password Requirements Checklist */}
            <div className="p-3 mt-2 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-slate-600 uppercase tracking-wider">Requirements:</span>
                <span className={
                  form.password.length === 0 ? 'text-slate-400 font-semibold' :
                  passwordRules.filter(r => r.test(form.password)).length <= 2 ? 'text-red-600 font-bold' :
                  passwordRules.filter(r => r.test(form.password)).length <= 4 ? 'text-amber-600 font-bold' :
                  'text-emerald-600 font-extrabold'
                }>
                  {form.password.length === 0 ? 'Not Started' :
                   passwordRules.filter(r => r.test(form.password)).length <= 2 ? 'Weak' :
                   passwordRules.filter(r => r.test(form.password)).length <= 4 ? 'Medium' :
                   'Strong ✓'}
                </span>
              </div>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all pr-12"
                type={showConfirmPassword ? 'text' : 'password'} 
                placeholder="Re-enter password" 
                required
                disabled={loading || !!success}
                value={form.confirmPassword} 
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})} 
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 cursor-pointer p-1 flex items-center justify-center hover:text-slate-700 transition-colors"
                disabled={loading || !!success}
              >
                {showConfirmPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
              </button>
            </div>
          </div>

          <button 
            className="w-full py-3.5 px-6 font-extrabold text-sm rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3 font-jakarta tracking-wide"
            type="submit" 
            disabled={loading || !!success}
          >
            {loading ? 'Resetting password...' : 'Reset Password'}
          </button>
        </form>
        <div className="text-center mt-5 text-xs sm:text-sm text-slate-500 font-medium">
          Back to <Link to="/login" className="text-[#DC2626] font-extrabold hover:underline ml-1">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
