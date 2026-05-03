import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import Diagnostics from "@/components/Diagnostics";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default function DiagnosticsPage() {
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
          <h1 className="text-2xl font-semibold text-brand-ink">Diagnostics</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            DB health check — confirm your data is being saved to a persistent volume.
          </p>
          <Diagnostics />
        </div>
      </main>
    </div>
  );
}
