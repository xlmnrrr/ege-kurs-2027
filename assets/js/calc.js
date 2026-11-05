// Калькулятор физики (ТЗ п.7): окно поверх задачи, перетаскивается; два режима.
// «Как на ЕГЭ» — непрограммируемый с sin/cos/tg (то, что разрешено); «Помощник» — степени десятки, константы справочника ФИПИ 2027,
// перевод единиц, дроби, история, проверка порядка величины. Выражения считает свой разборщик (без eval).
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// Справочные данные ЕГЭ-2027 по физике (демоверсия ФИПИ 2027, «Константы»)
const CONSTS = [
  ['g', 10, 'м/с²'], ['G', 6.7e-11, 'Н·м²/кг²'], ['R', 8.31, 'Дж/(моль·К)'], ['k_B', 1.38e-23, 'Дж/К'], ['N_A', 6e23, 'моль⁻¹'], ['c', 3e8, 'м/с'],
  ['k', 9e9, 'Н·м²/Кл²'], ['ε₀', 8.85e-12, 'Ф/м'], ['e', 1.6e-19, 'Кл'], ['h', 6.6e-34, 'Дж·с'], ['mₑ', 9.1e-31, 'кг'], ['mₚ', 1.673e-27, 'кг'], ['а.е.м.', 1.66e-27, 'кг'], ['эВ', 1.6e-19, 'Дж'],
];
const UNITS = [
  ['мк→ (×10⁻⁶)', 1e-6], ['м→ (×10⁻³)', 1e-3], ['н→ (×10⁻⁹)', 1e-9], ['п→ (×10⁻¹²)', 1e-12], ['к→ (×10³)', 1e3], ['М→ (×10⁶)', 1e6], ['Г→ (×10⁹)', 1e9],
  ['км/ч → м/с', 1 / 3.6], ['м/с → км/ч', 3.6], ['см → м', 1e-2], ['см² → м²', 1e-4], ['см³ → м³', 1e-6], ['л → м³', 1e-3], ['г → кг', 1e-3], ['мин → с', 60], ['ч → с', 3600],
  ['°C → K', 'C2K'], ['K → °C', 'K2C'], ['атм → Па', 101325], ['эВ → Дж', 1.6e-19], ['Дж → эВ', 1 / 1.6e-19],
];

