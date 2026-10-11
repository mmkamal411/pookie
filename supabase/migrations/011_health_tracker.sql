-- Migration 011: W22 exercise & health tracker (data layer)
-- Sources: BUILD-LOG 2026-10-11 (Technical Architect batch-2 spec decisions),
-- AI-MOTHER-VISION.md W22, docs/GUIDANCE-FRAMEWORK.md (child privacy contract).
--
-- THE PRIVACY MODEL (this is the product, not the plumbing):
--   - health_subjects: minimal person registry (owner_user_id anchor +
--     subject_id). NOT a second membership system — child_access stays the
--     single source of truth; access funnels through current_child_ids().
--   - Per-metric, per-person sharing via health_metric_visible() predicate.
--   - Teens 13-17: sensitive metrics (BP, glucose, heart rate, sleep) are
--     child-confidential BY DEFAULT. Parents see non-sensitive metrics, what
--     the teen shares, or what's parent-visible by policy (diabetes glucose).
--   - NO silent parent overrides: the safety-override path requires a
--     reason >= 20 chars, notifies the teen IN-TRANSACTION (same RPC), and
--     is audit-logged. Override reads are audited at the route layer.
--   - Under-13: parent sees all. 18+/adult: subject controls.
--   - W22 is the DATA layer; W2 is interpretation (neither writes the
--     other's tables). Wellness tracking only — no diagnostic or dosing
--     endpoints exist anywhere in this migration.
--
-- Wellness-only guardrails: metric list is closed (no weight/BMI metric —
-- guidance bans weight numbers to the child); trends-and-nudges framing is
-- enforced in app copy, not schema, because the schema holds no conclusions.
--
-- Conventions: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS,
-- explicit least-privilege GRANTs (authenticated only — NO anon, NO
-- agent_reader on health tables per the batch-2 security checklist),
-- all definer fns pin search_path + REVOKE ALL FROM PUBLIC.

-- ---------------------------------------------------------------------------
-- Metric registry (closed list) + sensitivity
-- ---------------------------------------------------------------------------
-- Canonical metrics: steps, sleep_minutes, blood_pressure, glucose,
-- heart_rate, workout_minutes. Validated by CHECK on every write.

CREATE OR REPLACE FUNCTION public.health_metric_sensitive(p_metric text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_metric IN ('blood_pressure', 'glucose', 'heart_rate', 'sleep_minutes')
$$;

REVOKE ALL ON FUNCTION public.health_metric_sensitive(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_metric_sensitive(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- health_subjects: minimal person registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_subjects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid        NOT NULL,  -- household/tenant anchor (a parent user)
  subject_id    uuid        NOT NULL UNIQUE,
  -- subject_kind='child'  -> subject_id = children.id
  -- subject_kind='adult'  -> subject_id = owner_user_id (self-tracking adult)
  subject_kind  text        NOT NULL CHECK (subject_kind IN ('child', 'adult')),
  label         text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  dob           date,                 -- drives the 13-17 tier + under-18 rules
  clinical_flags jsonb      NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. {"diabetes": true} -> glucose is parent-visible by policy
  -- (diabetes care is a family affair; set by a parent, not surveillance).
  data_class      text      NOT NULL DEFAULT 'S',
  retention_class text      NOT NULL DEFAULT 'long',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_subjects_owner_idx
  ON public.health_subjects (owner_user_id);
CREATE INDEX IF NOT EXISTS health_subjects_child_idx
  ON public.health_subjects (subject_id) WHERE subject_kind = 'child';

ALTER TABLE public.health_subjects ENABLE ROW LEVEL SECURITY;

-- SELECT: the owner, or any tenant member of the subject's child.
DROP POLICY IF EXISTS health_subjects_select ON public.health_subjects;
CREATE POLICY health_subjects_select ON public.health_subjects
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR (subject_kind = 'child' AND subject_id = ANY (public.current_child_ids()))
  );

-- INSERT: owner registers themself (adult) or a parent registers their child.
DROP POLICY IF EXISTS health_subjects_insert ON public.health_subjects;
CREATE POLICY health_subjects_insert ON public.health_subjects
  FOR INSERT WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      (subject_kind = 'adult' AND subject_id = auth.uid())
      OR (
        subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
      )
    )
  );

-- UPDATE: owner or the subject themself (label, dob, clinical_flags).
DROP POLICY IF EXISTS health_subjects_update ON public.health_subjects;
CREATE POLICY health_subjects_update ON public.health_subjects
  FOR UPDATE USING (
    owner_user_id = auth.uid()
    OR public.health_subject_user(id) = auth.uid()
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR public.health_subject_user(id) = auth.uid()
  );

-- No client DELETE: the registry is append-only (offboarding is a W-admin path).

GRANT SELECT, INSERT, UPDATE ON public.health_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_subjects TO service_role;

-- ---------------------------------------------------------------------------
-- health_subject_user(p_subject_id): the subject's own app user id, if linked
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_subject_user(p_subject_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.subject_kind = 'adult' THEN s.owner_user_id
    ELSE (
      SELECT ca.user_id
      FROM public.child_access ca
      WHERE ca.child_id = s.subject_id AND ca.role = 'child'
      ORDER BY ca.created_at ASC
      LIMIT 1
    )
  END
  FROM public.health_subjects s
  WHERE s.id = p_subject_id
$$;

REVOKE ALL ON FUNCTION public.health_subject_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_subject_user(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- health_metric_visible(p_subject_id, p_metric): THE privacy predicate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_metric_visible(p_subject_id uuid, p_metric text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind  text;
  v_child uuid;
  v_dob   date;
  v_flags jsonb;
  v_age   int;
  v_uid   uuid := auth.uid();
  v_role  text;
BEGIN
  SELECT s.subject_kind, s.subject_id, s.dob, s.clinical_flags
    INTO v_kind, v_child, v_dob, v_flags
    FROM public.health_subjects s
    WHERE s.id = p_subject_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- The subject themself always sees their own metrics.
  IF public.health_subject_user(p_subject_id) = v_uid THEN RETURN true; END IF;

  -- Adult subjects: nobody else (their data is theirs alone).
  IF v_kind = 'adult' THEN RETURN false; END IF;

  -- Child subject: the caller must be a parent of that child.
  SELECT ca.role INTO v_role
    FROM public.child_access ca
    WHERE ca.child_id = v_child AND ca.user_id = v_uid;
  IF v_role IS DISTINCT FROM 'parent' THEN RETURN false; END IF;

  -- Under-13: parent sees all (guidance tier).
  IF v_dob IS NOT NULL THEN
    v_age := date_part('year', age(current_date, v_dob))::int;
    IF v_age < 13 THEN RETURN true; END IF;
  END IF;

  -- Non-sensitive metrics are family-visible.
  IF NOT public.health_metric_sensitive(p_metric) THEN RETURN true; END IF;

  -- Parent-visible by policy (diabetes care is a family affair).
  IF p_metric = 'glucose'
     AND COALESCE((v_flags ->> 'diabetes')::boolean, false) THEN
    RETURN true;
  END IF;

  -- The teen's explicit share.
  IF EXISTS (
    SELECT 1 FROM public.health_metric_sharing sh
    WHERE sh.subject_id = p_subject_id AND sh.metric = p_metric
  ) THEN RETURN true; END IF;

  -- Audited safety override (minimum-necessary, time-boxed).
  IF EXISTS (
    SELECT 1 FROM public.health_safety_overrides o
    WHERE o.subject_id = p_subject_id
      AND o.metric = p_metric
      AND (o.expires_at IS NULL OR o.expires_at > now())
  ) THEN RETURN true; END IF;

  -- 13-17 sensitive default: child-confidential.
  RETURN false;
END
$$;

REVOKE ALL ON FUNCTION public.health_metric_visible(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_metric_visible(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- health_metric_readings: the wellness data stream (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_metric_readings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  metric      text        NOT NULL CHECK (metric IN (
    'steps', 'sleep_minutes', 'blood_pressure', 'glucose', 'heart_rate', 'workout_minutes'
  )),
  recorded_at timestamptz NOT NULL,
  value_num   double precision,  -- steps, sleep min, glucose mg/dL, HR bpm, workout min, BP systolic
  value_num2  double precision,  -- BP diastolic (blood_pressure only)
  value_text  text,              -- e.g. workout kind ("walk", "soccer")
  source      text        NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'healthkit', 'health_connect', 'dexcom', 'cuff_bridge'
  )),
  -- Manual entry is the honest v1. HealthKit / Health Connect / Dexcom are
  -- Edge-Function integrations that land later; 'cuff_bridge' covers
  -- Omron/Withings vendor-app bridges. Nothing here fakes a live feed.
  note        text        CHECK (note IS NULL OR char_length(note) <= 280),
  data_class  text        NOT NULL DEFAULT 'S',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT readings_bp_needs_both CHECK (
    metric <> 'blood_pressure'
    OR (value_num IS NOT NULL AND value_num2 IS NOT NULL)
  ),
  CONSTRAINT readings_value_present CHECK (
    value_num IS NOT NULL OR value_text IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS health_readings_subject_metric_time_idx
  ON public.health_metric_readings (subject_id, metric, recorded_at DESC);

ALTER TABLE public.health_metric_readings ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant membership AND the per-metric visibility predicate.
DROP POLICY IF EXISTS health_readings_select ON public.health_metric_readings;
CREATE POLICY health_readings_select ON public.health_metric_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND (
          s.owner_user_id = auth.uid()
          OR (s.subject_kind = 'child' AND s.subject_id = ANY (public.current_child_ids()))
        )
    )
    AND public.health_metric_visible(subject_id, metric)
  );

-- INSERT: the subject themself, or a parent of the subject's child.
DROP POLICY IF EXISTS health_readings_insert ON public.health_metric_readings;
CREATE POLICY health_readings_insert ON public.health_metric_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND (
          public.health_subject_user(s.id) = auth.uid()
          OR (
            s.subject_kind = 'child'
            AND EXISTS (
              SELECT 1 FROM public.child_access ca
              WHERE ca.child_id = s.subject_id
                AND ca.user_id = auth.uid()
                AND ca.role = 'parent'
            )
          )
        )
    )
  );

-- Append-only: no client UPDATE/DELETE (corrections are new readings).

GRANT SELECT, INSERT ON public.health_metric_readings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_metric_readings TO service_role;

-- ---------------------------------------------------------------------------
-- health_metric_sharing: the teen's per-metric sharing choices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_metric_sharing (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  metric      text        NOT NULL CHECK (metric IN (
    'steps', 'sleep_minutes', 'blood_pressure', 'glucose', 'heart_rate', 'workout_minutes'
  )),
  audience    text        NOT NULL DEFAULT 'parent' CHECK (audience = 'parent'),
  created_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, metric)
);

