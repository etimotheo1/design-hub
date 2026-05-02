import AuthShell from "@/components/AuthShell";
import Logo from "@/components/Logo";
import AcceptInviteForm from "@/components/AcceptInviteForm";

export const dynamic = "force-dynamic";

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  return (
    <AuthShell>
      <div className="lg:hidden mb-8"><Logo /></div>
      <h1 className="text-2xl font-semibold text-brand-ink">Welcome to Design Hub</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">
        Set your password to finish creating your account.
      </p>
      <AcceptInviteForm token={params.token} />
    </AuthShell>
  );
}
