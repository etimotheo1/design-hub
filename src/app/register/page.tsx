"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import Logo from "@/components/Logo";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"tech" | "non_tech">("tech");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.ok) { setError(data.error || "Registration failed"); return; }
    router.push("/board");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="lg:hidden mb-8"><Logo /></div>

      <h1 className="text-2xl font-semibold text-brand-ink">Create account</h1>
      <p className="text-slate-500 text-sm mt-1 mb-8">Join Design Hub to share ideas or pick up tech work.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Display name" value={displayName} onChange={setDisplayName} autoFocus />
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />

        <div>
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">Team</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "tech" | "non_tech")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="tech">Tech (designer, builder)</option>
            <option value="non_tech">Non-tech (ideator, business)</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-xs text-slate-500 border-t border-slate-200 pt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-accent font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function Field({
  label, value, onChange, type = "text", autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">{label}</label>
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition"
        required
        minLength={type === "password" ? 6 : undefined}
      />
    </div>
  );
}
