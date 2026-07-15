# AGENDA/H8

Agenda personale **offline-first** in stile industriale/terminale (nero + verde
neon): calendario, task organizzate in gruppi e note in cartelle, tutte sullo
stesso database SQLite locale. Costruita con **Tauri 2**, frontend in HTML/CSS/
JavaScript puro (niente framework), pensata **mobile-first per Android** con
build desktop come bonus e iOS predisposto.

## Cosa fa

- **Calendario** (schermata principale): vista mese / settimana / giorno,
  swipe per cambiare periodo, pulsante "Oggi", tap su un giorno → nuovo evento
  con data precompilata, tap su un evento → modifica. Tocca il mese/anno in
  alto per **saltare a qualsiasi mese e anno (1583–4000)**.
- **Festività nazionali**: nelle Impostazioni scegli lo stato (bandiera 🇮🇹 🇦🇱
  🇽🇰 🇲🇰 🇨🇭 🇩🇪 🇦🇹 🇫🇷 🇪🇸 🇬🇧 🇺🇸 🇬🇷) e le feste di quel paese compaiono fissate sul
  calendario, calcolate offline per qualsiasi anno: date fisse, Pasqua
  occidentale e ortodossa (computus), feste islamiche col calendario tabulare
  (Fitër/Kurban Bajrami, precisione ±1 giorno).
