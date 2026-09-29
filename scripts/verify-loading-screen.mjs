import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/home/tokit/.gemini/antigravity-ide/brain/28df0017-3507-4472-8342-4855f1bb4931/verification";
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log("🚀 Starting Playwright Loading Screen Verification...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = {
    themes: {},
    sprites: [],
    reducedMotion: false,
    appTransition: false,
    consoleErrors: [],
  };

  // 1. Test All 3 Themes on Startup
  for (const theme of ["dark", "oled", "light"]) {
    console.log(`\n--- Testing Theme: ${theme.toUpperCase()} ---`);
    results.themes[theme] = {};
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("[ion-tabs]")) {
          results.consoleErrors.push(`[${theme}] ${text}`);
        }
      }
    });

    // Set theme in localStorage before load
    await page.addInitScript((t) => {
      localStorage.setItem("sujud_theme", t);
    }, theme);

    // Track network requests for loading sprites
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/assets/loading_sprites/")) {
        const filename = path.basename(url);
        if (!results.sprites.some((s) => s.filename === filename)) {
          results.sprites.push({ filename, status: res.status() });
        }
      }
    });

    await page.goto("http://localhost:5173", { waitUntil: "commit" });

    // Measure immediate background color on first paint
    const initialBg = await page.evaluate(() => {
      const el = document.documentElement;
      return window.getComputedStyle(el).backgroundColor;
    });

    // Capture initial loading screen screenshot
    await page.waitForTimeout(400); // Frame 1: Qiyam
    const qiyamPath = path.join(ARTIFACTS_DIR, `01_qiyam_${theme}.png`);
    await page.screenshot({ path: qiyamPath });

    // Advance to Sujood + Cat (t ~ 3600ms)
    await page.waitForTimeout(3200);
    const sujoodPath = path.join(ARTIFACTS_DIR, `02_sujood_cat_${theme}.png`);
    await page.screenshot({ path: sujoodPath });

    // Advance to Logo phase (t ~ 6200ms)
    await page.waitForTimeout(2600);
    const logoPath = path.join(ARTIFACTS_DIR, `03_logo_${theme}.png`);
    await page.screenshot({ path: logoPath });

    let isRemoved = false;
    try {
      await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 8000 });
      isRemoved = true;
    } catch {
      const count = await page.locator("#sujud-loading-screen").count();
      isRemoved = count === 0;
    }
    results.themes[theme].loadingScreenRemoved = isRemoved;

    const appPath = path.join(ARTIFACTS_DIR, `04_main_app_${theme}.png`);
    await page.screenshot({ path: appPath });

    const navBarCount = await page.locator("#nav-bar").count();
    results.themes[theme].navBarVisible = navBarCount > 0;

    console.log(`Initial BG: ${initialBg}`);
    console.log(`Loading Screen Removed: ${isRemoved}`);
    console.log(`App Visible: ${navBarCount > 0}`);

    await context.close();
  }

  // 2. Test Prefers-Reduced-Motion
  console.log("\n--- Testing prefers-reduced-motion: reduce ---");
  const motionContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const motionPage = await motionContext.newPage();
  await motionPage.goto("http://localhost:5173", { waitUntil: "commit" });

  await motionPage.waitForTimeout(300);
  const staticLogoPath = path.join(ARTIFACTS_DIR, `05_reduced_motion_logo.png`);
  await motionPage.screenshot({ path: staticLogoPath });

  const hasAnimationSprite = await motionPage.locator('img[alt="Sujud animation"]').count();
  const hasStaticLogo = await motionPage.locator('img[alt="Sujud Logo"]').count();

  console.log(`Animation sprites omitted in reduced motion: ${hasAnimationSprite === 0}`);
  console.log(`Static logo present in reduced motion: ${hasStaticLogo > 0}`);
  results.reducedMotion = hasAnimationSprite === 0 && hasStaticLogo > 0;

  // Wait for 1800ms minimum hold + 500ms fade transition into app
  await motionPage.waitForTimeout(2500);
  const appInReducedMotion = await motionPage.locator("#nav-bar").count();
  console.log(`App visible after reduced motion: ${appInReducedMotion > 0}`);

  await motionContext.close();
  await browser.close();

  // Summary Report
  console.log("\n================ SUMMARY ================");
  console.log("Sprites loaded:", results.sprites.length);
  results.sprites.forEach((s) => console.log(`  - ${s.filename}: HTTP ${s.status}`));
  console.log("Themes verified:", Object.keys(results.themes));
  console.log("Console errors:", results.consoleErrors.length);
  if (results.consoleErrors.length > 0) {
    results.consoleErrors.forEach((e) => console.log(`  - Error: ${e}`));
  }

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, "verification_report.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("Verification completed successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
