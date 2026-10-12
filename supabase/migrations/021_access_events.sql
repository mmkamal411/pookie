-- Migration 021: access_events append-only audit trail (FR-ACCESS-009).
--
-- Design refs: sol-access §3, sol-support §B.3, EXPERT-SOLUTIONS §G (canonical).
-- Every grant / revoke / request / block / safe-exit / support-agent read is
-- logged here. Teen-visible; never shown to a revoked parent (enforced by RLS
-- policy arms, sol-access §3.4). Support + credit events (D4) included.
--
-- IDEMPOTENT: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- Reason codes (stable vocabulary for revoke/grant reasons)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_reason_codes (
  code text PRIMARY KEY,
  description text NOT NULL
);

INSERT INTO public.access_reason_codes (code, description) VALUES
  ('teen_choice', 'Teen''s own sharing choice'),
  ('regrant', 'Teen re-granted after revoke'),
  ('safety_concern', 'Safety-driven change'),
  ('safe_exit_risk', 'Teen indicated telling parents could put them at risk'),
  ('household_change', 'Blended-family / household change'),
  ('cooling_off_expired', '7-day cooling-off reached effect'),
  ('cooling_off_cancelled', 'Teen cancelled pending revoke'),
  ('court_order', 'Court-ordered change'),
  ('duplicate_cleanup', 'Claim-dedupe merge'),
  ('system_migration', 'Backfill / migration'),
  ('trusted_adult_request', 'Trusted adult involved'),
  ('coerced_link', 'Link completed under possible coercion flag'),
  ('credentials_paused', 'Revoked parent''s sync credentials paused'),
  ('credit_issued', 'Support credit/adjustment issued on ticket'),
  ('credit_approval', 'Credit above agent authority requested/decided'),
  ('expiry', 'Time-boxed grant reached its end')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- access_events: append-only. No UPDATE/DELETE policies are ever created.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  subject_user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type IN (
    -- access model (sol-access §3.2)
    'grant', 'revoke_initiated', 'revoke_effective', 'revoke_cancelled',
    'cooling_off_started', 'safe_exit', 'request_created', 'request_approved',
    'request_denied', 'block_added', 'block_removed', 'link_code_redeemed',
    'invite_sent', 'invite_accepted', 'scope_changed', 'court_order_applied',
    'court_order_cleared', 'go_independent', 'regrant', 'credentials_paused',
    -- support agent audit (sol-support §B.3)
    'support.ticket.viewed', 'support.ticket.assigned',
    'support.grant.requested', 'support.grant.approved', 'support.grant.denied',
    'support.grant.expired', 'support.grant.revoked',
    'support.grant.data_accessed', 'support.internal_note.created',
    'support.consent_card.sent',
    -- financial authority (MD decision D4)
    'support.credit.issued', 'support.credit.approval_requested',
    'support.credit.approval_decided'
  )),
  granted_by text CHECK (granted_by IN ('child', 'parent', 'system')),
  reason_code text REFERENCES public.access_reason_codes(code),
  notify_mode text CHECK (notify_mode IN ('at_effect', 'immediate', 'suppressed')),
  safe_exit boolean NOT NULL DEFAULT false,
  device_hash text NOT NULL DEFAULT '',
  ip_hash text NOT NULL DEFAULT '',
  same_device boolean,
  coerced_flag boolean NOT NULL DEFAULT false,
  -- D4 financial fields: set only on support.credit.* events (amount in cents)
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  decided_by uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS access_events_child_time
  ON public.access_events (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_events_actor
  ON public.access_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_events_type_time
  ON public.access_events (event_type, created_at DESC);

COMMENT ON TABLE public.access_events IS
  'Append-only audit for every access mutation and every support-agent read.
   Never shown to a revoked parent (RLS arms in a later security migration).
   device_hash/ip_hash are salted sha256 — never raw IP (sol-access §3.1).';

-- ---------------------------------------------------------------------------
-- log_access_event(): the single append point. SECURITY DEFINER so RPCs and
-- triggers can write without granting INSERT to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_access_event(
  p_child_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_subject_user_id uuid DEFAULT NULL,
  p_reason_code text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_amount_cents integer DEFAULT NULL
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
    (child_id, actor_user_id, event_type, subject_user_id, reason_code,
     metadata, amount_cents)
  VALUES
    (p_child_id, p_actor_user_id, p_event_type, p_subject_user_id, p_reason_code,
     COALESCE(p_metadata, '{}'::jsonb), p_amount_cents)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.log_access_event(uuid, uuid, text, uuid, text, jsonb, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_access_event(uuid, uuid, text, uuid, text, jsonb, integer)
  TO authenticated, service_role;

-- RLS: enabled, SELECT-only for the teen on their own record. No INSERT /
-- UPDATE / DELETE policies for authenticated — all writes go through
-- log_access_event() or mutation RPCs. (Full per-arm policy set, incl. the
-- revoked-parent rule, is hardened by the Security Engineer.)
ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_events_teen_select ON public.access_events;
CREATE POLICY access_events_teen_select ON public.access_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = access_events.child_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS access_events_service_all ON public.access_events;
CREATE POLICY access_events_service_all ON public.access_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
