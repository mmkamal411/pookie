-- Migration 003: Per-child credential vault + Portals UI metadata
-- Source: PLAN.md §3.1, §4.8
-- Passwords live in Supabase Vault (AES-256-GCM, managed). This table holds
-- METADATA ONLY. RLS alone cannot hide columns — vault_secret_id is never
-- exposed to client roles (see secret-less view + column GRANTs below).

-- Enable Vault (one-line per plan)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ---------------------------------------------------------------------------
-- child_portals: per-child portal credentials (metadata only)
-- child_id NULLABLE: NULL = parent-level portal (e.g. ParentVUE covering all children)
-- FIX 2026-10-11: NULL-child_id rows are FAMILY-scoped via owner_user_id.
-- Without this, in a multi-family future ANY parent of ANY child could read
-- (and overwrite) another family's parent-level portal credentials: the old
-- get_tenant_secret matched `cp.child_id IS NULL` with no family predicate,
-- the vault secret name 'tenant_parent__<system>' collided across families
-- (family B's set_tenant_secret would OVERWRITE family A's Vault secret),
-- and UNIQUE(child_id, portal_key) never fires on NULLs so duplicate NULL
-- rows accumulated with ON CONFLICT silently missing every time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_portals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid REFERENCES public.children(id) ON DELETE CASCADE,
  owner_user_id    uuid REFERENCES public.users(id),
  portal_key       text NOT NULL,          -- e.g. 'studentvue', 'parentvue', 'ctls-learn'
  label            text NOT NULL,          -- display label
  username         text,                   -- portal username (not secret)
  vault_secret_id  uuid,                   -- references vault.secrets(id); NEVER to clients
  status           text NOT NULL DEFAULT 'unverified'
                     CHECK (status IN ('unverified','verified','failed')),
  last_verified_at timestamptz,
  -- FIX 2026-10-11 R2 (integration-expert H6/H7): PLAN §4.8 failure-mode
  -- schema backing.
  consecutive_failures   int NOT NULL DEFAULT 0,      -- worker-owned auth-failure counter
  credentials_updated_at timestamptz NOT NULL DEFAULT now(),  -- bumped on every rotation
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, portal_key),
  -- A parent-level (NULL child_id) row MUST record which family's parent owns it.
  CONSTRAINT child_portals_null_row_has_owner
    CHECK (child_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

-- One parent-level row per portal per owning parent (NULLs never conflict in
-- the table-level UNIQUE above, so this partial index is the real guard).
CREATE UNIQUE INDEX IF NOT EXISTS child_portals_null_owner_portal_uniq
  ON public.child_portals (owner_user_id, portal_key) WHERE child_id IS NULL;

CREATE INDEX IF NOT EXISTS child_portals_child_id_idx ON public.child_portals (child_id);

-- FIX 2026-10-11 R2: idempotent backfill of the failure-mode columns for
-- projects where child_portals already exists from the R1 migration run.
ALTER TABLE public.child_portals
  ADD COLUMN IF NOT EXISTS consecutive_failures   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credentials_updated_at timestamptz NOT NULL DEFAULT now();

-- FAILURE MODE (PLAN §4.8) — enforcement contract, read before changing:
-- consecutive_failures is incremented by the WORKER on each sanitized
-- portal-auth failure and reset to 0 on success (the worker owns the
-- counter; the DB only stores it). After N consecutive failures the worker
-- pauses claims for this portal and the app layer nudges the parent with a
-- Portals deep link — claim-pausing is ENFORCED in the worker /
-- rpc_claim_sync, never here. credentials_updated_at is bumped by
-- set_tenant_secret() on every rotation so long jobs can detect mid-job
-- staleness (rotation after job start -> re-fetch on next claim).
-- status='failed' marks the last terminal state; 'paused' is intentionally
-- NOT a status value — pausing is a worker claim decision, not row state.

ALTER TABLE public.child_portals ENABLE ROW LEVEL SECURITY;

-- FIX 2026-10-11: SELECT-only, family-scoped. The old FOR ALL policy let any
-- parent of any child see EVERY family's NULL-child_id portal metadata, and
-- granted direct INSERT/UPDATE/DELETE (including vault_secret_id rewrites)
-- to clients. All writes now go through set_tenant_secret() (SECURITY
-- DEFINER with explicit authorization); clients get no write GRANTs at all.
-- NULL rows are visible only to parents who share at least one child with
-- the row's owner (covers shared custody; blocks cross-family reads).
DROP POLICY IF EXISTS child_portals_parent_all ON public.child_portals;
CREATE POLICY child_portals_parent_select ON public.child_portals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid() AND ca.role = 'parent'
        AND (child_portals.child_id IS NULL OR ca.child_id = child_portals.child_id)
    )
    AND (
      child_portals.child_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.child_access theirs
        JOIN public.child_access mine ON mine.child_id = theirs.child_id
        WHERE theirs.user_id = child_portals.owner_user_id
          AND mine.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Secret-less view for clients: vault_secret_id is invisible outside service_role
-- FIX 2026-10-11 (CRITICAL): the original view omitted security_invoker, so
-- it executed with the view OWNER's (postgres) privileges and BYPASSED RLS on
-- child_portals entirely — ANY authenticated user could read EVERY tenant's
-- portal metadata (usernames, portal keys, verification timestamps) via the
-- view despite the base-table REVOKE. security_invoker=true makes the view
-- run as the caller, so the RLS policy above applies. Column-level GRANTs
-- (below) are the second layer: vault_secret_id is not granted to any client
-- role, so direct `SELECT vault_secret_id` / `SELECT *` on the base table is
-- permission-denied even where RLS would allow the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.child_portals_public
WITH (security_invoker = true) AS
SELECT id, child_id, portal_key, label, username, status, last_verified_at,
       consecutive_failures, credentials_updated_at, created_at
FROM public.child_portals;

-- Revoke everything, then grant ONLY the non-secret columns. RLS still gates rows.
-- FIX 2026-10-11 R2: consecutive_failures + credentials_updated_at are portal
-- METADATA (never secrets) — the Portals UI needs them for the failure/nudge
-- UX. vault_secret_id remains granted to no client role.
REVOKE ALL ON public.child_portals FROM anon, authenticated;
GRANT SELECT (id, child_id, portal_key, label, username, status, last_verified_at,
              consecutive_failures, credentials_updated_at, created_at)
  ON public.child_portals TO authenticated;
GRANT SELECT ON public.child_portals_public TO authenticated;

-- FIX 2026-10-11 R2 (agent portal-metadata decision): NO agent_reader grant is
-- added here — the existing grant lives in 005 (read-only in this round) and
-- is already documented there as currently INERT. DECISION: yes, the agent
-- needs portal metadata (status / username / consecutive_failures — e.g.
-- Pookie answering "is ParentVUE connected?", or briefing copy that must say
-- "sync paused, ask a parent to re-enter the password"), never secrets — and
-- the secret-less view already guarantees that (vault_secret_id is not in the
-- select list and is granted to no client role). The grant must become live
-- only through the agent-aware RLS scope bridge (solution-architect H3 /
-- security-engineer SEC-008), which does not exist yet: today agent_reader
-- has no auth.uid() so this view's RLS policy returns zero rows for it. Do
-- NOT remove the 005 grant now (removal would just require re-adding it when
-- the bridge ships); do NOT add any wider grant (no Vault, no base table).
-- When the bridge migration lands, it must include a negative test: expired
-- scope row => denied.

-- ---------------------------------------------------------------------------
-- get_tenant_secret(p_child_id, p_system): SECURITY DEFINER, service_role ONLY.
-- Workers call this at job-claim time (fetch-at-claim, no cache, zeroize after).
-- FIX 2026-10-11:
--   * NULL p_child_id is rejected outright. The old code let a NULL child_id
--     match `cp.child_id IS NULL` with LIMIT 1 and return an ARBITRARY family's
--     parent-level credential. Every service_role path must carry an explicit
--     child_id — this is where that invariant is enforced in SQL.
--   * The parent-level (NULL child_id) fallback is family-scoped: it matches
--     only NULL rows whose owner is a parent of p_child_id. The old predicate
--     had no family condition, so a parent of child A could read the
--     parent-level portal credential created by child B's family.
--   * EXECUTE is revoked from PUBLIC/anon; only authenticated + service_role
--     may call. The function already fails closed for callers with no JWT.
-- FIX 2026-10-11 R2 (CRITICAL — integration-expert C1 / security-engineer
-- SEC-005 / solution-architect H4): the parent-role branch is REMOVED. The
-- old code returned the DECRYPTED secret to any parent-role JWT caller via
-- PostgREST RPC, contradicting PLAN §4.8 ("only service_role +
-- credential-test Edge Function ever see the secret"; "The Edge Function
-- never returns the secret value"). Now: service_role only. Parent-safe
-- flows are (a) test_portal_connection() below — boolean only, never the
-- secret; (b) the credential-test Edge Function, which performs its own
-- parent check, calls THIS function with the service_role key, attempts the
-- live portal login, and returns only {ok, checked_at} to the UI.
--   * EXECUTE is now revoked from authenticated as well (defense in depth):
--     the membership assertion below already raises for non-service callers,
--     but the RPC should not even be invocable by client roles.
-- FIX 2026-10-11 R2 (HIGH — integration-expert H1): service_role is accepted
-- via EITHER signal: the PostgREST request.jwt.claims GUC (REST/RPC path —
-- set by PostgREST from the verified JWT) OR current_user = 'service_role'
-- (direct-SQL path: psql, psycopg/pgBouncer workers — the GUC is unset
-- there, and the old GUC-only check failed closed against legitimate
-- workers). current_user is set by Postgres from the authenticated
-- connection role and cannot be forged by SQL text; under PostgREST the
-- session role already equals the JWT role, so this stays sound on the RPC
-- path. Workers should still PREFER the PostgREST/RPC path — direct SQL is
-- a supported fallback, not the primary contract.
-- FIX 2026-10-11 R2 (backend-dev): `vault` removed from SET search_path
-- (search_path hygiene). Every Vault reference is schema-qualified
-- (vault.secrets, vault.decrypted_secrets, vault.create_secret,
-- vault.update_secret), and a pinned search_path on SECURITY DEFINER
-- functions blocks search_path hijacking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_secret(p_child_id uuid, p_system text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id uuid;
  v_secret    text;
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_id_required';
  END IF;

  -- Membership assertion: service_role ONLY. Parents never receive plaintext
  -- secrets (see R2 note above). Fail-closed: callers with no JWT and no
  -- service_role connection raise.
  IF NOT (
    (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    OR current_user = 'service_role'
  ) THEN
    RAISE EXCEPTION 'tenant_membership_required';
  END IF;

  -- Prefer the child-specific row; fall back to the CALLER'S FAMILY's
  -- parent-level row (owner must be a parent of p_child_id). Never another
  -- family's NULL row.
  SELECT cp.vault_secret_id INTO v_secret_id
  FROM public.child_portals cp
  WHERE (cp.child_id = p_child_id
         OR (cp.child_id IS NULL
             AND EXISTS (SELECT 1 FROM public.child_access ca
                         WHERE ca.user_id = cp.owner_user_id
                           AND ca.child_id = p_child_id
                           AND ca.role = 'parent')))
    AND cp.portal_key = p_system
  ORDER BY cp.child_id NULLS LAST
  LIMIT 1;

  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'no_credential_for_system';
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_secret(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_secret(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- set_tenant_secret(p_child_id, p_system, p_secret): rotate/store a credential.
-- Parent-only. Writes to Vault, stores only the id in child_portals.
-- FIX 2026-10-11:
--   * Empty/NULL secrets are rejected (a blank password must never be stored).
--   * Per-family Vault secret names: NULL-child_id rows now use
--     'tenant_parent_<owner_uuid>__<portal_key>'. The old name
--     'tenant_parent__<portal_key>' collided across families — family B's
--     rotation would silently OVERWRITE family A's Vault secret.
--   * owner_user_id is recorded (required for NULL rows by the CHECK
--     constraint). The upsert is branched: child rows use ON CONFLICT
--     (child_id, portal_key); NULL rows use the partial unique index
--     ON CONFLICT (owner_user_id, portal_key) WHERE child_id IS NULL.
--     (The old single ON CONFLICT (child_id, portal_key) NEVER matched NULL
--     rows — Postgres treats NULLs as distinct — so rotations of parent-level
--     portals created duplicate rows and the reader picked one at random.)
--   * EXECUTE revoked from PUBLIC/anon; authenticated + service_role only.
-- CONTRACT NOTE: this function MUST be invoked with the end-user's JWT
-- (the portal-credential-write Edge Function forwards the caller's token),
-- never with the service_role key: the parent check reads auth.uid(), which
-- is NULL under service_role and would (correctly) raise. service_role
-- callers needing writes must go through a reviewed admin path, not this fn.
-- FIX 2026-10-11 R2: `vault` removed from SET search_path (search_path
-- hygiene — all Vault references are schema-qualified); credentials_updated_at
-- is bumped to now() on every rotation (both branches) so workers can detect
-- mid-job staleness.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_secret(p_child_id uuid, p_portal_key text, p_label text, p_username text, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id uuid;
  v_row_id    uuid;
  v_name      text;
  v_owner     uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.role = 'parent'
                   AND (p_child_id IS NULL OR ca.child_id = p_child_id)) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  IF p_secret IS NULL OR p_secret = '' THEN
    RAISE EXCEPTION 'empty_secret_rejected';
  END IF;

  v_owner := auth.uid();

  IF p_child_id IS NULL THEN
    v_name := 'tenant_parent_' || v_owner::text || '__' || p_portal_key;
  ELSE
    v_name := 'tenant_' || p_child_id::text || '__' || p_portal_key;
  END IF;

  -- Upsert the Vault secret by name
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = v_name;
  IF FOUND THEN
    PERFORM vault.update_secret(v_secret_id, p_secret);
  ELSE
    SELECT vault.create_secret(p_secret, v_name) INTO v_secret_id;
  END IF;

  IF p_child_id IS NULL THEN
    INSERT INTO public.child_portals (child_id, owner_user_id, portal_key, label, username, vault_secret_id, status)
    VALUES (NULL, v_owner, p_portal_key, p_label, p_username, v_secret_id, 'unverified')
    ON CONFLICT (owner_user_id, portal_key) WHERE child_id IS NULL
    DO UPDATE SET label = EXCLUDED.label, username = EXCLUDED.username,
                   vault_secret_id = EXCLUDED.vault_secret_id, status = 'unverified',
                   last_verified_at = NULL, credentials_updated_at = now()
    RETURNING id INTO v_row_id;
  ELSE
    INSERT INTO public.child_portals (child_id, owner_user_id, portal_key, label, username, vault_secret_id, status)
    VALUES (p_child_id, v_owner, p_portal_key, p_label, p_username, v_secret_id, 'unverified')
    ON CONFLICT (child_id, portal_key)
    DO UPDATE SET label = EXCLUDED.label, username = EXCLUDED.username,
                   vault_secret_id = EXCLUDED.vault_secret_id, status = 'unverified',
                   last_verified_at = NULL, credentials_updated_at = now()
    RETURNING id INTO v_row_id;
  END IF;

  RETURN v_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tenant_secret(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tenant_secret(uuid, text, text, text, text) TO authenticated, service_role;
-- ---------------------------------------------------------------------------
-- test_portal_connection(p_child_id, p_portal_key): the safe "Test connection"
-- for the Portals UI. Parent-only. Resolves the portal row with the same
-- family-scoped logic as get_tenant_secret, decrypts the secret SERVER-SIDE
-- (proving the Vault material exists and is intact), and returns BOOLEAN
-- only — the secret NEVER leaves the database.
--
-- Scope honesty: this is a credential-material integrity check, NOT a live
-- portal login. The actual login attempt is performed by the credential-test
-- Edge Function (PLAN §4.8), which performs its own parent check, calls
-- get_tenant_secret() with the service_role key, and returns only
-- {ok, checked_at} to the UI. Status flips to 'verified' are owned by that
-- Edge Function (future mark_portal_verified); this function changes no
-- status and writes no audit row.
--
-- NULL p_child_id: resolves ONLY rows owned by the caller (their own
-- parent-level portals) — family-scoped by construction, since
-- owner_user_id = auth.uid() is in the predicate.
--
-- FIX 2026-10-11 R2 (CRITICAL — integration-expert C1): replaces the removed
-- parent branch of get_tenant_secret(). Parents get a boolean, never
-- plaintext. Error strings stay static literals (never the secret).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.test_portal_connection(p_child_id uuid, p_portal_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id uuid;
  v_secret    text;
BEGIN
  -- Parent-only. NULL child: caller must be a parent somewhere; the row
  -- predicate below then restricts to caller-owned rows only.
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.role = 'parent'
                   AND (p_child_id IS NULL OR ca.child_id = p_child_id)) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  -- Same family-scoped resolution as get_tenant_secret: child-level row
  -- preferred, then the caller's family's parent-level row.
  SELECT cp.vault_secret_id INTO v_secret_id
  FROM public.child_portals cp
  WHERE cp.portal_key = p_portal_key
    AND (
      (p_child_id IS NOT NULL AND
       (cp.child_id = p_child_id
        OR (cp.child_id IS NULL
            AND EXISTS (SELECT 1 FROM public.child_access ca
                        WHERE ca.user_id = cp.owner_user_id
                          AND ca.child_id = p_child_id
                          AND ca.role = 'parent'))))
      OR
      (p_child_id IS NULL AND cp.child_id IS NULL AND cp.owner_user_id = auth.uid())
    )
  ORDER BY cp.child_id NULLS LAST
  LIMIT 1;

  IF v_secret_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Decrypt server-side: proves the Vault secret exists and is intact.
  -- The value is used for nothing else and is never returned.
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.test_portal_connection(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_portal_connection(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- remove_tenant_secret(p_child_id, p_portal_key): the Portals UI [Remove]
-- action. Parent-only. Deletes the Vault secret AND the child_portals row.
--
-- DECISION (documented): the metadata row is DELETED, not kept with
-- status='unverified'. A kept row would render a phantom portal card in the
-- Portals UI ("unverified" with no credential behind it) and reintroduce the
-- NULL-row bookkeeping the partial unique index was built to avoid. The
-- Vault secret is truly deleted (not rotated-to-random) so a compromised
-- credential is gone, not just orphaned.
--
-- Implementation note: the supabase_vault extension exposes only
-- vault.create_secret / vault.update_secret — there is NO
-- vault.delete_secret() function. The sanctioned pattern is DELETE FROM
-- vault.secrets directly, executed here inside the SECURITY DEFINER
-- function (the caller holds no vault privileges). Known residue: the
-- secret's pgsodium key row is orphaned by the delete (operational
-- housekeeping, not a security issue — the key alone decrypts nothing
-- without the secret row).
--
-- NULL p_child_id removes the caller's OWN parent-level row only
-- (owner_user_id = auth.uid()); a parent can never delete another family's
-- NULL row. Returns FALSE when nothing matched (idempotent UI behavior).
-- Removal audit-logging is the calling Edge Function's job (audit_event
-- lives in 004, applied after this migration — 003 stays self-contained).
--
-- CONTRACT NOTE (same as set_tenant_secret): invoke with the end-user's
-- JWT, never the service_role key — the parent check reads auth.uid().
--
-- FIX 2026-10-11 R2 (integration-expert H8 / security-engineer SEC-010).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_tenant_secret(p_child_id uuid, p_portal_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id    uuid;
  v_secret_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.role = 'parent'
                   AND (p_child_id IS NULL OR ca.child_id = p_child_id)) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  SELECT cp.id, cp.vault_secret_id INTO v_row_id, v_secret_id
  FROM public.child_portals cp
  WHERE cp.portal_key = p_portal_key
    AND (
      (p_child_id IS NOT NULL AND cp.child_id = p_child_id)
      OR (p_child_id IS NULL AND cp.child_id IS NULL AND cp.owner_user_id = auth.uid())
    );

  IF v_row_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.child_portals WHERE id = v_row_id;

  IF v_secret_id IS NOT NULL THEN
    -- No vault.delete_secret() exists in the extension: direct DELETE is the
    -- sanctioned pattern (runs as the definer; caller has no vault rights).
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_tenant_secret(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_tenant_secret(uuid, text) TO authenticated, service_role;
