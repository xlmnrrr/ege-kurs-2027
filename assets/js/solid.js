// 3D «Сечение» (DESIGN.md, v3): правильный многогранник медленно вращается, сквозь него идёт плоскость.
// Чертёж по правилам учебника: видимые рёбра сплошные, невидимые — штрихом, сечение — янтарная заливка.
// Canvas 2D, без библиотек. Тянуть — вращать, нажать — следующее тело. Вне экрана и в скрытой вкладке стоит.
const r3 = Math.sqrt(3);
const BODIES = [
  { name: 'куба', short: 'Куб', V: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    F: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], L: ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'], n: [1, -1, -1],
    note: 'плоскость ⟂ диагонали' },
  { name: 'тетраэдра', short: 'Тетраэдр', V: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    F: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]], L: ['D', 'A', 'B', 'C'], n: [1, 0, 0], note: 'в середине — квадрат' },
  { name: 'октаэдра', short: 'Октаэдр', V: [[1.65, 0, 0], [-1.65, 0, 0], [0, 1.65, 0], [0, -1.65, 0], [0, 0, 1.65], [0, 0, -1.65]],
    F: [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]], L: ['A', 'C', 'S', 'S₁', 'B', 'D'], n: [1, 1, 1], note: 'плоскость ∥ грани' },
];
for (const b of BODIES) {
  const len = Math.hypot(...b.n); b.n = b.n.map((x) => x / len);
  b.E = []; const seen = new Map();
  b.F.forEach((f, fi) => f.forEach((v, i) => { const w = f[(i + 1) % f.length], key = Math.min(v, w) + ':' + Math.max(v, w); if (!seen.has(key)) { seen.set(key, b.E.length); b.E.push({ a: v, b: w, f: [] }); } b.E[seen.get(key)].f.push(fi); }));
  b.C = b.F.map((f) => [0, 1, 2].map((k) => f.reduce((s, v) => s + b.V[v][k], 0) / f.length));
  b.range = Math.max(...b.V.map((v) => v[0] * b.n[0] + v[1] * b.n[1] + v[2] * b.n[2])) * 0.9;
  const e0 = b.E[0]; b.edge = Math.hypot(...[0, 1, 2].map((k) => b.V[e0.a][k] - b.V[e0.b][k]));
}
const NAMES = { 3: 'треугольник', 4: 'четырёхугольник', 5: 'пятиугольник', 6: 'шестиугольник' };

