// Modale attività: creazione e modifica di eventi/task.
// Un'attività CON data appare sul calendario, SENZA data vive solo nella
// sezione Task — il campo data qui è il ponte tra i due mondi.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { openOverlay, closeOverlay, confirmDialog, esc } from '../ui/modal.js';

const $ = id => document.getElementById(id);

let editingId = null;
let priority = 1;
let kind = 'project';      // 'project' | 'daily' — fissato alla creazione
let onChangeCb = null;
let onPickDateCb = null;   // impostata da main: avvia la modalità "scegli giorno"

const nowIso = () => {
  const n = new Date(), p = x => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};
const nowHm = () => {
  const n = new Date(), p = x => String(x).padStart(2, '0');
  return `${p(n.getHours())}:${p(n.getMinutes())}`;
};

/** Etichette del modale dipendenti dalla lingua: al boot e al cambio lingua. */
export function refreshLabels() {
  const prios = [t('prio_low'), t('prio_mid'), t('prio_high')];
  $('fPrio').querySelectorAll('button').forEach((b, i) => (b.textContent = prios[i]));
  const recOpts = $('fRec').options;
  recOpts[0].textContent = t('rec_none');
  recOpts[1].textContent = t('rec_daily');
  recOpts[2].textContent = t('rec_weekly');
  recOpts[3].textContent = t('rec_monthly');
  recOpts[4].textContent = t('rec_yearly');
  $('actCancel').textContent = t('cancel');
  $('actSave').textContent = t('save');
  $('actDelete').textContent = t('delete');
  $('actPickDate').textContent = t('assign_date');
  $('subAddBtn').textContent = t('add');
  $('subInput').placeholder = t('subtask_placeholder');
  $('fTitle').placeholder = t('title_placeholder');
}

export function initActivityModal({ onPickDate }) {
  onPickDateCb = onPickDate;
  refreshLabels();

  $('fPrio').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setPriority(+b.dataset.p);
  });

  $('fDone').addEventListener('change', () => {
    const on = $('fDone').checked;
    $('doneRow').hidden = !on;
    if (on && !$('fDoneDate').value) {
      $('fDoneDate').value = nowIso();
      $('fDoneTime').value = nowHm();
    }
  });

  $('actCancel').addEventListener('click', close);
  $('actOverlay').addEventListener('click', e => { if (e.target.id === 'actOverlay') close(); });

  $('actSave').addEventListener('click', save);

  $('actDelete').addEventListener('click', async () => {
    if (!(await confirmDialog(t('confirm_delete_activity')))) return;
    await db.deleteActivity(editingId);
    toast(t('deleted'));
    close();
    onChangeCb?.();
  });

  $('actPickDate').addEventListener('click', async () => {
    // Prima salva le modifiche correnti, poi passa al calendario in modalità scelta giorno.
    const saved = await save({ keepOpen: false, silent: true });
    if (saved) onPickDateCb?.(saved);
  });

  $('subAddBtn').addEventListener('click', addSubtask);
  $('subInput').addEventListener('keydown', e => { if (e.key === 'Enter') addSubtask(); });
}

function setPriority(p) {
  priority = p;
  $('fPrio').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', +b.dataset.p === p));
}

async function fillGroups(selectedId) {
  const groups = await db.listGroups();
  const s = $('fGroup');
  s.innerHTML = '';
  for (const g of groups) {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.name;
    if (g.id === selectedId) o.selected = true;
    s.appendChild(o);
  }
}

