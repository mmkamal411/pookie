-- Migration 016: public invite preview RPC.
--
-- REQUIRES migration 015 (invites.invited_by_user_id + graduate_child_access)
-- to be applied first.
--
-- Why: /verify-invite?token=xxx is a PUBLIC page (no login required to view).
-- invites SELECT policies only cover parent-role members and the invitee
-- themselves, so an anonymous visitor cannot read an invite row under RLS.
-- The token is an unguessable capability (24 random bytes, hex), so anyone
-- holding it may see a LIMITED preview — no grades, no access rows, no
-- tenant enumeration. Field selection is deliberate: just enough for the
-- child to recognise "who invited me".
--
-- Email-ownership verification stays server-side in consume_invite() (the
-- RPC raises invite_email_mismatch); this preview discloses nothing that
-- lets a viewer bypass it.

CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
RETURNS TABLE (
  child_id         uuid,
  invite_email     text,
  child_first_name text,
  child_nickname   text,
  inviter_name     text,
  inviter_email    text,
  expires_at       timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.child_id,
         i.email,
         c.first_name,
         c.nickname,
         u.display_name,
         u.email,
         i.expires_at
    FROM public.invites i
    LEFT JOIN public.children c ON c.id = i.child_id
    LEFT JOIN public.users     u ON u.id = i.invited_by_user_id
   WHERE i.token = p_token
     AND i.status = 'pending'
     AND i.expires_at > now()
   LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated, service_role;
