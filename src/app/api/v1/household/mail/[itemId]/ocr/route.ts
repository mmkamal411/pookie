// POST /api/v1/household/mail/[itemId]/ocr — run the §3.3 OCR pipeline.
// Extract-then-mask is enforced in the pipeline (NFR-PRIVACY-009): the
// extractor sees the raw reading, but what persists to ocr_text is masked
// (digit runs ≥8 → ****last4). Returns metadata only; the masked text is read
// through the audited detail route. Parent-only.
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { runOcrPipeline } from '@/server/ocr/pipeline';

type Params = { itemId: string };

const ocrSchema = z.object({
  providerKey: z.string().max(80).optional(),
  externalConsent: z.boolean().optional(),
  force: z.boolean().optional(),
});

export const POST = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = ocrSchema.parse(await req.json().catch(() => ({})));
  const supabase = await createClient();
  const result = await runOcrPipeline(supabase, supabaseAdmin, household, ctx.params.itemId, {
    providerKey: body.providerKey,
    externalConsent: body.externalConsent,
    force: body.force,
  });
  return result;
});
