import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import ProjectsManager from "@/components/ProjectsManager";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand">Projects</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Group cards by initiative. Add new ones for any new product line, market, or tech effort.
          </p>
          <ProjectsManager isAdmin={user.role === "admin"} />
        </div>
      </main>
    </div>
  );
}
