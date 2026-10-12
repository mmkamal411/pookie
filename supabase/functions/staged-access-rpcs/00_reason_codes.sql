-- Staged seed: access_reason_codes additions required by the Platform Team 1
-- access RPCs (01–05 in this directory).
--
-- Fold into the renumbered migration that owns access_reason_codes (canonical
-- 021), AFTER its seed block. Idempotent: ON CONFLICT DO NOTHING.
-- Depends on: canonical 021 (access_reason_codes table).

INSERT INTO public.access_reason_codes (code, description) VALUES
  ('pending_coapproval',
   'D6: parent granted a new grantee; awaiting teen co-approval'),
  ('coapproval_granted',
   'D6: teen approved a pending co-approval grant'),
  ('coapproval_declined',
   'D6: teen declined a pending co-approval grant'),
  ('request_expired',
   'Access request lapsed after its 30-day TTL without a decision'),
  ('emergency_teen_path',
   'Emergency grant activated via the teen-configured safety path'),
  ('emergency_le_path',
   'Emergency grant activated via the law-enforcement exigent path'),
  ('emergency_court_order',
   'Emergency grant activated via court order (manual queue)'),
  ('emergency_expired',
   'Emergency grant reached its expiry (12h teen path / 72h LE path)'),
  ('emergency_revoked',
   'Emergency grant revoked early by the teen or an operator')
ON CONFLICT (code) DO NOTHING;
