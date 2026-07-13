// Layer dati: unico punto di accesso a SQLite (tauri-plugin-sql).
// Le API Tauri arrivano da window.__TAURI__ (withGlobalTauri: true, niente bundler).
let db = null;

function sqlApi() {
  const ns = window.__TAURI__?.sql;
  if (!ns) throw new Error('Plugin SQL non disponibile: app aperta fuori da Tauri?');
  // L'IIFE del plugin può esporre la classe come default o direttamente.
  return ns.default ?? ns.Database ?? ns;
}

export async function initDb() {
  const Database = sqlApi();
  db = await Database.load('sqlite:agenda-h8.db');
  await db.execute('PRAGMA foreign_keys = ON;');
  return db;
}

export const select = (sql, params = []) => db.select(sql, params);
export const execute = (sql, params = []) => db.execute(sql, params);

const nowStamp = () => {
  const n = new Date(), p = x => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}`;
};

/* ---------------- gruppi ---------------- */
export const listGroups = () => select('SELECT * FROM groups ORDER BY id');

export async function createGroup(name) {
  await execute('INSERT INTO groups (name) VALUES ($1)', [name]);
}

export async function renameGroup(id, name) {
  await execute('UPDATE groups SET name=$1 WHERE id=$2', [name, id]);
}

// Il gruppo 1 ("Generale") non si elimina: le attività orfane migrano lì.
export async function deleteGroup(id) {
  if (id === 1) return;
  await execute('UPDATE activities SET group_id=1 WHERE group_id=$1', [id]);
  await execute('DELETE FROM groups WHERE id=$1', [id]);
}

/* ---------------- attività ---------------- */
const ACT_COLS = 'id,title,description,group_id,date,time,priority,done,done_at,recurrence,reminder,created_at,updated_at';

export const getActivity = async id =>
  (await select(`SELECT ${ACT_COLS} FROM activities WHERE id=$1`, [id]))[0];

export const listActivities = () =>
  select(`SELECT ${ACT_COLS} FROM activities ORDER BY date, time, priority DESC`);

// Attività "task": senza data, per la sezione Task.
export const listUndated = () =>
  select(`SELECT ${ACT_COLS} FROM activities WHERE date IS NULL ORDER BY done, priority DESC, id`);

// Attività con data in un intervallo, più tutte le ricorrenti (espanse a runtime).
export const listDatedBetween = (from, to) =>
  select(
    `SELECT ${ACT_COLS} FROM activities
     WHERE date IS NOT NULL AND (recurrence IS NOT NULL OR (date >= $1 AND date <= $2))`,
    [from, to]
  );

export async function createActivity(a) {
  const r = await execute(
    `INSERT INTO activities (title, description, group_id, date, time, priority, done, done_at, recurrence, reminder)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [a.title, a.description ?? '', a.group_id ?? 1, a.date ?? null, a.time ?? null,
     a.priority ?? 1, a.done ? 1 : 0, a.done_at ?? null, a.recurrence ?? null, a.reminder ? 1 : 0]
  );
  return r.lastInsertId;
}

export async function updateActivity(id, a) {
  await execute(
    `UPDATE activities SET title=$1, description=$2, group_id=$3, date=$4, time=$5,
     priority=$6, done=$7, done_at=$8, recurrence=$9, reminder=$10, updated_at=$11 WHERE id=$12`,
    [a.title, a.description ?? '', a.group_id ?? 1, a.date ?? null, a.time ?? null,
     a.priority ?? 1, a.done ? 1 : 0, a.done_at ?? null, a.recurrence ?? null,
     a.reminder ? 1 : 0, nowStamp(), id]
  );
}

export async function setDone(id, done) {
  const doneAt = done ? nowStamp() : null;
  await execute('UPDATE activities SET done=$1, done_at=$2, updated_at=$3 WHERE id=$4',
    [done ? 1 : 0, doneAt, nowStamp(), id]);
  return doneAt;
}

