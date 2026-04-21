'use client';

import { useCallback, useState } from 'react';
import { BulkInput } from '@/components/shared/BulkInput';
import { DownloadZipButton } from '@/components/shared/DownloadZipButton';
import { RecentCaptures } from '@/components/shared/RecentCaptures';
import { ScreenshotActions } from '@/components/shared/ScreenshotActions';
import { CaptureButton } from '@/components/shared/CaptureButton';

interface CaptureResult {
  id: string;
  query: string;
  image: string; // data:image/png;base64,...
  timestamp: number;
}

export function AfrcPanel() {
  const [raw, setRaw] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'regNo'>('name');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [refresh, setRefresh] = useState(0);

  const values = raw.split('\n').map((s) => s.trim()).filter(Boolean);

  const capture = useCallback(async () => {
    const items = values.slice(0, 10);
    if (items.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: items.length });
    const collected: CaptureResult[] = [];
    const failures: string[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const res = await fetch('/api/capture/afrc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ searchType, searchValue: items[i] }),
        });
        const body = await res.json();
        if (body.success) collected.push(...(body.results as CaptureResult[]));
        else failures.push(`${items[i]}: ${body.error ?? 'capture failed'}`);
      } catch (e) {
        failures.push(`${items[i]}: ${(e as Error).message}`);
      }
      setProgress({ done: i + 1, total: items.length });
    }

    setResults((prev) => [...collected, ...prev]);
    if (failures.length > 0) setError(failures.join('\n'));
    setLoading(false);
    setProgress(null);
    setRefresh((n) => n + 1);
  }, [values, searchType, loading]);

  const zipItems = results.map((r) => ({
    filename: `afrc_${r.query.replace(/\s+/g, '_')}.png`,
    imageSrc: r.image,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="headline-section">AFRC CPA Register</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Search the AFRC Public Register of Certified Public Accountants (Practising).
          Enter multiple names or numbers for bulk capture — each is processed individually.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--color-surface-container)' }}>
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
                  disabled={loading}
                  style={{ accentColor: 'var(--color-primary-cta)', width: '1rem', height: '1rem' }}
                />
                <span className="text-sm font-medium">
                  {type === 'name' ? 'Search by Name' : 'Search by Practising Number'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="afrc-values"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-on-surface)' }}
          >
            {searchType === 'name' ? 'Names' : 'Practising Certificate Numbers'}
            <span className="label-meta block mt-1">One entry per line, max 10</span>
          </label>
          <BulkInput
            id="afrc-values"
            value={raw}
            onChange={setRaw}
            placeholder={searchType === 'name' ? 'e.g. Chan\nLee\nWong' : 'e.g. P01234\nP05678'}
            max={10}
            disabled={loading}
          />
        </div>

        <div className="flex justify-end">
          <CaptureButton isPending={loading} disabled={values.length === 0} onClick={capture} />
        </div>
      </div>

      {progress && (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: 'var(--color-on-surface-var)' }}>
            {progress.done} / {progress.total} captured
          </p>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <pre
          className="whitespace-pre-wrap error-block text-xs"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </pre>
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
                zipName={`afrc_${new Date().toISOString().slice(0, 10)}.zip`}
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
                  filename={`afrc_${r.query.replace(/\s+/g, '_')}.png`}
                />
              </figcaption>
              <div className="p-4 flex justify-center" style={{ background: 'var(--color-surface-highest)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={`AFRC capture — ${r.query}`}
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

      <RecentCaptures tool="afrc" refreshKey={refresh} />
    </div>
  );
}
