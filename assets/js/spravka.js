// Справочник формул: #/формулы — три раздела (алгебра, геометрия, физика с константами).
// Поиск по тексту и по самим формулам (KaTeX хранит исходник), оглавление, «+» в мой лист формул, печать на А4.
import { App, esc, h, loadBundle, record, toast } from './app.js';
import { Chertezh, mid, lerp, V } from './chertezh.js';

const PARTS = [['алгебра', 'sp-a', 'Алгебра и начала анализа', 'числа, степени, логарифмы, тригонометрия, производная, вероятность'],
  ['геометрия', 'sp-g', 'Геометрия', 'планиметрия, векторы, стереометрия — теоремы и формулы с рисунками'],
  ['физика', 'sp-f', 'Физика', 'все разделы ЕГЭ, формулы и константы справочника КИМ']];
const figMods = {};

export async function renderRef(App_, which) {
  const part = PARTS.find((p) => p[0] === which);
  if (!part) {
    return h(`<div class="page" data-title="Формулы"><h1>Формулы и константы</h1><p class="lead">Всё, что нужно, чтобы решить любой номер ЕГЭ: определения, теоремы, формулы и константы. Поиск, печать, «+» — в твой лист формул.</p>
      <div class="ref-cards">${PARTS.map(([k, , t, d]) => `<a class="type-card" href="#/формулы/${k}"><b>${t}</b><div class="what">${d}</div></a>`).join('')}</div></div>`);
  }
  const [key, id, title] = part;
  let b;
  try { b = await loadBundle(id); } catch { return h(`<div class="page"><h1>${title}</h1><p class="lead">Раздел ещё собирается.</p></div>`); }
  const v = h(`<div class="page ref" data-title="Формулы: ${title}">
    <p class="ui muted" style="margin:0 0 6px"><a href="#/формулы">Формулы</a></p><h1>${title}</h1>
    <nav class="tabs" aria-label="Разделы справочника">${PARTS.map(([k, , t]) => `<a href="#/формулы/${k}" ${k === key ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
    <div class="ref-tools no-print"><input class="input" type="search" placeholder="Найти: «синус», «площадь», «sqrt», «закон»…" aria-label="Поиск по справочнику"><button class="btn" data-print>Печать А4</button></div>
    <nav class="toc no-print"></nav><article class="doc ref-doc">${b.html}</article><p class="empty" hidden>Ничего не нашлось — попробуй другое слово.</p></div>`);
  const art = v.querySelector('.ref-doc');
  // разделы ## — секции для оглавления и фильтра
  const secs = [];
  let cur = null;
  for (const node of [...art.children]) {
    if (node.tagName === 'H2') { cur = h('<section class="ref-sec"></section>'); cur.id = 'rs-' + secs.length; node.before(cur); cur.appendChild(node); secs.push(cur); }
    else if (cur) cur.appendChild(node);
  }
  v.querySelector('.toc').innerHTML = secs.map((s, i) => `<a href="#" data-go="${i}">${esc(s.querySelector('h2').textContent)}</a>`).join('');
  v.querySelectorAll('[data-go]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); v.querySelector('#rs-' + a.dataset.go).scrollIntoView({ behavior: 'smooth' }); }));
  // рисунки
  if (b.figures) {
    if (!figMods[id]) { const url = URL.createObjectURL(new Blob([b.figures], { type: 'text/javascript' })); figMods[id] = import(url).finally(() => URL.revokeObjectURL(url)); }
    const figs = await figMods[id];
    art.querySelectorAll('figure.fig[data-fig]').forEach((f) => {
      const fn = figs[f.dataset.fig.replace(/-([\p{L}\d])/gu, (_, c) => c.toUpperCase())];
      if (!fn) { f.remove(); return; }
      f.innerHTML = '<svg role="img" aria-label="Рисунок"></svg>'; const ch = new Chertezh(f.firstChild, { mode: '2d' }); fn(ch, { mid, lerp, V }); ch.render(); ch.setStep(ch.steps - 1, true);
    });
  } else art.querySelectorAll('figure.fig').forEach((f) => f.remove());
  // «+» в лист формул
  art.querySelectorAll('.mathd').forEach((m, k) => {
    const fk = `${id}:f${k}`, on = !!App.S.formulas[fk];
    const btn = h(`<button class="iconbtn add-formula no-print" aria-pressed="${on}" aria-label="${on ? 'Убрать из листа формул' : 'Добавить в мой лист формул'}" title="Мой лист формул"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${on ? 'M5 12l4 4 10-10' : 'M12 5v14M5 12h14'}"/></svg></button>`);
    btn.onclick = async () => { const now = !App.S.formulas[fk]; await record('formula', { key: fk, on: now, tex: m.querySelector('.katex')?.outerHTML || m.innerHTML, title: `Справочник: ${title}` }); btn.setAttribute('aria-pressed', now); btn.querySelector('path').setAttribute('d', now ? 'M5 12l4 4 10-10' : 'M12 5v14M5 12h14'); toast(now ? 'Формула в листе формул' : 'Убрано из листа формул'); };
    m.appendChild(btn);
  });
  // поиск: по тексту и по исходнику формул; показываем совпавшие пункты, их заголовки и разделы
  const items = [...art.querySelectorAll('li, p, tr, .mathd, aside, figure')];
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е');
  const txt = new Map(items.map((el) => [el, norm(el.textContent + ' ' + [...el.querySelectorAll('annotation')].map((a) => a.textContent).join(' '))]));
  const input = v.querySelector('input[type=search]'), empty = v.querySelector('.empty');
  input.oninput = () => {
    const q = norm(input.value.trim());
    let any = false;
    for (const s of secs) {
      let secHit = !q || norm(s.querySelector('h2').textContent).includes(q);
      for (const el of s.querySelectorAll('li, p, tr, .mathd, aside, figure')) {
        const hit = !q || secHit || txt.get(el)?.includes(q);
        el.classList.toggle('ref-hide', !hit);
        if (hit && q) secHit = secHit || false;
      }
      const vis = !q || secHit || [...s.querySelectorAll('li, p, tr, .mathd, aside')].some((el) => !el.classList.contains('ref-hide'));
      s.hidden = !vis; any = any || vis;
      s.querySelectorAll('h3').forEach((h3) => { let n = h3.nextElementSibling, show = false; while (n && n.tagName !== 'H3') { if (!n.classList.contains('ref-hide') && !(n.matches('ul,ol,.tbl') && !n.querySelector('li:not(.ref-hide), tr:not(.ref-hide)'))) show = true; n = n.nextElementSibling; } h3.hidden = q && !show; });
      s.querySelectorAll('ul, ol, .tbl').forEach((l) => { l.hidden = q && !l.querySelector('li:not(.ref-hide), tr:not(.ref-hide)'); });
    }
    empty.hidden = any;
  };
  v.querySelector('[data-print]').onclick = () => print();
  return v;
}
