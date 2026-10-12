-- Migration 028: Support tickets (S3) + agent RBAC + shared age gates.
--
-- Source: docs/solutions/sol-support.md §B (data model), §B.3 (audit),
--         §D (migrations 028-030 spec); BUILD-SPECIFICATION.md FR-SUPPORT-001..006,
--         FR-TRAVEL-001, NFR-SEC-001/007; EXPERT-SOLUTIONS.md (health never
--         grantable; support audit extends access_events).
--
-- DEPENDENCIES:
--   * 001 (users, children, child_access), 015 — present.
--   * 021 (access_events) — NOT YET IN TREE. support_log_event() degrades
--     gracefully: it inserts support.* events only when the table exists AND
--     accepts the row (exception-guarded). 021 MUST add the §B.3 event types
--     (support.ticket.viewed, support.ticket.assigned, support.grant.requested/
--     .approved/.denied/.expired/.revoked, support.grant.data_accessed,
--     support.internal_note.created, support.consent_card.sent) to its
--     event_type CHECK list, and SHOULD make child_id nullable or document
--     that adult-owned (child_id NULL) support events live in support_grants/
--     ticket rows as the durable audit trail (retention: grants 3y per §C.1).
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS / CREATE OR REPLACE FUNCTION.
-- Safe to re-run. Sequence creation is guarded with a DO block.
--
-- GRANT MODEL (001 F2 / 016 convention): RLS policies grant nothing.
--   * support_tickets: authenticated gets SELECT + INSERT (row-scoped by
--     policy). UPDATE/DELETE are REVOKEd from authenticated — status and
--     assignment change ONLY through the RPCs below (SECURITY DEFINER).
--     A transition-guard trigger enforces the §D.2 state machine as
--     defense-in-depth.
--   * ticket_messages: authenticated gets SELECT (row-scoped; internal rows
--     never visible to the ticket owner). INSERT/UPDATE/DELETE revoked —
--     all posts go through rpc_post_ticket_message so the PII redaction
--     trigger (§C.3) always fires.
--   * support_agents: no grants to authenticated/anon — RPC-only surface.
--   * RPCs: REVOKE ALL FROM PUBLIC, GRANT EXECUTE TO authenticated (+
--     service_role where cron needs it).
--
-- TABLES: support_agents, support_tickets, ticket_messages.

-- ---------------------------------------------------------------------------
-- Part 0 — shared age-gate helpers (used by support C5 under-13 rule AND by
-- the travel purchase gates in 049; defined once, here).
-- ---------------------------------------------------------------------------

