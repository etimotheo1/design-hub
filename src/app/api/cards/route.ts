import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import type { CardWithMeta, Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";

// Look up taxonomy values by name. We accept any non-empty name that exists
// in the table (and isn't archived) — this keeps card forms simple.
function isKnownCategory(name: string | null): boolean {
  if (!name) return false;
  return !!get(`SELECT 1 FROM categories WHERE name = ? AND archived = 0`, [name]);
}
function isKnownCardType(name: string | null): boolean {
  if (!name) return false;
  return !!get(`SELECT 1 FROM card_types WHERE name = ? AND archived = 0`, [name]);
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("project_id");

  let sql = `
    SELECT c.*,
           p.name AS project_name,
           u.display_name AS created_by_name,
           a.display_name AS assignee_name,
           (SELECT COUNT(*) FROM comments cm WHERE cm.card_id = c.id) AS comment_count,
           (SELECT COUNT(*) FROM attachments at WHERE at.card_id = c.id) AS attachment_count,
           (SELECT MAX(entered_at) FROM stage_history h
              WHERE h.card_id = c.id AND h.stage = c.stage) AS current_stage_entered_at
    FROM cards c
    JOIN projects p ON p.id = c.project_id
    JOIN users u ON u.id = c.created_by
    LEFT JOIN users a ON a.id = c.assignee_id
    WHERE p.archived = 0
  `;
  const params: unknown[] = [];
  if (projectId) {
    sql += ` AND c.project_id = ?`;
    params.push(Number(projectId));
  }
  sql += ` ORDER BY c.stage ASC, c.position ASC, c.id ASC`;

  const rows = all<CardWithMeta>(sql, params);
  return NextResponse.json({ ok: true, cards: rows });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const body = await req.json();
  const projectId = Number(body.project_id);
  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const imagined = body.imagined_outcome ? String(body.imagined_outcome).trim() : null;
  const stage: Stage = STAGES.includes(body.stage) ? body.stage : "idea";
  const category = typeof body.category === "string" && isKnownCategory(body.category) ? body.category : null;
  const cardType = typeof body.card_type === "string" && isKnownCardType(body.card_type) ? body.card_type : null;
  const deadline = typeof body.deadline === "string" && body.deadline.match(/^\d{4}-\d{2}-\d{2}$/)
    ? body.deadline : null;

  if (!projectId || !title) {
    return NextResponse.json({ ok: false, error: "Project and title are required." }, { status: 400 });
  }

  // Place at the end of the column.
  const max = get<{ m: number | null }>(
    `SELECT MAX(position) AS m FROM cards WHERE project_id = ? AND stage = ?`,
    [projectId, stage]
  );
  const position = (max?.m ?? -1) + 1;

  const result = run(
    `INSERT INTO cards (project_id, title, description, imagined_outcome, stage, position, category, card_type, deadline, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, title, description, imagined, stage, position, category, cardType, deadline, user.id]
  );
  const cardId = Number(result.lastInsertRowid);
  // Log the initial stage entry so analytics work from card creation onward.
  run(`INSERT INTO stage_history (card_id, stage) VALUES (?, ?)`, [cardId, stage]);

  return NextResponse.json({ ok: true, id: cardId });
}
