// Test export iCal e backup: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeIcsText } from '../src/js/logic/ics.js';
import { buildBackup, parseBackup } from '../src/js/logic/backup.js';

const NOW = new Date(Date.UTC(2026, 6, 13, 10, 0));

test('ics: struttura base e solo attività con data', () => {
  const ics = buildIcs([
    { id: 1, title: 'Evento', date: '2026-07-14', time: '15:00', done: 0 },
    { id: 2, title: 'Task senza data', date: null },
  ], NOW);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Evento'));
  assert.ok(!ics.includes('Task senza data'));
  assert.ok(ics.includes('DTSTART:20260714T150000'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('ics: evento senza ora = tutto il giorno', () => {
  const ics = buildIcs([{ id: 3, title: 'Compleanno', date: '2026-08-08' }], NOW);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260808'));
});

test('ics: ricorrenza → RRULE', () => {
  const ics = buildIcs([{ id: 4, title: 'Palestra', date: '2026-07-13', recurrence: 'weekly' }], NOW);
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY'));
});

test('ics: escaping di virgole, punto e virgola e a capo', () => {
  assert.equal(escapeIcsText('a,b;c\nd'), 'a\\,b\\;c\\nd');
});

test('ics: righe terminate con CRLF', () => {
  const ics = buildIcs([], NOW);
  assert.ok(ics.includes('\r\n'));
});

test('backup: round-trip', () => {
  const dump = {
    groups: [{ id: 1, name: 'Generale', created_at: 'x' }],
    activities: [], subtasks: [], recurrence_done: [],
    note_folders: [{ id: 1, name: 'Senza cartella', created_at: 'x' }],
    notes: [], settings: [],
  };
  const parsed = parseBackup(buildBackup(dump, NOW));
  assert.deepEqual(parsed, dump);
});

test('backup: rifiuta json estraneo', () => {
  assert.throws(() => parseBackup('{"foo": 1}'));
  assert.throws(() => parseBackup(JSON.stringify({ app: 'agenda-h8', version: 1, data: { groups: [] } })));
});
