// Calendario: viste mese / settimana / giorno, navigazione, swipe,
// e modalità "scegli giorno" per assegnare una data a una task esistente.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { esc } from '../ui/modal.js';
import { occursOn, toIso, parseIso } from '../logic/recurrence.js';
import { holidayMap, countryByCode, MIN_YEAR, MAX_YEAR } from '../logic/holidays.js';
import { hmToMinutes, minutesToHm, fmtMinutes, fmtMinutesShort, sumMonth } from '../logic/workhours.js';
import { openActivityModal } from './activityModal.js';

const $ = id => document.getElementById(id);

let view = 'month';                 // 'month' | 'week' | 'day'
let cursor = new Date();            // giorno di riferimento della vista
let firstDay = 1;                   // 1 = lunedì, 0 = domenica (da impostazioni)
let pickActivity = null;            // task in attesa di data (modalità scelta giorno)
let country = '';                   // stato per le festività ('' = nessuno)
const holidayCache = new Map();     // "IT:2026" → Map(dataIso → [nomi])

export function setFirstDay(d) { firstDay = d; }

export function setCountry(code) {
  country = code ?? '';
  holidayCache.clear();
}

/** Nomi delle festività del giorno (secondo lo stato scelto nelle impostazioni). */
function holidayNames(dateIso) {
  if (!country) return [];
  const year = +dateIso.slice(0, 4);
  const key = `${country}:${year}`;
  if (!holidayCache.has(key)) holidayCache.set(key, holidayMap(country, year));
  return holidayCache.get(key).get(dateIso) ?? [];
}

const countryFlag = () => countryByCode(country)?.flag ?? '⭐';

export function initCalendar() {
  $('todayBtn').textContent = t('today');
  const tabs = $('calTabs').querySelectorAll('.tab');
  tabs[0].textContent = t('month');
  tabs[1].textContent = t('week');
  tabs[2].textContent = t('day');

  $('calTabs').addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    view = b.dataset.view;
    tabs.forEach(x => x.classList.toggle('active', x === b));
    render();
  });

  $('calPrev').addEventListener('click', () => shift(-1));
  $('calNext').addEventListener('click', () => shift(1));
  $('todayBtn').addEventListener('click', () => { cursor = new Date(); render(); });
  initYmPicker();

  $('fabCal').addEventListener('click', () =>
    openActivityModal({ presetDate: toIso(cursor), onChange: render }));

  $('pickCancel').addEventListener('click', exitPickMode);

  // swipe orizzontale per cambiare periodo
  let x0 = null, y0 = null;
  const body = $('calBody');
  body.addEventListener('touchstart', e => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  body.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    x0 = y0 = null;
  }, { passive: true });
}

function shift(dir) {
  if (view === 'month') cursor.setMonth(cursor.getMonth() + dir);
  else if (view === 'week') cursor.setDate(cursor.getDate() + 7 * dir);
  else cursor.setDate(cursor.getDate() + dir);
  render();
}

/* ---------- selettore "vai a mese e anno" ---------- */
function initYmPicker() {
  const clamp = y => Math.min(MAX_YEAR, Math.max(MIN_YEAR, y || cursor.getFullYear()));

  $('calLabel').addEventListener('click', () => {
    $('ymYear').value = cursor.getFullYear();
    renderYmMonths();
    $('ymOverlay').classList.add('open');
  });
  $('ymCancel').addEventListener('click', () => $('ymOverlay').classList.remove('open'));
  $('ymOverlay').addEventListener('click', e => {
    if (e.target.id === 'ymOverlay') $('ymOverlay').classList.remove('open');
  });
  $('ymPrev').addEventListener('click', () => {
    $('ymYear').value = clamp(+$('ymYear').value - 1);
    renderYmMonths();
  });
  $('ymNext').addEventListener('click', () => {
    $('ymYear').value = clamp(+$('ymYear').value + 1);
    renderYmMonths();
  });
  $('ymYear').addEventListener('change', () => {
    $('ymYear').value = clamp(+$('ymYear').value);
    renderYmMonths();
  });
}

function renderYmMonths() {
  const grid = $('ymMonths');
  grid.innerHTML = '';
  const year = +$('ymYear').value;
  t('months').forEach((name, i) => {
    const b = document.createElement('button');
    b.className = 'btn' +
      (year === cursor.getFullYear() && i === cursor.getMonth() ? ' current' : '');
    b.textContent = name.slice(0, 3);
    b.addEventListener('click', () => {
      cursor = new Date(year, i, 1);
      $('ymOverlay').classList.remove('open');
      render();
    });
    grid.appendChild(b);
  });
}

/* ---------- modalità "scegli giorno" (assegna data a una task) ---------- */
export function enterPickMode(activityId, title) {
  pickActivity = activityId;
  $('pickLabel').textContent = `${t('pick_date_banner')} ${title}`;
  $('pickBanner').hidden = false;
}

function exitPickMode() {
  pickActivity = null;
  $('pickBanner').hidden = true;
}

