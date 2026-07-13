// Layer i18n minimale: t('chiave') restituisce la stringa nella lingua attiva.
// Per aggiungere una lingua: creare en.js/sq.js con le stesse chiavi di it.js
// e registrarla in LANGS. Le chiavi mancanti ricadono sull'italiano.
import it from './it.js';

const LANGS = { it };
let current = 'it';

export function setLang(lang) {
  if (LANGS[lang]) current = lang;
}

export function getLang() {
  return current;
}

export function t(key) {
  const dict = LANGS[current];
  const v = dict[key] ?? LANGS.it[key];
  return v ?? key;
}
