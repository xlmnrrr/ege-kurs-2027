// Страница номера: разбор (теория, типы с пошаговыми рисунками, ловушки), «уже знаю», тренажёр, шпаргалка, повторение ошибок.
import { App, esc, h, loadBundle, record, toast, numLink, statusOf } from './app.js';
import { Chertezh, mid, lerp, V } from './chertezh.js';
import { dueReviews } from './progress.js';
import { sound, speak, stopSpeak } from './extras.js';

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
  return g === a;
}

/** Карточка задачи тренажёра. Поток (ТЗ п.5.6): ошибка -> подсказка 1 -> ошибка -> подсказка 2 -> ошибка -> решение. */
async function taskCard(task, numId, figs, onDone) {
  const n = App.catalog.find((x) => x.id === numId);
  const srcTxt = task.src ? `${esc(task.src.вид || '')}${task.src.где ? ': ' + esc(task.src.где) : ''}` : '';
  const el = h(`<article class="task" aria-label="Задача ${esc(task.id)}">
    <div class="task-meta"><span>${n ? `${n.subject === 'математика' ? 'Математика' : 'Физика'} №${n.num}` : ''}</span><span>тип ${esc(task.type.replace(/^t/, ''))}</span><span>уровень ${task.level}</span>
      <button class="btn quiet small" data-say>Прочитать вслух</button></div>
    <div class="q">${task.q}</div>
    ${task.fig && figs[task.fig] ? '<figure class="fig"><svg role="img" aria-label="Рисунок к задаче"></svg></figure>' : ''}
    <form class="answer" autocomplete="off"><label class="sr" for="a-${esc(task.id)}">Ответ</label><input class="input" id="a-${esc(task.id)}" inputmode="decimal" placeholder="Ответ как в бланке"><button class="btn primary" type="submit">Проверить</button></form>
    <div class="row" style="margin-top:var(--s2)"><button class="btn quiet small" data-h="1">Подсказка 1</button><button class="btn quiet small" data-h="2">Подсказка 2</button><button class="btn quiet small" data-h="3">Показать решение</button></div>
    <div class="hints"></div><div class="res" aria-live="polite"></div>
    ${srcTxt ? `<p class="src">Источник: ${srcTxt}</p>` : ''}</article>`);
  if (task.fig && figs[task.fig]) { const ch = makeFigure(figs[task.fig], el.querySelector('figure svg')); ch.setStep(0, true); }
  let tries = 0, hints = 0, done = false;
  const box = el.querySelector('.hints'), res = el.querySelector('.res'), input = el.querySelector('input');
  const show = (k) => {
    if (k === 1 && hints < 1) { box.appendChild(h(`<div class="hint"><b>Подсказка 1.</b> ${task.h1.replace(/^<p>|<\/p>$/g, '')}</div>`)); hints = 1; }
    else if (k === 2 && hints < 2) { if (hints < 1) show(1); box.appendChild(h(`<div class="hint"><b>Подсказка 2.</b> ${task.h2.replace(/^<p>|<\/p>$/g, '')}</div>`)); hints = 2; }
    else if (k === 3 && !done) { if (hints < 2) show(2); box.appendChild(h(`<div class="key"><b class="ui">Решение.</b> ${task.sol}<p class="ui"><b>Ответ: ${esc(task.a)}</b></p></div>`)); finish(false); }
  };
  el.querySelectorAll('[data-h]').forEach((b) => (b.onclick = () => show(+b.dataset.h)));
  el.querySelector('[data-say]').onclick = () => speak(task.say);
  async function finish(ok) {
    if (done) return; done = true;
    el.querySelectorAll('[data-h]').forEach((b) => (b.disabled = true)); input.disabled = true; el.querySelector('form button').disabled = true;
    await record('answer', { task: task.id, num: numId, ok, hints, tries, given: input.value });
    const next = h(`<button class="btn primary" style="margin-top:var(--s3)">Следующая задача</button>`); next.onclick = onDone; res.appendChild(next); next.focus();
  }
  el.querySelector('form').onsubmit = (e) => {
    e.preventDefault(); if (done) return;
    const r = checkAnswer(input.value, task);
    if (r === null) { res.innerHTML = '<div class="result bad"><b>Введи ответ.</b> Число как в бланке: запятая, минус, без единиц.</div>'; return; }
    if (r) { res.innerHTML = `<div class="result ok"><b>Верно.</b> ${tries || hints ? 'С подсказкой — задача вернётся на повторение завтра.' : 'Чисто, без подсказок.'}</div>`; sound.play('ok'); finish(true); return; }
    tries++; sound.play('bad');
    res.innerHTML = `<div class="result bad"><b>Пока неверно.</b> ${tries === 1 ? 'Вот подсказка — попробуй ещё раз.' : tries === 2 ? 'Вторая подсказка — уже почти решение.' : 'Смотри полное решение — задача вернётся на повторение.'}</div>`;
    show(Math.min(3, tries));
    if (!done) input.select();
  };
  return el;
}

