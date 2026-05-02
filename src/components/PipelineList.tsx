"use client";
import { useEffect, useMemo, useState } from "react";
import type { CardWithMeta, Project, SessionUser, Stage, TaxonomyItem, User } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";
import CardModal from "./CardModal";

type SortKey = "title" | "project_name" | "stage" | "category" | "card_type" | "assignee_name" | "deadline" | "created_at";
type SortDir = "asc" | "desc";

const STAGE_PILL: Record<Stage, string> = {
  idea: "bg-amber-100 text-amber-900",
  design: "bg-indigo-100 text-indigo-900",
  build: "bg-violet-100 text-violet-900",
  test: "bg-pink-100 text-pink-900",
  ship: "bg-emerald-100 text-emerald-900",
};

function deadlineCountdown(d: string | null): { label: string; cls: string } | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0)   return { label: `${days}d`, cls: "text-red-700" };
  if (days === 0) return { label: "0d",       cls: "text-amber-700" };
  if (days <= 7)  return { label: `${days}d`, cls: "text-amber-700" };
  return                  { label: `${days}d`, cls: "text-emerald-700" };
}

export default function PipelineList({ currentUser }: { currentUser: SessionUser }) {
  const [cards, setCards] = useState<CardWithMeta[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState<"all" | number>("all");
  const [stage, setStage] = useState<"all" | Stage>("all");
  const [category, setCategory] = useState<"all" | string>("all");
  const [cardType, setCardType] = useState<"all" | string>("all");
  const [assigneeId, setAssigneeId] = useState<"all" | "mine" | "unassigned" | number>("all");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  async function load() {
    setLoading(true);
    const [c, p, u, t] = await Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/taxonomy").then((r) => r.json()),
    ]);
    if (c.ok) setCards(c.cards);
    if (p.ok) setProjects(p.projects);
    if (u.ok) setUsers(u.users);
    if (t.ok) {
      setCategories(t.categories.filter((x: TaxonomyItem) => !x.archived));
      setCardTypes(t.cardTypes.filter((x: TaxonomyItem) => !x.archived));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Apply filters + sort.
  const filtered = useMemo(() => {
    let list = cards.slice();

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.imagined_outcome ?? "").toLowerCase().includes(q) ||
        (c.project_name ?? "").toLowerCase().includes(q) ||
        (c.assignee_name ?? "").toLowerCase().includes(q)
      );
    }
    if (projectId !== "all") list = list.filter((c) => c.project_id === projectId);
    if (stage !== "all")     list = list.filter((c) => c.stage === stage);
    if (category !== "all")  list = list.filter((c) => c.category === category);
    if (cardType !== "all")  list = list.filter((c) => c.card_type === cardType);
    if (assigneeId === "mine") list = list.filter((c) => c.assignee_id === currentUser.id);
    else if (assigneeId === "unassigned") list = list.filter((c) => c.assignee_id == null);
    else if (typeof assigneeId === "number") list = list.filter((c) => c.assignee_id === assigneeId);

    // Sort with a stable comparator. Stage gets ordered by STAGES rank, not alpha.
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let av: string | number | null = null;
      let bv: string | number | null = null;
      if (sortKey === "stage") {
        av = STAGES.indexOf(a.stage as Stage);
        bv = STAGES.indexOf(b.stage as Stage);
      } else {
        av = (a as Record<string, unknown>)[sortKey] as string | number | null;
        bv = (b as Record<string, unknown>)[sortKey] as string | number | null;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;  // nulls always last
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });

    return list;
  }, [cards, search, projectId, stage, category, cardType, assigneeId, sortKey, sortDir, currentUser.id]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  function clearFilters() {
    setSearch(""); setProjectId("all"); setStage("all");
    setCategory("all"); setCardType("all"); setAssigneeId("all");
  }
  const hasActiveFilters = search || projectId !== "all" || stage !== "all" ||
    category !== "all" || cardType !== "all" || assigneeId !== "all";

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description, project, assignee…"
            className="flex-1 min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <Filter label="Project" value={String(projectId)} onChange={(v) => setProjectId(v === "all" ? "all" : Number(v))}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Filter>
          <Filter label="Stage" value={stage} onChange={(v) => setStage(v as "all" | Stage)}>
            <option value="all">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </Filter>
          <Filter label="Category" value={category} onChange={setCategory}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </Filter>
          <Filter label="Type" value={cardType} onChange={setCardType}>
            <option value="all">All types</option>
            {cardTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </Filter>
          <Filter label="Assignee" value={String(assigneeId)} onChange={(v) => {
            if (v === "all" || v === "mine" || v === "unassigned") setAssigneeId(v);
            else setAssigneeId(Number(v));
          }}>
            <option value="all">All assignees</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </Filter>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-slate-600 hover:text-slate-900">Clear filters</button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Showing <span className="font-medium text-slate-800">{filtered.length}</span>
          {filtered.length !== cards.length && <> of {cards.length}</>} cards.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                <Th label="Title"     onClick={() => toggleSort("title")}     active={sortKey === "title"}     dir={sortDir} />
                <Th label="Project"   onClick={() => toggleSort("project_name")} active={sortKey === "project_name"} dir={sortDir} />
                <Th label="Stage"     onClick={() => toggleSort("stage")}     active={sortKey === "stage"}     dir={sortDir} />
                <Th label="Category"  onClick={() => toggleSort("category")}  active={sortKey === "category"}  dir={sortDir} />
                <Th label="Type"      onClick={() => toggleSort("card_type")} active={sortKey === "card_type"} dir={sortDir} />
                <Th label="Assignee"  onClick={() => toggleSort("assignee_name")} active={sortKey === "assignee_name"} dir={sortDir} />
                <Th label="Due"       onClick={() => toggleSort("deadline")}  active={sortKey === "deadline"}  dir={sortDir} />
                <Th label="Created"   onClick={() => toggleSort("created_at")} active={sortKey === "created_at"} dir={sortDir} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  {hasActiveFilters ? "No cards match these filters." : "No cards yet — add your first idea."}
                </td></tr>
              )}
              {!loading && filtered.map((c) => {
                const dl = deadlineCountdown(c.deadline);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setOpenCardId(c.id)}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-slate-900 truncate" title={c.title}>{c.title}</div>
                      {c.imagined_outcome && (
                        <div className="text-xs text-slate-500 truncate" title={c.imagined_outcome}>{c.imagined_outcome}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.project_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${STAGE_PILL[c.stage as Stage]}`}>
                        {STAGE_LABELS[c.stage as Stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.category || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.card_type || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.assignee_name || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dl ? <span className={`font-medium ${dl.cls}`}>{dl.label}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

function Filter({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-600">
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm bg-white"
      >
        {children}
      </select>
    </label>
  );
}

function Th({
  label, onClick, active, dir,
}: {
  label: string; onClick: () => void; active: boolean; dir: SortDir;
}) {
  return (
    <th onClick={onClick} className="px-4 py-2.5 text-left font-semibold cursor-pointer hover:bg-slate-100 select-none">
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-slate-500">{dir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}
