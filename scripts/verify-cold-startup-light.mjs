import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "/home/tokit/.gemini/antigravity-ide/brain/5de18ede-c035-4603-a7a8-ca06ae83f4dd/light_mode_audit";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function verifyColdStartup() {
  console.log("🎬 Verifying Cold Startup in Light Mode...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  // Set theme to light in localStorage before any script runs
  await page.addInitScript(() => {
    localStorage.setItem("sujud_theme", "light");
  });

  // Navigate to app
  console.log("Navigating cold launch with Light Mode preference...");
  await page.goto("http://127.0.0.1:5173/HomePage?demo_data=1", { waitUntil: "commit" });

  // Capture frame immediately (initial shell / first frame)
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "cold_launch_frame1_shell.png") });
  console.log("Captured frame 1 (initial shell)");

  // Check initial shell background color
  const shellBg = await page.evaluate(() => {
    const shell = document.getElementById("sujud-initial-shell");
    if (shell) return window.getComputedStyle(shell).backgroundColor;
    const body = document.body;
    return window.getComputedStyle(body).backgroundColor;
  });
  console.log("Frame 1 background color:", shellBg);

  // Capture frame while video is playing
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "cold_launch_frame2_video.png") });
  console.log("Captured frame 2 (video playing)");

  // Verify video properties
  const videoDetails = await page.evaluate(() => {
    const v = document.querySelector("#sujud-loading-screen video");
    if (!v) return null;
    const rect = v.getBoundingClientRect();
    const style = window.getComputedStyle(v);
    const parentRect = v.parentElement?.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      aspectRatio: rect.width / (rect.height || 1),
      objectFit: style.objectFit,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      muted: v.muted,
      paused: v.paused,
      currentTime: v.currentTime,
      parentWidth: parentRect?.width,
      parentHeight: parentRect?.height,
    };
  });
  console.log("Video Details:", JSON.stringify(videoDetails, null, 2));

  // Fast forward video to test smooth fade out into light mode
  await page.evaluate(() => {
    const v = document.querySelector("#sujud-loading-screen video");
    if (v) {
      v.currentTime = v.duration - 0.2;
    }
  });

  // Wait for loading screen to fade and detach
  await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);

  // Capture frame after loading screen is completely gone
  await page.screenshot({ path: path.join(OUTPUT_DIR, "cold_launch_frame3_light_revealed.png") });
  console.log("Captured frame 3 (light mode app revealed)");

  const revealedBg = await page.evaluate(() => {
    return {
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
      bodyClass: document.body.className,
      htmlClass: document.documentElement.className,
      themeColorMeta: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    };
  });
  console.log("Revealed App State:", JSON.stringify(revealedBg, null, 2));

  await browser.close();
  console.log("✅ Cold startup verification complete!");
}

verifyColdStartup();
