"use client";
import { useEffect, useState } from "react";
import type { FormField, FormFieldType } from "@/lib/types";
import { FORM_FIELD_TYPES } from "@/lib/types";

// Designer for a single form's custom fields. Add, edit, delete, reorder.
export default function FormFieldsDesigner({ formId }: { formId: number }) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [adding, setAdding] = useState(false);

  async function load() {
    const r = await fetch(`/api/admin/forms/${formId}/fields`);
    const j = await r.json();
    if (j.ok) setFields(j.fields);
  }
  useEffect(() => { load(); }, [formId]);

  async function createField(field: FieldDraft) {
    const res = await fetch(`/api/admin/forms/${formId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(field),
    });
    const j = await res.json();
    if (!j.ok) { alert(j.error || "Could not add field."); return; }
    setAdding(false);
    load();
  }

  async function updateField(fieldId: number, patch: Partial<FieldDraft>) {
    await fetch(`/api/admin/forms/${formId}/fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function removeField(fieldId: number) {
    if (!confirm("Delete this field? Existing answers stay in past submissions but the field disappears from the form.")) return;
    await fetch(`/api/admin/forms/${formId}/fields/${fieldId}`, { method: "DELETE" });
    load();
  }

  async function move(fieldId: number, direction: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const swap = idx + direction;
    if (swap < 0 || swap >= fields.length) return;
    const next = [...fields];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setFields(next);
    await fetch(`/api/admin/forms/${formId}/fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((f) => f.id) }),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900 text-sm">Custom questions</h3>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
            + Add question
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        These are extra questions, on top of the standard fields (name, email, idea title, "what do you imagine?", project picker).
        They appear on the public form in the order shown below.
      </p>

      {adding && (
        <FieldEditor
          mode="create"
          onSave={(d) => createField(d)}
          onCancel={() => setAdding(false)}
        />
      )}

      {fields.length === 0 && !adding && (
        <p className="text-xs text-slate-400 italic">No custom questions yet — submitters will see only the standard fields.</p>
      )}

      <ul className="space-y-2">
        {fields.map((f, i) => (
          <li key={f.id} className="bg-slate-50 rounded-lg border border-slate-200">
            <FieldRow
              field={f}
              isFirst={i === 0}
              isLast={i === fields.length - 1}
              onMove={(dir) => move(f.id, dir)}
              onUpdate={(patch) => updateField(f.id, patch)}
              onDelete={() => removeField(f.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FieldDraft {
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helper_text?: string;
  required?: boolean;
  options?: string[];
}

function FieldRow({
  field, isFirst, isLast, onMove, onUpdate, onDelete,
}: {
  field: FormField;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onUpdate: (patch: Partial<FieldDraft>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <FieldEditor
        mode="edit"
        initial={{
          type: field.type,
          label: field.label,
          placeholder: field.placeholder ?? "",
          helper_text: field.helper_text ?? "",
          required: !!field.required,
          options: field.options ?? [],
        }}
        onSave={(d) => { onUpdate(d); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  const typeLabel = FORM_FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type;
  return (
    <div className="px-3 py-2 flex items-center gap-2">
      <div className="flex flex-col">
        <button onClick={() => onMove(-1)} disabled={isFirst} className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30">▲</button>
        <button onClick={() => onMove(1)}  disabled={isLast}  className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30">▼</button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{field.label}</span>
          {field.required ? <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Required</span> : null}
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">{typeLabel}</span>
        </div>
        {field.helper_text && <p className="text-xs text-slate-500 mt-0.5">{field.helper_text}</p>}
        {field.options && field.options.length > 0 && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Options: {field.options.join(", ")}</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button onClick={() => setEditing(true)} className="text-slate-600 hover:text-slate-900">Edit</button>
        <button onClick={onDelete} className="text-red-600 hover:text-red-800">Delete</button>
      </div>
    </div>
  );
}

function FieldEditor({
  mode, initial, onSave, onCancel,
}: {
  mode: "create" | "edit";
  initial?: FieldDraft;
  onSave: (d: FieldDraft) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<FormFieldType>(initial?.type ?? "short_text");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [placeholder, setPlaceholder] = useState(initial?.placeholder ?? "");
  const [helper, setHelper] = useState(initial?.helper_text ?? "");
  const [required, setRequired] = useState<boolean>(initial?.required ?? false);
  const [options, setOptions] = useState<string[]>(initial?.options ?? []);
  const [optInput, setOptInput] = useState("");

  const supportsOptions = FORM_FIELD_TYPES.find((t) => t.value === type)?.supportsOptions ?? false;

  function addOption() {
    const v = optInput.trim();
    if (!v) return;
    setOptions([...options, v]);
    setOptInput("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (supportsOptions && options.length === 0) {
      alert("Add at least one option for choice fields.");
      return;
    }
    onSave({
      type, label,
      placeholder: placeholder || undefined,
      helper_text: helper || undefined,
      required,
      options: supportsOptions ? options : undefined,
    });
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border-2 border-slate-300 p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Field type</label>
          <select value={type} onChange={(e) => setType(e.target.value as FormFieldType)} className="w-full text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white">
            {FORM_FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Label / question</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "How urgent is this?"' className="w-full text-sm rounded-lg border border-slate-300 px-2 py-1.5" required />
        </div>
      </div>

      {(type === "short_text" || type === "long_text" || type === "email" || type === "phone" || type === "url" || type === "number") && (
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Placeholder (optional)</label>
          <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className="w-full text-sm rounded-lg border border-slate-300 px-2 py-1.5" />
        </div>
      )}

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Helper text (optional)</label>
        <input value={helper} onChange={(e) => setHelper(e.target.value)} placeholder="Explain what you want from the answer." className="w-full text-sm rounded-lg border border-slate-300 px-2 py-1.5" />
      </div>

      {supportsOptions && (
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Options</label>
          <ul className="space-y-1 mb-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 bg-slate-100 px-2 py-1 rounded">{o}</span>
                <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-xs text-red-600">Remove</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={optInput} onChange={(e) => setOptInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} placeholder="Add an option…" className="flex-1 text-sm rounded-lg border border-slate-300 px-2 py-1.5" />
            <button type="button" onClick={addOption} className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300">Add</button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        <span>Required</span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
          {mode === "create" ? "Add field" : "Save"}
        </button>
      </div>
    </form>
  );
}