export async function openActivityModal({ id = null, presetDate = null, presetGroup = null, presetKind = 'project', onChange = null } = {}) {
  editingId = id;
  onChangeCb = onChange;
  const a = id ? await db.getActivity(id) : null;
  kind = a?.kind ?? presetKind;
  const daily = kind === 'daily';

  // Un task 'daily' è una routine: niente data, ricorrenza, promemoria,
  // gruppo o sotto-task — solo titolo, note e priorità.
  applyKindVisibility(daily);

  $('actTitle').textContent = daily
    ? (a ? t('edit_daily') : t('new_daily'))
    : (a ? t('edit_activity') : t('new_activity'));
  $('fTitle').value = a?.title ?? '';
  $('fDesc').value = a?.description ?? '';
  await fillGroups(a?.group_id ?? presetGroup ?? 1);
  $('fDate').value = a?.date ?? presetDate ?? '';
  $('fTime').value = a?.time ?? '';
  setPriority(a?.priority ?? 1);
  $('fRec').value = a?.recurrence ?? '';
  $('fReminder').checked = !!a?.reminder;
  $('fDone').checked = !!a?.done;
  $('doneRow').hidden = !a?.done;
  if (a?.done && a.done_at) {
    const [dd, tt] = a.done_at.split(' ');
    $('fDoneDate').value = dd ?? '';
    $('fDoneTime').value = tt ?? '';
  } else {
    $('fDoneDate').value = '';
    $('fDoneTime').value = '';
  }
  $('actDelete').hidden = !a;
  // "assegna data" e sotto-task valgono solo per i progetti (mai per i daily).
  $('actPickDate').hidden = daily || !!a?.date;
  $('subBlock').hidden = daily || !a;    // le sotto-task si aggiungono dopo il primo salvataggio
  if (a && !daily) await renderSubtasks();
  openOverlay('actOverlay');
  $('fTitle').focus();
}

// Mostra/nasconde i campi non pertinenti ai task 'daily'.
function applyKindVisibility(daily) {
  for (const el of ['fGroupLabel', 'fGroup', 'fDateRow', 'fDateHint',
                    'fRecLabel', 'fRec', 'fReminderRow', 'doneChkRow']) {
    $(el).hidden = daily;
  }
  if (daily) $('doneRow').hidden = true;
}

function close() {
  closeOverlay('actOverlay');
  editingId = null;
}

/** @returns {Promise<number|null>} id dell'attività salvata, o null se non valida */
async function save(opts = {}) {
  const title = $('fTitle').value.trim();
  if (!title) { toast(t('missing_title')); return null; }
  const done = $('fDone').checked;
  const daily = kind === 'daily';
  const data = {
    title,
    description: $('fDesc').value.trim(),
    kind,
    // I daily sono routine senza data/gruppo/ricorrenza: si azzerano quei campi.
    group_id: daily ? 1 : +$('fGroup').value,
    date: daily ? null : ($('fDate').value || null),
    time: daily ? null : ($('fTime').value || null),
    priority,
    recurrence: daily ? null : ($('fRec').value || null),
    reminder: daily ? false : $('fReminder').checked,
    done,
    done_at: done ? `${$('fDoneDate').value || nowIso()} ${$('fDoneTime').value || '00:00'}` : null,
  };
  let id = editingId;
  try {
    if (id) await db.updateActivity(id, data);
    else id = await db.createActivity(data);
  } catch {
    toast(t('error_save'));
    return null;
  }
  if (!opts.silent) toast(t('saved'));
  close();
  onChangeCb?.();
  return id;
}

/* ---------- sottoattività (checklist) ---------- */
async function renderSubtasks() {
  const list = $('subList');
  // Nel modale si gestisce solo il 1° livello; le sotto-sotto-task si aggiungono
  // dall'albero inline nella sezione Task.
  const subs = (await db.listSubtasks(editingId)).filter(s => s.parent_id == null);
  list.innerHTML = '';
  for (const s of subs) {
    const row = document.createElement('div');
    row.className = 'subtask' + (s.done ? ' done' : '');
    row.innerHTML = `
      <input type="checkbox" ${s.done ? 'checked' : ''} aria-label="${esc(s.title)}">
      <span class="stitle">${esc(s.title)}</span>
      <button class="rm" aria-label="${t('delete')}">✕</button>`;
    row.querySelector('input').addEventListener('change', async e => {
      await db.setSubtaskDone(s.id, e.target.checked);
      renderSubtasks();
    });
    row.querySelector('.rm').addEventListener('click', async () => {
      await db.deleteSubtask(s.id);
      renderSubtasks();
    });
    list.appendChild(row);
  }
}

async function addSubtask() {
  const v = $('subInput').value.trim();
  if (!v || !editingId) return;
  await db.addSubtask(editingId, v);
  $('subInput').value = '';
  renderSubtasks();
}
