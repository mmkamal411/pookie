-- ===========================================================================
-- STAGING FILE — RLS foundation for access-control tables (Security Engineer)
-- Staged at: ~/workspace/pookie-security-staging/rls_foundation.sql
-- ===========================================================================
-- MD FREEZE (2026-10-12): do NOT place in supabase/migrations/ yet. This is
-- the complete, corrected policy set, staged for folding into the renumbered
-- migration sequence. Policy names and logic are final; keep names stable so
-- Fractional Team 2's audit stays mechanical.
--
-- SUPERSEDES the truncated draft at supabase/migrations/025_rls_foundation.sql
-- (incomplete — unbalanced $$, Parts 2c/3/4 missing — DISCARD during folding).
--
-- Reconciled 2026-10-12 ~04:05 EDT against the LANDED backend migrations:
--   017_profiles.sql         (profiles: date_of_birth, legal_status, RLS)
--   018_access_authority.sql (granted_by/status/cooling, grant/revoke RPCs)
--   019_link_codes.sql       (link_codes + generate/redeem RPCs)
--   020_access_requests.sql  (requester_id, request/decide RPCs)
--   021_access_events.sql    (access_events + log_access_event 7-arg form)
-- Part 0 assurances converge whether they ran first or not (IF NOT EXISTS).
--
-- CONVENTIONS: public.safe_auth_uid() everywhere (014 — fail-closed on
-- non-UUID subs). Mutations on access-control tables go through SECURITY
-- DEFINER RPCs; authenticated gets SELECT-only table grants where a direct
-- read path exists, and NO INSERT/UPDATE/DELETE policies where the RPC-only
-- rule applies (default-deny). service_role bypasses RLS natively.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE throughout.

-- ===========================================================================
-- Part 0 — schema assurances (converge with 017–021 / 030)
-- ===========================================================================

-- 0a. child_access status + expiry. 018 added status (CHECK
-- 'active','revoked','scheduled_revoke','pending_coapproval') + cooling /
-- lockout bookkeeping; expires_at + grant_kind/grant_purpose land in 030.
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'child_access_status_check') THEN
    ALTER TABLE public.child_access
      ADD CONSTRAINT child_access_status_check
      CHECK (status IN ('active','revoked','scheduled_revoke','pending_coapproval'));
  END IF;
END
$$;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS cooling_off_until timestamptz;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS re_request_locked_until timestamptz;
CREATE INDEX IF NOT EXISTS child_access_status_idx
  ON public.child_access (child_id, status) WHERE status = 'active';

-- 0b. profiles (017 landed: user_id PK, display_name, onboarding_completed,
-- date_of_birth, dob_verified, legal_status, created_at, updated_at).
-- Assurances below no-op when 017 applied first.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  date_of_birth        date,
  dob_verified         boolean NOT NULL DEFAULT false,
  legal_status         text NOT NULL DEFAULT 'adult',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_status text NOT NULL DEFAULT 'adult';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'profiles_legal_status_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_legal_status_check
      CHECK (legal_status IN ('adult', 'minor', 'emancipated'));
  END IF;
END
$$;

-- 0c. link_codes (019 landed the table + RLS + RPCs; no-op when first).
CREATE TABLE IF NOT EXISTS public.link_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash     text NOT NULL,
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + INTERVAL '15 minutes',
  used_at       timestamptz,
  used_by       uuid REFERENCES auth.users(id),
  attempt_count integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS link_codes_one_live_per_child
  ON public.link_codes (child_id) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS link_codes_child_expiry_idx
  ON public.link_codes (child_id, expires_at);
CREATE INDEX IF NOT EXISTS link_codes_created_by_idx
  ON public.link_codes (created_by);

