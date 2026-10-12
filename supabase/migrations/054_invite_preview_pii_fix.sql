-- Migration 054: get_invite_preview() PII fix (CRITICAL-1, Fractional Compliance)
--
-- CONTEXT: 016's get_invite_preview() returned child_id, invite_email,
-- child_first_name and child_nickname to UNAUTHENTICATED callers — child PII
-- leaked pre-auth (FR-AUTH-009, NFR-PRIVACY-005). This folds in the staged
-- fix from supabase/functions/staged-compliance-fixes/01_get_invite_preview_fix.sql
-- (supersedes 016's version).
--
-- CHANGES:
--   1. get_invite_preview(p_token) now returns ONLY valid / expired / used /
--      inviter_name / inviter_email. It can never return the child's identity.
--      DROP + CREATE (not OR REPLACE): the RETURNS TABLE shape changes, and
--      PostgreSQL forbids changing a function's return type via OR REPLACE.
--   2. NEW get_invite_detail(p_token): authenticated-only post-auth enrichment
--      returning child_id / invite_email / child_first_name / child_nickname /
--      expires_at — but ONLY when the caller's auth email matches the invite's
--      email (the same email-ownership proof consume_invite() requires).
--      Any other caller gets zero rows (uniform shape, no oracle).
--
-- FRONTEND DEPENDENCY (blocking for live apply): src/app/verify-invite/page.tsx
-- currently reads preview.child_id / preview.invite_email /
-- preview.child_first_name / preview.child_nickname from get_invite_preview.
-- After this migration those fields are gone from the preview. The page MUST
-- switch to get_invite_detail() (authenticated branch) BEFORE this applies
-- live, or the invite-accept flow breaks. Pre-auth rendering already uses
-- only inviter_name — that path is unaffected.
--
-- REQUIRES: 001 (invites, users, children), 014 (safe_auth_uid),
-- 015 (invites.invited_by_user_id).
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS + CREATE OR REPLACE / REVOKE+GRANT.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. PII-free pre-auth preview (return shape changes -> DROP first)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_invite_preview(text);

CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
RETURNS TABLE (
  valid         boolean,
  expired       boolean,
  used          boolean,
  inviter_name  text,
  inviter_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
  v_name   text;
  v_email  text;
BEGIN
  -- Blank/NULL token: a uniform negative response carrying no data.
  -- Tokens are 24 random bytes (hex) minted in 001; there is no oracle
  -- cheaper than guessing one.
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN QUERY SELECT false, false, false, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Inviting adult only — NEVER the child's identity.
  SELECT u.display_name, u.email INTO v_name, v_email
    FROM public.users u
   WHERE u.id = v_invite.invited_by_user_id;

  RETURN QUERY
  SELECT true,
         v_invite.expires_at <= now(),
         v_invite.status IS DISTINCT FROM 'pending',
         v_name,
         v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Authenticated-only post-auth enrichment (email-ownership gated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invite_detail(p_token text)
RETURNS TABLE (
  child_id         uuid,
  invite_email     text,
  child_first_name text,
  child_nickname   text,
  expires_at       timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite       public.invites%ROWTYPE;
  v_caller       uuid := public.safe_auth_uid();
  v_caller_email text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN; -- not authenticated: zero rows, fail closed
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Email-ownership proof (same check consume_invite() enforces server-side).
  -- A caller whose auth email does not match the invite learns nothing.
  SELECT email INTO v_caller_email FROM public.users WHERE id = v_caller;
  IF lower(v_invite.email) IS DISTINCT FROM lower(v_caller_email) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_invite.child_id,
         v_invite.email,
         c.first_name,
         c.nickname,
         v_invite.expires_at
    FROM public.children c
   WHERE c.id = v_invite.child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite_detail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_detail(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_invite_preview(text) IS
  'Pre-auth invite preview: validity + inviting adult only. Never returns child identity (CRITICAL-1).';
COMMENT ON FUNCTION public.get_invite_detail(text) IS
  'Post-auth invite detail: child fields only when caller email matches the invite (email-ownership proof).';