ALTER TABLE public.health_metric_sharing ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant members (parents can see what the teen chose to share).
DROP POLICY IF EXISTS health_sharing_select ON public.health_metric_sharing;
CREATE POLICY health_sharing_select ON public.health_metric_sharing
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND (
          s.owner_user_id = auth.uid()
          OR (s.subject_kind = 'child' AND s.subject_id = ANY (public.current_child_ids()))
        )
    )
  );

-- Writes: the subject themself ONLY (a parent cannot silently widen sharing;
-- the widen path is the audited safety override). Under-13: a parent may
-- manage sharing for the child.
DROP POLICY IF EXISTS health_sharing_write ON public.health_metric_sharing;
CREATE POLICY health_sharing_write ON public.health_metric_sharing
  FOR ALL USING (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND s.subject_kind = 'child'
        AND s.dob IS NOT NULL
        AND date_part('year', age(current_date, s.dob))::int < 13
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  )
  WITH CHECK (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND s.subject_kind = 'child'
        AND s.dob IS NOT NULL
        AND date_part('year', age(current_date, s.dob))::int < 13
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_metric_sharing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_metric_sharing TO service_role;

-- ---------------------------------------------------------------------------
-- health_safety_overrides: audited, time-boxed, teen-notified
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_safety_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  metric      text        NOT NULL CHECK (metric IN (
    'steps', 'sleep_minutes', 'blood_pressure', 'glucose', 'heart_rate', 'workout_minutes'
  )),
  reason      text        NOT NULL CHECK (char_length(reason) >= 20),
  created_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  data_class  text        NOT NULL DEFAULT 'S'
);

