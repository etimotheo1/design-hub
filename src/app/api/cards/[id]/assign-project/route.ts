import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isValidColor } from "@/lib/colors";
import { get, run } from "@/lib/db";

// Admin-only. Used by the Approvals page to resolve a "suggest new project"
// submission. Two modes:
//   1. { project_id: N } → reassign card to existing project, clear suggestion.
//   2. { create_project: { name, description?, color? } } → create the project,
//      reassign card to it, clear suggestion.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const cardId = Number(params.id);
  const body = await req.json();

  let targetProjectId: number;

  if (body.project_id) {
    targetProjectId = Number(body.project_id);
    const exists = get(`SELECT 1 FROM projects WHERE id = ?`, [targetProjectId]);
    if (!exists) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 400 });
  } else if (body.create_project) {
    const cp = body.create_project;
    const name = String(cp.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Project name required." }, { status: 400 });
    const color = isValidColor(cp.color) ? cp.color : "indigo";
    const visibility = cp.visibility === "private" ? "private" : "public";
    try {
      const result = run(
        `INSERT INTO projects (name, description, color, visibility, created_by) VALUES (?, ?, ?, ?, ?)`,
        [name, cp.description?.trim() || null, color, visibility, me.id]
      );
      targetProjectId = Number(result.lastInsertRowid);
      run(
        `INSERT OR IGNORE INTO project_members (project_id, user_id, role, granted_by) VALUES (?, ?, 'lead', ?)`,
        [targetProjectId, me.id, me.id]
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE")) return NextResponse.json({ ok: false, error: "A project with that name already exists." }, { status: 400 });
      return NextResponse.json({ ok: false, error: "Could not create project." }, { status: 500 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "Provide project_id or create_project." }, { status: 400 });
  }

  // Reassign and clear the pending suggestion.
  run(
    `UPDATE cards SET project_id = ?, suggested_project_name = NULL, updated_at = datetime('now') WHERE id = ?`,
    [targetProjectId, cardId]
  );
  return NextResponse.json({ ok: true, project_id: targetProjectId });
}
