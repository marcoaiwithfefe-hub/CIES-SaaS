'use client';

import { useState, useCallback } from 'react';
import { HkexPanel } from '@/components/panels/HkexPanel';
import { SfcPanel } from '@/components/panels/SfcPanel';
import { AfrcPanel } from '@/components/panels/AfrcPanel';
import { AfrcFirmPanel } from '@/components/panels/AfrcFirmPanel';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

export type ToolId = 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';

/**
 * ToolWorkspace — Single-pane-of-glass workspace.
 *
 * All four tool panels are rendered simultaneously but only one is visible.
 * Switching tabs always preserves the state of hidden panels because they
 * are never unmounted — just hidden via `display: none`.
 *
 * The active tab is also persisted to sessionStorage so a page refresh
 * returns the user to the last-used tool.
 */
export function ToolWorkspace() {
  const [activeTab, setActiveTab] = useState<ToolId>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('activeToolTab');
      if (saved && ['hkex', 'sfc', 'afrc', 'afrc-firm'].includes(saved)) {
        return saved as ToolId;
      }
    }
    return 'hkex';
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTabChange = useCallback((tab: ToolId) => {
    setActiveTab(tab);
    setMobileOpen(false);
    try {
      sessionStorage.setItem('activeToolTab', tab);
    } catch {
      // sessionStorage might be unavailable in some contexts
    }
  }, []);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      {/* ── Desktop Sidebar (always visible ≥ lg) ── */}
      <div className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 h-full">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
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
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header
          className="flex lg:hidden items-center gap-4 px-4 py-3 shrink-0"
          style={{
            borderBottom: '1px solid color-mix(in srgb, var(--color-outline-var) 20%, transparent)',
            background: 'var(--color-surface-low)',
          }}
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

        {/* Scrollable Content Area — All panels always mounted, one visible */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--color-background)' }}
        >
          <div className="max-w-4xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
            {/* 
              KEEP-ALIVE PATTERN: All panels are always rendered.
              Only the active panel is visible. Hidden panels retain
              their component state (search inputs, results, etc.)
            */}
            <div style={{ display: activeTab === 'hkex' ? 'block' : 'none' }}>
              <HkexPanel />
            </div>
            <div style={{ display: activeTab === 'sfc' ? 'block' : 'none' }}>
              <SfcPanel />
            </div>
            <div style={{ display: activeTab === 'afrc' ? 'block' : 'none' }}>
              <AfrcPanel />
            </div>
            <div style={{ display: activeTab === 'afrc-firm' ? 'block' : 'none' }}>
              <AfrcFirmPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
