// POST /api/v1/health/subjects/[subjectId]/overrides/[overrideId]/revoke
// Parent-only revocation (append-only: revoked_at, never delete).
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { revokeOverride } from '@/server/services/health';

export const POST = handleRoute<{
  subjectId: string;
  overrideId: string;
}>(async (ctx) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const override = await revokeOverride(hctx, ctx.params.overrideId);
  await auditEvent(hctx.subjectChildId, 'health_override.revoked', {
    subject_id: hctx.subjectRowId,
    override_id: override.id,
  });
  return {
    override: {
      id: override.id,
      metric_key: override.metric_key,
      revoked_at: override.revoked_at,
      active: false,
    },
  };
});
