import type { Metadata } from 'next';
import { ToolWorkspace } from '@/components/layout/ToolWorkspace';

export const metadata: Metadata = {
  title: 'CIES Internal Regulatory Audit System',
  description:
    'Internal compliance intelligence terminal for HKEX, SFC, and AFRC regulatory data capture and audit.',
};

/**
 * Single-page workspace — all tool panels live here.
 *
 * Navigation between tools is handled client-side via ToolWorkspace
 * (display:none toggling) so that each panel's state (search inputs,
 * results, loading) is preserved across tab switches.
 */
export default function HomePage() {
  const isMockMode = process.env.MOCK_MODE === 'true';

  return <ToolWorkspace isMockMode={isMockMode} />;
}
