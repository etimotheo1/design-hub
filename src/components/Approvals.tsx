"use client";
import { useEffect, useState } from "react";
import type { Invitation, Project, SessionUser, Stage } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import CardModal from "./CardModal";

type ApprovalCard = {
  id: number;
  title: string;
  project_name: string;
  stage: Stage;
  category: string | null;
  card_type: string | null;
  deadline: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  comment_count: number;
};

type PendingSubmission = {
  id: number;
  title: string;
  imagined_outcome: string | null;
  suggested_project_name: string;
  external_submitter_name: string | null;
  external_submitter_email: string | null;
  created_at: string;
};

type PendingMove = {
  id: number;
  card_id: number;
  card_title: string;
  project_id: number;
  project_name: string;
  from_stage: Stage;
  to_stage: Stage;
  summary: string;
  requested_by: number;
  requested_by_name: string;
  created_at: string;
  attachments: { label: string; url: string }[];
};

type ApprovalsData = {
  stuckIdeas: ApprovalCard[];
  overdueCards: ApprovalCard[];
  dueSoon: ApprovalCard[];
  pendingInvites: (Invitation & { invited_by_name: string })[];
  pendingSubmissions: PendingSubmission[];
  pendingMoves: PendingMove[];
};

const STAGE_PILL: Record<Stage, string> = {
  idea: "bg-amber-100 text-amber-900",
  design: "bg-indigo-100 text-indigo-900",
  build: "bg-violet-100 text-violet-900",
  test: "bg-pink-100 text-pink-900",
  ship: "bg-emerald-100 text-emerald-900",
};

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function deadlineDays(d: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function Approvals({ currentUser }: { currentUser: SessionUser }) {
  const [data, setData] = useState<ApprovalsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [a, p] = await Promise.all([
      fetch("/api/approvals").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    if (a.ok) setData(a);
    if (p.ok) setProjects(p.projects);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function approveAsExisting(cardId: number, projectId: number) {
    await fetch(`/api/cards/${cardId}/assign-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    load();
  }

  async function approveAsNew(cardId: number, name: string) {
    if (!name.trim()) return;
    await fetch(`/api/cards/${cardId}/assign-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ create_project: { name: name.trim() } }),
    });
    load();
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/accept-invite/${token}`;
    await navigator.clipboard?.writeText(url);
  }
  async function revokeInvite(token: string) {
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    await fetch(`/api/invitations/${token}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600">Could not load.</p>;

  const totalAttention =
    data.stuckIdeas.length + data.overdueCards.length + data.dueSoon.length +
    data.pendingInvites.length + (data.pendingSubmissions?.length ?? 0) +
    (data.pendingMoves?.length ?? 0);

  async function approveMove(moveId: number, note?: string) {
    await fetch(`/api/stage-moves/${moveId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || null }),
    });
    load();
  }
  async function rejectMove(moveId: number, note?: string) {
    await fetch(`/api/stage-moves/${moveId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || null }),
    });
    load();
  }

  if (totalAttention === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="text-4xl mb-2">✨</div>
        <h2 className="font-semibold text-slate-900">All clear</h2>
        <p className="text-sm text-slate-500 mt-1">Nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.pendingMoves && data.pendingMoves.length > 0 && (
        <Section
          title={`Stage move requests (${data.pendingMoves.length})`}
          tint="indigo"
          subtitle="Team members are asking to advance these cards. Review the summary and approve or send back."
        >
          {data.pendingMoves.map((m) => (
            <PendingMoveRow
              key={m.id}
              move={m}
              onApprove={(note) => approveMove(m.id, note)}
              onReject={(note) => rejectMove(m.id, note)}
              onOpen={() => setOpenCardId(m.card_id)}
            />
          ))}
        </Section>
      )}

      {currentUser.role === "admin" && data.pendingSubmissions && data.pendingSubmissions.length > 0 && (
        <Section
          title={`New project suggestions (${data.pendingSubmissions.length})`}
          tint="indigo"
          subtitle="Submitted via a public form. Either move the idea to an existing project, or create the suggested new project."
        >
          {data.pendingSubmissions.map((s) => (
            <PendingRow
              key={s.id}
              submission={s}
              projects={projects.filter((p) => !p.archived)}
              onApproveExisting={(pid) => approveAsExisting(s.id, pid)}
              onApproveNew={(name) => approveAsNew(s.id, name)}
              onOpen={() => setOpenCardId(s.id)}
            />
          ))}
        </Section>
      )}

      {data.overdueCards.length > 0 && (
        <Section
          title={`Overdue (${data.overdueCards.length})`}
          tint="red"
          subtitle="Deadlines have passed. These need to ship or have a new deadline."
        >
          {data.overdueCards.map((c) => (
            <CardRow key={c.id} card={c} onClick={() => setOpenCardId(c.id)}
              badge={<span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">{deadlineDays(c.deadline!)}d</span>} />
          ))}
        </Section>
      )}

      {data.dueSoon.length > 0 && (
        <Section
          title={`Due in next 7 days (${data.dueSoon.length})`}
          tint="amber"
          subtitle="Approaching deadlines. Make a plan."
        >
          {data.dueSoon.map((c) => (
            <CardRow key={c.id} card={c} onClick={() => setOpenCardId(c.id)}
              badge={<span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{deadlineDays(c.deadline!)}d</span>} />
          ))}
        </Section>
      )}

      {data.stuckIdeas.length > 0 && (
        <Section
          title={`Untriaged ideas (${data.stuckIdeas.length})`}
          tint="slate"
          subtitle="Ideas waiting more than 3 days in the bucketlist. Promote, comment, or delete."
        >
          {data.stuckIdeas.map((c) => (
            <CardRow key={c.id} card={c} onClick={() => setOpenCardId(c.id)}
              badge={<span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{ageDays(c.created_at)}d old</span>} />
          ))}
        </Section>
      )}

      {currentUser.role === "admin" && data.pendingInvites.length > 0 && (
        <Section
          title={`Pending invitations (${data.pendingInvites.length})`}
          tint="indigo"
          subtitle="People you've invited who haven't joined yet."
        >
          {data.pendingInvites.map((inv) => (
            <div key={inv.token} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{inv.display_name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {inv.email} · expires {new Date(inv.expires_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button onClick={() => copyInviteLink(inv.token)} className="text-indigo-600 hover:text-indigo-800">Copy link</button>
                <button onClick={() => revokeInvite(inv.token)} className="text-red-600 hover:text-red-800">Revoke</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {openCardId !== null && (
        <CardModal cardId={openCardId} currentUser={currentUser} onClose={() => setOpenCardId(null)} onChange={load} />
      )}
    </div>
  );
}

function Section({
  title, tint, subtitle, children,
}: {
  title: string;
  tint: "red" | "amber" | "indigo" | "slate";
  subtitle: string;
  children: React.ReactNode;
}) {
  const tintClass = {
    red: "border-red-200",
    amber: "border-amber-200",
    indigo: "border-indigo-200",
    slate: "border-slate-200",
  }[tint];
  return (
    <div className={`bg-white rounded-xl border ${tintClass} shadow-sm overflow-hidden`}>
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function PendingRow({
  submission, projects, onApproveExisting, onApproveNew, onOpen,
}: {
  submission: PendingSubmission;
  projects: Project[];
  onApproveExisting: (projectId: number) => void;
  onApproveNew: (name: string) => void;
  onOpen: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "existing" | "new">("choose");
  const [pickedProject, setPickedProject] = useState<number | "">("");
  const [newName, setNewName] = useState(submission.suggested_project_name);

  return (
    <div className="px-4 py-3 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button onClick={onOpen} className="text-left min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900">{submission.title}</div>
          {submission.imagined_outcome && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{submission.imagined_outcome}</p>
          )}
          <div className="text-[11px] text-slate-500 mt-1.5">
            From {submission.external_submitter_name}
            {submission.external_submitter_email && <> · {submission.external_submitter_email}</>}
          </div>
          <div className="mt-1.5 inline-block text-[11px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
            Suggested project: {submission.suggested_project_name}
          </div>
        </button>
      </div>

      {mode === "choose" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => { setMode("new"); }} className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            ✓ Create "{submission.suggested_project_name}"
          </button>
          <button onClick={() => setMode("existing")} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">
            → Move to existing project
          </button>
        </div>
      )}

      {mode === "new" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[12rem] text-sm rounded-lg border border-slate-300 px-3 py-1.5"
            placeholder="Project name"
          />
          <button onClick={() => onApproveNew(newName)} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Create &amp; move</button>
          <button onClick={() => setMode("choose")} className="text-xs text-slate-500 hover:text-slate-800">Cancel</button>
        </div>
      )}

      {mode === "existing" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={pickedProject === "" ? "" : String(pickedProject)}
            onChange={(e) => setPickedProject(e.target.value ? Number(e.target.value) : "")}
            className="flex-1 min-w-[12rem] text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
          >
            <option value="">Choose a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => typeof pickedProject === "number" && onApproveExisting(pickedProject)}
            disabled={pickedProject === ""}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >Move card</button>
          <button onClick={() => setMode("choose")} className="text-xs text-slate-500 hover:text-slate-800">Cancel</button>
        </div>
      )}
    </div>
  );
}

function PendingMoveRow({
  move, onApprove, onReject, onOpen,
}: {
  move: PendingMove;
  onApprove: (note?: string) => void;
  onReject: (note?: string) => void;
  onOpen: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "approving" | "rejecting">("idle");
  const [note, setNote] = useState("");

  return (
    <div className="px-4 py-3 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button onClick={onOpen} className="text-left min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-slate-500 truncate">{move.project_name}</span>
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${STAGE_PILL[move.from_stage]}`}>
              {STAGE_LABELS[move.from_stage]}
            </span>
            <span className="text-slate-400 text-xs">→</span>
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${STAGE_PILL[move.to_stage]}`}>
              {STAGE_LABELS[move.to_stage]}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-900">{move.card_title}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Requested by <span className="font-medium">{move.requested_by_name}</span>
            {" · "}
            {new Date(move.created_at).toLocaleString()}
          </div>
        </button>
      </div>

      <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Summary</div>
        <p className="text-sm text-slate-800 whitespace-pre-wrap">{move.summary}</p>
        {move.attachments.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {move.attachments.map((a, i) => (
              <li key={i} className="text-xs flex items-center gap-1.5">
                <span className="text-slate-400">📎</span>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline truncate">
                  {a.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mode === "idle" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onApprove()}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            ✓ Approve &amp; move
          </button>
          <button
            onClick={() => setMode("rejecting")}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
          >
            Send back
          </button>
        </div>
      )}

      {mode === "rejecting" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason (optional) — what should they fix or add?"
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onReject(note)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Send back
            </button>
            <button
              onClick={() => { setMode("idle"); setNote(""); }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CardRow({
  card, onClick, badge,
}: {
  card: ApprovalCard;
  onClick: () => void;
  badge: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs text-slate-500 truncate">{card.project_name}</span>
          <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${STAGE_PILL[card.stage]}`}>
            {STAGE_LABELS[card.stage]}
          </span>
          {card.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{card.category}</span>}
        </div>
        <div className="text-sm font-medium text-slate-900">{card.title}</div>
        <div className="text-[11px] text-slate-500 mt-1">
          {card.assignee_name ? `Assigned to ${card.assignee_name}` : "Unassigned"}
          {card.comment_count > 0 && <> · 💬 {card.comment_count}</>}
        </div>
      </div>
      <div className="flex-shrink-0">{badge}</div>
    </button>
  );
}
