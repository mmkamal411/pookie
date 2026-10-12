-- Staged DDL + RPCs: emergency access grants (Platform Team 1 Backend).
--
-- Fold into the renumbered migration that owns emergency access (was 022).
-- Depends on: 018-table-changes (child_access), canonical 021
-- (access_events, log_access_event, access_reason_codes incl.
-- 00_reason_codes.sql).
--
-- Break-glass, two paths (locked): teen-configured safety net + LE legal
-- path. There is NO civilian self-serve insert path — rows are created ONLY
-- by the RPCs below. Disclosure tooling needs counsel sign-off before use
-- (NFR-LEGAL gate); this ships the data model + enforcement, not the UI.
-- D5: the court_order path is service_role-only (manual court-order queue
-- operator) — no automated custody enforcement in v1.

-- ---------------------------------------------------------------------------
-- Table (fold the DDL into the migration body; idempotent guards kept)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_access_grants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  granted_to       uuid NOT NULL REFERENCES auth.users(id),
  path             text NOT NULL,
  corroboration_ref text,
  scope            text[] NOT NULL DEFAULT '{location,medical_card}',
  expires_at       timestamptz NOT NULL,
  teen_notified_at timestamptz,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'emergency_access_grants_path_check') THEN
    ALTER TABLE public.emergency_access_grants
      ADD CONSTRAINT emergency_access_grants_path_check
      CHECK (path IN ('teen_configured', 'le_exigent', 'court_order'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'emergency_access_grants_scope_check') THEN
    ALTER TABLE public.emergency_access_grants
      ADD CONSTRAINT emergency_access_grants_scope_check
      -- Fixed allowlist: location + medical_card ONLY. Never reflection,
      -- wellness, health tiers, chats, or grades — enforced at the schema.
      CHECK (scope <@ ARRAY['location', 'medical_card']
             AND array_length(scope, 1) > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS emergency_access_grants_child_idx
  ON public.emergency_access_grants (child_id, expires_at);

COMMENT ON TABLE public.emergency_access_grants IS
  'Break-glass grants. Two paths: teen_configured (12h, teen-activated) and le_exigent / court_order (72h, operator-only). scope is schema-capped to location + medical_card — no other data class can ever flow through this table. No self-serve writes: rows are created only by create_emergency_grant().';

ALTER TABLE public.emergency_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_grants_scoped_read ON public.emergency_access_grants;
CREATE POLICY emergency_grants_scoped_read ON public.emergency_access_grants
  FOR SELECT USING (
    granted_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.emergency_access_grants.child_id
                  AND ca.user_id = auth.uid()
                  AND ca.role = 'child'
                  AND ca.status = 'active')
  );
-- No INSERT/UPDATE/DELETE policies: default-deny. RPCs are SECURITY DEFINER.

REVOKE ALL ON public.emergency_access_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.emergency_access_grants TO authenticated;
GRANT ALL ON public.emergency_access_grants TO service_role;

-- ---------------------------------------------------------------------------
-- create_emergency_grant(p_child_id, p_granted_to, p_path,
--                        p_corrobation_ref, p_scope) -> uuid
--   teen_configured : caller must be the teen (active role='child' row).
--                     12h TTL. teen_notified_at = now() (the teen activated
--                     it themselves).
--   le_exigent      : service_role ONLY (LE liaison backend). 72h TTL.
--                     corroboration_ref (report #, NOT freeform PII) required.
--   court_order     : service_role ONLY (manual court-order queue operator).
--                     72h TTL. corroboration_ref required (order reference).
-- scope must stay inside the fixed allowlist (schema CHECK enforces it).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_emergency_grant(
  p_child_id        uuid,
  p_granted_to      uuid,
  p_path            text,
  p_corrobation_ref text DEFAULT NULL,
  p_scope           text[] DEFAULT '{location,medical_card}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid := public.safe_auth_uid();
  v_jwt_role  text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  -- 015 convention: no JWT claims at all (direct SQL) or service_role JWT =
  -- privileged operator path. Everyone else goes through the teen path.
  v_operator  boolean := (v_jwt_role IS NULL) OR (v_jwt_role = 'service_role');
  v_is_teen   boolean := false;
  v_ttl       interval;
  v_grant_id  uuid;
  v_reason    text;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_granted_to IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF p_path IS NULL
     OR p_path NOT IN ('teen_configured', 'le_exigent', 'court_order') THEN
    RAISE EXCEPTION 'invalid_emergency_path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_granted_to) THEN
    RAISE EXCEPTION 'grantee_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) INTO v_is_teen;

  IF p_path = 'teen_configured' THEN
    IF NOT v_is_teen THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    v_ttl := INTERVAL '12 hours';
    v_reason := 'emergency_teen_path';
  ELSE
    -- LE exigent + court order: operator-only, never self-serve.
    IF NOT v_operator THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    IF p_corrobation_ref IS NULL OR btrim(p_corrobation_ref) = '' THEN
      RAISE EXCEPTION 'corroboration_required';
    END IF;
    v_ttl := INTERVAL '72 hours';
    v_reason := CASE WHEN p_path = 'le_exigent'
                     THEN 'emergency_le_path'
                     ELSE 'emergency_court_order' END;
  END IF;

  INSERT INTO public.emergency_access_grants
    (child_id, granted_to, path, corroboration_ref, scope,
     expires_at, teen_notified_at, created_by)
  VALUES
    (p_child_id, p_granted_to, p_path, p_corrobation_ref, p_scope,
     now() + v_ttl,
     CASE WHEN p_path = 'teen_configured' THEN now() END,
     v_caller)
  RETURNING id INTO v_grant_id;

  PERFORM public.log_access_event(
    p_child_id, v_caller, 'grant', p_granted_to, v_reason,
    jsonb_build_object('emergency_grant_id', v_grant_id, 'path', p_path));

  PERFORM public.audit_event(p_child_id, 'access.emergency_granted', 'user',
                             'emergency_access_grants', v_grant_id::text,
                             jsonb_build_object('path', p_path,
                                                'granted_to', p_granted_to));
  RETURN v_grant_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.create_emergency_grant(uuid, uuid, text, text, text[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.create_emergency_grant(uuid, uuid, text, text, text[])
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- revoke_emergency_grant(p_grant_id) -> boolean
-- The teen may revoke ANY emergency grant on their record at any time;
-- service_role (operator) may also revoke. Revocation expires the grant
-- immediately (the row is kept as the record).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_emergency_grant(p_grant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := public.safe_auth_uid();
  v_jwt_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_operator boolean := (v_jwt_role IS NULL) OR (v_jwt_role = 'service_role');
  v_grant    public.emergency_access_grants%ROWTYPE;
BEGIN
  IF p_grant_id IS NULL THEN RAISE EXCEPTION 'grant_required'; END IF;

  SELECT * INTO v_grant FROM public.emergency_access_grants
   WHERE id = p_grant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant_not_found';
  END IF;

  IF NOT v_operator
     AND NOT EXISTS (
       SELECT 1 FROM public.child_access ca
        WHERE ca.child_id = v_grant.child_id AND ca.user_id = v_caller
          AND ca.role = 'child' AND ca.status = 'active'
     ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.emergency_access_grants
     SET expires_at = now()
   WHERE id = p_grant_id;

  PERFORM public.log_access_event(
    v_grant.child_id, v_caller, 'revoke_effective', v_grant.granted_to,
    'emergency_revoked',
    jsonb_build_object('emergency_grant_id', p_grant_id));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_emergency_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_emergency_grant(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- expire_emergency_grants() -> integer
-- Cron (service_role only). Idempotent: a grant is logged exactly once,
-- tracked via the grant id in the event metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_emergency_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g       public.emergency_access_grants%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR g IN
    SELECT * FROM public.emergency_access_grants
     WHERE expires_at <= now()
       AND NOT EXISTS (
         SELECT 1 FROM public.access_events ae
          WHERE ae.event_type = 'revoke_effective'
            AND ae.reason_code = 'emergency_expired'
            AND ae.metadata ->> 'emergency_grant_id' = g.id::text
       )
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.log_access_event(
      g.child_id, NULL, 'revoke_effective', g.granted_to, 'emergency_expired',
      jsonb_build_object('emergency_grant_id', g.id, 'path', g.path));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_emergency_grants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_emergency_grants() TO service_role;
