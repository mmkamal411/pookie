// GET /api/v1/health/subjects/[subjectId]/metrics — visibility-filtered readings.
// POST /api/v1/health/subjects/[subjectId]/metrics — manual entry (subject-self or parent).
// Weight is never surfaced to child-role callers; teens cannot log it.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { DOCTOR_RAIL } from '@/server/health/copy';
import {
  getSubjectMetrics,
  logMetric,
  logMetricSchema,
} from '@/server/services/health';

const querySchema = z.object({
  metric: z.string().min(1).max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const GET = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const url = new URL(req.url);
  const query = querySchema.parse({
    metric: url.searchParams.get('metric') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const readings = await getSubjectMetrics(hctx, query);
  return {
    readings: readings.map((r) => ({
      id: r.id,
      metric_key: r.metric_key,
      value_numeric: r.value_numeric,
      value_text: r.value_text,
      recorded_at: r.recorded_at,
      source: r.source,
      note: r.note,
    })),
    meta: { disclaimer: DOCTOR_RAIL },
  };
});

export const POST = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const body = logMetricSchema.parse(await req.json());
  const reading = await logMetric(hctx, body);
  // Audit carries ids only — never the value (audit secret-guard).
  await auditEvent(hctx.subjectChildId, 'health_metric.logged', {
    subject_id: hctx.subjectRowId,
    metric_key: reading.metric_key,
  });
  return {
    reading: {
      id: reading.id,
      metric_key: reading.metric_key,
      value_numeric: reading.value_numeric,
      value_text: reading.value_text,
      recorded_at: reading.recorded_at,
      source: reading.source,
    },
    meta: { disclaimer: DOCTOR_RAIL },
  };
});
