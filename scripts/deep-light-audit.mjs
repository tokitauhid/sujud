import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "/home/tokit/.gemini/antigravity-ide/brain/5de18ede-c035-4603-a7a8-ca06ae83f4dd/light_mode_audit";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function deepAudit() {
  console.log("🔍 Starting Deep Light Mode Audit...");

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

  const contrastIssues = [];

  // Helper to wait for loading screen to finish
  async function waitForAppReady() {
    console.log("Waiting for loading screen to complete...");
    // Fast-forward video if present to avoid waiting 10s on every fresh page load
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const v = document.querySelector("#sujud-loading-screen video");
      if (v) {
        v.currentTime = v.duration || 10;
        v.dispatchEvent(new Event("ended"));
      }
    });
    // Wait for #sujud-loading-screen to be gone
    await page.waitForSelector("#sujud-loading-screen", { state: "detached", timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // Helper to audit computed styles of visible elements on current screen
  async function scanVisibleContrast(screenName) {
    const issues = await page.evaluate((name) => {
      const results = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node;

      function parseRgb(colorStr) {
        if (!colorStr) return null;
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return null;
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: match[4] !== undefined ? parseFloat(match[4]) : 1,
        };
      }

      function getEffectiveBg(el) {
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const bg = window.getComputedStyle(cur).backgroundColor;
          const parsed = parseRgb(bg);
          if (parsed && parsed.a > 0.5) {
            return { color: bg, rgb: parsed };
          }
          cur = cur.parentElement;
        }
        return { color: "rgb(250, 247, 244)", rgb: { r: 250, g: 247, b: 244, a: 1 } };
      }

      function luminance(rgb) {
        const a = [rgb.r, rgb.g, rgb.b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }

      function contrastRatio(rgb1, rgb2) {
        const l1 = luminance(rgb1) + 0.05;
        const l2 = luminance(rgb2) + 0.05;
        return l1 > l2 ? l1 / l2 : l2 / l1;
      }

      while ((node = walker.nextNode())) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;

        // Check text elements
        const text = node.textContent?.trim();
        const hasDirectText = Array.from(node.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);

        if (hasDirectText && text) {
          const textColor = style.color;
          const textRgb = parseRgb(textColor);
          const bg = getEffectiveBg(node);

          if (textRgb && bg.rgb) {
            const ratio = contrastRatio(textRgb, bg.rgb);
            // In light mode, if text is near white (r > 220, g > 220, b > 220) on light bg (r > 200)
            const isWhiteTextOnLight = (textRgb.r > 210 && textRgb.g > 210 && textRgb.b > 210) && (bg.rgb.r > 200 && bg.rgb.g > 200 && bg.rgb.b > 200);
            if (ratio < 2.5 || isWhiteTextOnLight) {
              results.push({
                screen: name,
                type: "LOW_CONTRAST_TEXT",
                text: text.substring(0, 40),
                tagName: node.tagName,
                className: node.className.toString().substring(0, 100),
                textColor,
                bgColor: bg.color,
                ratio: ratio.toFixed(2),
              });
            }
          }
        }

        // Check inputs & placeholders
        if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
          const inputBg = style.backgroundColor;
          const inputColor = style.color;
          results.push({
            screen: name,
            type: "INPUT_STYLE",
            tagName: node.tagName,
            inputBg,
            inputColor,
          });
        }
      }

      return results;
    }, screenName);

    contrastIssues.push(...issues);
  }

  try {
    // 1. Initial Launch at HomePage
    await page.goto("http://127.0.0.1:5173/HomePage?demo_data=1&no_onboarding=1");
    await waitForAppReady();

    // 2. Set Theme to Light
    await page.evaluate(() => {
      localStorage.setItem("sujud_theme", "light");
      document.body.classList.remove("dark", "oled");
      document.body.classList.add("light");
      document.documentElement.classList.remove("dark", "oled");
      document.documentElement.classList.add("light");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#FAF7F4");
    });
    await page.waitForTimeout(500);

    console.log("Theme switched to Light. Body classes:", await page.evaluate(() => document.body.className));

    // Audit Screen 1: HomePage (Daily Tracker)
    console.log("Auditing HomePage...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_home_light.png") });
    await scanVisibleContrast("HomePage");

    // Click on a salah status cell in the table to open BottomSheetSalahStatus
    const statusCell = page.locator('.ReactVirtualized__Table__rowColumn button, .ReactVirtualized__Table__row button').first();
    if (await statusCell.isVisible()) {
      console.log("Opening BottomSheetSalahStatus...");
      await statusCell.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "sheet_salah_status_light.png") });
      await scanVisibleContrast("Sheet_SalahStatus");
      // Dismiss sheet by clicking outside/handle or escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // Audit Screen 2: StatsPage
    console.log("Auditing StatsPage...");
    const statsTab = page.locator('ion-tab-button[tab="StatsPage"]');
    await statsTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_stats_overview_light.png") });
    await scanVisibleContrast("StatsPage_Overview");

    // Scroll down on StatsPage to see other cards
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_stats_overview_scrolled_light.png") });
    await scanVisibleContrast("StatsPage_Scrolled");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // Trends Tab in StatsPage
    const trendsBtn = page.locator('ion-segment-button[value="trends"], ion-label:has-text("TRENDS"), button:has-text("TRENDS")').first();
    if (await trendsBtn.isVisible()) {
      await trendsBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_stats_trends_light.png") });
      await scanVisibleContrast("StatsPage_Trends");
    }

    // Audit Screen 3: QuickLog Modal
    console.log("Auditing QuickLog Modal...");
    const logTab = page.locator('ion-tab-button[tab="QuickLog"]');
    await logTab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_quick_log_light.png") });
    await scanVisibleContrast("QuickLog_Modal");
    // Dismiss quick log
    const closeBtn = page.locator('.quick-log-modal button[aria-label="Close"], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);

    // Audit Screen 4: SalahTimesPage (Prayers)
    console.log("Auditing SalahTimesPage...");
    const prayersTab = page.locator('ion-tab-button[tab="SalahTimesPage"]');
    await prayersTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_prayers_light.png") });
    await scanVisibleContrast("SalahTimesPage");

    // Audit Screen 5: SettingsPage (Config tab)
    console.log("Auditing SettingsPage...");
    const configTab = page.locator('ion-tab-button[tab="SettingsPage"]');
    await configTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screen_settings_light.png") });
    await scanVisibleContrast("SettingsPage");

    // Open Theme Options Sheet from SettingsPage
    const themeRow = page.locator("#open-theme-options-sheet");
    if (await themeRow.isVisible()) {
      await themeRow.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "sheet_theme_options_light.png") });
      await scanVisibleContrast("Sheet_ThemeOptions");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Open Edit Reasons Sheet
    const reasonsRow = page.locator("#open-edit-reasons-sheet");
    if (await reasonsRow.isVisible()) {
      await reasonsRow.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "sheet_edit_reasons_light.png") });
      await scanVisibleContrast("Sheet_EditReasons");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Save contrast issues report
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "contrast_issues.json"),
      JSON.stringify(contrastIssues, null, 2)
    );

    console.log(`\n==============================================`);
    console.log(`Deep audit finished. Total low contrast issues found: ${contrastIssues.length}`);
    console.log(`Screenshots saved to: ${OUTPUT_DIR}`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.error("Deep audit error:", err);
  } finally {
    await browser.close();
  }
}

deepAudit();
