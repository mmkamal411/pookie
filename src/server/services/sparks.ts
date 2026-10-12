// Study Sparks — FR-SCHOOL-004, G8, R6.
//
// The rename is load-bearing: "peer" on AI content is fabricated social proof.
// Study Sparks = short, LABELED, study-skill micro-content. No spark ever
// claims a human peer wrote it.
//
// STUDY-SKILLS-ONLY FENCE (fail-closed): candidates pass a two-stage check —
// (1) deterministic rules here (entity/keyword denylist, formula-pattern
// detection), (2) an LLM classifier (future pipeline). Uncertain ⇒ BLOCKED.
// Blocked candidates are logged with reason codes for fence tuning.
//
// Every spark carries a provenance label (origin, source_refs,
// deident_method, study-skill tags, review status, AI label). No spark
// renders without a resolvable label. 4-week TTL enforced at read + purge.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, mapDbError } from "@/server/errors";
import { fenceStudySpark, type FenceVerdict } from "./spark-fence.ts";

export const AI_LABEL_PREFIX = "Made by Pookie AI";

export interface SparkLabel {
  sparkId: string;
  createdAt: string;
  expiresAt: string;
  origin: "ai-synthesis" | "curriculum-extraction";
  sourceRefs: unknown[];
  deidentMethod: "aggregate-k5" | "curriculum-only";
  studySkillTags: string[];
  reviewStatus: "auto" | "human-approved" | "qa-sampled";
  aiLabel: string;
}

export interface StudySpark {
  id: string;
  unitTag: string | null;
  sparkText: string; // maps the `body` column (wired contract)
  label: SparkLabel;
}

// ---------------------------------------------------------------------------
// Reads (tenant-scoped; expiry enforced — only live sparks render)
// ---------------------------------------------------------------------------

export async function listStudySparks(
  childId: string,
  classId?: string,
): Promise<{ sparks: StudySpark[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("study_sparks")
    .select(
      "id, unit_tag, body, origin, source_refs, deident_method, study_skill_tags, review_status, created_at, expires_at",
    )
    .or(`child_id.is.null,child_id.eq.${childId}`)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const sparks = ((data ?? []) as Array<Record<string, unknown>>).map((s) => {
    const origin = s.origin as SparkLabel["origin"];
    const label: SparkLabel = {
      sparkId: String(s.id),
      createdAt: String(s.created_at),
      expiresAt: String(s.expires_at),
      origin,
      sourceRefs: (s.source_refs as unknown[]) ?? [],
      deidentMethod: s.deident_method as SparkLabel["deidentMethod"],
      studySkillTags: (s.study_skill_tags as string[]) ?? [],
      reviewStatus: s.review_status as SparkLabel["reviewStatus"],
      aiLabel: `${AI_LABEL_PREFIX} · checked ${String(s.created_at).slice(0, 10)}`,
    };
    return {
      id: String(s.id),
      unitTag: (s.unit_tag as string) ?? null,
      sparkText: String(s.body),
      label,
    };
  });
  return { sparks };
}

export const sparkCreateSchema = z.object({
  class_id: z.string().uuid().nullable().optional(),
  unit_tag: z.string().max(120).nullable().optional(),
  body: z.string().min(1).max(600),
  origin: z.enum(["ai-synthesis", "curriculum-extraction"]),
  source_refs: z.array(z.string()).max(20).default([]),
  deident_method: z.enum(["aggregate-k5", "curriculum-only"]),
  cohort_size: z.number().int().min(5).nullable().optional(),
  study_skill_tags: z.array(z.string().max(60)).max(10).default([]),
});

/**
 * Pipeline insert (service_role only — no client policy exists). Runs the
 * deterministic fence BEFORE insert; fence failure ⇒ dropped + logged.
 * Returns null when the candidate is fenced out (the pipeline logs the
 * reason code for fence tuning).
 */
export async function insertStudySpark(
  childId: string | null,
  input: z.infer<typeof sparkCreateSchema>,
): Promise<{ spark: StudySpark | null; fence: FenceVerdict }> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const fence = fenceStudySpark(input.body);
  if (!fence.allowed) {
    return { spark: null, fence };
  }
  const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("study_sparks")
    .insert({
      child_id: childId,
      class_id: input.class_id ?? null,
      unit_tag: input.unit_tag ?? null,
      body: input.body,
      origin: input.origin,
      source_refs: input.source_refs,
      deident_method: input.deident_method,
      cohort_size: input.cohort_size ?? null,
      study_skill_tags: input.study_skill_tags,
      expires_at: expiresAt,
    })
    .select("id, unit_tag, body, origin, source_refs, deident_method, study_skill_tags, review_status, created_at, expires_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const s = data as Record<string, unknown>;
  return {
    spark: {
      id: String(s.id),
      unitTag: (s.unit_tag as string) ?? null,
      sparkText: String(s.body),
      label: {
        sparkId: String(s.id),
        createdAt: String(s.created_at),
        expiresAt: String(s.expires_at),
        origin: s.origin as SparkLabel["origin"],
        sourceRefs: (s.source_refs as unknown[]) ?? [],
        deidentMethod: s.deident_method as SparkLabel["deidentMethod"],
        studySkillTags: (s.study_skill_tags as string[]) ?? [],
        reviewStatus: s.review_status as SparkLabel["reviewStatus"],
        aiLabel: `${AI_LABEL_PREFIX} · checked ${String(s.created_at).slice(0, 10)}`,
      },
    },
    fence,
  };
}

/** Nightly purge worker entry point (service_role cron): hard-deletes expired sparks. */
export async function runSparkPurge(): Promise<{ purged: number }> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { data, error } = await supabaseAdmin.rpc("purge_expired_sparks");
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { purged: (data as number) ?? 0 };
}
