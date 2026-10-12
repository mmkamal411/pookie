// GET /api/v1/household/vault/documents/[docId] — reveal a document's secret.
// Explicit user action: the read is audited, decryption runs server-side, and
// the secret is never logged or persisted. Parent-only.
// DELETE — remove the document (cryptographic erasure).
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { deleteDocument, revealDocument } from '@/server/services/vault';

type Params = { docId: string };

export const GET = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const { meta, secret } = await revealDocument(household.ownerUserId, ctx.params.docId);
  await auditEvent(household.anchorChildId, 'vault_document.revealed', {
    document_id: meta.id,
    doc_type: meta.doc_type,
  });
  return { document: meta, secret };
});

export const DELETE = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  await deleteDocument(household.ownerUserId, ctx.params.docId);
  await auditEvent(household.anchorChildId, 'vault_document.deleted', {
    document_id: ctx.params.docId,
  });
  return { deleted: true };
});
