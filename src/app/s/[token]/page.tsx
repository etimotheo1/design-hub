import PublicSubmitForm from "@/components/PublicSubmitForm";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

// Public — no auth required. Anyone with the token can submit an idea.
export default function PublicFormPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <PublicSubmitForm token={params.token} />
      </div>
    </div>
  );
}
