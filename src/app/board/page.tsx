import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import KanbanBoard from "@/components/KanbanBoard";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-4 overflow-hidden">
        <KanbanBoard currentUser={user} />
      </main>
    </div>
  );
}
