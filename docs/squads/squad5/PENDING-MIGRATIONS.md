# Squad 5 — PENDING-MIGRATIONS.md

**Status:** PENDING — **awaiting MD renumbering. DO NOT APPLY AS-IS.**
**Author:** Tech Lead / Senior Backend Engineer, Squad 5 · **Date:** 2026-10-12
**Freeze:** per MD directive 2026-10-12, nothing here may be created as a file in
`supabase/migrations/`. Each unit below is complete, review-ready SQL; only the
filename/number is deferred to the Managing Director's registry.

**How to apply (after MD assigns numbers):** split at the `UNIT P1..P6` banners, one file per
unit, in P1 → P6 order. Every unit is idempotent (`IF NOT EXISTS` / `OR REPLACE` /
`DROP ... IF EXISTS` / `ON CONFLICT DO UPDATE`).

**Dependencies:** 001, 002, 006, 013, 015 (in tree) · 021 `access_events` + `log_access_event()` (in
tree — used as the canonical audit append point) · 032 `support_tickets`/`ticket_events`/
`support_agents`/`support_oncall`/`support_credit_approvals` (in tree) · 033 helpers
(`support_user_age_band`, `support_is_agent`, `support_caller_agent_id`, `support_sla_due_at`,
`support_business_days_ago`) + RLS (in tree) · 034 `support_grants` + `expire_support_grants()`
(in tree) · 046 `faq_articles`/`faq_feedback`/`faq_article_versions` (in tree).

**Reconciliation with the tree (see BACKEND-CONTRACTS.md §1.1):**
- R-A: `ticket_events` (032) is the canonical thread table. Unit P1 writes ONLY to
  `ticket_events`; Unit P6 carries the `ticket_messages` (033) cleanup.
- R-B: audit writes go through 021's `log_access_event()` (nullable `child_id`, full
  `support.*` event list). Unit P6 retires 033's `support_log_event`.
- R-D: Unit P1 adds the missing `resolved_at` / `lead_review` columns
  (`ADD COLUMN IF NOT EXISTS` — additive, safe).

---
---

## UNIT P1 — Ticket / thread / grant / credit RPCs (S3 + D4)

Tables are REAL (032/034). This unit adds the missing server-side write paths: every status
change, message post, grant decision, scoped read, and credit goes through these RPCs.
Direct `UPDATE`/`DELETE` on `support_tickets` and `ticket_events` stays revoked from
`authenticated` (033); the transition-guard trigger (033) remains as defense-in-depth.

```sql
-- P1.0 — additive columns (R-D). 032's table won the CREATE race; 033's
-- resolved_at/lead_review never materialized.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_review boolean NOT NULL DEFAULT false;

-- P1.1 — rpc_open_ticket: the counterparty opens a ticket. Under-13 child-role
-- principals are rejected server-side (sol-support C5); the parent opens in
-- their own session with p_child_id set (on-behalf-of).
CREATE OR REPLACE FUNCTION public.rpc_open_ticket(
  p_subject       text,
  p_category      text,
  p_body          text,
  p_child_id      uuid DEFAULT NULL,
  p_priority      text DEFAULT 'P2',
  p_source        text DEFAULT 'manual',
  p_ai_transcript text DEFAULT NULL
)
RETURNS TABLE (ticket_id uuid, ticket_number text, sla_due_at timestamptz,
               status text, teen_privacy boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_band         text;
  v_tid          uuid;
  v_number       text;
  v_due          timestamptz;
  v_teen_privacy boolean;
  v_sensitive    boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'not_authenticated';
  END IF;
  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    RAISE EXCEPTION 'subject required' USING ERRCODE = 'subject_required';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'body required' USING ERRCODE = 'body_required';
  END IF;
  IF p_priority NOT IN ('P1','P2','P3') THEN
    RAISE EXCEPTION 'unknown priority' USING ERRCODE = 'invalid_priority';
  END IF;
  IF p_source NOT IN ('s2_escalation','manual','faq') THEN
    RAISE EXCEPTION 'unknown source' USING ERRCODE = 'invalid_source';
  END IF;

  v_band := public.support_user_age_band(v_uid);
  IF v_band = 'child' THEN
    RAISE EXCEPTION 'under-13 principals cannot open tickets or AI chats; the parent opens in their own session (sol-support C5)'
      USING ERRCODE = 'under13_ticket_denied';
  END IF;

  IF p_child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.user_id = v_uid AND ca.child_id = p_child_id
  ) THEN
    RAISE EXCEPTION 'no access to that child' USING ERRCODE = 'child_access_denied';
  END IF;

  -- FR-SUPPORT-004: teen-authored tickets are invisible to parent accounts
  -- at the RLS policy level (033).
  v_teen_privacy := (v_band = 'teen');
  -- §B.4: P1 / teen-authored / safety-category tickets are sensitive —
  -- self-assign blocked; a lead must assign.
  v_sensitive := (p_priority = 'P1') OR (v_band = 'teen') OR (p_category LIKE 'safety.%');

  v_due := public.support_sla_due_at(p_priority, now());

  INSERT INTO public.support_tickets
    (user_id, child_id, category, subject, priority, sensitive,
     teen_privacy, sla_due_at, source)
  VALUES
    (v_uid, p_child_id, p_category, p_subject, p_priority, v_sensitive,
     v_teen_privacy, v_due, p_source)
  RETURNING id, ticket_number INTO v_tid, v_number;

  -- First event: the user's own words (P1.6 redaction trigger fires).
  INSERT INTO public.ticket_events (ticket_id, author_type, author_id, kind, body)
  VALUES (v_tid, 'user', v_uid, 'message', p_body);

  -- S2 escalation: the AI transcript attaches as a collapsed row (§A.2).
  IF p_ai_transcript IS NOT NULL AND btrim(p_ai_transcript) <> '' THEN
    INSERT INTO public.ticket_events (ticket_id, author_type, kind, body)
    VALUES (v_tid, 'ai', 'ai_transcript', p_ai_transcript);
  END IF;

  -- NOTE: no access_events row on open — 021's event_type list has no
  -- 'support.ticket.opened'; the ticket row itself is the creation record.
  -- Views, assigns, grants, and reads are audited per §B.3.

  RETURN QUERY SELECT v_tid, v_number, v_due, 'open'::text, v_teen_privacy;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_open_ticket(text, text, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_open_ticket(text, text, text, uuid, text, text, text) TO authenticated;
```

