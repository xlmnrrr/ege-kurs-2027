// Синхронизация прогресса ПК ↔ iPhone (АРХИТЕКТУРА.md §3.5). События шифруются ключом K до отправки — сервер видит только шифротекст.
import { b64, unb64, sealText, openText, syncToken } from './crypto.js';
import * as store from './store.js';

let App = null, token = null, url = '/sync', busy = null, again = false, timer = 0, state = { ok: null, text: 'Ещё не синхронизировалось.', at: 0 };
export const syncStatus = () => state;

export async function startSync(app) {
  App = app;
  try { const cfg = await (await fetch('data/config.json', { cache: 'no-store' })).json(); if (cfg.syncUrl !== undefined) url = cfg.syncUrl; } catch { /* по умолчанию тот же сервер */ }
  if (!url) { state = { ok: false, text: 'Синхронизация не настроена: прогресс хранится на этом устройстве (есть сохранение в файл).' }; mark(); return; }
  token = await syncToken(App.K);
  addEventListener('online', () => syncNow());
  setInterval(() => syncNow(), 60000);
  syncNow();
}
function mark() {
  import('./app.js').then(({ setSyncDot }) => store.all('outbox').then((o) => setSyncDot(state.ok === false ? 'off' : o.length ? 'wait' : 'ok')));
}
export function syncNow(immediate = false) {
  clearTimeout(timer);
  return new Promise((res) => { timer = setTimeout(() => run().then(res), immediate ? 0 : 1500); });
}
async function run() {
  if (!App?.K || !token || !url) return mark();
  if (busy) { again = true; return busy; } // отправка уже идёт — повторить сразу после неё
  let done; busy = new Promise((r) => (done = r));
  try {
    const outbox = await store.all('outbox');
    const push = await Promise.all(outbox.map(async (ev) => ({ id: ev.id, blob: b64(await sealText(App.K, JSON.stringify(ev))) })));
    const after = (await store.get('meta', 'cursor')) || 0;
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': token }, body: JSON.stringify({ after, push }) });
    if (r.status === 404 || r.status === 405) { state = { ok: false, text: 'На этом хостинге синхронизации нет: прогресс хранится на устройстве.' }; return; }
    if (!r.ok) throw new Error('сервер ответил ' + r.status);
    const { cursor, pull } = await r.json();
    const have = new Set((await store.all('events')).map((e) => e.id));
    const fresh = [];
    for (const row of pull) { if (have.has(row.id)) continue; try { fresh.push(JSON.parse(await openText(App.K, unb64(row.blob)))); } catch { /* чужая запись — пропуск */ } }
    if (fresh.length) await store.putMany('events', fresh);
    for (const ev of outbox) await store.del('outbox', ev.id);
    await store.put('meta', cursor, 'cursor');
    state = { ok: true, text: `Синхронизировано ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}: отправлено ${push.length}, получено ${fresh.length}.`, at: Date.now() };
    if (fresh.length) { const { refreshState } = await import('./app.js'); await refreshState(); dispatchEvent(new Event('ege-synced')); }
  } catch (e) {
    state = { ok: null, text: `Нет связи с сервером синхронизации (${e.message}). Прогресс сохранён на устройстве и отправится позже.` };
  } finally { const p = busy; busy = null; mark(); if (again) { again = false; await run(); } done(); }
}
