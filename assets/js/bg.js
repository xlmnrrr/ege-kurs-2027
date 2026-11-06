// Живой фон «Лампа над тетрадью» (DESIGN.md, v3): тёмная тетрадь с чертежами и формулами ЕГЭ,
// которые проявляет тёплый свет лампы под курсором. Один WebGL2-холст за всей страницей.
// Механика из Эталона: сторож меряет кадр и только понижает качество (меньше пикселей и кадров → неподвижный кадр),
// в скрытой вкладке ничего не рисуется. Нет WebGL2, «уменьшить движение», экономия трафика или выбор «неподвижный» —
// та же тетрадь одной картинкой на 2D-холсте. На страницах чтения фон спокойный: приглушён и неподвижен.
const KEY = 'ege-bg';
export const bgMode = () => { try { return localStorage.getItem(KEY) || 'live'; } catch { return 'live'; } };

const TEX = [2048, 1280];

// ---------- тетрадь: чертежи и формулы рисуются кодом ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function paintNotebook(ctx, W, H, pal) {
  const R = rng(20270607);
  ctx.save();
  if (pal.grid) { // клетка тетради: видна только под лампой
    ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < W; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0.5; y < H; y += 24) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.globalAlpha = 0.45; ctx.stroke(); ctx.globalAlpha = 1;
  }
  const ink = pal.ink, dot = pal.dot;
  let c; // текущий контекст рисунка
  const L = (pts, dash) => { c.setLineDash(dash ? [6, 6] : []); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.setLineDash([]); };
  const fn = (f, x0, x1, sx, sy, step = 2) => { const p = []; for (let x = x0; x <= x1; x += step / sx) p.push([x * sx, -f(x) * sy]); L(p); };
  const arrow = (x0, y0, x1, y1, s = 9) => { L([[x0, y0], [x1, y1]]); const a = Math.atan2(y1 - y0, x1 - x0); L([[x1 - s * Math.cos(a - 0.4), y1 - s * Math.sin(a - 0.4)], [x1, y1], [x1 - s * Math.cos(a + 0.4), y1 - s * Math.sin(a + 0.4)]]); };
  const circ = (x, y, r, a0 = 0, a1 = Math.PI * 2, dash) => { c.setLineDash(dash ? [6, 6] : []); c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); c.setLineDash([]); };
  const ell = (x, y, rx, ry, a0 = 0, a1 = Math.PI * 2, dash) => { c.setLineDash(dash ? [6, 6] : []); c.beginPath(); c.ellipse(x, y, rx, ry, 0, a0, a1); c.stroke(); c.setLineDash([]); };
  const pt = (x, y) => { c.save(); c.fillStyle = dot; c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill(); c.restore(); };
  const t = (s, x, y, size = 20) => { c.font = `italic ${size}px Literata, Georgia, serif`; c.fillText(s, x, y); };
  const axes = (w, h) => { arrow(-w, 0, w, 0, 8); arrow(0, h, 0, -h, 8); };

  const SKETCH = [
    () => { axes(150, 80); fn(Math.sin, -4.6, 4.6, 30, 55); c.globalAlpha = 0.6; fn(Math.cos, -4.6, 4.6, 30, 55); c.globalAlpha = 1; t('y = sin x', 40, -70, 18); pt(Math.PI * 30, 0); t('π', Math.PI * 30 - 5, 24, 17); },
    () => { axes(130, 110); fn((x) => (x * x - 2 * x - 3) / 2.2, -1.9, 3.9, 30, 30); pt(-30, 0); pt(90, 0); pt(30, 4 / 2.2 * 30); t('y = x² − 2x − 3', 34, -90, 18); },
    () => { axes(120, 110); circ(0, 0, 90); const a = 0.85; L([[0, 0], [90 * Math.cos(a), -90 * Math.sin(a)]]); L([[90 * Math.cos(a), -90 * Math.sin(a)], [90 * Math.cos(a), 0]], true); L([[90 * Math.cos(a), -90 * Math.sin(a)], [0, -90 * Math.sin(a)]], true); circ(0, 0, 22, -a, 0); t('α', 26, -8, 17); pt(90 * Math.cos(a), -90 * Math.sin(a)); t('cos α', 40, 22, 15); t('sin α', -64, -66, 15); },
    () => { const A = [-120, 60], B = [120, 60], C = [-40, -80]; L([A, B, C, A]); const H = [-40, 60]; L([C, H], true); L([[-40, 48], [-28, 48], [-28, 60]]); [A, B, C].forEach((p) => pt(...p)); t('A', -142, 80); t('B', 126, 80); t('C', -48, -92); t('h', -34, 0, 18); t('a² + b² = c²', -10, 110, 19); },
    () => { circ(0, 0, 95); const P = [[95 * Math.cos(2.6), 95 * Math.sin(2.6)], [95 * Math.cos(0.5), 95 * Math.sin(0.5)], [95 * Math.cos(-1.9), 95 * Math.sin(-1.9)]]; L([...P, P[0]]); P.forEach((p) => pt(...p)); pt(0, 0); L([[0, 0], P[1]], true); t('R', 30, 24, 17); t('a / sin A = 2R', -70, 130, 18); },
    () => { const s = 70, dx = 38, dy = -30; const A = [-s, s], B = [s, s], C = [s + dx, s + dy], D = [-s + dx, s + dy]; const up = (p) => [p[0], p[1] - 2 * s];
      L([A, B, C]); L([C, D, A], true); L([D, up(D)], true); L([A, up(A), up(B), B]); L([C, up(C)]); L([up(A), up(D), up(C), up(B)]); L([up(D), B], false); t('ABCDA₁B₁C₁D₁', -70, s + 34, 15); },
    () => { ell(0, 70, 80, 22); ell(0, 70, 80, 22, Math.PI, Math.PI * 2, true); L([[-80, 70], [0, -90], [80, 70]]); L([[0, -90], [0, 70]], true); L([[0, 70], [80, 70]], true); t('h', 6, -6, 17); t('r', 36, 92, 17); t('V = ⅓πr²h', 60, -60, 18); },
    () => { axes(120, 110); fn((x) => Math.exp(x), -3.6, 1.45, 30, 22); fn((x) => Math.log(x), 0.05, 3.9, 30, 22); c.globalAlpha = 0.5; L([[-100, 100], [100, -100]], true); c.globalAlpha = 1; t('y = eˣ', -84, -70, 17); t('y = ln x', 54, 14, 17); },
    () => { arrow(-100, 60, 40, 60); arrow(-100, 60, -40, -40); L([[40, 60], [100, -40]], true); L([[-40, -40], [100, -40]], true); arrow(-100, 60, 100, -40); t('a⃗', -40, 84, 18); t('b⃗', -96, -4, 18); t('a⃗ + b⃗', 4, 0, 18); },
    () => { L([[-140, 70], [150, 70]]); const v = 16, a = 0.95; const p = []; for (let s = 0; s <= 2.5; s += 0.05) p.push([-130 + v * Math.cos(a) * s * 7, 70 - (v * Math.sin(a) * s - 4.9 * s * s) * 7]); L(p); arrow(-130, 70, -130 + 48 * Math.cos(a), 70 - 48 * Math.sin(a)); pt(-130 + v * Math.cos(a) * 1.65 * 7, 70 - (v * Math.sin(a) * 1.65 - 4.9 * 1.65 * 1.65) * 7); t('v₀', -112, 6, 17); t('y = v₀t sin α − gt²/2', -80, 104, 16); },
    () => { L([[-140, 70], [140, 70], [140, -60], [-140, 70]]); c.save(); c.translate(30, 0); c.rotate(-Math.atan2(130, 280)); L([[-30, -2], [30, -2], [30, -40], [-30, -40], [-30, -2]]); arrow(0, -20, 0, -90); arrow(-30, -20, -95, -20); c.restore(); arrow(30, -14, 30, 70); t('mg', 38, 52, 17); t('N', 6, -96, 17); t('F тр', -84, -48, 16); t('α', -86, 62, 17); },
    () => { L([[-160, 0], [160, 0]], true); ell(0, 0, 10, 90); pt(-70, 0); pt(70, 0); t('F', -76, 22, 17); t('F', 64, 22, 17); arrow(-140, 0, -140, -40); L([[-140, -40], [0, -40], [140, 60]]); L([[-140, -40], [0, 0], [120, 34]]); t('1/d + 1/f = 1/F', -60, 120, 17); },
    () => { pt(-80, 0); pt(80, 0); t('+q', -100, -14, 17); t('−q', 72, -14, 17); for (const k of [-1, -0.55, 0, 0.55, 1]) { const p = []; for (let s = 0; s <= 1; s += 0.04) p.push([-80 + 160 * s, -k * 120 * Math.sin(Math.PI * s)]); L(p); } t('F = k q₁q₂ / r²', -70, 120, 17); },
    () => { axes(120, 110); L([[-60, -70], [60, -70]]); L([[60, -70], [60, 50]]); L([[60, 50], [-60, 50]]); L([[-60, 50], [-60, -70]]); arrow(-10, -70, 10, -70, 8); arrow(60, -20, 60, 0, 8); arrow(10, 50, -10, 50, 8); arrow(-60, 0, -60, -20, 8); t('p', -16, -100, 17); t('V', 104, 24, 17); t('pV = νRT', 10, -90, 18); },
    () => { L([[-110, -60], [-30, -60]]); L([[-14, -60], [110, -60], [110, 60], [-110, 60], [-110, -60]]); L([[-30, -80], [-30, -40]]); L([[-14, -70], [-14, -50]]); c.save(); c.fillStyle = 'transparent'; c.strokeRect(-40, 48, 80, 24); c.restore(); L([[60, -20], [60, 20]]); circ(60, 0, 22); t('V', 52, 7, 17); t('I = U / R', -40, 108, 18); },
    () => { L([[-150, 0], [150, 0]], true); fn((x) => Math.sin(x), -5, 5, 30, 50); arrow(-150 + 0, -70, -150 + 2 * Math.PI * 30, -70, 7); arrow(-150 + 2 * Math.PI * 30, -70, -150, -70, 7); t('λ', -150 + Math.PI * 30 - 6, -80, 18); t('v = λν', 40, 92, 18); },
    () => { L([[-90, -100], [90, -100]]); const a = 0.45, l = 150; L([[0, -100], [l * Math.sin(a), -100 + l * Math.cos(a)]]); L([[0, -100], [0, 60]], true); circ(l * Math.sin(a), -100 + l * Math.cos(a), 14); circ(0, -100, 40, Math.PI / 2 - a, Math.PI / 2); t('T = 2π√(l/g)', -40, 96, 18); },
  ];
  const FORM = ['sin²α + cos²α = 1', 'x = (−b ± √D) / 2a', 'S = ½ ab sin γ', '(xⁿ)′ = n xⁿ⁻¹', 'log_a b = ln b / ln a', 'F = ma', 'Q = cmΔt', 'E = hν', 'v = v₀ + at', 'Eк = mv²/2', 'aₙ = a₁ + d(n − 1)',
    'Φ = BS cos α', 'n₁ sin α = n₂ sin β', 'P(A) = m / n', 'tg α = sin α / cos α', 'ε = −ΔΦ/Δt', 'p = mv', 'S = πr²', 'cos 2α = 1 − 2sin²α', 'A = Fs cos α', 'q = CU', 'Sбок = 2πrh'];
  ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const cols = 5, rows = 4, cw = W / cols, rh = H / rows;
  const order = SKETCH.map((_, i) => i).sort(() => R() - 0.5);
  let k = 0, f = 0;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    c = ctx; ctx.save();
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    const cx = (q + 0.5) * cw + (R() - 0.5) * cw * 0.25, cy = (r + 0.5) * rh + (R() - 0.5) * rh * 0.2;
    ctx.translate(cx, cy); ctx.rotate((R() - 0.5) * 0.16);
    if ((r + q) % 4 !== 3 && k < order.length) { ctx.scale(0.9, 0.9); SKETCH[order[k++]](); }
    else { t(FORM[f++ % FORM.length], -110, 0, 26); t(FORM[f++ % FORM.length], -80, 50, 21); }
    ctx.restore();
    // формула-спутник в углу ячейки
    ctx.save(); ctx.fillStyle = ink; ctx.globalAlpha = 0.75;
    ctx.translate(q * cw + 16 + R() * 40, r * rh + 30 + R() * 20); ctx.rotate((R() - 0.5) * 0.1);
    c = ctx; if (R() < 0.55) t(FORM[f++ % FORM.length], 0, 0, 17);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- шейдер ----------