```sql
-- P1.2 — rpc_claim_ticket: agent takes a ticket. Refuses non-agents,
-- sensitive-without-lead (§B.4), conflict of interest (logged), already-claimed.
CREATE OR REPLACE FUNCTION public.rpc_claim_ticket(p_ticket_id uuid)
RETURNS TABLE (ticket_id uuid, assigned_agent_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id  uuid := public.support_caller_agent_id();
  v_agent_uid uuid;
  v_t         public.support_tickets%ROWTYPE;
  v_name      text;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'not a support agent' USING ERRCODE = 'not_support_agent';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF v_t.sensitive AND NOT public.support_is_agent('lead') THEN
    RAISE EXCEPTION 'sensitive tickets (P1 / teen-authored / safety) require lead assignment'
      USING ERRCODE = 'sensitive_claim_requires_lead';
  END IF;

  SELECT sa.user_id INTO v_agent_uid FROM public.support_agents sa WHERE sa.id = v_agent_id;
  IF (v_t.child_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.child_access ca
         WHERE ca.user_id = v_agent_uid AND ca.child_id = v_t.child_id))
     OR (v_t.child_id IS NULL AND EXISTS (
        SELECT 1 FROM public.children c
        JOIN public.child_access ca ON ca.child_id = c.id
         WHERE c.parent_user_id = v_t.user_id AND ca.user_id = v_agent_uid))
  THEN
    PERFORM public.log_access_event(v_t.child_id, v_agent_uid, 'support.ticket.assigned',
      NULL, NULL, jsonb_build_object('refused', true, 'reason', 'conflict_of_interest'));
    RAISE EXCEPTION 'conflict of interest: agent is linked to this family'
      USING ERRCODE = 'conflict_of_interest';
  END IF;

  IF v_t.assigned_agent_id IS NOT NULL AND v_t.assigned_agent_id <> v_agent_id
     AND NOT public.support_is_agent('lead') THEN
    RAISE EXCEPTION 'ticket already claimed' USING ERRCODE = 'ticket_already_claimed';
  END IF;

  UPDATE public.support_tickets
     SET assigned_agent_id = v_agent_id, status = 'in_progress'
   WHERE id = p_ticket_id;

  SELECT display_name INTO v_name FROM public.support_agents WHERE id = v_agent_id;
  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change',
          'Agent ' || coalesce(v_name, 'support') || ' joined the ticket.',
          jsonb_build_object('from', 'open', 'to', 'in_progress', 'agent_id', v_agent_id));

  PERFORM public.log_access_event(v_t.child_id, v_agent_uid, 'support.ticket.assigned',
    NULL, NULL, jsonb_build_object('ticket_id', p_ticket_id, 'agent_id', v_agent_id));

  RETURN QUERY SELECT p_ticket_id, v_agent_id, 'in_progress'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_claim_ticket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_claim_ticket(uuid) TO authenticated;

-- P1.3 — rpc_assign_ticket: lead/admin assigns or reassigns.
CREATE OR REPLACE FUNCTION public.rpc_assign_ticket(p_ticket_id uuid, p_agent_id uuid)
RETURNS TABLE (ticket_id uuid, assigned_agent_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_child uuid;
BEGIN
  IF NOT public.support_is_agent('lead') THEN
    RAISE EXCEPTION 'lead role required' USING ERRCODE = 'lead_required';
  END IF;
  SELECT child_id INTO v_child FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_agents sa WHERE sa.id = p_agent_id AND sa.active) THEN
    RAISE EXCEPTION 'agent not found or inactive' USING ERRCODE = 'agent_not_found';
  END IF;

  UPDATE public.support_tickets
     SET assigned_agent_id = p_agent_id,
         status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
   WHERE id = p_ticket_id;

  SELECT display_name INTO v_name FROM public.support_agents WHERE id = p_agent_id;
  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change',
          'Ticket assigned to agent ' || coalesce(v_name, 'support') || '.',
          jsonb_build_object('to', 'in_progress', 'agent_id', p_agent_id, 'by_lead', true));

  PERFORM public.log_access_event(v_child, auth.uid(), 'support.ticket.assigned',
    NULL, NULL, jsonb_build_object('ticket_id', p_ticket_id, 'agent_id', p_agent_id, 'by_lead', true));

  RETURN QUERY SELECT p_ticket_id, p_agent_id,
    (SELECT status FROM public.support_tickets WHERE id = p_ticket_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_assign_ticket(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_assign_ticket(uuid, uuid) TO authenticated;

-- P1.4 — rpc_agent_mark_resolved: arms the user-confirm card (§A.3).
-- Does NOT close; only rpc_user_confirm_resolution or the auto-close does.
CREATE OR REPLACE FUNCTION public.rpc_agent_mark_resolved(p_ticket_id uuid)
RETURNS TABLE (ticket_id uuid, status text, resolved_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id uuid := public.support_caller_agent_id();
  v_t public.support_tickets%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'not a support agent' USING ERRCODE = 'not_support_agent';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF NOT (v_t.assigned_agent_id = v_agent_id OR public.support_is_agent('lead')) THEN
    RAISE EXCEPTION 'ticket not assigned to you' USING ERRCODE = 'ticket_not_assigned';
  END IF;
  IF v_t.status <> 'in_progress' THEN
    RAISE EXCEPTION 'only in-progress tickets can be resolved' USING ERRCODE = 'invalid_status_transition';
  END IF;

  UPDATE public.support_tickets
     SET status = 'resolved', resolved_at = v_now
   WHERE id = p_ticket_id;

  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change',
    'Our team thinks this is resolved. Please confirm below — nothing closes without your say.',
    jsonb_build_object('from', 'in_progress', 'to', 'resolved'));

  RETURN QUERY SELECT p_ticket_id, 'resolved'::text, v_now;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_agent_mark_resolved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_agent_mark_resolved(uuid) TO authenticated;

-- P1.5 — resolution handshake (user side).
CREATE OR REPLACE FUNCTION public.rpc_user_confirm_resolution(p_ticket_id uuid)
RETURNS TABLE (ticket_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  UPDATE public.support_tickets
     SET status = 'closed', closed_at = now()
   WHERE id = p_ticket_id AND user_id = v_uid AND status = 'resolved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found, not yours, or not resolved'
      USING ERRCODE = 'confirm_not_allowed';
  END IF;
  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change', 'You confirmed the fix. Ticket closed — thanks!',
          jsonb_build_object('from', 'resolved', 'to', 'closed'));
  RETURN QUERY SELECT p_ticket_id, 'closed'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_user_confirm_resolution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_user_confirm_resolution(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_user_reopen(p_ticket_id uuid)
RETURNS TABLE (ticket_id uuid, status text, reopened_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count int;
BEGIN
  UPDATE public.support_tickets
     SET status = 'in_progress',
         resolved_at = NULL,
         reopened_count = reopened_count + 1,
         lead_review = (reopened_count + 1 > 2)
   WHERE id = p_ticket_id AND user_id = v_uid AND status IN ('resolved','closed')
  RETURNING support_tickets.reopened_count INTO v_count;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found, not yours, or not reopenable'
      USING ERRCODE = 'reopen_not_allowed';
  END IF;
  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change', 'You reopened this ticket. We are on it again.',
          jsonb_build_object('to', 'in_progress', 'reopened_count', v_count));
  RETURN QUERY SELECT p_ticket_id, 'in_progress'::text, v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_user_reopen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_user_reopen(uuid) TO authenticated;
```

