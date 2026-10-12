-- Staged: timeboxed grants — expiry sweep (Platform Team 1 Backend).
--
-- Fold into the renumbered migration that owns the timeboxed columns
-- (was 023): child_access.expires_at / grant_kind / grant_purpose + the
-- partial index below. The sweep RPC lives here, staged.
-- Depends on: 018-table-changes (child_access), canonical 021
-- (access_events, log_access_event), the timeboxed columns themselves.

-- ---------------------------------------------------------------------------
-- Partial index for the expiry sweep (fold into the migration DDL):
--
-- CREATE INDEX IF NOT EXISTS child_access_expiry_sweep_idx
--   ON public.child_access (expires_at)
--   WHERE expires_at IS NOT NULL AND status = 'active';
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- apply_expired_grants() -> integer
-- Cron (service_role only). Timeboxed ('occasion') grants whose expires_at
-- passed become 'revoked'. NO re-request lockout: a natural expiry is not
-- a revocation — the granter may issue the next occasion grant immediately
-- (D6 caps still apply). One ledger row per expiry.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_expired_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       public.child_access%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.child_access
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now()
     WHERE child_id = r.child_id AND user_id = r.user_id;
    PERFORM public.log_access_event(
      r.child_id, NULL, 'revoke_effective', r.user_id, 'expiry',
      jsonb_build_object('grant_kind', r.grant_kind,
                         'grant_purpose', r.grant_purpose));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_expired_grants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_expired_grants() TO service_role;
