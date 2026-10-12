-- Migration 061: W6 Driving School — rules engine + hours log (S5-006)
--
-- CONTEXT: POST /api/v1/marketplace/driving/log and the progress GET are
-- coded RPC-first against rpc_log_driving_hours / rpc_driving_hours_progress,
-- which existed only in docs/squads/squad5/PENDING-MIGRATIONS.md (UNIT P3,
-- "awaiting MD renumbering"). The driving_log table itself was also never
-- migrated, so even the routes' direct-table fallbacks hit "relation does
-- not exist". This migration promotes UNIT P3 VERBATIM (Squad 4 DB
-- remediation) — per-state rules from day one (MD D3), GA verified against
-- dds.georgia.gov, FL against flhsmv.gov.
--
-- REQUIRES: 001 (children, child_access).
--
-- IDEMPOTENT: IF NOT EXISTS / OR REPLACE / ON CONFLICT DO UPDATE /
-- DROP POLICY IF EXISTS. Safe to re-run.
-- GRANT MODEL (P3 convention): driving_rules SELECT for anon+authenticated
-- (public reference data); driving_log family-scoped RLS, append-only
-- (no DELETE for authenticated); RPCs EXECUTE for authenticated.

-- P3.0 — driving_rules: versioned, per-state reference data.
CREATE TABLE IF NOT EXISTS public.driving_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code      text NOT NULL,                    -- 'GA', 'FL'
  rule_code       text NOT NULL,                    -- stable key, e.g. 'permit.min_age'
  category        text NOT NULL,                    -- permit | supervised_hours | provisional | full_license
  title           text NOT NULL,
  summary_md      text NOT NULL,                    -- paraphrased, plain language
  min_age_years   int,                              -- milestone age, NULL if n/a
  source_name     text NOT NULL,
  source_url      text NOT NULL,
  rules_verified_at date NOT NULL,
  UNIQUE (state_code, rule_code)
);
CREATE INDEX IF NOT EXISTS driving_rules_state_idx ON public.driving_rules (state_code, category);

ALTER TABLE public.driving_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS driving_rules_public_read ON public.driving_rules;
CREATE POLICY driving_rules_public_read ON public.driving_rules
  FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.driving_rules FROM anon, authenticated;
GRANT SELECT ON public.driving_rules TO anon, authenticated;

-- P3.1 — GA seed (dds.georgia.gov).
INSERT INTO public.driving_rules
  (state_code, rule_code, category, title, summary_md, min_age_years,
   source_name, source_url, rules_verified_at)
VALUES
  ('GA','permit.min_age','permit','Learner''s permit (Class CP) at 15',
   'At 15 you can apply for a Class CP instructional permit. You must pass a vision exam and a knowledge exam. The fee is $10. A parent, guardian, or driver-training instructor must sign the application.',
   15,'GA DDS — Parent Teen Driving Guide 2024–2025','https://dds.georgia.gov/media/12841/download','2026-10-12'),
  ('GA','permit.supervision','permit','Permit driving: supervised, no late nights',
   'With a permit you may only drive with a licensed driver age 21+ in the front seat. No driving from 12:00 midnight to 5:00 AM — no exceptions.',
   15,'GA DDS — Parent Teen Driving Guide 2024–2025','https://dds.georgia.gov/media/12841/download','2026-10-12'),
  ('GA','hours.joshuas_law','supervised_hours','Joshua''s Law: 30 hours class + 40 hours driving',
   'Before your Class D test you must finish a 30-hour driver education course and log 40 hours of supervised driving, with at least 6 hours at night.',
   NULL,'GA DDS — Parent Teen Driving Guide 2024–2025','https://dds.georgia.gov/media/12841/download','2026-10-12'),
  ('GA','provisional.eligibility','provisional','Class D provisional license at 16',
   'At 16, after holding your permit for 1 year and a day with no major violations, and finishing Joshua''s Law, you can take the road test for a Class D provisional license.',
   16,'GA DDS — Parent Teen Driving Guide 2024–2025','https://dds.georgia.gov/media/12841/download','2026-10-12'),
  ('GA','provisional.night','provisional','Class D: no driving midnight–5 AM',
   'Class D holders may not drive between midnight and 5:00 AM. The trip purpose does not matter — no work or school exception.',
   16,'GA TADRA summary (georgiacriminaldefense.com, citing GA licensing code)','https://www.georgiacriminaldefense.com/blog/curfew-16-year-olds/','2026-10-12'),
  ('GA','provisional.passengers','provisional','Class D: passenger limits phase in',
   'First 6 months: immediate family passengers only. Months 7–12: at most 1 non-family passenger under 21. After 12 months: at most 3 non-family passengers under 21.',
   16,'GA TADRA summary (georgiacriminaldefense.com, citing GA licensing code)','https://www.georgiacriminaldefense.com/blog/curfew-16-year-olds/','2026-10-12'),
  ('GA','full.class_c','full_license','Full Class C license at 18',
   'At 18 you can get an unrestricted Class C license, as long as your Class D is not suspended and you have gone 12 months without a disqualifying conviction.',
   18,'GA DDS — Parent Teen Driving Guide 2024–2025','https://dds.georgia.gov/media/12841/download','2026-10-12')
