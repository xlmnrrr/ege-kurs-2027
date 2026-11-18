// «3D-стенд» (волна 3, 18.11.2026): объёмные сцены в стиле «Чертежа», Canvas 2D, без библиотек.
// Стереометрия — 11 тел (видимые рёбра сплошные, невидимые — штрихом, высоты и оси — построением, буквы как в ЕГЭ);
// физика — наклонная плоскость, пружинный и нитяной маятники, магнитное поле прямого тока.
// Тянуть вбок или ←→ — поворот; тянуть вверх-вниз или ↑↓ — параметр сцены (угол, масса, длина, ток) или наклон камеры.
// Вне экрана и в скрытой вкладке стоит; «уменьшить движение» — без автоповорота и анимации, управление остаётся.
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors = () => { const c = getComputedStyle(document.documentElement); const g = (n) => c.getPropertyValue(n).trim();
  return { text: g('--text'), muted: g('--muted'), line: g('--line-strong'), amber: g('--primary'), blue: g('--blue'), peach: g('--peach'), ok: g('--ok') }; };
const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('.', ',');

// ---------- тела ----------
const reg = (n, r, y, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i * 2 * Math.PI) / n; return [r * Math.cos(a), y, r * Math.sin(a)]; });
const sub = (L, s) => L.map((x) => x + s);
function prism(base, h, labels) { const n = base.length, V = [...base, ...base.map(([x, , z]) => [x, base[0][1] + h, z])];
  const F = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => i + n)];
  for (let i = 0; i < n; i++) F.push([i, (i + 1) % n, (i + 1) % n + n, i + n]);
  return { V, F, L: labels || [...base.map((_, i) => 'ABCDEF'[i]), ...base.map((_, i) => 'ABCDEF'[i] + '₁')] }; }
function pyramid(base, apex, labels) { const n = base.length, V = [...base, apex];
  const F = [Array.from({ length: n }, (_, i) => i)]; for (let i = 0; i < n; i++) F.push([i, (i + 1) % n, n]);
  return { V, F, L: labels || [...base.map((_, i) => 'ABCDEF'[i]), 'S'] }; }
const sq = (s, y) => [[-s, y, s], [s, y, s], [s, y, -s], [-s, y, -s]];
const TH = {
  cube: { name: 'Куб', make: () => prism(sq(1, -1), 2), cap: 'Куб: V = a³, S = 6a², диагональ d = a√3' },
  box: { name: 'Параллелепипед', make: () => prism([[-1.3, -0.9, 0.8], [1.3, -0.9, 0.8], [1.3, -0.9, -0.8], [-1.3, -0.9, -0.8]], 1.8), cap: 'Прямоугольный параллелепипед: V = abc, d² = a² + b² + c²' },
  prism3: { name: 'Треугольная призма', make: () => prism(reg(3, 1.3, -1, Math.PI / 2), 2), cap: 'Призма: V = S осн · h, S бок = P осн · h' },
  prism6: { name: 'Шестиугольная призма', make: () => prism(reg(6, 1.2, -1), 2), cap: 'Правильная шестиугольная призма: S осн = (3√3/2)·a², V = S осн · h' },
  pyr3: { name: 'Треугольная пирамида', make: () => pyramid(reg(3, 1.35, -1, Math.PI / 2), [0, 1.3, 0]), h: true, cap: 'Пирамида: V = ⅓ · S осн · h; у правильной высота падает в центр основания' },
  pyr4: { name: 'Четырёхугольная пирамида', make: () => pyramid(sq(1.15, -1), [0, 1.3, 0]), h: true, cap: 'Правильная четырёхугольная пирамида: V = ⅓ · a² · h, O — центр квадрата' },
  pyr6: { name: 'Шестиугольная пирамида', make: () => pyramid(reg(6, 1.3, -1), [0, 1.4, 0]), h: true, cap: 'Правильная шестиугольная пирамида SABCDEF: V = ⅓ · S осн · h, S осн = (3√3/2)·a²' },
  tetra: { name: 'Тетраэдр', make: () => { const a = 2.4, r = a / Math.sqrt(3), h = a * Math.sqrt(2 / 3); return pyramid(reg(3, r, -h / 3, Math.PI / 2), [0, (2 * h) / 3, 0], ['A', 'B', 'C', 'D']); }, h: true, cap: 'Правильный тетраэдр: все рёбра a, V = a³√2 / 12, h = a√(2/3)' },
  cylinder: { name: 'Цилиндр', round: 'cyl', cap: 'Цилиндр: V = πr²h, S бок = 2πrh' },
  cone: { name: 'Конус', round: 'cone', cap: 'Конус: V = ⅓πr²h, S бок = πrl, l² = r² + h²' },
  sphere: { name: 'Шар', round: 'sph', cap: 'Шар: V = ⁴⁄₃πR³, площадь сферы S = 4πR²' },
};
for (const k of Object.keys(TH)) if (TH[k].make) { const b = TH[k].make(); Object.assign(TH[k], b);
  const c = [0, 1, 2].map((i) => b.V.reduce((s, v) => s + v[i], 0) / b.V.length); TH[k].C = c;
  const E = new Map(); b.F.forEach((f, fi) => f.forEach((v, i) => { const w = f[(i + 1) % f.length], key = Math.min(v, w) + ':' + Math.max(v, w); if (!E.has(key)) E.set(key, { a: v, b: w, f: [] }); E.get(key).f.push(fi); }));
  TH[k].E = [...E.values()]; }

