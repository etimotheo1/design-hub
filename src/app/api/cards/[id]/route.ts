import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import type { Card, Comment, Attachment, Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";

function isKnownCategory(name: string | null): boolean {
  if (!name) return false;
  return !!get(`SELECT 1 FROM categories WHERE name = ? AND archived = 0`, [name]);
}
function isKnownCardType(name: string | null): boolean {
  if (!name) return false;
  return !!get(`SELECT 1 FROM card_types WHERE name = ? AND archived = 0`, [name]);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const id = Number(params.id);
  const card = get<Card & { project_name: string; created_by_name: string; assignee_name: string | null }>(
    `SELECT c.*, p.name AS project_name, u.display_name AS created_by_name, a.display_name AS assignee_name
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = c.created_by
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE c.id = ?`,
    [id]
  );
  if (!card) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const comments = all<Comment & { author_name: string }>(
    `SELECT cm.*, u.display_name AS author_name
     FROM comments cm JOIN users u ON u.id = cm.author_id
     WHERE cm.card_id = ? ORDER BY cm.created_at ASC`,
    [id]
  );
  const attachments = all<Attachment>(
    `SELECT * FROM attachments WHERE card_id = ? ORDER BY created_at ASC`,
    [id]
  );

  return NextResponse.json({ ok: true, card, comments, attachments });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  let stageChanged: Stage | null = null;

  if (typeof body.title === "string") { fields.push("title = ?"); values.push(body.title.trim()); }
  if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description?.trim() || null); }
  if (body.imagined_outcome !== undefined) { fields.push("imagined_outcome = ?"); values.push(body.imagined_outcome?.trim() || null); }
  if (body.assignee_id !== undefined) { fields.push("assignee_id = ?"); values.push(body.assignee_id || null); }
  if (body.category !== undefined) {
    const c = typeof body.category === "string" && isKnownCategory(body.category) ? body.category : null;
    fields.push("category = ?"); values.push(c);
  }
  if (body.card_type !== undefined) {
    const t = typeof body.card_type === "string" && isKnownCardType(body.card_type) ? body.card_type : null;
    fields.push("card_type = ?"); values.push(t);
  }
  if (body.deadline !== undefined) {
    const d = typeof body.deadline === "string" && body.deadline.match(/^\d{4}-\d{2}-\d{2}$/)
      ? body.deadline : null;
    fields.push("deadline = ?"); values.push(d);
  }
  if (typeof body.stage === "string" && STAGES.includes(body.stage as Stage)) {
    const newStage = body.stage as Stage;
    const existing = get<Card>(`SELECT * FROM cards WHERE id = ?`, [id]);
    if (existing && existing.stage !== newStage) {
      stageChanged = newStage;
      fields.push("stage = ?"); values.push(newStage);
      // When stage changes, push to bottom of new column.
      const max = get<{ m: number | null }>(
        `SELECT MAX(position) AS m FROM cards WHERE project_id = ? AND stage = ?`,
        [existing.project_id, newStage]
      );
      fields.push("position = ?"); values.push((max?.m ?? -1) + 1);
    }
  }
  if (typeof body.position === "number") { fields.push("position = ?"); values.push(body.position); }

  if (fields.length === 0) return NextResponse.json({ ok: true });

  fields.push("updated_at = datetime('now')");
  values.push(id);
  run(`UPDATE cards SET ${fields.join(", ")} WHERE id = ?`, values);

  // Log stage transitions so we can compute time-in-stage on the dashboard.
  if (stageChanged) {
    run(`INSERT INTO stage_history (card_id, stage) VALUES (?, ?)`, [id, stageChanged]);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  run(`DELETE FROM cards WHERE id = ?`, [Number(params.id)]);
  return NextResponse.json({ ok: true });
}
