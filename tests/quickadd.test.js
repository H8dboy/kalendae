// Test parser quick-add: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd } from '../src/js/logic/quickadd.js';

// "now" fisso nei test: lunedì 13 luglio 2026
const NOW = new Date(2026, 6, 13, 10, 0);

test('domani + orario hh:mm', () => {
  const r = parseQuickAdd('domani 15:00 chiamare commercialista', NOW);
  assert.equal(r.date, '2026-07-14');
  assert.equal(r.time, '15:00');
  assert.equal(r.title, 'chiamare commercialista');
});

test('oggi', () => {
  const r = parseQuickAdd('oggi spesa', NOW);
  assert.equal(r.date, '2026-07-13');
  assert.equal(r.title, 'spesa');
});

test('dopodomani', () => {
  const r = parseQuickAdd('dopodomani dentista', NOW);
  assert.equal(r.date, '2026-07-15');
  assert.equal(r.title, 'dentista');
});

test('giorno della settimana = prossima occorrenza, mai oggi', () => {
  // NOW è lunedì: "lunedì" deve dare il lunedì successivo
  const r = parseQuickAdd('lunedì riunione', NOW);
  assert.equal(r.date, '2026-07-20');
  const v = parseQuickAdd('venerdì aperitivo', NOW);
  assert.equal(v.date, '2026-07-17');
});

test('giorno della settimana senza accento', () => {
  const r = parseQuickAdd('lunedi riunione', NOW);
  assert.equal(r.date, '2026-07-20');
});

test('data esplicita gg/mm', () => {
  const r = parseQuickAdd('15/08 grigliata', NOW);
  assert.equal(r.date, '2026-08-15');
});

test('data gg/mm già passata → anno prossimo', () => {
  const r = parseQuickAdd('01/01 capodanno', NOW);
  assert.equal(r.date, '2027-01-01');
});

test('data completa gg/mm/aaaa', () => {
  const r = parseQuickAdd('08/08/2026 lancio M4TR1X', NOW);
  assert.equal(r.date, '2026-08-08');
  assert.equal(r.title, 'lancio M4TR1X');
});

test('"alle 15" → 15:00', () => {
  const r = parseQuickAdd('domani alle 15 corriere', NOW);
  assert.equal(r.time, '15:00');
  assert.equal(r.title, 'corriere');
});

test('orario con punto 15.30', () => {
  const r = parseQuickAdd('oggi 15.30 palestra', NOW);
  assert.equal(r.time, '15:30');
});

test('solo testo: nessuna data, resta task', () => {
  const r = parseQuickAdd('comprare filtro lavatrice', NOW);
  assert.equal(r.date, null);
  assert.equal(r.time, null);
  assert.equal(r.title, 'comprare filtro lavatrice');
});

test('orario non valido ignorato', () => {
  const r = parseQuickAdd('appunti 99:99 vari', NOW);
  assert.equal(r.time, null);
});
