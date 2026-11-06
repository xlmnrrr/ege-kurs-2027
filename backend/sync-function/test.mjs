// Локальная проверка функции синхронизации без облака: хранилище подменено словарём в памяти.
// node backend/sync-function/test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const store = new Map();
let delay = 0;
globalThis.fetch = async (url, opt) => {
    assert.equal(opt.headers.Authorization, 'Bearer iam-test', 'нет IAM-токена в запросе к хранилищу');
    const key = url.split('/').slice(4).join('/');
    await new Promise((r) => setTimeout(r, delay));
    if (opt.method === 'GET') return store.has(key) ? { ok: true, status: 200, text: async () => store.get(key) } : { ok: false, status: 404 };
    if (opt.method === 'PUT') { await new Promise((r) => setTimeout(r, delay)); store.set(key, opt.body); return { ok: true, status: 200, text: async () => '' }; }
    throw new Error('метод ' + opt.method);
};
process.env.SYNC_BUCKET = 'ege-sync';
process.env.ALLOWED_ORIGINS = 'https://site.example';
const { handler } = require('./index.js');
const ctx = { token: { access_token: 'iam-test' } };
const TOK = 'a'.repeat(44);
const call = (body, token = TOK, method = 'POST') => handler({ httpMethod: method, headers: { Origin: 'https://site.example', 'X-Token': token }, body: JSON.stringify(body), isBase64Encoded: false }, ctx);
const ev = (id) => ({ id, blob: 'шифр-' + id });

let r = await call({}, TOK, 'OPTIONS');
assert.equal(r.statusCode, 204); assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://site.example'); assert.match(r.headers['Access-Control-Allow-Headers'], /x-token/);
r = await call({ after: 0, push: [ev('pc1'), ev('pc2')] });                       // ПК регистрирует токен и отправляет
assert.equal(r.statusCode, 200); assert.deepEqual(JSON.parse(r.body).pull.map((x) => x.id), ['pc1', 'pc2']);
r = await call({ after: 0, push: [] }, 'b'.repeat(44));                          // чужой токен
assert.equal(r.statusCode, 401);
r = await call({ after: 0, push: [ev('ph1')] });                                  // iPhone получает историю ПК
const b = JSON.parse(r.body); assert.equal(b.cursor, 3); assert.deepEqual(b.pull.map((x) => x.id), ['pc1', 'pc2', 'ph1']);
r = await call({ after: 3, push: [ev('ph1')] });                                  // повтор не дублирует
assert.equal(JSON.parse(r.body).cursor, 3);
delay = 5;                                                                         // гонка: два устройства пишут одновременно
const [x, y] = await Promise.all([call({ after: 3, push: [ev('pc3'), ev('pc4')] }), call({ after: 3, push: [ev('ph2')] })]);
assert.equal(x.statusCode, 200); assert.equal(y.statusCode, 200);
const ids = store.get('journal.jsonl').trim().split('\n').map((l) => JSON.parse(l).id);
for (const id of ['pc1', 'pc2', 'ph1', 'pc3', 'pc4', 'ph2']) assert.ok(ids.includes(id), 'потеряна запись ' + id);
assert.equal(new Set(ids).size, ids.length, 'дубли в журнале');
r = await handler({ httpMethod: 'POST', headers: { 'X-Token': TOK }, body: Buffer.from(JSON.stringify({ after: 0, push: [] })).toString('base64'), isBase64Encoded: true }, ctx);
assert.equal(JSON.parse(r.body).pull.length, 6);                                   // тело в base64 читается
console.log('функция синхронизации: все проверки пройдены (CORS, токен, push/pull, повтор, гонка двух устройств, base64)');
