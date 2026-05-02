import { NextRequest, NextResponse } from "next/server";
import { loginUser, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const result = await loginUser(username, password);
  if (!result.ok || !result.user) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }
  const token = createSession(result.user.id);
  setSessionCookie(token);
  return NextResponse.json({ ok: true, user: result.user });
}
