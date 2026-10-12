// GET /api/v1/children/[childId]/school/quiz-items?class_id=
// FR-SCHOOL-005 fail-closed: ONLY verification_status='published' rows are
// visible (RLS). v1 ships zero AI items — this returns [] until the
// machine-verification pipeline + pilot land. There is no code path that
// renders a non-published AI item.
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { listPublishedQuizItems } from "@/server/services/quiz";

const querySchema = z.object({ class_id: z.string().uuid().optional() });

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listPublishedQuizItems(tenant.childId, class_id);
});
