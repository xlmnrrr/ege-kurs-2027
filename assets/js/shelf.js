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
    flyInto(a, screen, shelf, { preview, adopt });
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

/** «Влёт в книгу»: внутри раскрытой книги — живая мини-страница предмета; она растягивается до экрана и становится
 *  настоящей страницей (тот же узел переезжает в #main — модель не перезапускается, шва нет).
 *  Порядок держат таймеры, а не события анимаций — так он доходит до конца и в фоновой вкладке. */
function flyInto(a, screen, shelf, { preview, adopt }) {
  const body = a.querySelector('.book-body'), cover = a.querySelector('.book-cover'), page = a.querySelector('.book-page');
  const href = a.getAttribute('href'), timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  untilt(a);
  a.classList.add('open', 'flying');
  shelf.classList.add('choosing'); screen.classList.add('choosing');
  const cw = document.documentElement.clientWidth, vw = innerWidth, vh = innerHeight;

  // внутри книги сразу сайт: левая половина мини-страницы — на внутренней стороне обложки, правая — на странице.
  // Когда обложка легла, разворот = мини-страница целиком (по ширине, без обрезки), никаких подмен и проявлений.
  const pvR = preview?.(a.dataset.book), pvL = preview?.(a.dataset.book);
  const Wl = body.clientWidth, kpv = (2 * Wl) / cw;
  const half = (pvEl, host, shift) => {
    const box = document.createElement('span'); box.className = 'book-half'; box.setAttribute('aria-hidden', 'true');
    pvEl.classList.add('pv'); pvEl.style.width = `${cw}px`; pvEl.style.height = `${vh}px`; pvEl.style.transform = `translate(${shift}px, 0px) scale(${kpv})`;
    box.appendChild(pvEl); host.appendChild(box); return box;
  };
  let boxR = null;
  if (pvR && pvL) {
    page.classList.add('has-pv');
    boxR = half(pvR, page, -Wl);
    half(pvL, cover.querySelector('.bc-back'), 0);
  }
  // A. книга выплывает в центр: корешок — по центру экрана, раскрытая книга помещается целиком
  const br = a.getBoundingClientRect(), W = br.width, H = body.offsetHeight;
  // раскрытый разворот (обложка + страница = 2W·s): крупно, но с воздухом вокруг
  const s = Math.max(1, Math.min((vh * 0.78) / H, (vw * 0.86) / (2 * W)));
  const dx = vw / 2 + (W * s) / 2 - (br.left + W / 2), dy = vh * 0.5 - (br.top + H / 2);
  const ease = 'cubic-bezier(.22,.8,.2,1)';
  // точка схода — туда, где книга окажется, иначе раскрытая обложка уйдёт в перекос
  a.animate([{ perspectiveOrigin: '50% 50%' }, { perspectiveOrigin: `${(dx + W / 2).toFixed(1)}px ${(dy + H / 2).toFixed(1)}px` }], { duration: 700, easing: ease, fill: 'forwards' });
  // без остановки: к 0,7 с книга в центре, дальше продолжает медленно наплывать — нырок в страницу подхватывает это движение
  const cur = getComputedStyle(body).transform;
  body.animate([
    { transform: cur === 'none' ? 'none' : cur, offset: 0, easing: 'cubic-bezier(.25,.75,.35,1)' },
    { transform: `translate(${dx}px, ${dy}px) scale(${s})`, offset: 0.44, easing: 'cubic-bezier(.4,0,.7,.4)' },
    { transform: `translate(${dx}px, ${dy}px) scale(${s * 1.1})`, offset: 1 },
  ], { duration: 1600, fill: 'forwards' });
  // B. обложка раскрывается по корешку
  cover.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: 640, delay: 200, easing: 'cubic-bezier(.3,.6,.25,1)', fill: 'forwards' });

  // C. страница растягивается до экрана: слой полёта забирает мини-страницу и растит её из книги
  let fly = null;
  at(860, () => {
    // разворот на экране: правая половина — страница, левая — такая же ширина слева от корешка
    const rr = (boxR || page).getBoundingClientRect(), left = rr.left - rr.width, r = { left, top: rr.top, right: rr.right, bottom: rr.bottom, width: rr.width * 2 };
    fly = document.createElement('div');
    fly.className = 'fly'; fly.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fly);
    const k = r.width / cw, rad = (6 * s).toFixed(1);
    const clip0 = `inset(${r.top.toFixed(1)}px ${(vw - r.right).toFixed(1)}px ${(vh - r.bottom).toFixed(1)}px ${r.left.toFixed(1)}px round ${rad}px)`;
    const curve = 'cubic-bezier(.32,.2,.2,1)', dur = 760;   // старт не с нуля — продолжение наплыва книги
    fly.animate([{ clipPath: clip0 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: dur, easing: curve, fill: 'forwards' });
    if (pvR) {
      fly.appendChild(pvR);
      pvR.style.transform = ''; pvR.animate([{ transform: `translate(${r.left}px, ${r.top}px) scale(${k})` }, { transform: 'translate(0px, 0px) scale(1)' }], { duration: dur, easing: curve, fill: 'forwards' });
    }
    // книга под слоем уходит в глубину — как будто камера пролетает сквозь неё
    body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'forwards', composite: 'replace' });
  });

  // D. переход: страница из слоя становится настоящей
  let gone = false;
  const go = () => {
    if (gone) return; gone = true;
    timers.forEach(clearTimeout);
    removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onSkip, true);
    document.documentElement.dataset.arrive = a.dataset.book;
    const pg = fly && pvR?.querySelector('.page');
    const adopted = !!(pg && fly.contains(pg));
    let shown = false;
    const reveal = () => {
      if (shown) return; shown = true;
      const f = fly || null; fly = null;
      // страница уже перенесена — под слоем то же самое, убираем сразу; иначе (полёт пропущен) — мягко гасим
      if (f && adopted) f.remove();
      else if (f) { f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }); setTimeout(() => f.remove(), 280); }
      setTimeout(() => { delete document.documentElement.dataset.arrive; }, 1200);
    };
    addEventListener('ege-routed', reveal, { once: true });
    setTimeout(reveal, 1500); // страховка: страница не сообщила о себе
    // готовую страницу отдаём маршрутизатору (только если полёт дошёл до конца — иначе он нарисует свою)
    if (adopted) adopt?.(href, pg);
    location.hash = href;
  };
  at(1640, go);
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
