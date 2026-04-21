'use client';

import { useCallback, useState } from 'react';
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

export function AfrcFirmPanel() {
  const [englishName, setEnglishName] = useState('');
  const [chineseName, setChineseName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [refresh, setRefresh] = useState(0);

  const canCapture = !loading && (englishName.trim() || chineseName.trim() || regNo.trim());

  const capture = useCallback(async () => {
    if (!canCapture) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/capture/afrc-firm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          englishName: englishName.trim() || undefined,
          chineseName: chineseName.trim() || undefined,
          regNo: regNo.trim() || undefined,
        }),
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
  }, [englishName, chineseName, regNo, canCapture]);

  const zipItems = results.map((r) => ({
    filename: `afrc-firm_${r.query.replace(/\s+/g, '_')}.png`,
    imageSrc: r.image,
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCapture) capture();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="headline-section">AFRC CPA Firm Register</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-var)' }}>
          Search the AFRC Public Register of CPA Firms and Corporate Practices.
          Fill in one or more fields — at least one is required.
        </p>
      </header>

      <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--color-surface-container)' }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="afrcFirm-enName"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-on-surface)' }}
            >
              English Name
            </label>
            <input
              id="afrcFirm-enName"
              type="text"
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Pricewaterhouse"
              disabled={loading}
              className="input-regulatory w-full"
            />
          </div>
          <div>
            <label
              htmlFor="afrcFirm-chName"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-on-surface)' }}
            >
              Chinese Name
            </label>
            <input
              id="afrcFirm-chName"
              type="text"
              value={chineseName}
              onChange={(e) => setChineseName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 羅兵咸"
              disabled={loading}
              className="input-regulatory w-full"
            />
          </div>
          <div>
            <label
              htmlFor="afrcFirm-regNo"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-on-surface)' }}
            >
              Registration Number
            </label>
            <input
              id="afrcFirm-regNo"
              type="text"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 0001"
              disabled={loading}
              className="input-regulatory w-full"
            />
          </div>
        </div>

        <p className="label-meta">At least one field is required. All filled fields are sent together.</p>

        <div className="flex justify-end">
          <CaptureButton isPending={loading} disabled={!canCapture} onClick={capture} />
        </div>
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

      {loading && (
        <p className="text-sm animate-pulse" style={{ color: 'var(--color-on-surface-var)' }}>
          Capturing AFRC Firm register…
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
                zipName={`afrc-firm_${new Date().toISOString().slice(0, 10)}.zip`}
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
                  filename={`afrc-firm_${r.query.replace(/\s+/g, '_')}.png`}
                />
              </figcaption>
              <div className="p-4 flex justify-center" style={{ background: 'var(--color-surface-highest)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={`AFRC Firm capture — ${r.query}`}
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

      <RecentCaptures tool="afrc-firm" refreshKey={refresh} />
    </div>
  );
}
