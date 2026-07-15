// Test logica importi (parsing, formattazione, somme).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, fmtAmount, sumInstallments, paidPercent } from '../src/js/logic/money.js';

test('parseAmount: formati comuni', () => {
  assert.equal(parseAmount('1234'), 123400);
  assert.equal(parseAmount('1234.56'), 123456);
  assert.equal(parseAmount('1234,56'), 123456);
  assert.equal(parseAmount('1.234,56'), 123456);
  assert.equal(parseAmount('1,234.56'), 123456);
  assert.equal(parseAmount('0,5'), 50);
  assert.equal(parseAmount('250'), 25000);
});

test('parseAmount: simboli valuta e spazi ignorati', () => {
  assert.equal(parseAmount('€ 250'), 25000);
  assert.equal(parseAmount('$1,000.00'), 100000);
  assert.equal(parseAmount(' 99,90 '), 9990);
});

test('parseAmount: separatore seguito da 3 cifre = migliaia', () => {
  assert.equal(parseAmount('1.234'), 123400);
  assert.equal(parseAmount('12.345.678'), 1234567800);
});

test('parseAmount: input non validi → null', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('12a'), null);
  assert.equal(parseAmount(null), null);
});

test('parseAmount: negativi', () => {
  assert.equal(parseAmount('-50'), -5000);
  assert.equal(parseAmount('-1.234,56'), -123456);
});

test('fmtAmount: separatori per lingua', () => {
  // CLDR: l'italiano raggruppa le migliaia solo da 5 cifre intere in su.
  assert.equal(fmtAmount(123456, 'it'), '1234,56');
  assert.equal(fmtAmount(1234567, 'it'), '12.345,67');
  assert.equal(fmtAmount(123456, 'en'), '1,234.56');
  assert.equal(fmtAmount(0, 'en'), '0.00');
  assert.equal(fmtAmount(50, 'it'), '0,50');
});

test('round-trip parse → fmt', () => {
  assert.equal(fmtAmount(parseAmount('12.345,67'), 'it'), '12.345,67');
  assert.equal(fmtAmount(parseAmount('1,234.56'), 'en'), '1,234.56');
});

test('sumInstallments e paidPercent', () => {
  const rows = [{ amount: 25000 }, { amount: 25000 }, { amount: 10000 }];
  assert.equal(sumInstallments(rows), 60000);
  assert.equal(sumInstallments([]), 0);
  assert.equal(paidPercent(60000, 120000), 50);
  assert.equal(paidPercent(150000, 120000), 100);  // clamp
  assert.equal(paidPercent(60000, 0), null);       // senza totale
  assert.equal(paidPercent(60000, null), null);
});
