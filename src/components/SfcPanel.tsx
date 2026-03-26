import React, { useState } from 'react';
import { CONFIG } from '../config';
import { useCapture } from '../hooks/useCapture';
import { SearchForm } from './shared/SearchForm';
import { ProgressStepper } from './shared/ProgressStepper';
import { ScreenshotGallery } from './shared/ScreenshotGallery';

export default function SfcPanel({ isMockMode }: { isMockMode: boolean }) {
  const [fundNamesInput, setFundNamesInput] = useState('');
  const { execute, loading, progress, results, error, setResults } = useCapture(CONFIG.ENDPOINTS.SFC, isMockMode);

  const handleCapture = async () => {
    const fundNames = fundNamesInput.split('\n').map(n => n.trim()).filter(Boolean);
    if (fundNames.length === 0) return;
    
    if (fundNames.length > 10) {
      alert("Please limit your search to a maximum of 10 fund names at a time.");
      return;
    }
    
    await execute({ fundNames });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{CONFIG.SFC.LABELS.TITLE}</h1>
        <p className="text-slate-500 mt-2">{CONFIG.SFC.LABELS.SUBTITLE}</p>
      </header>

      <SearchForm
        id="fundNames"
        label="Target Fund Names (One per line, smart keyword match supported)"
        placeholder="Enter Fund Names (one per line)&#10;e.g. AIA Income&#10;Tracker Fund"
        value={fundNamesInput}
        onChange={setFundNamesInput}
        onSubmit={handleCapture}
        loading={loading}
        isTextArea={true}
      />

      {error && (
        <div className="text-red-500 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-100" role="alert">
          {error}
        </div>
      )}

      <ProgressStepper progress={progress} />
      
      <ScreenshotGallery results={results} prefix="sfc" onClear={() => setResults([])} />
    </div>
  );
}
