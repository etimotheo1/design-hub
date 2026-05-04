import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import DesignationsAdmin from "@/components/DesignationsAdmin";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default function AdminDesignationsPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");
  if (user.role !== "admin") redirect("/board");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <BackLink href="/settings" label="Back to Settings" />
          <h1 className="text-2xl font-semibold text-brand-ink">Designations</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Job titles or hierarchy levels (CEO, Manager, Line Manager, Supervisor, Engineer…). These power the workflow approval rules — anyone with a matching designation can move cards through that step.
          </p>
          <DesignationsAdmin />
        </div>
      </main>
    </div>
  );
}
