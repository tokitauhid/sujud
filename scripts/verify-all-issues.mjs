import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const report = {
  passed: [],
  failed: [],
};

function pass(testName, details) {
  console.log(`\x1b[32m✔ PASS:\x1b[0m ${testName}`, details ? `(${JSON.stringify(details)})` : '');
  report.passed.push({ testName, details });
}

function fail(testName, error) {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${testName}`, error);
  report.failed.push({ testName, error: String(error) });
}

const tempUserData = `/tmp/chrome-verify-${Date.now()}`;
const chromePort = 9225;
const chromeProcess = spawn('/usr/bin/google-chrome-stable', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${tempUserData}`,
  `--remote-debugging-port=${chromePort}`,
  '--window-size=1200,900',
  '--hide-scrollbars',
]);

await new Promise((resolve) => setTimeout(resolve, 1500));

const versionRes = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
const versionData = await versionRes.json();
const wsUrl = versionData.webSocketDebuggerUrl;

console.log('Connected to Google Chrome:', wsUrl);
const ws = new WebSocket(wsUrl);

let id = 1;
const pending = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = id++;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

await new Promise((resolve) => {
  ws.onopen = resolve;
});

// Create page target
const { targetId } = await send('Target.createTarget', {
  url: 'http://localhost:5173/HomePage?no_onboarding=1&demo_data=1',
});

const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true,
});

const sendSession = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = id++;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
  });

await sendSession('Page.enable');
await sendSession('Runtime.enable');

