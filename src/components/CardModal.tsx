"use client";
import { useCallback, useEffect, useState } from "react";
import type { Card, Comment, Attachment, Stage, SessionUser, User, TaxonomyItem, Collaborator } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";
import DateTimePicker from "./DateTimePicker";
import MoveCardDialog from "./MoveCardDialog";

type SubmissionAnswer = { field_label: string; field_type: string; value: string | null; position: number };

type Loaded = {
  card: Card & { project_name: string; created_by_name: string; assignee_name: string | null };
  comments: (Comment & { author_name: string })[];
  attachments: Attachment[];
  collaborators: Collaborator[];
  submissionAnswers?: SubmissionAnswer[];
};

// Convert deadline value (date or datetime string) to the format <input type="datetime-local">
// expects: "YYYY-MM-DDTHH:MM". Backwards compatible with old date-only values
// (we treat midnight, but render with default 14:00 if user is selecting fresh).
function deadlineForInput(d: string | null): string {
  if (!d) return "";
  if (d.length === 10) return `${d}T14:00`; // legacy date-only → assume 2pm
  return d.slice(0, 16);                    // trim seconds if any
}

export default function CardModal({
  cardId,
  currentUser,
  onClose,
  onChange,
}: {
  cardId: number;
  currentUser: SessionUser;
  onClose: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imagined, setImagined] = useState("");
  const [newComment, setNewComment] = useState("");
  const [attLabel, setAttLabel] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [expanding, setExpanding] = useState(false);
  const [expansion, setExpansion] = useState<string | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<Stage | null>(null);
  const [moveNotice, setMoveNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cards/${cardId}`);
    const json = await res.json();
    if (json.ok) {
      setData(json);
      setTitle(json.card.title);
      setDescription(json.card.description || "");
      setImagined(json.card.imagined_outcome || "");
    }
  }, [cardId]);

  useEffect(() => {
    load();
    fetch("/api/users").then((r) => r.json()).then((j) => { if (j.ok) setUsers(j.users); });
    fetch("/api/taxonomy").then((r) => r.json()).then((j) => {
      if (j.ok) {
        setCategories(j.categories.filter((c: TaxonomyItem) => !c.archived));
        setCardTypes(j.cardTypes.filter((c: TaxonomyItem) => !c.archived));
      }
    });
  }, [load]);

  if (!data) {
    return (
      <Modal onClose={onClose} title="Loading…">
        <p className="text-sm text-slate-500">Fetching card…</p>
      </Modal>
    );
  }

  const { card, comments, attachments, collaborators, submissionAnswers } = data;
  const collaboratorIds = new Set(collaborators.map((c) => c.user_id));
  const addableUsers = users.filter((u) => !collaboratorIds.has(u.id) && u.id !== card.assignee_id);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    onChange();
  }

  async function saveEdits() {
    await patch({ title, description, imagined_outcome: imagined });
    setEditing(false);
  }

  async function addComment() {
    if (!newComment.trim()) return;
    await fetch(`/api/cards/${cardId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    setNewComment("");
    await load();
    onChange();
  }

  async function addAttachment() {
    if (!attLabel.trim() || !attUrl.trim()) return;
    await fetch(`/api/cards/${cardId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: attLabel, url: attUrl }),
    });
    setAttLabel(""); setAttUrl("");
    await load();
    onChange();
  }

  async function removeAttachment(id: number) {
    await fetch(`/api/cards/${cardId}/attachments?attachment_id=${id}`, { method: "DELETE" });
    await load();
    onChange();
  }

  async function addCollaborator(userId: number) {
    if (!userId) return;
    await fetch(`/api/cards/${cardId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    await load();
    onChange();
  }

  async function removeCollaborator(userId: number) {
    await fetch(`/api/cards/${cardId}/collaborators?user_id=${userId}`, { method: "DELETE" });
    await load();
    onChange();
  }

  async function deleteCard() {
    if (!confirm("Delete this card permanently?")) return;
    await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    onChange();
    onClose();
  }

  async function expandWithAI(style: string = "default") {
    if (!data) return;
    setExpanding(true);
    setExpandError(null);
    try {
      const res = await fetch("/api/ai/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing ? title : data.card.title,
          imagined: editing ? imagined : (data.card.imagined_outcome ?? ""),
          project: data.card.project_name,
          style,
        }),
      });
      const j = await res.json();
      if (j.ok && j.result?.expansion) setExpansion(j.result.expansion);
      else if (j.error) setExpandError(j.error);
    } catch (e) {
      setExpandError(e instanceof Error ? e.message : "Network error");
    } finally {
      setExpanding(false);
    }
  }

  async function applyExpansion() {
    if (!expansion) return;
    if (editing) {
      setImagined(expansion);
    } else {
      await patch({ imagined_outcome: expansion });
    }
    setExpansion(null);
  }

  return (
    <Modal onClose={onClose} title={card.project_name}>
      <div className="space-y-4">
        {/* Title */}
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        ) : (
          <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
        )}

        {/* Stage display + move buttons (every move requires summary via dialog) */}
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500">Stage:</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-medium uppercase tracking-wide">
              {STAGE_LABELS[card.stage as Stage]}
            </span>
            <span className="text-slate-400 text-xs">Move to →</span>
            {STAGES.filter((s) => s !== card.stage).map((s) => (
              <button
                key={s}
                onClick={() => setMoveTo(s)}
                className="text-xs px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700"
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
          <div>
            <span className="text-slate-500 mr-2">Assignee:</span>
            <select
              value={card.assignee_id ?? ""}
              onChange={(e) => patch({ assignee_id: e.target.value ? Number(e.target.value) : null })}
              className="rounded-lg border border-slate-300 px-2 py-1 bg-white"
            >
              <option value="">— unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500 ml-auto">
            Created by {card.created_by_name} · {new Date(card.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Category, Type, Deadline */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="block text-xs text-slate-500 mb-1">Category</span>
            <select
              value={(card.category as string) ?? ""}
              onChange={(e) => patch({ category: e.target.value || null })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
            >
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Type</span>
            <select
              value={(card.card_type as string) ?? ""}
              onChange={(e) => patch({ card_type: e.target.value || null })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
            >
              <option value="">— none —</option>
              {cardTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Deadline</span>
            <DateTimePicker
              value={card.deadline}
              onChange={(v) => patch({ deadline: v })}
            />
          </div>
        </div>

        {/* Description */}
        <Section label="Description">
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          ) : (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {card.description || <span className="text-slate-400 italic">No description.</span>}
            </p>
          )}
        </Section>

        {/* Imagined outcome */}
        <Section label="What we imagine">
          {editing ? (
            <textarea
              value={imagined}
              onChange={(e) => setImagined(e.target.value)}
              rows={imagined.length > 300 ? 10 : 4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="What success looks like for the ideator."
            />
          ) : (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {card.imagined_outcome || <span className="text-slate-400 italic">No imagined outcome captured.</span>}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => expandWithAI("default")}
              disabled={expanding || !(editing ? title.trim() : card.title)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
              title="Use Claude to expand this into a richer briefing"
            >
              <span>✨</span>
              {expanding ? "Expanding…" : "Expand with AI"}
            </button>
            {expandError && <span className="text-xs text-amber-700">{expandError}</span>}
          </div>
          {expansion && (
            <div className="mt-3 rounded-lg bg-violet-50 border border-violet-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-violet-800">✨ Suggested briefing</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={applyExpansion} className="text-xs px-2 py-1 rounded bg-violet-700 text-white hover:bg-violet-800 font-medium">Replace with this</button>
                  <button type="button" onClick={() => setExpansion(null)} className="text-xs text-slate-500 hover:text-slate-800">Dismiss</button>
                </div>
              </div>
              <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{expansion}</pre>
              <div className="pt-2 border-t border-violet-200/60">
                <div className="text-[11px] uppercase tracking-wide text-violet-700/70 font-semibold mb-1.5">Try a different style</div>
                <div className="flex flex-wrap gap-1.5">
                  <StyleBtn onClick={() => expandWithAI("concise")}   disabled={expanding}>Shorter</StyleBtn>
                  <StyleBtn onClick={() => expandWithAI("detailed")}  disabled={expanding}>More detail</StyleBtn>
                  <StyleBtn onClick={() => expandWithAI("customer")}  disabled={expanding}>Customer angle</StyleBtn>
                  <StyleBtn onClick={() => expandWithAI("technical")} disabled={expanding}>Technical angle</StyleBtn>
                  <StyleBtn onClick={() => expandWithAI("strategic")} disabled={expanding}>Strategic / CEO</StyleBtn>
                  <StyleBtn onClick={() => expandWithAI("default")}   disabled={expanding}>Re-roll</StyleBtn>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Edit toggle + delete */}
        <div className="flex justify-between">
          {editing ? (
            <div className="flex gap-2">
              <button onClick={saveEdits} className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-slate-800">Save</button>
              <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">Edit</button>
          )}
          <button onClick={deleteCard} className="text-sm text-red-600 hover:text-red-800 px-2">Delete card</button>
        </div>

        {/* Submission answers (only if card came from a public form) */}
        {(card.external_submitter_name || (submissionAnswers && submissionAnswers.length > 0)) && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-amber-800 font-semibold">📨 Form submission</div>
            {card.external_submitter_name && (
              <div className="text-sm text-slate-800">
                From <span className="font-medium">{card.external_submitter_name}</span>
                {card.external_submitter_email && <> · <span className="font-mono text-xs">{card.external_submitter_email}</span></>}
              </div>
            )}
            {submissionAnswers && submissionAnswers.length > 0 && (
              <dl className="text-sm divide-y divide-amber-200/60">
                {submissionAnswers.map((a, i) => (
                  <div key={i} className="py-1.5 flex flex-col sm:flex-row sm:gap-3">
                    <dt className="font-medium text-slate-700 sm:w-1/3">{a.field_label}</dt>
                    <dd className="text-slate-900 flex-1 break-words">{renderAnswer(a)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        <hr className="border-slate-200" />

        {/* Collaborators */}
        <Section label={`Collaborators (${collaborators.length})`}>
          {collaborators.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 mb-3">
              {collaborators.map((c) => (
                <li key={c.user_id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">
                  <span className="font-medium">{c.display_name}</span>
                  <button
                    onClick={() => removeCollaborator(c.user_id)}
                    title="Remove collaborator"
                    className="text-indigo-400 hover:text-indigo-700"
                  >×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic mb-3">No collaborators yet.</p>
          )}
          {addableUsers.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) addCollaborator(Number(e.target.value)); }}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
            >
              <option value="">+ Add collaborator…</option>
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          )}
        </Section>

        {/* Attachments */}
        <Section label={`Attachments (${attachments.length})`}>
          <ul className="space-y-1.5 mb-3">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">📎</span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-accent hover:underline truncate flex-1"
                  title={a.url}
                >
                  {a.label}
                </a>
                <button onClick={() => removeAttachment(a.id)} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={attLabel}
              onChange={(e) => setAttLabel(e.target.value)}
              placeholder="Label (e.g. 'Figma mockup')"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              value={attUrl}
              onChange={(e) => setAttUrl(e.target.value)}
              placeholder="URL or path"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button onClick={addAttachment} className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white">Add</button>
          </div>
          <p className="text-xs text-slate-400 mt-1">URLs, GitHub links, file paths on your computer, Box/Drive links — anything that points to the work.</p>
        </Section>

        {/* Comments */}
        <Section label={`Comments (${comments.length})`}>
          <ul className="space-y-3 mb-3 max-h-60 overflow-y-auto thin-scroll">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-slate-800">{c.author_name}</span>
                  <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap mt-0.5">{c.body}</p>
              </li>
            ))}
            {comments.length === 0 && <li className="text-xs text-slate-400 italic">No comments yet.</li>}
          </ul>
          <div className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              placeholder={`Comment as ${currentUser.display_name}…`}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button onClick={addComment} className="self-end text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-slate-800">Post</button>
          </div>
        </Section>

        {moveNotice && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            {moveNotice}
          </div>
        )}
      </div>

      {moveTo && (
        <MoveCardDialog
          cardId={card.id}
          cardTitle={card.title}
          currentStage={card.stage as Stage}
          toStage={moveTo}
          onClose={() => setMoveTo(null)}
          onDone={(status) => {
            setMoveTo(null);
            if (status === "pending") {
              setMoveNotice("Sent for approval. The card stays in the current stage until an approver acts.");
              setTimeout(() => setMoveNotice(null), 6000);
            }
            load();
            onChange();
          }}
        />
      )}
    </Modal>
  );
}

function renderAnswer(a: { field_type: string; value: string | null }): React.ReactNode {
  if (!a.value) return <span className="text-slate-400 italic">—</span>;
  if (a.field_type === "multi_choice") {
    try {
      const arr = JSON.parse(a.value) as unknown;
      if (Array.isArray(arr)) return arr.map(String).join(", ");
    } catch { /* fall through */ }
  }
  if (a.field_type === "yes_no") {
    return a.value === "yes" || a.value === "true" ? "✓ Yes" : "✗ No";
  }
  return a.value;
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</h3>
      {children}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-30 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-700 text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
