-- PENDING: apply after the MD migrations freeze lifts (2026-10-12).
--
-- This SECURITY DEFINER RPC is the server-side half of the onboarding
-- add-child flow (src/lib/onboarding/actions.ts -> createChildProfile).
-- The action calls public.provision_onboarding_child(...) and currently
-- fails closed with "create_failed" until this lands. Column names it
-- touches are from the locked briefs: children(date_of_birth),
-- child_access(granted_by, granted_by_user_id).
--
-- When the freeze lifts, the DBA should place this under
-- supabase/migrations/ with the next free number (it was drafted as 021).

-- Migration: onboarding first-child provisioning RPC
--
-- CONTEXT: Pookie is the USER's personal assistant (locked 2026-10-12).
-- Signup is fully automated: sign in -> /onboarding -> dashboard. A fresh
-- user has ZERO child_access rows, so the existing create_child() RPC
-- (001 F7) cannot serve onboarding — it raises parent_membership_required
-- for anyone without an existing parent membership, and its design intent
-- ("a family's FIRST child always comes from consume_invite") predates the
-- user-first self-serve signup model.
--
-- CHANGES:
--   1. provision_onboarding_child(p_first_name, p_last_name, p_birthdate,
--      p_attested, p_email_provided DEFAULT false) -> jsonb
--      SECURITY DEFINER, fail closed. Atomic: children row (WITH
--      date_of_birth — create_child() has no DOB param, and age tiering
--      cannot attach without it) + the caller's parent access row.
--      Gates, in order:
--        a. caller authenticated (auth.uid() NOT NULL)
--        b. guardian attestation TRUE (legal gate; required to proceed)
--        c. name non-blank, birthdate present, not in the future, age <= 150
--        d. caller holds NO existing child_access rows (first child only —
--           further children are added from Settings -> Family via the
--           create_child() RPC, which exists precisely for parent members)
--      The under-13 COPPA branch is enforced by the CALLER (server action):
--      a supplied email is ignored for <13 and the fact is recorded in the
--      audit detail (email_ignored_under13) — never persisted as an invite.
--   2. child_access row carries granted_by='parent' + granted_by_user_id =
--      the creating parent, per the 018 access-authority model.
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION / REVOKE+GRANT. Safe to re-run.
-- GRANT MODEL (015 convention): only new privilege surface is EXECUTE on
-- the RPC for authenticated (+ service_role). No RLS changes.

CREATE OR REPLACE FUNCTION public.provision_onboarding_child(
  p_first_name     text,
  p_last_name      text,
  p_birthdate      date,
  p_attested       boolean,
  p_email_provided boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_child_id uuid;
  v_base     text;
  v_try      text;
  v_attempt  int;
  v_age      int;
  v_under13  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- The legal gate: onboarding cannot create a child profile without it.
  IF NOT COALESCE(p_attested, false) THEN
    RAISE EXCEPTION 'guardian_attestation_required';
  END IF;

  IF p_first_name IS NULL OR btrim(p_first_name) = '' THEN
    RAISE EXCEPTION 'child_name_required';
  END IF;
  IF p_birthdate IS NULL THEN
    RAISE EXCEPTION 'child_birthdate_required';
  END IF;
  IF p_birthdate > CURRENT_DATE THEN
    RAISE EXCEPTION 'child_birthdate_in_future';
  END IF;

  v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, p_birthdate))::int;
  IF v_age > 150 THEN
    RAISE EXCEPTION 'child_birthdate_implausible';
  END IF;
  v_under13 := p_birthdate > CURRENT_DATE - interval '13 years';

  -- First child only. Anyone who already holds a membership adds further
  -- children from Settings -> Family (create_child RPC, 001 F7).
  IF EXISTS (SELECT 1 FROM public.child_access WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'already_has_family';
  END IF;

  -- The public.users row must exist for the child_access FK; the auth
  -- trigger normally covers this, ensure_user() is the login-time backstop.
  PERFORM public.ensure_user();

  v_base := lower(regexp_replace(
    btrim(p_first_name) || '-' || NULLIF(btrim(COALESCE(p_last_name, '')), ''),
    '[^a-z0-9]+', '-', 'gi'));
  v_base := btrim(v_base, '-');
  IF v_base = '' THEN v_base := 'child'; END IF;

  FOR v_attempt IN 1..5 LOOP
    IF v_attempt = 1 THEN
      v_try := v_base;
    ELSE
      v_try := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    END IF;
    BEGIN
      INSERT INTO public.children
            (parent_user_id, first_name, last_name, slug, date_of_birth)
      VALUES (v_uid, btrim(p_first_name),
              COALESCE(NULLIF(btrim(COALESCE(p_last_name, '')), ''), ''),
              v_try, p_birthdate)
      RETURNING id INTO v_child_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.child_access
        (child_id, user_id, role, granted_by, granted_by_user_id)
  VALUES (v_child_id, v_uid, 'parent', 'parent', v_uid);

  -- Caller is a member of the new child from the row above, so this passes
  -- audit_event's membership assertion (004, resolved at runtime).
  PERFORM public.audit_event(v_child_id, 'child.created', 'user', 'children',
                             v_child_id::text,
                             jsonb_build_object(
                               'slug', v_try,
                               'under13', v_under13,
                               'email_provided', COALESCE(p_email_provided, false),
                               'email_ignored_under13',
                                 v_under13 AND COALESCE(p_email_provided, false),
                               'via', 'onboarding'));

  RETURN jsonb_build_object(
    'child_id', v_child_id,
    'age_years', v_age,
    'under13', v_under13);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_onboarding_child(text, text, date, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_onboarding_child(text, text, date, boolean, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.provision_onboarding_child(text, text, date, boolean, boolean) IS
  'Onboarding first-child provisioning: the ONLY client path that creates a child for a user with zero existing memberships. Guardian attestation is required; date_of_birth is stored for age tiering. Under-13 email is never persisted as an invite (COPPA) — the fact is audit-logged instead.';
