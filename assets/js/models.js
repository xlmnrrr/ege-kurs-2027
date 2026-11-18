// 3D-модели на титульном листе предмета (18.11.2026): математика — «Сечение» (solid.js), физика — конический маятник,
// русский — раскрытая книга, страницы которой перелистываются по шагам курса. Всё в стиле «Чертежа», без библиотек.
// Вне экрана и в скрытой вкладке стоят; «уменьшить движение» — неподвижный кадр, управление остаётся.
import { mountSolid } from './solid.js';
import { mountScene3d } from './scene3d.js';

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors = () => { const c = getComputedStyle(document.documentElement); const g = (n) => c.getPropertyValue(n).trim();
  return { text: g('--text'), muted: g('--muted'), line: g('--line-strong'), amber: g('--primary'), blue: g('--blue'), peach: g('--peach'), bg: g('--bg') }; };

/** Смонтировать все модели внутри узла (страница или её копия в книге) */
export function mountModels(root) {
  const once = (fn) => (el) => { if (el.dataset.mounted) return; el.dataset.mounted = '1'; fn(el); }; // страница из книги уже смонтирована
  root.querySelectorAll('.solid').forEach(once(mountSolid));
  root.querySelectorAll('.pend').forEach(once(mountPendulum));
  root.querySelectorAll('.rbook').forEach(once(mountRuBook));
  root.querySelectorAll('.s3d').forEach(mountScene3d); // 3D-стенд (сам помечает смонтированное)
}

// ---------- физика: конический маятник ----------
export const pendulumHTML = () => `<figure class="pend sp-model-fig">
  <canvas tabindex="0" role="img" aria-label="Конический маятник: тяни вверх-вниз — угол, вбок — поворот; стрелки клавиатуры делают то же"></canvas>
  <figcaption><span class="sc">Конический маятник</span><span class="sp-hint">тяни вверх-вниз — угол, вбок — поворот</span></figcaption></figure>`;

function mountPendulum(fig) {
  const canvas = fig.querySelector('canvas'), cap = fig.querySelector('.sc'), ctx = canvas.getContext('2d');
  const C = colors(), g = 9.8, Lm = 1, Ld = 2.1, top = 1.25;
  let yaw = 0.5, pitch = 0.3, alpha = 30 * Math.PI / 180, phi = 0.6, W = 0, H = 0, dpr = 1, raf = 0, last = 0, visible = true, drag = null, capText = '';
  const size = () => { /* размер раскладки, а не на экране: в книге холст уменьшен transform-ом */ dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  const omega = () => Math.sqrt(g / (Lm * Math.cos(alpha)));

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rot = ([x, y, z]) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
    const D = 7, f = Math.min(W, H) * 0.25, oy = -0.15;
    const P = (v) => { const r = rot(v), k = D / (D - r[2]); return [W / 2 + r[0] * f * k, H / 2 - (r[1] + oy) * f * k, r[2]]; };
    const line = (a, b, col, w = 1.6, dash = null, al = 1) => { ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]); };
    const arrow = (a, b, col, label) => {
      line(a, b, col, 2.2);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hl = 9;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - hl * Math.cos(ang - 0.38), b[1] - hl * Math.sin(ang - 0.38)); ctx.lineTo(b[0] - hl * Math.cos(ang + 0.38), b[1] - hl * Math.sin(ang + 0.38)); ctx.closePath(); ctx.fill();
      ctx.font = `italic ${Math.round(Math.max(13, Math.min(17, W / 22)))}px KaTeX_Main, Literata, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, b[0] + 14 * Math.cos(ang) + 8 * Math.sin(ang), b[1] + 14 * Math.sin(ang) - 8 * Math.cos(ang));
    };
    const S = [0, top, 0], R = Ld * Math.sin(alpha), yc = top - Ld * Math.cos(alpha);
    const B = [R * Math.cos(phi), yc, R * Math.sin(phi)];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // подвес: балка со штриховкой
    const b1 = P([-0.7, top, 0]), b2 = P([0.7, top, 0]); line(b1, b2, C.text, 1.8);
    for (let i = 0; i <= 8; i++) { const x = -0.7 + i * 0.175, a = P([x, top, 0]), b = P([x + 0.12, top + 0.14, 0]); line(a, b, C.muted, 1, null, 0.7); }
    // ось вращения
    line(P(S), P([0, top - Ld - 0.35, 0]), C.muted, 1.2, [5, 6], 0.7);
    // траектория: дальняя половина штрихом, ближняя — сплошной
    const N = 72, cz = rot([0, yc, 0])[2];
    for (let i = 0; i < N; i++) {
      const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2;
      const v0 = [R * Math.cos(t0), yc, R * Math.sin(t0)], v1 = [R * Math.cos(t1), yc, R * Math.sin(t1)];
      const front = rot(v0)[2] > cz;
      line(P(v0), P(v1), C.blue, front ? 1.6 : 1.1, front ? null : [3, 5], front ? 0.85 : 0.45);
    }
    // радиус окружности
    line(P([0, yc, 0]), P(B), C.muted, 1, [4, 5], 0.8);
    // угол α у подвеса
    const ax = [0, -1, 0], sd = [(B[0]) / Ld, (B[1] - top) / Ld, (B[2]) / Ld];
    ctx.beginPath(); ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 16; i++) { const t = i / 16, v = [0, 1, 2].map((k) => ax[k] * (1 - t) + sd[k] * t), l = Math.hypot(...v), p = P([v[0] / l * 0.5, top + v[1] / l * 0.5, v[2] / l * 0.5]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
    { const v = [0, 1, 2].map((k) => (ax[k] + sd[k]) / 2), l = Math.hypot(...v), p = P([v[0] / l * 0.72, top + v[1] / l * 0.72, v[2] / l * 0.72]);
      ctx.fillStyle = C.amber; ctx.font = `italic ${Math.round(Math.max(13, Math.min(17, W / 22)))}px KaTeX_Main, Literata, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('α', p[0], p[1]); }
    // нить
    const pB = P(B); line(P(S), pB, C.text, 1.7);
    // силы у груза: mg вниз, натяжение вдоль нити, их сумма — к оси (центростремительное ускорение)
    const k = 0.75, Tm = k / Math.cos(alpha);
    arrow(pB, P([B[0], B[1] - k, B[2]]), C.peach, 'mg');
    arrow(pB, P([B[0] + (S[0] - B[0]) / Ld * Tm, B[1] + (S[1] - B[1]) / Ld * Tm, B[2] + (S[2] - B[2]) / Ld * Tm]), C.blue, 'T');
    const toAxis = [-Math.cos(phi), 0, -Math.sin(phi)], ma = k * Math.tan(alpha);
    arrow(pB, P([B[0] + toAxis[0] * ma, B[1], B[2] + toAxis[2] * ma]), C.amber, 'ma');
    // груз — шар
    const rr = Math.max(7, Math.min(12, W / 34)), gr = ctx.createRadialGradient(pB[0] - rr * 0.35, pB[1] - rr * 0.4, 1, pB[0], pB[1], rr);
    gr.addColorStop(0, C.text); gr.addColorStop(1, C.line);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pB[0], pB[1], rr, 0, 7); ctx.fill();
    ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(...P(S).slice(0, 2), 3, 0, 7); ctx.fill();
    // подпись: период по формуле
    const deg = Math.round(alpha * 180 / Math.PI), T = (2 * Math.PI / omega()).toFixed(2).replace('.', ',');
    const txt = `α = ${deg}°, период T = 2π√(l·cos α / g) ≈ ${T} с при l = 1 м`;
    if (cap && txt !== capText) { capText = txt; cap.textContent = txt; }
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still()) { phi += omega() * dt; if (!drag) yaw += 0.12 * dt; }
    draw();
    if (visible && !document.hidden && !still()) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const setAlpha = (d) => { alpha = Math.max(10, Math.min(60, alpha * 180 / Math.PI + d)) * Math.PI / 180; draw(); };
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    yaw += dx * 0.012; setAlpha(-dy * 0.35);
  });
  const up = () => { drag = null; kick(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', (e) => {
    const m = { ArrowUp: () => setAlpha(3), ArrowDown: () => setAlpha(-3), ArrowLeft: () => { yaw -= 0.15; draw(); }, ArrowRight: () => { yaw += 0.15; draw(); } }[e.key];
    if (m) { e.preventDefault(); m(); }
  });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  size(); draw(); kick();
}