async function onDayTap(dateIso) {
  if (pickActivity) {
    await db.setActivityDate(pickActivity, dateIso);
    exitPickMode();
    toast(`${t('saved')} → ${dateIso}`);
    render();
  } else {
    openActivityModal({ presetDate: dateIso, onChange: render });
  }
}

/* ---------- ore di lavoro ---------- */
/** Modale h/m per registrare le ore lavorate del giorno. */
async function openWorkModal(dateIso) {
  const ov = document.getElementById('whOverlay');
  $('whDateLabel').textContent = `${t('work_hours_label')} ${dateIso}`;
  const { h, m } = minutesToHm(await db.getWorkMinutes(dateIso));
  $('whH').value = h || '';
  $('whM').value = m || '';

  const done = () => {
    ov.classList.remove('open');
    $('whSave').onclick = $('whCancel').onclick = $('whClear').onclick = ov.onclick = null;
  };
  $('whCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  $('whClear').onclick = async () => {
    await db.setWorkMinutes(dateIso, 0);
    done();
    render();
  };
  $('whSave').onclick = async () => {
    await db.setWorkMinutes(dateIso, hmToMinutes($('whH').value, $('whM').value));
    done();
    toast(t('saved'));
    render();
  };
  ov.classList.add('open');
  $('whH').focus();
}

/* ---------- caricamento dati del periodo visibile ---------- */
async function loadRange(fromIso, toIsoStr) {
  const acts = await db.listDatedBetween(fromIso, toIsoStr);
  const recDone = await db.listRecurrenceDone(fromIso, toIsoStr);
  const doneMap = new Set(recDone.map(r => `${r.activity_id}|${r.occurrence_date}`));
  const wh = await db.listWorkHours(fromIso, toIsoStr);
  const whMap = new Map(wh.map(r => [r.date, r.minutes]));
  return { acts, doneMap, wh, whMap };
}

// Le occorrenze di un giorno: attività secche del giorno + ricorrenti che vi cadono.
function itemsForDay(acts, doneMap, dateIso) {
  return acts
    .filter(a => occursOn(a, dateIso))
    .map(a => ({
      ...a,
      occDone: a.recurrence ? doneMap.has(`${a.id}|${dateIso}`) : !!a.done,
    }))
    .sort((x, y) => (x.time ?? '99') < (y.time ?? '99') ? -1 : 1);
}

/* ---------- render ---------- */
export async function render() {
  if (view === 'month') await renderMonth();
  else if (view === 'week') await renderWeek();
  else await renderDay();
}

function startOfWeek(d) {
  const out = new Date(d);
  const shiftDays = (out.getDay() - firstDay + 7) % 7;
  out.setDate(out.getDate() - shiftDays);
  return out;
}

function dowLabels() {
  // dows_short parte da lunedì: con domenica come primo giorno si ruota di uno.
  const base = t('dows_short');
  return firstDay === 1 ? base : [base[6], ...base.slice(0, 6)];
}

async function renderMonth() {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  $('calLabel').textContent = `${t('months')[m]} ${y}`;

  const first = new Date(y, m, 1);
  const gridStart = startOfWeek(first);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = Math.round((first - gridStart) / 86400000);
  const rows = Math.ceil((lead + daysInMonth) / 7);
  const total = rows * 7;
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + total - 1);

  const { acts, doneMap, wh, whMap } = await loadRange(toIso(gridStart), toIso(gridEnd));
  const todayIso = toIso(new Date());

  const grid = document.createElement('div');
  grid.className = 'month-grid';
  for (const lbl of dowLabels()) {
    const h = document.createElement('div');
    h.className = 'dow';
    h.textContent = lbl;
    grid.appendChild(h);
  }
  const MAX_CHIPS = 3;
  for (let i = 0; i < total; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    const iso = toIso(d);
    const cell = document.createElement('div');
    cell.className = 'cell' + (d.getMonth() !== m ? ' other' : '') + (iso === todayIso ? ' today' : '');
    cell.setAttribute('role', 'gridcell');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = d.getDate();
    cell.appendChild(num);

    // angolo in alto a destra: ore lavorate del giorno (⏱ per aggiungerle)
    if (d.getMonth() === m) {
      const minutes = whMap.get(iso) ?? 0;
      const wb = document.createElement('button');
      wb.className = 'whbadge' + (minutes > 0 ? ' has' : '');
      wb.textContent = minutes > 0 ? fmtMinutesShort(minutes) : '⏱';
      wb.setAttribute('aria-label', `${t('work_hours_label')} ${iso}`);
      wb.addEventListener('click', ev => {
        ev.stopPropagation();
        openWorkModal(iso);
      });
      cell.appendChild(wb);
    }

    const holidays = holidayNames(iso);
    if (holidays.length) {
      cell.classList.add('festivo');
      const hc = document.createElement('div');
      hc.className = 'chip festivo';
      hc.textContent = `${countryFlag()} ${holidays.join(' · ')}`;
      hc.title = holidays.join(' · ');
      cell.appendChild(hc);
    }

    const items = itemsForDay(acts, doneMap, iso);
    items.slice(0, MAX_CHIPS).forEach(it => {
      const c = document.createElement('div');
      c.className = `chip p${it.priority}` + (it.occDone ? ' done' : '');
      c.textContent = (it.time ? it.time + ' ' : '') + it.title;
      c.title = it.title;
      c.addEventListener('click', ev => {
        ev.stopPropagation();
        openActivityModal({ id: it.id, onChange: render });
      });
      cell.appendChild(c);
    });
    if (items.length > MAX_CHIPS) {
      const more = document.createElement('div');
      more.className = 'chip more';
      more.textContent = `+${items.length - MAX_CHIPS} ${t('more')}`;
      more.addEventListener('click', ev => {
        ev.stopPropagation();
        gotoDay(d);
      });
      cell.appendChild(more);
    }
    cell.addEventListener('click', () => onDayTap(iso));
    grid.appendChild(cell);
  }

  // totale ore lavorate del mese in vista (solo giorni del mese, non i bordi grigi)
  const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
  const monthTotal = sumMonth(wh, ym);
  const children = [grid];
  if (monthTotal > 0) {
    const totRow = document.createElement('div');
    totRow.id = 'whTotal';
    totRow.textContent = `⏱ ${t('work_month_total')}: ${fmtMinutes(monthTotal)}`;
    children.push(totRow);
  }
  $('calBody').replaceChildren(...children);
}

