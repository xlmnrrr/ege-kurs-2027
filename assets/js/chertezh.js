// Чертёж — своя маленькая библиотека пошаговых рисунков на SVG (2D и 3D), без зависимостей.
// Идея: рисунок = список элементов, у каждого номер шага; setStep(n) показывает элементы шагов ≤ n
// (вперёд — линия «прорисовывается», назад — плавно гаснет). 3D — ортогональная проекция,
// вращение пальцем/мышью, невидимые части линий штрихом (проверка перекрытия гранями), кнопка «как в тетради».
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], (a[2] || 0) + (b[2] || 0)];
const mul = (a, k) => [a[0] * k, a[1] * k, (a[2] || 0) * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + (a[2] || 0) * (b[2] || 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2] || 0);
const norm = (a) => mul(a, 1 / (len(a) || 1));
export const mid = (a, b) => mul(add(a, b), 0.5);
export const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
export const V = { sub, add, mul, dot, cross, len, norm };

export class Chertezh {
  /**
   * @param {SVGSVGElement} svg
   * @param {{mode?:'2d'|'3d', width?:number, height?:number, scale?:number, yaw?:number, pitch?:number, notebook?:{yaw:number,pitch:number}, center?:number[]}} o
   */
  constructor(svg, o = {}) {
    this.svg = svg;
    this.mode = o.mode || '2d';
    this.W = o.width || 400; this.H = o.height || 300;
    this.scale = o.scale || 1;
    this.center = o.center || [0, 0, 0];
    this.notebook = o.notebook || { yaw: -0.5, pitch: 0.32 };
    this.yaw = o.yaw ?? this.notebook.yaw; this.pitch = o.pitch ?? this.notebook.pitch;
    svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    svg.classList.add('ch');
    this.gFaces = el('g', { class: 'ch-faces' }, svg);
    this.gLines = el('g', { class: 'ch-lines' }, svg);
    this.gPts = el('g', { class: 'ch-pts' }, svg);
    this.gLabels = el('g', { class: 'ch-labels' }, svg);
    this.items = [];
    this.faces = []; // для 3D: грани, перекрывающие линии [{pts:[...3d], id}]
    this.step = 0;
    if (this.mode === '3d') this.enableRotate();
    if (typeof ResizeObserver !== 'undefined') { let w = 0; new ResizeObserver(([e]) => { const nw = Math.round(e.contentRect.width); if (nw && nw !== w) { w = nw; if (this.items.length) this.render(); } }).observe(svg); }
  }

  /** Настройки рисунка после создания (рисунки номера задают их сами): mode, width, height, scale, center, notebook, yaw, pitch */
  opts(o = {}) {
    const was3d = this.mode === '3d';
    if (o.mode) this.mode = o.mode;
    if (o.width) this.W = o.width; if (o.height) this.H = o.height;
    if (o.scale) this.scale = o.scale; if (o.center) this.center = o.center;
    if (o.notebook) this.notebook = o.notebook;
    this.yaw = o.yaw ?? (o.notebook ? o.notebook.yaw : this.yaw); this.pitch = o.pitch ?? (o.notebook ? o.notebook.pitch : this.pitch);
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    if (this.mode === '3d' && !was3d && !this._rot) this.enableRotate();
    return this;
  }
  /** Число шагов рисунка (максимальный номер шага + 1) */
  get steps() { return this.items.reduce((m, it) => Math.max(m, it.step), 0) + 1; }

  // ---------- проекция ----------
  basis() {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // ось z — вверх; камера смотрит с направления view (к зрителю)
    // правая тройка экрана (вправо, вверх, к зрителю) — без зеркального отражения; ось z мира смотрит вверх
    const view = [-sy * cp, cy * cp, sp];           // единичный вектор от сцены к зрителю
    const right = [-cy, -sy, 0];
    const up = cross(view, right);
    return { right, up, view };
  }
  P(p) { // мировые -> экран (+ глубина: больше = ближе к зрителю)
    if (this.mode === '2d') return [this.W / 2 + (p[0] - this.center[0]) * this.scale, this.H / 2 - (p[1] - this.center[1]) * this.scale, 0];
    const b = this._b || (this._b = this.basis());
    const q = sub(p, this.center);
    return [this.W / 2 + dot(q, b.right) * this.scale, this.H / 2 - dot(q, b.up) * this.scale, dot(q, b.view)];
  }

