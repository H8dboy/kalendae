// Festività nazionali — modulo PURO (niente DOM/Tauri), testato in tests/.
// Tutto è CALCOLATO localmente, quindi funziona per qualsiasi anno dal 1583
// al 4000 senza internet: date fisse, feste mobili cristiane (computus di
// Pasqua occidentale e ortodossa) e feste islamiche (calendario tabulare,
// precisione ±1 giorno — le date reali dipendono dall'avvistamento della luna).

const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export const MIN_YEAR = 1583;
export const MAX_YEAR = 4000;

/* ================= feste mobili cristiane ================= */

/** Pasqua occidentale (gregoriana) — algoritmo di Butcher. @returns {m,d} */
export function easterWestern(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

/** Pasqua ortodossa espressa nel calendario gregoriano — Meeus giuliano + scarto. */
export function easterOrthodox(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // scarto giuliano→gregoriano per il secolo dell'anno (13 giorni nel 1900–2099)
  const gap = Math.floor(y / 100) - Math.floor(y / 400) - 2;
  const dt = new Date(y, month - 1, day + gap);
  return { m: dt.getMonth() + 1, d: dt.getDate() };
}

/** Data (ISO) a offset di giorni da una {m,d} dell'anno y. */
function offsetDate(y, base, days) {
  const dt = new Date(y, base.m - 1, base.d + days);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/* ================= giorni della settimana ================= */

/** n-esimo giorno-della-settimana del mese (dow: 0=dom … 6=sab, n≥1). */
function nthWeekday(y, m, dow, n) {
  const first = new Date(y, m - 1, 1).getDay();
  const day = 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
  return iso(y, m, day);
}

/** Ultimo giorno-della-settimana del mese. */
function lastWeekday(y, m, dow) {
  const lastDay = new Date(y, m, 0);
  const day = lastDay.getDate() - ((lastDay.getDay() - dow + 7) % 7);
  return iso(y, m, day);
}

/* ================= calendario islamico (tabulare/civile) ================= */
// Conversione aritmetica standard: anni bisestili 2,5,7,10,13,16,18,21,24,26,29
// del ciclo di 30. Epoca civile: 1 Muharram AH1 = JDN 1948440.

function gregorianToJdn(y, m, d) {
  const a = Math.trunc((m - 14) / 12);
  return Math.trunc((1461 * (y + 4800 + a)) / 4)
    + Math.trunc((367 * (m - 2 - 12 * a)) / 12)
    - Math.trunc((3 * Math.trunc((y + 4900 + a) / 100)) / 4)
    + d - 32075;
}

function jdnToGregorian(jdn) {
  let l = jdn + 68569;
  const n = Math.trunc((4 * l) / 146097);
  l -= Math.trunc((146097 * n + 3) / 4);
  const i = Math.trunc((4000 * (l + 1)) / 1461001);
  l -= Math.trunc((1461 * i) / 4) - 31;
  const j = Math.trunc((80 * l) / 2447);
  const d = l - Math.trunc((2447 * j) / 80);
  l = Math.trunc(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;
  return { y, m, d };
}

function islamicToJdn(iy, im, id) {
  return id + Math.ceil(29.5 * (im - 1)) + (iy - 1) * 354
    + Math.floor((3 + 11 * iy) / 30) + 1948440 - 1;
}

/** Tutte le date gregoriane (ISO) in cui cade una data islamica nell'anno gy. */
function islamicInYear(gy, im, id) {
  const jdnStart = gregorianToJdn(gy, 1, 1);
  const guess = Math.floor((30 * (jdnStart - 1948440) + 10646) / 10631);
  const out = [];
  for (const iy of [guess - 1, guess, guess + 1]) {
    const g = jdnToGregorian(islamicToJdn(iy, im, id));
    if (g.y === gy) out.push(iso(g.y, g.m, g.d));
  }
  return out;
}

/* ================= definizione paesi ================= */

export const COUNTRIES = [
  { code: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: 'AL', flag: '🇦🇱', name: 'Shqipëria (Albania)' },
  { code: 'XK', flag: '🇽🇰', name: 'Kosova (Kosovo)' },
  { code: 'MK', flag: '🇲🇰', name: 'Maqedonia e Veriut' },
  { code: 'CH', flag: '🇨🇭', name: 'Svizzera' },
  { code: 'DE', flag: '🇩🇪', name: 'Deutschland (Germania)' },
  { code: 'AT', flag: '🇦🇹', name: 'Österreich (Austria)' },
  { code: 'FR', flag: '🇫🇷', name: 'France (Francia)' },
  { code: 'ES', flag: '🇪🇸', name: 'España (Spagna)' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'US', flag: '🇺🇸', name: 'United States' },
  { code: 'GR', flag: '🇬🇷', name: 'Ελλάδα (Grecia)' },
];

export const countryByCode = code => COUNTRIES.find(c => c.code === code) ?? null;

// Ogni paese è una funzione (year) → [{date, name}] con le festività NAZIONALI
// nella lingua del paese.
const RULES = {
  IT(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'Capodanno'), f(y, 1, 6, 'Epifania'),
      { date: offsetDate(y, e, 0), name: 'Pasqua' },
      { date: offsetDate(y, e, 1), name: 'Lunedì dell’Angelo' },
      f(y, 4, 25, 'Festa della Liberazione'), f(y, 5, 1, 'Festa del Lavoro'),
      f(y, 6, 2, 'Festa della Repubblica'), f(y, 8, 15, 'Ferragosto'),
      f(y, 11, 1, 'Ognissanti'), f(y, 12, 8, 'Immacolata Concezione'),
      f(y, 12, 25, 'Natale'), f(y, 12, 26, 'Santo Stefano'),
    ];
  },
  AL(y) {
    const e = easterWestern(y), o = easterOrthodox(y);
    return [
      f(y, 1, 1, 'Viti i Ri'), f(y, 1, 2, 'Viti i Ri (dita 2)'),
      f(y, 3, 14, 'Dita e Verës'), f(y, 3, 22, 'Dita e Nevruzit'),
      { date: offsetDate(y, e, 0), name: 'Pashkët Katolike' },
      { date: offsetDate(y, o, 0), name: 'Pashkët Ortodokse' },
      f(y, 5, 1, 'Dita e Punëtorëve'),
      ...islamicInYear(y, 10, 1).map(d => ({ date: d, name: 'Fitër Bajrami' })),
      ...islamicInYear(y, 12, 10).map(d => ({ date: d, name: 'Kurban Bajrami' })),
      f(y, 9, 5, 'Dita e Nënë Terezës'),
      f(y, 11, 28, 'Dita e Pavarësisë'), f(y, 11, 29, 'Dita e Çlirimit'),
      f(y, 12, 8, 'Dita e Rinisë'), f(y, 12, 25, 'Krishtlindja'),
    ];
  },
  XK(y) {
    const e = easterWestern(y), o = easterOrthodox(y);
    return [
      f(y, 1, 1, 'Viti i Ri'), f(y, 1, 7, 'Krishtlindja Ortodokse'),
      f(y, 2, 17, 'Dita e Pavarësisë'), f(y, 4, 9, 'Dita e Kushtetutës'),
      { date: offsetDate(y, e, 1), name: 'E hëna e Pashkëve Katolike' },
      { date: offsetDate(y, o, 1), name: 'E hëna e Pashkëve Ortodokse' },
      f(y, 5, 1, 'Dita e Punës'), f(y, 5, 9, 'Dita e Evropës'),
      ...islamicInYear(y, 10, 1).map(d => ({ date: d, name: 'Fitër Bajrami' })),
      ...islamicInYear(y, 12, 10).map(d => ({ date: d, name: 'Kurban Bajrami' })),
      f(y, 12, 25, 'Krishtlindja Katolike'),
    ];
  },
  MK(y) {
    const o = easterOrthodox(y);
    return [
      f(y, 1, 1, 'Viti i Ri'), f(y, 1, 7, 'Krishtlindja Ortodokse'),
      { date: offsetDate(y, o, 1), name: 'E hëna e Pashkëve Ortodokse' },
      f(y, 5, 1, 'Dita e Punës'), f(y, 5, 24, 'Shën Cirili dhe Metodi'),
      ...islamicInYear(y, 10, 1).map(d => ({ date: d, name: 'Fitër Bajrami' })),
      f(y, 8, 2, 'Dita e Republikës (Ilinden)'),
      f(y, 9, 8, 'Dita e Pavarësisë'), f(y, 10, 11, 'Dita e Kryengritjes'),
      f(y, 10, 23, 'Dita e Luftës Revolucionare'), f(y, 12, 8, 'Shën Klimenti i Ohrit'),
    ];
  },
  CH(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'Capodanno / Neujahr'),
      { date: offsetDate(y, e, -2), name: 'Venerdì Santo / Karfreitag' },
      { date: offsetDate(y, e, 1), name: 'Lunedì di Pasqua / Ostermontag' },
      { date: offsetDate(y, e, 39), name: 'Ascensione / Auffahrt' },
      { date: offsetDate(y, e, 50), name: 'Lunedì di Pentecoste / Pfingstmontag' },
      f(y, 8, 1, 'Festa nazionale / Bundesfeier'),
      f(y, 12, 25, 'Natale / Weihnachten'), f(y, 12, 26, 'Santo Stefano / Stephanstag'),
    ];
  },
  DE(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'Neujahr'),
      { date: offsetDate(y, e, -2), name: 'Karfreitag' },
      { date: offsetDate(y, e, 1), name: 'Ostermontag' },
      f(y, 5, 1, 'Tag der Arbeit'),
      { date: offsetDate(y, e, 39), name: 'Christi Himmelfahrt' },
      { date: offsetDate(y, e, 50), name: 'Pfingstmontag' },
      f(y, 10, 3, 'Tag der Deutschen Einheit'),
      f(y, 12, 25, '1. Weihnachtstag'), f(y, 12, 26, '2. Weihnachtstag'),
    ];
  },
  AT(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'Neujahr'), f(y, 1, 6, 'Heilige Drei Könige'),
      { date: offsetDate(y, e, 1), name: 'Ostermontag' },
      f(y, 5, 1, 'Staatsfeiertag'),
      { date: offsetDate(y, e, 39), name: 'Christi Himmelfahrt' },
      { date: offsetDate(y, e, 50), name: 'Pfingstmontag' },
      { date: offsetDate(y, e, 60), name: 'Fronleichnam' },
      f(y, 8, 15, 'Mariä Himmelfahrt'), f(y, 10, 26, 'Nationalfeiertag'),
      f(y, 11, 1, 'Allerheiligen'), f(y, 12, 8, 'Mariä Empfängnis'),
      f(y, 12, 25, 'Christtag'), f(y, 12, 26, 'Stefanitag'),
    ];
  },
  FR(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'Jour de l’an'),
      { date: offsetDate(y, e, 1), name: 'Lundi de Pâques' },
      f(y, 5, 1, 'Fête du Travail'), f(y, 5, 8, 'Victoire 1945'),
      { date: offsetDate(y, e, 39), name: 'Ascension' },
      { date: offsetDate(y, e, 50), name: 'Lundi de Pentecôte' },
      f(y, 7, 14, 'Fête nationale'), f(y, 8, 15, 'Assomption'),
      f(y, 11, 1, 'Toussaint'), f(y, 11, 11, 'Armistice 1918'),
      f(y, 12, 25, 'Noël'),
    ];
  },
  ES(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'Año Nuevo'), f(y, 1, 6, 'Epifanía del Señor'),
      { date: offsetDate(y, e, -2), name: 'Viernes Santo' },
      f(y, 5, 1, 'Fiesta del Trabajo'), f(y, 8, 15, 'Asunción de la Virgen'),
      f(y, 10, 12, 'Fiesta Nacional de España'), f(y, 11, 1, 'Todos los Santos'),
      f(y, 12, 6, 'Día de la Constitución'), f(y, 12, 8, 'Inmaculada Concepción'),
      f(y, 12, 25, 'Navidad'),
    ];
  },
  GB(y) {
    const e = easterWestern(y);
    return [
      f(y, 1, 1, 'New Year’s Day'),
      { date: offsetDate(y, e, -2), name: 'Good Friday' },
      { date: offsetDate(y, e, 1), name: 'Easter Monday' },
      { date: nthWeekday(y, 5, 1, 1), name: 'Early May Bank Holiday' },
      { date: lastWeekday(y, 5, 1), name: 'Spring Bank Holiday' },
      { date: lastWeekday(y, 8, 1), name: 'Summer Bank Holiday' },
      f(y, 12, 25, 'Christmas Day'), f(y, 12, 26, 'Boxing Day'),
    ];
  },
  US(y) {
    return [
      f(y, 1, 1, 'New Year’s Day'),
      { date: nthWeekday(y, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
      { date: nthWeekday(y, 2, 1, 3), name: 'Presidents’ Day' },
      { date: lastWeekday(y, 5, 1), name: 'Memorial Day' },
      f(y, 6, 19, 'Juneteenth'), f(y, 7, 4, 'Independence Day'),
      { date: nthWeekday(y, 9, 1, 1), name: 'Labor Day' },
      { date: nthWeekday(y, 10, 1, 2), name: 'Columbus Day' },
      f(y, 11, 11, 'Veterans Day'),
      { date: nthWeekday(y, 11, 4, 4), name: 'Thanksgiving' },
      f(y, 12, 25, 'Christmas Day'),
    ];
  },
  GR(y) {
    const o = easterOrthodox(y);
    return [
      f(y, 1, 1, 'Πρωτοχρονιά'), f(y, 1, 6, 'Θεοφάνεια'),
      { date: offsetDate(y, o, -48), name: 'Καθαρά Δευτέρα' },
      f(y, 3, 25, 'Εθνική Εορτή (25η Μαρτίου)'),
      { date: offsetDate(y, o, -2), name: 'Μεγάλη Παρασκευή' },
      { date: offsetDate(y, o, 1), name: 'Δευτέρα του Πάσχα' },
      f(y, 5, 1, 'Εργατική Πρωτομαγιά'),
      { date: offsetDate(y, o, 50), name: 'Δευτέρα Πεντηκοστής' },
      f(y, 8, 15, 'Κοίμηση της Θεοτόκου'), f(y, 10, 28, 'Ημέρα του Όχι'),
      f(y, 12, 25, 'Χριστούγεννα'), f(y, 12, 26, 'Σύναξη της Θεοτόκου'),
    ];
  },
};

const f = (y, m, d, name) => ({ date: iso(y, m, d), name });

/**
 * Festività nazionali di un paese per un anno.
 * @param {string} code codice paese ('IT', 'AL', …) — '' o sconosciuto → []
 * @returns {Array<{date: string, name: string}>} ordinate per data
 */
export function getHolidays(code, year) {
  const rule = RULES[code];
  if (!rule || year < MIN_YEAR || year > MAX_YEAR) return [];
  return rule(year).sort((a, b) => a.date.localeCompare(b.date));
}

/** Mappa data ISO → [nomi] per un anno (comoda per il rendering del calendario). */
export function holidayMap(code, year) {
  const map = new Map();
  for (const h of getHolidays(code, year)) {
    if (!map.has(h.date)) map.set(h.date, []);
    map.get(h.date).push(h.name);
  }
  return map;
}