-- 0d. access_events + reason codes (021 landed; seed converges via
-- ON CONFLICT DO NOTHING).
CREATE TABLE IF NOT EXISTS public.access_reason_codes (
  code        text PRIMARY KEY,
  description text NOT NULL
);
INSERT INTO public.access_reason_codes (code, description) VALUES
  ('teen_choice','Teen''s own sharing choice'),
  ('regrant','Teen re-granted after revoke'),
  ('safety_concern','Safety-driven change'),
  ('safe_exit_risk','Teen indicated telling parents could put them at risk'),
  ('household_change','Blended-family / household change'),
  ('cooling_off_expired','7-day cooling-off reached effect'),
  ('cooling_off_cancelled','Teen cancelled pending revoke'),
  ('court_order','Court-ordered change'),
  ('duplicate_cleanup','Claim-dedupe merge'),
  ('system_migration','Backfill / migration'),
  ('trusted_adult_request','Trusted adult involved'),
  ('coerced_link','Link completed under possible coercion flag'),
  ('credentials_paused','Revoked parent''s sync credentials paused')
ON CONFLICT (code) DO NOTHING;

-- 0e. emergency_access_grants — *** INTERFACE DEFINED HERE (Security
-- Engineer). *** No spec'd schema exists in BUILD-SPECIFICATION.md or
-- sol-access.md, and the MD directive forbids placeholder policies, so the
-- schema ships here. Semantics (per coordinator brief): the teen designates
-- trusted adults for emergency break-glass access; readable ONLY by the
-- teen + service_role — never by parents (even non-revoked), so no parent
-- can discover or pressure the teen's trusted adult. Backend: adopt or
-- reconcile before landing any competing definition.
CREATE TABLE IF NOT EXISTS public.emergency_access_grants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  grantee_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by_user_id  uuid NOT NULL REFERENCES auth.users(id),
  scope               text NOT NULL DEFAULT 'break_glass'
                      CHECK (scope IN ('break_glass','safety_contact')),
  reason              text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  revoked_at          timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS emergency_access_grants_active_one
  ON public.emergency_access_grants (child_id, grantee_user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS emergency_access_grants_child_idx
  ON public.emergency_access_grants (child_id);

-- 0f. access_requests.requester_id (020 landed; no-op when first).
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS requester_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS access_requests_requester_idx
  ON public.access_requests (requester_id);

-- ===========================================================================
-- Part 1 — tenancy gate: current_child_ids() enforces effective access
-- ===========================================================================
-- THE single funnel every tenant-table SELECT policy keys off. A row counts
-- as access-granting when:
--   status = 'active', OR
--   status = 'scheduled_revoke' with cooling_off_until still in the future
--     (the 13–15 cooling-off keeps the grant EFFECTIVE until it elapses —
--     the panel requires the parent's view to look unchanged during cooling;
--     cutting access at initiation would also break the frozen-view design),
-- AND (expires_at IS NULL OR expires_at > now()).
-- Revoked / expired / lapsed-cooling rows are invisible everywhere,
-- immediately — including to already-written policies.
-- Also swaps auth.uid() → safe_auth_uid() (014 convention): non-UUID subs
-- yield '{}' instead of raising.
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
        WHERE ca.user_id = public.safe_auth_uid()
          AND (ca.status = 'active'
               OR (ca.status = 'scheduled_revoke'
                   AND ca.cooling_off_until IS NOT NULL
                   AND ca.cooling_off_until > now()))
          AND (ca.expires_at IS NULL OR ca.expires_at > now())
      ), '{}')
  END
$$;

-- ===========================================================================
-- Part 2 — harden in-tree membership checks for the status/expiry world
-- ===========================================================================
-- 001/015 predate soft-revoke (revocation = DELETE). Once status='revoked'
-- rows are retained (018+), every "is a parent" check must exclude them, or
-- a revoked parent keeps invite-minting, child-creating and member-revoking
-- power. Fail-closed; no behavior change while no revoked/expired rows exist.

