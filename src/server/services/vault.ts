// W7 Money & Documents vault — business logic.
// NFR-SEC-006: never persist full PANs. The API layer rejects any payload
// containing a 13–19 digit run (card shape) BEFORE encryption; only last4_ref
// is stored in the clear. Encryption/decryption happen through the
// service_role path (vault_doc_encrypt/vault_doc_decrypt) with a server-only
// key — client JWTs never touch plaintext or the key.
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ErrorCodes, failWith } from '@/server/errors';

export type VaultDocType =
  | 'card' | 'bank_account' | 'tax' | 'insurance'
  | 'medical' | 'legal' | 'identity' | 'loan' | 'other';

export interface VaultDocumentMeta {
  id: string;
  owner_user_id: string;
  doc_type: VaultDocType;
  doc_label: string;
  last4_ref: string | null;
  created_by: string;
  retention_until: string | null;
  expires_on: string | null;
  created_at: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

const META_COLS =
  'id, owner_user_id, doc_type, doc_label, last4_ref, created_by, retention_until, expires_on, created_at';

/** Reject payloads carrying full card/account numbers (13–19 digit runs). */
export function assertNoFullPan(payload: string, label: string): void {
  const digits = payload.replace(/\D/g, '');
  if (/\d{13,19}/.test(payload.replace(/[\s-]/g, '')) || digits.length >= 13) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  if (/\d{8,}/.test(label.replace(/[\s-]/g, ''))) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
}

function toMeta(row: Record<string, unknown>): VaultDocumentMeta {
  return {
    id: row.id as string,
    owner_user_id: row.owner_user_id as string,
    doc_type: row.doc_type as VaultDocType,
    doc_label: row.doc_label as string,
    last4_ref: (row.last4_ref as string) ?? null,
    created_by: row.created_by as string,
    retention_until: (row.retention_until as string) ?? null,
    expires_on: (row.expires_on as string) ?? null,
    created_at: row.created_at as string,
  };
}

function vaultKey(): string {
  const key = process.env.VAULT_DOC_ENCRYPTION_KEY;
  if (!key) failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
  return key;
}

export interface StoreDocumentInput {
  doc_type: VaultDocType;
  doc_label: string;
  /** The secret payload (JSON string). Must NOT contain a full PAN. */
  secret: string;
  last4_ref?: string;
  expires_on?: string;
}

/** Encrypt + store a document. Retention is computed server-side per doc_type. */
export async function storeDocument(
  ownerUserId: string,
  userId: string,
  input: StoreDocumentInput,
): Promise<VaultDocumentMeta> {
  assertNoFullPan(input.secret, input.doc_label);
  const { data: ciphertext, error: encError } = await supabaseAdmin.rpc('vault_doc_encrypt', {
    p_plaintext: input.secret,
    p_key: vaultKey(),
  });
  if (encError || !ciphertext) failWith(ErrorCodes.INTERNAL);
  const { data: retention, error: retError } = await supabaseAdmin.rpc('vault_retention_until', {
    p_doc_type: input.doc_type,
  });
  if (retError) failWith(ErrorCodes.INTERNAL);
  const { data, error } = await supabaseAdmin.from('vault_documents').insert({
    owner_user_id: ownerUserId,
    doc_type: input.doc_type,
    doc_label: input.doc_label,
    encrypted_blob: ciphertext,
    last4_ref: input.last4_ref ?? null,
    created_by: userId,
    retention_until: retention as string | null,
    expires_on: input.expires_on ?? null,
    data_class: 'S',
  }).select(META_COLS).single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toMeta(data as Record<string, unknown>);
}

/** List document metadata (never plaintext). RLS: parents only. */
export async function listDocuments(
  supabase: Db,
  ownerUserId: string,
): Promise<VaultDocumentMeta[]> {
  const { data, error } = await supabase
    .from('vault_documents')
    .select(META_COLS)
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) failWith(ErrorCodes.INTERNAL);
  return ((data ?? []) as Record<string, unknown>[]).map(toMeta);
}

/**
 * Reveal a document's secret. Explicit user action only: the route audits this
 * read, and decryption runs server-side via service_role. Returns the plaintext
 * to the route, which must not log or persist it.
 */
export async function revealDocument(
  ownerUserId: string,
  docId: string,
): Promise<{ meta: VaultDocumentMeta; secret: string }> {
  const { data, error } = await supabaseAdmin
    .from('vault_documents')
    .select(`${META_COLS}, encrypted_blob`)
    .eq('id', docId)
    .eq('owner_user_id', ownerUserId)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  const row = data as Record<string, unknown>;
  const { data: plaintext, error: decError } = await supabaseAdmin.rpc('vault_doc_decrypt', {
    p_ciphertext: row.encrypted_blob,
    p_key: vaultKey(),
  });
  if (decError || plaintext == null) failWith(ErrorCodes.INTERNAL);
  const { encrypted_blob: _ignored, ...metaRow } = row;
  return { meta: toMeta(metaRow), secret: plaintext as string };
}

/** Delete a document (parent-owned; deletion is cryptographic erasure). */
export async function deleteDocument(ownerUserId: string, docId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('vault_documents')
    .delete()
    .eq('id', docId)
    .eq('owner_user_id', ownerUserId);
  if (error) failWith(ErrorCodes.INTERNAL);
}
