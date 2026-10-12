// /api/v1/health/wellbeing — W8 wellbeing entries (sol-health §5).
//
// POST: create a mood/journal entry. Teen-only (RLS). Entries the teen marks
//   as mental-health care / self-harm / disordered eating are tiered H3
//   server-side (DB trigger; the teen cannot downgrade).
//   crisis op: "I need help now" → mood_critical event (high).
// GET: list the caller's own entries (teen-only RLS; no parent arm).
// DELETE: tombstone via rpc_health_record_delete (H3 → hard delete next run).
//
// Crisis-response (988 surfacing, trusted-adult routing) belongs to the
// safety pipeline consuming wellbeing_events; this route emits events only.
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import { uuidSchema, toHealthApiError } from '../_lib';

const careCategorySchema = z.enum([
  'none',
  'mental_health_care',
  'self_harm',
  'disordered_eating',
]);

const entrySchema = z.object({
  op: z.literal('entry').default('entry'),
  child_id: uuidSchema,
  mood_score: z.number().int().min(1).max(5).optional(),
  mood_label: z.string().max(80).optional(),
  journal_text: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  care_category: careCategorySchema.default('none'),
  auto_purge_after_days: z.enum(['30', '90', '365']).optional(),
});

const helpNowSchema = z.object({
  op: z.literal('help_now'),
  child_id: uuidSchema,
});

const deleteSchema = z.object({
  op: z.literal('delete'),
  child_id: uuidSchema,
  entry_id: uuidSchema,
});

const bodySchema = z.discriminatedUnion('op', [
  entrySchema,
  helpNowSchema,
  deleteSchema,
]);

const querySchema = z.object({
  child_id: uuidSchema,
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
});

export const GET = handleRoute(async ({ requestId }, req) => {
  const { searchParams } = new URL(req.url);
  const q = querySchema.parse({
    child_id: searchParams.get('child_id'),
    limit: searchParams.get('limit') ?? undefined,
    before: searchParams.get('before') ?? undefined,
  });
  // assertTenant anchors audit + tenant scope; RLS restricts to the teen.
  await assertTenant(q.child_id);
  const supabase = await createClient();
  try {
    let query = supabase
      .from('wellbeing_entries')
      .select(
        'id, entered_at, mood_score, mood_label, tags, care_category, health_tier, auto_purge_after_days',
      )
      .eq('child_id', q.child_id)
      .order('entered_at', { ascending: false })
      .limit(q.limit);
    if (q.before) query = query.lt('entered_at', q.before);
    const { data, error } = await query;
    if (error) throw error;
    return { entries: data ?? [] };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});

export const POST = handleRoute(async ({ requestId, userId }, req) => {
  const body = bodySchema.parse(await req.json());
  const supabase = await createClient();
  // Tenant scope; teen-only enforcement is RLS + child-role checks below.
  const tenant = await assertTenant(body.child_id);
  if (tenant.role !== 'child') {
    throw new ApiError(ErrorCodes.HEALTH_TEEN_ONLY);
  }

  // ---- help_now: "I need help now" (sol-health §5.3, severity high) ----
  if (body.op === 'help_now') {
    try {
      const { error } = await supabase.rpc('emit_wellbeing_event', {
        p_child_id: body.child_id,
        p_event_type: 'mood_critical',
        p_severity: 'high',
      });
      if (error) throw error;
    } catch (err) {
      toHealthApiError(err, requestId);
    }
    await auditEvent(body.child_id, 'wellbeing.help_now', {});
    return {
      emitted: 'mood_critical',
      resources: {
        call_988: 'Call or text 988',
        crisis_text_line: 'Text HOME to 741741',
        ga_crisis_line: '1-800-715-4225',
      },
    };
  }

  // ---- delete: tombstone now (§3.3); H3 fast path next nightly run ----
  if (body.op === 'delete') {
    try {
      const { data, error } = await supabase.rpc('rpc_health_record_delete', {
        p_table: 'wellbeing_entries',
        p_record_id: body.entry_id,
      });
      if (error) throw error;
      await auditEvent(body.child_id, 'wellbeing.entry_deleted', {});
      return data;
    } catch (err) {
      toHealthApiError(err, requestId);
    }
  }

  // ---- entry ----
  const healthTier =
    body.care_category === 'none' ? 'H2' : 'H3'; // DB trigger enforces regardless
  try {
    const { data, error } = await supabase
      .from('wellbeing_entries')
      .insert({
        child_id: body.child_id,
        mood_score: body.mood_score ?? null,
        mood_label: body.mood_label ?? null,
        journal_text: body.journal_text ?? null,
        tags: body.tags,
        care_category: body.care_category,
        health_tier: healthTier,
        entered_by: userId,
        auto_purge_after_days: body.auto_purge_after_days
          ? parseInt(body.auto_purge_after_days, 10)
          : null,
      })
      .select('id, entered_at, health_tier')
      .single();
    if (error) throw error;

    // Data-side event emission (§5.3). Metadata only — never content.
    const events: string[] = [];
    if (body.mood_score === 1) {
      const { error: e1 } = await supabase.rpc('emit_wellbeing_event', {
        p_child_id: body.child_id,
        p_event_type: 'mood_critical',
        p_severity: 'high',
      });
      if (e1) throw e1;
      events.push('mood_critical');
    }
    if (body.care_category === 'self_harm') {
      const { error: e2 } = await supabase.rpc('emit_wellbeing_event', {
        p_child_id: body.child_id,
        p_event_type: 'self_harm_disclosure',
        p_severity: 'high',
      });
      if (e2) throw e2;
      events.push('self_harm_disclosure');
    }
    if (body.care_category === 'disordered_eating') {
      const { error: e3 } = await supabase.rpc('emit_wellbeing_event', {
        p_child_id: body.child_id,
        p_event_type: 'ed_signal',
        p_severity: 'medium',
      });
      if (e3) throw e3;
      events.push('ed_signal');
    }
    // Server-side pattern detection runs nightly; also check on write for
    // immediate feedback (flag only, no content leaves).
    if (body.mood_score !== undefined) {
      await supabase.rpc('detect_wellbeing_pattern', {
        p_child_id: body.child_id,
      });
    }

    await auditEvent(body.child_id, 'wellbeing.entry_created', {
      tier: healthTier,
      events,
    });
    return { entry: data, events_emitted: events };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});
