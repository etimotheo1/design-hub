import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, run } from "@/lib/db";
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

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });

  try {
    const result = run(
      `INSERT INTO projects (name, description) VALUES (?, ?)`,
      [name.trim(), description?.trim() || null]
    );
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "A project with that name already exists." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Could not create project." }, { status: 500 });
  }
}
