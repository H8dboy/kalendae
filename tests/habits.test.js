// Test della logica Astinenza (streak nel tempo + conteggio giornaliero).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStamp, elapsed, streakDays, bestOf,
  sumRange, loggedDays, reduced, reducedRange,
  savedStreakCents, savedCounterCents,
} from '../src/js/logic/habits.js';

test('parseStamp: formati validi e non', () => {
  assert.equal(parseStamp('2026-07-21 08:30').getHours(), 8);
  assert.equal(parseStamp('2026-07-21').getHours(), 0);         // solo data = mezzanotte
  assert.equal(parseStamp('2026-07-21T08:30').getMinutes(), 30); // separatore T
  assert.equal(parseStamp(''), null);
  assert.equal(parseStamp(null), null);
  assert.equal(parseStamp('non-una-data'), null);
});

test('elapsed: giorni/ore/minuti dallo start', () => {
  const start = new Date(2026, 6, 20, 10, 0); // 20 lug 10:00
  const now = new Date(2026, 6, 23, 14, 30);  // 23 lug 14:30 → 3g 4h 30m
  const e = elapsed(start, now);
  assert.equal(e.days, 3);
  assert.equal(e.hours, 4);
  assert.equal(e.minutes, 30);
});

test('elapsed: start nel futuro o assente = zeri', () => {
  const now = new Date(2026, 6, 20, 10, 0);
  const future = new Date(2026, 6, 25, 10, 0);
  assert.deepEqual(elapsed(future, now), { days: 0, hours: 0, minutes: 0, ms: 0 });
  assert.deepEqual(elapsed(null, now), { days: 0, hours: 0, minutes: 0, ms: 0 });
});

test('streakDays: giorni interi da una stringa stamp', () => {
  const now = new Date(2026, 6, 21, 9, 0);
  assert.equal(streakDays('2026-07-18 09:00', now), 3);
  assert.equal(streakDays('2026-07-21 08:00', now), 0); // meno di un giorno
});

test('bestOf: tiene il massimo, mai negativo', () => {
  assert.equal(bestOf(10, 3), 10);
  assert.equal(bestOf(3, 10), 10);
  assert.equal(bestOf(0, 0), 0);
  assert.equal(bestOf(-5, 4), 4);
});

const counts = [
  { date: '2026-07-01', value: 8 },
  { date: '2026-07-02', value: 5 },
  { date: '2026-07-20', value: 3 },
  { date: '2026-08-01', value: 10 },
];

test('sumRange: somma solo dentro l’intervallo', () => {
  assert.equal(sumRange(counts, '2026-07-01', '2026-07-31'), 16); // 8+5+3
  assert.equal(sumRange(counts, '2026-08-01', '2026-08-31'), 10);
  assert.equal(sumRange([], '2026-07-01', '2026-07-31'), 0);
});

test('loggedDays: giorni distinti con voce', () => {
  assert.equal(loggedDays(counts, '2026-07-01', '2026-07-31'), 3);
});

test('reduced: quantità in meno rispetto al solito', () => {
  assert.equal(reduced(3, 20), 17);
  assert.equal(reduced(25, 20), 0);   // di più del solito → 0, non negativo
  assert.equal(reduced(5, null), 0);  // senza baseline
});

test('reducedRange: somma dei "in meno" sui giorni loggati', () => {
  // baseline 20: (20-8)+(20-5)+(20-3) = 12+15+17 = 44 in luglio
  assert.equal(reducedRange(counts, 20, '2026-07-01', '2026-07-31'), 44);
  assert.equal(reducedRange(counts, null, '2026-07-01', '2026-07-31'), 0);
});

test('soldi risparmiati: streak e counter', () => {
  assert.equal(savedStreakCents(10, 500), 5000);   // 10 giorni × 5,00 = 50,00
  assert.equal(savedStreakCents(10, null), 0);
  assert.equal(savedCounterCents(44, 25), 1100);    // 44 sigarette × 0,25 = 11,00
  assert.equal(savedCounterCents(44, 0), 0);
});
