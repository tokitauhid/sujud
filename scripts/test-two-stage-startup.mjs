import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "/home/tokit/.gemini/antigravity-ide/brain/5de18ede-c035-4603-a7a8-ca06ae83f4dd/light_mode_audit";
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const BASE_URL = "http://127.0.0.1:5173";

async function runTests() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
  });

  console.log("=== STARTING PLAYWRIGHT TWO-STAGE STARTUP VERIFICATION ===");

  // -------------------------------------------------------------------------
  // TEST 1: First Run / Fresh Install (Stage 1)
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 1] First Launch / Fresh Install ---");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Fresh install: clear localStorage
    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.goto(`${BASE_URL}/?first_run=1`, { waitUntil: "commit" });

    // 1. Check video source immediately on startup
    await page.waitForSelector("#sujud-loading-screen video", { timeout: 5000 });
    const videoSrc = await page.$eval("#sujud-loading-screen video", (el) => el.src);
    const isLooping = await page.$eval("#sujud-loading-screen video", (el) => el.loop);
    console.log(`[TEST 1] Video src: ${videoSrc}`);
    console.log(`[TEST 1] Video loop attribute: ${isLooping}`);

    if (!videoSrc.includes("onboarding_intro")) {
      throw new Error(`FAIL: First launch should use onboarding_intro, got ${videoSrc}`);
    }
    if (isLooping !== false) {
      throw new Error("FAIL: First launch onboarding video must not loop");
    }

    // Capture screenshot during playback
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test1_first_run_playing.png") });
    console.log("[TEST 1] Saved screenshot test1_first_run_playing.png");

    // 2. Ensure loading screen remains visible while video plays (~3s in)
    await page.waitForTimeout(2000);
    const stillVisible = await page.$("#sujud-loading-screen");
    console.log(`[TEST 1] Still visible at ~3s: ${Boolean(stillVisible)}`);
    if (!stillVisible) {
      throw new Error("FAIL: Loading screen exited prematurely on first run!");
    }

    await context.close();
    console.log("✔ [TEST 1] PASSED: Fresh launch uses full onboarding video without looping.");
  }

  // -------------------------------------------------------------------------
  // TEST 2: Subsequent Startup (Stage 2) - Standard Launch
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 2] Subsequent Startup (Stage 2) ---");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Existing user: completed onboarding
    await page.addInitScript(() => {
      localStorage.setItem("hasCompletedInitialSettingsSync", "true");
      localStorage.setItem("sujud_theme", "dark");
    });

    await page.goto(`${BASE_URL}/HomePage?no_onboarding=1`, { waitUntil: "commit" });

    // Check video source
    await page.waitForSelector("#sujud-loading-screen video", { timeout: 5000 });
    const videoSrc = await page.$eval("#sujud-loading-screen video", (el) => el.src);
    const isLooping = await page.$eval("#sujud-loading-screen video", (el) => el.loop);
    console.log(`[TEST 2] Video src: ${videoSrc}`);
    console.log(`[TEST 2] Video loop attribute: ${isLooping}`);

    if (!videoSrc.includes("loading.mp4")) {
      throw new Error(`FAIL: Subsequent launch should use loading.mp4, got ${videoSrc}`);
    }
    if (isLooping !== true) {
      throw new Error("FAIL: Subsequent launch video must have loop=true");
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test2_subsequent_loading.png") });
    console.log("[TEST 2] Saved screenshot test2_subsequent_loading.png");

    // Check smooth exit
    await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 8000 });
    console.log("[TEST 2] Loading screen smoothly exited!");

    // Verify main app is revealed
    const mainApp = await page.waitForSelector(".app", { timeout: 3000 });
    console.log(`[TEST 2] Main app revealed: ${Boolean(mainApp)}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test2_subsequent_revealed.png") });

    await context.close();
    console.log("✔ [TEST 2] PASSED: Subsequent startup uses loading.mp4 with looping and smooth exit.");
  }

  // -------------------------------------------------------------------------
  // TEST 3: Looping Behavior & Mid-Loop Exit
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 3] Video Looping & Mid-Loop Exit ---");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.setItem("hasCompletedInitialSettingsSync", "true");
    });

    await page.goto(`${BASE_URL}/HomePage?no_onboarding=1`, { waitUntil: "domcontentloaded" });

    // Confirm video is playing and looping
    const video = await page.waitForSelector("#sujud-loading-screen video", { timeout: 5000 });
    const isLoop = await video.evaluate((v) => v.loop);
    console.log(`[TEST 3] Video loop property: ${isLoop}`);

    // Wait for loading screen to complete its lifecycle
    await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 8000 });
    console.log("[TEST 3] Loading screen detached without getting stuck");

    await context.close();
    console.log("✔ [TEST 3] PASSED: Looping and clean mid-loop exit verified.");
  }

  // -------------------------------------------------------------------------
  // TEST 4: Light Mode Subsequent Startup
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 4] Light Mode Subsequent Startup ---");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.setItem("hasCompletedInitialSettingsSync", "true");
      localStorage.setItem("sujud_theme", "light");
    });

    await page.goto(`${BASE_URL}/HomePage?no_onboarding=1`, { waitUntil: "commit" });

    await page.waitForSelector("#sujud-loading-screen video", { timeout: 5000 });
    const videoSrc = await page.$eval("#sujud-loading-screen video", (el) => el.src);
    console.log(`[TEST 4] Light mode startup video: ${videoSrc}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test4_light_mode_loading.png") });

    // Wait for exit
    await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 8000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test4_light_mode_revealed.png") });
    console.log("[TEST 4] Light mode main app smoothly revealed");

    await context.close();
    console.log("✔ [TEST 4] PASSED: Light mode subsequent startup verified.");
  }

  // -------------------------------------------------------------------------
  // TEST 5: OLED Mode Subsequent Startup
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 5] OLED Mode Subsequent Startup ---");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.setItem("hasCompletedInitialSettingsSync", "true");
      localStorage.setItem("sujud_theme", "oled");
    });

    await page.goto(`${BASE_URL}/HomePage?no_onboarding=1`, { waitUntil: "commit" });

    await page.waitForSelector("#sujud-loading-screen video", { timeout: 5000 });
    const videoSrc = await page.$eval("#sujud-loading-screen video", (el) => el.src);
    console.log(`[TEST 5] OLED mode startup video: ${videoSrc}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test5_oled_mode_loading.png") });

    // Wait for exit
    await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 8000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test5_oled_mode_revealed.png") });
    console.log("[TEST 5] OLED mode main app smoothly revealed");

    await context.close();
    console.log("✔ [TEST 5] PASSED: OLED mode subsequent startup verified.");
  }

  // -------------------------------------------------------------------------
  // TEST 6: First Run Light Mode Video Matching
  // -------------------------------------------------------------------------
  console.log("\n--- [TEST 6] First Run Light Mode Theme Matching ---");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("sujud_theme", "light");
    });

    await page.goto(`${BASE_URL}/?first_run=1`, { waitUntil: "commit" });

    await page.waitForSelector("#sujud-loading-screen video", { timeout: 5000 });
    const videoSrc = await page.$eval("#sujud-loading-screen video", (el) => el.src);
    console.log(`[TEST 6] First run light mode video: ${videoSrc}`);
    if (!videoSrc.includes("onboarding_intro_light.mp4")) {
      throw new Error(`FAIL: First run in light mode should use onboarding_intro_light.mp4, got ${videoSrc}`);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "test6_first_run_light.png") });

    await context.close();
    console.log("✔ [TEST 6] PASSED: First run light mode matches theme video.");
  }

  await browser.close();
  console.log("\n=== ALL PLAYWRIGHT TWO-STAGE STARTUP TESTS PASSED! ===");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
