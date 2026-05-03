import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { all, get, run } from "@/lib/db";
import type { FormField, FormFieldType } from "@/lib/types";
import { FORM_FIELD_TYPES } from "@/lib/types";

const VALID_TYPES = new Set<FormFieldType>(FORM_FIELD_TYPES.map((t) => t.value));
const SUPPORTS_OPTIONS = new Set<FormFieldType>(FORM_FIELD_TYPES.filter((t) => t.supportsOptions).map((t) => t.value));

// List + reorder + create custom fields for a form.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const fields = all<FormField>(
    `SELECT * FROM form_fields WHERE form_id = ? ORDER BY position ASC, id ASC`,
    [Number(params.id)]
  );
  // Parse options_json into options[] for client convenience.
  const enriched = fields.map((f) => ({
    ...f,
    options: f.options_json ? safeParseStringArray(f.options_json) : undefined,
  }));
  return NextResponse.json({ ok: true, fields: enriched });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });

  const formId = Number(params.id);
  const body = await req.json();
  const validation = validateField(body);
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

  // New field goes at the end.
  const max = get<{ m: number | null }>(`SELECT MAX(position) AS m FROM form_fields WHERE form_id = ?`, [formId]);
  const position = (max?.m ?? -1) + 1;

  const result = run(
    `INSERT INTO form_fields (form_id, position, type, label, placeholder, helper_text, required, options_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      formId, position, validation.value.type, validation.value.label,
      validation.value.placeholder, validation.value.helper_text,
      validation.value.required ? 1 : 0,
      validation.value.options ? JSON.stringify(validation.value.options) : null,
    ]
  );
  return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
}

// Bulk reorder via PATCH with { order: [fieldId, fieldId, ...] }.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const body = await req.json();
  if (!Array.isArray(body.order)) return NextResponse.json({ ok: false, error: "order array required" }, { status: 400 });

  body.order.forEach((fid: number, idx: number) => {
    run(`UPDATE form_fields SET position = ? WHERE id = ? AND form_id = ?`, [idx, Number(fid), Number(params.id)]);
  });
  return NextResponse.json({ ok: true });
}

interface ValidatedField {
  type: FormFieldType;
  label: string;
  placeholder: string | null;
  helper_text: string | null;
  required: boolean;
  options: string[] | null;
}

function validateField(body: Record<string, unknown>): { ok: true; value: ValidatedField } | { ok: false; error: string } {
  const type = body.type as FormFieldType;
  if (!VALID_TYPES.has(type)) return { ok: false, error: "Unknown field type." };
  const label = String(body.label || "").trim();
  if (!label) return { ok: false, error: "Field label required." };
  let options: string[] | null = null;
  if (SUPPORTS_OPTIONS.has(type)) {
    const arr = Array.isArray(body.options) ? body.options : [];
    options = arr.map((s) => String(s).trim()).filter(Boolean);
    if (options.length === 0) return { ok: false, error: "Choice fields need at least one option." };
  }
  return {
    ok: true,
    value: {
      type,
      label,
      placeholder: body.placeholder ? String(body.placeholder).trim() : null,
      helper_text: body.helper_text ? String(body.helper_text).trim() : null,
      required: !!body.required,
      options,
    },
  };
}

function safeParseStringArray(json: string): string[] | undefined {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* fallthrough */ }
  return undefined;
}
