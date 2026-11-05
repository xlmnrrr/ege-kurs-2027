// Состояние ученика = свёртка журнала событий (чистые функции — проверяются в Node: tools/test-logic.mjs).
// Повторение ошибок: интервалы 1, 3, 7, 21 день (ТЗ п.6). Серия, уровни, прогноз балла к 90.
export const INTERVALS = [1, 3, 7, 21];
const DAY = 86400000;
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function fold(events) {
  const s = { tasks: {}, numbers: {}, notes: {}, marks: {}, formulas: {}, days: {}, mocks: [], diag: {}, settings: {}, xp: 0 };
  const sorted = [...events].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  for (const e of sorted) {
    const d = e.data || {};
    switch (e.type) {
      case 'answer': {
        const t = (s.tasks[d.task] ||= { attempts: 0, correct: 0, last: null, hints: 0, srs: null, num: d.num });
        t.attempts++; t.num ||= d.num; t.hints = d.hints || 0;
        t.last = { ok: !!d.ok, t: e.t, hints: d.hints || 0, given: d.given };
        if (d.ok) { t.correct++; s.xp += d.hints || d.tries ? 5 : 10; }
        // повторение (одна запись = одна попытка решить задачу; data: ok, hints, tries — неверных вводов до ответа):
        // любая трудность (неверно, подсказка, неверный ввод) -> стадия 0, повтор завтра;
        // чисто верно в день срока или позже -> следующий интервал 3, 7, 21; после 21 — освоено
        const struggle = !d.ok || (d.hints || 0) > 0 || (d.tries || 0) > 0;
        if (struggle) t.srs = { stage: 0, due: startOfDay(e.t) + INTERVALS[0] * DAY };
        else if (t.srs && !t.srs.done && startOfDay(e.t) >= startOfDay(t.srs.due)) {
          const st = t.srs.stage + 1;
          t.srs = st >= INTERVALS.length ? { stage: st, done: true, due: null } : { stage: st, due: startOfDay(e.t) + INTERVALS[st] * DAY };
        }
        (s.days[dayKey(e.t)] ||= { minutes: 0, tasks: 0 }).tasks++;
        break;
      }
      case 'known': (s.numbers[d.num] ||= {}).known = { score: d.score, total: d.total, t: e.t }; break;
      case 'step': { const n = (s.numbers[d.num] ||= {}); (n.seen ||= {})[d.part] = e.t; break; }
      case 'diag': s.diag[d.num] = { level: d.level, t: e.t }; break;
      case 'note': if (d.text) s.notes[d.key] = { text: d.text, t: e.t, title: d.title }; else delete s.notes[d.key]; break;
      case 'mark': if (d.on) s.marks[d.key] = { t: e.t, title: d.title }; else delete s.marks[d.key]; break;
      case 'formula': if (d.on) s.formulas[d.key] = { t: e.t, tex: d.tex, title: d.title }; else delete s.formulas[d.key]; break;
      case 'day': (s.days[d.date] ||= { minutes: 0, tasks: 0 }).minutes += d.minutes || 0; break;
      case 'mock': s.mocks.push({ ...d, t: e.t }); break;
      case 'setting': s.settings[d.key] = d.value; break;
    }
  }
  return s;
}

/** Задачи, которые пора повторить сегодня (просроченные — первыми) */
export function dueReviews(s, now = Date.now()) {
  return Object.entries(s.tasks).filter(([, t]) => t.srs && !t.srs.done && t.srs.due <= startOfDay(now) + DAY - 1)
    .sort((a, b) => a[1].srs.due - b[1].srs.due).map(([id, t]) => ({ id, num: t.num, due: t.srs.due, stage: t.srs.stage }));
}

/** Серия: подряд идущие учебные дни (день считается, если решено ≥ 5 задач или ≥ 30 минут); выходные по плану серию не рвут */
export function streak(s, now = Date.now(), studyDays = [1, 2, 3, 4, 5, 6]) {
  let n = 0, t = startOfDay(now);
  const active = (k) => { const d = s.days[k]; return d && (d.tasks >= 5 || d.minutes >= 30); };
  if (!active(dayKey(t))) t -= DAY; // сегодня ещё можно успеть
  for (let i = 0; i < 400; i++, t -= DAY) {
    const wd = new Date(t).getDay();
    if (active(dayKey(t))) n++;
    else if (!studyDays.includes(wd)) continue;
    else break;
  }
  return n;
}

export const level = (xp) => { const lv = Math.floor(Math.sqrt(xp / 50)) + 1; const next = 50 * lv * lv; return { lv, xp, next, prev: 50 * (lv - 1) ** 2 }; };

/** Освоение номера 0..1: доля типов, где последняя попытка последней задачи типа верна без подсказок; «уже знаю» сдан — 0.8 минимум */
export function mastery(s, catalogNum, tasksOfNum = []) {
  const types = {};
  for (const t of tasksOfNum) { const st = s.tasks[t.id]; if (!st?.last) continue; const prev = types[t.type]; if (!prev || st.last.t > prev.t) types[t.type] = { t: st.last.t, good: st.last.ok && !st.last.hints }; }
  const allTypes = new Set(tasksOfNum.map((t) => t.type));
  let m = allTypes.size ? Object.values(types).filter((x) => x.good).length / allTypes.size : 0;
  const k = s.numbers[catalogNum.id]?.known;
  if (k && k.total && k.score / k.total >= 0.99) m = Math.max(m, 0.8);
  const dg = s.diag[catalogNum.id]; if (dg) m = Math.max(m, [0, 0.3, 0.6, 0.85][dg.level] ?? 0);
  return Math.min(1, m);
}

// Шкалы 2026 (исследование\шкалы.md); математика 2027 — прогноз: p * 32/33 по таблице 2026
const SCALE_M = [0, 6, 11, 17, 22, 27, 34, 40, 46, 52, 58, 64, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 95, 96, 97, 98, 99, 100, 100, 100];
const SCALE_F = [0, 5, 9, 14, 18, 23, 27, 32, 36, 39, 41, 43, 44, 46, 48, 49, 51, 53, 54, 56, 58, 59, 61, 62, 64, 65, 67, 68, 70, 71, 73, 74, 76, 77, 79, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100];
export function testScore(subject, primary) {
  if (subject === 'физика') return SCALE_F[Math.max(0, Math.min(45, Math.round(primary)))];
  const p = Math.max(0, Math.min(32, (primary * 32) / 33)), lo = Math.floor(p), hi = Math.min(32, lo + 1);
  return Math.round(SCALE_M[lo] + (SCALE_M[hi] - SCALE_M[lo]) * (p - lo));
}
/** Прогноз: первичный = Σ баллов номера × освоение; затем шкала */
export function forecast(s, catalog, tasksById = {}) {
  const out = {};
  for (const subject of ['математика', 'физика']) {
    const nums = catalog.filter((n) => n.subject === subject);
    const primary = nums.reduce((sum, n) => sum + n.points * mastery(s, n, tasksById[n.id] || []), 0);
    const max = nums.reduce((sum, n) => sum + n.points, 0);
    out[subject] = { primary: Math.round(primary * 10) / 10, max, test: testScore(subject, primary) };
  }
  return out;
}
