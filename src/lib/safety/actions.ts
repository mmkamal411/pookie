"use server";

// Squad 1 Safety Track — server actions wrapping the safety RPCs.
//
// Enforcement model: every access rule (age tiers, granted_by matrix, D6
// caps, trusted-adult gate) is enforced SERVER-SIDE inside the Postgres RPCs.
// These actions validate input shape (zod), resolve the session, call the
// RPC, and translate failures into typed results. They never re-implement
// authorization.
//
// Result shape: { ok: true, data } | { ok: false, error: { code, message } }.
// RPCs raise bare error codes (e.g. 'trusted_adult_required'); the code is
// surfaced verbatim so the client can map it to reviewed copy.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SafetyNotifyError,
  sendSafetyEmail,
  sendSafetySms,
} from "./notify";

export type ActionError = { code: string; message: string };
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

function fail<T>(code: string, message: string): ActionResult<T> {
  return { ok: false, error: { code, message } };
}

function rpcError<T>(err: unknown): ActionResult<T> {
  const message = err instanceof Error ? err.message : "Unknown error.";
  // RPCs raise bare codes; PostgREST surfaces them as the error message.
  const code = message.split(":")[0].trim() || "rpc_failed";
  return fail<T>(code, message);
}

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? user.id : null;
}

const uuidSchema = z.string().uuid();
const childIdSchema = uuidSchema.describe("child_id");

// ---------------------------------------------------------------------------
// Trusted adults
// ---------------------------------------------------------------------------

const nominateSchema = z.object({
  childId: childIdSchema,
  displayName: z.string().trim().min(1).max(80),
  relationship: z.enum([
    "parent",
    "relative",
    "counselor",
    "coach",
    "faith_leader",
    "neighbor",
    "other",
  ]),
  contactChannel: z.enum(["sms", "email", "app_push"]),
  contactValue: z.string().trim().min(3).max(160),
  note: z.string().trim().max(140).optional(),
  roles: z
    .array(z.enum(["crisis_alert", "revoke_guardian", "outing_contact"]))
    .min(1)
    .default(["crisis_alert"]),
  verificationMethod: z
    .enum(["link_code", "same_room", "parent_vouched"])
    .default("link_code"),
  parentUserId: uuidSchema.optional(),
});

export type NominateTrustedAdultResult = {
  trustedAdultId: string;
  verificationStatus: string;
  delivery: "sent" | "not_required" | "failed";
  deliveryError?: ActionError;
};

/**
 * Teen nominates a trusted adult. When a link_code/same_room code is issued,
 * this action dispatches it via the safety provider (server-side). A missing
 * provider fails LOUDLY (delivery: 'failed') — the nomination itself stays
 * pending and the teen can retry once a provider is configured.
 */
export async function nominateTrustedAdult(
  input: z.input<typeof nominateSchema>,
): Promise<ActionResult<NominateTrustedAdultResult>> {
  const parsed = nominateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid nomination input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_nominate_trusted_adult", {
    p_child_id: parsed.data.childId,
    p_display_name: parsed.data.displayName,
    p_relationship: parsed.data.relationship,
    p_contact_channel: parsed.data.contactChannel,
    p_contact_value: parsed.data.contactValue,
    p_note: parsed.data.note ?? null,
    p_roles: parsed.data.roles,
    p_verification_method: parsed.data.verificationMethod,
    p_parent_user_id: parsed.data.parentUserId ?? null,
  });
  if (error || !data) return rpcError(error);

  const row = data as {
    trusted_adult_id: string;
    verification_token: string;
    verification_code: string | null;
    verification_status: string;
  };

  if (!row.verification_code) {
    return {
      ok: true,
      data: {
        trustedAdultId: row.trusted_adult_id,
        verificationStatus: row.verification_status,
        delivery: "not_required",
      },
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pookie.pages.dev";
  const verifyUrl = `${appUrl}/verify-adult?token=${row.verification_token}`;
  const body =
    `Pookie safety: ${parsed.data.displayName} named you as a trusted adult. ` +
    `Your confirmation code is ${row.verification_code} (expires in 15 minutes). ` +
    `Confirm here: ${verifyUrl}`;
  try {
    if (parsed.data.contactChannel === "email") {
      await sendSafetyEmail(
        parsed.data.contactValue,
        "Confirm you are a Pookie trusted adult",
        body,
      );
    } else {
      await sendSafetySms(parsed.data.contactValue, body);
    }
  } catch (err) {
    const code =
      err instanceof SafetyNotifyError ? err.code : "delivery_failed";
    return {
      ok: true,
      data: {
        trustedAdultId: row.trusted_adult_id,
        verificationStatus: row.verification_status,
        delivery: "failed",
        deliveryError: {
          code,
          message:
            err instanceof Error ? err.message : "Code delivery failed.",
        },
      },
    };
  }

  return {
    ok: true,
    data: {
      trustedAdultId: row.trusted_adult_id,
      verificationStatus: row.verification_status,
      delivery: "sent",
    },
  };
}

const verifySchema = z.object({
  token: z.string().trim().min(1),
  code: z.string().trim().min(1).max(12),
});

/** Public-safe: runs on /verify-adult with no session required. */
export async function verifyTrustedAdult(
  input: z.input<typeof verifySchema>,
): Promise<ActionResult<{ trustedAdultId: string; displayName: string }>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Token and code are required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_verify_trusted_adult", {
    p_token: parsed.data.token,
    p_code: parsed.data.code,
  });
  if (error || !data) return rpcError(error);
  const row = data as { trusted_adult_id: string; display_name: string };
  return {
    ok: true,
    data: { trustedAdultId: row.trusted_adult_id, displayName: row.display_name },
  };
}

