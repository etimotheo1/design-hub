import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAIConfigured, expandIdea, type ExpandStyle } from "@/lib/ai";

const VALID_STYLES: ExpandStyle[] = ["default", "concise", "detailed", "customer", "technical", "strategic"];

// POST /api/ai/expand  — body: { title, imagined?, project?, style? }
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  if (!isAIConfigured()) {
    return NextResponse.json({ ok: true, available: false });
  }

  const body = await req.json();
  const title = String(body.title || "").trim();
  const imagined = body.imagined ? String(body.imagined).trim() : undefined;
  const project = body.project ? String(body.project).trim() : undefined;
  const style: ExpandStyle = VALID_STYLES.includes(body.style) ? body.style : "default";
  if (!title) return NextResponse.json({ ok: false, error: "Title required." }, { status: 400 });

  const result = await expandIdea({ title, imagined, project, style });
  if (!result.ok) {
    return NextResponse.json({ ok: true, available: true, result: null, error: result.error });
  }
  return NextResponse.json({ ok: true, available: true, result: result.result });
}
