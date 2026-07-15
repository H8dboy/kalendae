// Ore di lavoro: conversioni h/m ⇄ minuti e totale mensile.
// Logica pura (niente DOM/DB) così è testabile con node:test.

/** Converte ore+minuti in minuti totali, con valori sporchi normalizzati. */
export function hmToMinutes(h, m) {
  const hh = Math.max(0, Math.floor(Number(h) || 0));
  const mm = Math.max(0, Math.floor(Number(m) || 0));
  return hh * 60 + mm;
}

/** Spezza i minuti totali in { h, m } per riempire i campi del modale. */
export function minutesToHm(min) {
  const tot = Math.max(0, Math.floor(Number(min) || 0));
  return { h: Math.floor(tot / 60), m: tot % 60 };
}

/** Formatta i minuti come '7h 30m' (o '45m' se meno di un'ora, '0m' se zero). */
export function fmtMinutes(min) {
  const { h, m } = minutesToHm(min);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Formato corto per la casella del calendario: '7:30' / '0:45'. */
export function fmtMinutesShort(min) {
  const { h, m } = minutesToHm(min);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Totale minuti del mese: somma le righe { date:'YYYY-MM-DD', minutes }
 * la cui data appartiene al mese 'YYYY-MM'.
 */
export function sumMonth(rows, ym) {
  let tot = 0;
  for (const r of rows ?? []) {
    if ((r.date ?? '').startsWith(ym + '-')) tot += Math.max(0, r.minutes | 0);
  }
  return tot;
}
