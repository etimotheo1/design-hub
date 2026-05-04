"use client";
import { useEffect, useState } from "react";
import type { ProjectMember, Stage, User } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";

const STAGE_PILL: Record<Stage, string> = {
  idea: "bg-amber-100 text-amber-900 border-amber-200",
  design: "bg-indigo-100 text-indigo-900 border-indigo-200",
  build: "bg-violet-100 text-violet-900 border-violet-200",
  test: "bg-pink-100 text-pink-900 border-pink-200",
  ship: "bg-emerald-100 text-emerald-900 border-emerald-200",
};

type ApproverByStage = Record<Stage, Array<{ user_id: number; display_name: string }>>;

export default function ApprovalWorkflow({ projectId }: { projectId: number }) {
  const [byStage, setByStage] = useState<ApproverByStage | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [busyStage, setBusyStage] = useState<Stage | null>(null);

  async function load() {
    const [a, u] = await Promise.all([
      fetch(`/api/projects/${projectId}/approvers`).then((r) => r.json()),
      fetch(`/api/users`).then((r) => r.json()),
    ]);
    if (a.ok) setByStage(a.byStage as ApproverByStage);
    if (u.ok) setUsers(u.users);
  }
  useEffect(() => { load(); }, [projectId]);

  async function add(stage: Stage, userId: number) {
    setBusyStage(stage);
    await fetch(`/api/projects/${projectId}/approvers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, user_id: userId }),
    });
    setBusyStage(null);
    load();
  }

  async function remove(stage: Stage, userId: number) {
    setBusyStage(stage);
    await fetch(`/api/projects/${projectId}/approvers?stage=${stage}&user_id=${userId}`, { method: "DELETE" });
    setBusyStage(null);
    load();
  }

  if (!byStage) return <p className="text-sm text-slate-400">Loading approval rules…</p>;

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Pick who can approve moving cards into each stage. If no one is set, anyone with project access can move cards in. Admins can always move cards.
      </div>

      {/* End-to-end visual chain */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-2 min-w-max">
          {STAGES.map((s, i) => {
            const approvers = byStage[s] ?? [];
            const ids = new Set(approvers.map((a) => a.user_id));
            const addable = users.filter((u) => !ids.has(u.id));
            const isLast = i === STAGES.length - 1;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`rounded-lg border-2 ${STAGE_PILL[s]} p-3 w-44`}>
                  <div className="text-[11px] uppercase tracking-wide font-bold mb-1">→ {STAGE_LABELS[s]}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-600 mb-1.5">Approvers</div>
                  {approvers.length === 0 ? (
                    <p className="text-[11px] italic text-slate-500">Anyone (default)</p>
                  ) : (
                    <ul className="space-y-1 mb-2">
                      {approvers.map((a) => (
                        <li key={a.user_id} className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate">{a.display_name}</span>
                          <button
                            onClick={() => remove(s, a.user_id)}
                            disabled={busyStage === s}
                            className="text-slate-500 hover:text-red-600 disabled:opacity-50"
                            title="Remove"
                          >×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {addable.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) add(s, Number(e.target.value)); }}
                      disabled={busyStage === s}
                      className="w-full text-[11px] rounded border border-slate-300 px-1 py-0.5 bg-white"
                    >
                      <option value="">+ Add approver…</option>
                      {addable.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  )}
                </div>
                {!isLast && <div className="text-slate-300 text-xl flex-shrink-0">→</div>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500 italic">
        Tip: leave Idea open (no approvers) so anyone can capture ideas. Add approvers to Design, Build, Test, Ship to gate quality at each step.
      </p>
    </div>
  );
}
