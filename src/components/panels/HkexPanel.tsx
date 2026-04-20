'use client';

import { useState, useTransition } from 'react';
import { captureHkex } from '@/actions/hkex';
import type { CaptureResult } from '@/actions/hkex';
import { CaptureButton } from '@/components/shared/CaptureButton';
import { ProgressStepper } from '@/components/shared/ProgressStepper';
import { CaptureSkeleton } from '@/components/shared/CaptureSkeleton';
import { ScreenshotGallery } from '@/components/shared/ScreenshotGallery';

/**
 * HKEX Equities Capture Panel
 *
 * Flow:
 *  1. User enters stock codes → clicks Capture
 *  2. isPending = true → CaptureSkeleton + ProgressStepper visible
 *  3. Server Action returns base64 screenshots → ScreenshotGallery renders
 *
 * ui-ux-pro-max: loading-states, ARIA live, keyboard-nav, touch-targets
 */
export function HkexPanel() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const stockCodes = input
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const handleCapture = () => {
    if (stockCodes.length === 0) return;
    if (stockCodes.length > 10) {
      setError('Please limit your search to a maximum of 10 stock codes at a time.');
      return;
    }

    setError(null);
    setResults([]);
    setPendingCount(stockCodes.length);

    startTransition(async () => {
      const newResults: CaptureResult[] = [];
      for (const code of stockCodes) {
        const res = await captureHkex({ stockCode: code });
        if (res.success) {
          newResults.push(res.result);
          setResults([...newResults]); // stream results in as they arrive
        } else {
          setError(`[${res.errorType ?? 'ERROR'}] ${res.error}`);
          break;
        }
      }
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

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {isPending && (
        <>
          {/* Stage progress bar — auto-cycles through Playwright stages */}
          <ProgressStepper tool="hkex" />

          {/* Skeleton cards — one per queued capture so layout doesn't jump */}
          <CaptureSkeleton count={pendingCount || stockCodes.length || 1} label="Capturing HKEX…" />
        </>
      )}

      {/* ── Results (streams in as each code completes) ───────────────────── */}
      {!isPending && (
        <ScreenshotGallery
          results={results}
          prefix="hkex"
          onClear={() => { setResults([]); setPendingCount(0); }}
        />
      )}
    </div>
  );
}