// ---------- физика ----------
const PH = {
  incline: { name: 'Наклонная плоскость', param: { min: 5, max: 45, init: 30, step: 1, unit: '°', label: 'α' } },
  spring: { name: 'Пружинный маятник', param: { min: 0.1, max: 2, init: 0.5, step: 0.05, unit: ' кг', label: 'm' }, anim: true },
  pendulum: { name: 'Нитяной маятник', param: { min: 0.3, max: 2, init: 1, step: 0.05, unit: ' м', label: 'l' }, anim: true },
  wire: { name: 'Магнитное поле тока', param: { min: 1, max: 20, init: 5, step: 1, unit: ' А', label: 'I' }, anim: true },
};
export const SCENE_NAMES = Object.fromEntries([...Object.entries(TH), ...Object.entries(PH)].map(([k, v]) => [k, v.name]));

/** Какую сцену показать к задаче — по тексту условия (первое упоминание тела/явления) */
export function sceneForText(subject, html) {
  const t = String(html || '').replace(/<[^>]+>/g, ' ').toLowerCase().replace(/ё/g, 'е');
  if (subject === 'физика') {
    if (/наклонн/.test(t)) return 'incline';
    if (/пружин/.test(t)) return 'spring';
    if (/маятник/.test(t) || (/нит/.test(t) && /колеба/.test(t))) return 'pendulum';
    if (/магнитн/.test(t) && /(проводник|провод|ток)/.test(t)) return 'wire';
    return null;
  }
  if (subject !== 'математика') return null;
  const hits = [];
  const add = (re, key) => { const m = t.match(re); if (m) hits.push([m.index, key]); };
  add(/тетраэдр/, 'tetra');
  add(/(^|[^а-я])куб(а|е|у|ом|ы)?(?=[^а-я]|$)/u, 'cube');
  add(/параллелепипед/, 'box');
  { const m = t.match(/призм/); if (m) hits.push([m.index, /шестиуг/.test(t) ? 'prism6' : /четырехуг/.test(t) ? 'box' : 'prism3']); }
  { const m = t.match(/пирамид/); if (m) hits.push([m.index, /шестиуг/.test(t) ? 'pyr6' : /треуг/.test(t) ? 'pyr3' : 'pyr4']); }
  add(/цилиндр/, 'cylinder'); add(/конус/, 'cone');
  add(/(^|[^а-я])(шар|сфер)/u, 'sphere');
  hits.sort((a, b) => a[0] - b[0]);
  return hits[0]?.[1] || null;
}
/** Стенд на вкладке «Теория»: какие сцены у номера (id) */
export function standKeys(id) {
  return ({ m03: ['cube', 'box', 'prism3', 'prism6', 'pyr3', 'pyr4', 'pyr6', 'tetra', 'cylinder', 'cone', 'sphere'],
    m15: ['pyr6', 'tetra', 'pyr4', 'pyr3', 'prism3', 'cube', 'box', 'prism6', 'cone', 'cylinder', 'sphere'],
    f02: ['incline'], f04: ['spring', 'pendulum'], f12: ['wire'] })[id] || [];
}
export const scene3dHTML = (key) => `<figure class="s3d" data-scene="${key}">
  <canvas tabindex="0" role="img" aria-label="${SCENE_NAMES[key] || '3D-модель'}: тяни или стрелки — поворот${PH[key] ? ', вверх-вниз — параметр' : ''}"></canvas>
  <figcaption><span class="sc"></span><span class="sp-hint">${PH[key] ? 'вбок — поворот, вверх-вниз — ' + PH[key].param.label : 'тяни — поворот, ↑↓ — наклон'}</span></figcaption></figure>`;

