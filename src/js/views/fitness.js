// Sezione FITNESS: ogni sport ha le sue schede di allenamento (liste di
// esercizi con serie/ripetizioni/carico/recupero) e un diario degli
// allenamenti svolti. I campi sono testuali così valgono per qualunque sport
// (palestra, nuoto, corsa...).
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog, esc } from '../ui/modal.js';
import { toIso } from '../logic/recurrence.js';
import { hmToMinutes, minutesToHm, fmtMinutes } from '../logic/workhours.js';

const $ = id => document.getElementById(id);

const SPORT_ICONS = ['🏋', '🏊', '🏃', '🚴', '⚽', '🏀', '🎾', '🥊', '🥋', '🧘', '🏐', '⛰'];

let navigate = null;       // showScreen di main.js
let currentSport = null;   // { id, name, icon }
let currentPlan = null;    // { id, name }

export function initFitness({ showScreen }) {
  navigate = showScreen;
  $('fabSport').addEventListener('click', () => openSportModal(null));
  $('fabExercise').addEventListener('click', () => openExerciseModal(null));
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

/* ================= elenco sport ================= */
export async function renderSports() {
  const sports = await db.listSports();
  const list = $('sportList');
  list.innerHTML = '';

  if (!sports.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('no_sports');
    list.appendChild(e);
    return;
  }

  for (const s of sports) {
    const row = document.createElement('div');
    row.className = 'folder';
    row.innerHTML = `<span style="font-size:20px">${esc(s.icon)}</span>
      <span class="fname">${esc(s.name)}</span>
      <span class="fcount mono">${s.plan_count}📋 ${s.workout_count}✓</span>`;
    row.appendChild(mini('✎', () => openSportModal(s)));
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_sport')))) return;
      await db.deleteSport(s.id);
      toast(t('deleted'));
      renderSports();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentSport = s;
      navigate('sport');
    });
    list.appendChild(row);
  }
}

/* ---------- modale sport (nome + icona) ---------- */
function openSportModal(existing) {
  const ov = $('sportOverlay');
  $('sportTitle').textContent = existing ? t('edit_sport') : t('new_sport');
  const nameInput = $('sportName');
  nameInput.placeholder = t('sport_placeholder');
  nameInput.value = existing?.name ?? '';
  let icon = existing?.icon ?? SPORT_ICONS[0];

  const icons = $('sportIcons');
  icons.innerHTML = '';
  for (const em of SPORT_ICONS) {
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

  const done = () => {
    ov.classList.remove('open');
    $('sportSave').onclick = $('sportCancel').onclick = ov.onclick = null;
  };
  $('sportCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  $('sportSave').onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) { toast(t('missing_title')); return; }
    if (existing) await db.updateSport(existing.id, name, icon);
    else await db.createSport(name, icon);
    done();
    toast(t('saved'));
    renderSports();
  };
  ov.classList.add('open');
  nameInput.focus();
}

/* ================= dettaglio sport: schede + diario ================= */
export async function renderSport() {
  if (!currentSport) { navigate('fitness'); return; }
  // Ricarica lo sport dal DB (nome/icona possono essere cambiati).
  const sports = await db.listSports();
  const s = sports.find(x => x.id === currentSport.id);
  if (!s) { navigate('fitness'); return; }
  currentSport = s;
  $('screenTitle').textContent = `${s.icon} ${s.name}`;

  const body = $('sportBody');
  body.innerHTML = '';

  /* --- schede --- */
  body.appendChild(sectionHead(t('plans_section'), async () => {
    const name = await promptDialog(t('new_plan'), t('plan_name_label'), t('plan_placeholder'));
    if (name) { await db.createPlan(s.id, name); renderSport(); }
  }));

  const plans = await db.listPlans(s.id);
  if (!plans.length) {
    body.appendChild(subLine(t('no_plans')));
  }
  for (const p of plans) {
    const row = document.createElement('div');
    row.className = 'folder';
    row.innerHTML = `<span style="font-size:18px">📋</span>
      <span class="fname">${esc(p.name)}</span>
      <span class="fcount mono">${p.exercise_count} ${t('exercises_count')}</span>`;
    row.appendChild(mini('✎', async () => {
      const name = await promptDialog(t('rename_plan'), t('plan_name_label'), '', p.name);
      if (name && name !== p.name) { await db.renamePlan(p.id, name); renderSport(); }
    }));
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_plan')))) return;
      await db.deletePlan(p.id);
      toast(t('deleted'));
      renderSport();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentPlan = p;
      navigate('plan');
    });
    body.appendChild(row);
  }

  /* --- diario --- */
  body.appendChild(sectionHead(t('diary_section'), () => openWorkoutModal(null)));

  const workouts = await db.listWorkouts(s.id);
  if (!workouts.length) {
    body.appendChild(subLine(t('no_workouts')));
  }
  for (const w of workouts) {
    const row = document.createElement('div');
    row.className = 'note';
    const meta = [
      w.date,
      w.plan_name ? `📋 ${w.plan_name}` : '',
      w.minutes > 0 ? `⏱ ${fmtMinutes(w.minutes)}` : '',
    ].filter(Boolean).join('  ·  ');
    row.innerHTML = `<div class="nbody">
        <div class="ntitle">${esc(firstLine(w.notes) || w.plan_name || t('fitness'))}</div>
        <div class="nmeta">${esc(meta)}</div>
      </div>`;
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_workout')))) return;
      await db.deleteWorkout(w.id);
      toast(t('deleted'));
      renderSport();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      openWorkoutModal(w);
    });
    body.appendChild(row);
  }
}

