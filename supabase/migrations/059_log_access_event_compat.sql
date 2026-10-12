-- Migration 059: log_access_event() 7-param compat overload (repairs 051 caller breakage)
--
-- CONTEXT: 021 defined log_access_event(child, actor, event_type,
-- subject DEFAULT, reason DEFAULT, metadata DEFAULT, amount_cents DEFAULT).
-- Eleven runtime call sites were written against that shape and resolve their
-- call at execution time, not at apply time:
--   023_health_reconsent.sql      x5 (health_reconsent_complete,
--                                   health_reconsent_skipped_private,
--                                   health_cutover_18, health_deletion_requested,
--                                   transition_summary_export)
--   024_health_grace_and_deletion.sql x3 (health_grace_expired,
--                                   hide_past_health, health_deletion)
--   030_sud_separation.sql        x2 (sud_disclosure_consented/_revoked)
--   034_support_grants.sql        x1 (support.grant.expired)
-- All pass (child, actor, event_text, NULL, NULL, metadata jsonb).
-- 051 dropped the 7-param overload, so every one of those functions now
-- raises 42883 at runtime. Two app call sites use the same shape with named
-- args and break the same way:
--   src/app/api/v1/support/grants/[id]/decision/route.ts (fallback audit)
--   src/app/api/v1/travel/purchase/check/route.ts (denial audit)
--
-- FIX: restore 021's overload VERBATIM (same name, param order, defaults,
-- body). This is unambiguous against 051's canonical 8-arg form: the only
-- positional calls in the tree pass 6 args whose 3rd is text and 6th is
-- jsonb, which can never resolve to (uuid, uuid, uuid, text, ...). Verified
-- by repo-wide sweep 2026-10-12 (Squad 4 DB remediation): no 7-positional
-- call exists that could misresolve. Named-arg callers (p_child_id,
-- p_actor_user_id, p_event_type, ...) also resolve uniquely.
--
-- WHY NOT rewrite the 11 sites to the canonical 8-arg form: the canonical
-- form has no metadata slot, so rewriting would silently drop audit metadata
-- (tiers_cut, grace_days, grant_id, scope) that compliance flows rely on.
-- The compat overload preserves it.
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION / REVOKE+GRANT. Safe to re-run.
-- GRANT MODEL (021 convention): EXECUTE for authenticated + service_role.

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

COMMENT ON FUNCTION public.log_access_event(uuid, uuid, text, uuid, text, jsonb, integer) IS
  'Compat overload (restored from 021 by 059): (child, actor, event_type, subject, reason, metadata, amount_cents). Coexists with the canonical 8-arg form (051); overload resolution is unambiguous (verified 2026-10-12). New code SHOULD prefer the canonical form, but this overload stays for the metadata-carrying audit calls in 023/024/030_sud/034 and the support/travel route fallbacks.';