-- 2a. invites_before_write(): revoked/expired/cooling-lapsed parents cannot
-- mint invites. (015 checked role='parent' only.)
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
    IF NOT v_privileged THEN
      NEW.invited_by_user_id := v_caller;
    END IF;
    IF NOT v_privileged THEN
      IF NEW.child_id IS NULL THEN
        RAISE EXCEPTION 'invite_new_family_service_role_only';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                     WHERE ca.user_id = v_caller
                       AND ca.child_id = NEW.child_id
                       AND ca.role = 'parent'
                       AND (ca.status = 'active'
                            OR (ca.status = 'scheduled_revoke'
                                AND ca.cooling_off_until IS NOT NULL
                                AND ca.cooling_off_until > now()))
                       AND (ca.expires_at IS NULL OR ca.expires_at > now())) THEN
        RAISE EXCEPTION 'invite_parent_membership_required';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT v_privileged
     AND NEW.invited_by_user_id IS DISTINCT FROM OLD.invited_by_user_id THEN
    RAISE EXCEPTION 'invite_sender_immutable';
  END IF;
  IF NEW.role = 'child'
     AND NEW.expires_at > COALESCE(NEW.created_at, now()) + v_seven_days THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + v_seven_days;
  END IF;
  RETURN NEW;
END;
$$;

