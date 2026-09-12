import { useState, createContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import AIChatAssistant from '../AI/AIChatAssistant';

export const SidebarContext = createContext(null);

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarContext.Provider value={[sidebarOpen, setSidebarOpen]}>
      <div className="min-h-screen udhaar-page-bg text-deep-navy">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="pt-18 md:pl-64 min-h-screen transition-all duration-300">
          {/* Full-width responsive container with optimal edge spacing */}
          <div className="p-3 pb-24 sm:p-5 sm:pb-28 lg:p-6 lg:pb-10 w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10">
            {children || <Outlet context={[sidebarOpen, setSidebarOpen]} />}
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
