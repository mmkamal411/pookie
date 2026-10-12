-- Migration 024: RLS foundation for access-control tables (Security Engineer)
--
-- CONTEXT: Backend Developer's 017–023 (profiles, link_codes, access_requests
-- amendments, access_events, emergency_access_grants, child_access.status /
-- expires_at) had not landed when this was written. Per the Managing Director
-- directive (2026-10-12, NO PLACEHOLDERS), every policy below is a complete,
-- enforcing implementation built against the spec'd interfaces:
--   * locked spec USER-FIRST-ACCESS-MODEL-SPEC.md §8 (profiles, access_requests)
--   * docs/solutions/sol-access.md §3.1 (access_events), §5.1 (link_codes),
--     §7.2 (access_requests), §10 (profiles dob / legal_status)
-- Part 0 creates any missing tables/columns idempotently (IF NOT EXISTS), so
-- this migration is complete standalone AND converges when 017–023 land.
--
-- *** INTEGRATION POINT (Backend Developer / DevOps): ***
-- 017–023 MUST use CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- DROP POLICY IF EXISTS for every object defined here (profiles, link_codes,
-- access_events, access_reason_codes, emergency_access_grants,
-- child_access.status, child_access.expires_at, access_requests.requester_id,
-- and the policies below). Otherwise the second writer errors on apply.
-- Reconciliation checklist lives in docs/BUILD-LOG.md (2026-10-12 entry).
--
-- CONVENTIONS: public.safe_auth_uid() everywhere (014 — fail-closed on
-- non-UUID subs). Mutations on access-control tables go through SECURITY
-- DEFINER RPCs; authenticated gets SELECT-only table grants where a direct
-- read path exists, and NO INSERT/UPDATE/DELETE policies where the RPC-only
-- rule applies (default-deny). service_role bypasses RLS natively.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE throughout.
-- Safe to re-run.
--
-- ===========================================================================
-- Part 0 — schema assurances (spec'd interfaces; no-op if 017–023 landed)
-- ===========================================================================

-- 0a. child_access: status + expiry (spec: sol-access §1.1, kickoff scope).
-- Existing rows backfill to 'active' via the column default (NOT NULL).
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','pending_cooling','revoked','suspended_court'));
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS child_access_status_idx
  ON public.child_access (child_id, status) WHERE status = 'active';

-- 0b. profiles (locked spec §8: user_id PK → auth.users, display_name,
-- onboarding_completed, created_at; sol-access §10: dob, dob_verified,
-- legal_status). Plain text + CHECK (not an enum) so either writer's
-- follow-up ALTER ... ADD COLUMN IF NOT EXISTS converges.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  dob                  date,
  dob_verified         boolean NOT NULL DEFAULT false,
  legal_status         text NOT NULL DEFAULT 'adult'
                       CHECK (legal_status IN ('minor','emancipated','adult')),
  created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_status text NOT NULL DEFAULT 'adult'
  CHECK (legal_status IN ('minor','emancipated','adult'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 0c. link_codes (sol-access §5.1). Plaintext code is NEVER stored —
-- only the bcrypt hash. Redemption is SECURITY DEFINER RPC only.
CREATE TABLE IF NOT EXISTS public.link_codes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id              uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  code_hash             text NOT NULL,
  created_by            uuid NOT NULL REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at               timestamptz,
  used_by               uuid REFERENCES auth.users(id),
  generator_device_hash text NOT NULL DEFAULT '',
  invalidated           boolean NOT NULL DEFAULT false,
  UNIQUE (child_id, code_hash)
);
CREATE INDEX IF NOT EXISTS link_codes_child_id_idx ON public.link_codes (child_id);
CREATE INDEX IF NOT EXISTS link_codes_created_by_idx ON public.link_codes (created_by);

-- 0d. access_events + reason codes (sol-access §3.1, panel §1.3.6).
-- Append-only by policy design (Part 3): no UPDATE/DELETE policies, ever.
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

CREATE TABLE IF NOT EXISTS public.access_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  actor_user_id   uuid REFERENCES auth.users(id),
  subject_user_id uuid REFERENCES auth.users(id),
  event_type      text NOT NULL CHECK (event_type IN (
    'grant','revoke_initiated','revoke_effective','revoke_cancelled',
    'cooling_off_started','safe_exit','request_created','request_approved',
    'request_denied','block_added','block_removed','link_code_redeemed',
    'invite_sent','invite_accepted','scope_changed','court_order_applied',
    'court_order_cleared','go_independent','regrant','credentials_paused')),
  granted_by      text CHECK (granted_by IN ('child','parent','system')),
  reason_code     text REFERENCES public.access_reason_codes(code),
  notify_mode     text CHECK (notify_mode IN ('at_effect','immediate','suppressed')),
  safe_exit       boolean NOT NULL DEFAULT false,
  device_hash     text NOT NULL DEFAULT '',
  ip_hash         text NOT NULL DEFAULT '',
  same_device     boolean,
  coerced_flag    boolean NOT NULL DEFAULT false,
  metadata        jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS access_events_child_time_idx
  ON public.access_events (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_events_subject_idx
  ON public.access_events (subject_user_id);

-- 0e. emergency_access_grants — *** INTERFACE DEFINED HERE (Security
-- Engineer, 024). *** The kickoff scope named this table for 017–023 but no
-- spec'd schema exists in BUILD-SPECIFICATION.md or sol-access.md, and the
-- MD directive forbids placeholder policies. Semantics (per brief): the teen
-- designates trusted adults for emergency break-glass access; readable ONLY
-- by the teen + service_role — never by parents (even non-revoked ones), so
-- a parent can neither discover nor pressure the teen's trusted adult.
-- Backend: adopt this schema or reconcile before landing 017–023.
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

-- 0f. access_requests.requester_id (locked spec §8 / sol-access §7.2).
-- The 001 table carries requester_email; the spec'd interface adds the
-- auth-identity column. Both are honored by the policies below.
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS requester_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS access_requests_requester_idx
  ON public.access_requests (requester_id);

-- ===========================================================================
-- Part 1 — tenancy gate: current_child_ids() enforces active + unexpired
-- ===========================================================================
-- This is THE single funnel every tenant-table SELECT policy keys off
-- (children, child_access, invites, access_requests, study_plans, 007/008
-- household helpers, audit_event). Adding the status/expiry predicate HERE
-- makes revoked/expired rows invisible everywhere, immediately — including
-- to already-written policies. Also swaps auth.uid() → safe_auth_uid()
-- (014 convention): a non-UUID sub now yields '{}' instead of raising.
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
          AND ca.status = 'active'
          AND (ca.expires_at IS NULL OR ca.expires_at > now())
      ), '{}')
  END
$$;

-- ===========================================================================
-- Part 2 — harden in-tree membership checks for the status/expiry world
-- ===========================================================================
-- 001/015 were written before soft-revoke existed (revocation = DELETE).
-- Once status='revoked' rows are retained, every "is a parent" check must
-- exclude them, or a revoked parent keeps invite-minting, child-creating and
-- member-revoking power. These CREATE OR REPLACE updates are fail-closed and
-- change nothing while no revoked/expired rows exist.

-- 2a. invites_before_write(): revoked/expired parents cannot mint invites.
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
      -- 024 HARDENING: membership must be ACTIVE and unexpired. (015 checked
      -- role='parent' only; a soft-revoked parent would still pass.)
      IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                     WHERE ca.user_id = v_caller
                       AND ca.child_id = NEW.child_id
                       AND ca.role = 'parent'
                       AND ca.status = 'active'
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

-- 2b. create_child(): revoked/expired parents cannot create child tenants.
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
...[truncated 16210 chars]