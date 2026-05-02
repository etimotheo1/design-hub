import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import IdeaForm from "@/components/IdeaForm";
import { all } from "@/lib/db";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function SubmitPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");

  const projects = all<Project>(`SELECT * FROM projects WHERE archived = 0 ORDER BY name ASC`);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand">Share an idea</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Got an idea, problem, or improvement? Capture what you imagine and the tech team will pick it up from here.
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <IdeaForm projects={projects} />
          </div>
        </div>
      </main>
    </div>
  );
}
