import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import type { EmploymentType, WorkMode } from "@/lib/types";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/types";

// Read current user's full profile.
export async function GET() {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const profile = get(
    `SELECT id, username, email, display_name, role, phone, title, bio,
            employment_type, work_mode, profile_picture_url, access_policy, created_at
     FROM users WHERE id = ?`,
    [me.id]
  );
  if (!profile) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, profile });
}

// Update own profile fields.
export async function PATCH(req: NextRequest) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const body = await req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  // String fields user can edit on themselves.
  for (const k of ["display_name", "phone", "title", "bio", "profile_picture_url", "email"] as const) {
    if (typeof body[k] === "string" || body[k] === null) {
      fields.push(`${k} = ?`);
      values.push(body[k] ? String(body[k]).trim() : null);
    }
  }
  if (typeof body.employment_type === "string" || body.employment_type === null) {
    const v = EMPLOYMENT_TYPES.includes(body.employment_type as EmploymentType) ? body.employment_type : null;
    fields.push("employment_type = ?"); values.push(v);
  }
  if (typeof body.work_mode === "string" || body.work_mode === null) {
    const v = WORK_MODES.includes(body.work_mode as WorkMode) ? body.work_mode : null;
    fields.push("work_mode = ?"); values.push(v);
  }
  // role and access_policy are NOT editable here — admins set those on /settings/access.

  if (fields.length === 0) return NextResponse.json({ ok: true });

  values.push(me.id);
  run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
  return NextResponse.json({ ok: true });
}
