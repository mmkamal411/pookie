// GET /api/v1/health/subjects/[subjectId]/overrides — parent-only list.
// POST /api/v1/health/subjects/[subjectId]/overrides — parent-only grant.
// The override is audited and the teen is notified in-transaction
// (teen_notified_at); override reads are audited (disclosure accounting).
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import {
  createOverride,
  createOverrideSchema,
  listOverrides,
} from '@/server/services/health';

function shape(o: {
  id: string;
  metric_key: string;
  reason: string;
  teen_notified_at: string;
  revoked_at: string | null;
  created_at: string;
}) {
  return {
    id: o.id,
    metric_key: o.metric_key,
    reason: o.reason,
    teen_notified_at: o.teen_notified_at,
    revoked_at: o.revoked_at,
    created_at: o.created_at,
    active: o.revoked_at == null,
  };
}

export const GET = handleRoute<{ subjectId: string }>(async (ctx) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const overrides = await listOverrides(hctx);
  await auditEvent(hctx.subjectChildId, 'health_override.read', {
    subject_id: hctx.subjectRowId,
  });
  return { overrides: overrides.map(shape) };
});

export const POST = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const body = createOverrideSchema.parse(await req.json());
  const override = await createOverride(hctx, body);
  // Audit carries ids only — never the reason text or values.
  await auditEvent(hctx.subjectChildId, 'health_override.granted', {
    subject_id: hctx.subjectRowId,
    metric_key: override.metric_key,
    override_id: override.id,
  });
  return { override: shape(override) };
});
