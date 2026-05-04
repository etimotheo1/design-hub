"use client";
import { useEffect, useState } from "react";
import type { Stage } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";

// Dialog for moving a card to a different stage. Always requires a summary.
// Attachments optional but encouraged. Sends the request — backend decides
// whether the user has direct approval rights (auto-approved) or has to wait
// for an approver (pending).

interface Props {
  cardId: number;
  cardTitle: string;
  currentStage: Stage;
  toStage: Stage;
  onClose: () => void;
  onDone: (status: "moved" | "pending") => void;
}

export default function MoveCardDialog({ cardId, cardTitle, currentStage, toStage, onClose, onDone }: Props) {
  const [summary, setSummary] = useState("");
  const [attachments, setAttachments] = useState<Array<{ label: string; url: string }>>([]);
  const [attLabel, setAttLabel] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addAttachment() {
    if (!attLabel.trim() || !attUrl.trim()) return;
    setAttachments([...attachments, { label: attLabel.trim(), url: attUrl.trim() }]);
    setAttLabel(""); setAttUrl("");
  }
  function removeAttachment(i: number) {
    setAttachments(attachments.filter((_, idx) => idx !== i));
  }

  async function generateSummary() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Update for: ${cardTitle}`,
          imagined: `Just completed ${STAGE_LABELS[currentStage]} — ready to move to ${STAGE_LABELS[toStage]}.`,
          style: "concise",
        }),
      });
      const j = await res.json();
      if (j.ok && j.result?.expansion) {
        setSummary(j.result.expansion);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (summary.trim().length < 5) { setError("Please write a short summary of what was done."); return; }
    setSaving(true); setError(null);

    const res = await fetch(`/api/cards/${cardId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_stage: toStage, summary: summary.trim(), attachments }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not move card."); return; }
    onDone(data.status as "moved" | "pending");
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Move card</div>
            <h2 className="text-base font-semibold text-slate-900 truncate">{cardTitle}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Stage chips */}
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium uppercase">{STAGE_LABELS[currentStage]}</span>
            <span className="text-slate-400">→</span>
            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-xs font-medium uppercase">{STAGE_LABELS[toStage]}</span>
          </div>

          {/* Summary (required) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide">Summary <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={generateSummary}
                disabled={generating}
                className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded text-violet-700 hover:bg-violet-50 border border-violet-200 disabled:opacity-50"
                title="Use AI to draft a summary"
              >
                <span>✨</span> {generating ? "Drafting…" : "AI draft"}
              </button>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="What was completed? Why is this card ready for the next stage?"
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              minLength={5}
            />
            <p className="text-[11px] text-slate-500 mt-1">Required. This becomes part of the card's history and tells approvers what was done.</p>
          </div>

          {/* Attachments / links */}
          <div>
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">Attachments / links</label>
            {attachments.length > 0 && (
              <ul className="space-y-1 mb-2">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1.5">
                    <span className="text-slate-400">📎</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-900 truncate">{a.label}</div>
                      <div className="text-[11px] text-slate-500 truncate font-mono">{a.url}</div>
                    </div>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={attLabel}
                onChange={(e) => setAttLabel(e.target.value)}
                placeholder="Label (e.g. Test report)"
                className="flex-1 text-sm rounded-lg border border-slate-300 px-3 py-1.5"
              />
              <input
                value={attUrl}
                onChange={(e) => setAttUrl(e.target.value)}
                placeholder="URL or path"
                className="flex-1 text-sm rounded-lg border border-slate-300 px-3 py-1.5"
              />
              <button type="button" onClick={addAttachment} className="text-sm px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300">Add</button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Optional but recommended — Figma links, GitHub PRs, test reports, photos.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
            <button
              type="submit"
              disabled={saving || summary.trim().length < 5}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Submitting…" : `Move to ${STAGE_LABELS[toStage]} →`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
