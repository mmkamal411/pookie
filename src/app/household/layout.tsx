import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Household namespace — NOT under /c/[childSlug]. The data here is
// per-household (owner_user_id-anchored), so a child-scoped URL would imply
// per-child scoping that doesn't exist. force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export default async function HouseholdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