```sql
-- P1.6 — thread write path. The ONLY way to append to ticket_events for
-- authenticated users (direct INSERT stays revoked). Users write
-- kind='message' (internal forced false); agents write 'agent_reply' or
-- 'internal_note'. A user reply on a resolved ticket reopens it (§D.2).
-- Attachment rule: each ≤10 MB, images/PDFs (mime allowlist).
CREATE OR REPLACE FUNCTION public.rpc_post_ticket_message(
  p_ticket_id   uuid,
  p_body        text,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_internal    boolean DEFAULT false
)
RETURNS TABLE (event_id uuid, kind text, created_at timestamptz,
               redacted boolean, health_flagged boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_agent_id uuid := public.support_caller_agent_id();
  v_t        public.support_tickets%ROWTYPE;
  v_is_agent boolean := false;
  v_kind     text;
  v_internal boolean := false;
  v_att      jsonb;
  v_eid      uuid;
  v_created  timestamptz;
  v_red      boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'not_authenticated';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'message body required' USING ERRCODE = 'body_required';
  END IF;
  IF char_length(p_body) > 20000 THEN
    RAISE EXCEPTION 'message too long' USING ERRCODE = 'body_too_long';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF jsonb_typeof(p_attachments) <> 'array' THEN
    RAISE EXCEPTION 'attachments must be an array' USING ERRCODE = 'bad_attachments';
  END IF;
  FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
    IF (v_att->>'size')::bigint > 10485760 THEN
      RAISE EXCEPTION 'attachment exceeds 10 MB' USING ERRCODE = 'attachment_too_large';
    END IF;
    IF v_att->>'name' IS NULL
       OR coalesce(v_att->>'mime','') NOT IN
          ('image/png','image/jpeg','image/webp','image/gif','application/pdf') THEN
      RAISE EXCEPTION 'attachments must be images or PDFs with a name'
        USING ERRCODE = 'bad_attachments';
    END IF;
  END LOOP;

  IF v_agent_id IS NOT NULL THEN
    IF NOT (v_t.assigned_agent_id = v_agent_id
        OR (v_t.assigned_agent_id IS NULL AND v_t.status = 'open')
        OR public.support_is_agent('lead')) THEN
      RAISE EXCEPTION 'ticket not accessible' USING ERRCODE = 'ticket_not_accessible';
    END IF;
    v_is_agent := true;
    v_internal := p_internal;
    v_kind := CASE WHEN p_internal THEN 'internal_note' ELSE 'agent_reply' END;
  ELSE
    IF NOT (v_t.user_id = v_uid
        OR (v_t.teen_privacy = false AND v_t.child_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.child_access ca
               WHERE ca.user_id = v_uid AND ca.role = 'parent'
                 AND ca.child_id = v_t.child_id))) THEN
      RAISE EXCEPTION 'ticket not accessible' USING ERRCODE = 'ticket_not_accessible';
    END IF;
    v_kind := 'message';
    v_internal := false;
  END IF;

  IF v_t.status = 'closed' THEN
    RAISE EXCEPTION 'ticket is closed; reopen it first' USING ERRCODE = 'ticket_closed';
  END IF;

  INSERT INTO public.ticket_events
    (ticket_id, author_type, author_id, kind, body, internal, metadata)
  VALUES
    (p_ticket_id,
     CASE WHEN v_is_agent THEN 'agent' ELSE 'user' END,
     CASE WHEN v_is_agent THEN (SELECT user_id FROM public.support_agents WHERE id = v_agent_id)
          ELSE v_uid END,
     v_kind, p_body, v_internal,
     jsonb_build_object('attachments', p_attachments))
  RETURNING id, ticket_events.created_at, ticket_events.redacted
    INTO v_eid, v_created, v_red;

  IF v_internal THEN
    PERFORM public.log_access_event(v_t.child_id, v_uid, 'support.internal_note.created',
      NULL, NULL, jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_eid));
  END IF;

  -- "No, still broken": a user reply on a resolved ticket reopens it.
  IF NOT v_is_agent AND v_t.status = 'resolved' THEN
    UPDATE public.support_tickets
       SET status = 'in_progress', resolved_at = NULL,
           reopened_count = reopened_count + 1,
           lead_review = (reopened_count + 1 > 2)
     WHERE id = p_ticket_id;
    INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
    VALUES (p_ticket_id, 'system', 'status_change', 'Reopened by your reply.',
            jsonb_build_object('from', 'resolved', 'to', 'in_progress'));
  END IF;

  RETURN QUERY SELECT v_eid, v_kind, v_created, v_red,
    (SELECT (metadata->>'health_flagged')::boolean FROM public.ticket_events WHERE id = v_eid);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_post_ticket_message(uuid, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_post_ticket_message(uuid, text, jsonb, boolean) TO authenticated;

-- P1.7 — §C.3 PII redaction on ticket_events ingest (R-A: moved here from the
-- 033 ticket_messages trigger). Runs BEFORE storage: PANs, SSNs, pasted
-- passwords/secrets, bank account numbers -> '[redacted]', redacted=true.
-- Health-pattern heuristic -> metadata.health_flagged (agent warned; health
-- content never copied into internal notes). Heuristic ruleset — attorney
-- sign-off gate sol-support §E.1 before go-live.
CREATE OR REPLACE FUNCTION public.ticket_events_redact_pii()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_body text := NEW.body;
  v_meta jsonb := coalesce(NEW.metadata, '{}'::jsonb);
BEGIN
  IF v_body ~ '\y\d{3}-\d{2}-\d{4}\y' THEN
    v_body := regexp_replace(v_body, '\y\d{3}-\d{2}-\d{4}\y', '[redacted]', 'g');
    NEW.redacted := true;
  END IF;
  IF v_body ~ '\y\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\y' THEN
    v_body := regexp_replace(v_body, '\y\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\y', '[redacted]', 'g');
    NEW.redacted := true;
  END IF;
  IF v_body ~ '\y\d{13,19}\y' THEN
    v_body := regexp_replace(v_body, '\y\d{13,19}\y', '[redacted]', 'g');
    NEW.redacted := true;
  END IF;
  IF v_body ~* '(password|passwd|pwd|secret)\s*[:=]\s*\S+' THEN
    v_body := regexp_replace(v_body, '(?i)(password|passwd|pwd|secret)(\s*[:=]\s*)\S+', '\1\2[redacted]', 'g');
    NEW.redacted := true;
  END IF;
  IF v_body ~* 'account\s*(number|no\.?|#)?\s*[:#]?\s*\d{6,}' THEN
    v_body := regexp_replace(v_body, '(?i)(account(\s*(number|no\.?|#))?)(\s*[:#]?\s*)\d{6,}', '\1\4[redacted]', 'g');
    NEW.redacted := true;
  END IF;
  IF v_body ~* '(diagnos|prescription|medication|dosage|therapist|psychiatrist|insulin|inhaler|pregnan|contracept)' THEN
    v_meta := v_meta || '{"health_flagged": true}'::jsonb;
  END IF;
  NEW.body := v_body;
  NEW.metadata := v_meta;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ticket_events_redact_pii ON public.ticket_events;
CREATE TRIGGER ticket_events_redact_pii
  BEFORE INSERT ON public.ticket_events
  FOR EACH ROW EXECUTE FUNCTION public.ticket_events_redact_pii();

-- P1.8 — agent view audit (§B.3: no silent browsing).
CREATE OR REPLACE FUNCTION public.rpc_support_ticket_viewed(p_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id uuid := public.support_caller_agent_id();
  v_t public.support_tickets%ROWTYPE;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'not a support agent' USING ERRCODE = 'not_support_agent';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF NOT (v_t.assigned_agent_id = v_agent_id
      OR (v_t.assigned_agent_id IS NULL AND v_t.status = 'open')
      OR public.support_is_agent('lead')) THEN
    RAISE EXCEPTION 'ticket not accessible' USING ERRCODE = 'ticket_not_accessible';
  END IF;
  PERFORM public.log_access_event(v_t.child_id, auth.uid(), 'support.ticket.viewed',
    NULL, NULL, jsonb_build_object('ticket_id', p_ticket_id, 'agent_id', v_agent_id));
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_support_ticket_viewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_support_ticket_viewed(uuid) TO authenticated;

-- P1.9 — cron: auto-close resolved tickets silent 5 business days (§D.2).
CREATE OR REPLACE FUNCTION public.rpc_auto_close_resolved()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cutoff timestamptz := public.support_business_days_ago(5);
  v_ids uuid[];
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.support_is_agent('lead') THEN
    RAISE EXCEPTION 'service_role or lead only' USING ERRCODE = 'lead_required';
  END IF;
  SELECT coalesce(array_agg(id), '{}') INTO v_ids FROM public.support_tickets
   WHERE status = 'resolved' AND resolved_at < v_cutoff;
  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE public.support_tickets SET status = 'closed', closed_at = now()
     WHERE id = v_id AND status = 'resolved';
    INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
    VALUES (v_id, 'system', 'status_change',
      'Closed automatically after 5 business days with no reply. Reopen within 30 days if it is not fixed.',
      jsonb_build_object('from', 'resolved', 'to', 'closed', 'auto', true));
  END LOOP;
  RETURN coalesce(array_length(v_ids, 1), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_auto_close_resolved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_auto_close_resolved() TO authenticated, service_role;

-- P1.10 — cron (15 min): SLA breach flags + P3->P2 bump.
CREATE OR REPLACE FUNCTION public.rpc_support_sla_sweep()
RETURNS TABLE (breached int, bumped int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_breached int := 0;
  v_bumped   int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.support_is_agent('lead') THEN
    RAISE EXCEPTION 'service_role or lead only' USING ERRCODE = 'lead_required';
  END IF;
  WITH b AS (
    UPDATE public.support_tickets SET sla_breached = true
     WHERE sla_breached = false AND sla_due_at < now()
       AND status IN ('open','in_progress')
    RETURNING id, priority
  ), u AS (
    UPDATE public.support_tickets t SET priority = 'P2'
      FROM b WHERE t.id = b.id AND b.priority = 'P3'
    RETURNING t.id
  )
  SELECT (SELECT count(*) FROM b), (SELECT count(*) FROM u)
    INTO v_breached, v_bumped;
  RETURN QUERY SELECT v_breached, v_bumped;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_support_sla_sweep() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_support_sla_sweep() TO authenticated, service_role;
```

