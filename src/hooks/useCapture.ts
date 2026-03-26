import { useState, useCallback, useEffect } from 'react';

export interface ProgressState {
  message: string;
  step: number;
  totalSteps: number;
}

export interface CaptureResult {
  query: string;
  images: string[];
  totalMatches: number;
  timestamp?: number;
}

export function useCapture(endpoint: string, isMockMode: boolean = true) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `capture_results_${endpoint}`;

  const [results, setResults] = useState<CaptureResult[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleClear = () => {
      setResults([]);
    };

    window.addEventListener('capture_results_cleared', handleClear);
    return () => window.removeEventListener('capture_results_cleared', handleClear);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(results));
      window.dispatchEvent(new Event('capture_results_updated'));
    } catch (e) {
      console.warn('Failed to save results to localStorage', e);
    }
  }, [results, storageKey]);

  const execute = useCallback(async (payload: any, append: boolean = false) => {
    setLoading(true);
    setError(null);
    if (!append) {
      setResults([]);
    }
    setProgress({ message: 'Initializing...', step: 0, totalSteps: 1 });

    if (isMockMode) {
      // Simulate mock progress
      setProgress({ message: 'Mock: Launching Browser...', step: 1, totalSteps: 3 });
      await new Promise(r => setTimeout(r, 1000));
      setProgress({ message: 'Mock: Searching...', step: 2, totalSteps: 3 });
      await new Promise(r => setTimeout(r, 1000));
      setProgress({ message: 'Mock: Capturing...', step: 3, totalSteps: 3 });
      await new Promise(r => setTimeout(r, 1000));
      
      const query = payload.stockCode || payload.fundNames?.[0] || payload.searchValue || 'Tencent Holdings 00700';
      const mockResults = [
        {
          query: query,
          images: [`https://picsum.photos/seed/${query.replace(/\s+/g, '')}1/1200/800`],
          totalMatches: 1,
          timestamp: Date.now()
        },
        {
          query: 'AIA Group 01299',
          images: ['https://picsum.photos/seed/aia1/1200/800'],
          totalMatches: 1,
          timestamp: Date.now() - 1000
        },
        {
          query: 'HSBC Holdings 00005',
          images: ['https://picsum.photos/seed/hsbc1/1200/800'],
          totalMatches: 1,
          timestamp: Date.now() - 2000
        },
        {
          query: 'Tracker Fund 02800',
          images: ['https://picsum.photos/seed/tracker1/1200/800'],
          totalMatches: 1,
          timestamp: Date.now() - 3000
        }
      ];

      setResults(prev => append ? [...prev, ...mockResults] : mockResults);
      setLoading(false);
      setProgress(null);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('Failed to read response stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.substring(7);
            else if (line.startsWith('data: ')) data = line.substring(6);
          }

          if (data) {
            const parsed = JSON.parse(data);
            if (eventType === 'progress') {
              setProgress(parsed);
            } else if (eventType === 'complete') {
              // Ensure images have data URI prefix
              const formattedResults = parsed.results.map((r: any) => ({
                ...r,
                images: r.images.map((img: string) => img.startsWith('data:') ? img : `data:image/png;base64,${img}`),
                timestamp: Date.now()
              }));
              setResults(prev => append ? [...prev, ...formattedResults] : formattedResults);
            } else if (eventType === 'error') {
              throw new Error(`[${parsed.error.errorType || 'UNKNOWN'}] ${parsed.error.message}`);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [endpoint, isMockMode]);

  return { execute, loading, progress, results, error, setResults };
}
