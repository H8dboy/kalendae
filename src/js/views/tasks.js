// Sezione TASK — due macro-tipi selezionabili con i tab in alto:
//   • DAILY    → routine che si azzerano ogni giorno, con streak per voce
//   • PROGETTI → progetti in gruppi, con sotto-task e sotto-sotto-task (3 livelli)
// Le due modalità condividono l'entità "activity": distingue il campo `kind`.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog, esc } from '../ui/modal.js';
import { openActivityModal } from './activityModal.js';
import { toIso } from '../logic/recurrence.js';
import { buildSubtaskTree, subtaskProgress, dailyStreak } from '../logic/tasks.js';

const $ = id => document.getElementById(id);

let mode = 'project';                                 // 'project' | 'daily'
const filters = { group: null, prio: null, state: 'open' };  // solo modalità progetti
const collapsed = new Set();          // gruppi compressi
const openProjects = new Set();       // progetti con albero aperto
const openSubs = new Set();           // sotto-task con sotto-sotto-task aperte

export function initTasks() {
  $('fabTask').addEventListener('click', () =>
    openActivityModal({
      presetKind: mode,
      presetGroup: mode === 'project' ? (filters.group ?? 1) : 1,
      onChange: render,
    }));
}

export async function render() {
  renderTop();
  if (mode === 'daily') await renderDaily();
  else await renderProjects();
}

/* ================= tab + filtri ================= */
function renderTop() {
  const bar = $('taskFilters');
  bar.className = '';        // contenitore verticale: i figli (tabs + filtri) si impilano
  bar.innerHTML = '';

  const tabs = document.createElement('div');
  tabs.className = 'task-tabs';
  const tab = (label, m) => {
    const b = document.createElement('button');
    b.className = 'ttab' + (mode === m ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { mode = m; render(); });
    tabs.appendChild(b);
  };
  tab(t('tab_daily'), 'daily');
  tab(t('tab_projects'), 'project');
  bar.appendChild(tabs);

  if (mode === 'project') renderFilters(bar);
}

async function renderFilters(bar) {
  const row = document.createElement('div');
  row.className = 'filters';
  const groups = await db.listGroups();

  const chip = (label, active, onTap) => {
    const b = document.createElement('button');
    b.className = 'fchip' + (active ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { onTap(); render(); });
    row.appendChild(b);
  };

  chip(t('filter_open'), filters.state === 'open', () => (filters.state = 'open'));
  chip(t('filter_done'), filters.state === 'done', () => (filters.state = 'done'));
  chip(t('filter_all'), filters.state === 'all', () => (filters.state = 'all'));
  chip('⬤ ' + t('prio_high'), filters.prio === 2, () => (filters.prio = filters.prio === 2 ? null : 2));
  for (const g of groups) {
    chip(g.name, filters.group === g.id, () => (filters.group = filters.group === g.id ? null : g.id));
  }
  chip('+ ' + t('group_label').toLowerCase(), false, async () => {
    const name = await promptDialog(t('new_group'), t('group_name_label'), t('group_placeholder'));
    if (!name) return;
    try { await db.createGroup(name); } catch { toast(t('name_exists')); }
    render();
  });

  bar.appendChild(row);
}

function matchesFilters(a) {
  if (filters.state === 'open' && a.done) return false;
  if (filters.state === 'done' && !a.done) return false;
  if (filters.prio !== null && a.priority !== filters.prio) return false;
  return true;
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

function hint(text) {
  const e = document.createElement('div');
  e.className = 'sub';
  e.textContent = text;
  return e;
}

/* ================= PROGETTI ================= */
async function renderProjects() {
  const groups = await db.listGroups();
  const acts = (await db.listActivities()).filter(a => a.kind === 'project');
  // Sotto-task di tutti i progetti, raggruppate per activity_id.
  const subsByAct = new Map();
  for (const s of await db.listAllSubtasks()) {
    if (!subsByAct.has(s.activity_id)) subsByAct.set(s.activity_id, []);
    subsByAct.get(s.activity_id).push(s);
  }

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

    head.appendChild(iconBtn('＋', t('add'), () =>
      openActivityModal({ presetGroup: g.id, presetKind: 'project', onChange: render })));

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
    if (!items.length) bodyWrap.appendChild(hint(t('empty')));
    for (const a of items) bodyWrap.appendChild(projectRow(a, subsByAct.get(a.id) ?? []));
    box.appendChild(bodyWrap);
    list.appendChild(box);
  }
}