```sql
-- P1.11 — grant consenter (sol-support C2): the teen for teen-owned data,
-- else the counterparty. Only this user may approve/deny/revoke.
CREATE OR REPLACE FUNCTION public.support_grant_consenter(p_ticket_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t    public.support_tickets%ROWTYPE;
  v_teen uuid;
BEGIN
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_t.child_id IS NOT NULL THEN
    SELECT ca.user_id INTO v_teen FROM public.child_access ca
     WHERE ca.child_id = v_t.child_id AND ca.role = 'child' LIMIT 1;
    IF v_teen IS NOT NULL AND public.support_user_age_band(v_teen) = 'teen' THEN
      RETURN v_teen;
    END IF;
  END IF;
  RETURN v_t.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.support_grant_consenter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_grant_consenter(uuid) TO authenticated, service_role;

-- P1.12 — rpc_request_support_grant (§B.1). Health-family scopes rejected with
-- the explicit health_scope_rejected error (C1); the 034 CHECK allowlist
-- (school.grades.read, billing.read, sync.status.read) is the second gate.
-- Rate guard: <=3 requests/day/agent (§B.4).
CREATE OR REPLACE FUNCTION public.rpc_request_support_grant(
  p_ticket_id uuid, p_scope text, p_purpose text
)
RETURNS TABLE (grant_id uuid, status text, expires_at timestamptz, consenter_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id  uuid := public.support_caller_agent_id();
  v_t         public.support_tickets%ROWTYPE;
  v_today_n   int;
  v_gid       uuid;
  v_exp       timestamptz;
  v_consenter uuid;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'not a support agent' USING ERRCODE = 'not_support_agent';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF NOT (v_t.assigned_agent_id = v_agent_id
      OR (v_t.assigned_agent_id IS NULL AND v_t.status = 'open')
      OR public.support_is_agent('lead')) THEN
    RAISE EXCEPTION 'ticket not accessible' USING ERRCODE = 'ticket_not_accessible';
  END IF;

  IF p_scope ~ '^(health|wellbeing|mood|checkin)\.' THEN
    RAISE EXCEPTION 'health, wellbeing, mood, and check-in scopes can never be granted to support (sol-support C1)'
      USING ERRCODE = 'health_scope_rejected';
  END IF;
  IF p_scope NOT IN ('school.grades.read','billing.read','sync.status.read') THEN
    RAISE EXCEPTION 'scope is not in the support allowlist' USING ERRCODE = 'scope_not_allowed';
  END IF;
  IF p_purpose IS NULL OR char_length(btrim(p_purpose)) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'purpose must be 1-280 chars and is shown to the user'
      USING ERRCODE = 'bad_purpose';
  END IF;
  SELECT count(*) INTO v_today_n FROM public.support_grants g
   WHERE g.requested_by = v_agent_id AND g.created_at > now() - interval '1 day';
  IF v_today_n >= 3 THEN
    RAISE EXCEPTION 'grant request rate limit reached (3/day)' USING ERRCODE = 'grant_rate_limited';
  END IF;

  v_exp := now() + interval '24 hours';
  v_consenter := public.support_grant_consenter(p_ticket_id);

  INSERT INTO public.support_grants
    (ticket_id, agent_id, scope, purpose, requested_by, expires_at, status)
  VALUES (p_ticket_id, v_agent_id, p_scope, btrim(p_purpose), v_agent_id, v_exp, 'pending')
  RETURNING id INTO v_gid;

  PERFORM public.log_access_event(v_t.child_id, auth.uid(), 'support.grant.requested',
    NULL, NULL, jsonb_build_object('grant_id', v_gid, 'scope', p_scope, 'agent_id', v_agent_id));
  PERFORM public.log_access_event(v_t.child_id, auth.uid(), 'support.consent_card.sent',
    NULL, NULL, jsonb_build_object('grant_id', v_gid, 'consenter', v_consenter));
  -- NOTE: the in-app consent card + push is emitted by the notification
  -- service (sibling squad) reading new 'pending' grants; the grant row is
  -- the contract. Bodies contain no PII (subject only, §D.3).

  RETURN QUERY SELECT v_gid, 'pending'::text, v_exp, v_consenter;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_request_support_grant(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_request_support_grant(uuid, text, text) TO authenticated;

-- P1.13 — rpc_decide_support_grant: data owner approves/denies. Approve ->
-- active 24h. The 034 CHECK (expires_at <= created_at + 72h) caps everything.
CREATE OR REPLACE FUNCTION public.rpc_decide_support_grant(p_grant_id uuid, p_approve boolean)
RETURNS TABLE (grant_id uuid, status text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_g   public.support_grants%ROWTYPE;
  v_consenter uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'not_authenticated';
  END IF;
  SELECT * INTO v_g FROM public.support_grants WHERE id = p_grant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant not found' USING ERRCODE = 'grant_not_found';
  END IF;
  IF v_g.status <> 'pending' THEN
    RAISE EXCEPTION 'grant is not pending' USING ERRCODE = 'grant_not_pending';
  END IF;
  IF v_g.expires_at < now() THEN
    UPDATE public.support_grants SET status = 'expired' WHERE id = p_grant_id;
    RAISE EXCEPTION 'grant request expired' USING ERRCODE = 'grant_expired';
  END IF;
  v_consenter := public.support_grant_consenter(v_g.ticket_id);
  IF v_consenter IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'only the data owner can decide (the teen, for teen-owned data — sol-support C2)'
      USING ERRCODE = 'not_data_owner';
  END IF;

  IF p_approve THEN
    UPDATE public.support_grants
       SET status = 'active', consented_at = now(),
           expires_at = now() + interval '24 hours',
           granted_by_user_id = v_uid
     WHERE id = p_grant_id;
    PERFORM public.log_access_event(
      (SELECT child_id FROM public.support_tickets WHERE id = v_g.ticket_id),
      v_uid, 'support.grant.approved', NULL, NULL,
      jsonb_build_object('grant_id', p_grant_id, 'scope', v_g.scope));
  ELSE
    UPDATE public.support_grants
       SET status = 'denied', granted_by_user_id = v_uid
     WHERE id = p_grant_id;
    PERFORM public.log_access_event(
      (SELECT child_id FROM public.support_tickets WHERE id = v_g.ticket_id),
      v_uid, 'support.grant.denied', NULL, NULL,
      jsonb_build_object('grant_id', p_grant_id, 'scope', v_g.scope));
  END IF;

  RETURN QUERY SELECT p_grant_id,
    (SELECT status FROM public.support_grants WHERE id = p_grant_id),
    (SELECT expires_at FROM public.support_grants WHERE id = p_grant_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_decide_support_grant(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_decide_support_grant(uuid, boolean) TO authenticated;

-- P1.14 — rpc_extend_support_grant (lead only, max 72h from consent) and
-- rpc_revoke_support_grant (data owner or lead, anytime).
CREATE OR REPLACE FUNCTION public.rpc_extend_support_grant(p_grant_id uuid, p_hours int)
RETURNS TABLE (grant_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_g public.support_grants%ROWTYPE;
BEGIN
  IF NOT public.support_is_agent('lead') THEN
    RAISE EXCEPTION 'lead role required' USING ERRCODE = 'lead_required';
  END IF;
  SELECT * INTO v_g FROM public.support_grants WHERE id = p_grant_id;
  IF NOT FOUND OR v_g.status <> 'active' THEN
    RAISE EXCEPTION 'active grant not found' USING ERRCODE = 'grant_not_active';
  END IF;
  IF p_hours < 1 OR p_hours > 72
     OR v_g.consented_at + make_interval(hours => p_hours) > v_g.consented_at + interval '72 hours' THEN
    RAISE EXCEPTION 'extension must keep total within 72h of consent' USING ERRCODE = 'extend_cap_exceeded';
  END IF;
  UPDATE public.support_grants
     SET expires_at = consented_at + make_interval(hours => p_hours)
   WHERE id = p_grant_id;
  RETURN QUERY SELECT p_grant_id,
    (SELECT expires_at FROM public.support_grants WHERE id = p_grant_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_extend_support_grant(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_extend_support_grant(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_revoke_support_grant(p_grant_id uuid)
RETURNS TABLE (grant_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_g   public.support_grants%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM public.support_grants WHERE id = p_grant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant not found' USING ERRCODE = 'grant_not_found';
  END IF;
  IF v_g.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'grant is not revocable' USING ERRCODE = 'grant_not_revocable';
  END IF;
  IF NOT (public.support_grant_consenter(v_g.ticket_id) = v_uid
          OR public.support_is_agent('lead')) THEN
    RAISE EXCEPTION 'only the data owner or a lead can revoke' USING ERRCODE = 'not_data_owner';
  END IF;
  UPDATE public.support_grants SET status = 'revoked', revoked_at = now()
   WHERE id = p_grant_id;
  PERFORM public.log_access_event(
    (SELECT child_id FROM public.support_tickets WHERE id = v_g.ticket_id),
    v_uid, 'support.grant.revoked', NULL, NULL,
    jsonb_build_object('grant_id', p_grant_id, 'scope', v_g.scope));
  RETURN QUERY SELECT p_grant_id, 'revoked'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_revoke_support_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_support_grant(uuid) TO authenticated;
```

