import React, { useState } from 'react';
import { Clock, Trash2, LayoutDashboard } from 'lucide-react';

const TAB_LABELS = {
  hkex: 'HKEX',
  sfc: 'SFC',
  afrc: 'AFRC',
  'afrc-firm': 'AFRC Firms',
};

export function DashboardLayout({ children, activeTab, setActiveTab, isMockMode, setIsMockMode }) {
  const [history, setHistory] = useState([]);
  const [, setSelectedHistoryItem] = useState(null);
  const clearHistory = () => setHistory([]);
  const handleHistoryClick = (item) => {
    setActiveTab(item.tool);
    setSelectedHistoryItem(item);
  };
  return (
    <div className='flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden'>
      <aside className='w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 shrink-0'>
        <div className='p-6 border-b border-slate-100 flex items-center gap-3'>
          <div className='p-2 bg-indigo-50 rounded-lg text-indigo-600'>
            <LayoutDashboard className='w-6 h-6' />
          </div>
          <div className='text-xl font-bold tracking-tight text-slate-900'>Capture Tools</div>
        </div>
        <nav className='p-4 flex-1 overflow-y-auto flex flex-col gap-6'>
          <div>
            <div className='px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2'>Tools</div>
            <div className='space-y-1'>
              {['hkex', 'sfc', 'afrc', 'afrc-firm'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ' + (activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100')}
                >{TAB_LABELS[tab]}</button>
              ))}
            </div>
          </div>
          <div>
            <div className='flex items-center justify-between px-3 mb-2'>
              <div className='text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2'>
                <Clock className='w-3.5 h-3.5' />
                Recent Activity
              </div>
              {history.length > 0 && (
                <button onClick={clearHistory} className='text-slate-400 hover:text-red-500 transition-colors' aria-label='Clear history'>
                  <Trash2 className='w-3.5 h-3.5' />
                </button>
              )}
            </div>
            <div className='space-y-1'>
              {history.length === 0 ? (
                <p className='px-3 text-sm text-slate-400 italic'>No recent searches</p>
              ) : history.map((item) => (
                <button key={item.id} onClick={() => handleHistoryClick(item)} className='w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors'>
                  <div className='flex justify-between items-baseline'>
                    <span className='text-xs font-medium text-slate-500 uppercase'>{item.tool.replace('-', ' ')}</span>
                    <span className='text-[10px] text-slate-400'>{new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div className='text-sm font-medium text-slate-700 truncate mt-0.5' title={item.query}>{item.query}</div>
                </button>
              ))}
            </div>
          </div>
        </nav>
        <div className='p-4 border-t border-slate-100 bg-slate-50'>
          <label className='flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-200/50 transition-colors'>
            <input type='checkbox' checked={isMockMode} onChange={(e) => setIsMockMode(e.target.checked)} className='w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500' />
            <span className='text-sm font-medium text-slate-700'>Mock Mode (Fast UI Dev)</span>
          </label>
        </div>
      </aside>
      <main className='flex-1 overflow-y-auto bg-slate-50/50'>
        <div className='max-w-4xl mx-auto p-8'>{children}</div>
      </main>
    </div>
  );
}
