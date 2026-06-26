import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DataHistory from './components/DataHistory';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const { socket, mqttStatus } = useSocket();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      <Sidebar 
        isOpen={isSidebarOpen} 
        isMobileOpen={isMobileMenuOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        
        {/* Top Header - fixed height, compact on mobile */}
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 z-10 shadow-sm shrink-0">
          {/* Left: hamburger + title */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button 
              className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-md shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-xl font-bold text-slate-800 truncate">
              {activeTab === 'dashboard' ? 'Monitoring Dashboard' : 'Data History'}
            </h1>
          </div>

          {/* Right: status + logo */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-200">
              <span className="text-xs font-medium text-slate-600 hidden sm:inline">Status:</span>
              <span className={`badge text-xs ${
                mqttStatus === 'ONLINE' ? 'badge-safe' :
                mqttStatus === 'CONNECTING' ? 'badge-warning' :
                'badge-danger'
              }`}>
                {mqttStatus}
              </span>
            </div>
            <img src="/assets/logo.png" alt="UMJ Logo" className="h-8 md:h-10 w-auto object-contain shrink-0" />
          </div>
        </header>

        {/* Content Area:
            - Mobile: scrollable (overflow-y-auto)
            - Desktop (lg+): fixed height, no page scroll (overflow-hidden) */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-3 md:p-4 lg:p-5">
          {activeTab === 'dashboard' ? <Dashboard socket={socket} /> : <DataHistory />}
        </div>

        {/* Footer - compact */}
        <footer className="h-10 md:h-12 bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-10">
          <p className="text-xs md:text-sm text-white text-center truncate font-medium tracking-wide">
            University of Muhammadiyah Jakarta &mdash; Ergonomic Vest Dashboard &copy; 2026
          </p>
        </footer>
        
      </main>
    </div>
  );
}
