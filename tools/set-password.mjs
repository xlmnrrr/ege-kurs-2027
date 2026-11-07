// Пароль курса. Пароль знает только Макар: вводится здесь, нигде не сохраняется, в data/keys.json — только обёрнутый ключ.
//   node tools/set-password.mjs          — спросит пароль дважды (ввод скрыт), запишет data/keys.json
//   node tools/set-password.mjs --dev    — тестовый пароль из ..\справки\тестовый-пароль.txt (создаст, если нет) — только для разработки
// Ключ данных K (32 байта) — ..\справки\ключ-данных.bin, создаётся один раз; им шифруется весь контент (tools/build.mjs).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';
import { wrapK } from '../assets/js/crypto.js';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRAVKI = join(SITE, '..', 'справки');
export const K_FILE = join(SPRAVKI, 'ключ-данных.bin');
export function dataKey() {
  mkdirSync(SPRAVKI, { recursive: true });
  if (!existsSync(K_FILE)) writeFileSync(K_FILE, randomBytes(32));
  return new Uint8Array(readFileSync(K_FILE));
}

function ask(prompt) { // скрытый ввод без пакетов
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin; let s = '';
    stdin.setRawMode?.(true); stdin.resume(); stdin.setEncoding('utf8');
    const on = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') { stdin.setRawMode?.(false); stdin.pause(); stdin.off('data', on); process.stdout.write('\n'); resolve(s); }
      else if (ch === '\u0003') process.exit(1);
      else if (ch === '\u007f' || ch === '\b') s = s.slice(0, -1);
      else s += ch;
    };
    stdin.on('data', on);
  });
}

const argName = () => { const i = process.argv.indexOf('--name'); return i > 0 ? process.argv[i + 1] : null; };
const account = (name, password) => `${String(name).trim().toLowerCase()}\n${password}`;   // как в assets/js/app.js

async function main() {
  let password;
  if (process.argv.includes('--dev')) {
    const f = join(SPRAVKI, 'тестовый-пароль.txt');
    if (!existsSync(f)) {
      const words = ['лампа', 'вектор', 'призма', 'импульс', 'парабола', 'катет', 'фотон', 'медиана', 'логарифм', 'индукция'];
      writeFileSync(f, `${words[randomInt(10)]}-${words[randomInt(10)]}-${randomInt(100, 999)}\n`);
    }
    password = readFileSync(f, 'utf8').trim();
    // тестовый аккаунт «test» — только для локальных автотестов: справки\keys-dev.json, на сайт не попадает
    writeFileSync(join(SPRAVKI, 'keys-dev.json'), JSON.stringify(await wrapK(dataKey(), account('test', password)), null, 1));
    console.log('Тестовый аккаунт test (пароль в', f + ') → справки\keys-dev.json; data/keys.json не тронут.');
    return;
  } else if (process.env.EGE_PASSWORD) {
    password = process.env.EGE_PASSWORD;   // для запуска без терминала; в файлы не пишется
  } else {
    const a = await ask('Новый пароль курса (не короче 10 символов): ');
    const b = await ask('Ещё раз: ');
    if (a !== b) { console.log('Пароли не совпали — ничего не изменено.'); process.exit(1); }
    if (a.length < 8) { console.log('Слишком короткий: нужно 8+ символов.'); process.exit(1); }
    password = a;
  }
  const name = argName();
  if (!name) { console.log('Укажи имя аккаунта: node tools/set-password.mjs --name ИМЯ'); process.exit(1); }
  const keys = { ...(await wrapK(dataKey(), account(name, password))), login: 'name+password' };
  mkdirSync(join(SITE, 'data'), { recursive: true });
  writeFileSync(join(SITE, 'data', 'keys.json'), JSON.stringify(keys, null, 1));
  console.log('Готово: data/keys.json обновлён. Контент перешифровывать не нужно (ключ данных тот же).');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
