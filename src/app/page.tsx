import { redirect } from "next/navigation";
import { getCurrentUser, ensureAdminSeed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  // First-run bootstrap so there's an admin user to log in with.
  await ensureAdminSeed();

  const user = getCurrentUser();
  if (!user) redirect("/login");
  redirect("/board");
}
