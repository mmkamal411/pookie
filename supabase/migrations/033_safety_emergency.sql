-- Migration 033: Emergency module W19 (Squad 1 Safety Track)
--
-- CONTEXT: sol-safety.md §6, FR-SAFETY-008. Numbering: per APPLY_ORDER.md
-- collision directive (Squad 1 -> 026+).
--
-- POSITIONING (load-bearing): the Emergency module is STORAGE, never a
-- response service. "Pookie is not an emergency service. In an emergency,
-- call 911 first." Every emergency surface carries that banner (client).
--
-- CHANGES:
--   1. emergency_resources: preloaded per-region reference numbers, seeded
--      for Georgia (per-state tables from day one, panel W6 note). Public
--      read (reference data); writes service_role only.
--   2. emergency_medical: the teen's medical card (blood type, allergies,
--      conditions, medications, doctor, insurance ref, action plans).
--      Reachable WITHOUT parental access — it reads the TEEN'S OWN record;
--      parent grants are irrelevant to it (independent-teen rule, §6.3).
--      RLS: teen-only.
--   3. emergency_breakglass_tokens: teen-generated time-boxed QR + code
--      (24h, single-viewer). ER staff scan -> read-only medical card, no
--      login, no Pookie account. Every view is audit-logged.
--   4. rpc_create_breakglass_token (teen) / rpc_redeem_breakglass_token
--      (public-safe, anon-executable, token-gated — 016 convention).
--
-- The 6-digit break-glass code is bcrypt-hashed (pgcrypto crypt(), same as
-- 019 link_codes) — never plaintext.
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. New EXECUTE surface:
-- rpc_create_breakglass_token for authenticated (+ service_role);
-- rpc_redeem_breakglass_token for anon, authenticated, service_role.

-- ---------------------------------------------------------------------------
-- Part 1 — emergency_resources + Georgia seed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  name text NOT NULL,
  number text NOT NULL,
  sms text,
  url text,
  sort int NOT NULL DEFAULT 100,
  verified_at timestamptz,
  verification_note text
);

CREATE INDEX IF NOT EXISTS emergency_resources_region_idx
  ON public.emergency_resources (region_code, sort);

COMMENT ON TABLE public.emergency_resources IS
  'Preloaded emergency reference numbers, per region (per-state tables from day one, panel W6 note). Copy honesty: "Numbers verified [date]. If one does not work, call 911." This module is storage, not a response service.';

INSERT INTO public.emergency_resources
  (region_code, name, number, sms, url, sort, verified_at, verification_note)
VALUES
  ('US-GA', 'Emergency', '911', NULL, NULL, 10,
   '2026-10-12', 'Universal emergency number.'),
  ('US-GA', 'Poison Control', '1-800-222-1222', '1-800-222-1222',
   'https://www.poison.org', 20, '2026-10-12', 'National toll-free line.'),
  ('US-GA', '988 Suicide and Crisis Lifeline', '988', '988',
   'https://988lifeline.org', 30, '2026-10-12', 'Call or text, 24/7.'),
  ('US-GA', 'Georgia Crisis and Access Line (GCAL)', '1-800-715-4225', NULL,
   'https://dbhdd.georgia.gov/gcal', 40, '2026-10-12', 'Georgia statewide crisis line.'),
  ('US-GA', 'Crisis Text Line', '741741', '741741',
   'https://www.crisistextline.org', 50, '2026-10-12', 'Text HOME to 741741.'),
  ('US-GA', 'DFCS child-abuse reporting', '1-855-422-4453', NULL,
   'https://dfcs.georgia.gov', 60, '2026-10-12',
   'G7 mandatory-reporter path. Use if a child is being hurt or is unsafe.'),
  ('US-GA', 'Cobb County Police (non-emergency)', '770-499-3911', NULL,
   'https://www.cobbcounty.gov/police', 70, '2026-10-12',
   'Published by Cobb County Police (cobbcounty.gov). For non-urgent police matters.')
ON CONFLICT DO NOTHING;