const declineSchema = z.object({
  childId: childIdSchema,
  ackVersion: z.literal("v1"),
});

/** Teen records the informed decline ("no adult will be alerted"). */
export async function declineTrustedAdult(
  input: z.input<typeof declineSchema>,
): Promise<ActionResult<{ declined: true }>> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success)
    return fail("invalid_input", "The acknowledgment checkbox is required.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_decline_trusted_adult", {
    p_child_id: parsed.data.childId,
    p_ack_version: parsed.data.ackVersion,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { declined: true as const } };
}

export type TrustedAdultRow = {
  id: string;
  display_name: string;
  relationship: string;
  contact_channel: string;
  contact_masked: string;
  verification_status: string;
  roles: string[];
  priority: number;
  is_active: boolean;
  teen_note: string | null;
};

/** Teen-visible list (RLS enforces teen-only visibility). */
export async function getTrustedAdults(
  childId: string,
): Promise<ActionResult<TrustedAdultRow[]>> {
  if (!uuidSchema.safeParse(childId).success)
    return fail("invalid_input", "Invalid child id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trusted_adults")
    .select(
      "id, display_name, relationship, contact_channel, contact_masked, verification_status, roles, priority, is_active, teen_note",
    )
    .eq("child_id", childId)
    .eq("is_active", true)
    .order("priority");
  if (error) return rpcError(error);
  return { ok: true, data: (data ?? []) as TrustedAdultRow[] };
}

/** Deactivate a trusted adult (teen-only, immediate, no confirm wall server-side). */
export async function deactivateTrustedAdult(
  trustedAdultId: string,
): Promise<ActionResult<{ deactivated: true }>> {
  if (!uuidSchema.safeParse(trustedAdultId).success)
    return fail("invalid_input", "Invalid trusted adult id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("trusted_adults")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", trustedAdultId);
  if (error) return rpcError(error);
  return { ok: true, data: { deactivated: true as const } };
}

/** Revoke-gate status for the Sharing flow (FR-SAFETY-001). */
export async function getRevokeGateStatus(
  childId: string,
): Promise<
  ActionResult<{ satisfied: boolean; via: string; trustedAdultId: string | null }>
> {
  if (!uuidSchema.safeParse(childId).success)
    return fail("invalid_input", "Invalid child id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_revoke_gate_status", {
    p_child_id: childId,
  });
  if (error || !data) return rpcError(error);
  const row = data as {
    satisfied: boolean;
    via: string;
    trusted_adult_id: string | null;
  };
  return {
    ok: true,
    data: {
      satisfied: row.satisfied,
      via: row.via,
      trustedAdultId: row.trusted_adult_id,
    },
  };
}

// ---------------------------------------------------------------------------
// Revoke / safe-exit
// ---------------------------------------------------------------------------

const initiateRevokeSchema = z.object({
  childId: childIdSchema,
  granteeUserId: uuidSchema,
  notifyMode: z.enum(["at_effect", "immediate"]),
  scopesRemoved: z.array(z.string()).optional(),
});

export async function initiateRevoke(
  input: z.input<typeof initiateRevokeSchema>,
): Promise<
  ActionResult<{
    pendingRevokeId: string;
    status: string;
    effectAt: string | null;
    notifyMode: string;
  }>
