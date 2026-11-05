// PNG-иконки из assets/img/icon.svg через headless Chrome: node tools/make-icons.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(SITE, 'assets/img/icon.svg'), 'utf8');
const b = await launch(); const p = await b.tab();
for (const size of [180, 192, 512]) {
  await p.size(size, size, { dpr: 1 });
  await p.open('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;background:#1C222E">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`));
  await sleep(200);
  await p.shot(join(SITE, `assets/img/icon-${size}.png`), { clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  console.log('icon', size);
}
await b.close();
