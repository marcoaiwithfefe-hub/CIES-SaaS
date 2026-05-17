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

  const pageUrl = page.url();
  const timestamp =
    new Date()
      .toLocaleString('en-GB', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      .replace(',', '') + ' HKT';

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
      await firstRow.waitFor({ state: 'visible', timeout: 20000 });
      await firstRow.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);

      await firstRow.evaluate(
        (row, { url, ts }) => {
          const urlRow = document.createElement('tr');
          urlRow.id = '__cies-url-bar__';
          urlRow.innerHTML = `<td colspan="99" style="background:#1e3a5f;color:#fff;padding:5px 12px;font-size:12px;font-family:monospace;white-space:nowrap;">${url}</td>`;
          row.parentNode?.insertBefore(urlRow, row);

          const tsRow = document.createElement('tr');
          tsRow.id = '__cies-ts-bar__';
          tsRow.innerHTML = `<td colspan="99" style="background:#e8f0fe;color:#333;padding:4px 12px;font-size:11px;font-family:monospace;white-space:nowrap;">Captured: ${ts}</td>`;
          row.parentNode?.insertBefore(tsRow, row.nextSibling);
        },
        { url: pageUrl, ts: timestamp },
      );

      const urlBarEl = page.locator('#__cies-url-bar__');
      const tsBarEl = page.locator('#__cies-ts-bar__');
      const [urlBox, rowBox, tsBox] = await Promise.all([
        urlBarEl.boundingBox(),
        firstRow.boundingBox(),
        tsBarEl.boundingBox(),
      ]);

      let image: Buffer;
      if (urlBox && rowBox && tsBox) {
        const clip = {
          x: Math.min(urlBox.x, rowBox.x, tsBox.x),
          y: urlBox.y,
          width: Math.max(urlBox.width, rowBox.width, tsBox.width),
          height: tsBox.y + tsBox.height - urlBox.y,
        };
        image = (await page.screenshot({ type: 'png', clip })) as Buffer;
      } else {
        image = (await firstRow.screenshot({ type: 'png' })) as Buffer;
      }

      await page.evaluate(() => {
        document.getElementById('__cies-url-bar__')?.remove();
        document.getElementById('__cies-ts-bar__')?.remove();
      });

      results.push({ query: name, image });
    } catch (e) {
      results.push({ query: name, image: null, error: (e as Error).message });
    }
  }
  return results;
}