/** Тест «Уже знаю?» */
function knownTest(slot, b, figs) {
  const tasks = b.tasks.filter((t) => t.known);
  if (!tasks.length) { slot.remove(); return; }
  const prev = App.S.numbers[b.id]?.known;
  const el = h(`<section class="card known" aria-labelledby="kn-${b.id}"><h3 id="kn-${b.id}">Уже знаешь этот номер?</h3>
    <p class="ui muted">${tasks.length} ${tasks.length === 1 ? 'задача' : 'задачи'} на самые трудные типы. Всё верно — сразу к тренажёру трудного уровня, иначе — с теории.${prev ? ` Прошлый результат: ${prev.score} из ${prev.total}.` : ''}</p>
    <form class="kn">${tasks.map((t, i) => `<div style="margin:var(--s3) 0"><div>${i + 1}. ${t.q}</div><input class="input" style="margin-top:6px" inputmode="decimal" aria-label="Ответ к задаче ${i + 1}" data-id="${esc(t.id)}"></div>`).join('')}
    <button class="btn primary" type="submit">Проверить себя</button></form><div class="kn-res" aria-live="polite"></div></section>`);
  slot.replaceWith(el);
  el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    let score = 0; tasks.forEach((t) => { const inp = el.querySelector(`[data-id="${CSS.escape(t.id)}"]`); if (checkAnswer(inp.value, t)) score++; });
    await record('known', { num: b.id, score, total: tasks.length });
    el.querySelector('.kn-res').innerHTML = score === tasks.length
      ? `<div class="result ok"><b>${score} из ${tasks.length} — отлично.</b> Можно сразу в <a href="${location.hash.split('/').slice(0, 3).join('/')}/тренажёр">тренажёр</a>; теорию оставь для повторения.</div>`
      : `<div class="result bad"><b>${score} из ${tasks.length}.</b> Начни с теории ниже — потом типы и тренажёр.</div>`;
    sound.play(score === tasks.length ? 'level' : 'bad');
  };
}