// ---------- разбор выражения (сортировочная станция) ----------
const FN = { sin: 1, cos: 1, tg: 1, ctg: 1, arcsin: 1, arccos: 1, arctg: 1, '√': 1, ln: 1, lg: 1 };
const PREC = { '+': 1, '-': 1, '×': 2, '÷': 2, 'neg': 3, '^': 4 };
export function evaluate(src, { deg = true, consts = {} } = {}) {
  const s = src.replace(/\s+/g, '').replace(/,/g, '.').replace(/\*/g, '×').replace(/\//g, '÷').replace(/−/g, '-').replace(/π/g, `(${Math.PI})`).replace(/²/g, '^2').replace(/³/g, '^3');
  const toks = []; let i = 0;
  const names = Object.keys(consts).sort((a, b) => b.length - a.length);
  while (i < s.length) {
    const r = s.slice(i);
    let m;
    if ((m = /^\d+(\.\d+)?(E[-+]?\d+)?/.exec(r)) || (m = /^\.\d+(E[-+]?\d+)?/.exec(r))) { toks.push({ t: 'n', v: parseFloat(m[0].replace('E', 'e')) }); i += m[0].length; continue; }
    const fn = Object.keys(FN).sort((a, b) => b.length - a.length).find((f) => r.startsWith(f));
    if (fn) { toks.push({ t: 'f', v: fn }); i += fn.length; continue; }
    const cn = names.find((c) => r.startsWith(c));
    if (cn) { toks.push({ t: 'n', v: consts[cn] }); i += cn.length; continue; }
    if ('+-×÷^()'.includes(r[0])) { toks.push({ t: r[0] === '(' || r[0] === ')' ? r[0] : 'o', v: r[0] }); i++; continue; }
    throw new Error(`непонятный символ «${r[0]}»`);
  }
  // неявное умножение: 2(3), 2π, )(, 3sin
  const T = [];
  toks.forEach((k, j) => { const p = T[T.length - 1]; if (p && (p.t === 'n' || p.t === ')') && (k.t === 'n' || k.t === '(' || k.t === 'f')) T.push({ t: 'o', v: '×' }); T.push(k); });
  const out = [], st = [];
  T.forEach((k, j) => {
    const p = T[j - 1];
    if (k.t === 'n') out.push(k);
    else if (k.t === 'f') st.push(k);
    else if (k.t === 'o') {
      let op = k.v;
      if (op === '-' && (!p || p.t === 'o' || p.t === '(' || p.t === 'f')) op = 'neg';
      else if (op === '+' && (!p || p.t === 'o' || p.t === '(')) return;
      while (st.length) { const top = st[st.length - 1]; if (top.t === 'f' || (top.t === 'o' && (PREC[top.v] > PREC[op] || (PREC[top.v] === PREC[op] && op !== '^' && op !== 'neg')))) out.push(st.pop()); else break; }
      st.push({ t: 'o', v: op });
    } else if (k.t === '(') st.push(k);
    else { while (st.length && st[st.length - 1].t !== '(') out.push(st.pop()); if (!st.length) throw new Error('лишняя скобка'); st.pop(); if (st.length && st[st.length - 1].t === 'f') out.push(st.pop()); }
  });
  while (st.length) { const k = st.pop(); if (k.t === '(') throw new Error('не закрыта скобка'); out.push(k); }
  const a = deg ? Math.PI / 180 : 1, v = [];
  for (const k of out) {
    if (k.t === 'n') { v.push(k.v); continue; }
    if (k.t === 'f') { const x = v.pop(); if (x === undefined) throw new Error('нет числа для функции');
      v.push({ sin: Math.sin(x * a), cos: Math.cos(x * a), tg: Math.tan(x * a), ctg: 1 / Math.tan(x * a), arcsin: Math.asin(x) / a, arccos: Math.acos(x) / a, arctg: Math.atan(x) / a, '√': Math.sqrt(x), ln: Math.log(x), lg: Math.log10(x) }[k.v]); continue; }
    if (k.v === 'neg') { v.push(-v.pop()); continue; }
    const y = v.pop(), x = v.pop(); if (x === undefined || y === undefined) throw new Error('не хватает числа');
    v.push({ '+': x + y, '-': x - y, '×': x * y, '÷': x / y, '^': x ** y }[k.v]);
  }
  if (v.length !== 1) throw new Error('выражение не закончено');
  // убрать «шум» плавающей точки: sin 30° = 0,5 ровно
  return Math.abs(v[0]) < 1e-300 ? 0 : +v[0].toPrecision(12);
}
export function fmt(x, sci = false) {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'ошибка' : '∞';
  const ax = Math.abs(x);
  if (sci || (ax !== 0 && (ax < 1e-3 || ax >= 1e7))) { const [m, e] = x.toExponential(4).split('e'); return `${(+m).toString().replace('.', ',')}·10${String(+e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`; }
  return String(+x.toPrecision(10)).replace('.', ',');
}
function fraction(x) { // простая дробь, если знаменатель ≤ 1000
  if (!Number.isFinite(x) || Number.isInteger(x)) return null;
  for (let d = 2; d <= 1000; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return `${n}/${d}`; }
  return null;
}

let el = null;
export function openCalc() {
  if (el) { el.remove(); el = null; return; }
  let mode = 'ege', deg = true, expr = '', hist = [];
  const consts = Object.fromEntries(CONSTS.map(([n, v]) => [n, v]));
  el = h(`<section class="calc" role="dialog" aria-label="Калькулятор">
    <div class="calc-h"><b>Калькулятор</b><button class="btn small" data-drg aria-label="Градусы или радианы">DEG</button><button class="iconbtn" data-close aria-label="Закрыть калькулятор"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="calc-modes" role="group" aria-label="Режим"><button data-mode="ege" aria-pressed="true">Как на ЕГЭ</button><button data-mode="help" aria-pressed="false">Помощник</button></div>
    <div class="calc-screen"><div class="expr" aria-live="polite"></div><div class="res">0</div><div class="note"></div></div>
    <div class="keys"></div><div class="calc-extra" hidden></div></section>`);
  document.getElementById('calc-host').appendChild(el);
  const ex = el.querySelector('.expr'), res = el.querySelector('.res'), note = el.querySelector('.note'), keys = el.querySelector('.keys'), extra = el.querySelector('.calc-extra');
  const KEYS = [['sin', 'fn'], ['cos', 'fn'], ['tg', 'fn'], ['√', 'fn'], ['x²', 'fn'], ['7'], ['8'], ['9'], ['÷', 'op'], ['C', 'fn'], ['4'], ['5'], ['6'], ['×', 'op'], ['⌫', 'fn'], ['1'], ['2'], ['3'], ['−', 'op'], ['(', 'op'], ['0'], [','], ['EXP', 'fn'], ['+', 'op'], [')', 'op'], ['xʸ', 'fn'], ['π', 'fn'], ['±', 'fn'], ['Ans', 'fn'], ['=', 'eq']];
  keys.innerHTML = KEYS.map(([k, c]) => `<button class="${c || ''}" data-k="${esc(k)}" aria-label="${esc(k)}">${esc(k === 'EXP' && mode === 'help' ? '×10ⁿ' : k)}</button>`).join('');
  let ans = 0;
  const show = () => { ex.textContent = expr.replace(/E/g, '·10^'); try { if (expr) { const v = evaluate(expr, { deg, consts }); res.textContent = fmt(v); check(v); } } catch { /* пока недописано */ } };
  const check = (v) => {
    if (mode !== 'help') { note.textContent = ''; return; }
    const f = fraction(v), ax = Math.abs(v);
    note.textContent = !Number.isFinite(v) ? 'Деление на ноль или вне области функции' : ax > 1e30 || (ax < 1e-40 && ax !== 0) ? 'Порядок величины подозрительный — проверь степени 10 и единицы' : f ? `дробью: ${f}` : `порядок величины: 10${fmt(10 ** Math.floor(Math.log10(ax || 1)), true).split('·10')[1] || '⁰'}`;
  };
  const press = (k) => {
    if (k === 'C') { expr = ''; res.textContent = '0'; note.textContent = ''; }
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') { try { const v = evaluate(expr, { deg, consts }); ans = v; hist.unshift(`${expr.replace(/E/g, '·10^')} = ${fmt(v)}`); hist = hist.slice(0, 10); res.textContent = fmt(v); check(v); renderHist(); expr = String(v).replace('e', 'E').replace('.', ','); } catch (e) { note.textContent = e.message; } show(); return; }
    else if (k === 'x²') expr += '^2'; else if (k === 'xʸ') expr += '^'; else if (k === 'EXP') expr += 'E';
    else if (k === '±') expr = expr.startsWith('-(') && expr.endsWith(')') ? expr.slice(2, -1) : `-(${expr || '0'})`;
    else if (k === 'Ans') expr += `(${String(ans).replace('e', 'E')})`;
    else if (['sin', 'cos', 'tg', '√'].includes(k)) expr += k + '(';
    else expr += k === '−' ? '-' : k;
    show();
  };
  keys.onclick = (e) => { const b = e.target.closest('button'); if (b) press(b.dataset.k); };
  el.addEventListener('keydown', (e) => { const m = { Enter: '=', Backspace: '⌫', Escape: 'C', '*': '×', '/': '÷', '.': ',' }; const k = m[e.key] || ('0123456789+-()^,'.includes(e.key) ? (e.key === '-' ? '−' : e.key) : null); if (k) { e.preventDefault(); press(k); } });
  el.tabIndex = -1; el.focus();
  const renderHist = () => { const hd = el.querySelector('.calc-hist'); if (hd) hd.innerHTML = hist.map((x) => `<div>${esc(x)}</div>`).join('') || 'История пуста'; };
  const setMode = (m) => {
    mode = m; el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === m));
    el.querySelector('[data-k="EXP"]').textContent = m === 'help' ? '×10ⁿ' : 'EXP';
    extra.hidden = m !== 'help';
    extra.innerHTML = m === 'help' ? `<div class="consts" aria-label="Константы справочника ЕГЭ">${CONSTS.map(([n, v, u]) => `<button data-c="${esc(n)}" title="${esc(fmt(v))} ${esc(u)}">${esc(n)}</button>`).join('')}</div>
      <label class="field">Перевести результат<select data-unit><option value="">— единицы —</option>${UNITS.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('')}</select></label><div class="calc-hist"></div>` : '';
    extra.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { expr += b.dataset.c; show(); }));
    extra.querySelector('[data-unit]')?.addEventListener('change', (e) => {
      const u = UNITS[+e.target.value]; e.target.value = ''; if (!u) return;
      try { const v = evaluate(expr || String(ans), { deg, consts }); const r = u[1] === 'C2K' ? v + 273 : u[1] === 'K2C' ? v - 273 : v * u[1]; hist.unshift(`${fmt(v)} ${u[0]} = ${fmt(r)}`); ans = r; expr = String(r).replace('e', 'E').replace('.', ','); res.textContent = fmt(r); renderHist(); show(); } catch (x) { note.textContent = x.message; }
    });
    renderHist(); show();
  };
  el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  el.querySelector('[data-drg]').onclick = (e) => { deg = !deg; e.target.textContent = deg ? 'DEG' : 'RAD'; show(); };
  el.querySelector('[data-close]').onclick = () => { el.remove(); el = null; };
  // перетаскивание за шапку (на ПК)
  const head = el.querySelector('.calc-h'); let d = null;
  head.addEventListener('pointerdown', (e) => { if (e.target.closest('button') || innerWidth <= 640) return; const r = el.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', (e) => { if (!d) return; el.style.left = Math.max(0, Math.min(innerWidth - el.offsetWidth, e.clientX - d.x)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - d.y)) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; });
  head.addEventListener('pointerup', () => (d = null));
}
