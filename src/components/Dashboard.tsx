"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Stage } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";

type DashboardData = {
  total: number;
  counts: Record<Stage, number>;
  avgTimes: Record<Stage, { avg_seconds: number; samples: number }>;
  deadlineCards: Array<{
    id: number; title: string; deadline: string; stage: Stage;
    project_name: string; assignee_name: string | null;
  }>;
  byCategory: Array<{ category: string | null; count: number }>;
  byType: Array<{ card_type: string | null; count: number }>;
};

const STAGE_ACCENT: Record<Stage, string> = {
  idea: "bg-amber-200 text-amber-900",
  design: "bg-indigo-200 text-indigo-900",
  build: "bg-violet-200 text-violet-900",
  test: "bg-pink-200 text-pink-900",
  ship: "bg-emerald-200 text-emerald-900",
};

const STAGE_BAR: Record<Stage, string> = {
  idea: "bg-amber-400",
  design: "bg-indigo-400",
  build: "bg-violet-400",
  test: "bg-pink-400",
  ship: "bg-emerald-400",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const days = seconds / 86400;
  if (days >= 1) return `${days.toFixed(1)}d`;
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  const mins = seconds / 60;
  return `${mins.toFixed(0)}m`;
}

function deadlineLabel(d: string): { label: string; cls: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const hasTime = d.length > 10;
  const due = new Date(hasTime ? d : `${d}T00:00:00`);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  const days = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  const formatted = due.toLocaleString(undefined, hasTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
  if (days < 0)  return { label: `Overdue (${Math.abs(days)}d) · ${formatted}`, cls: "text-red-700 bg-red-50" };
  if (days === 0) return { label: `Today · ${formatted}`, cls: "text-amber-700 bg-amber-50" };
  return { label: `In ${days}d · ${formatted}`, cls: "text-slate-700 bg-slate-50" };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((j) => {
      if (j.ok) setData(j);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 rounded-xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-red-600">Could not load dashboard.</p>;

  const maxCount = Math.max(1, ...STAGES.map((s) => data.counts[s]));
  const maxByCategory = Math.max(1, ...data.byCategory.map((r) => r.count));
  const maxByType = Math.max(1, ...data.byType.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* Top headline tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAGES.map((s) => (
          <div key={s} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${STAGE_ACCENT[s]}`}>
              {STAGE_LABELS[s]}
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{data.counts[s]}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              avg {formatDuration(data.avgTimes[s].avg_seconds)}
              {data.avgTimes[s].samples > 0 && (
                <span className="text-slate-400"> · {data.avgTimes[s].samples} sample{data.avgTimes[s].samples === 1 ? "" : "s"}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stage counts as a bar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Cards by stage</h2>
            <span className="text-xs text-slate-500">{data.total} total active</span>
          </div>
          <div className="space-y-3">
            {STAGES.map((s) => (
              <div key={s}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">{STAGE_LABELS[s]}</span>
                  <span className="text-slate-500">
                    {data.counts[s]}{data.total > 0 ? ` · ${Math.round((data.counts[s] / data.total) * 100)}%` : ""}
                    <span className="text-slate-400"> · avg {formatDuration(data.avgTimes[s].avg_seconds)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${STAGE_BAR[s]} transition-all`}
                    style={{ width: `${(data.counts[s] / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            "Avg" is the average time a card historically spent in that stage. Builds up as cards move forward.
          </p>
        </div>

        {/* Deadlines */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Deadlines · next 7 days</h2>
          {data.deadlineCards.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nothing overdue or due soon. ✨</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto thin-scroll">
              {data.deadlineCards.map((c) => {
                const dl = deadlineLabel(c.deadline);
                return (
                  <li key={c.id} className="border border-slate-200 rounded-lg p-2.5">
                    <Link href="/board" className="block">
                      <div className="text-sm font-medium text-slate-900 truncate">{c.title}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {c.project_name} · {STAGE_LABELS[c.stage]}
                        {c.assignee_name && ` · ${c.assignee_name}`}
                      </div>
                      <div className={`mt-1 inline-block text-[11px] px-1.5 py-0.5 rounded font-medium ${dl.cls}`}>{dl.label}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Category + Type breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title="By category"
          rows={data.byCategory.map((r) => ({ label: r.category ?? "(uncategorized)", count: r.count }))}
          max={maxByCategory}
          barClass="bg-indigo-400"
        />
        <BreakdownCard
          title="By type"
          rows={data.byType.map((r) => ({ label: r.card_type ?? "(no type)", count: r.count }))}
          max={maxByType}
          barClass="bg-cyan-400"
        />
      </div>
    </div>
  );
}

function BreakdownCard({
  title, rows, max, barClass,
}: {
  title: string;
  rows: { label: string; count: number }[];
  max: number;
  barClass: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No data yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-700">{r.label}</span>
                <span className="text-slate-500">{r.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full ${barClass} transition-all`}
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
