// Маленький Markdown для контента курса (формат — скилл ege-kurs, references/шаблон-номера.md).
// Поддержка: front matter, ## и ###, абзацы, списки, таблицы, **жирный**, *курсив*, `код`, [ссылка](url),
// формулы $…$ и $$…$$ (KaTeX, пререндер), блоки ::: тип аргумент … ::: (тело — подмножество YAML или Markdown).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const katex = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'vendor', 'katex', 'katex.min.js'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const mathErrors = [];

export function tex(src, display = false) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: true, output: 'html', strict: 'ignore', trust: false });
  } catch (e) {
    mathErrors.push(`${src}: ${e.message}`);
    return `<code class="tex-err">${esc(src)}</code>`;
  }
}

/** Строчная разметка: формулы сначала (чтобы * и _ внутри формул не трогать) */
export function inline(s) {
  const math = [];
  s = s.replace(/\$\$([^$]+)\$\$/g, (_, m) => { math.push(tex(m.trim(), true)); return `\u0000${math.length - 1}\u0000`; });
  // формула + прилипший знак препинания не разрываются переносом
  // короткая формула + прилипший знак препинания не разрываются; длинная может переноситься по знакам = + −
  s = s.replace(/\$([^$\n]+?)\$([.,;:!?)»]*)/g, (_, m, p) => { const t = tex(m.trim()); math.push(m.trim().length <= 16 ? `<span class="nb">${t}${esc(p)}</span>` : `${t}${esc(p)}`); return `\u0000${math.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => math[+i]);
}

/** Подмножество YAML для блоков: key: value, списки «- ключ: значение» с продолжением строк */
export function yaml(text) {
  const out = {}; let curList = null, curItem = null, curKey = null, lastObj = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const ind = raw.length - raw.trimStart().length, line = raw.trim();
    let m;
    if (ind === 0 && (m = /^([^:\s][^:]*):\s*(.*)$/.exec(line))) {
      curKey = m[1].trim();
      if (m[2] === '') { out[curKey] = []; curList = out[curKey]; curItem = null; lastObj = null; }
      else { out[curKey] = m[2]; curList = null; lastObj = [out, curKey]; }
    } else if (curList && (m = /^-\s+([^:]+):\s*(.*)$/.exec(line))) {
      curItem = { [m[1].trim()]: m[2] }; curList.push(curItem); lastObj = [curItem, m[1].trim()];
    } else if (curList && (m = /^-\s+(.*)$/.exec(line))) {
      curList.push(m[1]); lastObj = [curList, curList.length - 1];
    } else if (curItem && (m = /^([^:\s][^:]*):\s*(.*)$/.exec(line)) && !line.startsWith('$')) {
      curItem[m[1].trim()] = m[2]; lastObj = [curItem, m[1].trim()];
    } else if (lastObj) { // продолжение предыдущего значения
      lastObj[0][lastObj[1]] += '\n' + line;
    }
  }
  return out;
}

/** Markdown-документ -> {meta, html, blocks} ; blockHandler(type, arg, body) -> html */
export function md(source, blockHandler = () => '') {
  let meta = {};
  source = source.replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (fm) { meta = yaml(fm[1]); source = source.slice(fm[0].length); }
  const lines = source.split('\n');
  const html = []; let para = [], list = null, table = null;
  const flush = () => {
    if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; }
    if (table) {
      const [head, , ...rows] = table;
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      html.push(`<div class="tbl"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      table = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = /^:::\s*([\p{L}\d-]+)\s*(.*)$/u.exec(line))) { // блок
      flush();
      const body = []; i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) body.push(lines[i++]);
      html.push(blockHandler(m[1], m[2].trim(), body.join('\n')));
      continue;
    }
    if (/^\$\$\s*$/.test(line)) { // многострочная формула
      flush(); const body = []; i++;
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) body.push(lines[i++]);
      html.push(`<div class="mathd">${tex(body.join('\n'), true)}</div>`); continue;
    }
    if ((m = /^\$\$(.+)\$\$\s*(.*)$/.exec(line))) { flush(); html.push(`<div class="mathd">${tex(m[1], true)}</div>`); if (m[2]) para.push(m[2]); continue; }
    if ((m = /^(#{2,3})\s+(.+)$/.exec(line))) {
      flush(); const lvl = m[1].length, text = m[2].trim();
      const id = text.toLowerCase().replace(/<[^>]+>|\$[^$]*\$/g, '').replace(/[^\p{L}\d]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
      html.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`); continue;
    }
    if (/^\|.*\|\s*$/.test(line)) { if (!table) { flush(); table = []; } table.push(line.trim()); continue; }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(line)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (para.length || table || (list && list.tag !== tag)) flush();
      if (!list) list = { tag, items: [] };
      list.items.push(m[1]); continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (list && /^\s{2,}/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    if (table) flush();
    para.push(line.trim());
  }
  flush();
  return { meta, html: html.join('\n') };
}

/** Текст для озвучки: формулы -> слова (упрощённо), разметка убрана */
export function speech(src) {
  const w = (t) => t
    .replace(/\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 делить на $2 ')
    .replace(/\\sqrt\{([^{}]+)\}/g, ' корень из $1 ')
    .replace(/\^\{?2\}?/g, ' в квадрате ').replace(/\^\{?3\}?/g, ' в кубе ').replace(/\^\{([^{}]+)\}|\^(\w)/g, ' в степени $1$2 ')
    .replace(/_\{([^{}]+)\}|_(\w)/g, ' $1$2 ')
    .replace(/\\cdot|\\times/g, ' умножить на ').replace(/=/g, ' равно ').replace(/\\ne/g, ' не равно ')
    .replace(/\\le(q)?/g, ' меньше или равно ').replace(/\\ge(q)?/g, ' больше или равно ').replace(/</g, ' меньше ').replace(/>/g, ' больше ')
    .replace(/\+/g, ' плюс ').replace(/-|−/g, ' минус ').replace(/\\pi/g, ' пи ').replace(/\\alpha/g, ' альфа ').replace(/\\beta/g, ' бета ')
    .replace(/\\varphi|\\phi/g, ' фи ').replace(/\\Delta/g, ' дельта ').replace(/\\sin/g, ' синус ').replace(/\\cos/g, ' косинус ')
    .replace(/\\(tg|tan)/g, ' тангенс ').replace(/\\log_?/g, ' логарифм ').replace(/\\parallel/g, ' параллельно ').replace(/\\perp/g, ' перпендикулярно ')
    .replace(/\\angle/g, ' угол ').replace(/\\triangle/g, ' треугольник ').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, ' ');
  return src.replace(/\$\$?([^$]+)\$\$?/g, (_, m) => w(m)).replace(/[*`#|>]/g, ' ').replace(/:::.*$/gm, '').replace(/\s+/g, ' ').trim();
}
