import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const cardId = Number(params.id);
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ ok: false, error: "Comment cannot be empty." }, { status: 400 });

  const result = run(
    `INSERT INTO comments (card_id, author_id, body) VALUES (?, ?, ?)`,
    [cardId, user.id, body.trim()]
  );
  return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
}
