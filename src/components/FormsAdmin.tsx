"use client";
import { useEffect, useState } from "react";
import type { Project, ShareableForm } from "@/lib/types";

type FormRow = ShareableForm & { submission_count: number; project_name: string | null };

export default function FormsAdmin() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Create form fields
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<number | "any">("any");
  const [allowSuggest, setAllowSuggest] = useState(true);
  const [thankYou, setThankYou] = useState("");
  const [submitLabel, setSubmitLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [f, p] = await Promise.all([
      fetch("/api/admin/forms").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    if (f.ok) setForms(f.forms);
    if (p.ok) setProjects(p.projects);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        project_id: projectId === "any" ? null : projectId,
        allow_suggest_new_project: allowSuggest,
        thank_you_message: thankYou || null,
        submit_button_label: submitLabel || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error); return; }
    setName(""); setProjectId("any"); setAllowSuggest(true); setThankYou(""); setSubmitLabel("");
    setShowCreate(false);
    load();
  }

  async function setActive(id: number, active: boolean) {
    await fetch(`/api/admin/forms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Revoke this form? The link will stop working.")) return;
    await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
    load();
  }

  function copyUrl(token: string) {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard?.writeText(url);
  }

  function publicUrl(token: string): string {
    if (typeof window === "undefined") return `/s/${token}`;
    return `${window.location.origin}/s/${token}`;
  }

  return (
    <div className="space-y-6">
      {/* Create button or form */}
      {showCreate ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">New form</h2>
          <form onSubmit={create} className="space-y-3">
            <Field label="Form name (internal)">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Customer feedback", "Driver suggestions"' className={inputCls} required />
            </Field>
            <Field label="Project for new ideas">
              <select value={projectId === "any" ? "any" : String(projectId)} onChange={(e) => setProjectId(e.target.value === "any" ? "any" : Number(e.target.value))} className={inputCls}>
                <option value="any">Submitter picks (limited to public projects)</option>
                {projects.filter((p) => !p.archived).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                If you pick a specific project, every submission lands there (faster for the submitter).
              </p>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={allowSuggest} onChange={(e) => setAllowSuggest(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-medium text-slate-800">Allow "Suggest new project"</span>
                <p className="text-xs text-slate-500">If submitter's idea doesn't fit existing projects, they can propose a new one. It lands in the Submission Inbox for your review (Approvals page).</p>
              </span>
            </label>
            <Field label="Submit button label (optional)">
              <input value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} placeholder="e.g. Send my idea" className={inputCls} />
            </Field>
            <Field label="Thank-you message (optional)">
              <textarea value={thankYou} onChange={(e) => setThankYou(e.target.value)} rows={2} placeholder="Shown after submitting." className={inputCls} />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
              <button type="submit" disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-brand-ink text-white hover:bg-slate-800 disabled:opacity-50">
                {saving ? "Creating…" : "Create form"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)} className="text-sm px-3 py-2 rounded-lg bg-brand-ink text-white hover:bg-slate-800">
          + New form
        </button>
      )}

      {/* List */}
      {forms.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No forms yet. Create one above to start collecting ideas from outside Design Hub.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {forms.map((f) => (
            <div key={f.id} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{f.name}</span>
                    {f.active ? (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Active</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">Paused</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Lands in: {f.project_name ? <span className="font-medium">{f.project_name}</span> : "submitter picks (public projects)"}
                    {" · "}{f.submission_count} submission{f.submission_count === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded break-all flex-1 min-w-0">{publicUrl(f.token)}</code>
                    <button onClick={() => copyUrl(f.token)} className="text-xs px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-700">Copy link</button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm flex-shrink-0">
                  <button onClick={() => setActive(f.id, !f.active)} className="text-slate-600 hover:text-slate-900">
                    {f.active ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(f.id)} className="text-red-600 hover:text-red-800">Revoke</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
