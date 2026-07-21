// Sezione ASTINENZA: ognuno traccia le sue dipendenze (sigarette, sesso,
// caffè, social, videogiochi...). Due modalità per dipendenza:
//   'streak'  → "quanto tempo senza": contatore dall'ultimo inizio + ricadute
//   'counter' → "quante oggi": conteggio giornaliero con +1/−1 e "in meno" del solito
import * as db from '../db.js';
import { t, getLang } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, esc } from '../ui/modal.js';
import { toIso } from '../logic/recurrence.js';
import { fmtAmount, parseAmount } from '../logic/money.js';
import {
  elapsed, streakDays, bestOf, parseStamp,
  sumRange, reduced, reducedRange, savedStreakCents, savedCounterCents,
} from '../logic/habits.js';

const $ = id => document.getElementById(id);

const HABIT_ICONS = ['🚭', '🚬', '🍺', '🍷', '☕', '🧋', '🎮', '📱', '📺', '🍬', '🎰', '💊', '🔞', '🛒', '🍔', '💸'];

let navigate = null;    // showScreen di main.js
let currentHabit = null;
let liveTimer = null;   // aggiornamento del contatore streak "dal vivo"

export function initHabits({ showScreen }) {
  navigate = showScreen;
  $('fabHabit').addEventListener('click', () => openHabitModal(null));
}

function stopLive() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
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

function subLine(text) {
  const e = document.createElement('div');
  e.className = 'sub';
  e.textContent = text;
  return e;
}

const money = cents => fmtAmount(cents, getLang());

/* ================= elenco dipendenze ================= */
export async function renderHabits() {
  stopLive();
  const habits = await db.listHabits();
  const list = $('habitList');
  list.innerHTML = '';

  if (!habits.length) {
    list.appendChild(subLine(t('no_habits')));
    return;
  }

  for (const h of habits) {
    const row = document.createElement('div');
    row.className = 'folder';

    let badge = '';
    if (h.mode === 'streak') {
      const d = streakDays(h.started_at);
      badge = `🔥 ${d} ${t('habit_days')}`;
    } else {
      const today = await db.getHabitCount(h.id, toIso(new Date()));
      const goalTxt = h.goal != null ? ` / ${h.goal}` : '';
      badge = `${t('habit_today')} ${today}${goalTxt}`;
    }

    row.innerHTML = `<span style="font-size:20px">${esc(h.icon)}</span>
      <span class="fname">${esc(h.name)}</span>
      <span class="fcount mono">${esc(badge)}</span>`;
    row.appendChild(mini('✎', () => openHabitModal(h)));
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_habit')))) return;
      await db.deleteHabit(h.id);
      toast(t('deleted'));
      renderHabits();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentHabit = h;
      navigate('habit');
    });
    list.appendChild(row);
  }
}

