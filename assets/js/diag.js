// Диагностика (ТЗ п.5): оба предмета, обе части. Часть 1 — ответ проверяется сразу; часть 2 — решаешь на листе,
// потом видишь решение и критерии ФИПИ и ставишь себе баллы честно. Итог — уровень по каждому номеру -> план стартует со слабых.
import { App, esc, h, record, toast, numLink, loadBundle } from './app.js';
import { checkAnswer } from './number.js';
import { Chertezh, mid, lerp, V } from './chertezh.js';
import { sound } from './extras.js';

const LEVEL = ['с нуля', 'слабо', 'почти', 'знаю'];
export async function renderDiag(App_, letter) {
  const subject = letter === 'ф' ? 'физика' : letter === 'м' ? 'математика' : null;
  if (!subject) {
    const done = (s) => App.catalog.filter((n) => n.subject === s && App.S.diag[n.id]).length;
    return h(`<div class="page prose" data-title="Диагностика"><h1>Диагностика</h1>
      <p class="lead">По 1–2 задачи на каждый номер ЕГЭ-2027, обе части. Итог покажет, с каких номеров начинать — план перестроится сам. Можно проходить частями: результат каждого номера сохраняется.</p>
      <div class="nums">${[['м', 'математика', 20], ['ф', 'физика', 26]].map(([l, s, k]) => `<a class="num" href="#/диагностика/${l}"><span class="n">${s === 'математика' ? 'М' : 'Ф'}</span><span><span class="t">${s === 'математика' ? 'Математика · профиль' : 'Физика'}</span><br><span class="s">${k} номеров · ~${s === 'математика' ? 90 : 100} минут</span></span><span class="st">${done(s)} из ${k}</span></a>`).join('')}</div></div>`);
  }
  const id = letter === 'м' ? 'dm' : 'df';
  let b;
  try { b = await loadBundle(id); } catch { return h(`<div class="page"><h1>Диагностика: ${subject}</h1><p class="lead">Задачи диагностики ещё собираются.</p></div>`); }
  let figs = {};
  if (b.figures) { const url = URL.createObjectURL(new Blob([b.figures], { type: 'text/javascript' })); figs = await import(url); URL.revokeObjectURL(url); }
  const v = h(`<div class="page" data-title="Диагностика: ${subject}"><h1>Диагностика: ${subject}</h1>
    <p class="lead">Часть 1 — ответ как в бланке. Часть 2 — реши на листе, затем открой решение и критерии и поставь себе баллы. Калькулятор: ${subject === 'физика' ? 'можно (кнопка в шапке)' : 'нельзя, как на экзамене'}.</p>
    <form class="diag" autocomplete="off"></form></div>`);
  const form = v.querySelector('form');
  const byNum = {};
  for (const t of b.tasks) (byNum[t.num] ||= []).push(t);
  for (const [num, tasks] of Object.entries(byNum)) {
    const n = App.catalog.find((x) => x.id === num);
    const sec = h(`<section class="card" style="margin-bottom:var(--s3)"><h3>№${n?.num ?? num}. ${esc(n?.title || '')}${App.S.diag[num] ? ` <span class="muted ui" style="font-size:13px">· прошлый результат: ${LEVEL[App.S.diag[num].level]}</span>` : ''}</h3></section>`);
    tasks.forEach((t, k) => {
      const box = h(`<div class="dt" data-id="${esc(t.id)}" style="margin-top:var(--s3)"><div>${t.q}</div>${t.fig && figs[t.fig] ? '<figure class="fig"><svg role="img" aria-label="Рисунок к задаче"></svg></figure>' : ''}</div>`);
      if (t.fig && figs[t.fig]) { const ch = new Chertezh(box.querySelector('svg'), { mode: '2d' }); figs[t.fig](ch, { mid, lerp, V }); ch.render(); ch.setStep(0, true); }
      if (t.part === 1) box.appendChild(h(`<label class="field" style="margin-top:var(--s2)">Ответ<input class="input" inputmode="decimal" data-ans></label>`));
      else {
        const more = h(`<div style="margin-top:var(--s2)"><button type="button" class="btn small">Решил на листе — показать решение и критерии</button><div class="crit" hidden><div class="key">${t.sol}</div><div class="criteria">${t.criteria || ''}</div>
          <label class="field">Сколько баллов из ${t.max} я бы получил по критериям<select class="input" data-self>${Array.from({ length: t.max + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}</select></label></div></div>`);
        more.querySelector('button').onclick = (e) => { more.querySelector('.crit').hidden = false; e.target.remove(); };
        box.appendChild(more);
      }
      sec.appendChild(box);
    });
    form.appendChild(sec);
  }
  form.appendChild(h('<div class="row"><button class="btn primary" type="submit">Подвести итог</button></div>'));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const res = [];
    for (const [num, tasks] of Object.entries(byNum)) {
      let got = 0, max = 0, answered = 0;
      for (const t of tasks) {
        const box = form.querySelector(`[data-id="${CSS.escape(t.id)}"]`);
        if (t.part === 1) { const val = box.querySelector('[data-ans]').value; if (val.trim()) answered++; max += 1; if (checkAnswer(val, t)) got += 1; }
        else { const sel = box.querySelector('[data-self]'); const opened = !box.querySelector('.crit')?.hidden; if (opened) answered++; max += t.max; got += opened ? +sel.value : 0; }
      }
      if (!answered) continue; // номер пропущен — уровень не записываем
      const r = got / max, level = r >= 0.99 ? 3 : r >= 0.6 ? 2 : r > 0 ? 1 : 0;
      await record('diag', { num, level, got, max });
      res.push({ num, level, got, max });
    }
    sound.play('level');
    const weak = res.filter((r) => r.level <= 1).map((r) => App.catalog.find((x) => x.id === r.num)).filter(Boolean);
    v.querySelector('.diag').replaceWith(h(`<div><div class="result ok"><b>Итог записан: ${res.length} номеров.</b> План на сегодня уже учитывает результат.</div>
      <div class="tbl"><table><thead><tr><th>Номер</th><th>Баллы</th><th>Уровень</th></tr></thead><tbody>${res.map((r) => { const n = App.catalog.find((x) => x.id === r.num); return `<tr><td><a href="${n ? numLink(n) : '#/'}">№${n?.num}. ${esc(n?.title || '')}</a></td><td>${r.got} из ${r.max}</td><td>${LEVEL[r.level]}</td></tr>`; }).join('')}</tbody></table></div>
      ${weak.length ? `<p>Начать стоит с: ${weak.slice(0, 5).map((n) => `<a href="${numLink(n)}">№${n.num}</a>`).join(', ')}.</p>` : ''}<p><a class="btn primary" href="#/">К плану на сегодня</a></p></div>`));
    scrollTo(0, 0);
  };
  return v;
}
