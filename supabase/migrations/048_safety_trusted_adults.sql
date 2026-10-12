-- Migration 029: trusted adults (Squad 1 Safety Track)
--
-- CONTEXT: sol-safety.md §1 + §4 (G1/G15), FR-SAFETY-001, FR-SAFETY-010.
-- Numbering: the canonical map assigned 022 to this file; the health team
-- shipped 022_health_tiers.sql first, and APPLY_ORDER.md's collision directive
-- renumbers Squad 1 to 026+. This lands at the next free number (029).
--
-- CHANGES:
--   1. public.is_teen_of(uuid): caller holds an active role='child' row on
--      the child (uses safe_auth_uid, 014 convention). RLS helper.
--   2. Overload public.log_access_event(uuid,uuid,uuid,text,text,text,uuid,jsonb):
--      018_access_authority calls log_access_event with 8 positional args
--      (child, actor, subject, event_type, granted_by, reason_code,
--      related_trusted_adult_id, metadata), but 021 landed a 7-arg signature
--      with a different parameter order. This overload maps the 018 call
--      shape onto 021's access_events table (granted_by -> granted_by column,
--      related_trusted_adult_id -> metadata.related_trusted_adult_id).
--      Additive only; 021's function is untouched.
--   3. Extends 021's access_events.event_type CHECK with the safety event
--      types (trusted_adult.*, crisis_alert.*, emergency.*) and adds the
--      matching reason codes. Constraint is dropped/re-added with the full
--      prior list plus the new types (additive).
--   4. trusted_adults table: teen-nominated safety contacts. A trusted adult
--      is a NOTIFICATION TARGET ONLY — designation never grants data access
--      (scope firewall, sol-safety §1). RLS: teen-only CRUD; parents and
--      grantees get no SELECT (even a parent who IS a trusted adult sees
--      nothing of the list).
--   5. trusted_adult_contacts: contact channel values live here, referenced
--      by vault_secret_id (Supabase Vault, same standard as the credential
--      vault in 003). No SELECT policy for authenticated at all — writes and
--      reads go through SECURITY DEFINER RPCs / service_role. Plaintext is
--      never stored in an app table and never logged.
--   6. trusted_adult_verifications: 6-digit link codes. code_hash is bcrypt
--      via pgcrypto crypt() (same as 019 link_codes); 15-minute expiry;
--      5-attempt lockout.
--   7. RPCs: rpc_nominate_trusted_adult (teen, rate-limited 5/day, cap 5
--      active), rpc_verify_trusted_adult (public-safe, anon-executable, same
--      hardening as 016's get_invite_preview), rpc_decline_trusted_adult
--      (informed-decline path, ack version pinned).
--   8. Trigger trusted_adults_strip_on_parent_revoke: when a parent's
--      child_access row becomes 'revoked', their trusted_adults rows are
--      deactivated and stripped of crisis_alert/revoke_guardian roles. A
--      revoked adult can never serve as crisis routing (sol-safety §1.1,
--      FR-SAFETY-013 hard invariant).
--
-- D7 (MD decision, coarse-only location): no location columns anywhere here.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- constraint guards / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS /
-- CREATE OR REPLACE on functions. Safe to re-run.
--
-- GRANT MODEL (015 convention): RLS policies grant nothing new. New EXECUTE
-- surface: rpc_nominate_trusted_adult + rpc_decline_trusted_adult for
-- authenticated (+ service_role); rpc_verify_trusted_adult for anon,
-- authenticated, service_role (public verification page, 016 convention).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Part 1 — is_teen_of() helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teen_of(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id
       AND ca.user_id = public.safe_auth_uid()
       AND ca.role = 'child'
       AND ca.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_teen_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teen_of(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 2 — log_access_event() 8-arg overload (repairs 018's call shape)
-- 018 calls: (child_id, actor, subject, event_type, granted_by, reason_code,
-- related_trusted_adult_id, metadata). Maps onto 021's access_events table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_access_event(
  p_child_id uuid,
  p_actor_user_id uuid,
  p_subject_user_id uuid,
  p_event_type text,
  p_granted_by text,
  p_reason_code text,
  p_related_trusted_adult_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_meta jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_required';
  END IF;
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_required';
  END IF;
  IF p_related_trusted_adult_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object(
      'related_trusted_adult_id', p_related_trusted_adult_id);
  END IF;
  INSERT INTO public.access_events
    (child_id, actor_user_id, subject_user_id, event_type, granted_by,
     reason_code, metadata)
  VALUES
    (p_child_id, p_actor_user_id, p_subject_user_id, p_event_type,
     p_granted_by, p_reason_code, v_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_event(uuid, uuid, uuid, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_access_event(uuid, uuid, uuid, text, text, text, uuid, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 3 — extend 021's event_type CHECK + reason codes (additive)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'access_events_event_type_check') THEN
    ALTER TABLE public.access_events DROP CONSTRAINT access_events_event_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'access_events_event_type_check') THEN
    ALTER TABLE public.access_events
      ADD CONSTRAINT access_events_event_type_check
      CHECK (event_type IN (
        'grant', 'revoke_initiated', 'revoke_effective', 'revoke_cancelled',
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
        -- Safety track (029+): trusted adults, crisis routing, emergency
        'trusted_adult.added', 'trusted_adult.verified',
        'trusted_adult.deactivated', 'trusted_adult.contact_updated',
        'crisis_alert.sent', 'crisis_alert.no_reachable_adult',
        'crisis_alert.declined_path', 'crisis_alert.acknowledged',
        'emergency.break_glass_viewed', 'emergency.medical_updated',
        'emergency.request_submitted', 'emergency.request_decided',
        'grant.coapproval_requested', 'grant.coapproval_decided',
        'grant.expired', 'outing.plan_shared', 'outing.plan_overdue'
      ));
  END IF;
END
$$;

INSERT INTO public.access_reason_codes (code, description) VALUES
  ('trusted_adult_verified', 'Trusted adult confirmed their contact channel'),
  ('trusted_adult_deactivated', 'Teen removed a trusted adult'),
  ('crisis_t1_imminent', 'T1 imminent-risk language detected'),
  ('crisis_t2_ideation', 'T2 crisis-ideation language detected'),
  ('declined_path_ack', 'Teen acknowledged no adult will be alerted'),
  ('breakglass_token_created', 'Teen created a 24h break-glass medical token'),
  ('breakglass_token_redeemed', 'Break-glass medical card viewed via token'),
  ('outing_shared', 'Teen shared an outing plan with a trusted adult'),
  ('dusk_override', 'Teen overrode the dusk guard with adult share')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Part 4 — trusted_adults table
-- A trusted adult is a NOTIFICATION TARGET ONLY. Designation confers zero
-- data access (scope firewall). Teen-controlled visibility: teen-only RLS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trusted_adults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  full_name text,
  relationship text NOT NULL
    CHECK (relationship IN ('parent', 'relative', 'counselor', 'coach',
                            'faith_leader', 'neighbor', 'other')),
  contact_channel text NOT NULL
    CHECK (contact_channel IN ('sms', 'email', 'app_push')),
  contact_masked text NOT NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed')),
  verified_at timestamptz,
  verification_method text
    CHECK (verification_method IN ('link_code', 'same_room', 'parent_vouched')),
  verification_token text UNIQUE,
  roles text[] NOT NULL DEFAULT '{crisis_alert}',
  priority int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  is_parent boolean NOT NULL DEFAULT false,
  parent_user_id uuid REFERENCES auth.users(id),
  teen_note text CHECK (teen_note IS NULL OR char_length(teen_note) <= 140),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_adults_roles_subset
    CHECK (roles <@ ARRAY['crisis_alert', 'revoke_guardian', 'outing_contact']),
  CONSTRAINT trusted_adults_parent_link_consistent
    CHECK ((is_parent AND parent_user_id IS NOT NULL)
        OR (NOT is_parent))
);

CREATE INDEX IF NOT EXISTS trusted_adults_child_idx
  ON public.trusted_adults (child_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS trusted_adults_crisis_routing_idx
  ON public.trusted_adults (child_id, priority)
  WHERE is_active AND verification_status = 'verified';
CREATE INDEX IF NOT EXISTS trusted_adults_verify_token_idx
  ON public.trusted_adults (verification_token) WHERE verification_token IS NOT NULL;

COMMENT ON TABLE public.trusted_adults IS
  'Teen-nominated safety contacts (G1/G15). NOTIFICATION TARGETS ONLY: a row here grants zero data access (scope firewall, sol-safety §1). Teen-visible only — parents and grantees have no SELECT. contact_value plaintext lives in Supabase Vault via trusted_adult_contacts; this table carries only a masked display form.';
COMMENT ON COLUMN public.trusted_adults.roles IS
  'Subset of {crisis_alert, revoke_guardian, outing_contact}. One row may carry several roles.';
COMMENT ON COLUMN public.trusted_adults.is_parent IS
  'True when the adult is a live-grant parent. A revoked parent is stripped by the trusted_adults_strip_on_parent_revoke trigger and can never serve as crisis routing.';

ALTER TABLE public.trusted_adults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trusted_adults_teen_all ON public.trusted_adults;
CREATE POLICY trusted_adults_teen_all ON public.trusted_adults
  FOR ALL TO authenticated
  USING (public.is_teen_of(child_id))
  WITH CHECK (public.is_teen_of(child_id));

-- ---------------------------------------------------------------------------
-- Part 5 — trusted_adult_contacts (Vault-backed, service_role/RPC only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trusted_adult_contacts (
  trusted_adult_id uuid PRIMARY KEY REFERENCES public.trusted_adults(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'app_push')),
  vault_secret_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trusted_adult_contacts IS
  'Contact channel values for trusted adults. Plaintext lives in Supabase Vault (vault_secret_id); the same standard as the credential vault (003). No SELECT policy for authenticated — reads go through SECURITY DEFINER RPCs or service_role (crisis-router Edge Function).';

ALTER TABLE public.trusted_adult_contacts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Part 6 — trusted_adult_verifications (link codes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trusted_adult_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trusted_adult_id uuid NOT NULL REFERENCES public.trusted_adults(id) ON DELETE CASCADE,
  token text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trusted_adult_verifications_token_idx
  ON public.trusted_adult_verifications (token);

COMMENT ON TABLE public.trusted_adult_verifications IS
  '6-digit verification codes for trusted-adult nominations. code_hash is bcrypt via pgcrypto crypt() (same as 019 link_codes) — never plaintext. 15-minute expiry, 5-attempt lockout.';

ALTER TABLE public.trusted_adult_verifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Part 7 — RPCs
-- ---------------------------------------------------------------------------

-- rpc_nominate_trusted_adult: teen nominates an adult. Rate-limited
-- (5/day), capped at 5 active adults. Contact value is encrypted into
-- Supabase Vault server-side; the RPC returns the verification code ONLY
-- to the server caller (never to the browser client) so the server action
-- can dispatch it via SMS/email.
CREATE OR REPLACE FUNCTION public.rpc_nominate_trusted_adult(
  p_child_id uuid,
  p_display_name text,
  p_relationship text,
  p_contact_channel text,
  p_contact_value text,
  p_note text DEFAULT NULL,
  p_roles text[] DEFAULT ARRAY['crisis_alert'],
  p_verification_method text DEFAULT 'link_code',
  p_parent_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_id uuid;
  v_token text;
  v_code text;
  v_masked text;
  v_vault_id uuid;
  v_is_parent boolean := false;
  v_verified boolean := false;
  v_method text := p_verification_method;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;

  IF p_display_name IS NULL OR btrim(p_display_name) = '' THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;
  IF p_contact_value IS NULL OR btrim(p_contact_value) = '' THEN
    RAISE EXCEPTION 'contact_value_required';
  END IF;
  IF NOT (p_roles <@ ARRAY['crisis_alert', 'revoke_guardian', 'outing_contact']) THEN
    RAISE EXCEPTION 'invalid_roles';
  END IF;
  IF p_verification_method NOT IN ('link_code', 'same_room', 'parent_vouched') THEN
    RAISE EXCEPTION 'invalid_verification_method';
  END IF;

  -- Rate limit: at most 5 nominations per teen per rolling day.
  IF (SELECT count(*) FROM public.trusted_adults
       WHERE child_id = p_child_id AND created_at > now() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'nomination_rate_limited';
  END IF;

  -- Cap: 5 active adults (G15 §4.2 — enough for redundancy, small enough to
  -- stay meaningful). Deactivate one before adding another.
  IF (SELECT count(*) FROM public.trusted_adults
       WHERE child_id = p_child_id AND is_active) >= 5 THEN
    RAISE EXCEPTION 'trusted_adult_cap_reached';
  END IF;

  -- Parent-vouched path: the adult must hold a LIVE parent grant. A revoked
  -- parent is never eligible (FR-SAFETY-013 hard invariant).
  IF p_verification_method = 'parent_vouched' THEN
    IF p_parent_user_id IS NULL THEN RAISE EXCEPTION 'parent_user_required'; END IF;
    IF EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = p_child_id AND ca.user_id = p_parent_user_id
                  AND ca.role = 'parent' AND ca.status = 'revoked') THEN
      RAISE EXCEPTION 'revoked_parent_not_eligible';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.child_id = p_child_id AND ca.user_id = p_parent_user_id
                      AND ca.role = 'parent' AND ca.status = 'active') THEN
      RAISE EXCEPTION 'parent_grant_not_active';
    END IF;
    v_is_parent := true;
    v_verified := true;
  END IF;

  -- Masked display form (teen-visible; never the full value).
  IF p_contact_channel = 'sms' THEN
    v_masked := '***-***-' || right(regexp_replace(p_contact_value, '[^0-9]', '', 'g'), 4);
  ELSIF p_contact_channel = 'email' THEN
    v_masked := left(p_contact_value, 1) || '***@' || split_part(p_contact_value, '@', 2);
  ELSE
    v_masked := 'app push';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.trusted_adults
    (child_id, display_name, relationship, contact_channel, contact_masked,
     verification_status, verified_at, verification_method, verification_token,
     roles, priority, is_parent, parent_user_id, teen_note, created_by)
  VALUES
    (p_child_id, btrim(p_display_name), p_relationship, p_contact_channel, v_masked,
     CASE WHEN v_verified THEN 'verified' ELSE 'pending' END,
     CASE WHEN v_verified THEN now() ELSE NULL END,
     v_method, v_token, p_roles,
     COALESCE((SELECT max(priority) FROM public.trusted_adults
                WHERE child_id = p_child_id AND is_active), 0) + 1,
     v_is_parent, CASE WHEN v_is_parent THEN p_parent_user_id ELSE NULL END,
     NULLIF(btrim(COALESCE(p_note, '')), ''), v_caller)
  RETURNING id INTO v_id;

  -- Vault the contact value (Supabase Vault; fails loudly if unavailable).
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE EXCEPTION 'vault_unavailable';
  END IF;
  v_vault_id := vault.create_secret(btrim(p_contact_value), 'trusted_adult_contact:' || v_id::text);

  INSERT INTO public.trusted_adult_contacts (trusted_adult_id, channel, vault_secret_id)
  VALUES (v_id, p_contact_channel, v_vault_id);

  -- Issue the 6-digit code (link_code / same_room). parent_vouched needs none.
  v_code := NULL;
  IF NOT v_verified THEN
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    INSERT INTO public.trusted_adult_verifications
      (trusted_adult_id, token, code_hash, expires_at)
    VALUES
      (v_id, v_token, crypt(v_code, gen_salt('bf')), now() + INTERVAL '15 minutes');
  END IF;

  PERFORM public.log_access_event(
    p_child_id, v_caller, NULL, 'trusted_adult.added', 'child', 'teen_choice',
    v_id,
    jsonb_build_object('roles', p_roles, 'channel', p_contact_channel,
                       'method', v_method));
  PERFORM public.audit_event(p_child_id, 'trusted_adult.nominated', 'user',
                             'trusted_adults', v_id::text,
                             jsonb_build_object('method', v_method));

  RETURN jsonb_build_object(
    'trusted_adult_id', v_id,
    'verification_token', v_token,
    'verification_code', v_code,
    'verification_status', CASE WHEN v_verified THEN 'verified' ELSE 'pending' END);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_nominate_trusted_adult(uuid, text, text, text, text, text, text[], text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_nominate_trusted_adult(uuid, text, text, text, text, text, text[], text, uuid)
  TO authenticated, service_role;

-- rpc_verify_trusted_adult: public-safe code redemption for the /verify-adult
-- page. Unguessable token + 6-digit code; 5-attempt lockout; 15-min expiry.
-- Callable by anon (016 convention). Returns the adult's display name only.
CREATE OR REPLACE FUNCTION public.rpc_verify_trusted_adult(
  p_token text,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ver public.trusted_adult_verifications%ROWTYPE;
  v_adult public.trusted_adults%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN RAISE EXCEPTION 'token_required'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'code_required'; END IF;

  SELECT * INTO v_ver FROM public.trusted_adult_verifications
   WHERE token = p_token AND consumed_at IS NULL
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verification_not_found'; END IF;
  IF v_ver.expires_at <= now() THEN
    UPDATE public.trusted_adults SET verification_status = 'failed'
     WHERE id = v_ver.trusted_adult_id;
    RAISE EXCEPTION 'verification_expired';
  END IF;
  IF v_ver.attempts >= 5 THEN
    UPDATE public.trusted_adults SET verification_status = 'failed'
     WHERE id = v_ver.trusted_adult_id;
    RAISE EXCEPTION 'verification_locked';
  END IF;

  IF v_ver.code_hash <> crypt(btrim(p_code), v_ver.code_hash) THEN
    UPDATE public.trusted_adult_verifications
       SET attempts = attempts + 1 WHERE id = v_ver.id;
    IF v_ver.attempts + 1 >= 5 THEN
      UPDATE public.trusted_adults SET verification_status = 'failed'
       WHERE id = v_ver.trusted_adult_id;
      RAISE EXCEPTION 'verification_locked';
    END IF;
    RAISE EXCEPTION 'verification_code_mismatch';
  END IF;

  UPDATE public.trusted_adult_verifications
     SET consumed_at = now(), attempts = attempts + 1 WHERE id = v_ver.id;
  UPDATE public.trusted_adults
     SET verification_status = 'verified', verified_at = now()
   WHERE id = v_ver.trusted_adult_id
  RETURNING * INTO v_adult;

  PERFORM public.log_access_event(
    v_adult.child_id, NULL, NULL, 'trusted_adult.verified', 'system',
    'trusted_adult_verified', v_adult.id,
    jsonb_build_object('method', v_adult.verification_method));

  RETURN jsonb_build_object(
    'trusted_adult_id', v_adult.id,
    'display_name', v_adult.display_name,
    'verification_status', 'verified');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_verify_trusted_adult(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_verify_trusted_adult(text, text)
  TO anon, authenticated, service_role;

-- rpc_decline_trusted_adult: the informed-decline path (sol-safety §1.5).
-- Records crisis_alert.declined_path with the pinned ack version. The revoke
-- flow may then proceed; crisis routing becomes in-app resources only.
-- p_ack_version must equal 'v1' (the checkbox copy version).
CREATE OR REPLACE FUNCTION public.rpc_decline_trusted_adult(
  p_child_id uuid,
  p_ack_version text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  IF p_ack_version IS DISTINCT FROM 'v1' THEN RAISE EXCEPTION 'ack_version_mismatch'; END IF;

  UPDATE public.child_access
     SET trusted_adult_declined = true
   WHERE child_id = p_child_id AND user_id = v_caller AND role = 'child';

  PERFORM public.log_access_event(
    p_child_id, v_caller, NULL, 'crisis_alert.declined_path', 'child',
    'declined_path_ack', NULL,
    jsonb_build_object('ack_version', 'v1'));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_decline_trusted_adult(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_decline_trusted_adult(uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 8 — strip revoked parents from crisis routing (hard invariant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trusted_adults_strip_on_parent_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'revoked'
     AND NEW.role = 'parent' THEN
    UPDATE public.trusted_adults
       SET is_active = false,
           is_parent = false,
           parent_user_id = NULL,
           roles = array_remove(roles, 'crisis_alert'),
           updated_at = now()
     WHERE child_id = NEW.child_id
       AND parent_user_id = NEW.user_id
       AND is_active;
    UPDATE public.trusted_adults
       SET roles = array_remove(roles, 'revoke_guardian'),
           updated_at = now()
     WHERE child_id = NEW.child_id
       AND parent_user_id = NEW.user_id
       AND 'revoke_guardian' = ANY (roles);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trusted_adults_strip_on_parent_revoke ON public.child_access;
CREATE TRIGGER trusted_adults_strip_on_parent_revoke
AFTER UPDATE OF status ON public.child_access
FOR EACH ROW EXECUTE FUNCTION public.trusted_adults_strip_on_parent_revoke();

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Teen nominates an adult (link_code): expect verification_code in result,
--    row pending, vault secret created, access_events trusted_adult.added.
-- 2. Wrong code x5 -> verification_locked; adult row failed.
-- 3. parent_vouched with a revoked parent's user id -> revoked_parent_not_eligible.
-- 4. Revoking that parent's grant -> trusted_adults row is_active=false,
--    crisis_alert role stripped.
-- 5. 6th active nomination -> trusted_adult_cap_reached.
-- 6. check.sh passes.
