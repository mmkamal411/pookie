"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendChildInvite } from "@/lib/tenant/actions";

/**
 * Onboarding server actions (/onboarding flow).
 *
 * Style matches the tenant actions: fail-closed on auth.getUser() first,
 * machine-readable error codes, plain-English mapping left to the UI.
 * No client-derived roles anywhere — the caller's identity comes from the
 * session JWT, and child provisioning goes through the SECURITY DEFINER
 * RPC provision_onboarding_child (migration 052), which re-checks the
 * guardian attestation and the first-child-only rule server-side.
 */

/** Full years between a YYYY-MM-DD date and today. Module-private: "use server"
 * files may only export async functions, and nothing imports this externally. */
function ageYears(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const displayNameSchema = z.string().trim().min(1).max(80);

/**
 * Finish onboarding: upsert the profiles row (017) with the display name
 * and mark onboarding completed. Called by every terminal step of the
 * wizard — "Skip for now" completes onboarding too ("just me" mode), it
 * just doesn't add a child.
 *
 * Defensive: if migration 017 has not applied yet (42P01), return a clear
 * retry code instead of throwing — the wizard surfaces it as a message.
 */
export async function completeOnboarding(
  displayName?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const payload: { user_id: string; onboarding_completed: boolean; display_name?: string } = {
    user_id: user.id,
    onboarding_completed: true,
  };
  if (displayName !== undefined) {
    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) return { ok: false, error: "invalid_name" };
    payload.display_name = parsed.data;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    if (error.code === "42P01") return { ok: false, error: "profiles_not_ready" };
    return { ok: false, error: "save_failed" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Child profile creation (onboarding step 2)
// ---------------------------------------------------------------------------

const childInputSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(120, "name_too_long"),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "birthdate_invalid"),
  email: z.string().trim().max(254, "invalid_email").email("invalid_email").optional(),
  attested: z.boolean().refine((v) => v === true, "attestation_required"),
});

export type CreateChildResult =
  | {
      ok: true;
      childId: string;
      ageTier: "under13" | "teen" | "adult";
      inviteSent: boolean;
      /** Out-of-band invite link (no transactional email provider yet — 015). */
      verifyUrl: string | null;
      /** True when an email was supplied for an under-13 child (ignored, COPPA). */
      emailIgnored: boolean;
    }
  | { ok: false; error: string };

/**
 * True when the caller's own profiles.date_of_birth (if present) shows
 * age < 13. A caller that young cannot attest to being a legal guardian,
 * so child creation is blocked for them.
 */
async function callerIsUnder13(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("date_of_birth")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.date_of_birth) return false;
  return ageYears(data.date_of_birth) < 13;
}

/**
 * Create the user's first child profile during onboarding.
 *
 * Age gates, computed server-side from the submitted birthdate:
 *  - <13  → parent-managed child row; a supplied email is ignored (logged
 *            in the RPC's audit detail as email_ignored_under13, COPPA —
 *            no login, no invite for them).
 *  - ≥13 + email → child row + the 015 invite hook (sendChildInvite:
 *            rate-limited, duplicate-safe, email-ownership proof at accept).
 *  - ≥13, no email → parent-managed; the email can be added later from
 *            Settings → Family.
 *
 * Guardian attestation is required both here (zod) and inside the RPC —
 * the client checkbox is UX, the RPC raise is the enforcement.
 */
export async function createChildProfile(input: {
  name: string;
  birthdate: string;
  email?: string;
  attested: boolean;
}): Promise<CreateChildResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const parsed = childInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }

  // Real-date check (YYYY-MM-DD that actually exists) + not in the future.
  const [y, m, d] = parsed.data.birthdate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false, error: "birthdate_invalid" };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (parsed.data.birthdate > todayStr) {
    return { ok: false, error: "birthdate_in_future" };
  }

  if (await callerIsUnder13(supabase, user.id)) {
    return { ok: false, error: "guardian_only" };
  }

  const childAge = ageYears(parsed.data.birthdate);
  if (childAge > 150) return { ok: false, error: "birthdate_implausible" };

  // The form asks for one name; the children table keeps first/last.
  const tokens = parsed.data.name.split(/\s+/);
  const firstName = tokens[0];
  const lastName = tokens.slice(1).join(" ");

  const email = parsed.data.email?.trim()
    ? parsed.data.email.trim().toLowerCase()
    : null;

  const { data, error } = await supabase.rpc("provision_onboarding_child", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_birthdate: parsed.data.birthdate,
    p_attested: true,
    p_email_provided: email !== null,
  });
  if (error) {
    const code = error.message;
    if (code.includes("guardian_attestation_required")) {
      return { ok: false, error: "attestation_required" };
    }
    if (code.includes("already_has_family")) {
      return { ok: false, error: "already_has_family" };
    }
    if (code.includes("not_authenticated")) {
      return { ok: false, error: "not_signed_in" };
    }
    return { ok: false, error: "create_failed" };
  }

  const row = data as { child_id: string; under13: boolean } | null;
  if (!row?.child_id) return { ok: false, error: "create_failed" };
  const childId = row.child_id;
  const under13 = row.under13;

  const ageTier: "under13" | "teen" | "adult" = under13
    ? "under13"
    : childAge < 18
      ? "teen"
      : "adult";

  // ≥13 + email → fire the existing invite system (015). Failures leave
  // the child row intact; the parent can retry from Settings → Family.
  let inviteSent = false;
  let verifyUrl: string | null = null;
  if (!under13 && email) {
    const invite = await sendChildInvite(childId, email);
    if (invite.ok) {
      inviteSent = true;
      verifyUrl = invite.verifyUrl;
    }
  }

  return {
    ok: true,
    childId,
    ageTier,
    inviteSent,
    verifyUrl,
    emailIgnored: under13 && email !== null,
  };
}
