-- Migration 062: rpc_set_health_grant() — per-tier per-parent health toggles
--
-- CONTEXT: src/lib/health/actions.ts (Settings → Sharing → Health) calls
-- rpc_set_health_grant(p_child_id, p_grantee_user_id, p_tier, p_enabled),
-- but no migration ever created it — the toggle failed closed with
-- "backend_not_ready". Squad 2's PM-BACKLOG lists it as backend dependency
-- D1 ("Squad 2 backend provides it per §2.3 semantics"); this migration
-- implements it now (Squad 4 DB remediation) so the shipped UI works.
-- Squad 2: please review against sol-health §2.3; the contract below is
-- exactly the PM-BACKLOG acceptance signature.
--
-- SEMANTICS (sol-health §2.3):
--   * One ACTIVE row per (child_id, granter, grantee, tier) in
--     health_consent_grants; no row = no access (deny by default in
--     health_tier_visible()). Enforced structurally by a partial unique
--     index (062) on top of the procedural upsert.
--   * H3/H0 can never get a row: refused here with a clean error, and the
--     022 CHECK constraints (health_grant_no_h3 / _no_h0) are the backstop.
--   * Grants carry expires_at = NULL (revocable anytime by the granter, one
--     tap, instantly reversible): disabling sets status='revoked';
--     re-enabling reactivates the same row.
--   * Per parent: Mom and Dad are separate toggles (parallel-parenting safe).
-- AUTHORITY ("writable by granter only via RPC", 022 §5 + PM-BACKLOG):
--   * the caller must be the data subject (child-role on the child), or
--   * a parent-role holder while the child is under 13 (stewardship).
--   This mirrors the authority check the calling action already applies
--   (subject || (under13 && parent)).
--   * The grantee must be a linked parent on the same child (re-verified
--     server-side; the action pre-checks this too).
-- AUDIT: 'scope_changed' via the 059 compat overload (metadata carries
-- tier/enabled/grantee; no health content in the log).
--
-- REQUIRES: 022 (health_consent_grants, health_tier enum), 027 (is_minor_13),
--   059 (log_access_event 7-param overload).
--
-- IDEMPOTENT: CREATE UNIQUE INDEX IF NOT EXISTS / CREATE OR REPLACE /
-- REVOKE+GRANT. Safe to re-run.
-- GRANT MODEL: EXECUTE for authenticated only. Writes go through this RPC;
-- 022 already denies direct client INSERT/UPDATE/DELETE.

CREATE UNIQUE INDEX IF NOT EXISTS health_consent_grants_one_active
  ON public.health_consent_grants (child_id, granter_user_id, grantee_user_id, tier)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.rpc_set_health_grant(
  p_child_id uuid,
  p_grantee_user_id uuid,
  p_tier text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_subject boolean;
  v_is_steward boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_tier NOT IN ('H1', 'H2') THEN
    RAISE EXCEPTION 'health grant tier refused: % (only H1/H2 are grantable)', p_tier
      USING ERRCODE = 'P0001';
  END IF;

  IF p_child_id IS NULL OR p_grantee_user_id IS NULL OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'child, grantee and enabled are required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Authority: subject themself, or steward of an under-13 child.
  -- SECURITY (2026-10-12): status='active' required — revoked/scheduled_revoke
  -- rows must not pass the authority check.
  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = v_uid AND ca.child_id = p_child_id AND ca.role = 'child'
      AND ca.status = 'active'
  ) INTO v_is_subject;
  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = v_uid AND ca.child_id = p_child_id AND ca.role = 'parent'
      AND ca.status = 'active'
  ) AND public.is_minor_13(p_child_id) INTO v_is_steward;

  IF NOT (v_is_subject OR v_is_steward) THEN
    RAISE EXCEPTION 'only the data subject (or steward of an under-13 child) can change health grants'
      USING ERRCODE = 'P0001';
  END IF;

  -- Grantee must be a linked parent on the same child (parallel-parenting safe).
  -- SECURITY (2026-10-12): status='active' required.
  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = p_grantee_user_id AND ca.child_id = p_child_id
      AND ca.role = 'parent' AND ca.status = 'active'
  ) THEN
    RAISE EXCEPTION 'grantee is not a linked parent of this child'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_enabled THEN
    UPDATE public.health_consent_grants
       SET status = 'active',
           revoked_at = NULL,
           revoked_reason = NULL,
           expires_at = NULL,
           granted_at = now()
     WHERE child_id = p_child_id
       AND granter_user_id = v_uid
       AND grantee_user_id = p_grantee_user_id
       AND tier = p_tier::public.health_tier
       AND status <> 'active';
    IF NOT FOUND THEN
      INSERT INTO public.health_consent_grants
        (child_id, granter_user_id, grantee_user_id, tier, status, expires_at)
      VALUES (p_child_id, v_uid, p_grantee_user_id,
              p_tier::public.health_tier, 'active', NULL)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    UPDATE public.health_consent_grants
       SET status = 'revoked',
           revoked_at = now(),
           revoked_reason = 'toggle_off'
     WHERE child_id = p_child_id
       AND granter_user_id = v_uid
       AND grantee_user_id = p_grantee_user_id
       AND tier = p_tier::public.health_tier
       AND status = 'active';
  END IF;

  PERFORM public.log_access_event(
    p_child_id, v_uid, 'scope_changed', NULL, NULL,
    jsonb_build_object('tier', p_tier, 'enabled', p_enabled,
                       'grantee_user_id', p_grantee_user_id));

  RETURN jsonb_build_object('status', 'ok', 'tier', p_tier, 'enabled', p_enabled);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_health_grant(uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_health_grant(uuid, uuid, text, boolean)
  TO authenticated;

COMMENT ON FUNCTION public.rpc_set_health_grant(uuid, uuid, text, boolean) IS
  'Per-tier per-parent health visibility toggle (sol-health §2.3). Granter = subject or under-13 steward; grantee must be a linked parent. H3/H0 ungrantable (structural). One active row per (child, granter, grantee, tier); disable revokes, re-enable reactivates. Created by 062 (Squad 4 DB remediation) for the shipped Settings → Sharing → Health UI.';
