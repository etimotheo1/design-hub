import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { FORM_FIELD_TYPES, type FormFieldType } from "@/lib/types";

const VALID_TYPES = new Set<FormFieldType>(FORM_FIELD_TYPES.map((t) => t.value));
const SUPPORTS_OPTIONS = new Set<FormFieldType>(FORM_FIELD_TYPES.filter((t) => t.supportsOptions).map((t) => t.value));

export async function PATCH(req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const fieldId = Number(params.fieldId);
  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.label === "string" && body.label.trim()) {
    fields.push("label = ?"); values.push(body.label.trim());
  }
  if (typeof body.type === "string" && VALID_TYPES.has(body.type as FormFieldType)) {
    fields.push("type = ?"); values.push(body.type);
  }
  if ("placeholder" in body) {
    fields.push("placeholder = ?");
    values.push(body.placeholder ? String(body.placeholder).trim() : null);
  }
  if ("helper_text" in body) {
    fields.push("helper_text = ?");
    values.push(body.helper_text ? String(body.helper_text).trim() : null);
  }
  if (typeof body.required === "boolean") {
    fields.push("required = ?"); values.push(body.required ? 1 : 0);
  }
  if ("options" in body) {
    if (Array.isArray(body.options)) {
      const arr = body.options.map((s) => String(s).trim()).filter(Boolean);
      fields.push("options_json = ?"); values.push(arr.length > 0 ? JSON.stringify(arr) : null);
    } else if (body.options === null) {
      fields.push("options_json = ?"); values.push(null);
    }
  }
  if (typeof body.position === "number") {
    fields.push("position = ?"); values.push(body.position);
  }

  if (fields.length === 0) return NextResponse.json({ ok: true });
  values.push(fieldId);
  run(`UPDATE form_fields SET ${fields.join(", ")} WHERE id = ?`, values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  run(`DELETE FROM form_fields WHERE id = ?`, [Number(params.fieldId)]);
  return NextResponse.json({ ok: true });
}
