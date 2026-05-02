import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import type { Invitation } from "@/lib/types";

// Public: look up an invitation by token to render the accept page.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const inv = get<Invitation>(
    `SELECT * FROM invitations WHERE token = ?`,
    [params.token]
  );
  if (!inv) return NextResponse.json({ ok: false, error: "Invitation not found." }, { status: 404 });
  if (inv.used) return NextResponse.json({ ok: false, error: "This invitation has already been used." }, { status: 410 });
  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "This invitation has expired. Ask for a new one." }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      email: inv.email,
      display_name: inv.display_name,
      role: inv.role,
      expires_at: inv.expires_at,
    },
  });
}

// Admin: revoke an invitation.
export async function DELETE(_req: NextRequest, { params }: { params: { token: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  run(`DELETE FROM invitations WHERE token = ?`, [params.token]);
  return NextResponse.json({ ok: true });
}
