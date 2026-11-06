// Доска-черновик для любой задачи (математика, физика, диагностика). Самодостаточный модуль: стили внутри.
// Инструменты: кисть, прямая (клик — тяни — клик), окружность (центр — радиус), дуга (начало — конец — изгиб), текст,
// ластик (стирает и перенесённый рисунок), рука (двигать рисунок и надписи, растягивать рисунок за угол).
// Привязка к клеткам (⌗): концы прямых, центры окружностей, дуги, рисунок и надписи встают в узлы сетки 20 px.
// «⇩ Рисунок» переносит рисунок задачи: картинка без фона, тёмные линии, все буквы, сразу по клеткам.
// Назад/вперёд (Ctrl+Z / Ctrl+Y), очистить (тоже отменяется), фон «тетрадь»/«лист», во весь экран.
// Черновик каждой задачи сохраняется в браузере (ключ key) и возвращается при следующем открытии.
// mountBoard(host, { key, getFigure: () => SVGElement|null })

const CELL = 20;
const COLORS = ['#1C222E', '#C0392B', '#2364AA', '#1E8449', '#B9770E', '#8E44AD'];
const TOOLS = [['pen', '✎', 'Кисть', 'B'], ['line', '╱', 'Прямая: клик — тяни — клик', 'L'], ['circle', '◯', 'Окружность: центр — радиус', 'O'],
  ['arc', '◠', 'Дуга: начало — конец — изгиб', 'A'], ['text', 'T', 'Текст', 'T'], ['erase', '⌫', 'Ластик', 'E'], ['hand', '✥', 'Двигать и растягивать', 'H']];
const CSS = `
.bd{display:flex;flex-direction:column;gap:8px;outline:none}
.bd-bar{display:flex;flex-wrap:wrap;gap:6px 10px}.bd-grp{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.bd-bar button{min-width:36px;height:36px;border-radius:8px;border:1px solid var(--line,#3B4558);background:var(--surface2,#2C3546);color:var(--text,#ECE4D8);font:15px/1 var(--font-ui,system-ui);cursor:pointer;padding:0 8px}
.bd-bar button:hover{border-color:var(--line-strong,#66708A)}
.bd-bar button[aria-pressed="true"]{border-color:var(--primary,#E9B062);background:color-mix(in srgb,var(--primary,#E9B062) 24%,var(--surface2,#2C3546))}
.bd-bar .bd-col{min-width:26px;width:26px;padding:0;background:var(--c)}.bd-bar .bd-col[aria-pressed="true"]{outline:2px solid var(--primary,#E9B062);outline-offset:1px}
.bd-stage{position:relative;height:var(--bd-h,520px);border-radius:10px;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.bd-stage canvas{position:absolute;inset:0;width:100%;height:100%}
.bd-text{position:absolute;background:rgba(255,255,255,.75);border:1px dashed #2364AA;font:20px Literata,Georgia,serif;padding:0 3px;min-width:110px;outline:none;color:#1C222E;z-index:2}
.bd-flash{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:#1C222E;color:#fff;padding:6px 12px;border-radius:8px;font:13px var(--font-ui,system-ui);z-index:3}
.bd-hint{font:12px var(--font-ui,system-ui);color:var(--muted,#ABA497);min-height:16px}
.bd.full{position:fixed;inset:0;z-index:200;background:var(--bg,#1C222E);padding:10px}.bd.full .bd-stage{flex:1;height:auto}
@media (max-width:760px){.bd-bar button{min-width:34px;height:34px}.bd-stage{height:var(--bd-h-m,440px)}}`;

function injectCSS() { if (!document.getElementById('bd-css')) { const s = document.createElement('style'); s.id = 'bd-css'; s.textContent = CSS; document.head.appendChild(s); } }
const LS = 'доска:';
const load = (key) => { try { return JSON.parse(localStorage.getItem(LS + key)); } catch { return null; } };
const MEM = new Map();

