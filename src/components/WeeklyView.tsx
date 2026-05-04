"use client";
import { useEffect, useMemo, useState } from "react";
import type { Project, SessionUser, Stage } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { colorClasses } from "@/lib/colors";
import CardModal from "./CardModal";

type DueCard = {
  id: number; title: string; stage: Stage; deadline: string;
  project_id: number; project_name: string; project_color: string | null;
  assignee_id: number | null; assignee_name: string | null;
  shipped_at?: string | null;
};
type Leader = { user_id: number; display_name: string; due_count: number; shipped_count: number };
type Throughput = { week_start: string; shipped: number };

type WeeklyData = {
  week_start: string;
  week_end: string;
  dueThisWeek: DueCard[];
  shippedThisWeek: DueCard[];
  leaderboard: Leader[];
  throughput: Throughput[];
};

const STAGE_PILL: Record<Stage, string> = {
  idea: "bg-amber-100 text-amber-900",
  design: "bg-indigo-100 text-indigo-900",
  build: "bg-violet-100 text-violet-900",
  test: "bg-pink-100 text-pink-900",
  ship: "bg-emerald-100 text-emerald-900",
};

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoMonday(d: Date): string {
  const x = new Date(d); x.setHours(0,0,0,0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return ymd(x);
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function fmtRange(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const sameMonth = f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
  const fStr = f.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const tStr = t.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  return `${fStr} – ${tStr}`;
}
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function WeeklyView({ currentUser }: { currentUser: SessionUser }) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [weekStart, setWeekStart] = useState<string>(isoMonday(new Date()));
  const [scope, setScope] = useState<"mine" | "team" | "all">("all");
  const [projectFilter, setProjectFilter] = useState<"all" | number>("all");
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ week_start: weekStart, scope });
    if (projectFilter !== "all") params.set("project_id", String(projectFilter));
    const [w, p] = await Promise.all([
      fetch(`/api/weekly?${params.toString()}`).then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    if (w.ok) setData(w);
    if (p.ok) setProjects(p.projects);
    setLoading(false);
  }
  useEffect(() => { load(); }, [weekStart, scope, projectFilter]);

  const today = ymd(new Date());
  const isThisWeek = weekStart === isoMonday(new Date());

  // Group due-this-week cards by day for a calendar-strip layout.
  const groupedByDay = useMemo(() => {
    if (!data) return {} as Record<string, DueCard[]>;
    const map: Record<string, DueCard[]> = {};
    for (let i = 0; i < 7; i++) map[addDays(weekStart, i)] = [];
    for (const c of data.dueThisWeek) {
      const day = c.deadline.slice(0, 10);
      if (map[day]) map[day].push(c);
    }
    return map;
  }, [data, weekStart]);

  const maxThroughput = data ? Math.max(1, ...data.throughput.map((t) => t.shipped)) : 1;

  return (
    <div className="space-y-6">
      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Week navigator */}
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="text-sm px-2 py-1 rounded hover:bg-slate-100" aria-label="Previous week">←</button>
            <div className="text-sm font-medium text-slate-900 px-2">
              {data ? fmtRange(data.week_start, data.week_end) : "…"}
              {isThisWeek && <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">This week</span>}
            </div>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="text-sm px-2 py-1 rounded hover:bg-slate-100" aria-label="Next week">→</button>
            {!isThisWeek && (
              <button onClick={() => setWeekStart(isoMonday(new Date()))} className="text-xs px-2 py-1 rounded text-indigo-600 hover:text-indigo-800 ml-1">Jump to this week</button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Filter label="Scope" value={scope} onChange={(v) => setScope(v as "mine" | "team" | "all")}>
              <option value="all">Everyone</option>
              <option value="team">Team</option>
              <option value="mine">Just me</option>
            </Filter>
            <Filter label="Project" value={String(projectFilter)} onChange={(v) => setProjectFilter(v === "all" ? "all" : Number(v))}>
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Filter>
          </div>
        </div>
      </div>

      {loading || !data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Headline tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Tile label="Due this week"      value={data.dueThisWeek.length}     tint="amber"   />
            <Tile label="Shipped this week"  value={data.shippedThisWeek.length} tint="emerald" />
            <Tile label="Active deliverers"  value={data.leaderboard.length}     tint="indigo"  />
          </div>

          {/* Day strip */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Deadlines by day</h2>
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {Object.entries(groupedByDay).map(([day, cards]) => (
                <div key={day} className={`rounded-lg border p-2 min-h-[110px] ${day === today ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="text-[11px] font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    {dayLabel(day)}
                    {day === today && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-indigo-600 text-white">Today</span>}
                  </div>
                  {cards.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {cards.map((c) => (
                        <li key={c.id}>
                          <button onClick={() => setOpenCardId(c.id)} className="w-full text-left text-[11px] bg-white rounded border border-slate-200 px-1.5 py-1 hover:border-indigo-400 hover:shadow-sm">
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${colorClasses(c.project_color).dot}`}></span>
                              <span className="truncate text-slate-900 font-medium">{c.title}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`text-[9px] uppercase tracking-wide px-1 py-0.5 rounded font-semibold ${STAGE_PILL[c.stage]}`}>{STAGE_LABELS[c.stage]}</span>
                              {c.assignee_name && <span className="text-[10px] text-slate-500 truncate">{c.assignee_name}</span>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Leaderboard */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Top deliverers this week</h2>
              {data.leaderboard.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No assigned deliverables in this scope.</p>
              ) : (
                <ul className="space-y-2">
                  {data.leaderboard.map((l, i) => {
                    const total = l.due_count + l.shipped_count;
                    return (
                      <li key={l.user_id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-6 text-right">#{i + 1}</span>
                        <span className="text-sm font-medium text-slate-900 flex-1 truncate">{l.display_name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800" title="Due this week">{l.due_count} due</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700" title="Shipped this week">{l.shipped_count} shipped</span>
                          <span className="text-slate-500 font-medium">· {total} total</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Throughput chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Shipped per week</h2>
              <ul className="space-y-1.5">
                {data.throughput.map((t) => (
                  <li key={t.week_start} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 w-16">{new Date(`${t.week_start}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    <div className="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${(t.shipped / maxThroughput) * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-6 text-right">{t.shipped}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Shipped this week list */}
          {data.shippedThisWeek.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Shipped this week ({data.shippedThisWeek.length})</h2>
              <ul className="divide-y divide-slate-100">
                {data.shippedThisWeek.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setOpenCardId(c.id)} className="w-full text-left py-2.5 hover:bg-slate-50 px-2 rounded">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`h-2 w-2 rounded-full ${colorClasses(c.project_color).dot}`}></span>
                        <span className="text-xs text-slate-500">{c.project_name}</span>
                        <span className="text-sm font-medium text-slate-900">{c.title}</span>
                        {c.assignee_name && <span className="text-xs text-slate-500 ml-auto">{c.assignee_name}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {openCardId !== null && (
        <CardModal cardId={openCardId} currentUser={currentUser} onClose={() => setOpenCardId(null)} onChange={load} />
      )}
    </div>
  );
}

function Tile({ label, value, tint }: { label: string; value: number; tint: "amber" | "emerald" | "indigo" }) {
  const cls = tint === "amber" ? "bg-amber-50 text-amber-900 border-amber-200"
            : tint === "emerald" ? "bg-emerald-50 text-emerald-900 border-emerald-200"
            : "bg-indigo-50 text-indigo-900 border-indigo-200";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-600">
      <span>{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm bg-white">
        {children}
      </select>
    </label>
  );
}
