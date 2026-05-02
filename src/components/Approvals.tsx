"use client";
import { useEffect, useState } from "react";
import type { Invitation, SessionUser, Stage } from "@/lib/types";
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

type ApprovalsData = {
  stuckIdeas: ApprovalCard[];
  overdueCards: ApprovalCard[];
  dueSoon: ApprovalCard[];
  pendingInvites: (Invitation & { invited_by_name: string })[];
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
  const [loading, setLoading] = useState(true);
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const json = await res.json();
    if (json.ok) setData(json);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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
    data.stuckIdeas.length + data.overdueCards.length + data.dueSoon.length + data.pendingInvites.length;

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
