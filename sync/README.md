# Layer di sincronizzazione (fase 2 — NON implementato)

Questa cartella è il segnaposto per la futura sincronizzazione con servizi
esterni (obiettivo: integrazione mail/calendario Proton tramite API non
ufficiale). **Oggi l'app è 100% offline** e nessun codice qui dentro viene
eseguito.

## Perché esiste già

Lo schema dati è stato pensato per rendere la sync innestabile senza
ristrutturare il database:

- ogni tabella ha chiavi intere stabili e `created_at` / `updated_at`
  (le note e le attività aggiornano `updated_at` a ogni modifica);
- il backup JSON (`src/js/logic/backup.js`) è già una serializzazione completa
  e versionata dello stato — la stessa forma che un motore di sync
  scambierebbe con un server;
- l'export iCal (`src/js/logic/ics.js`) è il formato ponte verso calendari
  esterni.

## Interfaccia prevista

Un provider di sync dovrà implementare questa interfaccia (pseudocodice
documentativo, da trasformare in modulo JS quando si parte):

```js
/**
 * Contratto di un provider di sincronizzazione.
 * Tutte le funzioni sono async e non devono MAI bloccare la UI.
 */
export class SyncProvider {
  /** Autentica e apre la sessione. @returns {Promise<void>} */
  async connect(credentials) {}

  /**
   * Scarica i cambiamenti remoti successivi a `sinceToken`.
   * @returns {Promise<{changes: Change[], nextToken: string}>}
   */
  async pull(sinceToken) {}

  /**
   * Invia i cambiamenti locali. Il server risponde con l'esito per elemento.
   * @param {Change[]} changes
   * @returns {Promise<PushResult[]>}
   */
  async push(changes) {}

  /** Chiude la sessione. */
  async disconnect() {}
}

/**
 * Change = {
 *   entity: 'activity' | 'note' | 'group' | 'folder',
 *   op: 'upsert' | 'delete',
 *   id: number,            // id locale
 *   remoteId?: string,     // id sul servizio remoto
 *   payload?: object,      // la riga serializzata (forma del backup JSON)
 *   updated_at: string,    // per la risoluzione dei conflitti
 * }
 */
```

## Risoluzione conflitti (decisione da prendere in fase 2)

Strategia proposta: **last-write-wins su `updated_at`**, con eccezione per le
note dove un conflitto crea una copia ("Nota (conflitto)") invece di perdere
testo. Da validare quando si sceglie l'API concreta.

## Cosa NON fare

- Non aggiungere colonne di sync alle tabelle esistenti prima di avere scelto
  il provider: quando servirà, una nuova migration aggiungerà `remote_id` e
  `sync_state` alle entità coinvolte.
- Non implementare API non ufficiali Proton qui dentro senza valutare i limiti
  del loro ToS e la cifratura lato client.
