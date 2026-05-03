import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { ensureExternalUser, ensureInboxProject } from "@/lib/auth";
import type { ShareableForm } from "@/lib/types";

// Public submission endpoint — anyone with the form token can POST to it.
// Creates a Card in the appropriate project and logs to form_submissions.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const form = get<ShareableForm>(`SELECT * FROM forms WHERE token = ?`, [params.token]);
  if (!form) return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404 });
  if (!form.active) return NextResponse.json({ ok: false, error: "This form is paused." }, { status: 410 });
  if (form.expires_at && new Date(form.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "This form has expired." }, { status: 410 });
  }

  const body = await req.json();
  const submitterName  = String(body.submitter_name || "").trim();
  const submitterEmail = String(body.submitter_email || "").trim().toLowerCase();
  const title          = String(body.title || "").trim();
  const imagined       = body.imagined ? String(body.imagined).trim() : null;
  const pickedProjectId = body.project_id ? Number(body.project_id) : null;
  const suggestedNewProject = body.suggested_new_project ? String(body.suggested_new_project).trim() : null;

  if (!submitterName)  return NextResponse.json({ ok: false, error: "Your name is required." },  { status: 400 });
  if (!submitterEmail || !/.+@.+\..+/.test(submitterEmail)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (!title)          return NextResponse.json({ ok: false, error: "Idea title is required." }, { status: 400 });

  const externalUserId = await ensureExternalUser();

  // Resolve target project:
  //   1. Form has a fixed project_id → use it.
  //   2. Submitter picked a public project → validate and use it.
  //   3. Submitter suggested a NEW project → land in the Inbox project, store the suggestion.
  let targetProjectId: number;
  let suggestedProjectName: string | null = null;

  if (form.project_id) {
    targetProjectId = form.project_id;
  } else if (pickedProjectId) {
    const picked = get<{ id: number; visibility: string; archived: number }>(
      `SELECT id, visibility, archived FROM projects WHERE id = ?`, [pickedProjectId]
    );
    if (!picked || picked.archived || picked.visibility !== "public") {
      return NextResponse.json({ ok: false, error: "That project isn't open for submissions." }, { status: 400 });
    }
    targetProjectId = picked.id;
  } else if (suggestedNewProject && form.allow_suggest_new_project) {
    targetProjectId = ensureInboxProject(externalUserId);
    suggestedProjectName = suggestedNewProject;
  } else {
    return NextResponse.json({ ok: false, error: "Please pick a project." }, { status: 400 });
  }

  // Place the new card at the bottom of the Idea column.
  const max = get<{ m: number | null }>(
    `SELECT MAX(position) AS m FROM cards WHERE project_id = ? AND stage = 'idea'`,
    [targetProjectId]
  );
  const position = (max?.m ?? -1) + 1;

  const cardResult = run(
    `INSERT INTO cards (
       project_id, title, description, imagined_outcome, stage, position,
       category, created_by, external_submitter_name, external_submitter_email,
       from_form_id, suggested_project_name
     ) VALUES (?, ?, ?, ?, 'idea', ?, ?, ?, ?, ?, ?, ?)`,
    [
      targetProjectId,
      title,
      null,
      imagined,
      position,
      form.default_category || null,
      externalUserId,
      submitterName,
      submitterEmail,
      form.id,
      suggestedProjectName,
    ]
  );
  const cardId = Number(cardResult.lastInsertRowid);

  // Log initial stage entry so analytics work from card creation.
  run(`INSERT INTO stage_history (card_id, stage) VALUES (?, 'idea')`, [cardId]);

  // Audit-log the submission.
  run(
    `INSERT INTO form_submissions (form_id, card_id, submitter_name, submitter_email)
     VALUES (?, ?, ?, ?)`,
    [form.id, cardId, submitterName, submitterEmail]
  );

  return NextResponse.json({
    ok: true,
    thank_you: form.thank_you_message ?? "Thanks — your idea was submitted. The team will review it.",
  });
}