-- 2b. create_child(): only an effective (active / unexpired-cooling) parent
-- may create child tenants.
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
                 WHERE user_id = public.safe_auth_uid()
                   AND role = 'parent'
                   AND (status = 'active'
                        OR (status = 'scheduled_revoke'
                            AND cooling_off_until IS NOT NULL
                            AND cooling_off_until > now()))
                   AND (expires_at IS NULL OR expires_at > now())) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;
  v_base := COALESCE(NULLIF(btrim(p_slug), ''),
                     lower(regexp_replace(p_first_name || '-' || p_last_name,
                                          '[^a-z0-9]+', '-', 'gi')));
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
            (parent_user_id, first_name, last_name, nickname, slug,
             school_name, grade_level, timezone)
      VALUES (public.safe_auth_uid(), btrim(p_first_name), btrim(p_last_name),
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
  VALUES (v_child_id, public.safe_auth_uid(), 'parent');
  PERFORM public.audit_event(v_child_id, 'child.created', 'user', 'children',
                             v_child_id::text,
                             jsonb_build_object('slug', v_try));
  RETURN v_child_id;
END;
$$;

-- 2c. revoke_child_access() (001): only an effective parent may revoke, and
-- the last-parent guard counts effective parents only.
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
                 WHERE ca.user_id = public.safe_auth_uid()
                   AND ca.child_id = p_child_id
                   AND ca.role = 'parent'
                   AND (ca.status = 'active'
                        OR (ca.status = 'scheduled_revoke'
                            AND ca.cooling_off_until IS NOT NULL
                            AND ca.cooling_off_until > now()))
                   AND (ca.expires_at IS NULL OR ca.expires_at > now())) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;
  SELECT ca.role INTO v_role FROM public.child_access ca
   WHERE ca.child_id = p_child_id AND ca.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'access_row_not_found';
  END IF;
  IF v_role = 'parent' AND NOT EXISTS (
    SELECT 1 FROM public.child_access
     WHERE child_id = p_child_id AND role = 'parent'
       AND (status = 'active'
            OR (status = 'scheduled_revoke'
                AND cooling_off_until IS NOT NULL
                AND cooling_off_until > now()))
       AND (expires_at IS NULL OR expires_at > now())
       AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'cannot_remove_last_parent';
  END IF;
  PERFORM public.audit_event(p_child_id, 'access.revoked', 'user', 'child_access',
                             p_child_id::text,
                             jsonb_build_object('removed_user_id', p_user_id,
                                                'role', v_role));
  DELETE FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id;
  RETURN true;
END;
$$;

-- 2d. audit_event(): fail-closed actor attribution for non-UUID subs
-- (was: auth.uid() raises for agent JWTs, aborting the audit write).
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
  v_actor    uuid := public.safe_auth_uid();
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
  VALUES (p_child_id, v_actor, p_actor_kind, p_action, p_table_name, p_row_id, p_detail)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ===========================================================================
-- Part 3 — RLS policies
-- ===========================================================================

-- 3a. profiles: owner reads/writes own row only. No DELETE policy —
-- profile deletion is an account-erasure flow (service_role). Recreates
-- 017's policies with safe_auth_uid() (014 convention).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
CREATE POLICY profiles_owner_read ON public.profiles
  FOR SELECT USING (user_id = public.safe_auth_uid());
DROP POLICY IF EXISTS profiles_owner_insert ON public.profiles;
CREATE POLICY profiles_owner_insert ON public.profiles
  FOR INSERT WITH CHECK (user_id = public.safe_auth_uid());
DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update ON public.profiles
  FOR UPDATE
  USING (user_id = public.safe_auth_uid())
  WITH CHECK (user_id = public.safe_auth_uid());

-- 3b. link_codes: the generating parent (created_by) reads/writes own rows.
-- Redemption is SECURITY DEFINER RPC only — a non-creator matches zero rows
-- under these policies, so code_hash is never enumerable by outsiders.
-- (Coexists with 019's link_codes_parent_read metadata arm; see BUILD-LOG.)
-- No DELETE policy: invalidation is invalidated/used_at (ledger-like).
ALTER TABLE public.link_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS link_codes_creator_select ON public.link_codes;
CREATE POLICY link_codes_creator_select ON public.link_codes
  FOR SELECT USING (created_by = public.safe_auth_uid());
DROP POLICY IF EXISTS link_codes_creator_insert ON public.link_codes;
CREATE POLICY link_codes_creator_insert ON public.link_codes
  FOR INSERT WITH CHECK (created_by = public.safe_auth_uid());
DROP POLICY IF EXISTS link_codes_creator_update ON public.link_codes;
CREATE POLICY link_codes_creator_update ON public.link_codes
  FOR UPDATE
  USING (created_by = public.safe_auth_uid())
  WITH CHECK (created_by = public.safe_auth_uid());

-- 3c. access_requests: requester sees own; active parents see requests on
-- their child; the linked teen (13+) sees requests on own record. Parent
-- UPDATE (approve/deny, 001) kept. No DELETE (ledger-like; the 020 sweeper
-- is the only deleter, service_role, and it audit-logs first).
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS access_requests_read ON public.access_requests;
CREATE POLICY access_requests_read ON public.access_requests
  FOR SELECT USING (
    -- Requester sees own: spec'd requester_id, plus the 001 email-match arm
    -- for legacy rows.
    public.safe_auth_uid() IS NOT NULL AND (
      requester_id = public.safe_auth_uid()
      OR lower(requester_email) = lower(
           (SELECT u.email FROM public.users u WHERE u.id = public.safe_auth_uid()))
    )
    -- Teen (13+) sees requests on own record. Under-13 children can never
    -- have children.user_id set (under13_bans.sql, Ban 1), so this arm is
    -- inherently 13+.
    OR EXISTS (SELECT 1 FROM public.children c
               WHERE c.id = public.access_requests.child_id
                 AND c.parent_user_id = public.safe_auth_uid())
    -- Parents with effective access see requests on their child.
    -- current_child_ids() (Part 1) drops revoked/expired/lapsed rows, so a
    -- parent loses this read the moment their grant stops being effective.
    OR (child_id = ANY (public.current_child_ids())
        AND EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.user_id = public.safe_auth_uid()
                      AND ca.child_id = public.access_requests.child_id
                      AND ca.role = 'parent'))
  );

DROP POLICY IF EXISTS access_requests_requester_insert ON public.access_requests;
CREATE POLICY access_requests_requester_insert ON public.access_requests
  FOR INSERT WITH CHECK (
    public.safe_auth_uid() IS NOT NULL
    AND lower(requester_email) = lower(
          (SELECT u.email FROM public.users u WHERE u.id = public.safe_auth_uid()))
    AND (requester_id IS NULL OR requester_id = public.safe_auth_uid())
  );

DROP POLICY IF EXISTS access_requests_parent_update ON public.access_requests;
CREATE POLICY access_requests_parent_update ON public.access_requests
  FOR UPDATE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.access_requests.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.access_requests.child_id
                  AND ca.role = 'parent')
  );

