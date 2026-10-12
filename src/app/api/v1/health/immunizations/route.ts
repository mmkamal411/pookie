// /api/v1/health/immunizations — G22 immunization management (sol-health §9).
//
// GET:  list immunizations for a subject (H1 while <18; RLS tier-filtered).
// POST: record a dose (CVX code, dose number, administered date, provider,
//       lot, source, 3231 on-file + expiry).
//
// CVX codes: CDC standard (e.g. HPV = 62/118/165). Free-text vaccine names
// are not accepted — the route validates against a CVX allowlist so dose
// histories stay machine-readable for school/college form exports.
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema, toHealthApiError } from '../_lib';
import { failWith, ErrorCodes } from '@/server/errors';

// CDC CVX codes relevant to adolescent schedules (subset; the full table is
// reference data — unknown codes are refused rather than free-texted).
const CVX_ALLOWLIST = new Set([
  '62', '118', '165', // HPV (HPV2/HPV4/HPV9)
  '115', // Tdap
  '114', // MCV4 (MenACWY)
  '108', // MenB
  '83', // HepA
  '08', '42', '43', '44', '45', // HepB variants
  '10', // IPV (polio)
  '03', '05', '06', '07', '94', // MMR variants
  '21', // Varicella
  '120', // DTaP-HepB-IPV
  '196', '197', '198', // COVID-19 mRNA variants
  '88', // Influenza (generic)
]);

const immunizationSchema = z.object({
  subject_id: uuidSchema,
  vaccine_code: z.string().regex(/^[0-9]{1,3}$/),
  dose_number: z.number().int().min(1).max(10).optional(),
  administered_at: z.string().date().optional(),
  provider: z.string().max(160).optional(),
  lot_number: z.string().max(60).optional(),
  source: z.enum(['manual', 'provider_import', 'ga_grits']).default('manual'),
  doc_path: z.string().max(400).optional(),
  form_3231_on_file: z.boolean().default(false),
  form_3231_expires: z.string().date().optional(),
});

const querySchema = z.object({
  subject_id: uuidSchema,
});

export const GET = handleRoute(async ({ requestId }, req) => {
  const { searchParams } = new URL(req.url);
  const q = querySchema.parse({ subject_id: searchParams.get('subject_id') });
  await assertHealthSubject(q.subject_id);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('immunizations')
      .select(
        'id, vaccine_code, dose_number, administered_at, provider, lot_number, source, form_3231_on_file, form_3231_expires, verified_by_parent, health_tier',
      )
      .eq('subject_id', q.subject_id)
      .order('administered_at', { ascending: false });
    if (error) throw error;
    return { immunizations: data ?? [] };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});

export const POST = handleRoute(async ({ requestId, userId }, req) => {
  const body = immunizationSchema.parse(await req.json());
  if (!CVX_ALLOWLIST.has(body.vaccine_code)) {
    // Unknown CVX: refuse rather than accept free text (machine-readable
    // histories are required for school/college form exports).
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  const subject = await assertHealthSubject(body.subject_id);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('immunizations')
      .insert({
        subject_id: body.subject_id,
        vaccine_code: body.vaccine_code,
        dose_number: body.dose_number ?? null,
        administered_at: body.administered_at ?? null,
        provider: body.provider ?? null,
        lot_number: body.lot_number ?? null,
        source: body.source,
        doc_path: body.doc_path ?? null,
        form_3231_on_file: body.form_3231_on_file,
        form_3231_expires: body.form_3231_expires ?? null,
        entered_by: userId,
        health_tier: 'H1',
      })
      .select('id, vaccine_code, dose_number, administered_at')
      .single();
    if (error) throw error;
    await auditEvent(subject.subjectChildId!, 'health.immunization_recorded', {
      vaccine_code: body.vaccine_code,
    });
    return { immunization: data };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});
