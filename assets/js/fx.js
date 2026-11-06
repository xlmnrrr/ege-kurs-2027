// Эффекты интерфейса (DESIGN.md, v3): появление блоков каскадом, досчёт чисел, свет лампы на карточке под курсором.
// «Уменьшить движение» — ничего не двигается, числа сразу итоговые. Текст никогда не прячется надолго: анимация ≤ 0,45 с.
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLOCKS = '.hero, .callout, .card, .pmap, .num, .type-card, .check-card, .task, .board, .ref-cards > a, .day, .list .item, .part-h, .num-hero, .sub-hero, .dt';

/** Новый экран: блоки поднимаются по очереди, числа досчитываются */
export function enter(view) {
  if (still()) return;
  let i = 0;
  for (const el of view.querySelectorAll(BLOCKS)) {
    if (el.parentElement?.closest('.pmap, .task, .board')) continue;
    if (i > 14) break;
    el.style.setProperty('--i', i++);
    el.classList.add('fx-in');
  }
  for (const el of view.querySelectorAll('[data-count]')) countUp(el);
}

function countUp(el) {
  const to = +el.dataset.count;
  if (!Number.isFinite(to) || to <= 0) return;
  const t0 = performance.now(), dur = Math.min(1100, 500 + to * 4);
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(to * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

/** Свет на карточках: координаты курсора внутри карточки → CSS-переменные --mx/--my */
const LIT = '.card, .num, .type-card, .callout, .check-card, .pmap, .ref-cards > a, .task, .nchip';
export function initLight() {
  if (matchMedia('(hover: none)').matches) return;
  let cur = null, raf = 0, ev = null;
  addEventListener('pointermove', (e) => {
    ev = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = ev.target.closest?.(LIT);
      if (cur && cur !== el) cur.classList.remove('lit');
      cur = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
      el.style.setProperty('--my', `${ev.clientY - r.top}px`);
      el.classList.add('lit');
    });
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { cur?.classList.remove('lit'); cur = null; });
}
