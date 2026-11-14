// Снимок всех рисунков номера по всем шагам (как на iPhone): node tools/fig-check.mjs математика/03 [файл.png] [начало имени, напр. задачаM01T6]
// Нужен сервер с корнем проекта на 8111: node tools/dev-server.mjs "D:\road\HARNESS + CLAUDE.br/ПРОЕКТЫ/курс егэ физика математика" 8111
import { launch, sleep } from './cdp.mjs';
const [n, out = `fig-${n.replace(/\W+/g, '-')}.png`, only = ''] = process.argv.slice(2);
const b = await launch(); const p = await b.tab();
const errs = [];
p.on('Runtime.exceptionThrown', (e) => errs.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
await p.size(860, 900, { dpr: 2 });
await p.open('http://127.0.0.1:8111/' + encodeURI(`сайт/tools/fig-preview.html?n=${n}&f=${only}`));
await p.until('document.body.dataset.ready==="1"', 15000); await sleep(600);
const h = await p.run('document.body.scrollHeight');
await p.size(860, Math.min(h + 20, 12000), { dpr: 1.5 }); await sleep(400);
await p.shot(out);
const inner = await p.run('window.__errs');
console.log(`${n}: ${await p.run("document.querySelectorAll('.cell').length")} кадров → ${out}`);
console.log('ошибки:', [...inner, ...errs].length ? [...inner, ...errs].join(' | ') : 'нет');
await b.close();
