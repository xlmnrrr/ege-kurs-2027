'use strict';
// Синхронизация прогресса «ЕГЭ курс 2027» (ПК ↔ iPhone) — Yandex Cloud Function, среда nodejs22.
// Тот же протокол, что у локального сервера tools/dev-server.mjs (АРХИТЕКТУРА.md §5):
//   POST, заголовок x-token, тело {after, push:[{id, blob}]} → {cursor, pull:[{id, blob}]}
// Хранилище — закрытый бакет Object Storage (переменная SYNC_BUCKET), объекты в том же формате, что у локального сервера:
//   journal.jsonl — строки {seq, id, blob}; token.sha256 — хэш токена (первое устройство регистрирует его).
// Сервер видит только шифротекст: события шифруются ключом из пароля ещё на устройстве.
// Доступ к бакету — IAM-токеном сервисного аккаунта функции (context.token), ключи в коде и переменных не нужны.
// Переменные: SYNC_BUCKET — имя закрытого бакета; ALLOWED_ORIGINS — адреса сайта через запятую.

const crypto = require('crypto');

const S3 = 'https://storage.yandexcloud.net';
const OVERLAP = 50;          // отдаём записи немного «назад» от курсора: защита от гонки двух устройств, дубли клиент отбрасывает по id
const MAX_BODY = 5e6;
const TRIES = 4;

function header(event, name) {
    const h = event.headers || {};
    const k = Object.keys(h).find((x) => x.toLowerCase() === name);
    return k ? String(h[k]) : '';
}

function cors(origin) {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const h = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, x-token',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
    return h;
}

function json(statusCode, body, h) {
    return { statusCode, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

async function s3(method, key, iam, body) {
    const r = await fetch(`${S3}/${process.env.SYNC_BUCKET}/${key}`, {
        method,
        headers: { Authorization: `Bearer ${iam}`, ...(body !== undefined ? { 'Content-Type': 'text/plain; charset=utf-8' } : {}) },
        body
    });
    if (method === 'GET' && r.status === 404) return null;
    if (!r.ok) throw new Error(`хранилище ${method} ${key}: ${r.status}`);
    return method === 'GET' ? r.text() : '';
}

function rowsOf(text) {
    return (text || '').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function tokenOk(token, iam) {
    if (!token || token.length < 32) return false;
    const h = crypto.createHash('sha256').update(token).digest();
    const saved = await s3('GET', 'token.sha256', iam);
    if (saved === null) { await s3('PUT', 'token.sha256', iam, h.toString('hex')); return true; }   // первое устройство регистрирует токен
    const b = Buffer.from(saved.trim(), 'hex');
    return b.length === h.length && crypto.timingSafeEqual(b, h);
}

exports.handler = async (event, context) => {
    const h = cors(header(event, 'origin'));
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
    if (event.httpMethod !== 'POST') return json(405, { error: 'method' }, h);
    const iam = context && context.token && context.token.access_token;
    if (!iam || !process.env.SYNC_BUCKET) return json(500, { error: 'не настроены сервисный аккаунт или SYNC_BUCKET' }, h);
    try {
        if (!(await tokenOk(header(event, 'x-token'), iam))) return json(401, { error: 'token' }, h);
        const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
        if (raw.length > MAX_BODY) return json(413, { error: 'too large' }, h);
        const { after = 0, push = [] } = JSON.parse(raw || '{}');
        const mine = (Array.isArray(push) ? push : []).filter((r) => r && typeof r.id === 'string' && typeof r.blob === 'string');
        let rows = rowsOf(await s3('GET', 'journal.jsonl', iam));
        // запись с проверкой: два устройства могут писать одновременно — перечитываем и дописываем потерянное
        for (let k = 0; k < TRIES; k++) {
            const ids = new Set(rows.map((r) => r.id));
            const add = mine.filter((r) => !ids.has(r.id));
            if (!add.length) break;
            let seq = rows.length ? rows[rows.length - 1].seq : 0;
            for (const r of add) rows.push({ seq: ++seq, id: r.id, blob: r.blob });
            await s3('PUT', 'journal.jsonl', iam, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
            rows = rowsOf(await s3('GET', 'journal.jsonl', iam));
        }
        const have = new Set(rows.map((r) => r.id));
        if (mine.some((r) => !have.has(r.id))) return json(503, { error: 'busy' }, h);   // клиент оставит события в очереди и повторит
        const from = Math.max(0, (Number(after) || 0) - OVERLAP);
        const cursor = rows.length ? rows[rows.length - 1].seq : 0;
        return json(200, { cursor, pull: rows.filter((r) => r.seq > from).map(({ id, blob }) => ({ id, blob })) }, h);
    } catch (e) {
        return json(400, { error: String(e.message) }, h);
    }
};
