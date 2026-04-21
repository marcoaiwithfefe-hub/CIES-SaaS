'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface HistoryItem {
  id: string;
  tool: string;
  query: string;
  language?: 'en' | 'tc';
  timestamp: number;
  url: string;
}

interface Props {
  tool: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
  // Bump this number after a new capture to re-fetch the list
  refreshKey: number;
}

// ui-ux-pro-max: section landmark, loading handled gracefully (empty = hidden)
export function RecentCaptures({ tool, refreshKey }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetch(`/api/history?tool=${tool}&limit=5`)
      .then((r) => r.json())
      .then((j: { items?: HistoryItem[] }) => setItems(j.items ?? []))
      .catch(() => setItems([]));
  }, [tool, refreshKey]);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Recent captures"
      className="mt-6 pt-4"
      style={{ borderTop: '1px solid color-mix(in srgb, var(--color-outline-var) 20%, transparent)' }}
    >
      <h3
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-on-surface-var)', letterSpacing: '0.08rem' }}
      >
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        Recent captures (last 24 h)
      </h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--color-surface-high)' }}
          >
            <span
              className="truncate font-mono text-xs"
              style={{ color: 'var(--color-on-surface)' }}
            >
              {item.query}
              {item.language ? (
                <span className="ml-1.5" style={{ color: 'var(--color-on-surface-var)' }}>
                  ({item.language})
                </span>
              ) : null}
            </span>
            <span className="label-meta shrink-0">
              {new Date(item.timestamp).toLocaleTimeString('en-HK', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <a
              href={item.url}
              download={`${item.tool}_${item.query}${item.language ? `_${item.language}` : ''}.png`}
              className="shrink-0 text-xs font-medium"
              style={{ color: 'var(--color-primary-cta)' }}
            >
              re-download
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
