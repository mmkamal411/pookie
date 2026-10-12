// /api/v1/children/[childId]/school/accommodations
// FR-SCHOOL-012 (G20): 504/IEP plans — store the plan, track delivery, log
// review dates. The teen sees their own plan in full (self-advocacy).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { ApiError, mapDbError } from "@/server/errors";
import { requireParentRole } from "@/server/services/school";

const planSchema = z.object({
  plan_type: z.enum(["504", "IEP"]),
  plan_year: z.string().min(1).max(20),
  document_ref: z.string().max(500).nullable().optional(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  next_review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  case_manager: z.string().max(200).nullable().optional(),
  school_year: z.string().max(20).nullable().optional(),
  accommodations: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        setting: z.enum(["classroom", "testing", "both"]),
        responsible_party: z.string().max(200).nullable().optional(),
      }),
    )
    .max(30)
    .default([]),
});

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("accommodation_plans")
    .select(
      "id, plan_type, plan_year, document_ref, review_date, next_review_date, case_manager, school_year, created_at, plan_accommodations(id, description, setting, responsible_party)",
    )
    .eq("child_id", tenant.childId)
    .order("created_at", { ascending: false });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { plans: plans ?? [] };
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  await requireParentRole(tenant.childId);
  const body = planSchema.parse(await req.json());
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("accommodation_plans")
    .insert({
      child_id: tenant.childId,
      plan_type: body.plan_type,
      plan_year: body.plan_year,
      document_ref: body.document_ref ?? null,
      review_date: body.review_date ?? null,
      next_review_date: body.next_review_date ?? null,
      case_manager: body.case_manager ?? null,
      school_year: body.school_year ?? null,
    })
    .select("id")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const planId = (plan as { id: string }).id;
  if (body.accommodations.length > 0) {
    const { error: accErr } = await supabase.from("plan_accommodations").insert(
      body.accommodations.map((a) => ({
        plan_id: planId,
        description: a.description,
        setting: a.setting,
        responsible_party: a.responsible_party ?? null,
      })),
    );
    if (accErr) throw new ApiError(mapDbError(accErr, crypto.randomUUID()));
  }
  await auditEvent(tenant.childId, "accommodation.plan_created", { plan_type: body.plan_type });
  return { plan_id: planId };
});
