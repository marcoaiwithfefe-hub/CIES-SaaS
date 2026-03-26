import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { SfcPanel } from '@/components/panels/SfcPanel';

export const metadata: Metadata = {
  title: 'SFC Tool — CIES Auditor',
  description: 'Search SFC CIES-eligible fund list for regulatory compliance.',
};

export default function SfcPage() {
  const isMockMode = process.env.MOCK_MODE === 'true';
  return (
    <DashboardShell>
      <SfcPanel isMockMode={isMockMode} />
    </DashboardShell>
  );
}
