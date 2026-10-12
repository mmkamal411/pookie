// /api/v1/household/bills — Bill Tracker (Squad Value).
import { handleRoute } from "@/server/rest";
import { billCreateSchema, createBill, listBills } from "@/server/services/bills";
import { z } from "zod";

const querySchema = z.object({ status: z.string().default("all") });

export const GET = handleRoute(async (_ctx, req) => {
  const { status } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  return listBills(status);
});

export const POST = handleRoute(async (_ctx, req) => {
  const body = billCreateSchema.parse(await req.json());
  return createBill(body);
});
