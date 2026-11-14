// Сборка контента: ..\контент\<предмет>\NN\ -> data\enc\<id>.bin (AES-GCM), data\enc\catalog.bin, data\version.json
//   node tools/build.mjs            — всё
//   node tools/build.mjs m01 f26    — только эти номера (+ оглавление)
// Формат номера — скилл ege-kurs (references/шаблон-номера.md). Задачи со статусом «спорная» на сайт не идут.
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importK, seal } from '../assets/js/crypto.js';
import { inline, md, mathErrors, speech, yaml } from './md.mjs';
import { dataKey } from './set-password.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(SITE, '..', 'контент');
const OUT = join(SITE, 'data', 'enc');
const SUBJ = { математика: 'm', физика: 'f', русский: 'r' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const warn = [];

function mdText(s) { return md(String(s || '')).html; } // многострочный Markdown -> HTML

function blockHTML(type, arg, body, ctx) {
  if (type === 'рисунок') return `<figure class="fig" data-fig="${esc(arg)}"></figure>`;
  if (type === 'уже-знаю') { const y = yaml(body); ctx.known = String(y.задачи || '').replace(/[[\]\s]/g, '').split(',').filter(Boolean); return '<div class="known-slot"></div>'; }
  if (type === 'пример') {
    const y = yaml(body); const steps = (y.шаги || []).map((s) => ({ name: s.название || '', html: mdText(s.текст || '') }));
    ctx.examples.push({ id: arg, fig: y.рисунок || null, steps, answer: y.ответ || '' });
    if (y.рисунок && !ctx.figNames.has(y.рисунок)) warn.push(`${ctx.id}: пример ${arg} ссылается на нет такого рисунка ${y.рисунок}`);
    return `<section class="example" data-example="${esc(arg)}"></section>`;
  }
  if (type === 'ловушка') return `<aside class="trap"><b>Ловушка.</b> ${mdText(body).replace(/^<p>|<\/p>$/g, '')}</aside>`;
  if (type === 'аргумент') return `<div class="arg-card">${mdText(body)}</div>`; // карточка готового аргумента (русский)
  if (type === 'герои') return `<section class="ru-heroes">${mdText(body)}</section>`; // карточки героев произведения (русский): список «- **Имя** — …»
  if (type === 'зацепки') return `<section class="ru-hooks">${mdText(body)}</section>`; // мелкие зацепки: «- деталь → как использовать»
  if (type === 'проверка') return '<div class="essay-check"></div>'; // живая проверка сочинения (русский)
  if (type === 'подсказка' || type === 'важно') return `<aside class="${type === 'важно' ? 'key' : 'hint'}">${mdText(body)}</aside>`;
  if (type === 'критерии') return `<div class="criteria">${mdText(body)}</div>`;
  warn.push(`${ctx.id}: неизвестный блок ::: ${type}`);
  return '';
}

// ---------- задачи базы-2027 (контент\база-2027\<предмет>\NN\задачи.json, схема v2) ----------
// Идут в бандл первыми, со структурой «Решение»: формулы → идея → способы → ответ → проверка.
// Не публикуются: статус не «ок»; задачи с ошибками линта (обработка\линт-<предмет>.json).
const BASE = join(CONTENT, 'база-2027');
const LEVEL = { Б: 1, П: 2, В: 3 };
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const strip = (html) => String(html).replace(/^<p>|<\/p>\s*$/g, '').trim();
const plainAnswer = (a) => String(a ?? '').replace(/\$/g, '').replace(/\{,\}/g, ',').replace(/\\,|\\;|\\ /g, '').trim();
const isNumeric = (a) => /^[-−]?\d+(?:[.,]\d+)?(?:;[-−]?\d+(?:[.,]\d+)?)*$/.test(plainAnswer(a).replace(/\s/g, ''));
const lintBad = {};
function badIds(subject) {
  if (lintBad[subject]) return lintBad[subject];
  const s = new Set(); const f = join(BASE, 'обработка', `линт-${subject}.json`);
  if (existsSync(f)) for (const e of JSON.parse(readFileSync(f, 'utf8')).ошибки || []) s.add(e.id);
  return (lintBad[subject] = s);
}
function baseTasks(subject, nn, id) {
  const f = join(BASE, subject, nn, 'задачи.json');
  if (!existsSync(f)) return { tasks: [], btypes: [], imgBytes: 0 };
  const all = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '') || '[]');
  const figDir = join(BASE, 'обработка', 'рисунки-сайт', subject, nn);
  const figMap = existsSync(join(figDir, 'карта.json')) ? JSON.parse(readFileSync(join(figDir, 'карта.json'), 'utf8')) : {};
  const bad = badIds(subject), tasks = [], btypes = [], typeId = new Map(), seen = new Set();
  let imgBytes = 0, skipped = 0;
  for (const t of all) {
    if (t.статус !== 'ок') { warn.push(`${id}: задача базы ${t.id} — статус «${t.статус}», не публикуется`); continue; }
    if (bad.has(t.id)) { skipped++; continue; }
    const tid = String(t.id).replace(/[^\p{L}\d]+/gu, '-');
    if (seen.has(tid)) { warn.push(`${id}: дубль id ${tid}`); continue; }
    seen.add(tid);
    const typeName = String(t.тип || 'Без типа').trim();
    if (!typeId.has(typeName)) { typeId.set(typeName, 'b' + (typeId.size + 1)); btypes.push({ id: typeId.get(typeName), title: typeName, n: 0 }); }
    const bt = btypes.find((x) => x.id === typeId.get(typeName)); bt.n++;
    const atype = t.тип_ответа || (isNumeric(t.ответ) ? 'число' : 'развёрнутый');
    const forms = (t.формулы || []).map((x) => (typeof x === 'string' ? { f: strip(mdText(x)), why: '' } : { f: strip(mdText(x.формула || '')), why: strip(mdText(x.зачем || '')) })).filter((x) => x.f);
    const methods = (t.способы || []).map((m) => ({ title: String(m.название || `Способ ${m.n}`), kind: m.вид === 'проверка' ? 'check' : 'solve', order: +m.сложность_порядок || +m.n || 9,
      steps: (m.шаги || []).map((s) => strip(mdText(s))), forms: (m.формулы || []).map((s) => strip(mdText(s))).filter(Boolean), a: strip(mdText(String(m.ответ ?? ''))) }))
      .sort((x, y) => x.order - y.order);
    let img = null;
    if (figMap[t.id] && existsSync(join(figDir, figMap[t.id]))) {
      const buf = readFileSync(join(figDir, figMap[t.id])); imgBytes += buf.length;
      const ext = figMap[t.id].slice(figMap[t.id].lastIndexOf('.'));
      img = { src: `data:${MIME[ext] || 'application/octet-stream'};base64,${buf.toString('base64')}`, alt: String(t.рисунок?.данные || 'Рисунок к задаче').slice(0, 300) };
    }
    const firstSolve = methods.find((m) => m.kind === 'solve');
    const h1 = t.подсказка1 ? mdText(t.подсказка1) : (forms[0]?.why ? `<p>Понадобится: ${forms[0].why}.</p>` : mdText(t.идея || ''));
    const h2 = t.подсказка2 ? mdText(t.подсказка2) : (forms[0]?.why && t.идея ? mdText(t.идея) : (firstSolve?.steps[0] ? `<p>${firstSolve.steps[0]}</p>` : ''));
    tasks.push({ id: tid, base: true, type: bt.id, sub: t.подтип || '', level: LEVEL[t.сложность] || 1, q: mdText(t.условие || ''), fig: null, img,
      a: atype === 'развёрнутый' ? strip(mdText(String(t.ответ))) : plainAnswer(t.ответ), alts: (t.варианты_ответа || []).map(plainAnswer), atype, self: atype === 'развёрнутый', tol: t.допуск || null,
      h1, h2, forms, idea: mdText(t.идея || ''), methods, check: strip(mdText(String(t.проверка || ''))),
      src: { вид: t.источник?.вид || '', где: t.источник?.стр || '', ссылка: t.источник?.url || '' }, known: false, say: speech(t.условие || ''),
      crit: t.критерии ? mdText(t.критерии) : '', max: t.макс || null, choices: Array.isArray(t.выбор) && t.выбор.length ? t.выбор.map((x) => strip(mdText(x))) : null });
  }
  if (skipped) warn.push(`${id}: ${skipped} задач базы с ошибками линта не опубликованы (ждут починки)`);
  return { tasks, btypes, imgBytes };
}

