-- Migration 067: Class resources + check-in uploads (Squad Telemetry E4)
-- Mehedi's Classes requirements (2026-10-12).
--
--   class_resources   — per-class resource library (seeded recs + student-added):
--                       Khan/YouTube/cheat sheets/games/ebooks/etc.
--   class-handouts    — private Supabase storage bucket, child-scoped paths:
--                       <child_id>/<class_slug>/<filename>
--   checkin_uploads   — metadata for handout/photo uploads linked to a check-in
--                       (+ class + auto unit tag).
--   checkin_class_details — field renames for the astronaut-debriefing UI (E5):
--                       worked_on -> covered, confusing -> fuzzy, + clicked.
--                       Final per-class fields: covered, clicked, fuzzy,
--                       due_next, confidence. (Day-level mood/energy/stress
--                       already live on checkins from 006.)
--
-- RLS: child-scoped via child_id = ANY (public.current_child_ids()) (001 pattern).
-- IDEMPOTENT: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / guarded renames /
-- DROP POLICY IF EXISTS / OR REPLACE. check.sh compliant.

-- ---------------------------------------------------------------------------
-- 0. checkin_class_details field renames (guarded; 066 applied 2026-10-12,
--    nothing reads the old names yet)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='checkin_class_details'
               AND column_name='worked_on') THEN
    ALTER TABLE public.checkin_class_details RENAME COLUMN worked_on TO covered;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='checkin_class_details'
               AND column_name='confusing') THEN
    ALTER TABLE public.checkin_class_details RENAME COLUMN confusing TO fuzzy;
  END IF;
END $$;

ALTER TABLE public.checkin_class_details
  ADD COLUMN IF NOT EXISTS clicked text;

COMMENT ON COLUMN public.checkin_class_details.covered IS
  'What was covered in class today (student words).';
COMMENT ON COLUMN public.checkin_class_details.clicked IS
  'What clicked — the concept that made sense today.';
COMMENT ON COLUMN public.checkin_class_details.fuzzy IS
  'What is still fuzzy / confusing.';
COMMENT ON COLUMN public.checkin_class_details.due_next IS
  'What is due next for this class.';

-- ---------------------------------------------------------------------------
-- 1. class_resources: per-class resource library
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_resources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id      uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 280),
  url           text,                                   -- NULL for uploads/notes
  resource_type text NOT NULL
                CHECK (resource_type IN ('khan_academy','youtube','cheat_sheet',
                      'clever','kahoot','blooket','quizlet','desmos','deltamath',
                      'ap_classroom','ebook','game','other')),
  description   text,
  unit_tag      text,                                   -- unit this resource serves
  is_seeded     boolean NOT NULL DEFAULT false,         -- true = Pookie recommendation
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provenance    text NOT NULL DEFAULT 'app_generated'
                CHECK (provenance IN ('school_of_record','app_generated')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_resources_child_class_idx
  ON public.class_resources (child_id, class_id, sort_order)
  WHERE is_active;

DROP TRIGGER IF EXISTS class_resources_touch ON public.class_resources;
CREATE TRIGGER class_resources_touch
  BEFORE UPDATE ON public.class_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_resources_tenant_read ON public.class_resources;
CREATE POLICY class_resources_tenant_read ON public.class_resources
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));

-- Any tenant member may add a resource; created_by is bound to the caller.
DROP POLICY IF EXISTS class_resources_member_insert ON public.class_resources;
CREATE POLICY class_resources_member_insert ON public.class_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND created_by = auth.uid()
  );

-- Update/delete: parent role, or the member who added it.
DROP POLICY IF EXISTS class_resources_owner_update ON public.class_resources;
CREATE POLICY class_resources_owner_update ON public.class_resources
  FOR UPDATE TO authenticated
  USING (
    child_id = ANY (public.current_child_ids())
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = public.class_resources.child_id
                   AND ca.role = 'parent')
    )
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = public.class_resources.child_id
                   AND ca.role = 'parent')
    )
  );

DROP POLICY IF EXISTS class_resources_owner_delete ON public.class_resources;
CREATE POLICY class_resources_owner_delete ON public.class_resources
  FOR DELETE TO authenticated
  USING (
    child_id = ANY (public.current_child_ids())
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = public.class_resources.child_id
                   AND ca.role = 'parent')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_resources TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. class-handouts storage bucket — SEE migration 068
--    (storage schema is not owned by the mgmt-API role; bucket + storage.objects
--    policies must be applied via the Supabase dashboard SQL editor)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. checkin_uploads: metadata for handout/photo uploads on a check-in
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_uploads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id  uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  unit_tag    text,                                     -- auto: classes.current_unit at upload
  file_path   text NOT NULL,                            -- '<child_id>/<class_slug>/<filename>'
  file_name   text NOT NULL,
  mime_type   text,
  size_bytes  bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provenance  text NOT NULL DEFAULT 'app_generated'
              CHECK (provenance IN ('school_of_record','app_generated')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkin_id, file_path)
);

CREATE INDEX IF NOT EXISTS checkin_uploads_checkin_idx
  ON public.checkin_uploads (checkin_id);
CREATE INDEX IF NOT EXISTS checkin_uploads_child_class_idx
  ON public.checkin_uploads (child_id, class_id);

ALTER TABLE public.checkin_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkin_uploads_tenant_read ON public.checkin_uploads;
CREATE POLICY checkin_uploads_tenant_read ON public.checkin_uploads
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS checkin_uploads_member_insert ON public.checkin_uploads;
CREATE POLICY checkin_uploads_member_insert ON public.checkin_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS checkin_uploads_owner_delete ON public.checkin_uploads;
CREATE POLICY checkin_uploads_owner_delete ON public.checkin_uploads
  FOR DELETE TO authenticated
  USING (
    child_id = ANY (public.current_child_ids())
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = public.checkin_uploads.child_id
                   AND ca.role = 'parent')
    )
  );

GRANT SELECT, INSERT, DELETE ON public.checkin_uploads TO authenticated;
