// Layer i18n minimale: t('chiave') restituisce la stringa nella lingua attiva.
// Per aggiungere una lingua: creare sq.js ecc. con le stesse chiavi di it.js
// e registrarla in LANGS. Le chiavi mancanti ricadono sull'inglese.
import it from './it.js';
import en from './en.js';

const LANGS = { it, en };
let current = 'en';

export function setLang(lang) {
  if (LANGS[lang]) current = lang;
}

export function getLang() {
  return current;
}

export function t(key) {
  const dict = LANGS[current];
  const v = dict[key] ?? LANGS.en[key];
  return v ?? key;
}
