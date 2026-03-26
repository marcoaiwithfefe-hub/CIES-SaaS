import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES', { waitUntil: 'domcontentloaded' });
  
  const content = await page.content();
  fs.writeFileSync('./sfc-content.html', content);

  await browser.close();
})();