-- 3d. access_events: append-only audit (panel §1.3.6, sol-access §3.4).
-- READERS:
--   (1) the linked teen reads every event on own record;
--   (2) a viewer with EFFECTIVE access reads events where they are the
--       subject (their own grant/revoke).
-- There is deliberately NO "parent reads child's full timeline" arm and NO
-- arm for revoked/expired viewers: a revoked parent sees ZERO rows,
-- immediately. WRITES: no INSERT/UPDATE/DELETE policies for authenticated —
-- events are written by the SECURITY DEFINER log_access_event overloads
-- (owner bypass) or service_role. "Nobody except service_role can
-- UPDATE/DELETE" holds by absence of policy (default-deny).
ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS access_events_teen_select ON public.access_events;
CREATE POLICY access_events_teen_select ON public.access_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.children c
            WHERE c.id = public.access_events.child_id
              AND c.parent_user_id = public.safe_auth_uid())
  );
DROP POLICY IF EXISTS access_events_subject_select ON public.access_events;
CREATE POLICY access_events_subject_select ON public.access_events
  FOR SELECT USING (
    subject_user_id = public.safe_auth_uid()
    AND child_id = ANY (public.current_child_ids())
  );

-- 3e. emergency_access_grants: readable ONLY by the teen + service_role.
-- No parent arm exists — not even for non-revoked parents. No
-- INSERT/UPDATE/DELETE policies for authenticated: designation and
-- revocation go through the teen's SECURITY DEFINER RPC / service_role.
ALTER TABLE public.emergency_access_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS emergency_access_grants_teen_select ON public.emergency_access_grants;
CREATE POLICY emergency_access_grants_teen_select ON public.emergency_access_grants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.children c
            WHERE c.id = public.emergency_access_grants.child_id
              AND c.parent_user_id = public.safe_auth_uid())
  );

-- 3f. child_access: keep the 001 policies (member read, parent insert).
-- Effective-access predicates live in current_child_ids() (Part 1), which
-- both policies key off: revoked/expired/lapsed rows are invisible to every
-- read that implies access, and the parent_insert self-check re-enters
-- through RLS, so non-effective parents cannot mint new rows either.
-- Documented so the audit can verify the propagation path.

-- ===========================================================================
-- Part 4 — table grants (RLS policies grant nothing; 001 F2 convention)
-- ===========================================================================
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

REVOKE ALL ON public.link_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.link_codes TO authenticated;

-- access_requests keeps its 001 grants; re-issued idempotently.
GRANT SELECT, INSERT ON public.access_requests TO authenticated;
GRANT UPDATE (status) ON public.access_requests TO authenticated;

-- Append-only: SELECT for the two policy arms; no write grants at all.
REVOKE ALL ON public.access_events FROM anon, authenticated;
GRANT SELECT ON public.access_events TO authenticated;

-- Teen-read-only: SELECT for the teen arm; no write grants at all.
REVOKE ALL ON public.emergency_access_grants FROM anon, authenticated;
GRANT SELECT ON public.emergency_access_grants TO authenticated;

