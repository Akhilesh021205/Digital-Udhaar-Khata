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
      <div className="min-h-screen bg-soft-white text-deep-navy">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="pt-18 min-h-screen transition-all duration-300">
          {/* Mobile: tighter padding with room for bottom nav */}
          <div className="p-3 pb-24 sm:p-5 sm:pb-28 lg:p-8 lg:pb-10 max-w-7xl mx-auto">
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
