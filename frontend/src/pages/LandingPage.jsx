import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  HiOutlinePhone, 
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineBell,
  HiOutlineTrendingUp,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineChatAlt2,
  HiOutlineMicrophone,
  HiOutlineLockClosed,
  HiOutlineCloudUpload,
  HiOutlineDatabase,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineArrowRight,
  HiOutlineCheck,
  HiOutlineUsers
} from 'react-icons/hi';
import Logo from '../components/Common/Logo';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ctaPhoneNumber, setCtaPhoneNumber] = useState('');
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleGetStarted = (e, phoneVal) => {
    e.preventDefault();
    if (!phoneVal) {
      toast.error('Please enter a phone number to get started.');
      return;
    }
    // Redirect to register page and prefill the phone number
    navigate(`/register?phone=${encodeURIComponent(phoneVal)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F2] to-[#F8F7F5] dark:from-[#0B0F19] dark:to-[#151D30] text-[#0F172A] dark:text-[#F8FAFC] font-sans relative overflow-hidden transition-colors duration-300">
      
      {/* Decorative Floating Background Blobs */}
      <div className="absolute w-[500px] h-[500px] bg-radial from-orange/8 to-transparent -top-[150px] -right-[150px] rounded-full blur-3xl animate-float-slow pointer-events-none -z-10"></div>
      <div className="absolute w-[400px] h-[400px] bg-radial from-info-analytics/5 to-transparent bottom-[150px] -left-[100px] rounded-full blur-3xl animate-float-medium pointer-events-none -z-10" style={{ animationDelay: '1s' }}></div>

      {/* 1. HERO SECTION & NAVBAR */}
      {/* Sticky Navbar */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-pure-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-soft-gray px-6 md:px-16 flex items-center justify-between z-40 transition-colors duration-300">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-10 h-10 rounded-xl bg-pure-white border border-soft-gray flex items-center justify-center p-1.5 shadow-sm">
            <Logo />
          </div>
          <span className="text-lg font-bold text-deep-navy font-outfit tracking-wide">Udhaar Khata</span>
        </div>
        
        {/* Navigation links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-gray">
          <a href="#features" className="hover:text-orange transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-orange transition-colors">How it Works</a>
          <a href="#reviews" className="hover:text-orange transition-colors">Reviews</a>
        </nav>

        <div className="flex items-center gap-4">
          <a href="tel:+919876543210" className="hidden md:flex items-center gap-2 px-3 py-2 bg-transparent text-slate-gray hover:text-deep-navy text-sm font-semibold transition-colors decoration-none">
            <HiOutlinePhone size={18} />
            <span>+91 98765 43210</span>
          </a>
          
          {/* Theme toggle button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 bg-pure-white border border-soft-gray hover:bg-light-cream/50 rounded-full cursor-pointer text-slate-gray hover:text-deep-navy transition-all flex items-center justify-center shadow-xs outline-none"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <HiOutlineSun className="text-amber-500 animate-pulse" size={18} />
            ) : (
              <HiOutlineMoon className="text-indigo-600" size={18} />
            )}
          </button>

          <button 
            className="px-6 py-2.5 bg-orange text-white hover:bg-orange-hover font-semibold text-sm rounded-lg transition-all shadow-sm cursor-pointer border-none active:scale-95" 
            onClick={() => navigate('/login')}
          >
            Log In
          </button>
        </div>
      </header>

      {/* Hero Section Container */}
      <section className="max-w-7xl mx-auto px-6 md:px-16 pt-32 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left column: headline & details */}
        <div className="space-y-6 text-left animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange/15 rounded-full text-orange text-xs font-extrabold uppercase tracking-wider animate-pulse-glow">
            <HiOutlineSparkles size={14} />
            <span>100% Safe & Secure Cryptographic Ledger</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-deep-navy leading-[1.1] font-outfit">
            Business hua <br />
            <span className="text-orange bg-gradient-to-r from-orange to-red-500 bg-clip-text text-transparent">easy</span>
          </h1>
          <p className="text-lg text-slate-gray leading-relaxed max-w-lg">
            Manage your daily business ledger, accept payments, verify record integrity with a private blockchain, and ask questions directly to KathaGPT AI.
          </p>
          
          {/* Phone Form */}
          <form className="flex flex-col sm:flex-row gap-3 max-w-md" onSubmit={(e) => handleGetStarted(e, phoneNumber)}>
            <div className="flex-1 flex items-center bg-pure-white border border-soft-gray rounded-lg px-3 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/20 transition-all shadow-xs">
              <span className="text-sm font-semibold text-slate-gray pr-2 border-r border-soft-gray">+91</span>
              <input 
                type="tel" 
                className="w-full bg-transparent border-none py-3.5 px-2.5 text-sm text-deep-navy placeholder-slate-gray/40 outline-none" 
                placeholder="Enter phone number" 
                maxLength="10" 
                pattern="[0-9]{10}"
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button type="submit" className="px-8 py-3.5 bg-orange hover:bg-orange-hover text-white font-semibold text-sm rounded-lg transition-all shadow-md shrink-0 cursor-pointer border-none active:scale-98">
              Get Started
            </button>
          </form>
          
          {/* Trust Badges */}
          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-semibold text-slate-gray">
            <div className="flex items-center gap-1.5 text-green-get">
              <HiOutlineShieldCheck size={18} />
              <span>Safe. Secure. Reliable.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HiOutlineCheck size={16} className="text-orange" />
              <span>No Hidden Charges</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HiOutlineCheck size={16} className="text-orange" />
              <span>Made for Kirana & Retail</span>
            </div>
          </div>
        </div>

        {/* Right column: Animated Mockups with floating success coins */}
        <div className="relative flex items-center justify-center p-4 lg:p-8 animate-fade-in-right">
          
          {/* Floating Coins */}
          <div className="absolute top-10 left-[10%] w-12 h-12 bg-amber-400 text-white rounded-full flex items-center justify-center font-extrabold text-lg shadow-lg border border-amber-300 animate-float-coin-1 z-20">
            ₹
          </div>
          <div className="absolute bottom-12 right-[5%] w-10 h-10 bg-green-get text-white rounded-full flex items-center justify-center font-extrabold text-sm shadow-lg border border-green-400 animate-float-coin-2 z-20">
            ✓
          </div>
          <div className="absolute top-[40%] right-2 w-8 h-8 bg-orange text-white rounded-full flex items-center justify-center font-extrabold text-xs shadow-lg border border-orange-400 animate-float-coin-1 z-20" style={{ animationDelay: '1.5s' }}>
            ₹
          </div>

          {/* Desktop Dashboard Mockup */}
          <div className="w-full max-w-[500px] aspect-[16/10] bg-[#0F172A] rounded-2xl border border-soft-gray/50 shadow-2xl relative overflow-hidden flex flex-col p-1.5 animate-float-slow hover:scale-[1.02] hover:rotate-1 hover:shadow-2xl transition-all duration-500 cursor-pointer">
            <div className="flex-1 bg-soft-white rounded-lg overflow-hidden flex">
              {/* Mini Sidebar */}
              <div className="w-12 bg-light-cream border-r border-soft-gray flex flex-col items-center py-3 gap-2">
                <div className="w-6 h-6 rounded bg-orange/25" />
                <div className="w-8 h-2.5 rounded bg-orange/20" />
                <div className="w-8 h-2.5 rounded bg-slate-gray/10" />
                <div className="w-8 h-2.5 rounded bg-slate-gray/10" />
                <div className="w-8 h-2.5 rounded bg-slate-gray/10" />
              </div>
              
              {/* Mini Main Content Area */}
              <div className="flex-1 flex flex-col p-3 overflow-hidden text-[9px] space-y-2 text-left">
                <div className="flex justify-between items-center mb-1 pb-1 border-b border-soft-gray">
                  <span className="font-bold text-deep-navy">Dashboard</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-get animate-pulse" /> {/* Soft pulse status dot */}
                </div>
                
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-red-give/5 border-red-give/10 text-red-give flex flex-col justify-between">
                    <span className="text-[6px] uppercase tracking-wider font-semibold">You Will Get</span>
                    <span className="text-[10px] font-extrabold text-red-give">₹4,000</span>
                  </div>
                  <div className="p-2 rounded border bg-green-get/5 border-green-get/10 text-green-get flex flex-col justify-between">
                    <span className="text-[6px] uppercase tracking-wider font-semibold">You Will Give</span>
                    <span className="text-[10px] font-extrabold text-green-get">₹0</span>
                  </div>
                </div>
                
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-1">
                  <div className="p-1 bg-pure-white border border-soft-gray rounded flex flex-col items-center">
                    <span className="text-[5px] text-slate-gray">Customers</span>
                    <span className="text-[8px] font-bold text-deep-navy">2</span>
                  </div>
                  <div className="p-1 bg-pure-white border border-soft-gray rounded flex flex-col items-center">
                    <span className="text-[5px] text-slate-gray">Today's Txns</span>
                    <span className="text-[8px] font-bold text-deep-navy">2</span>
                  </div>
                  <div className="p-1 bg-pure-white border border-soft-gray rounded flex flex-col items-center">
                    <span className="text-[5px] text-slate-gray">Pending</span>
                    <span className="text-[8px] font-bold text-deep-navy">1</span>
                  </div>
                </div>

                {/* Animated Chart Bar Growth */}
                <div className="p-2 bg-pure-white border border-soft-gray rounded flex flex-col space-y-1">
                  <span className="text-[5px] text-slate-gray font-bold">Monthly Collection Insights</span>
                  <div className="flex items-end gap-2.5 h-8 pt-1">
                    <div className="flex-1 bg-orange/20 hover:bg-orange/40 rounded-t-sm animate-grow-1" />
                    <div className="flex-1 bg-orange/25 hover:bg-orange/40 rounded-t-sm animate-grow-2" />
                    <div className="flex-1 bg-orange/20 hover:bg-orange/40 rounded-t-sm animate-grow-3" />
                    <div className="flex-1 bg-orange hover:bg-orange-hover rounded-t-sm animate-grow-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Mockup */}
          <div className="absolute -bottom-4 -left-4 w-32 aspect-[9/19] bg-[#0F172A] border-4 border-soft-gray/50 rounded-2xl shadow-xl hidden md:flex flex-col p-1 overflow-hidden z-10 animate-float-medium hover:scale-105 transition-transform cursor-pointer">
            <div className="w-8 h-2.5 bg-[#0F172A] mx-auto rounded-b-md" />
            <div className="flex-1 bg-soft-white rounded-lg flex flex-col p-1.5 overflow-hidden text-[6px] space-y-1.5 text-left">
              <div className="flex justify-between items-center pb-0.5 border-b border-soft-gray">
                <span className="font-bold text-deep-navy">Dashboard</span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-get animate-pulse" /> {/* Soft pulse status dot */}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="p-1 rounded bg-red-give/5 border border-red-give/10 text-red-give flex flex-col">
                  <span className="text-[4px] uppercase tracking-wider font-semibold">Get</span>
                  <span className="text-[7px] font-extrabold text-red-give">₹4,000</span>
                </div>
                <div className="p-1 rounded bg-green-get/5 border border-green-get/10 text-green-get flex flex-col">
                  <span className="text-[4px] uppercase tracking-wider font-semibold">Give</span>
                  <span className="text-[7px] font-extrabold text-green-get">₹0</span>
                </div>
              </div>
              
              <div className="p-1 bg-pure-white border border-soft-gray rounded-1.5 flex-1 flex flex-col">
                <span className="font-bold text-deep-navy block mb-0.5 text-[5px]">Recent Activity</span>
                <div className="flex justify-between text-[5px] py-0.5 border-b border-soft-gray/50 last:border-none">
                  <span>nanda shiva</span>
                  <span className="text-green-get font-semibold">₹50,000</span>
                </div>
                <div className="flex justify-between text-[5px] py-0.5 border-b border-soft-gray/50 last:border-none">
                  <span>Akhilesh</span>
                  <span className="text-red-give font-semibold">₹4,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. METRICS STRIP */}
      <section className="bg-pure-white dark:bg-slate-900 border-y border-soft-gray py-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-16 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div className="p-2 space-y-1">
            <span className="text-3xl md:text-4xl font-extrabold text-orange font-outfit block">10L+</span>
            <span className="text-xs text-slate-gray uppercase font-bold tracking-wider">Active Merchants</span>
          </div>
          <div className="p-2 space-y-1">
            <span className="text-3xl md:text-4xl font-extrabold text-orange font-outfit block">₹100Cr+</span>
            <span className="text-xs text-slate-gray uppercase font-bold tracking-wider">Monthly Transactions</span>
          </div>
          <div className="p-2 space-y-1">
            <span className="text-3xl md:text-4xl font-extrabold text-orange font-outfit block">99.99%</span>
            <span className="text-xs text-slate-gray uppercase font-bold tracking-wider">Network Uptime</span>
          </div>
          <div className="p-2 space-y-1">
            <span className="text-3xl md:text-4xl font-extrabold text-orange font-outfit block">100%</span>
            <span className="text-xs text-slate-gray uppercase font-bold tracking-wider">Safe & Tamper Proof</span>
          </div>
        </div>
      </section>

      {/* 3. FEATURE CARDS */}
      <section className="max-w-7xl mx-auto px-6 md:px-16 py-20" id="features">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="px-3 py-1 bg-orange/10 text-orange rounded-full text-xs font-bold uppercase tracking-wider">Powerful Features</span>
          <h2 className="text-3xl font-extrabold text-deep-navy font-outfit">Everything you need to manage business</h2>
          <p className="text-sm text-slate-gray">Streamline your daily accounts, reduce collection times, and protect records with advanced security.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-2 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-orange/10 text-orange rounded-2xl flex items-center justify-center shrink-0">
              <HiOutlineDatabase size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-deep-navy font-outfit">Blockchain Ledger Security</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Transactions are recorded in cryptographic blocks linked in a private chain. Absolutely immutable and tamper-evident auditing.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-2 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-orange/10 text-orange rounded-2xl flex items-center justify-center shrink-0">
              <HiOutlineMicrophone size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-deep-navy font-outfit">AI Voice Entries</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Add ledger records quickly by speaking. Recognition algorithms understand English, Hindi, and Telugu accents easily.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-2 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-orange/10 text-orange rounded-2xl flex items-center justify-center shrink-0">
              <HiOutlineChatAlt2 size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-deep-navy font-outfit">KathaGPT Assistant</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Interact with your ledger data conversationally to view collection metrics, calculate high-risk customers, and run analysis reports.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-2 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-orange/10 text-orange rounded-2xl flex items-center justify-center shrink-0">
              <HiOutlineBell size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-deep-navy font-outfit">Smart WhatsApp Reminders</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Send automatic reminders to customers about pending payments. Reduces pending dues by up to 3x with automated triggers.
              </p>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-2 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-orange/10 text-orange rounded-2xl flex items-center justify-center shrink-0">
              <HiOutlineLockClosed size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-deep-navy font-outfit">Biometric Face Unlock</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Secure your database and merchant UPI details from unauthorized eyes using modern local face template verification.
              </p>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-2 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-orange/10 text-orange rounded-2xl flex items-center justify-center shrink-0">
              <HiOutlineCloudUpload size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-deep-navy font-outfit">Cloud Backup & PDF Export</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Auto-sync ledger to secure cloud. Generate reports in PDF/Excel and print credit statements for any customer instantly.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. WORKFLOW / HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 md:px-16 py-20 bg-light-cream/40 dark:bg-slate-950/30 rounded-3xl border border-soft-gray" id="how-it-works">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="px-3 py-1 bg-orange/10 text-orange rounded-full text-xs font-bold uppercase tracking-wider">Workflow</span>
          <h2 className="text-3xl font-extrabold text-deep-navy font-outfit">Track balances in 3 quick steps</h2>
          <p className="text-sm text-slate-gray">Easy-to-use interface designed specifically for store owners and employees.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl relative shadow-sm text-left hover:shadow-md transition-all duration-300">
            <span className="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center font-bold text-sm absolute -top-4 left-8 shadow-md">1</span>
            <h3 className="text-lg font-bold text-deep-navy mb-2 font-outfit">Create Account</h3>
            <p className="text-xs text-slate-gray leading-relaxed">
              Sign up with your store name and mobile details. Prefill configuration in under 60 seconds.
            </p>
          </div>
          <div className="p-8 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl relative shadow-sm text-left hover:shadow-md transition-all duration-300">
            <span className="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center font-bold text-sm absolute -top-4 left-8 shadow-md">2</span>
            <h3 className="text-lg font-bold text-deep-navy mb-2 font-outfit">Add Customers</h3>
            <p className="text-xs text-slate-gray leading-relaxed">
              Enter customer mobile numbers to open a digital card. Import contacts instantly.
            </p>
          </div>
          <div className="p-8 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl relative shadow-sm text-left hover:shadow-md transition-all duration-300">
            <span className="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center font-bold text-sm absolute -top-4 left-8 shadow-md">3</span>
            <h3 className="text-lg font-bold text-deep-navy mb-2 font-outfit">Record & Automate</h3>
            <p className="text-xs text-slate-gray leading-relaxed">
              Record credit or debit transactions. Set custom payment notifications and receive funds securely.
            </p>
          </div>
        </div>
      </section>

      {/* 5. CUSTOMER REVIEWS */}
      <section className="max-w-7xl mx-auto px-6 md:px-16 py-20" id="reviews">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="px-3 py-1 bg-orange/10 text-orange rounded-full text-xs font-bold uppercase tracking-wider">Testimonials</span>
          <h2 className="text-3xl font-extrabold text-deep-navy font-outfit">Loved by Indian Merchant Community</h2>
          <p className="text-sm text-slate-gray">Here is what local retailers, wholesale vendors, and store owners have to say.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Review 1 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-1.5 hover:shadow-md transition-all duration-300">
            <div className="flex gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => <HiOutlineStar key={i} size={16} />)}
            </div>
            <p className="text-xs text-slate-gray italic leading-relaxed">
              "KathaGPT changed how I review my business. I just ask 'who owes me most this week?' and I get the answers instantly. Speeds up my collection massively!"
            </p>
            <div className="border-t border-soft-gray/50 pt-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center font-bold text-orange">
                RK
              </div>
              <div>
                <span className="text-xs font-bold text-deep-navy block font-outfit">Rajesh Kumar</span>
                <span className="text-[10px] text-slate-gray">Kirana Store Owner, Delhi</span>
              </div>
            </div>
          </div>

          {/* Review 2 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-1.5 hover:shadow-md transition-all duration-300">
            <div className="flex gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => <HiOutlineStar key={i} size={16} />)}
            </div>
            <p className="text-xs text-slate-gray italic leading-relaxed">
              "The voice entry feature is a lifesaver. When customers are waiting at the counter, I just speak their entry into the phone and it records instantly. No typing!"
            </p>
            <div className="border-t border-soft-gray/50 pt-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center font-bold text-orange">
                AS
              </div>
              <div>
                <span className="text-xs font-bold text-deep-navy block font-outfit">Amit Sharma</span>
                <span className="text-[10px] text-slate-gray">Electrical Wholesaler, Jaipur</span>
              </div>
            </div>
          </div>

          {/* Review 3 */}
          <div className="p-6 bg-pure-white dark:bg-slate-900 border border-soft-gray rounded-2xl text-left space-y-4 hover:-translate-y-1.5 hover:shadow-md transition-all duration-300">
            <div className="flex gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => <HiOutlineStar key={i} size={16} />)}
            </div>
            <p className="text-xs text-slate-gray italic leading-relaxed">
              "I feel completely safe using Udhaar Khata because it uses a private blockchain to lock transaction data. No risk of accidental edits or malicious updates."
            </p>
            <div className="border-t border-soft-gray/50 pt-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center font-bold text-orange">
                PM
              </div>
              <div>
                <span className="text-xs font-bold text-deep-navy block font-outfit">Pooja Mehta</span>
                <span className="text-[10px] text-slate-gray">Apparel Boutique, Mumbai</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA BANNER */}
      <section className="max-w-6xl mx-auto px-6 md:px-16 py-16 mb-20 bg-gradient-to-tr from-[#E22D34] to-[#C52329] text-white rounded-3xl shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute w-[300px] h-[300px] bg-white/10 rounded-full blur-3xl -top-[100px] -right-[100px] pointer-events-none" />
        
        <h2 className="text-3xl md:text-4xl font-extrabold font-outfit max-w-xl mx-auto leading-tight text-white" style={{ color: '#ffffff' }}>
          Ready to Digitise your Store's Udhaar Book?
        </h2>
        <p className="text-sm text-white/80 max-w-md mx-auto leading-relaxed">
          Join over 1,000,000+ smart merchants who trust Udhaar Khata to handle their accounts securely.
        </p>

        <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative z-10" onSubmit={(e) => handleGetStarted(e, ctaPhoneNumber)}>
          <div className="flex-1 flex items-center bg-white border border-transparent rounded-lg px-3 focus-within:ring-2 focus-within:ring-white/50 transition-all shadow-xs">
            <span className="text-sm font-semibold text-slate-gray pr-2 border-r border-soft-gray">+91</span>
            <input 
              type="tel" 
              className="w-full bg-transparent border-none py-3.5 px-2.5 text-sm text-[#0F172A] placeholder-slate-gray/40 outline-none" 
              placeholder="Enter phone number" 
              maxLength="10" 
              pattern="[0-9]{10}"
              value={ctaPhoneNumber} 
              onChange={(e) => setCtaPhoneNumber(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button type="submit" className="px-8 py-3.5 bg-deep-navy hover:bg-[#1E293B] text-white font-semibold text-sm rounded-lg transition-all shadow-md shrink-0 cursor-pointer border-none active:scale-98">
            Get Started
          </button>
        </form>
      </section>

      {/* 7. FOOTER */}
      <footer className="bg-pure-white dark:bg-slate-900 border-t border-soft-gray py-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-16 grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pure-white border border-soft-gray flex items-center justify-center p-1.5 shadow-sm">
                <Logo />
              </div>
              <span className="text-sm font-bold text-deep-navy font-outfit tracking-wide">Udhaar Khata</span>
            </div>
            <p className="text-xs text-slate-gray leading-relaxed max-w-[200px]">
              Next-generation digital ledger system for small business and retail merchants across India.
            </p>
          </div>
          
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-deep-navy font-outfit">Product</h5>
            <ul className="text-xs text-slate-gray space-y-2 list-none p-0 m-0">
              <li><a href="#features" className="hover:text-orange transition-colors">Features</a></li>
              <li><a href="#interactive-demo" className="hover:text-orange transition-colors">Integrations</a></li>
              <li><a href="#how-it-works" className="hover:text-orange transition-colors">Security Audit</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-deep-navy font-outfit">Company</h5>
            <ul className="text-xs text-slate-gray space-y-2 list-none p-0 m-0">
              <li><span className="hover:text-orange transition-colors cursor-pointer">About Us</span></li>
              <li><span className="hover:text-orange transition-colors cursor-pointer">Contact Support</span></li>
              <li><span className="hover:text-orange transition-colors cursor-pointer">Terms & Conditions</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-deep-navy font-outfit">Security</h5>
            <div className="flex items-center gap-2 text-xs font-semibold text-green-get">
              <HiOutlineShieldCheck size={18} />
              <span>100% Cryptographic Blockchain Secure</span>
            </div>
            <p className="text-[10px] text-slate-gray leading-relaxed">
              All financial logs are hashed and validated with distributed chains.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-16 pt-8 mt-8 border-t border-soft-gray flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-gray font-semibold">
          <span>&copy; {new Date().getFullYear()} Udhaar Khata Inc. All rights reserved.</span>
          <div className="flex gap-6">
            <span className="hover:text-orange transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-orange transition-colors cursor-pointer">Security Ledger Audit</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