/* ---------- modale dipendenza (nome, icona, modalità, parametri) ---------- */
function openHabitModal(existing) {
  const ov = $('habitOverlay');
  $('habitModalTitle').textContent = existing ? t('edit_habit') : t('new_habit');
  const nameInput = $('hbName');
  nameInput.placeholder = t('habit_name_placeholder');
  nameInput.value = existing?.name ?? '';

  // Modalità: fissata alla creazione, non modificabile dopo (cambia il senso dei dati).
  let mode = existing?.mode ?? 'streak';
  const modeSeg = $('hbMode');
  const paintMode = () => {
    modeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    $('hbStreakFields').hidden = mode !== 'streak';
    $('hbCounterFields').hidden = mode !== 'counter';
    $('hbCostLabel').textContent = mode === 'streak' ? t('habit_cost_day_label') : t('habit_cost_unit_label');
  };
  modeSeg.querySelectorAll('button').forEach(b => {
    b.onclick = existing ? null : () => { mode = b.dataset.mode; paintMode(); };
    b.disabled = !!existing;
    b.style.opacity = existing && b.dataset.mode !== mode ? '.4' : '1';
  });

  let icon = existing?.icon ?? HABIT_ICONS[0];
  const icons = $('hbIcons');
  icons.innerHTML = '';
  for (const em of HABIT_ICONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    b.className = em === icon ? 'active' : '';
    b.addEventListener('click', () => {
      icon = em;
      icons.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    icons.appendChild(b);
  }

  $('hbUnit').placeholder = t('habit_unit_placeholder');
  $('hbUnit').value = existing?.unit ?? '';
  $('hbBaseline').value = existing?.baseline ?? '';
  // "goal" ha due input (limite/giorno per il conteggio, giorni-obiettivo per lo streak).
  $('hbGoal').value = existing?.mode === 'counter' ? (existing?.goal ?? '') : '';
  $('hbGoalStreak').value = existing?.mode === 'streak' ? (existing?.goal ?? '') : '';
  $('hbCost').value = existing?.cost != null ? money(existing.cost) : '';
  paintMode();

  const done = () => {
    ov.classList.remove('open');
    $('hbSave').onclick = $('hbCancel').onclick = ov.onclick = null;
  };
  $('hbCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  $('hbSave').onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) { toast(t('missing_title')); return; }
    const intOrNull = v => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : null; };
    const h = {
      name, icon, mode, unit: $('hbUnit').value.trim(),
      baseline: mode === 'counter' ? intOrNull($('hbBaseline').value) : null,
      goal: intOrNull(mode === 'counter' ? $('hbGoal').value : $('hbGoalStreak').value),
      cost: $('hbCost').value.trim() ? parseAmount($('hbCost').value) : null,
    };
    if (existing) await db.updateHabit(existing.id, h);
    else await db.createHabit(h);
    done();
    toast(t('saved'));
    renderHabits();
  };
  ov.classList.add('open');
  nameInput.focus();
}

/* ================= dettaglio dipendenza ================= */
export async function renderHabit() {
  stopLive();
  if (!currentHabit) { navigate('habits'); return; }
  const h = await db.getHabit(currentHabit.id);
  if (!h) { navigate('habits'); return; }
  currentHabit = h;
  $('screenTitle').textContent = `${h.icon} ${h.name}`;

  const body = $('habitBody');
  body.innerHTML = '';

  // Barra azioni: modifica / elimina la dipendenza.
  const bar = document.createElement('div');
  bar.className = 'session-bar';
  const edit = document.createElement('button');
  edit.className = 'btn small';
  edit.textContent = '✎ ' + t('edit_habit');
  edit.addEventListener('click', () => openHabitModal(h));
  const del = document.createElement('button');
  del.className = 'btn small danger';
  del.textContent = t('delete');
  del.addEventListener('click', async () => {
    if (!(await confirmDialog(t('confirm_delete_habit')))) return;
    await db.deleteHabit(h.id);
    toast(t('deleted'));
    navigate('habits');
  });
  bar.appendChild(edit);
  bar.appendChild(del);
  body.appendChild(bar);

  if (h.mode === 'streak') await renderStreak(h, body);
  else await renderCounter(h, body);
}

/* ---------- riquadro grande riutilizzabile ---------- */
function bigCard(big, sub, accent = true) {
  const card = document.createElement('div');
  card.style.cssText = [
    'text-align:center', 'padding:22px 16px', 'margin:4px 0 14px',
    'border:1.5px solid ' + (accent ? 'var(--neon)' : 'var(--line)'), 'border-radius:var(--radius)',
    'background:var(--panel2)',
  ].join(';');
  const b = document.createElement('div');
  b.className = 'mono';
  b.style.cssText = 'font-size:44px;font-weight:800;line-height:1;color:' + (accent ? 'var(--neon)' : 'var(--ink)');
  b.textContent = big;
  const s = document.createElement('div');
  s.style.cssText = 'font-size:13px;color:var(--dim);margin-top:8px;line-height:1.4';
  s.textContent = sub;
  card.appendChild(b);
  card.appendChild(s);
  return { card, bigEl: b, subEl: s };
}

function statRow(label, value) {
  const r = document.createElement('div');
  r.className = 'setrow';
  r.innerHTML = `<span class="slabel">${esc(label)}</span><span class="mono" style="font-weight:700">${esc(value)}</span>`;
  return r;
}

/* ================= modalità streak (tempo senza) ================= */
async function renderStreak(h, body) {
  const paintBig = () => {
    const e = elapsed(h.started_at);
    const dayWord = e.days === 1 ? t('habit_day') : t('habit_days');
    return {
      big: `${e.days}`,
      sub: `${dayWord} · ${e.hours}h ${e.minutes}m\n${t('habit_since')} ${h.started_at ?? '—'}`,
    };
  };
  const first = paintBig();
  const { card, bigEl, subEl } = bigCard(`🔥 ${first.big}`, first.sub);
  body.appendChild(card);

  // Aggiornamento dal vivo finché la schermata è aperta.
  liveTimer = setInterval(() => {
    if ($('screen-habit').hidden) { stopLive(); return; }
    const p = paintBig();
    bigEl.textContent = `🔥 ${p.big}`;
    subEl.textContent = p.sub;
  }, 30000);

  const days = streakDays(h.started_at);
  body.appendChild(statRow(t('habit_record'), `${Math.max(h.best_streak, days)} ${t('habit_days')}`));

  if (h.goal != null && h.goal > 0) {
    const pct = Math.min(100, Math.round((days / h.goal) * 100));
    body.appendChild(statRow(t('habit_goal'), `${days} / ${h.goal} ${t('habit_days')} (${pct}%)`));
  }
  if (h.cost) {
    body.appendChild(statRow(t('habit_saved'), money(savedStreakCents(days, h.cost))));
  }

  // Azioni streak: ricaduta (azzera) e modifica inizio.
  const actions = document.createElement('div');
  actions.className = 'session-bar';
  const relapse = document.createElement('button');
  relapse.className = 'btn danger';
  relapse.style.flex = '1';
  relapse.textContent = '↺ ' + t('habit_relapse');
  relapse.addEventListener('click', async () => {
    if (!(await confirmDialog(t('confirm_relapse')))) return;
    // Aggiorna il record col tratto appena concluso, poi riparte da ora.
    const ended = streakDays(h.started_at);
    const best = bestOf(h.best_streak, ended);
    if (best !== h.best_streak) await db.setHabitBest(h.id, best);
    await db.addRelapse(h.id);
    toast(t('habit_restarted'));
    renderHabit();
  });
  const editStart = document.createElement('button');
  editStart.className = 'btn small';
  editStart.textContent = t('habit_edit_start');
  editStart.addEventListener('click', () => openStartModal(h));
  actions.appendChild(relapse);
  actions.appendChild(editStart);
  body.appendChild(actions);

  // Storico ricadute.
  const relapses = await db.listRelapses(h.id);
  const head = document.createElement('div');
  head.className = 'shead';
  head.textContent = t('habit_relapses');
  body.appendChild(head);
  if (!relapses.length) {
    body.appendChild(subLine(t('habit_no_relapses')));
  }
  for (const r of relapses) {
    const row = document.createElement('div');
    row.className = 'note';
    row.innerHTML = `<div class="nbody"><div class="ntitle">↺ ${esc(r.date)}</div>
      ${r.notes ? `<div class="nmeta">${esc(r.notes)}</div>` : ''}</div>`;
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_entry')))) return;
      await db.deleteEntry(r.id);
      toast(t('deleted'));
      renderHabit();
    }));
    body.appendChild(row);
  }
}

