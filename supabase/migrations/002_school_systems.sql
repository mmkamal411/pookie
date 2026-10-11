-- Migration 002: School system adapter registry + classes + bell schedules
-- Source: PLAN.md §3.1, §4.9
-- Cobb County (ParentVUE/StudentVUE + CTLS) ships as Adapter #1.
-- Adding a system later = 1 row here + adapter module implementing the contract.

-- ---------------------------------------------------------------------------
-- school_systems: the adapter registry (config table, read by workers + UI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_systems (
  system_key         text PRIMARY KEY,          -- e.g. 'cobb-county-ga'
  display_name       text NOT NULL,             -- e.g. 'Cobb County School District'
  adapter_module     text NOT NULL,             -- e.g. 'cobb_adapter'
  auth_flow          text NOT NULL CHECK (auth_flow IN ('userpass','oauth','sso')),
  credential_fields  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- UI renders these, e.g. [{"key":"username","label":"StudentVUE username","type":"text"}]
  grade_scale_default jsonb,
  term_structure     text NOT NULL DEFAULT 'semesters' CHECK (term_structure IN ('semesters','trimesters','quarters')),
  sync_cadence       text NOT NULL DEFAULT 'daily',
  notes              text,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11 R2 (integration-expert H2-H5, M1-M2): registry completeness.
-- The registry is a config table, not code — adapters must be configurable
-- declaratively. New columns: oauth_config (required when auth_flow='oauth':
-- authorize/token URLs, scopes, client-id reference, redirect URI),
-- auth_requirements (per-system auth constraints the Portals UI warns about,
-- e.g. approved-device mandates), api_endpoints (per-system/district base
-- URLs — per-district URLs stay out of adapter code), rate_limits
-- (machine-readable claim throttles for workers), capabilities (which
-- contract methods the system supports), contract_version (adapter contract
-- version; workers fail closed on unknown majors). ALTER TABLE ... IF NOT
-- EXISTS keeps re-runs idempotent where the table already exists from R1.
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_systems
  ADD COLUMN IF NOT EXISTS oauth_config       jsonb,
  ADD COLUMN IF NOT EXISTS auth_requirements  jsonb,
  ADD COLUMN IF NOT EXISTS api_endpoints      jsonb,
  ADD COLUMN IF NOT EXISTS rate_limits       jsonb,
  ADD COLUMN IF NOT EXISTS capabilities      jsonb,
  ADD COLUMN IF NOT EXISTS contract_version  text NOT NULL DEFAULT 'v1';

-- Seed: Cobb County as Adapter #1
INSERT INTO public.school_systems
  (system_key, display_name, adapter_module, auth_flow, credential_fields, grade_scale_default, term_structure, sync_cadence, notes)
VALUES
  ('cobb-county-ga', 'Cobb County School District', 'cobb_adapter', 'userpass',
   '[{"key":"studentvue_username","label":"StudentVUE username","type":"text"},{"key":"studentvue_password","label":"StudentVUE password","type":"password"},{"key":"parentvue_username","label":"ParentVUE username (optional)","type":"text"},{"key":"parentvue_password","label":"ParentVUE password (optional)","type":"password"}]'::jsonb,
   '{"A":[90,100],"B":[80,89],"C":[74,79],"D":[70,73],"F":[0,69]}'::jsonb,
   'semesters', 'daily',
   'Adapter #1. StudentVUE via laptop worker (Conditional Access blocks sandbox); ParentVUE via parent cron.')
ON CONFLICT (system_key) DO NOTHING;

-- FIX 2026-10-11 R2 (integration-expert H9, H3, M1): fuller credential_fields
-- spec {key,label,type,secret,required,placeholder?,options?,order} on the
-- Cobb seed row, plus its known auth_requirements (Cobb Conditional Access
-- blocks non-approved devices — the Portals UI must warn BEFORE a parent
-- saves credentials) and capabilities (the four Adapter #1 contract
-- methods). UPDATE (not just the INSERT above) so re-runs of this migration
-- backfill the fuller spec on projects seeded by the older row shape.
UPDATE public.school_systems
SET credential_fields =
      '[{"key":"studentvue_username","label":"StudentVUE username","type":"text","secret":false,"required":true,"placeholder":"e.g. jdoe27","order":1},{"key":"studentvue_password","label":"StudentVUE password","type":"password","secret":true,"required":true,"order":2},{"key":"parentvue_username","label":"ParentVUE username (optional)","type":"text","secret":false,"required":false,"placeholder":"Optional - one ParentVUE login covers all children","order":3},{"key":"parentvue_password","label":"ParentVUE password (optional)","type":"password","secret":true,"required":false,"order":4}]'::jsonb,
    auth_requirements =
      '{"approved_device_required":true,"notes":"Cobb Conditional Access blocks automated and sandbox logins (error 53003). StudentVUE sync must run on an approved device/profile via the parent laptop worker; ParentVUE via the parent cron."}'::jsonb,
    capabilities =
      '{"get_grades":true,"get_assignments":true,"get_attendance":true,"get_messages":true}'::jsonb
WHERE system_key = 'cobb-county-ga';

-- ---------------------------------------------------------------------------
-- classes: replaces class-schedule.json + grade-weights.json (per child)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  name          text NOT NULL,                 -- canonical, e.g. 'Geometry'
  display_name  text,                          -- e.g. 'Geometry (H)'
  class_slug    text NOT NULL,                 -- e.g. 'geometry'
  period        text,                          -- e.g. '6th'
  teacher_name  text,
  teacher_email text,
  display_order int  NOT NULL DEFAULT 0,
  aliases       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- schedule-matching aliases
  grade_weights jsonb,                                   -- real category weights
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, class_slug)
);

