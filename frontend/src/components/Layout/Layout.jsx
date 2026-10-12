import { useState, createContext, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import AIChatAssistant from '../AI/AIChatAssistant';

export const SidebarContext = createContext(null);

const PageSkeletonLoader = () => (
  <div className="w-full space-y-6 animate-pulse pt-2">
    {/* Header banner skeleton */}
    <div className="h-10 bg-slate-200/70 dark:bg-slate-800/60 rounded-2xl w-48 mb-6" />
    {/* Metric / highlight cards skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="h-28 bg-slate-200/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50" />
      <div className="h-28 bg-slate-200/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50" />
      <div className="h-28 bg-slate-200/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50" />
      <div className="h-28 bg-slate-200/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50" />
    </div>
    {/* Content list / table skeleton */}
    <div className="h-64 bg-slate-200/60 dark:bg-slate-800/50 rounded-3xl border border-slate-200/50 dark:border-slate-700/50" />
  </div>
);

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarContext.Provider value={[sidebarOpen, setSidebarOpen]}>
      <div className="min-h-screen udhaar-page-bg text-deep-navy">
        <Sidebar />
        <main className="pt-18 md:pl-64 min-h-screen transition-all duration-300">
          {/* Full-width responsive container with optimal edge spacing */}
          <div className="p-3 pb-24 sm:p-5 sm:pb-28 lg:p-6 lg:pb-10 w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10">
            <Suspense fallback={<PageSkeletonLoader />}>
              {children || <Outlet context={[sidebarOpen, setSidebarOpen]} />}
            </Suspense>
          </div>
        </main>
        {/* Mobile bottom navigation – hidden on lg+ */}
        <MobileBottomNav />
        <AIChatAssistant />
      </div>
    </SidebarContext.Provider>
  );
};

export default Layout;
