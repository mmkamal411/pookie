// GET /api/v1/ai/direct-mode/eligibility
// FR-AI-002: server-side 18+ gate for Muse Direct Mode. Under-18: the mode
// does not exist in the UI and this returns { eligible: false } — the chat
// layer must 403 regardless of client state. Age is computed server-side at
// request time from a VERIFIED date of birth.
import { handleRoute } from "@/server/rest";
import { isDirectModeEligible } from "@/server/services/ai-gates";

export const GET = handleRoute(async (ctx) => {
  const eligible = await isDirectModeEligible(ctx.userId);
  return { eligible, mode: eligible ? "direct" : "pookie" };
});
