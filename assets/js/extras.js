// Звуки (синтез WebAudio, без файлов), озвучка (speechSynthesis, русский голос устройства), главная «Две орбиты».
import { Chertezh } from './chertezh.js';

// ---------- звуки: тихие, выключаются одной кнопкой (хранится на устройстве) ----------
let ctx = null;
const read = () => { try { return localStorage.getItem('ege-sound') !== 'off'; } catch { return true; } };
export const sound = {
  on: read(),
  set(v) { this.on = v; try { localStorage.setItem('ege-sound', v ? 'on' : 'off'); } catch {} },
  toggle() { this.set(!this.on); },
  play(kind) {
    if (!this.on || matchMedia('(prefers-reduced-motion: reduce)').matches && kind === 'level') return;
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const notes = { ok: [[660, 0], [880, 0.09]], bad: [[220, 0]], level: [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.32]], streak: [[784, 0], [988, 0.1]] }[kind] || [];
      const t0 = ctx.currentTime + 0.01;
      for (const [f, dt] of notes) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(kind === 'bad' ? 0.05 : 0.07, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.32);
        o.connect(g).connect(ctx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.35);
      }
    } catch { /* звук не обязателен */ }
  },
};

// ---------- озвучка: голос браузера/iPhone, бесплатно и офлайн ----------
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => /^ru/i.test(v.lang));
  voice = vs.find((v) => /milena|милена|irina|google русский|svetlana/i.test(v.name)) || vs.find((v) => v.localService) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
export function speak(text, onEnd) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const parts = text.match(/[^.!?…]+[.!?…]*/g) || [text]; // по предложениям — iOS обрывает длинные фразы
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p.trim());
    u.lang = 'ru-RU'; if (voice) u.voice = voice; u.rate = 0.95;
    if (i === parts.length - 1 && onEnd) u.onend = onEnd;
    speechSynthesis.speak(u);
  });
}
export const stopSpeak = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); };

// ---------- «Две орбиты»: 3D-карта номеров (DESIGN.md) ----------
export function orbits(svg, catalog, statusOf, onPick) {
  const ch = new Chertezh(svg, { mode: '3d', width: 520, height: 440, scale: 52, center: [0, 0, 0.2], notebook: { yaw: Math.PI + 0.3, pitch: 0.33 } });
  // две горизонтальные орбиты на общей оси (ось = время до экзамена): математика сверху, физика снизу — проекции не пересекаются
  const ring = (subject, R, z, phase) => {
    const nums = catalog.filter((n) => n.subject === subject);
    const pt = (a) => [R * Math.cos(a), R * Math.sin(a), z];
    const curve = []; for (let i = 0; i <= 120; i++) curve.push(pt((i / 120) * 2 * Math.PI));
    ch.curve(curve, { cls: subject === 'математика' ? 'orbit-m' : 'orbit-f' });
    nums.forEach((n, i) => {
      const a = phase + (i / nums.length) * 2 * Math.PI, p = pt(a);
      const it = ch.point(p, String(n.num), { r: n.part === 2 ? 7 : 5.5, cls: `node node-${statusOf(n)}${n.hasContent ? '' : ' node-soon'}`, off: 12 });
      it.nodeRef = n;
    });
    ch.text([-R - 0.2, -R * 0.55, z], subject === 'математика' ? 'математика' : 'физика', { cls: 'orbit-name', dx: 0, dy: subject === 'математика' ? -26 : 30 });
  };
  ring('математика', 3.0, 2.0, Math.PI / 2);
  ring('физика', 4.2, -1.5, Math.PI / 2);
  ch.seg([0, 0, -2.6], [0, 0, 3.0], { cls: 'thin construct', hidden3d: false });
  ch.point([0, 0, 0.1], null, { r: 7, cls: 'node-core' });
  ch.render();
  // медленное вращение, пока человек не трогает; пауза вне экрана и при reduced motion
  let auto = !matchMedia('(prefers-reduced-motion: reduce)').matches, visible = true, raf = 0;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(svg);
  const tick = () => { if (!svg.isConnected) { io.disconnect(); return; } if (auto && visible && document.visibilityState === 'visible') { ch.yaw += 0.0025; ch.render(); svg.classList.add('ch-instant'); } raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  svg.addEventListener('pointerdown', () => { auto = false; });
  // выбор номера: ближайший узел к точке касания (≤ 22 px)
  let down = null;
  svg.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  svg.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = svg.getBoundingClientRect(), k = ch.W / r.width, x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    let best = null, bd = 22 * k;
    for (const it of ch.items) { if (!it.nodeRef) continue; const p = ch.P(it.data.p); const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = it.nodeRef; } }
    if (best) onPick(best);
  });
  return ch;
}
