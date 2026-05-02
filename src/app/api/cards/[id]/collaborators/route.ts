import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";

// Add a collaborator (admin or assignee or creator can add).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const cardId = Number(params.id);
  const { user_id } = await req.json();
  const userId = Number(user_id);
  if (!userId) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  // Confirm user exists.
  const u = get(`SELECT 1 FROM users WHERE id = ?`, [userId]);
  if (!u) return NextResponse.json({ ok: false, error: "User not found" }, { status: 400 });

  try {
    run(
      `INSERT INTO card_collaborators (card_id, user_id, added_by) VALUES (?, ?, ?)`,
      [cardId, userId, me.id]
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("PRIMARY KEY")) {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Remove a collaborator.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  if (!userId) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });
  run(`DELETE FROM card_collaborators WHERE card_id = ? AND user_id = ?`, [Number(params.id), userId]);
  return NextResponse.json({ ok: true });
}
