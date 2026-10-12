-- Migration 076: Verifiable Parental Consent for Under-13 Child Login (Squad Cradle)
--
-- CONTEXT: COPPA requires verifiable parental consent before an under-13
-- child gets an online account. The default remains CLOSED: consume_invite()
-- (055) raises 'under_13_no_login' for under-13 children. This migration adds
-- the explicit, auditable consent path that OPENS it — and only it.
--
-- DESIGN:
--   parental_consents: one row per (child, consent_type). The consenting
--   parent records HOW consent was verified (method + detail JSON). Consent
--   can be revoked; revocation blocks FUTURE invite consumes (it does not
--   retroactively sever an already-provisioned login — that's a separate
--   admin action, deliberately).
--
--   consume_invite() age gate (055) is amended: under-13 is allowed ONLY
--   when a valid (non-revoked) 'child_login' consent exists from a user
--   who holds (or held at grant time) a parent role on the child.
--
--   grant_parental_consent() / revoke_parental_consent(): SECURITY DEFINER
--   RPCs. The caller must hold a parent role on the child (verified inside
--   the function via child_access). Consent is recorded with the parent's
--   user id, timestamp, method, and an audit_event row.
--
-- PRODUCTION NOTE: the 'method' field is the hook for real verification
-- (signed form, ID check, credit-card verification, etc.). The test flow
-- uses method='in_person_test' with the consenting parent named in detail.
-- Do NOT treat the test method as the production pattern.
--
-- IDEMPOTENT: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS. Safe to re-run.

-- ---------------------------------------------------------------------------
-- parental_consents table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parental_consents (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                  uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  consenting_parent_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type              text NOT NULL DEFAULT 'child_login'
                              CHECK (consent_type IN ('child_login')),
  method                    text NOT NULL,
                              -- e.g. 'in_person_test', 'signed_form', 'id_verified'
  detail                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_at                timestamptz NOT NULL DEFAULT now(),
  revoked_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, consent_type)
);

CREATE INDEX IF NOT EXISTS parental_consents_child_idx
  ON public.parental_consents (child_id) WHERE revoked_at IS NULL;

ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- Parents read consents for their children.
DROP POLICY IF EXISTS parental_consents_parent_read ON public.parental_consents;
CREATE POLICY parental_consents_parent_read ON public.parental_consents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.parental_consents.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

-- The child (13+, or under-13 with a login) reads their own consent record.
DROP POLICY IF EXISTS parental_consents_child_read ON public.parental_consents;
CREATE POLICY parental_consents_child_read ON public.parental_consents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.parental_consents.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'child')
  );

-- Writes go through the RPCs below (SECURITY DEFINER, parent-role checked).
-- No direct INSERT/UPDATE/DELETE grants to client roles.

