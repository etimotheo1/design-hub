import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import { STAGES, type Stage } from "@/lib/types";

export async function GET() {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const workflows = all<{
    id: number; name: string; description: string | null; created_at: string; in_use: number;
  }>(
    `SELECT w.*, (SELECT COUNT(*) FROM projects p WHERE p.workflow_id = w.id) AS in_use
     FROM workflows w ORDER BY w.name ASC`
  );
  return NextResponse.json({ ok: true, workflows });
}

export async function POST(req: NextRequest) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });

  const result = run(
    `INSERT INTO workflows (name, description, created_by) VALUES (?, ?, ?)`,
    [name, body.description ? String(body.description).trim() : null, me.id]
  );
  const workflowId = Number(result.lastInsertRowid);

  // Auto-create the four forward transitions so the designer has rows to fill.
  const forward: Array<[Stage, Stage]> = [];
  for (let i = 0; i < STAGES.length - 1; i++) forward.push([STAGES[i], STAGES[i + 1]]);
  const stmt = run.bind(null);
  for (const [a, b] of forward) {
    stmt(`INSERT INTO workflow_transitions (workflow_id, from_stage, to_stage) VALUES (?, ?, ?)`, [workflowId, a, b]);
  }

  return NextResponse.json({ ok: true, id: workflowId });
}
