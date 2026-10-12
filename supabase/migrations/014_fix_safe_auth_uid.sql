-- Migration 014: M1 safe_auth_uid() fix
--
-- CONTEXT: Migrations 006–008 were already applied to the live `pookie` project
-- before the M1 security fix was ready. The Security Engineer's Phase-2b
-- prescription (BUILD-LOG.md 2026-10-11) called for editing the migration FILES,
-- but since 006–008 are already live, the fix ships here as a new migration
-- instead. Do NOT edit 006/007/008.
--
-- ROOT CAUSE: auth.uid() casts the JWT `sub` claim to uuid and RAISES on
-- non-UUID subs instead of failing closed. Agent JWTs use sub='muse-agent'
-- (non-UUID), so every RLS evaluation touching auth.uid() hard-errors for
-- agent_reader instead of scoping (007) or denying (008).
--
-- FIX (3 parts):
--   Part 1: New safe_auth_uid() helper — returns NULL on missing claim or
--           non-UUID sub, so every predicate using it fails closed.
--   Part 2: Swap the three agent-path auth.uid() call sites to
--           public.safe_auth_uid().
--   Part 3: Missing EXECUTE grants for agent_reader on the 007/008 helpers
--           (Postgres checks EXECUTE on policy-referenced functions as the
--           caller, SECURITY DEFINER notwithstanding).
--
-- IDEMPOTENT: All statements use CREATE OR REPLACE / DROP IF EXISTS / IF NOT EXISTS.
-- RISK: Low. safe_auth_uid() returns identical results to auth.uid() for all
-- valid UUID subs (i.e., every real user). Only non-UUID subs change behavior:
-- from "raise" to "NULL" (fail-closed). No data migration.
--
-- ---------------------------------------------------------------------------
-- Part 1 — safe_auth_uid() helper
-- Must exist before any policy references it (CREATE POLICY validates
-- expressions at creation time).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_sub text := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub');
BEGIN
  IF v_sub IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_sub::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.safe_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_auth_uid() TO authenticated, service_role, agent_reader;

-- ---------------------------------------------------------------------------
-- Part 2a — 006 study_plans_tenant_read: swap auth.uid() → safe_auth_uid()
-- (The NOT EXISTS arm is the agent path: agent readers take it when they have
-- no child_access row. With raw auth.uid(), a non-UUID sub raises here.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS study_plans_tenant_read ON public.study_plans;
CREATE POLICY study_plans_tenant_read ON public.study_plans
  FOR SELECT USING (
    child_id = ANY (public.current_child_ids())
    AND (
      safety_status = 'approved'
      OR NOT EXISTS (SELECT 1 FROM public.child_access ca
                     WHERE ca.user_id = public.safe_auth_uid()
                       AND ca.child_id = public.study_plans.child_id
                       AND ca.role = 'child')
    )
  );

-- ---------------------------------------------------------------------------
-- Part 2b — 007 is_household_member(): swap auth.uid() → safe_auth_uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_household_member(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner = public.safe_auth_uid()  -- owners always see their own list
      OR EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
                 WHERE public.household_owner_for_child(c.cid) = p_owner)
$$;

-- ---------------------------------------------------------------------------
-- Part 2c — 008 is_household_parent(): swap auth.uid() → safe_auth_uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_household_parent(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
    JOIN public.child_access ca
      ON ca.child_id = c.cid AND ca.user_id = public.safe_auth_uid() AND ca.role = 'parent'
    WHERE public.household_owner_for_child(c.cid) = p_owner
  )
$$;

-- ---------------------------------------------------------------------------
-- Part 3 — EXECUTE grants for agent_reader on 007/008 helpers
-- Without these, every agent query on 007/008 tables dies with
-- "permission denied for function" even after the UUID-sub fix.
-- (current_child_ids() keeps default PUBLIC execute — no change needed.)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.household_owner_for_child(uuid) TO authenticated, service_role, agent_reader;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated, service_role, agent_reader;
GRANT EXECUTE ON FUNCTION public.is_household_parent(uuid) TO authenticated, service_role, agent_reader;

-- ---------------------------------------------------------------------------
-- Verification (run after applying; all should return 0 rows / expected values)
-- ---------------------------------------------------------------------------
-- 1. Function exists and is callable:
--    SELECT public.safe_auth_uid();  -- expect NULL (no JWT in SQL editor)
-- 2. Policies reference the new function:
--    SELECT policyname FROM pg_policies
--     WHERE schemaname='public' AND tablename='study_plans'
--       AND policyname='study_plans_tenant_read'
--       AND pg_get_expr(polqual, polrelid) LIKE '%safe_auth_uid%';
--    -- expect 1 row
-- 3. Grants present:
--    SELECT grantee FROM information_schema.routine_privileges
--     WHERE routine_schema='public'
--       AND routine_name IN ('safe_auth_uid','is_household_member',
--                            'is_household_parent','household_owner_for_child')
--       AND grantee='agent_reader';
--    -- expect 4 rows