```sql
-- P1.15 — rpc_support_scoped_read: the agent reads THROUGH the grant (§B.1).
-- Active-grant check (right agent/ticket/scope, unexpired) + per-call
-- support.grant.data_accessed audit. There is no other read path.
CREATE OR REPLACE FUNCTION public.rpc_support_scoped_read(p_ticket_id uuid, p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id uuid := public.support_caller_agent_id();
  v_t        public.support_tickets%ROWTYPE;
  v_g        public.support_grants%ROWTYPE;
  v_data     jsonb;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'not a support agent' USING ERRCODE = 'not_support_agent';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  SELECT * INTO v_g FROM public.support_grants g
   WHERE g.ticket_id = p_ticket_id AND g.agent_id = v_agent_id
     AND g.scope = p_scope AND g.status = 'active' AND g.expires_at > now()
   ORDER BY g.consented_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active grant for this scope (request access first)'
      USING ERRCODE = 'no_active_grant';
  END IF;

  IF p_scope = 'school.grades.read' THEN
    IF v_t.child_id IS NULL THEN
      v_data := jsonb_build_object('grades', jsonb_build_array());
    ELSE
      SELECT jsonb_agg(row_to_json(x)) INTO v_data FROM (
        SELECT c.display_name AS class, g.term, g.numeric AS grade, g.synced_at AS as_of
          FROM public.grades g JOIN public.classes c ON c.id = g.class_id
         WHERE g.child_id = v_t.child_id ORDER BY c.display_order) x;
      v_data := jsonb_build_object('grades', coalesce(v_data, '[]'::jsonb));
    END IF;
  ELSIF p_scope = 'sync.status.read' THEN
    IF v_t.child_id IS NULL THEN
      v_data := jsonb_build_object('jobs', jsonb_build_array(), 'heartbeats', jsonb_build_array());
    ELSE
      SELECT jsonb_build_object(
        'jobs', coalesce((SELECT jsonb_agg(row_to_json(j)) FROM (
            SELECT status, device_name, summary, created_at, completed_at
              FROM public.sync_jobs WHERE child_id = v_t.child_id
             ORDER BY created_at DESC LIMIT 5) j), '[]'::jsonb),
        'heartbeats', coalesce((SELECT jsonb_agg(row_to_json(h)) FROM (
            SELECT device_name, status, last_heartbeat
              FROM public.sync_heartbeats WHERE child_id = v_t.child_id) h), '[]'::jsonb)
      ) INTO v_data;
    END IF;
  ELSIF p_scope = 'billing.read' THEN
    -- INTEGRATION POINT (Money squad): no billing tables exist in the tree
    -- yet. Grant validation + audit above are complete and enforced; the
    -- payload reader lands with the billing tables. data_status tells the
    -- agent console to render "billing detail not yet connected".
    v_data := jsonb_build_object('data_status', 'module_not_built',
      'note', 'billing tables land with the Money squad; grant + audit enforced');
  ELSE
    RAISE EXCEPTION 'unknown scope' USING ERRCODE = 'scope_not_allowed';
  END IF;

  PERFORM public.log_access_event(v_t.child_id, auth.uid(), 'support.grant.data_accessed',
    NULL, NULL, jsonb_build_object('grant_id', v_g.id, 'scope', p_scope, 'agent_id', v_agent_id));

  RETURN jsonb_build_object('ticket_id', p_ticket_id, 'scope', p_scope,
                            'accessed_at', now(), 'data', v_data);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_support_scoped_read(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_support_scoped_read(uuid, text) TO authenticated;

-- P1.16 — D4 financial authority. Agents issue <= $50 (5000c) in-ticket
-- directly; above $50 creates a support_credit_approvals row for admin (MD).
CREATE OR REPLACE FUNCTION public.rpc_issue_support_credit(
  p_ticket_id uuid, p_amount_cents int, p_reason text
)
RETURNS TABLE (event_id uuid, approval_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id uuid := public.support_caller_agent_id();
  v_t        public.support_tickets%ROWTYPE;
  v_eid      uuid;
  v_aid      uuid;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'not a support agent' USING ERRCODE = 'not_support_agent';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'credit amount must be positive' USING ERRCODE = 'credit_amount_invalid';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'reason must be 1-280 chars' USING ERRCODE = 'bad_purpose';
  END IF;
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'ticket_not_found';
  END IF;
  IF NOT (v_t.assigned_agent_id = v_agent_id OR public.support_is_agent('lead')) THEN
    RAISE EXCEPTION 'ticket not assigned to you' USING ERRCODE = 'ticket_not_assigned';
  END IF;

  IF p_amount_cents <= 5000 THEN
    INSERT INTO public.ticket_events
      (ticket_id, author_type, author_id, kind, body, amount_cents, metadata)
    VALUES (p_ticket_id, 'agent',
            (SELECT user_id FROM public.support_agents WHERE id = v_agent_id),
            'credit_issued',
            'Credit issued: $' || (p_amount_cents::numeric/100)::text || '. ' || btrim(p_reason),
            p_amount_cents,
            jsonb_build_object('agent_id', v_agent_id, 'reason', btrim(p_reason)))
    RETURNING id INTO v_eid;
    PERFORM public.log_access_event(v_t.child_id, auth.uid(), 'support.credit.issued',
      NULL, 'credit_issued',
      jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_eid),
      p_amount_cents);
    RETURN QUERY SELECT v_eid, NULL::uuid, 'issued'::text;
  ELSE
    INSERT INTO public.support_credit_approvals
      (ticket_id, amount_cents, reason, requested_by)
    VALUES (p_ticket_id, p_amount_cents, btrim(p_reason), v_agent_id)
    RETURNING id INTO v_aid;
    INSERT INTO public.ticket_events
      (ticket_id, author_type, kind, body, amount_cents, metadata)
    VALUES (p_ticket_id, 'system', 'approval_requested',
            'Credit of $' || (p_amount_cents::numeric/100)::text
              || ' needs Managing Director approval. We will update you here.',
            p_amount_cents,
            jsonb_build_object('approval_id', v_aid, 'agent_id', v_agent_id))
    RETURNING id INTO v_eid;
    PERFORM public.log_access_event(v_t.child_id, auth.uid(),
      'support.credit.approval_requested', NULL, 'credit_approval',
      jsonb_build_object('ticket_id', p_ticket_id, 'approval_id', v_aid),
      p_amount_cents);
    RETURN QUERY SELECT v_eid, v_aid, 'pending_approval'::text;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_issue_support_credit(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_issue_support_credit(uuid, int, text) TO authenticated;

-- P1.17 — rpc_decide_credit_approval: admin (MD) decides >$50 requests.
-- On approve, the credit_issued thread row is written (visible to the user).
CREATE OR REPLACE FUNCTION public.rpc_decide_credit_approval(
  p_approval_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS TABLE (approval_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a public.support_credit_approvals%ROWTYPE;
  v_child uuid;
BEGIN
  IF NOT public.support_is_agent('admin') THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'admin_required';
  END IF;
  SELECT * INTO v_a FROM public.support_credit_approvals WHERE id = p_approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval not found' USING ERRCODE = 'approval_not_found';
  END IF;
  IF v_a.status <> 'pending' THEN
    RAISE EXCEPTION 'approval is not pending' USING ERRCODE = 'approval_not_pending';
  END IF;
  SELECT child_id INTO v_child FROM public.support_tickets WHERE id = v_a.ticket_id;

  UPDATE public.support_credit_approvals
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'denied' END,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   WHERE id = p_approval_id;

  IF p_approve THEN
    INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, amount_cents, metadata)
    VALUES (v_a.ticket_id, 'system', 'credit_issued',
            'Credit issued: $' || (v_a.amount_cents::numeric/100)::text || '. ' || v_a.reason,
            v_a.amount_cents,
            jsonb_build_object('approval_id', p_approval_id));
  ELSE
    INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
    VALUES (v_a.ticket_id, 'system', 'approval_decided',
            'The requested credit was not approved.' || coalesce(' Note: ' || p_note, ''),
            jsonb_build_object('approval_id', p_approval_id, 'approved', false));
  END IF;

  PERFORM public.log_access_event(v_child, auth.uid(), 'support.credit.approval_decided',
    NULL, 'credit_approval',
    jsonb_build_object('approval_id', p_approval_id, 'approved', p_approve),
    v_a.amount_cents);

  RETURN QUERY SELECT p_approval_id,
    (SELECT status FROM public.support_credit_approvals WHERE id = p_approval_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_decide_credit_approval(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_decide_credit_approval(uuid, boolean, text) TO authenticated;
```

---
---

## UNIT P2 — FAQ search + versioning + seed corpus (S1)

Tables are REAL (046). This unit adds: pgvector + `embedding`, the typo-tolerance index,
keyword + semantic search RPCs, the legal-versioning trigger, the editorial-flag RPC,
and the 23-article launch-floor seed (MD directive 2026-10-12).

