import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { isValidColor } from "@/lib/colors";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.name === "string") {
    fields.push("name = ?");
    values.push(body.name.trim());
  }
  if (typeof body.description === "string" || body.description === null) {
    fields.push("description = ?");
    values.push(body.description?.trim() || null);
  }
  if (body.color === null || isValidColor(body.color)) {
    fields.push("color = ?");
    values.push(body.color || null);
  }
  if (typeof body.archived === "number") {
    fields.push("archived = ?");
    values.push(body.archived);
  }
  if (fields.length === 0) return NextResponse.json({ ok: true });

  values.push(id);
  run(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admin can delete projects." }, { status: 403 });
  }
  run(`DELETE FROM projects WHERE id = ?`, [Number(params.id)]);
  return NextResponse.json({ ok: true });
}
