import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CaptureResult } from '../hooks/useCapture';

export interface HistoryItem {
  id: string;
  tool: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
  query: string;
  timestamp: number;
  results: CaptureResult[];
}

interface HistoryContextType {
  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  selectedHistoryItem: HistoryItem | null;
  setSelectedHistoryItem: (item: HistoryItem | null) => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('recent_activity');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('recent_activity', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save history to localStorage', e);
    }
  }, [history]);

  const addHistoryItem = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, 5); // Keep last 5
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    setSelectedHistoryItem(null);
  };

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, clearHistory, selectedHistoryItem, setSelectedHistoryItem }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
