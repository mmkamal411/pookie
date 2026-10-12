-- Migration 030: crisis protocol tables + D6 time-boxed grant tiers (Squad 1)
--
-- CONTEXT: sol-safety.md §1.4 + §2.6 (G1/G2), FR-SAFETY-002; MD decision D6
-- (time-boxed grants: tiered caps 8/30d trusted vs 2/30d new, teen
-- co-approval for new grantees, installment detection), FR-ACCESS-011.
-- Numbering: per APPLY_ORDER.md collision directive (Squad 1 -> 026+), this
-- lands at 030. It also satisfies 018's forward reference: "timeboxed-grant
-- columns (expires_at, grant_kind, grant_purpose) land in 023, which
-- re-defines this function to reset them on re-grant" — 023 was taken by the
-- health team, so the columns and the grant_access redefinition land here.
--
-- CHANGES:
--   1. crisis_rulesets: versioned detection/routing rulesets. The active
--      ruleset version is pinned on every crisis_events/crisis_alerts row so
--      routing decisions are reproducible. Seed: v1 (T1/T2/T3 per §1.4).
--      Detection itself lives in server-side surfaces (mood pulse, check-ins,
--      tutor Worker safety middleware) — never client-side. This table pins
--      the ROUTING contract, not the classifier.
--   2. crisis_events: detection events (teen-readable audit). RLS: teen
--      SELECT own; writes service_role only (Edge Function).
--   3. crisis_alerts: outbound trusted-adult alert audit (delivery status,
--      ack). RLS: teen SELECT own; writes service_role only.
--   4. grant_ledger: append-only issuance history per (child, grantee) —
--      the D6 cap/trust-tier source of truth. RLS: teen SELECT own;
--      service_role writes (via RPCs).
--   5. child_access.expires_at / grant_kind / grant_purpose (time-boxed
--      grants); status CHECK widened with 'pending_coapproval' (020's
--      spelling) and 'expired'.
--   6. grant_access() redefined: 018's full authority model preserved, plus
--      optional (p_expires_at, p_grant_kind, p_purpose). D6 enforcement:
--      rolling-30d caps (8 trusted / 2 new), new-grantee + parent caller ->
--      status 'pending_coapproval' (teen activates via rpc_approve_grant),
--      installment-evasion flagging, ledger write on every issuance,
--      timeboxed columns reset on re-grant (018's note).
--   7. revoke_access() extended: 'pending_cooling'/'pending_coapproval' rows
--      are cancellable via the same matrix.
--   8. rpc_approve_grant / rpc_reject_grant (teen-only co-approval decision).
--   9. expire_timeboxed_grants() (service_role cron): flips elapsed
--      timeboxed grants to 'expired'.
--
-- D7 (MD decision, coarse-only location): no lat/lng columns anywhere.
-- Break-glass location scope is coarse city/ZIP by construction (036).
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. New EXECUTE surface:
-- rpc_approve_grant, rpc_reject_grant for authenticated (+ service_role);
-- expire_timeboxed_grants for service_role only. grant_access keeps its
-- 018 grants (authenticated, service_role).

-- ---------------------------------------------------------------------------
-- Part 1 — crisis_rulesets (versioned routing contract) + v1 seed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crisis_rulesets (
  version text PRIMARY KEY,
  rules_json jsonb NOT NULL,
  active_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crisis_rulesets IS
  'Versioned crisis-routing rulesets (T1/T2/T3). The active version is pinned on every crisis_events/crisis_alerts row so routing decisions are reproducible. Detection lives in server-side surfaces (never client-side); this table pins the ROUTING contract: who gets alerted, how fast, with what copy.';

INSERT INTO public.crisis_rulesets (version, rules_json, active_from) VALUES
('v1', '{
  "tiers": {
    "T1": {
      "name": "imminent-risk language",
      "signals": ["explicit plan, means, or timeline for self-harm or harm to others"],
      "route": "trusted_adult_sms_immediate",
      "teen_card": ["988", "crisis_text_line", "call_911", "grounding_offer"],
      "realert_minutes": 15,
      "staff_evaluation": "mandatory_reporter_program_dfcs_path"
    },
    "T2": {
      "name": "crisis-ideation language",
      "signals": ["I want to die", "I cannot do this anymore", "self-harm mention without plan"],
      "route": "trusted_adult_sms_within_5min",
      "teen_card": ["988", "crisis_text_line", "tell_trusted_adult_action"],
      "realert_minutes": 0
    },
    "T3": {
      "name": "pattern signals",
      "signals": ["mood pulse 1-2 for >=5 of last 7 days", "escalating negative sentiment", "check-in streak of despair language"],
      "route": "teen_nudge_only",
      "external_alert": false,
      "note": "T3 never leaves the teen account. Never parent-visible, including aggregates."
    }
  },
  "alert_copy_sms": "Pookie safety alert for {teen_first_name}: they may be in crisis. Please check on them now. If you believe they are in immediate danger, call 911. US: call/text 988 anytime. This is an automated alert. Reply STOP to opt out of future alerts.",
  "routing_rules": [
    "Alerts route to the teen-designated trusted adult, never to a revoked parent.",
    "No parent notification unless the parent IS the designated trusted adult with a live grant.",
    "Alert content is presence-only. No mood text, check-in content, or chat excerpts.",
    "SMS failure falls back to email, then to the secondary trusted adult, then to in-app escalation. Never falls back to a parent.",
    "We do not promise secrecy the AI cannot keep; the teen is told when an alert fires (T1)."
  ]
}'::jsonb, now())
ON CONFLICT (version) DO NOTHING;

ALTER TABLE public.crisis_rulesets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crisis_rulesets_read ON public.crisis_rulesets;
CREATE POLICY crisis_rulesets_read ON public.crisis_rulesets
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Part 2 — crisis_events (detection audit, teen-readable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crisis_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('T1', 'T2', 'T3')),
  ruleset_version text NOT NULL REFERENCES public.crisis_rulesets(version),
  source text NOT NULL
    CHECK (source IN ('mood_pulse', 'checkin', 'ai_chat')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  inapp_card_shown_at timestamptz,
  -- FK to trusted_adults is added in 049_safety_trusted_adult_fks.sql: the
  -- trusted_adults table lands in 048, which sorts after this file, and the
  -- referenced table must exist at CREATE TABLE time.
  trusted_adult_id uuid,
  alert_sent_at timestamptz,
  teen_action_taken text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crisis_events_child_idx
  ON public.crisis_events (child_id, detected_at DESC);

COMMENT ON TABLE public.crisis_events IS
  'Crisis detection events (L3/L4). Teen-readable audit: the teen can see that a detection fired and what routing followed. Writes are service_role only (crisis-router Edge Function). T3 rows are teen-nudge only — no external alert ever.';

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crisis_events_teen_read ON public.crisis_events;
CREATE POLICY crisis_events_teen_read ON public.crisis_events
  FOR SELECT TO authenticated
  USING (
    -- Inlined (not public.is_teen_of()): the helper lives in
    -- 048_safety_trusted_adults.sql, which sorts after this file, and policy
    -- expressions are validated at CREATE POLICY time.
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = crisis_events.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Part 3 — crisis_alerts (outbound alert audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crisis_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('T1', 'T2')),
  ruleset_version text NOT NULL REFERENCES public.crisis_rulesets(version),
  detection_source text NOT NULL,
  -- FK to trusted_adults is added in 049_safety_trusted_adult_fks.sql (see note above).
  trusted_adult_id uuid,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'undelivered', 'failed')),
  ack_at timestamptz,
  teen_inapp_card_shown boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crisis_alerts_child_idx
  ON public.crisis_alerts (child_id, sent_at DESC);

COMMENT ON TABLE public.crisis_alerts IS
  'Outbound trusted-adult alert audit. Presence-only alerts (no content). Writes are service_role only (crisis-router Edge Function). There is no client-callable send path — rpc_send_crisis_alert does not exist by design.';

ALTER TABLE public.crisis_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crisis_alerts_teen_read ON public.crisis_alerts;
CREATE POLICY crisis_alerts_teen_read ON public.crisis_alerts
  FOR SELECT TO authenticated
  USING (
    -- Inlined (not public.is_teen_of()): the helper lives in
    -- 048_safety_trusted_adults.sql, which sorts after this file.
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = crisis_alerts.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Part 4 — grant_ledger (D6 trust-tier / cap source of truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grant_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  grantee_user_id uuid NOT NULL REFERENCES auth.users(id),
  granter_user_id uuid REFERENCES auth.users(id),
  granted_by text NOT NULL CHECK (granted_by IN ('child', 'parent', 'system')),
  grant_kind text NOT NULL DEFAULT 'permanent'
    CHECK (grant_kind IN ('permanent', 'timeboxed')),
  purpose text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'pending_coapproval', 'rejected')),
  teen_approved_at timestamptz,
  installment_suspect boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS grant_ledger_grantee_window_idx
  ON public.grant_ledger (child_id, grantee_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS grant_ledger_status_idx
  ON public.grant_ledger (status) WHERE status = 'pending_coapproval';

COMMENT ON TABLE public.grant_ledger IS
  'Append-only issuance history per (child, grantee). D6 trust tier is DERIVED from this table: a grantee is "trusted" when they hold prior good-standing rows (active/expired); everyone else is "new". Caps: 8 issuances per rolling 30d for trusted grantees, 2 for new grantees. installment_suspect flags cap-evasion patterns (re-grant within 24h of expiry) for review.';

ALTER TABLE public.grant_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_ledger_teen_read ON public.grant_ledger;
CREATE POLICY grant_ledger_teen_read ON public.grant_ledger
  FOR SELECT TO authenticated
  USING (
    -- Inlined (not public.is_teen_of()): the helper lives in
    -- 048_safety_trusted_adults.sql, which sorts after this file.
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = grant_ledger.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Part 5 — child_access timeboxed columns + widened status
-- ---------------------------------------------------------------------------
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS grant_kind text NOT NULL DEFAULT 'permanent'
  CHECK (grant_kind IN ('permanent', 'timeboxed'));
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS grant_purpose text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'child_access_status_check') THEN
    ALTER TABLE public.child_access DROP CONSTRAINT child_access_status_check;
  END IF;
  ALTER TABLE public.child_access
    ADD CONSTRAINT child_access_status_check
    CHECK (status IN ('active', 'pending_cooling', 'revoked', 'suspended_court',
                      'scheduled_revoke', 'pending_coapproval', 'expired'));
END
$$;

COMMENT ON COLUMN public.child_access.expires_at IS
  'Time-boxed grant expiry (D6/FR-ACCESS-011). NULL = permanent. Elapsed rows are flipped to status=expired by expire_timeboxed_grants().';
COMMENT ON COLUMN public.child_access.grant_kind IS
  'permanent | timeboxed. Timeboxed grants are occasion-based (D6) and never carry reflection/wellness scopes at the RPC layer.';

-- ---------------------------------------------------------------------------
-- Part 6 — grant_access() redefined (018 authority model + D6 tiers)
--
-- Preserves 018's authority checks verbatim (fail-closed order), adds:
--   p_expires_at / p_grant_kind / p_purpose (defaults = permanent grant;
--     existing 3-arg callers like 020's decide_access_request are unaffected).
--   D6 tiered caps: 8 issuances / rolling 30d for trusted grantees
--     (prior good-standing grant), 2 / 30d for new grantees.
--   New grantee + parent caller -> status 'pending_coapproval'; the grant
--     activates only after the teen approves (rpc_approve_grant). A teen
--     caller granting a new grantee activates immediately (their own choice).
--   Installment detection: a re-grant within 24h of the prior grant's
--     expiry is flagged installment_suspect on the ledger row (Round 2).
--   Re-grant of a revoked row resets expires_at/grant_kind/grant_purpose
--     (018's forward note) and writes a fresh ledger row.
-- Timeboxed grants REJECT reflection/wellness scopes at seed time: the
-- access_scopes trigger seeds per the row; this function zeroes the
-- non-operational scopes for timeboxed grants after insert.
-- ---------------------------------------------------------------------------
-- Replace (not overload) 018's 3-arg grant_access: the old signature is
-- dropped so 2-/3-arg callers (e.g. 020's decide_access_request) resolve to
-- the D6-enforcing version below. This is the redefinition 018's header
-- anticipates ("re-defines this function to reset them on re-grant").
DROP FUNCTION IF EXISTS public.grant_access(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.grant_access(
  p_child_id uuid,
  p_user_id  uuid,
  p_role     text DEFAULT 'parent',
  p_expires_at timestamptz DEFAULT NULL,
  p_grant_kind text DEFAULT 'permanent',
  p_purpose  text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := public.safe_auth_uid();
  v_tier        text;
  v_is_teen     boolean := false;
  v_is_parent   boolean := false;
  v_granted_by  text;
  v_row         public.child_access%ROWTYPE;
  v_regranted   boolean := false;
  v_new_status  text := 'active';
  v_trusted     boolean := false;
  v_window_cnt  integer := 0;
  v_cap         integer;
  v_suspect     boolean := false;
  v_ledger_id   uuid;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_user_id  IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_role IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION 'unsupported_grant_role';
  END IF;
  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'cannot_grant_self';
  END IF;
  IF p_grant_kind NOT IN ('permanent', 'timeboxed') THEN
    RAISE EXCEPTION 'invalid_grant_kind';
  END IF;
  IF p_grant_kind = 'timeboxed' THEN
    IF p_expires_at IS NULL OR p_expires_at <= now() THEN
      RAISE EXCEPTION 'grant_expiry_required';
    END IF;
    IF p_expires_at > now() + INTERVAL '90 days' THEN
      RAISE EXCEPTION 'grant_duration_exceeded';
    END IF;
  ELSIF p_expires_at IS NOT NULL THEN
    RAISE EXCEPTION 'expiry_requires_timeboxed';
  END IF;

  -- Caller authority (018, unchanged).
  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) INTO v_is_teen;

  IF v_is_teen THEN
    IF EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = p_child_id AND ca.user_id = p_user_id
         AND ca.role = 'child'
    ) THEN
      RAISE EXCEPTION 'cannot_grant_self';
    END IF;
    v_tier := public.child_age_tier(p_child_id);
    IF v_tier IN ('under13', 'unknown') THEN
      RAISE EXCEPTION 'age_verification_required';
    END IF;
    v_granted_by := 'child';
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
         AND ca.role = 'parent' AND ca.status = 'active'
    ) INTO v_is_parent;
    IF NOT v_is_parent THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    v_granted_by := 'parent';
  END IF;

  -- Existing row?
  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_row.status IN ('active', 'scheduled_revoke', 'pending_cooling', 'pending_coapproval') THEN
      RAISE EXCEPTION 'grant_already_active';
    END IF;
    IF NOT v_is_teen
       AND v_row.re_request_locked_until IS NOT NULL
       AND v_row.re_request_locked_until > now() THEN
      RAISE EXCEPTION 're_request_locked';
    END IF;
  END IF;

  -- D6 trust tier: trusted = prior good-standing grant (active/expired).
  SELECT EXISTS (
    SELECT 1 FROM public.grant_ledger gl
     WHERE gl.child_id = p_child_id AND gl.grantee_user_id = p_user_id
       AND gl.status IN ('active', 'expired')
  ) INTO v_trusted;

  -- D6 rolling-30d cap.
  SELECT count(*) INTO v_window_cnt FROM public.grant_ledger gl
   WHERE gl.child_id = p_child_id AND gl.grantee_user_id = p_user_id
     AND gl.issued_at > now() - INTERVAL '30 days'
     AND gl.status IN ('active', 'expired', 'revoked', 'pending_coapproval');
  v_cap := CASE WHEN v_trusted THEN 8 ELSE 2 END;
  IF v_window_cnt >= v_cap THEN
    PERFORM public.log_access_event(
      p_child_id, v_caller, p_user_id, 'grant', v_granted_by, 'teen_choice',
      NULL,
      jsonb_build_object('cap_exceeded', true, 'cap', v_cap,
                         'window_count', v_window_cnt,
                         'trusted', v_trusted));
    RAISE EXCEPTION 'grant_cap_exceeded';
  END IF;

  -- Installment detection: new issuance within 24h of the prior grant's
  -- expiry looks like cap evasion (Round 2). Flagged, not blocked.
  SELECT EXISTS (
    SELECT 1 FROM public.grant_ledger gl
     WHERE gl.child_id = p_child_id AND gl.grantee_user_id = p_user_id
       AND gl.expires_at IS NOT NULL
       AND gl.expires_at BETWEEN now() - INTERVAL '24 hours' AND now()
  ) INTO v_suspect;

  -- New grantee + parent caller -> teen co-approval (D6). Teen callers and
  -- trusted re-grants activate immediately.
  IF NOT v_trusted AND NOT v_is_teen THEN
    v_new_status := 'pending_coapproval';
  END IF;

  IF FOUND THEN
    UPDATE public.child_access
       SET role = 'parent',
           status = v_new_status,
           granted_by = v_granted_by,
           granted_by_user_id = v_caller,
           revoked_at = NULL,
           cooling_off_until = NULL,
           re_request_locked_until = NULL,
           expires_at = p_expires_at,
           grant_kind = p_grant_kind,
           grant_purpose = NULLIF(btrim(COALESCE(p_purpose, '')), ''),
           granted_at = now()
     WHERE child_id = p_child_id AND user_id = p_user_id;
    v_regranted := true;
  ELSE
    INSERT INTO public.child_access
      (child_id, user_id, role, granted_by, granted_by_user_id, status,
       expires_at, grant_kind, grant_purpose)
    VALUES
      (p_child_id, p_user_id, 'parent', v_granted_by, v_caller, v_new_status,
       p_expires_at, p_grant_kind, NULLIF(btrim(COALESCE(p_purpose, '')), ''));
  END IF;

  -- Timeboxed grants are operational-scope only: zero reflection/wellness/
  -- location/itinerary at issuance (the access_scopes trigger seeds first;
  -- this narrows it back for timeboxed rows).
  IF p_grant_kind = 'timeboxed' THEN
    UPDATE public.access_scopes
       SET allowed = false, updated_at = now()
     WHERE child_id = p_child_id AND user_id = p_user_id
       AND scope IN ('reflection', 'wellness', 'location', 'itinerary');
  END IF;

  INSERT INTO public.grant_ledger
    (child_id, grantee_user_id, granter_user_id, granted_by, grant_kind,
     purpose, expires_at, status, installment_suspect,
     metadata)
  VALUES
    (p_child_id, p_user_id, v_caller, v_granted_by, p_grant_kind,
     NULLIF(btrim(COALESCE(p_purpose, '')), ''), p_expires_at, v_new_status,
     v_suspect,
     jsonb_build_object('trusted', v_trusted, 'regrant', v_regranted,
                        'window_count', v_window_cnt, 'cap', v_cap))
  RETURNING id INTO v_ledger_id;

  PERFORM public.log_access_event(
    p_child_id, v_caller, p_user_id,
    CASE WHEN v_new_status = 'pending_coapproval'
         THEN 'grant.coapproval_requested' ELSE 'grant' END,
    v_granted_by,
    CASE WHEN v_regranted THEN 'regrant' ELSE 'teen_choice' END,
    NULL,
    jsonb_build_object('ledger_id', v_ledger_id, 'grant_kind', p_grant_kind,
                       'trusted', v_trusted, 'installment_suspect', v_suspect));

  PERFORM public.audit_event(p_child_id, 'access.granted', 'user',
                             'child_access', p_child_id::text || '/' || p_user_id::text,
                             jsonb_build_object('granted_to', p_user_id,
                                                'granted_by', v_granted_by,
                                                'regrant', v_regranted,
                                                'grant_kind', p_grant_kind,
                                                'installment_suspect', v_suspect));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_access(uuid, uuid, text, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_access(uuid, uuid, text, timestamptz, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 7 — revoke_access(): honor pending_cooling + pending_coapproval rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_access(
  p_child_id uuid,
  p_user_id  uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid := public.safe_auth_uid();
  v_row       public.child_access%ROWTYPE;
  v_is_teen   boolean := false;
  v_is_parent boolean := false;
  v_tier      text;
  v_cooling   boolean := false;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_user_id  IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id
     AND status IN ('active', 'scheduled_revoke', 'pending_cooling', 'pending_coapproval')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'access_not_found';
  END IF;

  IF v_row.role = 'child' THEN
    RAISE EXCEPTION 'child_access_irrevocable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) INTO v_is_teen;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'parent' AND ca.status = 'active'
  ) INTO v_is_parent;

  IF v_caller = p_user_id THEN
    NULL;
  ELSIF v_is_teen THEN
    v_tier := public.child_age_tier(p_child_id);
    IF v_tier IN ('t13_15', 'unknown') THEN
      v_cooling := true;
    END IF;
    -- A pending_coapproval row revoked by the teen is a rejection, not a
    -- cooling case: it never activated.
    IF v_row.status = 'pending_coapproval' THEN
      v_cooling := false;
    END IF;
  ELSIF v_row.granted_by = 'parent' AND v_row.granted_by_user_id = v_caller THEN
    NULL;
  ELSIF v_row.granted_by = 'child' AND v_is_parent THEN
    RAISE EXCEPTION 'child_grant_untouchable';
  ELSIF v_row.granted_by = 'parent' THEN
    RAISE EXCEPTION 'not_your_grant';
  ELSIF v_row.granted_by = 'system' THEN
    RAISE EXCEPTION 'not_authorized';
  ELSE
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_cooling THEN
    UPDATE public.child_access
       SET status = 'scheduled_revoke',
           cooling_off_until = now() + INTERVAL '7 days'
     WHERE child_id = p_child_id AND user_id = p_user_id;
    PERFORM public.log_access_event(
      p_child_id, v_caller, p_user_id, 'revoke', v_row.granted_by,
      'cooling_off_scheduled', NULL, NULL);
  ELSE
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now(),
           cooling_off_until = NULL,
           re_request_locked_until = now() + INTERVAL '30 days'
     WHERE child_id = p_child_id AND user_id = p_user_id;
    UPDATE public.grant_ledger
       SET status = 'revoked'
     WHERE child_id = p_child_id AND grantee_user_id = p_user_id
       AND status IN ('active', 'pending_coapproval');
    PERFORM public.log_access_event(
      p_child_id, v_caller, p_user_id, 'revoke', v_row.granted_by,
      'teen_choice', NULL, NULL);
  END IF;

  PERFORM public.audit_event(p_child_id, 'access.revoked', 'user',
                             'child_access', p_child_id::text || '/' || p_user_id::text,
                             jsonb_build_object('revoked_user', p_user_id,
                                                'cooling', v_cooling));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_access(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 8 — teen co-approval decisions (D6)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_approve_grant(p_ledger_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_led public.grant_ledger%ROWTYPE;
  v_tier text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_ledger_id IS NULL THEN RAISE EXCEPTION 'ledger_required'; END IF;

  SELECT * INTO v_led FROM public.grant_ledger WHERE id = p_ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'grant_not_found'; END IF;
  IF v_led.status IS DISTINCT FROM 'pending_coapproval' THEN
    RAISE EXCEPTION 'grant_not_pending';
  END IF;
  IF NOT public.is_teen_of(v_led.child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  v_tier := public.child_age_tier(v_led.child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;

  UPDATE public.child_access
     SET status = 'active', granted_at = now()
   WHERE child_id = v_led.child_id AND user_id = v_led.grantee_user_id;

  UPDATE public.grant_ledger
     SET status = 'active', teen_approved_at = now()
   WHERE id = p_ledger_id;

  PERFORM public.log_access_event(
    v_led.child_id, v_caller, v_led.grantee_user_id, 'grant.coapproval_decided',
    'child', 'teen_choice', NULL,
    jsonb_build_object('ledger_id', p_ledger_id, 'decision', 'approved'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_approve_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_approve_grant(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_reject_grant(p_ledger_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_led public.grant_ledger%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_ledger_id IS NULL THEN RAISE EXCEPTION 'ledger_required'; END IF;

  SELECT * INTO v_led FROM public.grant_ledger WHERE id = p_ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'grant_not_found'; END IF;
  IF v_led.status IS DISTINCT FROM 'pending_coapproval' THEN
    RAISE EXCEPTION 'grant_not_pending';
  END IF;
  IF NOT public.is_teen_of(v_led.child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;

  UPDATE public.child_access
     SET status = 'revoked', revoked_at = now(),
         revoked_by = v_caller
   WHERE child_id = v_led.child_id AND user_id = v_led.grantee_user_id;

  UPDATE public.grant_ledger
     SET status = 'rejected', teen_approved_at = now()
   WHERE id = p_ledger_id;

  PERFORM public.log_access_event(
    v_led.child_id, v_caller, v_led.grantee_user_id, 'grant.coapproval_decided',
    'child', 'teen_choice', NULL,
    jsonb_build_object('ledger_id', p_ledger_id, 'decision', 'rejected'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reject_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reject_grant(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 9 — expire_timeboxed_grants() (service_role cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_timeboxed_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.child_access%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.child_access
     WHERE grant_kind = 'timeboxed'
       AND status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.child_access
       SET status = 'expired'
     WHERE child_id = r.child_id AND user_id = r.user_id;
    UPDATE public.grant_ledger
       SET status = 'expired'
     WHERE child_id = r.child_id AND grantee_user_id = r.user_id
       AND status = 'active';
    PERFORM public.log_access_event(
      r.child_id, NULL, r.user_id, 'grant.expired', r.granted_by, 'expiry',
      NULL, NULL);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_timeboxed_grants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_timeboxed_grants() TO service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Parent grants a NEW grantee -> child_access status 'pending_coapproval',
--    ledger row pending_coapproval; teen rpc_approve_grant -> active.
-- 2. Trusted grantee (prior expired grant) gets 8/30d; 9th -> grant_cap_exceeded.
-- 3. New grantee gets 2/30d; 3rd -> grant_cap_exceeded.
-- 4. Timeboxed grant zeroes reflection/wellness/location/itinerary scopes.
-- 5. Re-grant after revoke resets expires_at/grant_kind.
-- 6. check.sh passes.