- **Task** (icona ☑ in alto a destra): gruppi personalizzabili (creabili,
  rinominabili, eliminabili — le task di un gruppo eliminato passano a
  "Generale"), spunta di completamento che **salva data e ora** ("fatta
  2026-07-13 18:42", modificabile a posteriori), assegnazione data dal
  calendario ("Assegna data dal calendario" nel modale, poi tocchi il giorno).
- **Note** (icona 📄): cartelle creabili/rinominabili/eliminabili (le note di
  una cartella eliminata passano a "Senza cartella"), editor con salvataggio
  automatico e data ultima modifica; le note vuote si autoeliminano.
- **Attività complete**: titolo, descrizione, gruppo, data/ora opzionali,
  priorità (bassa/media/alta con colore), ricorrenze (giornaliera /
  settimanale / mensile / annuale), sottoattività (checklist), promemoria.
- **Lingua**: interfaccia in **inglese** (default) o italiano, cambiabile
  al volo dalle Impostazioni. Il quick-add capisce sempre entrambe le lingue
  ("domani alle 15" e "tomorrow at 15").
- **Ore di lavoro**: in vista mese ogni casella ha un ⏱ nell'angolo — lo
  tocchi e registri le ore lavorate di quel giorno (ore e minuti). Il badge
  mostra le ore del giorno (es. `7:30`) e sotto il calendario appare il
  **totale del mese** (es. `142h 30m`) con il pulsante **💾 CSV** che esporta
  il mese giorno per giorno (per farti pagare o per controllo). In vista
  giorno c'è la riga "⏱ Lavoro" sempre pronta; "Azzera" cancella le ore.
  Nelle Impostazioni puoi attivare il **promemoria serale** ("hai registrato
  le ore di oggi?") all'ora che scegli — suona solo se il giorno è vuoto.
- **Fitness** (menu ⋮ → Fitness): crei i tuoi sport (nome + icona 🏋 🏊 🏃 …).
  Ogni sport ha le sue **schede di allenamento** — liste di esercizi con
  serie, ripetizioni/distanza, carico/intensità, recupero e note, quindi
  vanno bene sia per la palestra ("Panca 4×12 60kg rec 90s") che per il
  nuoto ("8×50m stile, ritmo gara") o altro — e un **diario allenamenti**
  dove registri ogni sessione con data, scheda usata, durata e come è andata.
  Dentro una scheda, **▶ Inizia allenamento** avvia la sessione: spunti gli
  esercizi man mano che li fai e "Termina e salva" scrive tutto nel diario
  con la durata calcolata da solo. Le Statistiche mostrano anche ore
  lavorate e allenamenti per mese.
- **Funzioni estese**: notifiche locali all'ora impostata, ricerca su
  eventi/task/note, filtri (gruppo, priorità, aperte/fatte), archivio delle
  fatte ordinato per data di completamento, statistiche (completate per
  settimana/mese/gruppo), export/import backup JSON, export calendario .ics,
  quick-add con parsing italiano ("domani 15:00 chiamare commercialista"),
  tema scuro/chiaro, impostazioni (primo giorno settimana, notifiche, lingua).

Menu **⋮** in alto a destra → Fitness, Archivio fatte, Statistiche, Impostazioni.

## Struttura del progetto

```
agenda-h8/
├── src/                    ← frontend (HTML/CSS/JS puro, ES modules)
│   ├── index.html          ← tutte le schermate e i modali
│   ├── css/                ← theme.css (colori, tema chiaro/scuro), layout.css
│   └── js/
│       ├── main.js         ← bootstrap, navigazione, quick-add, notifiche
│       ├── db.js           ← UNICO punto di accesso a SQLite
│       ├── i18n/           ← stringhe centralizzate (it.js; en/sq predisposti)
│       ├── logic/          ← moduli PURI testabili: recurrence, quickadd, ics, backup
│       ├── ui/             ← toast, modali, conferme
│       └── views/          ← calendar, tasks, notes, archive, stats, settings, search
├── src-tauri/              ← backend Rust minimale
│   ├── src/lib.rs          ← registrazione plugin + migrations SQL versionate
│   ├── tauri.conf.json     ← configurazione app
│   └── capabilities/       ← permessi (sql, notifiche, dialog, fs)
├── sync/                   ← interfaccia sync futura (Proton) — DOCUMENTATA, non implementata
├── tests/                  ← test della logica pura (node --test)
└── README.md
```

**Dove sono i dati**: un unico file SQLite `agenda-h8.db` nella cartella dati
dell'app (su Windows `%APPDATA%\com.h8.agenda`, su Android nella sandbox
dell'app). Lo schema è creato/aggiornato da *migrations versionate* in
`src-tauri/src/lib.rs`: per cambiare lo schema in futuro si aggiunge una nuova
migration, mai modificare quelle esistenti.

---

## Prerequisiti (Windows)

### Già necessari per il desktop

1. **Rust** — installa da https://rustup.rs (sul tuo PC c'è già ✓)
2. **Node.js** ≥ 20 — https://nodejs.org (c'è già ✓)
3. **WebView2** — preinstallato su Windows 11 ✓

### In più per Android

4. **JDK 17** (Java) — scarica "Temurin 17 LTS" da https://adoptium.net,
   installa e spunta l'opzione che imposta `JAVA_HOME`.
5. **Android Studio** — https://developer.android.com/studio — serve solo per
   scaricare SDK e NDK, non per programmare:
   - apri Android Studio → **More Actions → SDK Manager**
   - scheda **SDK Platforms**: spunta Android 14 (o più recente)
   - scheda **SDK Tools**: spunta **Android SDK Build-Tools**,
     **NDK (Side by side)**, **Android SDK Platform-Tools**,
     **Android SDK Command-line Tools** → Apply
6. **Variabili d'ambiente** (Impostazioni → Sistema → Informazioni →
   Impostazioni di sistema avanzate → Variabili d'ambiente → Nuova, per l'utente):
   ```
   JAVA_HOME    = C:\Program Files\Eclipse Adoptium\jdk-17...   (se non già impostata)
   ANDROID_HOME = C:\Users\<tuo utente>\AppData\Local\Android\Sdk
   NDK_HOME     = %ANDROID_HOME%\ndk\<versione installata>
   ```
   Poi **riapri il terminale** (le variabili si leggono all'avvio).
7. **Target Rust per Android** (una volta sola):
   ```
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

---

## Comandi

Tutti dalla cartella del progetto (`C:\progetti\agenda-h8`):

```powershell
npm install          # prima volta: scarica le dipendenze JS
npm test             # test della logica (ricorrenze, parser, ics, backup)
npm run tauri dev    # DESKTOP: avvia l'app in sviluppo (prima volta: compila, ~minuti)
npm run tauri build  # DESKTOP: crea l'installer (src-tauri/target/release/bundle/)
```

### Android

```powershell
npm run tauri android init   # UNA volta sola: genera il progetto Android (src-tauri/gen/android)
npm run tauri android dev    # sviluppo su emulatore o telefono collegato via USB*
npm run tauri android build  # produce l'APK/AAB di release (da firmare, vedi sotto)
```

\* Per il telefono reale: attiva **Opzioni sviluppatore → Debug USB** sul
telefono, collegalo e verifica che `adb devices` lo veda.

### APK firmato per distribuzione fuori store

Android installa solo APK firmati. Serve una **keystore** (chiave di firma) —
creala UNA volta e **non perderla mai** (gli aggiornamenti devono essere
firmati con la stessa chiave):

```powershell
keytool -genkey -v -keystore agenda-h8.keystore -alias agenda-h8 -keyalg RSA -keysize 2048 -validity 10000
```

Poi crea `src-tauri/gen/android/keystore.properties` (dopo `android init`):

```properties
password=LA_TUA_PASSWORD
keyAlias=agenda-h8
storeFile=C:\\percorso\\assoluto\\agenda-h8.keystore
```

e in `src-tauri/gen/android/app/build.gradle.kts` collega la firma alla build
di release (la documentazione ufficiale passo-passo:
https://tauri.app/distribute/sign/android/). Infine:

```powershell
npm run tauri android build -- --apk
# risultato: src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Quell'APK si installa su qualsiasi telefono ("Consenti origini sconosciute")
e si può distribuire da nderja.com o altro canale.

### iOS (predisposto)

Tauri 2 supporta iOS (`npm run tauri ios init/dev/build`) ma **serve un Mac**
con Xcode: il codice dell'app è già compatibile, quando avrai accesso a un Mac
non ci sono modifiche da fare al progetto.

---

## Note tecniche

- **Niente bundler**: `withGlobalTauri: true` in `tauri.conf.json` espone le
  API dei plugin su `window.__TAURI__`, così il frontend è servito com'è,
  senza Vite/webpack. Un file = un modulo ES.
- **Eventi e task sono la stessa entità** (tabella `activities`): con `date`
  compaiono sul calendario, senza vivono solo nella sezione Task. Assegnare o
  togliere la data sposta l'attività tra i due mondi senza perdere nulla.
- **Ricorrenze**: in DB c'è solo la regola; le occorrenze si calcolano a
  runtime (`src/js/logic/recurrence.js`). Il completamento di una singola
  occorrenza finisce in `recurrence_done`.
- **Eliminazioni sicure**: ogni eliminazione chiede conferma; gruppo/cartella
  eliminati non cancellano il contenuto ma lo spostano nel contenitore di
  default.
- **i18n**: tutte le stringhe sono in `src/js/i18n/it.js`; per l'inglese o
  l'albanese si crea `en.js`/`sq.js` con le stesse chiavi e si registra in
  `i18n/index.js`.
- **Sync futura (Proton)**: vedi `sync/README.md` — interfaccia documentata,
  zero codice eseguito oggi.
