import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import { isValidColor } from "@/lib/colors";
import type { Project } from "@/lib/types";

// Effective visibility for a non-admin user U on project P:
//   - admin role → sees all projects (regardless of visibility/archived)
//   - U.access_policy = 'restricted' → only sees projects U is a member of OR created
//   - otherwise (standard) → sees public projects + projects U is a member of OR created
//
// Admins use ?include_hidden=1 from the /projects management page to also see
// archived ones for unhiding. Non-admins never see archived/hidden projects.
export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const includeHidden = req.nextUrl.searchParams.get("include_hidden") === "1" && user.role === "admin";

  let rows: Project[];
  if (user.role === "admin") {
    rows = all<Project>(includeHidden
      ? `SELECT * FROM projects ORDER BY archived ASC, name ASC`
      : `SELECT * FROM projects WHERE archived = 0 ORDER BY name ASC`);
  } else {
    // Pull access_policy fresh — sessions only have role.
    const me = get<{ access_policy: string }>(`SELECT access_policy FROM users WHERE id = ?`, [user.id]);
    const policy = me?.access_policy ?? "standard";

    // Visible IF: not archived AND (
    //   I am a member OR I created it OR (policy=standard AND visibility=public)
    // )
    const sql = `
      SELECT p.* FROM projects p
      WHERE p.archived = 0
        AND (
          p.created_by = ?
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)
          ${policy === "standard" ? "OR p.visibility = 'public'" : ""}
        )
      ORDER BY p.name ASC
    `;
    rows = all<Project>(sql, [user.id, user.id]);
  }
  return NextResponse.json({ ok: true, projects: rows });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const { name, description, color, visibility, workflow_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
  const safeColor = isValidColor(color) ? color : null;
  const safeVisibility = visibility === "private" ? "private" : "public";
  const safeWorkflowId = workflow_id ? Number(workflow_id) : null;

  try {
    const result = run(
      `INSERT INTO projects (name, description, color, visibility, created_by, workflow_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), description?.trim() || null, safeColor, safeVisibility, user.id, safeWorkflowId]
    );
    // Auto-add the creator as a 'lead' member so they always have access to
    // their own private projects even if their access policy is 'restricted'.
    run(
      `INSERT OR IGNORE INTO project_members (project_id, user_id, role, granted_by) VALUES (?, ?, 'lead', ?)`,
      [Number(result.lastInsertRowid), user.id, user.id]
    );
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "A project with that name already exists." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Could not create project." }, { status: 500 });
  }
}
