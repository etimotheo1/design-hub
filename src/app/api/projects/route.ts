import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
import { isValidColor } from "@/lib/colors";
import type { Project } from "@/lib/types";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const rows = all<Project>(
    `SELECT * FROM projects WHERE archived = 0 ORDER BY name ASC`
  );
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
