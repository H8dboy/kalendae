# Handoff: Kalendae — rebrand di AGENDA/H8

## Overview
Restyling completo e rinomina dell'app "AGENDA/H8" (agenda personale offline-first, Tauri + vanilla JS) in **Kalendae**: nuovo logo (K capitale lapidaria con spicchio di luna nuova nel braccio obliquo), palette nero + verde neon raffinata, nuova tipografia, icone SVG al posto dei glifi Unicode/emoji di sistema, tema chiaro aggiornato. Nessuna nuova funzionalità: è un rebrand visivo dell'app esistente.

## About the Design Files
I file in questo pacchetto sono **riferimenti di design creati in HTML** — mockup che mostrano l'aspetto voluto, NON codice di produzione da copiare. Il compito è **ricreare questi design nel codebase esistente** (`agenda-h8`: vanilla JS + CSS con variabili, struttura `src/css/theme.css`, `src/css/layout.css`, `src/index.html`, viste in `src/js/views/*`), rispettando i pattern già presenti (CSS variables, classi esistenti, i18n con `data-i18n`).

- `Kalendae UI.dc.html` — 16 schermate ad alta fedeltà (apri nel browser; i valori esatti sono negli style inline).
- `Kalendae Brand.dc.html` — brand sheet: logo, costruzione, palette, tipografia, icona app, regole d'uso.
- `codice/` — pezzi già pronti: `theme.css` sostitutivo, snippet header/logo, SVG del logo, icone PNG, istruzioni.
- `support.js` — runtime dei mockup, serve solo ad aprirli; ignorarlo per l'implementazione.

## Fidelity
**High-fidelity.** Colori, spaziature, tipografia e copy sono definitivi. Ricreare pixel-perfect usando le variabili CSS del progetto.

## Design Tokens

### Tema scuro (default)
- `--bg` #090C09 · `--panel` #111611 · `--panel2` #171E16 · `--line` #1F2A1E
- linea sottile griglia/righe: #141B13 (nuova, più tenue di --line)
- `--ink` #DCE8D4 · testo secondario #A9B8A0 · `--dim` #7C8A72 · dim scuro #66755E · disabled #4C5A46
- `--neon` #3DFF70 · `--neon-dim` #1E8A44 · `--neon-ink` #041408
- `--warn` #FFB347 · `--danger` #FF5C5C · `--prio-low` #5B9AFF · `--prio-mid` #FFB347 · `--prio-high` #FF5C5C

### Tema chiaro (`[data-theme="light"]`)
- `--bg` #F4F7F2 · `--panel` #FFFFFF · `--panel2` #E8EFE4 · `--line` #D3DECE · riga tenue #E4EBE0
- `--ink` #131B14 · `--dim` #5F6E5A · dim chiaro #8A9884 · disabled #AEB9A8
- accento `--neon` #0A8C3D (testo su neon: #FFFFFF)
- `--warn` #9A5B00 · `--danger` #C02929 · `--prio-low` #1D5FD6

### Raggio e misure
- `--radius` 8px (input/bottoni 9px, card 12px, FAB 16px, menu popover 12px, chip pillola 999px)
- `--tap` 44px minimo. Topbar min-height 54px. FAB 52×52.

### Glow (solo tema scuro, sottile)
- FAB: `box-shadow: 0 6px 26px rgba(61,255,112,.35)`
- pill "oggi": `0 0 12px rgba(61,255,112,.4)` · barre attive: `0 0 10-14px rgba(61,255,112,.5)`

## Tipografia
- **Cinzel 700** (`--brand`): SOLO wordmark "KALENDAE" (header 14px, letter-spacing .22em) e marchio. Mai per testo corrente.
- **IBM Plex Sans** (`--sans`) 400/500/600/700: corpo. Titoli riga 14.5–15px; titolo nota editor 18px/600.
- **IBM Plex Mono** (`--mono`) 400/500/600: date, ore, importi, etichette. Etichette sezione 10–11px uppercase letter-spacing .16–.22em in neon; meta riga 10.5px in dim; label mese 13.5px/600 ls .14em.
- Font da bundlare in `src/fonts/` con `@font-face` (app offline-first, niente CDN).

## Logo (vedi Kalendae Brand.dc.html)
- K in Cinzel Bold in un quadrato 100×100 (font-size 96, baseline y=86, centrata x=50).
- Disco lunare: cerchio nero r=12.5 centrato in (62,32) sottratto in mask — eclissa il braccio obliquo superiore; la grazia in alto a destra deve riemergere oltre il disco.
- Spicchio: path `M 58 20.2 A 12.5 12.5 0 0 0 58 43.8 A 21 21 0 0 1 58 20.2 Z`, unico elemento in verde neon. Nel codice reale usare `fill="var(--neon)"` così segue il tema.
- Sotto i 24px: K piena senza luna. Snippet pronto: `codice/header-snippet.html`.

