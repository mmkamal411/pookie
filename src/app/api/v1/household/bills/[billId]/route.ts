// /api/v1/household/bills/[billId] — Bill Tracker (Squad Value).
import { handleRoute } from "@/server/rest";
import { billPatchSchema, deleteBill, patchBill } from "@/server/services/bills";

export const PATCH = handleRoute<{ billId: string }>(async (ctx, req) => {
  const body = billPatchSchema.parse(await req.json());
  return patchBill(ctx.params.billId, body);
});

export const DELETE = handleRoute<{ billId: string }>(async (ctx) => {
  return deleteBill(ctx.params.billId);
});
