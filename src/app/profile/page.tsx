import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import ProfileEditor from "@/components/ProfileEditor";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <BackLink href="/settings" label="Back to Settings" />
          <h1 className="text-2xl font-semibold text-brand-ink">Your profile</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            How you appear to teammates. Your role and project access are managed by your admin.
          </p>
          <ProfileEditor />
        </div>
      </main>
    </div>
  );
}
