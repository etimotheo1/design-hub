import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import type { ShareableForm } from "@/lib/types";

export async function GET() {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const forms = all<ShareableForm & { submission_count: number; project_name: string | null }>(
    `SELECT f.*,
            (SELECT COUNT(*) FROM form_submissions s WHERE s.form_id = f.id) AS submission_count,
            p.name AS project_name
     FROM forms f
     LEFT JOIN projects p ON p.id = f.project_id
     ORDER BY f.created_at DESC`
  );
  return NextResponse.json({ ok: true, forms });
}

export async function POST(req: NextRequest) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });

  const projectId = body.project_id ? Number(body.project_id) : null;
  const allowSuggest = body.allow_suggest_new_project === false ? 0 : 1;
  const defaultCategory = body.default_category ? String(body.default_category).trim() : null;
  const thankYou = body.thank_you_message ? String(body.thank_you_message).trim() : null;
  const submitLabel = body.submit_button_label ? String(body.submit_button_label).trim() : null;
  const expiresAt = body.expires_at ? String(body.expires_at) : null;

  const token = crypto.randomBytes(8).toString("hex"); // 16-char token
  const result = run(
    `INSERT INTO forms (token, name, project_id, allow_suggest_new_project, default_category,
                        thank_you_message, submit_button_label, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [token, name, projectId, allowSuggest, defaultCategory, thankYou, submitLabel, me.id, expiresAt]
  );
  return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid), token });
}
