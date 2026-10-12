-- Migration 068: class-handouts storage bucket + policies (Squad Telemetry E4)
--
-- APPLY VIA SUPABASE DASHBOARD SQL EDITOR ONLY — the management API role does
-- not own the storage schema (42501 on storage.objects via API). The dashboard
-- SQL editor runs with owner privileges.
--
-- Bucket: class-handouts (private, 50 MB file limit).
-- Path convention: <child_id>/<class_slug>/<filename>
--   e.g. 5e76dcad-2239-484f-bd86-2495b4650eb9/geometry/unit3-study-guide.pdf
-- Policies scope every operation to the caller's own children's folders via
-- public.current_child_ids(); updates/deletes additionally require the
-- uploader (owner) or a parent-role grant on that child.
--
-- IDEMPOTENT: ON CONFLICT / DROP POLICY IF EXISTS throughout.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('class-handouts', 'class-handouts', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_handouts_select ON storage.objects;
CREATE POLICY class_handouts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'class-handouts'
    AND (storage.foldername(name))[1]::uuid = ANY (public.current_child_ids())
  );

DROP POLICY IF EXISTS class_handouts_insert ON storage.objects;
CREATE POLICY class_handouts_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'class-handouts'
    AND (storage.foldername(name))[1]::uuid = ANY (public.current_child_ids())
  );

DROP POLICY IF EXISTS class_handouts_update ON storage.objects;
CREATE POLICY class_handouts_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'class-handouts'
    AND (storage.foldername(name))[1]::uuid = ANY (public.current_child_ids())
    AND (
      owner = auth.uid()
      OR EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = ((storage.foldername(name))[1]::uuid)
                   AND ca.role = 'parent')
    )
  );

DROP POLICY IF EXISTS class_handouts_delete ON storage.objects;
CREATE POLICY class_handouts_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'class-handouts'
    AND (storage.foldername(name))[1]::uuid = ANY (public.current_child_ids())
    AND (
      owner = auth.uid()
      OR EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid()
                   AND ca.child_id = ((storage.foldername(name))[1]::uuid)
                   AND ca.role = 'parent')
    )
  );