-- support_user_age_band: 'adult' | 'teen' (13-17) | 'child' (<13).
-- parent-role users are always 'adult'. child-role users resolve through
-- child_access -> children.date_of_birth. Missing DOB fails CLOSED to
-- 'child' (most restrictive): the teen proves their age, the system never
-- assumes adulthood. SECURITY DEFINER so RLS policies can call it.
CREATE OR REPLACE FUNCTION public.support_user_age_band(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_dob  date;
  v_age  int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'child';  -- fail closed
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF v_role = 'parent' THEN
    RETURN 'adult';
  END IF;
  IF v_role IS NULL THEN
    RETURN 'child';  -- unknown principal: fail closed
  END IF;

  -- child-role user: find their tenant DOB
  SELECT c.date_of_birth INTO v_dob
    FROM public.child_access ca
    JOIN public.children c ON c.id = ca.child_id
   WHERE ca.user_id = p_user_id AND ca.role = 'child'
   LIMIT 1;

  IF v_dob IS NULL THEN
    RETURN 'child';  -- no DOB on file: fail closed
  END IF;

  v_age := date_part('year', age(CURRENT_DATE, v_dob))::int;
  IF v_age < 13 THEN
    RETURN 'child';
  ELSIF v_age < 18 THEN
    RETURN 'teen';
  ELSE
    RETURN 'adult';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.support_user_age_band(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_user_age_band(uuid) TO authenticated, service_role;

-- support_is_agent: is the caller an active support agent at >= p_min_tier?
-- Tier order: agent < lead < admin. Deactivating the support_agents row
-- revokes instantly (checked per call, never cached) — §B.4.
CREATE OR REPLACE FUNCTION public.support_is_agent(p_min_tier text DEFAULT 'agent')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT sa.role_tier INTO v_tier
    FROM public.support_agents sa
   WHERE sa.user_id = auth.uid()
     AND sa.active = true;

  IF v_tier IS NULL THEN
    RETURN false;
  END IF;

  RETURN CASE p_min_tier
    WHEN 'admin' THEN v_tier = 'admin'
    WHEN 'lead'  THEN v_tier IN ('lead', 'admin')
    ELSE              v_tier IN ('agent', 'lead', 'admin')
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.support_is_agent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_is_agent(text) TO authenticated, service_role;

-- support_caller_agent_id: the caller's support_agents.id, or NULL.
CREATE OR REPLACE FUNCTION public.support_caller_agent_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT sa.id FROM public.support_agents sa
           WHERE sa.user_id = auth.uid() AND sa.active = true);
END;
$$;

REVOKE ALL ON FUNCTION public.support_caller_agent_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_caller_agent_id() TO authenticated, service_role;

-- support_log_event: best-effort audit write into access_events (021).
-- Inserts ONLY when the table exists and accepts the row; any failure
-- (missing table, event_type CHECK not yet extended, child_id NOT NULL on
-- adult tickets) is swallowed — the support_grants table (3y retention,
-- §C.1) remains the durable audit trail. Never raises.
CREATE OR REPLACE FUNCTION public.support_log_event(
  p_event_type   text,
  p_ticket_id    uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  IF to_regclass('public.access_events') IS NULL THEN
    RETURN;  -- 021 not applied yet
  END IF;

  SELECT t.child_id INTO v_child_id
    FROM public.support_tickets t WHERE t.id = p_ticket_id;
  IF v_child_id IS NULL THEN
    RETURN;  -- access_events.child_id is NOT NULL (sol-access §3); adult
             -- tickets are audited via support_grants + ticket rows instead
  END IF;

  BEGIN
    INSERT INTO public.access_events
      (child_id, actor_user_id, subject_user_id, event_type, metadata)
    VALUES
      (v_child_id, p_actor_user_id, NULL, p_event_type, p_metadata);
  EXCEPTION WHEN OTHERS THEN
    -- 021's event_type CHECK does not list support.* yet, or any other
    -- schema drift: degrade silently, never break the support flow.
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.support_log_event(text, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_log_event(text, uuid, uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 1 — support_agents (internal staff; separate principal from app users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_agents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,                       -- first name shown to users
  role_tier    text NOT NULL DEFAULT 'agent'
               CHECK (role_tier IN ('agent','lead','admin')),
  active       boolean NOT NULL DEFAULT true,       -- false = instant revoke (§B.4)
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies and NO grants to authenticated/anon:
-- the agent console is a separate auth surface; every agent capability is
-- checked per-call via support_is_agent(). service_role retains access.

-- ---------------------------------------------------------------------------
-- Part 2 — support_tickets
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='support_ticket_seq') THEN
    CREATE SEQUENCE public.support_ticket_seq START 1;
  END IF;
END $$;

-- 'PK-2026-0042' — sequence-backed, concurrency-safe via nextval().
CREATE OR REPLACE FUNCTION public.support_next_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'PK-' || to_char(now(), 'YYYY') || '-'
       || lpad(nextval('public.support_ticket_seq')::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.support_next_ticket_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_next_ticket_number() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     text NOT NULL UNIQUE,           -- 'PK-2026-0042'
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                        -- the counterparty. For under-13: the PARENT (C5).
  child_id          uuid REFERENCES public.children(id) ON DELETE SET NULL,
                        -- on-behalf-of; NULL for an adult's own ticket
  category          text NOT NULL,                  -- topic code, e.g. 'school.sync'
  subject           text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','resolved','closed')),
  priority          text NOT NULL DEFAULT 'P2'
                    CHECK (priority IN ('P1','P2','P3')),
  sensitive         boolean NOT NULL DEFAULT false, -- P1 / teen-authored / safety
  teen_privacy      boolean NOT NULL DEFAULT false, -- FR-SUPPORT-004: when true,
                        -- the ticket is INVISIBLE to parent accounts at the
                        -- RLS policy level (not just UI-hidden)
  assigned_agent_id uuid REFERENCES public.support_agents(id) ON DELETE SET NULL,
  sla_due_at        timestamptz NOT NULL,
  sla_breached      boolean NOT NULL DEFAULT false,
  source            text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('s2_escalation','manual','faq')),
  reopened_count    int NOT NULL DEFAULT 0,
  lead_review       boolean NOT NULL DEFAULT false, -- reopened>2 churn flag (§D.2)
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_child_idx ON public.support_tickets (child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx ON public.support_tickets (status, priority, sla_due_at)
  WHERE assigned_agent_id IS NULL AND status = 'open';
CREATE INDEX IF NOT EXISTS support_tickets_agent_idx ON public.support_tickets (assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS support_tickets_sla_idx ON public.support_tickets (sla_due_at)
  WHERE sla_breached = false AND status IN ('open','in_progress');

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Owner (the counterparty — parent for under-13, teen/adult otherwise)
DROP POLICY IF EXISTS support_tickets_owner_select ON public.support_tickets;
CREATE POLICY support_tickets_owner_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Parent view: ONLY non-teen-privacy tickets filed on behalf of THEIR child.
-- teen_privacy=true rows are invisible here by policy (FR-SUPPORT-004).
DROP POLICY IF EXISTS support_tickets_parent_select ON public.support_tickets;
CREATE POLICY support_tickets_parent_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    child_id IS NOT NULL
    AND teen_privacy = false
    AND EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.user_id = auth.uid()
         AND ca.role = 'parent'
         AND ca.child_id = support_tickets.child_id
    )
  );

-- Agent queue: assigned to me, OR unassigned open tickets (the open queue).
DROP POLICY IF EXISTS support_tickets_agent_select ON public.support_tickets;
CREATE POLICY support_tickets_agent_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    public.support_is_agent('agent')
    AND (
      assigned_agent_id = public.support_caller_agent_id()
      OR (assigned_agent_id IS NULL AND status = 'open')
    )
  );

-- Lead/admin: full visibility (still never health records — those live in
-- other tables entirely and are grant-gated in 030).
DROP POLICY IF EXISTS support_tickets_lead_select ON public.support_tickets;
CREATE POLICY support_tickets_lead_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.support_is_agent('lead'));

-- INSERT: the counterparty opens their own ticket (WITH CHECK pins user_id).
-- Under-13 principals are rejected in rpc_open_ticket, not here, so the
-- policy stays a pure ownership check.
DROP POLICY IF EXISTS support_tickets_owner_insert ON public.support_tickets;
CREATE POLICY support_tickets_owner_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policies for authenticated: status/assignment/sla change
-- ONLY through the RPCs (Part 6) + the transition-guard trigger (Part 4).
REVOKE UPDATE, DELETE ON public.support_tickets FROM authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_ticket_seq TO authenticated;

-- ---------------------------------------------------------------------------
-- Part 3 — window-aware SLA (FR-SUPPORT-003 + sol-support §D.1, reconciled)
--   P1: 4 hours of COVERAGE WINDOW (9:00 AM–5:00 PM ET, 7 days/week,
--       incl. holidays per MD D4 rotating on-call). An 11 PM P1 ticket is
--       therefore due 1 PM the next day (9 AM + 4 window-hours).
--   P2: 24h calendar. P3: 72h calendar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_sla_due_at(
  p_priority  text,
  p_opened_at timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_due       timestamptz := p_opened_at;
  v_remaining interval;
  v_day       date;
  v_win_start timestamptz;
  v_win_end   timestamptz;
  v_avail     interval;
  v_take      interval;
  v_guard     int := 0;
BEGIN
  IF p_priority = 'P2' THEN
    RETURN p_opened_at + interval '24 hours';
  END IF;
  IF p_priority = 'P3' THEN
    RETURN p_opened_at + interval '72 hours';
  END IF;
  IF p_priority <> 'P1' THEN
    RAISE EXCEPTION 'unknown priority %', p_priority;
  END IF;

  v_remaining := interval '4 hours';
  WHILE v_remaining > interval '0 seconds' LOOP
    v_guard := v_guard + 1;
    IF v_guard > 60 THEN
      RAISE EXCEPTION 'SLA window computation did not converge';
    END IF;
    v_day       := (v_due AT TIME ZONE 'America/New_York')::date;
    v_win_start := (v_day::timestamp + time '09:00') AT TIME ZONE 'America/New_York';
    v_win_end   := (v_day::timestamp + time '17:00') AT TIME ZONE 'America/New_York';

    IF v_due < v_win_start THEN
      v_due := v_win_start;
    ELSIF v_due >= v_win_end THEN
      v_due := ((v_day + 1)::timestamp + time '09:00') AT TIME ZONE 'America/New_York';
      CONTINUE;
    END IF;

    v_avail := v_win_end - v_due;
    v_take  := LEAST(v_avail, v_remaining);
    v_due       := v_due + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;
  RETURN v_due;
END;
$$;

REVOKE ALL ON FUNCTION public.support_sla_due_at(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_sla_due_at(text, timestamptz) TO authenticated, service_role;

-- support_business_days_ago: cutoff for the 5-business-day auto-close (§D.2).
-- Business days = Mon-Fri (support runs 7 days incl. holidays per MD D4).
CREATE OR REPLACE FUNCTION public.support_business_days_ago(p_days int)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_d date := CURRENT_DATE;
  v_n int := 0;
BEGIN
  WHILE v_n < p_days LOOP
    v_d := v_d - 1;
    IF extract(isodow FROM v_d) < 6 THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN (v_d::timestamp + time '00:00') AT TIME ZONE 'America/New_York';
END;
$$;

REVOKE ALL ON FUNCTION public.support_business_days_ago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_business_days_ago(int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — ticket_messages (+ §C.3 server-side PII redaction on ingest)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('user','agent','ai','system')),
  author_id   uuid,                             -- auth.users id or support_agents.id
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  internal    boolean NOT NULL DEFAULT false,   -- agent-only; RLS-enforced (§A.3)
  redacted    boolean NOT NULL DEFAULT false,   -- auto-redaction fired (§C.3)
  health_flagged boolean NOT NULL DEFAULT false, -- heuristic: message may
                        -- contain health details — agent must not repeat it
                        -- in internal notes (§C.3); NEVER shown to parents
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{name,size,mime,path}]
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx ON public.ticket_messages (ticket_id, created_at);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Owner thread view: own tickets, NON-internal rows only.
DROP POLICY IF EXISTS ticket_messages_owner_select ON public.ticket_messages;
CREATE POLICY ticket_messages_owner_select ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
       WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()
    )
  );

-- Parent thread view: same, but only on non-teen-privacy child tickets.
DROP POLICY IF EXISTS ticket_messages_parent_select ON public.ticket_messages;
CREATE POLICY ticket_messages_parent_select ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      JOIN public.child_access ca
        ON ca.child_id = t.child_id AND ca.role = 'parent' AND ca.user_id = auth.uid()
       WHERE t.id = ticket_messages.ticket_id
         AND t.teen_privacy = false
    )
  );