function projectRow(a, subs) {
  const wrap = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'task' + (a.done ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!a.done;
  cb.setAttribute('aria-label', `${t('done_label')}: ${a.title}`);
  cb.addEventListener('change', async () => {
    const doneAt = await db.setDone(a.id, cb.checked);
    if (cb.checked) toast(`${t('done_prefix')} ✓ ${doneAt}`);
    render();
  });

  // freccia apri/chiudi albero sotto-task
  const open = openProjects.has(a.id);
  const caret = document.createElement('button');
  caret.className = 'caret';
  caret.textContent = open ? '▾' : '▸';
  caret.setAttribute('aria-label', t('subtasks_label'));
  caret.addEventListener('click', e => {
    e.stopPropagation();
    open ? openProjects.delete(a.id) : openProjects.add(a.id);
    render();
  });

  const body = document.createElement('div');
  body.className = 'body';
  const meta = [];
  if (a.date) meta.push(`<span class="datebadge">📅 ${a.date}${a.time ? ' ' + a.time : ''}</span>`);
  const prog = subtaskProgress(subs);
  if (prog.total) meta.push(`<span class="prog">☑ ${prog.done}/${prog.total}</span>`);
  if (a.done && a.done_at) meta.push(`<span class="doneAt">${t('done_prefix')} ${a.done_at}</span>`);
  if (!a.date && !a.done && !prog.total) meta.push(t('no_deadline'));
  body.innerHTML = `<div class="title">${esc(a.title)}</div><div class="meta">${meta.join(' ')}</div>`;
  body.addEventListener('click', () => openActivityModal({ id: a.id, onChange: render }));

  row.appendChild(cb);
  row.appendChild(caret);
  row.appendChild(body);
  row.appendChild(iconBtn('＋', t('add_subtask'), () => addSub(a.id, null)));
  wrap.appendChild(row);

  if (open) wrap.appendChild(subtree(a.id, subs));
  return wrap;
}

// Albero sotto-task (2 livelli) di un progetto.
function subtree(activityId, subs) {
  const box = document.createElement('div');
  box.className = 'subtree';
  const tree = buildSubtaskTree(subs);

  if (!tree.length) box.appendChild(hint(t('no_subtasks')));

  for (const node of tree) {
    box.appendChild(subRow(node, 1));
    if (openSubs.has(node.id)) {
      const l2 = document.createElement('div');
      l2.className = 'subtree l2';
      if (!node.children.length) l2.appendChild(hint(t('no_subsubtasks')));
      for (const child of node.children) l2.appendChild(subRow(child, 2));
      box.appendChild(l2);
    }
  }
  return box;
}

// Riga di una sotto-task. level 1 = può avere sotto-sotto-task, level 2 = foglia.
function subRow(s, level) {
  const row = document.createElement('div');
  row.className = 'subtask' + (s.done ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!s.done;
  cb.setAttribute('aria-label', s.title);
  cb.addEventListener('change', async () => { await db.setSubtaskDone(s.id, cb.checked); render(); });
  row.appendChild(cb);

  if (level === 1) {
    const open = openSubs.has(s.id);
    const caret = document.createElement('button');
    caret.className = 'caret';
    caret.textContent = open ? '▾' : '▸';
    caret.setAttribute('aria-label', t('subsubtasks_label'));
    caret.addEventListener('click', () => { open ? openSubs.delete(s.id) : openSubs.add(s.id); render(); });
    row.appendChild(caret);
  }

  const title = document.createElement('span');
  title.className = 'stitle';
  title.textContent = s.title;
  row.appendChild(title);

  if (level === 1) {
    row.appendChild(iconBtn('＋', t('add_subsubtask'), () => addSub(s.activity_id, s.id)));
  }

  const rm = document.createElement('button');
  rm.className = 'rm';
  rm.textContent = '✕';
  rm.setAttribute('aria-label', t('delete'));
  rm.addEventListener('click', async () => {
    if (!(await confirmDialog(t('confirm_delete_subtask')))) return;
    await db.deleteSubtask(s.id);
    openSubs.delete(s.id);
    render();
  });
  row.appendChild(rm);
  return row;
}

// Aggiunge una sotto-task (parentId null) o sotto-sotto-task (parentId valorizzato).
async function addSub(activityId, parentId) {
  const title = await promptDialog(
    parentId ? t('add_subsubtask') : t('add_subtask'),
    t('subtasks_label'), t('subtask_placeholder'));
  if (!title) return;
  await db.addSubtask(activityId, title, parentId);
  openProjects.add(activityId);
  if (parentId) openSubs.add(parentId);
  render();
}

/* ================= DAILY (routine) ================= */
async function renderDaily() {
  const dailies = (await db.listActivities()).filter(a => a.kind === 'daily');
  const today = toIso(new Date());
  const doneToday = new Set(await db.listDailyDoneOn(today));

  const list = $('taskList');
  list.innerHTML = '';

  if (!dailies.length) {
    list.appendChild(hint(t('no_daily')));
    return;
  }

  // Non fatte oggi in cima; a parità, priorità più alta prima.
  dailies.sort((x, y) =>
    (doneToday.has(x.id) - doneToday.has(y.id)) || (y.priority - x.priority) || (x.id - y.id));

  for (const a of dailies) {
    const dates = (await db.listDailyDates(a.id)).map(r => r.date);
    const streak = dailyStreak(dates, today);
    const isDone = doneToday.has(a.id);

    const row = document.createElement('div');
    row.className = 'task' + (isDone ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isDone;
    cb.setAttribute('aria-label', `${t('done_label')}: ${a.title}`);
    cb.addEventListener('change', async () => {
      await db.setDailyDone(a.id, today, cb.checked);
      render();
    });

    const body = document.createElement('div');
    body.className = 'body';
    const streakTxt = streak > 0 ? `<span class="streak-badge">🔥 ${streak} ${t('streak_unit')}</span>` : '';
    body.innerHTML = `<div class="title">${esc(a.title)}</div>
      <div class="meta">${streakTxt || t('daily_meta')}</div>`;
    body.addEventListener('click', () => openActivityModal({ id: a.id, onChange: render }));

    row.appendChild(cb);
    row.appendChild(body);
    row.appendChild(iconBtn('✕', t('delete'), async () => {
      if (!(await confirmDialog(t('confirm_delete_daily')))) return;
      await db.deleteActivity(a.id);
      toast(t('deleted'));
      render();
    }));
    list.appendChild(row);
  }
}