export async function renderNumber(App_, n, tab) {
  const base = numLink(n);
  const head = `<div class="num-head"><p class="ui muted" style="margin:0 0 6px"><a href="#/${n.subject === 'математика' ? 'м' : 'ф'}">${n.subject === 'математика' ? 'Математика' : 'Физика'}</a> · задание ${n.num} · ${n.part === 1 ? 'часть 1' : 'часть 2'}</p>
    <h1>№${n.num}. ${esc(n.title)}</h1><p class="lead">${esc(n.about || '')} · ${n.points} ${n.points === 1 ? 'балл' : n.points < 5 ? 'балла' : 'баллов'} · на экзамене ~${n.minutes} мин${n.pct2026 ? ` · в 2026 решили ${Math.round(n.pct2026)} %` : ''}</p></div>`;
  if (!n.hasContent) return h(`<div class="page" data-title="№${n.num} ${esc(n.title)}">${head}<div class="card"><h3>Разбор готовится</h3><p>Этот номер ещё собирается из всех книг КАГ и банка ФИПИ. План занятий учитывает его — когда разбор появится, он откроется здесь.</p><p><a class="btn" href="#/${n.subject === 'математика' ? 'м' : 'ф'}">К списку номеров</a></p></div></div>`);
  const b = await loadBundle(n.id), figs = await figuresOf(b);
  const tabs = `<nav class="tabs" aria-label="Разделы номера">${[['разбор', 'Разбор'], ['тренажёр', `Тренажёр · ${b.tasks.length}`], ['шпаргалка', 'Шпаргалка А4']].map(([k, t]) => `<a href="${base}/${k}" ${tab === k ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
  const v = h(`<div class="page" data-title="№${n.num} ${esc(n.title)}">${head}
    <div class="row no-print"><button class="btn small" data-read>Прочитать вслух</button><button class="btn small" data-note>Заметка</button><button class="btn small" data-mark aria-pressed="${!!App.S.marks[n.id]}">${App.S.marks[n.id] ? 'В закладках' : 'В закладки'}</button></div>
    <div class="note-box"></div>${tabs}<div class="body"></div></div>`);
  const body = v.querySelector('.body');
  v.querySelector('[data-read]').onclick = (e) => { if (e.target.dataset.on) { stopSpeak(); e.target.textContent = 'Прочитать вслух'; delete e.target.dataset.on; } else { speak(b.say, () => { e.target.textContent = 'Прочитать вслух'; delete e.target.dataset.on; }); e.target.textContent = 'Остановить чтение'; e.target.dataset.on = 1; } };
  v.querySelector('[data-mark]').onclick = async (e) => { const on = !App.S.marks[n.id]; await record('mark', { key: n.id, on, title: `${n.subject === 'математика' ? 'Математика' : 'Физика'} №${n.num}. ${n.title}` }); e.target.textContent = on ? 'В закладках' : 'В закладки'; e.target.setAttribute('aria-pressed', on); };
  v.querySelector('[data-note]').onclick = () => {
    const nb = v.querySelector('.note-box'); if (nb.firstChild) { nb.innerHTML = ''; return; }
    const cur = App.S.notes[n.id]?.text || '';
    const f = h(`<form class="card" style="margin-top:var(--s3)"><label class="field">Заметка к номеру<textarea class="input" name="t">${esc(cur)}</textarea></label><div class="row" style="margin-top:var(--s2)"><button class="btn primary" type="submit">Сохранить</button></div></form>`);
    f.onsubmit = async (e) => { e.preventDefault(); await record('note', { key: n.id, text: f.t.value.trim(), title: `${n.subject === 'математика' ? 'Математика' : 'Физика'} №${n.num}. ${n.title}` }); toast('Заметка сохранена'); nb.innerHTML = ''; };
    nb.appendChild(f); f.t.focus();
  };

  if (tab === 'тренажёр') {
    const types = [...new Set(b.tasks.map((t) => t.type))];
    let type = types[0], i = 0;
    const bar = h(`<div class="typebar" role="group" aria-label="Тип задач">${types.map((t) => `<button aria-pressed="${t === type}" data-t="${esc(t)}">Тип ${esc(t.replace(/^t/, ''))} · ${b.tasks.filter((x) => x.type === t).length}</button>`).join('')}</div>`);
    const slot = h('<div></div>');
    body.append(bar, slot);
    const order = (t) => b.tasks.filter((x) => x.type === t).sort((x, y) => (App.S.tasks[x.id]?.last?.ok ? 1 : 0) - (App.S.tasks[y.id]?.last?.ok ? 1 : 0) || x.level - y.level);
    const showTask = async () => { const list = order(type); const task = list[i % list.length]; slot.innerHTML = ''; slot.appendChild(await taskCard(task, n.id, figs, () => { i++; showTask(); })); };
    bar.querySelectorAll('button').forEach((bt) => (bt.onclick = () => { type = bt.dataset.t; i = 0; bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === bt)); showTask(); }));
    showTask();
    return v;
  }
  const doc = h(`<article class="doc">${b.html}</article>`);
  body.appendChild(doc);
  doc.querySelectorAll('figure.fig[data-fig]').forEach((f) => {
    const name = f.dataset.fig.replace(/-([\p{L}\d])/gu, (_, c) => c.toUpperCase()), fn = figs[name];
    if (!fn) { f.remove(); return; }
    f.innerHTML = '<svg role="img" aria-label="Рисунок"></svg>'; const ch = makeFigure(fn, f.firstChild); ch.setStep(ch.steps - 1, true);
  });
  for (const ex of b.examples) { const host = doc.querySelector(`[data-example="${CSS.escape(ex.id)}"]`); if (host) stand(host, ex, figs, n.id); }
  const slot = doc.querySelector('.known-slot'); if (slot) knownTest(slot, b, figs);
  doc.querySelectorAll('.mathd').forEach((m, k) => {
    const key = `${n.id}:f${k}`, on = !!App.S.formulas[key];
    const btn = h(`<button class="iconbtn add-formula no-print" aria-pressed="${on}" aria-label="${on ? 'Убрать из листа формул' : 'Добавить в мой лист формул'}" title="Мой лист формул"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${on ? 'M5 12l4 4 10-10' : 'M12 5v14M5 12h14'}"/></svg></button>`);
    btn.onclick = async () => { const now = !App.S.formulas[key]; await record('formula', { key, on: now, tex: m.querySelector('.katex')?.outerHTML || m.innerHTML, title: `${n.subject === 'математика' ? 'Математика' : 'Физика'} №${n.num}` }); btn.setAttribute('aria-pressed', now); btn.querySelector('path').setAttribute('d', now ? 'M5 12l4 4 10-10' : 'M12 5v14M5 12h14'); toast(now ? 'Формула в листе формул' : 'Убрано из листа формул'); };
    m.appendChild(btn);
  });
  if (tab === 'шпаргалка') {
    doc.querySelectorAll('.example').forEach((ex) => ex.querySelectorAll('.stepbar .chips button').forEach((b2, i, arr) => i === arr.length - 1 && b2.click()));
    body.prepend(h('<div class="row no-print" style="margin-bottom:var(--s4)"><button class="btn primary" data-print>Распечатать на А4</button><span class="muted ui">Рисунки печатаются в последнем шаге, чёрным по белому.</span></div>'));
    body.querySelector('[data-print]').onclick = () => print();
  }
  record('step', { num: n.id, part: 'разбор' });
  return v;
}

