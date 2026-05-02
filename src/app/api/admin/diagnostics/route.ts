import { NextResponse } from "next/server";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth";
import { getDb, dbPaths } from "@/lib/db";

// Admin-only. Returns DB path + size + counts so we can verify the volume
// is actually catching writes. If you redeploy and the size resets to ~0
// or the counts drop, the volume isn't persisting.
export async function GET() {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const { DATA_DIR, DB_PATH, cwd } = dbPaths();
  const db = getDb();

  let dbSize = 0;
  let dbModified: string | null = null;
  try {
    const st = fs.statSync(DB_PATH);
    dbSize = st.size;
    dbModified = st.mtime.toISOString();
  } catch { /* file may not exist */ }

  const tables: Record<string, number> = {};
  for (const t of ["users", "projects", "cards", "comments", "attachments", "categories", "card_types", "invitations", "stage_history"]) {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number } | undefined;
      tables[t] = row?.c ?? 0;
    } catch {
      tables[t] = -1;
    }
  }

  let metaRows: Array<{ key: string; value: string }> = [];
  try {
    metaRows = db.prepare(`SELECT key, value FROM meta ORDER BY key`).all() as Array<{ key: string; value: string }>;
  } catch { /* meta might not exist on really old DBs */ }

  return NextResponse.json({
    ok: true,
    paths: {
      cwd,
      DATA_DIR,
      DB_PATH,
      env_DATA_DIR: process.env.DATA_DIR ?? null,
      env_RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH ?? null,
      data_dir_exists: fs.existsSync(DATA_DIR),
      db_file_exists: fs.existsSync(DB_PATH),
      db_size_bytes: dbSize,
      db_modified_at: dbModified,
    },
    tables,
    meta: Object.fromEntries(metaRows.map((r) => [r.key, r.value])),
    deployed_at: new Date().toISOString(),
  });
}
