// Turni di lavoro: durata di un turno dagli orari e totale mensile.
// Logica pura (niente DOM/DB) così è testabile con node:test.
// Per la formattazione dei minuti si riusa fmtMinutes di workhours.js.

/** Minuti di 'HH:MM' dall'inizio del giorno; NaN se il formato non è valido. */
function hhmmToMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return NaN;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

/**
 * Durata di un turno in minuti dagli orari inizio/fine.
 * - orario mancante o non valido → 0 (turni tipo Riposo/Ferie).
 * - overnight (fine <= inizio, es. 22:00→06:00) → conta fino al giorno dopo.
 */
export function shiftMinutes(start, end) {
  const s = hhmmToMin(start), e = hhmmToMin(end);
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  let diff = e - s;
  if (diff <= 0) diff += 24 * 60; // scavalca la mezzanotte
  return diff;
}

/**
 * Totale minuti dei turni del mese 'YYYY-MM'.
 * @param assignments righe { date:'YYYY-MM-DD', shift_id }
 * @param typesById   mappa/oggetto shift_id → { start, end }
 */
export function sumMonthShifts(assignments, typesById, ym) {
  const get = id => (typesById instanceof Map ? typesById.get(id) : typesById?.[id]);
  let tot = 0;
  for (const a of assignments ?? []) {
    if (!(a.date ?? '').startsWith(ym + '-')) continue;
    const st = get(a.shift_id);
    if (st) tot += shiftMinutes(st.start, st.end);
  }
  return tot;
}
