use tauri_plugin_sql::{Migration, MigrationKind};

/// Migrations versionate del database.
/// Regola: MAI modificare una migration già distribuita — aggiungerne una nuova
/// con version incrementata. Il plugin tiene traccia della versione applicata.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "schema_iniziale",
        kind: MigrationKind::Up,
        sql: r#"
            CREATE TABLE groups (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            -- Gruppo di default: non eliminabile (vincolo applicato lato app).
            -- I task di un gruppo cancellato migrano qui.
            INSERT INTO groups (id, name) VALUES (1, 'Generale');

            -- Eventi e task sono la stessa entità: con "date" l'attività appare
            -- sul calendario, senza resta solo nella sezione Task.
            CREATE TABLE activities (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                group_id    INTEGER NOT NULL DEFAULT 1 REFERENCES groups(id),
                date        TEXT,            -- 'YYYY-MM-DD' oppure NULL
                time        TEXT,            -- 'HH:MM' oppure NULL
                priority    INTEGER NOT NULL DEFAULT 1,  -- 0 bassa, 1 media, 2 alta
                done        INTEGER NOT NULL DEFAULT 0,
                done_at     TEXT,            -- 'YYYY-MM-DD HH:MM' al completamento
                recurrence  TEXT,            -- NULL | 'daily' | 'weekly' | 'monthly' | 'yearly'
                reminder    INTEGER NOT NULL DEFAULT 0,  -- promemoria attivo (serve data+ora)
                created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE INDEX idx_activities_date  ON activities(date);
            CREATE INDEX idx_activities_group ON activities(group_id);

            CREATE TABLE subtasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                done        INTEGER NOT NULL DEFAULT 0,
                position    INTEGER NOT NULL DEFAULT 0
            );

            -- Completamenti delle singole occorrenze di un'attività ricorrente:
            -- la regola resta in activities, qui si segna "fatta il giorno X".
            CREATE TABLE recurrence_done (
                activity_id     INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
                occurrence_date TEXT NOT NULL,   -- 'YYYY-MM-DD' dell'occorrenza
                done_at         TEXT NOT NULL,
                PRIMARY KEY (activity_id, occurrence_date)
            );

            CREATE TABLE note_folders (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            -- Cartella di default: le note di una cartella cancellata migrano qui.
            INSERT INTO note_folders (id, name) VALUES (1, 'Senza cartella');

            CREATE TABLE notes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_id  INTEGER NOT NULL DEFAULT 1 REFERENCES note_folders(id),
                title      TEXT NOT NULL DEFAULT '',
                body       TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        "#,
    },
    Migration {
        version: 2,
        description: "ore_lavoro_e_fitness",
        kind: MigrationKind::Up,
        sql: r#"
            -- Ore di lavoro registrate per giorno (una riga per giorno).
            CREATE TABLE work_hours (
                date    TEXT PRIMARY KEY,          -- 'YYYY-MM-DD'
                minutes INTEGER NOT NULL DEFAULT 0
            );

            -- Sport dell'utente (palestra, nuoto, ...): ognuno ha le sue
            -- schede di allenamento e il suo diario.
            CREATE TABLE sports (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                icon       TEXT NOT NULL DEFAULT '🏋',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Scheda/lista di allenamento di uno sport (es. "Scheda A", "Vasche martedì").
            CREATE TABLE workout_plans (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                sport_id   INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Esercizi di una scheda: campi testuali liberi così valgono per
            -- qualunque sport (serie '4', reps '12' o '50m', carico '60kg' o 'ritmo gara').
            CREATE TABLE plan_exercises (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id  INTEGER NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
                name     TEXT NOT NULL,
                sets     TEXT NOT NULL DEFAULT '',
                reps     TEXT NOT NULL DEFAULT '',
                load     TEXT NOT NULL DEFAULT '',
                rest     TEXT NOT NULL DEFAULT '',
                notes    TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL DEFAULT 0
            );

            -- Diario: allenamenti svolti (data, scheda usata, durata, note).
            CREATE TABLE workouts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                sport_id   INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
                plan_id    INTEGER REFERENCES workout_plans(id) ON DELETE SET NULL,
                date       TEXT NOT NULL,              -- 'YYYY-MM-DD'
                minutes    INTEGER NOT NULL DEFAULT 0, -- durata
                notes      TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE INDEX idx_workouts_date  ON workouts(date);
            CREATE INDEX idx_workouts_sport ON workouts(sport_id);
        "#,
    },
    Migration {
        version: 3,
        description: "pagamenti_a_rate",
        kind: MigrationKind::Up,
        sql: r#"
            -- Sezioni dei pagamenti (Auto, Elettronica, ... + personalizzate).
            CREATE TABLE payment_categories (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                icon       TEXT NOT NULL DEFAULT '💳',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Piano di pagamento (es. "Rata macchina"): il totale da versare
            -- è opzionale e impostato a mano; gli importi sono in CENTESIMI.
            CREATE TABLE payment_plans (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL REFERENCES payment_categories(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                total       INTEGER,             -- centesimi, NULL = senza totale
                notes       TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Singole rate versate: la somma è calcolata dall'app.
            CREATE TABLE payment_installments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id    INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
                date       TEXT NOT NULL,        -- 'YYYY-MM-DD'
                amount     INTEGER NOT NULL,     -- centesimi
                notes      TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE INDEX idx_installments_plan ON payment_installments(plan_id);
        "#,
    },
    Migration {
        version: 4,
        description: "turni_di_lavoro",
        kind: MigrationKind::Up,
        sql: r#"
            -- Modelli di turno (Mattina, Pomeriggio, Notte, Riposo, ...):
            -- sigla + nome + orario (vuoto = 0h) + colore.
            CREATE TABLE shift_types (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                label      TEXT NOT NULL,                 -- sigla breve, es. 'M'
                name       TEXT NOT NULL DEFAULT '',      -- nome esteso, es. 'Mattina'
                start      TEXT NOT NULL DEFAULT '',      -- 'HH:MM' o '' (nessun orario → 0h)
                end        TEXT NOT NULL DEFAULT '',
                color      TEXT NOT NULL DEFAULT '#3dff70',
                position   INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Turno assegnato a un giorno (uno per giorno).
            CREATE TABLE day_shifts (
                date     TEXT PRIMARY KEY,                -- 'YYYY-MM-DD'
                shift_id INTEGER NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE
            );
        "#,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:agenda-h8.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
