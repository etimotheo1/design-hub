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

  const card = get<{ project_id: number }>(`SELECT project_id FROM cards WHERE id = ?`, [move.card_id]);
  if (!card) return NextResponse.json({ ok: false, error: "Card not found." }, { status: 404 });

  const check = checkStageApproval(user.id, user.role, card.project_id, move.from_stage, move.to_stage);
  if (!check.allowed) {
    const list = check.requiredDesignations.join(" / ") || "the right designation";
    return NextResponse.json({ ok: false, error: `Only ${list} can reject this move.` }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const note = body.note ? String(body.note).trim() : null;

  run(
    `UPDATE stage_moves SET status = 'rejected', decided_by = ?, decided_at = datetime('now'),
                            decision_note = ? WHERE id = ?`,
    [user.id, note, moveId]
  );
  return NextResponse.json({ ok: true });
}
