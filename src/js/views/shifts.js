// Sezione TURNI: modelli di turno (sigla + nome + orario + colore).
// L'assegnazione turno→giorno avviene dal calendario (openShiftPicker).
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, esc } from '../ui/modal.js';
import { shiftMinutes } from '../logic/shifts.js';
import { fmtMinutes } from '../logic/workhours.js';

const $ = id => document.getElementById(id);

export function initShifts() {
  $('fabShift').addEventListener('click', () => openShiftModal(null));
}

function mini(txt, onTap) {
  const b = document.createElement('button');
  b.className = 'icon-btn iconbtn-mini';
  b.style.minWidth = b.style.minHeight = '38px';
  b.style.fontSize = '15px';
  b.textContent = txt;
  b.addEventListener('click', e => { e.stopPropagation(); onTap(); });
  return b;
}

// Etichetta orario di un turno: "06:00–14:00 · 8h" oppure il suggerimento riposo.
function range(st) {
  if (st.start && st.end) return `${st.start}–${st.end} · ${fmtMinutes(shiftMinutes(st.start, st.end))}`;
  return t('shift_rest_hint');
}

export async function renderShifts() {
  const list = $('shiftBody');
  const types = await db.listShiftTypes();
  list.innerHTML = '';

  if (!types.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.style.cssText = 'padding:16px 12px';
    e.textContent = t('shift_empty');
    list.appendChild(e);
    return;
  }

  for (const st of types) {
    const row = document.createElement('div');
    row.className = 'folder';
    row.innerHTML = `<span class="shift-sigla" style="background:${esc(st.color)}">${esc(st.label || '?')}</span>
      <div class="nbody">
        <div class="fname">${esc(st.name || st.label)}</div>
        <div class="nmeta">${esc(range(st))}</div>
      </div>`;
    row.appendChild(mini('✎', () => openShiftModal(st)));
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_shift')))) return;
      await db.deleteShiftType(st.id);
      toast(t('deleted'));
      renderShifts();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      openShiftModal(st);
    });
    list.appendChild(row);
  }
}

function openShiftModal(existing) {
  const ov = $('shiftOverlay');
  $('shiftTitle').textContent = existing ? t('shift_edit') : t('shift_new');
  const label = $('shLabel'), name = $('shName'), start = $('shStart'), end = $('shEnd'), color = $('shColor');
  const del = $('shDelete');
  label.value = existing?.label ?? '';
  name.value = existing?.name ?? '';
  start.value = existing?.start ?? '';
  end.value = existing?.end ?? '';
  color.value = existing?.color || '#3dff70';
  del.hidden = !existing;

  const done = () => {
    ov.classList.remove('open');
    $('shSave').onclick = $('shCancel').onclick = del.onclick = ov.onclick = null;
  };
  $('shCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  del.onclick = async () => {
    if (!(await confirmDialog(t('confirm_delete_shift')))) return;
    await db.deleteShiftType(existing.id);
    done();
    toast(t('deleted'));
    renderShifts();
  };
  $('shSave').onclick = async () => {
    const t0 = {
      label: label.value.trim(),
      name: name.value.trim(),
      start: start.value,
      end: end.value,
      color: color.value || '#3dff70',
    };
    if (!t0.label) { toast(t('missing_title')); return; }
    if (existing) await db.updateShiftType(existing.id, t0);
    else await db.createShiftType(t0);
    done();
    toast(t('saved'));
    renderShifts();
  };
  ov.classList.add('open');
  label.focus();
}
