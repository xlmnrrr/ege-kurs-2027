// Локальный статический сервер без пакетов: node tools/dev-server.mjs [корень] [порт] [--lan]
// По умолчанию корень — папка сайта, порт 8110, слушает только 127.0.0.1 (--lan — для iPhone по Wi-Fi, этап 4 с mkcert).
// Сжатие gzip как у хостинга, без кэша (для разработки).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT = resolve(args[0] || join(fileURLToPath(import.meta.url), '..', '..'));
const PORT = Number(args[1] || 8110);
const HOST = process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream', '.enc': 'application/octet-stream', '.wasm': 'application/wasm',
};
const ZIP = /\.(html|css|js|mjs|json|svg|txt|webmanifest|ttf)$/;

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404'); return; }
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const head = { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (ZIP.test(file) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...head, 'content-encoding': 'gzip' });
    createReadStream(file).pipe(createGzip()).pipe(res);
  } else {
    res.writeHead(200, { ...head, 'content-length': statSync(file).size });
    createReadStream(file).pipe(res);
  }
}).listen(PORT, HOST, () => console.log(`http://${HOST === '0.0.0.0' ? 'IP-ПК' : '127.0.0.1'}:${PORT}/  ->  ${ROOT}`));
