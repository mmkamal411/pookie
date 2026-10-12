// GET /api/v1/household/vault/documents — document metadata (never secrets).
// POST — encrypt + store a document. NFR-SEC-006: payloads carrying full
// card/account numbers (13–19 digit runs) are rejected BEFORE encryption;
// only last4_ref is stored in the clear. Parent-only (Class S).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { listDocuments, storeDocument } from '@/server/services/vault';

const docTypeSchema = z.enum([
  'card', 'bank_account', 'tax', 'insurance',
  'medical', 'legal', 'identity', 'loan', 'other',
]);

const storeSchema = z.object({
  doc_type: docTypeSchema,
  doc_label: z.string().min(1).max(120),
  secret: z.string().min(1).max(20000),
  last4_ref: z.string().regex(/^\d{1,4}$/).optional(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handleRoute(async () => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const supabase = await createClient();
  const documents = await listDocuments(supabase, household.ownerUserId);
  await auditEvent(household.anchorChildId, 'vault_documents.viewed', {
    count: documents.length,
  });
  return { documents };
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = storeSchema.parse(await req.json());
  const document = await storeDocument(household.ownerUserId, household.userId, body);
  await auditEvent(household.anchorChildId, 'vault_document.stored', {
    document_id: document.id,
    doc_type: document.doc_type,
  });
  return { document };
});
