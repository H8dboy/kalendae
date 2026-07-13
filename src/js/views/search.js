// Ricerca su eventi, task e note (titoli, descrizioni e testo).
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { esc } from '../ui/modal.js';
import { openActivityModal } from './activityModal.js';
import { openNoteFromSearch } from './notes.js';

const $ = id => document.getElementById(id);
let debounce = null;

export function initSearch() {
  $('searchInput').placeholder = t('search_placeholder');
  $('searchInput').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(run, 250);
  });
}

export function focusSearch() {
  $('searchInput').focus();
  run();
}

async function run() {
  const q = $('searchInput').value.trim();
  const box = $('searchResults');
  box.innerHTML = '';
  if (q.length < 2) return;

  const { acts, notes } = await db.searchAll(q);
  const events = acts.filter(a => a.date);
  const tasks = acts.filter(a => !a.date);

  const section = (label, items, renderRow) => {
    if (!items.length) return;
    const h = document.createElement('div');
    h.className = 'shead';
    h.textContent = label;
    box.appendChild(h);
    items.forEach(it => box.appendChild(renderRow(it)));
  };

  section(t('events_section'), events, actRow);
  section(t('tasks_section'), tasks, actRow);
  section(t('notes_section'), notes, noteRow);

  if (!events.length && !tasks.length && !notes.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('no_results');
    box.appendChild(e);
  }
}

function actRow(a) {
  const row = document.createElement('div');
  row.className = 'event-row' + (a.done ? ' done' : '');
  row.innerHTML = `
    <span class="etime mono">${a.date ?? ''}</span>
    <span class="prio-dot p${a.priority}"></span>
    <span class="etitle">${esc(a.title)}</span>`;
  row.addEventListener('click', () => openActivityModal({ id: a.id, onChange: run }));
  return row;
}

function noteRow(n) {
  const row = document.createElement('div');
  row.className = 'note';
  row.innerHTML = `<div class="nbody">
      <div class="ntitle">${esc(n.title || '(…)')}</div>
      <div class="nmeta">${n.updated_at}</div>
    </div>`;
  row.addEventListener('click', () => openNoteFromSearch(n));
  return row;
}
