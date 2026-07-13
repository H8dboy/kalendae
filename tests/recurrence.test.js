// Test ricorrenze: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occursOn, occurrencesBetween, toIso, parseIso } from '../src/js/logic/recurrence.js';

test('attività senza ricorrenza occorre solo nella sua data', () => {
  const a = { date: '2026-07-13', recurrence: null };
  assert.equal(occursOn(a, '2026-07-13'), true);
  assert.equal(occursOn(a, '2026-07-14'), false);
});

test('attività senza data non occorre mai', () => {
  assert.equal(occursOn({ date: null, recurrence: 'daily' }, '2026-07-13'), false);
});

test('mai prima della data di partenza', () => {
  const a = { date: '2026-07-13', recurrence: 'daily' };
  assert.equal(occursOn(a, '2026-07-12'), false);
  assert.equal(occursOn(a, '2026-07-13'), true);
});

test('daily: tutti i giorni successivi', () => {
  const a = { date: '2026-07-13', recurrence: 'daily' };
  assert.equal(occursOn(a, '2026-07-14'), true);
  assert.equal(occursOn(a, '2027-01-01'), true);
});

test('weekly: stesso giorno della settimana', () => {
  const a = { date: '2026-07-13', recurrence: 'weekly' }; // lunedì
  assert.equal(occursOn(a, '2026-07-20'), true);   // lunedì dopo
  assert.equal(occursOn(a, '2026-07-21'), false);  // martedì
});

test('monthly: stesso giorno del mese; il 31 salta i mesi corti', () => {
  const a = { date: '2026-01-31', recurrence: 'monthly' };
  assert.equal(occursOn(a, '2026-03-31'), true);
  assert.equal(occursOn(a, '2026-02-28'), false); // febbraio non ha il 31
  assert.equal(occursOn(a, '2026-04-30'), false);
});

test('yearly: stesso giorno e mese', () => {
  const a = { date: '2026-08-08', recurrence: 'yearly' };
  assert.equal(occursOn(a, '2027-08-08'), true);
  assert.equal(occursOn(a, '2027-08-09'), false);
});

test('yearly 29 febbraio: solo anni bisestili', () => {
  const a = { date: '2024-02-29', recurrence: 'yearly' };
  assert.equal(occursOn(a, '2028-02-29'), true);
  assert.equal(occursOn(a, '2026-02-28'), false);
});

test('occurrencesBetween espande le occorrenze nel range', () => {
  const a = { date: '2026-07-13', recurrence: 'weekly' };
  assert.deepEqual(
    occurrencesBetween(a, '2026-07-01', '2026-07-31'),
    ['2026-07-13', '2026-07-20', '2026-07-27']
  );
});

test('occurrencesBetween: singola per attività non ricorrente', () => {
  const a = { date: '2026-07-13', recurrence: null };
  assert.deepEqual(occurrencesBetween(a, '2026-07-01', '2026-07-31'), ['2026-07-13']);
  assert.deepEqual(occurrencesBetween(a, '2026-08-01', '2026-08-31'), []);
});

test('toIso/parseIso round-trip', () => {
  assert.equal(toIso(parseIso('2026-07-13')), '2026-07-13');
});
