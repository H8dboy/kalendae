// Test logica Task: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubtaskTree, subtaskProgress, dailyStreak, prevIso } from '../src/js/logic/tasks.js';

test('buildSubtaskTree: 2 livelli, ordinati per position', () => {
  const rows = [
    { id: 1, parent_id: null, position: 1, done: 0 },
    { id: 2, parent_id: null, position: 0, done: 0 },
    { id: 3, parent_id: 2, position: 1, done: 0 },
    { id: 4, parent_id: 2, position: 0, done: 1 },
  ];
  const tree = buildSubtaskTree(rows);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].id, 2);            // position 0 prima
  assert.equal(tree[1].id, 1);
  assert.deepEqual(tree[0].children.map(c => c.id), [4, 3]); // figli ordinati
  assert.equal(tree[1].children.length, 0);
});

test('buildSubtaskTree: parent_id undefined trattato come radice', () => {
  const tree = buildSubtaskTree([{ id: 1, position: 0, done: 0 }]);
  assert.equal(tree.length, 1);
});

test('subtaskProgress conta tutti i livelli', () => {
  const rows = [
    { id: 1, parent_id: null, done: 1 },
    { id: 2, parent_id: null, done: 0 },
    { id: 3, parent_id: 2, done: 1 },
  ];
  assert.deepEqual(subtaskProgress(rows), { done: 2, total: 3 });
});

test('subtaskProgress su lista vuota', () => {
  assert.deepEqual(subtaskProgress([]), { done: 0, total: 0 });
});

test('prevIso attraversa i confini di mese/anno', () => {
  assert.equal(prevIso('2026-03-01'), '2026-02-28');
  assert.equal(prevIso('2026-01-01'), '2025-12-31');
});

test('dailyStreak: fatto oggi + giorni precedenti consecutivi', () => {
  const dates = ['2026-07-23', '2026-07-22', '2026-07-21', '2026-07-19'];
  assert.equal(dailyStreak(dates, '2026-07-23'), 3);  // 23,22,21 (19 è staccato)
});

test('dailyStreak: oggi non fatto ma ieri sì → streak fino a ieri', () => {
  const dates = ['2026-07-22', '2026-07-21'];
  assert.equal(dailyStreak(dates, '2026-07-23'), 2);
});

test('dailyStreak: né oggi né ieri → 0', () => {
  assert.equal(dailyStreak(['2026-07-20'], '2026-07-23'), 0);
});

test('dailyStreak: nessun completamento → 0', () => {
  assert.equal(dailyStreak([], '2026-07-23'), 0);
});
