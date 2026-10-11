-- Migration 009: sync queue + atomic sweep upsert (school portal workers)
--
-- The laptop workers (Windows/Mac) run the claim -> sweep -> upsert -> finish
-- pattern against these objects. Conventions follow 001_tenancy_core:
-- SECURITY DEFINER + SET search_path=public + REVOKE ALL FROM PUBLIC +
-- GRANT EXECUTE TO service_role only. RLS is enabled with NO policies
-- (service_role-only surface, same as agent_tenant_scope) — the 006 school
-- tables carry no client write policies for the sync path, so service_role
-- is the pipeline's write identity by design.
--
-- RPC naming follows the NEW project convention (plain names like
-- consume_invite) — deliberately NOT the old project's `rpc_` prefix.
--
-- STATUS: authored for DBA review — not yet applied to the pookie project.

-- ---------------------------------------------------------------------------
-- sync_jobs: the queue. SYNC NOW taps insert 'pending' rows (via
-- sync_request_job); workers claim with sync_claim_job and finish with
-- sync_finish_job. Log lines accumulate as a JSONB array (capped).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','claimed','complete','failed')),
  device_name text,
  summary     text,
  log         jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  claimed_at  timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS sync_jobs_child_status_created_idx
  ON public.sync_jobs (child_id, status, created_at DESC);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service_role-only via the RPCs below.

