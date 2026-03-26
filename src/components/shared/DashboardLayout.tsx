import React, { useState } from 'react';
import { Menu, X, Search, FileText, Building2, Briefcase } from 'lucide-react';
import { CONFIG } from '../../config';
import { SearchHistory } from './SearchHistory';

export type TabType = 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';

interface DashboardLayoutProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  children: React.ReactNode;
  isMockMode: boolean;
  setIsMockMode: (mock: boolean) => void;
}

export function DashboardLayout({ activeTab, setActiveTab, children, isMockMode, setIsMockMode }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'hkex', label: CONFIG.HKEX.LABELS.TAB, icon: Search },
    { id: 'sfc', label: CONFIG.SFC.LABELS.TAB, icon: FileText },
    { id: 'afrc', label: CONFIG.AFRC.LABELS.TAB, icon: Briefcase },
    { id: 'afrc-firm', label: CONFIG.AFRC_FIRM.LABELS.TAB, icon: Building2 },
  ] as const;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    closeMobileMenu();
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Compliance Capture</h1>
          <button 
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={closeMobileMenu}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
            Tools
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto border-t border-slate-200">
          <SearchHistory onSelectHistory={(tab) => handleTabClick(tab)} />
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-200/50 transition-colors">
            <input
              type="checkbox"
              checked={isMockMode}
              onChange={(e) => setIsMockMode(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="text-sm font-medium text-slate-700">Mock Mode (Fast UI Dev)</span>
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold text-slate-900">Compliance Capture</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
