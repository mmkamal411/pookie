-- Migration 051: Canonical log_access_event signature (fixes SEC-C2).
--
-- Problem: three overloads exist with different param orders. Callers in 018/019/020
-- use 8 positional args (child_id, actor, subject, event_type, granted_by, reason, device_hash, ip_hash).
-- 021 defined a 7-param version with different order. This consolidates to ONE canonical
-- 8-param signature; the 7-param overload is dropped.
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS with signature.

-- Drop the 7-param version from 021 (different param order — causes wrong-arg bugs)
DROP FUNCTION IF EXISTS public.log_access_event(uuid, uuid, text, uuid, text, jsonb, integer);

-- Drop the 8-param with trusted_adult variant (fold its param into metadata)
DROP FUNCTION IF EXISTS public.log_access_event(uuid, uuid, uuid, text, text, text, uuid, jsonb);

-- Canonical 8-param version (matches all callers in 018/019/020)
CREATE OR REPLACE FUNCTION public.log_access_event(
  p_child_id uuid,
  p_actor_user_id uuid,
  p_subject_user_id uuid,
  p_event_type text,
  p_granted_by text,
  p_reason_code text DEFAULT NULL,
  p_device_hash text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.access_events
    (child_id, actor_user_id, subject_user_id, event_type, granted_by, reason_code,
     metadata)
  VALUES
    (p_child_id, p_actor_user_id, p_subject_user_id, p_event_type, p_granted_by, p_reason_code,
     jsonb_build_object('device_hash', p_device_hash, 'ip_hash', p_ip_hash))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.log_access_event(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_access_event(uuid, uuid, uuid, text, text, text, text, text)
  TO authenticated, service_role;
