"use client";
import { useEffect, useState } from "react";
import type { TaxonomyItem } from "@/lib/types";

type Kind = "categories" | "card_types";

export default function TaxonomyAdmin() {
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [cardTypes, setCardTypes] = useState<TaxonomyItem[]>([]);

  async function load() {
    const res = await fetch("/api/taxonomy");
    const data = await res.json();
    if (data.ok) {
      setCategories(data.categories);
      setCardTypes(data.cardTypes);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Section
        title="Categories"
        hint="The area of the business an idea relates to (e.g. Distribution, Tech)."
        kind="categories"
        items={categories}
        reload={load}
      />
      <Section
        title="Types"
        hint="The nature of the work (e.g. New initiative, Improvement)."
        kind="card_types"
        items={cardTypes}
        reload={load}
      />
    </div>
  );
}

function Section({
  title, hint, kind, items, reload,
}: {
  title: string; hint: string; kind: Kind;
  items: TaxonomyItem[]; reload: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/taxonomy/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error); return; }
    setName("");
    reload();
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/taxonomy/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) alert(data.error || "Could not save.");
    setEditingId(null);
    reload();
  }

  async function remove(id: number) {
    if (!confirm("Delete this? Cards using it will be cleared.")) return;
    await fetch(`/api/taxonomy/${kind}/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">{hint}</p>

      <form onSubmit={add} className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add new…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <button type="submit" className="text-sm px-3 py-1.5 rounded-lg bg-brand-ink text-white hover:bg-slate-800">Add</button>
      </form>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <ul className="divide-y divide-slate-100">
        {items.length === 0 && <li className="text-sm text-slate-400 italic py-2">Nothing yet.</li>}
        {items.map((it) => (
          <li key={it.id} className="py-2.5">
            {editingId === it.id ? (
              <div className="flex gap-2">
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  autoFocus
                />
                <button onClick={() => patch(it.id, { name: editingName })} className="text-sm px-2 py-1 rounded-lg bg-brand-ink text-white">Save</button>
                <button onClick={() => setEditingId(null)} className="text-sm px-2 py-1 rounded-lg hover:bg-slate-100">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${it.archived ? "line-through text-slate-400" : "text-slate-800"}`}>{it.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => { setEditingId(it.id); setEditingName(it.name); }}
                    className="text-slate-600 hover:text-slate-900"
                  >Rename</button>
                  <button
                    onClick={() => patch(it.id, { archived: it.archived ? 0 : 1 })}
                    className="text-slate-500 hover:text-slate-900"
                  >{it.archived ? "Restore" : "Archive"}</button>
                  <button
                    onClick={() => remove(it.id)}
                    className="text-red-600 hover:text-red-800"
                  >Delete</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
