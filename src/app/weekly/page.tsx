import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import WeeklyView from "@/components/WeeklyView";

export const dynamic = "force-dynamic";

export default function WeeklyPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand-ink">Weekly Expectations</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            What's due this week, what shipped, and who's leading the pack.
          </p>
          <WeeklyView currentUser={user} />
        </div>
      </main>
    </div>
  );
}
