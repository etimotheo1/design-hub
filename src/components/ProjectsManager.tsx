"use client";
import { useEffect, useState } from "react";
import type { Project, ProjectVisibility } from "@/lib/types";
import { colorClasses, type ColorToken } from "@/lib/colors";
import ColorPicker from "./ColorPicker";

export default function ProjectsManager({ isAdmin }: { isAdmin: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ColorToken | null>(null);
  const [visibility, setVisibility] = useState<ProjectVisibility>("public");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState<ColorToken | null>(null);
  const [editVisibility, setEditVisibility] = useState<ProjectVisibility>("public");

  async function load() {
    // Admin view shows all projects (including hidden ones) so admins can unhide.
    const res = await fetch(`/api/projects?include_hidden=${isAdmin ? "1" : "0"}`);
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
      body: JSON.stringify({ name, description, color, visibility }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error); return; }
    setName(""); setDescription(""); setColor(null); setVisibility("public");
    load();
  }

  async function startEdit(p: Project) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditColor((p.color as ColorToken | null) ?? null);
    setEditVisibility(p.visibility ?? "public");
  }

  async function saveEdit(id: number) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc, color: editColor, visibility: editVisibility }),
    });
    setEditingId(null);
    load();
  }

  async function setHidden(id: number, hidden: boolean) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: hidden ? 1 : 0 }),
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
          <div>
            <span className="text-xs text-slate-500 block mb-1.5">Visibility</span>
            <div className="flex gap-2">
              <label className={`flex-1 cursor-pointer text-sm rounded-lg border px-3 py-2 ${visibility === "public" ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
                <input type="radio" name="vis" className="sr-only" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                <div className="font-medium">🌐 Public</div>
                <div className="text-xs text-slate-500">All standard-access users see it.</div>
              </label>
              <label className={`flex-1 cursor-pointer text-sm rounded-lg border px-3 py-2 ${visibility === "private" ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
                <input type="radio" name="vis" className="sr-only" checked={visibility === "private"} onChange={() => setVisibility("private")} />
                <div className="font-medium">🔒 Private</div>
                <div className="text-xs text-slate-500">Only members + admins see it.</div>
              </label>
            </div>
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
                <div>
                  <span className="text-xs text-slate-500 block mb-1.5">Visibility</span>
                  <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as ProjectVisibility)} className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 bg-white">
                    <option value="public">🌐 Public</option>
                    <option value="private">🔒 Private (members only)</option>
                  </select>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-medium ${p.archived ? "text-slate-400 line-through" : "text-slate-900"}`}>{p.name}</h3>
                      {p.visibility === "private" && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">🔒 Private</span>
                      )}
                      {p.archived ? (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">Hidden</span>
                      ) : null}
                    </div>
                    {p.description && <p className={`text-sm mt-0.5 ${p.archived ? "text-slate-400" : "text-slate-500"}`}>{p.description}</p>}
                    {p.archived && (
                      <p className="text-xs text-slate-500 mt-1 italic">
                        Hidden from Bucketlist, Board, Pipeline, Dashboard, and Approvals.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(p)} className="text-sm text-slate-600 hover:text-slate-900">Edit</button>
                  {isAdmin && (
                    p.archived ? (
                      <button onClick={() => setHidden(p.id, false)} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">Unhide</button>
                    ) : (
                      <button onClick={() => setHidden(p.id, true)} className="text-sm text-slate-500 hover:text-slate-900">Hide</button>
                    )
                  )}
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
