-- Migration 065: Bill Tracker (Squad Value — 24h value directive)
--
-- Track bills with amounts and due dates. The foundation for due-date reminders.
-- Household-anchored (owner_user_id); RLS via is_household_member().
-- Mehedi had this in d-dash Command Center; Pookie lost it. Restoring.

CREATE TABLE IF NOT EXISTS public.bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  payee         text,  -- who gets paid: "Electric Co.", "Wells Fargo Mortgage"
  amount        numeric(12,2),
  due_date      date,
  recurrence    text CHECK (recurrence IN ('once','monthly','quarterly','yearly')),
  category      text,  -- 'housing', 'utilities', 'insurance', 'subscription', 'debt', 'other'
  status        text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue','autopay')),
  notes         text,
  last_paid_at  timestamptz,
  data_class    text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bills_owner_idx ON public.bills (owner_user_id);
CREATE INDEX IF NOT EXISTS bills_due_idx ON public.bills (owner_user_id, due_date) WHERE status IN ('unpaid','overdue');

DROP TRIGGER IF EXISTS bills_touch ON public.bills;
CREATE TRIGGER bills_touch
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.family_tasks_touch_updated();

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bills_select ON public.bills;
CREATE POLICY bills_select ON public.bills
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS bills_insert ON public.bills;
CREATE POLICY bills_insert ON public.bills
  FOR INSERT WITH CHECK (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS bills_update ON public.bills;
CREATE POLICY bills_update ON public.bills
  FOR UPDATE USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS bills_delete ON public.bills;
CREATE POLICY bills_delete ON public.bills
  FOR DELETE USING (public.is_household_member(owner_user_id));
