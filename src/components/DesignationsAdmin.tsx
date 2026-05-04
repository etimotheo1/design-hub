"use client";
import { useEffect, useState } from "react";
import type { Designation } from "@/lib/types";

const SUGGESTED = ["CEO", "Manager", "Line Manager", "Supervisor", "Engineer", "Designer", "Anyone"];

export default function DesignationsAdmin() {
  const [items, setItems] = useState<Designation[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ name: string; reason: string }[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [orgContext, setOrgContext] = useState("");
  const [showOrgInput, setShowOrgInput] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/designations");
    const j = await res.json();
    if (j.ok) setItems(j.designations);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    if (!j.ok) { setError(j.error); return; }
    setName("");
    load();
  }

  async function quickAdd(value: string) {
    if (items.find((d) => d.name.toLowerCase() === value.toLowerCase())) return;
    await fetch("/api/admin/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    load();
  }

  async function aiSuggest() {
    setAiSuggesting(true); setAiError(null);
    try {
      const res = await fetch("/api/ai/suggest-designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgContext: orgContext.trim() || undefined }),
      });
      const j = await res.json();
      if (!j.ok) { setAiError(j.error || "Suggestion failed"); return; }
      if (!j.available) { setAiError("AI is not configured on this server."); return; }
      setAiSuggestions(j.designations || []);
      if ((j.designations || []).length === 0) setAiError("No new suggestions — your list looks complete!");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Network error");
    } finally {
      setAiSuggesting(false);
    }
  }

  async function acceptSuggestion(s: { name: string }) {
    await quickAdd(s.name);
    setAiSuggestions((arr) => arr.filter((x) => x.name !== s.name));
  }

  async function acceptAllSuggestions() {
    for (const s of aiSuggestions) {
      // sequential to keep DB happy with constraint checks
      // eslint-disable-next-line no-await-in-loop
      await fetch("/api/admin/designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: s.name }),
      });
    }
    setAiSuggestions([]);
    load();
  }

  async function rename(id: number) {
    await fetch(`/api/admin/designations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    load();
  }

  async function setArchived(id: number, archived: boolean) {
    await fetch(`/api/admin/designations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archived ? 1 : 0 }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this designation? Users currently using it will be unassigned.")) return;
    await fetch(`/api/admin/designations/${id}`, { method: "DELETE" });
    load();
  }

  const missingSuggestions = SUGGESTED.filter((s) => !items.find((i) => i.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a designation (e.g. Manager)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <button type="submit" className="text-sm px-3 py-1.5 rounded-lg bg-brand-ink text-white hover:bg-slate-800">Add</button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {missingSuggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1.5">Quick-add common ones:</p>
            <div className="flex flex-wrap gap-1.5">
              {missingSuggestions.map((s) => (
                <button key={s} type="button" onClick={() => quickAdd(s)} className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-slate-500">Want a tailored set? Let AI suggest based on your team.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOrgInput((v) => !v)}
                className="text-[11px] text-slate-500 hover:text-slate-800"
              >
                {showOrgInput ? "Hide context" : "Add context"}
              </button>
              <button
                type="button"
                onClick={aiSuggest}
                disabled={aiSuggesting}
                className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
              >
                <span>✨</span> {aiSuggesting ? "Thinking…" : "AI suggest"}
              </button>
            </div>
          </div>
          {showOrgInput && (
            <textarea
              value={orgContext}
              onChange={(e) => setOrgContext(e.target.value)}
              rows={2}
              placeholder="Optional: describe your team (e.g. 'Tech-enabled food distributor; ops, finance, tech, sales teams')"
              className="mt-2 w-full text-sm rounded-lg border border-slate-300 px-3 py-2"
            />
          )}
          {aiError && <p className="text-xs text-amber-700 mt-2">{aiError}</p>}
          {aiSuggestions.length > 0 && (
            <div className="mt-3 rounded-lg bg-violet-50 border border-violet-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-violet-800">✨ Suggested designations</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={acceptAllSuggestions} className="text-xs px-2 py-1 rounded bg-violet-700 text-white hover:bg-violet-800 font-medium">Add all</button>
                  <button type="button" onClick={() => setAiSuggestions([])} className="text-xs text-slate-500 hover:text-slate-800">Dismiss</button>
                </div>
              </div>
              <ul className="space-y-1">
                {aiSuggestions.map((s) => (
                  <li key={s.name} className="flex items-start justify-between gap-3 bg-white rounded px-2.5 py-1.5 border border-violet-100">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">{s.name}</div>
                      {s.reason && <div className="text-[11px] text-slate-500">{s.reason}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => acceptSuggestion(s)}
                      className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700"
                    >
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {items.length === 0 && <p className="p-5 text-sm text-slate-400 italic">No designations yet — add one above.</p>}
        {items.map((d) => (
          <div key={d.id} className="p-3 sm:p-4">
            {editingId === d.id ? (
              <div className="flex gap-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm" autoFocus />
                <button onClick={() => rename(d.id)} className="text-sm px-2 py-1 rounded bg-brand-ink text-white">Save</button>
                <button onClick={() => setEditingId(null)} className="text-sm px-2 py-1 rounded hover:bg-slate-100">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${d.archived ? "line-through text-slate-400" : "text-slate-800 font-medium"}`}>{d.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => { setEditingId(d.id); setEditName(d.name); }} className="text-slate-600 hover:text-slate-900">Rename</button>
                  <button onClick={() => setArchived(d.id, !d.archived)} className="text-slate-500 hover:text-slate-900">{d.archived ? "Restore" : "Archive"}</button>
                  <button onClick={() => remove(d.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
