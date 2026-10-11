-- Migration 001: Multi-tenant core (users, children, child_access, invites)
-- Greenfield project: pookie
-- Source: PLAN.md §3.1, §4.1
-- Principle: login email is the tenant resolver. child_access is the single source of truth.
--
-- ROUND-1 FIXES 2026-10-11 (Database expert — Data & Tenancy / RLS correctness):
--   F1  invites policies: the old `invites_parent_write FOR ALL USING
--       (child_id IS NULL OR child_id = ANY (current_child_ids()))` let ANY
--       authenticated user — including child-role users and anon-adjacent
--       callers once GRANTs exist — INSERT invites with child_id NULL (no
--       membership check at all) and let child-role users mint invites
--       (even role='parent') for their own tenant. consume_invite() is
--       SECURITY DEFINER, so such an invite converts directly into a parent
--       access row: privilege escalation. Split into parent-only
--       INSERT/UPDATE policies; invitee keeps SELECT on own rows; NULL-child
--       (new-family) invites are service_role-only (no RLS path creates them).
--       No DELETE policy: revocation = UPDATE status='revoked' (ledger-like).
--   F2  Added the missing GRANTs (H2). RLS policies alone grant nothing —
--       without these PostgREST returns permission-denied for every client.
--       Least-privilege: no anon grants; column-level UPDATE on users and
--       children so security-critical columns (users.role, users.email,
--       children.parent_user_id) can never be rewritten by clients even if a
--       future policy is written sloppily.
--   F3  users: added users_self_update (display_name only, via column GRANT)
--       — previously no UPDATE policy existed, so the app could not update
--       display names at all; the column GRANT (not the policy) is what
--       prevents a self role='parent' escalation.
--   F4  children: no direct INSERT grant/policy — inserts go through the new
--       create_child() RPC (atomic child + parent access row; the old
--       FOR ALL USING could never permit INSERT anyway since a fresh id is
--       never in current_child_ids(), which silently broke the add-a-child
--       wizard). children.parent_user_id excluded from the UPDATE column
--       GRANT (billing anchor is never client-writable).
--   F5  child_access: removed the direct DELETE policy; deletes go through
--       the new revoke_child_access() RPC, which refuses to remove the last
--       parent of a child (orphaned tenants are unmanageable) and writes an
--       audit row. No UPDATE grant/policy on child_access at all (role
--       changes are revoke+grant, never in-place edits).
--   F6  consume_invite(): (a) the email check `v_invite.email <> (SELECT
--       email ...)` was FAIL-OPEN on a missing users row (NULL <> x -> NULL
--       -> IF skipped); now `IS DISTINCT FROM` + lower() — fail-closed and
--       case-insensitive. (b) Guards against double-provisioning and mixed
--       parent+child roles for one login, with a deliberate same-child
--       promotion path. (c) Deterministic slug per invite with a retry loop
--       on unique_violation. (d) Syncs users.role both directions. (e) Logs
--       access.granted via audit_event (runtime dep on 004 — resolved at
--       execution, not creation). (f) EXECUTE revoked from PUBLIC.
--   F7  New create_child() RPC: the only client path to add a child row.
--   F8  New revoke_child_access() RPC: the only client path to remove access.
--   F9  current_child_ids(): agent-aware. When the verified JWT carries
--       role='agent_reader', the tenant set resolves from
--       agent_tenant_scope via the service-minted job_id claim (expired or
--       missing scope -> '{}' -> deny). This makes the agent boundary
--       enforceable by RLS itself, not by query convention. The
--       agent_tenant_scope table is CREATED HERE (moved from 005): 001's
--       function is LANGUAGE sql, whose body is validated at CREATE time,
--       so the table must exist before this function is defined.
--   F10 Added handle_auth_user_updated trigger: auth.users email changes
--       propagate to public.users.email (the platform is email-keyed; a
--       stale email breaks the tenant resolver).
--   F11 `DROP POLICY IF EXISTS` before every CREATE POLICY — Postgres has no
--       CREATE POLICY IF NOT EXISTS, so re-running the migration used to
--       fail on duplicates.
--   F12 users_self_read join logic VERIFIED (no cross-tenant email leak:
--       the EXISTS arm requires the CALLER to hold role='parent' on the
--       shared child; child-role callers see only their own row; anon sees
--       nothing). child_access_parent_insert/_delete self-reference
--       VERIFIED: the EXISTS subquery re-enters child_access through the
--       SELECT policy, which is equally restrictive — a caller cannot see a
--       child they are not a member of, so the check cannot be abused to
--       grant into foreign tenants. handle_new_auth_user default-role
--       window VERIFIED harmless: every policy gates on child_access, never
--       on users.role, so role='parent' with zero access rows sees nothing.
--       current_child_ids() can never return NULL (COALESCE -> '{}'); anon
--       (auth.uid() NULL) always gets '{}' -> every predicate fail-closed.

