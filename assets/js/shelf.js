// Стартовый экран «Полка» (18.11.2026, v2): три объёмные книги вместо шапки.
// Наведение — книга приподнимается и наклоняется за курсором, по обложке скользит блик лампы; свет на всех обложках
// следует за курсором по экрану. Клик/Enter — «влёт в книгу»: книга выплывает в центр, обложка раскрывается,
// камера ныряет в первую страницу, бумага темнеет до фона — и из неё проступает предмет. Клик/Esc во время полёта — пропустить.
// Вернулся на главную — книга встаёт обратно на полку. «Уменьшить движение» — переход сразу, без полёта.
// Книги — обычные ссылки: Tab/Enter, средняя кнопка и Ctrl+клик работают как у ссылки.
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BACK_KEY = 'shelf-back';

// эмблемы — тонкие чертежи в стиле «Чертежа» (линия 1.75, без заливок)
const EMBLEM = {
  m: '<path class="ax" d="M6 50H58M12 58V6"/><path d="M17 9C22 58 36 58 41 9"/><path class="acc" d="M22 47L54 23"/><circle class="acc" cx="34" cy="38" r="2.4"/>',
  r: '<path class="ax" d="M8 10V56"/><path d="M18 14H54M12 22H54M12 30H44"/><path d="M18 40H54M12 48H50"/><path class="acc" d="M12 56H34"/>',
  f: '<path class="ax" d="M6 54H58"/><path d="M6 54L58 24V54"/><path d="M26 42.5L38.1 35.5L33.6 27.7L21.5 34.7Z"/><path class="acc" d="M29.8 35V50M27 46.5L29.8 50.3L32.6 46.5"/>',
};

/** books: [{key:'m'|'r'|'f', href, title, sub, done, total}] */
export function shelfHTML({ lead, books, nav }) {
  const book = (b, i) => `<a class="book book-${b.key}" href="${b.href}" data-book="${b.key}" style="--n:${i}" aria-label="${esc(b.title)}: ${esc(b.sub)}, освоено ${b.done} из ${b.total}">
      <span class="book-body">
        <span class="book-back" aria-hidden="true"></span>
        <span class="book-spine" aria-hidden="true"></span>
        <span class="book-edge" aria-hidden="true"></span>
        <span class="book-page" aria-hidden="true"><span class="bp-t">${esc(b.title)}</span><span class="bp-s">${esc(b.sub)}</span></span>
        <span class="book-cover" aria-hidden="true">
          <span class="bc-front">
            <svg class="bc-em" viewBox="0 0 64 64">${EMBLEM[b.key]}</svg>
            <span class="bc-t">${esc(b.title)}</span>
            <span class="bc-s">${esc(b.sub)}</span>
            <span class="bc-p"><i style="--p:${b.total ? b.done / b.total : 0}"></i><span>${b.done} из ${b.total}</span></span>
          </span>
          <span class="bc-back"></span>
        </span>
      </span>
      <span class="book-shade" aria-hidden="true"></span>
    </a>`;
  return `<section class="shelf-screen" aria-labelledby="shelf-h">
    <div class="shelf-head">
      <h1 id="shelf-h"><span class="lamp" aria-hidden="true"></span>ЕГЭ курс 2027</h1>
      <p class="shelf-lead">${lead}</p>
    </div>
    <nav class="shelf" aria-label="Предметы">${books.map(book).join('')}</nav>
    <div class="shelf-board" aria-hidden="true"></div>
    <nav class="shelf-nav" aria-label="Разделы">
      ${nav.map(([href, t]) => (href === 'today' ? `<button type="button" class="sn-link" data-today>${t}</button>` : `<a class="sn-link" href="${href}">${t}</a>`)).join('')}
      <span class="sn-tools">
        <span class="sync-dot off" aria-hidden="true"></span>
        <button class="iconbtn" type="button" data-shelf-sound aria-label="Звуки"></button>
        <button class="iconbtn" type="button" data-shelf-calc aria-label="Калькулятор"></button>
      </span>
    </nav>
  </section>`;
}

