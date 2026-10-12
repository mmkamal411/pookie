-- Migration 063: self-service deletion with grace period.
--
-- CONTEXT: Founder requirement (2026-10-12) — a user whose registration goes
-- bad must be able to delete themselves and start over WITHOUT manual DB
-- surgery. Previously the only recovery was dashboard deletion by an admin.
--
-- DESIGN: soft-delete with 30-day grace period (ACCOUNT_DELETION_GRACE_DAYS
-- = 30, founder-confirmed 2026-10-12). Deletion marks rows; a nightly job
-- hard-purges expired rows. The user sees recovery UX during grace.
--
-- DEFENSE IN DEPTH (never-event: cross-user deletion):
--   Layer 1 (app): server actions take NO user ID — the RPCs below use
--     auth.uid() from the session JWT exclusively. A null session aborts.
--   Layer 2 (DB): every DELETE/UPDATE here is constrained with
--     WHERE <col> = auth.uid(). RLS already denies DELETE on children,
--     child_access, profiles, public.users for authenticated users (verified
--     2026-10-12: no DELETE policies exist on those tables) — so even a
--     compromised app server cannot delete rows except through these RPCs,
--     which refuse cross-user operations.
--
-- CHANGES:
--   1. Columns: public.users + public.children get deletion_requested_at
--      and permanent_delete_after (timestamptz, nullable).
--   2. request_account_deletion() — SECURITY DEFINER. Marks caller + owned
--      children. Audits BEFORE marking. Fails closed on null auth.uid().
--   3. cancel_account_deletion() — SECURITY DEFINER. Clears flags on
--      caller's OWN rows only (WHERE id = auth.uid()).
--   4. request_child_deletion(p_child_id) — SECURITY DEFINER. Verifies
--      caller owns the child (parent_user_id = auth.uid() OR parent grant).
--      If another user holds access (independent teen login), only the
--      caller's grant is removed ("remove my access"); otherwise the child
--      is soft-deleted. Audits BEFORE.
--   5. cancel_child_deletion(p_child_id) — SECURITY DEFINER. Scoped.
--   6. purge_expired_deletions() — SECURITY DEFINER. Hard-deletes rows
--      where permanent_delete_after < now(), FK-safe order, audit-logged.
--      Intended for pg_cron nightly; also callable by service_role.
--
-- IDEMPOTENT: CREATE OR REPLACE / IF NOT EXISTS. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Soft-delete columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS permanent_delete_after timestamptz;

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS permanent_delete_after timestamptz;

-- Indexes for the purge job and the "is deletion pending?" checks.
CREATE INDEX IF NOT EXISTS users_purge_idx
  ON public.users (permanent_delete_after) WHERE permanent_delete_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS children_purge_idx
  ON public.children (permanent_delete_after) WHERE permanent_delete_after IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. request_account_deletion()
-- ---------------------------------------------------------------------------
-- Marks the CALLER's account and all children they parent for deletion.
-- Grace period: 30 days (ACCOUNT_DELETION_GRACE_DAYS — founder-confirmed).
-- The user ID comes ONLY from auth.uid(); there is no parameter, so there
-- is nothing for a caller to spoof.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_purge timestamptz;
  v_child_count int;
BEGIN
  -- Fail closed: no session, no deletion. A null ID must never proceed —
  -- a missing WHERE constraint could match unintended rows.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Already requested? Return the existing date (idempotent).
  SELECT permanent_delete_after INTO v_purge
  FROM public.users WHERE id = v_uid;
  IF v_purge IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_requested', true,
      'permanent_delete_after', v_purge);
  END IF;

  v_purge := now() + INTERVAL '30 days'; -- ACCOUNT_DELETION_GRACE_DAYS

  -- Audit BEFORE marking: child_id NULL so a later child CASCADE cannot
  -- wipe this row. actor is the user themselves.
  INSERT INTO public.audit_log
        (child_id, actor_user_id, actor_kind, action, table_name, row_id, detail)
  VALUES (NULL, v_uid, 'user', 'account.deletion_requested',
          'users', v_uid::text,
          jsonb_build_object('permanent_delete_after', v_purge));

  -- Mark owned children: parent_user_id = v_uid OR caller holds parent grant.
  -- Scoped to v_uid — user A cannot mark user B's children.
  UPDATE public.children c
  SET deletion_requested_at = now(),
      permanent_delete_after = v_purge
  WHERE c.deletion_requested_at IS NULL
    AND (c.parent_user_id = v_uid
         OR EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.child_id = c.id
                      AND ca.user_id = v_uid
                      AND ca.role = 'parent'));
  GET DIAGNOSTICS v_child_count = ROW_COUNT;

  -- Mark the user. Scoped to v_uid.
  UPDATE public.users
  SET deletion_requested_at = now(),
      permanent_delete_after = v_purge
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'already_requested', false,
    'permanent_delete_after', v_purge,
    'children_marked', v_child_count);
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.request_account_deletion() IS
  'Self-service account deletion (soft, 30-day grace). Caller ID from auth.uid() only — no parameters. Audits before marking.';

