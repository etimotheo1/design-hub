"use client";
import { useEffect, useState } from "react";
import type { User, Invitation } from "@/lib/types";

type IssuedInvite = {
  token: string;
  email: string;
  display_name: string;
  role: User["role"];
  expires_at: string;
};

type PendingInvite = Invitation & { invited_by_name: string };

export default function UsersAdmin({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<User["role"]>("tech");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<IssuedInvite | null>(null);

  async function load() {
    const [u, i] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/users/invite").then((r) => r.json()),
    ]);
    if (u.ok) setUsers(u.users);
    if (i.ok) setPending(i.invitations.filter((iv: PendingInvite) => !iv.used));
  }
  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setIssued(null);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, display_name: displayName, role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error); return; }
    setIssued(data.invitation);
    setEmail(""); setDisplayName(""); setRole("tech");
    load();
  }

  async function removeUser(id: number) {
    if (!confirm("Remove this user?")) return;
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    load();
  }

  async function revokeInvite(token: string) {
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    await fetch(`/api/invitations/${token}`, { method: "DELETE" });
    if (issued?.token === token) setIssued(null);
    load();
  }

  function inviteUrl(token: string): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/accept-invite/${token}`;
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Invite a user</h2>
        <form onSubmit={invite} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@eafoods.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sara Mwakalinga"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as User["role"])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="tech">Tech (designer, builder)</option>
              <option value="non_tech">Non-tech (ideator, business)</option>
              <option value="admin">Admin (full control)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-ink text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Creating link…" : "Create invite link"}
            </button>
          </div>
        </form>
      </div>

      {/* Just-issued invite */}
      {issued && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-emerald-900">Invitation link ready</h3>
              <p className="text-sm text-emerald-800 mt-1">
                Send this link to <span className="font-medium">{issued.display_name}</span> via WhatsApp or email.
                They'll set their own password — no need to share credentials.
              </p>
            </div>
            <button onClick={() => setIssued(null)} className="text-emerald-700 text-sm">Dismiss</button>
          </div>

          <div className="mt-4 bg-white rounded-lg border border-emerald-200 p-3">
            <div className="flex items-center gap-2">
              <code className="text-sm text-slate-800 break-all flex-1 font-mono">{inviteUrl(issued.token)}</code>
              <button onClick={() => copy(inviteUrl(issued.token))} className="text-sm px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-700">Copy link</button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Expires {new Date(issued.expires_at).toLocaleDateString()}.
            </p>
          </div>

          <button
            onClick={() => copy(
              `Hi ${issued.display_name},\n\n` +
              `You're invited to Design Hub. Click this link to set your password and get started:\n` +
              `${inviteUrl(issued.token)}\n\n` +
              `(Link expires in 14 days.)`
            )}
            className="mt-3 text-sm px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800"
          >
            Copy full message
          </button>
        </div>
      )}

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Pending invitations ({pending.length})</h2>
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.token} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 truncate">{p.display_name}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {p.role === "non_tech" ? "Non-tech" : p.role === "admin" ? "Admin" : "Tech"}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {p.email} · expires {new Date(p.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button onClick={() => copy(inviteUrl(p.token))} className="text-indigo-600 hover:text-indigo-800">Copy link</button>
                  <button onClick={() => revokeInvite(p.token)} className="text-red-600 hover:text-red-800">Revoke</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active users */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        <div className="p-4 sm:p-5 font-semibold text-slate-900">Active users ({users.length})</div>
        {users.length === 0 && <p className="p-5 text-sm text-slate-400 italic">No users yet.</p>}
        {users.map((u) => (
          <div key={u.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 truncate">{u.display_name}</span>
                <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${
                  u.role === "admin" ? "bg-indigo-100 text-indigo-800" :
                  u.role === "non_tech" ? "bg-amber-100 text-amber-800" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {u.role === "non_tech" ? "Non-tech" : u.role === "admin" ? "Admin" : "Tech"}
                </span>
              </div>
              <div className="text-sm text-slate-500 mt-0.5 truncate">
                {u.email || <span className="italic">(no email)</span>} · <span className="font-mono">{u.username}</span>
              </div>
            </div>
            {u.id !== currentUserId && (
              <button onClick={() => removeUser(u.id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
