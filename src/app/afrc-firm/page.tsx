import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { AfrcFirmPanel } from '@/components/panels/AfrcFirmPanel';

export const metadata: Metadata = {
  title: 'AFRC Firm — CIES Auditor',
  description: 'Search AFRC CPA firm public register.',
};

export default function AfrcFirmPage() {
  const isMockMode = process.env.MOCK_MODE === 'true';
  return (
    <DashboardShell>
      <AfrcFirmPanel isMockMode={isMockMode} />
    </DashboardShell>
  );
}
