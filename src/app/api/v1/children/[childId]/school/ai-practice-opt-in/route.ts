// PATCH /api/v1/children/[childId]/school/ai-practice-opt-in
// FR-SCHOOL-005: per-class AI-practice opt-in. TEEN-OWNED toggle (practice
// content is app-generated / child-authority; default OFF). Parents see the
// toggle state; they cannot flip it (403). Under-13: no AI quizzes at all
// (technical ban enforced here).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { setAiPracticeOptIn } from "@/server/services/quiz";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";

const bodySchema = z.object({
  class_id: z.string().uuid(),
  opt_in: z.boolean(),
});

export const PATCH = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = bodySchema.parse(await req.json());

  // Under-13 technical ban (COPPA posture): no AI quizzes, opt-in refused.
  const supabase = await createClient();
  const { data: child } = await supabase
    .from("children")
    .select("date_of_birth")
    .eq("id", tenant.childId)
    .maybeSingle();
  const dob = (child as { date_of_birth: string | null } | null)?.date_of_birth;
  if (dob && new Date(dob) > new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000)) {
    throw new ApiError(ErrorCodes.VALIDATION_FAILED);
  }
  if (!dob) failWith(ErrorCodes.VALIDATION_FAILED);

  const data = await setAiPracticeOptIn(tenant.childId, body.class_id, body.opt_in);
  await auditEvent(tenant.childId, "ai_practice.opt_in_changed", { opt_in: body.opt_in });
  return data;
});
