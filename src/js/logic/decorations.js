// Decorazioni festive sul calendario — modulo PURO, testato in tests/.
// Ogni data può avere emoji a tema: 🎃 Halloween, 🎄 Natale, 🎆 San Silvestro,
// l'animale zodiacale al Capodanno cinese, 🐣 Pasqua, 🎭 Carnevale, ecc.
// Sono indipendenti dallo stato scelto per le festività: appaiono sempre.

import { easterWestern } from './holidays.js';

const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/* ---------- Capodanno cinese ----------
   Il calendario cinese non ha una formula semplice: si usa la tabella delle
   date pubblicate (2024–2044). Fuori intervallo: nessuna decorazione.
   L'animale segue il ciclo di 12 anni: 2024 drago. */
export const CNY_DATES = {
  2024: '02-10', 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26',
  2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31',
  2034: '02-19', 2035: '02-08', 2036: '01-28', 2037: '02-15', 2038: '02-04',
  2039: '01-24', 2040: '02-12', 2041: '02-01', 2042: '01-22', 2043: '02-10',
  2044: '01-30',
};

// Ciclo zodiacale: indice = anno % 12 (2024 % 12 = 8 → drago).
const ZODIAC_EMOJI = ['🐒', '🐓', '🐕', '🐖', '🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐'];
const ZODIAC_KEYS = ['monkey', 'rooster', 'dog', 'pig', 'rat', 'ox', 'tiger', 'rabbit',
                     'dragon', 'snake', 'horse', 'goat'];

/** Zodiaco cinese dell'anno: { emoji, key } (key per la stringa i18n zodiac_*). */
export function chineseZodiac(year) {
  const i = ((year % 12) + 12) % 12;
  return { emoji: ZODIAC_EMOJI[i], key: ZODIAC_KEYS[i] };
}

/**
 * Decorazioni dell'anno: Map(dataIso → [{ emoji, key }]).
 * key è la chiave i18n del nome (deco_*), usata per il tooltip.
 */
export function decorationMap(year) {
  const map = new Map();
  const add = (dateIso, emoji, key) => {
    if (!map.has(dateIso)) map.set(dateIso, []);
    map.get(dateIso).push({ emoji, key });
  };

  // date fisse
  add(iso(year, 1, 1), '🎇', 'deco_new_year');
  add(iso(year, 1, 6), '🧙', 'deco_epiphany');
  add(iso(year, 2, 14), '❤️', 'deco_valentine');
  add(iso(year, 10, 31), '🎃', 'deco_halloween');
  add(iso(year, 12, 24), '🌟', 'deco_xmas_eve');
  add(iso(year, 12, 25), '🎄', 'deco_christmas');
  add(iso(year, 12, 31), '🎆', 'deco_nye');

  // mobili sulla Pasqua occidentale
  const e = easterWestern(year);
  const easterDt = new Date(year, e.m - 1, e.d);
  const off = days => {
    const d = new Date(easterDt);
    d.setDate(d.getDate() + days);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  add(off(0), '🐣', 'deco_easter');
  add(off(-47), '🎭', 'deco_carnival');   // martedì grasso

  // Capodanno cinese: emoji dell'animale dell'anno
  const cny = CNY_DATES[year];
  if (cny) add(`${year}-${cny}`, chineseZodiac(year).emoji, 'deco_cny');

  return map;
}
