import { chromium } from 'playwright';

async function testThemeMatrix() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(3000);

  // Go to Settings tab
  const settingsTab = page.locator('button:has-text("Settings"), div:has-text("Settings")').last();
  await settingsTab.click();
  await page.waitForTimeout(1000);

  // Verify theme selector
  const themeCard = page.locator('text=Theme').first();
  await themeCard.click();
  await page.waitForTimeout(800);

  // We should see Dark, Light, OLED, System
  const themes = ['Dark', 'OLED', 'Light', 'System', 'Light'];
  for (const theme of themes) {
    console.log(`Selecting theme: ${theme}`);
    const option = page.locator(`button:has-text("${theme}"), div:has-text("${theme}")`).last();
    if (await option.isVisible()) {
      await option.click();
      await page.waitForTimeout(600);
      
      const bodyClass = await page.evaluate(() => document.body.className);
      const htmlClass = await page.evaluate(() => document.documentElement.className);
      const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      console.log(`  -> htmlClass: "${htmlClass}", bodyClass: "${bodyClass}", bodyBg: "${bg}"`);
      
      if (theme !== 'Light') {
        // Reopen theme sheet for next selection
        const themeCardAgain = page.locator('text=Theme').first();
        await themeCardAgain.click();
        await page.waitForTimeout(600);
      }
    } else {
      console.log(`  Option ${theme} not directly clickable in sheet, searching...`);
    }
  }

  console.log(`\nConsole errors recorded: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  await browser.close();
}

testThemeMatrix().catch(e => {
  console.error(e);
  process.exit(1);
});
