import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { isAIConfigured, suggestTaxonomy } from "@/lib/ai";
import type { TaxonomyItem } from "@/lib/types";

// POST /api/ai/suggest  — body: { title, imagined? }
// Returns { ok, available, suggestion? }. If AI isn't configured, available=false.
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  if (!isAIConfigured()) {
    return NextResponse.json({ ok: true, available: false });
  }

  const body = await req.json();
  const title = String(body.title || "").trim();
  const imagined = body.imagined ? String(body.imagined).trim() : undefined;
  if (!title) return NextResponse.json({ ok: false, error: "Title required." }, { status: 400 });

  const cats = all<TaxonomyItem>(`SELECT * FROM categories WHERE archived = 0 ORDER BY sort_order, name`);
  const types = all<TaxonomyItem>(`SELECT * FROM card_types WHERE archived = 0 ORDER BY sort_order, name`);

  const result = await suggestTaxonomy({
    title,
    imagined,
    categories: cats.map((c) => c.name),
    cardTypes: types.map((t) => t.name),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: true, available: true, suggestion: null, error: result.error });
  }
  return NextResponse.json({ ok: true, available: true, suggestion: result.suggestion });
}
