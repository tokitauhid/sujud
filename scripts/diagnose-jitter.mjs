import { chromium } from "playwright";

async function diagnose() {
  console.log("🔍 Diagnosing animation jitter with Playwright...");
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

  const snapshots = [];
  // Sample every 100ms for 8 seconds
  const startTime = Date.now();
  for (let i = 0; i < 75; i++) {
    const elapsed = Date.now() - startTime;
    const data = await page.evaluate(() => {
      const stage = document.querySelector("#sujud-loading-screen");
      if (!stage) return { visible: false };

      const activeImg = stage.querySelector('img[alt="Sujud animation"]');
      const logoImg = stage.querySelector('img[alt="Sujud Logo"]');
      const logoParent = logoImg ? logoImg.parentElement : null;

      const activeRect = activeImg ? activeImg.getBoundingClientRect() : null;
      const logoRect = logoImg ? logoImg.getBoundingClientRect() : null;
      const logoOpacity = logoParent ? window.getComputedStyle(logoParent).opacity : "0";

      return {
        visible: true,
        src: activeImg ? activeImg.getAttribute("src") : null,
        activeTop: activeRect ? activeRect.top : null,
        activeHeight: activeRect ? activeRect.height : null,
        logoTop: logoRect ? logoRect.top : null,
        logoOpacity,
      };
    });

    snapshots.push({ timeMs: elapsed, ...data });
    await page.waitForTimeout(100);
  }

  await browser.close();

  console.log("Captured", snapshots.length, "snapshots.");
  // Print whenever src changes
  let lastSrc = "";
  for (const s of snapshots) {
    if (s.src !== lastSrc) {
      console.log(`[t=${s.timeMs}ms] Frame: ${s.src} | logoOpacity: ${s.logoOpacity}`);
      lastSrc = s.src;
    }
  }
}

diagnose().catch(console.error);
