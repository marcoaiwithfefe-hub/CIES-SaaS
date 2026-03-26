import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { HkexPanel } from '@/components/panels/HkexPanel';

export const metadata: Metadata = {
  title: 'HKEX Tool — CIES Auditor',
  description: 'Capture HKEX regulatory compliance data for listed equities.',
};

/**
 * HKEX capture page — Server Component.
 * Mock mode is controlled by environment; panels are Client Components.
 */
export default function HkexPage() {
  const isMockMode = process.env.MOCK_MODE === 'true';

  return (
    <DashboardShell>
      <HkexPanel isMockMode={isMockMode} />
    </DashboardShell>
  );
}
