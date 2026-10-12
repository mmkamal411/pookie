import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  consumeInvite,
  getActiveChildId,
  getMemberships,
} from "@/lib/tenant/actions";

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
 * Root router — resolves login email → tenant per the plan (§4.1):
 * - No session → /login
 * - ?invite= token → DOB gate, then consume it (failures land on the
 *   friendly /verify-invite invalid state — never the error boundary),
 *   then continue
 * - profiles.onboarding_completed = false → /onboarding (first-login gate)
 * - 0 memberships → /me (the "just me" home — the old
 *   /login?error=no-invite bounce was a dead end: a signed-in user with
 *   no children saw the login form again with no dashboard and no way
 *   to add a child)
 * - 1 membership → straight into that child's dashboard (no switcher, ever)
 * - N memberships (parent) → /select-child
 * - Existing session with active child → that child's dashboard
 *
 * The profiles table (017) may not be applied yet: a missing table (42P01)
 * skips the onboarding gate (falls through to the legacy behavior) rather
 * than redirect-looping.
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

  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/me");

  const activeChildId = await getActiveChildId();
  const active = memberships.find((m) => m.child_id === activeChildId);
  if (active) redirect(`/c/${active.child.slug}`);

  if (memberships.length === 1) {
    // NOTE: do NOT call setActiveChild() here — cookies().set() throws in a
    // Server Component ("Cookies can only be modified in a Server Action or
    // Route Handler"), which 500s the front door for every single-child user.
    // The /c/[slug] page resolves the tenant from the URL slug directly.
    redirect(`/c/${memberships[0].child.slug}`);
  }

  redirect("/select-child");
}
