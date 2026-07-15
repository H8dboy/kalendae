// Parser "aggiungi veloce" — modulo PURO, testato in tests/.
// Riconosce italiano E inglese (sempre entrambi, a prescindere dalla lingua
// dell'app): oggi/today, domani/tomorrow, dopodomani/day after tomorrow,
// i giorni della settimana (prossima occorrenza), date "15/08" o
// "15/08/2026", orari "15:00", "15.30" o "alle 15"/"at 15".
// Il resto del testo diventa il titolo.
// Esempio: "tomorrow 15:00 call the accountant"
//   → { title: 'call the accountant', date: '2026-07-16', time: '15:00' }

import { toIso } from './recurrence.js';

const DOWS = {
  'lunedì': 1, 'lunedi': 1, 'martedì': 2, 'martedi': 2, 'mercoledì': 3,
  'mercoledi': 3, 'giovedì': 4, 'giovedi': 4, 'venerdì': 5, 'venerdi': 5,
  'sabato': 6, 'domenica': 0,
  'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5,
  'saturday': 6, 'sunday': 0,
};

/** @param {string} text  @param {Date} [now] iniettabile nei test */
export function parseQuickAdd(text, now = new Date()) {
  let rest = ` ${text.trim()} `;
  let date = null;
  let time = null;

  const eat = (regex, onMatch) => {
    const m = rest.match(regex);
    if (m) {
      onMatch(m);
      rest = rest.replace(regex, ' ');
    }
  };

  // --- data relativa (prima le forme lunghe, che contengono le corte) ---
  eat(/\s(?:dopodomani|day\s+after\s+tomorrow)\s/i, () => { date = addDays(now, 2); });
  if (!date) eat(/\s(?:domani|tomorrow)\s/i, () => { date = addDays(now, 1); });
  if (!date) eat(/\s(?:oggi|today)\s/i, () => { date = addDays(now, 0); });

  // --- giorno della settimana: prossima occorrenza (mai oggi) ---
  if (!date) {
    for (const [name, dow] of Object.entries(DOWS)) {
      const re = new RegExp(`\\s${name}\\s`, 'i');
      if (re.test(rest)) {
        let delta = (dow - now.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        date = addDays(now, delta);
        rest = rest.replace(re, ' ');
        break;
      }
    }
  }

  // --- data esplicita gg/mm o gg/mm/aaaa ---
  if (!date) {
    eat(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s/, m => {
      const day = +m[1], mon = +m[2];
      if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
        const year = m[3] ? +m[3] : inferYear(now, mon, day);
        date = toIso(new Date(year, mon - 1, day));
      }
    });
  }

  // --- orario hh:mm / hh.mm ---
  eat(/\s(\d{1,2})[:.](\d{2})\s/, m => {
    const h = +m[1], mi = +m[2];
    if (h <= 23 && mi <= 59) time = pad(h) + ':' + pad(mi);
  });
  // --- "alle 15" / "at 15" ---
  if (!time) {
    eat(/\s(?:alle?|at)\s+(\d{1,2})\s/i, m => {
      const h = +m[1];
      if (h <= 23) time = pad(h) + ':00';
    });
  }

  const title = rest.replace(/\s+/g, ' ').trim();
  return { title, date, time };
}

const pad = n => String(n).padStart(2, '0');

function addDays(now, n) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  return toIso(d);
}

// "15/08" senza anno: se la data è già passata quest'anno, si intende il prossimo.
function inferYear(now, mon, day) {
  const y = now.getFullYear();
  const candidate = new Date(y, mon - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return candidate < today ? y + 1 : y;
}
