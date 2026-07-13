// Logica ricorrenze — modulo PURO (niente DOM, niente Tauri): testato in tests/.
// Un'attività ricorrente ha una data di partenza (activity.date) e una regola
// ('daily' | 'weekly' | 'monthly' | 'yearly'). Le occorrenze non sono salvate
// in DB: si calcola a runtime se l'attività "cade" in un certo giorno.

const DAY_MS = 86400000;

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * L'attività occorre nel giorno targetIso?
 * Regole: mai prima della data di partenza; 'monthly' sul giorno del mese
 * (il 31 nei mesi corti NON occorre — comportamento semplice e prevedibile);
 * 'yearly' su stesso giorno e mese (29 febbraio solo negli anni bisestili).
 */
export function occursOn(activity, targetIso) {
  if (!activity.date) return false;
  if (!activity.recurrence) return activity.date === targetIso;
  if (targetIso < activity.date) return false;
  if (targetIso === activity.date) return true;

  const start = parseIso(activity.date);
  const target = parseIso(targetIso);

  switch (activity.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return start.getDay() === target.getDay();
    case 'monthly':
      return start.getDate() === target.getDate();
    case 'yearly':
      return start.getDate() === target.getDate() && start.getMonth() === target.getMonth();
    default:
      return false;
  }
}

/** Tutte le occorrenze di un'attività nell'intervallo [from, to] (ISO, inclusi). */
export function occurrencesBetween(activity, from, to) {
  const out = [];
  if (!activity.date) return out;
  if (!activity.recurrence) {
    if (activity.date >= from && activity.date <= to) out.push(activity.date);
    return out;
  }
  let d = parseIso(from < activity.date ? activity.date : from);
  const end = parseIso(to);
  // Scansione giorno per giorno: gli intervalli visibili sono brevi (max un mese).
  while (d <= end) {
    const iso = toIso(d);
    if (occursOn(activity, iso)) out.push(iso);
    d = new Date(d.getTime() + DAY_MS);
  }
  return out;
}
