import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import TaxonomyAdmin from "@/components/TaxonomyAdmin";

export const dynamic = "force-dynamic";

export default function AdminTaxonomyPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password === 1) redirect("/change-password");
  if (user.role !== "admin") redirect("/board");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold text-brand-ink">Categories &amp; Types</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Add, rename, or remove the labels people pick when capturing an idea. Renames automatically update existing cards.
          </p>
          <TaxonomyAdmin />
        </div>
      </main>
    </div>
  );
}
