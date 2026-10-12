-- Migration 024: W21 mail — extract-then-mask enforcement + raw-image auto-deletion (FR-MOD-W21, NFR-PRIVACY-009)
--
-- Extends migration 008's mail_items (do NOT rebuild it):
--   1. extracted_amounts / extracted_due_dates / extracted_action_items — the
--      arrays the intake contract names (§3.2 pipeline outputs).
--   2. auto_delete_at — raw photo purge deadline. Default: 30 days from intake.
--      NFR-PRIVACY-009: raw images auto-delete ≤ 30 days. The deadline is a
--      column (not application memory) so the scheduled purge works without
--      trusting any single deploy.
--   3. mask_account_numbers() — extract-then-mask helper: OCR extracts FIRST,
--      then digit runs ≥8 are replaced with **** + last-4 before anything is
--      persisted to ocr_text. The pipeline MUST call this before writing.
--   4. purge_expired_mail_photos() — scheduled-job entry point: deletes the
--      storage.objects rows past their deadline, clears photo_path, stamps
--      photo_purged_at. SECURITY DEFINER; intended caller is pg_cron or the
--      edge-function scheduler with service_role. Reads of the masked text and
--      the extracted fields are unaffected.

-- ---------------------------------------------------------------------------
-- Extended extraction columns on the existing table.
-- ---------------------------------------------------------------------------
ALTER TABLE public.mail_items
  ADD COLUMN IF NOT EXISTS extracted_amounts numeric(12,2)[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_due_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_delete_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS photo_purged_at timestamptz;

CREATE INDEX IF NOT EXISTS mail_items_auto_delete_at_idx
  ON public.mail_items (auto_delete_at) WHERE photo_purged_at IS NULL;

-- Backfill: existing rows (pre-024) get a deadline 30 days from their intake.
UPDATE public.mail_items
SET auto_delete_at = GREATEST(received_date::timestamptz + interval '30 days', now() + interval '1 day')
WHERE auto_delete_at IS NULL;

-- ---------------------------------------------------------------------------
-- mask_account_numbers(p_text): extract-then-mask (NFR-PRIVACY-009).
-- OCR text arrives RAW (full numbers are visible to the extractor); this
-- helper replaces every digit run of 8+ (card/account/SSN shapes, with or
-- without separators) with **** + the last 4 digits, then the masked text is
-- what persists to ocr_text. Deterministic, reversible-safe (masking is lossy
-- by design — the raw number only ever lives in the photo).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mask_account_numbers(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result text := '';
  v_rest   text := p_text;
  v_match  text[];
  v_pos    integer;
  v_digits text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  LOOP
    -- Next candidate: 8+ digits possibly separated by spaces/dashes.
    v_match := regexp_match(v_rest, '(?<!\d)\d(?:[\s\-]?\d){7,}(?!\d)');
    IF v_match IS NULL THEN
      v_result := v_result || v_rest;
      EXIT;
    END IF;
    v_pos := position(v_match[1] in v_rest);
    v_result := v_result || substring(v_rest FROM 1 FOR v_pos - 1);
    v_digits := regexp_replace(v_match[1], '\D', '', 'g');
    IF length(v_digits) >= 8 THEN
      v_result := v_result || '****' || right(v_digits, 4);
    ELSE
      v_result := v_result || v_match[1];
    END IF;
    v_rest := substring(v_rest FROM v_pos + length(v_match[1]));
  END LOOP;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mask_account_numbers(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mask_account_numbers(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- purge_expired_mail_photos(): the scheduled job (runs as definer).
-- For every mail_item past auto_delete_at with an un-purged photo:
--   1. delete the storage.objects row (mail-photos bucket),
--   2. clear photo_path, stamp photo_purged_at.
-- Extracted/masked data survives — only the raw image dies. Returns count.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_mail_photos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_paths text[];
  v_count integer := 0;
BEGIN
  SELECT array_agg(photo_path) INTO v_paths
  FROM public.mail_items
  WHERE auto_delete_at < now() AND photo_purged_at IS NULL;

  IF v_paths IS NULL OR array_length(v_paths, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'mail-photos' AND name = ANY (v_paths);

  UPDATE public.mail_items
  SET photo_path = '', photo_purged_at = now()
  WHERE auto_delete_at < now() AND photo_purged_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_mail_photos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_mail_photos() TO service_role;