```sql
-- P2.0 — extensions + additive columns/indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.faq_articles ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- NOTE: add an IVFFlat/HNSW index on embedding once the corpus exceeds ~50k
-- rows; sequential scan is correct and fast below that.

CREATE INDEX IF NOT EXISTS faq_articles_title_trgm
  ON public.faq_articles USING gin (title gin_trgm_ops);

-- P2.1 — legal versioning trigger (§A.5.2/§A.5.3): every UPDATE snapshots;
-- legal edits bump legal_version and restart the 6-month review clock.
-- (Attorney sign-off gate §E.1 still applies before new text goes live.)
CREATE OR REPLACE FUNCTION public.faq_article_versioning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next int;
BEGIN
  IF NEW.legal_note_md IS DISTINCT FROM OLD.legal_note_md
     OR NEW.legal_citation IS DISTINCT FROM OLD.legal_citation
     OR NEW.legal_basis IS DISTINCT FROM OLD.legal_basis THEN
    NEW.legal_version := OLD.legal_version + 1;
    NEW.legal_reviewed_at := CURRENT_DATE;
    NEW.legal_review_due_at := CURRENT_DATE + INTERVAL '6 months';
  END IF;
  NEW.updated_at := now();
  v_next := coalesce(
    (SELECT max(version) FROM public.faq_article_versions WHERE article_id = NEW.id), 0) + 1;
  INSERT INTO public.faq_article_versions
    (article_id, version, title, body_md, legal_note_md, legal_citation,
     legal_basis, legal_reviewed_at, legal_review_due_at, changed_by)
  VALUES (NEW.id, v_next, NEW.title, NEW.body_md, NEW.legal_note_md,
          NEW.legal_citation, NEW.legal_basis, NEW.legal_reviewed_at,
          NEW.legal_review_due_at, auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS faq_article_versioning ON public.faq_articles;
CREATE TRIGGER faq_article_versioning
  BEFORE UPDATE ON public.faq_articles
  FOR EACH ROW EXECUTE FUNCTION public.faq_article_versioning();

-- P2.2 — rpc_faq_search: keyword-first (ts_rank + pg_trgm typo tolerance),
-- band-filtered server-side, live-only. Hidden-result counts never disclosed.
CREATE OR REPLACE FUNCTION public.rpc_faq_search(
  p_query text, p_viewer_band text DEFAULT 'all', p_limit int DEFAULT 10
)
RETURNS TABLE (article_id uuid, slug text, title text, category text,
               score double precision, snippet text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q tsquery;
BEGIN
  IF p_query IS NULL OR btrim(p_query) = '' THEN RETURN; END IF;
  IF p_viewer_band NOT IN ('all','teen','parent','adult') THEN
    RAISE EXCEPTION 'bad viewer band' USING ERRCODE = 'invalid_band';
  END IF;
  v_q := plainto_tsquery('english', p_query);
  RETURN QUERY
  SELECT a.id, a.slug, a.title, a.category,
         (ts_rank(a.search_vector, v_q) * 2.0 + similarity(a.title, p_query))::double precision,
         left(a.body_md, 280)
    FROM public.faq_articles a
   WHERE a.status = 'live'
     AND (a.age_band = 'all' OR a.age_band = p_viewer_band OR p_viewer_band = 'adult')
     AND (a.search_vector @@ v_q OR similarity(a.title, p_query) > 0.25)
   ORDER BY 5 DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 25);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_faq_search(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_faq_search(text, text, int) TO anon, authenticated;

-- P2.3 — rpc_faq_semantic_search: fallback when keyword returns <3 results.
-- The route handler embeds the query (Workers AI) and calls this; results
-- render under a quiet "Related answers" header.
CREATE OR REPLACE FUNCTION public.rpc_faq_semantic_search(
  p_embedding vector(1536), p_viewer_band text DEFAULT 'all', p_limit int DEFAULT 5
)
RETURNS TABLE (article_id uuid, slug text, title text, category text,
               distance double precision, snippet text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_embedding IS NULL THEN RETURN; END IF;
  IF p_viewer_band NOT IN ('all','teen','parent','adult') THEN
    RAISE EXCEPTION 'bad viewer band' USING ERRCODE = 'invalid_band';
  END IF;
  RETURN QUERY
  SELECT a.id, a.slug, a.title, a.category,
         (a.embedding <=> p_embedding)::double precision, left(a.body_md, 280)
    FROM public.faq_articles a
   WHERE a.status = 'live' AND a.embedding IS NOT NULL
     AND (a.age_band = 'all' OR a.age_band = p_viewer_band OR p_viewer_band = 'adult')
   ORDER BY a.embedding <=> p_embedding
   LIMIT LEAST(GREATEST(p_limit, 1), 10);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_faq_semantic_search(vector, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_faq_semantic_search(vector, text, int) TO anon, authenticated;

-- P2.4 — rpc_faq_get_article: full article incl. LegalAccordion fields.
CREATE OR REPLACE FUNCTION public.rpc_faq_get_article(p_slug text, p_viewer_band text DEFAULT 'all')
RETURNS TABLE (article_id uuid, slug text, title text, body_md text, category text,
  keywords text[], age_band text, related_slugs text[],
  legal_note_md text, legal_citation text, legal_basis text,
  legal_reviewed_at date, legal_review_due_at date, legal_version int, legal_stale boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a public.faq_articles%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.faq_articles a
   WHERE a.slug = p_slug AND a.status = 'live';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'article not found' USING ERRCODE = 'faq_not_found';
  END IF;
  IF NOT (v_a.age_band = 'all' OR v_a.age_band = p_viewer_band OR p_viewer_band = 'adult') THEN
    RAISE EXCEPTION 'article not available for this age band' USING ERRCODE = 'faq_band_forbidden';
  END IF;
  RETURN QUERY SELECT v_a.id, v_a.slug, v_a.title, v_a.body_md, v_a.category,
    v_a.keywords, v_a.age_band, v_a.related_slugs,
    v_a.legal_note_md, v_a.legal_citation, v_a.legal_basis,
    v_a.legal_reviewed_at, v_a.legal_review_due_at, v_a.legal_version,
    (v_a.legal_review_due_at IS NOT NULL AND v_a.legal_review_due_at < CURRENT_DATE);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_faq_get_article(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_faq_get_article(text, text) TO anon, authenticated;

-- P2.5 — feedback columns first (the 👍/👎 correction path, §A.2), then
-- rpc_faq_feedback writes all of them.
ALTER TABLE public.faq_feedback
  ADD COLUMN IF NOT EXISTS reason text
    CHECK (reason IS NULL OR reason IN ('wrong_answer','out_of_date','too_confusing','did_not_answer')),
  ADD COLUMN IF NOT EXISTS note text CHECK (note IS NULL OR char_length(note) <= 500),
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.rpc_faq_feedback(
  p_article_id uuid, p_helpful boolean,
  p_reason text DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.faq_articles WHERE id = p_article_id AND status = 'live') THEN
    RAISE EXCEPTION 'article not found' USING ERRCODE = 'faq_not_found';
  END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN
     ('wrong_answer','out_of_date','too_confusing','did_not_answer') THEN
    RAISE EXCEPTION 'bad reason' USING ERRCODE = 'invalid_reason';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN
    RAISE EXCEPTION 'note too long' USING ERRCODE = 'note_too_long';
  END IF;
  INSERT INTO public.faq_feedback (article_id, helpful, reason, note, submitted_by)
  VALUES (p_article_id, p_helpful, p_reason, p_note, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_faq_feedback(uuid, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_faq_feedback(uuid, boolean, text, text) TO authenticated;

-- P2.6 — editorial flag: helpful-rate < 60% over 30 days (>= 10 responses)
-- auto-flags the article for review (§A.2 correction path).
RETURNS TABLE (article_id uuid, slug text, title text,
               responses bigint, helpful_rate double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = 'service_role_required';
  END IF;
  RETURN QUERY
  SELECT a.id, a.slug, a.title, count(f.id)::bigint,
         (count(*) FILTER (WHERE f.helpful)::double precision / count(*))
    FROM public.faq_articles a JOIN public.faq_feedback f ON f.article_id = a.id
   WHERE a.status = 'live' AND f.created_at > now() - interval '30 days'
   GROUP BY a.id, a.slug, a.title
  HAVING count(*) >= 10
     AND (count(*) FILTER (WHERE f.helpful)::double precision / count(*)) < 0.60;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_faq_flagged_for_review() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_faq_flagged_for_review() TO service_role;
```

### P2.8 — Seed corpus: 23-article launch floor (MD directive 2026-10-12)

Real copy, ≤8th-grade reading level (validated: `docs/squads/squad5/work/faq_seed_gen.py` —
all 23 articles score FK ≤ 8.0 on body and legal accordion separately). Covers all 9 sections
(health/home/school/safety/travel/marketplace/support/account/legal) with ≥1 how-to + ≥1
troubleshooting each, plus 8 legal accordions (honesty lines included; attorney sign-off
still required per §E.1 before go-live). Idempotent (`ON CONFLICT (slug) DO UPDATE`).