const VERT = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uView, uTexSize, uLight;
uniform float uScale, uR, uPower, uCalm, uScroll, uT;
out vec4 color;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float dust(vec2 p, float cell, float t, float seed) {
  p += vec2(sin(t * 0.07 + seed) * 24.0, -t * (7.0 + seed * 3.0));
  vec2 id = floor(p / cell);
  vec2 f = p - id * cell;
  vec2 r = h22(id + seed * 17.0);
  vec2 c = (0.2 + 0.6 * r) * cell + vec2(sin(t * 0.6 + r.x * 6.28), cos(t * 0.5 + r.y * 6.28)) * cell * 0.08;
  float s = 0.7 + 1.3 * h21(id + seed * 3.1);
  float tw = 0.55 + 0.45 * sin(t * (0.8 + r.x) + r.y * 6.28);
  return smoothstep(s + 1.2, 0.0, length(f - c)) * step(0.5, h21(id * 1.7 + seed)) * tw;
}
void main() {
  vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 q = css / uView;
  vec2 look = (uLight - uView * 0.5) / max(uView.x, uView.y);
  vec3 amber = vec3(0.913, 0.690, 0.384);
  vec3 col = vec3(0.110, 0.133, 0.180) * (1.0 + 0.08 * (1.0 - q.y));
  vec2 g1 = (q - vec2(0.08, -0.12)) * vec2(1.0, 1.7);
  col += amber * 0.05 * exp(-dot(g1, g1) * 3.2);
  vec2 g2 = q - vec2(1.05, -0.05);
  col += vec3(0.557, 0.706, 0.918) * 0.03 * exp(-dot(g2, g2) * 4.0);
  float d = length(css - uLight);
  float pool = exp(-(d * d) / (uR * uR));
  float halo = exp(-d / (uR * 1.7));
  float flick = 0.975 + 0.025 * sin(uT * 1.7) * sin(uT * 2.9 + 1.3);
  float lit = pool * uPower * flick;
  col += amber * (pool * 0.8 + halo * 0.3) * uPower * flick * 0.075;
  vec2 tuv = (css - look * vec2(40.0, 26.0) + vec2(0.0, uScroll * 0.16)) / uTexSize;
  vec3 tx = texture(uTex, tuv).rgb;
  float calm = 1.0 - 0.55 * uCalm;
  col += vec3(0.58, 0.66, 0.82) * tx.r * 0.05 * calm;
  col += vec3(1.0, 0.80, 0.50) * tx.r * lit * 0.40 * calm;
  col += amber * tx.g * lit * 0.09 * calm;
  col += vec3(1.0, 0.80, 0.50) * tx.b * (lit * 0.7 + 0.05) * 0.5 * calm;
  if (uCalm < 0.99) {
    vec2 dp = css - look * vec2(80.0, 52.0) + vec2(0.0, uScroll * 0.32);
    float m = dust(dp, 90.0, uT, 0.0) + 0.7 * dust(dp + 311.0, 130.0, uT * 0.8, 1.0) + 0.5 * dust(dp + 97.0, 64.0, uT * 1.2, 2.0);
    col += vec3(1.0, 0.86, 0.62) * m * (lit * 0.6 + halo * uPower * 0.1) * (1.0 - uCalm);
  }
  vec2 v = q - 0.5;
  col *= 1.0 - 0.3 * dot(v, v);
  col += (h21(gl_FragCoord.xy + fract(uT * 7.0) * 91.0) - 0.5) * 1.6 / 255.0;
  color = vec4(col, 1.0);
}`;

const TIERS = [{ scale: 1, fps: 60, idle: 30 }, { scale: 0.75, fps: 40, idle: 24 }, { scale: 0.55, fps: 30, idle: 20 }, { scale: 0.42, fps: 24, idle: 15 }];

function allowedLive() {
  const c = navigator.connection;
  return !(matchMedia('(prefers-reduced-motion: reduce)').matches || c?.saveData || /(^|-)2g/.test(c?.effectiveType || ''));
}

let api = null;
/** Запуск фона. Повторный вызов — сменить режим (live | still | off). */
export async function startBg(mode = bgMode()) {
  api?.stop();
  api = null;
  document.getElementById('bg')?.remove();
  if (mode === 'off') return;
  try { await document.fonts.ready; } catch { /* шрифт не обязателен */ }
  const canvas = document.createElement('canvas');
  canvas.id = 'bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  if (mode === 'live' && allowedLive()) api = live(canvas);
  if (!api) api = still(canvas);
}

// ---------- неподвижная тетрадь: 2D, одной картинкой ----------
function still(canvas) {
  const ctx = canvas.getContext('2d');
  let tm = 0;
  const draw = () => {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.12, h * 0.05, 0, w * 0.12, h * 0.05, Math.max(w, h) * 0.55);
    g.addColorStop(0, 'rgba(233,176,98,0.10)'); g.addColorStop(1, 'rgba(233,176,98,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(-(TEX[0] - w) / 2, 0);
    paintNotebook(ctx, TEX[0], Math.max(TEX[1], h), { ink: 'rgba(170,186,220,0.075)', dot: 'rgba(233,176,98,0.16)', grid: null });
    ctx.restore();
    canvas.classList.add('on');
  };
  const onResize = () => { clearTimeout(tm); tm = setTimeout(draw, 200); };
  draw();
  addEventListener('resize', onResize);
  return { stop() { removeEventListener('resize', onResize); } };
}

// ---------- живая тетрадь: WebGL2 ----------
function live(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('фон:', gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uTex', 'uRes', 'uView', 'uTexSize', 'uLight', 'uScale', 'uR', 'uPower', 'uCalm', 'uScroll', 'uT']) U[n] = gl.getUniformLocation(prog, n);

  // текстура тетради: R — чертежи и формулы, G — клетка, B — точки-узлы
  const nb = document.createElement('canvas'); nb.width = TEX[0]; nb.height = TEX[1];
  const nctx = nb.getContext('2d');
  nctx.fillStyle = '#000'; nctx.fillRect(0, 0, TEX[0], TEX[1]);
  nctx.globalCompositeOperation = 'lighter';
  paintNotebook(nctx, TEX[0], TEX[1], { ink: '#ff0000', dot: '#0000ff', grid: '#00ff00' });
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nb);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.uniform1i(U.uTex, 0);
  gl.uniform2f(U.uTexSize, TEX[0], TEX[1]);

  const touch = matchMedia('(hover: none)').matches;
  const S = { x: innerWidth * 0.14, y: innerHeight * 0.08, gx: innerWidth * 0.14, gy: innerHeight * 0.08, p: 0.5, gp: 0.5, calm: 0, gcalm: document.documentElement.dataset.view === 'read' ? 1 : 0, scroll: scrollY, inside: false, touchUntil: 0 };
  S.calm = S.gcalm;
  let tier = touch ? 1 : 0, scale = 1, raf = 0, last = 0, clock = 0, frames = 0, spent = 0, probes = 0, dead = false, shown = false, dirty = true;
  const pixel = new Uint8Array(4);

  const fit = () => {
    const t = TIERS[tier];
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    let w = innerWidth * dpr * t.scale, h = innerHeight * dpr * t.scale;
    const k = Math.min(1, Math.sqrt(2.6e6 / (w * h)));
    w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
    scale = w / innerWidth;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    dirty = true;
  };
  const rest = () => { S.gx = innerWidth * 0.14; S.gy = innerHeight * 0.06; };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = TIERS[tier];
    const dt = Math.min(0.1, (now - last) / 1000);
    const read = S.gcalm > 0.5;
    // цели лампы
    if (read) { S.gx = innerWidth * 0.86; S.gy = innerHeight * 0.1; S.gp = 0.55; }
    else if (touch && now > S.touchUntil) { const w = clock; S.gx = innerWidth * (0.5 + 0.34 * Math.sin(w * 0.13)); S.gy = innerHeight * (0.36 + 0.24 * Math.sin(w * 0.087 + 1.1)); S.gp = 0.85; }
    else if (!touch) S.gp = S.inside ? 1 : 0.6;
    const moving = Math.abs(S.gx - S.x) + Math.abs(S.gy - S.y) > 0.4 || Math.abs(S.gp - S.p) > 0.003 || Math.abs(S.gcalm - S.calm) > 0.003 || Math.abs(scrollY - S.scroll) > 0.5;
    // спокойный режим: рисуем, только пока что-то меняется; живой — пылинки плывут на «тихой» частоте
    const fps = moving ? t.fps : read ? 0 : t.idle;
    if (!fps && !dirty) { last = now; return; }
    if (fps && now - last < 1000 / fps - 3) return;
    last = now;
    clock += dt;
    const k = 1 - Math.exp(-dt * (touch ? 1.2 : 4.5));
    S.x += (S.gx - S.x) * k; S.y += (S.gy - S.y) * k;
    S.p += (S.gp - S.p) * (1 - Math.exp(-dt * 2));
    S.calm += (S.gcalm - S.calm) * (1 - Math.exp(-dt * 3));
    S.scroll = scrollY;
    const probe = ++frames % 40 === 0;
    const t0 = probe ? performance.now() : 0;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform2f(U.uView, innerWidth, innerHeight);
    gl.uniform1f(U.uScale, scale);
    gl.uniform2f(U.uLight, S.x, S.y);
    gl.uniform1f(U.uR, Math.max(200, Math.min(460, Math.min(innerWidth, innerHeight) * 0.36)) * (1 - 0.3 * S.calm));
    gl.uniform1f(U.uPower, S.p);
    gl.uniform1f(U.uCalm, S.calm);
    gl.uniform1f(U.uScroll, S.scroll);
    gl.uniform1f(U.uT, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    dirty = false;
    if (!shown && frames > 2) { shown = true; canvas.classList.add('on'); }
    if (!probe) return;
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); // ждём видеокарту: честная цена кадра
    const ms = performance.now() - t0;
    spent += ms; probes++;
    if (probes < 3) return;
    const cost = spent / probes; spent = 0; probes = 0;
    canvas.dataset.cost = cost.toFixed(2);
    if (cost <= (1000 / t.fps) * 0.4) return; // фон — не главное: не больше 40 % бюджета кадра
    if (tier + 1 < TIERS.length) { tier++; canvas.dataset.tier = tier; fit(); }
    else { dead = true; canvas.dataset.tier = 'still'; cancelAnimationFrame(raf); raf = 0; } // последний кадр остаётся картинкой
  }
  const sync = () => {
    const run = !document.hidden && !dead;
    if (run && !raf) { last = performance.now() - 16; raf = requestAnimationFrame(frame); }
    else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  const onMove = (e) => {
    if (e.pointerType === 'touch') { if (e.type === 'pointerdown' && !e.target.closest('.bd-wrap, canvas, input, textarea')) { S.gx = e.clientX; S.gy = e.clientY; S.touchUntil = performance.now() + 4500; } return; }
    if (S.gcalm > 0.5) return;
    S.inside = true; S.gx = e.clientX; S.gy = e.clientY;
  };
  const onLeave = () => { S.inside = false; if (!touch) rest(); };
  const onView = () => { S.gcalm = document.documentElement.dataset.view === 'read' ? 1 : 0; dirty = true; if (!S.gcalm && !touch && !S.inside) rest(); };
  const onResize = () => { fit(); if (dead) { dead = false; tier = TIERS.length - 1; sync(); } };
  fit(); sync();
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', sync);
  addEventListener('ege-view', onView);
  addEventListener('resize', onResize);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; dead = true; startBg('still'); });
  return {
    stop() {
      cancelAnimationFrame(raf); raf = 0; dead = true;
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', sync); removeEventListener('ege-view', onView); removeEventListener('resize', onResize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
