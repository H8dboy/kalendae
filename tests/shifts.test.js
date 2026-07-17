// Test della logica turni (durata dagli orari, totale mese, overnight).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftMinutes, sumMonthShifts } from '../src/js/logic/shifts.js';

test('shiftMinutes: turno diurno base', () => {
  assert.equal(shiftMinutes('06:00', '14:00'), 480); // 8h
  assert.equal(shiftMinutes('09:30', '17:00'), 450); // 7h30
  assert.equal(shiftMinutes('00:00', '08:00'), 480);
});

test('shiftMinutes: overnight scavalca la mezzanotte', () => {
  assert.equal(shiftMinutes('22:00', '06:00'), 480); // 8h notte
  assert.equal(shiftMinutes('23:30', '07:30'), 480);
  assert.equal(shiftMinutes('20:00', '20:00'), 24 * 60); // stesso orario = 24h
});

test('shiftMinutes: senza orario o valori sporchi = 0 (Riposo/Ferie)', () => {
  assert.equal(shiftMinutes('', ''), 0);
  assert.equal(shiftMinutes('06:00', ''), 0);
  assert.equal(shiftMinutes('', '14:00'), 0);
  assert.equal(shiftMinutes('abc', '14:00'), 0);
  assert.equal(shiftMinutes('25:00', '30:00'), 0); // ore fuori range
  assert.equal(shiftMinutes(null, undefined), 0);
});

test('sumMonthShifts: somma solo i giorni del mese richiesto', () => {
  const types = {
    1: { start: '06:00', end: '14:00' }, // 480
    2: { start: '14:00', end: '22:00' }, // 480
    3: { start: '', end: '' },           // Riposo → 0
  };
  const assign = [
    { date: '2026-07-01', shift_id: 1 },
    { date: '2026-07-02', shift_id: 2 },
    { date: '2026-07-03', shift_id: 3 },
    { date: '2026-08-01', shift_id: 1 }, // altro mese, ignorato
  ];
  assert.equal(sumMonthShifts(assign, types, '2026-07'), 960); // 480+480+0
  assert.equal(sumMonthShifts(assign, types, '2026-08'), 480);
  assert.equal(sumMonthShifts(assign, types, '2026-09'), 0);
});

test('sumMonthShifts: funziona anche con una Map e ignora id sconosciuti', () => {
  const types = new Map([[1, { start: '22:00', end: '06:00' }]]);
  const assign = [
    { date: '2026-07-10', shift_id: 1 },   // 480 overnight
    { date: '2026-07-11', shift_id: 99 },  // tipo inesistente → 0
  ];
  assert.equal(sumMonthShifts(assign, types, '2026-07'), 480);
  assert.equal(sumMonthShifts([], types, '2026-07'), 0);
  assert.equal(sumMonthShifts(null, types, '2026-07'), 0);
});
