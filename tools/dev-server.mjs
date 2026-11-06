// Локальный сервер курса без пакетов.
//   node tools/dev-server.mjs [корень] [порт]            — http://127.0.0.1:порт (по умолчанию корень — сайт, порт 8110)
//   node tools/dev-server.mjs [корень] [порт] --https    — https на всех адресах (iPhone по Wi-Fi), сертификат из ..\справки\https\
//        + http://IP:8109/ca.crt — отдаёт ТОЛЬКО публичный сертификат центра для установки на iPhone
// API синхронизации прогресса (то же, что будет у облачной функции, см. АРХИТЕКТУРА.md §3.5):
//   POST /sync  заголовок x-token, тело {after, push:[{id, blob}]} -> {cursor, pull:[{id, blob}]}
//   хранилище — ..\справки\sync\ (только шифротекст; токен хранится как sha256)
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { createHash, timingSafeEqual } from 'node:crypto';
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const TOOLS = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT = resolve(args[0] || join(TOOLS, '..'));
const PORT = Number(args[1] || 8110);
const HTTPS = process.argv.includes('--https');
const SPRAVKI = resolve(TOOLS, '..', '..', 'справки');
const SYNC = process.env.EGE_SYNC_DIR || join(SPRAVKI, 'sync'); // для автотестов — своя папка
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8',
};
const ZIP = /\.(html|css|js|mjs|json|svg|txt|webmanifest|ttf|md)$/;

// ---------- синхронизация ----------
function syncState() {
  mkdirSync(SYNC, { recursive: true });
  const f = join(SYNC, 'journal.jsonl');
  const rows = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { f, rows, ids: new Set(rows.map((r) => r.id)) };
}
function checkToken(token) {
  if (!token || token.length < 32) return false;
  const tf = join(SYNC, 'token.sha256');
  const h = createHash('sha256').update(token).digest();
  if (!existsSync(tf)) { mkdirSync(SYNC, { recursive: true }); writeFileSync(tf, h.toString('hex')); return true; } // первое устройство регистрирует токен
  const saved = Buffer.from(readFileSync(tf, 'utf8').trim(), 'hex');
  return saved.length === h.length && timingSafeEqual(saved, h);
}
function handleSync(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
  req.on('end', () => {
    try {
      if (!checkToken(req.headers['x-token'])) { res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"token"}'); return; }
      const { after = 0, push = [] } = JSON.parse(body || '{}');
      const st = syncState();
      let seq = st.rows.length;
      for (const r of push) {
        if (!r || typeof r.id !== 'string' || typeof r.blob !== 'string' || st.ids.has(r.id)) continue;
        const row = { seq: ++seq, id: r.id, blob: r.blob };
        appendFileSync(st.f, JSON.stringify(row) + '\n'); st.rows.push(row); st.ids.add(r.id);
      }
      const pull = st.rows.filter((r) => r.seq > after).map(({ id, blob }) => ({ id, blob }));
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ cursor: seq, pull }));
    } catch (e) { res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: String(e.message) })); }
  });
}

// ---------- статика ----------
function handler(req, res) {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/sync' && req.method === 'POST') return handleSync(req, res);
  // локально синхронизируемся со своим сервером, даже если в data/config.json адрес облачной функции (EGE_CLOUD_SYNC=1 — проверить облако)
  if (p === '/data/config.json' && !process.env.EGE_CLOUD_SYNC) { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end('{ "syncUrl": "/sync" }'); return; }
  let file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404'); return; }
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const head = { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (p.endsWith('/sw.js')) head['service-worker-allowed'] = '/';
  if (ZIP.test(file) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...head, 'content-encoding': 'gzip' });
    createReadStream(file).pipe(createGzip()).pipe(res);
  } else {
    res.writeHead(200, { ...head, 'content-length': statSync(file).size });
    createReadStream(file).pipe(res);
  }
}

if (HTTPS) {
  const dir = join(SPRAVKI, 'https');
  createHttps({ key: readFileSync(join(dir, 'server.key')), cert: readFileSync(join(dir, 'server.crt')) }, handler)
    .listen(PORT, '0.0.0.0', () => console.log(`https://<IP-ПК>:${PORT}/  ->  ${ROOT}`));
  createHttp((req, res) => {
    if (new URL(req.url, 'http://x').pathname === '/ca.crt') {
      res.writeHead(200, { 'content-type': 'application/x-x509-ca-cert', 'content-disposition': 'attachment; filename="ege-kurs-ca.crt"' });
      createReadStream(join(dir, 'ca.crt')).pipe(res);
    } else res.writeHead(404).end();
  }).listen(8109, '0.0.0.0', () => console.log('сертификат для iPhone: http://<IP-ПК>:8109/ca.crt'));
} else {
  createHttp(handler).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/  ->  ${ROOT}`));
}
