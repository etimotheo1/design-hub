"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, Category, CardType, TaxonomyItem } from "@/lib/types";
import DateTimePicker from "./DateTimePicker";

// Friendly, non-tech-oriented submission form. Always lands cards in the Idea column.
export default function IdeaForm({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [imagined, setImagined] = useState("");
  const [details, setDetails] = useState("");
  const [projectId, setProjectId] = useState<number | undefined>(projects[0]?.id);
  const [category, setCategory] = useState<Category | "">("");
  const [cardType, setCardType] = useState<CardType | "">("");
  const [deadline, setDeadline] = useState("");
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
    if (!projectId) { setError("Pick a project."); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title,
        description: details,
        imagined_outcome: imagined,
        stage: "idea",
        category: category || null,
        card_type: cardType || null,
        deadline: deadline || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not submit."); return; }
    setDone(true);
    setTitle(""); setImagined(""); setDetails("");
    setCategory(""); setCardType(""); setDeadline("");
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">✨</div>
        <h2 className="text-lg font-semibold">Idea captured</h2>
        <p className="text-sm text-slate-500 mt-1">Your idea is now in the Idea column for the team to pick up.</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => setDone(false)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
          >
            Submit another
          </button>
          <button
            onClick={() => router.push("/board")}
            className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-slate-800"
          >
            See the board
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">What's the idea? <span className="text-red-500">*</span></label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="In a sentence — what's the idea or problem?"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Which project does it relate to?</label>
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
        <label className="block text-sm font-medium text-slate-700">What do you imagine?</label>
        <textarea
          value={imagined}
          onChange={(e) => setImagined(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          placeholder="Describe the experience, outcome, or end-state you imagine. Don't worry about how — that's the tech team's job."
        />
        <p className="text-xs text-slate-400 mt-1">This is the most important field. Help the tech team see what you see.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">Choose…</option>
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
            <option value="">Choose…</option>
            {cardTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Target deadline (optional)</label>
        <DateTimePicker value={deadline || null} onChange={(v) => setDeadline(v ?? "")} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Anything else? (optional)</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          placeholder="Background, examples, links…"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="text-sm px-4 py-2 rounded-lg bg-brand text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Sending…" : "Send to the team"}
        </button>
      </div>
    </form>
  );
}
