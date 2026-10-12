-- Migration 053: create_child() gains an optional p_date_of_birth
--
-- CONTEXT: the 001 create_child() RPC stores no birthdate, so children
-- added after onboarding (Settings -> Profile -> add child) could never
-- attach to the 018 age-tiering model — the 18+ independence gate
-- (getIndependenceStatus) and the Muse 18+ gate fail-closed to
-- "not eligible" forever for them, with no path to fix it.
--
-- CHANGES: create_child() takes a new trailing p_date_of_birth
-- (date, DEFAULT NULL) and stores it on children.date_of_birth (001
-- already carries the column). The default keeps every existing 7-arg
-- call working unchanged.
--
-- IMPLEMENTATION NOTE: PostgreSQL treats (text×7) and (text×7, date) as
-- two different overloads, so CREATE OR REPLACE alone would leave the old
-- 7-arg function in place and 7-arg callers would keep hitting the
-- DOB-less version. DROP the old signature first, then create the new one.
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS + CREATE OR REPLACE. Safe to re-run.
-- GRANT MODEL (001 convention): EXECUTE on the new 8-arg signature for
-- authenticated + service_role only. No RLS changes.

DROP FUNCTION IF EXISTS
  public.create_child(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_child(
  p_first_name    text,
  p_last_name     text,
  p_nickname      text DEFAULT NULL,
  p_slug          text DEFAULT NULL,
  p_school_name   text DEFAULT NULL,
  p_grade_level   text DEFAULT NULL,
  p_timezone      text DEFAULT 'America/New_York',
  p_date_of_birth date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_base     text;
  v_try      text;
  v_attempt  int;
BEGIN
  IF p_first_name IS NULL OR btrim(p_first_name) = '' THEN
    RAISE EXCEPTION 'child_name_required';
  END IF;
  -- Last name stays required: it anchors the default slug. Callers that
  -- only have one name pass it twice or pass '-' — unchanged from 001.
  IF p_last_name IS NULL OR btrim(p_last_name) = '' THEN
    RAISE EXCEPTION 'child_name_required';
  END IF;

  IF p_date_of_birth IS NOT NULL THEN
    IF p_date_of_birth > CURRENT_DATE THEN
      RAISE EXCEPTION 'child_birthdate_in_future';
    END IF;
    IF EXTRACT(YEAR FROM age(CURRENT_DATE, p_date_of_birth))::int > 150 THEN
      RAISE EXCEPTION 'child_birthdate_implausible';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.child_access
                 WHERE user_id = auth.uid() AND role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  v_base := COALESCE(NULLIF(btrim(p_slug), ''),
                     lower(regexp_replace(p_first_name || '-' || p_last_name,
                                          '[^a-z0-9]+', '-', 'gi')));
  v_base := btrim(v_base, '-');
  IF v_base = '' THEN v_base := 'child'; END IF;

  -- Prefer the clean slug when free; suffix on collision.
  FOR v_attempt IN 1..5 LOOP
    IF v_attempt = 1 THEN
      v_try := v_base;
    ELSE
      v_try := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    END IF;
    BEGIN
      INSERT INTO public.children
            (parent_user_id, first_name, last_name, nickname, slug,
             school_name, grade_level, timezone, date_of_birth)
      VALUES (auth.uid(), btrim(p_first_name), btrim(p_last_name),
              NULLIF(btrim(p_nickname), ''), v_try,
              NULLIF(btrim(p_school_name), ''), NULLIF(btrim(p_grade_level), ''),
              p_timezone, p_date_of_birth)
      RETURNING id INTO v_child_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.child_access (child_id, user_id, role)
  VALUES (v_child_id, auth.uid(), 'parent');

  -- Caller is a member of the new child from the row above, so this passes
  -- audit_event's membership assertion (004, resolved at runtime).
  PERFORM public.audit_event(v_child_id, 'child.created', 'user', 'children',
                             v_child_id::text,
                             jsonb_build_object('slug', v_try));

  RETURN v_child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_child(text, text, text, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_child(text, text, text, text, text, text, text, date)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_child(text, text, text, text, text, text, text, date) IS
  'Add-a-child for existing parent members (Settings -> Profile, POST /api/v1/children). Optional p_date_of_birth feeds the 018 age-tiering model; NULL keeps the pre-053 behavior. First child for a zero-membership user goes through provision_onboarding_child (052), not this function.';
