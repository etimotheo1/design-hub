"use client";
import { useEffect, useState } from "react";
import type { EmploymentType, WorkMode } from "@/lib/types";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/types";

interface Profile {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  role: string;
  phone: string | null;
  title: string | null;
  bio: string | null;
  employment_type: EmploymentType | null;
  work_mode: WorkMode | null;
  profile_picture_url: string | null;
  access_policy: string;
}

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/profile");
    const data = await res.json();
    if (data.ok) setProfile(data.profile);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: profile.display_name,
        email: profile.email,
        phone: profile.phone,
        title: profile.title,
        bio: profile.bio,
        employment_type: profile.employment_type,
        work_mode: profile.work_mode,
        profile_picture_url: profile.profile_picture_url,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setError(data.error || "Could not save."); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!profile) return <p className="text-sm text-slate-400">Loading…</p>;

  const initials = profile.display_name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile({ ...profile, [k]: v });

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Avatar + display name + title */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          {profile.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profile_picture_url} alt="" className="h-16 w-16 rounded-full object-cover bg-slate-100" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 grid place-items-center text-white font-semibold">{initials}</div>
          )}
          <div className="flex-1 space-y-3">
            <Field label="Display name">
              <input value={profile.display_name} onChange={(e) => set("display_name", e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Job title">
              <input value={profile.title ?? ""} onChange={(e) => set("title", e.target.value || null)} placeholder="e.g. COO, Driver, Designer" className={inputCls} />
            </Field>
            <Field label="Profile picture URL (optional)">
              <input value={profile.profile_picture_url ?? ""} onChange={(e) => set("profile_picture_url", e.target.value || null)} placeholder="https://…" className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">AI-assisted picture generation coming later. For now, paste any image URL.</p>
            </Field>
          </div>
        </div>
      </div>

      {/* Contact */}
      <Block title="Contact">
        <Field label="Email"><input type="email" value={profile.email ?? ""} onChange={(e) => set("email", e.target.value || null)} className={inputCls} /></Field>
        <Field label="Phone"><input type="tel" value={profile.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} placeholder="+255 …" className={inputCls} /></Field>
      </Block>

      {/* Work */}
      <Block title="Work">
        <Field label="Employment type">
          <select value={profile.employment_type ?? ""} onChange={(e) => set("employment_type", (e.target.value || null) as EmploymentType | null)} className={inputCls}>
            <option value="">— not set —</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-1">Used by admin for access policies (FTE, Consulting, Gig, Intern, Other).</p>
        </Field>
        <Field label="Work mode">
          <select value={profile.work_mode ?? ""} onChange={(e) => set("work_mode", (e.target.value || null) as WorkMode | null)} className={inputCls}>
            <option value="">— not set —</option>
            {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </Block>

      {/* About */}
      <Block title="About you">
        <Field label="Bio">
          <textarea value={profile.bio ?? ""} onChange={(e) => set("bio", e.target.value || null)} rows={3} placeholder="Short note for teammates" className={inputCls} />
        </Field>
      </Block>

      {/* Read-only: role + access policy */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-sm space-y-1">
        <div><span className="text-slate-500">Role:</span> <span className="font-medium">{profile.role}</span></div>
        <div><span className="text-slate-500">Access policy:</span> <span className="font-medium">{profile.access_policy}</span></div>
        <div><span className="text-slate-500">Username:</span> <span className="font-mono text-xs">{profile.username}</span></div>
        <p className="text-xs text-slate-500 mt-2">Role and access policy are managed by your admin in Settings → Access.</p>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-brand-ink text-white hover:bg-slate-800 disabled:opacity-50">
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <span className="text-sm text-emerald-700">✓ Saved</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}