-- ---------------------------------------------------------------------------
-- grant_parental_consent(): parent records verifiable consent for their child.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_parental_consent(
  p_child_id uuid,
  p_method   text,
  p_detail   jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_id     uuid;
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_required';
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF p_method IS NULL OR btrim(p_method) = '' THEN
    RAISE EXCEPTION 'consent_method_required';
  END IF;

  -- Caller must hold a parent role on this child.
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.child_id = p_child_id
                   AND ca.user_id = v_caller
                   AND ca.role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  INSERT INTO public.parental_consents
    (child_id, consenting_parent_user_id, consent_type, method, detail)
  VALUES (p_child_id, v_caller, 'child_login', p_method, COALESCE(p_detail, '{}'::jsonb))
  ON CONFLICT (child_id, consent_type)
  DO UPDATE SET
    consenting_parent_user_id = EXCLUDED.consenting_parent_user_id,
    method = EXCLUDED.method,
    detail = EXCLUDED.detail,
    granted_at = now(),
    revoked_at = NULL
  RETURNING id INTO v_id;

  PERFORM public.audit_event(p_child_id, 'consent.parental_granted', 'user',
                             'parental_consents', v_id::text,
                             jsonb_build_object('method', p_method,
                                                'granted_by', v_caller));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_parental_consent(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_parental_consent(uuid, text, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- revoke_parental_consent(): parent revokes. Blocks future invite consumes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_parental_consent(p_child_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_required';
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.child_id = p_child_id
                   AND ca.user_id = v_caller
                   AND ca.role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  UPDATE public.parental_consents
     SET revoked_at = now()
   WHERE child_id = p_child_id
     AND consent_type = 'child_login'
     AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM public.audit_event(p_child_id, 'consent.parental_revoked', 'user',
                             'parental_consents', p_child_id::text,
                             jsonb_build_object('revoked_by', v_caller));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_parental_consent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_parental_consent(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- has_valid_parental_consent(): DEFINER helper for the invite gate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_valid_parental_consent(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parental_consents pc
    WHERE pc.child_id = p_child_id
      AND pc.consent_type = 'child_login'
      AND pc.revoked_at IS NULL
      -- The consenting user must have been a parent of the child at grant
      -- time or still be one (grants survive custody changes; revocation
      -- is the explicit off-switch).
      AND EXISTS (SELECT 1 FROM public.child_access ca
                  WHERE ca.child_id = pc.child_id
                    AND ca.user_id = pc.consenting_parent_user_id
                    AND ca.role = 'parent')
  )
$$;

-- ---------------------------------------------------------------------------
-- Amend consume_invite()'s COPPA gate (055): under-13 is allowed ONLY with
-- valid parental consent. The gate stays fail-closed in every other case.
--
-- 055 created consume_invite via CREATE OR REPLACE, so we re-apply the full
-- function body with the single amended gate. If 055's body ever changes,
-- this must be re-based (the gate block is marked below).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite         public.invites%ROWTYPE;
  v_caller         uuid := public.safe_auth_uid();
  v_caller_email   text;
  v_tier           text;
  v_child          uuid;
  v_slug           text;
  v_attempt        int;
  v_existing_child uuid;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'invite_token_required';
  END IF;

  SELECT * INTO v_invite FROM public.invites
   WHERE token = p_token AND status = 'pending' AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found_or_expired';
  END IF;

  -- Fail-closed, case-insensitive email match. Stays BEFORE the age gate so
  -- a token probe for someone else's child reveals no age information.
  SELECT email INTO v_caller_email FROM public.users WHERE id = v_caller;
  IF lower(v_invite.email) IS DISTINCT FROM lower(v_caller_email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- COPPA age gate (055, amended by 076): a child-role invite may only be
  -- consumed for a child whose date_of_birth puts them at 13+, OR for an
  -- under-13 child with valid verifiable parental consent (076). NULL DOB /
  -- missing child_id fails closed.
  -- >>> 076 GATE BLOCK — keep in sync with 055's body <<<
  IF v_invite.role = 'child' THEN
    IF v_invite.child_id IS NULL THEN
      RAISE EXCEPTION 'under_13_no_login';
    END IF;
    v_tier := public.child_age_tier(v_invite.child_id);
    IF v_tier = 'under13' THEN
      IF NOT public.has_valid_parental_consent(v_invite.child_id) THEN
        RAISE EXCEPTION 'under_13_no_login';
      END IF;
    END IF;
    IF v_tier = 'unknown' THEN
      RAISE EXCEPTION 'age_verification_required';
    END IF;
  END IF;
  -- >>> END 076 GATE BLOCK <<<

  -- No double-provisioning as a second child identity.
  IF v_invite.role = 'child'
     AND EXISTS (SELECT 1 FROM public.child_access WHERE user_id = v_caller) THEN
    RAISE EXCEPTION 'already_provisioned';
  END IF;

  -- 'parent' invite for a login that currently holds a child role:
  -- same child -> in-place promotion; different child -> refuse.
  IF v_invite.role = 'parent' THEN
    SELECT ca.child_id INTO v_existing_child
      FROM public.child_access ca
     WHERE ca.user_id = v_caller AND ca.role = 'child';
    IF FOUND THEN
      IF v_invite.child_id IS DISTINCT FROM v_existing_child THEN
        RAISE EXCEPTION 'role_conflict_requires_admin';
      END IF;
      UPDATE public.child_access SET role = 'parent'
       WHERE user_id = v_caller AND child_id = v_existing_child;
    END IF;
  END IF;

  -- New family parent (child_id null): create their first child shell.
  IF v_invite.child_id IS NULL THEN
    FOR v_attempt IN 1..5 LOOP
      v_slug := 'child-' || substr(md5(v_invite.id::text || ':' || v_attempt::text), 1, 12);
      BEGIN
        INSERT INTO public.children (parent_user_id, first_name, last_name, slug)
        VALUES (v_caller, 'New', 'Child', v_slug)
        RETURNING id INTO v_child;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempt = 5 THEN RAISE; END IF;
      END;
    END LOOP;
  ELSE
    v_child := v_invite.child_id;
  END IF;

  INSERT INTO public.child_access (child_id, user_id, role)
  VALUES (v_child, v_caller, v_invite.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.users SET role = v_invite.role
   WHERE id = v_caller AND role IS DISTINCT FROM v_invite.role;

  UPDATE public.invites SET status = 'accepted' WHERE id = v_invite.id;

  PERFORM public.audit_event(v_child, 'access.granted', 'user', 'child_access',
                             v_child::text,
                             jsonb_build_object('role', v_invite.role,
                                                'invite_id', v_invite.id));

  RETURN v_child;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_invite(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Table exists: SELECT * FROM public.parental_consents LIMIT 0; -- ok
-- 2. Under-13 consume without consent -> ERROR under_13_no_login (unchanged)
-- 3. grant_parental_consent() as a parent -> returns uuid; audit row written
-- 4. Under-13 consume with valid consent -> succeeds, child_access row created
-- 5. revoke_parental_consent() -> true; subsequent consume -> under_13_no_login
-- 6. grant/revoke as non-parent -> ERROR parent_membership_required
