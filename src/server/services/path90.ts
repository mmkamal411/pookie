// Path-to-90 forecast compute glue — FR-SCHOOL-007.
//
// FORECAST COMPUTE: builds the engine inputs from school-of-record data
// (gradebook sync → per-category earned/possible; classes.grade_weights;
// due_next → known remaining assessments), runs the pure deterministic engine
// (forecast.ts — the LLM never computes grades), stores the row with
// engine_version + inputs_hash + citations, and marks older rows stale when
// the inputs hash changes.
//
// NOTE: Teen checkbox actions live in study_plans.plan[] (migration 045) —
// there is no separate path_to_90_actions table. The action CRUD functions
// that referenced it were removed 2026-10-12 as dead code.
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import {
  computeForecast,
  hashForecastInputs,
  type CategoryInput,
  type ForecastInput,
  type ForecastResult,
  type InputCitation,
  type RemainingAssessment,
} from "@/server/services/forecast";

// Forecast compute glue
// ---------------------------------------------------------------------------

interface GradeWeightRow {
  grade_weights: unknown;
  name: string;
}

function normalizeWeights(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const e of raw as Array<{ category?: string; name?: string; weight?: number }>) {
      const k = e.category ?? e.name;
      if (k && typeof e.weight === "number") out[k] = e.weight;
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Build engine inputs from school-of-record data and compute the forecast.
 * Any tenant member may compute (reads are tenant-scoped); the stored row is
 * the deterministic output — nothing the caller supplies can alter the math.
 */
export async function computeClassForecast(
  childId: string,
  classId: string,
): Promise<{ forecast: ForecastResult; stale: boolean }> {
  const supabase = await createClient();

  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("grade_weights, name")
    .eq("child_id", childId)
    .eq("id", classId)
    .maybeSingle();
  if (classErr) throw new ApiError(mapDbError(classErr, crypto.randomUUID()));
  if (!classRow) failWith(ErrorCodes.NOT_FOUND);

  const weights = normalizeWeights((classRow as GradeWeightRow).grade_weights);
  const weightsVerified = weights !== null;

  const { data: gradeRow } = await supabase
    .from("grades")
    .select("synced_at, source")
    .eq("child_id", childId)
    .eq("class_id", classId)
    .maybeSingle();

  const { data: assignments, error: asgErr } = await supabase
    .from("assignments")
    .select("title, category, status, points_earned, points_possible, due_date")
    .eq("child_id", childId)
    .eq("class_id", classId);
  if (asgErr) throw new ApiError(mapDbError(asgErr, crypto.randomUUID()));
  const rows = (assignments ?? []) as Array<{
    title: string;
    category: string | null;
    status: string;
    points_earned: number | null;
    points_possible: number | null;
    due_date: string | null;
  }>;

  // Per-category earned/possible from GRADED assignments (school-of-record).
  const earnedByCat = new Map<string, { earned: number; possible: number }>();
  const remaining: RemainingAssessment[] = [];
  for (const a of rows) {
    const cat = a.category ?? "Uncategorized";
    if (a.status === "graded" && a.points_possible != null && a.points_possible > 0) {
      const agg = earnedByCat.get(cat) ?? { earned: 0, possible: 0 };
      agg.earned += a.points_earned ?? 0;
      agg.possible += a.points_possible;
      earnedByCat.set(cat, agg);
    } else if ((a.status === "upcoming" || a.status === "missing" || a.status === "late") && a.points_possible) {
      remaining.push({ name: a.title, category: cat, maxPoints: Number(a.points_possible) });
    }
  }

  const categories: CategoryInput[] = [];
  const weightNames = weights ? Object.keys(weights) : [...earnedByCat.keys()];
  for (const name of weightNames) {
    const agg = earnedByCat.get(name) ?? { earned: 0, possible: 0 };
    categories.push({
      name,
      earned: agg.earned,
      possible: agg.possible,
      weight: weights ? (weights[name] ?? 0) : 0,
    });
  }
  // Categories with graded work but no weight entry still feed the engine
  // only when weights are missing entirely (equal split) — never silently.
  if (!weights && categories.length > 0) {
    const equal = 1 / categories.length;
    for (const c of categories) c.weight = equal;
  }

  const gradeSyncedAt = (gradeRow as { synced_at?: string } | null)?.synced_at ?? null;
  const citations: InputCitation[] = [
    {
      input: "per-category earned/possible",
      source: `Gradebook sync ${gradeSyncedAt ?? "unknown"} (${(gradeRow as { source?: string } | null)?.source ?? "parentvue"})`,
      takenAt: gradeSyncedAt ?? new Date().toISOString(),
    },
    {
      input: "category weights",
      source: weightsVerified ? "Weights: from StudentVUE ✓ verified" : "Weights: fallback (unverified) ⚠",
      takenAt: new Date().toISOString(),
    },
    {
      input: "known remaining assessments",
      source: `Known remaining: ${remaining.length} items from due_next`,
      takenAt: new Date().toISOString(),
    },
  ];

  const forecastInput: ForecastInput = { categories, remaining, citations };
  const forecast = await computeForecast(forecastInput);

  // Persist (service_role — forecasts are server-computed outputs, and the
  // forecasts table has no client INSERT policy by design).
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("forecasts")
    .insert({
      child_id: childId,
      class_id: classId,
      engine_version: forecast.engineVersion,
      inputs_hash: forecast.inputsHash,
      forecast: forecast as unknown as Record<string, unknown>,
      citations: citations as unknown as Record<string, unknown>[],
      stale: false,
    })
    .select("id")
    .single();
  if (insErr) throw new ApiError(mapDbError(insErr, crypto.randomUUID()));

  // Invalidate older forecasts whose inputs hash differs.
  await supabaseAdmin
    .from("forecasts")
    .update({ stale: true, superseded_by: (inserted as { id: string }).id })
    .eq("child_id", childId)
    .eq("class_id", classId)
    .neq("id", (inserted as { id: string }).id)
    .neq("inputs_hash", forecast.inputsHash)
    .eq("stale", false);

  return { forecast, stale: false };
}

/** Latest non-stale forecast + citations (any tenant member). */
export async function getLatestForecast(childId: string, classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forecasts")
    .select("id, engine_version, inputs_hash, computed_at, forecast, citations, stale")
    .eq("child_id", childId)
    .eq("class_id", classId)
    .eq("stale", false)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { forecast: data ?? null };
}

/** Re-export for tests: input hashing is part of the invalidation contract. */
export { hashForecastInputs };
