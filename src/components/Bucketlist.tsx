"use client";
import { useEffect, useMemo, useState } from "react";
import type { CardWithMeta, Project, SessionUser, TaxonomyItem } from "@/lib/types";
import CardModal from "./CardModal";

const LS_PROJECT = "designhub.bucketlist.project";
const LS_CATEGORY = "designhub.bucketlist.category";
const LS_TYPE = "designhub.bucketlist.cardType";

export default function Bucketlist({ currentUser }: { currentUser: SessionUser }) {
  const [ideas, setIdeas] = useState<CardWithMeta[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-add form state
  const [title, setTitle] = useState("");
  const [imagined, setImagined] = useState("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [category, setCategory] = useState<string>("");
  const [cardType, setCardType] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [filterProject, setFilterProject] = useState<"all" | number>("all");

  const [openCardId, setOpenCardId] = useState<number | null>(null);

  async function load() {
    const [c, p, t] = await Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/taxonomy").then((r) => r.json()),
    ]);
    if (c.ok) setIdeas(c.cards.filter((x: CardWithMeta) => x.stage === "idea"));
    if (p.ok) {
      setProjects(p.projects);
      // Restore last-used project from localStorage, or default to first.
      const savedProj = typeof window !== "undefined" ? localStorage.getItem(LS_PROJECT) : null;
      const initial = savedProj ? Number(savedProj) : p.projects[0]?.id ?? "";
      if (p.projects.find((pr: Project) => pr.id === initial)) setProjectId(initial);
      else if (p.projects.length) setProjectId(p.projects[0].id);
    }
    if (t.ok) {
      setCategories(t.categories.filter((c: TaxonomyItem) => !c.archived));
      setCardTypes(t.cardTypes.filter((c: TaxonomyItem) => !c.archived));
      if (typeof window !== "undefined") {
        const sc = localStorage.getItem(LS_CATEGORY);
        const st = localStorage.getItem(LS_TYPE);
        if (sc && t.categories.find((x: TaxonomyItem) => x.name === sc)) setCategory(sc);
        if (st && t.cardTypes.find((x: TaxonomyItem) => x.name === st)) setCardType(st);
      }
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = ideas.slice();
    if (filterProject !== "all") list = list.filter((c) => c.project_id === filterProject);
    // Newest first.
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return list;
  }, [ideas, filterProject]);

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Pick a project."); return; }
    if (!title.trim()) return;
    setSaving(true); setError(null);

    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title: title.trim(),
        imagined_outcome: imagined.trim() || null,
        category: category || null,
        card_type: cardType || null,
        stage: "idea",
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not add."); return; }

    // Remember choices so the next quick-add doesn't ask again.
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_PROJECT, String(projectId));
      if (category) localStorage.setItem(LS_CATEGORY, category);
      if (cardType) localStorage.setItem(LS_TYPE, cardType);
    }

    // Clear title + imagined; keep project/category/type for next entry.
    setTitle("");
    setImagined("");
    load();
  }

  async function promote(id: number) {
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "design" }),
    });
    load();
  }

  function ageLabel(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return `${days}d ago`;
    const hours = Math.floor(ms / 3600000);
    if (hours >= 1) return `${hours}h ago`;
    const mins = Math.floor(ms / 60000);
    if (mins >= 1) return `${mins}m ago`;
    return "just now";
  }

  return (
    <div className="space-y-4">
      {/* Quick-add card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <form onSubmit={quickAdd} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the idea? (press Enter to add)"
            className="w-full text-base rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent"
            required
            autoFocus
          />
          <textarea
            value={imagined}
            onChange={(e) => setImagined(e.target.value)}
            placeholder="What do you imagine? (optional)"
            rows={2}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              required
            >
              <option value="">Project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Category…</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Type…</option>
              {cardTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Project, Category, and Type are remembered for your next entry — just type and Enter.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-brand-ink text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add to bucketlist"}
            </button>
          </div>
        </form>
      </div>

      {/* List header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-slate-900">
          {filtered.length} {filtered.length === 1 ? "idea" : "ideas"} waiting
        </h2>
        <label className="text-xs text-slate-600 flex items-center gap-1.5">
          <span>Project:</span>
          <select
            value={String(filterProject)}
            onChange={(e) => setFilterProject(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm bg-white"
          >
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      {/* Ideas list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {loading && <p className="p-6 text-sm text-slate-400">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="p-8 text-sm text-slate-400 italic text-center">
            No ideas yet — drop one in the box above.
          </p>
        )}
        {!loading && filtered.map((c) => (
          <div key={c.id} className="p-4 sm:p-5 hover:bg-slate-50 transition group">
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => setOpenCardId(c.id)}
                className="text-left min-w-0 flex-1"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs text-slate-500 truncate">{c.project_name}</span>
                  {c.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{c.category}</span>}
                  {c.card_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{c.card_type}</span>}
                  <span className="text-[10px] text-slate-400 ml-auto sm:ml-0">{ageLabel(c.created_at)}</span>
                </div>
                <div className="text-sm font-medium text-slate-900">{c.title}</div>
                {c.imagined_outcome && (
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    <span className="font-medium text-slate-700">Imagined: </span>
                    {c.imagined_outcome}
                  </p>
                )}
                <div className="text-[11px] text-slate-400 mt-1.5">
                  by {c.created_by_name}
                  {c.comment_count > 0 && <> · 💬 {c.comment_count}</>}
                  {c.attachment_count > 0 && <> · 📎 {c.attachment_count}</>}
                </div>
              </button>
              <button
                onClick={() => promote(c.id)}
                className="opacity-0 group-hover:opacity-100 transition flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                title="Move to Design stage"
              >
                Send to Design →
              </button>
            </div>
          </div>
        ))}
      </div>

      {openCardId !== null && (
        <CardModal
          cardId={openCardId}
          currentUser={currentUser}
          onClose={() => setOpenCardId(null)}
          onChange={load}
        />
      )}
    </div>
  );
}
