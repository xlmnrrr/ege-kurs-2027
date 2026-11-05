// node tools/test-calc.mjs — проверка разборщика калькулятора (без браузера)
globalThis.document = { createElement: () => ({ content: {} }) };
const { evaluate, fmt } = await import('../assets/js/calc.js');
let fail = 0;
const t = (expr, want, o) => { let got; try { got = evaluate(expr, o); } catch (e) { got = 'ошибка: ' + e.message; } const ok = typeof want === 'number' ? Math.abs(got - want) <= Math.abs(want) * 1e-9 + 1e-12 : String(got).startsWith(want); if (!ok) fail++; console.log(ok ? '✓' : '✗', expr, '=', got, ok ? '' : `(ждали ${want})`); };
t('2+3×4', 14); t('(2+3)×4', 20); t('2^3^2', 512); t('-2^2', -4); t('3E-6×2', 6e-6); t('1,5+1,5', 3);
t('sin(30)', 0.5); t('cos(60)', 0.5); t('tg(45)', 1); t('sin(π÷2)', 1, { deg: false });
t('√(16)', 4); t('2π', 2 * Math.PI); t('2(3+1)', 8); t('10÷4', 2.5); t('1,6E-19×6E23', 96000);
t('g×2', 20, { consts: { g: 10 } }); t('k×1E-9×1E-9÷0,1^2', 9e-7, { consts: { k: 9e9 } });
t('2+', 'ошибка'); t('(2', 'ошибка'); t('2)', 'ошибка');
console.log(fmt(3e-6), fmt(0.5), fmt(123456789), fmt(-2.5));
console.log(fail ? `ОШИБОК: ${fail}` : 'все проверки калькулятора пройдены'); process.exit(fail ? 1 : 0);
