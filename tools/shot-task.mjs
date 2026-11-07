// Скриншот экрана задачи: node tools/shot-task.mjs m/6/t1 out.png [кнопка: formulas|theory]  (m|f — латиницей: Git Bash портит кириллицу в аргументах)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PW = readFileSync(join(SITE, '..', 'справки', 'тестовый-пароль.txt'), 'utf8').trim();
const [route, out, btn] = process.argv.slice(2), PORT = 8121;
const [L, N, T] = route.split('/'), hash = `#/${L === 'm' ? 'м' : 'ф'}/${N}${T ? (T.startsWith('t') ? '/тип/' + T : '/' + ({ th: 'теория' })[T]) : ''}`;
const server = spawn(process.execPath, [join(SITE, 'tools', 'dev-server.mjs'), SITE, String(PORT)], { env: { ...process.env, EGE_DEV_KEYS: '1', EGE_SYNC_DIR: mkdtempSync(join(tmpdir(), 'ege-s-')) }, stdio: 'ignore' });
await sleep(700);
const b = await launch(); const p = await b.tab(); const errs = [];
p.on('Runtime.exceptionThrown', (e) => errs.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
try {
  await p.size(1280, 900, { dpr: 1, mobile: false });
  await p.open(`http://127.0.0.1:${PORT}/`);
  await p.until(`!!document.querySelector('input[type=password]')`, 8000);
  await p.run(`(()=>{const f=document.querySelector('.lock form'); f.username.value='test'; f.password.value=${JSON.stringify(PW)}; f.remember.checked=true; f.requestSubmit();})()`);
  await p.until(`!!document.querySelector('#pmap')`, 10000);
  await p.run(`location.hash=${JSON.stringify(hash)}`); await sleep(1500);
  if (btn) { await p.run(`document.querySelector('[data-${btn}]')?.click()`); await sleep(700); }
  console.log(await p.run(`[...document.querySelectorAll('.task .tools button')].map(b=>b.textContent).join('|')+' tables:'+document.querySelectorAll('.task .q table').length`));
  await p.shot(out);
} finally { console.log('errors:', errs.length, errs.slice(0, 3).join('\n')); await b.close?.(); server.kill(); process.exit(0); }
