'use client';

import { useState, useTransition } from 'react';
import { captureHkex } from '@/actions/hkex';
import type { CaptureResult } from '@/actions/hkex';
import { CaptureButton } from '@/components/shared/CaptureButton';
import { ProgressStepper } from '@/components/shared/ProgressStepper';
import { ScreenshotGallery } from '@/components/shared/ScreenshotGallery';

interface HkexPanelProps {
  isMockMode: boolean;
}

/**
 * HKEX Equities Capture Panel
 * Matches Stitch frame: "HKEX Equities Capture"
 * Uses useTransition for loading state (React 19 pattern)
 */
export function HkexPanel({ isMockMode }: HkexPanelProps) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCapture = () => {
    const codes = input
      .split(/[\s,]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (codes.length === 0) return;
    if (codes.length > 10) {
      setError('Please limit your search to a maximum of 10 stock codes at a time.');
      return;
    }

    setError(null);
    setResults([]);

    startTransition(async () => {
      const newResults: CaptureResult[] = [];
      for (const code of codes) {
        const res = await captureHkex({ stockCode: code, isMockMode });
        if (res.success) {
          newResults.push(res.result);
        } else {
          setError(`[${res.errorType ?? 'ERROR'}] ${res.error}`);
          break;
        }
      }
      setResults(newResults);
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header>
        <h1 className="headline-section">HKEX Equities Capture</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Execute real-time compliance validation and data capture for listed securities on the
          Hong Kong Stock Exchange. Verified against CIES-2024 standards.
        </p>
      </header>

      {/* Search Form */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
        <label
          htmlFor="stockCodes"
          className="block text-sm font-medium"
          style={{ color: 'var(--color-on-surface)' }}
        >
          Target Stock Codes
          <span className="label-meta block mt-1">
            Enter one or more codes, comma or space separated (max 10)
          </span>
        </label>

        <div className="flex gap-3">
          <textarea
            id="stockCodes"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isPending && input.trim()) {
                e.preventDefault();
                handleCapture();
              }
            }}
            className="input-regulatory flex-1 rounded"
            style={{ minHeight: '88px', resize: 'vertical', borderRadius: '0.5rem 0.5rem 0 0' }}
            placeholder="e.g. 0700, 9988, 3690"
            aria-required="true"
            aria-describedby="stockCodes-hint"
            disabled={isPending}
          />
          <CaptureButton
            isPending={isPending}
            disabled={!input.trim()}
            onClick={handleCapture}
          />
        </div>
        <p id="stockCodes-hint" className="label-meta">
          Codes: 0005 (HSBC), 0700 (Tencent), 9988 (Alibaba), 3690 (Meituan)
        </p>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="error-block" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Progress */}
      {isPending && (
        <ProgressStepper message="Processing…" step={1} totalSteps={4} />
      )}

      {/* Results */}
      <ScreenshotGallery results={results} prefix="hkex" onClear={() => setResults([])} />
    </div>
  );
}
