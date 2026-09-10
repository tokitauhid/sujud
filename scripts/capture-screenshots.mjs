import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('assets/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const tempUserData = `/tmp/chrome-sujud-${Date.now()}`;
const chromeProcess = spawn('/usr/bin/google-chrome-stable', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${tempUserData}`,
  '--remote-debugging-port=9222',
  '--window-size=390,844',
  '--hide-scrollbars',
  '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
]);

// Wait for Chrome to be ready
await new Promise((resolve) => setTimeout(resolve, 1500));

const versionRes = await fetch('http://127.0.0.1:9222/json/version');
const versionData = await versionRes.json();
const wsUrl = versionData.webSocketDebuggerUrl;

console.log('Connected to Chrome via CDP:', wsUrl);

const ws = new WebSocket(wsUrl);

let id = 1;
const pending = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    console.log('[BROWSER]', ...msg.params.args.map(a => a.value || a.description));
  }
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

// Create target / page
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
await sendSession('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});

// Wait for app and sqlite to mount
await new Promise((resolve) => setTimeout(resolve, 3000));

// Dismiss any joyride or modals if present
await sendSession('Runtime.evaluate', {
  expression: `
    (() => {
      const joyrideOverlay = document.querySelector('.react-joyride__overlay');
      if (joyrideOverlay) joyrideOverlay.remove();
      const joyrideTooltip = document.querySelector('.react-joyride__tooltip');
      if (joyrideTooltip) joyrideTooltip.remove();
      const modal = document.querySelector('ion-modal');
      if (modal) modal.remove();
    })()
  `,
});

const clickTab = async (label) => {
  console.log(`Clicking tab ${label}...`);
  await sendSession('Runtime.evaluate', {
    expression: `
      (() => {
        const tabs = Array.from(document.querySelectorAll('ion-tab-button, .nav-tab-item, a, button'));
        const target = tabs.find(t => t.textContent && t.textContent.trim().toUpperCase().includes('${label.toUpperCase()}'));
        if (target) {
          target.click();
          return true;
        }
        return false;
      })()
    `,
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const screens = [
  { tab: 'TRACKER', name: '01_tracker.png' },
  { tab: 'STATS', name: '02_stats.png' },
  { tab: 'STATS', name: '03_calendar.png', scroll: 420 },
  { tab: 'PRAYERS', name: '04_prayers.png' },
  { tab: 'CONFIG', name: '05_settings.png' },
];

for (const s of screens) {
  await clickTab(s.tab);

  if (s.scroll) {
    await sendSession('Runtime.evaluate', {
      expression: `
        (() => {
          const content = document.querySelector('ion-content');
          if (content) {
            const scrollEl = (content.shadowRoot && content.shadowRoot.querySelector('.inner-scroll')) || content;
            scrollEl.scrollTop = ${s.scroll};
            if (content.scrollToPoint) content.scrollToPoint(0, ${s.scroll}, 100);
          }
        })()
      `,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const result = await sendSession('Page.captureScreenshot', {
    format: 'png',
  });

  const filePath = path.join(outDir, s.name);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  console.log(`Saved screenshot: ${filePath} (${result.data.length} bytes base64)`);
}

ws.close();
chromeProcess.kill();
console.log('All screenshots saved!');
process.exit(0);
