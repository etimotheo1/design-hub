import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { checkStageApproval } from "@/lib/workflow";
import type { Stage } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const moveId = Number(params.id);
  const move = get<{
    id: number; card_id: number; from_stage: Stage; to_stage: Stage; status: string;
  }>(
    `SELECT id, card_id, from_stage, to_stage, status FROM stage_moves WHERE id = ?`,
    [moveId]
  );
  if (!move) return NextResponse.json({ ok: false, error: "Move request not found." }, { status: 404 });
  if (move.status !== "pending") {
    return NextResponse.json({ ok: false, error: `This request is already ${move.status}.` }, { status: 400 });
  }

  const card = get<{ project_id: number; stage: Stage }>(
    `SELECT project_id, stage FROM cards WHERE id = ?`, [move.card_id]
  );
  if (!card) return NextResponse.json({ ok: false, error: "Card not found." }, { status: 404 });

  // Only users who would have direct approval rights for that transition can approve.
  const check = checkStageApproval(user.id, user.role, card.project_id, move.from_stage, move.to_stage);
  if (!check.allowed) {
    const list = check.requiredDesignations.join(" / ") || "the right designation";
    return NextResponse.json(
      { ok: false, error: `Only ${list} can approve this move.` },
      { status: 403 }
    );
  }

  // Card might have moved elsewhere since the request was filed — only proceed if it's still in the from_stage.
  if (card.stage !== move.from_stage) {
    run(
      `UPDATE stage_moves SET status = 'rejected', decided_by = ?, decided_at = datetime('now'),
                              decision_note = ? WHERE id = ?`,
      [user.id, `Auto-rejected: card is now in ${card.stage}, not ${move.from_stage}.`, moveId]
    );
    return NextResponse.json({ ok: false, error: "Card has moved since this request was filed; the request was auto-rejected." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const note = body.note ? String(body.note).trim() : null;

  // Approve: record the decision, move the card, log stage history.
  run(
    `UPDATE stage_moves SET status = 'approved', decided_by = ?, decided_at = datetime('now'),
                            decision_note = ? WHERE id = ?`,
    [user.id, note, moveId]
  );

  const max = get<{ m: number | null }>(
    `SELECT MAX(position) AS m FROM cards WHERE project_id = ? AND stage = ?`,
    [card.project_id, move.to_stage]
  );
  run(
    `UPDATE cards SET stage = ?, position = ?, updated_at = datetime('now') WHERE id = ?`,
    [move.to_stage, (max?.m ?? -1) + 1, move.card_id]
  );
  run(`INSERT INTO stage_history (card_id, stage) VALUES (?, ?)`, [move.card_id, move.to_stage]);

  return NextResponse.json({ ok: true });
}
