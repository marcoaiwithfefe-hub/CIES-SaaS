export const MOCK_RESULTS = {
  hkex: [
    { query: '0005.HK', label: 'HSBC HOLDINGS' },
    { query: '3690.HK', label: 'MEITUAN-W' },
    { query: '9988.HK', label: 'BABA-SW' },
    { query: '1299.HK', label: 'AIA' },
  ],
};

export function getMockImageUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed.replace(/[^a-z0-9]/gi, '')}/1200/800`;
}

export function buildMockCaptureResult(
  query: string,
  seed?: string
): { query: string; images: string[]; totalMatches: number; timestamp: number } {
  return {
    query,
    images: [getMockImageUrl(seed ?? query)],
    totalMatches: 1,
    timestamp: Date.now(),
  };
}
