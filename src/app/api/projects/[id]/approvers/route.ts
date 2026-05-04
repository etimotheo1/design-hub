import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import { STAGES, type Stage } from "@/lib/types";

// Per-project approval rules: who can approve cards moving INTO each stage.
// Admin OR project lead OR project creator can manage.

function canManage(meId: number, meRole: string, projectId: number): boolean {
  if (meRole === "admin") return true;
  const project = get<{ created_by: number | null }>(`SELECT created_by FROM projects WHERE id = ?`, [projectId]);
  if (project && project.created_by === meId) return true;
  const isLead = !!get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'lead'`, [projectId, meId]);
  return isLead;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = Number(params.id);
  const rows = all<{ project_id: number; stage: Stage; user_id: number; display_name: string }>(
    `SELECT psa.project_id, psa.stage, psa.user_id, u.display_name
     FROM project_stage_approvers psa
     JOIN users u ON u.id = psa.user_id
     WHERE psa.project_id = ?
     ORDER BY psa.stage, u.display_name`,
    [projectId]
  );

  // Group by stage for client convenience.
  const byStage: Record<string, Array<{ user_id: number; display_name: string }>> = {};
  for (const s of STAGES) byStage[s] = [];
  for (const r of rows) byStage[r.stage].push({ user_id: r.user_id, display_name: r.display_name });

  return NextResponse.json({ ok: true, byStage });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = Number(params.id);
  if (!canManage(me.id, me.role, projectId)) {
    return NextResponse.json({ ok: false, error: "Only admins, project leads, or the project creator can change approvers." }, { status: 403 });
  }

  const { stage, user_id } = await req.json();
  if (!STAGES.includes(stage)) return NextResponse.json({ ok: false, error: "Invalid stage" }, { status: 400 });
  if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  try {
    run(
      `INSERT INTO project_stage_approvers (project_id, stage, user_id, added_by) VALUES (?, ?, ?, ?)`,
      [projectId, stage, Number(user_id), me.id]
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("PRIMARY KEY")) return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = Number(params.id);
  if (!canManage(me.id, me.role, projectId)) {
    return NextResponse.json({ ok: false, error: "Only admins, project leads, or the project creator can change approvers." }, { status: 403 });
  }

  const stage = req.nextUrl.searchParams.get("stage");
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  if (!stage || !STAGES.includes(stage as Stage) || !userId) {
    return NextResponse.json({ ok: false, error: "stage and user_id required" }, { status: 400 });
  }
  run(`DELETE FROM project_stage_approvers WHERE project_id = ? AND stage = ? AND user_id = ?`, [projectId, stage, userId]);
  return NextResponse.json({ ok: true });
}
