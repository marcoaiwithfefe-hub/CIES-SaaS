import React, { useState, ReactNode } from 'react';
import { Clock, Trash2, LayoutDashboard } from 'lucide-react';

const TAB_LABELS: Record<string, string> = {
  hkex: 'HKEX',
  sfc: 'SFC',
  afrc: 'AFRC',
  'afrc-firm': 'AFRC Firms',
};

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMockMode: boolean;
  setIsMockMode: (mode: boolean) => void;
}

export function DashboardLayout({ children, activeTab, setActiveTab, isMockMode, setIsMockMode }: DashboardLayoutProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [, setSelectedHistoryItem] = useState<any>(null);
  const clearHistory = () => setHistory([]);
  const handleHistoryClick = (item: any) => {
    setActiveTab(item.tool);
    setSelectedHistoryItem(item);
  };
  return (
    <div className='flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden'>
      <aside className='w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 shrink-0'>
        <div className='p-6 border-b border-slate-100'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <LayoutDashboard className='w-5 h-5 text-indigo-600' />
            Sovereign Auditor
          </h2>
        </div>
        <nav className='flex-1 p-4 space-y-1 overflow-y-auto'>
          {Object.entries(TAB_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className='p-4 border-t border-slate-100'>
          <div className='flex items-center justify-between mb-3'>
            <span className='text-xs font-medium text-slate-500 flex items-center gap-1'>
              <Clock className='w-3 h-3' /> History
            </span>
            {history.length > 0 && (
              <button onClick={clearHistory} className='text-xs text-slate-400 hover:text-red-500'>
                <Trash2 className='w-3 h-3' />
              </button>
            )}
          </div>
          <div className='space-y-1 max-h-40 overflow-y-auto'>
            {history.length === 0 ? (
              <p className='text-xs text-slate-400'>No history yet</p>
            ) : (
              history.map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={() => handleHistoryClick(item)}
                  className='w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-600 truncate'
                >
                  {item.label || item.tool}
                </button>
              ))
            )}
          </div>
          <div className='mt-4 flex items-center justify-between'>
            <span className='text-xs text-slate-500'>Mock Mode</span>
            <button
              onClick={() => setIsMockMode(!isMockMode)}
              className={`relative w-9 h-5 rounded-full transition-colors ${isMockMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isMockMode ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </div>
      </aside>
      <main className='flex-1 overflow-y-auto bg-slate-50/50'>
        <div className='max-w-4xl mx-auto p-8'>{children}</div>
      </main>
    </div>
  );
}
