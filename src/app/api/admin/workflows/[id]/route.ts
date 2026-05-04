import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import type { Stage, WorkflowStageLabel, WorkflowTransition } from "@/lib/types";

// Returns workflow + stage labels + transitions (with allowed designation IDs).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const id = Number(params.id);
  const workflow = get<{ id: number; name: string; description: string | null }>(
    `SELECT id, name, description FROM workflows WHERE id = ?`, [id]
  );
  if (!workflow) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const labels = all<WorkflowStageLabel>(`SELECT * FROM workflow_stage_labels WHERE workflow_id = ?`, [id]);
  const transitions = all<WorkflowTransition>(`SELECT * FROM workflow_transitions WHERE workflow_id = ? ORDER BY id`, [id]);
  const transitionDesignations = all<{ transition_id: number; designation_id: number; designation_name: string }>(
    `SELECT wtd.transition_id, wtd.designation_id, d.name AS designation_name
     FROM workflow_transition_designations wtd
     JOIN designations d ON d.id = wtd.designation_id
     WHERE wtd.transition_id IN (SELECT id FROM workflow_transitions WHERE workflow_id = ?)
     ORDER BY d.name`,
    [id]
  );

  // Group designations under each transition for client convenience.
  const transitionsEnriched = transitions.map((t) => ({
    ...t,
    designations: transitionDesignations.filter((td) => td.transition_id === t.id),
  }));

  return NextResponse.json({ ok: true, workflow, labels, transitions: transitionsEnriched });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const id = Number(params.id);
  const body = await req.json();

  if (typeof body.name === "string" && body.name.trim()) {
    run(`UPDATE workflows SET name = ? WHERE id = ?`, [body.name.trim(), id]);
  }
  if ("description" in body) {
    run(`UPDATE workflows SET description = ? WHERE id = ?`, [
      body.description ? String(body.description).trim() : null, id,
    ]);
  }

  // Stage label override: { stage_labels: { [stage]: label_or_null } }
  if (body.stage_labels && typeof body.stage_labels === "object") {
    for (const [stage, label] of Object.entries(body.stage_labels)) {
      if (label === null || label === "") {
        run(`DELETE FROM workflow_stage_labels WHERE workflow_id = ? AND stage = ?`, [id, stage]);
      } else if (typeof label === "string" && label.trim()) {
        run(
          `INSERT INTO workflow_stage_labels (workflow_id, stage, label)
           VALUES (?, ?, ?)
           ON CONFLICT (workflow_id, stage) DO UPDATE SET label = excluded.label`,
          [id, stage, label.trim()]
        );
      }
    }
  }

  // Transition designations: { transition_designations: { [transition_id]: [designation_id, ...] } }
  // Replaces the full set for each transition listed.
  if (body.transition_designations && typeof body.transition_designations === "object") {
    for (const [tid, designationIds] of Object.entries(body.transition_designations)) {
      const transitionId = Number(tid);
      if (!Array.isArray(designationIds)) continue;
      // Verify the transition belongs to this workflow.
      const exists = get(`SELECT 1 FROM workflow_transitions WHERE id = ? AND workflow_id = ?`, [transitionId, id]);
      if (!exists) continue;
      run(`DELETE FROM workflow_transition_designations WHERE transition_id = ?`, [transitionId]);
      for (const did of designationIds) {
        try {
          run(
            `INSERT INTO workflow_transition_designations (transition_id, designation_id) VALUES (?, ?)`,
            [transitionId, Number(did)]
          );
        } catch { /* ignore dup */ }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  // Clear workflow_id from any projects using it.
  run(`UPDATE projects SET workflow_id = NULL WHERE workflow_id = ?`, [Number(params.id)]);
  run(`DELETE FROM workflows WHERE id = ?`, [Number(params.id)]);
  return NextResponse.json({ ok: true });
}
