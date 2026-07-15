// Statistiche: attività completate per settimana, mese e gruppo.
// Grafico a barre orizzontali in HTML/CSS: serie singola (una sola tinta,
// il colore accento del tema), etichetta a sinistra e valore in testo a destra
// — l'identità la porta l'etichetta, mai il colore.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { esc } from '../ui/modal.js';
import { fmtMinutes } from '../logic/workhours.js';

const $ = id => document.getElementById(id);

export async function render() {
  const body = $('statsBody');
  body.innerHTML = '';

  const [byWeek, byMonth, byGroup, workMonths, workoutMonths] = await Promise.all([
    db.statsByWeek(), db.statsByMonth(), db.statsByGroup(),
    db.statsWorkByMonth(), db.statsWorkoutsByMonth(),
  ]);

  if (!byWeek.length && !byMonth.length && !byGroup.length
      && !workMonths.length && !workoutMonths.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('stats_empty');
    body.appendChild(e);
    return;
  }

  // Le query restituiscono i bucket più recenti per primi: si mostrano in ordine cronologico.
  if (byWeek.length) body.appendChild(card(t('stats_week'), [...byWeek].reverse()));
  if (byMonth.length) body.appendChild(card(t('stats_month'), [...byMonth].reverse()));
  if (byGroup.length) body.appendChild(card(t('stats_group'), byGroup));
  if (workMonths.length)
    body.appendChild(card(t('stats_work'), [...workMonths].reverse(), fmtMinutes));
  if (workoutMonths.length)
    body.appendChild(card(t('stats_workouts'), [...workoutMonths].reverse()));
}

/** Card con grafico a barre orizzontali. rows: [{bucket, n}], fmt formatta il valore. */
function card(title, rows, fmt = String) {
  const box = document.createElement('div');
  box.className = 'statcard';
  const h = document.createElement('h4');
  h.textContent = title;
  box.appendChild(h);

  const max = Math.max(1, ...rows.map(r => r.n));
  for (const r of rows) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0;min-height:24px';
    const pct = Math.max(2, Math.round((r.n / max) * 100));
    row.innerHTML = `
      <span class="mono" style="width:88px;flex:none;font-size:11px;color:var(--dim);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(r.bucket))}</span>
      <span style="flex:1;min-width:0">
        <span title="${esc(String(r.bucket))}: ${esc(fmt(r.n))}" style="display:block;height:10px;width:${pct}%;
          background:var(--neon);border-radius:0 4px 4px 0"></span>
      </span>
      <span class="mono" style="min-width:32px;flex:none;text-align:right;font-size:12px;
        color:var(--ink)">${esc(fmt(r.n))}</span>`;
    box.appendChild(row);
  }
  return box;
}
