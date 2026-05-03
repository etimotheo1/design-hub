"use client";
import { useEffect, useState } from "react";
import type { FormField } from "@/lib/types";

type FormConfig = {
  name: string;
  project_id: number | null;
  project_name: string | null;
  allow_suggest_new_project: boolean;
  default_category: string | null;
  thank_you_message: string | null;
  submit_button_label: string | null;
};
type PublicProject = { id: number; name: string; color: string | null; description: string | null };

export default function PublicSubmitForm({ token }: { token: string }) {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [title, setTitle] = useState("");
  const [imagined, setImagined] = useState("");
  const [picked, setPicked] = useState<number | "new" | "">("");
  const [suggestedProject, setSuggestedProject] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thankYou, setThankYou] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/forms/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setConfig(j.form);
          setProjects(j.public_projects);
          setFields(j.fields ?? []);
        } else {
          setLoadError(j.error || "This form is not available.");
        }
      })
      .catch(() => setLoadError("Could not load this form."));
  }, [token]);

  if (loadError) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="text-3xl mb-2">😕</div>
        <h1 className="text-xl font-semibold">{loadError}</h1>
        <p className="text-sm text-slate-500 mt-2">If you got this link from someone, ask them for a fresh one.</p>
      </div>
    );
  }
  if (!config) {
    return <p className="text-center text-sm text-slate-500">Loading…</p>;
  }
  if (thankYou) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="text-4xl mb-2">✨</div>
        <h1 className="text-xl font-semibold">Idea received</h1>
        <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{thankYou}</p>
        <button
          onClick={() => { setThankYou(null); setTitle(""); setImagined(""); setPicked(""); setSuggestedProject(""); }}
          className="mt-6 text-sm px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
        >
          Submit another idea
        </button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let projectIdToSend: number | null = null;
    let suggestedToSend: string | null = null;

    if (config!.project_id) {
      // Form is bound to a fixed project
    } else if (picked === "new") {
      if (!suggestedProject.trim()) { setError("Please name the new project you're suggesting."); return; }
      suggestedToSend = suggestedProject.trim();
    } else if (typeof picked === "number") {
      projectIdToSend = picked;
    } else {
      setError("Please pick a project."); return;
    }

    setSaving(true);
    const res = await fetch(`/api/forms/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        title,
        imagined,
        project_id: projectIdToSend,
        suggested_new_project: suggestedToSend,
        answers,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not submit."); return; }
    setThankYou(data.thank_you);
  }

  const showProjectPicker = config.project_id == null;

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-brand-ink">{config.name}</h1>
        {config.project_name && (
          <p className="text-xs text-slate-500 mt-1">Submissions go to <span className="font-medium">{config.project_name}</span></p>
        )}
      </div>

      <Field label="Your name *">
        <input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} className={inputCls} required />
      </Field>
      <Field label="Your email *">
        <input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} className={inputCls} required />
        <p className="text-xs text-slate-400 mt-1">So the team can follow up. Won't be shared publicly.</p>
      </Field>

      <Field label="What's the idea? *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="In one line" className={inputCls} required />
      </Field>
      <Field label="What do you imagine?">
        <textarea value={imagined} onChange={(e) => setImagined(e.target.value)} rows={4} placeholder="Describe the experience or outcome you imagine. Don't worry about how — that's the team's job." className={inputCls} />
      </Field>

      {showProjectPicker && (
        <Field label="Which area does this relate to? *">
          <select value={picked === "" ? "" : String(picked)} onChange={(e) => setPicked(e.target.value === "" ? "" : e.target.value === "new" ? "new" : Number(e.target.value))} className={inputCls} required>
            <option value="">Choose…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {config.allow_suggest_new_project && <option value="new">+ Suggest a new area</option>}
          </select>
          {picked === "new" && (
            <input
              value={suggestedProject}
              onChange={(e) => setSuggestedProject(e.target.value)}
              placeholder="Name the new area you have in mind"
              className={`${inputCls} mt-2`}
              required
            />
          )}
          {picked === "new" && (
            <p className="text-xs text-slate-500 mt-1">An admin will review and either create this as a new project or merge your idea with an existing one.</p>
          )}
        </Field>
      )}

      {/* Custom fields the admin designed */}
      {fields.map((f) => (
        <CustomFieldRender
          key={f.id}
          field={f}
          value={answers[String(f.id)] ?? ""}
          onChange={(v) => setAnswers({ ...answers, [String(f.id)]: v })}
        />
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-brand-ink text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "Sending…" : (config.submit_button_label || "Send my idea")}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function CustomFieldRender({
  field, value, onChange,
}: {
  field: FormField;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const options = field.options ?? (field.options_json ? safeParseStringArray(field.options_json) : []) ?? [];
  const v = typeof value === "string" ? value : "";

  let control: React.ReactNode = null;
  switch (field.type) {
    case "short_text":
      control = <input value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} required={!!field.required} className={inputCls} />;
      break;
    case "long_text":
      control = <textarea value={v} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder ?? ""} required={!!field.required} className={inputCls} />;
      break;
    case "email":
      control = <input type="email" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} required={!!field.required} className={inputCls} />;
      break;
    case "phone":
      control = <input type="tel" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} required={!!field.required} className={inputCls} />;
      break;
    case "url":
      control = <input type="url" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? "https://…"} required={!!field.required} className={inputCls} />;
      break;
    case "number":
      control = <input type="number" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} required={!!field.required} className={inputCls} />;
      break;
    case "date":
      control = <input type="date" value={v} onChange={(e) => onChange(e.target.value)} required={!!field.required} className={inputCls} />;
      break;
    case "yes_no":
      control = (
        <div className="flex gap-2">
          {["yes","no"].map((opt) => (
            <label key={opt} className={`flex-1 cursor-pointer text-sm rounded-lg border px-3 py-2 text-center ${v === opt ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 font-medium" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
              <input type="radio" name={`f${field.id}`} className="sr-only" checked={v === opt} onChange={() => onChange(opt)} />
              {opt === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      );
      break;
    case "choice":
      control = (
        <div className="space-y-1.5">
          {options.map((o) => (
            <label key={o} className={`flex items-center gap-2 cursor-pointer text-sm rounded-lg border px-3 py-2 ${v === o ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
              <input type="radio" name={`f${field.id}`} checked={v === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );
      break;
    case "multi_choice": {
      const arr = Array.isArray(value) ? value : [];
      control = (
        <div className="space-y-1.5">
          {options.map((o) => {
            const selected = arr.includes(o);
            return (
              <label key={o} className={`flex items-center gap-2 cursor-pointer text-sm rounded-lg border px-3 py-2 ${selected ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, o]);
                    else onChange(arr.filter((x) => x !== o));
                  }}
                />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">{label}</label>
      {control}
      {field.helper_text && <p className="text-xs text-slate-500 mt-1">{field.helper_text}</p>}
    </div>
  );
}

function safeParseStringArray(json: string): string[] | undefined {
  try {
    const p = JSON.parse(json);
    if (Array.isArray(p)) return p.map(String);
  } catch { /* fall through */ }
  return undefined;
}
