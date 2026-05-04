import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { isAIConfigured, suggestDesignations } from "@/lib/ai";
import type { Designation } from "@/lib/types";

// POST /api/ai/suggest-designations
// Body: { orgContext?: string }
// Returns { ok, available, designations? }
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });

  if (!isAIConfigured()) {
    return NextResponse.json({ ok: true, available: false });
  }

  const body = await req.json().catch(() => ({}));
  const orgContext = body.orgContext ? String(body.orgContext).trim() : undefined;

  const existing = all<Designation>(`SELECT name FROM designations WHERE archived = 0`);

  const result = await suggestDesignations({
    existing: existing.map((d) => d.name),
    orgContext,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: true, available: true, designations: [], error: result.error });
  }
  return NextResponse.json({ ok: true, available: true, designations: result.result?.designations ?? [] });
}