ON CONFLICT (state_code, rule_code) DO UPDATE SET
  title = EXCLUDED.title, summary_md = EXCLUDED.summary_md,
  min_age_years = EXCLUDED.min_age_years, source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url, rules_verified_at = EXCLUDED.rules_verified_at;

-- P3.2 — FL seed (flhsmv.gov).
INSERT INTO public.driving_rules
  (state_code, rule_code, category, title, summary_md, min_age_years,
   source_name, source_url, rules_verified_at)
VALUES
  ('FL','permit.min_age','permit','Learner''s license at 15',
   'At 15 you can get a learner''s license after a traffic law and substance abuse course and vision and hearing tests. A parent or guardian must sign if you are under 18.',
   15,'FLHSMV — Licensing Requirements for Teens','https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/','2026-10-12'),
  ('FL','permit.supervision','permit','Learner''s: 21+ supervisor, daylight only at first',
   'Always drive with a licensed driver age 21+ in the front seat. The first 3 months: daylight hours only. After that: until 10 PM. Hold the permit at least 12 months.',
   15,'FLHSMV — Licensing Requirements for Teens','https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/','2026-10-12'),
  ('FL','hours.supervised','supervised_hours','50 hours supervised, 10 at night',
   'Before your Class E test you must log 50 hours of supervised driving, with at least 10 hours at night, certified by a parent or guardian. No traffic convictions on the permit.',
   NULL,'FLHSMV — Licensing Requirements for Teens','https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/','2026-10-12'),
  ('FL','provisional.age16','provisional','Class E at 16: 6 AM–11 PM',
   'At 16, driving is allowed only between 6 AM and 11 PM, unless driving to or from work or with a licensed driver age 21+.',
   16,'FLHSMV — Licensing Requirements for Teens','https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/','2026-10-12'),
  ('FL','provisional.age17','provisional','Class E at 17: 5 AM–1 AM',
   'At 17, driving is allowed only between 5 AM and 1 AM, unless driving to or from work or with a licensed driver age 21+.',
   17,'FLHSMV — Licensing Requirements for Teens','https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/','2026-10-12'),
  ('FL','full.unrestricted','full_license','Full license at 18',
   'At 18 the Class E license is fully privileged: no time restrictions.',
   18,'FLHSMV — Licensing Requirements for Teens','https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/','2026-10-12')
ON CONFLICT (state_code, rule_code) DO UPDATE SET
  title = EXCLUDED.title, summary_md = EXCLUDED.summary_md,
  min_age_years = EXCLUDED.min_age_years, source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url, rules_verified_at = EXCLUDED.rules_verified_at;

-- P3.3 — driving_log: append-only supervised-hours log (real user data).
CREATE TABLE IF NOT EXISTS public.driving_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  logged_by          uuid NOT NULL REFERENCES auth.users(id),
  drive_date         date NOT NULL CHECK (drive_date <= CURRENT_DATE),
  minutes_total      int NOT NULL CHECK (minutes_total > 0 AND minutes_total <= 1440),
  minutes_night      int NOT NULL DEFAULT 0 CHECK (minutes_night >= 0),
  supervisor_name    text NOT NULL CHECK (char_length(supervisor_name) BETWEEN 1 AND 120),
  supervisor_licensed boolean NOT NULL DEFAULT true,
  conditions         text,                          -- e.g. 'rain', 'highway'
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driving_log_night_lte_total CHECK (minutes_night <= minutes_total)
);
CREATE INDEX IF NOT EXISTS driving_log_child_date_idx
  ON public.driving_log (child_id, drive_date DESC);

