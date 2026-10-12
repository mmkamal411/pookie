-- Migration 019: link codes (same-room teen linking)
--
-- CONTEXT: spec §5 — a parent generates a 6-digit code in-app (15-minute
-- expiry, single use); the teen enters it on their own device during signup
-- to link their login to their child profile. Faster than email, no inbox
-- round-trip.
--
-- CHANGES:
--   1. link_codes: id PK, code_hash (bcrypt via pgcrypto crypt(); NEVER
--      plaintext), child_id, created_by, expires_at (15-min TTL),
--      used_at/used_by, attempt_count (lockout at 5).
--   2. Partial unique index: ONE live (unused) code per child.
--   3. RPCs (SECURITY DEFINER, SET search_path=public, fail closed):
--        generate_link_code(p_child_id) -> text (parent-only; returns the
--          plaintext code ONCE — it is never stored or logged)
--        redeem_link_code(p_code, p_coercion_choice DEFAULT NULL) -> uuid
--          (verifies hash, expiry, single-use, attempt lockout; links the
--          caller as role='child'; records the anti-coercion confirmation
--          passed by the caller: 'i_chose_this' | 'i_was_told_to')
--   4. RLS: SELECT for parent members (metadata; the hash is bcrypt and
--      useless without the code). NO write policies — all writes via RPCs.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- CREATE INDEX IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE.
-- GRANT MODEL: SELECT for authenticated (parent members via policy); EXECUTE
-- on the two RPCs for authenticated + service_role.

-- ---------------------------------------------------------------------------
-- Part 1 — table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.link_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash     text NOT NULL,  -- crypt(code, gen_salt('bf',10)); NEVER plaintext
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + INTERVAL '15 minutes',
  used_at       timestamptz,
  used_by       uuid REFERENCES auth.users(id),
  attempt_count integer NOT NULL DEFAULT 0
);

-- One live (unused) code per child. generate_link_code() deletes superseded
-- unused codes before inserting, so this never blocks legitimate rotation.
CREATE UNIQUE INDEX IF NOT EXISTS link_codes_one_live_per_child
  ON public.link_codes (child_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS link_codes_child_expiry_idx
  ON public.link_codes (child_id, expires_at);

COMMENT ON TABLE public.link_codes IS
  'Same-room teen-linking codes. The plaintext 6-digit code exists ONLY in the generating parent''s session at creation time — code_hash is bcrypt, attempts lock out at 5, codes die after 15 minutes and are single-use.';
COMMENT ON COLUMN public.link_codes.code_hash IS
  'bcrypt hash of the 6-digit code (pgcrypto crypt/gen_salt). The plaintext is NEVER stored.';

-- ---------------------------------------------------------------------------
-- Part 2 — RLS: parent members may read metadata; no client writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS link_codes_parent_read ON public.link_codes;
CREATE POLICY link_codes_parent_read ON public.link_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
             WHERE ca.child_id = public.link_codes.child_id
               AND ca.user_id = auth.uid()
               AND ca.role = 'parent'
               AND ca.status = 'active')
  );
-- No INSERT/UPDATE/DELETE policies: default-deny. RPCs are SECURITY DEFINER.

REVOKE ALL ON public.link_codes FROM PUBLIC, anon;
GRANT SELECT ON public.link_codes TO authenticated;

