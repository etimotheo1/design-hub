import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import AccessAdmin from "@/components/AccessAdmin";

export const dynamic = "force-dynamic";

export default function AdminAccessPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");
  if (user.role !== "admin") redirect("/board");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand-ink">Access</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Who can see what. Manage roles, access policies, and per-project memberships in one place.
          </p>
          <AccessAdmin />
        </div>
      </main>
    </div>
  );
}
