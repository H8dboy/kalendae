// Sezione TASK: gruppi personalizzabili con le loro attività.
// Mostra tutte le attività (quelle con data hanno un badge-data e vivono
// anche sul calendario). Filtri: gruppo, priorità, aperte/fatte.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog, esc } from '../ui/modal.js';
import { openActivityModal } from './activityModal.js';

const $ = id => document.getElementById(id);

const filters = { group: null, prio: null, state: 'open' };  // state: 'all'|'open'|'done'
const collapsed = new Set();

export function initTasks() {
  $('fabTask').addEventListener('click', () =>
    openActivityModal({ onChange: render }));
}

export async function render() {
  await renderFilters();
  await renderList();
}

async function renderFilters() {
  const groups = await db.listGroups();
  const bar = $('taskFilters');
  bar.innerHTML = '';

  const chip = (label, active, onTap) => {
    const b = document.createElement('button');
    b.className = 'fchip' + (active ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { onTap(); render(); });
    bar.appendChild(b);
  };

  chip(t('filter_open'), filters.state === 'open', () => (filters.state = 'open'));
  chip(t('filter_done'), filters.state === 'done', () => (filters.state = 'done'));
  chip(t('filter_all'), filters.state === 'all', () => (filters.state = 'all'));
  chip('⬤ ' + t('prio_high'), filters.prio === 2, () => (filters.prio = filters.prio === 2 ? null : 2));
  for (const g of groups) {
    chip(g.name, filters.group === g.id, () => (filters.group = filters.group === g.id ? null : g.id));
  }
  // "+ gruppo" in coda ai filtri
  chip('+ ' + t('group_label').toLowerCase(), false, async () => {
    const name = await promptDialog(t('new_group'), t('group_name_label'), t('group_placeholder'));
    if (!name) return;
    try { await db.createGroup(name); } catch { toast(t('name_exists')); }
    render();
  });
}

function matchesFilters(a) {
  if (filters.state === 'open' && a.done) return false;
  if (filters.state === 'done' && !a.done) return false;
  if (filters.prio !== null && a.priority !== filters.prio) return false;
  return true;
}

async function renderList() {
  const groups = await db.listGroups();
  const acts = await db.listActivities();
  const list = $('taskList');
  list.innerHTML = '';

  for (const g of groups) {
    if (filters.group !== null && g.id !== filters.group) continue;
    const items = acts.filter(a => a.group_id === g.id && matchesFilters(a));

    const box = document.createElement('div');
    box.className = 'group' + (collapsed.has(g.id) ? ' collapsed' : '');

    const head = document.createElement('div');
    head.className = 'ghead';
    head.innerHTML = `<span>${esc(g.name)}</span>
      <span class="count">${items.filter(a => !a.done).length} ${t('open_count')}</span>`;

    // + task nel gruppo
    const add = iconBtn('＋', t('add'), () =>
      openActivityModal({ presetGroup: g.id, onChange: render }));
    head.appendChild(add);

    if (g.id !== 1) {
      head.appendChild(iconBtn('✎', t('rename_group'), async () => {
        const name = await promptDialog(t('rename_group'), t('group_name_label'), '', g.name);
        if (!name || name === g.name) return;
        try { await db.renameGroup(g.id, name); } catch { toast(t('name_exists')); }
        render();
      }));
      head.appendChild(iconBtn('✕', t('delete'), async () => {
        if (!(await confirmDialog(t('confirm_delete_group')))) return;
        await db.deleteGroup(g.id);
        render();
      }));
    }

    head.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      collapsed.has(g.id) ? collapsed.delete(g.id) : collapsed.add(g.id);
      box.classList.toggle('collapsed');
    });
    box.appendChild(head);

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'gbody';
    if (!items.length) {
      const e = document.createElement('div');
      e.className = 'sub';
      e.textContent = t('empty');
      bodyWrap.appendChild(e);
    }
    for (const a of items) bodyWrap.appendChild(taskRow(a));
    box.appendChild(bodyWrap);
    list.appendChild(box);
  }
}

function iconBtn(txt, label, onTap) {
  const b = document.createElement('button');
  b.className = 'icon-btn iconbtn-mini';
  b.style.minWidth = b.style.minHeight = '38px';
  b.style.fontSize = '15px';
  b.textContent = txt;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', e => { e.stopPropagation(); onTap(); });
  return b;
}

function taskRow(a) {
  const row = document.createElement('div');
  row.className = 'task' + (a.done ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!a.done;
  cb.setAttribute('aria-label', `${t('done_label')}: ${a.title}`);
  cb.addEventListener('change', async () => {
    // La spunta salva automaticamente data e ora di completamento.
    const doneAt = await db.setDone(a.id, cb.checked);
    if (cb.checked) toast(`${t('done_prefix')} ✓ ${doneAt}`);
    render();
  });

  const body = document.createElement('div');
  body.className = 'body';
  const meta = [];
  if (a.date) meta.push(`<span class="datebadge">📅 ${a.date}${a.time ? ' ' + a.time : ''}</span>`);
  if (a.done && a.done_at) meta.push(`<span class="doneAt">${t('done_prefix')} ${a.done_at}</span>`);
  if (!a.date && !a.done) meta.push(t('no_deadline'));
  body.innerHTML = `<div class="title">${esc(a.title)}</div><div class="meta">${meta.join(' ')}</div>`;
  body.addEventListener('click', () => openActivityModal({ id: a.id, onChange: render }));

  row.appendChild(cb);
  row.appendChild(body);
  return row;
}
