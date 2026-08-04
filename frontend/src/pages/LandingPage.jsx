import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  HiOutlineArrowRight,
  HiOutlineBadgeCheck,
  HiOutlineBell,
  HiOutlineBookOpen,
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlineCheckCircle,
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineLockClosed,
  HiOutlineMoon,
  HiOutlinePaperAirplane,
  HiOutlinePhone,
  HiOutlinePlay,
  HiOutlineSearch,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineSun,
  HiOutlineTrendingUp,
  HiOutlineUserAdd,
} from 'react-icons/hi';
import Logo from '../components/Common/Logo';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ctaPhoneNumber, setCtaPhoneNumber] = useState('');
  const [tiltStyle, setTiltStyle] = useState({});
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleGetStarted = (e, phoneVal) => {
    e.preventDefault();
    if (!phoneVal) {
      toast.error('Please enter a phone number to get started.');
      return;
    }
    navigate(`/register?phone=${encodeURIComponent(phoneVal)}`);
  };

  useEffect(() => {
    const revealItems = document.querySelectorAll('.uk-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('uk-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 90}ms`;
      observer.observe(item);
    });

    return () => observer.disconnect();
  }, []);

  const handleTilt = (event) => {
    if (window.matchMedia('(max-width: 768px)').matches) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    setTiltStyle({
      transform: `rotateY(${x * -10 - 8}deg) rotateX(${y * 8 + 4}deg) translateY(-8px)`,
    });
  };

  const resetTilt = () => setTiltStyle({});

  const rupee = '\u20B9';

  return (
    <div className="min-h-screen overflow-hidden bg-[#fff9f5] text-[#101525] transition-colors duration-300 dark:bg-[#0f1523] dark:text-[#f8fafc]">
      <style>
        {`
          @keyframes uk-rise {
            from { opacity: 0; transform: translateY(32px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes uk-float-large {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-14px); }
          }

          @keyframes uk-float-small {
            0%, 100% { transform: translateY(0) rotate(-6deg); }
            50% { transform: translateY(12px) rotate(-4deg); }
          }

          @keyframes uk-grow {
            from { transform: scaleY(0.05); }
            to { transform: scaleY(1); }
          }

          @keyframes uk-pulse-soft {
            0%, 100% { box-shadow: 0 0 0 8px rgba(233, 43, 53, 0.10); }
            50% { box-shadow: 0 0 0 14px rgba(233, 43, 53, 0); }
          }

          @keyframes uk-drift {
            0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
            50% { transform: translate3d(12px, -16px, 0) rotate(8deg); }
          }

          @keyframes uk-slide-card {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(18px); }
          }

          @keyframes uk-morph {
            0%, 100% { border-radius: 38% 62% 58% 42%; transform: rotate(0deg); }
            50% { border-radius: 58% 42% 36% 64%; transform: rotate(8deg); }
          }

          .uk-rise { animation: uk-rise 950ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .uk-float-large { animation: uk-float-large 7s ease-in-out infinite; }
          .uk-float-small {
            animation: uk-float-small 6s ease-in-out infinite;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .uk-float-small:hover {
            animation: none !important;
            transform: translateY(-10px) rotate(-8deg) !important;
            box-shadow: 0 35px 65px rgba(16, 21, 37, 0.28) !important;
          }
          .uk-grow { animation: uk-grow 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; transform-origin: bottom; }
          .uk-pulse-soft { animation: uk-pulse-soft 2.6s ease-in-out infinite; }
          .uk-drift { animation: uk-drift 7s ease-in-out infinite; }
          .uk-slide-card { animation: uk-slide-card 7s ease-in-out infinite; }
          .uk-morph { animation: uk-morph 9s ease-in-out infinite; }
          .uk-reveal { opacity: 0; transform: translateY(22px); transition: opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1); }
          .uk-reveal.uk-visible { opacity: 1; transform: translateY(0); }

          @keyframes uk-card-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
          .uk-float-card {
            animation: uk-card-float 6s ease-in-out infinite;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .uk-float-card:nth-child(2n) {
            animation-delay: 1.5s;
            animation-duration: 6.5s;
          }
          .uk-float-card:nth-child(3n) {
            animation-delay: 3s;
            animation-duration: 5.5s;
          }
          .uk-float-card:hover {
            animation: none !important;
            transform: translateY(-10px) !important;
            box-shadow: 0 20px 40px rgba(16, 21, 37, 0.12) !important;
          }
          .uk-float-card-red:hover { box-shadow: 0 16px 36px rgba(233, 43, 53, 0.18) !important; border-color: rgba(233, 43, 53, 0.4) !important; }
          .uk-float-card-green:hover { box-shadow: 0 16px 36px rgba(3, 166, 106, 0.18) !important; border-color: rgba(3, 166, 106, 0.4) !important; }
          .uk-float-card-blue:hover { box-shadow: 0 16px 36px rgba(40, 88, 232, 0.18) !important; border-color: rgba(40, 88, 232, 0.4) !important; }

          @media (prefers-reduced-motion: reduce) {
            .uk-rise,
            .uk-float-large,
            .uk-float-small,
            .uk-grow,
            .uk-pulse-soft,
            .uk-drift,
            .uk-slide-card,
            .uk-morph {
              animation-duration: 1ms !important;
              animation-iteration-count: 1 !important;
            }
            .uk-reveal {
              opacity: 1;
              transform: none;
            }
          }
        `}
      </style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(233,43,53,0.14),transparent_24rem),radial-gradient(circle_at_18%_32%,rgba(3,166,106,0.08),transparent_20rem),linear-gradient(180deg,#fff9f5_0%,#ffffff_65%)] dark:bg-[radial-gradient(circle_at_78%_18%,rgba(233,43,53,0.18),transparent_24rem),radial-gradient(circle_at_18%_32%,rgba(3,166,106,0.12),transparent_20rem),linear-gradient(180deg,#111827_0%,#0f1523_70%)]" />

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 md:px-10 lg:px-16">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#e92b35] to-[#ff5862] p-2 text-white shadow-[0_12px_30px_rgba(233,43,53,0.26)]">
              <Logo />
            </span>
            <span className="font-outfit text-lg font-black tracking-wide text-[#101525] dark:text-white">
              Udhaar Khata
            </span>
          </button>


          <div className="flex items-center gap-3">

            <button
              onClick={toggleTheme}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-black/10 bg-white text-[#463cff] shadow-[0_8px_24px_rgba(16,21,37,0.10)] transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-900"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              {theme === 'dark' ? <HiOutlineSun className="text-amber-400" size={19} /> : <HiOutlineMoon size={19} />}
            </button>

            <button
              className="cursor-pointer rounded-xl border-0 bg-gradient-to-br from-[#e92b35] to-[#ff4f5d] px-5 py-3 text-sm font-black text-white shadow-[0_16px_34px_rgba(233,43,53,0.30)] transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
              onClick={() => navigate('/login')}
              type="button"
            >
              Log In
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[650px] max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-6 pt-28 md:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:px-16">
          <div className="uk-rise text-left">

            <h1 className="font-outfit max-w-2xl text-5xl font-black leading-[0.98] tracking-normal text-[#101525] dark:text-white md:text-7xl">
              Udhaar ka hisaab,
              <span className="block text-[#e92b35]">ab bilkul easy.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-lg font-bold leading-relaxed text-[#2b3242] dark:text-slate-100 md:text-xl">
              Track credit, collect faster, and know exactly who owes what without searching notebooks or WhatsApp chats.
            </p>

            <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-[#667085] dark:text-slate-300 md:text-base">
              Udhaar Khata gives your business a simple digital register with payment reminders, daily reports, secure backups, and a smooth desktop experience.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#03a66a]/20 bg-[#03a66a]/10 px-3.5 py-2 text-[#067a52] dark:text-emerald-300">
                <HiOutlineShieldCheck size={16} /> Safe records
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e92b35]/20 bg-[#e92b35]/10 px-3.5 py-2 text-[#bf1f28] dark:text-red-200">
                <HiOutlineBell size={16} /> Auto reminders
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#2858e8]/20 bg-[#2858e8]/10 px-3.5 py-2 text-[#2858e8] dark:text-blue-300">
                <HiOutlineCloudUpload size={16} /> Cloud backup
              </span>
            </div>
          </div>

          <div
            className="uk-rise relative min-h-[460px] [perspective:1200px]"
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
          >
            <div className="uk-morph absolute inset-x-8 bottom-6 top-12 rounded-[40%] bg-[radial-gradient(circle_at_50%_30%,rgba(233,43,53,0.16),transparent_20rem),radial-gradient(circle_at_72%_70%,rgba(40,88,232,0.11),transparent_18rem)] blur-[2px]" />

            <div className="uk-drift absolute left-8 top-9 z-20 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#ff606b] to-[#e92b35] text-lg font-black text-white shadow-[0_18px_32px_rgba(233,43,53,0.26)]">
              {rupee}
            </div>

            <div className="uk-drift absolute right-20 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#33d399] to-[#03a66a] text-sm font-black text-white shadow-lg [animation-delay:1.1s]">
              <HiOutlineCheck size={20} />
            </div>

            <div className="uk-float-large absolute right-0 top-12 w-full max-w-[655px]">
              <div
                className="overflow-hidden rounded-[24px] border-[8px] border-[#111a2f] bg-[#fbfdff] dark:bg-slate-900 shadow-[0_24px_70px_rgba(16,21,37,0.16)] transition-all duration-300 ease-out"
                style={tiltStyle}
              >
                <div className="grid min-h-[404px] grid-cols-[74px_1fr]">
                  <aside className="border-r border-[#edf0f4] bg-gradient-to-b from-white to-[#fbf7f6] px-3.5 py-5">
                    <div className="mx-auto mb-4 h-8 w-8 rounded-[10px] bg-gradient-to-br from-[#ffc7cc] to-[#ef6b74]" />
                    <div className="mx-auto mb-3 h-3 w-11 rounded-full bg-[#f5d6da]" />
                    <div className="mx-auto mb-3 h-3 w-9 rounded-full bg-[#eceff3]" />
                    <div className="mx-auto h-3 w-9 rounded-full bg-[#eceff3]" />
                  </aside>

                  <div className="p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 font-black">
                      <span>Dashboard</span>
                      <div className="hidden h-9 w-[46%] items-center gap-2 rounded-full bg-[#f1f3f7] px-3 text-xs font-bold text-[#98a2b3] sm:flex">
                        <HiOutlineSearch size={14} />
                        <span>Search customers</span>
                      </div>
                      <span className="uk-pulse-soft h-5 w-5 rounded-full bg-[#e92b35]" />
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-3">
                      <div className="uk-float-card uk-float-card-red rounded-lg border border-[#ffd6da] bg-[#fff4f5] p-3.5 text-xs font-black uppercase text-[#e92b35] cursor-pointer">
                        You will get
                        <span className="mt-2 block text-lg text-[#101525]">
                          {rupee}
                          <AnimatedCounter endValue={245000} formatter={(val) => new Intl.NumberFormat('en-IN').format(val)} />
                        </span>
                      </div>
                      <div className="uk-float-card uk-float-card-green rounded-lg border border-[#c7f1e5] bg-[#effbf7] p-3.5 text-xs font-black uppercase text-[#03a66a] cursor-pointer">
                        You will give
                        <span className="mt-2 block text-lg text-[#101525]">
                          {rupee}
                          <AnimatedCounter endValue={76500} formatter={(val) => new Intl.NumberFormat('en-IN').format(val)} />
                        </span>
                      </div>
                      <div className="uk-float-card uk-float-card-blue rounded-lg border border-[#dce5ff] bg-[#f2f5ff] p-3.5 text-xs font-black uppercase text-[#2858e8] cursor-pointer">
                        Net balance
                        <span className="mt-2 block text-lg text-[#101525]">
                          {rupee}
                          <AnimatedCounter endValue={168500} formatter={(val) => new Intl.NumberFormat('en-IN').format(val)} />
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.05fr_0.95fr]">
                      <div className="flex h-40 items-end gap-2 rounded-lg border border-[#e6e9ef] bg-gradient-to-b from-white to-[#f8fbff] px-3 pb-3 pt-5">
                        {[58, 82, 45, 72, 66, 92].map((height, index) => (
                          <span
                            key={height}
                            className={`uk-grow flex-1 rounded-t-md ${index === 1 || index === 4 ? 'bg-gradient-to-b from-[#20c997] to-[#03a66a]' : index === 2 ? 'bg-gradient-to-b from-[#5b7cfa] to-[#2858e8]' : 'bg-gradient-to-b from-[#ff5c67] to-[#e92b35]'}`}
                            style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
                          />
                        ))}
                      </div>

                      <div className="grid gap-2">
                        <DashboardRow initial="R" name="Ramesh Kumar" status="Due today" amount={`${rupee}12,500`} tone="red" />
                        <DashboardRow initial="S" name="Suresh Traders" status="Paid" amount={`+${rupee}8,000`} tone="green" />
                        <DashboardRow initial="A" name="Anil Store" status="Reminder sent" amount={`${rupee}5,600`} tone="red" />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#e6e9ef] bg-white p-3 text-xs font-black">
                        Payment reminders
                        <span className="block pt-1 text-[11px] font-bold text-[#667085]">3 customers need follow-up</span>
                      </div>
                      <div className="rounded-lg border border-[#e6e9ef] bg-white p-3 text-xs font-black">
                        Cashflow trend
                        <span className="block pt-1 text-[11px] font-bold text-[#03a66a]">+18% this month</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="uk-float-small absolute -left-1 top-48 z-20 hidden h-[355px] w-[174px] overflow-hidden rounded-[25px] border-[8px] border-[#20293b] bg-white shadow-[0_28px_55px_rgba(16,21,37,0.20)] md:block">
              <div className="m-0 h-full rounded-[17px] border-[3px] border-[#cfd6df] bg-gradient-to-b from-[#fbfdff] to-[#fff8f7] p-3">
                <div className="mb-3 flex items-center justify-between font-black text-[#101525]">
                  <span>Khata</span>
                  <span className="uk-pulse-soft h-3 w-3 rounded-full bg-[#e92b35]" />
                </div>
                <MobileCard title="Receivable" value={`${rupee}2.45L`} />
                <MobileCard title="Reminder due" value={`${rupee}12,500`} tone="red" />
                <MobileCard title="Paid today" value={`+${rupee}8,000`} tone="green" />
                <div className="rounded-lg border border-[#e9edf3] bg-white p-2 text-[10px] font-black text-[#101525]">
                  Recent
                  <span className="block pt-1 text-[9px] font-bold text-[#667085]">Ramesh, Suresh, Anil</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-8 right-5 z-30 flex items-center gap-2 rounded-2xl border border-[#03a66a]/20 bg-white/95 px-4 py-3 text-sm font-black text-[#03a66a] shadow-[0_18px_40px_rgba(16,21,37,0.14)] [animation:uk-rise_900ms_440ms_both,uk-pulse-soft_2.4s_ease-in-out_infinite]">
              <HiOutlineBadgeCheck size={19} />
              <span>Payment tracked</span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 md:px-10 lg:px-16 pt-12 pb-4">
          <div className="bg-gradient-to-r from-[#0F172A] to-[#E22D34] text-white rounded-3xl shadow-xl p-8 md:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute w-[200px] h-[200px] bg-white/5 rounded-full blur-2xl -top-[50px] -right-[50px] pointer-events-none" />

            {/* Left Side */}
            <div className="text-left space-y-3 flex-1 lg:max-w-xl">
              <h2 className="text-2xl md:text-3xl font-extrabold font-outfit text-white leading-tight" style={{ color: '#ffffff' }}>
                Start your digital udhaar book
              </h2>
              <p className="text-xs text-white/90 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Keep customer records, reminders, and payments in one place.
              </p>
            </div>

            {/* Right Side Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md shrink-0">
              <button
                onClick={() => navigate('/register')}
                className="cursor-pointer rounded-xl border-none bg-white hover:bg-slate-50 px-6 py-3.5 text-sm font-black text-[#101525] shadow-md transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-1.5 flex-1"
                type="button"
              >
                <span>Get Started</span>
                <HiOutlineArrowRight size={14} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="cursor-pointer rounded-xl border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/10 px-6 py-3.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-1.5 flex-1"
                type="button"
              >
                <span>Log In</span>
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 md:px-10 lg:px-16" id="features">
          <SectionHead
            kicker="Everything in one place"
            title="A clean khata system your team can actually use every day."
            text="Fast entries, clear balances, timely reminders, and practical reports make daily business simpler from morning opening to night closing."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<HiOutlineDocumentText size={25} />} title="Digital Udhaar Register" text="Add credit and debit entries in seconds with customer-wise history, dates, notes, and total balances." />
            <FeatureCard icon={<HiOutlineBell size={25} />} title="Smart Reminders" text="Send polite follow-ups through SMS or WhatsApp and reduce awkward manual calls." />
            <FeatureCard icon={<HiOutlineTrendingUp size={25} />} title="Reports & Insights" text="See who owes you, which payments are pending, and how your store cashflow is moving." />
            <FeatureCard icon={<HiOutlineShieldCheck size={25} />} title="Secure Cloud Backup" text="Keep records protected and accessible, even if your notebook, phone, or laptop is unavailable." />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 md:px-10 lg:px-16" id="how-it-works">
          <SectionHead
            kicker="Simple workflow"
            title="From customer entry to payment collection in three calm steps."
            text="The interface is designed for repeat daily use: less thinking, fewer taps, and clearer numbers."
          />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[430px] overflow-hidden rounded-lg border border-[#e9edf3] bg-[linear-gradient(90deg,rgba(233,43,53,0.06)_1px,transparent_1px),linear-gradient(rgba(233,43,53,0.06)_1px,transparent_1px),#fff] bg-[size:36px_36px] dark:border-white/10">
              <ProcessCard className="top-14" icon={<HiOutlineUserAdd size={22} />} title="Add customer" text="Phone, name, opening balance" />
              <ProcessCard className="top-[172px] [animation-delay:0.55s]" icon={<HiOutlineBookOpen size={22} />} title="Record transaction" text="Credit or payment received" />
              <ProcessCard className="top-[290px] [animation-delay:1.1s]" icon={<HiOutlineBell size={22} />} title="Send reminder" text="Collect on time" />
            </div>

            <div className="grid gap-4">
              <StepCard number="1" title="Add every customer once" text="Create a clean customer profile with phone number, balance status, and history." />
              <StepCard number="2" title="Track daily udhaar instantly" text="Record money given or received and let the dashboard update totals automatically." />
              <StepCard number="3" title="Collect with confidence" text="Use reminders and reports to follow up on pending dues at the right time." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 md:px-10 lg:px-16" id="reviews">
          <SectionHead
            kicker="Built for real shops"
            title="Less confusion at the counter. More clarity in your cashflow."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <ReviewCard initials="RK" name="Ravi Kirana" role="Retail store owner" quote="Earlier I checked three notebooks for one balance. Now the amount is clear in one screen." />
            <ReviewCard initials="MT" name="Meena Textiles" role="Wholesale business" quote="Payment reminders save time. Customers get a clear message and I can focus on sales." />
            <ReviewCard initials="AS" name="Anil Stores" role="Daily essentials shop" quote="The desktop view makes reports simple. I know pending dues before closing the shop." />
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ebe6df] bg-white py-10 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 text-sm font-bold text-[#667085] md:flex-row md:items-center md:px-10 lg:px-16">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#e92b35] to-[#ff5862] p-2 text-white">
              <Logo />
            </span>
            <span className="font-outfit text-base font-black text-[#101525] dark:text-white">Udhaar Khata</span>
          </div>
          <span>Digital ledger for modern Indian businesses.</span>
        </div>
      </footer>
    </div>
  );
};

const DashboardRow = ({ initial, name, status, amount, tone }) => (
  <div className="grid grid-cols-[30px_1fr_auto] items-center gap-2 rounded-lg border border-[#e6e9ef] bg-white p-2.5 text-[11px] font-black text-[#101525]">
    <span className={`grid h-8 w-8 place-items-center rounded-full ${tone === 'green' ? 'bg-[#03a66a]/10 text-[#03a66a]' : 'bg-[#e92b35]/10 text-[#e92b35]'}`}>
      {initial}
    </span>
    <span>
      {name}
      <span className="block text-[10px] font-bold text-[#667085]">{status}</span>
    </span>
    <strong className={tone === 'green' ? 'text-[#03a66a]' : 'text-[#e92b35]'}>{amount}</strong>
  </div>
);

const MobileCard = ({ title, value, tone = 'red' }) => (
  <div className="mb-2 rounded-lg border border-[#e9edf3] bg-white p-2 text-[10px] font-black text-[#101525]">
    {title}
    <span className={`block pt-1 text-xs ${tone === 'green' ? 'text-[#03a66a]' : 'text-[#e92b35]'}`}>
      {value}
    </span>
  </div>
);

const Metric = ({ value, text }) => (
  <div className="px-6 py-8">
    <strong className="block text-4xl font-black text-[#101525] dark:text-white">{value}</strong>
    <span className="mt-2 block text-sm font-bold leading-6 text-[#667085] dark:text-slate-300">{text}</span>
  </div>
);

const SectionHead = ({ kicker, title, text }) => (
  <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
    <div>
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-[#e92b35]">{kicker}</p>
      <h2 className="font-outfit max-w-3xl text-3xl font-black leading-tight text-[#101525] dark:text-white md:text-5xl">
        {title}
      </h2>
    </div>
    {text && <p className="max-w-lg text-sm font-semibold leading-7 text-[#667085] dark:text-slate-300">{text}</p>}
  </div>
);

const FeatureCard = ({ icon, title, text }) => (
  <article className="uk-reveal uk-float-card min-h-[250px] rounded-lg border border-[#e9edf3] bg-white/90 p-6 shadow-[0_12px_34px_rgba(16,21,37,0.06)] dark:border-white/10 dark:bg-slate-900/90">
    <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0f1] text-[#e92b35]">
      {icon}
    </div>
    <h3 className="font-outfit mb-3 text-lg font-black text-[#101525] dark:text-white">{title}</h3>
    <p className="text-sm font-semibold leading-7 text-[#667085] dark:text-slate-300">{text}</p>
  </article>
);

const ProcessCard = ({ className, icon, title, text }) => (
  <div className={`uk-slide-card absolute left-5 right-5 flex min-h-[78px] items-center gap-4 rounded-lg border border-[#e9edf3] bg-white p-4 shadow-[0_18px_42px_rgba(16,21,37,0.10)] md:left-12 md:right-12 ${className}`}>
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#101525] text-white">
      {icon}
    </span>
    <span className="text-sm font-black text-[#101525]">
      {title}
      <span className="block text-xs font-bold text-[#667085]">{text}</span>
    </span>
  </div>
);

const StepCard = ({ number, title, text }) => (
  <article className="uk-reveal uk-float-card rounded-lg border border-[#e9edf3] bg-white/90 p-6 shadow-[0_12px_34px_rgba(16,21,37,0.06)] dark:border-white/10 dark:bg-slate-900/90">
    <span className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-[#e92b35] text-sm font-black text-white">
      {number}
    </span>
    <h3 className="font-outfit mb-2 text-lg font-black text-[#101525] dark:text-white">{title}</h3>
    <p className="text-sm font-semibold leading-7 text-[#667085] dark:text-slate-300">{text}</p>
  </article>
);

const ReviewCard = ({ initials, name, role, quote }) => (
  <article className="uk-reveal uk-float-card rounded-lg border border-[#e9edf3] bg-white/90 p-6 shadow-[0_12px_34px_rgba(16,21,37,0.06)] dark:border-white/10 dark:bg-slate-900/90">
    <div className="mb-5 flex gap-1 text-[#f4aa24]">
      {[...Array(5)].map((_, index) => (
        <HiOutlineStar key={index} size={17} />
      ))}
    </div>
    <p className="text-sm font-semibold leading-7 text-[#667085] dark:text-slate-300">"{quote}"</p>
    <div className="mt-6 flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#e92b35] to-[#ff6872] text-sm font-black text-white">
        {initials}
      </span>
      <div>
        <h3 className="font-outfit text-sm font-black text-[#101525] dark:text-white">{name}</h3>
        <p className="text-xs font-bold text-[#667085] dark:text-slate-300">{role}</p>
      </div>
    </div>
  </article>
);

const AnimatedCounter = ({ endValue, duration = 1200, formatter }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    let cancelled = false;
    const step = (timestamp) => {
      if (cancelled) return;
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * endValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
    return () => {
      cancelled = true;
    };
  }, [endValue, duration]);

  return <span>{formatter ? formatter(count) : count}</span>;
};

export default LandingPage;
