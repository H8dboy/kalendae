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

/* ---------------- ore di lavoro ---------------- */
export const listWorkHours = (from, to) =>
  select('SELECT date, minutes FROM work_hours WHERE date >= $1 AND date <= $2', [from, to]);

export const getWorkMinutes = async date =>
  (await select('SELECT minutes FROM work_hours WHERE date=$1', [date]))[0]?.minutes ?? 0;

// 0 minuti = giorno senza ore: la riga si elimina invece di tenere zeri.
export async function setWorkMinutes(date, minutes) {
  if (minutes > 0) {
    await execute('INSERT OR REPLACE INTO work_hours (date, minutes) VALUES ($1,$2)', [date, minutes]);
  } else {
    await execute('DELETE FROM work_hours WHERE date=$1', [date]);
  }
}

/* ---------------- fitness: sport ---------------- */
export const listSports = () =>
  select(`SELECT s.*,
            (SELECT COUNT(*) FROM workout_plans p WHERE p.sport_id=s.id) AS plan_count,
            (SELECT COUNT(*) FROM workouts w WHERE w.sport_id=s.id) AS workout_count
          FROM sports s ORDER BY s.id`);

export async function createSport(name, icon) {
  const r = await execute('INSERT INTO sports (name, icon) VALUES ($1,$2)', [name, icon]);
  return r.lastInsertId;
}

export const updateSport = (id, name, icon) =>
  execute('UPDATE sports SET name=$1, icon=$2 WHERE id=$3', [name, icon, id]);

// Eliminazione esplicita dei figli (stessa ragione di deleteActivity).
export async function deleteSport(id) {
  await execute('DELETE FROM plan_exercises WHERE plan_id IN (SELECT id FROM workout_plans WHERE sport_id=$1)', [id]);
  await execute('DELETE FROM workouts WHERE sport_id=$1', [id]);
  await execute('DELETE FROM workout_plans WHERE sport_id=$1', [id]);
  await execute('DELETE FROM sports WHERE id=$1', [id]);
}

/* ---------------- fitness: schede ---------------- */
export const listPlans = sportId =>
  select(`SELECT p.*,
            (SELECT COUNT(*) FROM plan_exercises e WHERE e.plan_id=p.id) AS exercise_count
          FROM workout_plans p WHERE p.sport_id=$1 ORDER BY p.id`, [sportId]);

export const getPlan = async id =>
  (await select('SELECT * FROM workout_plans WHERE id=$1', [id]))[0];

export async function createPlan(sportId, name) {
  const r = await execute('INSERT INTO workout_plans (sport_id, name) VALUES ($1,$2)', [sportId, name]);
  return r.lastInsertId;
}

export const renamePlan = (id, name) =>
  execute('UPDATE workout_plans SET name=$1 WHERE id=$2', [name, id]);

export async function deletePlan(id) {
  await execute('DELETE FROM plan_exercises WHERE plan_id=$1', [id]);
  await execute('UPDATE workouts SET plan_id=NULL WHERE plan_id=$1', [id]);
  await execute('DELETE FROM workout_plans WHERE id=$1', [id]);
}

/* ---------------- fitness: esercizi della scheda ---------------- */
export const listExercises = planId =>
  select('SELECT * FROM plan_exercises WHERE plan_id=$1 ORDER BY position, id', [planId]);

