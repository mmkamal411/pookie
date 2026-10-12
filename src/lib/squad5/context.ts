// Squad 5 server context — who is looking at Travel / Marketplace / Support.
// Resolves the child, the viewer's role (parent vs child), the server-side
// age band via the REAL support_user_age_band() RPC (033), and the child's
// age from children.date_of_birth for milestone math (W6, W29, W30).
//
// Enforcement note: this is a UI-convenience layer. Real access is enforced
// server-side by RLS + the purchase/visibility gates — never by these values.

import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";

export type AgeBand = "adult" | "teen" | "child";

export interface Squad5Context {
  childId: string;
  childSlug: string;
  childName: string;
  /** "parent" = a parent viewing the child's space; "child" = the teen themselves. */
  role: "parent" | "child";
  /** Server-side age band ('adult' | 'teen' | 'child'); fails closed to 'child'. */
  band: AgeBand;
  /** The child's age in years from date_of_birth (null when unknown). */
  childAge: number | null;
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

/** Teen when the viewer is a teen (or a parent viewing a teen's space for hub gating). */
export function isTeenBand(ctx: Squad5Context): boolean {
  return ctx.band === "teen";
}

export async function getSquad5Context(childSlug: string): Promise<Squad5Context | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) return null;

  // Server-side band from the REAL 033 RPC; fail closed to 'child' (BACKLOG §R-C,
  // BACKEND-CONTRACTS §0: missing DOB fails closed to child).
  let band: AgeBand = "child";
  try {
    const { data } = await supabase.rpc("support_user_age_band", { p_user_id: user.id });
    if (data === "adult" || data === "teen" || data === "child") band = data;
  } catch {
    band = membership.role === "parent" ? "adult" : "child";
  }

  // Child's age for milestone math (W6 GA timeline, W29 supervision, W30/W31).
  let childAge: number | null = null;
  try {
    const { data } = await supabase
      .from("children")
      .select("date_of_birth")
      .eq("id", membership.child_id)
      .maybeSingle();
    childAge = ageFromDob((data?.date_of_birth as string | null) ?? null);
  } catch {
    childAge = null;
  }

  const child = membership.child;
  return {
    childId: membership.child_id,
    childSlug,
    childName: child.nickname ?? child.first_name,
    role: membership.role === "child" ? "child" : "parent",
    band,
    childAge,
  };
}