export function mountBoard(host, opt = {}) {
  injectCSS();
  const key = opt.key || 'общая';
  let st = MEM.get(key);
  if (!st) {
    const s = load(key) || {};
    st = { objs: s.objs || [], redo: [], bg: s.bg || 'grid', snap: s.snap ?? true };
    for (const o of st.objs) if (o.t === 'img') { o.img = new Image(); o.img.onload = () => redraw(); o.img.src = o.src; }
    MEM.set(key, st);
  }
  host.innerHTML = `<div class="bd" tabindex="0">
  <div class="bd-bar" role="toolbar" aria-label="Инструменты черновика">
    <div class="bd-grp">${TOOLS.map(([t, ic, nm, hk]) => `<button data-tool="${t}" title="${nm} (${hk})" aria-label="${nm}">${t === 'text' ? '<b>T</b>' : ic}</button>`).join('')}</div>
    <div class="bd-grp">${COLORS.map((c, i) => `<button class="bd-col" data-col="${c}" style="--c:${c}" title="Цвет ${i + 1}" aria-label="Цвет ${i + 1}"></button>`).join('')}
      <button data-w="2" title="Тонко" aria-label="Тонкая линия">─</button><button data-w="4" title="Толще" aria-label="Толстая линия"><b>━</b></button></div>
    <div class="bd-grp"><button data-act="undo" title="Назад (Ctrl+Z)" aria-label="Отменить">↶</button><button data-act="redo" title="Вперёд (Ctrl+Y)" aria-label="Вернуть">↷</button>
      <button data-act="clear" title="Очистить (можно отменить)" aria-label="Очистить">🗑</button></div>
    <div class="bd-grp"><button data-act="fig" title="Перенести рисунок задачи на черновик">⇩ Рисунок</button>
      <button data-act="snap" title="Привязка к клеткам">⌗ Клетки</button>
      <button data-act="bg" title="Тетрадь в клетку или чистый лист"></button>
      <button data-act="full" title="Во весь экран" aria-label="Во весь экран">⤢</button></div>
  </div>
  <div class="bd-stage"><canvas></canvas><canvas></canvas><canvas></canvas></div>
  <div class="bd-hint"></div></div>`;
  const root = host.querySelector('.bd'), stage = root.querySelector('.bd-stage'), hint = root.querySelector('.bd-hint');
  const [cbg, cink, cui] = stage.querySelectorAll('canvas');
  const g = cbg.getContext('2d'), k = cink.getContext('2d'), u = cui.getContext('2d');
  let tool = 'pen', color = COLORS[0], width = 2, W = 0, H = 0;
  let draft = null, drag = null, hover = null;

  // ---------- сохранение ----------
  const ser = (o) => (o.t === 'img' ? { ...o, img: undefined, src: o.src } : o.t === 'tf' ? null : o.t === 'clear' ? null : o);
  function save() {
    const objs = flat().map(ser).filter(Boolean);
    try { localStorage.setItem(LS + key, JSON.stringify({ bg: st.bg, snap: st.snap, objs })); } catch { /* приватный режим — только в памяти */ }
  }
  function flat() { return st.objs.filter((o) => o.t !== 'tf' && o.t !== 'clear'); }

  // ---------- размеры и бумага ----------
  function size() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    for (const c of [cbg, cink, cui]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
    paper(); redraw();
  }
  function paper() {
    g.fillStyle = '#FDFCF8'; g.fillRect(0, 0, W, H);
    if (st.bg === 'grid') {
      g.strokeStyle = '#CBD8EA'; g.lineWidth = 1;
      for (let x = 0.5; x < W; x += CELL) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0.5; y < H; y += CELL) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = '#E8A0A0'; g.beginPath(); g.moveTo(W - 2 * CELL + 0.5, 0); g.lineTo(W - 2 * CELL + 0.5, H); g.stroke();
    }
    root.querySelector('[data-act=bg]').textContent = st.bg === 'grid' ? 'Тетрадь' : 'Лист';
    root.querySelector('[data-act=snap]').setAttribute('aria-pressed', st.snap);
  }
  const sn = (p) => (st.snap ? { x: Math.round(p.x / CELL) * CELL, y: Math.round(p.y / CELL) * CELL } : p);

  // ---------- рисование ----------
  function circle3(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-6) return null;
    const s = (p) => p.x * p.x + p.y * p.y;
    const x = (s(a) * (b.y - c.y) + s(b) * (c.y - a.y) + s(c) * (a.y - b.y)) / d, y = (s(a) * (c.x - b.x) + s(b) * (a.x - c.x) + s(c) * (b.x - a.x)) / d;
    return { x, y, r: Math.hypot(a.x - x, a.y - y) };
  }
  function draw(ctx, o) {
    ctx.save();
    ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = o.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.t === 'path') {
      if (o.erase) { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; }
      const P = o.pts; ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
      if (P.length < 3) ctx.lineTo(P[P.length - 1].x + 0.1, P[P.length - 1].y);
      for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2);   // сглаживание
      ctx.stroke();
    } else if (o.t === 'line') { ctx.beginPath(); ctx.moveTo(o.a.x, o.a.y); ctx.lineTo(o.b.x, o.b.y); ctx.stroke(); }
    else if (o.t === 'circle') { ctx.beginPath(); ctx.arc(o.c.x, o.c.y, Math.hypot(o.e.x - o.c.x, o.e.y - o.c.y), 0, 2 * Math.PI); ctx.stroke(); }
    else if (o.t === 'arc') {
      const c = o.c && circle3(o.a, o.c, o.b); ctx.beginPath();
      if (!c) { ctx.moveTo(o.a.x, o.a.y); ctx.lineTo(o.b.x, o.b.y); }
      else { const an = (p) => Math.atan2(p.y - c.y, p.x - c.x), nm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        ctx.arc(c.x, c.y, c.r, an(o.a), an(o.b), nm(an(o.c) - an(o.a)) > nm(an(o.b) - an(o.a))); }
      ctx.stroke();
    } else if (o.t === 'text') { ctx.font = `${o.size}px Literata, Georgia, serif`; ctx.textBaseline = 'top'; ctx.fillText(o.s, o.p.x, o.p.y); }
    else if (o.t === 'img' && o.img?.complete) ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    ctx.restore();
  }
  function redraw() {
    k.clearRect(0, 0, W, H); for (const o of st.objs) if (o.t !== 'tf' && o.t !== 'clear') draw(k, o);
    u.clearRect(0, 0, W, H);
    if (draft) draw(u, draft);
    if (hover && tool !== 'pen' && tool !== 'erase' && tool !== 'hand') { u.fillStyle = '#2364AA'; u.beginPath(); u.arc(hover.x, hover.y, 3, 0, 7); u.fill(); }   // куда встанет точка
    if (tool === 'hand') for (const o of st.objs) if (o.t === 'img') {
      u.save(); u.setLineDash([5, 4]); u.strokeStyle = '#2364AA'; u.strokeRect(o.x, o.y, o.w, o.h);
      u.setLineDash([]); u.fillStyle = '#2364AA'; u.fillRect(o.x + o.w - 8, o.y + o.h - 8, 16, 16); u.restore();
    }
  }
  const commit = (o) => { st.objs.push(o); st.redo.length = 0; redraw(); save(); };
  const HINTS = { pen: 'Рисуй мышью или пальцем.', line: 'Клик — начало, второй клик — конец прямой.', circle: 'Клик — центр, второй клик — точка окружности.',
    arc: 'Клик — начало дуги, клик — конец, третий клик — изгиб.', text: 'Клик — где писать; Enter — готово.', erase: 'Стирает всё: линии, надписи, рисунок.', hand: 'Тяни рисунок или надпись; синий квадрат в углу — растянуть.' };

  // ---------- ввод ----------
  const pos = (e) => { const r = cui.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hitText = (p) => flat().reverse().find((o) => o.t === 'text' && p.x >= o.p.x - 4 && p.x <= o.p.x + o.s.length * o.size * 0.55 && p.y >= o.p.y - 4 && p.y <= o.p.y + o.size + 4);
  cui.addEventListener('pointerdown', (e) => {
    const raw = pos(e), p = sn(raw); cui.setPointerCapture(e.pointerId); root.focus({ preventScroll: true });
    if (tool === 'pen' || tool === 'erase') { draft = { t: 'path', pts: [raw], color, w: tool === 'erase' ? 24 : width, erase: tool === 'erase' }; if (draft.erase) st.objs.push(draft); redraw(); return; }
    if (tool === 'line') { if (!draft) draft = { t: 'line', a: p, b: p, color, w: width }; else { draft.b = p; commit(draft); draft = null; } redraw(); return; }
    if (tool === 'circle') { if (!draft) draft = { t: 'circle', c: p, e: p, color, w: width }; else { draft.e = p; commit(draft); draft = null; } redraw(); return; }
    if (tool === 'arc') {
      if (!draft) draft = { t: 'arc', a: p, b: p, c: null, color, w: width, stage: 1 };
      else if (draft.stage === 1) { draft.b = p; draft.stage = 2; }
      else { draft.c = raw; delete draft.stage; commit(draft); draft = null; }
      redraw(); return;
    }
    if (tool === 'text') { textAt(p); return; }
    if (tool === 'hand') {
      for (const o of flat().reverse()) {
        if (o.t === 'img') {
          const corner = Math.abs(raw.x - (o.x + o.w)) < 16 && Math.abs(raw.y - (o.y + o.h)) < 16;
          if (corner || (raw.x > o.x && raw.x < o.x + o.w && raw.y > o.y && raw.y < o.y + o.h)) { drag = { o, mode: corner ? 'size' : 'move', p0: raw, before: { x: o.x, y: o.y, w: o.w, h: o.h } }; return; }
        }
      }
      const t = hitText(raw); if (t) drag = { o: t, mode: 'text', p0: raw, before: { p: { ...t.p } } };
    }
  });
  cui.addEventListener('pointermove', (e) => {
    const raw = pos(e), p = sn(raw); hover = p;
    if (draft?.t === 'path') { if (e.buttons) { draft.pts.push(raw); redraw(); } return; }
    if (draft?.t === 'line') draft.b = p;
    else if (draft?.t === 'circle') draft.e = p;
    else if (draft?.t === 'arc') { if (draft.stage === 1) draft.b = p; else draft.c = raw; }
    else if (drag) {
      const { o, before, p0 } = drag, dx = raw.x - p0.x, dy = raw.y - p0.y;
      if (drag.mode === 'move') { const ox = o.ox || 0, oy = o.oy || 0, q = sn({ x: before.x + dx + ox, y: before.y + dy + oy }); o.x = q.x - ox; o.y = q.y - oy; }   // узлы рисунка остаются на узлах тетради
      else if (drag.mode === 'size') { let w = Math.max(60, before.w + dx); if (st.snap) w = Math.round(w / CELL) * CELL; o.w = w; o.h = (w * before.h) / before.w; }
      else if (drag.mode === 'text') o.p = sn({ x: before.p.x + dx, y: before.p.y + dy });
    }
    redraw();
  });
  cui.addEventListener('pointerleave', () => { hover = null; redraw(); });
  cui.addEventListener('pointerup', () => {
    if (draft?.t === 'path') { if (!draft.erase) st.objs.push(draft); st.redo.length = 0; draft = null; redraw(); save(); }
    if (drag) {
      const { o, before } = drag;
      const after = drag.mode === 'text' ? { p: { ...o.p } } : { x: o.x, y: o.y, w: o.w, h: o.h };
      if (JSON.stringify(after) !== JSON.stringify(before)) { st.objs.push({ t: 'tf', o, before, after }); st.redo.length = 0; save(); }
      drag = null; redraw();
    }
  });
  function textAt(p) {
    const inp = document.createElement('input');
    inp.className = 'bd-text'; inp.style.left = p.x + 'px'; inp.style.top = p.y + 'px'; inp.style.color = color; inp.setAttribute('aria-label', 'Текст на черновике');
    stage.appendChild(inp); setTimeout(() => inp.focus(), 0);
    let done = false;
    const fin = () => { if (done) return; done = true; if (inp.value.trim()) commit({ t: 'text', p, s: inp.value, color, size: width > 3 ? 26 : 20 }); inp.remove(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') fin(); if (e.key === 'Escape') { inp.value = ''; fin(); } });
    inp.addEventListener('blur', fin);
  }
  function undo() {
    const o = st.objs.pop(); if (!o) return;
    if (o.t === 'tf') Object.assign(o.o, o.before);
    if (o.t === 'clear') st.objs = o.saved.slice();
    st.redo.push(o); redraw(); save();
  }
  function redo() {
    const o = st.redo.pop(); if (!o) return;
    if (o.t === 'tf') Object.assign(o.o, o.after);
    if (o.t === 'clear') st.objs = [o]; else st.objs.push(o);
    redraw(); save();
  }

  // ---------- перенос рисунка задачи ----------
  function transferFigure() {
    const svg = opt.getFigure?.(); if (!svg || !svg.querySelector('*')) { flash('У этой задачи нет рисунка'); return; }
    const clone = svg.cloneNode(true), src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    const dark = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return c; const [r, gg, b] = m.map(Number); return r * 0.3 + gg * 0.59 + b * 0.11 > 150 ? '#1C222E' : c; };
    src.forEach((el, i) => {
      const cs = getComputedStyle(el), d = dst[i];
      for (const pr of ['paint-order', 'stroke-linejoin', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'opacity', 'display', 'visibility', 'font-size', 'font-style', 'font-weight', 'text-anchor', 'dominant-baseline']) d.style.setProperty(pr, cs.getPropertyValue(pr));
      d.style.setProperty('font-family', 'Georgia, "Times New Roman", serif');
      const fill = cs.getPropertyValue('fill'), stroke = cs.getPropertyValue('stroke');
      d.style.setProperty('fill', fill && fill !== 'none' ? (el.tagName === 'text' || el.tagName === 'tspan' ? '#1C222E' : dark(fill)) : 'none');
      const isText = el.tagName === 'text' || el.tagName === 'tspan';
      d.style.setProperty('stroke', isText ? '#FDFCF8' : stroke && stroke !== 'none' ? dark(stroke) : 'none');   // у подписей — ореол цвета бумаги
      d.style.setProperty('transition', 'none'); d.style.setProperty('animation', 'none');
    });
    const vb = (svg.getAttribute('viewBox') || `0 0 ${svg.clientWidth} ${svg.clientHeight}`).split(/\s+/).map(Number);
    // клетчатая плоскость КИМ: клетку рисунка подгоняем под клетку тетради, оставляем только оси
    const gl = [...svg.querySelectorAll('.ch-grid line')];
    const xs = [...new Set(gl.filter((l) => l.getAttribute('x1') === l.getAttribute('x2')).map((l) => +(+l.getAttribute('x1')).toFixed(2)))].sort((a, b) => a - b);
    const ys = [...new Set(gl.filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).map((l) => +(+l.getAttribute('y1')).toFixed(2)))].sort((a, b) => a - b);
    const step = xs.length > 2 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : 0;
    clone.querySelectorAll('.ch-grid line:not(.ax)').forEach((n) => n.remove());
    clone.querySelectorAll('.ch-grid line.ax, .ch-grid polygon').forEach((n) => { n.style.setProperty('stroke', '#1C222E'); n.style.setProperty('fill', '#1C222E'); n.style.setProperty('stroke-width', '1.4px'); });
    clone.setAttribute('width', vb[2]); clone.setAttribute('height', vb[3]); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const img = new Image(), src2 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    img.onload = () => {
      let w, ox = 0, oy = 0;
      if (step > 0) {                                   // 1 клетка рисунка = 1 клетка тетради
        const k = CELL / step; w = vb[2] * k;
        ox = ((xs[0] * k) % CELL + CELL) % CELL; oy = ((ys[0] * k) % CELL + CELL) % CELL;
      } else { w = Math.min(W - 3 * CELL, vb[2]); w = Math.max(CELL * 6, Math.round(w / CELL) * CELL); }
      commit({ t: 'img', img, src: src2, x: CELL - ox, y: CELL - oy, ox, oy, w, h: (w * vb[3]) / vb[2] });
      setTool('hand'); flash(step > 0 ? 'Клетки рисунка совпали с клетками тетради — двигай рукой ✥' : 'Рисунок на черновике — тяни рукой ✥, растягивай за угол');
    };
    img.src = src2;
  }
  function flash(s) { const n = document.createElement('div'); n.className = 'bd-flash'; n.textContent = s; stage.appendChild(n); setTimeout(() => n.remove(), 1800); }

  // ---------- панель ----------
  function setTool(t) { tool = t; draft = null; root.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === t)); cui.style.cursor = t === 'hand' ? 'move' : t === 'text' ? 'text' : 'crosshair'; hint.textContent = HINTS[t]; redraw(); }
  function setColor(c) { color = c; root.querySelectorAll('[data-col]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.col === c)); }
  function setW(w) { width = w; root.querySelectorAll('[data-w]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.w === w)); }
  root.querySelector('.bd-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.dataset.col) setColor(b.dataset.col);
    else if (b.dataset.w) setW(+b.dataset.w);
    else ({
      undo, redo, fig: transferFigure,
      clear: () => { if (flat().length) { st.objs = [{ t: 'clear', saved: st.objs.slice() }]; st.redo.length = 0; redraw(); save(); } },
      snap: () => { st.snap = !st.snap; paper(); save(); flash(st.snap ? 'Привязка к клеткам включена' : 'Привязка выключена'); },
      bg: () => { st.bg = st.bg === 'grid' ? 'blank' : 'grid'; paper(); save(); },
      full: () => { root.classList.toggle('full'); b.textContent = root.classList.contains('full') ? '✕' : '⤢'; setTimeout(size, 30); },
    }[b.dataset.act] || (() => {}))();
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const kk = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (kk === 'z' || kk === 'я')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (kk === 'y' || kk === 'н')) { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') { if (root.classList.contains('full')) root.querySelector('[data-act=full]').click(); draft = null; redraw(); return; }
    const t = TOOLS.find((x) => x[3].toLowerCase() === kk); if (t && !e.ctrlKey && !e.metaKey) setTool(t[0]);
  });
  setTool('pen'); setColor(COLORS[0]); setW(2);
  new ResizeObserver(size).observe(stage);
  return { transferFigure, root };
}
