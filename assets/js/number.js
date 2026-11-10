// Страница номера «сначала задача» (этап 6, отзыв Макара 06.11):
//   задачи (по умолчанию) — «Проверить себя» + карточки типов с прогрессом;
//   тип/tN и проверка — экран задачи: условие, рисунок, ответ, Подсказка / Теория / Решение, черновик-доска справа;
//   теория, ловушки, шпаргалка — вкладки для чтения целиком. Повторение ошибок — тот же экран задачи.
import { App, esc, h, loadBundle, record, toast, numLink } from './app.js';
import { Chertezh, mid, lerp, V } from './chertezh.js';
import { dueReviews } from './progress.js';
import { sound, speak } from './extras.js';
import { mountBoard } from './board.js';

// Подписи и буквы предметов в одном месте: раньше здесь было жёстко «математика или физика»
const SUBJ_NAME = { математика: 'Математика', физика: 'Физика', русский: 'Русский' };
const SUBJ_LET = { математика: 'м', физика: 'ф', русский: 'р' };
const subjName = (n) => SUBJ_NAME[n.subject] || n.subject;
const subjLet = (n) => SUBJ_LET[n.subject] || 'м';

const figMods = {};
async function figuresOf(b) { // код рисунков номера: расшифрованный текст -> модуль через Blob URL
  if (!b.figures) return {};
  if (!figMods[b.id]) { const url = URL.createObjectURL(new Blob([b.figures], { type: 'text/javascript' })); figMods[b.id] = import(url).finally(() => URL.revokeObjectURL(url)); }
  return figMods[b.id];
}
function makeFigure(fn, svg) {
  const ch = new Chertezh(svg, { mode: '2d' });
  fn(ch, { mid, lerp, V });
  ch.render();
  return ch;
}
const camel = (s) => s.replace(/-([\p{L}\d])/gu, (_, c) => c.toUpperCase());
function drawFigs(root, figs) {
  root.querySelectorAll('figure.fig[data-fig]').forEach((f) => {
    const fn = figs[camel(f.dataset.fig)];
    if (!fn) { f.remove(); return; }
    f.innerHTML = '<svg role="img" aria-label="Рисунок"></svg>'; const ch = makeFigure(fn, f.firstChild); ch.setStep(ch.steps - 1, true);
  });
}

/** Разворот «рисунок + шаги» для примера (DESIGN.md, DRAWINGS.md §5) */
function stand(host, ex, figs, numId) {
  const fn = ex.fig && figs[ex.fig];
  const el = h(`<div class="example"><div class="panel"><div class="stage"><svg role="img" aria-label="Рисунок к примеру ${esc(ex.id)}"></svg></div>
    <div class="stepbar"><button data-prev aria-label="Предыдущий шаг">‹</button><div class="chips"></div><button data-next aria-label="Следующий шаг">›</button></div><p class="caption" aria-live="polite"></p></div>
    <div class="stepcards"></div></div>`);
  host.replaceWith(el);
  const svg = el.querySelector('svg');
  let ch = null;
  if (fn) { ch = makeFigure(fn, svg); if (ch.mode === '3d') { const b = h('<button class="btn small view">Как в тетради</button>'); b.onclick = () => ch.toNotebook(); el.querySelector('.stage').appendChild(b); } }
  else el.querySelector('.stage').remove();
  const chips = el.querySelector('.chips'), cards = el.querySelector('.stepcards'), cap = el.querySelector('.caption');
  ex.steps.forEach((s, i) => {
    const b = h(`<button type="button" aria-label="Шаг ${i + 1}: ${esc(s.name)}"><span class="n">${i + 1}</span><span class="nm">${esc(s.name)}</span></button>`); b.onclick = () => go(i); chips.appendChild(b);
    const c = h(`<div class="stepcard" tabindex="0"><h4>Шаг ${i + 1}. ${esc(s.name)}</h4>${s.html}</div>`); c.onclick = () => go(i); c.onkeydown = (e) => { if (e.key === 'Enter') go(i); }; cards.appendChild(c);
  });
  if (ex.answer) cards.appendChild(h(`<div class="ex-answer">Ответ: ${esc(ex.answer)}</div>`));
  const prev = el.querySelector('[data-prev]'), next = el.querySelector('[data-next]');
  let cur = 0, seen = false;
  function go(i) {
    cur = i; ch?.setStep(i);
    [...chips.children].forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    [...cards.querySelectorAll('.stepcard')].forEach((c, k) => { c.classList.toggle('cur', k === i); c.classList.toggle('later', k > i); });
    cap.innerHTML = `<b>Шаг ${i + 1}.</b> ${esc(ex.steps[i].name)}`;
    prev.disabled = i === 0; next.disabled = i === ex.steps.length - 1;
    if (i === ex.steps.length - 1 && !seen) { seen = true; record('step', { num: numId, part: 'пример:' + ex.id }); }
  }
  prev.onclick = () => go(Math.max(0, cur - 1)); next.onclick = () => go(Math.min(ex.steps.length - 1, cur + 1));
  el.querySelector('.panel').addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') next.click(); if (e.key === 'ArrowLeft') prev.click(); });
  go(0);
}

