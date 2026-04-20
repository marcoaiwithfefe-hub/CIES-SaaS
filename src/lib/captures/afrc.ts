import type { Page } from 'playwright-core';
import { robustClick, clipScreenshot } from '@/lib/playwright-utils';

const AFRC_URL =
  'https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx';

export interface AfrcCaptureInput {
  searchType: 'name' | 'regNo';
  searchValue: string;
}

export async function captureAfrc(page: Page, input: AfrcCaptureInput): Promise<Buffer> {
  await page.goto(AFRC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    /* best effort */
  }

  const inputSelector = input.searchType === 'name' ? '#vNAME' : '#vREGNO';
  const loc = page.locator(inputSelector).first();
  await loc.waitFor({ state: 'attached', timeout: 10000 });
  await loc.fill(input.searchValue, { force: true });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    robustClick(page, '#BTNUA_SEARCH', '#GridContainerDiv', 'afrc-search'),
  ]);

  await page.waitForTimeout(800).catch(() => {});
  return clipScreenshot(page);
}