function gotoDay(d) {
  cursor = new Date(d);
  view = 'day';
  $('calTabs').querySelectorAll('.tab').forEach(x =>
    x.classList.toggle('active', x.dataset.view === 'day'));
  render();
}

async function renderWeek() {
  const start = startOfWeek(cursor);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  $('calLabel').textContent =
    `${start.getDate()} ${t('months')[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${t('months')[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;

  const { acts, doneMap, whMap } = await loadRange(toIso(start), toIso(end));
  const todayIso = toIso(new Date());
  const wrap = document.createElement('div');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    wrap.appendChild(dayBlock(d, itemsForDay(acts, doneMap, toIso(d)), todayIso, false, whMap));
  }
  $('calBody').replaceChildren(wrap);
}

async function renderDay() {
  const iso = toIso(cursor);
  $('calLabel').textContent =
    `${t('dows_long')[(cursor.getDay() + 6) % 7]} ${cursor.getDate()} ${t('months')[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const { acts, doneMap, whMap } = await loadRange(iso, iso);
  const wrap = document.createElement('div');
  wrap.appendChild(dayBlock(cursor, itemsForDay(acts, doneMap, iso), toIso(new Date()), true, whMap, true));
  $('calBody').replaceChildren(wrap);
}

/** Blocco-giorno per viste settimana/giorno: intestazione + righe evento.
 *  In vista giorno (alwaysWork) la riga ore lavoro appare sempre come punto
 *  d'ingresso; in vista settimana solo se il giorno ha già ore registrate. */
function dayBlock(d, items, todayIso, noHead = false, whMap = null, alwaysWork = false) {
  const iso = toIso(d);
  const box = document.createElement('div');
  box.className = 'agenda-day' + (iso === todayIso ? ' today' : '');

  if (!noHead) {
    const head = document.createElement('div');
    head.className = 'dhead';
    head.textContent = `${t('dows_short')[(d.getDay() + 6) % 7]} ${d.getDate()}`;
    head.addEventListener('click', () => gotoDay(d));
    box.appendChild(head);
  }

  const holidays = holidayNames(iso);
  if (holidays.length) {
    const hr = document.createElement('div');
    hr.className = 'holiday-row';
    hr.textContent = `${countryFlag()} ${holidays.join(' · ')}`;
    box.appendChild(hr);
  }

  const workMin = whMap?.get(iso) ?? 0;
  if (alwaysWork || workMin > 0) {
    const wr = document.createElement('button');
    wr.className = 'work-row' + (workMin > 0 ? ' has' : '');
    wr.textContent = `⏱ ${t('work_row')}: ${workMin > 0 ? fmtMinutes(workMin) : '—'}`;
    wr.addEventListener('click', () => openWorkModal(iso));
    box.appendChild(wr);
  }

  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = '—';
    e.addEventListener('click', () => onDayTap(iso));
    box.appendChild(e);
    return box;
  }

  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'event-row' + (it.occDone ? ' done' : '');
    row.innerHTML = `
      <span class="etime mono">${it.time ?? ''}</span>
      <span class="prio-dot p${it.priority}"></span>
      <span class="etitle">${esc(it.title)}</span>
      <input type="checkbox" ${it.occDone ? 'checked' : ''} aria-label="${t('done_label')}: ${esc(it.title)}">`;
    row.querySelector('input').addEventListener('click', async ev => {
      ev.stopPropagation();
      const checked = ev.target.checked;
      if (it.recurrence) await db.setOccurrenceDone(it.id, iso, checked);
      else await db.setDone(it.id, checked);
      render();
    });
    row.addEventListener('click', () => openActivityModal({ id: it.id, onChange: render }));
    box.appendChild(row);
  }
  return box;
}