ALTER TABLE public.health_safety_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: a parent of the subject's child (reads are audited at the route
-- layer), or the subject themself (transparency: the teen can always see
-- that an override exists).
DROP POLICY IF EXISTS health_overrides_select ON public.health_safety_overrides;
CREATE POLICY health_overrides_select ON public.health_safety_overrides
  FOR SELECT USING (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND s.subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  );

-- No client INSERT/UPDATE/DELETE: overrides are created ONLY through the
-- health_create_safety_override() RPC (parent assertion + teen notification
-- + audit in one transaction).

GRANT SELECT ON public.health_safety_overrides TO authenticated;
GRANT SELECT, INSERT ON public.health_safety_overrides TO service_role;

-- ---------------------------------------------------------------------------
-- health_notifications: teen disclosure outbox (plain-language safety notices)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('safety_override', 'share_change')),
  message     text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

CREATE INDEX IF NOT EXISTS health_notifications_subject_idx
  ON public.health_notifications (subject_id, created_at DESC);

ALTER TABLE public.health_notifications ENABLE ROW LEVEL SECURITY;

-- SELECT + mark-read: the subject themself only.
DROP POLICY IF EXISTS health_notifications_select ON public.health_notifications;
CREATE POLICY health_notifications_select ON public.health_notifications
  FOR SELECT USING (
    public.health_subject_user(subject_id) = auth.uid()
  );

