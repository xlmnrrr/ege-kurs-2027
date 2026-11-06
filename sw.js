// Офлайн: оболочка и все зашифрованные пакеты в кэше. VERSION подставляет tools/build.mjs — новая сборка = новый кэш.
const VERSION = 'a9d374544a54-5a02c807';
const CACHE = `ege-${VERSION}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/tokens.css', 'assets/css/base.css', 'assets/css/v2.css', 'assets/css/chertezh.css', 'assets/vendor/katex/katex.min.css',
  'assets/js/app.js', 'assets/js/crypto.js', 'assets/js/store.js', 'assets/js/progress.js', 'assets/js/plan.js', 'assets/js/number.js',
  'assets/js/chertezh.js', 'assets/js/extras.js', 'assets/js/calc.js', 'assets/js/sync.js', 'assets/js/diag.js', 'assets/js/board.js', 'assets/js/spravka.js', 'assets/js/bg.js', 'assets/js/solid.js', 'assets/js/fx.js',
  'assets/fonts/literata.woff2', 'assets/fonts/literata-italic.woff2', 'assets/fonts/commissioner.woff2',
  'assets/img/icon.svg', 'assets/img/icon-180.png', 'assets/img/icon-192.png', 'assets/img/icon-512.png',
  'data/keys.json', 'data/version.json', 'data/config.json',
  ...['Main-Regular', 'Main-Bold', 'Main-Italic', 'Math-Italic', 'Math-BoldItalic', 'AMS-Regular', 'Size1-Regular', 'Size2-Regular', 'Size3-Regular', 'Size4-Regular', 'Caligraphic-Regular']
    .map((f) => `assets/vendor/katex/fonts/KaTeX_${f}.woff2`),
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache: 'reload' — мимо HTTP-кэша браузера: иначе в новый кэш попадает старая копия (GitHub Pages отдаёт max-age=600)
    const fresh = (u) => new Request(u, { cache: 'reload' });
    await c.addAll(SHELL.map(fresh));
    try { const v = await (await fetch('data/version.json', { cache: 'no-store' })).json(); await c.addAll(v.files.map((f) => fresh(`data/enc/${f}`))); } catch { /* пакеты докачаются по запросу */ }
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })());
});
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // /sync (POST) и чужие адреса — мимо кэша
  const fresh = /\/data\/(version|keys|config)\.json$/.test(url.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (fresh) { try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return (await c.match(e.request)) || Response.error(); } }
    const hit = await c.match(e.request, { ignoreSearch: true }) || (e.request.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit;
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return Response.error(); }
  })());
});