// ---------- проверка ответа как в бланке ----------
export function normalize(s) { return String(s ?? '').trim().replace(/\s+/g, '').replace(/[−–—]/g, '-').replace(/\./g, ','); }
export function checkAnswer(given, task) {
  const g = normalize(given), a = normalize(task.a);
  if (!g) return null;
  const num = (x) => (/^-?\d+(,\d+)?$/.test(x) ? parseFloat(x.replace(',', '.')) : NaN);
  if (task.tol) { const [c, d] = normalize(task.tol).split('±').map(num); const x = num(g); return !Number.isNaN(x) && Math.abs(x - c) <= d + 1e-12; }
  const x = num(g), y = num(a);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return Math.abs(x - y) < 1e-9;
  if (a.includes(';')) {   // несколько чисел: «2,4;0,2», допускаем «2,4±0,2», «2,4+-0,2», «2,4/0,2»
    const gs = g.replace(/\+-|±|\//g, ';').split(';'), as = a.split(';');
    if (g === as.join('')) return true;   // как на бланке ЕГЭ: «4,60,1» — значение и погрешность слитно
    return gs.length === as.length && as.every((v, k) => { const p = num(gs[k]), q = num(v); return Number.isNaN(q) ? gs[k] === v : !Number.isNaN(p) && Math.abs(p - q) < 1e-9; });
  }
  return g === a;
}


/** Проверка сочинения: живые цифры по тексту, который ученик вставил сам (русский) */
const AI_MARKERS = ['играет ключевую роль','играет важную роль','выступает символом','подчеркивает важность','подчёркивает важность','в современном мире','важно отметить','важно подчеркнуть','стоит подчеркнуть','необходимо учитывать','следует отметить','данный','является','осуществляется','представляет собой','более того','кроме того','таким образом','подводя итог','в заключение','многогранный','углубляться','гобелен','дотошный','знаковый','парадигма','релевантный','концептуальный','символизирует','олицетворяет','резюмируя'];
function mountEssayCheck(host) {
  host.innerHTML = `<div class="ec-head"><h3>Проверь своё сочинение</h3><p class="muted ui">Вставь текст — проверка идёт сама, ничего никуда не отправляется.</p></div>` +
    `<div class="ec-timer no-print"><button class="btn" data-timer>Таймер 3:55</button><b data-timerv>3:55</b><span class="muted ui">как на экзамене</span></div>` +
    `<textarea class="ec-text" placeholder="Вставь сюда своё сочинение..."></textarea>` +
    `<div class="ec-stats"></div><div class="ec-res"></div>`;
  const ta = host.querySelector('.ec-text'), stats = host.querySelector('.ec-stats'), res = host.querySelector('.ec-res');
  let tick = null, left = 235;
  const btn = host.querySelector('[data-timer]'), tv = host.querySelector('[data-timerv]');
  const show = () => { tv.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); tv.className = left <= 15 ? 'bad' : ''; };
  btn.onclick = () => {
    if (tick) { clearInterval(tick); tick = null; btn.textContent = 'Таймер 3:55'; return; }
    left = 235; show(); btn.textContent = 'Стоп';
    tick = setInterval(() => { left--; show(); if (left <= 0) { clearInterval(tick); tick = null; btn.textContent = 'Таймер 3:55'; toast('Время вышло — 3 часа 55 минут'); } }, 1000);
  };
  const words = (t) => (t.match(/[А-Яа-яЁёA-Za-z]+(?:-[А-Яа-яЁёA-Za-z]+)?/g) || []);
  const analyze = () => {
    const t = ta.value;
    if (!t.trim()) { stats.innerHTML = ''; res.innerHTML = ''; return; }
    const w = words(t), n = w.length;
    const sents = t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z"])/).filter((x) => x.trim());
    const lens = sents.map((x) => words(x).length);
    const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    let sd = 0; if (lens.length > 1) { let v = 0; for (const L of lens) v += (L - mean) ** 2; sd = Math.sqrt(v / lens.length); }
    const shortN = lens.filter((x) => x <= 5).length, longN = lens.filter((x) => x >= 25).length;
    const paras = t.split(/\n\s*\n/).filter((x) => x.trim()).length;
    const low = t.toLowerCase(), found = AI_MARKERS.filter((m) => low.includes(m));
    const typo = [];
    if (t.includes('\u2014')) typo.push('длинное тире');
    if (t.includes('\u2026')) typo.push('многоточие-символ');
    if (t.includes('\u00ab') || t.includes('\u00bb')) typo.push('кавычки-ёлочки');
    if (t.includes('\u00a0')) typo.push('неразрывные пробелы');
    if (t.includes('**')) typo.push('звёздочки markdown');
    const first = t.trim()[0];
    stats.innerHTML = `<span class="ec-s">Слов <b>${n}</b></span><span class="ec-s">Абзацев <b>${paras}</b></span><span class="ec-s">Предложений <b>${sents.length}</b></span><span class="ec-s">Длина <b>${lens.length ? Math.min(...lens) : 0}–${lens.length ? Math.max(...lens) : 0}</b></span><span class="ec-s">Ритм <b>${sd.toFixed(1)}</b></span><span class="ec-s">Коротких <b>${shortN}</b></span>`;
    const line = (good, text) => `<div class="ec-line ${good ? 'ok' : 'warn'}"><b>${good ? '✓' : '!'}</b><span>${text}</span></div>`;
    let h = '';
    h += n < 250 ? line(false, `Слов ${n} — это меньше 250, автоматический незачёт. Добавляй.`)
      : n < 330 ? line(true, `Слов ${n} — проходит, но лучше довести до 330–380: будет запас.`)
      : n <= 380 ? line(true, `Слов ${n} — объём идеальный.`)
      : line(true, `Слов ${n} — больше 380, следи, чтобы не появилась вода.`);
    h += paras === 4 ? line(true, 'Абзацев ровно 4 — так и нужно: тезис, два аргумента, вывод.')
      : line(false, `Абзацев ${paras}. Нужно 4. Разделяй части пустой строкой.`);
    h += sd >= 3 ? line(true, `Ритм живой (разброс ${sd.toFixed(1)}): предложения разной длины.`)
      : line(false, `Разброс длины всего ${sd.toFixed(1)} — текст звучит ровно и машинно. Сделай часть фраз по 3–5 слов, часть по 25–30.`);
    if (shortN < 3) h += line(false, `Коротких фраз мало (${shortN}). Добавь рубленые: «Бела погибает.» «Провожать его некому.»`);
    if (longN === 0) h += line(false, 'Нет ни одного длинного предложения (25+ слов) — ритм получается плоским.');
    h += found.length ? line(false, 'Слова-маркеры: ' + found.map((x) => '«' + x + '»').join(', ') + '. Замени или убери.')
      : line(true, 'Слов-маркеров не найдено.');
    h += typo.length ? line(false, 'Оформление: ' + typo.join(', ') + '.') : line(true, 'Оформление чистое.');
    if (first && first === first.toLowerCase() && /[а-яё]/.test(first)) h += line(false, 'Текст начинается со строчной буквы.');
    const ex = ['Печорин','Соколов','Матрён','Раскольников','Базаров','Обломов','Гринёв','Чацкий','Катерина','Онегин'];
    const heroes = ex.filter((x) => t.includes(x));
    h += heroes.length >= 2 ? line(true, 'В тексте есть конкретные герои: ' + heroes.join(', ') + '.')
      : line(false, 'Мало конкретных имён. Судя по тексту, героев почти нет — а по критерию 2 нужен конкретный эпизод с именами.');
    h += /(таким образом|подводя итог|в заключение|играет важную роль)/i.test(t) ? line(false, 'Есть связки-автоматы («таким образом», «в заключение») — не больше одной на текст.') : line(true, 'Связок-автоматов нет.');
    res.innerHTML = h;
  };
  ta.addEventListener('input', analyze);
  ta.value = (App.S.notes['ru:essay'] && App.S.notes['ru:essay'].text) || '';
  analyze();
  let saveT = null;
  ta.addEventListener('input', () => { clearTimeout(saveT); saveT = setTimeout(() => record('note', { key: 'ru:essay', text: ta.value, title: 'Черновик сочинения' }), 1500); });
}