function sectionHead(label, onAdd) {
  const h = document.createElement('div');
  h.className = 'shead';
  h.style.display = 'flex';
  h.style.alignItems = 'center';
  const span = document.createElement('span');
  span.textContent = label;
  span.style.flex = '1';
  h.appendChild(span);
  h.appendChild(mini('＋', onAdd));
  return h;
}

function subLine(text) {
  const e = document.createElement('div');
  e.className = 'sub';
  e.textContent = text;
  return e;
}

const firstLine = s => (s ?? '').trim().split('\n')[0];

/* ---------- modale allenamento (diario) ---------- */
async function openWorkoutModal(existing) {
  const ov = $('woOverlay');
  $('woTitle').textContent = existing ? t('edit_workout') : t('log_workout');
  $('woDate').value = existing?.date ?? toIso(new Date());

  const sel = $('woPlan');
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = t('workout_no_plan');
  sel.appendChild(none);
  for (const p of await db.listPlans(currentSport.id)) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    if (existing?.plan_id === p.id) o.selected = true;
    sel.appendChild(o);
  }

  const { h, m } = minutesToHm(existing?.minutes ?? 0);
  $('woH').value = h || '';
  $('woM').value = m || '';
  $('woNotes').value = existing?.notes ?? '';

  const delBtn = $('woDelete');
  delBtn.hidden = !existing;

  const done = () => {
    ov.classList.remove('open');
    $('woSave').onclick = $('woCancel').onclick = delBtn.onclick = ov.onclick = null;
  };
  $('woCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  delBtn.onclick = async () => {
    if (!(await confirmDialog(t('confirm_delete_workout')))) return;
    await db.deleteWorkout(existing.id);
    done();
    toast(t('deleted'));
    renderSport();
  };
  $('woSave').onclick = async () => {
    const w = {
      sport_id: currentSport.id,
      plan_id: sel.value ? +sel.value : null,
      date: $('woDate').value || toIso(new Date()),
      minutes: hmToMinutes($('woH').value, $('woM').value),
      notes: $('woNotes').value.trim(),
    };
    if (existing) await db.updateWorkout(existing.id, w);
    else await db.addWorkout(w);
    done();
    toast(t('saved'));
    renderSport();
  };
  ov.classList.add('open');
}

/* ================= scheda: elenco esercizi ================= */
export async function renderPlan() {
  if (!currentPlan) { navigate('fitness'); return; }
  const p = await db.getPlan(currentPlan.id);
  if (!p) { navigate('fitness'); return; }
  currentPlan = p;
  $('screenTitle').textContent = `📋 ${p.name}`;

  const body = $('planBody');
  body.innerHTML = '';

  const exercises = await db.listExercises(p.id);
  if (!exercises.length) {
    body.appendChild(subLine(t('no_exercises')));
    return;
  }

  exercises.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'note';
    const meta = [
      e.sets && e.reps ? `${e.sets} × ${e.reps}` : (e.sets || e.reps),
      e.load,
      e.rest ? `⏲ ${e.rest}` : '',
    ].filter(Boolean).join('  ·  ');
    row.innerHTML = `<span class="fcount mono" style="min-width:24px;text-align:right">${i + 1}.</span>
      <div class="nbody">
        <div class="ntitle">${esc(e.name)}</div>
        ${meta ? `<div class="nmeta">${esc(meta)}</div>` : ''}
        ${e.notes ? `<div class="nmeta">${esc(firstLine(e.notes))}</div>` : ''}
      </div>`;
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_exercise')))) return;
      await db.deleteExercise(e.id);
      toast(t('deleted'));
      renderPlan();
    }));
    row.addEventListener('click', ev => {
      if (ev.target.closest('.iconbtn-mini')) return;
      openExerciseModal(e);
    });
    body.appendChild(row);
  });
}

/* ---------- modale esercizio ---------- */
function openExerciseModal(existing) {
  const ov = $('exOverlay');
  $('exTitle').textContent = existing ? t('edit_exercise') : t('new_exercise');
  $('exName').placeholder = t('exercise_placeholder');
  $('exName').value = existing?.name ?? '';
  $('exSets').value = existing?.sets ?? '';
  $('exReps').value = existing?.reps ?? '';
  $('exLoad').value = existing?.load ?? '';
  $('exRest').value = existing?.rest ?? '';
  $('exNotes').value = existing?.notes ?? '';

  const delBtn = $('exDelete');
  delBtn.hidden = !existing;

  const done = () => {
    ov.classList.remove('open');
    $('exSave').onclick = $('exCancel').onclick = delBtn.onclick = ov.onclick = null;
  };
  $('exCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  delBtn.onclick = async () => {
    if (!(await confirmDialog(t('confirm_delete_exercise')))) return;
    await db.deleteExercise(existing.id);
    done();
    toast(t('deleted'));
    renderPlan();
  };
  $('exSave').onclick = async () => {
    const name = $('exName').value.trim();
    if (!name) { toast(t('missing_title')); return; }
    const e = {
      name,
      sets: $('exSets').value.trim(),
      reps: $('exReps').value.trim(),
      load: $('exLoad').value.trim(),
      rest: $('exRest').value.trim(),
      notes: $('exNotes').value.trim(),
    };
    if (existing) await db.updateExercise(existing.id, e);
    else await db.addExercise(currentPlan.id, e);
    done();
    toast(t('saved'));
    renderPlan();
  };
  ov.classList.add('open');
  $('exName').focus();
}
