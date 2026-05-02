import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Invitation, Stage } from "@/lib/types";

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

  return NextResponse.json({
    ok: true,
    stuckIdeas,
    overdueCards,
    dueSoon,
    pendingInvites,
  });
}
