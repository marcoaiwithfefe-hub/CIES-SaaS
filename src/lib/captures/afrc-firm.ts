import type { Page } from 'playwright-core';
import { robustClick, clipScreenshot } from '@/lib/playwright-utils';

const AFRC_FIRM_URL =
  'https://armies.afrc.org.hk/registration/ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx';

export interface AfrcFirmCaptureInput {
  englishName?: string;
  chineseName?: string;
  regNo?: string;
}

export async function captureAfrcFirm(
  page: Page,
  input: AfrcFirmCaptureInput,
): Promise<Buffer> {
  await page.goto(AFRC_FIRM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    /* best effort */
  }

  const fills: Array<[string, string | undefined]> = [
    ['#vNAME', input.englishName],
    ['#vCHINESENAME', input.chineseName],
    ['#vREGNO', input.regNo],
  ];
  for (const [sel, value] of fills) {
    if (!value) continue;
    const loc = page.locator(sel).first();
    await loc.waitFor({ state: 'attached', timeout: 10000 });
    await loc.fill(value, { force: true });
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    robustClick(page, '#BTNUA_SEARCH', '#GridContainerDiv', 'afrc-firm-search'),
  ]);
  await page.waitForTimeout(800).catch(() => {});
  return clipScreenshot(page);
}
