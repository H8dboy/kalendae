// Test festività: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterWestern, easterOrthodox, getHolidays, holidayMap, COUNTRIES } from '../src/js/logic/holidays.js';

const dates = (code, y) => getHolidays(code, y).map(h => h.date);
const find = (code, y, name) => getHolidays(code, y).find(h => h.name.includes(name));

test('Pasqua occidentale: date note', () => {
  assert.deepEqual(easterWestern(2026), { m: 4, d: 5 });
  assert.deepEqual(easterWestern(2025), { m: 4, d: 20 });
  assert.deepEqual(easterWestern(2027), { m: 3, d: 28 });
  assert.deepEqual(easterWestern(2000), { m: 4, d: 23 });
});

test('Pasqua ortodossa: date note (gregoriane)', () => {
  assert.deepEqual(easterOrthodox(2026), { m: 4, d: 12 });
  assert.deepEqual(easterOrthodox(2025), { m: 4, d: 20 });  // 2025: coincidono
  assert.deepEqual(easterOrthodox(2024), { m: 5, d: 5 });
});

test('Italia 2026: fisse e mobili', () => {
  const it = dates('IT', 2026);
  assert.ok(it.includes('2026-01-01'));
  assert.ok(it.includes('2026-04-06'));  // Lunedì dell'Angelo
  assert.ok(it.includes('2026-06-02'));
  assert.ok(it.includes('2026-12-26'));
  assert.equal(it.length, 12);
});

test('Albania: Bajram con calendario islamico tabulare (±1 giorno)', () => {
  // Eid al-Fitr 2026 atteso intorno al 20 marzo 2026
  const fiter = getHolidays('AL', 2026).filter(h => h.name === 'Fitër Bajrami');
  assert.equal(fiter.length, 1);
  assert.ok(['2026-03-19', '2026-03-20', '2026-03-21'].includes(fiter[0].date), fiter[0].date);
  // Pashkët: cattolica 5/4, ortodossa 12/4
  assert.equal(find('AL', 2026, 'Pashkët Katolike').date, '2026-04-05');
  assert.equal(find('AL', 2026, 'Pashkët Ortodokse').date, '2026-04-12');
});

test('Kosovo: indipendenza e festività doppie', () => {
  const xk = dates('XK', 2026);
  assert.ok(xk.includes('2026-02-17'));
  assert.ok(xk.includes('2026-01-07'));
});

test('USA: festività a giorno-della-settimana', () => {
  assert.equal(find('US', 2026, 'Thanksgiving').date, '2026-11-26');       // 4° giovedì nov
  assert.equal(find('US', 2026, 'Martin Luther').date, '2026-01-19');      // 3° lunedì gen
  assert.equal(find('US', 2026, 'Memorial').date, '2026-05-25');           // ultimo lunedì mag
  assert.equal(find('US', 2026, 'Labor').date, '2026-09-07');              // 1° lunedì set
});

test('Regno Unito: bank holidays 2026', () => {
  assert.equal(find('GB', 2026, 'Early May').date, '2026-05-04');
  assert.equal(find('GB', 2026, 'Spring Bank').date, '2026-05-25');
  assert.equal(find('GB', 2026, 'Summer Bank').date, '2026-08-31');
});

test('Grecia: feste legate alla Pasqua ortodossa', () => {
  assert.equal(find('GR', 2026, 'Καθαρά').date, '2026-02-23');   // Pasqua ort. −48
  assert.equal(find('GR', 2026, 'Δευτέρα του Πάσχα').date, '2026-04-13');
});

test('funziona su anni lontani (range 1583–4000)', () => {
  assert.ok(getHolidays('IT', 1600).length > 0);
  assert.ok(getHolidays('IT', 3000).length > 0);
  assert.deepEqual(getHolidays('IT', 1500), []);   // fuori range
  assert.deepEqual(getHolidays('IT', 4001), []);
});

test('codice sconosciuto o vuoto → nessuna festività', () => {
  assert.deepEqual(getHolidays('', 2026), []);
  assert.deepEqual(getHolidays('ZZ', 2026), []);
});

test('holidayMap raggruppa per data', () => {
  const map = holidayMap('IT', 2026);
  assert.deepEqual(map.get('2026-12-25'), ['Natale']);
  assert.equal(map.get('2026-07-15'), undefined);
});

test('ogni paese ha bandiera e regole', () => {
  for (const c of COUNTRIES) {
    assert.ok(c.flag.length > 0, c.code);
    assert.ok(getHolidays(c.code, 2026).length >= 8, `${c.code} ha poche festività`);
  }
});