ALTER TABLE public.driving_log ENABLE ROW LEVEL SECURITY;

-- Teen (child-role with access) and parents of the child: full row access.
-- Parents may log on the teen's behalf; the log is append-only (no DELETE).
DROP POLICY IF EXISTS driving_log_family_all ON public.driving_log;
CREATE POLICY driving_log_family_all ON public.driving_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.child_id = driving_log.child_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.child_id = driving_log.child_id));
REVOKE DELETE ON public.driving_log FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.driving_log TO authenticated;

-- P3.4 — rpc_log_driving_hours + rpc_driving_hours_progress (real computation
-- against the state's requirement from driving_rules).
CREATE OR REPLACE FUNCTION public.rpc_log_driving_hours(
  p_child_id uuid, p_drive_date date, p_minutes_total int,
  p_minutes_night int DEFAULT 0, p_supervisor_name text DEFAULT NULL,
  p_conditions text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.child_id = p_child_id) THEN
    RAISE EXCEPTION 'no access to that child' USING ERRCODE = 'child_access_denied';
  END IF;
  IF p_minutes_total IS NULL OR p_minutes_total <= 0 OR p_minutes_total > 1440 THEN
    RAISE EXCEPTION 'minutes_total must be 1-1440' USING ERRCODE = 'bad_minutes';
  END IF;
  IF p_minutes_night < 0 OR p_minutes_night > p_minutes_total THEN
    RAISE EXCEPTION 'minutes_night must be 0..minutes_total' USING ERRCODE = 'bad_minutes';
  END IF;
  IF p_drive_date IS NULL OR p_drive_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'drive_date cannot be in the future' USING ERRCODE = 'bad_date';
  END IF;
  INSERT INTO public.driving_log
    (child_id, logged_by, drive_date, minutes_total, minutes_night,
     supervisor_name, conditions)
  VALUES (p_child_id, auth.uid(), p_drive_date, p_minutes_total,
          p_minutes_night, coalesce(nullif(btrim(p_supervisor_name),''), 'unspecified'),
          nullif(btrim(p_conditions), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_log_driving_hours(uuid, date, int, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_log_driving_hours(uuid, date, int, int, text, text) TO authenticated;

-- Progress vs the state requirement. GA: 40h / 6h night (Joshua's Law).
-- FL: 50h / 10h night. Unknown state -> GA-shaped default is NOT assumed;
-- the function raises unknown_state so the UI shows planning mode honestly.
CREATE OR REPLACE FUNCTION public.rpc_driving_hours_progress(
  p_child_id uuid, p_state_code text DEFAULT 'GA'
)
RETURNS TABLE (total_minutes bigint, night_minutes bigint,
               total_target int, night_target int,
               pct_total numeric, pct_night numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_t int;
  v_night_t int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.child_id = p_child_id) THEN
    RAISE EXCEPTION 'no access to that child' USING ERRCODE = 'child_access_denied';
  END IF;
  CASE p_state_code
    WHEN 'GA' THEN v_total_t := 2400; v_night_t := 360;
    WHEN 'FL' THEN v_total_t := 3000; v_night_t := 600;
    ELSE RAISE EXCEPTION 'no supervised-hours requirement on file for %', p_state_code
      USING ERRCODE = 'unknown_state';
  END CASE;
  RETURN QUERY
  SELECT coalesce(sum(minutes_total),0)::bigint,
         coalesce(sum(minutes_night),0)::bigint,
         v_total_t, v_night_t,
         round(coalesce(sum(minutes_total),0)::numeric / v_total_t * 100, 1),
         round(coalesce(sum(minutes_night),0)::numeric / v_night_t * 100, 1)
    FROM public.driving_log WHERE child_id = p_child_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_driving_hours_progress(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_driving_hours_progress(uuid, text) TO authenticated;
