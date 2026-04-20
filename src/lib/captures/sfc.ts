import type { Page } from 'playwright-core';

const SFC_URL_EN =
  'https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES';
const SFC_URL_TC =
  'https://www.sfc.hk/tc/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES';

export interface SfcCaptureInput {
  fundNames: string[];
  language: 'en' | 'tc';
}

export interface SfcItemResult {
  query: string;
  image: Buffer | null;
  error?: string;
}

export async function captureSfc(page: Page, input: SfcCaptureInput): Promise<SfcItemResult[]> {
  const url = input.language === 'tc' ? SFC_URL_TC : SFC_URL_EN;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  try {
    const accordion = page.locator('.accordin_expand').first();
    if (await accordion.isVisible({ timeout: 5000 })) {
      await accordion.click();
      await page.waitForTimeout(600);
    }
  } catch {
    /* already expanded or different markup */
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    /* best effort */
  }

  const results: SfcItemResult[] = [];
  for (const rawName of input.fundNames) {
    const name = rawName.trim();
    if (!name) continue;
    try {
      const rowLocator = page.locator('tr', { hasText: name }).first();
      await rowLocator.waitFor({ state: 'visible', timeout: 6000 });
      await rowLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const image = (await rowLocator.screenshot({ type: 'png' })) as Buffer;
      results.push({ query: name, image });
    } catch (e) {
      results.push({ query: name, image: null, error: (e as Error).message });
    }
  }
  return results;
}
