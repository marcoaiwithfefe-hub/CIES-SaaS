import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const metadata: Metadata = { title: 'Settings — CIES Auditor' };

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="headline-section">Settings</h1>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-var)' }}>
          System configuration and preferences — coming soon.
        </p>
      </div>
    </DashboardShell>
  );
}
