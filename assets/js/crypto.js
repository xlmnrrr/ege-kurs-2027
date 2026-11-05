// Шифрование курса (браузер и Node 20+: одинаковый WebCrypto). Схема — АРХИТЕКТУРА.md §3.1–3.2.
// Пароль -> PBKDF2-SHA-256 (600 000) -> KEK (AES-GCM) -> расшифровка ключа данных K -> K расшифровывает пакеты.
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
export const ITER = 600000;
const CHECK = 'ege-kurs-2027';

export const b64 = (u8) => { let s = ''; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** KEK из пароля */
export async function kekFrom(password, salt, iter = ITER) {
  const base = await subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Ключ данных K из сырых байт; extractable только в сборке (Node), в браузере — нет */
export const importK = (raw, extractable = false) => subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);

export async function seal(key, bytes) { // -> [1 версия][12 IV][шифр+тег]
  const iv = rand(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(1 + 12 + ct.length);
  out[0] = 1; out.set(iv, 1); out.set(ct, 13);
  return out;
}
export async function open(key, packed) {
  const a = new Uint8Array(packed);
  if (a[0] !== 1) throw new Error('неизвестная версия пакета');
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: a.subarray(1, 13) }, key, a.subarray(13)));
}
export const sealText = async (key, text) => seal(key, enc.encode(text));
export const openText = async (key, packed) => dec.decode(await open(key, packed));

/** keys.json: K, обёрнутый паролем (используется в tools/set-password.mjs) */
export async function wrapK(rawK, password) {
  const salt = rand(16);
  const kek = await kekFrom(password, salt);
  const wrapped = await seal(kek, rawK);
  const k = await importK(rawK);
  const check = await sealText(k, CHECK);
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), wrapped: b64(wrapped), check: b64(check) };
}

/** Вход: пароль + keys.json -> неизвлекаемый CryptoKey K (или ошибка «неверный пароль») */
export async function unlock(password, keys) {
  const kek = await kekFrom(password, unb64(keys.salt), keys.iter);
  let raw;
  try { raw = await open(kek, unb64(keys.wrapped)); } catch { throw new Error('PASSWORD'); }
  const k = await importK(raw, false);
  raw.fill(0);
  if ((await openText(k, unb64(keys.check))) !== CHECK) throw new Error('PASSWORD');
  return k;
}

/** Токен синхронизации: HMAC(K-производный, "sync") — сервер видит только его хэш */
export async function syncToken(k) {
  const probe = await subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, k, enc.encode('sync-token-v1'));
  const h = await subtle.digest('SHA-256', probe);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Пакет курса: расшифровать + распаковать gzip (DecompressionStream есть в Safari 16.4+, Chrome 80+) */
export async function openJSON(key, packed) {
  const raw = await open(key, packed);
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
