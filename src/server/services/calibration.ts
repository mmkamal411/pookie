// Teen-owned check-in calibration system — FR-SCHOOL-003.
//
// THE PARENT-FACING CROSS-CHECK / LIE DETECTOR IS DEAD AND NEVER SHIPS.
// This module implements the metacognition tool the teen owns:
//   - recordEstimate(): the teen optionally estimates a near-term outcome at
//     check-in ("I think I got ~80% on today's quiz").
//   - pairEstimateActual(): the sync pipeline records the actual when it
//     arrives; per-estimate error e_i = |estimate − actual|; the rolling
//     calibration score recomputes (last 10 paired estimates):
//       calibration = 1 − mean(e_i)/100, shown as "within ±X pts on average".
//   - Framing bands describe the SKILL of estimating, never honesty.
//   - Small-n guard: no score until ≥ 5 paired estimates.
//
// ACCESS: recordEstimate / retention get/set are teen-only (requireChildRole —
// a REAL child_access row). RLS independently restricts the tables to the
// owning teen. Parents get 403 at the route layer; the serializer blocklist
// (provenance.ts) is the third gate. pairEstimateActual / runCheckinPurge are
// service_role pipeline/worker entry points.
//
// In-product guarantee (rendered verbatim by the teen UI):
//   "Only you see this. It never appears in anything your parents see, and
//    it never affects your access."
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requireChildRole } from "@/server/services/school";

export const CALIBRATION_PRIVACY_GUARANTEE =
  "Only you see this. It never appears in anything your parents see, and it never affects your access.";

export const estimateSchema = z.object({
  class_id: z.string().uuid().nullable().optional(),
  estimate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "estimate_date must be YYYY-MM-DD"),
  kind: z.enum(["quiz", "test", "assignment", "other"]),
  description: z.string().min(1).max(200),
  estimate_pct: z.number().min(0).max(100),
});

export const retentionSchema = z.object({
  checkin_retention: z.enum(["rolling_90d", "rolling_365d", "manual_delete_only"]),
});

/** Teen records an estimate of a near-term outcome. */
export async function recordEstimate(childId: string, input: z.infer<typeof estimateSchema>) {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_estimates")
    .insert({
      child_id: childId,
      class_id: input.class_id ?? null,
      estimate_date: input.estimate_date,
      kind: input.kind,
      description: input.description,
      estimate_pct: input.estimate_pct,
    })
    .select("id, estimate_date, kind, description, estimate_pct, created_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { estimate: data };
}

/** Teen's estimate history (own only). */
export async function listEstimates(childId: string, limit = 20) {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_estimates")
    .select("id, class_id, estimate_date, kind, description, estimate_pct, actual_pct, error_pct, paired_at, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { estimates: data ?? [] };
}

/**
 * Pair an estimate with its actual (sync pipeline, service_role).
 * Called when the synced grade for the estimated assessment arrives.
 * Recomputes the rolling calibration via recompute_calibration().
 */
export async function pairEstimateActual(
  childId: string,
  estimateId: string,
  actualPct: number,
): Promise<{ paired: boolean; estimateId: string }> {
  if (actualPct < 0 || actualPct > 100) failWith(ErrorCodes.VALIDATION_FAILED);
  const { data, error } = await supabaseAdmin
    .from("checkin_estimates")
    .update({ actual_pct: actualPct, paired_at: new Date().toISOString() })
    .eq("id", estimateId)
    .eq("child_id", childId)
    .is("actual_pct", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) failWith(ErrorCodes.NOT_FOUND);

  const { error: rpcError } = await supabaseAdmin.rpc("recompute_calibration", {
    p_child_id: childId,
  });
  if (rpcError) throw new ApiError(mapDbError(rpcError, crypto.randomUUID()));
  return { paired: true, estimateId };
}

/** Teen's retention setting (own only). */
export async function getRetentionSetting(childId: string) {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("teen_privacy_settings")
    .select("checkin_retention, updated_at")
    .eq("child_id", childId)
    .maybeSingle();
  return {
    checkin_retention: (data as { checkin_retention: string } | null)?.checkin_retention ?? "rolling_90d",
  };
}

/** Teen changes their retention setting (own only). */
export async function setRetentionSetting(childId: string, input: z.infer<typeof retentionSchema>) {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teen_privacy_settings")
    .upsert(
      { child_id: childId, checkin_retention: input.checkin_retention, updated_at: new Date().toISOString() },
      { onConflict: "child_id" },
    )
    .select("checkin_retention, updated_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { retention: data };
}

/** Nightly purge worker entry point (service_role cron). Returns per-child counts. */
export async function runCheckinPurge(): Promise<{
  purged: Array<{ child_id: string; purged_checkins: number; purged_estimates: number }>;
}> {
  const { data, error } = await supabaseAdmin.rpc("purge_expired_checkins");
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { purged: (data ?? []) as Array<{ child_id: string; purged_checkins: number; purged_estimates: number }> };
}
