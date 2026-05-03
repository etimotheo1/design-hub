"use client";
import Link from "next/link";

// Small "← Back" affordance for nested pages. Pass an explicit href when the
// hierarchy is clear (e.g. all /admin/* sub-pages → /settings).
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-3 group"
    >
      <span className="text-base group-hover:-translate-x-0.5 transition-transform">←</span>
      <span>{label}</span>
    </Link>
  );
}
