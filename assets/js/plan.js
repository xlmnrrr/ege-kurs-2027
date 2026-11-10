// План «с нуля до идеала» до экзаменов: вычисляется заново каждый день из состояния (пропуск дня = пересборка, хранить нечего).
// День (ТЗ п.6): ~20 мин повторение ошибок, ~70 мин номер (теория → типы → тренажёр), ~30 мин смешанные; раз в неделю — пробник.
import { dueReviews, mastery, startOfDay } from './progress.js';

const DAY = 86400000;
export const DEFAULTS = {
  exams: { русский: '2026-12-02', математика: '2027-06-07', физика: '2027-06-10' }, // русский — итоговое сочинение (сообщение школы), остальное — проект расписания 2027
  minutes: 120,
  studyDays: [1, 2, 3, 4, 5, 6],      // пн–сб (0 = вс)
  mockDay: 6,                          // суббота — пробник
  finishBefore: 21,                    // все номера пройти за 3 недели до экзамена, дальше — пробники и повторение
};
// Сколько учебных блоков по 70 мин нужно номеру с нуля (часть 1 — проще, часть 2 — дольше)
export function blocksNeeded(n) {
  if (n.part === 2) return n.points >= 4 ? 5 : n.points === 3 ? 4 : 3;
  return n.level === 'Б' ? 1 : 2;
}

/** Очередь номеров предмета: сначала то, что даёт больше баллов за минуту подготовки и слабее освоено */
export function queue(s, catalog, subject, tasksById = {}) {
  return catalog.filter((n) => n.subject === subject).map((n) => {
    const m = mastery(s, n, tasksById[n.id] || []);
    const left = Math.max(0, Math.ceil(blocksNeeded(n) * (1 - m)));
    const value = (n.points * (1 - m)) / Math.max(1, blocksNeeded(n));
    return { n, m, left, value };
  }).filter((q) => q.left > 0)
    .sort((a, b) => (a.n.part - b.n.part) || (b.value - a.value) || (a.n.num - b.n.num));
}

const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

/**
 * План на N дней вперёд. Предметы чередуются по дням с учётом остатка работы (у кого больше блоков осталось — чаще).
 * @returns [{date, kind:'study'|'mock'|'rest'|'exam', subject, blocks:[{kind, minutes, num?, count?}]}]
 */
export function buildPlan(s, catalog, { now = Date.now(), days = 14, tasksById = {}, opts = {} } = {}) {
  const o = { ...DEFAULTS, ...opts, exams: { ...DEFAULTS.exams, ...(opts.exams || {}) } };
  const subjects = Object.keys(o.exams);
  const q = {}; subjects.forEach((sub) => (q[sub] = queue(s, catalog, sub, tasksById)));
  const left = (subj) => (q[subj] || []).reduce((a, x) => a + x.left, 0);
  const pointer = {}, used = {}; subjects.forEach((sub) => { pointer[sub] = 0; used[sub] = 0; });
  const reviews = dueReviews(s, now).length;
  const out = [];
  let t = startOfDay(now), lastSubj = s.settings.lastSubject || 'физика';
  for (let i = 0; i < days; i++, t += DAY) {
    const date = iso(t), wd = new Date(t).getDay();
    const examToday = Object.entries(o.exams).find(([, d]) => d === date);
    if (examToday) { out.push({ date, kind: 'exam', subject: examToday[0], blocks: [] }); continue; }
    if (!o.studyDays.includes(wd)) { out.push({ date, kind: 'rest', blocks: [] }); continue; }
    const daysTo = (subj) => Math.round((parse(o.exams[subj]) - t) / DAY);
    // пробник раз в неделю (когда есть хотя бы половина номеров предмета)
    if (wd === o.mockDay) {
      const subj = left('математика') / 20 <= left('физика') / 26 ? 'математика' : 'физика';
      out.push({ date, kind: 'mock', subject: subj, blocks: [{ kind: 'mock', minutes: 235, subject: subj }] });
      continue;
    }
    // какой предмет сегодня: тот, у кого «давление» (остаток / дни до срока) больше; при равенстве — чередуем
    // какой предмет сегодня: у кого «давление» (остаток на день до срока) больше, при близких — чередуем
    const pressure = (subj) => (left(subj) - used[subj]) / Math.max(1, daysTo(subj) - o.finishBefore);
    const ranked = subjects.slice().sort((a, b) => pressure(b) - pressure(a));
    let subj;
    if (ranked.length > 1 && pressure(ranked[0]) > pressure(ranked[1]) * 1.15) subj = ranked[0];
    else {
      const alt = subjects.filter((x) => x !== lastSubj && left(x) - used[x] > 0).sort((a, b) => pressure(b) - pressure(a));
      subj = alt[0] || ranked[0];
    }
    if (left(subj) - used[subj] <= 0) {
      const rest = subjects.filter((x) => left(x) - used[x] > 0).sort((a, b) => pressure(b) - pressure(a));
      if (rest.length) subj = rest[0];
    }
    lastSubj = subj;
    const blocks = [];
    const rev = i === 0 ? reviews : 0;
    blocks.push({ kind: 'review', minutes: 20, count: rev });
    // номер дня
    let item = q[subj][pointer[subj]];
    if (item) {
      blocks.push({ kind: 'number', minutes: 70, num: item.n.id, title: item.n.title, part: item.n.part, stage: item.m > 0 ? 'продолжение' : 'с нуля' });
      used[subj]++; item.left--; if (item.left <= 0) pointer[subj]++;
    } else blocks.push({ kind: 'mixed', minutes: 70, subject: subj });
    blocks.push({ kind: 'mixed', minutes: 30, subject: subj });
    out.push({ date, kind: 'study', subject: subj, blocks });
  }
  return out;
}

/** Хватает ли времени: сколько учебных блоков нужно и сколько есть до «финиша» каждого предмета */
export function feasibility(s, catalog, { now = Date.now(), tasksById = {}, opts = {} } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const res = {};
  for (const subj of new Set([...Object.keys(DEFAULTS.exams), ...Object.keys(o.exams)])) {
    const need = queue(s, catalog, subj, tasksById).reduce((a, x) => a + x.left, 0);
    let have = 0;
    for (let t = startOfDay(now); t < parse(o.exams[subj]) - o.finishBefore * DAY; t += DAY) { const wd = new Date(t).getDay(); if (o.studyDays.includes(wd) && wd !== o.mockDay) have++; }
    res[subj] = { need, have: Math.floor(have / 2), ok: need <= Math.floor(have / 2) }; // дни делятся между двумя предметами
  }
  return res;
}
