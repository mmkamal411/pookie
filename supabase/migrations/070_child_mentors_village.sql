-- Migration 070: The Village — Mentors for Children (Squad Village)
--
-- A parent can grant trusted people (older sibling, uncle, aunt, grandparent,
-- tutor, coach) a "mentor" view of a child's school life: classes, grades,
-- due dates, tests, quizzes, missing work. Mentors VIEW and ENCOURAGE —
-- they cannot change grades, message teachers, or see health data.
--
-- Age-tiered rules (locked by founder):
--   under 13 .......... parent controls; grant activates immediately
--   13–15 ............. child gets a say; 7-day cooling-off after consent
--   16+ ............... teen controls; instant grant, fully reversible
-- Instant removal anytime. Every mentor data view is logged.
--
-- Design:
--   child_mentors: one row per (child, mentor user). Scope = class ids or NULL (all).
--   mentor_access_log: append-only audit of mentor reads.
--   mentor_kudos: encouragement messages from mentors to the child.
--   is_active_mentor(child_id): DEFINER helper for RLS on school tables.

-- ---------------------------------------------------------------------------
-- child_mentors table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_mentors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  mentor_user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  relationship        text NOT NULL CHECK (relationship IN (
                        'sibling','uncle','aunt','grandparent','tutor','coach','other')),
  scope_class_ids     uuid[],  -- NULL = all classes; otherwise the scoped subset
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending','active','cooling_off','revoked')),
  child_consent       text NOT NULL DEFAULT 'not_required' CHECK (child_consent IN (
                        'not_required','pending','granted','denied')),
  consent_granted_at  timestamptz,
  cooling_off_until   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, mentor_user_id)
);

CREATE INDEX IF NOT EXISTS child_mentors_mentor_idx
  ON public.child_mentors (mentor_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS child_mentors_child_idx
  ON public.child_mentors (child_id);

-- ---------------------------------------------------------------------------
-- mentor_access_log: append-only audit (no UPDATE/DELETE by design)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_access_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id      uuid NOT NULL REFERENCES public.child_mentors(id) ON DELETE CASCADE,
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  action         text NOT NULL,  -- e.g. 'overview.viewed', 'class.viewed'
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentor_access_log_mentor_idx
  ON public.mentor_access_log (mentor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- mentor_kudos: encouragement from mentors (child + parents can read)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_kudos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id      uuid NOT NULL REFERENCES public.child_mentors(id) ON DELETE CASCADE,
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  message        text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentor_kudos_child_idx
  ON public.mentor_kudos (child_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse the family_tasks touch function pattern)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.child_mentors_touch_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS child_mentors_touch ON public.child_mentors;
CREATE TRIGGER child_mentors_touch
  BEFORE UPDATE ON public.child_mentors
  FOR EACH ROW EXECUTE FUNCTION public.child_mentors_touch_updated();

-- ---------------------------------------------------------------------------
-- is_active_mentor(child_id): DEFINER helper — true when the caller holds an
-- ACTIVE mentor grant for the child (cooling-off counts only after expiry).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_mentor(p_child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.child_mentors m
    WHERE m.child_id = p_child_id
      AND m.mentor_user_id = auth.uid()
      AND (
        m.status = 'active'
        OR (m.status = 'cooling_off' AND m.cooling_off_until IS NOT NULL
            AND m.cooling_off_until <= now())
      )
  )
$$;

-- Mentor class scope: NULL scope_class_ids = all classes.
CREATE OR REPLACE FUNCTION public.mentor_can_see_class(p_child_id uuid, p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.child_mentors m
    WHERE m.child_id = p_child_id
      AND m.mentor_user_id = auth.uid()
      AND (
        m.status = 'active'
        OR (m.status = 'cooling_off' AND m.cooling_off_until IS NOT NULL
            AND m.cooling_off_until <= now())
      )
      AND (m.scope_class_ids IS NULL OR p_class_id = ANY (m.scope_class_ids))
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS: child_mentors
--   - tenant parents manage (grant/revoke)
--   - mentors read their own rows
--   - the child (13+) reads + updates consent on their own rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.child_mentors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS child_mentors_parent_manage ON public.child_mentors;
CREATE POLICY child_mentors_parent_manage ON public.child_mentors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.child_mentors.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'parent')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.child_mentors.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS child_mentors_mentor_read ON public.child_mentors;
CREATE POLICY child_mentors_mentor_read ON public.child_mentors
  FOR SELECT USING (mentor_user_id = auth.uid());

DROP POLICY IF EXISTS child_mentors_child_read ON public.child_mentors;
CREATE POLICY child_mentors_child_read ON public.child_mentors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.child_mentors.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'child')
  );

DROP POLICY IF EXISTS child_mentors_child_consent ON public.child_mentors;
CREATE POLICY child_mentors_child_consent ON public.child_mentors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.child_mentors.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'child')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.child_mentors.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'child')
  );

-- ---------------------------------------------------------------------------
-- RLS: mentor_access_log (append-only; tenant parents + mentors read own)
-- ---------------------------------------------------------------------------
ALTER TABLE public.mentor_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mentor_access_log_parent_read ON public.mentor_access_log;
CREATE POLICY mentor_access_log_parent_read ON public.mentor_access_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.mentor_access_log.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS mentor_access_log_mentor_insert ON public.mentor_access_log;
CREATE POLICY mentor_access_log_mentor_insert ON public.mentor_access_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_mentors m
            WHERE m.id = public.mentor_access_log.mentor_id
              AND m.mentor_user_id = auth.uid())
  );

DROP POLICY IF EXISTS mentor_access_log_mentor_read ON public.mentor_access_log;
CREATE POLICY mentor_access_log_mentor_read ON public.mentor_access_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_mentors m
            WHERE m.id = public.mentor_access_log.mentor_id
              AND m.mentor_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: mentor_kudos (mentors write; child + parents read)
-- ---------------------------------------------------------------------------
ALTER TABLE public.mentor_kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mentor_kudos_write ON public.mentor_kudos;
CREATE POLICY mentor_kudos_write ON public.mentor_kudos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_mentors m
            WHERE m.id = public.mentor_kudos.mentor_id
              AND m.mentor_user_id = auth.uid()
              AND (m.status = 'active'
                   OR (m.status = 'cooling_off' AND m.cooling_off_until <= now())))
  );

DROP POLICY IF EXISTS mentor_kudos_tenant_read ON public.mentor_kudos;
CREATE POLICY mentor_kudos_tenant_read ON public.mentor_kudos
  FOR SELECT USING (
    public.is_active_mentor(child_id)
    OR child_id = ANY (public.current_child_ids())
  );

-- ---------------------------------------------------------------------------
-- Mentor read access to school data (additive permissive SELECT policies).
-- Mentors see classes/grades/assignments within their scope. Explicitly NOT
-- granted: health tables, teacher messaging, checkins, study plans.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS classes_mentor_read ON public.classes;
CREATE POLICY classes_mentor_read ON public.classes
  FOR SELECT USING (public.mentor_can_see_class(child_id, id));

DROP POLICY IF EXISTS grades_mentor_read ON public.grades;
CREATE POLICY grades_mentor_read ON public.grades
  FOR SELECT USING (public.mentor_can_see_class(child_id, class_id));

DROP POLICY IF EXISTS assignments_mentor_read ON public.assignments;
CREATE POLICY assignments_mentor_read ON public.assignments
  FOR SELECT USING (public.mentor_can_see_class(child_id, class_id));