// ---------- русский: раскрытая книга, страницы — шаги курса ----------
/** steps: [[номер, заголовок], …] */
export const ruBookHTML = (steps) => `<figure class="rbook sp-model-fig" data-steps='${JSON.stringify(steps).replace(/'/g, '&#39;')}'>
  <div class="rb-stage" role="img" aria-label="Раскрытая книга: страницы — шесть шагов курса">
    <div class="rb-half rb-l"><div class="rb-page"></div></div>
    <div class="rb-half rb-r"><div class="rb-page"></div></div>
    <div class="rb-leaf"><div class="rb-page rb-front"></div><div class="rb-page rb-back"></div></div>
  </div>
  <figcaption><span class="sc">Шесть шагов к зачёту</span></figcaption></figure>`;

function mountRuBook(fig) {
  let steps = []; try { steps = JSON.parse(fig.dataset.steps); } catch { return; }
  const L = fig.querySelector('.rb-l .rb-page'), R = fig.querySelector('.rb-r .rb-page'), leaf = fig.querySelector('.rb-leaf');
  const F = leaf.querySelector('.rb-front'), Bk = leaf.querySelector('.rb-back');
  const page = (i) => { const [n, t] = steps[i % steps.length]; return `<span class="rbn">Шаг ${n}</span><span class="rbt">${t}</span><i></i><i></i><i></i><i></i>`; };
  let j = 0, timer = 0, visible = true;
  const show = () => { L.innerHTML = page(j); R.innerHTML = page(j + 1); F.innerHTML = page(j + 1); Bk.innerHTML = page(j + 2); };
  show();
  if (still()) return;
  const flip = () => {
    if (!visible || document.hidden || !fig.isConnected) { timer = setTimeout(flip, 1500); return; }
    R.innerHTML = page(j + 3);
    leaf.classList.add('turning');
    setTimeout(() => {
      j = (j + 2) % steps.length;
      L.innerHTML = page(j);
      leaf.classList.add('reset'); leaf.classList.remove('turning');
      F.innerHTML = page(j + 1); Bk.innerHTML = page(j + 2);
      void leaf.offsetWidth; leaf.classList.remove('reset');
      timer = setTimeout(flip, 2600);
    }, 1150);
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(fig);
  timer = setTimeout(flip, 1600);
}