-- ===========================================================================
-- Part 5 — INTEGRATION FIX: log_access_event contract reconciliation
-- ===========================================================================
-- 018/019/020 were written against the sol-access §3.2 call signature
--   log_access_event(child, actor, subject, event, granted_by, reason, dev, ip)
-- but 021 implemented the 7-arg form
--   log_access_event(child, actor, event, subject, reason, metadata, cents).
-- Every grant/revoke/link/request RPC would fail at runtime with
-- "function does not exist". This overload restores the sol-access contract
-- additively (no change to 021's function); backend should adopt one
-- canonical signature afterwards (see BUILD-LOG).
CREATE OR REPLACE FUNCTION public.log_access_event(
  p_child_id      uuid,
  p_actor_user_id uuid,
  p_subject_user_id uuid,
  p_event_type    text,
  p_granted_by    text,
  p_reason_code   text,
  p_device_hash   text,
  p_ip_hash       text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.access_events
    (child_id, actor_user_id, subject_user_id, event_type, granted_by,
     reason_code, device_hash, ip_hash, metadata)
  VALUES
    (p_child_id, p_actor_user_id, p_subject_user_id, p_event_type,
     p_granted_by, p_reason_code,
     COALESCE(p_device_hash, ''), COALESCE(p_ip_hash, ''),
     '{}'::jsonb)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_event(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_access_event(uuid, uuid, uuid, text, text, text, text, text)
  TO authenticated, service_role;

-- The call sites also use event types / reason codes missing from 021's
-- vocabularies; extend both additively (idempotent).
ALTER TABLE public.access_events
  DROP CONSTRAINT IF EXISTS access_events_event_type_check;
ALTER TABLE public.access_events
  ADD CONSTRAINT access_events_event_type_check
  CHECK (event_type IN (
    'grant', 'revoke', 'request', 'block',
    'revoke_initiated', 'revoke_effective', 'revoke_cancelled',
    'cooling_off_started', 'safe_exit', 'request_created', 'request_approved',
    'request_denied', 'block_added', 'block_removed', 'link_code_redeemed',
    'invite_sent', 'invite_accepted', 'scope_changed', 'court_order_applied',
    'court_order_cleared', 'go_independent', 'regrant', 'credentials_paused',
    'support.ticket.viewed', 'support.ticket.assigned',
    'support.grant.requested', 'support.grant.approved', 'support.grant.denied',
    'support.grant.expired', 'support.grant.revoked',
    'support.grant.data_accessed', 'support.internal_note.created',
    'support.consent_card.sent',
    'support.credit.issued', 'support.credit.approval_requested',
    'support.credit.approval_decided',
    'invite_consume_failed'
  ));

INSERT INTO public.access_reason_codes (code, description) VALUES
  ('pending_coapproval', 'Parent grant awaiting teen co-approval (D6)'),
  ('coapproval_granted', 'Teen approved a pending grant (D6)'),
  ('coapproval_declined', 'Teen declined a pending grant (D6)'),
  ('pending_cancelled', 'Pending co-approval cancelled before effect'),
  ('cooling_off_scheduled', '7-day cooling-off scheduled'),
  ('link_code_redeemed', 'Teen linked via link code'),
  ('access_requested', 'Access request created'),
  ('request_expired', 'Access request expired unanswered')
ON CONFLICT (code) DO NOTHING;

-- ===========================================================================
-- Verification (run after the folded migration applies)
-- ===========================================================================
-- 1. Tenancy excludes revoked/expired, keeps unexpired cooling:
--    SELECT public.current_child_ids();  -- per-fixture expectations
-- 2. Revoked parent sees zero audit rows:
--    SELECT count(*) FROM public.access_events;  -- expect 0
-- 3. Teen sees own timeline:
--    (as children.user_id) SELECT count(*) FROM public.access_events
--     WHERE child_id = '<own>';  -- expect full history
-- 4. Non-creator link_codes: SELECT count(*) FROM public.link_codes;
--    -- expect 0 (creator arm only; 019's parent arm is metadata)
-- 5. Parent cannot read emergency_access_grants:
--    SELECT count(*) FROM public.emergency_access_grants;  -- expect 0
-- 6. Profiles isolation: SELECT count(*) FROM public.profiles;  -- expect 1
-- 7. log_access_event 8-arg overload resolves:
--    SELECT public.log_access_event('00000000-0000-0000-0000-000000000001',
--      NULL, NULL, 'grant', 'system', 'system_migration', NULL, NULL);
--    -- expect a uuid (then DELETE the probe row as service_role)
-- 8. Policy inventory:
--    SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
--      AND tablename IN ('profiles','link_codes','access_requests',
--                        'access_events','emergency_access_grants')
--     ORDER BY 1,2;
