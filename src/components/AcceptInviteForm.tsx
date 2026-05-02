"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Invite = { email: string; display_name: string; role: "admin" | "tech" | "non_tech"; expires_at: string };

export default function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setInvite(j.invitation);
        else setLoadError(j.error || "Invitation invalid.");
      });
  }, [token]);

  if (loadError) {
    return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">{loadError}</p>;
  }
  if (!invite) {
    return <p className="text-sm text-slate-500">Loading invitation…</p>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSaving(true); setError(null);
    const res = await fetch(`/api/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not accept invitation."); return; }
    router.push("/board");
    router.refresh();
  }

  const roleLabel = invite.role === "admin" ? "Admin" : invite.role === "non_tech" ? "Non-tech" : "Tech";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
        <div className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-1">Invited as</div>
        <div className="font-medium text-slate-900">{invite.display_name}</div>
        <div className="text-slate-600">{invite.email} · {roleLabel}</div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">Choose a password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          required
          minLength={6}
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          required
          minLength={6}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-brand-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "Setting up…" : "Create my account"}
      </button>
    </form>
  );
}