## Screens (01–16 in Kalendae UI.dc.html)
Ogni frame è etichettato. Punti chiave per schermata:
1. **Calendario mese**: quickadd mono su panel; label "LUGLIO 2026" mono; tab MESE/SETTIMANA/GIORNO con underline 2px neon; celle con num mono 10.5px, oggi = pill neon + cella evidenziata (bg #0D120C, inset ring 1px neon-dim); chip evento 10px con border-left 2px colore priorità; badge ore lavoro "8h" mono 9px angolo alto-dx; barra totale "ORE LAVORO — LUGLIO: 84H 30M" + bottone CSV.
2. **Settimana**: gruppi per giorno con header mono uppercase; oggi = blocco evidenziato con bordi neon-dim; menu ⋮ aperto: popover 216px, icone SVG stroke (manubrio, calcolatrice, archivio, barre, ingranaggio), voce hover con bg panel2 + testo neon.
3. **Giorno**: righe con ora mono 12px + dot priorità 8px + meta uppercase; riga LAVORO con ore in neon.
4. **Task**: filtri pillola TUTTI/APERTE/FATTE (attivo: bordo neon-dim, testo neon, bg #10160F); header gruppo con chevron + conteggio "2 APERTE" in neon-dim; checkbox 21px radius 6 bordo neon-dim, spuntata = riempita neon con ✓ scuro; fatta = line-through + "FATTA 15 LUG, 18:20" neon-dim; scadenze in warn.
5. **Note cartelle**: righe icona cartella SVG + nome + conteggio mono + chevron.
6. **Editor nota**: titolo 18px/600 con border-bottom; corpo 14.5px lh 1.7; barra meta "ULTIMA MODIFICA … · SALVATA ✓"; toast centrato in basso (panel, bordo neon-dim, testo neon mono 11.5px).
7. **Fitness sport**: tile emoji sport 42px (radius 11, bg #131A12) — le emoji qui sono DATI utente, restano; card "ALLENAMENTO IN CORSO — 24:13" con dot pulsante neon.
8. **Scheda in allenamento**: barra sessione (bg #0D120C, bordo sotto neon-dim, TERMINA = bottone pieno neon con testo scuro); esercizi con checkbox; fatti = testo dim; meta "4 × 12 · 60KG · REC 90S" mono; sezione DIARIO ALLENAMENTI.
9. **Pagamenti**: righe TOTALE/VERSATI/RIMANENTI (versati in neon 600); progress bar 10px radius 5 riempimento neon con glow; lista RATE data mono dim + importo mono.
10. **Statistiche**: card panel radius 12; barre orizzontali 13px su track #171E16, storiche in neon-dim, periodo corrente in neon pieno + glow + label neon.
11. **Impostazioni**: sezioni ASPETTO/CALENDARIO/NOTIFICHE/DATI in mono neon 10px ls .2em; select-look chip; toggle 40×23 (on: track neon-dim, knob neon); righe dati con icone download/upload/calendario; footer "KALENDAE 1.0 · OFFLINE-FIRST".
12. **Ricerca**: input focus con bordo neon-dim + ring `0 0 0 3px rgba(61,255,112,.07)`; caret neon; sezioni EVENTI/TASK/NOTE con conteggio; substring che matcha evidenziata in neon.
13. **Archivio fatte**: filtri gruppo a pillola; righe spuntate line-through con timestamp neon-dim.
14. **Modale nuova attività**: bottom sheet (radius 16 16 0 0, bordo-top neon-dim, grab handle 40×4), label campo mono 10px uppercase, input bg #090C09 bordo line (attivo: neon-dim), segmento priorità 3 celle (attiva: bg panel2 + colore priorità + 600), CTA **Salva pieno neon** (testo #041408 700) — il primario ora è pieno, non outline.
15–16. **Tema chiaro**: stessi layout con token chiari; topbar/righe su bianco, FAB #0A8C3D con + bianco.

## Interactions & Behavior
Già implementate nell'app esistente — non cambiano. Solo aggiornamenti visivi: hover righe → bg `--panel2`; hover icone → colore neon; focus-visible → outline 2px neon; transizioni bordo/colore .15s come oggi; il tab attivo e i filtri usano i nuovi stili sopra.

## State Management
Nessun cambiamento: riuso completo di db.js/logic esistenti.

## Assets
- `codice/icons/icon-512.png`, `icon-192.png`, `icon-48.png` — icona app (fondo nero radiale, K + spicchio). Per Tauri: `tauri icon codice/icons/icon-512.png`.
- `codice/logo-kalendae.svg` — marchio vettoriale (richiede Cinzel disponibile).
- Icone UI: SVG inline stroke 1.6–1.8, 24×24 viewBox, resa 17–19px, cap/join round — copiarle dai mockup (lente, quadrato-spunta, file, kebab, freccia indietro, chevron, manubrio, calcolatrice, archivio, barre, ingranaggio, download/upload, calendario, +, ✕, ✓).

## Files
- `Kalendae UI.dc.html` — mockup 16 schermate (fonte di verità per i valori)
- `Kalendae Brand.dc.html` — brand sheet
- `codice/theme.css` — theme.css sostitutivo pronto
- `codice/header-snippet.html` — logo + header + CSS + riga JS
- `codice/README-integrazione.md` — checklist in 6 passi
- `codice/logo-kalendae.svg`, `codice/icons/*.png`