export function mountShelf(view, { onSound, onCalc, soundOn, icon, play, preview, adopt }) {
  const screen = view.querySelector('.shelf-screen'), shelf = view.querySelector('.shelf');
  if (!shelf) return;
  const snd = view.querySelector('[data-shelf-sound]'), calc = view.querySelector('[data-shelf-calc]');
  snd.innerHTML = icon('sound'); snd.setAttribute('aria-pressed', soundOn());
  snd.onclick = () => { onSound(); snd.setAttribute('aria-pressed', soundOn()); };
  calc.innerHTML = icon('calc'); calc.onclick = onCalc;
  view.querySelector('[data-today]').onclick = () => view.querySelector('#today')?.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });

  // вернулись из предмета — его книга встаёт на полку
  let back = null; try { back = sessionStorage.getItem(BACK_KEY); sessionStorage.removeItem(BACK_KEY); } catch { /* приватный режим */ }
  const backBook = back && shelf.querySelector(`[data-book="${back}"]`);
  if (backBook && !still()) { backBook.classList.add('returning'); setTimeout(() => backBook.classList.remove('returning'), 1000); }

  if (matchMedia('(hover: hover)').matches && !still()) tilt(screen, shelf);

  let flying = false;
  shelf.addEventListener('click', (e) => {
    const a = e.target.closest('[data-book]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (flying) return;
    flying = true;
    try { sessionStorage.setItem(BACK_KEY, a.dataset.book); } catch { /* приватный режим */ }
    if (still()) { location.hash = a.getAttribute('href'); return; }
    play?.();
    flyInto(a, screen, shelf);
  });
}

