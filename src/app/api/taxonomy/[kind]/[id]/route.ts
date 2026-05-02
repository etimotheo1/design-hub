import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";

function config(kind: string): { table: string; cardField: string } | null {
  if (kind === "categories") return { table: "categories", cardField: "category" };
  if (kind === "card_types") return { table: "card_types", cardField: "card_type" };
  return null;
}

// Rename, archive/unarchive, or reorder.
export async function PATCH(req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const cfg = config(params.kind);
  if (!cfg) return NextResponse.json({ ok: false, error: "unknown kind" }, { status: 400 });

  const id = Number(params.id);
  const body = await req.json();

  // Renames cascade to existing cards' denormalised name.
  if (typeof body.name === "string" && body.name.trim()) {
    const existing = get<{ name: string }>(`SELECT name FROM ${cfg.table} WHERE id = ?`, [id]);
    if (existing && existing.name !== body.name.trim()) {
      try {
        run(`UPDATE ${cfg.table} SET name = ? WHERE id = ?`, [body.name.trim(), id]);
        run(`UPDATE cards SET ${cfg.cardField} = ? WHERE ${cfg.cardField} = ?`, [body.name.trim(), existing.name]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE")) {
          return NextResponse.json({ ok: false, error: "That name already exists." }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: "Could not rename." }, { status: 500 });
      }
    }
  }
  if (typeof body.archived === "number") {
    run(`UPDATE ${cfg.table} SET archived = ? WHERE id = ?`, [body.archived ? 1 : 0, id]);
  }
  if (typeof body.sort_order === "number") {
    run(`UPDATE ${cfg.table} SET sort_order = ? WHERE id = ?`, [body.sort_order, id]);
  }

  return NextResponse.json({ ok: true });
}

// Delete and unset on existing cards.
export async function DELETE(_req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const cfg = config(params.kind);
  if (!cfg) return NextResponse.json({ ok: false, error: "unknown kind" }, { status: 400 });

  const id = Number(params.id);
  const existing = get<{ name: string }>(`SELECT name FROM ${cfg.table} WHERE id = ?`, [id]);
  if (existing) {
    run(`UPDATE cards SET ${cfg.cardField} = NULL WHERE ${cfg.cardField} = ?`, [existing.name]);
  }
  run(`DELETE FROM ${cfg.table} WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