// Helper to evaluate JS in browser
async function evalJs(expr) {
  const res = await sendSession('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

// Helper to set viewport
async function setViewport(width, height, mobile = false) {
  await sendSession('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile,
  });
  await new Promise((r) => setTimeout(r, 600));
}

try {
  // Wait for initial load and data to populate
  await new Promise((r) => setTimeout(r, 3000));

  // Dismiss joyride overlays ONLY (DO NOT remove ion-modal!)
  await evalJs(`
    (() => {
      document.querySelectorAll('.react-joyride__overlay, .react-joyride__tooltip').forEach(e => e.remove());
    })()
  `);

  console.log('\n--- 1. Testing Tablet Portrait Mode (Isha Column & Responsiveness) ---');
  // 1. Tablet Portrait Viewport (840x1024)
  await setViewport(840, 1024, false);

  const tabletPortraitMetrics = await evalJs(`
    (() => {
      const headerRow = document.querySelector('.ReactVirtualized__Table__headerRow');
      const firstRow = document.querySelector('.ReactVirtualized__Table__row');
      const rows = document.querySelectorAll('.ReactVirtualized__Table__row');
      if (!headerRow || !firstRow) return { error: 'Table or rows not found' };

      const headerCols = Array.from(headerRow.children).map((c, idx) => ({
        index: idx,
        text: c.textContent.trim(),
        width: Math.round(c.getBoundingClientRect().width),
        left: Math.round(c.getBoundingClientRect().left),
        right: Math.round(c.getBoundingClientRect().right)
      }));

      const rowCols = Array.from(firstRow.children).map((c, idx) => ({
        index: idx,
        width: Math.round(c.getBoundingClientRect().width),
        left: Math.round(c.getBoundingClientRect().left),
        right: Math.round(c.getBoundingClientRect().right)
      }));

      const ishaHeader = headerCols[5];
      const ishaCell = rowCols[5];

      return {
        rowsCount: rows.length,
        headerRowWidth: Math.round(headerRow.getBoundingClientRect().width),
        firstRowWidth: Math.round(firstRow.getBoundingClientRect().width),
        headerCols,
        rowCols,
        ishaHeader,
        ishaCell,
        ishaAligned: ishaHeader && ishaCell && Math.abs(ishaHeader.left - ishaCell.left) <= 2 && Math.abs(ishaHeader.width - ishaCell.width) <= 2,
        allCheckboxesPresent: rows.length > 0 && Array.from(rows).every(r => r.children.length === 6)
      };
    })()
  `);

  if (tabletPortraitMetrics.error) {
    fail('Tablet Portrait Table Check', tabletPortraitMetrics.error);
  } else {
    if (tabletPortraitMetrics.headerRowWidth === tabletPortraitMetrics.firstRowWidth && tabletPortraitMetrics.ishaAligned) {
      pass('Tablet Portrait Isha Column Alignment', {
        headerWidth: tabletPortraitMetrics.headerRowWidth,
        rowWidth: tabletPortraitMetrics.firstRowWidth,
        ishaHeader: tabletPortraitMetrics.ishaHeader,
        ishaCell: tabletPortraitMetrics.ishaCell
      });
    } else {
      fail('Tablet Portrait Isha Column Alignment', tabletPortraitMetrics);
    }

    if (tabletPortraitMetrics.rowsCount > 0 && tabletPortraitMetrics.allCheckboxesPresent) {
      pass('Tablet Portrait Row Visibility & Column Count', { rowsCount: tabletPortraitMetrics.rowsCount });
    } else {
      fail('Tablet Portrait Row Visibility & Column Count', tabletPortraitMetrics);
    }
  }

  // Also test iPad portrait (768x1024)
  await setViewport(768, 1024, false);
  const ipadMetrics = await evalJs(`
    (() => {
      const headerRow = document.querySelector('.ReactVirtualized__Table__headerRow');
      const firstRow = document.querySelector('.ReactVirtualized__Table__row');
      if (!headerRow || !firstRow) return { error: 'Table or rows not found' };
      const ishaHeader = headerRow.children[5].getBoundingClientRect();
      const ishaCell = firstRow.children[5].getBoundingClientRect();
      return {
        headerRowWidth: Math.round(headerRow.getBoundingClientRect().width),
        firstRowWidth: Math.round(firstRow.getBoundingClientRect().width),
        ishaDiffLeft: Math.abs(ishaHeader.left - ishaCell.left),
        ishaDiffWidth: Math.abs(ishaHeader.width - ishaCell.width)
      };
    })()
  `);

  if (ipadMetrics.headerRowWidth === ipadMetrics.firstRowWidth && ipadMetrics.ishaDiffLeft <= 2) {
    pass('iPad 768px Portrait Isha Column Alignment', ipadMetrics);
  } else {
    fail('iPad 768px Portrait Isha Column Alignment', ipadMetrics);
  }

  console.log('\n--- 2. Testing Date Column Centering ---');
  const dateCentering = await evalJs(`
    (() => {
      const headerDateCol = document.querySelector('.ReactVirtualized__Table__headerColumn:first-child');
      const rowDateCol = document.querySelector('.ReactVirtualized__Table__rowColumn:first-child');
      if (!headerDateCol || !rowDateCol) return { error: 'Date columns not found' };
      const headerStyle = window.getComputedStyle(headerDateCol);
      const rowStyle = window.getComputedStyle(rowDateCol);
      const dateTextDiv = rowDateCol.querySelector('div');
      const dateTextClass = dateTextDiv ? dateTextDiv.className : '';
      return {
        rowJustifyContent: rowStyle.justifyContent,
        dateDivHasCenterClass: dateTextClass.includes('justify-center') && dateTextClass.includes('text-center')
      };
    })()
  `);

  if (dateCentering.rowJustifyContent === 'center' && dateCentering.dateDivHasCenterClass) {
    pass('Date Column Center Alignment', dateCentering);
  } else {
    fail('Date Column Center Alignment', dateCentering);
  }

  console.log('\n--- 3. Testing Tablet Landscape Mode & Widgets (No Overflow) ---');
  await setViewport(1180, 820, false);
  const landscapeMetrics = await evalJs(`
    (() => {
      const grid = document.querySelector('.home-page-tablet-grid');
      const widgets = document.querySelector('.home-page-tablet-widgets');
      const table = document.querySelector('.ReactVirtualized__Table');
      if (!grid || !widgets || !table) return { error: 'Grid or widgets not found in landscape' };
      
      const gridRect = grid.getBoundingClientRect();
      const widgetsRect = widgets.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const winWidth = window.innerWidth;

      const isWidgetsVisible = window.getComputedStyle(widgets).display !== 'none';
      const isGridDisplay = window.getComputedStyle(grid).display === 'grid';

      return {
        winWidth,
        gridRight: Math.round(gridRect.right),
        widgetsRight: Math.round(widgetsRect.right),
        isWidgetsVisible,
        isGridDisplay,
        overflowPixels: Math.max(0, Math.round(widgetsRect.right - winWidth))
      };
    })()
  `);

  if (landscapeMetrics.isWidgetsVisible && landscapeMetrics.overflowPixels === 0 && landscapeMetrics.isGridDisplay) {
    pass('Tablet Landscape Widgets Layout & Zero Overflow', landscapeMetrics);
  } else {
    fail('Tablet Landscape Widgets Layout & Zero Overflow', landscapeMetrics);
  }

  console.log('\n--- 4. Testing Stats Bar 5 Sections ---');
  // Navigate to Stats page via URL evaluation
  await evalJs(`
    (() => {
      const btn = Array.from(document.querySelectorAll('.tablet-side-nav button, ion-tab-button')).find(b => b.textContent && b.textContent.includes('STATS'));
      if (btn) btn.click();
      else window.location.href = '/StatsPage?no_onboarding=1&demo_data=1';
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  const statsMetrics = await evalJs(`
    (() => {
      const dayBars = document.querySelectorAll('.border-l.border-b > div.group, .relative.z-10.flex.flex-col.items-center');
      if (dayBars.length === 0) {
        return { error: 'No day bars found in Stats page', url: window.location.href };
      }

      const firstBarHtml = dayBars[0] ? dayBars[0].innerHTML : '';
      const sectionElements = dayBars[0] ? Array.from(dayBars[0].querySelectorAll('div')).map(d => ({
        className: d.className,
        title: d.getAttribute('title') || '',
        childCount: d.children.length
      })) : [];

      let fiveSectionBar = null;
      for (const bar of dayBars) {
        // Look for any container with exactly 5 divs
        const divs = bar.querySelectorAll('div');
        for (const d of divs) {
          if (d.children.length === 5) {
            fiveSectionBar = Array.from(d.children).map(c => ({
              className: c.className,
              title: c.getAttribute('title') || ''
            }));
            break;
          }
        }
        if (fiveSectionBar) break;
      }

      const legend = document.querySelector('.flex.flex-wrap.items-center.justify-center');

      return {
        barsCount: dayBars.length,
        hasFiveSections: fiveSectionBar !== null,
        sectionsInfo: fiveSectionBar,
        firstBarHtml: firstBarHtml.slice(0, 300),
        hasLegend: !!legend
      };
    })()
  `);

  if (statsMetrics.hasFiveSections) {
    pass('Stats Bar 5-Section Distribution', {
      barsCount: statsMetrics.barsCount,
      sections: statsMetrics.sectionsInfo?.map(s => s.title)
    });
  } else {
    fail('Stats Bar 5-Section Distribution', statsMetrics);
  }

  console.log('\n--- 5. Testing In Jamaah Highlighting in Main Log Status Panel ---');
  // Navigate back to Tracker tab via direct URL to ensure fresh HomePage state
  await evalJs(`window.location.href = '/HomePage?no_onboarding=1&demo_data=1'`);
  await new Promise((r) => setTimeout(r, 3000));

  // Dismiss any joyride
  await evalJs(`
    (() => {
      document.querySelectorAll('.react-joyride__overlay, .react-joyride__tooltip').forEach(e => e.remove());
    })()
  `);

  // Click a prayer cell (Fajr cell in first row) to open BottomSheetSalahStatus
  const clickResult = await evalJs(`
    (() => {
      const sections = Array.from(document.querySelectorAll('.ReactVirtualized__Table__rowColumn section'));
      // Find the first section that is a prayer cell (has cursor-pointer)
      const prayerSection = sections.find(s => s.className.includes('cursor-pointer'));
      if (!prayerSection) return { error: 'Prayer section not found', sectionsCount: sections.length };
      
      prayerSection.click();
      return { clicked: true, className: prayerSection.className };
    })()
  `);
  console.log('Click result:', clickResult);
  await new Promise((r) => setTimeout(r, 2000));

  const jamaahHighlightCheck = await evalJs(`
    (async () => {
      try {
        let jamaahEl = null;

        for (let i = 0; i < 20; i++) {
          // Search in normal DOM and within any shadowRoot
          const findVisibleJamaah = () => {
            const allElements = Array.from(document.querySelectorAll('p, span, div, ion-label'));
            return allElements.find(el => {
              if (el.textContent && el.textContent.trim() === 'In Jamaah') {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              }
              return false;
            });
          };

          jamaahEl = findVisibleJamaah();
          if (jamaahEl) break;

          // Check shadow roots if any
          const modals = document.querySelectorAll('ion-modal');
          for (const m of modals) {
            if (m.shadowRoot) {
              const shadowEls = Array.from(m.shadowRoot.querySelectorAll('p, span, div, ion-label'));
              const found = shadowEls.find(el => el.textContent && el.textContent.trim() === 'In Jamaah');
              if (found) {
                jamaahEl = found;
                break;
              }
            }
          }
          if (jamaahEl) break;

          await new Promise(r => setTimeout(r, 200));
        }

        if (!jamaahEl) {
          const allTextOnPage = Array.from(document.querySelectorAll('p, span, div')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 30);
          return { error: 'Visible In Jamaah text not found on page', allTextOnPage };
        }

        const card = jamaahEl.closest('.aspect-square') || jamaahEl.parentElement;
        if (!card) return { error: 'Jamaah card not found' };

        const cardStyle = window.getComputedStyle(card);
        const topColor = cardStyle.borderTopColor || '';
        const hasGoldBorder = topColor.includes('245, 158, 11') || (card.style && card.style.border && card.style.border.includes('F59E0B'));
        const boxShadow = cardStyle.boxShadow || '';
        const hasBoxGlow = boxShadow.includes('245, 158, 11') && !boxShadow.includes('rgba(0, 0, 0, 0)');
        const hasDot = card.innerHTML.includes('bg-[#F59E0B]');

        return {
          label: jamaahEl.textContent.trim(),
          hasGoldBorder: !!hasGoldBorder,
          hasBoxGlow,
          hasDot,
          isClean: !hasGoldBorder && !hasBoxGlow && !hasDot
        };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    })()
  `);

  if (jamaahHighlightCheck.isClean) {
    pass('In Jamaah Highlighting Removed in Main Log Panel', jamaahHighlightCheck);
  } else {
    fail('In Jamaah Highlighting Removed in Main Log Panel', jamaahHighlightCheck);
  }

  // Close any open modal
  await evalJs(`
    (() => {
      const modal = document.querySelector('ion-modal');
      if (modal && modal.dismiss) modal.dismiss();
    })()
  `);

  console.log('\n--- 6. Testing Mobile Mode Responsiveness ---');
  await setViewport(390, 844, true);
  const mobileMetrics = await evalJs(`
    (() => {
      const table = document.querySelector('.ReactVirtualized__Table');
      const headerRow = document.querySelector('.ReactVirtualized__Table__headerRow');
      const firstRow = document.querySelector('.ReactVirtualized__Table__row');
      if (!headerRow || !firstRow) return { error: 'Table or rows not found on mobile' };

      const winWidth = window.innerWidth;
      const headerRect = headerRow.getBoundingClientRect();
      const rowRect = firstRow.getBoundingClientRect();

      return {
        winWidth,
        headerWidth: Math.round(headerRect.width),
        rowWidth: Math.round(rowRect.width),
        fitsViewport: headerRect.right <= winWidth + 2 && rowRect.right <= winWidth + 2
      };
    })()
  `);

  if (mobileMetrics.fitsViewport && mobileMetrics.headerWidth === mobileMetrics.rowWidth) {
    pass('Mobile Mode Table Responsiveness & Alignment', mobileMetrics);
  } else {
    fail('Mobile Mode Table Responsiveness & Alignment', mobileMetrics);
  }

  console.log('\n--- 7. Verifying README.md Screenshots ---');
  const readmeContent = fs.readFileSync('README.md', 'utf-8');
  const hasScreenshotsSection = readmeContent.includes('## 📱 App Screenshots');
  const screenshotFilesExist = [
    'assets/screenshots/01_tracker.png',
    'assets/screenshots/02_stats.png',
    'assets/screenshots/03_prayers.png',
    'assets/screenshots/04_settings.png'
  ].every(f => fs.existsSync(f));

  if (hasScreenshotsSection && screenshotFilesExist) {
    pass('README.md Screenshots Present & Valid Files Exist', {
      hasSection: true,
      screenshotFiles: true
    });
  } else {
    fail('README.md Screenshots Present & Valid Files Exist', {
      hasScreenshotsSection,
      screenshotFilesExist
    });
  }

} catch (err) {
  fail('Unhandled test execution error', err);
} finally {
  ws.close();
  chromeProcess.kill();
  console.log('\n======================================');
  console.log(`RESULTS: ${report.passed.length} PASSED, ${report.failed.length} FAILED`);
  console.log('======================================');
  if (report.failed.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
