"use client";
import { useEffect, useState } from "react";
import type { Designation, Stage } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";

type WorkflowRow = { id: number; name: string; description: string | null; in_use: number };
type TransitionDetail = {
  id: number; from_stage: Stage; to_stage: Stage;
  designations: Array<{ designation_id: number; designation_name: string }>;
};
type WorkflowDetail = {
  workflow: { id: number; name: string; description: string | null };
  labels: Array<{ stage: Stage; label: string }>;
  transitions: TransitionDetail[];
};

export default function WorkflowsAdmin() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [name, setName] = useState("");

  async function load() {
    const [w, d] = await Promise.all([
      fetch("/api/admin/workflows").then((r) => r.json()),
      fetch("/api/admin/designations").then((r) => r.json()),
    ]);
    if (w.ok) setWorkflows(w.workflows);
    if (d.ok) setDesignations(d.designations);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    if (j.ok) {
      setName("");
      load();
      setOpenId(j.id);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this workflow? Projects using it will fall back to no enforcement (open).")) return;
    await fetch(`/api/admin/workflows/${id}`, { method: "DELETE" });
    if (openId === id) setOpenId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='New workflow name (e.g. "Standard Tech Team")'
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <button type="submit" className="text-sm px-3 py-1.5 rounded-lg bg-brand-ink text-white hover:bg-slate-800">+ Create</button>
        </div>
      </form>

      <div className="space-y-3">
        {workflows.length === 0 && <p className="text-sm text-slate-400 italic">No workflows yet.</p>}
        {workflows.map((w) => (
          <div key={w.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{w.name}</div>
                {w.description && <p className="text-sm text-slate-500 mt-0.5">{w.description}</p>}
                <p className="text-xs text-slate-500 mt-1">Used by {w.in_use} project{w.in_use === 1 ? "" : "s"}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button onClick={() => setOpenId(openId === w.id ? null : w.id)} className="text-indigo-600 hover:text-indigo-800 font-medium">
                  {openId === w.id ? "Close" : "Edit"}
                </button>
                <button onClick={() => remove(w.id)} className="text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
            {openId === w.id && <WorkflowEditor workflowId={w.id} designations={designations.filter((d) => !d.archived)} onChanged={load} />}
          </div>
        ))}
      </div>

      {designations.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          ⚠️ No designations yet. <a href="/admin/designations" className="underline font-medium">Add some first</a> — they're what you assign to each transition.
        </div>
      )}
    </div>
  );
}

function WorkflowEditor({ workflowId, designations, onChanged }: { workflowId: number; designations: Designation[]; onChanged: () => void }) {
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}`);
      const j = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!j.ok) {
        setLoadError(j.error || `HTTP ${res.status}`);
        return;
      }
      setDetail(j);
      setName(j.workflow.name);
      setDescription(j.workflow.description ?? "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Network error");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workflowId]);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/admin/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
    onChanged();
  }

  if (loadError) {
    return (
      <div className="px-5 pb-4 text-sm">
        <p className="text-red-700">Could not load workflow details: {loadError}</p>
        <button onClick={load} className="mt-2 text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Retry</button>
      </div>
    );
  }
  if (!detail) return <p className="px-5 pb-4 text-sm text-slate-400">Loading…</p>;

  const labelsMap: Record<string, string> = Object.fromEntries(detail.labels.map((l) => [l.stage, l.label]));

  function stageLabel(stage: Stage): string {
    return labelsMap[stage] ?? STAGE_LABELS[stage];
  }

  return (
    <div className="px-5 pb-5 border-t border-slate-200 space-y-5">
      {/* Name + description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">Workflow name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => patch({ name })} className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => patch({ description })} className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2" placeholder="Optional. e.g. Tech team standard workflow." />
        </div>
      </div>

      {/* Stage labels */}
      <div>
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">Custom stage labels (optional)</label>
        <p className="text-xs text-slate-500 mb-2">Override how each stage appears in this workflow. Leave blank to use the default name.</p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {STAGES.map((s) => (
            <div key={s}>
              <div className="text-[10px] uppercase text-slate-500 mb-1">{STAGE_LABELS[s]}</div>
              <input
                defaultValue={labelsMap[s] ?? ""}
                placeholder={STAGE_LABELS[s]}
                onBlur={(e) => patch({ stage_labels: { [s]: e.target.value || null } })}
                className="w-full text-sm rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Transition designations */}
      <div>
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">Approvers per transition</label>
        <p className="text-xs text-slate-500 mb-3">For each step, pick which designations can approve. If no designations are picked, anyone with project access can move the card.</p>
        <div className="space-y-2">
          {detail.transitions.map((t) => (
            <TransitionRow
              key={t.id}
              transition={t}
              fromLabel={stageLabel(t.from_stage)}
              toLabel={stageLabel(t.to_stage)}
              designations={designations}
              onSave={(ids) => patch({ transition_designations: { [t.id]: ids } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TransitionRow({
  transition, fromLabel, toLabel, designations, onSave,
}: {
  transition: TransitionDetail;
  fromLabel: string;
  toLabel: string;
  designations: Designation[];
  onSave: (ids: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>(transition.designations.map((d) => d.designation_id));

  function toggle(id: number) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    onSave(next);
  }

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2">
        <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-xs">{fromLabel}</span>
        <span className="text-slate-400">→</span>
        <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-xs">{toLabel}</span>
      </div>
      {designations.length === 0 ? (
        <p className="text-xs text-slate-500 italic">Add designations first.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {designations.map((d) => {
            const isOn = selected.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(d.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                  isOn
                    ? "bg-indigo-100 text-indigo-900 ring-2 ring-indigo-300"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      )}
      {selected.length === 0 && <p className="text-[11px] text-slate-500 italic mt-2">No restriction — anyone with project access can move cards.</p>}
    </div>
  );
}
