// Astinenza — logica PURA (niente DOM/DB), testata in tests/habits.test.js.
// Due modalità: 'streak' (tempo senza) e 'counter' (conteggio giornaliero).

const MS_DAY = 86400000;

/**
 * Parse di 'YYYY-MM-DD HH:MM' (ora locale) → Date, oppure null se non valido.
 * Accetta anche solo 'YYYY-MM-DD' (mezzanotte).
 */
export function parseStamp(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Tempo trascorso da startedAt a now → { days, hours, minutes, ms }.
 * Mai negativo (se startedAt è nel futuro torna zeri).
 */
export function elapsed(startedAt, now = new Date()) {
  const start = startedAt instanceof Date ? startedAt : parseStamp(startedAt);
  if (!start) return { days: 0, hours: 0, minutes: 0, ms: 0 };
  const ms = Math.max(0, (now instanceof Date ? now.getTime() : now) - start.getTime());
  return {
    days: Math.floor(ms / MS_DAY),
    hours: Math.floor((ms % MS_DAY) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    ms,
  };
}

/** Giorni interi di streak (0 se startedAt assente/futuro). */
export function streakDays(startedAt, now = new Date()) {
  return elapsed(startedAt, now).days;
}

/** Nuovo record confrontando lo streak concluso con quello memorizzato. */
export function bestOf(prevBest, endedDays) {
  return Math.max(Math.max(0, prevBest | 0), Math.max(0, endedDays | 0));
}

/* ---------------- modalità conteggio ---------------- */

/** Somma le quantità delle voci [{date,value}] con data in [from,to] inclusi. */
export function sumRange(entries, from, to) {
  let tot = 0;
  for (const e of entries ?? []) {
    const d = e.date ?? '';
    if (d >= from && d <= to) tot += Math.max(0, e.value | 0);
  }
  return tot;
}

/** Numero di giorni distinti con una voce in [from,to]. */
export function loggedDays(entries, from, to) {
  const set = new Set();
  for (const e of entries ?? []) {
    const d = e.date ?? '';
    if (d >= from && d <= to) set.add(d);
  }
  return set.size;
}

/** Quantità "in meno" rispetto al solito in un giorno (mai negativa). */
export function reduced(value, baseline) {
  if (baseline == null) return 0;
  return Math.max(0, (baseline | 0) - Math.max(0, value | 0));
}

/**
 * Totale "in meno" rispetto al baseline sui giorni loggati in [from,to].
 * Somma per ogni giorno con voce: max(0, baseline - quantità).
 */
export function reducedRange(entries, baseline, from, to) {
  if (baseline == null) return 0;
  let tot = 0;
  for (const e of entries ?? []) {
    const d = e.date ?? '';
    if (d >= from && d <= to) tot += reduced(e.value, baseline);
  }
  return tot;
}

/* ---------------- soldi risparmiati (centesimi) ---------------- */

/** Streak: giorni di astinenza × costo giornaliero evitato. */
export function savedStreakCents(days, costPerDayCents) {
  if (!costPerDayCents) return 0;
  return Math.max(0, days | 0) * (costPerDayCents | 0);
}

/** Counter: unità "in meno" × costo per unità. */
export function savedCounterCents(reducedUnits, costPerUnitCents) {
  if (!costPerUnitCents) return 0;
  return Math.max(0, reducedUnits | 0) * (costPerUnitCents | 0);
}