> {
  const parsed = initiateRevokeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid revoke input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_initiate_revoke", {
    p_child_id: parsed.data.childId,
    p_grantee_user_id: parsed.data.granteeUserId,
    p_notify_mode: parsed.data.notifyMode,
    p_scopes_removed: parsed.data.scopesRemoved ?? null,
  });
  if (error || !data) return rpcError(error);
  const row = data as {
    pending_revoke_id: string;
    status: string;
    effect_at: string | null;
    notify_mode: string;
  };
  return {
    ok: true,
    data: {
      pendingRevokeId: row.pending_revoke_id,
      status: row.status,
      effectAt: row.effect_at,
      notifyMode: row.notify_mode,
    },
  };
}

export async function cancelRevoke(
  pendingRevokeId: string,
): Promise<ActionResult<{ cancelled: true }>> {
  if (!uuidSchema.safeParse(pendingRevokeId).success)
    return fail("invalid_input", "Invalid pending revoke id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_cancel_revoke", {
    p_pending_revoke_id: pendingRevokeId,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { cancelled: true as const } };
}

/**
 * Execute due revokes. SERVICE_ROLE ONLY — call from the cron route handler,
 * never from the browser. Uses the admin client (RLS bypassed).
 */
export async function executeRevoke(): Promise<ActionResult<{ effected: number }>> {
  const { data, error } = await supabaseAdmin.rpc("rpc_execute_revoke");
  if (error) return rpcError(error);
  return { ok: true, data: { effected: (data as number) ?? 0 } };
}

const safeExitSchema = z.object({
  childId: childIdSchema,
  granteeUserId: uuidSchema,
});

/**
 * Safe exit: immediate cutoff, suppressed notification, frozen syncs.
 * FR-SAFETY-004: the response carries no fanfare — safe exits stay visually boring.
 */
export async function safeExit(
  input: z.input<typeof safeExitSchema>,
): Promise<ActionResult<{ safeExit: true }>> {
  const parsed = safeExitSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid safe-exit input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_safe_exit", {
    p_child_id: parsed.data.childId,
    p_grantee_user_id: parsed.data.granteeUserId,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { safeExit: true as const } };
}

export async function regrantAccess(
  input: z.input<typeof safeExitSchema>,
): Promise<ActionResult<{ regranted: true }>> {
  const parsed = safeExitSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid re-grant input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_regrant_access", {
    p_child_id: parsed.data.childId,
    p_grantee_user_id: parsed.data.granteeUserId,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { regranted: true as const } };
}

// ---------------------------------------------------------------------------
// D6 time-boxed grants
// ---------------------------------------------------------------------------

const grantAccessSchema = z.object({
  childId: childIdSchema,
  granteeUserId: uuidSchema,
  expiresAt: z.string().datetime().optional(),
  grantKind: z.enum(["permanent", "timeboxed"]).default("permanent"),
  purpose: z.string().trim().max(120).optional(),
});

/**
 * Issue a grant (D6 tiers enforced in the RPC: 8/30d trusted, 2/30d new;
 * new-grantee + parent caller -> pending teen co-approval).
 */
export async function grantAccess(
  input: z.input<typeof grantAccessSchema>,
): Promise<ActionResult<{ granted: true }>> {
  const parsed = grantAccessSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid grant input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_access", {
    p_child_id: parsed.data.childId,
    p_user_id: parsed.data.granteeUserId,
    p_role: "parent",
    p_expires_at: parsed.data.expiresAt ?? null,
    p_grant_kind: parsed.data.grantKind,
    p_purpose: parsed.data.purpose ?? null,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { granted: true as const } };
}

