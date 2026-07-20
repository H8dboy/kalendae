// Impostazioni: tema, primo giorno settimana, notifiche, lingua,
// export/import backup JSON ed export calendario .ics.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { buildBackup, parseBackup } from '../logic/backup.js';
import { buildIcs } from '../logic/ics.js';
import { COUNTRIES } from '../logic/holidays.js';

const $ = id => document.getElementById(id);

// Valori di default delle impostazioni (chiave → default).
export const DEFAULTS = {
  theme: 'dark', first_day: '1', notifications: '1', lang: 'en', country: '',
  work_reminder: '0', work_reminder_time: '20:00',
  show_work_hours: '1', show_shifts: '0',
};

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
  // Cambiando lingua le etichette di questa schermata vanno rigenerate.
  if (key === 'lang') render();
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
  // Stato per le festività: bandiera + nome; le feste appaiono sul calendario.
  rowSelect(t('set_country'), 'country', [
    ['', t('country_none')],
    ...COUNTRIES.map(c => [c.code, `${c.flag} ${c.name}`]),
  ]);
  rowSelect(t('set_language'), 'lang', [['en', 'English'], ['it', 'Italiano']]);

  const rowCheck = (label, key) => {
    const row = document.createElement('div');
    row.className = 'setrow';
    row.innerHTML = `<span class="slabel">${label}</span>`;
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = settings[key] === '1';
    chk.addEventListener('change', () => set(key, chk.checked ? '1' : '0'));
    row.appendChild(chk);
    body.appendChild(row);
    return row;
  };

  rowCheck(t('set_notifications'), 'notifications');

  // --- Lavoro: Ore di lavoro e Turni sono indipendenti (uno, l'altro o entrambi). ---
  // Banner in evidenza per far scoprire i Turni (nascosti dal menu finché non attivi).
  shiftPromo();
  rowCheck(t('set_work_hours'), 'show_work_hours');

  // Promemoria serale "hai registrato le ore di oggi?": checkbox + orario.
  const wrRow = rowCheck(t('set_work_reminder'), 'work_reminder');
  const wrTime = document.createElement('input');
  wrTime.type = 'time';
  wrTime.value = settings.work_reminder_time;
  wrTime.style.cssText = 'background:var(--bg);border:1px solid var(--line);color:var(--ink);padding:8px 10px;border-radius:var(--radius);font-size:14px;min-height:40px';
  wrTime.addEventListener('change', () => {
    if (wrTime.value) set('work_reminder_time', wrTime.value);
  });
  wrRow.insertBefore(wrTime, wrRow.lastChild);

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

// Banner in evidenza in cima alla sezione Lavoro: card cliccabile che attiva i Turni,
// così l'utente li scopre senza doverli cercare (il menu ⋮ Turni resta nascosto finché OFF).
function shiftPromo() {
  const body = $('settingsBody');
  const card = document.createElement('button');
  card.type = 'button';
  card.style.cssText = [
    'display:flex', 'flex-direction:column', 'gap:6px', 'width:100%', 'text-align:left',
    'padding:14px 16px', 'margin:4px 0 12px',
    'border:1.5px solid var(--neon)', 'border-radius:var(--radius)',
    'background:var(--panel2)', 'color:var(--ink)', 'cursor:pointer',
  ].join(';');

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
  const title = document.createElement('span');
  title.textContent = '✨ ' + t('shifts_promo_title');
  title.style.cssText = 'font-weight:700;letter-spacing:.02em';
  const pill = document.createElement('span');

  const paint = () => {
    const on = settings.show_shifts === '1';
    pill.textContent = on ? 'ON' : 'OFF';
    pill.style.cssText = 'font-size:12px;font-weight:700;padding:3px 12px;border-radius:999px;'
      + (on ? 'background:var(--neon);color:var(--neon-ink)'
            : 'background:var(--line);color:var(--dim)');
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  paint();

  head.appendChild(title);
  head.appendChild(pill);

  const hint = document.createElement('span');
  hint.textContent = t('shifts_promo_hint');
  hint.style.cssText = 'font-size:13px;color:var(--dim);line-height:1.35';

  card.appendChild(head);
  card.appendChild(hint);
  card.addEventListener('click', async () => {
    await set('show_shifts', settings.show_shifts === '1' ? '0' : '1');
    paint();
  });
  body.appendChild(card);
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