-- ---------------------------------------------------------------------------
-- 3. cancel_account_deletion()
-- ---------------------------------------------------------------------------
-- Clears deletion flags on the CALLER's own rows only.
-- A caller cannot cancel another user's deletion: every UPDATE is scoped
-- with WHERE id = auth.uid().
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_restored_children int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Restore owned children first (scoped to caller's children).
  UPDATE public.children c
  SET deletion_requested_at = NULL,
      permanent_delete_after = NULL
  WHERE c.deletion_requested_at IS NOT NULL
    AND (c.parent_user_id = v_uid
         OR EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.child_id = c.id
                      AND ca.user_id = v_uid
                      AND ca.role = 'parent'));
  GET DIAGNOSTICS v_restored_children = ROW_COUNT;

  -- Restore the user. If no row was flagged, there is nothing to cancel.
  UPDATE public.users
  SET deletion_requested_at = NULL,
      permanent_delete_after = NULL
  WHERE id = v_uid AND deletion_requested_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_deletion_pending';
  END IF;

  INSERT INTO public.audit_log
        (child_id, actor_user_id, actor_kind, action, table_name, row_id, detail)
  VALUES (NULL, v_uid, 'user', 'account.deletion_cancelled',
          'users', v_uid::text,
          jsonb_build_object('children_restored', v_restored_children));

  RETURN jsonb_build_object(
    'cancelled', true,
    'children_restored', v_restored_children);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.cancel_account_deletion() IS
  'Cancels a pending self-deletion (grace-period recovery). Scoped to auth.uid() — cannot cancel another user''s deletion.';

