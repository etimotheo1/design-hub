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
  const collaborators = all<{
    user_id: number; display_name: string; username: string; email: string | null;
    added_at: string; added_by_name: string;
  }>(
    `SELECT u.id AS user_id, u.display_name, u.username, u.email,
            cc.added_at, ab.display_name AS added_by_name
     FROM card_collaborators cc
     JOIN users u  ON u.id  = cc.user_id
     JOIN users ab ON ab.id = cc.added_by
     WHERE cc.card_id = ?
     ORDER BY cc.added_at ASC`,
    [id]
  );

  // If this card came from a form submission, surface the custom-field answers
  // so the admin can see what the submitter said.
  const submissionAnswers = card.from_form_id ? all<{
    field_label: string; field_type: string; value: string | null; position: number;
  }>(
    `SELECT ff.label AS field_label, ff.type AS field_type, fa.value, ff.position
     FROM form_submissions fs
     JOIN form_field_answers fa ON fa.submission_id = fs.id
     JOIN form_fields ff ON ff.id = fa.field_id
     WHERE fs.card_id = ?
     ORDER BY ff.position ASC`,
    [id]
  ) : [];

  return NextResponse.json({ ok: true, card, comments, attachments, collaborators, submissionAnswers });
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
    // Accept YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS].
    const d = typeof body.deadline === "string" && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(body.deadline)
      ? body.deadline : null;
    fields.push("deadline = ?"); values.push(d);
  }
  if (typeof body.stage === "string" && STAGES.includes(body.stage as Stage)) {
    const newStage = body.stage as Stage;
    const existing = get<Card>(`SELECT * FROM cards WHERE id = ?`, [id]);
    if (existing && existing.stage !== newStage) {
      // Approval enforcement: if any approvers are configured for this stage
      // in this project, the user must be one of them (admins always pass).
      if (user.role !== "admin") {
        const approvers = get<{ c: number }>(
          `SELECT COUNT(*) AS c FROM project_stage_approvers WHERE project_id = ? AND stage = ?`,
          [existing.project_id, newStage]
        );
        const isConfigured = (approvers?.c ?? 0) > 0;
        if (isConfigured) {
          const allowed = !!get(
            `SELECT 1 FROM project_stage_approvers WHERE project_id = ? AND stage = ? AND user_id = ?`,
            [existing.project_id, newStage, user.id]
          );
          if (!allowed) {
            return NextResponse.json(
              { ok: false, error: `You don't have approval rights to move cards into ${newStage}. Ask a designated approver.` },
              { status: 403 }
            );
          }
        }
      }

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
