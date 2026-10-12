// /api/v1/health/immunizations/[id] — PATCH / DELETE a dose record.
//
// PATCH: update dose fields (provider-entered corrections). 3231 expiry
//   updates re-arm the reminder ledger for the new date.
// DELETE: tombstone (deleted_at); the §3.3 purge pipeline hard-deletes ≤30
//   days and removes the 3231 PDF from the health-documents bucket.
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import { uuidSchema, toHealthApiError } from '../../_lib';

const patchSchema = z.object({
  dose_number: z.number().int().min(1).max(10).optional(),
  administered_at: z.string().date().optional(),
  provider: z.string().max(160).optional(),
  lot_number: z.string().max(60).optional(),
  form_3231_on_file: z.boolean().optional(),
  form_3231_expires: z.string().date().nullable().optional(),
  verified_by_parent: z.boolean().optional(),
});

export const PATCH = handleRoute<{ id: string }>(
  async ({ requestId, params }, req) => {
    const id = uuidSchema.parse(params.id);
    const body = patchSchema.parse(await req.json());
    const supabase = await createClient();

    const { data: row, error: rowErr } = await supabase
      .from('immunizations')
      .select('id, subject_id, health_subjects!inner(child_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (rowErr || !row) throw new ApiError(ErrorCodes.NOT_FOUND);
    const childId = (row.health_subjects as unknown as { child_id: string }).child_id;
    await assertTenant(childId);

    try {
      const { data, error } = await supabase
        .from('immunizations')
        .update({ ...body })
        .eq('id', id)
        .select('id, vaccine_code, dose_number, form_3231_expires')
        .single();
      if (error) throw error;

      // 3231 expiry moved → re-arm reminders: drop ledger rows for windows
      // that are now in the future again so they re-fire.
      if (body.form_3231_expires !== undefined && body.form_3231_expires) {
        await supabase
          .from('immunization_reminder_log')
          .delete()
          .eq('immunization_id', id)
          .lt(
            'window_days',
            Math.ceil(
              (new Date(body.form_3231_expires).getTime() - Date.now()) /
                86400000,
            ),
          );
      }

      await auditEvent(childId, 'health.immunization_updated', { id });
      return { immunization: data };
    } catch (err) {
      toHealthApiError(err, requestId);
    }
  },
);

export const DELETE = handleRoute<{ id: string }>(
  async ({ requestId, params }) => {
    const id = uuidSchema.parse(params.id);
    const supabase = await createClient();

    const { data: row, error: rowErr } = await supabase
      .from('immunizations')
      .select('id, health_subjects!inner(child_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (rowErr || !row) throw new ApiError(ErrorCodes.NOT_FOUND);
    const childId = (row.health_subjects as unknown as { child_id: string }).child_id;
    await assertTenant(childId);

    try {
      const { error } = await supabase
        .from('immunizations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await auditEvent(childId, 'health.immunization_deleted', { id });
      return { tombstoned: true };
    } catch (err) {
      toHealthApiError(err, requestId);
    }
  },
);
