'use client';

import { AlertCircle, Download, Trash2 } from 'lucide-react';
import type { CaptureResult } from '@/actions/hkex';

interface ScreenshotGalleryProps {
  results: CaptureResult[];
  prefix: string;
  onClear?: () => void;
}

function downloadDataUrl(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Detects the FAIL_PLACEHOLDER SVG we inject when Playwright times out. */
function isFailPlaceholder(url: string): boolean {
  return url.startsWith('data:image/svg+xml') || url.includes('Capture+Failed') || url.includes('Capture Failed');
}

/**
 * ScreenshotGallery — responsive audit results.
 *
 * Each captured image is a data:image/png;base64,… string from the Server Action.
 * Failed captures are shown with a red "Capture Failed" badge overlay instead of
 * a broken <img> tag.
 *
 * ui-ux-pro-max: data-table alt, img alt text, no horizontal scroll on mobile
 */
export function ScreenshotGallery({ results, prefix, onClear }: ScreenshotGalleryProps) {
  if (results.length === 0) return null;

  const totalImages = results.reduce((acc, r) => acc + r.images.length, 0);

  const handleDownloadAll = async () => {
    if (results.length === 0) return;
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    for (const result of results) {
      for (let idx = 0; idx < result.images.length; idx++) {
        const url = result.images[idx];
        if (isFailPlaceholder(url)) continue; // don't package placeholder SVGs
        const filename = `${prefix}-${result.query.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${idx + 1}.png`;
        const base64 = url.startsWith('data:') ? url.split(',')[1] : null;
        if (base64) zip.file(filename, base64, { base64: true });
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadDataUrl(URL.createObjectURL(blob), `${prefix}-screenshots.zip`);
  };

  return (
    <section
      aria-label={`Capture results — ${totalImages} image${totalImages !== 1 ? 's' : ''} found`}
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface-container)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 15%, transparent)' }}
      >
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          Capture Results
          <span className="chip-regulatory ml-3">{totalImages} found</span>
        </h2>
        <div className="flex items-center gap-2">
          {onClear && (
            <button
              onClick={onClear}
              className="btn-ghost text-sm"
              aria-label="Clear all results"
              style={{ color: 'var(--color-error)' }}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
          <button
            onClick={handleDownloadAll}
            disabled={totalImages === 0}
            className="btn-secondary text-sm"
            aria-label="Download all screenshots as ZIP"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Download All</span>
          </button>
        </div>
      </div>

      {/* Results */}
      <div
        className="divide-y"
        style={{ borderColor: 'color-mix(in srgb, var(--color-outline-var) 10%, transparent)' }}
      >
        {results.map((result, rIdx) => (
          <article key={rIdx} className="p-5 space-y-4">
            <header className="flex items-center gap-3 flex-wrap">
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--color-on-surface)' }}
              >
                &ldquo;{result.query}&rdquo;
              </h3>
              <span className="chip-regulatory">
                {result.totalMatches} match{result.totalMatches !== 1 ? 'es' : ''}
              </span>
              {/* Timestamp */}
              {result.timestamp && (
                <span className="label-meta">
                  {new Date(result.timestamp).toLocaleTimeString('en-HK', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              )}
            </header>

            {result.totalMatches > 5 && (
              <div
                className="text-xs p-3 rounded-lg"
                role="alert"
                style={{
                  background: 'color-mix(in srgb, var(--color-tertiary-container) 20%, transparent)',
                  color: 'var(--color-tertiary)',
                }}
              >
                ⚠ Found {result.totalMatches} matches. Captured first 5 to prevent timeout — refine your search.
              </div>
            )}

            {result.images.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--color-on-surface-var)' }}>
                No matches found for this query.
              </p>
            ) : (
              <div className="table-scroll">
                <div className="space-y-3" style={{ minWidth: '320px' }}>
                  {result.images.map((url, idx) => {
                    const failed = isFailPlaceholder(url);
                    const filename = `${prefix}-${result.query.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${idx + 1}.png`;

                    return (
                      <figure key={idx} className="screenshot-frame m-0">
                        {/* Caption bar */}
                        <figcaption
                          className="flex items-center justify-between px-4 py-2 glass"
                          style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 10%, transparent)' }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="label-meta">Match {idx + 1}</span>
                            {/* Capture Failed badge */}
                            {failed && (
                              <span className="chip-capture-failed">
                                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                                Capture Failed
                              </span>
                            )}
                          </div>
                          {!failed && (
                            <button
                              onClick={() => downloadDataUrl(url, filename)}
                              className="btn-ghost text-xs"
                              aria-label={`Download match ${idx + 1} for ${result.query}`}
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              Download
                            </button>
                          )}
                        </figcaption>

                        {/* Screenshot — bound directly to base64 data URL */}
                        <div
                          className="p-4 flex justify-center"
                          style={{ background: 'var(--color-surface-highest)' }}
                        >
                          <img
                            /* src is bound to data:image/png;base64,… from the Server Action */
                            src={url}
                            alt={
                              failed
                                ? `Capture failed for ${result.query}`
                                : `Regulatory screenshot — ${result.query}, match ${idx + 1}`
                            }
                            className="max-w-full h-auto rounded"
                            loading="lazy"
                            style={{
                              border: failed
                                ? '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)'
                                : '1px solid color-mix(in srgb, var(--color-outline-var) 10%, transparent)',
                              opacity: failed ? 0.75 : 1,
                            }}
                          />
                        </div>
                      </figure>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
