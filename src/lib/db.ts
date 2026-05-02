import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// SQLite via Node's built-in node:sqlite module (stable in Node 23+).
// No native compilation, no version-mismatch errors with new Node releases.
//
// IMPORTANT — persistence:
// The DB lives at $DATA_DIR/pm.db. On Railway, you MUST mount a persistent
// volume at the same path you set DATA_DIR to (or at $RAILWAY_VOLUME_MOUNT_PATH
// if that env is set), otherwise the DB file gets wiped on every redeploy.
//
// Path resolution priority:
//   1. DATA_DIR env var (explicit path, e.g. /app/data)
//   2. RAILWAY_VOLUME_MOUNT_PATH env var (Railway sets this when a volume mounts)
//   3. ./data relative to the working directory (fallback for local dev)

function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) return process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return path.resolve(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, "pm.db");

// Exported so /api/admin/diagnostics can read them without re-deriving paths.
export function dbPaths() {
  return { DATA_DIR, DB_PATH, cwd: process.cwd() };
}

type RunResult = { lastInsertRowid: number | bigint; changes: number | bigint };

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const dbExistedBefore = fs.existsSync(DB_PATH);
  const dbStatsBefore = dbExistedBefore ? fs.statSync(DB_PATH) : null;

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  initSchema(db);

  // Loud, helpful startup log — visible in Railway deploy logs. If the DB
  // file is "new" on every deploy, the volume isn't catching writes.
  try {
    const userCount      = (db.prepare(`SELECT COUNT(*) AS c FROM users`).get()      as { c: number } | undefined)?.c ?? 0;
    const projectCount   = (db.prepare(`SELECT COUNT(*) AS c FROM projects`).get()   as { c: number } | undefined)?.c ?? 0;
    const cardCount      = (db.prepare(`SELECT COUNT(*) AS c FROM cards`).get()      as { c: number } | undefined)?.c ?? 0;
    const categoryCount  = (db.prepare(`SELECT COUNT(*) AS c FROM categories`).get() as { c: number } | undefined)?.c ?? 0;
    console.log(
      `[design-hub] DB ready at ${DB_PATH} ` +
      `(${dbExistedBefore ? `existing, ${dbStatsBefore?.size ?? 0} bytes` : "NEW FILE — volume may not be persisting!"}). ` +
      `users=${userCount} projects=${projectCount} cards=${cardCount} categories=${categoryCount}.`
    );
  } catch {
    // Don't crash startup just because logging failed.
  }

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
      color       TEXT,
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

    -- Editable taxonomy: Categories and Card Types are managed by admins.
    -- cards.category / cards.card_type store the NAME (denormalised) so
    -- queries don't need joins; renames are propagated by an UPDATE on cards.
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT,
      archived   INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS card_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      archived   INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tokenised invitations: admin generates a link, recipient sets their own password.
    CREATE TABLE IF NOT EXISTS invitations (
      token        TEXT PRIMARY KEY,
      email        TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role         TEXT NOT NULL,
      invited_by   INTEGER NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at   TEXT NOT NULL,
      used         INTEGER NOT NULL DEFAULT 0,
      used_at      TEXT,
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

    -- Generic key/value store. Used to track whether one-shot setup steps
    -- (like seeding defaults) have already run.
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Multiple collaborators per card. Join table; PK prevents duplicates.
    CREATE TABLE IF NOT EXISTS card_collaborators (
      card_id   INTEGER NOT NULL,
      user_id   INTEGER NOT NULL,
      added_at  TEXT NOT NULL DEFAULT (datetime('now')),
      added_by  INTEGER NOT NULL,
      PRIMARY KEY (card_id, user_id),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_collab_card ON card_collaborators(card_id);
    CREATE INDEX IF NOT EXISTS idx_collab_user ON card_collaborators(user_id);
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
  if (!tableHasColumn(db, "users", "email")) {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
  }
  if (!tableHasColumn(db, "users", "must_change_password")) {
    db.exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`);
  }
  if (!tableHasColumn(db, "projects", "color")) {
    db.exec(`ALTER TABLE projects ADD COLUMN color TEXT`);
    // Backfill colors for the seeded projects so the Bucketlist looks right
    // out of the box. User can change them anytime.
    db.exec(`UPDATE projects SET color = 'emerald' WHERE name = 'Tanzania Market Leadership' AND color IS NULL`);
    db.exec(`UPDATE projects SET color = 'sky'     WHERE name = 'Kenya Expansion'             AND color IS NULL`);
    db.exec(`UPDATE projects SET color = 'amber'   WHERE name = 'Rice Pilot'                   AND color IS NULL`);
    db.exec(`UPDATE projects SET color = 'indigo'  WHERE name = 'etasks Platform'              AND color IS NULL`);
  }
  if (!tableHasColumn(db, "categories", "color")) {
    db.exec(`ALTER TABLE categories ADD COLUMN color TEXT`);
    db.exec(`UPDATE categories SET color = 'blue'    WHERE name = 'Distribution' AND color IS NULL`);
    db.exec(`UPDATE categories SET color = 'emerald' WHERE name = 'Product'      AND color IS NULL`);
    db.exec(`UPDATE categories SET color = 'indigo'  WHERE name = 'Tech'         AND color IS NULL`);
    db.exec(`UPDATE categories SET color = 'pink'    WHERE name = 'Marketing'    AND color IS NULL`);
    db.exec(`UPDATE categories SET color = 'amber'   WHERE name = 'Operations'   AND color IS NULL`);
    db.exec(`UPDATE categories SET color = 'slate'   WHERE name = 'Other'        AND color IS NULL`);
  }

  // One-time heal: any admin stuck with the forced-change flag gets cleared.
  // (Earlier versions seeded the admin with must_change_password = 1, which
  // could repeatedly send the admin to /change-password. The seeded admin
  // should sign in normally; password changes happen via the top-nav link.)
  db.exec(`UPDATE users SET must_change_password = 0 WHERE role = 'admin' AND must_change_password = 1`);

  // Backfill stage_history for any pre-existing cards that have no entries yet,
  // so dashboard analytics work from the moment the migration runs.
  db.exec(`
    INSERT INTO stage_history (card_id, stage, entered_at)
    SELECT c.id, c.stage, c.created_at
    FROM cards c
    WHERE NOT EXISTS (SELECT 1 FROM stage_history h WHERE h.card_id = c.id)
  `);

  // ============================================================================
  // SEEDING — VERY DEFENSIVE GATE.
  //
  // We only ever seed defaults if the database is COMPLETELY empty (no users,
  // no projects, no categories, no card_types). Any existing data — even a
  // single row in any of those tables — is treated as "user has started using
  // the app" and seeding is permanently disabled by setting per-table markers.
  //
  // This prevents the previous bug where deleted/renamed default categories
  // would respawn after a deploy. Even on a future volume hiccup that loses
  // the global marker, individual table contents serve as the gate.
  //
  // Admins who actually want defaults restored can use the "Restore defaults"
  // button on /admin/taxonomy, which calls the seed endpoint explicitly.
  // ============================================================================

  const counts = {
    projects:   (db.prepare(`SELECT COUNT(*) AS c FROM projects`).get()   as { c: number }).c,
    users:      (db.prepare(`SELECT COUNT(*) AS c FROM users`).get()      as { c: number }).c,
    categories: (db.prepare(`SELECT COUNT(*) AS c FROM categories`).get() as { c: number }).c,
    cardTypes:  (db.prepare(`SELECT COUNT(*) AS c FROM card_types`).get() as { c: number }).c,
  };
  const totallyEmpty =
    counts.projects === 0 && counts.users === 0 && counts.categories === 0 && counts.cardTypes === 0;

  // Mark each individual table as "no longer auto-seedable" if it has any data.
  // This is permanent: once you've added or deleted anything in a table, it's
  // your table and we never touch it again. Statement has TWO placeholders
  // (key, value) to match the two args we pass.
  const setMarker = db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);
  const now = new Date().toISOString();
  if (counts.projects > 0)   setMarker.run("seeded_projects",   `noop:${now}`);
  if (counts.categories > 0) setMarker.run("seeded_categories", `noop:${now}`);
  if (counts.cardTypes > 0)  setMarker.run("seeded_card_types", `noop:${now}`);

  if (!totallyEmpty) return;

  // Brand-new install — seed once, then mark so it never runs again.
  seedProjectDefaults(db);
  seedCategoryDefaults(db);
  seedCardTypeDefaults(db);
  setMarker.run("seeded_projects",   `v1:${now}`);
  setMarker.run("seeded_categories", `v1:${now}`);
  setMarker.run("seeded_card_types", `v1:${now}`);
}

// Exported so an admin can manually restore defaults via /api/admin/restore-defaults.
// These functions use INSERT OR IGNORE — they only add MISSING defaults, never
// overwrite existing rows. Safe to call any number of times.
export function seedProjectDefaults(db: DatabaseSync) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO projects (name, description, color) VALUES (?, ?, ?)`);
  const defaults: Array<[string, string, string]> = [
    ["Tanzania Market Leadership", "Defend and deepen our position in Tanzania.", "emerald"],
    ["Kenya Expansion",            "Evaluate and prepare entry strategy for Kenya.", "sky"],
    ["Rice Pilot",                 "Pilot and validate the rice product line.", "amber"],
    ["etasks Platform",            "Long-term: evolve into a tech company. Design Hub itself feeds into etasks.", "indigo"],
  ];
  defaults.forEach((row) => stmt.run(...row));
}

export function seedCategoryDefaults(db: DatabaseSync) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO categories (name, color, sort_order) VALUES (?, ?, ?)`);
  const defaults: Array<[string, string]> = [
    ["Distribution", "blue"],
    ["Product",      "emerald"],
    ["Tech",         "indigo"],
    ["Marketing",    "pink"],
    ["Operations",   "amber"],
    ["Other",        "slate"],
  ];
  defaults.forEach(([name, color], i) => stmt.run(name, color, i));
}

export function seedCardTypeDefaults(db: DatabaseSync) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO card_types (name, sort_order) VALUES (?, ?)`);
  const defaults = ["New initiative", "Improvement", "Fix", "Research"];
  defaults.forEach((name, i) => stmt.run(name, i));
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
