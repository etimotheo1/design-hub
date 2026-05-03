import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");
  if (user.role !== "admin") redirect("/board");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand-ink">Settings</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">Admin tools for Design Hub.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              href="/profile"
              title="My profile"
              description="Display name, picture, contact info, employment type, work mode."
              icon="🪪"
            />
            <Card
              href="/admin/users"
              title="Users"
              description="Invite people to Design Hub. Manage roles and revoke access."
              icon="👥"
            />
            <Card
              href="/admin/access"
              title="Access"
              description="Roles, access policies, and per-project membership in one place."
              icon="🔑"
            />
            <Card
              href="/projects"
              title="Projects"
              description="Manage initiatives. Public, private, or hidden."
              icon="📁"
            />
            <Card
              href="/admin/taxonomy"
              title="Tags"
              description="Edit the Categories and Types used to label ideas."
              icon="🏷️"
            />
            <Card
              href="/change-password"
              title="My password"
              description="Change your own password."
              icon="🔒"
            />
            <Card
              href="/admin/diagnostics"
              title="Diagnostics"
              description="DB path, size, row counts. Verify your data is actually persisting."
              icon="🩺"
            />
          </div>

          <div className="mt-8 bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-600">
            <h2 className="font-semibold text-slate-900 mb-2">Email invitations</h2>
            <p>
              Right now invitations show a copyable link — you send it manually via WhatsApp or email. To enable
              automatic email delivery (e.g. invites coming from a <span className="font-mono">@neldi.com</span> address),
              add a Resend API key to your Railway environment variables. Ask Claude to walk through it whenever you're ready.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ href, title, description, icon }: { href: string; title: string; description: string; icon: string }) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition p-5"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </Link>
  );
}
