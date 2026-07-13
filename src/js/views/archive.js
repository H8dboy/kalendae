// Archivio fatte: registro delle attività completate, ordinato per done_at
// (le più recenti in alto). Serve come storico "quando ho fatto cosa".
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { esc } from '../ui/modal.js';
import { openActivityModal } from './activityModal.js';

const $ = id => document.getElementById(id);
let groupFilter = null;

export async function render() {
  const rows = await db.listDone();

  // filtri per gruppo (solo gruppi che hanno almeno una fatta)
  const bar = $('archiveFilters');
  bar.innerHTML = '';
  const groups = [...new Map(rows.map(r => [r.group_id, r.group_name])).entries()];
  const chip = (label, active, onTap) => {
    const b = document.createElement('button');
    b.className = 'fchip' + (active ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { onTap(); render(); });
    bar.appendChild(b);
  };
  chip(t('filter_all'), groupFilter === null, () => (groupFilter = null));
  for (const [id, name] of groups)
    chip(name, groupFilter === id, () => (groupFilter = groupFilter === id ? null : id));

  const list = $('archiveList');
  list.innerHTML = '';
  const filtered = rows.filter(r => groupFilter === null || r.group_id === groupFilter);
  if (!filtered.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('archive_empty');
    list.appendChild(e);
    return;
  }

  let lastDay = null;
  for (const a of filtered) {
    const day = a.done_at.slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      const h = document.createElement('div');
      h.className = 'shead';
      h.textContent = day;
      list.appendChild(h);
    }
    const row = document.createElement('div');
    row.className = 'event-row done';
    row.innerHTML = `
      <span class="etime mono">${a.done_at.slice(11)}</span>
      <span class="prio-dot p${a.priority}"></span>
      <span class="etitle">${esc(a.title)}</span>
      <span class="emeta">${esc(a.group_name)}</span>`;
    row.addEventListener('click', () =>
      openActivityModal({ id: a.id, onChange: render }));
    list.appendChild(row);
  }
}
