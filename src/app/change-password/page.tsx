import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import Logo from "@/components/Logo";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default function ChangePasswordPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");

  const forced = user.must_change_password === 1;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {!forced && <BackLink href="/settings" label="Back to Settings" />}
        <div className="mb-6"><Logo /></div>
        <h1 className="text-xl font-semibold text-brand-ink">
          {forced ? "Set your password" : "Change your password"}
        </h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {forced
            ? "You signed in with a temporary password. Set a new one to continue."
            : `Signed in as ${user.display_name}.`}
        </p>
        <ChangePasswordForm forced={forced} />
      </div>
    </div>
  );
}
