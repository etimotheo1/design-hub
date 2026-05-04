import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Stage } from "@/lib/types";

// /api/weekly?week_start=YYYY-MM-DD&scope=mine|team|all&project_id=N
//
// Returns deliverables for the requested week:
//   - dueThisWeek: cards with deadline within [Mon..Sun]
//   - shippedThisWeek: cards that entered 'ship' between Mon..Sun
//   - leaderboard: top assignees by # active deliverables this week
//   - throughput: last 8 weeks of "cards shipped per week"
export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const weekStart = params.get("week_start") || isoMonday(new Date());
  const weekEnd = addDaysIso(weekStart, 6);
  const scope = (params.get("scope") || "all") as "mine" | "team" | "all";
  const projectFilter = params.get("project_id") ? Number(params.get("project_id")) : null;

  // Build the WHERE clause for project access (mirrors /api/projects logic)
  // — admin sees all, otherwise public + memberships.
  const visibleProjectIds = await getVisibleProjectIds(user.id, user.role);
  if (visibleProjectIds.length === 0) {
    return NextResponse.json({
      ok: true,
      week_start: weekStart, week_end: weekEnd,
      dueThisWeek: [], shippedThisWeek: [], leaderboard: [], throughput: [],
    });
  }
  const projectClause = projectFilter
    ? (visibleProjectIds.includes(projectFilter) ? `c.project_id = ${projectFilter}` : `c.project_id = -1`)
    : `c.project_id IN (${visibleProjectIds.join(",")})`;

  const scopeClause =
    scope === "mine" ? `(c.assignee_id = ${user.id} OR c.created_by = ${user.id})` :
    "1=1"; // 'team' and 'all' are equivalent for v1; can split later.

  // Cards due this week (deadline on any day Mon..Sun, not yet shipped).
  const dueThisWeek = all<DueCardRow>(
    `SELECT c.id, c.title, c.stage, c.deadline, c.project_id,
            p.name AS project_name, p.color AS project_color,
            a.id AS assignee_id, a.display_name AS assignee_name
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE p.archived = 0
       AND ${projectClause}
       AND ${scopeClause}
       AND c.deadline IS NOT NULL
       AND c.stage <> 'ship'
       AND date(substr(c.deadline, 1, 10)) BETWEEN date(?) AND date(?)
     ORDER BY date(substr(c.deadline, 1, 10)) ASC, c.id ASC`,
    [weekStart, weekEnd]
  );

  // Cards that entered 'ship' this week.
  const shippedThisWeek = all<DueCardRow>(
    `SELECT c.id, c.title, c.stage, c.deadline, c.project_id,
            p.name AS project_name, p.color AS project_color,
            a.id AS assignee_id, a.display_name AS assignee_name,
            (SELECT MAX(entered_at) FROM stage_history sh WHERE sh.card_id = c.id AND sh.stage = 'ship') AS shipped_at
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE p.archived = 0
       AND ${projectClause}
       AND ${scopeClause}
       AND c.stage = 'ship'
       AND EXISTS (
         SELECT 1 FROM stage_history sh
         WHERE sh.card_id = c.id AND sh.stage = 'ship'
           AND date(sh.entered_at) BETWEEN date(?) AND date(?)
       )
     ORDER BY shipped_at DESC`,
    [weekStart, weekEnd]
  );

  // Leaderboard: assignees ranked by total active deliverables this week.
  // Counts both due-this-week and shipped-this-week, attributed to assignee.
  const leaderboard = all<{ user_id: number; display_name: string; due_count: number; shipped_count: number }>(
    `SELECT u.id AS user_id, u.display_name,
            SUM(CASE WHEN c.stage <> 'ship' AND c.deadline IS NOT NULL
                          AND date(substr(c.deadline, 1, 10)) BETWEEN date(?) AND date(?)
                     THEN 1 ELSE 0 END) AS due_count,
            SUM(CASE WHEN c.stage = 'ship' AND EXISTS (
                          SELECT 1 FROM stage_history sh
                          WHERE sh.card_id = c.id AND sh.stage = 'ship'
                            AND date(sh.entered_at) BETWEEN date(?) AND date(?))
                     THEN 1 ELSE 0 END) AS shipped_count
     FROM cards c
     JOIN projects p ON p.id = c.project_id
     LEFT JOIN users u ON u.id = c.assignee_id
     WHERE p.archived = 0
       AND ${projectClause}
       AND u.id IS NOT NULL
     GROUP BY u.id
     HAVING (due_count + shipped_count) > 0
     ORDER BY (due_count + shipped_count) DESC
     LIMIT 10`,
    [weekStart, weekEnd, weekStart, weekEnd]
  );

  // Throughput: cards shipped per ISO week, last 8 weeks ending at this week.
  const throughput: Array<{ week_start: string; shipped: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const ws = addDaysIso(weekStart, -7 * i);
    const we = addDaysIso(ws, 6);
    const row = all<{ c: number }>(
      `SELECT COUNT(DISTINCT c.id) AS c
       FROM cards c
       JOIN projects p ON p.id = c.project_id
       JOIN stage_history sh ON sh.card_id = c.id AND sh.stage = 'ship'
       WHERE p.archived = 0
         AND ${projectClause}
         AND date(sh.entered_at) BETWEEN date(?) AND date(?)`,
      [ws, we]
    );
    throughput.push({ week_start: ws, shipped: row[0]?.c ?? 0 });
  }

  return NextResponse.json({
    ok: true,
    week_start: weekStart,
    week_end: weekEnd,
    dueThisWeek,
    shippedThisWeek,
    leaderboard,
    throughput,
  });
}

interface DueCardRow {
  id: number;
  title: string;
  stage: Stage;
  deadline: string;
  project_id: number;
  project_name: string;
  project_color: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  shipped_at?: string | null;
}

// ---------- helpers ----------

async function getVisibleProjectIds(userId: number, role: string): Promise<number[]> {
  if (role === "admin") {
    return all<{ id: number }>(`SELECT id FROM projects WHERE archived = 0`).map((r) => r.id);
  }
  // Match the rules in /api/projects (standard sees public + memberships).
  const policy = all<{ access_policy: string }>(`SELECT access_policy FROM users WHERE id = ?`, [userId])[0]?.access_policy ?? "standard";
  const sql = `
    SELECT p.id FROM projects p
    WHERE p.archived = 0
      AND (
        p.created_by = ${userId}
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ${userId})
        ${policy === "standard" ? "OR p.visibility = 'public'" : ""}
      )
  `;
  return all<{ id: number }>(sql).map((r) => r.id);
}

// ISO Monday of the given Date, returned as YYYY-MM-DD (local).
function isoMonday(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 if Monday … 6 if Sunday
  x.setDate(x.getDate() - day);
  return ymd(x);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n: number) { return String(n).padStart(2, "0"); }
