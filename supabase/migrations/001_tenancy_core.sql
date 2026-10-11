-- Migration 001: Multi-tenant core (users, children, child_access, invites)
-- Greenfield project: pookie
-- Source: PLAN.md §3.1, §4.1
-- Principle: login email is the tenant resolver. child_access is the single source of truth.

-- ---------------------------------------------------------------------------
-- users: app-level profile, 1:1 with auth.users, created by trigger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text UNIQUE NOT NULL,
  role        text NOT NULL CHECK (role IN ('parent','child')),
  display_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- children: the tenants
-- parent_user_id is the owner/billing anchor ONLY — never the access mechanism.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.children (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid REFERENCES public.users(id),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  nickname      text,
  slug          text UNIQUE NOT NULL,          -- e.g. 'dawson-kamal'
  date_of_birth date,
  school_name   text,
  district      text,
  grade_level   text,
  student_id    text,
  grade_scale   jsonb NOT NULL DEFAULT '{"A":[90,100],"B":[80,89],"C":[74,79],"D":[70,73],"F":[0,69]}'::jsonb,
  timezone      text NOT NULL DEFAULT 'America/New_York',
  avatar_url    text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One default child per parent (billing anchor scope)
CREATE UNIQUE INDEX IF NOT EXISTS children_one_default_per_parent
  ON public.children (parent_user_id) WHERE is_default AND parent_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- child_access: THE membership table — single source of truth for tenancy
-- (child_id, user_id) PK. Partial unique index: a child-role user holds
-- exactly one row globally; parents hold N.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_access (
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('parent','child')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, user_id)
);

-- A child-role user may belong to exactly one child, globally.
CREATE UNIQUE INDEX IF NOT EXISTS child_access_one_child_per_child_user
  ON public.child_access (user_id) WHERE role = 'child';

CREATE INDEX IF NOT EXISTS child_access_user_id_idx
  ON public.child_access (user_id);

-- ---------------------------------------------------------------------------
-- invites: the allowlist. Seeds from today's family-email allowlist.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('parent','child')),
  child_id   uuid REFERENCES public.children(id) ON DELETE CASCADE, -- null = new family parent
  token      text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invites_email_status_idx
  ON public.invites (email, status);

-- ---------------------------------------------------------------------------
-- Trigger: ensure public.users row on auth.users insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'parent', -- default; corrected by invite consumption or admin
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- RLS helper: current_child_ids() — the caller's tenant set (STABLE, DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_child_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(ca.child_id), '{}')
  FROM public.child_access ca
  WHERE ca.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Invite consumption: called after OTP login when child_access has 0 rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
  v_child  uuid;
BEGIN
  SELECT * INTO v_invite FROM public.invites
   WHERE token = p_token AND status = 'pending' AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found_or_expired';
  END IF;

  IF v_invite.email <> (SELECT email FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- New family parent (child_id null): create their first child shell; profile completed in UI
  IF v_invite.child_id IS NULL THEN
    INSERT INTO public.children (parent_user_id, first_name, last_name, slug)
    VALUES (auth.uid(), 'New', 'Child', 'child-' || substr(md5(random()::text),1,8))
    RETURNING id INTO v_child;
  ELSE
    v_child := v_invite.child_id;
  END IF;

  INSERT INTO public.child_access (child_id, user_id, role)
  VALUES (v_child, auth.uid(), v_invite.role)
  ON CONFLICT DO NOTHING;

  -- Correct the users.role if the invite says child
  IF v_invite.role = 'child' THEN
    UPDATE public.users SET role = 'child' WHERE id = auth.uid();
  END IF;

  UPDATE public.invites SET status = 'accepted' WHERE id = v_invite.id;

  RETURN v_child;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites      ENABLE ROW LEVEL SECURITY;

-- users: you can read your own row; parents can read rows of users sharing a child
CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.child_access ca1
               JOIN public.child_access ca2 ON ca1.child_id = ca2.child_id
               WHERE ca1.user_id = auth.uid() AND ca2.user_id = public.users.id
                 AND ca1.role = 'parent'));

-- children: readable iff in your tenant set; writable only by parent-role holders in set
CREATE POLICY children_tenant_read ON public.children
  FOR SELECT USING (id = ANY (public.current_child_ids()));

CREATE POLICY children_parent_write ON public.children
  FOR ALL USING (
    id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = public.children.id AND ca.role = 'parent')
  );

-- child_access: readable by members; inserts via parents or consume_invite (definer)
CREATE POLICY child_access_member_read ON public.child_access
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

CREATE POLICY child_access_parent_insert ON public.child_access
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid() AND ca.child_id = child_access.child_id AND ca.role = 'parent')
  );

CREATE POLICY child_access_parent_delete ON public.child_access
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid() AND ca.child_id = child_access.child_id AND ca.role = 'parent')
  );

-- invites: inviting parent (same tenant) + invitee (by email) only
CREATE POLICY invites_parent_read ON public.invites
  FOR SELECT USING (
    child_id = ANY (public.current_child_ids())
    OR email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY invites_parent_write ON public.invites
  FOR ALL USING (
    child_id IS NULL OR child_id = ANY (public.current_child_ids())
  );