export async function addExercise(planId, e) {
  const pos = (await select('SELECT COALESCE(MAX(position),0)+1 AS p FROM plan_exercises WHERE plan_id=$1', [planId]))[0].p;
  await execute(
    'INSERT INTO plan_exercises (plan_id, name, sets, reps, load, rest, notes, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [planId, e.name, e.sets ?? '', e.reps ?? '', e.load ?? '', e.rest ?? '', e.notes ?? '', pos]);
}

export const updateExercise = (id, e) =>
  execute('UPDATE plan_exercises SET name=$1, sets=$2, reps=$3, load=$4, rest=$5, notes=$6 WHERE id=$7',
    [e.name, e.sets ?? '', e.reps ?? '', e.load ?? '', e.rest ?? '', e.notes ?? '', id]);

export const deleteExercise = id => execute('DELETE FROM plan_exercises WHERE id=$1', [id]);

/* ---------------- fitness: diario allenamenti ---------------- */
export const listWorkouts = (sportId, limit = 100) =>
  select(`SELECT w.*, p.name AS plan_name FROM workouts w
          LEFT JOIN workout_plans p ON p.id = w.plan_id
          WHERE w.sport_id=$1 ORDER BY w.date DESC, w.id DESC LIMIT $2`, [sportId, limit]);

export async function addWorkout(w) {
  await execute('INSERT INTO workouts (sport_id, plan_id, date, minutes, notes) VALUES ($1,$2,$3,$4,$5)',
    [w.sport_id, w.plan_id ?? null, w.date, w.minutes ?? 0, w.notes ?? '']);
}

export const updateWorkout = (id, w) =>
  execute('UPDATE workouts SET plan_id=$1, date=$2, minutes=$3, notes=$4 WHERE id=$5',
    [w.plan_id ?? null, w.date, w.minutes ?? 0, w.notes ?? '', id]);

export const deleteWorkout = id => execute('DELETE FROM workouts WHERE id=$1', [id]);

/* ---------------- pagamenti: sezioni ---------------- */
export const listPayCategories = () =>
  select(`SELECT c.*,
            (SELECT COUNT(*) FROM payment_plans p WHERE p.category_id=c.id) AS plan_count,
            (SELECT COALESCE(SUM(i.amount),0) FROM payment_installments i
              JOIN payment_plans p ON p.id=i.plan_id WHERE p.category_id=c.id) AS paid
          FROM payment_categories c ORDER BY c.id`);

export async function createPayCategory(name, icon) {
  const r = await execute('INSERT INTO payment_categories (name, icon) VALUES ($1,$2)', [name, icon]);
  return r.lastInsertId;
}

export const updatePayCategory = (id, name, icon) =>
  execute('UPDATE payment_categories SET name=$1, icon=$2 WHERE id=$3', [name, icon, id]);

export async function deletePayCategory(id) {
  await execute('DELETE FROM payment_installments WHERE plan_id IN (SELECT id FROM payment_plans WHERE category_id=$1)', [id]);
  await execute('DELETE FROM payment_plans WHERE category_id=$1', [id]);
  await execute('DELETE FROM payment_categories WHERE id=$1', [id]);
}

/* ---------------- pagamenti: piani ---------------- */
export const listPayPlans = categoryId =>
  select(`SELECT p.*,
            (SELECT COALESCE(SUM(i.amount),0) FROM payment_installments i WHERE i.plan_id=p.id) AS paid,
            (SELECT COUNT(*) FROM payment_installments i WHERE i.plan_id=p.id) AS installment_count
          FROM payment_plans p WHERE p.category_id=$1 ORDER BY p.id`, [categoryId]);

export const getPayPlan = async id =>
  (await select(`SELECT p.*,
      (SELECT COALESCE(SUM(i.amount),0) FROM payment_installments i WHERE i.plan_id=p.id) AS paid
    FROM payment_plans p WHERE p.id=$1`, [id]))[0];

export async function createPayPlan(categoryId, p) {
  const r = await execute('INSERT INTO payment_plans (category_id, name, total, notes) VALUES ($1,$2,$3,$4)',
    [categoryId, p.name, p.total ?? null, p.notes ?? '']);
  return r.lastInsertId;
}

export const updatePayPlan = (id, p) =>
  execute('UPDATE payment_plans SET name=$1, total=$2, notes=$3 WHERE id=$4',
    [p.name, p.total ?? null, p.notes ?? '', id]);

export async function deletePayPlan(id) {
  await execute('DELETE FROM payment_installments WHERE plan_id=$1', [id]);
  await execute('DELETE FROM payment_plans WHERE id=$1', [id]);
}

/* ---------------- pagamenti: rate ---------------- */
export const listInstallments = planId =>
  select('SELECT * FROM payment_installments WHERE plan_id=$1 ORDER BY date DESC, id DESC', [planId]);

export const addInstallment = (planId, i) =>
  execute('INSERT INTO payment_installments (plan_id, date, amount, notes) VALUES ($1,$2,$3,$4)',
    [planId, i.date, i.amount, i.notes ?? '']);

export const updateInstallment = (id, i) =>
  execute('UPDATE payment_installments SET date=$1, amount=$2, notes=$3 WHERE id=$4',
    [i.date, i.amount, i.notes ?? '', id]);

export const deleteInstallment = id =>
  execute('DELETE FROM payment_installments WHERE id=$1', [id]);

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

export const statsWorkByMonth = () =>
  select(`SELECT substr(date,1,7) AS bucket, SUM(minutes) AS n
          FROM work_hours GROUP BY bucket ORDER BY bucket DESC LIMIT 6`);

export const statsWorkoutsByMonth = () =>
  select(`SELECT substr(date,1,7) AS bucket, COUNT(*) AS n
          FROM workouts GROUP BY bucket ORDER BY bucket DESC LIMIT 6`);

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
    work_hours: await select('SELECT * FROM work_hours'),
    sports: await select('SELECT * FROM sports'),
    workout_plans: await select('SELECT * FROM workout_plans'),
    plan_exercises: await select('SELECT * FROM plan_exercises'),
    workouts: await select('SELECT * FROM workouts'),
    payment_categories: await select('SELECT * FROM payment_categories'),
    payment_plans: await select('SELECT * FROM payment_plans'),
    payment_installments: await select('SELECT * FROM payment_installments'),
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
  await execute('DELETE FROM work_hours');
  await execute('DELETE FROM plan_exercises');
  await execute('DELETE FROM workouts');
  await execute('DELETE FROM workout_plans');
  await execute('DELETE FROM sports');
  await execute('DELETE FROM payment_installments');
  await execute('DELETE FROM payment_plans');
  await execute('DELETE FROM payment_categories');
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
  // Tabelle aggiunte dopo: i backup vecchi non le hanno (?? []).
  for (const w of data.work_hours ?? [])
    await execute('INSERT INTO work_hours (date,minutes) VALUES ($1,$2)', [w.date, w.minutes]);
  for (const s of data.sports ?? [])
    await execute('INSERT INTO sports (id,name,icon,created_at) VALUES ($1,$2,$3,$4)',
      [s.id, s.name, s.icon, s.created_at]);
  for (const p of data.workout_plans ?? [])
    await execute('INSERT INTO workout_plans (id,sport_id,name,created_at) VALUES ($1,$2,$3,$4)',
      [p.id, p.sport_id, p.name, p.created_at]);
  for (const e of data.plan_exercises ?? [])
    await execute('INSERT INTO plan_exercises (id,plan_id,name,sets,reps,load,rest,notes,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [e.id, e.plan_id, e.name, e.sets, e.reps, e.load, e.rest, e.notes, e.position]);
  for (const w of data.workouts ?? [])
    await execute('INSERT INTO workouts (id,sport_id,plan_id,date,minutes,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [w.id, w.sport_id, w.plan_id, w.date, w.minutes, w.notes, w.created_at]);
  for (const c of data.payment_categories ?? [])
    await execute('INSERT INTO payment_categories (id,name,icon,created_at) VALUES ($1,$2,$3,$4)',
      [c.id, c.name, c.icon, c.created_at]);
  for (const p of data.payment_plans ?? [])
    await execute('INSERT INTO payment_plans (id,category_id,name,total,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [p.id, p.category_id, p.name, p.total, p.notes, p.created_at]);
  for (const i of data.payment_installments ?? [])
    await execute('INSERT INTO payment_installments (id,plan_id,date,amount,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [i.id, i.plan_id, i.date, i.amount, i.notes, i.created_at]);
}
