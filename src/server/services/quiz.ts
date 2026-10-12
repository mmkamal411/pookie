// Quiz + flashcards + formula bank — FR-SCHOOL-005, FR-SCHOOL-018 (G19).
//
// FAIL-CLOSED POSTURE: until the machine-verification pipeline exists and the
// pilot passes, the product ships SOURCE-TEXT FLASHCARDS ONLY (verbatim Q/A
// spans from uploaded material — no AI generation, no distractors).
//
//   - flashcards: tenant read; any tenant member may add/remove (study aids
//     the teen configures — app_generated, child-authority).
//   - quiz_items: the student-visible RLS policy admits ONLY
//     verification_status='published' rows, and the opt-in trigger blocks
//     publishing into classes the teen has not opted into. There is no code
//     path that renders a non-published AI item.
//   - formula_bank: versioned, two-expert-verified grounding source. The quiz
//     generator must cite formula_id; the (future) machine verifier rejects
//     items citing unknown IDs.
//
// AI labels are COLUMNS (ai_generated, generated_by_model, verified_by,
// verified_at, engine_version) — they survive API responses and exports.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requireChildRole } from "@/server/services/school";

export const flashcardSchema = z.object({
  class_id: z.string().uuid().nullable().optional(),
  unit_tag: z.string().max(120).nullable().optional(),
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(2000),
  source_doc_id: z.string().uuid().nullable().optional(),
  span_refs: z.array(z.string().max(200)).max(20).default([]),
});

export async function listFlashcards(childId: string, classId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("flashcards")
    .select("id, class_id, unit_tag, front, back, source_doc_id, span_refs, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { flashcards: data ?? [] };
}

/** Any tenant member may add a source-text flashcard (verbatim spans only). */
export async function createFlashcard(childId: string, input: z.infer<typeof flashcardSchema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      child_id: childId,
      class_id: input.class_id ?? null,
      unit_tag: input.unit_tag ?? null,
      front: input.front,
      back: input.back,
      source_doc_id: input.source_doc_id ?? null,
      span_refs: input.span_refs,
      created_by: user?.id ?? null,
    })
    .select("id, class_id, unit_tag, front, back, source_doc_id, span_refs, created_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { flashcard: data };
}

export async function deleteFlashcard(childId: string, flashcardId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", flashcardId)
    .eq("child_id", childId);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { deleted: true };
}

/**
 * Published quiz items (fail-closed: ONLY verification_status='published'
 * rows are visible — enforced by RLS). v1 ships zero AI items; this endpoint
 * returns [] until the verification pipeline + pilot land.
 */
export async function listPublishedQuizItems(childId: string, classId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("quiz_items")
    .select(
      "id, class_id, unit_tag, question, answer_key, distractors, misconception_tags, source_span_ids, ai_generated, generated_by_model, verified_by, verified_at, engine_version, created_at",
    )
    .eq("child_id", childId)
    .eq("verification_status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { items: (data ?? []).map((i) => ({ ...(i as object), aiLabel: "AI-made · machine-checked" })) };
}

/** Teen-owned per-class AI-practice opt-in toggle (default OFF). Parent: 403. */
export async function setAiPracticeOptIn(childId: string, classId: string, optIn: boolean) {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update({ ai_practice_opt_in: optIn })
    .eq("id", classId)
    .eq("child_id", childId)
    .select("id, ai_practice_opt_in")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return { class: data };
}

/** Formula bank: versioned, immutable, two-expert-verified set (G19). */
export async function listFormulas(subject: "math" | "science", version?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("formula_bank")
    .select("id, subject, name, latex, plain_statement, source_citation, version, verified_at, machine_check")
    .eq("subject", subject)
    .order("name");
  if (version) {
    query = query.eq("version", version);
  } else {
    // Latest version wins when unspecified.
    const { data: latest } = await supabase
      .from("formula_bank")
      .select("version")
      .eq("subject", subject)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const v = (latest as { version: string } | null)?.version;
    if (!v) return { formulas: [], version: null };
    query = query.eq("version", v);
  }
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const rows = (data ?? []) as Array<{ version: string } & Record<string, unknown>>;
  return { formulas: rows, version: rows[0]?.version ?? version ?? null };
}