export function mountSolid(fig) {
  const canvas = fig.querySelector('canvas'), cap = fig.querySelector('figcaption .sc'), btn = fig.querySelector('[data-next-body]');
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const C = { text: css.getPropertyValue('--text').trim() || '#ECE4D8', muted: css.getPropertyValue('--muted').trim() || '#ABA497', amber: css.getPropertyValue('--primary').trim() || '#E9B062', blue: css.getPropertyValue('--blue').trim() || '#8EB4EA' };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bi = 0, yaw = 0.6, pitch = 0.42, vy = 0, sweep = still ? 0 : -1.2, raf = 0, last = 0, visible = true, drag = null, capText = '', capAt = 0, fade = 1, W = 0, H = 0, dpr = 1;

  const size = () => { const r = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };

  function draw() {
    const b = BODIES[bi];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rot = ([x, y, z]) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
    const D = 8, f = Math.min(W, H) * 0.245 * (0.85 + 0.15 * fade);
    const proj = ([x, y, z]) => { const k = D / (D - z); return [W / 2 + x * f * k, H / 2 - y * f * k]; };
    const RV = b.V.map(rot), P = RV.map(proj);
    const faceVis = b.C.map((c) => { const rc = rot(c), len = Math.hypot(...rc); return (rc[0] * -rc[0] + rc[1] * -rc[1] + (D - rc[2]) * rc[2]) / len > 0; });
    // сечение
    const s = Math.sin(sweep) * b.range;
    const pts = [];
    b.E.forEach((e) => {
      const A = b.V[e.a], B = b.V[e.b];
      const da = A[0] * b.n[0] + A[1] * b.n[1] + A[2] * b.n[2] - s, db = B[0] * b.n[0] + B[1] * b.n[1] + B[2] * b.n[2] - s;
      if (da * db < 0) { const t = da / (da - db); pts.push({ p: [0, 1, 2].map((k) => A[k] + (B[k] - A[k]) * t), f: e.f }); }
    });
    let area = 0, poly = [];
    if (pts.length >= 3) {
      const c = [0, 1, 2].map((k) => pts.reduce((a, q) => a + q.p[k], 0) / pts.length);
      const u = (() => { const d = pts[0].p.map((x, k) => x - c[k]); const l = Math.hypot(...d); return d.map((x) => x / l); })();
      const n = b.n, v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      poly = pts.map((q) => { const d = q.p.map((x, k) => x - c[k]); return { ...q, a: Math.atan2(d[0] * v[0] + d[1] * v[1] + d[2] * v[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2]), x: d[0] * u[0] + d[1] * u[1] + d[2] * u[2], y: d[0] * v[0] + d[1] * v[1] + d[2] * v[2] }; }).sort((a, q) => a.a - q.a);
      for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p.x * q.y - q.x * p.y; }
      area = Math.abs(area) / 2;
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // невидимые рёбра — штрихом, под всем
    b.E.forEach((e) => { const vis = e.f.some((fi) => faceVis[fi]); if (vis) return; ctx.setLineDash([5, 6]); ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(...P[e.a]); ctx.lineTo(...P[e.b]); ctx.stroke(); });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (poly.length >= 3) {
      const PP = poly.map((q) => proj(rot(q.p)));
      ctx.beginPath(); PP.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath();
      ctx.fillStyle = C.amber; ctx.globalAlpha = 0.2; ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const face = p.f.find((x) => q.f.includes(x));
        const vis = face === undefined || faceVis[face];
        ctx.setLineDash(vis ? [] : [4, 5]); ctx.strokeStyle = C.amber; ctx.globalAlpha = vis ? 1 : 0.6; ctx.lineWidth = vis ? 2.2 : 1.5;
        ctx.beginPath(); ctx.moveTo(...PP[i]); ctx.lineTo(...PP[(i + 1) % PP.length]); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = C.amber;
      PP.forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, 7); ctx.fill(); });
    }
    // видимые рёбра поверх
    ctx.strokeStyle = C.text; ctx.lineWidth = 1.7;
    b.E.forEach((e) => { if (!e.f.some((fi) => faceVis[fi])) return; ctx.beginPath(); ctx.moveTo(...P[e.a]); ctx.lineTo(...P[e.b]); ctx.stroke(); });
    // вершины и буквы
    const ctr = proj(rot([0, 0, 0]));
    ctx.font = `italic ${Math.round(Math.max(12, Math.min(16, W / 20)))}px Literata, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    P.forEach((p, i) => {
      ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, 7); ctx.fill();
      const dx = p[0] - ctr[0], dy = p[1] - ctr[1], l = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = C.muted; ctx.globalAlpha = RV[i][2] < -0.3 ? 0.55 : 0.95; ctx.fillText(b.L[i], p[0] + (dx / l) * 14, p[1] + (dy / l) * 13); ctx.globalAlpha = 1;
    });
    // подпись — не чаще 6 раз в секунду
    const now = performance.now();
    if (cap && now - capAt > 160) {
      capAt = now;
      const txt = poly.length >= 3 ? `Сечение ${b.name}: ${NAMES[poly.length] || poly.length + '-угольник'}, S ≈ ${(area / (b.edge * b.edge)).toFixed(2).replace('.', ',')}·a²` : `${b.short}: ${b.note}`;
      if (txt !== capText) { capText = txt; cap.textContent = txt; }
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) { if (!still) yaw += (0.22 + vy) * dt; vy *= Math.exp(-dt * 2.5); }
    if (!still) sweep += dt * 0.42;
    if (fade < 1) fade = Math.min(1, fade + dt * 3.5);
    draw();
    if (visible && !document.hidden && (!still || drag || Math.abs(vy) > 0.002 || fade < 1)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const next = () => { bi = (bi + 1) % BODIES.length; fade = 0.55; if (still) sweep = 0; capAt = 0; kick(); };

  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() }; canvas.setPointerCapture(e.pointerId); kick(); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    yaw += dx * 0.012; pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.008)); vy = dx * 0.08;
  });
  const up = () => { if (drag && drag.moved < 6 && performance.now() - drag.t < 450) next(); drag = null; kick(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { drag = null; });
  btn?.addEventListener('click', next);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  size(); draw(); kick();
}

/** Разметка фигуры: холст + подпись + кнопка «другое тело» */
export const solidHTML = (cls = '') => `<figure class="solid ${cls}"><canvas role="img" aria-label="Многогранник с сечением: тяни — вращать, нажми — другое тело"></canvas>
  <figcaption><span class="sc">Сечение куба</span><button type="button" class="sc-next" data-next-body aria-label="Другой многогранник">↻</button></figcaption></figure>`;
