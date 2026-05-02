import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import type { Invitation } from "@/lib/types";

// Public: invitee submits chosen password. We create the user account, mark
// the invitation used, sign them in, and return ok.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const inv = get<Invitation>(
    `SELECT * FROM invitations WHERE token = ?`,
    [params.token]
  );
  if (!inv) return NextResponse.json({ ok: false, error: "Invitation not found." }, { status: 404 });
  if (inv.used) return NextResponse.json({ ok: false, error: "Already used." }, { status: 410 });
  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Expired." }, { status: 410 });
  }

  const { password } = await req.json();
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // Username derived from email's local part (sanitised). If taken, append digits.
  let baseUsername = inv.email.split("@")[0].replace(/[^a-z0-9._-]/g, "").slice(0, 30) || "user";
  let username = baseUsername;
  let n = 1;
  while (get(`SELECT 1 FROM users WHERE username = ?`, [username])) {
    username = `${baseUsername}${++n}`;
    if (n > 99) {
      return NextResponse.json({ ok: false, error: "Could not generate a unique username." }, { status: 500 });
    }
  }

  const hash = await hashPassword(password);
  const result = run(
    `INSERT INTO users (username, password_hash, display_name, role, email, must_change_password)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [username, hash, inv.display_name, inv.role, inv.email]
  );
  const userId = Number(result.lastInsertRowid);

  run(
    `UPDATE invitations SET used = 1, used_at = datetime('now') WHERE token = ?`,
    [params.token]
  );

  const sessionToken = createSession(userId);
  setSessionCookie(sessionToken);

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      username,
      display_name: inv.display_name,
      role: inv.role,
      must_change_password: 0,
    },
  });
}