DROP POLICY IF EXISTS health_notifications_update ON public.health_notifications;
CREATE POLICY health_notifications_update ON public.health_notifications
  FOR UPDATE USING (
    public.health_subject_user(subject_id) = auth.uid()
  )
  WITH CHECK (
    public.health_subject_user(subject_id) = auth.uid()
  );

-- No client INSERT: rows are written by the safety-override RPC.

GRANT SELECT, UPDATE ON public.health_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_notifications TO service_role;

-- ---------------------------------------------------------------------------
-- health_create_safety_override(): the ONLY override path.
-- Parent-only, reason >= 20 chars (CHECK), teen notified in-transaction,
-- audit-logged. Applies to the 13-17 child-confidential tier only
-- (under-13 parents already see all; adults are out of scope).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_create_safety_override(
  p_subject_id uuid,
  p_metric     text,
  p_reason     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child uuid;
  v_kind  text;
  v_dob   date;
  v_age   int;
  v_label text;
  v_uid   uuid := auth.uid();
  v_id    uuid;
BEGIN
  IF p_metric NOT IN ('steps', 'sleep_minutes', 'blood_pressure', 'glucose', 'heart_rate', 'workout_minutes') THEN
    RAISE EXCEPTION 'unknown_metric';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 20 THEN
    RAISE EXCEPTION 'override_reason_too_short';
  END IF;

  SELECT s.subject_kind, s.subject_id, s.dob, s.label
    INTO v_kind, v_child, v_dob, v_label
    FROM public.health_subjects s
    WHERE s.id = p_subject_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_subject'; END IF;
  IF v_kind <> 'child' THEN RAISE EXCEPTION 'override_not_applicable'; END IF;

  -- Caller must be a parent of this child.
  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.child_id = v_child AND ca.user_id = v_uid AND ca.role = 'parent'
  ) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  -- The override path exists for the 13-17 confidential tier.
  IF v_dob IS NULL THEN RAISE EXCEPTION 'override_needs_dob'; END IF;
  v_age := date_part('year', age(current_date, v_dob))::int;
  IF v_age < 13 OR v_age >= 18 THEN RAISE EXCEPTION 'override_not_applicable'; END IF;

  INSERT INTO public.health_safety_overrides (subject_id, metric, reason, created_by)
  VALUES (p_subject_id, p_metric, btrim(p_reason), v_uid)
  RETURNING id INTO v_id;

  -- Teen notified IN-TRANSACTION, in plain language. No secret overrides, ever.
  INSERT INTO public.health_notifications (subject_id, kind, message)
  VALUES (
    p_subject_id,
    'safety_override',
    'Heads up: your parent used a safety override to see your '
      || replace(p_metric, '_', ' ')
      || ' readings for the next 7 days. The reason they gave: "'
      || btrim(p_reason)
      || '". You can see this override any time under Health > Privacy.'
  );

  -- Audit (detail carries NO reason text — audit-detail values ban).
  PERFORM public.audit_event(
    p_child_id   := v_child,
    p_action     := 'health.safety_override',
    p_actor_kind := 'user',
    p_table_name := 'health_safety_overrides',
    p_row_id     := v_id::text,
    p_detail     := jsonb_build_object(
      'subject_id', p_subject_id,
      'metric', p_metric,
      'expires_at', (now() + interval '7 days')::text
    )
  );

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.health_create_safety_override(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_create_safety_override(uuid, text, text) TO authenticated, service_role;
