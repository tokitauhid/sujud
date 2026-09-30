import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "/home/tokit/.gemini/antigravity-ide/brain/5de18ede-c035-4603-a7a8-ca06ae83f4dd/light_mode_audit";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function audit() {
  console.log("🚀 Starting Playwright Audit for Light Mode vs Dark Mode...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Modern Android device viewport
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Error]: ${msg.text()}`);
    }
  });

  try {
    // 1. Visit with demo_data=1&no_onboarding=1
    console.log("Navigating to HomePage...");
    await page.goto("http://127.0.0.1:5173/HomePage?demo_data=1&no_onboarding=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1000);

    async function setAppTheme(theme) {
      await page.evaluate((t) => {
        localStorage.setItem("sujud_theme", t);
        document.body.classList.remove("dark", "oled", "light");
        if (t === "oled") {
          document.body.classList.add("dark", "oled");
        } else if (t === "light") {
          document.body.classList.add("light");
        } else {
          document.body.classList.add("dark");
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
          meta.setAttribute("content", t === "light" ? "#FAF7F4" : (t === "oled" ? "#000000" : "#121315"));
        }
      }, theme);
      await page.waitForTimeout(300);
    }

    // Capture Dark Mode Baseline
    await setAppTheme("dark");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_dark_home.png") });

    // Capture Light Mode HomePage
    await setAppTheme("light");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_light_home.png") });

    // 2. StatsPage
    console.log("Navigating to StatsPage...");
    await page.goto("http://127.0.0.1:5173/StatsPage?demo_data=1&no_onboarding=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);
    await setAppTheme("dark");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_dark_stats.png") });
    await setAppTheme("light");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_light_stats.png") });

    // Trends tab in StatsPage
    const trendsTabBtn = page.locator('ion-segment-button[value="trends"], button:has-text("Trends"), ion-label:has-text("Trends")').first();
    if (await trendsTabBtn.isVisible()) {
      await trendsTabBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "02_light_stats_trends.png") });
    }

    // 3. QuickLog Modal
    console.log("Opening QuickLog Modal...");
    const quickLogBtn = page.locator('ion-tab-button[tab="QuickLog"], [data-testid="quick-log-btn"]').first();
    if (await quickLogBtn.isVisible()) {
      await quickLogBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "03_light_quick_log.png") });
      // Close modal
      const closeBtn = page.locator('.quick-log-modal button[aria-label="Close"], button:has-text("Cancel"), [aria-label="Close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // 4. SalahTimesPage
    console.log("Navigating to SalahTimesPage...");
    await page.goto("http://127.0.0.1:5173/SalahTimesPage?demo_data=1&no_onboarding=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);
    await setAppTheme("dark");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_dark_prayers.png") });
    await setAppTheme("light");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_light_prayers.png") });

    // 5. SettingsPage
    console.log("Navigating to SettingsPage...");
    await page.goto("http://127.0.0.1:5173/SettingsPage?demo_data=1&no_onboarding=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);
    await setAppTheme("dark");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_dark_settings.png") });
    await setAppTheme("light");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_light_settings.png") });

    // Open Theme Options Sheet
    const themeRow = page.locator("#open-theme-options-sheet");
    if (await themeRow.isVisible()) {
      await themeRow.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "05_light_theme_sheet.png") });
      // Dismiss
      await page.evaluate(() => {
        document.querySelectorAll("ion-modal").forEach(m => m.dismiss && m.dismiss());
      });
      await page.waitForTimeout(300);
    }

    // Open Calculation Method Sheet
    const calcRow = page.locator("#open-calculation-method-sheet, [id*='calc'], [id*='method']").first();
    if (await calcRow.isVisible()) {
      await calcRow.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "05_light_calc_method_sheet.png") });
      await page.evaluate(() => {
        document.querySelectorAll("ion-modal").forEach(m => m.dismiss && m.dismiss());
      });
      await page.waitForTimeout(300);
    }

    // 6. Onboarding Screen in Light Mode
    console.log("Navigating to Cold Onboarding in Light Mode...");
    await page.goto("http://127.0.0.1:5173/?test_onboarding=1", {
      waitUntil: "commit",
    });
    // Set light mode in localStorage before page load
    await page.evaluate(() => {
      localStorage.setItem("sujud_theme", "light");
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06_light_cold_launch.png") });

    console.log("✔ Playwright audit initial capture complete! Saved to:", OUTPUT_DIR);
  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    await browser.close();
  }
}

audit();
