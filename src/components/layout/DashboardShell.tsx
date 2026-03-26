'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      {/* ── Desktop Sidebar (always visible ≥ lg) ── */}
      <div className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 h-full">
        <Sidebar />
      </div>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Sidebar Drawer ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col lg:hidden transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header
          className="flex lg:hidden items-center gap-4 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 20%, transparent)', background: 'var(--color-surface-low)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-ghost"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            style={{ minHeight: '44px', minWidth: '44px', padding: '0.5rem' }}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
          <p
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            CIES Internal Check
          </p>
        </header>

        {/* Scrollable Content Area */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--color-background)' }}
        >
          <div className="max-w-4xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