-- ---------------------------------------------------------------------------
-- Part 3 — generate_link_code(p_child_id)
-- Parent-only. 6 digits from pgcrypto CSPRNG, bcrypt-hashed, 15-min TTL.
-- Returns the plaintext ONCE; the caller must display it, never log it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_link_code(p_child_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_code   text;
  v_hash   text;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  -- Parent-only: an active parent member of THIS child.
  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'parent' AND ca.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Single live code invariant: retire superseded unused codes first.
  DELETE FROM public.link_codes
   WHERE child_id = p_child_id AND used_at IS NULL;

  -- 6 digits, uniform over 100000–999999, from the CSPRNG.
  v_code := ((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint
              % 900000) + 100000)::text;
  v_hash := crypt(v_code, gen_salt('bf', 10));

  INSERT INTO public.link_codes (code_hash, child_id, created_by, expires_at)
  VALUES (v_hash, p_child_id, v_caller, now() + INTERVAL '15 minutes');

  PERFORM public.audit_event(p_child_id, 'access.link_code_generated', 'user',
                             'link_codes', p_child_id::text,
                             jsonb_build_object('generated_by', v_caller));
  -- The plaintext is returned, never stored. Do not log v_code.
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_link_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_link_code(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — redeem_link_code(p_code, p_coercion_choice)
-- Verifies the bcrypt hash (constant-time compare inside pgcrypto), checks
-- expiry/single-use/attempt_count (lockout at 5), enforces the COPPA age
-- gate (under-13 CANNOT link, server-side), then inserts the caller's
-- role='child' row (granted_by='system' — the link is a verified claim, not
-- a parent grant).
--
-- Anti-coercion: p_coercion_choice is recorded by the CALLER from the
-- teen's private confirmation screen ('i_chose_this' | 'i_was_told_to').
-- A coerced link STILL COMPLETES (never tip off a coercer in the room);
-- the flag lands in access_events (reason 'coerced_link') for the teen's
-- private timeline and follow-up. The parent is never notified of the flag.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_link_code(
  p_code             text,
  p_coercion_choice  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  uuid := public.safe_auth_uid();
  v_code    public.link_codes%ROWTYPE;
  v_tier    text;
  v_coerced boolean := false;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required';
  END IF;
  IF p_coercion_choice IS NOT NULL
     AND p_coercion_choice NOT IN ('i_chose_this', 'i_was_told_to') THEN
    RAISE EXCEPTION 'invalid_coercion_choice';
  END IF;

  -- Candidate: live, unexpired, hash matches. pgcrypto's crypt() compare is
  -- constant-time; the table is tiny so the scan is acceptable.
  SELECT * INTO v_code FROM public.link_codes
   WHERE used_at IS NULL
     AND expires_at > now()
     AND crypt(p_code, code_hash) = code_hash
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'code_invalid_or_expired';
  END IF;

  -- Brute-force lockout at 5 attempts (recorded on the code row).
  IF v_code.attempt_count >= 5 THEN
    RAISE EXCEPTION 'code_locked';
  END IF;
  UPDATE public.link_codes
     SET attempt_count = attempt_count + 1
   WHERE id = v_code.id;

  -- COPPA age gate: server-side, not policy. Under-13s cannot link, period.
  v_tier := public.child_age_tier(v_code.child_id);
  IF v_tier = 'under13' THEN
    RAISE EXCEPTION 'under13_link_forbidden';
  END IF;
  IF v_tier = 'unknown' THEN
    RAISE EXCEPTION 'age_verification_required';
  END IF;

  -- One teen login per child, globally.
  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = v_code.child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'child_already_linked';
  END IF;

  -- Mark used BEFORE linking (single-use even if the insert below fails).
  UPDATE public.link_codes
     SET used_at = now(), used_by = v_caller
   WHERE id = v_code.id;

  BEGIN
    INSERT INTO public.child_access
      (child_id, user_id, role, granted_by, granted_by_user_id, status)
    VALUES
      (v_code.child_id, v_caller, 'child', 'system', NULL, 'active');
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_linked';
  END;

  -- The teen's own profiles row becomes minor-status at link time.
  UPDATE public.profiles
     SET legal_status = 'minor'
   WHERE user_id = v_caller AND legal_status IS DISTINCT FROM 'minor';

  v_coerced := (p_coercion_choice = 'i_was_told_to');

  PERFORM public.log_access_event(
    v_code.child_id, v_caller, v_caller, 'grant', 'system',
    CASE WHEN v_coerced THEN 'coerced_link' ELSE 'link_code_redeemed' END,
    NULL, NULL);

  PERFORM public.audit_event(v_code.child_id, 'access.link_code_redeemed', 'user',
                             'child_access',
                             v_code.child_id::text || '/' || v_caller::text,
                             jsonb_build_object('coerced', v_coerced));
  RETURN v_code.child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_link_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_link_code(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Hash never plaintext: SELECT code_hash FROM link_codes LIMIT 1;
--    -- expect $2a$10$... (bcrypt), never 6 digits
-- 2. Single live code: SELECT public.generate_link_code('<child>'); twice;
--    SELECT count(*) FROM link_codes WHERE child_id='<child>' AND used_at IS NULL;
--    -- expect 1
-- 3. Wrong code 5x -> 6th redeem raises code_locked; correct code after expiry
--    raises code_invalid_or_expired.
-- 4. Redeem as teen: child_access gains (child, caller, 'child', granted_by='system').
-- 5. Under-13 child: redeem raises under13_link_forbidden (server-side, not RLS).
