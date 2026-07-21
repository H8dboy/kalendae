// Biglietti da visita: link di chiamata, ricerca, filtri e ordinamento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRADES, digits, telHref, mailHref,
  cardMatches, cardInTrade, sortCards, tradeFilters, cardSubtitle,
} from '../src/js/logic/cards.js';

const card = (over = {}) => ({
  id: 1, name: 'Idraulica Rossi', trade: 'Idraulico', icon: '🔧',
  phone: '333 123 4567', phone2: '', email: '', address: '', notes: '',
  favorite: 0, ...over,
});

test('digits tiene il + e butta il resto della punteggiatura', () => {
  assert.equal(digits('+39 333-123.4567'), '+393331234567');
  assert.equal(digits('(0521) 55 66 77'), '0521556677');
  assert.equal(digits(null), '');
});

test('telHref costruisce il link solo con un numero plausibile', () => {
  assert.equal(telHref('333 123 4567'), 'tel:3331234567');
  assert.equal(telHref('+39 333 1234567'), 'tel:+393331234567');
  assert.equal(telHref(''), null);
  assert.equal(telHref('n/d'), null);
  assert.equal(telHref('12'), null);        // troppo corto per essere un numero
});

test('mailHref valida l\'indirizzo', () => {
  assert.equal(mailHref('info@rossi.it'), 'mailto:info@rossi.it');
  assert.equal(mailHref('rossi.it'), null);
  assert.equal(mailHref(''), null);
});

test('la ricerca guarda tutti i campi, senza distinzione di maiuscole', () => {
  const c = card({ notes: 'Chiamare dopo le 18', address: 'Via Verdi 3' });
  assert.ok(cardMatches(c, 'rossi'));
  assert.ok(cardMatches(c, 'IDRAULICO'));
  assert.ok(cardMatches(c, 'verdi'));
  assert.ok(cardMatches(c, 'dopo le 18'));
  assert.ok(cardMatches(c, ''));            // query vuota = mostra tutto
  assert.ok(!cardMatches(c, 'elettricista'));
});

test('la ricerca per numero ignora spazi e trattini', () => {
  const c = card({ phone: '333 123 4567', phone2: '+39 0521-556677' });
  assert.ok(cardMatches(c, '3331234'));
  assert.ok(cardMatches(c, '0521556677'));
  assert.ok(!cardMatches(c, '999999'));
});

test('filtro per mestiere: stringa vuota = tutti', () => {
  const c = card();
  assert.ok(cardInTrade(c, ''));
  assert.ok(cardInTrade(c, 'Idraulico'));
  assert.ok(!cardInTrade(c, 'Elettricista'));
});

test('ordinamento: preferiti in cima, poi alfabetico', () => {
  const list = [
    card({ id: 1, name: 'Zeta Impianti' }),
    card({ id: 2, name: 'alfa Clima' }),
    card({ id: 3, name: 'Muratore Bianchi', favorite: 1 }),
  ];
  assert.deepEqual(sortCards(list).map(c => c.id), [3, 2, 1]);
  // l'array originale non viene toccato
  assert.deepEqual(list.map(c => c.id), [1, 2, 3]);
});

test('i chip di filtro contano i mestieri presenti, i più numerosi per primi', () => {
  const list = [
    card({ id: 1, trade: 'Idraulico', icon: '🔧' }),
    card({ id: 2, trade: 'Elettricista', icon: '⚡' }),
    card({ id: 3, trade: 'Idraulico', icon: '🔧' }),
    card({ id: 4, trade: '' }),               // senza mestiere: nessun chip
  ];
  assert.deepEqual(tradeFilters(list), [
    { trade: 'Idraulico', icon: '🔧', count: 2 },
    { trade: 'Elettricista', icon: '⚡', count: 1 },
  ]);
});

test('sottotitolo: mestiere e numero, saltando i campi vuoti', () => {
  assert.equal(cardSubtitle(card()), 'Idraulico · 333 123 4567');
  assert.equal(cardSubtitle(card({ phone: '' })), 'Idraulico');
  assert.equal(cardSubtitle(card({ trade: '', phone: '' })), '');
});

test('ogni mestiere suggerito ha icona e chiave i18n', () => {
  for (const tr of TRADES) {
    assert.ok(tr.icon.length > 0);
    assert.match(tr.key, /^trade_[a-z]+$/);
  }
});
