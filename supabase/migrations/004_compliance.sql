-- Migration 004: Compliance — consents ledger + audit log
-- Source: PLAN.md §3.1, AI-MOTHER-VISION.md §5 (compliance)
-- consents: append-only ledger; revocation is a new row, never an edit.
-- audit_log: append-only; FERPA-aligned disclosure accounting (covers the agent too).

-- ---------------------------------------------------------------------------
-- consents: every authorization the parent grants, as an immutable ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  granted_by  uuid NOT NULL REFERENCES public.users(id),
  scope       text NOT NULL,   -- e.g. 'portal_sync:studentvue', 'health:wearable', 'data:export'
  recipient   text,            -- named recipient for disclosures (FERPA accounting)
  status      text NOT NULL CHECK (status IN ('granted','revoked')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consents_child_scope_idx
  ON public.consents (child_id, scope, created_at DESC);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- Append-only: members read; parents insert; NO updates/deletes (revoke = new row)
CREATE POLICY consents_tenant_read ON public.consents
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

CREATE POLICY consents_parent_insert ON public.consents
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = consents.child_id AND ca.role = 'parent')
  );

-- ---------------------------------------------------------------------------
-- audit_log: every read/write of consequence, including agent reads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid REFERENCES public.children(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id),
  actor_kind    text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','agent','worker','system')),
  action        text NOT NULL,     -- e.g. 'transcript.sent', 'grades.read', 'portal.verified'
  table_name    text,
  row_id        text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_child_at_idx
  ON public.audit_log (child_id, at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: members read their tenant's log; writes via SECURITY DEFINER fns / service_role
CREATE POLICY audit_log_tenant_read ON public.audit_log
  FOR SELECT USING (child_id IS NULL OR child_id = ANY (public.current_child_ids()));

-- Helper: log an audit event (definer so workers/agents can write)
CREATE OR REPLACE FUNCTION public.audit_event(
  p_child_id uuid, p_action text, p_actor_kind text DEFAULT 'user',
  p_table_name text DEFAULT NULL, p_row_id text DEFAULT NULL, p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.audit_log (child_id, actor_user_id, actor_kind, action, table_name, row_id, detail)
  VALUES (p_child_id, auth.uid(), p_actor_kind, p_action, p_table_name, p_row_id, p_detail)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