// ---------- разбор номера на части: теория, типы, ловушки ----------
function parseDoc(html) {
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  tmp.querySelector('.known-slot')?.remove();
  const out = { intro: [], theory: [], types: [], traps: [], tail: [], formulas: '' };
  let h2 = '', cur = null;
  for (const node of [...tmp.children]) {
    if (node.tagName === 'H2') { h2 = node.textContent.trim(); cur = null; if (!/^(Теория|Типы задач|Ловушки|Что проверяет|Формулы)/.test(h2)) out.tail.push(node.outerHTML); continue; }
    if (h2.startsWith('Что проверяет')) { out.intro.push(node.outerHTML); continue; }
    if (h2 === 'Теория') {
      if (node.tagName === 'H3') { cur = { title: node.textContent.trim(), html: '' }; out.theory.push(cur); } else if (cur) cur.html += node.outerHTML; else out.intro.push(node.outerHTML);
      continue;
    }
    if (h2 === 'Типы задач') {
      if (node.tagName === 'H3') { const m = node.textContent.match(/Тип\s+(\d+)\.\s*(.*)/); cur = { id: 't' + (m ? m[1] : out.types.length + 1), title: m ? m[2] : node.textContent, html: '' }; out.types.push(cur); } else if (cur) cur.html += node.outerHTML;
      continue;
    }
    if (h2 === 'Формулы') { out.formulas += node.outerHTML; continue; }
    if (h2 === 'Ловушки') { if (node.matches('.trap')) out.traps.push(node.outerHTML); continue; }
    out.tail.push(node.outerHTML);
  }
  for (const t of out.types) {
    const d = document.createElement('div'); d.innerHTML = t.html;
    const how = [...d.querySelectorAll('p')].find((p) => /^Как узнать/.test(p.textContent));
    t.what = how ? how.textContent.replace(/^Как узнать:\s*/, '').split(/[;.]/)[0] : '';
    const stems = (s) => s.toLowerCase().replace(/ё/g, 'е').match(/[а-я]{4,}/g)?.map((w) => w.slice(0, 6)).filter((w) => !['задачи', 'тип', 'общего'].includes(w)) || [];
    const ts = new Set(stems(t.title));
    t.theory = out.theory.filter((s) => stems(s.title).some((w) => ts.has(w)));
  }
  return out;
}

