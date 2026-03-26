import React, { useState, useEffect } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { CONFIG } from '../../config';
import { CaptureResult } from '../../hooks/useCapture';
import { TabType } from './DashboardLayout';

interface HistoryItem extends CaptureResult {
  tab: TabType;
}

interface SearchHistoryProps {
  onSelectHistory: (tab: TabType) => void;
}

export function SearchHistory({ onSelectHistory }: SearchHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = () => {
    const endpoints: { tab: TabType; url: string }[] = [
      { tab: 'hkex', url: CONFIG.ENDPOINTS.HKEX },
      { tab: 'sfc', url: CONFIG.ENDPOINTS.SFC },
      { tab: 'afrc', url: CONFIG.ENDPOINTS.AFRC },
      { tab: 'afrc-firm', url: CONFIG.ENDPOINTS.AFRC_FIRM },
    ];

    let allResults: HistoryItem[] = [];

    endpoints.forEach(({ tab, url }) => {
      try {
        const saved = localStorage.getItem(`capture_results_${url}`);
        if (saved) {
          const results: CaptureResult[] = JSON.parse(saved);
          allResults = allResults.concat(results.map(r => ({ ...r, tab })));
        }
      } catch (e) {
        console.warn('Failed to parse history for', url);
      }
    });

    if (allResults.length === 0) {
      // Pre-populate with dummy data for Stitch preview
      const now = Date.now();
      allResults = [
        { tab: 'hkex', query: 'Tencent Holdings 00700', images: [], totalMatches: 1, timestamp: now },
        { tab: 'sfc', query: 'Tracker Fund', images: [], totalMatches: 3, timestamp: now - 100000 },
        { tab: 'afrc', query: 'Deloitte Touche Tohmatsu', images: [], totalMatches: 1, timestamp: now - 300000 },
        { tab: 'afrc-firm', query: 'PricewaterhouseCoopers', images: [], totalMatches: 2, timestamp: now - 500000 },
        { tab: 'hkex', query: 'Alibaba Group 09988', images: [], totalMatches: 1, timestamp: now - 800000 },
      ];
    }

    // Sort by timestamp descending
    allResults.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Keep top 10
    setHistory(allResults.slice(0, 10));
  };

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => loadHistory();
    window.addEventListener('capture_results_updated', handleUpdate);
    return () => window.removeEventListener('capture_results_updated', handleUpdate);
  }, []);

  const handleClearAll = () => {
    const endpoints = [
      CONFIG.ENDPOINTS.HKEX,
      CONFIG.ENDPOINTS.SFC,
      CONFIG.ENDPOINTS.AFRC,
      CONFIG.ENDPOINTS.AFRC_FIRM,
    ];
    endpoints.forEach(url => localStorage.removeItem(`capture_results_${url}`));
    window.dispatchEvent(new Event('capture_results_cleared'));
    loadHistory();
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 pb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
            Recent Activity
          </h3>
        </div>
        <div className="flex-1 p-4 text-center text-slate-500 text-sm mt-4">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
          Recent Activity
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {history.map((item, idx) => (
          <button
            key={`${item.tab}-${item.timestamp}-${idx}`}
            onClick={() => onSelectHistory(item.tab)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors group flex items-center gap-3"
          >
            <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 truncate">
                {item.tab.toUpperCase()}: {item.query}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {item.totalMatches} match{item.totalMatches !== 1 ? 'es' : ''}
              </p>
            </div>
          </button>
        ))}
      </div>
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleClearAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All History
        </button>
      </div>
    </div>
  );
}