-- ---------------------------------------------------------------------------
-- users: app-level profile, 1:1 with auth.users, created by trigger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text UNIQUE NOT NULL,
  role        text NOT NULL CHECK (role IN ('parent','child')),
  display_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- children: the tenants
-- parent_user_id is the owner/billing anchor ONLY — never the access mechanism.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.children (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid REFERENCES public.users(id),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  nickname      text,
  slug          text UNIQUE NOT NULL,          -- e.g. 'dawson-kamal'
  date_of_birth date,
  school_name   text,
  district      text,
  grade_level   text,
  student_id    text,
  grade_scale   jsonb NOT NULL DEFAULT '{"A":[90,100],"B":[80,89],"C":[74,79],"D":[70,73],"F":[0,69]}'::jsonb,
  timezone      text NOT NULL DEFAULT 'America/New_York',
  avatar_url    text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One default child per parent (billing anchor scope)
CREATE UNIQUE INDEX IF NOT EXISTS children_one_default_per_parent
  ON public.children (parent_user_id) WHERE is_default AND parent_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- child_access: THE membership table — single source of truth for tenancy
-- (child_id, user_id) PK. Partial unique index: a child-role user holds
-- exactly one row globally; parents hold N.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_access (
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('parent','child')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, user_id)
);

-- A child-role user may belong to exactly one child, globally.
CREATE UNIQUE INDEX IF NOT EXISTS child_access_one_child_per_child_user
  ON public.child_access (user_id) WHERE role = 'child';

CREATE INDEX IF NOT EXISTS child_access_user_id_idx
  ON public.child_access (user_id);

-- ---------------------------------------------------------------------------
-- invites: the allowlist. Seeds from today's family-email allowlist.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('parent','child')),
  child_id   uuid REFERENCES public.children(id) ON DELETE CASCADE, -- null = new family parent
  token      text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invites_email_status_idx
  ON public.invites (email, status);

-- FIX 2026-10-11 (F1): the parent-scoped invite policies filter on child_id;
-- without this index every invite read/write scans.
CREATE INDEX IF NOT EXISTS invites_child_id_idx
  ON public.invites (child_id);

-- ---------------------------------------------------------------------------
-- agent_tenant_scope: per-job agent tenancy (which child a job may touch)
-- FIX 2026-10-11 (F9): defined HERE, not in 005. current_child_ids() below
-- is LANGUAGE sql and Postgres validates a SQL function body at CREATE time,
-- so the table must exist before the function is defined. RLS is enabled
-- with NO policies: deny-all direct access. Reads go through SECURITY
-- DEFINER helpers (current_child_ids, agent_assert_scope in 005); writes are
-- service_role-only (the backend that mints the agent's scoped JWT at cron/
-- job creation). Rows expire after 2h; an expired scope fails closed ('{}').
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_tenant_scope (
  job_id     text PRIMARY KEY,
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours'
);

CREATE INDEX IF NOT EXISTS agent_tenant_scope_expires_idx
  ON public.agent_tenant_scope (expires_at);

ALTER TABLE public.agent_tenant_scope ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-all. See header comment.

-- ---------------------------------------------------------------------------
-- Trigger: ensure public.users row on auth.users insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'parent', -- default; corrected by invite consumption or admin.
              -- F12: harmless window — every RLS policy gates on
              -- child_access, never on users.role, so a fresh user with
              -- zero access rows sees nothing regardless of this default.
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11 (F10): keep the email-keyed tenant resolver consistent.
-- If the auth email changes, public.users.email must follow, otherwise invite
-- matching and the login flow's email comparisons silently break.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();

-- ---------------------------------------------------------------------------
-- RLS helper: current_child_ids() — the caller's tenant set (STABLE, DEFINER)
-- FIX 2026-10-11 (F9): agent-aware. The agent authenticates with a
-- service-minted JWT carrying role='agent_reader' and a job_id claim; its
-- tenant set is that job's scope row (not child_access — the agent has no
-- membership rows by design). Missing/expired scope -> '{}' -> every policy
-- denies: fail-closed. Regular callers take the child_access path.
-- STABLE (not VOLATILE): evaluated once per statement — this is the
-- performance-critical property for RLS-heavy workloads (see handbook 06).
-- NEVER returns NULL: COALESCE -> '{}'; `x = ANY('{}')` is false, never NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_child_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'agent_reader' THEN
      COALESCE((
        SELECT array_agg(s.child_id)
        FROM public.agent_tenant_scope s
        WHERE s.job_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'job_id')
          AND s.expires_at > now()
      ), '{}')
    ELSE
      COALESCE((
        SELECT array_agg(ca.child_id)
        FROM public.child_access ca
        WHERE ca.user_id = auth.uid()
      ), '{}')
  END
