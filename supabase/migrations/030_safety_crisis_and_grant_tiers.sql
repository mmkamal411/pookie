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
  trusted_adult_id uuid REFERENCES public.trusted_adults(id) ON DELETE SET NULL,
  alert_sent_at timestamptz,
  teen_action_taken text,
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
  USING (public.is_teen_of(child_id));

-- ---------------------------------------------------------------------------
-- Part 3 — crisis_alerts (outbound alert audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crisis_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('T1', 'T2')),
  ruleset_version text NOT NULL REFERENCES public.crisis_rulesets(version),
  detection_source text NOT NULL,
  trusted_adult_id uuid REFERENCES public.trusted_adults(id) ON DELETE SET NULL,
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
  USING (public.is_teen_of(child_id));

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
  USING (public.is_teen_of(child_id));

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
