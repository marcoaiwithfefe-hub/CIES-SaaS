'use client';

/**
 * CaptureSkeleton — animated shimmer shown while Playwright is running.
 *
 * Renders N skeleton cards (one per queued query) with a 1280×720 viewport
 * aspect-ratio placeholder so layout doesn't jump when the real screenshot arrives.
 *
 * ui-ux-pro-max: loading-states, aria-live, reduced-motion safe
 */

interface CaptureSkeletonProps {
  /** How many cards to render (one per queued query). Defaults to 1. */
  count?: number;
  /** Label shown in each card header strip. */
  label?: string;
}

function SkeletonBlock({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton-block ${className}`}
      aria-hidden="true"
      style={style}
    />
  );
}

export function CaptureSkeleton({ count = 1, label = 'Capturing…' }: CaptureSkeletonProps) {
  const cards = Array.from({ length: count });

  return (
    <section
      aria-label={`Loading ${count} capture result${count !== 1 ? 's' : ''}`}
      aria-busy="true"
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface-container)' }}
    >
      {/* Gallery header placeholder */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 15%, transparent)' }}
      >
        <div className="flex items-center gap-3">
          <SkeletonBlock style={{ width: 140, height: 18, borderRadius: 6 }} />
          <SkeletonBlock style={{ width: 56, height: 18, borderRadius: 20 }} />
        </div>
        <SkeletonBlock style={{ width: 100, height: 32, borderRadius: 8 }} />
      </div>

      <div
        className="divide-y"
        style={{ borderColor: 'color-mix(in srgb, var(--color-outline-var) 10%, transparent)' }}
      >
        {cards.map((_, i) => (
          <article key={i} className="p-5 space-y-4">
            {/* Article header */}
            <div className="flex items-center gap-3">
              <SkeletonBlock style={{ width: 120, height: 16, borderRadius: 4 }} />
              <SkeletonBlock style={{ width: 64, height: 16, borderRadius: 20 }} />
            </div>

            {/* Screenshot frame placeholder — 16:9 ratio matching 1280×720 viewport */}
            <figure
              className="screenshot-frame m-0"
              aria-label={`${label} screenshot ${i + 1}`}
            >
              {/* Caption bar */}
              <figcaption
                className="flex items-center justify-between px-4 py-2"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 10%, transparent)' }}
              >
                <SkeletonBlock style={{ width: 64, height: 12, borderRadius: 4 }} />
                <SkeletonBlock style={{ width: 80, height: 12, borderRadius: 4 }} />
              </figcaption>

              {/* Viewport shimmer — matches 16:9 ratio */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  paddingBottom: '56.25%',   // 720/1280 = 56.25%
                  background: 'var(--color-surface-highest)',
                }}
              >
                {/* Full-bleed shimmer overlay */}
                <div
                  className="absolute inset-0 skeleton-block"
                  aria-hidden="true"
                  style={{ borderRadius: 0 }}
                />

                {/* Faux browser chrome lines */}
                <div className="absolute inset-x-6 top-6 space-y-3" aria-hidden="true">
                  {/* Simulates a navigation bar */}
                  <SkeletonBlock style={{ width: '100%', height: 32, borderRadius: 6 }} />
                  {/* Simulates table rows */}
                  <SkeletonBlock style={{ width: '90%', height: 16, borderRadius: 4 }} />
                  <SkeletonBlock style={{ width: '75%', height: 16, borderRadius: 4 }} />
                  <SkeletonBlock style={{ width: '85%', height: 16, borderRadius: 4 }} />
                  <SkeletonBlock style={{ width: '60%', height: 16, borderRadius: 4 }} />
                  <SkeletonBlock style={{ width: '80%', height: 16, borderRadius: 4 }} />
                </div>
              </div>
            </figure>
          </article>
        ))}
      </div>
    </section>
  );
}
