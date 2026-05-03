import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import { isValidColor } from "@/lib/colors";
import type { Project } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  // ?include_hidden=1 returns archived/hidden projects too — for the /projects
  // admin page so admins can unhide them. All other views (Bucketlist, Board,
  // Pipeline, Dashboard, Approvals) call without it and only get visible ones.
  const includeHidden = req.nextUrl.searchParams.get("include_hidden") === "1";
  const sql = includeHidden
    ? `SELECT * FROM projects ORDER BY archived ASC, name ASC`
    : `SELECT * FROM projects WHERE archived = 0 ORDER BY name ASC`;
  const rows = all<Project>(sql);
  return NextResponse.json({ ok: true, projects: rows });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const { name, description, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
  const safeColor = isValidColor(color) ? color : null;

  try {
    const result = run(
      `INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`,
      [name.trim(), description?.trim() || null, safeColor]
    );
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "A project with that name already exists." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Could not create project." }, { status: 500 });
  }
}
