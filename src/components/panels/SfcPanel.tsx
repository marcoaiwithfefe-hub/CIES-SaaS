'use client';

import { useState, useTransition } from 'react';
import { captureSfc } from '@/actions/sfc';
import type { CaptureResult } from '@/actions/hkex';
import { CaptureButton } from '@/components/shared/CaptureButton';
import { ProgressStepper } from '@/components/shared/ProgressStepper';
import { ScreenshotGallery } from '@/components/shared/ScreenshotGallery';

export function SfcPanel({ isMockMode }: { isMockMode: boolean }) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCapture = () => {
    const fundNames = input.split('\n').map((n) => n.trim()).filter(Boolean);
    if (fundNames.length === 0) return;
    if (fundNames.length > 10) {
      setError('Please limit your search to a maximum of 10 fund names at a time.');
      return;
    }

    setError(null);
    setResults([]);

    startTransition(async () => {
      const res = await captureSfc({ fundNames, isMockMode });
      if (res.success) {
        setResults(res.results);
      } else {
        setError(`[${res.errorType ?? 'ERROR'}] ${res.error}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="headline-section">SFC CIES Tool</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Search the SFC Public Register of Eligible Collective Investment Schemes under the new CIES framework.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
        <label
          htmlFor="fundNames"
          className="block text-sm font-medium"
          style={{ color: 'var(--color-on-surface)' }}
        >
          Target Fund Names
          <span className="label-meta block mt-1">One fund name per line — smart keyword match supported (max 10)</span>
        </label>

        <div className="flex gap-3">
          <textarea
            id="fundNames"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input-regulatory flex-1 rounded"
            style={{ minHeight: '120px', resize: 'vertical', borderRadius: '0.5rem 0.5rem 0 0' }}
            placeholder={'e.g. AIA Income\nTracker Fund\nHSBC Growth'}
            aria-required="true"
            disabled={isPending}
          />
          <CaptureButton isPending={isPending} disabled={!input.trim()} onClick={handleCapture} />
        </div>
      </div>

      {error && (
        <div className="error-block" role="alert" aria-live="assertive">{error}</div>
      )}

      {isPending && <ProgressStepper message="Loading SFC register…" step={2} totalSteps={5} />}

      <ScreenshotGallery results={results} prefix="sfc" onClear={() => setResults([])} />
    </div>
  );
}
