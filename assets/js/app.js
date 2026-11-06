// «ЕГЭ курс 2027» — оболочка: вход, шапка, маршруты (#/…), главная, предмет, план, заметки, настройки.
import { unlock, openJSON } from './crypto.js';
import * as store from './store.js';
import { fold, dueReviews, streak, level, forecast, mastery, dayKey } from './progress.js';
import { buildPlan, feasibility, DEFAULTS } from './plan.js';
import { renderNumber, renderReview } from './number.js';
import { sound } from './extras.js';
import { startSync, syncNow, syncStatus } from './sync.js';

export const App = { K: null, keys: null, catalog: [], bundles: {}, tasksById: {}, S: fold([]), version: null };
const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const SUBJ = { м: 'математика', ф: 'физика' }, LETTER = { математика: 'м', физика: 'ф' };
export const numLink = (n) => `#/${LETTER[n.subject]}/${n.num}`;
const ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  math: '<path d="M5 7h14M9 7v11M15 7v8a3 3 0 0 0 3 3"/>',
  phys: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  note: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  diag: '<path d="M4 19h16M7 16V9M12 16V5M17 16v-4"/>',
  redo: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
};
const NAV = [['#/', 'today', 'Сегодня'], ['#/м', 'math', 'Математика'], ['#/ф', 'phys', 'Физика'], ['#/формулы', 'book', 'Формулы'], ['#/план', 'plan', 'План'], ['#/заметки', 'note', 'Заметки']];
const NAV_EXTRA = [['#/диагностика', 'diag', 'Диагностика'], ['#/повтор', 'redo', 'Повторение ошибок'], ['#/настройки', 'gear', 'Настройки']];
export const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
export function toast(text, ms = 2600) { const t = h(`<div class="toast" role="status">${esc(text)}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), ms); }

// ---------- данные ----------
export async function loadBundle(id) {
  if (App.bundles[id]) return App.bundles[id];
  const r = await fetch(`data/enc/${id}.bin`);
  if (!r.ok) throw new Error('нет пакета ' + id);
  const b = await openJSON(App.K, await r.arrayBuffer());
  App.bundles[id] = b; App.tasksById[id] = b.tasks;
  return b;
}
export async function refreshState() { App.S = fold(await store.all('events')); }
export async function record(type, data) { const ev = await store.record(type, data); await refreshState(); syncNow(); return ev; }
export const setting = (k, def) => (App.S.settings[k] !== undefined ? App.S.settings[k] : def);
const planOpts = () => ({ studyDays: setting('studyDays', DEFAULTS.studyDays), minutes: setting('minutes', DEFAULTS.minutes), exams: setting('exams', DEFAULTS.exams) });

// ---------- вход ----------
let fails = 0, blockedUntil = 0;
function lockView() {
  $('#top').hidden = true;
  const main = $('#main');
  main.innerHTML = '';
  const v = h(`<div class="lock"><div class="lock-box">
    <svg class="lock-art" viewBox="0 0 320 120" aria-hidden="true"><g fill="none" stroke-linecap="round">
      <ellipse cx="160" cy="62" rx="140" ry="34" stroke="var(--blue)" stroke-opacity=".55" stroke-width="1.6" transform="rotate(-8 160 62)"/>
      <ellipse cx="160" cy="62" rx="118" ry="44" stroke="var(--primary)" stroke-opacity=".7" stroke-width="1.6" transform="rotate(14 160 62)"/>
      <circle cx="160" cy="62" r="7" fill="var(--primary)"/></g></svg>
    <h1>ЕГЭ курс 2027</h1><p class="lead">Математика профиль и физика. Курс зашифрован — введи пароль.</p>
    <form autocomplete="on">
      <input type="text" name="username" autocomplete="username" value="ege-kurs-2027" hidden aria-hidden="true">
      <label class="field">Пароль<input class="input" type="password" name="password" autocomplete="current-password" required minlength="4" autofocus></label>
      <label class="check"><input type="checkbox" name="remember" checked> Запомнить это устройство</label>
      <p class="err" role="alert"></p>
      <button class="btn primary" type="submit">Открыть курс</button>
    </form></div></div>`);
  main.appendChild(v);
  const form = $('form', v), err = $('.err', v), btn = $('button', v);
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (Date.now() < blockedUntil) { err.textContent = `Слишком много попыток. Подожди ${Math.ceil((blockedUntil - Date.now()) / 1000)} с.`; return; }
    btn.disabled = true; btn.textContent = 'Открываю…'; err.textContent = '';
    try {
      const k = await unlock(form.password.value, App.keys);
      if (form.remember.checked) await store.put('keys', k, 'K');
      App.K = k; fails = 0; await enter();
    } catch (x) {
      fails++; if (fails >= 5) { blockedUntil = Date.now() + 30000; fails = 0; }
      err.textContent = x.message === 'PASSWORD' ? 'Пароль не подошёл. Проверь раскладку и Caps Lock.' : `Не получилось открыть курс: ${x.message}`;
      btn.disabled = false; btn.textContent = 'Открыть курс'; form.password.select();
    }
  };
}

async function enter() {
  App.catalog = (await openJSON(App.K, await (await fetch('data/enc/catalog.bin')).arrayBuffer())).numbers;
  await refreshState();
  header();
  startSync(App);
  addEventListener('hashchange', route);
  // пришёл прогресс с другого устройства — перерисовать обзорные страницы (не трогаем номер, чтобы не сбить решение)
  addEventListener('ege-synced', () => { const hsh = location.hash.replace(/^#\/?/, ''); if (!hsh || /^(м|ф|план|заметки)\/?$/.test(decodeURIComponent(hsh))) route(); });
  route();
  // день занятий: минуты считаем по активному времени на странице
  let last = Date.now(), acc = 0;
  setInterval(() => { const now = Date.now(); if (document.visibilityState === 'visible' && now - last < 90000) acc += now - last; last = now; if (acc >= 5 * 60000) { record('day', { date: dayKey(now), minutes: Math.round(acc / 60000) }); acc = 0; } }, 30000);
}

// ---------- шапка ----------
function header() {
  const top = $('#top'); top.hidden = false;
  top.innerHTML = `<div class="top-in">
    <button class="iconbtn burger" data-menu aria-label="Меню" aria-expanded="false" aria-controls="menu">${icon('menu')}</button>
    <a class="brand" href="#/"><span class="lamp" aria-hidden="true"></span>ЕГЭ <b>2027</b></a>
    <nav class="nav" id="menu" aria-label="Разделы">${NAV.map(([href, ic, t]) => `<a href="${href}">${icon(ic)}<span>${t}</span></a>`).join('')}
      <div class="menu-extra">${NAV_EXTRA.map(([href, ic, t]) => `<a href="${href}">${icon(ic)}<span>${t}</span></a>`).join('')}</div></nav>
    <span class="sync-dot off" title="Синхронизация" aria-hidden="true"></span>
    <button class="iconbtn" data-sound aria-label="Звуки" aria-pressed="${sound.on}">${icon('sound')}</button>
    <button class="iconbtn" data-calc aria-label="Калькулятор">${icon('calc')}</button>
    <a class="iconbtn" href="#/настройки" aria-label="Настройки">${icon('gear')}</a></div>`;
  $('[data-sound]', top).onclick = (e) => { sound.toggle(); e.currentTarget.setAttribute('aria-pressed', sound.on); if (sound.on) sound.play('ok'); };
  $('[data-calc]', top).onclick = async () => (await import('./calc.js')).openCalc();
  const burger = $('[data-menu]', top), menu = $('#menu', top);
  const setMenu = (on) => { document.body.classList.toggle('menu-open', on); burger.setAttribute('aria-expanded', on); burger.innerHTML = icon(on ? 'close' : 'menu'); };
  burger.onclick = () => setMenu(!document.body.classList.contains('menu-open'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
}
export function setSyncDot(state) { const d = $('.sync-dot'); if (d) { d.className = `sync-dot ${state}`; d.title = { ok: 'Прогресс синхронизирован', wait: 'Есть неотправленный прогресс', off: 'Синхронизация недоступна — прогресс хранится на устройстве' }[state] || ''; } }

// ---------- маршруты ----------
async function route() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const main = $('#main');
  document.querySelectorAll('.nav a').forEach((a) => a.toggleAttribute('aria-current', false));
  const cur = '#/' + (parts[0] || '');
  const navA = [...document.querySelectorAll('.nav a')].find((a) => a.getAttribute('href') === cur);
  if (navA) navA.setAttribute('aria-current', 'page');
  let view;
  try {
    if (!parts.length) view = await home();
    else if (SUBJ[parts[0]] && !parts[1]) view = subjectView(SUBJ[parts[0]]);
    else if (SUBJ[parts[0]] && parts[1]) {
      const n = App.catalog.find((x) => x.subject === SUBJ[parts[0]] && x.num === +parts[1]);
      view = n ? await renderNumber(App, n, parts[2] || 'задачи', parts[3]) : notFound();
    } else if (parts[0] === 'план') view = planView();
    else if (parts[0] === 'заметки') view = notesView();
    else if (parts[0] === 'формулы') view = await (await import('./spravka.js')).renderRef(App, parts[1]);
    else if (parts[0] === 'настройки') view = settingsView();
    else if (parts[0] === 'повтор') view = await renderReview(App);
    else if (parts[0] === 'диагностика') view = await (await import('./diag.js')).renderDiag(App, parts[1]);
    else view = notFound();
  } catch (e) { console.error(e); view = h(`<div class="page"><h1>Не открылось</h1><p class="lead">${esc(e.message)}. Обнови страницу; если повторится — проверь, что сайт обновился.</p></div>`); }
  main.innerHTML = ''; main.appendChild(view);
  scrollTo(0, 0);
  document.title = (view.dataset.title ? view.dataset.title + ' — ' : '') + 'ЕГЭ курс 2027';
  main.focus({ preventScroll: true });
}
const notFound = () => h('<div class="page"><h1>Такой страницы нет</h1><p><a href="#/">На главную</a></p></div>');

// ---------- главная ----------
const daysTo = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.ceil((new Date(y, m - 1, d) - new Date().setHours(0, 0, 0, 0)) / 86400000); };
const plural = (n, a, b, c) => { const m = n % 10, mm = n % 100; return `${n} ${m === 1 && mm !== 11 ? a : m >= 2 && m <= 4 && (mm < 10 || mm >= 20) ? b : c}`; };
/** Карта номеров: сворачиваемая таблица «не начат / в работе / освоен» по предметам (вместо 3D-орбит, решение 06.11) */
function progressMap() {
  const ST = [['new', 'Не начато'], ['work', 'В работе'], ['done', 'Освоено']];
  const by = {}; for (const n of App.catalog) (by[n.subject + statusOf(n)] ||= []).push(n);
  const cnt = (k) => App.catalog.filter((n) => statusOf(n) === k).length;
  const chip = (n) => `<a class="nchip ${statusOf(n)}" href="${numLink(n)}" title="${esc(n.title)}"><b>${n.num}</b><span>${esc(n.title)}</span></a>`;
  let open = false; try { open = localStorage.getItem('pmap') === '1'; } catch { /* приватный режим */ }
  return `<details class="pmap" id="pmap"${open ? ' open' : ''}>
    <summary><span class="pm-t">Карта номеров</span><span class="pm-c"><i class="done"></i>освоено ${cnt('done')}<i class="work"></i>в работе ${cnt('work')}<i class="new"></i>не начато ${cnt('new')}</span></summary>
    <div class="pm-body">${['математика', 'физика'].map((sub) => `<div class="pm-sub"><h3>${sub === 'математика' ? 'Математика · профиль' : 'Физика'}</h3>
      <div class="pm-grid">${ST.map(([k, t]) => `<div class="pm-col"><div class="pm-h">${t} · ${(by[sub + k] || []).length}</div><div class="pm-list">${(by[sub + k] || []).map(chip).join('') || '<span class="muted ui">—</span>'}</div></div>`).join('')}</div></div>`).join('')}</div></details>`;
}
async function home() {
  const S = App.S, ex = planOpts().exams;
  const today = buildPlan(S, App.catalog, { days: 1, tasksById: App.tasksById, opts: planOpts() })[0];
  const fc = forecast(S, App.catalog, App.tasksById), st = streak(S, Date.now(), planOpts().studyDays), lv = level(S.xp);
  const due = dueReviews(S).length;
  const dm = daysTo(ex['математика']), df = daysTo(ex['физика']), hasDiag = Object.keys(S.diag).length > 0;
  const mins = (today.blocks || []).reduce((a, b) => a + (b.minutes || 0), 0);
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const v = h(`<div class="page" data-title="Сегодня"><div class="home2">
    <header class="hero"><p class="eyebrow">${esc(date)}</p><h1 id="today-h">${today.kind === 'rest' ? 'Сегодня отдых' : today.kind === 'mock' ? 'Сегодня пробник' : 'План на сегодня'}</h1>
      <p class="lead">${mins ? `${mins} минут занятий. ` : ''}Сначала задачи — теория открывается прямо в задаче.</p></header>
    <div class="home-grid">
      <div class="col-main">
        ${hasDiag ? '' : `<section class="callout"><div><b>Начни с диагностики</b><p>По 1–2 задачи на каждый номер — план начнёт со слабых мест.</p></div><a class="btn primary" href="#/диагностика">Пройти диагностику</a></section>`}
        <section class="card plan" aria-labelledby="plan-h"><div class="card-h"><h2 id="plan-h">Занятие</h2><span class="muted ui">${mins ? mins + ' мин' : ''}</span></div>
          <ol class="timeline">${(today.blocks || []).map(blockHTML).join('') || '<li class="muted">Сегодня по плану отдых. Можно повторить ошибки или решить пару задач.</li>'}</ol>
          <div class="row"><a class="btn primary" href="${hasDiag ? startHref(today, due) : '#/диагностика'}">${hasDiag ? 'Начать занятие' : 'Сначала диагностика'}</a>${due ? `<a class="btn" href="#/повтор">Повторить ошибки: ${due}</a>` : ''}</div></section>
        ${progressMap()}
      </div>
      <aside class="col-side">
        <section class="card countdown" aria-label="До экзаменов"><div class="cd"><b>${dm}</b><span>${plural(dm, 'день', 'дня', 'дней').replace(/^\d+ /, '')} до математики</span><small>${new Date(ex['математика']).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</small></div>
          <div class="cd"><b>${df}</b><span>${plural(df, 'день', 'дня', 'дней').replace(/^\d+ /, '')} до физики</span><small>${new Date(ex['физика']).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</small></div></section>
        <section class="card forecast"><div class="card-h"><h2>Прогноз баллов</h2><span class="muted ui">цель 90</span></div>
          ${['математика', 'физика'].map((sj) => `<div class="fc"><div class="fc-r"><span>${sj === 'математика' ? 'Математика' : 'Физика'}</span><b>${fc[sj].test}</b></div><div class="bar"><i style="width:${Math.min(100, (fc[sj].test / 90) * 100)}%"></i><em style="left:${(90 / 100) * 100}%"></em></div></div>`).join('')}
          <p class="muted ui small">Освоенные номера × баллы по шкале 2026.</p></section>
        <section class="card mini"><div><b>${st}</b><span>серия дней</span></div><div><b>${lv.lv}</b><span>уровень</span><div class="bar"><i style="width:${((lv.xp - lv.prev) / (lv.next - lv.prev)) * 100}%"></i></div></div></section>
      </aside>
    </div></div></div>`);
  v.querySelector('#pmap').addEventListener('toggle', (e) => { try { localStorage.setItem('pmap', e.target.open ? '1' : '0'); } catch { /* приватный режим */ } });
  return v;
}
function todayTitle(d) {
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  if (d.kind === 'mock') return `Пробник по предмету «${d.subject}» · ${date}`;
  if (d.kind === 'rest') return `Отдых · ${date}`;
  if (d.kind === 'exam') return `Экзамен: ${d.subject}`;
  return `План на сегодня · ${date}`;
}
function blockHTML(b) {
  const n = b.num && App.catalog.find((x) => x.id === b.num);
  const what = b.kind === 'review' ? `Повторение ошибок${b.count ? ` — ${plural(b.count, 'задача', 'задачи', 'задач')}` : ' — пока нечего повторять, реши пару задач прошлых номеров'}`
    : b.kind === 'number' && n ? `<a href="${numLink(n)}">${n.subject === 'математика' ? 'Математика' : 'Физика'}, №${n.num}. ${esc(n.title)}</a> — ${b.stage === 'с нуля' ? '«Проверить себя» → задачи по типам, теория — кнопкой в задаче' : 'продолжаем задачи по типам'}${n.hasContent ? '' : ' <span class="muted">(разбор готовится)</span>'}`
      : b.kind === 'mock' ? `Пробник на 235 минут: ${b.subject}` : `Смешанные задачи: ${b.subject}`;
  return `<li class="tl"><span class="min">${b.minutes}<small>мин</small></span><span class="what">${what}</span></li>`;
}
function startHref(d, due) {
  if (due) return '#/повтор';
  const nb = (d.blocks || []).find((b) => b.kind === 'number');
  const n = nb && App.catalog.find((x) => x.id === nb.num);
  return n ? numLink(n) : '#/м';
}
export function statusOf(n) {
  const m = mastery(App.S, n, App.tasksById[n.id] || []);
  const touched = Object.values(App.S.tasks).some((t) => t.num === n.id) || App.S.numbers[n.id];
  return m >= 0.8 ? 'done' : touched || m > 0 ? 'work' : 'new';
}

// ---------- предмет ----------
function subjectView(subject) {
  const nums = App.catalog.filter((n) => n.subject === subject);
  const card = (n) => { const st = statusOf(n); return `<a class="num ${st === 'done' ? 'done' : st === 'work' ? 'work' : ''} ${n.hasContent ? '' : 'soon'}" href="${numLink(n)}">
    <span class="n">${n.num}</span><span><span class="t">${esc(n.title)}${n.isNew ? ' · новое' : ''}</span><br><span class="s">${plural(n.points, 'балл', 'балла', 'баллов')} · ~${n.minutes} мин${n.pct2026 ? ` · решают ${Math.round(n.pct2026)} %` : ''}</span></span>
    <span class="st">${n.hasContent ? { done: 'освоен', work: 'в работе', new: 'не начат' }[st] : 'скоро'}</span></a>`; };
  return h(`<div class="page" data-title="${subject}"><h1>${subject === 'математика' ? 'Математика · профиль' : 'Физика'}</h1>
    <p class="lead">${subject === 'математика' ? '20 заданий, 33 первичных балла, 235 минут (ЕГЭ-2027).' : '26 заданий, 45 первичных баллов, 235 минут (ЕГЭ-2027).'}</p>
    <h2 class="part-h">Часть 1</h2><div class="nums">${nums.filter((n) => n.part === 1).map(card).join('')}</div>
    <h2 class="part-h">Часть 2 — развёрнутый ответ</h2><div class="nums">${nums.filter((n) => n.part === 2).map(card).join('')}</div></div>`);
}

// ---------- план ----------
function planView() {
  const o = planOpts(), plan = buildPlan(App.S, App.catalog, { days: 21, tasksById: App.tasksById, opts: o }), f = feasibility(App.S, App.catalog, { tasksById: App.tasksById, opts: o });
  const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], todayIso = dayKey(Date.now());
  const v = h(`<div class="page" data-title="План"><h1>План до экзаменов</h1>
    <p class="lead">План пересчитывается каждый день: пропустил день — он сам перестроится под даты экзаменов. Напоминаний нет.</p>
    <div class="grid2"><div class="week">${plan.map((d) => { const dt = new Date(d.date + 'T00:00'); return `<div class="day ${d.date === todayIso ? 'today' : ''} ${d.kind}"><span class="d">${wd[dt.getDay()]}, ${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}</span><span>${d.kind === 'rest' ? 'Отдых' : d.kind === 'exam' ? `<b>Экзамен: ${d.subject}</b>` : d.blocks.map((b) => blockHTML(b).replace(/<div class="block"><span class="min">(\d+) мин<\/span><span>/, '$1 мин — ').replace(/<\/span><\/div>$/, '')).join('<br>')}</span></div>`; }).join('')}</div>
    <div><div class="card"><h3>Хватает ли времени</h3>${['математика', 'физика'].map((s) => `<p class="ui">${s}: нужно ${f[s].need} учебных блоков по 70 мин, есть ${f[s].have} до финиша (за 3 недели до экзамена). ${f[s].ok ? '<span style="color:var(--ok)">Успеваем.</span>' : '<span style="color:var(--err)">Не успеваем — добавь учебный день.</span>'}</p>`).join('')}</div>
    <div class="card"><h3>Настройки плана</h3><form id="plan-form" class="ui" style="display:grid;gap:var(--s3)">
      <fieldset style="border:0;padding:0;margin:0"><legend class="muted" style="margin-bottom:6px">Учебные дни</legend><div class="row">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="check"><input type="checkbox" name="d" value="${d}" ${o.studyDays.includes(d) ? 'checked' : ''}> ${wd[d]}</label>`).join('')}</div></fieldset>
      <label class="field">Математика — дата экзамена<input class="input" type="date" name="em" value="${o.exams['математика']}"></label>
      <label class="field">Физика — дата экзамена<input class="input" type="date" name="ef" value="${o.exams['физика']}"></label>
      <button class="btn primary" type="submit">Сохранить план</button></form></div></div></div></div>`);
  $('#plan-form', v).onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    await record('setting', { key: 'studyDays', value: fd.getAll('d').map(Number) });
    await record('setting', { key: 'exams', value: { математика: fd.get('em'), физика: fd.get('ef') } });
    toast('План сохранён и пересчитан'); route();
  };
  return v;
}

// ---------- заметки, закладки, лист формул ----------
function notesView() {
  const S = App.S, byT = (o) => Object.entries(o).sort((a, b) => b[1].t - a[1].t);
  const titleOf = (key) => { const n = App.catalog.find((x) => x.id === key.split(':')[0]); return n ? `${n.subject === 'математика' ? 'Математика' : 'Физика'} №${n.num}. ${n.title}` : key; };
  const linkOf = (key) => { const n = App.catalog.find((x) => x.id === key.split(':')[0]); return n ? numLink(n) : '#/'; };
  const v = h(`<div class="page" data-title="Заметки"><h1>Заметки, закладки, лист формул</h1>
    <div class="grid2"><div><h2>Мой лист формул</h2>${byT(S.formulas).length ? `<div class="list">${byT(S.formulas).map(([k, f]) => `<div class="item"><div class="t">${esc(f.title || titleOf(k))}</div><div class="mathd">${f.tex || ''}</div><button class="btn quiet small no-print" data-unformula="${esc(k)}">Убрать</button></div>`).join('')}</div><p class="row" style="margin-top:var(--s3)"><button class="btn" data-print>Распечатать лист формул (А4)</button></p>` : '<p class="empty">Пусто. В разборе номера нажми «+» рядом с формулой — она появится здесь.</p>'}</div>
    <div><h2>Заметки</h2>${byT(S.notes).length ? `<div class="list">${byT(S.notes).map(([k, n]) => `<div class="item"><div class="t"><a href="${linkOf(k)}">${esc(n.title || titleOf(k))}</a></div><div style="white-space:pre-wrap">${esc(n.text)}</div></div>`).join('')}</div>` : '<p class="empty">Заметок пока нет. В номере — кнопка «Заметка».</p>'}
    <h2>Закладки</h2>${byT(S.marks).length ? `<div class="list">${byT(S.marks).map(([k, m]) => `<div class="item"><a href="${linkOf(k)}">${esc(m.title || titleOf(k))}</a></div>`).join('')}</div>` : '<p class="empty">Закладок нет.</p>'}</div></div></div>`);
  v.querySelectorAll('[data-unformula]').forEach((b) => (b.onclick = async () => { await record('formula', { key: b.dataset.unformula, on: false }); route(); }));
  v.querySelector('[data-print]')?.addEventListener('click', () => print());
  return v;
}

// ---------- настройки ----------
function settingsView() {
  const ss = syncStatus();
  const v = h(`<div class="page prose" data-title="Настройки"><h1>Настройки</h1>
    <div class="card"><h3>Синхронизация ПК ↔ iPhone</h3><p class="ui">${esc(ss.text)}</p><div class="row"><button class="btn" data-sync>Синхронизировать сейчас</button></div></div>
    <div class="card"><h3>Звук и озвучка</h3><label class="check"><input type="checkbox" data-snd ${sound.on ? 'checked' : ''}> Тихие звуки (верно, серия, уровень)</label>
      <p class="muted ui" style="font-size:14px">Кнопка «Прочитать вслух» в номере использует встроенный голос браузера (на iPhone — голос Siri, работает без интернета).</p></div>
    <div class="card"><h3>Прогресс</h3><p class="ui">Событий в журнале: ${App.S ? Object.keys(App.S.tasks).length : 0} задач решалось. Можно сохранить копию прогресса в файл и восстановить на другом устройстве.</p>
      <div class="row"><button class="btn" data-export>Сохранить прогресс в файл</button><label class="btn">Загрузить из файла<input type="file" accept=".json" data-import hidden></label></div></div>
    <div class="card danger-zone"><h3>Сбросить прогресс</h3><p class="ui">Решённые задачи, повторение, диагностика, заметки, закладки, лист формул и черновики — как будто сайт только создан. Сброс попадёт и на другие устройства при синхронизации. Отменить нельзя — сначала можно сохранить прогресс в файл.</p>
      <div class="row"><label class="field" style="min-width:200px">Что сбросить<select class="input" data-rscope><option value="математика">Только математику</option><option value="физика">Только физику</option><option value="всё">Весь прогресс</option></select></label>
      <label class="field" style="min-width:200px"><span data-rq></span><input class="input" inputmode="numeric" data-rans autocomplete="off"></label></div>
      <div class="row" style="margin-top:var(--s2)"><button class="btn danger" data-reset disabled>Сбросить</button><span class="muted ui" data-rmsg></span></div></div>
    <div class="card"><h3>Пароль и устройство</h3><p class="ui">Пароль меняется на компьютере командой <code>node tools/set-password.mjs</code> (контент перешифровывать не нужно). Это устройство ${App.K ? 'запомнено' : 'не запомнено'}.</p>
      <button class="btn" data-logout>Выйти на этом устройстве</button></div>
    <p class="muted ui" style="font-size:13px">Версия контента: ${esc(App.version?.v || '—')}</p></div>`);
  $('[data-sync]', v).onclick = async () => { await syncNow(true); route(); };
  { // сброс прогресса с проверочным примером (капча), чтобы не нажать случайно
    const x = 11 + Math.floor(Math.random() * 30), y = 7 + Math.floor(Math.random() * 20);
    $('[data-rq]', v).textContent = `Проверка: сколько будет ${x} + ${y}?`;
    const ans = $('[data-rans]', v), btn = $('[data-reset]', v);
    ans.oninput = () => { btn.disabled = +ans.value.trim() !== x + y; };
    btn.onclick = async () => {
      const scope = $('[data-rscope]', v).value;
      if (+ans.value.trim() !== x + y) return;
      await record('reset', { scope });
      try { // черновики на этом устройстве
        const pre = scope === 'физика' ? /^доска:(диаг:d-)?f\d/ : scope === 'математика' ? /^доска:(диаг:d-)?m\d/ : /^доска:/;
        for (const k of Object.keys(localStorage)) if (pre.test(k)) localStorage.removeItem(k);
      } catch { /* приватный режим */ }
      toast(scope === 'всё' ? 'Весь прогресс сброшен' : `Прогресс по предмету «${scope}» сброшен`);
      route();
    };
  }
  $('[data-snd]', v).onchange = (e) => { sound.set(e.target.checked); document.querySelector('[data-sound]')?.setAttribute('aria-pressed', sound.on); };
  $('[data-export]', v).onclick = async () => {
    const evs = await store.all('events');
    const a = h(`<a download="ege-progress-${dayKey(Date.now())}.json"></a>`); a.href = URL.createObjectURL(new Blob([JSON.stringify({ v: 1, events: evs })], { type: 'application/json' })); a.click();
  };
  $('[data-import]', v).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const { events } = JSON.parse(await f.text()); await store.putMany('events', events); await store.putMany('outbox', events); await refreshState(); toast(`Загружено событий: ${events.length}`); route(); } catch { toast('Файл не похож на прогресс курса'); }
  };
  $('[data-logout]', v).onclick = async () => { await store.del('keys', 'K'); App.K = null; location.hash = ''; location.reload(); };
  return v;
}

// ---------- запуск ----------
async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage('skip-waiting'); }); });
    }).catch(() => {});
    let reloading = false; const hadController = !!navigator.serviceWorker.controller;   // первая установка — не перезагружать
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return;
      if (/\/(тип|проверка)/.test(decodeURIComponent(location.hash))) { toast('Курс обновлён — новая версия откроется при переходе', 5000); return; }
      reloading = true; location.reload();
    });
  }
  try {
    App.keys = await (await fetch('data/keys.json', { cache: 'no-store' })).json();
    App.version = await (await fetch('data/version.json', { cache: 'no-store' })).json().catch(() => null);
  } catch { $('#main').innerHTML = '<div class="page"><h1>Нет связи</h1><p class="lead">Первый раз курс нужно открыть с интернетом.</p></div>'; return; }
  const k = await store.get('keys', 'K').catch(() => null);
  if (k) { App.K = k; try { await enter(); return; } catch (e) { console.warn('запомненный ключ не подошёл', e); await store.del('keys', 'K'); } }
  lockView();
}
boot();
