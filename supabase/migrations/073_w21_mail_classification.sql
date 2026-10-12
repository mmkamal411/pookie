-- 073_w21_mail_classification.sql — W21 Mail (Phase1-Mail): add 'school'
-- and 'personal' to the mail_items classification taxonomy. Keyword rules in
-- src/server/ocr/extract.ts already know the new values; this migration only
-- widens the CHECK constraint. Re-runnable: drop-then-add.
--
-- Pre-state: ('bill','tax','legal','insurance','medical','other','junk').

ALTER TABLE public.mail_items DROP CONSTRAINT IF EXISTS mail_items_classification_check;

ALTER TABLE public.mail_items
  ADD CONSTRAINT mail_items_classification_check
  CHECK (classification IN (
    'bill','tax','legal','insurance','medical','school','personal','other','junk'
  ));
