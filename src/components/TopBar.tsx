"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/types";
import Logo from "./Logo";

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const tab = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
          active
            ? "bg-brand-ink text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {label}
      </Link>
    );
  };

  const roleLabel =
    user.role === "non_tech" ? "Non-tech" : user.role === "admin" ? "Admin" : "Tech";

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Logo />

        <nav className="flex items-center gap-1">
          {tab("/board", "Board")}
          {tab("/pipeline", "Pipeline")}
          {tab("/dashboard", "Dashboard")}
          {tab("/submit", "Submit Idea")}
          {tab("/projects", "Projects")}
          {user.role === "admin" && tab("/admin/users", "Users")}
          {user.role === "admin" && tab("/admin/taxonomy", "Tags")}
        </nav>

        {/* Spacer + change-password shortcut */}
        <div className="hidden" />

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-slate-700 font-medium">{user.display_name}</span>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-accentMuted text-brand-accent font-semibold">
              {roleLabel}
            </span>
          </div>
          <Link
            href="/change-password"
            className="text-sm text-slate-500 hover:text-slate-900 transition hidden sm:inline"
          >
            Password
          </Link>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
