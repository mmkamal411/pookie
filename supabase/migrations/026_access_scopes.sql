-- Migration 026: visibility scopes — access_scopes + resolve_visible_scopes().
--
-- Design refs: sol-access §2, FR-ACCESS-006, EXPERT-SOLUTIONS §G.
-- NUMBERING NOTE: canonical §G reserved 022 for this; MD reconciliation
-- (commit 306c8e5, 2026-10-12) renumbered the migration chain to 026.
--
-- [ADAPT] sol-access assumed child_access(id uuid PK). Shipped schema uses
-- PRIMARY KEY (child_id, user_id), so access_scopes keys on the composite.
--
-- PART 0 amends Team 1's 018: panel-redesign columns it did not include, and
-- widens the status CHECK to a superset so both spellings of the cooling state
-- are honored ('scheduled_revoke' = Team 1's 018 spelling, 'pending_cooling' =
-- panel §1.4.1 canonical). Additive only — 018's RPCs keep working.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / constraint guards / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- Part 0 — authority columns missing from 018 (sol-access §1.1)
-- ---------------------------------------------------------------------------
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id);
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS revoke_reason_code text REFERENCES public.access_reason_codes(code);
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS cooling_off_started_at timestamptz;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS frozen_view_at timestamptz;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS notify_mode text NOT NULL DEFAULT 'at_effect'
  CHECK (notify_mode IN ('at_effect', 'immediate', 'suppressed'));
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS safe_exit boolean NOT NULL DEFAULT false;
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS trusted_adult_user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.child_access ADD COLUMN IF NOT EXISTS trusted_adult_declined boolean NOT NULL DEFAULT false;

-- Widen status to the panel superset (keeps 018's 'scheduled_revoke' valid).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'child_access_status_check') THEN
    ALTER TABLE public.child_access DROP CONSTRAINT child_access_status_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'child_access_status_check') THEN
    ALTER TABLE public.child_access
      ADD CONSTRAINT child_access_status_check
      CHECK (status IN ('active', 'pending_cooling', 'revoked', 'suspended_court', 'scheduled_revoke'));
  END IF;
END
$$;

COMMENT ON COLUMN public.child_access.frozen_view_at IS
  'During a cooling state the grantee sees only rows with created_at <= this timestamp (sol-access §1.4).';

