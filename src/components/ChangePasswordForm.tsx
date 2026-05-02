"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setError("New passwords don't match."); return; }
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not change password."); return; }
    setDone(true);
    setTimeout(() => {
      router.push("/board");
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        Password updated. Taking you to the board…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={forced ? "Temporary password" : "Current password"} value={current} onChange={setCurrent} />
      <Field label="New password" value={next} onChange={setNext} />
      <Field label="Confirm new password" value={confirm} onChange={setConfirm} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full bg-brand-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
        required
        minLength={6}
      />
    </div>
  );
}
