import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import Logo from "@/components/Logo";

export default function RegisterDisabledPage() {
  return (
    <AuthShell>
      <div className="lg:hidden mb-8"><Logo /></div>
      <h1 className="text-2xl font-semibold text-brand-ink">Invite-only</h1>
      <p className="text-slate-500 text-sm mt-2 mb-6">
        Design Hub is invite-only. Ask your admin (Elia, or whoever set up your team's instance) to send you an invite. You'll get a username and a temporary password — paste them on the sign-in page.
      </p>
      <Link
        href="/login"
        className="inline-block bg-brand-ink text-white rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-slate-800"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
