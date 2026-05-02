"use client";
import { useEffect, useState } from "react";
import type { Project, Stage, Category, CardType, TaxonomyItem } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";

export default function NewCardForm({
  projects,
  defaultProjectId,
  defaultStage,
  onClose,
  onCreated,
}: {
  projects: Project[];
  defaultProjectId?: number;
  defaultStage: Stage;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imagined, setImagined] = useState("");
  const [projectId, setProjectId] = useState<number | undefined>(defaultProjectId);
  const [stage, setStage] = useState<Stage>(defaultStage);
  const [category, setCategory] = useState<Category | "">("");
  const [cardType, setCardType] = useState<CardType | "">("");
  const [deadline, setDeadline] = useState("");
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/taxonomy").then((r) => r.json()).then((j) => {
      if (j.ok) {
        setCategories(j.categories.filter((c: TaxonomyItem) => !c.archived));
        setCardTypes(j.cardTypes.filter((c: TaxonomyItem) => !c.archived));
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Choose a project."); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title,
        description,
        imagined_outcome: imagined,
        stage,
        category: category || null,
        card_type: cardType || null,
        deadline: deadline || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not create card."); return; }
    onCreated();
  }

  return (
    <Modal onClose={onClose} title="New card">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Project</label>
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              required
            >
              <option value="">Choose…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— none —</option>
              {cardTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Deadline (optional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            placeholder="Context, requirements, links…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">What I imagine</label>
          <textarea
            value={imagined}
            onChange={(e) => setImagined(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            placeholder="What does success look like? What should the user feel/do? (Especially helpful for non-tech ideators.)"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Creating…" : "Create card"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-30 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
