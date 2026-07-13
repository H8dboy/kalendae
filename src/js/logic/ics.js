// Export iCalendar (.ics) — modulo PURO, testato in tests/.
// Genera un VCALENDAR con un VEVENT per ogni attività con data.
// Le ricorrenze diventano RRULE standard, così Google Calendar & co. le capiscono.

const RRULES = {
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

// Escape richiesto da RFC 5545 per i campi di testo.
export function escapeIcsText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDate(dateIso) {
  return dateIso.replaceAll('-', '');
}

function icsDateTime(dateIso, timeHm) {
  return `${icsDate(dateIso)}T${timeHm.replace(':', '')}00`;
}

/**
 * @param {Array} activities  attività (solo quelle con date verranno esportate)
 * @param {Date} [now]        iniettabile nei test (per DTSTAMP/UID stabili)
 * @returns {string} contenuto del file .ics
 */
export function buildIcs(activities, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AGENDA-H8//IT',
    'CALSCALE:GREGORIAN',
  ];
  for (const a of activities) {
    if (!a.date) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:agenda-h8-${a.id}@h8`);
    lines.push(`DTSTAMP:${stamp}`);
    if (a.time) {
      lines.push(`DTSTART:${icsDateTime(a.date, a.time)}`);
    } else {
      // Evento "tutto il giorno": DTSTART;VALUE=DATE senza orario.
      lines.push(`DTSTART;VALUE=DATE:${icsDate(a.date)}`);
    }
    if (a.recurrence && RRULES[a.recurrence]) lines.push(`RRULE:${RRULES[a.recurrence]}`);
    lines.push(`SUMMARY:${escapeIcsText(a.title)}`);
    if (a.description) lines.push(`DESCRIPTION:${escapeIcsText(a.description)}`);
    lines.push(`STATUS:${a.done ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545: terminatore di riga CRLF.
  return lines.join('\r\n') + '\r\n';
}
