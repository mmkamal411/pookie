-- Migration 026: support backend — tickets, events, agents, on-call, credit approvals.
--
-- Design refs: sol-support §B/§D, FR-SUPPORT-003/004/005, MD decision D4
-- (rotating holiday on-call + tiered financial authority).
-- NUMBERING NOTE: canonical §G map said 044; landing at next free number (026).
--
-- Tables: support_agents, support_tickets, ticket_events, support_oncall,
--         support_credit_approvals.
-- Status transitions are enforced in the API layer (service_role); RLS gives
-- authenticated NO direct UPDATE on status — default-deny.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- support_agents: internal console principals. Deactivating the row instantly
-- revokes all agent access (checked per request, never cached — sol-support §B.4).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role_tier text NOT NULL DEFAULT 'agent'
    CHECK (role_tier IN ('agent', 'lead', 'admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.support_agents IS
  'Support console principals. role_tier=admin acts as Managing Director for
   credit approvals (MD decision D4). active=false revokes instantly.';

-- ---------------------------------------------------------------------------
-- Ticket numbers: PK-YYYY-NNNN, sequence-backed, issued synchronously at
-- ticket creation (sol-support §A.2: the user never waits for a number).
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq;

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL DEFAULT (
    'PK-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.ticket_number_seq')::text, 4, '0')
  ),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  category text NOT NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  sensitive boolean NOT NULL DEFAULT false,
  assigned_agent_id uuid REFERENCES public.support_agents(id),
  sla_due_at timestamptz NOT NULL,
  sla_breached boolean NOT NULL DEFAULT false,
  holiday boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('s2_escalation', 'manual', 'faq')),
  reopened_count integer NOT NULL DEFAULT 0,
  teen_privacy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx ON public.support_tickets (status, priority, sla_due_at)
  WHERE assigned_agent_id IS NULL;
CREATE INDEX IF NOT EXISTS support_tickets_agent_idx ON public.support_tickets (assigned_agent_id, status);

COMMENT ON COLUMN public.support_tickets.teen_privacy IS
  'Teen-owned ticket: invisible to parent accounts (API-enforced, not just UI-hidden — FR-SUPPORT-004).';
COMMENT ON COLUMN public.support_tickets.holiday IS
  'Filed on a support holiday: routed to the on-call agent (MD decision D4).';

-- ---------------------------------------------------------------------------
-- ticket_events: append-only thread. kind covers messages, internal notes,
-- status changes, and D4 financial events (credit_issued / approval_requested
-- / approval_decided carry amount_cents).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('user', 'agent', 'ai', 'system')),
  author_id uuid REFERENCES auth.users(id),
  kind text NOT NULL DEFAULT 'message' CHECK (kind IN (
    'message', 'agent_reply', 'ai_transcript', 'system_note', 'internal_note',
    'credit_issued', 'approval_requested', 'approval_decided', 'grant_requested',
    'status_change'
  )),
  body text NOT NULL DEFAULT '',
  internal boolean NOT NULL DEFAULT false,
  redacted boolean NOT NULL DEFAULT false,
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx
  ON public.ticket_events (ticket_id, created_at);

COMMENT ON COLUMN public.ticket_events.internal IS
  'Agent-only note. Excluded from the user thread by RLS, never client filtering (sol-support §A.3).';

-- ---------------------------------------------------------------------------
-- support_oncall: holiday on-call rotation (MD decision D4).
-- One row per date overrides the default rotation. The default rotation is
-- computed in code (alternating weeks across the two active agents); this
-- table is the override surface.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_oncall (
  oncall_date date PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.support_agents(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.support_oncall IS
  'Holiday on-call overrides (D4). Empty date = default rotation in code
   (alternating ISO weeks across active agents, agent #1 on even weeks).';

-- ---------------------------------------------------------------------------
-- support_credit_approvals: >$50 credits need MD approval (D4).
-- Agents may issue <= $50 in-ticket directly (ticket_events kind=credit_issued).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_credit_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 5000),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 280),
  requested_by uuid NOT NULL REFERENCES public.support_agents(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_credit_approvals_ticket_idx
  ON public.support_credit_approvals (ticket_id);

COMMENT ON TABLE public.support_credit_approvals IS
  'D4 tiered financial authority: amounts > $50 (5000c) require admin (MD)
   approval. decided_by must be a support_agents row with role_tier=admin.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_oncall ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_credit_approvals ENABLE ROW LEVEL SECURITY;

-- Helper predicate (used inline in policies): is the caller an active agent?
-- (Policies cannot call SECURITY DEFINER helpers portably here; inline EXISTS.)

-- support_agents: agents see the active roster; users see nothing.
DROP POLICY IF EXISTS support_agents_roster ON public.support_agents;
CREATE POLICY support_agents_roster ON public.support_agents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_agents sa
                 WHERE sa.user_id = auth.uid() AND sa.active));