function buildNumber(dir, subject, num) {
  const id = `${SUBJ[subject]}${String(num).padStart(2, '0')}`;
  const src = readFileSync(join(dir, 'номер.md'), 'utf8');
  const figSrc = existsSync(join(dir, 'рисунки.js')) ? readFileSync(join(dir, 'рисунки.js'), 'utf8') : '';
  const figNames = new Set([...figSrc.matchAll(/export\s+(?:async\s+)?function\s+([\p{L}\d_$]+)/gu)].map((m) => m[1]));
  // в тексте рисунки называются в кебаб-регистре: «пример-вписанная» -> примерВписанная
  const camel = (s) => s.replace(/-([\p{L}\d])/gu, (_, c) => c.toUpperCase());
  const ctx = { id, examples: [], known: [], figNames: new Set([...figNames].map((n) => n)) };
  ctx.figNames = { has: (k) => figNames.has(camel(k)) };
  const { meta, html } = md(src, (t, a, b) => blockHTML(t, a, b, ctx));
  ctx.examples.forEach((e) => { if (e.fig) e.fig = camel(e.fig); });
  const tasksAll = existsSync(join(dir, 'задачи.json')) ? JSON.parse(readFileSync(join(dir, 'задачи.json'), 'utf8')) : [];
  const fromBase = baseTasks(subject, String(num).padStart(2, '0'), id);
  const tasks = [...fromBase.tasks];
  const hasBase = fromBase.tasks.length > 0;
  for (const t of tasksAll) {
    const st = t.проверка?.статус;
    if (st === 'спорная') { warn.push(`${id}: задача ${t.id} спорная — не публикуется`); continue; }
    if (st !== 'ок' && st !== 'без_источника') warn.push(`${id}: задача ${t.id} без статуса проверки`);
    tasks.push({ id: t.id, type: t.тип, level: t.уровень || 1, q: mdText(t.условие || ''), fig: t.рисунок ? camel(t.рисунок) : null,
      a: String(t.ответ), tol: t.допуск || null, h1: mdText(t.подсказка1), h2: mdText(t.подсказка2), sol: mdText(t.решение),
      src: t.источник || null, known: !!t.уже_знаю || ctx.known.includes(t.id), say: speech(t.условие || ''), crit: t.критерии ? mdText(t.критерии) : '', max: t.макс || null,
      choices: Array.isArray(t.выбор) && t.выбор.length ? t.выбор.map((x) => mdText(x).replace(/^<p>|<\/p>$/g, '').trim()) : null,
      ...(hasBase ? { more: true } : {}) });   // при наличии базы старые сгенерированные задачи — запас «ещё задачи»
  }
  const bundle = { id, subject, num, meta, html, examples: ctx.examples, tasks, btypes: fromBase.btypes, figures: figSrc, say: speech(src), built: new Date().toISOString() };
  const types = {}; for (const t of tasks) types[t.type] = (types[t.type] || 0) + 1;
  return { id, bundle, imgBytes: fromBase.imgBytes, info: { id, subject, num, title: meta.название || '', points: +meta.баллы || null, minutes: +meta.минуты || null, tasks: tasks.length, baseTasks: fromBase.tasks.length, types, hasContent: true } };
}

