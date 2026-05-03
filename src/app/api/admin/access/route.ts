import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import type { AccessPolicy, EmploymentType, WorkMode } from "@/lib/types";

// Admin-only. Returns all users with everything needed for the access page,
// plus all projects with their visibility, plus a flat list of memberships.
export async function GET() {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const users = all(`
    SELECT id, username, email, display_name, role, access_policy, employment_type, work_mode, title
    FROM users ORDER BY display_name
  `);
  const projects = all(`SELECT id, name, color, visibility, archived, created_by FROM projects ORDER BY name`);
  const memberships = all(`
    SELECT project_id, user_id, role FROM project_members
  `);
  return NextResponse.json({ ok: true, users, projects, memberships });
}

// Update a user's role / access_policy / employment / work_mode (admin only).
export async function PATCH(req: NextRequest) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const body = await req.json();
  const userId = Number(body.user_id);
  if (!userId) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.role === "string" && ["admin", "tech", "non_tech"].includes(body.role)) {
    fields.push("role = ?"); values.push(body.role);
  }
  if (typeof body.access_policy === "string" && ["standard", "restricted"].includes(body.access_policy)) {
    fields.push("access_policy = ?"); values.push(body.access_policy as AccessPolicy);
  }
  if (typeof body.employment_type === "string" || body.employment_type === null) {
    fields.push("employment_type = ?"); values.push(body.employment_type as EmploymentType | null);
  }
  if (typeof body.work_mode === "string" || body.work_mode === null) {
    fields.push("work_mode = ?"); values.push(body.work_mode as WorkMode | null);
  }
  if (typeof body.title === "string" || body.title === null) {
    fields.push("title = ?"); values.push(body.title?.trim() || null);
  }

  if (fields.length === 0) return NextResponse.json({ ok: true });
  values.push(userId);
  run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
  return NextResponse.json({ ok: true });
}
