import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { AfrcPanel } from '@/components/panels/AfrcPanel';

export const metadata: Metadata = {
  title: 'AFRC Individual — CIES Auditor',
  description: 'Search AFRC CPA public register for individual practitioners.',
};

export default function AfrcPage() {
  const isMockMode = process.env.MOCK_MODE === 'true';
  return (
    <DashboardShell>
      <AfrcPanel isMockMode={isMockMode} />
    </DashboardShell>
  );
}