/** Повторение ошибок: задачи с наступившим сроком (1/3/7/21) по порядку */
export async function renderReview(App_) {
  const due = dueReviews(App.S);
  const v = h(`<div class="page" data-title="Повторение"><h1>Повторение ошибок</h1><p class="lead">Задачи, в которых были ошибка или подсказка. Верно без подсказок — задача уходит на следующий интервал (3, 7, 21 день).</p><div class="slot"></div></div>`);
  const slot = v.querySelector('.slot');
  if (!due.length) { slot.innerHTML = '<p class="empty">Сегодня повторять нечего. <a href="#/">К плану на сегодня</a></p>'; return v; }
  let i = 0;
  const next = async () => {
    if (i >= due.length) { slot.innerHTML = '<div class="result ok"><b>Повторение на сегодня закончено.</b> <a href="#/">К плану</a></div>'; sound.play('level'); return; }
    const d = due[i++];
    try { const b = await loadBundle(d.num), figs = await figuresOf(b), task = b.tasks.find((t) => t.id === d.id); if (!task) return next();
      slot.innerHTML = ''; slot.appendChild(h(`<p class="ui muted">${i} из ${due.length}</p>`)); slot.appendChild(await taskCard(task, d.num, figs, next)); } catch { next(); }
  };
  next();
  return v;
}