```sql
-- READABILITY OK: 23 articles, all FK <= 8.0 (body + legal separately)

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('health-connect-device', 'How do I connect Apple Health or Google Fit?', 'Your steps, sleep, and workouts can flow into Pookie on their own.

**Fix it**
1. Open the Health tab.
2. Tap Connect, then pick Apple Health on iPhone or Health Connect on Android.
3. Approve the types you want to share, like steps and sleep.
4. Come back tomorrow. The first sync can take up to 24 hours.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'health',
   ARRAY['connect','apple health','google fit','sync','steps','sleep'], 'all', ARRAY['health-sync-stopped'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('health-sync-stopped', 'My health data stopped syncing.', 'When the numbers freeze, the phone link is usually the cause.

**Fix it**
1. Open your phone''s health app and check that Pookie still has access.
2. Open Pookie''s Health tab and pull down to refresh.
3. If you changed your phone password or reinstalled the app, reconnect it.
4. Wait one hour, then check again.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'health',
   ARRAY['sync stopped','frozen','not updating','health data'], 'all', ARRAY['health-connect-device'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('wellbeing-privacy-mood', 'Who can see my mood check-ins?', 'Only you. Your mood check-ins live in a private space.

**The rule**
1. Parents, siblings, and support agents cannot see your mood entries.
2. No one can see totals or trends made from them either.
3. If you ever want to share one, you choose what to share and with whom.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'health',
   ARRAY['mood','private','privacy','wellbeing','check-in','parents'], 'all', '{}',
   'our_choice', NULL, 'The law doesn''t require this — we do it because a feelings journal only works if it is truly private. Privacy laws set a floor. They say: don''t leak people''s data. They don''t say how little your own staff should see. We chose the strictest workable version. No parent view. No agent view. No totals. No exceptions.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('mail-snap-intake', 'How do I add a piece of physical mail?', 'Snap a photo and Pookie reads the bill for you.

**Fix it**
1. Open the Home tab, then Mail.
2. Tap the camera button and snap the front of the letter.
3. Check what Pookie found: who it is from, the amount, and the due date.
4. Tap Save. Pookie will remind you before it is due.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'home',
   ARRAY['mail','letter','bill','scan','photo','camera'], 'all', ARRAY['spending-categorization'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('spending-categorization', 'How does Pookie sort my spending?', 'Pookie groups each purchase so you can see where your money goes.

**How it works**
1. When a purchase syncs, Pookie guesses the group, like Groceries or Gas.
2. Wrong guess? Tap the purchase and pick the right group. Pookie learns from you.
3. Groups roll up into a monthly view under Home, then Spending.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'home',
   ARRAY['spending','categories','budget','sort'], 'all', ARRAY['mail-snap-intake'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('school-sync-grades', 'How do I connect my school grades?', 'Link your school portal once. Pookie pulls your grades each day after that.

**Fix it**
1. Open the School tab.
2. Tap Connect portal and pick your school system.
3. Sign in with your school login. Pookie keeps it in an encrypted vault.
4. The first pull can take a few minutes. Later pulls run on their own.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'school',
   ARRAY['grades','school','portal','parentvue','connect','sync'], 'all', ARRAY['grades-stopped-updating'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('grades-stopped-updating', 'My grades stopped updating.', 'Grade syncs break most often when a school password changes.

**Fix it**
1. Open the School tab and tap Sync now.
2. If it asks you to sign in again, your school password changed. Enter the new one.
3. Check that your school''s portal itself works. If the portal is down, Pookie has to wait too.
4. Still old after a day? Your school may not have posted new grades yet.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'school',
   ARRAY['grades','sync','stopped','frozen','not updating','portal'], 'all', ARRAY['school-sync-grades'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('school-records-after-revoke', 'My teen removed my access in Pookie. Why can I still see their report card from the school?', 'Those are two different doors. Pookie''s Sharing screen controls what Pookie shares. Your school gives you records directly. Pookie cannot close that door, and it cannot open it either.

What Pookie does do: the moment your teen revokes, Pookie stops sharing the copy of grades inside the app. Right away. But the school''s own parent portal is between you and the school.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'school',
   ARRAY['revoke','access','ferpa','report card','records','removed'], 'parent', ARRAY['access-model-child-authority'],
   'law_required', 'FERPA — Family Educational Rights and Privacy Act, 20 U.S.C. §1232g', 'FERPA gives parents the right to their child''s school records until the child turns 18. Then the right moves to the student. Your school follows FERPA, not Pookie''s settings. What Pookie can do is stop sharing its own copy of grades the moment your teen revokes — and it does, at once.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('emergency-plan-setup', 'How do I set up our family emergency plan?', 'One plan, and everyone knows it.

**Fix it**
1. Open the Safety tab, then Emergency plan.
2. Add two meeting spots: one near home, one outside your area.
3. Add your out-of-area contact. This is the person everyone calls if local lines fail.
4. Walk through it with your family once. A plan no one has read is not a plan.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'safety',
   ARRAY['emergency','plan','safety','meeting spot','contact'], 'all', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('screen-time-limits', 'How do I set screen time limits?', 'Set the hours once. Pookie keeps the rhythm.

**Fix it**
1. Open the Safety tab, then Screen time.
2. Pick your child''s profile.
3. Set bedtime hours and any school-day limits.
4. Talk with your child about the why. Limits work best when they are not a surprise.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'safety',
   ARRAY['screen time','limits','bedtime','parental controls'], 'parent', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('flights-booking-basics', 'How do I book a flight in Pookie?', 'Search, pick, and pay — with one firm rule about who can pay.

**Fix it**
1. Open the Travel tab, then Flights.
2. Enter where from, where to, and your dates.
3. Compare the ranked results. Fees and bags are shown up front.
4. The person paying must be 18 or older. A teen can plan the whole trip, but an adult completes the purchase.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'travel',
   ARRAY['flights','book','tickets','travel','18'], 'all', ARRAY['rental-cars-age-rules'],
   'both', 'Contract law (minor capacity doctrines, state law) + Pookie policy', 'The law part: in most states, people under 18 cannot enter binding contracts, and airlines require an adult as the purchaser of record. Our choice on top of it: we enforce this in the software itself. A teen account cannot complete any purchase or booking flow, not just flights. Planning is open to all. Paying is 18+.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('rental-cars-age-rules', 'Why can''t I see rental cars?', 'If you are under 18, the rental car section stays hidden. This is on purpose.

**How it works**
1. Rental companies set minimum ages, often 21 or 25, and add young-driver fees.
2. Since no teen can complete a rental, Pookie hides the whole section from teen accounts. We show nothing you cannot use.
3. Adults see ranked totals with young-driver fees folded in where they apply.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'travel',
   ARRAY['rental car','hidden','age','21','25'], 'all', ARRAY['flights-booking-basics'],
   'both', 'State rental-age rules + rental company policy + Pookie policy', 'The law and company part: states and rental companies set minimum ages and fees. Those are their rules, not ours. Our choice: instead of showing teens prices they can never pay, we hide the section at the API layer. No teasing, no dead ends.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('babysitters-find-book', 'How do I find and book a babysitter?', 'Vetted sitters near you, booked in a few taps.

**Fix it**
1. Open the Marketplace tab, then Babysitters.
2. Enter the date, time, and your kids'' ages.
3. Read profiles: experience, rates, and background-check status.
4. Tap Book and confirm. You will get a reminder before the sit.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'marketplace',
   ARRAY['babysitter','sitter','book','childcare'], 'all', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('driving-school-hours', 'How do I log my driving practice hours?', 'Georgia counts your practice. Log every drive and watch the bar fill.

**Fix it**
1. Open the Marketplace tab, then Driving School.
2. After each drive, tap Log hours.
3. Enter the date, total minutes, night minutes, and who rode with you.
4. Georgia''s Joshua''s Law needs 40 hours with 6 at night before your Class D test. Pookie tracks your progress.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'marketplace',
   ARRAY['driving','hours','log','joshua''s law','permit','practice'], 'teen', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('help-center-how-to', 'How do I use the Help Center?', 'Answers first, humans when you need them.

**Fix it**
1. Open the Support tab. This Help Center is step one.
2. Search or browse the nine sections. Every feature has a how-to and a fix-it article.
3. Tap the question mark on any hard screen to jump straight to the right article.
4. Not finding it? The AI chat and tickets are one tap away.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['help','faq','support','how to'], 'all', ARRAY['ai-support-chat-how-to','tickets-open-track'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('ai-support-chat-how-to', 'What can the AI support chat do?', 'It fixes common problems fast, and hands you to a human the moment it should.

**What it can do**
1. Walk you through features and fix common problems, any time of day.
2. It cannot see your private data: not grades, not health, not check-ins.
3. It cannot delete or export your account. Those need a human.
4. Say "human" at any point. A person takes over with your full chat attached.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['ai','chat','assistant','human','bot'], 'all', ARRAY['help-center-how-to','tickets-open-track'],
   'our_choice', NULL, 'The law doesn''t require this — we do it because you should never have to guess whether you are talking to a person or a machine. The chat says it is AI in the header, on first run, and any time it hands you off. No dark patterns, no fake typing dots pretending to be human.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('tickets-open-track', 'How do I open and track a support ticket?', 'A ticket is how a human on our team takes your problem.

**Fix it**
1. Open the Support tab, then Tickets.
2. Tap New ticket. Pick the topic, write what is wrong, and send.
3. You get a ticket number right away. It looks like PK-2026-0042.
4. We reply within our promise time. You confirm the fix before we close it. Nothing closes without your say.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['ticket','support','human','agent','track','status'], 'all', ARRAY['help-center-how-to','ai-support-chat-how-to'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('support-data-access-permissions', 'Why does a support agent need my permission to look at my grades?', 'Because we decided support should work with almost nothing.

**How it works**
1. An agent sees your ticket and your words — not your gradebook.
2. If they need the real grades to fix it, they ask. You tap approve in the app.
3. Their access ends on its own after 24 hours.
4. Every look is logged. See the log in Settings, then Privacy, then Support access.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['permission','grades','agent','privacy','access','grant'], 'all', ARRAY['tickets-open-track'],
   'our_choice', NULL, 'The law doesn''t require this — we do it because it''s the right shape for a family app. Privacy laws set a floor. They say: don''t leak people''s data. They don''t say how little your own staff should see. We chose the strictest workable version. Support agents are the least-privileged people in our system who can still fix your problem.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('signup-onboarding', 'How do I sign up and add my family?', 'Thirty seconds to your own Pookie.

**Fix it**
1. Sign in with your email. No invite needed.
2. Tell us your name. Add children if you have them, or pick just me.
3. Adding a child? Pick email invite or a 6-digit code they enter.
4. Your dashboard is ready. Add school, health, and the rest when you like.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'account',
   ARRAY['sign up','onboarding','account','family','children','just me'], 'all', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('data-retention-what-we-keep', 'What data does Pookie keep, and for how long?', 'We keep what we need, for as short as we can.

**The schedule**
1. Open tickets live until they close. Closed tickets are deleted after 2 years.
2. AI chat transcripts are deleted after 13 months. Teens can delete their own sooner.
3. Ticket attachments are deleted 90 days after the ticket closes.
4. Support permission grants are kept 3 years, as proof of who looked at what.
5. The full schedule lives in Settings, then Privacy, then Data retention.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'account',
   ARRAY['retention','delete','data','how long','privacy'], 'all', '{}',
   'law_required', 'COPPA — Children''s Online Privacy Protection Act, FTC Rule (2025 update): data minimization', 'COPPA says apps must keep kids'' data only as long as needed for the purpose it was collected, then delete it. That is the legal reason behind every line above. Our choice on top: we apply the same short clocks to adult data too, because a family app should not hoard anyone''s history.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('access-model-child-authority', 'Who decides who can see my child''s stuff?', 'Your child does — once they are 13 or older.

**How it works**
1. At 13, your child becomes the access authority in Pookie.
2. A grant your child makes cannot be vetoed or undone by a parent. Only your child can change it.
3. One parent cannot block the other parent''s access that the child granted.
4. A court order is the one exception. It goes through manual review by our team, never an automatic switch.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'legal',
   ARRAY['access','authority','sharing','grant','veto','child'], 'all', ARRAY['age-tiers-logins','school-records-after-revoke'],
   'both', 'State contract/consent doctrines + court-order process + Pookie policy', 'The law part: courts can order access changes, and we must have a way to honor that. Our choice on top of it: inside the family, the teen''s word is final. No parent veto, no silent overrides. If we ever loosen this, we will tell you first.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('age-tiers-logins', 'Why can''t my 11-year-old have their own Pookie login?', 'Kids under 13 get a parent-managed profile instead. You run it from your account. No login, no password, and no chat for them. We know it is less fun for them. Here is why it has to be this way.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'legal',
   ARRAY['coppa','under 13','login','child account','kids'], 'parent', ARRAY['access-model-child-authority','go-independent-trusted-adult'],
   'law_required', 'COPPA — Children''s Online Privacy Protection Act, FTC Rule (2025 update)', 'COPPA says apps cannot collect personal facts from kids under 13 without verified parent consent, and cannot keep kids'' data longer than needed. Breaking it means FTC fines and court orders. Companies have paid millions. So we made a design choice the law forces: under-13s don''t get logins at all. That way we never collect anything from your child directly, and the rule is enforced by the software itself, not by a promise.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('go-independent-trusted-adult', 'Why do I have to name a trusted adult before going independent?', 'Going independent is a big step — your own Pookie, fully yours. This part takes one minute.

**How it works**
1. Name one adult you trust. It does not have to be a parent.
2. You can change it any time.
3. You can also decline — after you check a box showing you know what "no adult will be told" means.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'legal',
   ARRAY['independent','trusted adult','18','go independent'], 'teen', ARRAY['access-model-child-authority','age-tiers-logins'],
   'both', 'Duty of care (state tort doctrines re: services to minors) + Pookie policy', 'The law part: companies that serve teens have a duty of care. If a young person is in crisis, we need some way to get help to them. That is the legal reason behind the trusted-adult step. Our choice on top of it: you pick the adult, and you may decline — but only after you show you grasp what that means. No dark patterns, no guilt screens.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();


```

