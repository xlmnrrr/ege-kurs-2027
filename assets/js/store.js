// IndexedDB «ege»: keys (ключ K устройства), events (журнал прогресса), outbox (не отправлено), meta (курсор, устройство, настройки)
const DB = 'ege', VER = 1;
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of ['keys', 'meta']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      if (!d.objectStoreNames.contains('events')) d.createObjectStore('events', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (store, mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); // пустое значение -> undefined, а не сам запрос
    t.onerror = () => rej(t.error);
  });
};
export const get = (store, key) => tx(store, 'readonly', (s) => s.get(key));
export const put = (store, val, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
export const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
export const all = (store) => tx(store, 'readonly', (s) => s.getAll());
export const clear = (store) => tx(store, 'readwrite', (s) => s.clear());
export async function putMany(store, vals) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, 'readwrite'); const s = t.objectStore(store); vals.forEach((v) => s.put(v)); t.oncomplete = res; t.onerror = () => rej(t.error); }); }

/** Устройство: постоянный короткий id */
export async function deviceId() {
  let id = await get('meta', 'device');
  if (!id) { id = (crypto.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 8); await put('meta', id, 'device'); }
  return id;
}

/** Новое событие прогресса: в журнал и в очередь синхронизации */
let devCache = null;
export async function record(type, data, t = Date.now()) {
  devCache ||= await deviceId();
  const ev = { id: `${t.toString(36)}-${devCache}-${Math.random().toString(36).slice(2, 7)}`, t, dev: devCache, type, data };
  const d = await db();
  await new Promise((res, rej) => { const x = d.transaction(['events', 'outbox'], 'readwrite'); x.objectStore('events').put(ev); x.objectStore('outbox').put(ev); x.oncomplete = res; x.onerror = () => rej(x.error); });
  return ev;
}
