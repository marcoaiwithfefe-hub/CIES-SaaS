import React, { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { CONFIG } from '../config';
import { useCapture } from '../hooks/useCapture';
import { ProgressStepper } from './shared/ProgressStepper';
import { ScreenshotGallery } from './shared/ScreenshotGallery';

export default function AfrcFirmPanel({ isMockMode }: { isMockMode: boolean }) {
  const [searchType, setSearchType] = useState<'enName' | 'chName' | 'regNo'>('enName');
  const [searchValue, setSearchValue] = useState('');
  const { execute, loading, progress, results, error, setResults } = useCapture(CONFIG.ENDPOINTS.AFRC_FIRM, isMockMode);

  const handleCapture = async () => {
    if (!searchValue.trim()) return;
    await execute({ searchType, searchValue: searchValue.trim() });
  };

  const getPlaceholder = () => {
    switch (searchType) {
      case 'enName': return 'e.g. Pricewaterhouse';
      case 'chName': return 'e.g. 羅兵咸';
      case 'regNo': return 'e.g. 0001';
      default: return '';
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{CONFIG.AFRC_FIRM.LABELS.TITLE}</h1>
        <p className="text-slate-500 mt-2">{CONFIG.AFRC_FIRM.LABELS.SUBTITLE}</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Search Type
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="firmSearchType"
                value="enName"
                checked={searchType === 'enName'}
                onChange={() => setSearchType('enName')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-700">English Name</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="firmSearchType"
                value="chName"
                checked={searchType === 'chName'}
                onChange={() => setSearchType('chName')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-700">Chinese Name</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="firmSearchType"
                value="regNo"
                checked={searchType === 'regNo'}
                onChange={() => setSearchType('regNo')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-700">Registration Number</span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <label htmlFor="firmSearchValue" className="block text-sm font-medium text-slate-700">
            Search Value
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="firmSearchValue"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex-1 border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder={getPlaceholder()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchValue.trim() && !loading) {
                  handleCapture();
                }
              }}
            />
            <button
              onClick={handleCapture}
              disabled={loading || !searchValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              {loading ? 'Capturing...' : 'Capture'}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-100" role="alert">
            {error}
          </div>
        )}
      </div>

      <ProgressStepper progress={progress} />
      
      <ScreenshotGallery results={results} prefix="afrc-firm" onClear={() => setResults([])} />
    </div>
  );
}
