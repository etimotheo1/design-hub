"use client";
import { useEffect, useMemo, useState } from "react";
import { colorClasses } from "@/lib/colors";

type AccessUser = {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  role: "admin" | "tech" | "non_tech";
  access_policy: "standard" | "restricted";
  employment_type: string | null;
  work_mode: string | null;
  title: string | null;
};
type AccessProject = {
  id: number;
  name: string;
  color: string | null;
  visibility: "public" | "private";
  archived: number;
  created_by: number | null;
};
type Membership = { project_id: number; user_id: number; role: "member" | "lead" };
type Data = { users: AccessUser[]; projects: AccessProject[]; memberships: Membership[] };

export default function AccessAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState("");
  const [openUser, setOpenUser] = useState<number | null>(null);

  async function load() {
    const r = await fetch("/api/admin/access");
    const j = await r.json();
    if (j.ok) setData(j);
  }
  useEffect(() => { load(); }, []);

  async function patchUser(userId: number, patch: Record<string, unknown>) {
    await fetch("/api/admin/access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...patch }),
    });
    load();
  }

  async function setMember(projectId: number, userId: number, become: "member" | "lead" | "none") {
    if (become === "none") {
      await fetch(`/api/projects/${projectId}/members?user_id=${userId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: become }),
      });
    }
    load();
  }

  const visibleUsers = useMemo(() => {
    if (!data) return [];
    if (!filter.trim()) return data.users;
    const q = filter.trim().toLowerCase();
    return data.users.filter((u) =>
      u.display_name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  }, [data, filter]);

  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Explainer card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-sm space-y-2">
        <h2 className="font-semibold">How access works</h2>
        <ul className="list-disc pl-5 text-slate-600 space-y-1">
          <li><strong>Admins</strong> see all projects (public, private, hidden).</li>
          <li><strong>Standard</strong> users see all <em>public</em> projects + any <em>private</em> projects they're added to.</li>
          <li><strong>Restricted</strong> users see <em>only</em> the projects they're explicitly added to (no default access).</li>
          <li><strong>Project leads</strong> can add or remove members of their project.</li>
        </ul>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search users…"
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 pl-9 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
      </div>

      {/* User rows */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {visibleUsers.length === 0 && <p className="p-6 text-sm text-slate-400 italic">No users match.</p>}
        {visibleUsers.map((u) => {
          const expanded = openUser === u.id;
          const myMemberships = data.memberships.filter((m) => m.user_id === u.id);
          return (
            <div key={u.id} className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{u.display_name}</span>
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${
                      u.role === "admin" ? "bg-indigo-100 text-indigo-800" :
                      u.role === "non_tech" ? "bg-amber-100 text-amber-800" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {u.role === "non_tech" ? "Non-tech" : u.role === "admin" ? "Admin" : "Tech"}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${
                      u.access_policy === "restricted" ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {u.access_policy}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {u.email || <span className="italic">(no email)</span>}
                    {u.title && <> · {u.title}</>}
                    {u.employment_type && <> · {u.employment_type}</>}
                    {u.work_mode && <> · {u.work_mode}</>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Member of {myMemberships.length} project{myMemberships.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  onClick={() => setOpenUser(expanded ? null : u.id)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {expanded ? "Close" : "Manage access"}
                </button>
              </div>

              {expanded && (
                <div className="mt-4 space-y-4">
                  {/* Role + policy controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 uppercase tracking-wide block mb-1">Role</label>
                      <select
                        value={u.role}
                        onChange={(e) => patchUser(u.id, { role: e.target.value })}
                        className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      >
                        <option value="tech">Tech</option>
                        <option value="non_tech">Non-tech</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700 uppercase tracking-wide block mb-1">Access policy</label>
                      <select
                        value={u.access_policy}
                        onChange={(e) => patchUser(u.id, { access_policy: e.target.value })}
                        className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      >
                        <option value="standard">Standard — sees all public + invited private</option>
                        <option value="restricted">Restricted — only sees invited projects</option>
                      </select>
                    </div>
                  </div>

                  {/* Per-project membership */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 uppercase tracking-wide block mb-2">Project memberships</label>
                    <ul className="space-y-1.5">
                      {data.projects.filter((p) => !p.archived).map((p) => {
                        const m = myMemberships.find((mm) => mm.project_id === p.id);
                        const value = m ? m.role : "none";
                        const cc = colorClasses(p.color);
                        return (
                          <li key={p.id} className="flex items-center gap-3">
                            <span className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cc.dot}`}></span>
                              <span className="text-sm text-slate-800 truncate">{p.name}</span>
                              {p.visibility === "private" && (
                                <span className="text-[10px] uppercase tracking-wide px-1 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">Private</span>
                              )}
                            </span>
                            <select
                              value={value}
                              onChange={(e) => setMember(p.id, u.id, e.target.value as "member" | "lead" | "none")}
                              className="text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white"
                            >
                              <option value="none">— not a member —</option>
                              <option value="member">Member</option>
                              <option value="lead">Lead</option>
                            </select>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