// ---------- панель «Теория к типу» ----------
let drawer = null;
function theoryPanel() {
  if (drawer) return drawer;
  const scrim = h('<div class="dw-scrim"></div>'), el = h(`<aside class="dw" aria-label="Теория к типу" aria-hidden="true"><div class="dw-head"><b></b><button class="btn quiet" data-close aria-label="Закрыть">✕</button></div><div class="dw-body doc"></div></aside>`);
  document.body.append(scrim, el);
  const close = () => { el.classList.remove('on'); scrim.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); };
  el.querySelector('[data-close]').onclick = close; scrim.onclick = close;
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('hashchange', close);
  drawer = { open(title, html, after) { el.querySelector('.dw-head b').textContent = title; const body = el.querySelector('.dw-body'); body.innerHTML = html; after?.(body); body.scrollTop = 0; el.classList.add('on'); scrim.classList.add('on'); el.setAttribute('aria-hidden', 'false'); }, close };
  return drawer;
}

/** Карточка задачи. Поток (ТЗ п.5.6): ошибка -> подсказка 1 -> ошибка -> подсказка 2 -> ошибка -> решение. */
function taskCard(task, numId, figs, opt = {}) {
  const n = App.catalog.find((x) => x.id === numId);
  const srcTxt = task.src ? `${esc(task.src.вид || '')}${task.src.где ? ': ' + esc(task.src.где) : ''}` : '';
  const LV = ['', 'база', 'средний', 'трудный'];
  const el = h(`<article class="task" aria-label="Задача ${esc(task.id)}">
    <div class="task-meta"><span class="chip">${n ? `${subjName(n)} №${n.num}` : ''} · тип ${esc(task.type.replace(/^t/, ''))}</span><span class="chip lv${task.level}">${LV[task.level] || ''}</span>
      <button class="btn quiet small" data-say>Вслух</button></div>
    <div class="q">${task.q}</div>
    ${task.fig && figs[task.fig] ? '<figure class="fig"><svg role="img" aria-label="Рисунок к задаче"></svg></figure>' : ''}
    ${Array.isArray(task.choices) && task.choices.length ? `<div class="choices">${task.choices.map((c, i) => `<button type="button" class="choice" data-v="${i + 1}"><b>${i + 1}</b><span>${c}</span></button>`).join('')}</div>` : ''}
    <form class="answer${Array.isArray(task.choices) && task.choices.length ? ' answer-hidden' : ''}" autocomplete="off"><label class="sr" for="a-${esc(task.id)}">Ответ</label><input class="input" id="a-${esc(task.id)}" inputmode="decimal" placeholder="Ответ"><button class="btn primary" type="submit">Проверить</button></form>
    <div class="tools"><button class="btn" data-hint>Подсказка</button>${opt.onTheory ? '<button class="btn" data-theory>Теория</button>' : ''}${opt.onFormulas ? '<button class="btn" data-formulas>Формулы</button>' : ''}<button class="btn quiet" data-sol>Решение</button></div>
    <div class="res" aria-live="polite"></div><div class="hints"></div>
    ${srcTxt ? `<p class="src">Источник: ${srcTxt}</p>` : ''}</article>`);
  if (task.fig && figs[task.fig]) { const ch = makeFigure(figs[task.fig], el.querySelector('figure svg')); ch.setStep(0, true); }
  let tries = 0, hints = 0, done = false;
  const box = el.querySelector('.hints'), res = el.querySelector('.res'), input = el.querySelector('input');
  const show = (k) => {
    if (k === 1 && hints < 1) { box.appendChild(h(`<div class="hint"><b>Подсказка 1.</b> ${task.h1.replace(/^<p>|<\/p>$/g, '')}</div>`)); hints = 1; }
    else if (k === 2 && hints < 2) { if (hints < 1) show(1); box.appendChild(h(`<div class="hint"><b>Подсказка 2.</b> ${task.h2.replace(/^<p>|<\/p>$/g, '')}</div>`)); hints = 2; el.querySelector('[data-hint]').disabled = true; }
    else if (k === 3 && !done) { box.appendChild(h(`<div class="key"><b class="ui">Решение.</b> ${task.sol}<p class="ui"><b>Ответ: ${esc(task.a)}</b></p>${task.crit ? `<details class="crit"><summary class="ui">Критерии ФИПИ: как оценят это решение (макс. ${task.max || 2} б.)</summary>${task.crit}</details>` : ''}</div>`)); finish(false); }
  };
  el.querySelector('[data-hint]').onclick = () => show(Math.min(2, hints + 1));
  el.querySelector('[data-sol]').onclick = () => show(3);
  if (opt.onTheory) el.querySelector('[data-theory]').onclick = opt.onTheory;
  if (opt.onFormulas) el.querySelector('[data-formulas]').onclick = opt.onFormulas;
  el.querySelector('[data-say]').onclick = () => speak(task.say);
  async function finish(ok) {
    if (done) return; done = true;
    el.querySelector('[data-hint]').disabled = true; el.querySelector('[data-sol]').disabled = true; input.disabled = true; el.querySelector('form button').disabled = true;
    await record('answer', { task: task.id, num: numId, ok, hints, tries, given: input.value });
    opt.onFinish?.(ok);
  }
  el.querySelectorAll('.choice').forEach((btn) => (btn.onclick = () => {
    if (done) return;
    el.querySelectorAll('.choice').forEach((x) => x.classList.remove('picked'));
    btn.classList.add('picked');
    input.value = btn.getAttribute('data-v');
    el.querySelector('form').requestSubmit();
  }));
  el.querySelector('form').onsubmit = (e) => {
    e.preventDefault(); if (done) return;
    const r = checkAnswer(input.value, task);
    if (r === null) { res.innerHTML = '<div class="result bad"><b>Введи ответ.</b> Число как в бланке: запятая, минус, без единиц.</div>'; return; }
    el.querySelectorAll('.choice').forEach((x) => x.classList.toggle('right', !!r && x.classList.contains('picked')));
    el.querySelectorAll('.choice.picked').forEach((x) => { if (!r) x.classList.add('wrong'); });
    if (r) { res.innerHTML = `<div class="result ok"><b>Верно.</b> ${tries || hints ? 'С подсказкой — задача вернётся на повторение завтра.' : 'Чисто, без подсказок.'}</div>`; sound.play('ok'); finish(true); return; }
    tries++; sound.play('bad');
    res.innerHTML = `<div class="result bad"><b>Пока неверно.</b> ${tries === 1 ? 'Вот подсказка — попробуй ещё раз.' : tries === 2 ? 'Вторая подсказка — уже почти решение.' : 'Смотри полное решение — задача вернётся на повторение.'}</div>`;
    show(Math.min(3, tries));
    if (!done) input.select();
  };
  return el;
}