/** Наклон книги за курсором и свет лампы на обложках (только мышь) */
function tilt(screen, shelf) {
  // pointermove браузер и так присылает не чаще кадра — считаем сразу, без requestAnimationFrame (он стоит в фоновых окнах)
  screen.addEventListener('pointermove', (ev) => {
    if (ev.pointerType && ev.pointerType !== 'mouse') return;
    const r = screen.getBoundingClientRect();
    screen.style.setProperty('--lx', ((ev.clientX - r.left) / r.width).toFixed(3));
    screen.style.setProperty('--ly', ((ev.clientY - r.top) / r.height).toFixed(3));
    const a = ev.target.closest?.('[data-book]');
    shelf.querySelectorAll('.book.tilting').forEach((b) => { if (b !== a) untilt(b); });
    if (!a || a.classList.contains('open')) return;
    const br = a.getBoundingClientRect(), px = (ev.clientX - br.left) / br.width - 0.5, py = (ev.clientY - br.top) / br.height - 0.5;
    a.classList.add('tilting');
    a.style.setProperty('--ry', `${(px * 16).toFixed(2)}deg`);
    a.style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`);
    a.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
    a.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
  }, { passive: true });
  screen.addEventListener('pointerleave', () => shelf.querySelectorAll('.book.tilting').forEach(untilt));
}
function untilt(b) { b.classList.remove('tilting'); ['--ry', '--rx', '--gx', '--gy'].forEach((p) => b.style.removeProperty(p)); }

/** «Влёт в книгу» (v3, 19.11): книга выплывает в центр → раскрывается, на развороте — крупное название предмета →
 *  тёмный разворот с названием растягивается на весь экран → название плавно тает → под слоем уже готова страница
 *  предмета, слой мягко растворяется. Всё — только transform и opacity (их ведёт видеокарта, на телефоне без рывков);
 *  ни одной копии страницы внутри книги, живой фон на время полёта стоит.
 *  Порядок держат таймеры, а не события анимаций — так он доходит до конца и в фоновой вкладке. */
const TITLES = { m: ['Профильная математика', 'ЕГЭ-2027, 19 заданий'], f: ['Физика', 'ЕГЭ-2027, 26 заданий'], r: ['Русский язык', 'Итоговое сочинение'] };
function flyInto(a, screen, shelf) {
  const body = a.querySelector('.book-body'), cover = a.querySelector('.book-cover');
  const href = a.getAttribute('href'), key = a.dataset.book, timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  // все замеры — один раз и до смены классов: никаких чтений раскладки посреди движения
  const vw = innerWidth, vh = innerHeight, br = a.getBoundingClientRect(), W = br.width, H = body.offsetHeight;
  const cur = getComputedStyle(body).transform;
  untilt(a);
  a.classList.add('open', 'flying');
  shelf.classList.add('choosing'); screen.classList.add('choosing');
  const s = Math.max(1, Math.min((vh * 0.74) / H, (vw * 0.88) / (2 * W)));         // раскрытый разворот 2W·s
  const cx = br.left + W / 2, cy = br.top + H / 2;
  const dx0 = vw / 2 - cx, dy = vh / 2 - cy, shift = (W * s) / 2;                    // сначала по центру книга, потом — разворот
  const ease = 'cubic-bezier(.22,.8,.2,1)', glide = 'cubic-bezier(.45,0,.25,1)';
  body.animate([{ transform: cur === 'none' ? 'none' : cur }, { transform: `translate(${dx0}px, ${dy}px) scale(${s})` }], { duration: 640, easing: ease, fill: 'forwards' });
  body.animate([{ translate: '0px 0px' }, { translate: `${shift}px 0px` }], { duration: 620, delay: 240, easing: glide, fill: 'forwards' });
  // точка схода — над корешком в конце пути, чтобы раскрытая обложка не уходила в перекос
  a.animate([{ perspectiveOrigin: '50% 50%' }, { perspectiveOrigin: `${(vw / 2 - br.left).toFixed(1)}px ${(vh / 2 - br.top).toFixed(1)}px` }], { duration: 860, easing: glide, fill: 'forwards' });
  cover.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: 640, delay: 220, easing: 'cubic-bezier(.35,.1,.25,1)', fill: 'forwards' });

  // слой полёта: тёмный «разворот» (совпадает с раскрытой книгой) + название предмета; строится через 0,3 с, на лету
  const sw = 2 * W * s, sh = H * s, L = vw / 2 - W * s, T = vh / 2 - sh / 2;
  let fly = null;
  at(300, () => {
  dispatchEvent(new CustomEvent('ege-bg', { detail: { pause: true } }));
  const [t1, t2] = TITLES[key] || ['', ''];
  fly = document.createElement('div');
  fly.className = 'fly'; fly.setAttribute('aria-hidden', 'true');
  fly.style.setProperty('--fs', `${Math.max(22, Math.min(64, W * s * 0.21)).toFixed(1)}px`);
  fly.style.setProperty('--tw', `${Math.min(vw * 0.9, sw * 0.86).toFixed(1)}px`);
  fly.innerHTML = `<div class="fly-panel"></div><div class="fly-title"><b>${t1}</b><span>${t2}</span></div>`;
  document.body.appendChild(fly);
  const panel = fly.querySelector('.fly-panel'), title = fly.querySelector('.fly-title');
  const P0 = `translate(${L.toFixed(1)}px, ${T.toFixed(1)}px) scale(${(sw / vw).toFixed(4)}, ${(sh / vh).toFixed(4)})`;
  panel.style.transform = P0;
  // разворот лёг — на нём проступает название (тёмный слой того же цвета, что листы книги, — шва не видно)
  panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 420, easing: 'ease-out', fill: 'forwards' });
  title.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.96)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], { duration: 420, delay: 460, easing: 'ease-out', fill: 'forwards' });
  // разворот растягивается на весь экран, книга под ним тает; название растёт вместе с ним
  const grow = 'cubic-bezier(.55,0,.2,1)';
  panel.animate([{ transform: P0 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], { duration: 640, delay: 880, easing: grow, fill: 'forwards' });
  title.animate([{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: 'translate(-50%, -50%) scale(1.22)' }], { duration: 640, delay: 880, easing: grow, fill: 'forwards', composite: 'replace' });
  body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 1000, easing: 'ease-in', fill: 'forwards' });
  });
  // экран занят разворотом — название плавно тает
  at(1700, () => fly?.querySelector('.fly-title').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-in-out', fill: 'forwards', composite: 'replace' }));

  // переход: страница строится под непрозрачным слоем, потом слой мягко растворяется
  let gone = false;
  const go = () => {
    if (gone) return; gone = true;
    timers.forEach(clearTimeout);
    removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onSkip, true);
    let shown = false;
    const reveal = () => {
      if (shown) return; shown = true;
      // два кадра — чтобы новая страница успела отрисоваться, прежде чем слой начнёт растворяться
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const f = fly;
        if (f) { f.animate([{ opacity: getComputedStyle(f.querySelector('.fly-panel')).opacity }, { opacity: 0 }], { duration: 520, easing: 'ease-out', fill: 'forwards' }); setTimeout(() => f.remove(), 560); }
        setTimeout(() => dispatchEvent(new CustomEvent('ege-bg', { detail: { pause: false } })), 560);
      }));
    };
    addEventListener('ege-routed', reveal, { once: true });
    setTimeout(reveal, 1500); // страховка: страница не сообщила о себе
    location.hash = href;
  };
  at(2130, go);
  // пропустить полёт: любой клик или Esc/Enter/пробел
  const onSkip = (e) => { e.preventDefault(); go(); };
  const onKey = (e) => { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); go(); } };
  setTimeout(() => { addEventListener('pointerdown', onSkip, true); addEventListener('keydown', onKey, true); }, 150);
}

/** «Закрыть книгу»: страница уходит в глубину, на главной книга встаёт на полку */
export function closeBook(key) {
  try { if (key) sessionStorage.setItem(BACK_KEY, key); } catch { /* приватный режим */ }
  const main = document.getElementById('main'), top = document.getElementById('top');
  if (still() || !main) { location.hash = '#/'; return; }
  const anims = [
    main.animate([{ transform: 'none', opacity: 1 }, { transform: 'perspective(1400px) translate3d(0, 3vh, -520px) rotateY(14deg)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }),
    top && !top.hidden && top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }),
  ].filter(Boolean);
  const done = () => { location.hash = '#/'; addEventListener('ege-routed', () => anims.forEach((x) => x.cancel()), { once: true }); setTimeout(() => anims.forEach((x) => x.cancel()), 1500); };
  setTimeout(done, 480);
}
