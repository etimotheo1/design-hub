"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { SessionUser } from "@/lib/types";
import Logo from "./Logo";

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  type Tab = { href: string; label: string };
  const tabs: Tab[] = [
    { href: "/dashboard",  label: "Dashboard"   },
    { href: "/bucketlist", label: "Bucketlist"  },
    { href: "/board",      label: "Board"       },
    { href: "/pipeline",   label: "Pipeline"    },
    { href: "/projects",   label: "Projects"    },
    { href: "/approvals",  label: "Approvals"   },
  ];
  if (user.role === "admin") tabs.push({ href: "/settings", label: "Settings" });

  const tabClass = (active: boolean) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${
    active ? "bg-brand-ink text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
  const mobileTabClass = (active: boolean) => `block px-4 py-3 rounded-lg text-base font-medium transition ${
    active ? "bg-brand-ink text-white" : "text-slate-700 hover:bg-slate-100"
  }`;

  const roleLabel =
    user.role === "non_tech" ? "Non-tech" : user.role === "admin" ? "Admin" : "Tech";

  return (
    <>
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Left: logo */}
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-wrap">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} className={tabClass(pathname === t.href)}>
                {t.label}
              </Link>
            ))}
          </nav>

          {/* Right: user + actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile-only quick-add button */}
            <Link
              href="/bucketlist"
              className="md:hidden inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              aria-label="Quick add idea"
            >
              <span className="text-base leading-none">+</span>
              <span>Idea</span>
            </Link>

            {/* User badge — desktop only */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-slate-700 font-medium">{user.display_name}</span>
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-accentMuted text-brand-accent font-semibold">
                {roleLabel}
              </span>
            </div>

            {/* Sign out — desktop only (mobile gets it inside menu) */}
            <button
              onClick={logout}
              className="hidden md:inline text-sm text-slate-500 hover:text-slate-900 transition"
            >
              Sign out
            </button>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden inline-flex flex-col items-center justify-center w-9 h-9 rounded-md border border-slate-300 bg-white"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <span className="block w-4 h-0.5 bg-slate-700 mb-1"></span>
              <span className="block w-4 h-0.5 bg-slate-700 mb-1"></span>
              <span className="block w-4 h-0.5 bg-slate-700"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-30"
            onClick={() => setMenuOpen(false)}
          />
          <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-white border-b border-slate-200 shadow-lg">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{user.display_name}</span>
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-accentMuted text-brand-accent font-semibold">
                {roleLabel}
              </span>
            </div>
            <nav className="p-2 space-y-1">
              {tabs.map((t) => (
                <Link key={t.href} href={t.href} className={mobileTabClass(pathname === t.href)}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="px-2 pb-2 border-t border-slate-100">
              <button
                onClick={logout}
                className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
