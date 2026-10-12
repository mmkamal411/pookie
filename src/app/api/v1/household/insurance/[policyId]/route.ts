// /api/v1/household/insurance/[policyId] — Insurance Policy Tracker (Phase1-Insurance).
import { handleRoute } from "@/server/rest";
import { deletePolicy, policyPutSchema, putPolicy } from "@/server/services/insurance";

export const PUT = handleRoute<{ policyId: string }>(async (ctx, req) => {
  const body = policyPutSchema.parse(await req.json());
  return putPolicy(ctx.params.policyId, body);
});

export const DELETE = handleRoute<{ policyId: string }>(async (ctx) => {
  return deletePolicy(ctx.params.policyId);
});
