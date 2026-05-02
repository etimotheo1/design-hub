import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand-ink">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Where ideas are flowing, where they're stuck, and what's at risk.
          </p>
          <Dashboard />
        </div>
      </main>
    </div>
  );
}