CREATE INDEX IF NOT EXISTS classes_child_id_idx ON public.classes (child_id);

-- ---------------------------------------------------------------------------
-- bell_schedules: per child
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bell_schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  day_type   text NOT NULL DEFAULT 'regular',  -- regular | early_release | late_start
  periods    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, day_type)
);

-- ---------------------------------------------------------------------------
-- child_settings: per-tenant preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_settings (
  child_id     uuid PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
  school_system text NOT NULL DEFAULT 'cobb-county-ga' REFERENCES public.school_systems(system_key),
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_window   jsonb NOT NULL DEFAULT '{"start":"06:00","end":"22:00"}'::jsonb,
  retention     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS: everything tenant-scoped via current_child_ids()
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_settings ENABLE ROW LEVEL SECURITY;

-- school_systems: public read (registry), no client write.
-- Writes are intentionally owner/service_role-only (no write policy): the
-- adapter registry is platform config, not per-family data. A new school
-- system ships as a migration, never as a client write.
CREATE POLICY school_systems_read ON public.school_systems FOR SELECT USING (true);

-- FIX 2026-10-11: least privilege on tenant config tables. The original
-- FOR ALL policies let child-role users INSERT/UPDATE/DELETE classes,
-- bell_schedules and child_settings (grade_weights corruption, schedule
-- deletion). Reads stay member-wide; writes are parent-role-only.
CREATE POLICY classes_tenant_read ON public.classes
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

CREATE POLICY classes_parent_write ON public.classes
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.classes.child_id AND ca.role = 'parent')
  );

CREATE POLICY classes_parent_update ON public.classes
  FOR UPDATE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.classes.child_id AND ca.role = 'parent')
  );

CREATE POLICY classes_parent_delete ON public.classes
  FOR DELETE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.classes.child_id AND ca.role = 'parent')
  );

CREATE POLICY bell_schedules_tenant_read ON public.bell_schedules
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

CREATE POLICY bell_schedules_parent_write ON public.bell_schedules
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.bell_schedules.child_id AND ca.role = 'parent')
  );

CREATE POLICY bell_schedules_parent_update ON public.bell_schedules
  FOR UPDATE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.bell_schedules.child_id AND ca.role = 'parent')
  );

CREATE POLICY bell_schedules_parent_delete ON public.bell_schedules
  FOR DELETE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.bell_schedules.child_id AND ca.role = 'parent')
  );

CREATE POLICY child_settings_tenant_read ON public.child_settings
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

CREATE POLICY child_settings_parent_write ON public.child_settings
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.child_settings.child_id AND ca.role = 'parent')
  );

CREATE POLICY child_settings_parent_update ON public.child_settings
  FOR UPDATE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.child_settings.child_id AND ca.role = 'parent')
  );

CREATE POLICY child_settings_parent_delete ON public.child_settings
  FOR DELETE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.child_settings.child_id AND ca.role = 'parent')
  );

-- ---------------------------------------------------------------------------
-- FIX 2026-10-11: explicit GRANTs. RLS policies alone do not grant access;
-- without these, PostgREST returns permission-denied for every client role.
-- Grants are deliberately broad; RLS policies above are the narrow gate.
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.school_systems TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bell_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_settings TO authenticated;
