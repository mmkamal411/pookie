import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consumeInvite } from "@/lib/tenant/actions";

// Tenant resolution reads the session cookie — this route always blocks.
export const dynamic = "force-dynamic";

/** Full years between a YYYY-MM-DD date and today (DOB-gate helper). */
function ageYears(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

/**
 * Root router — user-first (Mehedi 2026-10-12).
 *
 * The pilot is an average human in command of their day-to-day life, with or
 * without children. The pilot's OWN dashboard (/me) is the default landing
 * for EVERY signed-in user — parents with kids land on their own bridge
 * first, then tap into a child's console from the Crew section. Child
 * cockpits (/c/[childSlug]) are opt-in modules, never the front door.
 * The old 1-membership → child / N-membership → /select-child split is gone.
 *
 * - No session → /login
 * - ?invite= token → DOB gate, then consume it (failures land on the
 *   friendly /verify-invite invalid state — never the error boundary),
 *   then continue
 * - profiles.onboarding_completed = false → /onboarding (first-login gate)
 * - otherwise → /me (the pilot's own bridge)
 *
 * The profiles table (017) may not be applied yet: a missing table (42P01)
 * skips the onboarding gate (falls through to the dashboard) rather than
 * redirect-looping.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Deletion grace: a user who requested deletion sees the recovery page,
  // not the app. (getAccountDeletionStatus reads the caller's own row.)
  const { getAccountDeletionStatus } = await import("@/lib/account/actions");
  const deletion = await getAccountDeletionStatus();
  if (deletion?.pending) redirect("/account-deleted");

  const params = await searchParams;
  if (params.invite) {
    // DOB gate (UX layer): a verifying user whose own profile shows
    // age < 13 cannot link a child role. The DB trigger is the backstop.
    const { data: dobProfile } = await supabase
      .from("profiles")
      .select("date_of_birth")
      .eq("user_id", user.id)
      .maybeSingle();
    if (dobProfile?.date_of_birth && ageYears(dobProfile.date_of_birth) < 13) {
      redirect(
        `/verify-invite?token=${encodeURIComponent(params.invite)}&error=underage`,
      );
    }
    const consumed = await consumeInvite(params.invite);
    if (!consumed.ok) {
      // Expired/used/bogus token: show the invite page's invalid state
      // instead of throwing into the error boundary.
      redirect(
        `/verify-invite?token=${encodeURIComponent(params.invite)}&error=invalid`,
      );
    }
    redirect("/");
  }

  // First-login gate: unfinished onboarding always routes to the wizard.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();
  const profilesReady = profileError?.code !== "42P01";
  if (profilesReady && (!profile || !profile.onboarding_completed)) {
    redirect("/onboarding");
  }

  // User-first: everyone lands on their own bridge. Crew consoles are
  // opt-in modules under /me, reachable any time at /c/[childSlug].
  redirect("/me");
}
