// DELETE /api/v1/children/[childId]/school/flashcards/[flashcardId]
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { deleteFlashcard } from "@/server/services/quiz";
import { z } from "zod";

export const DELETE = handleRoute<{ childId: string; flashcardId: string }>(async (ctx) => {
  const params = z
    .object({ childId: z.string().uuid(), flashcardId: z.string().uuid() })
    .parse(ctx.params);
  const tenant = await assertTenant(params.childId);
  const data = await deleteFlashcard(tenant.childId, params.flashcardId);
  await auditEvent(tenant.childId, "flashcard.deleted", {});
  return data;
});
