import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";

// Single endpoint that powers the Dashboard page. One round-trip for everything.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  // 1. Per-stage counts (cards currently sitting in each stage).
  const stageCounts = all<{ stage: Stage; count: number }>(
    `SELECT stage, COUNT(*) AS count
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     WHERE p.archived = 0
     GROUP BY stage`
  );

  // 2. Average time-in-stage (across COMPLETED transitions only).
  // For each stage entry that was followed by a later entry, the time spent
  // is the diff between this entry and the next entry's timestamp.
  const avgTimeInStage = all<{ stage: Stage; avg_seconds: number; samples: number }>(
    `WITH ordered AS (
       SELECT card_id, stage, entered_at,
              LEAD(entered_at) OVER (PARTITION BY card_id ORDER BY entered_at) AS next_at
       FROM stage_history
     )
     SELECT stage,
            AVG((julianday(next_at) - julianday(entered_at)) * 86400.0) AS avg_seconds,
            COUNT(*) AS samples
     FROM ordered
     WHERE next_at IS NOT NULL
     GROUP BY stage`
  );

  // 3. Cards with deadlines: overdue + at-risk (within 7 days).
  const deadlineCards = all<{
    id: number; title: string; deadline: string; stage: Stage;
    project_name: string; assignee_name: string | null;
  }>(
    `SELECT c.id, c.title, c.deadline, c.stage, p.name AS project_name,
            a.display_name AS assignee_name
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE c.deadline IS NOT NULL
       AND c.stage <> 'ship'
       AND p.archived = 0
       AND date(c.deadline) <= date('now', '+7 days')
     ORDER BY date(c.deadline) ASC`
  );

  // 4. Breakdown by category and by type.
  const byCategory = all<{ category: string | null; count: number }>(
    `SELECT category, COUNT(*) AS count
     FROM cards c JOIN projects p ON p.id = c.project_id
     WHERE p.archived = 0
     GROUP BY category`
  );
  const byType = all<{ card_type: string | null; count: number }>(
    `SELECT card_type, COUNT(*) AS count
     FROM cards c JOIN projects p ON p.id = c.project_id
     WHERE p.archived = 0
     GROUP BY card_type`
  );

  // Total non-archived cards for percentages.
  const total = stageCounts.reduce((sum, r) => sum + r.count, 0);

  // Normalise: ensure every stage appears even with 0 cards.
  const counts: Record<Stage, number> = { idea: 0, design: 0, build: 0, test: 0, ship: 0 };
  for (const r of stageCounts) counts[r.stage] = r.count;

  const avgTimes: Record<Stage, { avg_seconds: number; samples: number }> = {
    idea: { avg_seconds: 0, samples: 0 },
    design: { avg_seconds: 0, samples: 0 },
    build: { avg_seconds: 0, samples: 0 },
    test: { avg_seconds: 0, samples: 0 },
    ship: { avg_seconds: 0, samples: 0 },
  };
  for (const r of avgTimeInStage) {
    if (STAGES.includes(r.stage)) avgTimes[r.stage] = { avg_seconds: r.avg_seconds, samples: r.samples };
  }

  return NextResponse.json({
    ok: true,
    total,
    counts,
    avgTimes,
    deadlineCards,
    byCategory,
    byType,
  });
}
