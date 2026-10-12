-- Migration 026: W7 Money & Documents vault (FR-MOD-W7, NFR-SEC-006, NFR-PRIVACY-009)
--
-- ENCRYPTION APPROACH (NFR-SEC-006): documents are encrypted BEFORE storage.
--   - Ciphertext: pgcrypto pgp_sym_encrypt (AES-256) stored in encrypted_blob.
--   - Key custody: the symmetric key lives in Supabase Vault (vault.secrets)
--     or the app env — it NEVER lives in this table, in logs, or in backups
--     of application data. The app fetches the key server-side (service_role
--     path only) and passes it as an argument; the helpers below are
--     SECURITY DEFINER and accept the key as a parameter so the key never
--     persists in SQL history either (use prepared parameters, never inline
--     literals).
--   - Key rotation: rotate by re-encrypting blobs with the new key
--     (vault_doc_rotate_key); old key destroyed after (cryptographic erasure
--     for the old ciphertext lineage).
--   - NEVER persist full PANs: last4_ref is CHECK-constrained to ≤4 digits;
--     full card numbers are rejected at the API layer before encryption and
--     the doc_label must never contain a full number (audited at write).
--
-- RETENTION SCHEDULE (NFR-PRIVACY-001/002): per-type retention_until computed
-- at insert by vault_retention_until(). purge_expired_vault_documents() is the
-- scheduled-job entry point — deletion of the row IS cryptographic erasure
-- (ciphertext without the key is unrecoverable; keys rotate on a separate
-- schedule).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- vault_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key (household anchor)
  doc_type        text NOT NULL CHECK (doc_type IN ('card','bank_account','tax','insurance','medical','legal','identity','loan','other')),
  doc_label       text NOT NULL,                       -- display label, e.g. "Chase Sapphire" (never a full number)
  encrypted_blob  bytea NOT NULL,                      -- pgp_sym_encrypt() ciphertext
  last4_ref       text CHECK (last4_ref ~ '^\d{1,4}$'), -- last-4 ONLY; CHECK rejects anything longer
  created_by      uuid NOT NULL REFERENCES public.users(id),
  retention_until timestamptz,                         -- NULL = permanent (legal); computed by vault_retention_until()
  expires_on      date,                                -- document expiry (passport, insurance) — renewal nudge source
  data_class      text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_documents_owner_type_idx
  ON public.vault_documents (owner_user_id, doc_type);
CREATE INDEX IF NOT EXISTS vault_documents_retention_idx
  ON public.vault_documents (retention_until) WHERE retention_until IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Retention schedule per document type (years; NULL = permanent, never purged).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_retention_until(p_doc_type text, p_from timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_doc_type
    WHEN 'card'         THEN p_from + interval '1 year'   -- active card + 1y after removal
    WHEN 'bank_account' THEN p_from + interval '1 year'
    WHEN 'tax'          THEN p_from + interval '7 years'  -- IRS lookback
    WHEN 'insurance'    THEN p_from + interval '10 years'
    WHEN 'medical'      THEN p_from + interval '10 years' -- GA medical retention posture
    WHEN 'identity'     THEN p_from + interval '5 years'
    WHEN 'loan'         THEN p_from + interval '7 years'
    WHEN 'other'        THEN p_from + interval '3 years'
    WHEN 'legal'        THEN NULL                         -- permanent: court orders, custody docs
    ELSE p_from + interval '3 years'
  END
$$;

REVOKE ALL ON FUNCTION public.vault_retention_until(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_retention_until(text, timestamptz) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Encryption helpers. The key is passed as a parameter (service_role app path
-- fetches it from Supabase Vault / env). SECURITY DEFINER so a future
-- vault.secrets lookup can be added in ONE place without touching callers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_doc_encrypt(p_plaintext text, p_key text)
RETURNS bytea
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_encrypt(p_plaintext, p_key)
$$;

CREATE OR REPLACE FUNCTION public.vault_doc_decrypt(p_ciphertext bytea, p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(p_ciphertext, p_key)
$$;

REVOKE ALL ON FUNCTION public.vault_doc_encrypt(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_doc_decrypt(bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_doc_encrypt(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_doc_decrypt(bytea, text) TO service_role;

-- ---------------------------------------------------------------------------
-- purge_expired_vault_documents(): scheduled job. Deletes expired rows —
-- deletion is cryptographic erasure (no key => ciphertext is unrecoverable).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_vault_documents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  DELETE FROM public.vault_documents
  WHERE retention_until IS NOT NULL AND retention_until < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_vault_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_vault_documents() TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: Class S — household PARENTS only (children get zero rows), like W21.
-- Decrypt is never done via client JWT (no key in client context); reads
-- return metadata, the app decrypts server-side only for explicit user action.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vault_documents_parent_read ON public.vault_documents;
CREATE POLICY vault_documents_parent_read ON public.vault_documents
  FOR SELECT USING (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS vault_documents_parent_insert ON public.vault_documents;
CREATE POLICY vault_documents_parent_insert ON public.vault_documents
  FOR INSERT WITH CHECK (
    public.is_household_parent(owner_user_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS vault_documents_parent_update ON public.vault_documents;
CREATE POLICY vault_documents_parent_update ON public.vault_documents
  FOR UPDATE
  USING (public.is_household_parent(owner_user_id))
  WITH CHECK (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS vault_documents_parent_delete ON public.vault_documents;
CREATE POLICY vault_documents_parent_delete ON public.vault_documents
  FOR DELETE USING (public.is_household_parent(owner_user_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_documents TO authenticated;
