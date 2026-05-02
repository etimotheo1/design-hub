import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import type { User } from "@/lib/types";

// Lightweight user list for assignee dropdowns. Excludes password hash.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const rows = all<Omit<User, "created_at"> & { created_at: string }>(
    `SELECT id, username, display_name, role, created_at FROM users ORDER BY display_name ASC`
  );
  return NextResponse.json({ ok: true, users: rows });
}
