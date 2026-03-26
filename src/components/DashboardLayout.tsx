import React from 'react';
import { CONFIG } from '../config';
import { useHistory } from '../context/HistoryContext';
import { Clock, Trash2, LayoutDashboard } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
  setActiveTab: (tab: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm') => void;
  isMockMode: boolean;
  setIsMockMode: (mock: boolean) => void;
}

export function DashboardLayout({ children, activeTab, setActiveTab, isMockMode, setIsMockMode }: DashboardLayoutProps) {
  const { history, setSelectedHistoryItem, clearHistory } = useHistory();

  const handleHistoryClick = (item: any) => {
    setActiveTab(item.tool);
    setSelectedHistoryItem(item);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Capture Tools</h1>
        </div>

        {/* Navigation */}
        <nav className="p-4 flex-1 overflow-y-auto flex flex-col gap-6">
          <div>
            <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tools</h2>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('hkex')}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'hkex' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {CONFIG.HKEX.LABELS.TAB}
              </button>
              <button
                onClick={() => setActiveTab('sfc')}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'sfc' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {CONFIG.SFC.LABELS.TAB}
              </button>
              <button
                onClick={() => setActiveTab('afrc')}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'afrc' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {CONFIG.AFRC.LABELS.TAB}
              </button>
              <button
                onClick={() => setActiveTab('afrc-firm')}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'afrc-firm' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {CONFIG.AFRC_FIRM.LABELS.TAB}
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Recent Activity
              </h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="Clear history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {history.length === 0 ? (
                <p className="px-3 text-sm text-slate-400 italic">No recent searches</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleHistoryClick(item)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-medium text-slate-500 uppercase">{item.tool.replace('-', ' ')}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate mt-0.5" title={item.query}>
                      {item.query}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>

        {/* Settings Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-200/50 transition-colors">
            <input
              type="checkbox"
              checked={isMockMode}
              onChange={(e) => setIsMockMode(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">Mock Mode (Fast UI Dev)</span>
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        <div className="max-w-4xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
