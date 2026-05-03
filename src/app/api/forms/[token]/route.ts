import { NextRequest, NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import type { Project, ShareableForm } from "@/lib/types";

// Public endpoint — fetches a form's display config + the public projects the
// submitter can pick from (only used if form.project_id is null).
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const form = get<ShareableForm & { project_name: string | null }>(
    `SELECT f.*, p.name AS project_name
     FROM forms f LEFT JOIN projects p ON p.id = f.project_id
     WHERE f.token = ?`,
    [params.token]
  );
  if (!form) return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404 });
  if (!form.active) return NextResponse.json({ ok: false, error: "This form is paused." }, { status: 410 });
  if (form.expires_at && new Date(form.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "This form has expired." }, { status: 410 });
  }

  // Public projects only — for the picker (when form.project_id is null).
  const publicProjects = form.project_id == null
    ? all<Pick<Project, "id" | "name" | "color" | "description">>(
        `SELECT id, name, color, description FROM projects WHERE archived = 0 AND visibility = 'public' ORDER BY name`
      )
    : [];

  return NextResponse.json({
    ok: true,
    form: {
      name: form.name,
      project_id: form.project_id,
      project_name: form.project_name,
      allow_suggest_new_project: !!form.allow_suggest_new_project,
      default_category: form.default_category,
      thank_you_message: form.thank_you_message,
      submit_button_label: form.submit_button_label,
    },
    public_projects: publicProjects,
  });
}
