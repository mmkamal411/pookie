// POST /api/v1/ai/crisis-signal
// FR-AI-001 (emitter side): the chat layer calls this hook when
// detectCrisisLanguage() fires on user text. It emits the safety event for
// the router and returns the fixed handoff script the chat MUST surface
// in-conversation immediately (988 + Crisis Text Line, every time).
// The chat layer emits; it does not decide responses.
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { handleCrisisSignal, type SafetyEventType } from "@/server/services/ai-gates";

const bodySchema = z.object({
  child_id: z.string().uuid().nullable(),
  type: z.enum([
    "crisis_language",
    "abuse_disclosure",
    "mandatory_reporter_tripwire",
    "self_harm_plan",
    "eating_disorder_signal",
  ]),
  context_ref: z.string().max(500).nullable().optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const body = bodySchema.parse(await req.json());
  if (body.child_id) await assertTenant(body.child_id);
  return handleCrisisSignal(
    body.child_id,
    body.type as SafetyEventType,
    body.context_ref ?? undefined,
  );
});