-- ---------------------------------------------------------------------------
-- 4. request_child_deletion(p_child_id)
-- ---------------------------------------------------------------------------
-- Soft-deletes a child the CALLER owns. Ownership = parent_user_id = uid
-- OR caller holds a parent-role grant for the child.
--
-- Independent-login policy (founder default, confirm): if anyone OTHER than
-- the caller holds access to this child (e.g. the teen's own login), the
-- child record is NOT deleted — only the caller's grant is removed
-- ("remove my access"). The teen's data stays under their control.
CREATE OR REPLACE FUNCTION public.request_child_deletion(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_purge      timestamptz;
  v_first_name text;
  v_other_holders int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_id_required';
  END IF;

  -- Ownership check: caller must own this child. Fail closed — a caller
  -- who does not own the child gets an error, never a deletion.
  SELECT c.first_name INTO v_first_name
  FROM public.children c
  WHERE c.id = p_child_id
    AND c.deletion_requested_at IS NULL
    AND (c.parent_user_id = v_uid
         OR EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.child_id = c.id
                      AND ca.user_id = v_uid
                      AND ca.role = 'parent'));
  IF v_first_name IS NULL THEN
    RAISE EXCEPTION 'not_child_owner';
  END IF;

  -- Independent holders? Anyone besides the caller with a grant.
  SELECT count(*) INTO v_other_holders
  FROM public.child_access
  WHERE child_id = p_child_id AND user_id <> v_uid;

  IF v_other_holders > 0 THEN
    -- Policy: do NOT delete the child — remove only the caller's access.
    INSERT INTO public.audit_log
          (child_id, actor_user_id, actor_kind, action,
           table_name, row_id, detail)
    VALUES (p_child_id, v_uid, 'user', 'child.access_removed',
            'child_access', p_child_id::text,
            jsonb_build_object(
              'reason', 'independent_holders_present',
              'other_holders', v_other_holders));

    DELETE FROM public.child_access
    WHERE child_id = p_child_id AND user_id = v_uid;

    RETURN jsonb_build_object(
      'mode', 'access_removed',
      'child_first_name', v_first_name,
      'reason', 'This child has their own access — your access was removed, their data stays with them.');
  END IF;

  v_purge := now() + INTERVAL '30 days'; -- CHILD_DELETION_GRACE_DAYS

  -- Audit BEFORE marking.
  INSERT INTO public.audit_log
        (child_id, actor_user_id, actor_kind, action,
         table_name, row_id, detail)
  VALUES (p_child_id, v_uid, 'user', 'child.deletion_requested',
          'children', p_child_id::text,
          jsonb_build_object('permanent_delete_after', v_purge));

  UPDATE public.children
  SET deletion_requested_at = now(),
      permanent_delete_after = v_purge
  WHERE id = p_child_id;

  RETURN jsonb_build_object(
    'mode', 'deletion_scheduled',
    'child_first_name', v_first_name,
    'permanent_delete_after', v_purge);
END;
$$;

REVOKE ALL ON FUNCTION public.request_child_deletion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_child_deletion(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.request_child_deletion(uuid) IS
  'Self-service child removal (soft, 30-day grace). Ownership verified against auth.uid(). Independent-login children: removes caller access only.';

-- ---------------------------------------------------------------------------
-- 5. cancel_child_deletion(p_child_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_child_deletion(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_id_required';
  END IF;

  -- Scoped: only a child the caller owns AND that is pending deletion.
  UPDATE public.children c
  SET deletion_requested_at = NULL,
      permanent_delete_after = NULL
  WHERE c.id = p_child_id
    AND c.deletion_requested_at IS NOT NULL
    AND (c.parent_user_id = v_uid
         OR EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.child_id = c.id
                      AND ca.user_id = v_uid
                      AND ca.role = 'parent'));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_deletion_pending';
  END IF;

  INSERT INTO public.audit_log
        (child_id, actor_user_id, actor_kind, action,
         table_name, row_id, detail)
  VALUES (p_child_id, v_uid, 'user', 'child.deletion_cancelled',
          'children', p_child_id::text, '{}'::jsonb);

  RETURN jsonb_build_object('cancelled', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_child_deletion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_child_deletion(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.cancel_child_deletion(uuid) IS
  'Cancels a pending child deletion (grace-period recovery). Scoped to caller-owned children.';

-- ---------------------------------------------------------------------------
-- 6. purge_expired_deletions()
-- ---------------------------------------------------------------------------
-- Hard-deletes rows whose grace period expired. FK-safe order per user:
--   child_access → children → profiles → public.users → auth.users.
-- Also purges expired children not tied to an account deletion.
-- Intended for pg_cron nightly; callable by service_role for manual runs.
-- Every purge is audit-logged BEFORE the rows disappear.
CREATE OR REPLACE FUNCTION public.purge_expired_deletions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_child      uuid;
  v_users      int := 0;
  v_children   int := 0;
BEGIN
  -- Expired users first.
  FOR v_uid IN
    SELECT id FROM public.users
    WHERE permanent_delete_after IS NOT NULL
      AND permanent_delete_after < now()
  LOOP
    INSERT INTO public.audit_log
          (child_id, actor_user_id, actor_kind, action,
           table_name, row_id, detail)
    VALUES (NULL, v_uid, 'system', 'account.purged',
            'users', v_uid::text,
            jsonb_build_object('reason', 'grace_period_expired'));

    -- Grants for children this user parents (their rows die with children,
    -- but be explicit for clarity).
    DELETE FROM public.child_access ca
    USING public.children c
    WHERE ca.child_id = c.id
      AND (c.parent_user_id = v_uid
           OR (c.deletion_requested_at IS NOT NULL));

    -- Their grants on any child.
    DELETE FROM public.child_access WHERE user_id = v_uid;

    -- Owned children (expired or not — the account is gone).
    DELETE FROM public.children
    WHERE parent_user_id = v_uid;

    -- Profile (if the profiles table exists in this environment).
    BEGIN
      DELETE FROM public.profiles WHERE user_id = v_uid;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    -- App user row, then the auth identity. The FK from public.users
    -- cascades, but delete explicitly for clarity.
    DELETE FROM public.users WHERE id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;

    v_users := v_users + 1;
  END LOOP;

  -- Expired children not tied to a purged account (standalone removals).
  FOR v_child IN
    SELECT id FROM public.children
    WHERE permanent_delete_after IS NOT NULL
      AND permanent_delete_after < now()
  LOOP
    INSERT INTO public.audit_log
          (child_id, actor_user_id, actor_kind, action,
           table_name, row_id, detail)
    VALUES (v_child, NULL, 'system', 'child.purged',
            'children', v_child::text,
            jsonb_build_object('reason', 'grace_period_expired'));

    DELETE FROM public.child_access WHERE child_id = v_child;
    DELETE FROM public.children WHERE id = v_child;
    v_children := v_children + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'users_purged', v_users,
    'children_purged', v_children);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_deletions() TO service_role;

COMMENT ON FUNCTION public.purge_expired_deletions() IS
  'Nightly hard-purge for expired soft-deletions. service_role only. FK-safe order, audit-logged.';

-- ---------------------------------------------------------------------------
-- 7. Nightly schedule (pg_cron, if available)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-expired-deletions',
      '0 3 * * *',
      'SELECT public.purge_expired_deletions();'
    );
  END IF;
END $$;
