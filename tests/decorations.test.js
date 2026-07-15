// Test decorazioni festive del calendario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorationMap, chineseZodiac, CNY_DATES } from '../src/js/logic/decorations.js';

const emojisOn = (year, dateIso) =>
  (decorationMap(year).get(dateIso) ?? []).map(d => d.emoji);

test('date fisse: Halloween, Natale, San Silvestro, Capodanno', () => {
  assert.deepEqual(emojisOn(2026, '2026-10-31'), ['🎃']);
  assert.deepEqual(emojisOn(2026, '2026-12-25'), ['🎄']);
  assert.deepEqual(emojisOn(2026, '2026-12-31'), ['🎆']);
  assert.deepEqual(emojisOn(2026, '2026-01-01'), ['🎇']);
  assert.deepEqual(emojisOn(2026, '2026-02-14'), ['❤️']);
});

test('Pasqua e Carnevale mobili (2026: Pasqua 5 aprile, martedì grasso 17 febbraio)', () => {
  assert.deepEqual(emojisOn(2026, '2026-04-05'), ['🐣']);
  assert.deepEqual(emojisOn(2026, '2026-02-17').includes('🎭'), true);
});

test('Capodanno cinese 2026: 17 febbraio, anno del cavallo', () => {
  const d = decorationMap(2026).get('2026-02-17') ?? [];
  const cny = d.find(x => x.key === 'deco_cny');
  assert.ok(cny, 'manca la decorazione CNY');
  assert.equal(cny.emoji, '🐎');
});

test('zodiaco cinese: ciclo corretto', () => {
  assert.equal(chineseZodiac(2024).key, 'dragon');
  assert.equal(chineseZodiac(2025).key, 'snake');
  assert.equal(chineseZodiac(2026).key, 'horse');
  assert.equal(chineseZodiac(2020).key, 'rat');
  assert.equal(chineseZodiac(2036).key, 'dragon');   // 12 anni dopo il 2024
});

test('CNY fuori tabella: nessuna decorazione, nessun errore', () => {
  const map = decorationMap(2100);
  for (const [, arr] of map) {
    assert.ok(!arr.some(d => d.key === 'deco_cny'));
  }
});

test('tabella CNY: date plausibili (21 gen – 20 feb) e ciclo continuo', () => {
  for (const [y, md] of Object.entries(CNY_DATES)) {
    const [m, d] = md.split('-').map(Number);
    const ok = (m === 1 && d >= 21) || (m === 2 && d <= 20);
    assert.ok(ok, `CNY ${y} fuori finestra: ${md}`);
  }
});
