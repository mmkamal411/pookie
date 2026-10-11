-- Migration 005: Agent (Muse) access boundary — agent_reader role
-- Source: PLAN.md §4.10
-- The agent gets SELECT-only on tenant tables via a dedicated role.
-- NO grant on vault.secrets, vault_secret_id, or auth.users. RLS still applies.
-- Per-job scoping via agent_tenant_scope. Every agent read is audit-logged.
--
-- ROUND-1 FIXES 2026-10-11 (Database expert — Data & Tenancy / RLS correctness):
--   F1  agent_tenant_scope TABLE MOVED TO 001. Rationale: 001's
--       current_child_ids() is LANGUAGE sql, and Postgres validates a SQL
--       function body at CREATE time — the table must exist before 001
--       defines the function. The table, its expires_at index, and its
--       RLS enablement (deny-all, no policies) now live in 001; this file
--       keeps the reader/writer contract documented here.
--   F2  The agent path was specified but non-functional: agent_reader holds
--       no child_access rows, so auth.uid()-based RLS returned EMPTY for
--       every granted table. Fixed in 001: current_child_ids() is now
--       agent-aware — when the verified JWT carries role='agent_reader', the
--       tenant set resolves from agent_tenant_scope via the service-minted
--       job_id claim. No new per-table policies were needed: every tenant
--       RLS policy funnels through current_child_ids(), so the job scope is
--       enforced by RLS itself, not by query convention. Expired/missing
--       scope -> '{}' -> deny (fail-closed).
--       AGENT JWT CONTRACT (minted by the backend with the project's JWT
--       secret; the agent can never widen its own scope):
--         { "role": "agent_reader", "job_id": "<agent_tenant_scope.job_id>",
--           "sub": "muse-agent", "exp": <short-lived> }
--       Backend flow: insert the scope row (service_role) at job creation ->
--       mint the JWT -> agent uses it for PostgREST/RPC for that job only.
--       agent_assert_scope(job_id, child_id) remains for explicit assertions
--       (and for the direct-psql/SET ROLE path, where request.jwt.claims is
--       absent and current_child_ids() cannot see the job).
--   F3  EXECUTE hardening: agent_assert_scope revoked from PUBLIC, granted
--       to service_role + agent_reader only. audit_event EXECUTE granted to
--       agent_reader here (004 defines it but runs before this role exists).
--   F4  Explicit GRANT USAGE ON SCHEMA public TO agent_reader.
--   F5  CROSS-WORKSTREAM FLAG (003 owner): the GRANT SELECT ON
--       child_portals_public TO agent_reader below is currently INERT — 003's
--       Round-1 fix made the view security_invoker with a parent-role-only
--       RLS policy, so the agent (never a parent member) reads 0 rows
--       through it. Either drop this grant or have 003 add an agent-reader
--       SELECT arm. Kept as-is here pending that decision; it grants no data
--       today.
--   F6  CROSS-WORKSTREAM FLAG (ETL migration owner): the carried-over tables
--       (checkins, tutor_chat, private_notes, class_emails, sync_requests,
--       studentvue_syncs, parent_sync, merged_syncs, grade_history,
--       daily_content, peer_tips, ...) need `GRANT SELECT ... TO
--       agent_reader` in the ETL migration, or agent reads of those tables
--       fail with permission-denied. RLS on those tables will scope the agent
--       automatically via the 001 fix — no per-table agent policies needed.

-- Dedicated role (no login; used via service-role-issued scoped JWTs or SET ROLE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_reader') THEN
    CREATE ROLE agent_reader NOLOGIN;
  END IF;
END
$$;

-- Explicit schema usage for the dedicated role (defense in depth; USAGE on
-- public is normally present via PUBLIC default, but the agent boundary
-- should not depend on defaults).
GRANT USAGE ON SCHEMA public TO agent_reader;

-- Per-job scope table: see 001 (created there; RLS deny-all, no policies).
-- Writers: service_role only (backend mints scope rows at job creation).
-- Readers: SECURITY DEFINER helpers only (current_child_ids in 001,
-- agent_assert_scope below).

-- Grants: SELECT on tenant data tables only.
-- (Carried-over tables from the ETL get their grants in the ETL migration;
--  core tables are granted here. See F6 flag above.)
GRANT SELECT ON public.children TO agent_reader;
GRANT SELECT ON public.classes TO agent_reader;
GRANT SELECT ON public.bell_schedules TO agent_reader;
GRANT SELECT ON public.child_settings TO agent_reader;
GRANT SELECT ON public.school_systems TO agent_reader;
GRANT SELECT ON public.child_portals_public TO agent_reader;  -- the SECRET-LESS view only
-- F5: currently inert (003's parent-only policy) — pending 003-owner decision.
GRANT SELECT ON public.consents TO agent_reader;
GRANT SELECT ON public.audit_log TO agent_reader;

-- Explicitly: no grants on vault schema, child_portals base table, auth.users,
-- public.users, invites (invite tokens are bearer secrets), child_access.
-- RLS policies on the tables above apply to agent_reader as well (RLS is on);
-- with the 001 fix, current_child_ids() resolves the job's scope for the
-- agent, so those policies enforce the per-job boundary automatically.

-- Agent-scoped read helper: asserts the job's child matches the row's child.
-- Explicit per-call assertion for code paths that want it (and the only
-- scoping mechanism on the direct-psql/SET ROLE path, where the JWT claim is
-- absent). SECURITY DEFINER so it can read the deny-all scope table.
-- FIX 2026-10-11 (F3): EXECUTE revoked from PUBLIC — the (job_id, child_id)
-- validity oracle is not for anonymous callers.
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

REVOKE ALL ON FUNCTION public.agent_assert_scope(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_assert_scope(text, uuid) TO service_role, agent_reader;

-- FIX 2026-10-11 (F3): the agent's audit path. 004 grants EXECUTE on
-- audit_event to authenticated + service_role; the role did not exist yet
-- there, so the agent_reader grant lives here. audit_event()'s member
-- branch resolves the agent's job scope via current_child_ids(), so the
-- agent can only log events for its scoped child.
GRANT EXECUTE ON FUNCTION public.audit_event(uuid, text, text, text, text, jsonb)
  TO agent_reader;

COMMENT ON ROLE agent_reader IS 'Muse agent: SELECT-only on tenant tables, no Vault, no auth.users. RLS still enforced; tenant set comes from the service-minted job_id JWT claim via current_child_ids().';
