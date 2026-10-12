// POST /api/v1/children/[childId]/school/accommodations/[planId]/delivery-log
// FR-SCHOOL-012: per-accommodation delivery log (was extended time actually
// provided on the Unit 3 test?). Gaps surface as neutral "delivery gaps" for
// counselor conversation — never accusations.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requireParentRole } from "@/server/services/school";

const logSchema = z.object({
  accommodation_id: z.string().uuid().nullable().optional(),
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivered: z.boolean(),
  evidence: z.string().max(1000).nullable().optional(),
  noted_by: z.enum(["teen", "parent", "teacher"]),
});

export const POST = handleRoute<{ childId: string; planId: string }>(async (ctx, req) => {
  const params = z
    .object({ childId: z.string().uuid(), planId: z.string().uuid() })
    .parse(ctx.params);
  const tenant = await assertTenant(params.childId);
  await requireParentRole(tenant.childId);
  const body = logSchema.parse(await req.json());
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("accommodation_plans")
    .select("id")
    .eq("id", params.planId)
    .eq("child_id", tenant.childId)
    .maybeSingle();
  if (!plan) failWith(ErrorCodes.NOT_FOUND);

  const { data, error } = await supabase
    .from("accommodation_delivery_log")
    .insert({
      plan_id: params.planId,
      accommodation_id: body.accommodation_id ?? null,
      log_date: body.log_date,
      delivered: body.delivered,
      evidence: body.evidence ?? null,
      noted_by: body.noted_by,
    })
    .select("id, log_date, delivered, noted_by, created_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  await auditEvent(tenant.childId, "accommodation.delivery_logged", {
    delivered: body.delivered,
  });
  return { entry: data };
});

export const GET = handleRoute<{ childId: string; planId: string }>(async (ctx) => {
  const params = z
    .object({ childId: z.string().uuid(), planId: z.string().uuid() })
    .parse(ctx.params);
  const tenant = await assertTenant(params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accommodation_delivery_log")
    .select("id, accommodation_id, log_date, delivered, evidence, noted_by, created_at")
    .eq("plan_id", params.planId)
    .order("log_date", { ascending: false })
    .limit(100);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { entries: data ?? [] };
});
