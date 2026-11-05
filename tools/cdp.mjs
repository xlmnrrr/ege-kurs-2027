// Headless Chrome over the DevTools protocol, without Playwright or packages. Node 22+.
// Real GPU by default (--use-angle=d3d11): a hidden browser pane shows no WebGL, this does.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ angle = 'd3d11', args = [] } = {}) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const dir = mkdtempSync(join(tmpdir(), 'ege-cdp-'));
  const flags = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--hide-scrollbars',
    `--use-angle=${angle}`, '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', ...(angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : []), ...args, 'about:blank',
  ];
  const proc = spawn(CHROME, flags, { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { await sleep(150); }
  }
  if (!up) { proc.kill(); throw new Error('Chrome did not start'); }

  async function tab() {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p?.rej(new Error(`${p.method}: ${m.error.message}`));
        else p?.res(m.result);
      } else (listeners.get(m.method) || []).forEach((fn) => fn(m.params));
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
      pending.set(++id, { res, rej, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const on = (method, fn) => { listeners.set(method, [...(listeners.get(method) || []), fn]); };

    const page = {
      send,
      on,
      async size(width, height, { dpr = 1, mobile = false } = {}) {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
      },
      async open(url, { wait = 'load', timeout = 30000 } = {}) {
        const loaded = new Promise((res) => {
          const t = setTimeout(res, timeout);
          on(wait === 'load' ? 'Page.loadEventFired' : 'Page.domContentEventFired', () => { clearTimeout(t); res(); });
        });
        await send('Page.navigate', { url });
        await loaded;
      },
      async run(expression) {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result?.value;
      },
      async until(expression, timeout = 15000) {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
          if (await page.run(expression)) return true;
          await sleep(100);
        }
        return false;
      },
      async shot(file, opts = {}) {
        const format = file.endsWith('.jpg') ? 'jpeg' : file.endsWith('.webp') ? 'webp' : 'png';
        const r = await send('Page.captureScreenshot', { format, quality: format === 'png' ? undefined : 92, ...opts });
        writeFileSync(file, Buffer.from(r.data, 'base64'));
      },
      close() { ws.close(); },
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.bringToFront');
    return page;
  }

  return {
    tab,
    async close() {
      proc.kill();
      await sleep(300);
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* Chrome may still hold a file */ }
    },
  };
}
