// Importi in denaro — modulo PURO, testato in tests/.
// Gli importi si salvano in CENTESIMI (interi) per evitare errori float.
// Il parsing accetta sia la virgola che il punto come separatore decimale.

/**
 * Testo → centesimi (intero) oppure null se non valido.
 * Accetta: "1234", "1234.56", "1234,56", "1.234,56", "1,234.56", "€ 250".
 * Regola: l'ULTIMO separatore seguito da 1-2 cifre è il decimale;
 * gli altri separatori sono migliaia e si scartano.
 */
export function parseAmount(text) {
  if (text == null) return null;
  let s = String(text).trim().replace(/[€$£\s]/g, '');
  if (!s) return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const sep = Math.max(lastDot, lastComma);
  let intPart = s, decPart = '';
  if (sep !== -1) {
    const after = s.slice(sep + 1);
    if (after.length >= 1 && after.length <= 2 && !/[.,]/.test(after)) {
      intPart = s.slice(0, sep);
      decPart = after;
    }
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (intPart === '' && decPart === '') return null;
  const cents = (parseInt(intPart || '0', 10) * 100) + parseInt((decPart + '00').slice(0, 2), 10);
  if (!Number.isFinite(cents)) return null;
  return neg ? -cents : cents;
}

/** Centesimi → testo, con separatori della lingua ('it' → 1.234,56). */
export function fmtAmount(cents, lang = 'en') {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

/** Totale versato di una lista di rate [{amount}] in centesimi. */
export function sumInstallments(rows) {
  let tot = 0;
  for (const r of rows ?? []) tot += r.amount | 0;
  return tot;
}

/** Percentuale versata rispetto al totale (0-100, clampata); null se senza totale. */
export function paidPercent(paidCents, totalCents) {
  if (!totalCents || totalCents <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((paidCents / totalCents) * 100)));
}
