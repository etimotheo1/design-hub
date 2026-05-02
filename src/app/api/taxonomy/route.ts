import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import type { TaxonomyItem } from "@/lib/types";

// Both lists in one call — used by card forms and admin page.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const categories = all<TaxonomyItem>(`SELECT * FROM categories ORDER BY archived ASC, sort_order ASC, name ASC`);
  const cardTypes  = all<TaxonomyItem>(`SELECT * FROM card_types  ORDER BY archived ASC, sort_order ASC, name ASC`);

  return NextResponse.json({ ok: true, categories, cardTypes });
}