ALTER TABLE public.emergency_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_resources_read ON public.emergency_resources;
CREATE POLICY emergency_resources_read ON public.emergency_resources
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Part 2 — emergency_medical (teen's own record; parent-access independent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_medical (
  child_id uuid PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
  blood_type text,
  allergies text[] NOT NULL DEFAULT '{}',
  conditions text,
  medications text,
  doctor_name text,
  doctor_phone text,
  insurance_ref text,
  action_plans jsonb NOT NULL DEFAULT '{}'::jsonb,
  lockscreen_fields text[] NOT NULL DEFAULT '{display_name,emergency_contact,blood_type,allergies}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.emergency_medical IS
  'Break-glass medical info (sol-safety §6.3). INDEPENDENT-TEEN RULE: this reads the teen''s OWN record — parent grants are irrelevant to it, so an independent teen in an ER keeps their medical info reachable. allergies is a hard-block list shared with W28 (never inferred). action_plans holds teen-fillable templates (allergy/asthma/seizure); informational scaffolding, not medical advice. lockscreen_fields is teen-controlled (checkboxes per field).';

ALTER TABLE public.emergency_medical ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_medical_teen_all ON public.emergency_medical;
CREATE POLICY emergency_medical_teen_all ON public.emergency_medical
  FOR ALL TO authenticated
  USING (
    -- Inlined (not public.is_teen_of()): the helper lives in
    -- 048_safety_trusted_adults.sql, which sorts after this file.
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = emergency_medical.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = emergency_medical.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Part 3 — break-glass tokens (24h, single-viewer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_breakglass_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  max_views int NOT NULL DEFAULT 1,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS emergency_breakglass_tokens_child_idx
  ON public.emergency_breakglass_tokens (child_id, expires_at);

COMMENT ON TABLE public.emergency_breakglass_tokens IS
  'Time-boxed break-glass tokens (sol-safety §6.3): teen generates a QR + 6-digit code, valid 24h, single-viewer. ER staff scan for a read-only medical card — no login, no Pookie account. Every view is audit-logged (access_events emergency.break_glass_viewed, teen-visible).';

ALTER TABLE public.emergency_breakglass_tokens ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Part 4 — RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_breakglass_token(
  p_child_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_code text;
  v_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;

  -- One live token per child: revoke any existing live token first.
  UPDATE public.emergency_breakglass_tokens
     SET revoked_at = now()
   WHERE child_id = p_child_id AND revoked_at IS NULL AND expires_at > now();

  v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');

  INSERT INTO public.emergency_breakglass_tokens
    (child_id, token_hash, expires_at)
  VALUES
    (p_child_id, crypt(v_code, gen_salt('bf')), now() + INTERVAL '24 hours')
  RETURNING id INTO v_id;

  PERFORM public.log_access_event(
    p_child_id, v_caller, NULL, 'emergency.medical_updated', 'child',
    'breakglass_token_created', NULL,
    jsonb_build_object('token_id', v_id));

  RETURN jsonb_build_object(
    'token_id', v_id,
    'code', v_code,
    'expires_at', now() + INTERVAL '24 hours',
    'max_views', 1);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_breakglass_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_create_breakglass_token(uuid)
  TO authenticated, service_role;

-- Public-safe redemption: token-gated, no login. Returns the teen's medical
-- card + emergency contact (trusted adult) in read-only form. Single-viewer
-- by default; every view audit-logged.
CREATE OR REPLACE FUNCTION public.rpc_redeem_breakglass_token(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok public.emergency_breakglass_tokens%ROWTYPE;
  v_med public.emergency_medical%ROWTYPE;
  v_child public.children%ROWTYPE;
  v_contact jsonb;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'code_required'; END IF;

  SELECT * INTO v_tok FROM public.emergency_breakglass_tokens
   WHERE revoked_at IS NULL AND expires_at > now() AND views < max_views
     AND token_hash = crypt(btrim(p_code), token_hash)
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  UPDATE public.emergency_breakglass_tokens
     SET views = views + 1 WHERE id = v_tok.id;

  SELECT * INTO v_child FROM public.children WHERE id = v_tok.child_id;
  SELECT * INTO v_med FROM public.emergency_medical WHERE child_id = v_tok.child_id;

  SELECT jsonb_build_object(
           'display_name', ta.display_name,
           'relationship', ta.relationship,
           'contact_masked', ta.contact_masked,
           'teen_note', ta.teen_note)
    INTO v_contact
    FROM public.trusted_adults ta
   WHERE ta.child_id = v_tok.child_id
     AND ta.is_active AND ta.verification_status = 'verified'
   ORDER BY ta.priority LIMIT 1;

  PERFORM public.log_access_event(
    v_tok.child_id, NULL, NULL, 'emergency.break_glass_viewed', 'system',
    'breakglass_token_redeemed', NULL,
    jsonb_build_object('token_id', v_tok.id, 'views', v_tok.views + 1));

  RETURN jsonb_build_object(
    'name', v_child.first_name,
    'blood_type', v_med.blood_type,
    'allergies', COALESCE(v_med.allergies, '{}'),
    'conditions', v_med.conditions,
    'medications', v_med.medications,
    'doctor_name', v_med.doctor_name,
    'doctor_phone', v_med.doctor_phone,
    'action_plans', COALESCE(v_med.action_plans, '{}'::jsonb),
    'emergency_contact', v_contact);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_redeem_breakglass_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_breakglass_token(text)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Teen creates token -> 6-digit code returned once; second create revokes
--    the first.
-- 2. Redeem with the code (anon) -> medical card JSON; second redeem ->
--    invalid_or_expired_token (single-viewer).
-- 3. Redeem after 24h -> invalid_or_expired_token.
-- 4. access_events has emergency.break_glass_viewed (teen-visible).
-- 5. check.sh passes.
