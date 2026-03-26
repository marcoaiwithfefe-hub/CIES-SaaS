'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gavel,
  ShieldCheck,
  UserSearch,
  Building2,
  Settings,
  HelpCircle,
  X,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

const NAV_ITEMS = [
  {
    href: '/',
    label: 'HKEX Tool',
    icon: Gavel,
    description: 'Equities capture',
  },
  {
    href: '/sfc',
    label: 'SFC Tool',
    icon: ShieldCheck,
    description: 'CIES fund list',
  },
  {
    href: '/afrc',
    label: 'AFRC Tool (Individual)',
    icon: UserSearch,
    description: 'CPA individual register',
  },
  {
    href: '/afrc-firm',
    label: 'AFRC Tool (Firm)',
    icon: Building2,
    description: 'CPA firm register',
  },
] as const;

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/support', label: 'Support', icon: HelpCircle },
] as const;

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();

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

      {/* ── Primary Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Tools">
        <p
          className="label-meta px-3 mb-3 uppercase tracking-widest"
          style={{ letterSpacing: '0.1rem' }}
        >
          Tools
        </p>
        <ul className="space-y-1" role="list">
          {NAV_ITEMS.map(({ href, label, icon: Icon, description }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={`nav-item${isActive ? ' active' : ''}`}
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
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Audit Integrity Badge ── */}
      <div
        className="px-5 py-3 mx-3 mb-3 rounded-lg"
        style={{ background: 'var(--color-surface-container)' }}
      >
        <p
          className="text-xs font-semibold mb-1"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-headline)' }}
        >
          Audit Integrity
        </p>
        <p className="label-meta leading-relaxed">
          Last synchronisation with HKEX regulatory endpoint completed 4 minutes ago.
        </p>
      </div>

      {/* ── Bottom Nav ── */}
      <div
        className="px-3 py-3"
        style={{ borderTop: '1px solid color-mix(in srgb, var(--color-outline-var) 20%, transparent)' }}
      >
        <ul className="space-y-1" role="list">
          {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                className="nav-item"
                aria-label={label}
              >
                <Icon
                  className="nav-icon w-5 h-5 shrink-0"
                  aria-hidden="true"
                  style={{ color: 'var(--color-on-surface-var)' }}
                />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
