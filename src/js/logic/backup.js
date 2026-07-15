// Serializzazione backup JSON — modulo PURO.
// Il formato porta una versione: se in futuro lo schema cambia, l'import
// potrà convertire i backup vecchi.

// v2: aggiunte work_hours, sports, workout_plans, plan_exercises, workouts
// (opzionali in import: i backup v1 restano importabili).
export const BACKUP_VERSION = 2;

export function buildBackup(dump, now = new Date()) {
  return JSON.stringify(
    { app: 'agenda-h8', version: BACKUP_VERSION, exported_at: now.toISOString(), data: dump },
    null, 2
  );
}

/** @returns {object} data pronto per restoreAll, oppure lancia se non valido */
export function parseBackup(jsonText) {
  const obj = JSON.parse(jsonText);
  if (obj?.app !== 'agenda-h8' || !obj.data) throw new Error('backup non valido');
  if (obj.version > BACKUP_VERSION) throw new Error('backup di una versione più recente');
  const d = obj.data;
  for (const key of ['groups', 'activities', 'subtasks', 'note_folders', 'notes', 'settings']) {
    if (!Array.isArray(d[key])) throw new Error(`backup non valido: manca ${key}`);
  }
  return d;
}