/* ---------- modale "modifica inizio" (datetime) ---------- */
function openStartModal(h) {
  const ov = $('hstartOverlay');
  const input = $('hstartInput');
  const d = parseStamp(h.started_at) ?? new Date();
  const p = x => String(x).padStart(2, '0');
  input.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;

  const done = () => {
    ov.classList.remove('open');
    $('hstartSave').onclick = $('hstartCancel').onclick = ov.onclick = null;
  };
  $('hstartCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  $('hstartSave').onclick = async () => {
    if (!input.value) { done(); return; }
    // 'YYYY-MM-DDTHH:MM' → 'YYYY-MM-DD HH:MM'
    await db.setHabitStart(h.id, input.value.replace('T', ' ').slice(0, 16));
    done();
    toast(t('saved'));
    renderHabit();
  };
  ov.classList.add('open');
}

/* ================= modalità counter (conteggio) ================= */
async function renderCounter(h, body) {
  const todayIso = toIso(new Date());
  const today = await db.getHabitCount(h.id, todayIso);
  const unit = h.unit || t('habit_unit_fallback');

  const goalTxt = h.goal != null ? ` / ${h.goal}` : '';
  const overGoal = h.goal != null && today > h.goal;
  const { card, bigEl } = bigCard(`${today}${goalTxt}`,
    `${t('habit_today_unit')} ${unit}` + (overGoal ? ` · ⚠ ${t('habit_over_goal')}` : ''),
    !overGoal);

  // Pulsanti +1 / −1 sulla card di oggi.
  const pm = document.createElement('div');
  pm.className = 'session-bar';
  pm.style.justifyContent = 'center';
  const step = async delta => {
    const cur = await db.getHabitCount(h.id, todayIso);
    const next = Math.max(0, cur + delta);
    await db.setHabitCount(h.id, todayIso, next);
    renderHabit();
  };
  const minus = document.createElement('button');
  minus.className = 'btn';
  minus.style.cssText = 'flex:1;font-size:20px';
  minus.textContent = '−1';
  minus.addEventListener('click', () => step(-1));
  const plus = document.createElement('button');
  plus.className = 'btn accent';
  plus.style.cssText = 'flex:1;font-size:20px';
  plus.textContent = '+1';
  plus.addEventListener('click', () => step(+1));
  card.appendChild(pm);
  pm.appendChild(minus);
  pm.appendChild(plus);
  body.appendChild(card);
  void bigEl;

  // Aggregati settimana / mese.
  const counts = await db.listHabitCounts(h.id);
  const now = new Date();
  const weekAgo = toIso(new Date(now.getTime() - 6 * 86400000)); // 7 giorni incl. oggi
  const monthStart = todayIso.slice(0, 7) + '-01';

  body.appendChild(statRow(t('habit_week'), `${sumRange(counts, weekAgo, todayIso)} ${unit}`));
  body.appendChild(statRow(t('habit_month'), `${sumRange(counts, monthStart, todayIso)} ${unit}`));

  if (h.baseline != null) {
    body.appendChild(statRow(t('habit_less_today'), `−${reduced(today, h.baseline)} ${unit}`));
    const lessMonth = reducedRange(counts, h.baseline, monthStart, todayIso);
    body.appendChild(statRow(t('habit_less_month'), `−${lessMonth} ${unit}`));
    if (h.cost) {
      body.appendChild(statRow(t('habit_saved_month'), money(savedCounterCents(lessMonth, h.cost))));
    }
  } else if (h.cost) {
    const monthTot = sumRange(counts, monthStart, todayIso);
    body.appendChild(statRow(t('habit_spent_month'), money(monthTot * h.cost)));
  }

  // Diario giornaliero + aggiunta manuale su una data.
  const head = document.createElement('div');
  head.className = 'shead';
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  const hs = document.createElement('span');
  hs.textContent = t('habit_log');
  hs.style.flex = '1';
  head.appendChild(hs);
  head.appendChild(mini('＋', () => openCountModal(h, null)));
  body.appendChild(head);

  if (!counts.length) {
    body.appendChild(subLine(t('habit_no_log')));
  }
  for (const c of counts) {
    const row = document.createElement('div');
    row.className = 'note';
    const less = h.baseline != null ? `  ·  −${reduced(c.value, h.baseline)}` : '';
    row.innerHTML = `<div class="nbody"><div class="ntitle">${esc(c.date)}</div>
      <div class="nmeta mono">${c.value} ${esc(unit)}${less}</div></div>`;
    row.appendChild(mini('✎', () => openCountModal(h, c)));
    row.appendChild(mini('✕', async () => {
      await db.deleteEntry(c.id);
      toast(t('deleted'));
      renderHabit();
    }));
    body.appendChild(row);
  }
}

/* ---------- modale voce di conteggio (data + quantità) ---------- */
function openCountModal(h, existing) {
  const ov = $('hcountOverlay');
  $('hcountTitle').textContent = existing ? t('habit_edit_entry') : t('habit_add_entry');
  $('hcountDate').value = existing?.date ?? toIso(new Date());
  $('hcountValue').value = existing?.value ?? '';
  $('hcountUnit').textContent = h.unit || t('habit_unit_fallback');

  const done = () => {
    ov.classList.remove('open');
    $('hcountSave').onclick = $('hcountCancel').onclick = ov.onclick = null;
  };
  $('hcountCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  $('hcountSave').onclick = async () => {
    const date = $('hcountDate').value || toIso(new Date());
    const value = Math.max(0, parseInt($('hcountValue').value, 10) || 0);
    await db.setHabitCount(h.id, date, value);
    done();
    toast(t('saved'));
    renderHabit();
  };
  ov.classList.add('open');
  $('hcountValue').focus();
}
