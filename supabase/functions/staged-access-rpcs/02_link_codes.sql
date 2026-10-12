-- Staged RPCs: link codes (Platform Team 1 Backend).
--
-- Fold into the renumbered migration that owns link_codes (was 019).
-- Depends on: 017 (profiles), 018-table-changes (child_access), canonical
-- 021 (access_events, log_access_event), pgcrypto.

-- ---------------------------------------------------------------------------
-- generate_link_code(p_child_id) -> text
-- Parent-only (active parent of THIS child). 6 digits from the pgcrypto
-- CSPRNG, bcrypt-hashed (gen_salt('bf',10)), 15-minute TTL, single live
-- code per child (superseded unused codes are retired first).
-- Returns the plaintext ONCE — it is never stored or logged.
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

  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'parent' AND ca.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.link_codes
   WHERE child_id = p_child_id AND used_at IS NULL;

  -- 6 digits from the CSPRNG: 6 independent bytes mod 10 (modulo bias is
  -- negligible behind the 5-attempt lockout).
  SELECT string_agg((get_byte(gen_random_bytes(1), 0) % 10)::text, '')
    INTO v_code
    FROM generate_series(1, 6) AS g;
  v_hash := crypt(v_code, gen_salt('bf', 10));

  INSERT INTO public.link_codes (code_hash, child_id, created_by, expires_at)
  VALUES (v_hash, p_child_id, v_caller, now() + INTERVAL '15 minutes');

  PERFORM public.audit_event(p_child_id, 'access.link_code_generated', 'user',
                             'link_codes', p_child_id::text,
                             jsonb_build_object('generated_by', v_caller));
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_link_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_link_code(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- redeem_link_code(p_code, p_coercion_choice) -> uuid (child_id)
--
-- Verifies the bcrypt hash (constant-time compare in pgcrypto), checks
-- expiry / single-use / attempt_count (lockout at 5), enforces the COPPA
-- age gate server-side (under-13 CANNOT link; unknown DOB fails closed),
-- then inserts the caller's role='child' row (granted_by='system' — a
-- verified claim, not a parent grant) and flips their profiles row to
-- legal_status='minor'.
--
-- Anti-coercion: p_coercion_choice ('i_chose_this' | 'i_was_told_to') is
-- recorded from the teen's PRIVATE confirmation screen. A coerced link
-- STILL COMPLETES (never tip off a coercer in the room); the flag lands
-- in access_events (reason 'coerced_link') for the teen's private timeline
-- and follow-up. The parent is never notified of the flag.
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
  v_reason  text := 'teen_choice';
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required';
  END IF;
  IF p_coercion_choice IS NOT NULL
     AND p_coercion_choice NOT IN ('i_chose_this', 'i_was_told_to') THEN
    RAISE EXCEPTION 'invalid_coercion_choice';
  END IF;

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

  IF v_code.attempt_count >= 5 THEN
    RAISE EXCEPTION 'code_locked';
  END IF;
  UPDATE public.link_codes
     SET attempt_count = attempt_count + 1
   WHERE id = v_code.id;

  v_tier := public.child_age_tier(v_code.child_id);
  IF v_tier = 'under13' THEN
    RAISE EXCEPTION 'under13_link_forbidden';
  END IF;
  IF v_tier = 'unknown' THEN
    RAISE EXCEPTION 'age_verification_required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = v_code.child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'child_already_linked';
  END IF;

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

  UPDATE public.profiles
     SET legal_status = 'minor'
   WHERE user_id = v_caller AND legal_status IS DISTINCT FROM 'minor';

  IF p_coercion_choice = 'i_was_told_to' THEN
    v_reason := 'coerced_link';
  END IF;

  PERFORM public.log_access_event(
    v_code.child_id, v_caller, 'link_code_redeemed', v_caller, v_reason);

  PERFORM public.audit_event(v_code.child_id, 'access.link_code_redeemed', 'user',
                             'child_access',
                             v_code.child_id::text || '/' || v_caller::text,
                             jsonb_build_object('coerced',
                               p_coercion_choice = 'i_was_told_to'));
  RETURN v_code.child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_link_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_link_code(text, text) TO authenticated, service_role;
