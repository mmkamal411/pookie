// GET /api/v1/health/transition-summary — "take to your new doctor" (§2.5).
//
// Subject-only. Calls rpc_export_transition_summary() server-side.
//   format=json → machine-readable JSON download.
//   format=pdf  → complete print-ready clinical summary HTML (single-page
//                 summary + appendices), served as a printable document.
//                 H3 records are excluded by default; opt specific records
//                 in via include_h3 (comma-separated ids, default OFF).
// Every export is audit-logged by the RPC (access_events).
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import { uuidSchema, toHealthApiError, assertNoBannedWords } from '../_lib';

const querySchema = z.object({
  child_id: uuidSchema,
  format: z.enum(['json', 'pdf']).default('json'),
  include_h3: z.string().optional(),
});

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface SummaryPayload {
  exported_at: string;
  medications: { name: string; dose: string | null; schedule: string | null; started_at: string | null }[];
  allergies: { allergen: string; severity: string; source: string }[];
  immunizations: { vaccine_code: string; dose_number: number | null; administered_at: string | null; provider: string | null; form_3231_on_file: boolean }[];
  vitals_trends: { metric_key: string; display_name: string; unit: string | null; n: number; min_value: number; max_value: number; avg_value: number; provenance: string[]; window: string; disclaimer: string }[];
  h3_records_included: { id: string; entered_at: string; mood_label: string | null; journal_text: string | null; tier: string }[];
  emergency_contacts: { name: string; relationship: string; phone: string }[] | { note: string };
}

/** Complete clinical summary document (single-page summary + appendices). */
function renderClinicalSummary(s: SummaryPayload): string {
  const medRows = s.medications
    .map(
      (m) =>
        `<tr><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${esc(m.schedule)}</td><td>${esc(m.started_at)}</td></tr>`,
    )
    .join('');
  const allergyRows = s.allergies
    .map(
      (a) =>
        `<tr><td>${esc(a.allergen)}</td><td>${esc(a.severity)}</td><td>${esc(a.source)}</td></tr>`,
    )
    .join('');
  const immRows = s.immunizations
    .map(
      (i) =>
        `<tr><td>${esc(i.vaccine_code)}</td><td>${esc(i.dose_number)}</td><td>${esc(i.administered_at)}</td><td>${esc(i.provider)}</td><td>${i.form_3231_on_file ? 'Yes' : 'No'}</td></tr>`,
    )
    .join('');
  const vitalRows = s.vitals_trends
    .map(
      (v) =>
        `<tr><td>${esc(v.display_name)}</td><td>${esc(v.min_value)} – ${esc(v.max_value)} ${esc(v.unit)}</td><td>${esc(v.avg_value)}</td><td>${esc(v.n)} readings</td><td>${esc(v.provenance.join(', '))}</td></tr>`,
    )
    .join('');
  const h3Rows = s.h3_records_included
    .map(
      (h) =>
        `<tr><td>${esc(h.entered_at)}</td><td>${esc(h.mood_label)}</td><td>${esc(h.journal_text)}</td></tr>`,
    )
    .join('');
  const contacts = Array.isArray(s.emergency_contacts)
    ? s.emergency_contacts
        .map((c) => `<li>${esc(c.name)} (${esc(c.relationship)}) — ${esc(c.phone)}</li>`)
        .join('')
    : `<li>${esc((s.emergency_contacts as { note: string }).note)}</li>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Health Summary — exported ${esc(s.exported_at)}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;max-width:760px;margin:2rem auto;padding:0 1rem}
  h1{font-size:1.4rem} h2{font-size:1.1rem;margin-top:1.5rem;border-bottom:1px solid #ccc;padding-bottom:.25rem}
  table{border-collapse:collapse;width:100%;font-size:.85rem}
  th,td{border:1px solid #ddd;padding:.35rem .5rem;text-align:left}
  .footer{font-size:.75rem;color:#555;margin-top:2rem;border-top:1px solid #ccc;padding-top:.5rem}
  @media print{body{margin:0}}
</style></head><body>
<h1>Health Summary</h1>
<p>Exported ${esc(s.exported_at)}. Descriptive information only — not a medical device. For medical advice, talk to a clinician.</p>

<h2>Current Medications</h2>
<table><tr><th>Name</th><th>Dose</th><th>Schedule</th><th>Started</th></tr>${medRows || '<tr><td colspan="4">None recorded</td></tr>'}</table>
<p><em>Descriptive list only — never dosing advice.</em></p>

<h2>Allergies</h2>
<table><tr><th>Allergen</th><th>Severity</th><th>Source</th></tr>${allergyRows || '<tr><td colspan="3">None recorded</td></tr>'}</table>

<h2>Immunizations</h2>
<table><tr><th>CVX</th><th>Dose</th><th>Date</th><th>Provider</th><th>3231 on file</th></tr>${immRows || '<tr><td colspan="5">None recorded</td></tr>'}</table>

<h2>Vitals Trends (trailing 12 months)</h2>
<table><tr><th>Metric</th><th>Range</th><th>Avg</th><th>Readings</th><th>Source</th></tr>${vitalRows || '<tr><td colspan="5">No readings</td></tr>'}</table>
<p><em>Descriptive ranges as recorded by devices. Not a medical device.</em></p>

<h2>Appendix A — Emergency Contacts</h2>
<ul>${contacts}</ul>
<p><em>Emergency contact is not the same as access. A listed contact can be called in an emergency; they cannot see health information unless access was separately granted.</em></p>

<h2>Appendix B — Personal Records Included by Explicit Opt-In</h2>
<table><tr><th>Date</th><th>Mood</th><th>Entry</th></tr>${h3Rows || '<tr><td colspan="3">None included (excluded by default)</td></tr>'}</table>

<div class="footer">
Pookie health summary. Generated server-side; this document was streamed and never persisted.
Substance-use records are never included in this export — they have a separate disclosure instrument.
</div>
</body></html>`;
  assertNoBannedWords(html);
  return html;
}

export const GET = handleRoute(async ({ requestId }, req) => {
  const { searchParams } = new URL(req.url);
  const q = querySchema.parse({
    child_id: searchParams.get('child_id'),
    format: searchParams.get('format') ?? undefined,
    include_h3: searchParams.get('include_h3') ?? undefined,
  });

  // Tenant scope; subject-only enforcement is inside the RPC.
  const tenant = await assertTenant(q.child_id);
  if (tenant.role !== 'child') {
    throw new ApiError(ErrorCodes.HEALTH_TEEN_ONLY);
  }

  const includeH3 = (q.include_h3 ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of includeH3) uuidSchema.parse(id);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc('rpc_export_transition_summary', {
      p_format: q.format,
      p_include_h3_record_ids: includeH3,
    });
    if (error) throw error;
    const summary = data as SummaryPayload;

    await auditEvent(q.child_id, 'health.transition_summary_viewed', {
      format: q.format,
      h3_included: includeH3.length,
    });

    if (q.format === 'pdf') {
      // handleRoute wraps handler returns in the canonical JSON envelope,
      // so the printable document travels inside the envelope; the client
      // saves/prints it (print-to-PDF). The RPC already audit-logged.
      const html = renderClinicalSummary(summary);
      return {
        document_html: html,
        filename: 'pookie-health-summary.html',
        content_type: 'text/html; charset=utf-8',
        note: 'Print-ready clinical summary. Substance-use records are never included.',
      };
    }
    return summary;
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});
