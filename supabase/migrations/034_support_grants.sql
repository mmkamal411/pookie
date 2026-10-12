-- Migration 028: support_grants — teen-approved break-glass data access (FR-SUPPORT-005).
--
-- Design refs: sol-support §B.1/§B.2, EXPERT-SOLUTIONS §G.
-- NUMBERING NOTE: canonical §G map said 046; landing at next free number (028).
--
-- Least-privilege: a grant names ONE allowlisted scope on ONE ticket, expires
-- automatically (default 24h, max 72h), and every scoped read is audit-logged
-- to access_events (support.grant.data_accessed). Health / wellbeing / mood /
-- check-in scopes are NOT grantable — the CHECK rejects them server-side
-- (sol-support conflict C1).
--
-- IDEMPOTENT: IF NOT EXISTS / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.support_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.support_agents(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN (
    'school.grades.read',   -- grades, assignments, attendance detail
    'billing.read',         -- masked billing records (last-4 only)
    'sync.status.read'      -- sync health / error detail, no grades
  )),
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 1 AND 280),
  requested_by uuid NOT NULL REFERENCES public.support_agents(id),
  granted_by_user_id uuid REFERENCES auth.users(id),
  consented_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_grants_expiry_cap CHECK (expires_at <= created_at + interval '72 hours')
);

CREATE INDEX IF NOT EXISTS support_grants_ticket_idx ON public.support_grants (ticket_id, status);
CREATE INDEX IF NOT EXISTS support_grants_agent_idx ON public.support_grants (agent_id, status);
CREATE INDEX IF NOT EXISTS support_grants_expiry_idx ON public.support_grants (expires_at)
  WHERE status = 'active';

COMMENT ON TABLE public.support_grants IS
  'Break-glass data access for support agents. TTL enforced server-side;
   expiry is automatic (cron rpc_expire_support_grants equivalent). The grant
   scope allowlist EXCLUDES health/wellbeing/mood/check-in by design (C1).';

ALTER TABLE public.support_grants ENABLE ROW LEVEL SECURITY;

-- User sees grants on their own tickets; agent sees their own grants.
DROP POLICY IF EXISTS support_grants_user ON public.support_grants;
CREATE POLICY support_grants_user ON public.support_grants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t
                 WHERE t.id = support_grants.ticket_id
                   AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS support_grants_agent ON public.support_grants;
CREATE POLICY support_grants_agent ON public.support_grants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_agents sa
                 WHERE sa.user_id = auth.uid() AND sa.active
                   AND sa.id = support_grants.agent_id));

DROP POLICY IF EXISTS support_grants_service_all ON public.support_grants;
CREATE POLICY support_grants_service_all ON public.support_grants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Expiry sweeper: flips active->expired past expires_at. Run every 15 min
-- (cron). Writes support.grant.expired to access_events per row.
CREATE OR REPLACE FUNCTION public.expire_support_grants()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT id, ticket_id, agent_id FROM public.support_grants
    WHERE status = 'active' AND expires_at <= now()
  LOOP
    UPDATE public.support_grants SET status = 'expired' WHERE id = r.id;
    PERFORM public.log_access_event(
      (SELECT child_id FROM public.support_tickets WHERE id = r.ticket_id),
      (SELECT user_id FROM public.support_agents WHERE id = r.agent_id),
      'support.grant.expired', NULL, NULL,
      jsonb_build_object('grant_id', r.id));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.expire_support_grants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_support_grants() TO service_role;
