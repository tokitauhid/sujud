import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/tokit/.gemini/antigravity-ide/brain/28df0017-3507-4472-8342-4855f1bb4931/jitter_frames";
fs.mkdirSync(OUT_DIR, { recursive: true });

async function captureAllFrames() {
  console.log("📸 Capturing all 12 frames in Playwright...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
  });

  await page.addInitScript(() => {
    localStorage.setItem("sujud_theme", "dark");
  });

  await page.goto("http://localhost:5173", { waitUntil: "commit" });

  let seenFrames = new Set();
  const startTime = Date.now();

  while (Date.now() - startTime < 8500) {
    const frameInfo = await page.evaluate(() => {
      const img = document.querySelector('#sujud-loading-screen img[alt="Sujud animation"]');
      const logoParent = document.querySelector('#sujud-loading-screen img[alt="Sujud Logo"]')?.parentElement;
      const logoOpacity = logoParent ? parseFloat(window.getComputedStyle(logoParent).opacity) : 0;
      return {
        src: img ? img.getAttribute("src") : null,
        isLogo: logoOpacity > 0.5,
      };
    });

    if (frameInfo.src && !seenFrames.has(frameInfo.src)) {
      seenFrames.add(frameInfo.src);
      const name = path.basename(frameInfo.src, ".webp");
      await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
      console.log(`Saved screenshot for ${name}`);
    }

    if (frameInfo.isLogo && !seenFrames.has("logo")) {
      seenFrames.add("logo");
      await page.screenshot({ path: path.join(OUT_DIR, `sujud_logo_final.png`) });
      console.log("Saved screenshot for logo");
    }

    await page.waitForTimeout(50);
  }

  await browser.close();
  console.log("Done capturing frames!");
}

captureAllFrames().catch(console.error);