async function main() {
  const only = process.argv.slice(2);
  mkdirSync(OUT, { recursive: true });
  const K = await importK(dataKey());
  const catalogBase = JSON.parse(readFileSync(join(CONTENT, 'номера.json'), 'utf8')); // все номера 2027: название, баллы, минуты, часть
  const infos = {};
  for (const [subject, letter] of Object.entries(SUBJ)) {
    const sdir = join(CONTENT, subject);
    if (!existsSync(sdir)) continue;
    for (const nn of readdirSync(sdir).filter((d) => /^\d{2}$/.test(d)).sort()) {
      const dir = join(sdir, nn);
      if (!existsSync(join(dir, 'номер.md'))) continue;
      const id = `${letter}${nn}`;
      if (only.length && !only.includes(id)) { infos[id] = { id, hasContent: true, keep: true }; continue; }
      const { bundle, info, imgBytes } = buildNumber(dir, subject, +nn);
      const bin = await seal(K, gzipSync(Buffer.from(JSON.stringify(bundle)), { level: 9 })); // сжатие до шифрования
      if (bin.length > 1.5 * 1024 * 1024) { console.error(`${id}: бандл ${(bin.length / 1048576).toFixed(2)} МБ — больше 1,5 МБ, не записан (уменьши рисунки)`); process.exitCode = 1; continue; }
      writeFileSync(join(OUT, `${id}.bin`), bin);
      infos[id] = info;
      console.log(`${id}: ${(bin.length / 1024).toFixed(0)} КБ, задач ${info.tasks}${info.baseTasks ? ` (из базы ${info.baseTasks}, рисунки ${(imgBytes / 1024).toFixed(0)} КБ)` : ''}, примеров ${bundle.examples.length}`);
    }
  }
  // диагностика: контент\диагностика\<предмет>.json (+ рисунки.js) -> dm.bin, df.bin
  const ddir = join(CONTENT, 'диагностика');
  if (existsSync(ddir)) {
    const figSrc = existsSync(join(ddir, 'рисунки.js')) ? readFileSync(join(ddir, 'рисунки.js'), 'utf8') : '';
    const camel = (x) => String(x || '').replace(/-([\p{L}\d])/gu, (_, c) => c.toUpperCase());
    for (const [subject, did] of [['математика', 'dm'], ['физика', 'df']]) {
      const f = join(ddir, `${subject}.json`);
      if (!existsSync(f) || (only.length && !only.includes(did))) continue;
      const raw = JSON.parse(readFileSync(f, 'utf8'));
      const tasks = raw.filter((t) => t.проверка?.статус !== 'спорная').map((t) => ({ id: t.id, num: t.номер_id, part: t.часть, q: mdText(t.условие), a: String(t.ответ ?? ''), tol: t.допуск || null,
        fig: t.рисунок ? camel(t.рисунок) : null, sol: mdText(t.решение), criteria: t.критерии ? mdText(t.критерии) : '', max: t.макс || 1, src: t.источник || null }));
      const bin = await seal(K, gzipSync(Buffer.from(JSON.stringify({ id: did, subject, tasks, figures: figSrc })), { level: 9 }));
      writeFileSync(join(OUT, `${did}.bin`), bin);
      console.log(`${did}: диагностика ${subject}, задач ${tasks.length}, ${(bin.length / 1024).toFixed(0)} КБ`);
    }
  }
  // справочник: контент\справочник\{алгебра,геометрия,физика}.md (+ общий рисунки.js) -> sp-a.bin, sp-g.bin, sp-f.bin
  const spdir = join(CONTENT, 'справочник');
  if (existsSync(spdir)) {
    const figSrc = existsSync(join(spdir, 'рисунки.js')) ? readFileSync(join(spdir, 'рисунки.js'), 'utf8') : '';
    const figNames = new Set([...figSrc.matchAll(/export\s+function\s+([\p{L}\d_$]+)/gu)].map((m) => m[1]));
    const camel = (s) => s.replace(/-([\p{L}\d])/gu, (_, c) => c.toUpperCase());
    for (const [name, sid] of [['алгебра', 'sp-a'], ['геометрия', 'sp-g'], ['физика', 'sp-f']]) {
      const f = join(spdir, name + '.md');
      if (!existsSync(f) || (only.length && !only.includes(sid))) continue;
      const ctx = { id: sid, examples: [], known: [], figNames: { has: (k) => figNames.has(camel(k)) } };
      const { meta, html } = md(readFileSync(f, 'utf8'), (t, a, b) => blockHTML(t, a, b, ctx));
      const bin = await seal(K, gzipSync(Buffer.from(JSON.stringify({ id: sid, title: meta.название || name, html, figures: html.includes('data-fig') ? figSrc : '' })), { level: 9 }));
      writeFileSync(join(OUT, `${sid}.bin`), bin);
      console.log(`${sid}: справочник «${meta.название || name}», ${(bin.length / 1024).toFixed(0)} КБ`);
    }
  }
  const catalog = catalogBase.map((n) => ({ ...n, ...(infos[n.id] && !infos[n.id].keep ? infos[n.id] : {}), hasContent: !!infos[n.id] }));
  const cat = await seal(K, gzipSync(Buffer.from(JSON.stringify({ numbers: catalog, built: new Date().toISOString() })), { level: 9 }));
  writeFileSync(join(OUT, 'catalog.bin'), cat);
  const h = createHash('sha256');
  for (const f of readdirSync(OUT).sort()) h.update(f).update(readFileSync(join(OUT, f)));
  const files = readdirSync(OUT).filter((f) => f.endsWith('.bin')).sort();
  const ver = h.digest('hex').slice(0, 12);
  writeFileSync(join(SITE, 'data', 'version.json'), JSON.stringify({ v: ver, files }, null, 1));
  // версия в sw.js: изменился контент или оболочка -> браузер ставит новый Service Worker и обновляет кэш
  const shell = createHash('sha256'); for (const f of ['index.html', 'manifest.webmanifest', ...readdirSync(join(SITE, 'assets', 'js')).map((x) => 'assets/js/' + x), ...readdirSync(join(SITE, 'assets', 'css')).map((x) => 'assets/css/' + x)]) shell.update(readFileSync(join(SITE, f)));
  const swFile = join(SITE, 'sw.js');
  writeFileSync(swFile, readFileSync(swFile, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${ver}-${shell.digest('hex').slice(0, 8)}';`));
  if (mathErrors.length) console.log('ОШИБКИ ФОРМУЛ:\n  ' + mathErrors.join('\n  '));
  if (warn.length) console.log('ПРЕДУПРЕЖДЕНИЯ:\n  ' + warn.join('\n  '));
  console.log(`оглавление: ${catalog.length} номеров, с контентом ${catalog.filter((n) => n.hasContent).length}`);
  if (mathErrors.length) process.exit(1);
}
main();
