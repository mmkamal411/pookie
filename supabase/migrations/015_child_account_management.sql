-- Migration 015: Parent-facing child account management
--
-- CONTEXT: two account-lifecycle flows on top of the 001 tenancy core:
--   (A) Child invite verification: a parent invites a child by email; the
--       child accepts via the email link (consume_invite, 001) and gets a
--       child_access row. The invites table already supports this, but it
--       had no sender attribution and no child-specific TTL.
--   (B) Child independence at 18 ("graduate"): an adult child takes sole
--       ownership of their tenant; all parent access rows are removed.
--
-- CHANGES:
--   1. invites.invited_by_user_id uuid REFERENCES auth.users(id), nullable
--      (backfill: historical rows stay NULL). Auto-attributed by trigger —
--      the caller can never spoof another sender.
--   2. invites_before_write() trigger (INSERT/UPDATE):
--        * sender attribution (see 1)
--        * 7-day TTL cap for role='child' invites, at INSERT and on UPDATE —
--          the 14-day column default is kept untouched for parent/other
--          flows; child invites are clamped down, never extended.
--        * defense-in-depth for the 001 F1 anti-escalation fix: the trigger
--          re-asserts the RLS policy rule (parent-role member of the invite's
--          child, or service_role) so a future policy edit cannot silently
--          reopen the child-mints-parent-invite escalation.
--        * invited_by_user_id is immutable after INSERT for non-privileged
--          callers (ledger-like history, same spirit as invites' no-DELETE).
--   3. graduate_child_access(p_child_id) RPC: SECURITY DEFINER. Callable only
--      by a user holding a role='child' membership row on that child AND
--      whose linked children.date_of_birth proves age >= 18. Promotes the
--      caller to role='parent' (sole owner), deletes all parent rows,
--      syncs users.role, writes an audit row. Fails closed otherwise.
--   4. RLS: invites_sender_read — the invite sender can SELECT rows they
--      sent (covers cases where the sender no longer holds tenant
--      membership). The invitee email-match arm already exists in
--      invites_parent_read (001); no change needed there.
--
-- TOKEN SECURITY (verified, no change): invites.token defaults to
--   encode(gen_random_bytes(24),'hex') — 24 bytes from pgcrypto's CSPRNG,
--   192 bits of entropy, hex-encoded to 48 chars. Unique constraint serializes
--   concurrent inserts. This satisfies the cryptographic-token requirement.
--
-- IDEMPOTENT: ALTER TABLE ... ADD COLUMN IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS / DROP TRIGGER IF EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE FUNCTION. Safe to re-run.
--
-- GRANT MODEL (001 F2 convention): RLS policies grant nothing — the only new
-- privilege surface is EXECUTE on graduate_child_access for authenticated
-- (+ service_role for admin/testing). No new table grants: invites already
-- carries SELECT/INSERT/UPDATE for authenticated, which covers the new
-- column; the trigger writes invited_by_user_id itself, so no column-level
-- grant dance is needed.

-- ---------------------------------------------------------------------------
-- Part 1 — invites.invited_by_user_id
-- Nullable: historical invites have no recorded sender; backfill is NULL.
-- FK points at auth.users (the login identity), matching users.id's own
-- reference (001) rather than the app profile, so the attribution survives
-- even if the public.users row is ever rebuilt.
-- ---------------------------------------------------------------------------
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS invites_invited_by_idx
  ON public.invites (invited_by_user_id);

-- ---------------------------------------------------------------------------
-- Part 2 — invites_before_write() trigger
-- Runs BEFORE INSERT OR UPDATE on invites. Uses safe_auth_uid() (014), not
-- auth.uid(): a non-UUID sub (service_role, agent JWTs) returns NULL instead
-- of raising, so every branch below fails closed rather than erroring.
-- Privileged path = no JWT claims at all (direct SQL) or service_role: the
-- operator may set invited_by_user_id / expires_at explicitly. Everyone else
-- gets attributed automatically and clamped to policy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invites_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role    text    := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_caller      uuid    := public.safe_auth_uid();
  v_privileged  boolean := (v_jwt_role IS NULL) OR (v_jwt_role = 'service_role');
  v_seven_days  interval := interval '7 days';
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Sender attribution: authoritative from the verified JWT. A caller can
    -- never claim another user's id here (the column is set, not read).
    IF NOT v_privileged THEN
      NEW.invited_by_user_id := v_caller;
    END IF;

    -- Anti-escalation, defense in depth for 001 F1. Mirrors
    -- invites_parent_insert's WITH CHECK so a future policy edit cannot
    -- silently let a child-role user mint invites (including role='parent')
    -- that consume_invite() would convert into parent access rows.
    IF NOT v_privileged THEN
      IF NEW.child_id IS NULL THEN
        -- New-family (child_id NULL) invites stay service_role-only by
        -- design (001 R2-6: open-vs-closed signup is an undecided founder
        -- decision; no RLS path creates them).
        RAISE EXCEPTION 'invite_new_family_service_role_only';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                     WHERE ca.user_id = v_caller
                       AND ca.child_id = NEW.child_id
                       AND ca.role = 'parent') THEN
        RAISE EXCEPTION 'invite_parent_membership_required';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT v_privileged
     AND NEW.invited_by_user_id IS DISTINCT FROM OLD.invited_by_user_id THEN
    -- Ledger-like: sender attribution is history, not editable.
    RAISE EXCEPTION 'invite_sender_immutable';
  END IF;

  -- 7-day TTL for child invites. The column's 14-day default (kept for
  -- parent/new-family flows) is clamped DOWN at write time; it can never be
  -- extended on INSERT or UPDATE. Applies to privileged callers too unless
  -- they explicitly set a shorter window — the window is policy, not
  -- caller discretion. (Non-privileged callers never reach here with an
  -- explicit longer value anyway: the 14d default is what gets clamped.)
  IF NEW.role = 'child'
     AND NEW.expires_at > COALESCE(NEW.created_at, now()) + v_seven_days THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + v_seven_days;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invites_before_write ON public.invites;