/** Задача + черновик рядом (на телефоне черновик под задачей). Черновик есть у любой задачи курса. */
export function withBoard(card, key) {
  const w = h(`<div class="work"><div class="work-task"></div><section class="board" aria-label="Черновик"><h4>Черновик</h4><div class="bd-host"></div></section></div>`);
  w.querySelector('.work-task').appendChild(card);
  mountBoard(w.querySelector('.bd-host'), { key, getFigure: () => card.querySelector('figure.fig svg') });
  return w;
}

/** Экран решения: задачи типа (или «Проверить себя») по одной, с «Предыдущая / Следующая». */
function solveScreen(host, list, ctx) {
  const { n, b, figs, doc, title, back, mode } = ctx;
  let i = Math.max(0, list.findIndex((t) => !App.S.tasks[t.id]?.last?.ok));
  let firstTry = 0;
  const render = () => {
    const t = list[i], ty = doc.types.find((x) => x.id === t.type);
    host.innerHTML = '';
    host.appendChild(h(`<div class="solve-head"><p class="ui muted crumbs"><a href="${back}">№${n.num}</a> › ${esc(title)} › задача ${i + 1} из ${list.length}</p>
      <div class="dots" aria-hidden="true">${list.map((x, k) => `<i class="${App.S.tasks[x.id]?.last?.ok ? 'ok' : ''} ${k === i ? 'cur' : ''}"></i>`).join('')}</div></div>`));
    const card = taskCard(t, n.id, figs, {
      onTheory: ty ? () => openTheory(ty) : null,
      onFormulas: doc.formulas ? () => theoryPanel().open(`Формулы №${n.num}`, `<div class="formulas">${doc.formulas}</div>`) : null,
      onFinish: (ok) => { if (ok && !card.dataset.tried) firstTry++; host.querySelector('[data-next]')?.focus(); },
    });
    card.querySelector('form').addEventListener('submit', () => { card.dataset.tried = card.dataset.tried || (card.querySelector('.result.bad') ? '1' : ''); }, true);
    host.appendChild(withBoard(card, t.id));
    const nav = h(`<div class="solve-nav"><div class="row"><a class="btn quiet" href="${back}">${mode === 'check' ? 'К номеру' : 'Все типы'}</a><button class="btn" data-prev ${i === 0 ? 'disabled' : ''}>‹ Предыдущая</button></div>
      <button class="btn primary" data-next>${i + 1 < list.length ? 'Следующая ›' : mode === 'check' ? 'Итог ›' : 'Тип пройден ›'}</button></div>`);
    host.appendChild(nav);
    nav.querySelector('[data-prev]').onclick = () => { if (i > 0) { i--; render(); scrollTo(0, 0); } };
    nav.querySelector('[data-next]').onclick = async () => {
      if (i + 1 < list.length) { i++; render(); scrollTo(0, 0); return; }
      if (mode === 'check') {
        await record('known', { num: b.id, score: firstTry, total: list.length });
        host.innerHTML = '';
        host.appendChild(h(`<div class="card" style="max-width:820px"><h2>${firstTry} из ${list.length} с первой попытки</h2><p>${firstTry === list.length ? 'Номер ты знаешь — тренируй трудный уровень и скорость.' : 'Начни с типов, где были ошибки: в каждом сначала база, потом трудные задачи. Теория — кнопкой «Теория» прямо в задаче.'}</p><p><a class="btn primary" href="${back}">К типам задач</a></p></div>`));
        sound.play(firstTry === list.length ? 'level' : 'bad');
      } else location.hash = back;
    };
  };
  const openTheory = (ty) => {
    const th = ty.theory.map((s) => `<h3>${esc(s.title)}</h3>${s.html}`).join('');
    theoryPanel().open(`Тип ${ty.id.slice(1)}. ${ty.title}`, `${ty.html}${th ? '<h2 class="dw-sep">Теория</h2>' + th : ''}`, (body) => {
      drawFigs(body, figs);
      for (const ex of b.examples) { const hostEx = body.querySelector(`[data-example="${CSS.escape(ex.id)}"]`); if (hostEx) stand(hostEx, ex, figs, n.id); }
    });
  };
  render();
}

