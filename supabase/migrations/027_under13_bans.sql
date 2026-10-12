-- Migration 025: under-13 technical guarantees (COPPA, panel §1.1.4)
--
-- These are DATABASE-enforced bans, not app policy. A 13th-birthday check is
-- not something any client, RPC, or future policy edit can bypass: the
-- triggers below fire inside the write path itself, for every role including
-- service_role-driven writes. There is deliberately NO privileged bypass —
-- "no under-13 self-login linkage, ever."
--
-- DOB source: public.children.date_of_birth (live since 001). Fail-closed:
-- NULL or missing DOB is treated as under-13 (a child-role linkage requires
-- PROVEN age ≥ 13). Emancipated/legal_status never overrides: COPPA is
-- federal and status-agnostic (sol-access §10.2 — an "emancipated" under-13
-- is a legal impossibility).
--
-- REQUIRES: 024 (profiles.dob / legal_status assurances used by the
-- access_requests guard). 017–023 may add further columns; nothing here
-- depends on them.
--
-- IDEMPOTENT: CREATE OR REPLACE / DROP TRIGGER IF EXISTS throughout.

-- ---------------------------------------------------------------------------
-- is_minor_13(p_child_id) — shared helper. TRUE = under 13 (or unknown age).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_minor_13(p_child_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
BEGIN
  IF p_child_id IS NULL THEN
    RETURN true;
  END IF;
  SELECT c.date_of_birth INTO v_dob
    FROM public.children c
   WHERE c.id = p_child_id;
  IF NOT FOUND OR v_dob IS NULL THEN
    RETURN true;  -- unknown age fails closed: no child-role linkage
  END IF;
  -- 13th birthday reached (server date; sub-day tz edge is immaterial here).
  RETURN v_dob > (current_date - INTERVAL '13 years')::date;
END;
$$;

REVOKE ALL ON FUNCTION public.is_minor_13(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_minor_13(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ban 1 — child_access: no child-role login linkage for under-13.
-- Fires on INSERT and on UPDATE of role/child_id (covers parent→child
-- promotion attempts). Parent-role rows are unaffected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.child_access_under13_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'child' AND public.is_minor_13(NEW.child_id) THEN
    RAISE EXCEPTION 'under13_child_login_denied';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_child_access_under13 ON public.child_access;
CREATE TRIGGER trg_child_access_under13
  BEFORE INSERT OR UPDATE OF role, child_id ON public.child_access
  FOR EACH ROW EXECUTE FUNCTION public.child_access_under13_guard();

-- ---------------------------------------------------------------------------
-- Ban 2 — link_codes: no link code may target an under-13 child.
-- Link codes are the 13+ self-linking mechanism; under-13s are
-- parent-managed, so issuing one is never legitimate. Covers UPDATE too so
-- a code cannot be retargeted onto an under-13 child after creation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_codes_under13_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_minor_13(NEW.child_id) THEN
    RAISE EXCEPTION 'under13_link_code_denied';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_codes_under13 ON public.link_codes;
CREATE TRIGGER trg_link_codes_under13
  BEFORE INSERT OR UPDATE OF child_id ON public.link_codes
  FOR EACH ROW EXECUTE FUNCTION public.link_codes_under13_guard();

-- ---------------------------------------------------------------------------
-- Ban 3 — access_requests: a requester asserting child-role linkage for an
-- under-13 child is rejected. "Asserting child-role linkage" is defined as:
--   (a) the requester IS the child's linked teen user (self-link claim), or
--   (b) the requester's own profile marks them as a minor — the access model
--       has no minor-grantee role, so a minor requesting on an under-13
--       child's record is necessarily asserting the child role.
-- Adult requesters (grandparents, step-parents, etc.) are NOT affected: their
-- requests proceed to the normal approve/deny flow with an adult grant role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.access_requests_under13_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester  uuid;
  v_child_user uuid;
  v_req_legal  text;
  v_req_dob    date;
BEGIN
  -- Fast path: only under-13 targets are guarded.
  IF NOT public.is_minor_13(NEW.child_id) THEN
    RETURN NEW;
  END IF;

  -- Resolve the requester's identity: spec'd requester_id, else the legacy
  -- email match, else the caller's own JWT.
  v_requester := NEW.requester_id;
  IF v_requester IS NULL THEN
    SELECT u.id INTO v_requester
      FROM public.users u
     WHERE lower(u.email) = lower(NEW.requester_email)
     LIMIT 1;
  END IF;
  IF v_requester IS NULL THEN
    v_requester := public.safe_auth_uid();
  END IF;

  SELECT c.user_id INTO v_child_user
    FROM public.children c
   WHERE c.id = NEW.child_id;

  -- (a) Self-link claim.
  IF v_requester IS NOT NULL AND v_child_user IS NOT NULL
     AND v_requester = v_child_user THEN
    RAISE EXCEPTION 'under13_child_linkage_denied';
  END IF;

  -- (b) Requester is themselves a minor.
  IF v_requester IS NOT NULL THEN
    SELECT p.legal_status, p.dob INTO v_req_legal, v_req_dob
      FROM public.profiles p
     WHERE p.user_id = v_requester;
    IF FOUND AND (
         v_req_legal = 'minor'
         OR (v_req_dob IS NOT NULL
             AND v_req_dob > (current_date - INTERVAL '18 years')::date)
       ) THEN
      RAISE EXCEPTION 'under13_child_linkage_denied';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_access_requests_under13 ON public.access_requests;
CREATE TRIGGER trg_access_requests_under13
  BEFORE INSERT ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.access_requests_under13_guard();

-- ---------------------------------------------------------------------------
-- Ban 4 (defense in depth) — children.date_of_birth corrected downward:
-- the moment the system learns a linked child is under 13, any existing
-- child-role login linkage is severed immediately (it cannot legally
-- persist), and the severance is audit-logged. Blocking the correction
-- itself would punish data hygiene; silent persistence would violate COPPA.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.children_dob_under13_sever()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_severed uuid[];
BEGIN
  IF NEW.date_of_birth IS NOT DISTINCT FROM OLD.date_of_birth THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_minor_13(NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Sever child-role linkage. (Parent rows are untouched.)
  WITH cut AS (
    DELETE FROM public.child_access
     WHERE child_id = NEW.id AND role = 'child'
    RETURNING user_id
  )
  SELECT COALESCE(array_agg(user_id), '{}') INTO v_severed FROM cut;

  -- Audit the severance where the audit table exists (021/024). Sentinel
  -- device/ip hashes: a DB trigger has no HTTP device context.
  IF v_severed <> '{}'
     AND to_regclass('public.access_events') IS NOT NULL THEN
    INSERT INTO public.access_events
      (child_id, actor_user_id, subject_user_id, event_type, reason_code,
       device_hash, ip_hash, metadata)
    SELECT NEW.id, public.safe_auth_uid(), uid, 'revoke_effective',
           'safety_concern', 'system:trigger', 'system:trigger',
           jsonb_build_object('cause', 'dob_corrected_below_13',
                              'old_dob', OLD.date_of_birth,
                              'new_dob', NEW.date_of_birth)
      FROM unnest(v_severed) AS uid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_children_dob_under13_sever ON public.children;
CREATE TRIGGER trg_children_dob_under13_sever
  AFTER UPDATE OF date_of_birth ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_dob_under13_sever();

-- ---------------------------------------------------------------------------
-- Verification (run after applying; each should return the noted result)
-- ---------------------------------------------------------------------------
-- 1. Helper sanity (replace <child_id>):
--    SELECT public.is_minor_13('<child_id>');        -- true iff dob < 13y ago
--    SELECT public.is_minor_13('00000000-0000-0000-0000-000000000000');
--    -- expect: true (unknown child fails closed)
-- 2. Ban 1 — as service_role (no bypass exists):
--    INSERT INTO public.child_access (child_id, user_id, role)
--    VALUES ('<under13_child>', '<user>', 'child');
--    -- expect: ERROR under13_child_login_denied
-- 3. Ban 2:
--    INSERT INTO public.link_codes (child_id, code_hash, created_by)
--    VALUES ('<under13_child>', 'x', '<parent>');
--    -- expect: ERROR under13_link_code_denied
-- 4. Ban 3 — requester whose profiles.legal_status='minor' on under-13:
--    INSERT INTO public.access_requests (child_id, requester_email, requester_id)
--    VALUES ('<under13_child>', 'teen@example.com', '<minor_user>');
--    -- expect: ERROR under13_child_linkage_denied
--    -- (same insert with an adult requester_id succeeds)
-- 5. Grants:
--    SELECT grantee FROM information_schema.routine_privileges
--     WHERE routine_schema='public' AND routine_name='is_minor_13';
--    -- expect: authenticated, service_role (NOT public, NOT anon)
