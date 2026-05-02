import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import type { User } from "@/lib/types";

// Lightweight user list for assignee dropdowns + admin Users page.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const rows = all<User>(
    `SELECT id, username, email, display_name, role, must_change_password, created_at FROM users ORDER BY display_name ASC`
  );
  return NextResponse.json({ ok: true, users: rows });
}

// Admin-only: remove a user (cascades through stage_history etc. via FK).
export async function DELETE(req: NextRequest) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  if (id === me.id) return NextResponse.json({ ok: false, error: "Cannot delete yourself." }, { status: 400 });

  // Sessions cascade by FK. Cards stay (assignee_id is nullable; created_by stays as orphan ID).
  run(`UPDATE cards SET assignee_id = NULL WHERE assignee_id = ?`, [id]);
  run(`DELETE FROM users WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
