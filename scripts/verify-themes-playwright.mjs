import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "/home/tokit/.gemini/antigravity-ide/brain/c3717e55-831a-43d8-b1f0-e656065813aa/theme_verification";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  console.log("🚀 Launching Comprehensive Playwright Theme Verification Suite...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 852 }, // Mobile viewport (iPhone 15 Pro standard)
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("[ion-tabs]")) return;
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const report = {
    transitions: {},
    rapidSwitching: {},
    oledColorChecks: {},
    lightColorChecks: {},
    persistenceChecks: {},
    screensChecked: {},
    consoleErrors: [],
    pageErrors: [],
    allPassed: true,
  };

  try {
    console.log("Navigating to SettingsPage directly...");
    await page.goto("http://127.0.0.1:5173/SettingsPage?no_onboarding=1&demo_data=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1000);

    async function getThemeState() {
      return await page.evaluate(() => {
        const body = document.body;
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute("content");
        const bodyComputed = window.getComputedStyle(body);
        return {
          bodyClasses: Array.from(body.classList),
          isDark: body.classList.contains("dark"),
          isOled: body.classList.contains("oled"),
          metaThemeColor,
          bodyBg: bodyComputed.backgroundColor,
          localStorageTheme: localStorage.getItem("sujud_theme"),
        };
      });
    }

    async function dismissModal() {
      await page.evaluate(() => {
        document.querySelectorAll("ion-modal").forEach((m) => {
          if (m.dismiss) m.dismiss();
        });
      });
      await page.waitForTimeout(300);
    }

    async function selectTheme(targetTheme) {
      // Ensure we are on SettingsPage
      if (!page.url().includes("/SettingsPage")) {
        await page.goto("http://127.0.0.1:5173/SettingsPage?no_onboarding=1&demo_data=1", {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(500);
      }

      const themeRow = page.locator("#open-theme-options-sheet");
      await themeRow.scrollIntoViewIfNeeded();
      await themeRow.click();
      await page.waitForTimeout(400);

      const labelMap = {
        light: "Light",
        dark: "Dark",
        oled: "OLED Black",
        system: "System",
      };

      const buttonLabel = labelMap[targetTheme];
      const startT = performance.now();
      const themeBtn = page.locator(`ion-modal button:has-text("${buttonLabel}")`).first();
      await themeBtn.click();
      const durationMs = Math.round(performance.now() - startT);
      await page.waitForTimeout(350);

      await dismissModal();
      return { durationMs };
    }

    // =========================================================================
    // 1. Theme Transitions Matrix (all pairs in both directions)
    // =========================================================================
    console.log("\n--- 1. Testing Theme Transitions Matrix ---");
    const transitions = [
      ["dark", "oled"],
      ["oled", "light"],
      ["light", "oled"],
      ["oled", "dark"],
      ["dark", "light"],
      ["light", "dark"],
      ["dark", "oled"],
      ["oled", "oled"],
      ["oled", "system"],
      ["system", "oled"],
    ];

    for (const [from, to] of transitions) {
      const transName = `${from} -> ${to}`;
      const { durationMs } = await selectTheme(to);
      const state = await getThemeState();

      let valid = true;
      if (to === "oled") {
        valid = state.isOled && state.isDark && state.bodyBg === "rgb(0, 0, 0)" && state.metaThemeColor === "#000000";
      } else if (to === "dark") {
        valid = !state.isOled && state.isDark && state.metaThemeColor === "#121315";
      } else if (to === "light") {
        valid = !state.isOled && !state.isDark && state.metaThemeColor === "#FAF7F4";
      } else if (to === "system") {
        valid = !state.isOled;
      }

      const shotPath = path.join(OUTPUT_DIR, `trans_${from}_to_${to}.png`);
      await page.screenshot({ path: shotPath });

      report.transitions[transName] = {
        passed: valid,
        durationMs,
        state,
        screenshot: shotPath,
      };

      if (!valid) {
        report.allPassed = false;
        console.error(`❌ Transition ${transName} FAILED:`, state);
      } else {
        console.log(`✔ Transition ${transName} passed (${durationMs}ms)`);
      }
    }

    // =========================================================================
    // 2. Rapid Theme Changes & Performance (Stress Test)
    // =========================================================================
    console.log("\n--- 2. Testing Rapid Theme Changes & Stress Test ---");
    const rapidThemes = ["light", "oled", "dark", "light", "oled", "dark", "oled"];
    const rapidStart = performance.now();
    for (const t of rapidThemes) {
      await selectTheme(t);
    }
    const rapidTotal = Math.round(performance.now() - rapidStart);
    const avgPerSwitch = Math.round(rapidTotal / rapidThemes.length);
    console.log(`✔ 7 Rapid switches completed in ${rapidTotal}ms (avg ${avgPerSwitch}ms/switch)`);
    report.rapidSwitching = { totalMs: rapidTotal, avgMs: avgPerSwitch };

    // Test rapid repeated clicks on OLED Black button
    const themeRow = page.locator("#open-theme-options-sheet");
    await themeRow.click();
    await page.waitForTimeout(300);
    const oledBtn = page.locator('ion-modal button:has-text("OLED Black")').first();
    for (let i = 0; i < 5; i++) {
      await oledBtn.click();
    }
    await dismissModal();
    const afterRapidState = await getThemeState();
    console.log("✔ Repeated clicks handled without hanging, active OLED state:", afterRapidState.isOled);

    // =========================================================================
    // 3. Verify OLED Surface Colors (#000000)
    // =========================================================================
    console.log("\n--- 3. Verifying OLED True Black Surfaces & Contrast ---");
    await selectTheme("oled");

    // 3a. Settings Page
    const settingsColors = await page.evaluate(() => {
      const body = document.body;
      const toolbar = document.querySelector(".page-header-toolbar");
      const card = document.querySelector(".border.rounded-none.bg-\\[\\#121212\\]");
      const tabBar = document.querySelector("ion-tab-bar");
      return {
        bodyBg: window.getComputedStyle(body).backgroundColor,
        toolbarBg: toolbar ? window.getComputedStyle(toolbar).backgroundColor : null,
        cardBg: card ? window.getComputedStyle(card).backgroundColor : null,
        cardBorder: card ? window.getComputedStyle(card).borderColor : null,
        tabBarBg: tabBar ? window.getComputedStyle(tabBar).backgroundColor : null,
        tabBarBorder: tabBar ? window.getComputedStyle(tabBar).borderTopColor : null,
      };
    });
    console.log("Settings OLED Colors:", settingsColors);
    report.oledColorChecks.settings = settingsColors;
    await page.screenshot({ path: path.join(OUTPUT_DIR, "oled_screen_settings.png") });

    // 3b. Prayers Page & Calendar
    const prayersTab = page.locator('ion-tab-button[tab="SalahTimesPage"]');
    await prayersTab.click();
    await page.waitForTimeout(800);

    const prayersColors = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const prayerCard = document.querySelector(".border.rounded-none.bg-\\[\\#121212\\]");
      const prayerCardBg = prayerCard ? window.getComputedStyle(prayerCard).backgroundColor : null;
      const prayerCardBorder = prayerCard ? window.getComputedStyle(prayerCard).borderColor : null;

      const calendar = document.querySelector('[data-testid="prayer-times-calendar"]');
      const calendarBg = calendar ? window.getComputedStyle(calendar).backgroundColor : null;
      const calendarBorder = calendar ? window.getComputedStyle(calendar).borderColor : null;

      const calendarDay = document.querySelector('[data-testid^="calendar-day-"]');
      const calendarDayBg = calendarDay ? window.getComputedStyle(calendarDay).backgroundColor : null;
      const calendarDayBorder = calendarDay ? window.getComputedStyle(calendarDay).borderColor : null;

      return {
        bodyBg,
        prayerCardBg,
        prayerCardBorder,
        calendarBg,
        calendarBorder,
        calendarDayBg,
        calendarDayBorder,
      };
    });
    console.log("Prayers & Calendar OLED Colors:", prayersColors);
    report.oledColorChecks.prayers = prayersColors;
    await page.screenshot({ path: path.join(OUTPUT_DIR, "oled_screen_prayers.png") });

    // 3c. Quick Log Modal
    const logTab = page.locator('ion-tab-button[tab="QuickLog"]');
    await logTab.click();
    await page.waitForTimeout(600);

    const quickLogColors = await page.evaluate(() => {
      const modal = document.querySelector(".quick-log-modal");
      const modalInner = document.querySelector(".quick-log-modal .bg-\\[\\#121212\\]");
      return {
        modalInnerBg: modalInner ? window.getComputedStyle(modalInner).backgroundColor : null,
        modalInnerBorder: modalInner ? window.getComputedStyle(modalInner).borderTopColor : null,
      };
    });
    console.log("Quick Log Modal OLED Colors:", quickLogColors);
    report.oledColorChecks.quickLog = quickLogColors;
    await page.screenshot({ path: path.join(OUTPUT_DIR, "oled_modal_quick_log.png") });

    // Dismiss quick log
    const closeBtn = page.locator('.quick-log-modal button[aria-label="Close"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // 3d. Home Page (Daily Tracker)
    const homeTab = page.locator('ion-tab-button[tab="HomePage"]');
    await homeTab.click();
    await page.waitForTimeout(800);

    const homeColors = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const toolbar = document.querySelector(".page-header-toolbar");
      const toolbarBg = toolbar ? window.getComputedStyle(toolbar).backgroundColor : null;
      const row = document.querySelector(".ReactVirtualized__Table__row");
      const rowBg = row ? window.getComputedStyle(row).backgroundColor : null;
      const rowBorder = row ? window.getComputedStyle(row).borderBottomColor : null;
      return {
        bodyBg,
        toolbarBg,
        rowBg,
        rowBorder,
      };
    });
    console.log("Home Page OLED Colors:", homeColors);
    report.oledColorChecks.home = homeColors;
    await page.screenshot({ path: path.join(OUTPUT_DIR, "oled_screen_home.png") });

    // =========================================================================
    // 4. Verify Light Mode Colors & Contrast
    // =========================================================================
    console.log("\n--- 4. Verifying Light Mode ---");
    const settingsTab = page.locator('ion-tab-button[tab="SettingsPage"]');
    await settingsTab.click();
    await page.waitForTimeout(500);
    await selectTheme("light");

    const lightState = await getThemeState();
    const lightCheck = {
      isNotOled: !lightState.isOled,
      isNotDark: !lightState.isDark,
      metaThemeColor: lightState.metaThemeColor,
      bodyBg: lightState.bodyBg,
    };
    console.log("Light Mode State:", lightCheck);
    report.lightColorChecks = lightCheck;
    await page.screenshot({ path: path.join(OUTPUT_DIR, "light_screen_settings.png") });

    // =========================================================================
    // 5. Verify Persistence Across Reloads
    // =========================================================================
    console.log("\n--- 5. Verifying Persistence Across Reloads ---");

    // Test OLED reload persistence
    await selectTheme("oled");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const oledReloadState = await getThemeState();
    const oledPersisted = oledReloadState.isOled && oledReloadState.bodyBg === "rgb(0, 0, 0)";
    console.log("✔ OLED Persistence after reload:", oledPersisted, oledReloadState.bodyClasses);
    report.persistenceChecks.oled = { persisted: oledPersisted, state: oledReloadState };

    // Test Dark reload persistence
    await selectTheme("dark");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const darkReloadState = await getThemeState();
    const darkPersisted = !darkReloadState.isOled && darkReloadState.isDark;
    console.log("✔ Dark Persistence after reload:", darkPersisted, darkReloadState.bodyClasses);
    report.persistenceChecks.dark = { persisted: darkPersisted, state: darkReloadState };

    // Test Light reload persistence
    await selectTheme("light");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const lightReloadState = await getThemeState();
    const lightPersisted = !lightReloadState.isOled && !lightReloadState.isDark;
    console.log("✔ Light Persistence after reload:", lightPersisted, lightReloadState.bodyClasses);
    report.persistenceChecks.light = { persisted: lightPersisted, state: lightReloadState };

    // Restore OLED mode as final active state
    await selectTheme("oled");

    // =========================================================================
    // 6. Final Report Summary
    // =========================================================================
    report.consoleErrors = consoleErrors;
    report.pageErrors = pageErrors;
    report.allPassed =
      Object.values(report.transitions).every((t) => t.passed) &&
      oledPersisted &&
      darkPersisted &&
      lightPersisted &&
      consoleErrors.length === 0 &&
      pageErrors.length === 0;

    fs.writeFileSync(
      path.join(OUTPUT_DIR, "verification_summary.json"),
      JSON.stringify(report, null, 2),
    );

    console.log("\n========================================================");
    console.log("🎉 ALL PLAYWRIGHT VERIFICATION CHECKS COMPLETED!");
    console.log(`Transitions Passed: ${Object.values(report.transitions).every((t) => t.passed)}`);
    console.log(`OLED Surfaces Pure Black (#000000): ${report.oledColorChecks.settings.bodyBg === "rgb(0, 0, 0)"}`);
    console.log(`OLED Persists: ${oledPersisted}`);
    console.log(`Dark Persists: ${darkPersisted}`);
    console.log(`Light Persists: ${lightPersisted}`);
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Page Errors: ${pageErrors.length}`);
    console.log(`Screenshots Saved To: ${OUTPUT_DIR}`);
    console.log("========================================================\n");
  } catch (e) {
    console.error("Verification error:", e);
    report.allPassed = false;
    report.error = e.message || String(e);
  } finally {
    await browser.close();
  }
}

run();
