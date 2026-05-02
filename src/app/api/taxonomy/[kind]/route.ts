import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { isValidColor } from "@/lib/colors";

// /api/taxonomy/categories  or  /api/taxonomy/card_types
function tableFor(kind: string): string | null {
  if (kind === "categories") return "categories";
  if (kind === "card_types") return "card_types";
  return null;
}

// card_types table doesn't have a `color` column — color only applies to categories.
function supportsColor(table: string): boolean {
  return table === "categories";
}

export async function POST(req: NextRequest, { params }: { params: { kind: string } }) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const table = tableFor(params.kind);
  if (!table) return NextResponse.json({ ok: false, error: "unknown kind" }, { status: 400 });

  const { name, color } = await req.json();
  const cleanName = String(name || "").trim();
  if (!cleanName) return NextResponse.json({ ok: false, error: "Name required." }, { status: 400 });
  const safeColor = isValidColor(color) ? color : null;

  try {
    let result;
    if (supportsColor(table)) {
      result = run(`INSERT INTO ${table} (name, color) VALUES (?, ?)`, [cleanName, safeColor]);
    } else {
      result = run(`INSERT INTO ${table} (name) VALUES (?)`, [cleanName]);
    }
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "That name already exists." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Could not create." }, { status: 500 });
  }
}