-- Agent thread view: all rows (incl. internal) on tickets the agent may see.
-- internal=true is additionally restricted to agents — never the ticket
-- owner, even if the owner somehow holds an agent row (separation, §B.4):
-- the owner policies above already exclude internal rows.
DROP POLICY IF EXISTS ticket_messages_agent_select ON public.ticket_messages;
CREATE POLICY ticket_messages_agent_select ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    public.support_is_agent('agent')
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
       WHERE t.id = ticket_messages.ticket_id
         AND (
           t.assigned_agent_id = public.support_caller_agent_id()
           OR (t.assigned_agent_id IS NULL AND t.status = 'open')
           OR public.support_is_agent('lead')
         )
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated: posts go through
-- rpc_post_ticket_message so redaction ALWAYS fires before storage.
REVOKE INSERT, UPDATE, DELETE ON public.ticket_messages FROM authenticated;
GRANT SELECT ON public.ticket_messages TO authenticated;

-- §C.3 PII redaction on ingest — runs BEFORE storage, so the original bytes
-- are never persisted. Heuristic patterns (attorney sign-off gate §E.1):
--   never stored: full card PANs, SSNs, pasted passwords/secrets,
--   full bank account numbers -> '[redacted]', redacted=true.
--   health-pattern content -> health_flagged=true (warns the agent; health
--   content is never copied into internal notes — enforced by convention
--   in the agent console + this flag).
CREATE OR REPLACE FUNCTION public.ticket_messages_redact_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text := NEW.body;
BEGIN
  -- US SSN (dashed)
  IF v_body ~ '\y\d{3}-\d{2}-\d{4}\y' THEN
    v_body := regexp_replace(v_body, '\y\d{3}-\d{2}-\d{4}\y', '[redacted]', 'g');
    NEW.redacted := true;
  END IF;

  -- Card PAN: 4x4 grouped, or a bare 13-19 digit run
  IF v_body ~ '\y\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\y' THEN
    v_body := regexp_replace(v_body, '\y\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\y', '[redacted]', 'g');
    NEW.redacted := true;
  END IF;
  IF v_body ~ '\y\d{13,19}\y' THEN
    v_body := regexp_replace(v_body, '\y\d{13,19}\y', '[redacted]', 'g');
    NEW.redacted := true;
  END IF;

  -- Pasted passwords / secrets ("password: hunter2")
  IF v_body ~* '(password|passwd|pwd|secret)\s*[:=]\s*\S+' THEN
    v_body := regexp_replace(v_body, '(?i)(password|passwd|pwd|secret)(\s*[:=]\s*)\S+', '\1\2[redacted]', 'g');
    NEW.redacted := true;
  END IF;

  -- Bank account numbers ("account # 12345678", "acct no: ...")
  IF v_body ~* 'account\s*(number|no\.?|#)?\s*[:#]?\s*\d{6,}' THEN
    v_body := regexp_replace(v_body, '(?i)(account(\s*(number|no\.?|#))?)(\s*[:#]?\s*)\d{6,}', '\1\4[redacted]', 'g');
    NEW.redacted := true;
  END IF;

  -- Health-pattern heuristic -> flag only (content stays for the user, but
  -- the agent is warned not to repeat it in internal notes).
  IF v_body ~* '(diagnos|prescription|medication|dosage|therapist|psychiatrist|insulin|inhaler|pregnan|contracept)' THEN
    NEW.health_flagged := true;
  END IF;

  NEW.body := v_body;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_messages_redact_pii ON public.ticket_messages;
CREATE TRIGGER ticket_messages_redact_pii
  BEFORE INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.ticket_messages_redact_pii();

-- ---------------------------------------------------------------------------
-- Part 5 — status-transition guard (§D.2 state machine, defense-in-depth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_tickets_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'open'        AND NEW.status = 'in_progress') OR
    (OLD.status = 'in_progress' AND NEW.status = 'resolved')   OR
    (OLD.status = 'resolved'    AND NEW.status IN ('closed','in_progress')) OR
    (OLD.status = 'closed'      AND NEW.status = 'in_progress'
       AND OLD.closed_at IS NOT NULL
       AND OLD.closed_at > now() - interval '30 days')
  ) THEN
    RAISE EXCEPTION 'invalid ticket status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'invalid_status_transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_transition_guard ON public.support_tickets;
CREATE TRIGGER support_tickets_transition_guard
  BEFORE UPDATE OF status ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_transition_guard();

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.support_tickets_touch_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_touch_updated ON public.support_tickets;
CREATE TRIGGER support_tickets_touch_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch_updated();
