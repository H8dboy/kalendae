// Impostazioni: tema, primo giorno settimana, notifiche, lingua,
// export/import backup JSON ed export calendario .ics.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { buildBackup, parseBackup } from '../logic/backup.js';
import { buildIcs } from '../logic/ics.js';

const $ = id => document.getElementById(id);

// Valori di default delle impostazioni (chiave → default).
export const DEFAULTS = { theme: 'dark', first_day: '1', notifications: '1', lang: 'it' };

let settings = { ...DEFAULTS };
let onSettingsChange = null;

export async function loadSettings() {
  settings = { ...DEFAULTS, ...(await db.getSettings()) };
  applyTheme();
  return settings;
}

export const getSetting = key => settings[key];

export function initSettings({ onChange }) {
  onSettingsChange = onChange;
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
}

async function set(key, value) {
  settings[key] = value;
  await db.setSetting(key, value);
  applyTheme();
  onSettingsChange?.(settings);
}

export function render() {
  const body = $('settingsBody');
  body.innerHTML = '';

  const rowSelect = (label, key, options) => {
    const row = document.createElement('div');
    row.className = 'setrow';
    const sel = document.createElement('select');
    for (const [val, lbl] of options) {
      const o = document.createElement('option');
      o.value = val; o.textContent = lbl;
      if (settings[key] === val) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => set(key, sel.value));
    row.innerHTML = `<span class="slabel">${label}</span>`;
    row.appendChild(sel);
    body.appendChild(row);
  };

  rowSelect(t('set_theme'), 'theme', [['dark', t('theme_dark')], ['light', t('theme_light')]]);
  rowSelect(t('set_first_day'), 'first_day', [['1', t('monday')], ['0', t('sunday')]]);
  // Lingue: en/sq si attivano aggiungendo i file in js/i18n/ (vedi i18n/index.js).
  rowSelect(t('set_language'), 'lang', [['it', 'Italiano']]);

  const notif = document.createElement('div');
  notif.className = 'setrow';
  notif.innerHTML = `<span class="slabel">${t('set_notifications')}</span>`;
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = settings.notifications === '1';
  chk.addEventListener('change', () => set('notifications', chk.checked ? '1' : '0'));
  notif.appendChild(chk);
  body.appendChild(notif);

  const btn = (label, cls, onTap) => {
    const row = document.createElement('div');
    row.className = 'setrow';
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.style.flex = '1';
    b.textContent = label;
    b.addEventListener('click', onTap);
    row.appendChild(b);
    body.appendChild(row);
  };

  btn(t('export_json'), 'accent', exportJson);
  btn(t('export_ics'), 'accent', exportIcs);
  btn(t('import_json'), 'danger', importJson);
}

/* ---------- export / import ---------- */
const dialog = () => window.__TAURI__.dialog;
const fs = () => window.__TAURI__.fs;

const stamp = () => new Date().toISOString().slice(0, 10);

async function exportJson() {
  const path = await dialog().save({
    defaultPath: `agenda-h8-backup-${stamp()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!path) return;
  const dump = await db.dumpAll();
  await fs().writeTextFile(path, buildBackup(dump));
  toast(`${t('export_done')} ${path}`);
}

async function exportIcs() {
  const path = await dialog().save({
    defaultPath: `agenda-h8-${stamp()}.ics`,
    filters: [{ name: 'iCalendar', extensions: ['ics'] }],
  });
  if (!path) return;
  const acts = await db.listActivities();
  await fs().writeTextFile(path, buildIcs(acts.filter(a => a.date)));
  toast(`${t('export_done')} ${path}`);
}

async function importJson() {
  const path = await dialog().open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!path) return;
  if (!(await confirmDialog(t('confirm_import')))) return;
  try {
    const text = await fs().readTextFile(path);
    const data = parseBackup(text);
    await db.restoreAll(data);
    await loadSettings();
    toast(t('import_done'));
    onSettingsChange?.(settings);
  } catch {
    toast(t('import_error'));
  }
}