-- ---------------------------------------------------------------------------
-- sync_heartbeats: worker liveness, one row per device.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_heartbeats (
  device_name    text PRIMARY KEY,
  child_id       uuid REFERENCES public.children(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'idle',
  last_job_id    uuid REFERENCES public.sync_jobs(id) ON DELETE SET NULL,
  last_heartbeat timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_heartbeats ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service_role-only via the RPCs below.

-- ---------------------------------------------------------------------------
-- sync_request_job(p_child_id): SYNC NOW — enqueue a pending job.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_request_job(p_child_id uuid)
RETURNS public.sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.sync_jobs%ROWTYPE;
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_id_required';
  END IF;
  PERFORM 1 FROM public.children WHERE id = p_child_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_child';
  END IF;
  INSERT INTO public.sync_jobs (child_id, status)
  VALUES (p_child_id, 'pending')
  RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_request_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_request_job(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_claim_job(p_child_id): oldest pending job -> 'claimed' (SKIP LOCKED
-- so concurrent workers never double-claim).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_claim_job(p_child_id uuid)
RETURNS public.sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.sync_jobs%ROWTYPE;
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_id_required';
  END IF;
  SELECT * INTO v_job
  FROM public.sync_jobs
  WHERE child_id = p_child_id AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.sync_jobs
  SET status = 'claimed', claimed_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_claim_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_claim_job(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_finish_job(p_job_id, p_status, p_summary): terminal state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_finish_job(p_job_id uuid, p_status text, p_summary text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id_required';
  END IF;
  IF p_status NOT IN ('complete', 'failed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  UPDATE public.sync_jobs
  SET status = p_status,
      summary = left(p_summary, 2000),
      completed_at = now()
  WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_finish_job(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_finish_job(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_append_log(p_job_id, p_line, p_level): append to the job log,
-- keeping the most recent 500 entries (bounded growth).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_append_log(p_job_id uuid, p_line text, p_level text DEFAULT 'info')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log jsonb;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT log INTO v_log FROM public.sync_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  v_log := v_log || jsonb_build_object(
    't', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'level', COALESCE(p_level, 'info'),
    'line', left(COALESCE(p_line, ''), 2000));
  -- Bounded growth: keep the most recent 500 entries.
  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_log
    FROM (SELECT e
            FROM jsonb_array_elements(v_log) WITH ORDINALITY AS x(e, n)
           ORDER BY n DESC
           LIMIT 500) kept;
  UPDATE public.sync_jobs SET log = v_log WHERE id = p_job_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_append_log(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_append_log(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_heartbeat(p_device_name, p_child_id, p_status, p_job_id): worker liveness.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_heartbeat(
  p_device_name text, p_child_id uuid, p_status text, p_job_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_device_name IS NULL OR btrim(p_device_name) = '' THEN
    RAISE EXCEPTION 'device_name_required';
  END IF;
  INSERT INTO public.sync_heartbeats (device_name, child_id, status, last_job_id, last_heartbeat)
  VALUES (p_device_name, p_child_id, COALESCE(p_status, 'idle'), p_job_id, now())
  ON CONFLICT (device_name) DO UPDATE
     SET child_id = EXCLUDED.child_id,
         status = EXCLUDED.status,
         last_job_id = EXCLUDED.last_job_id,
         last_heartbeat = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_heartbeat(text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_heartbeat(text, uuid, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_upsert_sweep(p_child_id, p_term, p_sweep): THE upsert step.
-- One atomic call carrying the whole sweep:
--   p_sweep = {
--     "classes":     [{class_slug, name, period, teacher_name, teacher_email}],
--     "grades":      [{class_slug, numeric, term, source}],
--     "assignments": [{class_slug, source_id, title, category, due_date,
--                      status, points_earned, points_possible, notes}],
--     "messages":    [{class_slug|null, direction, subject, body,
--                      thread_key, sent_at}]
--   }
-- Writes:
--   classes            resolve-or-create by (child_id, class_slug) so grades
--                      are never dropped when a new class appears mid-year
--   grades             upsert on UNIQUE (child_id, class_id, term)
--   grade_snapshots    append one row per class per sync (feeds the
--                      >3pt-drop trigger; 13-month retention per 006)
--   assignments        upsert on UNIQUE (child_id, class_id, source_id);
--                      NULL source_id rows never collide (manual rows safe)
--   teacher_messages   inbound insert, deduped on (child_id, thread_key,
--                      sent_at) when thread_key is present
-- Returns a counts object. Raises on unknown child; skips rows whose class
-- slug cannot be resolved (defensive — the classes step runs first, so this
-- should not happen).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_upsert_sweep(
  p_child_id uuid, p_term text, p_sweep jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c jsonb; g jsonb; a jsonb; m jsonb;
  v_class_id uuid;
  v_slug     text;
  v_term     text;
  v_status   text;
  n_classes int := 0;
  n_grades  int := 0;
  n_snaps   int := 0;
  n_assign  int := 0;
  n_msg     int := 0;
  n_dupe    int := 0;
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'child_id_required';
  END IF;
  PERFORM 1 FROM public.children WHERE id = p_child_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_child';
  END IF;
  IF p_sweep IS NULL THEN
    RAISE EXCEPTION 'sweep_required';
  END IF;

  -- 1. classes: resolve-or-create by (child_id, class_slug)
  FOR c IN SELECT * FROM jsonb_array_elements(COALESCE(p_sweep->'classes', '[]'::jsonb)) LOOP
    v_slug := NULLIF(btrim(c->>'class_slug'), '');
    IF v_slug IS NULL THEN
      CONTINUE;
    END IF;
    SELECT id INTO v_class_id
      FROM public.classes
     WHERE child_id = p_child_id AND class_slug = v_slug;
    IF NOT FOUND THEN
      INSERT INTO public.classes
            (child_id, name, display_name, class_slug, period, teacher_name, teacher_email)
      VALUES (p_child_id,
              left(COALESCE(c->>'name', v_slug), 200),
              left(COALESCE(c->>'name', v_slug), 200),
              v_slug,
              NULLIF(left(COALESCE(c->>'period', ''), 20), ''),
              NULLIF(left(COALESCE(c->>'teacher_name', ''), 200), ''),
              NULLIF(left(COALESCE(c->>'teacher_email', ''), 200), ''))
      RETURNING id INTO v_class_id;
      n_classes := n_classes + 1;
    END IF;
  END LOOP;

  -- 2. grades: upsert current numeric per class per term
  FOR g IN SELECT * FROM jsonb_array_elements(COALESCE(p_sweep->'grades', '[]'::jsonb)) LOOP
    SELECT id INTO v_class_id
      FROM public.classes
     WHERE child_id = p_child_id AND class_slug = (g->>'class_slug');
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_term := COALESCE(NULLIF(btrim(g->>'term'), ''), p_term, 'GP');
    INSERT INTO public.grades (child_id, class_id, term, numeric, source, synced_at)
    VALUES (p_child_id, v_class_id, v_term,
            (g->>'numeric')::numeric,
            left(COALESCE(g->>'source', 'studentvue'), 40),
            now())
    ON CONFLICT (child_id, class_id, term)
    DO UPDATE SET numeric = EXCLUDED.numeric,
                  source = EXCLUDED.source,
                  synced_at = now();
    n_grades := n_grades + 1;

    -- 3. grade_snapshots: append-only history row for this sync
    INSERT INTO public.grade_snapshots (child_id, class_id, term, numeric, taken_at)
    VALUES (p_child_id, v_class_id, v_term, (g->>'numeric')::numeric, now());
    n_snaps := n_snaps + 1;
  END LOOP;

  -- 4. assignments: upsert on (child_id, class_id, source_id)
  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p_sweep->'assignments', '[]'::jsonb)) LOOP
    SELECT id INTO v_class_id
      FROM public.classes
     WHERE child_id = p_child_id AND class_slug = (a->>'class_slug');
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_status := COALESCE(a->>'status', 'upcoming');
    IF v_status NOT IN ('upcoming','submitted','graded','missing','late','excused') THEN
      v_status := 'upcoming';
    END IF;
    INSERT INTO public.assignments
          (child_id, class_id, source_id, title, category, due_date, status,
           points_earned, points_possible, notes, synced_at)
    VALUES (p_child_id, v_class_id,
            NULLIF(btrim(a->>'source_id'), ''),
            left(COALESCE(a->>'title', '(untitled)'), 500),
            NULLIF(left(COALESCE(a->>'category', ''), 80), ''),
            NULLIF(a->>'due_date', '')::timestamptz,
            v_status,
            NULLIF(a->>'points_earned', '')::numeric,
            NULLIF(a->>'points_possible', '')::numeric,
            NULLIF(left(COALESCE(a->>'notes', ''), 2000), ''),
            now())
    ON CONFLICT (child_id, class_id, source_id)
    DO UPDATE SET title = EXCLUDED.title,
                  category = EXCLUDED.category,
                  due_date = EXCLUDED.due_date,
                  status = EXCLUDED.status,
                  points_earned = EXCLUDED.points_earned,
                  points_possible = EXCLUDED.points_possible,
                  notes = EXCLUDED.notes,
                  synced_at = now();
    n_assign := n_assign + 1;
  END LOOP;

  -- 5. teacher_messages: inbound only; dedupe on thread_key + sent_at.
  -- class_slug NULL = counselor/general (class_id NULL).
  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(p_sweep->'messages', '[]'::jsonb)) LOOP
    IF (m->>'direction') IS DISTINCT FROM 'inbound' THEN
      CONTINUE;
    END IF;
    IF NULLIF(btrim(m->>'class_slug'), '') IS NOT NULL THEN
      SELECT id INTO v_class_id
        FROM public.classes
       WHERE child_id = p_child_id AND class_slug = (m->>'class_slug');
      IF NOT FOUND THEN
        v_class_id := NULL;  -- unknown class: keep the message, lose the link
      END IF;
    ELSE
      v_class_id := NULL;
    END IF;
    IF NULLIF(btrim(m->>'thread_key'), '') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.teacher_messages tm
          WHERE tm.child_id = p_child_id
            AND tm.direction = 'inbound'
            AND tm.thread_key = btrim(m->>'thread_key')
            AND COALESCE(tm.sent_at, 'epoch'::timestamptz)
              = COALESCE(NULLIF(m->>'sent_at', '')::timestamptz, 'epoch'::timestamptz)
       ) THEN
      n_dupe := n_dupe + 1;
      CONTINUE;
    END IF;
    INSERT INTO public.teacher_messages
          (child_id, class_id, direction, subject, body, status, thread_key, sent_at)
    VALUES (p_child_id, v_class_id, 'inbound',
            NULLIF(left(COALESCE(m->>'subject', ''), 500), ''),
            COALESCE(m->>'body', ''),
            'received',
            NULLIF(btrim(m->>'thread_key'), ''),
            NULLIF(m->>'sent_at', '')::timestamptz);
    n_msg := n_msg + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'classes_created', n_classes,
    'grades_upserted', n_grades,
    'snapshots_inserted', n_snaps,
    'assignments_upserted', n_assign,
    'messages_inserted', n_msg,
    'messages_skipped_dupe', n_dupe
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_upsert_sweep(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_upsert_sweep(uuid, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Grants: service_role bypasses RLS; nothing else touches these tables.
-- ---------------------------------------------------------------------------
GRANT ALL ON public.sync_jobs TO service_role;
GRANT ALL ON public.sync_heartbeats TO service_role;
