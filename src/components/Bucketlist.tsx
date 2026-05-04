"use client";
import { useEffect, useMemo, useState } from "react";
import type { CardWithMeta, Project, SessionUser, TaxonomyItem } from "@/lib/types";
import { colorClasses } from "@/lib/colors";
import CardModal from "./CardModal";
import MoveCardDialog from "./MoveCardDialog";

const LS_PROJECT = "designhub.bucketlist.project";
const LS_CATEGORY = "designhub.bucketlist.category";
const LS_TYPE = "designhub.bucketlist.cardType";

type Suggestion = { category: string | null; card_type: string | null; reason?: string } | null;

export default function Bucketlist({ currentUser }: { currentUser: SessionUser }) {
  const [ideas, setIdeas] = useState<CardWithMeta[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-add state
  const [title, setTitle] = useState("");
  const [imagined, setImagined] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");
  const [cardType, setCardType] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggestion (tags)
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion>(null);
  const [suggesting, setSuggesting] = useState(false);

  // AI expand (richer "what I imagine")
  const [expanding, setExpanding] = useState(false);
  const [expansion, setExpansion] = useState<string | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);

  // List filters
  const [filterProject, setFilterProject] = useState<"all" | number>("all");
  const [search, setSearch] = useState("");

  // Project picker search (for when there are many projects)
  const [projectSearch, setProjectSearch] = useState("");

  const [openCardId, setOpenCardId] = useState<number | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ id: number; title: string } | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  async function load() {
    const [c, p, t] = await Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/taxonomy").then((r) => r.json()),
    ]);
    if (c.ok) setIdeas(c.cards.filter((x: CardWithMeta) => x.stage === "idea"));
    if (p.ok) {
      setProjects(p.projects);
      const saved = typeof window !== "undefined" ? localStorage.getItem(LS_PROJECT) : null;
      const initial = saved ? Number(saved) : (p.projects[0]?.id ?? null);
      if (initial && p.projects.find((pr: Project) => pr.id === initial)) setProjectId(initial);
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

  // Per-project counts for the cards row.
  const ideaCountByProject = useMemo(() => {
    const m: Record<number, number> = {};
    for (const i of ideas) m[i.project_id] = (m[i.project_id] || 0) + 1;
    return m;
  }, [ideas]);

  const filtered = useMemo(() => {
    let list = ideas.slice();
    if (filterProject !== "all") list = list.filter((c) => c.project_id === filterProject);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        (c.imagined_outcome ?? "").toLowerCase().includes(q) ||
        (c.project_name ?? "").toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q) ||
        (c.card_type ?? "").toLowerCase().includes(q) ||
        (c.created_by_name ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return list;
  }, [ideas, filterProject, search]);

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Pick a project first."); return; }
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

    if (typeof window !== "undefined") {
      localStorage.setItem(LS_PROJECT, String(projectId));
      if (category) localStorage.setItem(LS_CATEGORY, category);
      if (cardType) localStorage.setItem(LS_TYPE, cardType);
    }

    setTitle("");
    setImagined("");
    setSuggestion(null);
    load();
  }

  // Ask Claude to suggest a Category and Type once the user has typed a title.
  async function askAI() {
    if (!title.trim()) return;
    setSuggesting(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, imagined }),
      });
      const data = await res.json();
      if (data.ok) {
        setAiAvailable(data.available);
        if (data.suggestion) setSuggestion(data.suggestion);
        else { setSuggestion(null); if (data.error) setAiError(data.error); }
      } else {
        setAiError(data.error || "AI request failed");
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (suggestion.category) setCategory(suggestion.category);
    if (suggestion.card_type) setCardType(suggestion.card_type);
    setSuggestion(null);
  }

  // Ask Claude to expand the idea into a richer briefing.
  async function expandWithAI(style: string = "default") {
    if (!title.trim()) return;
    setExpanding(true);
    setExpandError(null);
    try {
      const project = projects.find((p) => p.id === projectId)?.name;
      const res = await fetch("/api/ai/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, imagined, project, style }),
      });
      const data = await res.json();
      if (data.ok) {
        setAiAvailable(data.available);
        if (data.result?.expansion) setExpansion(data.result.expansion);
        else if (data.error) setExpandError(data.error);
      } else {
        setExpandError(data.error || "AI request failed");
      }
    } catch (e) {
      setExpandError(e instanceof Error ? e.message : "Network error");
    } finally {
      setExpanding(false);
    }
  }

  function applyExpansion() {
    if (expansion) setImagined(expansion);
    setExpansion(null);
  }

  function promote(id: number, title: string) {
    setMoveDialog({ id, title });
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

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedProjectColor = colorClasses(selectedProject?.color);

  return (
    <div className="space-y-6">
      {/* Step 1: Project picker */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
            1. Pick a project
            {selectedProject && (
              <span className="ml-2 normal-case font-normal text-slate-700">
                · selected: <span className={`font-semibold ${selectedProjectColor.text}`}>{selectedProject.name}</span>
              </span>
            )}
          </div>
          {projects.length > 0 && (
            <div className="relative w-full sm:w-56">
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects…"
                className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 pl-8 bg-white w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              {projectSearch && (
                <button
                  type="button"
                  onClick={() => setProjectSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm"
                  title="Clear search"
                >×</button>
              )}
            </div>
          )}
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No projects yet — add one in Settings → Projects.</p>
        ) : (() => {
          const visibleProjects = projectSearch.trim()
            ? projects.filter((p) =>
                p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()) ||
                (p.description ?? "").toLowerCase().includes(projectSearch.trim().toLowerCase())
              )
            : projects;
          if (visibleProjects.length === 0) {
            return <p className="text-sm text-slate-400 italic">No projects match "{projectSearch}".</p>;
          }
          return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleProjects.map((p) => {
              const cc = colorClasses(p.color);
              const selected = p.id === projectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProjectId(p.id)}
                  className={`text-left rounded-xl p-4 transition relative
                    ${selected
                      ? `border-2 ${cc.cardSelected} ${cc.cardBg} shadow-lg scale-[1.02]`
                      : "bg-white border border-slate-200 hover:-translate-y-0.5 hover:shadow-md"}`}
                >
                  {selected && (
                    <span className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full ${cc.cardSelectedDot} text-white text-[10px] font-semibold uppercase tracking-wide shadow`}>
                      Selected
                    </span>
                  )}
                  <div className={`h-1.5 w-10 rounded-full ${cc.stripe} mb-3`}></div>
                  <div className="font-semibold text-slate-900 text-sm leading-tight">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-2">
                    {ideaCountByProject[p.id] ?? 0} {(ideaCountByProject[p.id] ?? 0) === 1 ? "idea" : "ideas"} waiting
                  </div>
                </button>
              );
            })}
          </div>
          );
        })()}
      </div>

      {/* Step 2: Idea capture */}
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">2. What's the idea?</div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <form onSubmit={quickAdd} className="space-y-3">
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (suggestion) setSuggestion(null); }}
              placeholder="Describe the idea in one line…"
              className="w-full text-base rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              autoFocus
            />
            <textarea
              value={imagined}
              onChange={(e) => setImagined(e.target.value)}
              placeholder="What do you imagine? (optional — Claude can expand this for you)"
              rows={imagined.length > 200 ? 6 : 3}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {/* AI assist row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={askAI}
                  disabled={suggesting || !title.trim()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>✨</span>
                  {suggesting ? "Thinking…" : "Suggest tags"}
                </button>
                <button
                  type="button"
                  onClick={() => expandWithAI("default")}
                  disabled={expanding || !title.trim()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Turn your one-liner into a richer briefing for design + tech"
                >
                  <span>✨</span>
                  {expanding ? "Expanding…" : "Expand details"}
                </button>
              </div>
              {aiAvailable === false && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                  AI not configured. Admin: add <span className="font-mono">ANTHROPIC_API_KEY</span> in Railway.
                </span>
              )}
            </div>

            {/* AI expansion preview */}
            {expansion && (
              <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-violet-800">✨ Suggested briefing</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={applyExpansion} className="text-xs px-2 py-1 rounded bg-violet-700 text-white hover:bg-violet-800 font-medium">Use this</button>
                    <button type="button" onClick={() => setExpansion(null)} className="text-xs text-slate-500 hover:text-slate-800">Dismiss</button>
                  </div>
                </div>
                <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{expansion}</pre>
                <div className="pt-2 border-t border-violet-200/60">
                  <div className="text-[11px] uppercase tracking-wide text-violet-700/70 font-semibold mb-1.5">Try a different style</div>
                  <div className="flex flex-wrap gap-1.5">
                    <StyleBtn onClick={() => expandWithAI("concise")}    disabled={expanding}>Shorter</StyleBtn>
                    <StyleBtn onClick={() => expandWithAI("detailed")}   disabled={expanding}>More detail</StyleBtn>
                    <StyleBtn onClick={() => expandWithAI("customer")}   disabled={expanding}>Customer angle</StyleBtn>
                    <StyleBtn onClick={() => expandWithAI("technical")}  disabled={expanding}>Technical angle</StyleBtn>
                    <StyleBtn onClick={() => expandWithAI("strategic")}  disabled={expanding}>Strategic / CEO</StyleBtn>
                    <StyleBtn onClick={() => expandWithAI("default")}    disabled={expanding}>Re-roll</StyleBtn>
                  </div>
                </div>
                <p className="text-[11px] text-violet-700/70">You can edit the text after clicking "Use this".</p>
              </div>
            )}
            {!expanding && !expansion && expandError && (
              <p className="text-xs text-amber-700">Expand failed: {expandError}</p>
            )}

            {/* AI suggestion result */}
            {suggestion && (suggestion.category || suggestion.card_type) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
                <span className="text-base">✨</span>
                <span className="text-sm text-indigo-900 flex-1">
                  <span className="text-indigo-600 font-medium">Suggests:</span>
                  {suggestion.category && <> Category <span className="font-medium">{suggestion.category}</span></>}
                  {suggestion.category && suggestion.card_type && ", "}
                  {suggestion.card_type && <> Type <span className="font-medium">{suggestion.card_type}</span></>}
                </span>
                <button type="button" onClick={applySuggestion} className="text-xs text-indigo-700 hover:text-indigo-900 font-medium px-2 py-1">Use ✓</button>
                <button type="button" onClick={() => setSuggestion(null)} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1">Skip</button>
              </div>
            )}

            {/* No-match feedback (AI ran but didn't suggest anything) */}
            {!suggesting && aiAvailable && !suggestion && aiError && (
              <p className="text-xs text-slate-500">
                AI couldn't pick a tag from your current Categories/Types. ({aiError})
              </p>
            )}

            {/* Category chips */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Category (optional)</div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const cc = colorClasses(c.color);
                  const selected = category === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(selected ? "" : c.name)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition
                        ${selected ? cc.chipSelected : `${cc.chip} ${cc.chipHover}`}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type chips */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Type (optional)</div>
              <div className="flex flex-wrap gap-1.5">
                {cardTypes.map((t) => {
                  const selected = cardType === t.name;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCardType(selected ? "" : t.name)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition
                        ${selected
                          ? "bg-slate-200 text-slate-900 ring-2 ring-slate-300"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 flex-wrap">
              <span className="text-xs text-slate-400">
                Project &amp; tags remembered for the next idea.
              </span>
              <button
                type="submit"
                disabled={saving || !projectId || !title.trim()}
                className={`text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition
                  ${selectedProject
                    ? `${selectedProjectColor.buttonBg} ${selectedProjectColor.buttonHoverBg}`
                    : "bg-slate-900 hover:bg-slate-800"}`}
              >
                {saving
                  ? "Adding…"
                  : selectedProject
                    ? `+ Add to ${selectedProject.name}`
                    : "+ Add idea"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Ideas waiting */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
            Ideas waiting · {filtered.length}{filtered.length !== ideas.length && <> of {ideas.length}</>}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ideas…"
                className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 pl-8 bg-white w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm"
                  title="Clear search"
                >×</button>
              )}
            </div>
            <select
              value={String(filterProject)}
              onChange={(e) => setFilterProject(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
            >
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {loading && <p className="p-6 text-sm text-slate-400">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="p-8 text-sm text-slate-400 italic text-center">
              {search ? "No ideas match your search." : "No ideas yet — drop one above."}
            </p>
          )}
          {!loading && filtered.map((c) => {
            const projectColor = projects.find((p) => p.id === c.project_id)?.color;
            const projDot = colorClasses(projectColor).dot;
            const catColor = categories.find((cat) => cat.name === c.category)?.color;
            const catCC = colorClasses(catColor);
            return (
              <div key={c.id} className="p-4 hover:bg-slate-50 transition group">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setOpenCardId(c.id)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`h-2 w-2 rounded-full ${projDot}`}></span>
                        <span className="text-slate-700 font-medium">{c.project_name}</span>
                      </span>
                      {c.category && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catCC.chip}`}>{c.category}</span>
                      )}
                      {c.card_type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{c.card_type}</span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">{ageLabel(c.created_at)}</span>
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
                    onClick={() => promote(c.id, c.title)}
                    className="opacity-0 group-hover:opacity-100 transition flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    title="Move to Design stage"
                  >
                    Send to Design →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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

function StyleBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[11px] px-2.5 py-1 rounded-md bg-white text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}
