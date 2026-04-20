'use client';

import { useState, useTransition } from 'react';
import { captureAfrc } from '@/actions/afrc';
import type { CaptureResult } from '@/actions/hkex';
import { CaptureButton } from '@/components/shared/CaptureButton';
import { ProgressStepper } from '@/components/shared/ProgressStepper';
import { ScreenshotGallery } from '@/components/shared/ScreenshotGallery';

export function AfrcPanel() {
  const [searchType, setSearchType] = useState<'name' | 'regNo'>('name');
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCapture = () => {
    if (!searchValue.trim()) return;
    setError(null);
    setResults([]);

    startTransition(async () => {
      const res = await captureAfrc({ searchType, searchValue: searchValue.trim() });
      if (res.success) {
        setResults([res.result]);
      } else {
        setError(`[${res.errorType ?? 'ERROR'}] ${res.error}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="headline-section">AFRC CPA Register</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Search the AFRC Public Register of CPAs (Practising). Search by name or practising certificate number.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--color-surface-container)' }}>
        {/* Search Type */}
        <fieldset>
          <legend className="block text-sm font-medium mb-3" style={{ color: 'var(--color-on-surface)' }}>
            Search Type
          </legend>
          <div className="flex gap-6">
            {(['name', 'regNo'] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer"
                style={{ color: 'var(--color-on-surface)', minHeight: '44px' }}
              >
                <input
                  type="radio"
                  name="afrc-searchType"
                  value={type}
                  checked={searchType === type}
                  onChange={() => setSearchType(type)}
                  disabled={isPending}
                  style={{ accentColor: 'var(--color-primary-cta)', width: '1rem', height: '1rem' }}
                />
                <span className="text-sm font-medium">
                  {type === 'name' ? 'Search by Name' : 'Search by Practising Number'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Search Input */}
        <div>
          <label
            htmlFor="afrc-searchValue"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-on-surface)' }}
          >
            {searchType === 'name' ? 'English Name' : 'Practising Certificate Number'}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="afrc-searchValue"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending && searchValue.trim()) handleCapture();
              }}
              className="input-regulatory flex-1"
              placeholder={searchType === 'name' ? 'e.g. Chan' : 'e.g. P01234'}
              aria-required="true"
              disabled={isPending}
            />
            <CaptureButton isPending={isPending} disabled={!searchValue.trim()} onClick={handleCapture} />
          </div>
        </div>
      </div>

      {error && <div className="error-block" role="alert" aria-live="assertive">{error}</div>}
      {isPending && <ProgressStepper message="Searching AFRC register…" step={2} totalSteps={4} />}
      <ScreenshotGallery results={results} prefix="afrc" onClear={() => setResults([])} />
    </div>
  );
}
