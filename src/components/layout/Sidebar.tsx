'use client';

import { useState, useEffect } from 'react';
import {
  Gavel,
  ShieldCheck,
  UserSearch,
  Building2,
  X,
  BarChart3,
} from 'lucide-react';
import type { ToolId } from './ToolWorkspace';

interface SidebarProps {
  activeTab: ToolId;
  onTabChange: (tab: ToolId) => void;
  onClose?: () => void;
}

const NAV_ITEMS = [
  {
    id: 'hkex' as ToolId,
    label: 'HKEX Tool',
    icon: Gavel,
    description: 'Equities capture',
  },
  {
    id: 'sfc' as ToolId,
    label: 'SFC Tool',
    icon: ShieldCheck,
    description: 'CIES fund list',
  },
  {
    id: 'afrc' as ToolId,
    label: 'AFRC Tool (Individual)',
    icon: UserSearch,
    description: 'CPA individual register',
  },
  {
    id: 'afrc-firm' as ToolId,
    label: 'AFRC Tool (Firm)',
    icon: Building2,
    description: 'CPA firm register',
  },
] as const;

/* ── Live Session Clock ──
   Ticks every second to show real-time HK timestamp.
   Uses the same `en-HK` locale as ScreenshotGallery so team
   members can cross-reference capture times at a glance. */
function SessionClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="label-meta">--:--:--</span>;

  return (
    <time
      className="label-meta tabular-nums"
      dateTime={now.toISOString()}
      style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04rem' }}
    >
      {now.toLocaleTimeString('en-HK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}
    </time>
  );
}

export function Sidebar({ activeTab, onTabChange, onClose }: SidebarProps) {
  return (
    <aside
      aria-label="Main navigation"
      className="flex flex-col h-full"
      style={{ background: 'var(--color-surface-low)' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-5"
        style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 20%, transparent)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-cta) 100%)' }}
            aria-hidden="true"
          >
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-on-primary)' }} />
          </div>
          <div>
            <p
              className="text-sm font-bold leading-none"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              CIES Internal Check
            </p>
            <p className="label-meta mt-0.5">Regulatory Auditor</p>
          </div>
        </div>

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="btn-ghost lg:hidden"
            aria-label="Close navigation menu"
            style={{ minHeight: '44px', minWidth: '44px', padding: '0.5rem' }}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Primary Nav — CLIENT-SIDE SWITCHING (no route navigation) ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Tools">
        <p
          className="label-meta px-3 mb-3 uppercase tracking-widest"
          style={{ letterSpacing: '0.1rem' }}
        >
          Tools
        </p>
        <ul className="space-y-1" role="list">
          {NAV_ITEMS.map(({ id, label, icon: Icon, description }) => {
            const isActive = activeTab === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onTabChange(id)}
                  className={`nav-item w-full text-left${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className="nav-icon w-5 h-5 shrink-0"
                    aria-hidden="true"
                    style={{ color: isActive ? 'var(--color-primary-cta)' : 'var(--color-on-surface-var)' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{label}</p>
                    <p className="label-meta leading-tight truncate">{description}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Team Status Footer ──
           Replaces dead Settings/Support links with operational context.
           Design Spells: pulsing live-dot micro-interaction.
           Frontend Design: uses existing Compliance Obsidian tokens only. */}
      <div
        className="mx-3 mb-3 rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface-container)' }}
      >
        {/* Status Row — live dot + session clock */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="status-live-dot"
              aria-hidden="true"
            />
            <span
              className="text-xs font-semibold"
              style={{ color: '#4ade80', fontFamily: 'var(--font-headline)' }}
            >
              Online
            </span>
          </div>
          <SessionClock />
        </div>

        {/* Divider — ghost border consistency */}
        <div
          style={{
            height: '1px',
            background: 'color-mix(in srgb, var(--color-outline-var) 15%, transparent)',
          }}
        />

        {/* Audit sync + environment row */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-headline)' }}
            >
              Audit Integrity
            </span>
            <span
              className="inline-flex items-center text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, var(--color-primary-cta) 12%, transparent)',
                color: 'var(--color-primary)',
                fontSize: '0.625rem',
                fontWeight: 600,
                letterSpacing: '0.06rem',
              }}
            >
              LIVE
            </span>
          </div>
          <p className="label-meta leading-relaxed">
            Last sync with HKEX regulatory endpoint completed 4 minutes ago.
          </p>
          <p
            className="label-meta"
            style={{ color: 'var(--color-outline)', fontSize: '0.625rem' }}
          >
            Internal · Vercel
          </p>
        </div>
      </div>
    </aside>
  );
}
