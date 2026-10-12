-- Self-test for migration 026: resolve_visible_scopes() choke point.
--
-- Run against a database with migrations 001, 015, 017, 018, 021, 026 applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/test_026_scopes.sql
-- Everything runs inside one transaction and ROLLS BACK — no residue.
-- Requires INSERT on auth.users: run as superuser in CI.
--
-- Fixtures: one child, one teen user, one parent (granted), one stranger.

BEGIN;

DO $do$
DECLARE
  v_teen     uuid := gen_random_uuid();
  v_parent   uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_child    uuid := gen_random_uuid();
  v_scopes   text[];
  v_fail     text := '';
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_teen, 'teen-test@example.com'),
    (v_parent, 'parent-test@example.com'),
    (v_stranger, 'stranger-test@example.com')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, email, role) VALUES
    (v_teen, 'teen-test@example.com', 'child'),
    (v_parent, 'parent-test@example.com', 'parent'),
    (v_stranger, 'stranger-test@example.com', 'parent')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.children (id, first_name, last_name, slug, user_id)
  VALUES (v_child, 'Test', 'Teen', 'test-teen-' || substr(v_child::text, 1, 8), v_teen);

  -- Teen's own row (role='child') and a parent grant. The 025 trigger seeds
  -- default scopes: performance+communications allowed for the parent.
  INSERT INTO public.child_access (child_id, user_id, role, granted_by)
  VALUES (v_child, v_teen, 'child', 'system'),
         (v_child, v_parent, 'parent', 'child');

  -- 1. Teen sees all 7 scopes.
  v_scopes := public.resolve_visible_scopes(v_teen, v_child);
  IF NOT (v_scopes @> ARRAY['performance','communications','reflection','wellness','location','itinerary','safety_comms']) THEN
    v_fail := v_fail || 'teen must see all 7 scopes; ';
  END IF;

  -- 2. Parent with default grant: performance + communications + safety_comms.
  v_scopes := public.resolve_visible_scopes(v_parent, v_child);
  IF NOT (v_scopes = ARRAY['communications','performance','safety_comms']::text[]) THEN
    v_fail := v_fail || 'parent default scopes wrong: ' || v_scopes::text || '; ';
  END IF;

  -- 3. has_scope: reflection/wellness never leak to the parent.
  IF public.has_scope(v_parent, v_child, 'reflection') THEN
    v_fail := v_fail || 'parent must lack reflection; ';
  END IF;
  IF public.has_scope(v_parent, v_child, 'wellness') THEN
    v_fail := v_fail || 'parent must lack wellness; ';
  END IF;
  IF NOT public.has_scope(v_teen, v_child, 'reflection') THEN
    v_fail := v_fail || 'teen must have reflection; ';
  END IF;
  IF NOT public.has_scope(v_teen, v_child, 'wellness') THEN
    v_fail := v_fail || 'teen must have wellness; ';
  END IF;

  -- 4. Stranger (never linked): safety_comms only.
  v_scopes := public.resolve_visible_scopes(v_stranger, v_child);
  IF NOT (v_scopes = ARRAY['safety_comms']::text[]) THEN
    v_fail := v_fail || 'stranger must see safety_comms only; ';
  END IF;

  -- 5. Cooling state: scopes unchanged (frozen view is time-filtered instead).
  UPDATE public.child_access SET status = 'pending_cooling',
    frozen_view_at = now() WHERE child_id = v_child AND user_id = v_parent;
  v_scopes := public.resolve_visible_scopes(v_parent, v_child);
  IF NOT (v_scopes = ARRAY['communications','performance','safety_comms']::text[]) THEN
    v_fail := v_fail || 'cooling must keep scopes; ';
  END IF;
  IF public.cooling_freeze_at(v_parent, v_child) IS NULL THEN
    v_fail := v_fail || 'freeze timestamp must be set; ';
  END IF;

  -- 6. Revoked: safety_comms only — zero leakage after revoke.
  UPDATE public.child_access SET status = 'revoked', revoked_at = now(),
    frozen_view_at = NULL WHERE child_id = v_child AND user_id = v_parent;
  v_scopes := public.resolve_visible_scopes(v_parent, v_child);
  IF NOT (v_scopes = ARRAY['safety_comms']::text[]) THEN
    v_fail := v_fail || 'revoked must see safety_comms only; ';
  END IF;
  IF public.has_scope(v_parent, v_child, 'performance') THEN
    v_fail := v_fail || 'revoked must lack performance; ';
  END IF;

  -- 7. Teen toggles a scope up: parent gains it, nothing else changes.
  UPDATE public.child_access SET status = 'active'
  WHERE child_id = v_child AND user_id = v_parent;
  UPDATE public.access_scopes SET allowed = true, updated_by = v_teen
  WHERE child_id = v_child AND user_id = v_parent AND scope = 'location';
  IF NOT public.has_scope(v_parent, v_child, 'location') THEN
    v_fail := v_fail || 'teen-granted location must be visible; ';
  END IF;
  IF public.has_scope(v_parent, v_child, 'wellness') THEN
    v_fail := v_fail || 'wellness must stay private; ';
  END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION 'SCOPE CHOKEPOINT FAILURES: %', v_fail;
  END IF;
  RAISE NOTICE 'test_026_scopes: all assertions passed';
END $do$;

ROLLBACK;
