import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, seedCategoryDefaults, seedCardTypeDefaults, seedProjectDefaults } from "@/lib/db";

// Admin-only: explicitly restore default categories / types / projects.
// Uses INSERT OR IGNORE — existing rows (and the user's own additions) are
// never touched; only missing defaults get added back.
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const { what } = await req.json();
  const db = getDb();

  if (what === "categories" || what === "all") seedCategoryDefaults(db);
  if (what === "card_types" || what === "all") seedCardTypeDefaults(db);
  if (what === "projects"   || what === "all") seedProjectDefaults(db);

  return NextResponse.json({ ok: true });
}
