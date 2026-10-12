import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./components/onboarding-flow";

export const dynamic = "force-dynamic";

/**
 * /onboarding — the 30-second first-run wizard (name → children → done).
 *
 * Guards:
 *  - No session → /login?next=/onboarding (post-auth return).
 *  - Already completed → / (the root router takes it from there).
 *
 * The profiles table (017) may not be applied yet in every environment:
 * a missing table (42P01) renders the wizard anyway — the server actions
 * degrade with clear retry messages instead of throwing.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed) redirect("/");

  return <OnboardingFlow initialDisplayName={profile?.display_name ?? ""} />;
}
