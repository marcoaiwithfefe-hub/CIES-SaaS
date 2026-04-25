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
    const accordions = page.locator('.accordin_expand');
    const count = await accordions.count();
    for (let i = 0; i < count; i++) {
      try {
        const accordion = accordions.nth(i);
        if (await accordion.isVisible({ timeout: 2000 })) {
          await accordion.click();
          await page.waitForTimeout(400);
        }
      } catch {
        /* skip non-visible or already-expanded accordion */
      }
    }
  } catch {
    /* no accordions found — page may render differently */
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
      const words = name.split(/\s+/).filter(Boolean);
      let rowLocator = page.locator('tr');
      for (const word of words) {
        rowLocator = rowLocator.filter({ hasText: new RegExp(word, 'i') });
      }
      const firstRow = rowLocator.first();
      await firstRow.waitFor({ state: 'visible', timeout: 6000 });
      await firstRow.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const image = (await firstRow.screenshot({ type: 'png' })) as Buffer;
      results.push({ query: name, image });
    } catch (e) {
      results.push({ query: name, image: null, error: (e as Error).message });
    }
  }
  return results;
}
