import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import WorkflowsAdmin from "@/components/WorkflowsAdmin";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default function AdminWorkflowsPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");
  if (user.role !== "admin") redirect("/board");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <BackLink href="/settings" label="Back to Settings" />
          <h1 className="text-2xl font-semibold text-brand-ink">Workflows</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Standard workflow templates per team type. Define which designations can approve each stage transition. Apply a template to a project from the project's edit panel.
          </p>
          <WorkflowsAdmin />
        </div>
      </main>
    </div>
  );
}