export const setActivityDate = (id, date, time = null) =>
  execute('UPDATE activities SET date=$1, time=$2, updated_at=$3 WHERE id=$4',
    [date, time, nowStamp(), id]);

// Eliminazione esplicita dei figli: il PRAGMA foreign_keys potrebbe non essere
// attivo su tutte le connessioni del pool, quindi non ci si affida al CASCADE.
export async function deleteActivity(id) {
  await execute('DELETE FROM subtasks WHERE activity_id=$1', [id]);
  await execute('DELETE FROM recurrence_done WHERE activity_id=$1', [id]);
  await execute('DELETE FROM activities WHERE id=$1', [id]);
}

/* ------- occorrenze ricorrenti completate ------- */
export const listRecurrenceDone = (from, to) =>
  select('SELECT activity_id, occurrence_date, done_at FROM recurrence_done WHERE occurrence_date >= $1 AND occurrence_date <= $2', [from, to]);

export async function setOccurrenceDone(activityId, dateIso, done) {
  if (done) {
    await execute(
      'INSERT OR REPLACE INTO recurrence_done (activity_id, occurrence_date, done_at) VALUES ($1,$2,$3)',
      [activityId, dateIso, nowStamp()]);
  } else {
    await execute('DELETE FROM recurrence_done WHERE activity_id=$1 AND occurrence_date=$2',
      [activityId, dateIso]);
  }
}

/* ---------------- sottoattività ---------------- */
export const listSubtasks = activityId =>
  select('SELECT * FROM subtasks WHERE activity_id=$1 ORDER BY position, id', [activityId]);

export async function addSubtask(activityId, title) {
  await execute('INSERT INTO subtasks (activity_id, title) VALUES ($1,$2)', [activityId, title]);
}

export const setSubtaskDone = (id, done) =>
  execute('UPDATE subtasks SET done=$1 WHERE id=$2', [done ? 1 : 0, id]);

export const deleteSubtask = id => execute('DELETE FROM subtasks WHERE id=$1', [id]);

/* ---------------- cartelle e note ---------------- */
export const listFolders = () =>
  select(`SELECT f.*, (SELECT COUNT(*) FROM notes n WHERE n.folder_id=f.id) AS note_count
          FROM note_folders f ORDER BY f.id`);

export async function createFolder(name) {
  await execute('INSERT INTO note_folders (name) VALUES ($1)', [name]);
}

export const renameFolder = (id, name) =>
  execute('UPDATE note_folders SET name=$1 WHERE id=$2', [name, id]);

// La cartella 1 ("Senza cartella") non si elimina: le note orfane migrano lì.
export async function deleteFolder(id) {
  if (id === 1) return;
  await execute('UPDATE notes SET folder_id=1 WHERE folder_id=$1', [id]);
  await execute('DELETE FROM note_folders WHERE id=$1', [id]);
}

export const listNotes = folderId =>
  select('SELECT * FROM notes WHERE folder_id=$1 ORDER BY updated_at DESC', [folderId]);

export async function createNote(folderId) {
  const r = await execute('INSERT INTO notes (folder_id) VALUES ($1)', [folderId]);
  return r.lastInsertId;
}

export const getNote = async id =>
  (await select('SELECT * FROM notes WHERE id=$1', [id]))[0];

export const saveNote = (id, title, body) =>
  execute('UPDATE notes SET title=$1, body=$2, updated_at=$3 WHERE id=$4',
    [title, body, nowStamp(), id]);

export const deleteNote = id => execute('DELETE FROM notes WHERE id=$1', [id]);

