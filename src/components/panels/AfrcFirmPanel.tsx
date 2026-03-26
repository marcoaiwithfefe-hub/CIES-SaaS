'use client';

import { useState, useTransition } from 'react';
import { captureAfrcFirm } from '@/actions/afrc-firm';
import type { CaptureResult } from '@/actions/hkex';
import { CaptureButton } from '@/components/shared/CaptureButton';
import { ProgressStepper } from '@/components/shared/ProgressStepper';
import { ScreenshotGallery } from '@/components/shared/ScreenshotGallery';

const SEARCH_TYPE_LABELS = {
  enName: { label: 'English Name', placeholder: 'e.g. Pricewaterhouse' },
  chName: { label: 'Chinese Name', placeholder: 'e.g. 羅兵咸' },
  regNo: { label: 'Registration Number', placeholder: 'e.g. 0001' },
} as const;

export function AfrcFirmPanel({ isMockMode }: { isMockMode: boolean }) {
  const [searchType, setSearchType] = useState<'enName' | 'chName' | 'regNo'>('enName');
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCapture = () => {
    if (!searchValue.trim()) return;
    setError(null);
    setResults([]);

    startTransition(async () => {
      const res = await captureAfrcFirm({ searchType, searchValue: searchValue.trim(), isMockMode });
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
        <h1 className="headline-section">AFRC CPA (Firm) Register</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Search the AFRC Public Register of CPA Firms and Corporate Practices. Search by English name, Chinese name, or registration number.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--color-surface-container)' }}>
        {/* Search Type */}
        <fieldset>
          <legend className="block text-sm font-medium mb-3" style={{ color: 'var(--color-on-surface)' }}>
            Search Type
          </legend>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(SEARCH_TYPE_LABELS) as Array<keyof typeof SEARCH_TYPE_LABELS>).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer"
                style={{ color: 'var(--color-on-surface)', minHeight: '44px' }}
              >
                <input
                  type="radio"
                  name="afrcFirm-searchType"
                  value={type}
                  checked={searchType === type}
                  onChange={() => { setSearchType(type); setSearchValue(''); }}
                  disabled={isPending}
                  style={{ accentColor: 'var(--color-primary-cta)', width: '1rem', height: '1rem' }}
                />
                <span className="text-sm font-medium">{SEARCH_TYPE_LABELS[type].label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Search Input */}
        <div>
          <label
            htmlFor="afrcFirm-searchValue"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-on-surface)' }}
          >
            {SEARCH_TYPE_LABELS[searchType].label}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="afrcFirm-searchValue"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending && searchValue.trim()) handleCapture();
              }}
              className="input-regulatory flex-1"
              placeholder={SEARCH_TYPE_LABELS[searchType].placeholder}
              aria-required="true"
              disabled={isPending}
            />
            <CaptureButton isPending={isPending} disabled={!searchValue.trim()} onClick={handleCapture} />
          </div>
        </div>
      </div>

      {error && <div className="error-block" role="alert" aria-live="assertive">{error}</div>}
      {isPending && <ProgressStepper message="Searching AFRC firm register…" step={2} totalSteps={4} />}
      <ScreenshotGallery results={results} prefix="afrc-firm" onClear={() => setResults([])} />
    </div>
  );
}
