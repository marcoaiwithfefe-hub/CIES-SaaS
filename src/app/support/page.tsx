import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const metadata: Metadata = { title: 'Support — CIES Auditor' };

export default function SupportPage() {
  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="headline-section">Support</h1>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-var)' }}>
          Documentation and support resources — coming soon.
        </p>
      </div>
    </DashboardShell>
  );
}
