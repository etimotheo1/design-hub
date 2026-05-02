import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import Approvals from "@/components/Approvals";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand-ink">Approvals</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Things that need your attention — overdue, untriaged, or waiting on you.
          </p>
          <Approvals currentUser={user} />
        </div>
      </main>
    </div>
  );
}
