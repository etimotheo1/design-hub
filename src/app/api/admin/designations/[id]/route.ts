import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const id = Number(params.id);
  const body = await req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.name === "string" && body.name.trim()) {
    fields.push("name = ?"); values.push(body.name.trim());
  }
  if ("description" in body) {
    fields.push("description = ?");
    values.push(body.description ? String(body.description).trim() : null);
  }
  if (typeof body.archived === "number") {
    fields.push("archived = ?"); values.push(body.archived ? 1 : 0);
  }
  if (typeof body.sort_order === "number") {
    fields.push("sort_order = ?"); values.push(body.sort_order);
  }
  if (fields.length === 0) return NextResponse.json({ ok: true });
  values.push(id);
  try {
    run(`UPDATE designations SET ${fields.join(", ")} WHERE id = ?`, values);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) return NextResponse.json({ ok: false, error: "That name is already taken." }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Could not update." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  // Clear designation_id on any users who had it.
  run(`UPDATE users SET designation_id = NULL WHERE designation_id = ?`, [Number(params.id)]);
  run(`DELETE FROM designations WHERE id = ?`, [Number(params.id)]);
  return NextResponse.json({ ok: true });
}
