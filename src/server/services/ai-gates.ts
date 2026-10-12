// AI governance gates — FR-AI-002, FR-AI-004, FR-AI-001 (emitter side).
//
// FR-AI-002 — Muse "direct mode" 18+ GATE (server-side):
//   "Unfiltered" is dead as a word and a promise (litigation risk). Direct Mode
//   = same safety, blunter tone. Under-18: the mode does not exist in the UI
//   and the API returns 403 regardless of client state. Age is computed
//   server-side at request time from a VERIFIED date of birth
//   (user_verifications, migration 033). Safety behavior is identical across
//   modes — mode is a tone preference; safety is a policy.
//
// FR-AI-004 — teacher-email send path requires PARENT AUTHORSHIP (no
// ghostwriting): drafts are parent-composed (blank draft — no AI-generated
// draft, no template-filled send); approval sends the exact approved bytes;
// the AI may only return tracked-change proofreading suggestions. Enforced in
// src/server/services/school.ts (requireParentRole on draft/approve/send +
// the approve route flips status on the stored body — nothing else can be
// injected).
//
// FR-AI-001 (emitter side) — crisis-language routing hooks: the chat layer
// calls detectCrisisLanguage() on user text; on a hit it MUST surface the
// 988 handoff script in-conversation immediately and call handleCrisisSignal()
// to emit the safety event for the router. The chat layer emits; it does not
// decide responses.
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";

/** Server-side 18+ gate for Direct Mode. Returns false for unverified/unknown. */
export async function isDirectModeEligible(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("direct_mode_eligible", { p_user_id: userId });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return data === true;
}

/** Assert Direct Mode eligibility — 403 for under-18/unverified, whatever the client claims. */
export async function assertDirectModeEligible(userId: string): Promise<void> {
  if (!(await isDirectModeEligible(userId))) failWith(ErrorCodes.DIRECT_MODE_18_ONLY);
}

// ---------------------------------------------------------------------------
// Crisis-language routing hooks (deterministic tripwire; the router decides)
// ---------------------------------------------------------------------------

import {
  CRISIS_HANDOFF_SCRIPT,
  detectCrisisLanguage,
  type CrisisSignalResult,
  type SafetyEventType,
} from "./crisis.ts";

export { CRISIS_HANDOFF_SCRIPT, detectCrisisLanguage };
export type { CrisisSignalResult, SafetyEventType };

/**
 * Handle a detected crisis signal: emit the safety event for the router and
 * return the fixed handoff script the chat MUST surface in-conversation.
 * Severity: self_harm_plan → imminent; abuse_disclosure → urgent; else watch.
 * (The router may escalate; the emitter never downgrades.)
 */
export async function handleCrisisSignal(
  childId: string | null,
  type: SafetyEventType,
  contextRef?: string,
): Promise<CrisisSignalResult> {
  const severity = type === "self_harm_plan" ? "imminent" : type === "abuse_disclosure" ? "urgent" : "watch";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("emit_safety_event", {
    p_child_id: childId,
    p_type: type,
    p_severity: severity,
    p_context_ref: contextRef ?? null,
  });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return {
    eventId: data as string,
    type,
    severity,
    handoffScript: CRISIS_HANDOFF_SCRIPT,
  };
}
