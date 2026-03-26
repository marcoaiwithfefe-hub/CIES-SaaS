import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 }
  });
  const page = await context.newPage();
  await page.goto('https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK', { waitUntil: 'networkidle' });
  
  const formChildren = await page.evaluate(() => {
    const form = document.querySelector('form#mainform');
    return Array.from(form?.children || []).map(c => ({
      tagName: c.tagName,
      className: c.className,
      id: c.id
    }));
  });
  console.log("Form children:", formChildren);
  
  await browser.close();
}

test().catch(console.error);
