-- Migration 004: Compliance — consents ledger + audit log
-- Source: PLAN.md §3.1, AI-MOTHER-VISION.md §5 (compliance)
-- consents: append-only ledger; revocation is a new row, never an edit.
-- audit_log: append-only; FERPA-aligned disclosure accounting (covers the agent too).
--
-- ROUND-1 FIXES 2026-10-11 (Database expert — Data & Tenancy / RLS correctness):
--   F1  consents_parent_insert: added `granted_by = auth.uid()` to the WITH
--       CHECK. The old policy let a parent insert a consent row attributing
--       the grant to ANY user — forged attribution in an append-only legal
--       ledger. Also added a non-empty scope guard.
--   F2  Added the missing GRANTs (RLS policies alone grant nothing):
--       consents -> SELECT, INSERT to authenticated; audit_log -> SELECT to
--       authenticated. No UPDATE/DELETE grants anywhere here — append-only
--       is enforced by grants as well as by the absence of policies.
--   F3  audit_event(): was PUBLIC-execute with ZERO authorization — any anon
--       or authenticated caller could forge audit rows for any child_id with
--       any actor_kind/action, poisoning the FERPA accounting trail. Now:
--       EXECUTE revoked from PUBLIC (authenticated + service_role only;
--       agent_reader is granted in 005); non-service callers must be members
--       of p_child_id (NULL child_id rejected for callers); service_role
--       callers MUST carry an explicit, existing child_id (the platform
--       invariant: service_role bypasses RLS, so every service path asserts
--       its child_id here instead) — NULL is allowed only for
--       actor_kind='system' global events. Empty actions rejected.
--   F4  audit_log_tenant_read: dropped the `child_id IS NULL OR ...` arm.
--       System-level (NULL child_id) audit rows were readable by EVERY
--       tenant's members — cross-tenant disclosure of the accounting trail
--       itself. NULL-child rows are now service_role/admin-only; tenant
--       events must always carry their child_id.
--   F5  `DROP POLICY IF EXISTS` before every CREATE POLICY (re-runnable
--       migrations).
--   F6  Added audit_log_actor_idx for per-actor disclosure queries.
--
-- ROUND-2 FIXES 2026-10-11 R2 (Database expert):
--   R2-3 audit_log.detail secret-sink guard (SEC-001): BEFORE INSERT trigger
--       rejecting rows whose detail top-level keys match secret-like
--       patterns (password, passwd, secret, token, credential, private_key,
--       api_key, otp — case-insensitive). The PLAN's own failure mode has
--       workers "record a sanitized error" on portal-auth failure — the
--       exact call site where a hurried implementation dumps an exception
--       string or credential material into detail, which tenant members
--       (child-role included) can then read. Convention is not enforcement;
--       this trigger is. Fail-closed by design: a key like `token_count`
--       also matches — rename such keys (e.g. `usage_tokens`) rather than
--       weakening the guard. Top-level keys only; nested-object scanning is
--       noted as future hardening. The exception string is a static literal
--       (keeps the no-secret-in-errors invariant).

-- ---------------------------------------------------------------------------
-- consents: every authorization the parent grants, as an immutable ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  granted_by  uuid NOT NULL REFERENCES public.users(id),
  scope       text NOT NULL,   -- e.g. 'portal_sync:studentvue', 'health:wearable', 'data:export'
  recipient   text,            -- named recipient for disclosures (FERPA accounting)
  status      text NOT NULL CHECK (status IN ('granted','revoked')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- FIX 2026-10-11 (F1): a consent with an empty scope is meaningless in a
-- legal ledger; reject it at the schema level.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consents_scope_nonempty') THEN
    ALTER TABLE public.consents
      ADD CONSTRAINT consents_scope_nonempty CHECK (char_length(scope) > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS consents_child_scope_idx
  ON public.consents (child_id, scope, created_at DESC);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- Append-only: members read; parents insert; NO updates/deletes (revoke = new row).
-- (No UPDATE/DELETE policies AND no UPDATE/DELETE grants — see GRANTs below.)
DROP POLICY IF EXISTS consents_tenant_read ON public.consents;
CREATE POLICY consents_tenant_read ON public.consents
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

-- FIX 2026-10-11 (F1): granted_by must be the caller. Without this a parent
-- could file a consent "granted by" another user — forged attribution in an
-- append-only ledger the family may one day rely on in a dispute.
DROP POLICY IF EXISTS consents_parent_insert ON public.consents;
CREATE POLICY consents_parent_insert ON public.consents
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND granted_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = consents.child_id AND ca.role = 'parent')
  );