/* ---------------- impostazioni ---------------- */
export async function getSettings() {
  const rows = await select('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export const setSetting = (key, value) =>
  execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1,$2)', [key, String(value)]);

/* ---------------- ricerca ---------------- */
export async function searchAll(q) {
  const like = `%${q}%`;
  const acts = await select(
    `SELECT ${ACT_COLS} FROM activities
     WHERE title LIKE $1 COLLATE NOCASE OR description LIKE $1 COLLATE NOCASE
     ORDER BY updated_at DESC LIMIT 50`, [like]);
  const notes = await select(
    `SELECT * FROM notes WHERE title LIKE $1 COLLATE NOCASE OR body LIKE $1 COLLATE NOCASE
     ORDER BY updated_at DESC LIMIT 50`, [like]);
  return { acts, notes };
}

/* ---------------- archivio e statistiche ---------------- */
export const listDone = () =>
  select(`SELECT a.*, g.name AS group_name FROM activities a
          JOIN groups g ON g.id = a.group_id
          WHERE a.done=1 AND a.done_at IS NOT NULL
          ORDER BY a.done_at DESC`);

// done_at è 'YYYY-MM-DD HH:MM': si aggrega per settimana ISO / mese / gruppo.
export const statsByMonth = () =>
  select(`SELECT substr(done_at,1,7) AS bucket, COUNT(*) AS n
          FROM activities WHERE done=1 AND done_at IS NOT NULL
          GROUP BY bucket ORDER BY bucket DESC LIMIT 6`);

export const statsByWeek = () =>
  select(`SELECT strftime('%Y-W%W', substr(done_at,1,10)) AS bucket, COUNT(*) AS n
          FROM activities WHERE done=1 AND done_at IS NOT NULL
          GROUP BY bucket ORDER BY bucket DESC LIMIT 8`);

export const statsByGroup = () =>
  select(`SELECT g.name AS bucket, COUNT(*) AS n
          FROM activities a JOIN groups g ON g.id=a.group_id
          WHERE a.done=1 GROUP BY g.id ORDER BY n DESC`);

/* ---------------- backup (export/import) ---------------- */
export async function dumpAll() {
  return {
    groups: await select('SELECT * FROM groups'),
    activities: await select('SELECT * FROM activities'),
    subtasks: await select('SELECT * FROM subtasks'),
    recurrence_done: await select('SELECT * FROM recurrence_done'),
    note_folders: await select('SELECT * FROM note_folders'),
    notes: await select('SELECT * FROM notes'),
    settings: await select('SELECT * FROM settings'),
  };
}

export async function restoreAll(data) {
  // Sostituzione completa: l'ordine rispetta le foreign key.
  await execute('DELETE FROM recurrence_done');
  await execute('DELETE FROM subtasks');
  await execute('DELETE FROM activities');
  await execute('DELETE FROM groups');
  await execute('DELETE FROM notes');
  await execute('DELETE FROM note_folders');
  await execute('DELETE FROM settings');
  for (const g of data.groups)
    await execute('INSERT INTO groups (id,name,created_at) VALUES ($1,$2,$3)', [g.id, g.name, g.created_at]);
  for (const a of data.activities)
    await execute(
      `INSERT INTO activities (${ACT_COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [a.id, a.title, a.description, a.group_id, a.date, a.time, a.priority, a.done, a.done_at, a.recurrence, a.reminder, a.created_at, a.updated_at]);
  for (const s of data.subtasks)
    await execute('INSERT INTO subtasks (id,activity_id,title,done,position) VALUES ($1,$2,$3,$4,$5)',
      [s.id, s.activity_id, s.title, s.done, s.position]);
  for (const r of data.recurrence_done ?? [])
    await execute('INSERT INTO recurrence_done (activity_id,occurrence_date,done_at) VALUES ($1,$2,$3)',
      [r.activity_id, r.occurrence_date, r.done_at]);
  for (const f of data.note_folders)
    await execute('INSERT INTO note_folders (id,name,created_at) VALUES ($1,$2,$3)', [f.id, f.name, f.created_at]);
  for (const n of data.notes)
    await execute('INSERT INTO notes (id,folder_id,title,body,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [n.id, n.folder_id, n.title, n.body, n.created_at, n.updated_at]);
  for (const s of data.settings)
    await execute('INSERT INTO settings (key,value) VALUES ($1,$2)', [s.key, s.value]);
}
