import { NextRequest, NextResponse } from "next/server";
import { registerUser, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password, displayName, role } = await req.json();
  const safeRole = role === "non_tech" ? "non_tech" : "tech";
  const result = await registerUser(username, password, displayName, safeRole);
  if (!result.ok || !result.user) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const token = createSession(result.user.id);
  setSessionCookie(token);
  return NextResponse.json({ ok: true, user: result.user });
}
