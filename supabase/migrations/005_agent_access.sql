-- Migration 005: Agent (Muse) access boundary — agent_reader role
-- Source: PLAN.md §4.10
-- The agent gets SELECT-only on tenant tables via a dedicated role.
-- NO grant on vault.secrets, vault_secret_id, or auth.users. RLS still applies.
-- Per-job scoping via agent_tenant_scope. Every agent read is audit-logged.

-- Dedicated role (no login; used via service-role-issued scoped JWTs or SET ROLE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_reader') THEN
    CREATE ROLE agent_reader NOLOGIN;
  END IF;
END
$$;

-- Per-job scope: which child the agent is acting on right now
CREATE TABLE IF NOT EXISTS public.agent_tenant_scope (
  job_id     text PRIMARY KEY,
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours'
);

-- Grants: SELECT on tenant data tables only.
-- (Carried-over tables from the ETL get their grants in the ETL migration;
--  core tables are granted here.)
GRANT SELECT ON public.children TO agent_reader;
GRANT SELECT ON public.classes TO agent_reader;
GRANT SELECT ON public.bell_schedules TO agent_reader;
GRANT SELECT ON public.child_settings TO agent_reader;
GRANT SELECT ON public.school_systems TO agent_reader;
GRANT SELECT ON public.child_portals_public TO agent_reader;  -- the SECRET-LESS view only
GRANT SELECT ON public.consents TO agent_reader;
GRANT SELECT ON public.audit_log TO agent_reader;

-- Explicitly: no grants on vault schema, child_portals base table, auth.users.
-- RLS policies on the tables above apply to agent_reader as well (RLS is on).

-- Agent-scoped read helper: asserts the job's child matches the row's child
CREATE OR REPLACE FUNCTION public.agent_assert_scope(p_job_id text, p_child_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agent_tenant_scope s
                 WHERE s.job_id = p_job_id AND s.child_id = p_child_id
                   AND s.expires_at > now()) THEN
    RAISE EXCEPTION 'agent_scope_violation';
  END IF;
  RETURN true;
END;
$$;

COMMENT ON ROLE agent_reader IS 'Muse agent: SELECT-only on tenant tables, no Vault, no auth.users. RLS still enforced.';
