-- Migration 072: Insurance Policy Tracker (Phase1-Insurance — Squad Phase1 24h effort)
--
-- Household insurance policies: dates, premiums, renewals, coverage summaries.
-- NOT a document store (that's the vault); the policy_number column stores a
-- masked display value only ("••••1234") — full numbers are masked server-side
-- before insert and are never persisted.
--
-- Household pattern (from 007/064): tables anchor to owner_user_id (the parent
-- user). Membership derived from child_access via is_household_member().

-- ---------------------------------------------------------------------------
-- insurance_policies table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('auto','home','health','life','renter')),
  provider        text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 200),
  policy_number   text,  -- masked display only (e.g. "••••1234"); never full
  premium_amount  numeric(12,2),
  premium_frequency text NOT NULL DEFAULT 'annual'
                  CHECK (premium_frequency IN ('monthly','quarterly','semiannual','annual')),
  renewal_date    date,
  coverage_summary text CHECK (char_length(coverage_summary) <= 2000),
  agent_name      text CHECK (char_length(agent_name) <= 200),
  agent_phone     text CHECK (char_length(agent_phone) <= 40),
  notes           text CHECK (char_length(notes) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_policies_owner_idx
  ON public.insurance_policies (owner_user_id);
CREATE INDEX IF NOT EXISTS insurance_policies_renewal_idx
  ON public.insurance_policies (owner_user_id, renewal_date)
  WHERE renewal_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS insurance_policies_type_idx
  ON public.insurance_policies (owner_user_id, type);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insurance_policies_touch_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS insurance_policies_touch ON public.insurance_policies;
CREATE TRIGGER insurance_policies_touch
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.insurance_policies_touch_updated();

-- ---------------------------------------------------------------------------
-- RLS: household members can CRUD policies in their household
-- ---------------------------------------------------------------------------
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_policies_select ON public.insurance_policies;
CREATE POLICY insurance_policies_select ON public.insurance_policies
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS insurance_policies_insert ON public.insurance_policies;
CREATE POLICY insurance_policies_insert ON public.insurance_policies
  FOR INSERT WITH CHECK (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS insurance_policies_update ON public.insurance_policies;
CREATE POLICY insurance_policies_update ON public.insurance_policies
  FOR UPDATE USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS insurance_policies_delete ON public.insurance_policies;
CREATE POLICY insurance_policies_delete ON public.insurance_policies
  FOR DELETE USING (public.is_household_member(owner_user_id));
