-- Migration 050: SEC-001 corrective — teen-only check-in RLS (+ SEC-002 throttle table).
-- NUMBERING NOTE: filed as 047; MD reconciliation (commit 306c8e5) had already
-- taken 047 (school track frontend), so this lands at the next free number.
---- CONTEXT (do NOT edit 006_w1_school_core.sql — already applied):
--   006's checkins_tenant_read let any tenant member (incl. parents) SELECT
--   raw teen check-in text via direct PostgREST; checkins_member_update let a
--   parent OVERWRITE the teen's check-in text; no DELETE policy existed, so
--   the teen could not delete their own check-in (FR-SCHOOL-003).
--   Security audit SEC-001 (2026-10-12), Phase 0 sign-off blocker.
--
-- CHANGES:
--   1. checkins SELECT/UPDATE/DELETE -> teen-only (caller holds the child
--      role on that child). Parents lose direct row access entirely.
--   2. checkin_daily_summary(p_child_id, p_from, p_to): SECURITY DEFINER
--      aggregate for parents — per-day counts + averages, NEVER raw text or
--      per-row mood/energy/stress.
--   3. GRANT DELETE ON checkins TO authenticated (was missing).
--   4. invite_consume_attempts: per-user throttle ledger for SEC-002.
--
-- NOTE (SEC-003): the audit claimed teacher_messages SELECT requires
-- role='parent'; committed 006 shows teacher_messages_tenant_read is
-- tenant-wide (child_id = ANY (current_child_ids())), so a linked teen
-- (role='child' row) can already read their own messages. No change made —
-- flagged for Security Engineer re-check.
--
-- IDEMPOTENT: DROP POLICY IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1+2. checkins: teen-only SELECT / UPDATE, teen-only DELETE (new).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS checkins_tenant_read ON public.checkins;
DROP POLICY IF EXISTS checkins_teen_read ON public.checkins;
CREATE POLICY checkins_teen_read ON public.checkins
  FOR SELECT USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid()
        AND ca.child_id = public.checkins.child_id
        AND ca.role = 'child'
    )
  );

DROP POLICY IF EXISTS checkins_member_update ON public.checkins;
DROP POLICY IF EXISTS checkins_teen_update ON public.checkins;
CREATE POLICY checkins_teen_update ON public.checkins
  FOR UPDATE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid()
        AND ca.child_id = public.checkins.child_id
        AND ca.role = 'child'
    )
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid()
        AND ca.child_id = public.checkins.child_id
        AND ca.role = 'child'
    )
  );

DROP POLICY IF EXISTS checkins_teen_delete ON public.checkins;
CREATE POLICY checkins_teen_delete ON public.checkins
  FOR DELETE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid()
        AND ca.child_id = public.checkins.child_id
        AND ca.role = 'child'
    )
  );

-- INSERT: unchanged (teen writes own check-ins; parent backfill, if kept,
-- goes through an explicit audited RPC — not direct INSERT).
GRANT DELETE ON public.checkins TO authenticated;

COMMENT ON TABLE public.checkins IS
  'Daily check-ins. SEC-001 (mig 047): raw rows are teen-only via RLS.
   Parents use checkin_daily_summary() (aggregates only, never text).';

-- ---------------------------------------------------------------------------
-- 3. Parent aggregate: counts + daily averages, never text / per-row values.
--    SECURITY DEFINER so parents get aggregates without row access.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkin_daily_summary(
  p_child_id uuid, p_from date, p_to date
)
RETURNS TABLE (
  checkin_date date,
  checkin_count bigint,
  avg_mood numeric,
  avg_energy numeric,
  avg_stress numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.checkin_date,
         COUNT(*),
         ROUND(AVG(c.mood), 2),
         ROUND(AVG(c.energy), 2),
         ROUND(AVG(c.stress), 2)
  FROM public.checkins c
  WHERE c.child_id = p_child_id
    AND c.checkin_date BETWEEN p_from AND p_to
    AND EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid() AND ca.child_id = p_child_id
    )
  GROUP BY c.checkin_date
  ORDER BY c.checkin_date;
$$;

REVOKE ALL ON FUNCTION public.checkin_daily_summary(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_daily_summary(uuid, date, date) TO authenticated;

COMMENT ON FUNCTION public.checkin_daily_summary(uuid, date, date) IS
  'SEC-001 parent path: per-day check-in counts and averages. Raw text and
   per-row mood/energy/stress are never exposed. Caller must hold any
   child_access row on the child.';

-- ---------------------------------------------------------------------------
-- 4. invite_consume_attempts: SEC-002 per-user throttle ledger.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invite_consume_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS invite_consume_attempts_user_time
  ON public.invite_consume_attempts (user_id, attempted_at DESC);

ALTER TABLE public.invite_consume_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invite_attempts_user_insert ON public.invite_consume_attempts;
CREATE POLICY invite_attempts_user_insert ON public.invite_consume_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS invite_attempts_user_select ON public.invite_consume_attempts;
CREATE POLICY invite_attempts_user_select ON public.invite_consume_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS invite_attempts_service_all ON public.invite_consume_attempts;
CREATE POLICY invite_attempts_service_all ON public.invite_consume_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.invite_consume_attempts IS
  'SEC-002: per-user throttle ledger for POST /api/v1/invites/consume
   (10 attempts / 10 min). Repeated failures are also audited to
   access_events as invite_consume_failed.';
