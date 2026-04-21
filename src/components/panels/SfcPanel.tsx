'use client';

import { useCallback, useState } from 'react';
import { BulkInput } from '@/components/shared/BulkInput';
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

export function SfcPanel() {
  const [raw, setRaw] = useState('');
  const [language, setLanguage] = useState<'en' | 'tc'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [refresh, setRefresh] = useState(0);

  const fundNames = raw.split('\n').map((s) => s.trim()).filter(Boolean);

  const capture = useCallback(async () => {
    const names = fundNames.slice(0, 10);
    if (names.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/capture/sfc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fundNames: names, language }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? 'Capture failed');
      } else {
        setResults((prev) => [...(body.results as CaptureResult[]), ...prev]);
        setRefresh((n) => n + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fundNames, language, loading]);

  const zipItems = results.map((r) => ({
    filename: `sfc_${r.query.replace(/\s+/g, '_')}_${language}.png`,
    imageSrc: r.image,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="headline-section">SFC CIES Fund List</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Search the SFC Public Register of Eligible Collective Investment Schemes under the new CIES framework.
          Switch language to capture the Chinese or English version.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="sfc-fundNames"
            className="block text-sm font-medium"
            style={{ color: 'var(--color-on-surface)' }}
          >
            Fund Names
            <span className="label-meta block mt-1">One fund name per line — keyword match (max 10)</span>
          </label>
          <LanguageToggle value={language} onChange={setLanguage} />
        </div>

        <BulkInput
          id="sfc-fundNames"
          value={raw}
          onChange={setRaw}
          placeholder={'e.g. AIA Income\nTracker Fund\nHSBC Growth'}
          max={10}
          disabled={loading}
        />

        <div className="flex justify-end">
          <CaptureButton isPending={loading} disabled={fundNames.length === 0} onClick={capture} />
        </div>

        <p className="label-meta">
          Tip: Partial names work — the tool matches any row containing your keyword.
        </p>
      </div>

      {error && (
        <div className="error-block" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm animate-pulse" style={{ color: 'var(--color-on-surface-var)' }}>
          Capturing {language.toUpperCase()} SFC rows for {fundNames.length} fund{fundNames.length !== 1 ? 's' : ''}…
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
                zipName={`sfc_${language}_${new Date().toISOString().slice(0, 10)}.zip`}
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
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>
                    &ldquo;{r.query}&rdquo;
                  </span>
                  <span className="chip-regulatory">{language.toUpperCase()}</span>
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
                  filename={`sfc_${r.query.replace(/\s+/g, '_')}_${language}.png`}
                />
              </figcaption>
              <div className="p-4 flex justify-center" style={{ background: 'var(--color-surface-highest)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={`SFC capture — ${r.query} (${language.toUpperCase()})`}
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

      <RecentCaptures tool="sfc" refreshKey={refresh} />
    </div>
  );
}