  // ---------- элементы ----------
  _add(kind, data, opt = {}) {
    const it = { kind, data, step: opt.step ?? 0, cls: opt.cls || '', nodes: [], label: opt.label, opt };
    this.items.push(it);
    return it;
  }
  /** Отрезок. opt: {step, cls:'ink'|'thin'|'construct'|'accent'|'accent2', hidden3d:true — штрих за гранями} */
  seg(a, b, opt = {}) { return this._add('seg', { a, b }, opt); }
  poly(pts, opt = {}) { return this._add('poly', { pts }, opt); }
  /** Грань 3D (заливка + участвует в перекрытии линий) */
  face(pts, opt = {}) { const it = this._add('face', { pts }, opt); if (opt.occlude !== false) this.faces.push(it); return it; }
  circle2d(c, r, opt = {}) { return this._add('circle', { c, r }, opt); }
  /** Окружность в 3D-плоскости: центр c, нормаль n, радиус r */
  circle3d(c, n, r, opt = {}) {
    const a = norm(Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0])), bb = cross(norm(n), a);
    const pts = []; for (let i = 0; i <= 72; i++) { const t = (i / 72) * 2 * Math.PI; pts.push(add(c, add(mul(a, r * Math.cos(t)), mul(bb, r * Math.sin(t))))); }
    return this._add('curve', { pts }, opt);
  }
  curve(pts, opt = {}) { return this._add('curve', { pts }, opt); }
  point(p, name, opt = {}) { return this._add('pt', { p, name }, opt); }
  /** Вектор-стрелка: из p в направлении d (мировые единицы) */
  vec(p, d, name, opt = {}) { return this._add('vec', { p, d, name }, opt); }
  /** Подпись в точке со смещением dx, dy (экранные единицы) */
  text(p, s, opt = {}) { return this._add('text', { p, s }, opt); }
  /** Дуга угла при вершине v между лучами к a и b (2D/3D), r — в экранных единицах */
  angle(v, a, b, opt = {}) { return this._add('angle', { v, a, b }, opt); }
  /** Знак прямого угла */
  right(v, a, b, opt = {}) { return this._add('right', { v, a, b }, opt); }
  /** Засечки равенства на отрезке (k штук) */
  ticks(a, b, k = 1, opt = {}) { return this._add('ticks', { a, b, k }, opt); }

  /** Клетчатая сетка как в КИМ: клетка 1×1, оси со стрелками, числа у осей; кривые обрезаются рамкой */
  grid2d({ x0, x1, y0, y1, numbers = 'ким', every = 1 }) { // numbers: 'ким' — только 0 и 1, как в КИМ; 'все' — каждое деление
    const g = el('g', { class: 'ch-grid' }); this.svg.insertBefore(g, this.svg.firstChild);
    const L = (a, b, c) => { const A = this.P(a), B = this.P(b); el('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: c }, g); };
    for (let x = Math.ceil(x0); x <= x1; x++) L([x, y0], [x, y1], x === 0 ? 'ax' : '');
    for (let y = Math.ceil(y0); y <= y1; y++) L([x0, y], [x1, y], y === 0 ? 'ax' : '');
    const O = this.P([0, 0]), XA = this.P([x1, 0]), YA = this.P([0, y1]);
    el('polygon', { points: `${XA[0]},${XA[1]} ${XA[0] - 10},${XA[1] - 4.5} ${XA[0] - 10},${XA[1] + 4.5}`, class: 'ax-head' }, g);
    el('polygon', { points: `${YA[0]},${YA[1]} ${YA[0] - 4.5},${YA[1] + 10} ${YA[0] + 4.5},${YA[1] + 10}`, class: 'ax-head' }, g);
    const t = (p, s, dx, dy, c = 'ax-num') => { const q = this.P(p); const n = el('text', { x: q[0] + dx, y: q[1] + dy, class: c }, g); n.textContent = s; };
    t([x1, 0], 'x', -8, 16, 'ax-name'); t([0, y1], 'y', 12, 10, 'ax-name');
    if (numbers === 'ким') { t([0, 0], '0', -9, 14); t([1, 0], '1', 0, 15); t([0, 1], '1', -11, 1); }
    else if (numbers) { t([0, 0], '0', -9, 14); for (let x = Math.ceil(x0) + 1; x < x1; x += every) if (x) t([x, 0], String(x).replace('-', '−'), 0, 15); for (let y = Math.ceil(y0) + 1; y < y1; y += every) if (y) t([0, y], String(y).replace('-', '−'), -12, 1); }
    // рамка-обрезка для линий и кривых
    const id = 'clip' + Math.random().toString(36).slice(2, 8), A = this.P([x0, y1]), B = this.P([x1, y0]);
    const cp = el('clipPath', { id }, this.svg); el('rect', { x: A[0], y: A[1], width: B[0] - A[0], height: B[1] - A[1] }, cp);
    this.gLines.setAttribute('clip-path', `url(#${id})`);
    return g;
  }

  /** Раздвинуть подписи: не наезжают друг на друга и на точки (несколько проходов) */
  _declutter() {
    const labels = [...this.gLabels.querySelectorAll('text.on, text:not([data-step])')].filter((n) => n.getBBox && n.textContent);
    if (!labels.length) return;
    const dots = [...this.gPts.querySelectorAll('circle.on, circle:not([data-step])')].map((c) => { const r = +c.getAttribute('r') + 3; return { x: +c.getAttribute('cx') - r, y: +c.getAttribute('cy') - r, w: 2 * r, h: 2 * r }; });
    const box = (n) => { const b = n.getBBox(); return { x: b.x - 2, y: b.y - 1, w: b.width + 4, h: b.height + 2 }; };
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const C = this.P(this.center);
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      labels.forEach((n, i) => {
        const b = box(n);
        const others = [...dots, ...labels.filter((m, j) => j < i).map(box)];
        if (others.some((o) => hit(b, o))) {
          const x = +n.getAttribute('x'), y = +n.getAttribute('y'), dx = x - C[0], dy = y - C[1], L = Math.hypot(dx, dy) || 1;
          n.setAttribute('x', (x + (dx / L) * 6).toFixed(1)); n.setAttribute('y', (y + (dy / L) * 6).toFixed(1)); moved = true;
        }
      });
      if (!moved) break;
    }
  }

  // ---------- видимость в 3D ----------
  _occluded(p3) { // точка закрыта какой-нибудь гранью?
    if (this.mode !== '3d' || !this.faces.length) return false;
    const P = this.P(p3);
    for (const f of this.faces) {
      if (f.step > this.step && !f.opt.alwaysOcclude) continue;
      const s = f._scr; if (!s) continue;
      if (!inPoly(P, s)) continue;
      const z = planeDepthAt(P, s);   // глубина грани под точкой
      if (z > P[2] + 1e-3 * this.scale) return true;
    }
    return false;
  }
  _splitVisible(a, b, n = 24) { // отрезок -> куски [видимые], [невидимые]
    const runs = []; let cur = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = lerp(a, b, t), hid = this._occluded(p);
      if (!cur || cur.hid !== hid) { if (cur) cur.t1 = (t + cur.tl) / 2; cur = { hid, t0: cur ? cur.t1 : 0, tl: t }; runs.push(cur); }
      cur.tl = t;
    }
    if (cur) cur.t1 = 1;
    return runs.map((r) => ({ hid: r.hid, a: lerp(a, b, r.t0), b: lerp(a, b, r.t1) }));
  }

  // ---------- отрисовка ----------
  render() {
    this._b = null;
    // длина штриха анимации — в пикселях экрана (у линий non-scaling-stroke штрих меряется в px)
    this.k = (this.svg.getBoundingClientRect().width || this.W) / this.W;
    // сначала экранные контуры граней (для перекрытия)
    for (const f of this.faces) f._scr = f.data.pts.map((p) => this.P(p));
    for (const it of this.items) this._draw(it);
    this.setStep(this.step, true);
  }
  _node(it, i, tag, parent) {
    let n = it.nodes[i];
    if (!n || n.tagName !== tag) { if (n) n.remove(); n = el(tag, {}, parent); it.nodes[i] = n; n.dataset.step = it.step; if (it.cls) n.setAttribute('class', it.cls); }
    return n;
  }
  _trim(it, from) { for (let i = from; i < it.nodes.length; i++) it.nodes[i]?.remove(); it.nodes.length = Math.min(it.nodes.length, from); }
  _draw(it) {
    const d = it.data;
    const cls = (base) => `${base} ${it.cls}`.trim();
    if (it.kind === 'seg') {
      const parts = this.mode === '3d' && it.opt.hidden3d !== false ? this._splitVisible(d.a, d.b) : [{ hid: false, a: d.a, b: d.b }];
      parts.forEach((s, i) => {
        const n = this._node(it, i, 'line', this.gLines);
        const A = this.P(s.a), B = this.P(s.b);
        n.setAttribute('x1', A[0]); n.setAttribute('y1', A[1]); n.setAttribute('x2', B[0]); n.setAttribute('y2', B[1]);
        n.setAttribute('class', cls(s.hid ? 'ch-hidden' : 'ch-line'));
        n.dataset.step = it.step;
        n.style.setProperty('--len', (Math.hypot(B[0] - A[0], B[1] - A[1]) * this.k + 2).toFixed(1) + 'px');
      });
      this._trim(it, parts.length);
    } else if (it.kind === 'poly' || it.kind === 'face' || it.kind === 'curve') {
      const n = this._node(it, 0, it.kind === 'curve' ? 'polyline' : 'polygon', it.kind === 'face' ? this.gFaces : this.gLines);
      const scr = d.pts.map((p) => this.P(p));
      n.setAttribute('points', scr.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '));
      n.setAttribute('class', cls(it.kind === 'face' ? 'ch-face' : it.kind === 'curve' ? 'ch-curve' : 'ch-poly'));
      let L = 0; for (let i = 1; i < scr.length; i++) L += Math.hypot(scr[i][0] - scr[i - 1][0], scr[i][1] - scr[i - 1][1]);
      n.style.setProperty('--len', (L * this.k + 2).toFixed(1) + 'px');
    } else if (it.kind === 'circle') {
      const n = this._node(it, 0, 'circle', this.gLines); const C = this.P(d.c);
      n.setAttribute('cx', C[0]); n.setAttribute('cy', C[1]); n.setAttribute('r', d.r * this.scale);
      n.setAttribute('class', cls('ch-curve')); n.style.setProperty('--len', (2 * Math.PI * d.r * this.scale * this.k + 2).toFixed(1) + 'px');
    } else if (it.kind === 'pt') {
      const C = this.P(d.p), hid = this.mode === '3d' && this._occluded(d.p);
      const n = this._node(it, 0, 'circle', this.gPts);
      n.setAttribute('cx', C[0]); n.setAttribute('cy', C[1]); n.setAttribute('r', it.opt.r || 4);
      n.setAttribute('class', cls(hid ? 'ch-pt ch-pt-hid' : 'ch-pt'));
      if (d.name) this._label(it, 1, C, d.name, d.p);
    } else if (it.kind === 'vec') {
      const A = this.P(d.p), B = this.P(add(d.p, d.d));
      const ln = this._node(it, 0, 'line', this.gLines);
      const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = it.opt.head || 13, w = h * 0.42;
      ln.setAttribute('x1', A[0]); ln.setAttribute('y1', A[1]); ln.setAttribute('x2', B[0] - ux * h * 0.8); ln.setAttribute('y2', B[1] - uy * h * 0.8);
      ln.setAttribute('class', cls('ch-vec')); ln.style.setProperty('--len', (L * this.k + 2).toFixed(1) + 'px');
      const hd = this._node(it, 1, 'polygon', this.gLines);
      hd.setAttribute('points', `${B[0]},${B[1]} ${B[0] - ux * h - uy * w},${B[1] - uy * h + ux * w} ${B[0] - ux * h + uy * w},${B[1] - uy * h - ux * w}`);
      hd.setAttribute('class', cls('ch-head'));
      if (d.name) this._label(it, 2, [B[0] + ux * 6, B[1] + uy * 6], d.name, null, true);
    } else if (it.kind === 'text') {
      const C = this.P(d.p); this._label(it, 0, [C[0] + (it.opt.dx || 0), C[1] + (it.opt.dy || 0)], d.s, null, true);
    } else if (it.kind === 'angle' || it.kind === 'right') {
      const O = this.P(d.v), A = this.P(d.a), B = this.P(d.b), r = it.opt.r || 22;
      const ua = norm2([A[0] - O[0], A[1] - O[1]]), ub = norm2([B[0] - O[0], B[1] - O[1]]);
      const n = this._node(it, 0, 'path', this.gLines);
      if (it.kind === 'right') {
        const p1 = [O[0] + ua[0] * r * 0.7, O[1] + ua[1] * r * 0.7], p2 = [O[0] + (ua[0] + ub[0]) * r * 0.7, O[1] + (ua[1] + ub[1]) * r * 0.7], p3 = [O[0] + ub[0] * r * 0.7, O[1] + ub[1] * r * 0.7];
        n.setAttribute('d', `M${p1} L${p2} L${p3}`);
      } else {
        const a0 = Math.atan2(ua[1], ua[0]), a1 = Math.atan2(ub[1], ub[0]);
        let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const p1 = [O[0] + r * Math.cos(a0), O[1] + r * Math.sin(a0)], p2 = [O[0] + r * Math.cos(a0 + da), O[1] + r * Math.sin(a0 + da)];
        n.setAttribute('d', `M${p1} A${r},${r} 0 0 ${da > 0 ? 1 : 0} ${p2}`);
        if (it.opt.name) { const am = a0 + da / 2, nr = it.opt.nameR || r + 14; this._label(it, 1, [O[0] + nr * Math.cos(am), O[1] + nr * Math.sin(am)], it.opt.name, null, true); }
      }
      n.setAttribute('class', cls('ch-angle')); n.style.setProperty('--len', (r * 3 * this.k).toFixed(1) + 'px');
    } else if (it.kind === 'ticks') {
      const A = this.P(d.a), B = this.P(d.b), M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const u = norm2([B[0] - A[0], B[1] - A[1]]), nrm = [-u[1], u[0]];
      for (let k = 0; k < d.k; k++) {
        const off = (k - (d.k - 1) / 2) * 5, c = [M[0] + u[0] * off, M[1] + u[1] * off];
        const n = this._node(it, k, 'line', this.gLines);
        n.setAttribute('x1', c[0] - nrm[0] * 7); n.setAttribute('y1', c[1] - nrm[1] * 7); n.setAttribute('x2', c[0] + nrm[0] * 7); n.setAttribute('y2', c[1] + nrm[1] * 7);
        n.setAttribute('class', cls('ch-tick'));
      }
    }
  }
  _label(it, i, at, s, p3, exact) {
    const n = this._node(it, i, 'text', this.gLabels);
    let x = at[0], y = at[1];
    if (!exact) { // отталкиваем подпись от центра фигуры
      const C = this.P(this.center), dx = at[0] - C[0], dy = at[1] - C[1], L = Math.hypot(dx, dy) || 1, off = it.opt.off || 16;
      x += (dx / L) * off + (it.opt.dx || 0); y += (dy / L) * off + (it.opt.dy || 0);
    }
    n.setAttribute('x', x.toFixed(1)); n.setAttribute('y', y.toFixed(1));
    n.setAttribute('class', `ch-label ${it.cls}`.trim());
    // индексы: «M_1» -> M с нижним индексом
    if (n.dataset.s !== s) {
      n.textContent = '';
      const m = /^(.+?)(?:_(.+))?$/.exec(s);
      n.appendChild(document.createTextNode(m[1]));
      if (m[2]) { const t = el('tspan', { 'baseline-shift': 'sub', class: 'ch-sub' }, n); t.textContent = m[2]; }
      n.dataset.s = s;
    }
  }

  // ---------- шаги ----------
  setStep(n, instant = false) {
    const back = n < this.step;
    this.step = n;
    if (this.mode === '3d' && !instant) this.render();
    this.svg.classList.toggle('ch-instant', instant);
    this.svg.classList.toggle('ch-back', back);
    this.svg.querySelectorAll('[data-step]').forEach((e) => {
      const s = +e.dataset.step;
      e.classList.toggle('on', s <= n);
      e.classList.toggle('now', s === n);
    });
    this._declutter();
  }

  // ---------- вращение ----------
  enableRotate() {
    this._rot = true;
    let drag = null;
    this.svg.style.touchAction = 'none';
    this.svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; this.svg.setPointerCapture(e.pointerId); this.svg.classList.add('ch-drag'); });
    this.svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = 0.01;
      this.yaw = drag.yaw - (e.clientX - drag.x) * k;
      this.pitch = Math.max(-0.2, Math.min(1.35, drag.pitch + (e.clientY - drag.y) * k));
      this.requestDraw();
    });
    const end = () => { drag = null; this.svg.classList.remove('ch-drag'); };
    this.svg.addEventListener('pointerup', end); this.svg.addEventListener('pointercancel', end);
  }
  requestDraw() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); this.svg.classList.add('ch-instant'); }); }
  /** Плавно вернуть вид «как в тетради» */
  toNotebook(ms = 600) {
    const y0 = this.yaw, p0 = this.pitch, t0 = performance.now();
    let dy = this.notebook.yaw - y0; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const tick = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3; this.yaw = y0 + dy * e; this.pitch = p0 + (this.notebook.pitch - p0) * e; this.render(); this.svg.classList.add('ch-instant'); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}

function norm2(v) { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; }
function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] + 1e-12) + a[0]) inside = !inside;
  }
  return inside;
}
function planeDepthAt(p, s) { // глубина плоскости грани (по трём точкам) в экранной точке p
  const a = s[0], b = s[1], c = s[2];
  const n = cross(sub(b, a), sub(c, a));
  if (Math.abs(n[2]) < 1e-9) return -Infinity;
  return a[2] - (n[0] * (p[0] - a[0]) + n[1] * (p[1] - a[1])) / n[2];
}
