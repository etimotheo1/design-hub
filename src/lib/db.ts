import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// SQLite via Node's built-in node:sqlite module (stable in Node 23+).
// No native compilation, no version-mismatch errors with new Node releases.
// The DB file lives in ./data/pm.db at the repo root.

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "pm.db");

type RunResult = { lastInsertRowid: number | bigint; changes: number | bigint };

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  initSchema(db);
  seedDefaults(db);

  _db = db;
  return db;
}

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function initSchema(db: DatabaseSync) {
  // Base tables — created on first run, idempotent.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'tech',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      archived    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cards (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id        INTEGER NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      imagined_outcome  TEXT,
      stage             TEXT NOT NULL DEFAULT 'idea',
      position          INTEGER NOT NULL DEFAULT 0,
      created_by        INTEGER NOT NULL,
      assignee_id       INTEGER,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cards_stage ON cards(stage);
    CREATE INDEX IF NOT EXISTS idx_cards_project ON cards(project_id);

    CREATE TABLE IF NOT EXISTS comments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id     INTEGER NOT NULL,
      author_id   INTEGER NOT NULL,
      body        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id     INTEGER NOT NULL,
      label       TEXT NOT NULL,
      url         TEXT NOT NULL,
      added_by    INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Time-in-stage tracking. One row per stage entry per card.
    CREATE TABLE IF NOT EXISTS stage_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id     INTEGER NOT NULL,
      stage       TEXT NOT NULL,
      entered_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stage_history_card ON stage_history(card_id);
  `);

  // Additive migrations for older DBs that pre-date these columns.
  // SQLite lacks ADD COLUMN IF NOT EXISTS, so we check first.
  if (!tableHasColumn(db, "cards", "category")) {
    db.exec(`ALTER TABLE cards ADD COLUMN category TEXT`);
  }
  if (!tableHasColumn(db, "cards", "card_type")) {
    db.exec(`ALTER TABLE cards ADD COLUMN card_type TEXT`);
  }
  if (!tableHasColumn(db, "cards", "deadline")) {
    db.exec(`ALTER TABLE cards ADD COLUMN deadline TEXT`);
  }

  // Backfill stage_history for any pre-existing cards that have no entries yet,
  // so dashboard analytics work from the moment the migration runs.
  db.exec(`
    INSERT INTO stage_history (card_id, stage, entered_at)
    SELECT c.id, c.stage, c.created_at
    FROM cards c
    WHERE NOT EXISTS (SELECT 1 FROM stage_history h WHERE h.card_id = c.id)
  `);
}

function seedDefaults(db: DatabaseSync) {
  // Seed three default projects matching the current strategic priorities.
  // Idempotent — INSERT OR IGNORE keeps the seed safe across restarts.
  const seedProjects = db.prepare(
    `INSERT OR IGNORE INTO projects (name, description) VALUES (?, ?)`
  );
  const defaults: Array<[string, string]> = [
    ["Tanzania Market Leadership", "Defend and deepen our position in Tanzania."],
    ["Kenya Expansion", "Evaluate and prepare entry strategy for Kenya."],
    ["Rice Pilot", "Pilot and validate the rice product line."],
    ["etasks Platform", "Long-term: evolve into a tech company. Design Hub itself feeds into etasks."],
  ];
  for (const row of defaults) {
    seedProjects.run(...row);
  }
}

// Run a one-shot query; useful for `route.ts` handlers that want raw rows.
//
// IMPORTANT: node:sqlite returns rows as `null`-prototype objects. Next.js
// refuses to serialize those across the Server→Client boundary, so we
// rebuild every row as a plain `{...}` object here. Any new query helpers
// must do the same.
function toPlain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function all<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const rows = getDb().prepare(sql).all(...(params as never[])) as unknown[];
  return rows.map((r) => toPlain<T>(r));
}

export function get<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
  const row = getDb().prepare(sql).get(...(params as never[]));
  return row ? toPlain<T>(row) : undefined;
}

export function run(sql: string, params: unknown[] = []): RunResult {
  return getDb().prepare(sql).run(...(params as never[])) as RunResult;
}
