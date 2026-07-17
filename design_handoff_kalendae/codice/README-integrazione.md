# Kalendae — integrazione nel codice (agenda-h8)

Io non posso scrivere nella tua cartella locale: copia questi file a mano.

## 1. Tema
Sostituisci `src/css/theme.css` con `codice/theme.css` (stessi nomi di variabile, layout.css resta compatibile). Radius passa da 6 a 8 px.

## 2. Font (offline-first: niente CDN)
Scarica da Google Fonts e metti in `src/fonts/`:
- **Cinzel** 700 (solo wordmark/logo)
- **IBM Plex Mono** 400/500/600 (date, ore, etichette)
- **IBM Plex Sans** 400/500/600/700 (corpo)

In `layout.css` aggiungi i relativi `@font-face` e usa `font-family: var(--sans)` sul body.

## 3. Header + logo
Segui `codice/header-snippet.html` (defs SVG, sostituzione h1, 4 righe CSS, 1 riga JS in main.js).

## 4. Nome app
- `src/js/i18n/it.js` e `en.js`: `app_name: 'KALENDAE'`, `notif_title: 'KALENDAE — promemoria'`
- `index.html`: `<title>KALENDAE</title>`
- `tauri.conf.json`: `productName`, `title` finestra.

## 5. Icone app
`codice/icons/`: `icon-512.png`, `icon-192.png`, `icon-48.png` (fondo nero, K + spicchio neon).
Tauri: rigenera con `tauri icon codice/icons/icon-512.png`. Sotto i 24 px usare la K senza luna (regola brand).

## 6. Riferimenti visivi
- `Kalendae UI.dc.html` — tutte le schermate ridisegnate (scuro + chiaro): valori esatti di spaziature, bordi, colori sono negli style inline.
- `Kalendae Brand.dc.html` — logo, costruzione, palette, tipografia, usi.

Nota: le icone di sezione nei mockup (lente, spunta, file, kebab, manubrio, ecc.) sono SVG stroke 1.6–1.8 a 19 px — sostituiscono i glifi Unicode/emoji dell'header attuale. Copiale dai mockup quando vuoi portarle nel codice.
