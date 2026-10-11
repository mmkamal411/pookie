import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DemoBanner } from "@/components/demo-banner";
import { isDemoRequest } from "@/lib/demo";

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
  // Demo sessions have no Supabase user — mock data comes from the page.
  if (!user && !(await isDemoRequest())) redirect("/login");

  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
