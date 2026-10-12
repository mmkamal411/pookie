-- Migration 017: profiles table (user-first identity)
--
-- CONTEXT: Pookie is the USER's personal assistant (locked 2026-10-12).
-- Every auth user gets a profiles row at signup; onboarding gates on
-- onboarding_completed. This table is the login identity's app profile,
-- distinct from public.users (tenant membership directory, 001).
--
-- CHANGES:
--   1. profiles: user_id PK -> auth.users (ON DELETE CASCADE), display_name,
--      onboarding_completed, date_of_birth + dob_verified (DOB gate for teen
--      self-signup: linking RPCs require a verified 13+ DOB), legal_status
--      ('adult'|'minor'|'emancipated'; ordinary adult signups are 'adult',
--      a teen's own row is set to 'minor' at link time).
--   2. updated_at maintained by trigger.
--   3. handle_new_profile() trigger on auth.users: every new login identity
--      gets a profiles row automatically (ON CONFLICT DO NOTHING).
--   4. RLS: owner-only SELECT/INSERT/UPDATE. No DELETE policy (deny by
--      default); profile deletion goes through account-erasure flows.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS / CREATE OR REPLACE.
-- GRANT MODEL: table-level SELECT/INSERT/UPDATE for authenticated (owner
-- rows only, via RLS). Security Engineer hardens further.

-- ---------------------------------------------------------------------------
-- Part 1 — profiles table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  date_of_birth        date,
  dob_verified         boolean NOT NULL DEFAULT false,
  legal_status         text NOT NULL DEFAULT 'adult',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- legal_status check constraint (named, idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_legal_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_legal_status_check
      CHECK (legal_status IN ('adult', 'minor', 'emancipated'));
  END IF;
END
$$;

COMMENT ON TABLE public.profiles IS
  'App profile for every login identity. onboarding_completed gates the /onboarding redirect. date_of_birth + dob_verified are the DOB gate for teen self-signup: linking RPCs (019/020) require verified age 13+. legal_status: adult (default), minor (teen-owned row), emancipated (document-verified).';
COMMENT ON COLUMN public.profiles.dob_verified IS
  'True once the DOB was verified at signup or link time. Unverified DOB is untrusted input.';

-- ---------------------------------------------------------------------------
-- Part 2 — updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Part 3 — auto-provision on auth.users insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_profile ON auth.users;
CREATE TRIGGER trg_handle_new_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ---------------------------------------------------------------------------
-- Part 4 — RLS: owner-only
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
CREATE POLICY profiles_owner_read ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_owner_insert ON public.profiles;
CREATE POLICY profiles_owner_insert ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update ON public.profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- No DELETE policy: profile deletion is an account-erasure flow, not self-serve.

REVOKE ALL ON public.profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Table + check: SELECT conname FROM pg_constraint
--      WHERE conrelid='public.profiles'::regclass AND conname='profiles_legal_status_check';
--    -- expect 1 row
-- 2. RLS owner-only: as user A, SELECT * FROM profiles WHERE user_id != '<A>';
--    -- expect 0 rows
-- 3. Auto-provision: INSERT INTO auth.users ... (via supabase auth admin)
--    then SELECT * FROM profiles WHERE user_id = '<new id>'; -- expect 1 row
-- 4. Grants: SELECT grantee, privilege_type FROM information_schema.role_table_grants
--      WHERE table_schema='public' AND table_name='profiles';
--    -- expect authenticated: SELECT, INSERT, UPDATE only
