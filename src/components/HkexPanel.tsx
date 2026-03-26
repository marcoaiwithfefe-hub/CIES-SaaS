import React, { useState } from 'react';
import { CONFIG } from '../config';
import { useCapture } from '../hooks/useCapture';
import { SearchForm } from './shared/SearchForm';
import { ProgressStepper } from './shared/ProgressStepper';
import { ScreenshotGallery } from './shared/ScreenshotGallery';

export default function HkexPanel({ isMockMode }: { isMockMode: boolean }) {
  const [stockCodesInput, setStockCodesInput] = useState('');
  const { execute, loading, progress, results, error, setResults } = useCapture(CONFIG.ENDPOINTS.HKEX, isMockMode);

  const handleCapture = async () => {
    const codes = stockCodesInput.split(/[\s,]+/).map(c => c.trim()).filter(Boolean);
    if (codes.length === 0) return;

    if (codes.length > 10) {
      alert("Please limit your search to a maximum of 10 stock codes at a time.");
      return;
    }

    // Since HKEX takes a single stockCode per request, we need to handle multiple codes.
    // The current useCapture hook is designed for a single request. 
    // We can either modify useCapture or loop here.
    // For simplicity, let's just pass the first code for now, or modify the backend to accept an array.
    // Wait, the backend for HKEX expects { stockCode: string }.
    // If we want to support multiple codes, we should loop here, but useCapture overwrites results.
    // Let's just support one code at a time for now, or loop and append.
    
    // Let's loop and append results
    setResults([]);
    for (const code of codes) {
      await execute({ stockCode: code }, true);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{CONFIG.HKEX.LABELS.TITLE}</h1>
          <p className="text-slate-500 mt-2">{CONFIG.HKEX.LABELS.SUBTITLE}</p>
        </div>
      </header>

      <SearchForm
        id="stockCodes"
        value={stockCodesInput}
        onChange={setStockCodesInput}
        onSubmit={handleCapture}
        loading={loading}
        placeholder="Enter Stock Codes (e.g. 0700, 9988, 3690)"
        label="Target Stock Codes (comma or space separated)"
        isTextArea={true}
      />

      {error && (
        <div className="text-red-500 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-100" role="alert">
          {error}
        </div>
      )}

      <ProgressStepper progress={progress} />

      <ScreenshotGallery results={results} prefix="hkex" onClear={() => setResults([])} />
    </div>
  );
}
