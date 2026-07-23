// Logica pura della sezione Task — testata in tests/.
// Niente accesso al DB o al DOM: solo trasformazioni su dati già letti.
//   - buildSubtaskTree: da lista piatta di sotto-task a albero a 2 livelli
//   - subtaskProgress: conteggio fatte/totali (tutti i livelli)
//   - dailyStreak: giorni consecutivi di completamento di un task 'daily'

/**
 * Annida le sotto-task per parent_id in un albero a 2 livelli.
 * @param {Array<{id:number,parent_id:number|null,position:number,done:number}>} rows
 * @returns {Array} sotto-task di 1° livello, ognuna con `children` (2° livello)
 */
export function buildSubtaskTree(rows) {
  const byPos = (a, b) => (a.position - b.position) || (a.id - b.id);
  const roots = rows.filter(r => r.parent_id == null).sort(byPos);
  return roots.map(r => ({
    ...r,
    children: rows.filter(c => c.parent_id === r.id).sort(byPos),
  }));
}

/**
 * Avanzamento di un progetto: fatte/totali su TUTTE le sotto-task (entrambi i livelli).
 * @returns {{done:number, total:number}}
 */
export function subtaskProgress(rows) {
  return {
    done: rows.filter(r => r.done).length,
    total: rows.length,
  };
}

/** Giorno precedente di una data ISO 'YYYY-MM-DD'. */
export function prevIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  const p = x => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/**
 * Streak di un task 'daily': giorni consecutivi completati fino a oggi.
 * Se oggi è già fatto, parte da oggi; se oggi non è ancora fatto ma ieri sì,
 * lo streak "in corso" resta quello fino a ieri (così l'utente sa cosa non perdere).
 * @param {string[]} doneDates  date 'YYYY-MM-DD' completate (ordine qualsiasi)
 * @param {string} todayIso
 * @returns {number}
 */
export function dailyStreak(doneDates, todayIso) {
  const set = new Set(doneDates);
  let cursor;
  if (set.has(todayIso)) cursor = todayIso;
  else {
    const y = prevIso(todayIso);
    if (set.has(y)) cursor = y;
    else return 0;
  }
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = prevIso(cursor);
  }
  return n;
}
