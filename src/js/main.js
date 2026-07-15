// AGENDA/H8 — bootstrap e navigazione.
// Concetto: il calendario è la schermata principale e l'unica in vista;
// Task (☑) e Note (📄) si aprono dalle icone in alto a destra,
// Archivio/Statistiche/Impostazioni dal menu ⋮.
import { initDb } from './db.js';
import * as db from './db.js';
import { t, setLang } from './i18n/index.js';
import { toast } from './ui/toast.js';
import * as calendar from './views/calendar.js';
import * as tasks from './views/tasks.js';
import * as notes from './views/notes.js';
import * as archive from './views/archive.js';
import * as stats from './views/stats.js';
import * as settingsView from './views/settings.js';
import * as search from './views/search.js';
import * as fitness from './views/fitness.js';
import { initActivityModal, refreshLabels as refreshActLabels } from './views/activityModal.js';
import { parseQuickAdd } from './logic/quickadd.js';
import { occursOn, toIso } from './logic/recurrence.js';

const $ = id => document.getElementById(id);

/* ================= navigazione ================= */
// Stack di schermate: 'calendar' è la radice, ← risale di un livello.
const SCREENS = ['calendar', 'tasks', 'notes', 'notelist', 'noteedit', 'search', 'archive', 'stats', 'settings', 'fitness', 'sport', 'plan'];
let stack = ['calendar'];

async function showScreen(name, title = null) {
  const current = stack[stack.length - 1];
  if (current === 'noteedit' && name !== 'noteedit') await notes.leaveEditor();

  if (name === 'calendar') stack = ['calendar'];
  else if (current !== name) stack.push(name);

  for (const s of SCREENS) $('screen-' + s).hidden = s !== name;
  $('backBtn').hidden = name === 'calendar';
  $('screenTitle').textContent = title ?? titleFor(name);
  $('tasksBtn').classList.toggle('active', name === 'tasks');
  $('notesBtn').classList.toggle('active', ['notes', 'notelist', 'noteedit'].includes(name));
  closeMenu();

  // render della schermata appena aperta
  if (name === 'calendar') calendar.render();
  else if (name === 'tasks') tasks.render();
  else if (name === 'notes') notes.renderFolders();
  else if (name === 'search') search.focusSearch();
  else if (name === 'archive') archive.render();
  else if (name === 'stats') stats.render();
  else if (name === 'settings') settingsView.render();
  else if (name === 'fitness') fitness.renderSports();
  else if (name === 'sport') fitness.renderSport();
  else if (name === 'plan') fitness.renderPlan();
}

function titleFor(name) {
  const map = {
    calendar: t('app_name'), tasks: t('tasks'), notes: t('notes'),
    search: t('search'), archive: t('archive'), stats: t('stats'), settings: t('settings'),
    fitness: t('fitness'),   // 'sport' e 'plan' impostano il titolo nel loro render
  };
  return map[name] ?? t('app_name');
}

async function goBack() {
  const current = stack.pop();
  if (current === 'noteedit') await notes.leaveEditor();
  const prev = stack.pop() ?? 'calendar';
  // showScreen ripushera prev; il titolo delle schermate note viene rigenerato dal render
  await showScreen(prev === 'noteedit' ? 'notelist' : prev);
  if (prev === 'notelist') notes.renderNoteList();
}

/* ================= menu ⋮ ================= */
function closeMenu() { $('menuPop').classList.remove('open'); }

function initMenu() {
  $('menuBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('menuPop').classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#menuPop')) closeMenu();
  });
  $('mFitness').addEventListener('click', () => showScreen('fitness'));
  $('mArchive').addEventListener('click', () => showScreen('archive'));
  $('mStats').addEventListener('click', () => showScreen('stats'));
  $('mSettings').addEventListener('click', () => showScreen('settings'));
}

/* ================= i18n runtime ================= */
// Etichette statiche: applicate al boot e riapplicate quando cambia la lingua.
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  $('confirmNo').textContent = t('cancel');
  $('confirmOk').textContent = t('delete');
  $('promptNo').textContent = t('cancel');
  $('promptOk').textContent = t('save');
  $('quickInput').placeholder = t('quickadd_placeholder');
  $('noteTitle').placeholder = t('note_title_placeholder');
  $('noteBody').placeholder = t('note_body_placeholder');
  $('searchInput').placeholder = t('search_placeholder');
  calendar.refreshLabels();
  refreshActLabels();
}

