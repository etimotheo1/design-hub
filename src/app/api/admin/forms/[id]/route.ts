import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const id = Number(params.id);
  const body = await req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.name === "string")                       { fields.push("name = ?");                       values.push(body.name.trim()); }
  if ("project_id" in body)                                { fields.push("project_id = ?");                 values.push(body.project_id ? Number(body.project_id) : null); }
  if (typeof body.allow_suggest_new_project === "boolean") { fields.push("allow_suggest_new_project = ?"); values.push(body.allow_suggest_new_project ? 1 : 0); }
  if ("default_category" in body)                          { fields.push("default_category = ?");           values.push(body.default_category || null); }
  if ("thank_you_message" in body)                         { fields.push("thank_you_message = ?");          values.push(body.thank_you_message || null); }
  if ("submit_button_label" in body)                       { fields.push("submit_button_label = ?");        values.push(body.submit_button_label || null); }
  if (typeof body.active === "boolean")                    { fields.push("active = ?");                     values.push(body.active ? 1 : 0); }
  if ("expires_at" in body)                                { fields.push("expires_at = ?");                 values.push(body.expires_at || null); }

  if (fields.length === 0) return NextResponse.json({ ok: true });
  values.push(id);
  run(`UPDATE forms SET ${fields.join(", ")} WHERE id = ?`, values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  run(`DELETE FROM forms WHERE id = ?`, [Number(params.id)]);
  return NextResponse.json({ ok: true });
}
