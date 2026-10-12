import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageGlide from "@/components/page-glide";

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

  return (
    <>
      <PageGlide>{children}</PageGlide>
      {/* Spacer for the root Command Deck (Squad Deck 2026-10-12). */}
      <div className="h-32 shrink-0" aria-hidden="true" />
    </>
  );
}