-- ---------------------------------------------------------------------------
-- Part 1 — access_scopes: per-person × per-scope visibility (sol-access §2.2)
-- safety_comms is intentionally absent: never toggleable, never revoked.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_scopes (
  child_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN
    ('performance', 'communications', 'reflection', 'wellness', 'location', 'itinerary')),
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (child_id, user_id, scope),
  FOREIGN KEY (child_id, user_id)
    REFERENCES public.child_access (child_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS access_scopes_lookup
  ON public.access_scopes (child_id, user_id) WHERE allowed;

COMMENT ON TABLE public.access_scopes IS
  'Per-grantee visibility toggles. Only the teen (or system lifecycle events)
   may change allowed. safety_comms is not stored here — it always flows.';

-- Seed default scopes on every new grant (sol-access §2.4):
-- performance + communications visible; reflection/wellness/location/itinerary
-- teen-private. The teen''s own (role=''child'') row gets all-true.
CREATE OR REPLACE FUNCTION public.access_scopes_seed_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.access_scopes (child_id, user_id, scope, allowed)
  SELECT NEW.child_id, NEW.user_id, s.scope,
         (NEW.role = 'child' OR s.scope IN ('performance', 'communications'))
  FROM (VALUES ('performance'), ('communications'), ('reflection'),
               ('wellness'), ('location'), ('itinerary')) AS s(scope)
  ON CONFLICT (child_id, user_id, scope) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS child_access_seed_scopes ON public.child_access;
CREATE TRIGGER child_access_seed_scopes
AFTER INSERT ON public.child_access
FOR EACH ROW EXECUTE FUNCTION public.access_scopes_seed_defaults();

-- Backfill scope rows for grants that predate this migration.
INSERT INTO public.access_scopes (child_id, user_id, scope, allowed)
SELECT ca.child_id, ca.user_id, s.scope,
       (ca.role = 'child' OR s.scope IN ('performance', 'communications'))
FROM public.child_access ca
CROSS JOIN (VALUES ('performance'), ('communications'), ('reflection'),
                   ('wellness'), ('location'), ('itinerary')) AS s(scope)
ON CONFLICT (child_id, user_id, scope) DO NOTHING;

-- Helper for the anti-coercion flow (sol-access §5.3): zero all scopes on a
-- grant; the teen re-enables privately in Sharing.
CREATE OR REPLACE FUNCTION public.zero_access_scopes(p_child_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.access_scopes SET allowed = false, updated_at = now()
  WHERE child_id = p_child_id AND user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.zero_access_scopes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zero_access_scopes(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 2 — the choke point (sol-access §2.5).
-- resolve_visible_scopes(p_viewer, p_child_id) -> text[]
--   teen (own child_access role=''child'' row) -> all 7 scopes
--   active/cooling grantee                        -> allowed scopes + safety_comms
--   revoked / blocked / never-linked              -> safety_comms only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_visible_scopes(p_viewer uuid, p_child_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scopes text[];
BEGIN
  -- The teen sees everything on their own record (incl. H2/H3).
  IF EXISTS (
    SELECT 1 FROM public.child_access
    WHERE child_id = p_child_id AND user_id = p_viewer AND role = 'child'
  ) THEN
    RETURN ARRAY['performance', 'communications', 'reflection', 'wellness',
                 'location', 'itinerary', 'safety_comms'];
  END IF;

  -- Active or cooling grantee: their allowed scopes. 'scheduled_revoke' is
  -- Team 1's 018 spelling of the cooling state — honored identically.
  IF EXISTS (
    SELECT 1 FROM public.child_access
    WHERE child_id = p_child_id AND user_id = p_viewer
      AND status IN ('active', 'pending_cooling', 'scheduled_revoke')
  ) THEN
    SELECT COALESCE(array_agg(s.scope ORDER BY s.scope), '{}') INTO v_scopes
    FROM public.access_scopes s
    JOIN public.child_access ca
      ON ca.child_id = s.child_id AND ca.user_id = s.user_id
    WHERE s.child_id = p_child_id AND s.user_id = p_viewer AND s.allowed;
    RETURN v_scopes || 'safety_comms';
  END IF;

  -- Revoked / blocked / never-linked: the safety channel only (sol-access §1.2b.3).
  RETURN ARRAY['safety_comms'];
END $$;

REVOKE ALL ON FUNCTION public.resolve_visible_scopes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_visible_scopes(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_scope(p_viewer uuid, p_child_id uuid, p_scope text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT $3 = ANY (public.resolve_visible_scopes($1, $2));
$$;
REVOKE ALL ON FUNCTION public.has_scope(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_scope(uuid, uuid, text) TO authenticated, service_role;

-- Cooling-state frozen view (sol-access §1.4): read paths append
-- AND created_at <= cooling_freeze_at(viewer, child) when non-NULL.
CREATE OR REPLACE FUNCTION public.cooling_freeze_at(p_viewer uuid, p_child_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ca.frozen_view_at FROM public.child_access ca
  WHERE ca.child_id = p_child_id AND ca.user_id = p_viewer
    AND ca.status IN ('pending_cooling', 'scheduled_revoke')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.cooling_freeze_at(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cooling_freeze_at(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: reads mirror the child_access arms. Writes: none for authenticated —
-- teen toggles go through a set_scope RPC (access team), default seeding via
-- the trigger above.
-- ---------------------------------------------------------------------------
ALTER TABLE public.access_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_scopes_select ON public.access_scopes;
CREATE POLICY access_scopes_select ON public.access_scopes
  FOR SELECT TO authenticated
  USING (
    -- own row
    user_id = auth.uid()
    -- the teen sees all rows on their own record
    OR EXISTS (SELECT 1 FROM public.child_access ca
               WHERE ca.child_id = access_scopes.child_id AND ca.user_id = auth.uid())
    -- an adult with an active/cooling grant sees the roster (Sharing screen)
    OR EXISTS (SELECT 1 FROM public.child_access mine
               WHERE mine.child_id = access_scopes.child_id
                 AND mine.user_id = auth.uid()
                 AND mine.status IN ('active', 'pending_cooling', 'scheduled_revoke'))
  );

DROP POLICY IF EXISTS access_scopes_service_all ON public.access_scopes;
CREATE POLICY access_scopes_service_all ON public.access_scopes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