CREATE TRIGGER trg_invites_before_write
  BEFORE INSERT OR UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.invites_before_write();

-- ---------------------------------------------------------------------------
-- Part 3 — graduate_child_access(p_child_id)
-- The "graduate" flow: an adult child becomes sole owner of their tenant.
--
-- SECURITY: SECURITY DEFINER + SET search_path=public (001 convention).
-- EXECUTE revoked from PUBLIC, granted to authenticated + service_role only.
-- The function itself enforces every authorization check and fails closed:
--   1. p_child_id NULL                     -> 'child_required'
--   2. no authenticated caller              -> 'authentication_required'
--   3. caller holds no role='child' row on   -> 'child_membership_required'
--      this child (a parent-role holder calling it gets this too)
--   4. children row missing                 -> 'child_not_found'
--   5. date_of_birth NULL or age < 18       -> 'child_not_of_age'
-- Row locks (FOR UPDATE) serialize concurrent graduations of one child.
--
-- EFFECTS (single transaction, all-or-nothing):
--   a. DELETE all role='parent' child_access rows for the child — the parent
--      loses access. This deliberately bypasses revoke_child_access()'s
--      last-parent guard: an adult taking sole ownership IS the sanctioned
--      orphan-parent case.
--   b. The caller's own membership row flips role='child' -> 'parent':
--      they become sole owner (invite rights, member management).
--   c. users.role synced child -> parent for the caller (profile consistency;
--      RLS gates on child_access, but the profile should not lie).
--   d. audit_event 'access.graduated' with the removed-parent count.
-- Data preservation is structural: every app table keys off children.id,
-- which never changes — nothing is moved, copied, or deleted except the
-- parent membership rows.
-- Idempotent: re-running with no parents left just re-affirms ownership
-- (removed_parent_rows = 0) and returns true.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.graduate_child_access(p_child_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  uuid := public.safe_auth_uid();
  v_dob     date;
  v_removed integer;
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_required';
  END IF;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  -- Fail closed: only a role='child' member of THIS child may graduate it.
  PERFORM 1 FROM public.child_access ca
   WHERE ca.child_id = p_child_id
     AND ca.user_id = v_caller
     AND ca.role = 'child'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'child_membership_required';
  END IF;

  SELECT c.date_of_birth INTO v_dob
    FROM public.children c
   WHERE c.id = p_child_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'child_not_found';
  END IF;

  -- 18th birthday reached. NULL dob fails closed (unknown age is not 18+).
  IF v_dob IS NULL OR v_dob > (current_date - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'child_not_of_age';
  END IF;

  -- (a) Parents lose access. The caller's own row is role='child', so it is
  --     untouched by this delete.
  DELETE FROM public.child_access
   WHERE child_id = p_child_id AND role = 'parent';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- (b) The graduate becomes sole owner of their own profile.
  UPDATE public.child_access
     SET role = 'parent'
   WHERE child_id = p_child_id AND user_id = v_caller;

  -- (c) Keep the profile role consistent with the granted access role
  --     (same sync consume_invite() performs in both directions).
  UPDATE public.users
     SET role = 'parent'
   WHERE id = v_caller AND role IS DISTINCT FROM 'parent';

  -- (d) Audit. The caller still holds a membership row (now role='parent'),
  --     so audit_event()'s tenant assertion (004) passes.
  PERFORM public.audit_event(p_child_id, 'access.graduated', 'user',
                             'child_access', p_child_id::text,
                             jsonb_build_object('graduated_user_id', v_caller,
                                                'removed_parent_rows', v_removed));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.graduate_child_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.graduate_child_access(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — RLS: sender visibility on invites
-- invites_parent_read (001) already gives the invitee the email-match SELECT
-- arm; the sender arm is new: the parent who sent the invite can SELECT the
-- rows they sent even if they no longer hold tenant membership (or, for
-- service_role-seeded rows, whenever invited_by_user_id names them).
-- No column GRANT changes: invites already carries table-level
-- SELECT/INSERT/UPDATE for authenticated (001 F2), which covers the new
-- column; invited_by_user_id is written by the trigger, never trusted from
-- the client.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS invites_sender_read ON public.invites;
CREATE POLICY invites_sender_read ON public.invites
  FOR SELECT USING (invited_by_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Verification (run after applying; each should return the noted result)
-- ---------------------------------------------------------------------------
-- 1. Column exists, nullable, FK to auth.users:
--    SELECT column_name, is_nullable, data_type
--      FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='invites'
--       AND column_name='invited_by_user_id';
--    -- expect: invited_by_user_id | YES | uuid
-- 2. Child invite TTL clamps to 7 days (as a parent member):
--    INSERT INTO public.invites (email, role, child_id)
--    VALUES ('kid@example.com','child','<a real child_id>')
--    RETURNING expires_at - created_at;
--    -- expect: 7 days (not 14)
-- 3. Child-role user cannot mint an invite (trigger raises):
--    (as a child member) INSERT INTO public.invites (email, role, child_id) ...
--    -- expect: ERROR invite_parent_membership_required
-- 4. Graduate happy path (as the child, dob >= 18y ago):
--    SELECT public.graduate_child_access('<child_id>');
--    -- expect: true; child_access holds one row (caller, role='parent')
-- 5. Graduate under 18 / by a parent / by a non-member:
--    -- expect: ERROR child_not_of_age / child_membership_required
-- 6. Grants:
--    SELECT grantee FROM information_schema.routine_privileges
--     WHERE routine_schema='public' AND routine_name='graduate_child_access';
--    -- expect: authenticated, service_role (NOT public, NOT anon)
