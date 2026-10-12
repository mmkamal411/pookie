// /api/v1/children/[childId]/school/flashcards
// FR-SCHOOL-005: source-text flashcards ONLY (verbatim Q/A spans from uploaded
// material — no AI generation, no distractors) until the machine-verification
// pipeline exists and the pilot passes.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createFlashcard, flashcardSchema, listFlashcards } from "@/server/services/quiz";
import { z } from "zod";

const querySchema = z.object({ class_id: z.string().uuid().optional() });

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listFlashcards(tenant.childId, class_id);
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = flashcardSchema.parse(await req.json());
  const data = await createFlashcard(tenant.childId, body);
  await auditEvent(tenant.childId, "flashcard.created", {});
  return data;
});