-- ---------------------------------------------------------------------------
-- audit_log: every read/write of consequence, including agent reads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid REFERENCES public.children(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id),
  actor_kind    text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','agent','worker','system')),
  action        text NOT NULL,     -- e.g. 'transcript.sent', 'grades.read', 'portal.verified'
  table_name    text,
  row_id        text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_child_at_idx
  ON public.audit_log (child_id, at DESC);

-- FIX 2026-10-11 (F6): per-actor disclosure queries ("everything the agent
-- read about this child") need this; the (child_id, at) index cannot serve
-- an actor-first predicate.
CREATE INDEX IF NOT EXISTS audit_log_actor_idx
  ON public.audit_log (actor_user_id, at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: members read their tenant's log; writes via audit_event()
-- (SECURITY DEFINER, authorized) or service_role.
-- FIX 2026-10-11 (F4): the old `child_id IS NULL OR ...` arm exposed every
-- system-level audit row to every tenant's members. Tenant events must carry
-- their child_id; NULL-child system rows are service_role/admin-only now.
DROP POLICY IF EXISTS audit_log_tenant_read ON public.audit_log;
CREATE POLICY audit_log_tenant_read ON public.audit_log
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11 R2 (R2-3): reject secret-shaped keys in audit_log.detail.
-- `detail` is caller-supplied jsonb readable by every tenant member, so it
-- is a latent credential sink (SEC-001): one hurried worker dumping an
-- exception string or password-adjacent field into detail exposes it to the
-- child-role user. This trigger fails the INSERT (not the transaction's
-- neighbors) when any TOP-LEVEL key matches the denylist, case-insensitive.
-- It fires for every writer — audit_event() callers and service_role alike —
-- because the hazard is the content, not the caller. Defense in depth: the
-- normative ban lives in the appsec handbook; sanitization still belongs at
-- the logging boundary in app code.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_reject_secret_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF NEW.detail IS NOT NULL AND jsonb_typeof(NEW.detail) = 'object' THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.detail) LOOP
      IF v_key ~* 'password|passwd|secret|token|credential|private[_-]?key|api[_-]?key|otp' THEN
        RAISE EXCEPTION 'audit_detail_secret_key_rejected';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_detail_secret_guard ON public.audit_log;
CREATE TRIGGER audit_log_detail_secret_guard
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_reject_secret_keys();

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11 (F2): explicit GRANTs — RLS policies alone grant nothing.
-- Append-only is enforced twice: no UPDATE/DELETE policies AND no
-- UPDATE/DELETE grants. anon gets nothing.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.consents TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper: log an audit event.
-- FIX 2026-10-11 (F3): authorization added (was PUBLIC-execute, zero authz —
-- anyone could forge rows for any child). Rules:
--   * service_role: bypasses RLS by design, so the child_id invariant is
--     enforced HERE — p_child_id must be explicit and reference a real
--     child. NULL is allowed only for actor_kind='system' (global events).
--   * agent_reader (service-minted JWT): falls into the member branch;
--     current_child_ids() resolves its job scope, so the agent can only log
--     for the child its job is scoped to.
--   * other callers (authenticated users, Edge Functions with user JWT):
--     must be members of p_child_id; NULL child_id rejected.
--   * anon: fails the member branch (auth.uid() NULL -> '{}') -> raises.
-- actor_user_id is always auth.uid() — callers cannot attribute actions to
-- other users. (service_role/worker calls record NULL actor_user_id with
-- actor_kind 'worker'/'system' — the kind column carries the attribution.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_event(
  p_child_id uuid, p_action text, p_actor_kind text DEFAULT 'user',
  p_table_name text DEFAULT NULL, p_row_id text DEFAULT NULL, p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_jwt_role text := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
BEGIN
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'audit_action_required';
  END IF;

  IF v_jwt_role = 'service_role' THEN
    IF p_child_id IS NULL THEN
      IF p_actor_kind <> 'system' THEN
        RAISE EXCEPTION 'service_role_audit_requires_child_id';
      END IF;
      -- actor_kind='system' with NULL child: global event, allowed.
    ELSIF NOT EXISTS (SELECT 1 FROM public.children WHERE id = p_child_id) THEN
      RAISE EXCEPTION 'audit_unknown_child';
    END IF;
  ELSE
    IF p_child_id IS NULL
       OR NOT (p_child_id = ANY (public.current_child_ids())) THEN
      RAISE EXCEPTION 'tenant_membership_required';
    END IF;
  END IF;

  INSERT INTO public.audit_log (child_id, actor_user_id, actor_kind, action, table_name, row_id, detail)
  VALUES (p_child_id, auth.uid(), p_actor_kind, p_action, p_table_name, p_row_id, p_detail)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_event(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_event(uuid, text, text, text, text, jsonb)
  TO authenticated, service_role;
-- NOTE: EXECUTE for agent_reader is granted in 005 (the role is created
-- there; 004 runs first, so the grant cannot live here).
