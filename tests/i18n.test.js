// Parità dei dizionari: en.js deve avere ESATTAMENTE le stesse chiavi di it.js
// (una chiave mancante in una lingua = testo che ricade nell'altra a runtime).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import it from '../src/js/i18n/it.js';
import en from '../src/js/i18n/en.js';

test('en ha tutte le chiavi di it (e viceversa)', () => {
  const itKeys = Object.keys(it).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(
    enKeys.filter(k => !itKeys.includes(k)), [],
    'chiavi presenti solo in en'
  );
  assert.deepEqual(
    itKeys.filter(k => !enKeys.includes(k)), [],
    'chiavi presenti solo in it'
  );
});

test('array di date coerenti in entrambe le lingue', () => {
  for (const d of [it, en]) {
    assert.equal(d.months.length, 12);
    assert.equal(d.dows_short.length, 7);
    assert.equal(d.dows_long.length, 7);
  }
});

test('nessuna stringa vuota nei dizionari', () => {
  for (const [lang, d] of [['it', it], ['en', en]]) {
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v)) continue;
      assert.ok(String(v).length > 0, `${lang}.${k} è vuota`);
    }
  }
});
