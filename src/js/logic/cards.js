// Biglietti da visita (wallet): logica pura — niente DOM/DB, così è testabile.
// Un biglietto = foto fronte/retro + i campi per chiamare al volo (nome, mestiere,
// telefono). Il punto della sezione è: trovare l'idraulico e chiamarlo in due tap.

// Mestieri suggeriti: icona + chiave i18n. L'ordine è quello dei chip nella modale.
export const TRADES = [
  { icon: '🔧', key: 'trade_plumber' },
  { icon: '⚡', key: 'trade_electrician' },
  { icon: '🧱', key: 'trade_builder' },
  { icon: '🪚', key: 'trade_carpenter' },
  { icon: '🎨', key: 'trade_painter' },
  { icon: '❄️', key: 'trade_hvac' },
  { icon: '🔑', key: 'trade_locksmith' },
  { icon: '🚗', key: 'trade_mechanic' },
  { icon: '🌿', key: 'trade_gardener' },
  { icon: '🧹', key: 'trade_cleaning' },
  { icon: '🚚', key: 'trade_transport' },
  { icon: '🩺', key: 'trade_doctor' },
  { icon: '⚖️', key: 'trade_lawyer' },
  { icon: '📊', key: 'trade_accountant' },
  { icon: '🏠', key: 'trade_agency' },
  { icon: '📇', key: 'trade_other' },
];

export const DEFAULT_ICON = '📇';

/** Solo le cifre di un numero (il + iniziale resta come prefisso internazionale). */
export function digits(phone) {
  const s = String(phone ?? '').trim();
  const plus = s.startsWith('+') ? '+' : '';
  return plus + s.replace(/\D/g, '');
}

/**
 * Link tel: per chiamare. Restituisce null se non c'è un numero plausibile
 * (meno di 3 cifre = campo vuoto o testo qualsiasi).
 */
export function telHref(phone) {
  const d = digits(phone);
  if (d.replace(/\D/g, '').length < 3) return null;
  return 'tel:' + d;
}

/** Link mailto:; null se non sembra un indirizzo email. */
export function mailHref(email) {
  const s = String(email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? 'mailto:' + s : null;
}

const norm = s => String(s ?? '').toLowerCase();

/**
 * Filtro della ricerca interna alla sezione: cerca in tutti i campi testuali.
 * Se la query contiene cifre, confronta anche i numeri ignorando spazi e trattini
 * (così "3331234" trova "333 123 4567").
 */
export function cardMatches(card, query) {
  const q = norm(query).trim();
  if (!q) return true;
  const hay = [card.name, card.trade, card.phone, card.phone2, card.email, card.address, card.notes]
    .map(norm).join(' ');
  if (hay.includes(q)) return true;
  const qd = q.replace(/\D/g, '');
  if (!qd) return false;
  return [card.phone, card.phone2].some(p => digits(p).replace(/\D/g, '').includes(qd));
}

/** Filtro per mestiere: '' = tutti. */
export const cardInTrade = (card, trade) => !trade || card.trade === trade;

/** Preferiti in cima, poi ordine alfabetico per nome (case-insensitive). */
export function sortCards(cards) {
  return [...(cards ?? [])].sort((a, b) =>
    (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) ||
    norm(a.name).localeCompare(norm(b.name)));
}

/**
 * Mestieri presenti nei biglietti, per costruire i chip di filtro.
 * @returns [{ trade, icon, count }] ordinati per numero di biglietti (decrescente).
 */
export function tradeFilters(cards) {
  const map = new Map();
  for (const c of cards ?? []) {
    const trade = (c.trade ?? '').trim();
    if (!trade) continue;
    const cur = map.get(trade) ?? { trade, icon: c.icon || DEFAULT_ICON, count: 0 };
    cur.count++;
    map.set(trade, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.trade.localeCompare(b.trade));
}

/** Riga di riepilogo sotto il nome nell'elenco: "Idraulico · 333 123 4567". */
export function cardSubtitle(card) {
  return [card.trade, card.phone].map(x => String(x ?? '').trim()).filter(Boolean).join(' · ');
}
