-- Staged compliance fix — CRITICAL-2 (Fractional Team 1): consume_invite()
-- had NO server-side age gate.
--
-- Supersedes: supabase/migrations/001_tenancy_core.sql lines ~487–579
-- (MD FREEZE is in effect on supabase/migrations/ — this is staged here,
-- committed on staging-build, to be folded into a migration at apply time.)
-- Depends on: 001 (invites, children, child_access), 004 (audit_event),
-- 014 (safe_auth_uid), 018 (child_age_tier).
--
-- Attack it closes: a parent set an under-13 DOB on a children row (the
-- updateChild PATCH had no server-side age validation), invited the child's
-- email, and the under-13 child got a working login — i.e. an auth session
-- minted for an under-13 principal, violating §1.1.4. redeem_link_code()
-- already gates ('under13_link_forbidden' / 'age_verification_required');
-- the email path was the hole. The two linking paths are now consistent.
--
-- Changes in this file:
--   (a) consume_invite(): after the invite row is loaded and the
--       email-ownership check passes, when v_invite.role = 'child' the
--       RPC calls public.child_age_tier() and raises 'under_13_no_login'
--       ('under13') or 'age_verification_required' ('unknown' — fail closed)
--       BEFORE any child_access row is inserted. The email check stays first
--       so an unauthorized probe learns nothing about a child's age.
--       All auth.uid() calls become public.safe_auth_uid() per convention.
--   (b) Defense in depth on the write path: children_dob_guard() (BEFORE
--       INSERT OR UPDATE OF date_of_birth) rejects (1) any date_of_birth in
--       the future and (2) any DOB change that would drop a linked child
--       under 13 while a child-role child_access row exists. This fires
--       before 027's AFTER sever trigger (trg_children_dob_under13_sever),
--       so the sever path remains for rows with no child-role linkage.
--
-- IDEMPOTENT: CREATE OR REPLACE / DROP TRIGGER IF EXISTS throughout.

-- ---------------------------------------------------------------------------
-- (a) consume_invite() with the COPPA age gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite         public.invites%ROWTYPE;
  v_child          uuid;
  v_caller_email   text;
  v_existing_child uuid;
  v_attempt        int;
  v_slug           text;
  v_tier           text;
  v_caller         uuid := public.safe_auth_uid();
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

  -- COPPA age gate (CRITICAL-2 fix): a child-role invite may only be
  -- consumed for a child whose date_of_birth puts them at 13+. Mirrors
  -- redeem_link_code(). NULL DOB / missing child_id fails closed.
  IF v_invite.role = 'child' THEN
    IF v_invite.child_id IS NULL THEN
      RAISE EXCEPTION 'under_13_no_login';
    END IF;
    v_tier := public.child_age_tier(v_invite.child_id);
    IF v_tier = 'under13' THEN
      RAISE EXCEPTION 'under_13_no_login';
    END IF;
    IF v_tier = 'unknown' THEN
      RAISE EXCEPTION 'age_verification_required';
    END IF;
  END IF;

  -- No double-provisioning as a second child identity.
  IF v_invite.role = 'child'
     AND EXISTS (SELECT 1 FROM public.child_access WHERE user_id = v_caller) THEN
    RAISE EXCEPTION 'already_provisioned';
  END IF;

  -- 'parent' invite for a login that currently holds a child role:
  -- same child -> in-place promotion; different child -> refuse (mixed
  -- parent+child roles for one login are unsupported; admin path only).
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

  -- New family parent (child_id null): create their first child shell; profile completed in UI
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

  -- Keep the profile role in sync with the granted access role.
  UPDATE public.users SET role = v_invite.role
   WHERE id = v_caller AND role IS DISTINCT FROM v_invite.role;

  UPDATE public.invites SET status = 'accepted' WHERE id = v_invite.id;

  -- Access grants are consequential: record them (004, resolved at runtime).
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
-- (b) Defense in depth: children.date_of_birth write-path guard
-- ---------------------------------------------------------------------------

-- DOB-only under-13 test (STABLE, not IMMUTABLE: it depends on current_date).
CREATE OR REPLACE FUNCTION public.dob_under13(p_dob date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_dob IS NOT NULL AND p_dob > (current_date - INTERVAL '13 years')::date
$$;

REVOKE ALL ON FUNCTION public.dob_under13(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dob_under13(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.children_dob_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- (1) A date of birth in the future is never valid, on insert or update.
  IF NEW.date_of_birth IS NOT NULL
     AND NEW.date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'dob_cannot_be_future';
  END IF;

  -- (2) A DOB change that would drop a linked child under 13 is rejected
  -- while a child-role child_access row exists for them — no under-13
  -- login linkage can be created or persisted via the unvalidated PATCH
  -- path. (027's AFTER sever trigger still runs for updates that succeed;
  -- this BEFORE guard simply fires first.)
  IF TG_OP = 'UPDATE'
     AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
     AND public.dob_under13(NEW.date_of_birth)
     AND EXISTS (SELECT 1 FROM public.child_access ca
                  WHERE ca.child_id = NEW.id AND ca.role = 'child') THEN
    RAISE EXCEPTION 'under_13_no_login';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_children_dob_guard ON public.children;
CREATE TRIGGER trg_children_dob_guard
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_dob_guard();

-- ---------------------------------------------------------------------------
-- Verification (run after applying; each should return the noted result)
-- ---------------------------------------------------------------------------
-- 1. consume_invite gate: consume a child-role invite token whose child has
--    DOB < 13y ago (as the email-matched caller) -> ERROR under_13_no_login.
-- 2. consume_invite fail-closed: same, with NULL date_of_birth
--    -> ERROR age_verification_required.
-- 3. Parent-role invites are unaffected by the gate (tier not consulted).
-- 4. INSERT INTO children (...) with date_of_birth = current_date + 1
--    -> ERROR dob_cannot_be_future.
-- 5. UPDATE children SET date_of_birth = <under-13> for a child that holds a
--    child-role child_access row -> ERROR under_13_no_login (before 027's
--    sever trigger).
-- 6. Same update with NO child-role row -> succeeds; 027's sever finds
--    nothing to cut (unchanged behavior).