/** Teen approves a pending co-approval grant (D6). */
export async function approveGrant(
  ledgerId: string,
): Promise<ActionResult<{ approved: true }>> {
  if (!uuidSchema.safeParse(ledgerId).success)
    return fail("invalid_input", "Invalid grant id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_approve_grant", {
    p_ledger_id: ledgerId,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { approved: true as const } };
}

/** Teen rejects a pending co-approval grant (D6). */
export async function rejectGrant(
  ledgerId: string,
): Promise<ActionResult<{ rejected: true }>> {
  if (!uuidSchema.safeParse(ledgerId).success)
    return fail("invalid_input", "Invalid grant id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_reject_grant", {
    p_ledger_id: ledgerId,
  });
  if (error) return rpcError(error);
  return { ok: true, data: { rejected: true as const } };
}

// ---------------------------------------------------------------------------
// Outing plans
// ---------------------------------------------------------------------------

const saveOutingPlanSchema = z.object({
  childId: childIdSchema,
  destination: z.string().trim().min(1).max(200),
  returnAt: z.string().datetime(),
  sunsetAt: z.string().datetime(),
  recipientTrustedAdultId: uuidSchema.optional(),
  companions: z.string().trim().max(200).optional(),
  departAt: z.string().datetime().optional(),
  checkinAt: z.string().datetime().optional(),
  city: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  duskOverrideAck: z.boolean().default(false),
});

export async function saveOutingPlan(
  input: z.input<typeof saveOutingPlanSchema>,
): Promise<ActionResult<{ outingPlanId: string; duskWarning: boolean }>> {
  const parsed = saveOutingPlanSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid outing plan input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_save_outing_plan", {
    p_child_id: parsed.data.childId,
    p_destination: parsed.data.destination,
    p_return_at: parsed.data.returnAt,
    p_sunset_at: parsed.data.sunsetAt,
    p_recipient_trusted_adult_id: parsed.data.recipientTrustedAdultId ?? null,
    p_companions: parsed.data.companions ?? null,
    p_depart_at: parsed.data.departAt ?? null,
    p_checkin_at: parsed.data.checkinAt ?? null,
    p_city: parsed.data.city ?? null,
    p_postal_code: parsed.data.postalCode ?? null,
    p_dusk_override_ack: parsed.data.duskOverrideAck,
  });
  if (error || !data) return rpcError(error);
  const row = data as { outing_plan_id: string; dusk_warning: boolean };
  return {
    ok: true,
    data: { outingPlanId: row.outing_plan_id, duskWarning: row.dusk_warning },
  };
}

// ---------------------------------------------------------------------------
// Emergency (W19)
// ---------------------------------------------------------------------------

/** Public reference data — no session required. */
export async function getEmergencyResources(
  regionCode = "US-GA",
): Promise<
  ActionResult<
    Array<{ name: string; number: string; sms: string | null; url: string | null }>
  >
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("emergency_resources")
    .select("name, number, sms, url")
    .eq("region_code", regionCode)
    .order("sort");
  if (error) return rpcError(error);
  return { ok: true, data: (data ?? []) as Array<{ name: string; number: string; sms: string | null; url: string | null }> };
}

const emergencyMedicalSchema = z.object({
  childId: childIdSchema,
  bloodType: z.string().trim().max(8).optional(),
  allergies: z.array(z.string().trim().max(80)).optional(),
  conditions: z.string().trim().max(500).optional(),
  medications: z.string().trim().max(500).optional(),
  doctorName: z.string().trim().max(120).optional(),
  doctorPhone: z.string().trim().max(40).optional(),
  insuranceRef: z.string().trim().max(200).optional(),
  lockscreenFields: z.array(z.string()).optional(),
});

/** Teen upserts their own emergency medical card (parent-access independent). */
export async function updateEmergencyMedical(
  input: z.input<typeof emergencyMedicalSchema>,
): Promise<ActionResult<{ updated: true }>> {
  const parsed = emergencyMedicalSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", "Invalid medical card input.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { error } = await supabase.from("emergency_medical").upsert(
    {
      child_id: parsed.data.childId,
      blood_type: parsed.data.bloodType ?? null,
      allergies: parsed.data.allergies ?? [],
      conditions: parsed.data.conditions ?? null,
      medications: parsed.data.medications ?? null,
      doctor_name: parsed.data.doctorName ?? null,
      doctor_phone: parsed.data.doctorPhone ?? null,
      insurance_ref: parsed.data.insuranceRef ?? null,
      lockscreen_fields: parsed.data.lockscreenFields ?? [
        "display_name",
        "emergency_contact",
        "blood_type",
        "allergies",
      ],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "child_id" },
  );
  if (error) return rpcError(error);
  return { ok: true, data: { updated: true as const } };
}

/** Teen generates a 24h single-viewer break-glass token. */
export async function createBreakglassToken(
  childId: string,
): Promise<
  ActionResult<{ tokenId: string; code: string; expiresAt: string; maxViews: number }>
> {
  if (!uuidSchema.safeParse(childId).success)
    return fail("invalid_input", "Invalid child id.");
  if (!(await requireUserId())) return fail("authentication_required", "Sign in required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_create_breakglass_token", {
    p_child_id: childId,
  });
  if (error || !data) return rpcError(error);
  const row = data as {
    token_id: string;
    code: string;
    expires_at: string;
    max_views: number;
  };
  return {
    ok: true,
    data: {
      tokenId: row.token_id,
      code: row.code,
      expiresAt: row.expires_at,
      maxViews: row.max_views,
    },
  };
}
