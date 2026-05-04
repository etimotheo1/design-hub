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
