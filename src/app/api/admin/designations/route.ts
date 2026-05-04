import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import type { Designation } from "@/lib/types";

export async function GET() {
  const me = getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const rows = all<Designation>(
    `SELECT * FROM designations ORDER BY archived ASC, sort_order ASC, name ASC`
  );
  return NextResponse.json({ ok: true, designations: rows });
}

export async function POST(req: NextRequest) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });

  try {
    const result = run(
      `INSERT INTO designations (name, description) VALUES (?, ?)`,
      [name, body.description ? String(body.description).trim() : null]
    );
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) return NextResponse.json({ ok: false, error: "That name is already taken." }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Could not create." }, { status: 500 });
  }
}
