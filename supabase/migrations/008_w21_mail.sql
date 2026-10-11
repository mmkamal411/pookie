-- Migration 008: W21 mail intelligence — mail items, action items, dispute drafts, OCR registry
-- Source: docs/MODULE-ARCHITECTURE.md §3.1 (the 8 Class-S properties), §3.2, §4.3
--
-- Scoping follows the §2.1 decision: household-anchored via owner_user_id
-- (bills/taxes/court notices belong to the parent's household), with an
-- optional related_child_id tag for child-relevant items.
-- Depends on 007's household helpers (household_owner_for_child, is_household_member).
--
-- Class S in schema terms (spec §3.1) — all 8 enforced here:
--   1. data_class column on every mail table (vision taxonomy; you cannot audit what you didn't label)
--   2. account_last4 text only — no full account numbers, ever
--   3. photo_path path-only column into the private 'mail-photos' bucket (created below)
--   4. external_ocr_consent gate — per-document third-party OCR consent
--   5. is_household_parent() RLS — children get zero rows; agents get zero rows via client JWTs
--   6. audited reads — route-level auditEvent('mail_item.read') on the detail route (§0.5 exception)
--   7. no client DELETE anywhere — dismissal is status='dismissed' (ledger-like)
--   8. ocr_text never in list payloads — route contract (list returns metadata only)

-- ---------------------------------------------------------------------------
-- is_household_parent(p_owner): household membership AND parent role on the
-- anchor child. This is the Class-S gate: children never pass it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_household_parent(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
    JOIN public.child_access ca
      ON ca.child_id = c.cid AND ca.user_id = auth.uid() AND ca.role = 'parent'
    WHERE public.household_owner_for_child(c.cid) = p_owner
  )
$$;

REVOKE ALL ON FUNCTION public.is_household_parent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_parent(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mail_ocr_providers: provider registry (config table, like school_systems).
-- Adding a vendor = 1 row + 1 Edge Function module, never a schema change.
-- RLS: public read (registry); no client write. Seed: one local row active;
-- external rows ship active=false until a vendor is approved.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mail_ocr_providers (
  provider_key       text PRIMARY KEY,                    -- e.g. 'workers-ai-vision'
  display_name       text NOT NULL,
  adapter_module     text NOT NULL,                       -- Edge Function module implementing OcrProvider
  handles_handwriting boolean NOT NULL DEFAULT false,
  is_external        boolean NOT NULL DEFAULT false,      -- true => requires external_ocr_consent
  data_residency     text,                                -- e.g. 'cloudflare', 'third-party'
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mail_ocr_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mail_ocr_providers_public_read ON public.mail_ocr_providers;
CREATE POLICY mail_ocr_providers_public_read ON public.mail_ocr_providers
  FOR SELECT USING (true);

GRANT SELECT ON public.mail_ocr_providers TO anon, authenticated;

-- Seed: local Workers-AI vision provider, active. External vendors get rows
-- with is_external=true AND active=false until approved.
INSERT INTO public.mail_ocr_providers
  (provider_key, display_name, adapter_module, handles_handwriting, is_external, data_residency, active)
VALUES
  ('workers-ai-vision', 'Workers AI Vision (local)', 'mail-ocr/providers/workers-ai',
   false, false, 'cloudflare', true)
ON CONFLICT (provider_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- mail_items: the envelope, the photo, the extraction.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mail_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key (household anchor)
  related_child_id         uuid REFERENCES public.children(id) ON DELETE SET NULL,       -- optional tag; NOT the tenant key
  photo_path               text NOT NULL,                -- <owner_uid>/mail/<yyyy-mm-dd>/<id>.jpg in mail-photos
  ocr_text                 text,                         -- NULL until OCR; Class-S content
  ocr_confidence           numeric(4,3),
  ocr_provider             text REFERENCES public.mail_ocr_providers(provider_key),
  ocr_at                   timestamptz,
  handwriting_flag         boolean NOT NULL DEFAULT false,  -- true => extraction unreliable; human review required
  external_ocr_consent     boolean NOT NULL DEFAULT false,  -- per-document third-party consent gate
  classification           text NOT NULL DEFAULT 'other'
                           CHECK (classification IN ('bill','tax','legal','insurance','medical','other','junk')),
  classification_confidence numeric(4,3),
  amount                   numeric(12,2),                -- extracted; verified against ocr_text before any reminder
  account_last4            text,                         -- masked only; full number re-viewed from the photo
  due_date                 date,                         -- the date the document says; deterministic parse
  sender                   text,
  received_date            date NOT NULL DEFAULT CURRENT_DATE,
  status                   text NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','triaged','actioned','dismissed')),
  data_class               text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),  -- §3.1.1
  retention_class          text NOT NULL DEFAULT 'standard1',  -- e.g. 'tax7', 'legal-permanent'
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_items_owner_status_received_idx
  ON public.mail_items (owner_user_id, status, received_date DESC);
CREATE INDEX IF NOT EXISTS mail_items_owner_classification_idx
  ON public.mail_items (owner_user_id, classification);

-- ---------------------------------------------------------------------------
-- mail_action_items: "the bill isn't done when the reminder fires."
-- Done requires resolution_note (route-level Zod refine); the confirmation
-- is recorded here. ledger_entry_id is the W11 seam (FK added by W11).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mail_action_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_item_id    uuid NOT NULL REFERENCES public.mail_items(id) ON DELETE CASCADE,
  owner_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- denormalized tenant key
  kind            text NOT NULL CHECK (kind IN ('pay','file','dispute','schedule','review','other')),
  title           text NOT NULL,
  detail          text,
  amount          numeric(12,2),
  due_date        date,                              -- deterministic, from the document
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','snoozed','done','cancelled')),
  reminder_at     timestamptz,                       -- 7-day + 2-day reminders computed by the pipeline
  reminder_sent   boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolution_note text,                              -- confirmation recorded here
  ledger_entry_id uuid,                              -- W11 seam: FK added by W11's migration, not here
  data_class      text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_action_items_owner_status_due_idx
  ON public.mail_action_items (owner_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS mail_action_items_mail_item_id_idx
  ON public.mail_action_items (mail_item_id);

-- ---------------------------------------------------------------------------
-- mail_dispute_drafts: AI drafts, parent acts. Nothing auto-executes —
-- enforced in the schema by dispute_approval_integrity: approved/sent are
-- IMPOSSIBLE without the frozen approved_text + approved_by.
-- Route rule: only approved_text (never a re-edited draft_text) may be sent;
-- sent requires approved first.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mail_dispute_drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_item_id uuid NOT NULL REFERENCES public.mail_items(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key
  draft_text   text NOT NULL,                       -- the AI's draft (editable)
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','approved','sent','abandoned')),
  approved_text text,                                -- frozen snapshot of the exact text the parent approved
  approved_by  uuid REFERENCES public.users(id),
  approved_at  timestamptz,
  sent_at      timestamptz,
  data_class   text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_dispute_drafts_mail_item_id_idx
  ON public.mail_dispute_drafts (mail_item_id);

-- The bright line as a CHECK constraint (re-runnable: drop-then-add).
ALTER TABLE public.mail_dispute_drafts DROP CONSTRAINT IF EXISTS dispute_approval_integrity;
ALTER TABLE public.mail_dispute_drafts
  ADD CONSTRAINT dispute_approval_integrity
  CHECK (
    (status IN ('approved','sent') AND approved_text IS NOT NULL AND approved_by IS NOT NULL)
    OR (status IN ('draft','abandoned'))
  );

-- ---------------------------------------------------------------------------
-- RLS: all mail tables parent-only via is_household_parent().
-- SELECT/INSERT/UPDATE for household parents; NO DELETE anywhere.
-- ---------------------------------------------------------------------------
ALTER TABLE public.mail_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_action_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_dispute_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mail_items_parent_read ON public.mail_items;
CREATE POLICY mail_items_parent_read ON public.mail_items
  FOR SELECT USING (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_items_parent_insert ON public.mail_items;
CREATE POLICY mail_items_parent_insert ON public.mail_items
  FOR INSERT WITH CHECK (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_items_parent_update ON public.mail_items;
CREATE POLICY mail_items_parent_update ON public.mail_items
  FOR UPDATE
  USING (public.is_household_parent(owner_user_id))
  WITH CHECK (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_action_items_parent_read ON public.mail_action_items;
CREATE POLICY mail_action_items_parent_read ON public.mail_action_items
  FOR SELECT USING (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_action_items_parent_insert ON public.mail_action_items;
CREATE POLICY mail_action_items_parent_insert ON public.mail_action_items
  FOR INSERT WITH CHECK (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_action_items_parent_update ON public.mail_action_items;
CREATE POLICY mail_action_items_parent_update ON public.mail_action_items
  FOR UPDATE
  USING (public.is_household_parent(owner_user_id))
  WITH CHECK (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_dispute_drafts_parent_read ON public.mail_dispute_drafts;
CREATE POLICY mail_dispute_drafts_parent_read ON public.mail_dispute_drafts
  FOR SELECT USING (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_dispute_drafts_parent_insert ON public.mail_dispute_drafts;
CREATE POLICY mail_dispute_drafts_parent_insert ON public.mail_dispute_drafts
  FOR INSERT WITH CHECK (public.is_household_parent(owner_user_id));

DROP POLICY IF EXISTS mail_dispute_drafts_parent_update ON public.mail_dispute_drafts;
CREATE POLICY mail_dispute_drafts_parent_update ON public.mail_dispute_drafts
  FOR UPDATE
  USING (public.is_household_parent(owner_user_id))
  WITH CHECK (public.is_household_parent(owner_user_id));

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). No DELETE grants — ledger-like by design.
-- No anon grants (the registry read is the only anon surface, granted above).
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.mail_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mail_action_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mail_dispute_drafts TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private 'mail-photos' bucket (photo_path columns point here).
-- Signed URLs minted server-side with short TTL; never public, never in the DB.
-- v1 uploads go through the POST route with service_role (admin client), so
-- these storage policies are defense-in-depth, not the primary path.
-- Path segment 1 = owner_user_id: <owner_uid>/mail/<yyyy-mm-dd>/<id>.jpg
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('mail-photos', 'mail-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS mail_photos_household_parent_select ON storage.objects;
CREATE POLICY mail_photos_household_parent_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'mail-photos'
    AND public.is_household_parent(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS mail_photos_household_parent_insert ON storage.objects;
CREATE POLICY mail_photos_household_parent_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'mail-photos'
    AND public.is_household_parent(((storage.foldername(name))[1])::uuid)
  );