// ---------- движок ----------
export function mountScene3d(fig) {
  if (!fig || fig.dataset.mounted) return; fig.dataset.mounted = '1';
  const key = fig.dataset.scene, th = TH[key], ph = PH[key];
  if (!th && !ph) return;
  const canvas = fig.querySelector('canvas'), cap = fig.querySelector('.sc'), ctx = canvas.getContext('2d');
  const C = colors();
  let yaw = th ? 0.55 : 0.35, pitch = th ? 0.38 : key === 'wire' ? 0.55 : 0.18, par = ph ? ph.param.init : 0, t = 0;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, visible = true, drag = null, capText = '', touched = false;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  const v = {
    rot([x, y, z]) { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; },
    P(p) { const r = v.rot(p), D = 9, k = D / (D - r[2]), f = Math.min(W, H) * (v.scale || 0.22); return [W / 2 + r[0] * f * k, H / 2 - (r[1] + (v.oy || 0)) * f * k, r[2]]; },
    line(a, b, col, w = 1.6, dash = null, al = 1) { const A = v.P(a), B = v.P(b); ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = al;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]); },
    fill(pts, col, al) { ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => { const q = v.P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; },
    text(p, s, col, dx = 0, dy = 0, size = 15, italic = true) { const q = v.P(p); ctx.fillStyle = col; ctx.font = `${italic ? 'italic ' : ''}${Math.round(Math.max(12, Math.min(size, W / 22)))}px KaTeX_Main, Literata, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, q[0] + dx, q[1] + dy); },
    dot(p, col, r = 2.6) { const q = v.P(p); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fill(); },
    arrow(a, b, col, label) { v.line(a, b, col, 2.2); const A = v.P(a), B = v.P(b), ang = Math.atan2(B[1] - A[1], B[0] - A[0]), hl = 9;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.lineTo(B[0] - hl * Math.cos(ang - 0.38), B[1] - hl * Math.sin(ang - 0.38)); ctx.lineTo(B[0] - hl * Math.cos(ang + 0.38), B[1] - hl * Math.sin(ang + 0.38)); ctx.closePath(); ctx.fill();
      if (label) { ctx.font = `italic ${Math.round(Math.max(13, Math.min(17, W / 22)))}px KaTeX_Main, Literata, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, B[0] + 15 * Math.cos(ang) + 8 * Math.sin(ang), B[1] + 15 * Math.sin(ang) - 8 * Math.cos(ang)); } },
  };
  const loop = (pts, col, opt = {}) => { // замкнутая кривая: ближняя половина сплошной, дальняя штрихом
    const cz = v.rot(opt.center || [0, 0, 0])[2];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], front = opt.allFront || v.rot(a)[2] >= cz - 1e-9;
      v.line(a, b, col, front ? (opt.w || 1.7) : 1.2, front ? null : [4, 5], front ? 1 : 0.55); } };

  function drawPoly(b, extra) {
    const cam = [0, 0, 9];
    const vis = b.F.map((f) => {
      const p = f.map((i) => v.rot(b.V[i])), c = [0, 1, 2].map((k) => p.reduce((s, q) => s + q[k], 0) / p.length);
      const u = [0, 1, 2].map((k) => p[1][k] - p[0][k]), w = [0, 1, 2].map((k) => p[2][k] - p[0][k]);
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const bc = v.rot(b.C), out = [0, 1, 2].map((k) => c[k] - bc[k]);
      if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((x) => -x);
      return n[0] * (cam[0] - c[0]) + n[1] * (cam[1] - c[1]) + n[2] * (cam[2] - c[2]) > 0;
    });
    b.F.forEach((f, fi) => { if (vis[fi]) v.fill(f.map((i) => b.V[i]), C.blue, 0.05); });
    b.E.forEach((e) => { if (!e.f.some((fi) => vis[fi])) v.line(b.V[e.a], b.V[e.b], C.muted, 1.3, [5, 6], 0.6); });
    extra?.();
    b.E.forEach((e) => { if (e.f.some((fi) => vis[fi])) v.line(b.V[e.a], b.V[e.b], C.text, 1.8); });
    const cP = v.P(b.C);
    b.V.forEach((p, i) => { const q = v.P(p); v.dot(p, C.text, 2.2); const dx = q[0] - cP[0], dy = q[1] - cP[1], l = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = C.muted; ctx.globalAlpha = v.rot(p)[2] < v.rot(b.C)[2] - 0.4 ? 0.6 : 0.95; ctx.font = `italic ${Math.round(Math.max(12, Math.min(16, W / 24)))}px Literata, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.L[i], q[0] + (dx / l) * 15, q[1] + (dy / l) * 14); ctx.globalAlpha = 1; });
  }

  function drawSolid() {
    v.scale = 0.23; v.oy = 0;
    if (th.V) {
      drawPoly(th, th.h ? () => { const n = th.V.length - 1, S = th.V[n], O = [0, th.V[0][1], 0];
        v.line(S, O, C.amber, 1.5, [5, 5]); v.dot(O, C.amber); v.text(O, 'O', C.amber, 12, 12, 14); } : null);
      return;
    }
    const N = 72;
    if (th.round === 'cyl') {
      const r = 1.15, h = 2.2, bot = reg(N, r, -h / 2), top = reg(N, r, h / 2);
      const xs = bot.map((p) => v.P(p)[0]); const iMin = xs.indexOf(Math.min(...xs)), iMax = xs.indexOf(Math.max(...xs));
      v.fill(top, C.blue, 0.06);
      loop(bot, C.text, { center: [0, -h / 2, 0] }); loop(top, C.text, { center: [0, h / 2, 0], allFront: pitch > 0 });
      [iMin, iMax].forEach((i) => v.line(bot[i], top[i], C.text, 1.8));
      v.line([0, -h / 2, 0], [0, h / 2, 0], C.amber, 1.4, [5, 5]); v.line([0, -h / 2, 0], bot[0], C.amber, 1.4, [5, 5]);
      v.dot([0, -h / 2, 0], C.amber); v.dot([0, h / 2, 0], C.amber); v.text([0, -h / 2, 0], 'O', C.amber, -12, 12, 14); v.text([0, h / 2, 0], 'O₁', C.amber, -14, -10, 14);
      v.text([r / 2, -h / 2, 0], 'r', C.amber, 0, -10, 15); v.text([0, 0, 0], 'h', C.amber, 12, 0, 15);
    } else if (th.round === 'cone') {
      const r = 1.25, h = 2.5, y0 = -1.1, base = reg(N, r, y0), S = [0, y0 + h, 0], sP = v.P(S), oP = v.P([0, y0, 0]);
      const ref = Math.atan2(oP[1] - sP[1], oP[0] - sP[0]);
      const ang = base.map((p) => { const q = v.P(p); let a = Math.atan2(q[1] - sP[1], q[0] - sP[0]) - ref; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; });
      const iMin = ang.indexOf(Math.min(...ang)), iMax = ang.indexOf(Math.max(...ang));
      loop(base, C.text, { center: [0, y0, 0] });
      if (ang[iMax] - ang[iMin] < Math.PI * 0.98) [iMin, iMax].forEach((i) => v.line(S, base[i], C.text, 1.8));
      v.line(S, [0, y0, 0], C.amber, 1.4, [5, 5]); v.line([0, y0, 0], base[0], C.amber, 1.4, [5, 5]); v.line(S, base[0], C.peach, 1.6);
      v.dot(S, C.text); v.dot([0, y0, 0], C.amber); v.text(S, 'S', C.muted, 0, -14, 15); v.text([0, y0, 0], 'O', C.amber, -12, 12, 14);
      v.text([r / 2, y0, 0], 'r', C.amber, 0, 11, 15); v.text([0, y0 + h / 2, 0], 'h', C.amber, -11, 0, 15); v.text([r / 2, y0 + h / 2, 0], 'l', C.peach, 12, 0, 15);
    } else {
      const R = 1.35, c = v.P([0, 0, 0]), rad = Math.min(W, H) * v.scale * R;
      ctx.globalAlpha = 0.06; ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = C.text; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, 7); ctx.stroke();
      loop(reg(N, R, 0), C.text, { w: 1.4 });
      const mer = Array.from({ length: N }, (_, i) => { const a = (i * 2 * Math.PI) / N; return [R * Math.cos(a), R * Math.sin(a), 0]; });
      loop(mer, C.muted, { w: 1.1 });
      v.dot([0, 0, 0], C.amber); v.line([0, 0, 0], [R, 0, 0], C.amber, 1.5, [5, 5]); v.text([0, 0, 0], 'O', C.amber, -12, 10, 14); v.text([R / 2, 0, 0], 'R', C.amber, 0, -11, 15);
    }
  }

  // --- физика ---
  const g = 9.8;
  function drawIncline() {
    v.scale = 0.2; v.oy = 0.3;
    const a = (par * Math.PI) / 180, L = 3.6, Hh = Math.min(L * Math.tan(a), 3.4), Lx = Hh / Math.tan(a), x0 = -Lx / 2, y0 = -1.3, dz = 0.8;
    // клин: треугольная призма «лёжа»
    const P3 = [[x0, y0, dz], [x0 + Lx, y0, dz], [x0 + Lx, y0 + Hh, dz], [x0, y0, -dz], [x0 + Lx, y0, -dz], [x0 + Lx, y0 + Hh, -dz]];
    const W1 = { V: P3, F: [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [0, 2, 5, 3]], L: ['', '', '', '', '', ''], C: [x0 + Lx * 0.66, y0 + Hh / 3, 0] };
    const E = new Map(); W1.F.forEach((f, fi) => f.forEach((vv, i) => { const w = f[(i + 1) % f.length], k = Math.min(vv, w) + ':' + Math.max(vv, w); if (!E.has(k)) E.set(k, { a: vv, b: w, f: [] }); E.get(k).f.push(fi); })); W1.E = [...E.values()];
    // брусок на склоне
    const u = [Math.cos(a), Math.sin(a), 0], n = [-Math.sin(a), Math.cos(a), 0], s = Math.hypot(Lx, Hh) * 0.5, bl = 0.75, bh = 0.45, bz = 0.38;
    const at = (t2, hh, z) => [x0 + u[0] * t2 + n[0] * hh, y0 + u[1] * t2 + n[1] * hh, z];
    const BV = [at(s - bl / 2, 0, bz), at(s + bl / 2, 0, bz), at(s + bl / 2, bh, bz), at(s - bl / 2, bh, bz), at(s - bl / 2, 0, -bz), at(s + bl / 2, 0, -bz), at(s + bl / 2, bh, -bz), at(s - bl / 2, bh, -bz)];
    const B = { V: BV, F: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], L: Array(8).fill(''), C: at(s, bh / 2, 0) };
    const E2 = new Map(); B.F.forEach((f, fi) => f.forEach((vv, i) => { const w = f[(i + 1) % f.length], k = Math.min(vv, w) + ':' + Math.max(vv, w); if (!E2.has(k)) E2.set(k, { a: vv, b: w, f: [] }); E2.get(k).f.push(fi); })); B.E = [...E2.values()];
    v.line([x0 - 0.6, y0, 1.2], [x0 + Lx + 0.6, y0, 1.2], C.muted, 1, null, 0.5);
    drawPoly(W1); drawPoly(B);
    // угол α у основания
    const arcPts = Array.from({ length: 12 }, (_, i) => { const t2 = (a * i) / 11; return [x0 + 0.7 * Math.cos(t2), y0 + 0.7 * Math.sin(t2), dz]; });
    for (let i = 0; i < 11; i++) v.line(arcPts[i], arcPts[i + 1], C.amber, 1.4); v.text([x0 + 1.0 * Math.cos(a / 2), y0 + 1.0 * Math.sin(a / 2), dz], 'α', C.amber, 0, 0, 16);
    // силы из центра бруска
    const c = B.C, k = 1.25, mu = 0.2, slides = Math.tan(a) > mu;
    v.arrow(c, [c[0], c[1] - k, c[2]], C.peach, 'mg');
    v.arrow(c, [c[0] + n[0] * k * Math.cos(a), c[1] + n[1] * k * Math.cos(a), c[2]], C.blue, 'N');
    const fr = slides ? mu * Math.cos(a) * k : Math.sin(a) * k;
    v.arrow(c, [c[0] + u[0] * fr, c[1] + u[1] * fr, c[2]], C.amber, 'Fтр');
    return slides ? `α = ${Math.round(par)}°, μ = 0,2: a = g(sin α − μ cos α) ≈ ${fmt(g * (Math.sin(a) - mu * Math.cos(a)), 1)} м/с²`
      : `α = ${Math.round(par)}°: tg α ≤ μ = 0,2 — брусок покоится, Fтр = mg sin α`;
  }
  function drawSpring() {
    v.scale = 0.2; v.oy = 0;
    const kk = 40, m = par, w = Math.sqrt(kk / m), A = 0.35, top = 1.9, rest = -0.2, y = rest + A * Math.cos(w * t), r = 0.32, turns = 10;
    for (let i = 0; i <= 8; i++) { const x = -0.9 + i * 0.225; v.line([x, top, 0], [x + 0.16, top + 0.16, 0], C.muted, 1, null, 0.7); }
    v.line([-0.9, top, 0], [0.9, top, 0], C.text, 1.8);
    const N = 160, pts = Array.from({ length: N + 1 }, (_, i) => { const f = i / N, ang = f * turns * 2 * Math.PI; return [r * Math.cos(ang), top - 0.15 - f * (top - 0.15 - (y + 0.3)), r * Math.sin(ang)]; });
    v.line([0, top, 0], [0, top - 0.15, 0], C.text, 1.6);
    for (let i = 0; i < N; i++) { const front = v.rot(pts[i])[2] >= 0; v.line(pts[i], pts[i + 1], front ? C.blue : C.muted, front ? 1.7 : 1.1, null, front ? 1 : 0.45); }
    const s = 0.3, BV = [[-s, y - s, s], [s, y - s, s], [s, y + s, s], [-s, y + s, s], [-s, y - s, -s], [s, y - s, -s], [s, y + s, -s], [-s, y + s, -s]];
    const Bx = { V: BV, F: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], L: Array(8).fill(''), C: [0, y, 0] };
    const E = new Map(); Bx.F.forEach((f, fi) => f.forEach((vv, i) => { const ww = f[(i + 1) % f.length], k2 = Math.min(vv, ww) + ':' + Math.max(vv, ww); if (!E.has(k2)) E.set(k2, { a: vv, b: ww, f: [] }); E.get(k2).f.push(fi); })); Bx.E = [...E.values()];
    drawPoly(Bx); v.text([0.75, y, 0], 'm', C.text, 0, 0, 16);
    v.line([-1.1, rest, 0], [1.1, rest, 0], C.muted, 1, [4, 5], 0.7); v.text([1.35, rest, 0], 'O', C.muted, 0, 0, 13);
    v.text([0.75, top - 0.8, 0], 'k = 40 Н/м', C.muted, 18, 0, 13, false);
    return `m = ${fmt(m)} кг, k = 40 Н/м: T = 2π√(m/k) ≈ ${fmt((2 * Math.PI) / w)} с`;
  }
  function drawPendulum() {
    v.scale = 0.2; v.oy = -0.2;
    const l = par, Ld = 1.2 + l * 1.1, top = 1.7, A0 = 0.38, w = Math.sqrt(g / l), th2 = A0 * Math.cos(w * t), S = [0, top, 0];
    for (let i = 0; i <= 8; i++) { const x = -0.9 + i * 0.225; v.line([x, top, 0], [x + 0.16, top + 0.16, 0], C.muted, 1, null, 0.7); }
    v.line([-0.9, top, 0], [0.9, top, 0], C.text, 1.8); v.line(S, [0, top - Ld - 0.3, 0], C.muted, 1.1, [5, 6], 0.7);
    const arc = Array.from({ length: 30 }, (_, i) => { const q = -A0 + (2 * A0 * i) / 29; return [Ld * Math.sin(q), top - Ld * Math.cos(q), 0]; });
    for (let i = 0; i < 29; i++) v.line(arc[i], arc[i + 1], C.blue, 1.2, [3, 5], 0.6);
    const Bp = [Ld * Math.sin(th2), top - Ld * Math.cos(th2), 0];
    v.line(S, Bp, C.text, 1.7); v.text([Ld * Math.sin(th2) / 2, top - (Ld * Math.cos(th2)) / 2, 0], 'l', C.text, 12, 0, 16);
    const q = v.P(Bp), rr = Math.max(7, Math.min(12, W / 34)), gr = ctx.createRadialGradient(q[0] - rr * 0.35, q[1] - rr * 0.4, 1, q[0], q[1], rr);
    gr.addColorStop(0, C.text); gr.addColorStop(1, C.line); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 7); ctx.fill();
    v.dot(S, C.text, 3);
    return `l = ${fmt(l)} м: T = 2π√(l/g) ≈ ${fmt((2 * Math.PI) / w)} с (при малых углах)`;
  }
  function drawWire() {
    v.scale = 0.21; v.oy = 0;
    const I = par, h = 1.8;
    v.line([0, -h, 0], [0, h, 0], C.text, 4);
    v.arrow([0, 0.6, 0], [0, 1.25, 0], C.amber, 'I');
    for (const y of [-1, 0, 1]) for (const r of [0.65, 1.2]) {
      const pts = reg(64, r, y); loop(pts, C.blue, { w: 1.4 });
      for (const ph0 of [0.4, 2.5, 4.6]) { // стрелки поля: для тока вверх B идёт по часовой стрелке, если смотреть сверху
        const ph = ph0 + (still() ? 0 : -t * (0.25 + I / 40)), p = [r * Math.cos(ph), y, r * Math.sin(ph)], d = [Math.sin(ph), 0, -Math.cos(ph)];
        const front = v.rot(p)[2] >= 0;
        if (front) v.arrow(p, [p[0] + d[0] * 0.28, y, p[2] + d[2] * 0.28], C.blue);
      }
    }
    v.text([1.2, 1, 0], 'B', C.blue, 16, -8, 16);
    const B = (2e-7 * I) / 0.05 * 1e6;
    return `I = ${Math.round(I)} А: B = μ₀I / (2πr) = ${fmt(B, 1)} мкТл при r = 5 см; направление — по правилу буравчика`;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let txt;
    if (th) { drawSolid(); txt = th.cap; }
    else txt = { incline: drawIncline, spring: drawSpring, pendulum: drawPendulum, wire: drawWire }[key]();
    if (cap && txt !== capText) { capText = txt; cap.textContent = txt; }
  }
  function frame(now) {
    raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still()) { t += dt; if (!drag && !touched) yaw += (th ? 0.25 : 0.08) * dt; }
    draw();
    if (visible && !document.hidden && !still() && (th || ph.anim || !touched)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const setPar = (d) => { if (!ph) { pitch = Math.max(-0.3, Math.min(1.2, pitch + d * 0.03)); draw(); return; }
    const p = ph.param; par = Math.max(p.min, Math.min(p.max, Math.round((par + d * p.step) / p.step) * p.step)); draw(); };
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, acc: 0 }; touched = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    yaw += dx * 0.012; drag.acc += -dy; const st = ph ? 6 : 3; while (Math.abs(drag.acc) >= st) { setPar(Math.sign(drag.acc)); drag.acc -= Math.sign(drag.acc) * st; } draw(); });
  const up = () => { drag = null; kick(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', (e) => { const m = { ArrowLeft: () => { yaw -= 0.15; draw(); }, ArrowRight: () => { yaw += 0.15; draw(); }, ArrowUp: () => setPar(1), ArrowDown: () => setPar(-1) }[e.key];
    if (m) { e.preventDefault(); touched = true; m(); } });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  size(); draw(); kick();
  fig.__scene = { get par() { return par; }, get caption() { return capText; }, setPar, draw };
}
