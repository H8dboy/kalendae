// Test della logica ore di lavoro (h/m ⇄ minuti, totale mese).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hmToMinutes, minutesToHm, fmtMinutes, fmtMinutesShort, sumMonth } from '../src/js/logic/workhours.js';

test('hmToMinutes: conversione base e valori sporchi', () => {
  assert.equal(hmToMinutes(7, 30), 450);
  assert.equal(hmToMinutes(0, 0), 0);
  assert.equal(hmToMinutes('8', '15'), 495);
  assert.equal(hmToMinutes(-2, -10), 0);        // negativi → 0
  assert.equal(hmToMinutes('abc', ''), 0);      // non numerici → 0
  assert.equal(hmToMinutes(1.9, 2.9), 62);      // decimali troncati
});

test('minutesToHm: round-trip con hmToMinutes', () => {
  assert.deepEqual(minutesToHm(450), { h: 7, m: 30 });
  assert.deepEqual(minutesToHm(59), { h: 0, m: 59 });
  assert.deepEqual(minutesToHm(0), { h: 0, m: 0 });
  assert.deepEqual(minutesToHm(-5), { h: 0, m: 0 });
  const min = hmToMinutes(12, 45);
  assert.deepEqual(minutesToHm(min), { h: 12, m: 45 });
});

test('fmtMinutes: formati 7h 30m / 45m / 3h / 0m', () => {
  assert.equal(fmtMinutes(450), '7h 30m');
  assert.equal(fmtMinutes(45), '45m');
  assert.equal(fmtMinutes(180), '3h');
  assert.equal(fmtMinutes(0), '0m');
});

test('fmtMinutesShort: formato H:MM per la casella', () => {
  assert.equal(fmtMinutesShort(450), '7:30');
  assert.equal(fmtMinutesShort(45), '0:45');
  assert.equal(fmtMinutesShort(605), '10:05');
});

test('sumMonth: somma solo i giorni del mese richiesto', () => {
  const rows = [
    { date: '2026-07-01', minutes: 480 },
    { date: '2026-07-15', minutes: 450 },
    { date: '2026-06-30', minutes: 300 },   // mese diverso: esclusa
    { date: '2026-07-31', minutes: 90 },
  ];
  assert.equal(sumMonth(rows, '2026-07'), 480 + 450 + 90);
  assert.equal(sumMonth(rows, '2026-06'), 300);
  assert.equal(sumMonth(rows, '2026-01'), 0);
  assert.equal(sumMonth([], '2026-07'), 0);
  assert.equal(sumMonth(null, '2026-07'), 0);
});

test('sumMonth: non confonde 2026-1 con 2026-11 e ignora minuti negativi', () => {
  const rows = [
    { date: '2026-11-02', minutes: 60 },
    { date: '2026-01-02', minutes: 30 },
    { date: '2026-11-03', minutes: -50 },  // corrotto: ignorato
  ];
  assert.equal(sumMonth(rows, '2026-1'), 0);   // mese va scritto 'YYYY-MM'
  assert.equal(sumMonth(rows, '2026-01'), 30);
  assert.equal(sumMonth(rows, '2026-11'), 60);
});
