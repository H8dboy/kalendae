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