$$;

-- ---------------------------------------------------------------------------
-- Invite consumption: called after OTP login when child_access has 0 rows
-- FIX 2026-10-11 (F6):
--   (a) Email check is now fail-closed: `lower(v_invite.email) IS DISTINCT
--       FROM lower(v_caller_email)`. The old `<>` comparison yielded NULL
--       (check skipped) when the users row was missing, and was
--       case-sensitive, stranding legit users in pending-invite state.
--   (b) Double-provisioning guards: a login that already holds access rows
--       cannot consume a 'child' invite (partial unique index is the backstop;
--       this raises a clear error first). A 'parent' invite promotes an
--       existing same-child child_role row in place; a child of ANOTHER
--       child cannot become a parent (mixed roles unsupported) — raises.
--   (c) New-family slug is deterministic per invite with a retry loop on
--       unique_violation (concurrent consumes of one token serialize on the
--       FOR UPDATE lock below, so the second sees status='accepted' and
--       raises before inserting).
--   (d) users.role is synced to the granted role in both directions.
--   (e) Logs access.granted via public.audit_event (defined in 004; plpgsql
--       resolves it at execution time, so the cross-migration reference is
--       safe at runtime).
-- The SELECT ... FOR UPDATE serializes concurrent consumptions of one token:
-- the loser sees status <> 'pending' and raises invite_not_found_or_expired.
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

  -- Fail-closed, case-insensitive email match.
  SELECT email INTO v_caller_email FROM public.users WHERE id = auth.uid();
  IF lower(v_invite.email) IS DISTINCT FROM lower(v_caller_email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- No double-provisioning as a second child identity.
  IF v_invite.role = 'child'
     AND EXISTS (SELECT 1 FROM public.child_access WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_provisioned';
  END IF;

  -- 'parent' invite for a login that currently holds a child role:
  -- same child -> in-place promotion; different child -> refuse (mixed
  -- parent+child roles for one login are unsupported; admin path only).
  IF v_invite.role = 'parent' THEN
    SELECT ca.child_id INTO v_existing_child
      FROM public.child_access ca
     WHERE ca.user_id = auth.uid() AND ca.role = 'child';
    IF FOUND THEN
      IF v_invite.child_id IS DISTINCT FROM v_existing_child THEN
        RAISE EXCEPTION 'role_conflict_requires_admin';
      END IF;
      UPDATE public.child_access SET role = 'parent'
       WHERE user_id = auth.uid() AND child_id = v_existing_child;
    END IF;
  END IF;

  -- New family parent (child_id null): create their first child shell; profile completed in UI
  IF v_invite.child_id IS NULL THEN
    FOR v_attempt IN 1..5 LOOP
      v_slug := 'child-' || substr(md5(v_invite.id::text || ':' || v_attempt::text), 1, 12);
      BEGIN
        INSERT INTO public.children (parent_user_id, first_name, last_name, slug)
        VALUES (auth.uid(), 'New', 'Child', v_slug)
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
  VALUES (v_child, auth.uid(), v_invite.role)
  ON CONFLICT DO NOTHING;

  -- Keep the profile role in sync with the granted access role.
  UPDATE public.users SET role = v_invite.role
   WHERE id = auth.uid() AND role IS DISTINCT FROM v_invite.role;

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
-- FIX 2026-10-11 (F7): create_child() — the ONLY client path that inserts a
-- children row. The children_parent_write policy's USING clause can never
-- permit a direct INSERT (a fresh id is not in current_child_ids()), so the
-- add-a-child wizard needs this atomic RPC: child row + the caller's parent
-- access row are created together — no orphan-tenant window. Only an
-- existing parent-role holder may call it; a family's FIRST child always
-- comes from consume_invite (NULL-child_id invite).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_child(
  p_first_name  text,
  p_last_name   text,
  p_nickname    text DEFAULT NULL,
  p_slug        text DEFAULT NULL,
  p_school_name text DEFAULT NULL,
  p_grade_level text DEFAULT NULL,
  p_timezone    text DEFAULT 'America/New_York'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_base     text;
  v_try      text;
  v_attempt  int;
BEGIN
  IF p_first_name IS NULL OR btrim(p_first_name) = ''
     OR p_last_name IS NULL OR btrim(p_last_name) = '' THEN
    RAISE EXCEPTION 'child_name_required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.child_access
                 WHERE user_id = auth.uid() AND role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  v_base := COALESCE(NULLIF(btrim(p_slug), ''),
                     lower(regexp_replace(p_first_name || '-' || p_last_name,
                                          '[^a-z0-9]+', '-', 'gi')));
  v_base := btrim(v_base, '-');
  IF v_base = '' THEN v_base := 'child'; END IF;

  -- Prefer the clean slug when free; suffix on collision.
  FOR v_attempt IN 1..5 LOOP
    IF v_attempt = 1 THEN
      v_try := v_base;
    ELSE
      v_try := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    END IF;
    BEGIN
      INSERT INTO public.children
            (parent_user_id, first_name, last_name, nickname, slug,
             school_name, grade_level, timezone)
      VALUES (auth.uid(), btrim(p_first_name), btrim(p_last_name),
              NULLIF(btrim(p_nickname), ''), v_try,
              NULLIF(btrim(p_school_name), ''), NULLIF(btrim(p_grade_level), ''),
              p_timezone)
      RETURNING id INTO v_child_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.child_access (child_id, user_id, role)
  VALUES (v_child_id, auth.uid(), 'parent');

  -- Caller is a member of the new child from the row above, so this passes
  -- audit_event's membership assertion (004, resolved at runtime).
  PERFORM public.audit_event(v_child_id, 'child.created', 'user', 'children',
                             v_child_id::text,
                             jsonb_build_object('slug', v_try));

  RETURN v_child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_child(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_child(text, text, text, text, text, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11 (F8): revoke_child_access() — the ONLY client path that
-- deletes a child_access row (the old child_access_parent_delete policy is
-- dropped below). A parent can remove members of their own child, but the
-- call refuses to remove the LAST parent row: an orphaned tenant is
-- unmanageable and unrecoverable without admin intervention. Full tenant
-- erasure still goes through DELETE on children (cascades), not through
-- access-row surgery. Every revocation is audit-logged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_child_access(p_child_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_child_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'child_and_user_required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = p_child_id
                   AND ca.role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  SELECT ca.role INTO v_role FROM public.child_access ca
   WHERE ca.child_id = p_child_id AND ca.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'access_row_not_found';
  END IF;

  IF v_role = 'parent' AND NOT EXISTS (
    SELECT 1 FROM public.child_access
     WHERE child_id = p_child_id AND role = 'parent' AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'cannot_remove_last_parent';
  END IF;

  -- Log BEFORE the delete: after removing their own row the caller would no
  -- longer satisfy audit_event()'s membership assertion, rolling back the
  -- whole transaction (a parent leaving their own family must still work).
  PERFORM public.audit_event(p_child_id, 'access.revoked', 'user', 'child_access',
                             p_child_id::text,
                             jsonb_build_object('removed_user_id', p_user_id,
                                                'role', v_role));

  DELETE FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_child_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_child_access(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites      ENABLE ROW LEVEL SECURITY;

-- FIX 2026-10-11 (F11): DROP POLICY IF EXISTS precedes every CREATE POLICY —
-- Postgres has no CREATE POLICY IF NOT EXISTS, so re-runs used to fail.

-- users: you can read your own row; parents can read rows of users sharing a child.
-- F12: join logic verified — the EXISTS arm requires the CALLER to hold
-- role='parent' on the shared child, so a child-role caller sees only their
-- own row and no emails leak across tenants. Anon (auth.uid() NULL) matches
-- nothing.
DROP POLICY IF EXISTS users_self_read ON public.users;
CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.child_access ca1
               JOIN public.child_access ca2 ON ca1.child_id = ca2.child_id
               WHERE ca1.user_id = auth.uid() AND ca2.user_id = public.users.id
                 AND ca1.role = 'parent'));

-- FIX 2026-10-11 (F3): users could never update their own display_name (no
-- UPDATE policy existed). The column GRANT below — not the policy — is what
-- prevents role/email escalation: only display_name is updatable.
DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- children: readable iff in your tenant set; writable only by parent-role holders in set.
-- (INSERT has no client path by design — see create_child() above.)
DROP POLICY IF EXISTS children_tenant_read ON public.children;
CREATE POLICY children_tenant_read ON public.children
  FOR SELECT USING (id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS children_parent_write ON public.children;
CREATE POLICY children_parent_write ON public.children
  FOR ALL USING (
    id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.children.id AND ca.role = 'parent')
  );

-- child_access: readable by members; inserts by parents (definer fns bypass).
-- F12: the self-referencing EXISTS subquery re-enters child_access through
-- the SELECT policy, which is equally restrictive — a caller cannot observe
-- (hence cannot satisfy the check for) a child they are not a member of, so
-- the check cannot be abused to grant into foreign tenants. A child-role
-- caller fails the ca.role='parent' predicate even for their own child.
DROP POLICY IF EXISTS child_access_member_read ON public.child_access;
CREATE POLICY child_access_member_read ON public.child_access
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS child_access_parent_insert ON public.child_access;
CREATE POLICY child_access_parent_insert ON public.child_access
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid() AND ca.child_id = child_access.child_id AND ca.role = 'parent')
  );

-- FIX 2026-10-11 (F8): direct DELETE removed — use revoke_child_access().
-- Dropped here so re-runs over the old migration converge.
DROP POLICY IF EXISTS child_access_parent_delete ON public.child_access;

-- invites: inviting parent (same tenant) + invitee (by email) only.
-- FIX 2026-10-11 (F1): the old single FOR ALL policy
--   USING (child_id IS NULL OR child_id = ANY (current_child_ids()))
-- let ANY authenticated user INSERT child_id-NULL invites (no membership
-- check whatsoever) and let child-role users mint invites — including
-- role='parent' — for their own tenant, which consume_invite() (definer)
-- converts into a parent access row: privilege escalation. Now:
--   * SELECT: parent-role members of the invite's child, OR the invitee
--     themself (email match, case-insensitive).
--   * INSERT/UPDATE: parent-role members of the invite's child ONLY.
--   * No DELETE policy: revocation is UPDATE status='revoked' (ledger-like);
--     expired-row cleanup is a service_role job.
--   * child_id IS NULL (new-family) invites have NO RLS write path: they are
--     created by service_role (the family allowlist seed) only.
DROP POLICY IF EXISTS invites_parent_write ON public.invites;  -- old, over-broad
DROP POLICY IF EXISTS invites_parent_read ON public.invites;
CREATE POLICY invites_parent_read ON public.invites
  FOR SELECT USING (
    (child_id = ANY (public.current_child_ids())
     AND EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = public.invites.child_id
                   AND ca.role = 'parent'))
    OR lower(email) = lower((SELECT u.email FROM public.users u WHERE u.id = auth.uid()))
  );

DROP POLICY IF EXISTS invites_parent_insert ON public.invites;
CREATE POLICY invites_parent_insert ON public.invites
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.invites.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS invites_parent_update ON public.invites;
CREATE POLICY invites_parent_update ON public.invites
  FOR UPDATE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.invites.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.invites.child_id
                  AND ca.role = 'parent')
  );

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11 (F2): explicit GRANTs. RLS policies alone grant nothing —
-- without these PostgREST returns permission-denied for every client role.
-- RLS remains the narrow gate; grants are the wide-but-necessary door.
-- anon gets NOTHING on tenancy tables (school_systems' public registry is
-- the only anon-readable surface, granted in 002).
-- ---------------------------------------------------------------------------

-- users: read own/co-member rows; update display_name only. role/email/id
-- are never client-writable (column GRANT allowlist, not policy text, is the
-- enforcement — it survives future policy edits).
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (display_name) ON public.users TO authenticated;

-- children: parents read/write their tenant's rows; no client INSERT
-- (create_child() RPC is the path); parent_user_id excluded from the UPDATE
-- column list — the billing anchor is never client-rewritable.
GRANT SELECT ON public.children TO authenticated;
GRANT UPDATE (first_name, last_name, nickname, slug, date_of_birth,
              school_name, district, grade_level, student_id, grade_scale,
              timezone, avatar_url, status, is_default)
  ON public.children TO authenticated;
GRANT DELETE ON public.children TO authenticated;

-- child_access: members read; parents insert. No UPDATE/DELETE grants at
-- all — role changes are revoke+grant, deletes go through
-- revoke_child_access() (definer). Least privilege, enforced by grants.
GRANT SELECT, INSERT ON public.child_access TO authenticated;

-- invites: parents read/write their tenant's invites; invitees read their
-- own rows. No DELETE grant — revocation is a status update.
GRANT SELECT, INSERT, UPDATE ON public.invites TO authenticated;

-- agent_tenant_scope: no grants to any client role (deny-all by RLS; writes
-- are service_role-only, reads are via SECURITY DEFINER helpers).
