import { Activity, History, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ isOpen, isMobileOpen, toggleSidebar, toggleMobileMenu, activeTab, setActiveTab }: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50 flex flex-col transition-all duration-300
        ${isOpen ? 'w-64' : 'w-20'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-center h-14 md:h-16 border-b border-slate-200 px-2 shrink-0">
          <span className={`font-bold text-slate-800 text-base md:text-lg transition-opacity duration-300 text-center ${isOpen ? 'opacity-100 w-full block' : 'opacity-0 hidden'}`}>
            Ergonomic Vest
          </span>
          <span className={`font-bold text-slate-800 text-base md:text-lg text-center w-full block ${isOpen ? 'hidden' : 'block'}`}>
            EV
          </span>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-4 flex flex-col gap-2 px-3">
          <button 
            onClick={() => { setActiveTab('dashboard'); if(isMobileOpen) toggleMobileMenu(); }}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Activity className="w-5 h-5 flex-shrink-0" />
            <span className={`${isOpen ? 'block' : 'hidden'}`}>Dashboard</span>
          </button>

          <button 
            onClick={() => { setActiveTab('history'); if(isMobileOpen) toggleMobileMenu(); }}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <History className="w-5 h-5 flex-shrink-0" />
            <span className={`${isOpen ? 'block' : 'hidden'}`}>Data History</span>
          </button>
        </nav>

        {/* Footer Toggle Button */}
        <div className="h-10 md:h-12 bg-blue-500 p-1.5 md:p-2 hidden md:flex items-center justify-center shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-10">
          <button 
            onClick={toggleSidebar}
            className="w-full h-full bg-white hover:bg-slate-50 border border-transparent rounded-md text-blue-500 transition-colors flex items-center justify-center shadow-sm"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </aside>
    </>
  );
}
