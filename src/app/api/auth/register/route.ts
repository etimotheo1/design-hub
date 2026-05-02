import { NextResponse } from "next/server";

// Open self-registration is intentionally disabled.
// Admins create accounts via /admin/users (POST /api/users/invite).
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Open registration is disabled. Ask your Design Hub admin to invite you.",
    },
    { status: 403 }
  );
}
