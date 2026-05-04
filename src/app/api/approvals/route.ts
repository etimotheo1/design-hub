import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { checkStageApproval } from "@/lib/workflow";
import type { Invitation, Stage } from "@/lib/types";

type PendingMove = {
  id: number;
  card_id: number;
  card_title: string;
  project_id: number;
  project_name: string;
  from_stage: Stage;
  to_stage: Stage;
  summary: string;
  requested_by: number;
  requested_by_name: string;
  created_at: string;
  attachments: { label: string; url: string }[];
};

type ApprovalCard = {
  id: number;
  title: string;
  project_name: string;
  stage: Stage;
  category: string | null;
  card_type: string | null;
  deadline: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  comment_count: number;
};

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  // Cards stuck at Idea stage for more than 3 days — untriaged.
  const stuckIdeas = all<ApprovalCard>(
    `SELECT c.id, c.title, p.name AS project_name, c.stage, c.category, c.card_type, c.deadline,
            c.assignee_id, a.display_name AS assignee_name, u.display_name AS created_by_name,
            c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM comments cm WHERE cm.card_id = c.id) AS comment_count
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = c.created_by
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE c.stage = 'idea'
       AND p.archived = 0
       AND date(c.created_at) <= date('now', '-3 days')
     ORDER BY c.created_at ASC
     LIMIT 50`
  );

  // Cards overdue (deadline passed, not yet shipped).
  const overdueCards = all<ApprovalCard>(
    `SELECT c.id, c.title, p.name AS project_name, c.stage, c.category, c.card_type, c.deadline,
            c.assignee_id, a.display_name AS assignee_name, u.display_name AS created_by_name,
            c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM comments cm WHERE cm.card_id = c.id) AS comment_count
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = c.created_by
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE c.deadline IS NOT NULL
       AND c.stage <> 'ship'
       AND p.archived = 0
       AND date(c.deadline) < date('now')
     ORDER BY date(c.deadline) ASC
     LIMIT 50`
  );

  // Cards due in next 7 days (warning).
  const dueSoon = all<ApprovalCard>(
    `SELECT c.id, c.title, p.name AS project_name, c.stage, c.category, c.card_type, c.deadline,
            c.assignee_id, a.display_name AS assignee_name, u.display_name AS created_by_name,
            c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM comments cm WHERE cm.card_id = c.id) AS comment_count
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = c.created_by
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE c.deadline IS NOT NULL
       AND c.stage <> 'ship'
       AND p.archived = 0
       AND date(c.deadline) >= date('now')
       AND date(c.deadline) <= date('now', '+7 days')
     ORDER BY date(c.deadline) ASC
     LIMIT 50`
  );

  // Pending invitations (admin only).
  let pendingInvites: (Invitation & { invited_by_name: string })[] = [];
  if (user.role === "admin") {
    pendingInvites = all<Invitation & { invited_by_name: string }>(
      `SELECT i.*, u.display_name AS invited_by_name
       FROM invitations i JOIN users u ON u.id = i.invited_by
       WHERE i.used = 0 AND datetime(i.expires_at) > datetime('now')
       ORDER BY i.created_at DESC
       LIMIT 50`
    );
  }

  // Form submissions awaiting project assignment (admin only).
  // These are cards that came in via a public form with a "suggest new project"
  // selection — they need an admin to either create the new project or move
  // the card to an existing one.
  let pendingSubmissions: Array<{
    id: number; title: string; imagined_outcome: string | null;
    suggested_project_name: string; external_submitter_name: string | null;
    external_submitter_email: string | null; created_at: string;
  }> = [];
  if (user.role === "admin") {
    pendingSubmissions = all(
      `SELECT id, title, imagined_outcome, suggested_project_name,
              external_submitter_name, external_submitter_email, created_at
       FROM cards
       WHERE suggested_project_name IS NOT NULL
         AND stage = 'idea'
       ORDER BY created_at DESC
       LIMIT 50`
    );
  }

  // Pending stage-move requests the current user can approve.
  // Fetch all pending moves, then filter via the workflow check.
  const allPending = all<{
    id: number; card_id: number; from_stage: Stage; to_stage: Stage;
    summary: string; requested_by: number; created_at: string;
    card_title: string; project_id: number; project_name: string;
    requested_by_name: string;
  }>(
    `SELECT m.id, m.card_id, m.from_stage, m.to_stage, m.summary, m.requested_by, m.created_at,
            c.title AS card_title, c.project_id, p.name AS project_name,
            u.display_name AS requested_by_name
     FROM stage_moves m
     JOIN cards c ON c.id = m.card_id
     JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = m.requested_by
     WHERE m.status = 'pending'
       AND p.archived = 0
     ORDER BY m.created_at ASC`
  );

  const pendingMoves: PendingMove[] = [];
  for (const m of allPending) {
    const check = checkStageApproval(user.id, user.role, m.project_id, m.from_stage, m.to_stage);
    if (!check.allowed) continue;
    const atts = all<{ label: string; url: string }>(
      `SELECT label, url FROM stage_move_attachments WHERE move_id = ? ORDER BY id ASC`,
      [m.id]
    );
    pendingMoves.push({
      id: m.id,
      card_id: m.card_id,
      card_title: m.card_title,
      project_id: m.project_id,
      project_name: m.project_name,
      from_stage: m.from_stage,
      to_stage: m.to_stage,
      summary: m.summary,
      requested_by: m.requested_by,
      requested_by_name: m.requested_by_name,
      created_at: m.created_at,
      attachments: atts,
    });
  }

  return NextResponse.json({
    ok: true,
    stuckIdeas,
    overdueCards,
    dueSoon,
    pendingInvites,
    pendingSubmissions,
    pendingMoves,
  });
}
