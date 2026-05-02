import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const cardId = Number(params.id);
  const { label, url } = await req.json();
  if (!label?.trim() || !url?.trim()) {
    return NextResponse.json({ ok: false, error: "Label and URL are required." }, { status: 400 });
  }

  // Light validation — accept http(s), file paths, GitHub links, or plain identifiers.
  const trimmedUrl = String(url).trim();

  const result = run(
    `INSERT INTO attachments (card_id, label, url, added_by) VALUES (?, ?, ?, ?)`,
    [cardId, String(label).trim(), trimmedUrl, user.id]
  );
  return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
}

export async function DELETE(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("attachment_id"));
  if (!id) return NextResponse.json({ ok: false, error: "attachment_id required" }, { status: 400 });
  run(`DELETE FROM attachments WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
