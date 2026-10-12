-- Staged compliance fix — CRITICAL-1 (Fractional Team 1): get_invite_preview
-- leaked child PII pre-auth.
--
-- Supersedes: supabase/migrations/016_invite_preview.sql
-- (MD FREEZE is in effect on supabase/migrations/ — this is staged here,
-- committed on staging-build, to be folded into a migration at apply time.)
-- Depends on: 001 (invites, users), 014 (safe_auth_uid), 015
-- (invites.invited_by_user_id).
--
-- Behavior change: the pre-auth preview now returns ONLY
--   valid boolean, expired boolean, used boolean,
--   inviter_name text, inviter_email text.
-- It NEVER returns child_id, the invitee email, child_first_name, or
-- child_nickname — the pre-auth page (/verify-invite) no longer has a
-- server-side way to render the child's identity. The frontend (in parallel)
-- strips the rendering; this RPC is the server-side enforcement
-- (FR-AUTH-009, NFR-PRIVACY-005).
--
-- Post-auth enrichment (child's name for the email-verified invitee) is
-- deliberately NOT in this function. If it is ever needed, add a separate
-- authenticated-only RPC that returns child fields only when
-- public.safe_auth_uid()'s email matches invites.email.

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