export async function renderNumber(App_, n, tab, arg) {
  const base = numLink(n);
  const ru = n.subject === 'русский';
  if (tab === 'разбор') tab = 'задачи';            // старые ссылки
  if (!tab) tab = ru ? 'теория' : 'задачи';        // у русского по умолчанию чтение, у остальных задачи
  const head = `<div class="num-head"><p class="ui muted" style="margin:0 0 6px"><a href="#/${subjLet(n)}">${subjName(n)}</a> · ${ru ? 'раздел ' + n.num : 'задание ' + n.num + ' · ' + (n.part === 1 ? 'часть 1' : 'часть 2')}</p>
    <h1>№${n.num}. ${esc(n.title)}</h1><p class="lead">${n.points ? `${n.points} ${n.points === 1 ? 'балл' : n.points < 5 ? 'балла' : 'баллов'} · ` : ''}${ru ? esc(n.about || '') + ' · ~' + n.minutes + ' мин' : 'на экзамене ~' + n.minutes + ' мин'}${n.pct2026 ? ` · в 2026 решили ${Math.round(n.pct2026)} %` : ''}</p></div>`;
  if (!n.hasContent) return h(`<div class="page" data-title="№${n.num} ${esc(n.title)}">${head}<div class="card"><h3>Разбор готовится</h3><p>Этот номер ещё собирается из всех книг КАГ и банка ФИПИ. План занятий учитывает его — когда разбор появится, он откроется здесь.</p><p><a class="btn" href="#/${subjLet(n)}">К списку номеров</a></p></div></div>`);
  const b = await loadBundle(n.id), figs = await figuresOf(b), doc = parseDoc(b.html);
  const v = h(`<div class="page" data-title="№${n.num} ${esc(n.title)}"></div>`);
  const solved = (list) => list.filter((t) => App.S.tasks[t.id]?.last?.ok).length;

  if (tab === 'тип' || tab === 'проверка') {
    const ty = doc.types.find((t) => t.id === arg);
    const list = tab === 'проверка' ? b.tasks.filter((t) => t.known) : b.tasks.filter((t) => t.type === arg).sort((x, y) => x.level - y.level || x.id.localeCompare(y.id));
    if (!list.length) { v.innerHTML = `${head}<p class="empty">Задач нет. <a href="${base}">К номеру</a></p>`; return v; }
    solveScreen(v, list, { n, b, figs, doc, title: tab === 'проверка' ? 'Проверить себя' : `Тип ${arg.slice(1)}. ${ty ? ty.title : ''}`, back: base, mode: tab === 'проверка' ? 'check' : 'type' });
    return v;
  }
  const all = b.tasks.length, done = solved(b.tasks), p = all ? Math.round((done / all) * 100) : 0;
  const tabs = ru ? '' : `<nav class="tabs" aria-label="Разделы номера">${[['задачи', 'Задачи'], ['теория', 'Теория'], ['ловушки', 'Ловушки'], ['шпаргалка', 'Шпаргалка А4']].map(([k, t]) => `<a href="${base}${k === 'задачи' ? '' : '/' + k}" ${tab === k ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
  v.innerHTML = `<div class="num-hero">${head}${(!ru || all) ? `<div class="ring" style="--p:${p}" aria-label="Освоено ${p} %"><span>${p}%<small>освоено</small></span></div>` : ''}</div>
    <div class="row no-print"><button class="btn small" data-note>Заметка</button><button class="btn small" data-mark aria-pressed="${!!App.S.marks[n.id]}">${App.S.marks[n.id] ? 'В закладках' : 'В закладки'}</button>${ru ? `<span class="muted ui">${all ? `решено ${done} из ${all} · ` : ''}открывай разделы по одному — так читается легче</span>` : `<span class="muted ui">решено ${done} из ${all}</span>`}</div>
    <div class="note-box"></div>${tabs}<div class="body"></div>`;
  const body = v.querySelector('.body');
  v.querySelector('[data-mark]').onclick = async (e) => { const on = !App.S.marks[n.id]; await record('mark', { key: n.id, on, title: `${subjName(n)} №${n.num}. ${n.title}` }); e.target.textContent = on ? 'В закладках' : 'В закладки'; e.target.setAttribute('aria-pressed', on); };
  v.querySelector('[data-note]').onclick = () => {
    const nb = v.querySelector('.note-box'); if (nb.firstChild) { nb.innerHTML = ''; return; }
    const cur = App.S.notes[n.id]?.text || '';
    const f = h(`<form class="card" style="margin-top:var(--s3)"><label class="field">Заметка к номеру<textarea class="input" name="t">${esc(cur)}</textarea></label><div class="row" style="margin-top:var(--s2)"><button class="btn primary" type="submit">Сохранить</button></div></form>`);
    f.onsubmit = async (e) => { e.preventDefault(); await record('note', { key: n.id, text: f.t.value.trim(), title: `${subjName(n)} №${n.num}. ${n.title}` }); toast('Заметка сохранена'); nb.innerHTML = ''; };
    nb.appendChild(f); f.t.focus();
  };

  if (tab === 'задачи') {
    const known = b.tasks.filter((t) => t.known), prevK = App.S.numbers[b.id]?.known;
    body.innerHTML = `${known.length ? `<section class="check-card"><div><b>Проверить себя</b><p>${known.length} задач на самые трудные типы · ~10 минут.${prevK ? ` Прошлый результат: ${prevK.score} из ${prevK.total}.` : ' Всё верно — сразу к трудному уровню.'}</p></div><a class="btn primary" href="${base}/проверка">Начать</a></section>` : ''}
      <h2>Типы задач</h2><div class="types">${doc.types.map((t) => { const list = b.tasks.filter((x) => x.type === t.id), d = solved(list);
        return `<a class="type-card" href="${base}/тип/${t.id}"><div class="row1"><b><span class="n">${t.id.slice(1)}</span>${esc(t.title)}</b><span class="cnt">${d}/${list.length}</span></div>
          <div class="what">${esc(t.what)}</div><div class="bar"><i style="width:${list.length ? (d / list.length) * 100 : 0}%"></i></div></a>`; }).join('')}</div>`;
    return v;
  }
  if (tab === 'ловушки') { body.innerHTML = `<div class="doc">${doc.traps.join('') || '<p class="empty">Ловушек нет.</p>'}</div>`; return v; }
  // теория (и шпаргалка — вся теория + типы с примерами в последнем шаге)
  const fold = n.subject === 'русский'; // русский читают блоками: секции теории сворачиваются
  // пустая секция = заголовок группы (например «Уровень S» перед произведениями)
  const secs = (doc.theory || []).map((s, k) => ({ s, k, group: fold && !String(s.html || '').trim() }));
  const real = secs.filter((x) => !x.group);
  const tocHTML = real.map((x) => `<a href="#" data-go="${x.k}">${esc(x.s.title)}</a>`).join('');
  const secsHTML = secs.map((x) => x.group
    ? `<h2 class="th-group" id="th-${x.k}">${esc(x.s.title)}</h2>`
    : (fold
      ? `<details class="th-sec th-fold" id="th-${x.k}"><summary><h3>${esc(x.s.title)}</h3><span class="ru-badge" data-badge="${x.k}"></span></summary><div class="th-body">${x.s.html}` +
        `<div class="ru-read no-print" data-read-key="${esc(n.id + '|' + x.s.title)}"><button class="btn small" data-r="reading">Читаю</button><button class="btn small" data-r="done">Прочитано</button><span class="ru-read-hint muted ui"></span></div></div></details>`
      : `<section class="th-sec" id="th-${x.k}"><h3>${esc(x.s.title)}</h3>${x.s.html}</section>`)).join('');
  const art = h(`<article class="doc theory">${doc.intro.join('')}
    ${doc.formulas ? `<details class="formulas-box" ${tab === 'шпаргалка' ? 'open' : ''}><summary class="ui">Формулы номера</summary><div class="formulas">${doc.formulas}</div></details>` : ''}
    <nav class="toc no-print">${fold ? '<b class="toc-h">Содержание</b>' : ''}${fold ? tocHTML : doc.theory.map((s, k) => `<a href="#" data-go="${k}">${esc(s.title)}</a>`).join('')}</nav>
    ${fold ? `<div class="ru-readbox no-print"><div class="ru-rb-col"><b>Читаю <span data-cnt="reading">0</span></b><div class="ru-rb-list" data-list="reading"></div></div><div class="ru-rb-col"><b>Прочитано <span data-cnt="done">0</span></b><div class="ru-rb-list" data-list="done"></div></div></div>` : ''}
    ${fold ? secsHTML : doc.theory.map((s, k) => `<section class="th-sec" id="th-${k}"><h3>${esc(s.title)}</h3>${s.html}</section>`).join('')}
    ${tab === 'шпаргалка' ? doc.types.map((t) => `<section class="th-sec"><h3>Тип ${t.id.slice(1)}. ${esc(t.title)}</h3>${t.html}</section>`).join('') : ''}
    ${doc.tail.join('')}</article>`);
  body.appendChild(art);
  if (fold) { // русский читают блоками: оглавление, счётчик разделов и кнопки развернуть/свернуть
    const bar = h(`<div class="row no-print fold-bar"><span class="muted ui">Разделов: ${fold ? real.length : doc.theory.length}</span><button class="btn small" data-unfold>Развернуть все</button><button class="btn small" data-fold>Свернуть все</button></div>`);
    if (all) bar.appendChild(h(`<a class="btn primary" href="${base}/задачи">Задания: ${done} из ${all}</a>`));
    body.prepend(bar);
    bar.querySelector('[data-unfold]').onclick = () => art.querySelectorAll('details.th-fold').forEach((d) => (d.open = true));
    bar.querySelector('[data-fold]').onclick = () => art.querySelectorAll('details.th-fold').forEach((d) => (d.open = false));
    // журнал чтения: «Читаю» -> «Прочитано», списки над разделами
    const boxes = [...art.querySelectorAll('.ru-read')];
    const st = (key) => (App.S.read && App.S.read[key] ? App.S.read[key].status : null);
    const syncRead = () => {
      boxes.forEach((b) => {
        const s2 = st(b.getAttribute('data-read-key'));
        b.querySelectorAll('[data-r]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.getAttribute('data-r') === s2)));
        b.querySelector('.ru-read-hint').textContent = s2 === 'done' ? 'прочитано' : s2 === 'reading' ? 'читаю' : '';
        const sec = b.closest('details'), bd = sec && sec.querySelector('[data-badge]');
        if (bd) { bd.textContent = s2 === 'done' ? 'прочитано' : s2 === 'reading' ? 'читаю' : ''; bd.className = 'ru-badge' + (s2 ? ' on ' + s2 : ''); }
      });
      ['reading', 'done'].forEach((k) => {
        const list = art.querySelector('[data-list="' + k + '"]'), cnt = art.querySelector('[data-cnt="' + k + '"]');
        const items = boxes.filter((b) => st(b.getAttribute('data-read-key')) === k);
        if (cnt) cnt.textContent = items.length;
        if (!list) return;
        list.innerHTML = items.length ? items.map((b) => { const d = b.closest('details'), t = d.querySelector('summary h3').textContent; return `<a href="#" data-jump="${d.id}">${esc(t)}</a>`; }).join('') : '<span class="muted ui">пусто</span>';
        list.querySelectorAll('[data-jump]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const d = art.querySelector('#' + CSS.escape(a.getAttribute('data-jump'))); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }));
      });
    };
    boxes.forEach((b) => b.querySelectorAll('[data-r]').forEach((btn) => (btn.onclick = async () => {
      const key = b.getAttribute('data-read-key'), want = btn.getAttribute('data-r'), cur = st(key);
      const title = b.closest('details').querySelector('summary h3').textContent;
      await record('read', { key, status: cur === want ? null : want, title, num: n.id });
      syncRead();
    })));
    syncRead();
    const list = App.catalog.filter((x) => x.subject === 'русский').sort((x, y) => x.num - y.num);
    const i = list.findIndex((x) => x.id === n.id), prev = list[i - 1], next = list[i + 1];
    body.appendChild(h(`<div class="ru-pager no-print">` +
      (prev ? `<a class="btn" href="${numLink(prev)}">← ${esc(prev.title)}</a>` : '<span></span>') +
      (next ? `<a class="btn primary" href="${numLink(next)}">${esc(next.title)} →</a>` : '<span></span>') +
      `</div>`));
  }
  art.querySelectorAll('[data-go]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); art.querySelector('#th-' + a.dataset.go)?.scrollIntoView({ behavior: 'smooth' }); }));
  const ec = art.querySelector('.essay-check');
  if (ec) mountEssayCheck(ec);
  drawFigs(art, figs);
  for (const ex of b.examples) { const hostEx = art.querySelector(`[data-example="${CSS.escape(ex.id)}"]`); if (hostEx) stand(hostEx, ex, figs, n.id); }
  art.querySelectorAll('.mathd').forEach((m, k) => {
    const key = `${n.id}:f${k}`, on = !!App.S.formulas[key];
    const btn = h(`<button class="iconbtn add-formula no-print" aria-pressed="${on}" aria-label="${on ? 'Убрать из листа формул' : 'Добавить в мой лист формул'}" title="Мой лист формул"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${on ? 'M5 12l4 4 10-10' : 'M12 5v14M5 12h14'}"/></svg></button>`);
    btn.onclick = async () => { const now = !App.S.formulas[key]; await record('formula', { key, on: now, tex: m.querySelector('.katex')?.outerHTML || m.innerHTML, title: `${subjName(n)} №${n.num}` }); btn.setAttribute('aria-pressed', now); btn.querySelector('path').setAttribute('d', now ? 'M5 12l4 4 10-10' : 'M12 5v14M5 12h14'); toast(now ? 'Формула в листе формул' : 'Убрано из листа формул'); };
    m.appendChild(btn);
  });
  if (tab === 'шпаргалка') {
    art.querySelectorAll('.example').forEach((ex) => ex.querySelectorAll('.stepbar .chips button').forEach((b2, i, arr) => i === arr.length - 1 && b2.click()));
    body.prepend(h('<div class="row no-print" style="margin-bottom:var(--s4)"><button class="btn primary" data-print>Распечатать на А4</button><span class="muted ui">Рисунки печатаются в последнем шаге, чёрным по белому.</span></div>'));
    body.querySelector('[data-print]').onclick = () => print();
  }
  record('step', { num: n.id, part: 'разбор' });
  return v;
}

/** Повторение ошибок: задачи с наступившим сроком (1/3/7/21) по порядку, тоже с черновиком */
export async function renderReview(App_) {
  const due = dueReviews(App.S);
  const v = h(`<div class="page" data-title="Повторение"><h1>Повторение ошибок</h1><p class="lead">Задачи, в которых были ошибка или подсказка. Верно без подсказок — задача уходит на следующий интервал (3, 7, 21 день).</p><div class="slot"></div></div>`);
  const slot = v.querySelector('.slot');
  if (!due.length) { slot.innerHTML = '<p class="empty">Сегодня повторять нечего. <a href="#/">К плану на сегодня</a></p>'; return v; }
  let i = 0;
  const next = async () => {
    if (i >= due.length) { slot.innerHTML = '<div class="result ok"><b>Повторение на сегодня закончено.</b> <a href="#/">К плану</a></div>'; sound.play('level'); return; }
    const d = due[i++];
    try {
      const b = await loadBundle(d.num), figs = await figuresOf(b), task = b.tasks.find((t) => t.id === d.id); if (!task) return next();
      slot.innerHTML = ''; slot.appendChild(h(`<p class="ui muted">${i} из ${due.length}</p>`));
      const card = taskCard(task, d.num, figs, { onFinish: () => { const bt = h('<button class="btn primary" style="margin-top:var(--s3)">Следующая задача ›</button>'); bt.onclick = next; card.querySelector('.res').appendChild(bt); bt.focus(); } });
      slot.appendChild(withBoard(card, task.id));
    } catch { next(); }
  };
  next();
  return v;
}
