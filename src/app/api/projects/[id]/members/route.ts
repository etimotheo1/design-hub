import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import type { ProjectMember } from "@/lib/types";

// List members of a project. Admin or the project creator can list.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = Number(params.id);
  const project = get<{ created_by: number | null }>(`SELECT created_by FROM projects WHERE id = ?`, [projectId]);
  if (!project) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // Admin OR creator OR existing member can view.
  const isMember = !!get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?`, [projectId, me.id]);
  if (me.role !== "admin" && project.created_by !== me.id && !isMember) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const members = all<ProjectMember>(
    `SELECT pm.project_id, pm.user_id, pm.role, pm.granted_by, pm.granted_at,
            u.display_name, u.email
     FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY pm.role DESC, u.display_name ASC`,
    [projectId]
  );
  return NextResponse.json({ ok: true, members });
}

// Add a member. Admin OR project creator OR existing 'lead' member.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = Number(params.id);
  const project = get<{ created_by: number | null }>(`SELECT created_by FROM projects WHERE id = ?`, [projectId]);
  if (!project) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const isLead = !!get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'lead'`, [projectId, me.id]);
  if (me.role !== "admin" && project.created_by !== me.id && !isLead) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { user_id, role } = await req.json();
  const safeRole = role === "lead" ? "lead" : "member";
  if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  try {
    run(
      `INSERT INTO project_members (project_id, user_id, role, granted_by) VALUES (?, ?, ?, ?)`,
      [projectId, Number(user_id), safeRole, me.id]
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("PRIMARY KEY")) {
      // Already a member — flip role if requested.
      run(`UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`, [safeRole, projectId, Number(user_id)]);
      return NextResponse.json({ ok: true, updated: true });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Remove a member.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = Number(params.id);
  const project = get<{ created_by: number | null }>(`SELECT created_by FROM projects WHERE id = ?`, [projectId]);
  if (!project) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const isLead = !!get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'lead'`, [projectId, me.id]);
  if (me.role !== "admin" && project.created_by !== me.id && !isLead) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  if (!userId) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });
  run(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [projectId, userId]);
  return NextResponse.json({ ok: true });
}
