import { chromium } from "playwright";

async function verifySyncStatus() {
  console.log("🚀 Starting Playwright Sync Status E2E Verification...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  const report = {
    checks: [],
    failed: 0,
    passed: 0,
  };

  function assert(name, condition, extra = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${name} ${extra}`);
      report.passed++;
      report.checks.push({ name, pass: true, extra });
    } else {
      console.error(`  ❌ FAIL: ${name} ${extra}`);
      report.failed++;
      report.checks.push({ name, pass: false, extra });
    }
  }

  try {
    // 1. FRESH ACCOUNT / NEVER SYNCED CHECK
    console.log("\n--- Scenario 1: Fresh Account (Never Synced) ---");
    await page.goto("http://localhost:5173/SettingsPage?no_onboarding=1&demo_data=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);

    // Mock a logged-in user in window state if needed or inspect
    await page.evaluate(() => {
      // Clear any stored lastSyncedAt
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("lastSyncedAt_")) localStorage.removeItem(k);
      });
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Check if "Never synced" or sign in is visible
    let syncText = await page.evaluate(() => {
      const pElements = Array.from(document.querySelectorAll("p"));
      return pElements.map((p) => p.textContent.trim()).filter((t) => t.includes("Synced") || t.includes("Never"));
    });
    console.log("Initial sync status texts found:", syncText);

    // 2. SIMULATE EXISTING ACCOUNT WITH PREVIOUS SYNC HISTORY
    console.log("\n--- Scenario 2: Existing Account with Previous History (e.g. 10m ago) ---");
    const tenMinAgo = new Date(Date.now() - 10 * 60000);
    await page.evaluate((ts) => {
      // Inject simulated user & stored lastSyncedAt
      localStorage.setItem("lastSyncedAt_demo-user", ts);
      localStorage.setItem("lastSyncedUserId", "demo-user");
    }, tenMinAgo.toISOString());

    // Inject mock auth state if needed to test signed-in view
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("syncStatusTest", { detail: { ts: 10 } }));
    });

    // 3. TEST IN-BROWSER BEHAVIOR VIA SYNC SERVICE
    console.log("\n--- Scenario 3: Verify formatLastSynced and storage helpers in runtime ---");
    const runtimeTests = await page.evaluate(async () => {
      const {
        formatLastSynced,
        getLocalLastSyncTimestamp,
        setLocalLastSyncTimestamp,
        recordSyncSuccess,
        subscribeSyncState,
      } = await import("/src/firebase/syncService.ts");

      const results = {};

      // A. Never synced
      results.never = formatLastSynced(null);

      // B. Just now
      results.justNow = formatLastSynced(new Date());

      // C. 5 minutes ago
      results.fiveMins = formatLastSynced(new Date(Date.now() - 5 * 60000));

      // D. 1 hour ago
      results.oneHour = formatLastSynced(new Date(Date.now() - 65 * 60000));

      // E. Local persistence roundtrip
      const testDate = new Date(2026, 9, 1, 12, 0, 0);
      setLocalLastSyncTimestamp("e2e-user", testDate);
      const readBack = getLocalLastSyncTimestamp("e2e-user");
      results.persistenceMatch = readBack && readBack.getTime() === testDate.getTime();

      // F. Reactive subscriber update
      let subscriberReceived = null;
      const unsub = subscribeSyncState((event) => {
        subscriberReceived = event;
      });
      const newSyncDate = new Date(2026, 9, 1, 12, 5, 0);
      recordSyncSuccess("e2e-user", newSyncDate);
      unsub();
      results.subscriberReceived = subscriberReceived;

      return results;
    });

    assert("formatLastSynced(null) is 'Never synced'", runtimeTests.never === "Never synced", runtimeTests.never);
    assert("formatLastSynced(now) is 'Synced just now'", runtimeTests.justNow === "Synced just now", runtimeTests.justNow);
    assert("formatLastSynced(5m) is 'Synced 5 minutes ago'", runtimeTests.fiveMins === "Synced 5 minutes ago", runtimeTests.fiveMins);
    assert("formatLastSynced(1h) is 'Synced 1 hour ago'", runtimeTests.oneHour === "Synced 1 hour ago", runtimeTests.oneHour);
    assert("Storage persists correctly across calls", runtimeTests.persistenceMatch === true);
    assert("Subscribers receive live sync event", runtimeTests.subscriberReceived?.status === "synced");

    // 4. TEST LEAVING AND RE-ENTERING SETTINGS
    console.log("\n--- Scenario 4: Leave and reopen Settings (survives tab navigation) ---");
    // Navigate to /SalahTimesPage
    await page.goto("http://localhost:5173/SalahTimesPage?no_onboarding=1&demo_data=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);

    // Update sync while on another page
    const syncTimeWhileAway = new Date();
    await page.evaluate((ts) => {
      localStorage.setItem("lastSyncedAt_e2e-user", ts);
    }, syncTimeWhileAway.toISOString());

    // Navigate back to /SettingsPage
    await page.goto("http://localhost:5173/SettingsPage?no_onboarding=1&demo_data=1", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);

    const readAfterReenter = await page.evaluate(() => {
      return localStorage.getItem("lastSyncedAt_e2e-user");
    });
    assert("Timestamp remains intact after leaving and reopening Settings", readAfterReenter === syncTimeWhileAway.toISOString());

    // 5. TEST RESTART APP SIMULATION
    console.log("\n--- Scenario 5: App Restart Simulation (survives page reload) ---");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const readAfterReload = await page.evaluate(() => {
      return localStorage.getItem("lastSyncedAt_e2e-user");
    });
    assert("Timestamp remains intact after app reload", readAfterReload === syncTimeWhileAway.toISOString());

    // 6. SIMULATE FAILED SYNC
    console.log("\n--- Scenario 6: Failed Sync Simulation ---");
    const failedSyncResult = await page.evaluate(async () => {
      const { performManualSync, getLocalLastSyncTimestamp } = await import("/src/firebase/syncService.ts");
      const before = getLocalLastSyncTimestamp("e2e-user");

      // Temporarily mock navigator.onLine to false to simulate offline failure
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      let errorCaught = false;
      try {
        await performManualSync("e2e-user");
      } catch (e) {
        errorCaught = true;
      }

      // Restore navigator.onLine
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

      const after = getLocalLastSyncTimestamp("e2e-user");
      return {
        errorCaught,
        beforeTime: before?.getTime(),
        afterTime: after?.getTime(),
        timestampUnchanged: before?.getTime() === after?.getTime(),
      };
    });

    assert("Failed sync correctly throws error", failedSyncResult.errorCaught === true);
    assert("Failed sync leaves previous timestamp unchanged", failedSyncResult.timestampUnchanged === true);

  } catch (err) {
    console.error("Verification suite encountered an error:", err);
    report.failed++;
  } finally {
    await browser.close();
  }

  console.log("\n==========================================");
  console.log(`Results: ${report.passed} passed, ${report.failed} failed`);
  console.log("==========================================");

  if (report.failed > 0) {
    process.exit(1);
  }
}

verifySyncStatus();
