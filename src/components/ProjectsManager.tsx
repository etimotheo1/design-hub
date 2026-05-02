"use client";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { colorClasses, type ColorToken } from "@/lib/colors";
import ColorPicker from "./ColorPicker";

export default function ProjectsManager({ isAdmin }: { isAdmin: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ColorToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState<ColorToken | null>(null);

  async function load() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (data.ok) setProjects(data.projects);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, color }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error); return; }
    setName(""); setDescription(""); setColor(null);
    load();
  }

  async function startEdit(p: Project) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditColor((p.color as ColorToken | null) ?? null);
  }

  async function saveEdit(id: number) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc, color: editColor }),
    });
    setEditingId(null);
    load();
  }

  async function archive(id: number) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: 1 }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete project and all its cards? This cannot be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Add a project</h2>
        <form onSubmit={create} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project about?"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <span className="text-xs text-slate-500 block mb-1.5">Color</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-slate-800">
              Create
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        {projects.length === 0 && (
          <p className="p-5 text-sm text-slate-400 italic">No projects yet.</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="p-4 sm:p-5">
            {editingId === p.id ? (
              <div className="space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div>
                  <span className="text-xs text-slate-500 block mb-1.5">Color</span>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
                  <button onClick={() => saveEdit(p.id)} className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-slate-800">Save</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <span className={`mt-1.5 h-3 w-3 rounded-full flex-shrink-0 ${colorClasses(p.color).dot}`}></span>
                  <div>
                    <h3 className="font-medium text-slate-900">{p.name}</h3>
                    {p.description && <p className="text-sm text-slate-500 mt-0.5">{p.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(p)} className="text-sm text-slate-600 hover:text-slate-900">Edit</button>
                  <button onClick={() => archive(p.id)} className="text-sm text-slate-500 hover:text-slate-900">Archive</button>
                  {isAdmin && (
                    <button onClick={() => remove(p.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