/* ================= quick add ================= */
function initQuickAdd() {
  const input = $('quickInput');
  input.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const parsed = parseQuickAdd(input.value);
    if (!parsed.title) return;
    await db.createActivity({
      title: parsed.title,
      date: parsed.date,
      time: parsed.time,
      reminder: !!(parsed.date && parsed.time),
    });
    input.value = '';
    toast(`${t('quickadd_added')} ✓ ${parsed.date ?? t('no_deadline')}${parsed.time ? ' ' + parsed.time : ''}`);
    calendar.render();
  });
}

/* ================= notifiche promemoria ================= */
// Ogni 30s: se un'attività con promemoria attivo cade oggi all'ora corrente,
// invia una notifica di sistema (una sola volta per sessione).
const notified = new Set();

async function ensureNotifPermission() {
  const n = window.__TAURI__?.notification;
  if (!n) return false;
  if (await n.isPermissionGranted()) return true;
  return (await n.requestPermission()) === 'granted';
}

async function checkReminders() {
  if (settingsView.getSetting('notifications') !== '1') return;
  const n = window.__TAURI__?.notification;
  if (!n) return;
  const now = new Date();
  const today = toIso(now);
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const acts = await db.listDatedBetween(today, today);
  for (const a of acts) {
    if (!a.reminder || a.done || !a.time) continue;
    if (!occursOn(a, today) || a.time !== hm) continue;
    const key = `${a.id}|${today}`;
    if (notified.has(key)) continue;
    notified.add(key);
    n.sendNotification({ title: t('notif_title'), body: `${a.time} — ${a.title}` });
  }

  // Promemoria serale ore di lavoro: solo se attivo, all'ora impostata,
  // e solo se oggi non è stata ancora registrata nessuna ora.
  if (settingsView.getSetting('work_reminder') === '1'
      && hm === settingsView.getSetting('work_reminder_time')
      && !notified.has(`work|${today}`)) {
    notified.add(`work|${today}`);
    if ((await db.getWorkMinutes(today)) === 0) {
      n.sendNotification({ title: t('notif_title'), body: t('work_reminder_msg') });
    }
  }
}

/* ================= bootstrap ================= */
async function boot() {
  try {
    await initDb();
  } catch (err) {
    document.body.innerHTML =
      `<p style="padding:24px;font-family:monospace">Errore database: ${err}</p>`;
    return;
  }

  const settings = await settingsView.loadSettings();
  setLang(settings.lang);
  calendar.setFirstDay(+settings.first_day);
  calendar.setCountry(settings.country);
  applyI18n();

  initActivityModal({
    onPickDate: async id => {
      const a = await db.getActivity(id);
      await showScreen('calendar');
      calendar.enterPickMode(id, a.title);
    },
  });
  calendar.initCalendar();
  tasks.initTasks();
  notes.initNotes({ showScreen });
  fitness.initFitness({ showScreen });
  search.initSearch();
  settingsView.initSettings({
    onChange: s => {
      setLang(s.lang);
      calendar.setFirstDay(+s.first_day);
      calendar.setCountry(s.country);
      applyI18n();
      $('screenTitle').textContent = titleFor(stack[stack.length - 1]);
    },
  });
  initMenu();
  initQuickAdd();

  // header
  $('backBtn').addEventListener('click', goBack);
  $('tasksBtn').addEventListener('click', () => showScreen('tasks'));
  $('notesBtn').addEventListener('click', () => showScreen('notes'));
  $('searchBtn').addEventListener('click', () => showScreen('search'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stack[stack.length - 1] !== 'calendar') goBack();
  });

  await showScreen('calendar');

  if (settings.notifications === '1') {
    const ok = await ensureNotifPermission();
    if (!ok) toast(t('notif_denied'));
  }
  setInterval(checkReminders, 30000);
  checkReminders();
}

boot();
