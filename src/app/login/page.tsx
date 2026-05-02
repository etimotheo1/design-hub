"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.ok) {
      setError(data.error || "Login failed");
      return;
    }
    // If the user signed in with a temp password, force them through the
    // change-password screen; the page guards on /board etc. enforce this too.
    if (data.user?.must_change_password === 1) {
      router.push("/change-password");
    } else {
      router.push("/board");
    }
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="lg:hidden mb-8"><Logo /></div>

      <h1 className="text-2xl font-semibold text-brand-ink">Welcome back</h1>
      <p className="text-slate-500 text-sm mt-1 mb-8">Sign in to manage ideas, designs, and shipments.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          autoFocus
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-8 text-xs text-slate-500 leading-relaxed border-t border-slate-200 pt-6">
        <p>Design Hub is invite-only. If you don't have an account yet, ask your admin for an invite.</p>
      </div>
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
      />
    </div>
  );
}
