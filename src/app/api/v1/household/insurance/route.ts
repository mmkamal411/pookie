// /api/v1/household/insurance — Insurance Policy Tracker (Phase1-Insurance).
import { handleRoute } from "@/server/rest";
import { createPolicy, listPolicies, policyCreateSchema } from "@/server/services/insurance";

export const GET = handleRoute(async () => {
  return listPolicies();
});

export const POST = handleRoute(async (_ctx, req) => {
  const body = policyCreateSchema.parse(await req.json());
  return createPolicy(body);
});
