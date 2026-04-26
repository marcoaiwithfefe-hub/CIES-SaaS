'use client';

import { useCallback, useState } from 'react';
import { DownloadZipButton } from '@/components/shared/DownloadZipButton';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { RecentCaptures } from '@/components/shared/RecentCaptures';
import { ScreenshotActions } from '@/components/shared/ScreenshotActions';
import { CaptureButton } from '@/components/shared/CaptureButton';

interface CaptureResult {
  id: string;
  query: string;
  image: string; // data:image/png;base64,...
  timestamp: number;
}

export function HkexPanel() {
  const [stockCode, setStockCode] = useState('');
  const [language, setLanguage] = useState<'en' | 'tc'>('tc');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [refresh, setRefresh] = useState(0);

  const capture = useCallback(async () => {
    const codes = stockCode
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (codes.length === 0 || loading) return;

    const invalid = codes.filter((c) => !/^[0-9A-Za-z.\-]+$/.test(c));
    if (invalid.length > 0) {
      setError(`Invalid code${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);
    const errors: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      setProgress({ current: i + 1, total: codes.length });
      try {
        const resp = await fetch('/api/capture/hkex', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stockCode: codes[i], language }),
        }).then((r) => r.json());
        if (resp.success) {
          setResults((prev) => [...(resp.results as CaptureResult[]), ...prev]);
          setRefresh((n) => n + 1);
        } else {
          errors.push(resp.error ?? 'Capture failed');
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    setProgress(null);
    if (errors.length > 0) setError(errors.join(' | '));
    setLoading(false);
  }, [stockCode, language, loading]);

  const zipItems = results.map((r) => ({
    filename: `hkex_${r.query}_${language}_${new Date(r.timestamp).toISOString().slice(0, 10)}.png`,
    imageSrc: r.image,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="headline-section">HKEX Equities Capture</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Real-time compliance validation for listed securities on the Hong Kong Stock Exchange.
          Verified against CIES-2024 standards.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
        <div className="flex items-start justify-between gap-3">
          <label
            htmlFor="hkex-stockCode"
            className="block text-sm font-medium"
            style={{ color: 'var(--color-on-surface)' }}
          >
            Stock Code
            <span className="label-meta block mt-1">Enter one or more codes, comma-separated (e.g. 0005, 0700, 9988)</span>
          </label>
          <LanguageToggle value={language} onChange={setLanguage} />
        </div>
        <div className="flex gap-3">
          <input
            id="hkex-stockCode"
            type="text"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && capture()}
            placeholder="e.g. 0005"
            disabled={loading}
            className="input-regulatory flex-1"
            aria-required="true"
            aria-describedby="hkex-hint"
          />
          <CaptureButton isPending={loading} disabled={!stockCode.trim()} onClick={capture} />
        </div>
        <p id="hkex-hint" className="label-meta">
          Common codes: 0005 (HSBC), 0700 (Tencent), 9988 (Alibaba), 3690 (Meituan)
        </p>
      </div>

      {error && (
        <div className="error-block" role="alert" aria-live="assertive">
          {error}
          <button
            type="button"
            onClick={capture}
            className="ml-3 underline text-sm"
            style={{ color: 'var(--color-error)' }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && progress && (
        <p className="text-sm animate-pulse" style={{ color: 'var(--color-on-surface-var)' }}>
          Capturing code {progress.current} of {progress.total}…
        </p>
      )}

      {results.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
              Results
              <span className="chip-regulatory ml-2">{results.length}</span>
            </h2>
            {results.length > 1 && (
              <DownloadZipButton
                items={zipItems}
                zipName={`hkex_${new Date().toISOString().slice(0, 10)}.zip`}
              />
            )}
          </div>

          {results.map((r) => (
            <figure key={r.id} className="screenshot-frame m-0">
              <figcaption
                className="flex items-center justify-between px-4 py-2 glass"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 10%, transparent)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-medium" style={{ color: 'var(--color-on-surface)' }}>
                    {r.query}
                  </span>
                  <span className="label-meta">
                    {new Date(r.timestamp).toLocaleTimeString('en-HK', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <ScreenshotActions
                  imageSrc={r.image}
                  filename={zipItems.find((z) => z.imageSrc === r.image)?.filename ?? `hkex_${r.query}.png`}
                />
              </figcaption>
              <div className="p-4 flex justify-center" style={{ background: 'var(--color-surface-highest)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={`HKEX capture — ${r.query}`}
                  className="max-w-full h-auto rounded"
                  loading="lazy"
                  style={{ border: '1px solid color-mix(in srgb, var(--color-outline-var) 10%, transparent)' }}
                />
              </div>
            </figure>
          ))}

          <button
            type="button"
            onClick={() => setResults([])}
            className="btn-ghost text-sm"
            style={{ color: 'var(--color-error)' }}
          >
            Clear results
          </button>
        </section>
      )}

      <RecentCaptures tool="hkex" refreshKey={refresh} />
    </div>
  );
}
