// Сквозная проверка каркаса в headless Chrome (АРХИТЕКТУРА.md §6). node tools/e2e.mjs [--shots папка]
// Поднимает свой сервер (порт 8120, отдельная папка синхронизации), проверяет iPhone 15 Pro и ПК.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PW = readFileSync(join(SITE, '..', 'справки', 'тестовый-пароль.txt'), 'utf8').trim();
const shotsDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const PORT = 8120, BASE = `http://127.0.0.1:${PORT}/`;
const syncDir = mkdtempSync(join(tmpdir(), 'ege-sync-'));
const server = spawn(process.execPath, [join(SITE, 'tools', 'dev-server.mjs'), SITE, String(PORT)], { env: { ...process.env, EGE_SYNC_DIR: syncDir }, stdio: 'ignore' });
await sleep(700);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓', m); } else { fail++; console.log('✗', m); } };
const errors = [], external = [];
async function newTab(b, { w = 393, h = 852, dpr = 3, mobile = true } = {}) {
  const p = await b.tab();
  p.on('Runtime.exceptionThrown', (e) => errors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  p.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') errors.push(e.args.map((a) => a.value || a.description).join(' ')); });
  await p.send('Network.enable');
  p.on('Network.requestWillBeSent', (e) => { const u = e.request.url; if (!/^(http:\/\/127\.0\.0\.1:8120|data:|blob:|chrome)/.test(u)) external.push(u); });
  await p.size(w, h, { dpr, mobile });
  return p;
}
const login = async (p, password = PW, remember = true) => {
  await p.until(`!!document.querySelector('input[type=password]')`, 8000);
  await p.run(`(()=>{const f=document.querySelector('.lock form'); f.password.value=${JSON.stringify(password)}; f.remember.checked=${remember}; f.requestSubmit();})()`);
};
const noHScroll = (p) => p.run(`document.documentElement.scrollWidth <= innerWidth + 1`);
const shot = async (p, name) => { if (shotsDir) await p.shot(join(shotsDir, name + '.png')); };

try {
  // ---------- устройство A: iPhone ----------
  const A = await launch();
  const p = await newTab(A);
  await p.open(BASE); await sleep(500);
  await login(p, 'неверный-пароль');
  await p.until(`document.querySelector('.lock .err')?.textContent.length > 5`, 8000);
  ok((await p.run(`document.querySelector('.lock .err').textContent`)).includes('Пароль не подошёл'), 'неверный пароль: понятное сообщение');
  ok(!(await p.run(`!!document.querySelector('#orbits')`)), 'неверный пароль: курс не открылся');
  await login(p);
  ok(await p.until(`!!document.querySelector('#orbits .ch-pt')`, 10000), 'верный пароль: главная с орбитами');
  ok((await p.run(`document.querySelectorAll('#orbits .ch-pt.node').length`)) === 46, 'на орбитах 46 номеров (20 + 26)');
  ok(await p.run(`document.querySelectorAll('.today .block').length === 3`), 'план на сегодня: 3 блока (повторение, номер, смешанные)');
  ok(await noHScroll(p), 'главная 393 px: без горизонтальной прокрутки');
  await shot(p, 'iphone-home');
  // запоминание устройства
  await p.open(BASE); ok(await p.until(`!!document.querySelector('#orbits')`, 10000), 'после перезагрузки вход не нужен (устройство запомнено)');
  // номер: разбор, шаги рисунка
  await p.run(`location.hash='#/м/1'`); ok(await p.until(`!!document.querySelector('.example .stage svg .ch-line')`, 10000), 'номер 1: пример с рисунком');
  ok(await p.run(`document.querySelectorAll('.example .stepcard').length === 4`), 'пример: 4 шага');
  await p.run(`document.querySelector('.example [data-next]').click()`); await sleep(300);
  ok(await p.run(`document.querySelector('.example .stepcard.cur h4').textContent.includes('Шаг 2')`), 'кнопка «›» — шаг 2, карточка подсвечена');
  ok(await p.run(`document.querySelectorAll('.example svg [data-step="1"].on').length > 0 && document.querySelectorAll('.example svg [data-step="2"].on').length === 0`), 'рисунок показывает только шаги ≤ текущего');
  ok(await p.run(`document.querySelectorAll('.doc .katex').length > 3`), 'формулы отрисованы (KaTeX из сборки)');
  ok(await p.run(`!!document.querySelector('figure.fig svg .ch-line')`), 'рисунок теории отрисован');
  ok(await noHScroll(p), 'страница номера 393 px: без горизонтальной прокрутки');
  await shot(p, 'iphone-number');
  // уже знаю
  await p.run(`(()=>{document.querySelector('.known input').value='3'; document.querySelector('.known form').requestSubmit();})()`); await sleep(400);
  ok((await p.run(`document.querySelector('.kn-res').textContent`)).includes('1 из 1'), '«Уже знаю?»: результат 1 из 1');
  // лист формул
  await p.run(`document.querySelector('.add-formula').click()`); await sleep(300);
  // тренажёр: 3 ошибки -> подсказка 1, подсказка 2, решение
  await p.run(`location.hash='#/м/1/тренажёр'`); await p.until(`!!document.querySelector('.task')`, 8000);
  const wrong = async () => { await p.run(`(()=>{const i=document.querySelector('.task input'); i.value='14'; document.querySelector('.task form').requestSubmit();})()`); await sleep(250); };
  await wrong(); ok(await p.run(`document.querySelectorAll('.task .hint').length === 1`), 'ошибка 1 → подсказка 1');
  await wrong(); ok(await p.run(`document.querySelectorAll('.task .hint').length === 2`), 'ошибка 2 → подсказка 2');
  await wrong(); ok(await p.run(`!!document.querySelector('.task .key') && document.querySelector('.task input').disabled`), 'ошибка 3 → полное решение, ввод закрыт');
  await shot(p, 'iphone-trainer');
  await p.run(`[...document.querySelectorAll('.task .btn.primary')].find(b=>b.textContent.includes('Следующая')).click()`); await sleep(400);
  await p.run(`(()=>{const i=document.querySelector('.task input'); i.value=' 10 '; document.querySelector('.task form').requestSubmit();})()`); await sleep(300);
  ok((await p.run(`document.querySelector('.task .result').textContent`)).startsWith('Верно'), 'верный ответ (с пробелами) принят');
  // повторение: ошибка сегодня → появится завтра (подменяем время)
  ok(await p.run(`import('./assets/js/progress.js').then(m=>import('./assets/js/store.js').then(s=>s.all('events').then(ev=>m.dueReviews(m.fold(ev), Date.now()+86400000).length)))`) >= 1, 'задача с ошибкой — в повторении завтра (1/3/7/21)');
  // заметки
  await p.run(`location.hash='#/заметки'`); await p.until(`!!document.querySelector('h1')`, 5000); await sleep(300);
  ok(await p.run(`document.querySelectorAll('.list .item .mathd').length >= 1`), 'формула попала в «Мой лист формул»');
  // план
  await p.run(`location.hash='#/план'`); await p.until(`!!document.querySelector('.week')`, 5000);
  ok(await p.run(`document.querySelectorAll('.week .day').length === 21`), 'план на 3 недели');
  ok(await noHScroll(p), 'план 393 px: без горизонтальной прокрутки');
  // калькулятор
  await p.run(`document.querySelector('[data-calc]').click()`); await sleep(200);
  for (const k of ['sin', '3', '0', ')', '×', '2', '=']) await p.run(`document.querySelector('.keys [data-k="${k}"]').click()`);
  ok((await p.run(`document.querySelector('.calc .res').textContent`)) === '1', 'калькулятор: sin(30°)×2 = 1');
  await p.run(`document.querySelector('[data-mode="help"]').click()`); await sleep(100);
  ok(await p.run(`document.querySelectorAll('.calc .consts button').length >= 12`), 'режим «Помощник»: константы справочника ЕГЭ');
  await shot(p, 'iphone-calc');
  await p.run(`document.querySelector('.calc [data-close]').click()`);
  // печать
  await p.run(`location.hash='#/м/1/шпаргалка'`); await p.until(`!!document.querySelector('[data-print]')`, 8000);
  await p.send('Emulation.setEmulatedMedia', { media: 'print' });
  ok(await p.run(`getComputedStyle(document.querySelector('.top')).display === 'none' && getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)'`), 'печать А4: без шапки, белый фон');
  await p.send('Emulation.setEmulatedMedia', { media: '' });
  // синхронизация A -> сервер
  await sleep(800); await p.run(`import('./assets/js/sync.js').then(m=>m.syncNow(true))`);
  ok((await p.run(`import('./assets/js/store.js').then(s=>s.all('outbox')).then(o=>o.length)`)) === 0, 'синхронизация: очередь отправлена');
  // офлайн (Service Worker)
  await p.run(`navigator.serviceWorker.ready.then(()=>1)`); await sleep(1500);
  await p.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await p.open(BASE); const offlineOk = await p.until(`!!document.querySelector('#orbits')`, 10000);
  ok(offlineOk, 'офлайн: курс открывается без сети (Service Worker)');
  await p.run(`location.hash='#/м/1'`); ok(await p.until(`!!document.querySelector('.example')`, 8000), 'офлайн: номер открывается из кэша');
  await p.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  // выход
  await p.run(`location.hash='#/настройки'`); await p.until(`!!document.querySelector('[data-logout]')`, 5000);
  await p.run(`document.querySelector('[data-logout]').click()`); ok(await p.until(`!!document.querySelector('input[type=password]')`, 8000), 'выход на устройстве — снова экран пароля');

  // ---------- устройство B: ПК, синхронизация ----------
  const B = await launch();
  const q = await newTab(B, { w: 1440, h: 900, dpr: 1, mobile: false });
  await q.open(BASE); await login(q); await q.until(`!!document.querySelector('#orbits')`, 10000);
  await q.run(`import('./assets/js/sync.js').then(m=>m.syncNow(true))`); await sleep(800);
  const tasksB = await q.run(`import('./assets/js/store.js').then(s=>s.all('events')).then(ev=>ev.filter(e=>e.type==='answer').length)`);
  ok(tasksB >= 2, `синхронизация: ПК получил ответы с iPhone (${tasksB})`);
  ok(await noHScroll(q), 'главная 1440 px: без горизонтальной прокрутки');
  await shot(q, 'pc-home');
  await q.run(`location.hash='#/м/1'`); await q.until(`!!document.querySelector('.example .stage svg')`, 8000); await sleep(800);
  ok(await q.run(`getComputedStyle(document.querySelector('.example')).gridTemplateColumns.split(' ').length === 2`), 'ПК: разворот «рисунок + шаги» в две колонки');
  await shot(q, 'pc-number');
  for (const w of [320, 768]) { await q.size(w, 800, { dpr: 1, mobile: w < 768 }); await sleep(300); ok(await noHScroll(q), `номер ${w} px: без горизонтальной прокрутки`); }
  await A.close(); await B.close();
} catch (e) { fail++; console.log('✗ сбой теста:', e.message); }
finally {
  server.kill(); try { rmSync(syncDir, { recursive: true, force: true }); } catch {}
}
const realErrors = errors.filter((e) => !/AudioContext/.test(e));
ok(!realErrors.length, `консоль без ошибок${realErrors.length ? ': ' + realErrors.slice(0, 3).join(' | ') : ''}`);
ok(!external.length, `ни одного внешнего запроса${external.length ? ': ' + external.slice(0, 3).join(', ') : ''}`);
console.log(`\n${pass}/${pass + fail} проверок пройдено`);
process.exit(fail ? 1 : 0);
