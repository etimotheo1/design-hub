import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import type { Invitation, User } from "@/lib/types";

const INVITATION_DAYS = 14;

// List pending invitations (admin only).
export async function GET() {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const rows = all<Invitation & { invited_by_name: string }>(
    `SELECT i.*, u.display_name AS invited_by_name
     FROM invitations i JOIN users u ON u.id = i.invited_by
     ORDER BY i.created_at DESC`
  );
  return NextResponse.json({ ok: true, invitations: rows });
}

// Create an invitation (admin only). Returns the shareable URL.
export async function POST(req: NextRequest) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const { email, display_name, role } = await req.json();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(display_name || "").trim();
  const cleanRole: User["role"] =
    role === "admin" ? "admin" :
    role === "non_tech" ? "non_tech" : "tech";

  if (!cleanEmail || !/.+@.+\..+/.test(cleanEmail)) {
    return NextResponse.json({ ok: false, error: "Valid email required." }, { status: 400 });
  }
  if (!cleanName) {
    return NextResponse.json({ ok: false, error: "Display name required." }, { status: 400 });
  }

  // If a user with that email already exists, refuse — admin should remove first.
  const existing = get(`SELECT 1 FROM users WHERE email = ?`, [cleanEmail]);
  if (existing) {
    return NextResponse.json({ ok: false, error: "A user with that email already exists." }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  run(
    `INSERT INTO invitations (token, email, display_name, role, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [token, cleanEmail, cleanName, cleanRole, me.id, expiresAt]
  );

  return NextResponse.json({
    ok: true,
    invitation: {
      token,
      email: cleanEmail,
      display_name: cleanName,
      role: cleanRole,
      expires_at: expiresAt,
    },
  });
}
