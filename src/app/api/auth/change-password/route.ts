import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, changeUserPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { current_password, new_password } = await req.json();
  const result = await changeUserPassword(
    user.id,
    String(current_password || ""),
    String(new_password || "")
  );
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true });
}
