import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { checkStageApproval } from "@/lib/workflow";
import { STAGES, type Stage } from "@/lib/types";

// POST /api/cards/[id]/move
// Body: { to_stage, summary, attachments?: [{label, url}] }
//
// Always records a stage_move row (audit trail). Two paths:
//   - User has approval rights → status='auto_approved', card moves, stage_history logged
//   - User doesn't have rights → status='pending', card stays in current stage
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const cardId = Number(params.id);
  const body = await req.json();
  const toStage = body.to_stage as Stage;
  const summary = String(body.summary || "").trim();
  const attachments: Array<{ label: string; url: string }> = Array.isArray(body.attachments)
    ? body.attachments
        .map((a: unknown) => {
          if (typeof a !== "object" || a === null) return null;
          const o = a as { label?: unknown; url?: unknown };
          const label = typeof o.label === "string" ? o.label.trim() : "";
          const url = typeof o.url === "string" ? o.url.trim() : "";
          return label && url ? { label, url } : null;
        })
        .filter((x: unknown): x is { label: string; url: string } => x !== null)
    : [];

  if (!STAGES.includes(toStage)) {
    return NextResponse.json({ ok: false, error: "Invalid target stage." }, { status: 400 });
  }
  if (!summary || summary.length < 5) {
    return NextResponse.json({ ok: false, error: "A summary is required (at least 5 characters)." }, { status: 400 });
  }

  const card = get<{ id: number; project_id: number; stage: Stage }>(
    `SELECT id, project_id, stage FROM cards WHERE id = ?`,
    [cardId]
  );
  if (!card) return NextResponse.json({ ok: false, error: "Card not found." }, { status: 404 });
  if (card.stage === toStage) {
    return NextResponse.json({ ok: false, error: "Card is already in that stage." }, { status: 400 });
  }

  const check = checkStageApproval(user.id, user.role, card.project_id, card.stage, toStage);
  const moveStatus = check.allowed ? "auto_approved" : "pending";

  // Insert the move record.
  const moveResult = run(
    `INSERT INTO stage_moves (card_id, from_stage, to_stage, requested_by, summary, status, decided_by, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cardId, card.stage, toStage, user.id, summary, moveStatus,
      check.allowed ? user.id : null,
      check.allowed ? new Date().toISOString() : null,
    ]
  );
  const moveId = Number(moveResult.lastInsertRowid);

  // Persist attachments on the move record.
  for (const att of attachments) {
    run(
      `INSERT INTO stage_move_attachments (move_id, label, url) VALUES (?, ?, ?)`,
      [moveId, att.label, att.url]
    );
  }

  // If approved, actually move the card and log stage history.
  if (check.allowed) {
    const max = get<{ m: number | null }>(
      `SELECT MAX(position) AS m FROM cards WHERE project_id = ? AND stage = ?`,
      [card.project_id, toStage]
    );
    run(
      `UPDATE cards SET stage = ?, position = ?, updated_at = datetime('now') WHERE id = ?`,
      [toStage, (max?.m ?? -1) + 1, cardId]
    );
    run(`INSERT INTO stage_history (card_id, stage) VALUES (?, ?)`, [cardId, toStage]);
    return NextResponse.json({ ok: true, status: "moved", move_id: moveId });
  }

  return NextResponse.json({
    ok: true,
    status: "pending",
    move_id: moveId,
    required_designations: check.requiredDesignations,
  });
}