-- support_tickets:
--   user  -> own tickets (teen_privacy tickets are owned by the teen's user_id,
--            so a parent's user_id never matches: invisible by construction).
--   agent -> assigned to me, or the unassigned open queue.
--   lead/admin -> all.
DROP POLICY IF EXISTS support_tickets_user ON public.support_tickets;
CREATE POLICY support_tickets_user ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS support_tickets_agent ON public.support_tickets;
CREATE POLICY support_tickets_agent ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.support_agents sa
            WHERE sa.user_id = auth.uid() AND sa.active
              AND (
                sa.role_tier IN ('lead', 'admin')
                OR support_tickets.assigned_agent_id = sa.id
                OR (support_tickets.assigned_agent_id IS NULL
                    AND support_tickets.status = 'open')
              ))
  );

DROP POLICY IF EXISTS support_tickets_user_insert ON public.support_tickets;
CREATE POLICY support_tickets_user_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policies for authenticated: status transitions go through
-- the API (service_role). Default-deny.
DROP POLICY IF EXISTS support_tickets_service_all ON public.support_tickets;
CREATE POLICY support_tickets_service_all ON public.support_tickets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ticket_events:
--   user  -> non-internal rows on own tickets.
--   agent -> all rows on accessible tickets (internal included).
DROP POLICY IF EXISTS ticket_events_user ON public.ticket_events;
CREATE POLICY ticket_events_user ON public.ticket_events
  FOR SELECT TO authenticated
  USING (
    internal = false
    AND EXISTS (SELECT 1 FROM public.support_tickets t
                WHERE t.id = ticket_events.ticket_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ticket_events_agent ON public.ticket_events;
CREATE POLICY ticket_events_agent ON public.ticket_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.support_agents sa
            WHERE sa.user_id = auth.uid() AND sa.active
              AND EXISTS (SELECT 1 FROM public.support_tickets t
                          WHERE t.id = ticket_events.ticket_id
                            AND (t.assigned_agent_id = sa.id
                                 OR (t.assigned_agent_id IS NULL AND t.status = 'open')
                                 OR sa.role_tier IN ('lead', 'admin'))))
  );

DROP POLICY IF EXISTS ticket_events_insert ON public.ticket_events;
CREATE POLICY ticket_events_insert ON public.ticket_events
  FOR INSERT TO authenticated
  WITH CHECK (
    -- user posting on own ticket
    (author_type = 'user' AND EXISTS (SELECT 1 FROM public.support_tickets t
       WHERE t.id = ticket_events.ticket_id AND t.user_id = auth.uid()))
    -- agent posting on an accessible ticket
    OR EXISTS (SELECT 1 FROM public.support_agents sa
               WHERE sa.user_id = auth.uid() AND sa.active
                 AND EXISTS (SELECT 1 FROM public.support_tickets t
                             WHERE t.id = ticket_events.ticket_id
                               AND (t.assigned_agent_id = sa.id
                                    OR sa.role_tier IN ('lead', 'admin'))))
  );

DROP POLICY IF EXISTS ticket_events_service_all ON public.ticket_events;
CREATE POLICY ticket_events_service_all ON public.ticket_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- support_oncall: agents only.
DROP POLICY IF EXISTS support_oncall_agent ON public.support_oncall;
CREATE POLICY support_oncall_agent ON public.support_oncall
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_agents sa
                 WHERE sa.user_id = auth.uid() AND sa.active));

DROP POLICY IF EXISTS support_oncall_service_all ON public.support_oncall;
CREATE POLICY support_oncall_service_all ON public.support_oncall
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- support_credit_approvals: user sees rows on own tickets; agents on accessible.
DROP POLICY IF EXISTS support_credit_user ON public.support_credit_approvals;
CREATE POLICY support_credit_user ON public.support_credit_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t
                 WHERE t.id = support_credit_approvals.ticket_id
                   AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS support_credit_agent ON public.support_credit_approvals;
CREATE POLICY support_credit_agent ON public.support_credit_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_agents sa
                 WHERE sa.user_id = auth.uid() AND sa.active
                   AND EXISTS (SELECT 1 FROM public.support_tickets t
                               WHERE t.id = support_credit_approvals.ticket_id
                                 AND (t.assigned_agent_id = sa.id
                                      OR sa.role_tier IN ('lead', 'admin')))));

DROP POLICY IF EXISTS support_credit_service_all ON public.support_credit_approvals;
CREATE POLICY support_credit_service_all ON public.support_credit_approvals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS support_agents_service_all ON public.support_agents;
CREATE POLICY support_agents_service_all ON public.support_agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
