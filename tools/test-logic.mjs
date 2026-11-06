// Проверка логики без браузера: свёртка прогресса, повторение 1/3/7/21, серия, шкалы, план. node tools/test-logic.mjs
import { readFileSync } from 'node:fs';
import { fold, dueReviews, streak, testScore, forecast, level } from '../assets/js/progress.js';
import { buildPlan, feasibility } from '../assets/js/plan.js';

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } else console.log('✓', msg); };
const D = 86400000, t0 = new Date(2026, 10, 9, 10, 0).getTime(); // пн 09.11.2026, 10:00
const ev = (type, data, t) => ({ id: `${t}-${Math.random()}`, t, type, data });

// --- повторение 1/3/7/21 ---
let E = [ev('answer', { task: 'm01-a', num: 'm01', ok: false }, t0)];
let s = fold(E);
ok(dueReviews(s, t0).length === 0, 'ошибка сегодня — повтор не сегодня');
ok(dueReviews(s, t0 + D).length === 1, 'ошибка — повтор через 1 день');
E.push(ev('answer', { task: 'm01-a', num: 'm01', ok: true }, t0 + D)); s = fold(E);
ok(s.tasks['m01-a'].srs.stage === 1 && dueReviews(s, t0 + 3 * D).length === 0 && dueReviews(s, t0 + 4 * D).length === 1, 'верно в срок — следующий через 3 дня');
E.push(ev('answer', { task: 'm01-a', num: 'm01', ok: true }, t0 + 4 * D)); s = fold(E);
ok(dueReviews(s, t0 + 11 * D).length === 1 && dueReviews(s, t0 + 10 * D).length === 0, 'затем через 7');
E.push(ev('answer', { task: 'm01-a', num: 'm01', ok: true }, t0 + 11 * D)); s = fold(E);
ok(dueReviews(s, t0 + 32 * D).length === 1, 'затем через 21');
E.push(ev('answer', { task: 'm01-a', num: 'm01', ok: true }, t0 + 32 * D)); s = fold(E);
ok(s.tasks['m01-a'].srs.done && dueReviews(s, t0 + 100 * D).length === 0, 'после 21 — освоено, больше не повторяем');
E.push(ev('answer', { task: 'm01-a', num: 'm01', ok: false }, t0 + 40 * D)); s = fold(E);
ok(s.tasks['m01-a'].srs.stage === 0 && dueReviews(s, t0 + 41 * D).length === 1, 'новая ошибка — снова с 1 дня');
const s2 = fold([ev('answer', { task: 'm01-b', num: 'm01', ok: true, hints: 1 }, t0)]);
ok(dueReviews(s2, t0 + D).length === 1, 'решено с подсказкой — тоже повторить завтра');
const s3 = fold([ev('answer', { task: 'm01-c', num: 'm01', ok: false }, t0), ev('answer', { task: 'm01-c', num: 'm01', ok: true }, t0 + 8 * 3600000)]);
ok(s3.tasks['m01-c'].srs.stage === 0, 'верно в тот же день после ошибки — интервал не продвигается раньше срока');
const s4 = fold([ev('answer', { task: 'm01-d', num: 'm01', ok: true }, t0)]);
ok(!s4.tasks['m01-d'].srs, 'чисто верно с первого раза — в повторение не попадает');

// --- серия ---
const days = []; for (let i = 0; i < 6; i++) for (let k = 0; k < 5; k++) days.push(ev('answer', { task: `x${i}${k}`, num: 'm02', ok: true }, t0 + i * D + k));
ok(streak(fold(days), t0 + 5 * D) === 6, 'серия 6 учебных дней подряд (пн–сб)');
ok(streak(fold(days), t0 + 6 * D) === 6, 'воскресенье (выходной) серию не рвёт');
ok(streak(fold(days), t0 + 8 * D) === 0, 'пропуск учебного дня рвёт серию');

// --- шкалы ---
ok(testScore('физика', 40) === 90 && testScore('физика', 45) === 100, 'физика: 40 → 90, 45 → 100');
ok(testScore('математика', 33) === 100 && testScore('математика', 0) === 0, 'математика 2027: 33 → 100');
ok(Math.abs(testScore('математика', 22.7) - 90) <= 1, 'математика: 22,7 первичных 2027 ≈ 90 (прогноз по шкале 2026)');
ok(level(0).lv === 1 && level(200).lv === 3, 'уровни растут по опыту');

// --- план ---
const catalog = JSON.parse(readFileSync(new URL('../../контент/номера.json', import.meta.url), 'utf8'));
const empty = fold([]);
const plan = buildPlan(empty, catalog, { now: t0, days: 14 });
ok(plan.length === 14, 'план на 14 дней');
ok(plan.filter((d) => d.kind === 'rest').length === 2, 'два воскресенья — отдых');
ok(plan.filter((d) => d.kind === 'mock').length === 2, 'пробник раз в неделю (сб)');
const study = plan.filter((d) => d.kind === 'study');
ok(study.every((d) => d.blocks.reduce((a, b) => a + b.minutes, 0) === 120), 'учебный день = 120 минут (20 + 70 + 30)');
ok(new Set(study.map((d) => d.subject)).size === 2, 'чередуются оба предмета');
ok(study[0].blocks[1].num && /0[1-4]$/.test(study[0].blocks[1].num), `первый номер — из части 1 с высокой отдачей (${study[0].blocks[1].num})`);
const later = buildPlan(empty, catalog, { now: t0 + 2 * D, days: 3 });
ok(later[0].date === '2026-11-11', 'пропустил дни — план начинается с сегодняшнего дня (пересборка)');
const exam = buildPlan(empty, catalog, { now: new Date(2027, 5, 7).getTime(), days: 4 });
ok(exam[0].kind === 'exam' && exam[0].subject === 'математика' && exam[3].kind === 'exam', '7 и 10 июня — экзамены');
const f = feasibility(empty, catalog, { now: t0 });
ok(f['математика'].ok && f['физика'].ok, `времени хватает: математика нужно ${f['математика'].need} из ${f['математика'].have}, физика ${f['физика'].need} из ${f['физика'].have} блоков`);
const fc = forecast(empty, catalog);
ok(fc['математика'].max === 33 && fc['физика'].max === 45, 'максимумы первичных 33 и 45');

{ // сброс прогресса: предмет и всё
  const E = (t, type, data) => ({ id: type + t, t, type, data });
  const ev = [E(1, 'answer', { task: 'm01-t1-01', num: 'm01', ok: true }), E(2, 'answer', { task: 'f01-t1-01', num: 'f01', ok: true }), E(3, 'note', { key: 'm01', text: 'x' }), E(4, 'diag', { num: 'm02', level: 2 })];
  const sm = fold([...ev, E(5, 'reset', { scope: 'математика' })]);
  ok(!sm.tasks['m01-t1-01'] && !!sm.tasks['f01-t1-01'] && !sm.notes.m01 && !sm.diag.m02 && sm.xp === 10, 'сброс математики: физика и её опыт остались');
  const sa = fold([...ev, E(5, 'reset', { scope: 'всё' }), E(6, 'answer', { task: 'm03-t1-01', num: 'm03', ok: true })]);
  ok(Object.keys(sa.tasks).join() === 'm03-t1-01' && sa.xp === 10, 'полный сброс: учитываются только события после него');
}
console.log(`\n${n - fail}/${n} проверок пройдено`);
process.exit(fail ? 1 : 0);