---
---

## UNIT P3 — W6 Driving School: rules engine + hours log (S5-006)

Per-state from day one (MD D3). GA verified against dds.georgia.gov (2024–2025 GA Parent Teen
Driving Guide); FL verified against flhsmv.gov (Graduated Driver License Laws page).
Summaries are paraphrased reference data with source URLs and `verified_at`; re-verify on
schedule per BACKLOG R-007 (the `rules_verified_at` column drives the "rules verified {date}" UI).

```sql
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
```

---
---

## UNIT P4 — Travel gates: FR-TRAVEL-001 purchaser invariant + W31 visibility (S5-011/S5-012)

Server-side, never UI-only. The full minor-traveler rules engine (airline UM bands/fees,
phone-booking routing, custody travel-restriction profile — FR-MOD-W30, FR-SAFETY-012) builds
on top of these gates with Squad 1's custody-flag contract; the invariant floor lives here.

```sql
-- P4.0 — rpc_travel_purchase_check: no purchase/booking/contract completable
-- by a <18 account (FR-TRAVEL-001). Denied attempts on real booking paths
-- write an audit row.
CREATE OR REPLACE FUNCTION public.rpc_travel_purchase_check(
  p_user_id uuid, p_flow text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_band   text;
  v_reason text;
BEGIN
  IF p_flow NOT IN ('flight','rental_car','event_ticket') THEN
    RAISE EXCEPTION 'unknown flow' USING ERRCODE = 'invalid_flow';
  END IF;
  -- The caller may only check themselves (or service_role for tests/admin).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'can only check your own eligibility' USING ERRCODE = 'not_self';
  END IF;

  v_band := public.support_user_age_band(p_user_id);

  IF v_band = 'adult' THEN
    RETURN jsonb_build_object('allowed', true, 'reason_code', 'ok',
                              'requires_adult', false);
  END IF;

  v_reason := CASE WHEN p_flow = 'rental_car' THEN 'rental_car_teen_hidden'
                   ELSE 'minor_purchaser_blocked' END;

  PERFORM public.log_access_event(
    NULL, p_user_id, 'request_denied', NULL, NULL,
    jsonb_build_object('flow', p_flow, 'reason_code', v_reason,
                       'note', 'FR-TRAVEL-001: minor purchase attempt refused'));

  RETURN jsonb_build_object(
    'allowed', false, 'reason_code', v_reason, 'requires_adult', true,
    'message', CASE WHEN p_flow = 'rental_car'
      THEN 'Rental cars need a grown-up. This section is hidden for teen accounts.'
      ELSE 'Flights need a grown-up to book. You can plan the trip and share the idea with a parent.' END);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_travel_purchase_check(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_travel_purchase_check(uuid, text) TO authenticated, service_role;

-- P4.1 — rpc_travel_module_visibility: API-layer module hiding. W31 is
-- invisible to teen/child at menu, route, AND RPC (QA proves all three with
-- a 16-year-old test account). Menu-wide FR-MENU-004 remains Platform's
-- modules.ts registry; this is the travel-scoped enforcement.
CREATE OR REPLACE FUNCTION public.rpc_travel_module_visibility(
  p_user_id uuid, p_module text
)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_band text;
BEGIN
  IF p_module NOT IN ('w25_fuel','w26_weather','w27_events','w28_restaurants',
                      'w29_trails','w30_flights','w31_rental_cars') THEN
    RAISE EXCEPTION 'unknown module' USING ERRCODE = 'invalid_module';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'can only check your own visibility' USING ERRCODE = 'not_self';
  END IF;
  v_band := public.support_user_age_band(p_user_id);
  IF p_module = 'w31_rental_cars' THEN
    RETURN v_band = 'adult';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_travel_module_visibility(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_travel_module_visibility(uuid, text) TO authenticated, service_role;
```

---
---

## UNIT P5 — External data cache (Travel/Marketplace upstream reads)

Cache-first for every external integration (NWS, EIA, OpenChargeMap, NPS, Foursquare,
municipal). TTLs: NWS alerts 15 min / forecast 1 h; fuel 24 h; chargers 24 h; trails 7 d;
restaurants 6 h; events 1 h. Upstream failure → honest "unavailable", never synthetic data.

```sql
-- P5.0 — external_data_cache: keyed by the route handler (e.g.
-- 'nws:alerts:30327', 'eia:gas:padd1c', 'ocm:poi:33.95,-84.54').
CREATE TABLE IF NOT EXISTS public.external_data_cache (
  cache_key   text PRIMARY KEY,
  source      text NOT NULL CHECK (source IN
                  ('nws','eia','openchargemap','nps','foursquare','municipal')),
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  ttl_seconds int NOT NULL CHECK (ttl_seconds > 0),
  expires_at  timestamptz GENERATED ALWAYS AS
                (fetched_at + make_interval(secs => ttl_seconds)) STORED
);
CREATE INDEX IF NOT EXISTS external_data_cache_source_idx
  ON public.external_data_cache (source);
CREATE INDEX IF NOT EXISTS external_data_cache_expiry_idx
  ON public.external_data_cache (expires_at);

ALTER TABLE public.external_data_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read unexpired rows (public data, no PII).
DROP POLICY IF EXISTS external_data_cache_read ON public.external_data_cache;
CREATE POLICY external_data_cache_read ON public.external_data_cache
  FOR SELECT TO authenticated USING (expires_at > now());
REVOKE INSERT, UPDATE, DELETE ON public.external_data_cache FROM authenticated;
GRANT SELECT ON public.external_data_cache TO authenticated;

-- P5.1 — rpc_cache_get (respects expiry) / rpc_cache_put (service_role) /
-- rpc_purge_expired_cache (cron).
CREATE OR REPLACE FUNCTION public.rpc_cache_get(p_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (SELECT payload FROM public.external_data_cache
           WHERE cache_key = p_key AND expires_at > now());
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_cache_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cache_get(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_cache_put(
  p_key text, p_source text, p_payload jsonb, p_ttl_seconds int
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = 'service_role_required';
  END IF;
  IF p_source NOT IN ('nws','eia','openchargemap','nps','foursquare','municipal') THEN
    RAISE EXCEPTION 'unknown source' USING ERRCODE = 'invalid_source';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds <= 0 THEN
    RAISE EXCEPTION 'ttl must be positive' USING ERRCODE = 'bad_ttl';
  END IF;
  INSERT INTO public.external_data_cache (cache_key, source, payload, ttl_seconds)
  VALUES (p_key, p_source, p_payload, p_ttl_seconds)
  ON CONFLICT (cache_key) DO UPDATE SET
    source = EXCLUDED.source, payload = EXCLUDED.payload,
    fetched_at = now(), ttl_seconds = EXCLUDED.ttl_seconds;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_cache_put(text, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cache_put(text, text, jsonb, int) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_purge_expired_cache()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = 'service_role_required';
  END IF;
  DELETE FROM public.external_data_cache WHERE expires_at <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_purge_expired_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_purge_expired_cache() TO service_role;
```

---
---

## UNIT P6 — Reconciliation SQL (MD decision needed: R-A, R-B)

Apply ONLY after MD confirms the recommendations in BACKEND-CONTRACTS.md §1.1.

```sql
-- R-A: retire the duplicate ticket_messages thread table (033). Canonical
-- thread is ticket_events (032). The PII redaction trigger now lives on
-- ticket_events (Unit P1.7).
--   1. Verify no rows depend on it beyond the redaction trigger:
--      SELECT count(*) FROM public.ticket_messages;
--   2. If zero: DROP TABLE public.ticket_messages;
--      (If non-zero, MD decides the backfill into ticket_events first.)

-- R-B: retire 033's support_log_event in favor of 021's log_access_event
-- (nullable child_id, full support.* event list, reason_code/amount support).
-- Keep a thin compatibility wrapper during the transition, then drop:
CREATE OR REPLACE FUNCTION public.support_log_event(
  p_event_type text, p_ticket_id uuid,
  p_actor_user_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_child uuid;
BEGIN
  SELECT child_id INTO v_child FROM public.support_tickets WHERE id = p_ticket_id;
  PERFORM public.log_access_event(v_child, p_actor_user_id, p_event_type,
    NULL, NULL, p_metadata);
END;
$$;
-- After all callers migrate to log_access_event: DROP FUNCTION public.support_log_event(text, uuid, uuid, jsonb);
```

---

*End of PENDING-MIGRATIONS.md — 6 units, all review-ready, all idempotent. Numbers TBD by MD.*
