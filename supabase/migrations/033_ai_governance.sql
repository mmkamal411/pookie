-- Migration 033: AI governance — safety event contract + 18+ Direct Mode gate
--
-- FR-AI-001 (crisis protocol event contract), FR-AI-002 (Muse "direct mode"
-- BLOCKED for under-18; server-side 18+ gate).
--
-- SAFETY EVENT CONTRACT (sol-school-ai §12.3): the chat layer EMITS events; it
-- does not decide responses. The safety router (Safety squad) consumes them.
--   type ∈ crisis_language | abuse_disclosure | mandatory_reporter_tripwire |
--           self_harm_plan | eating_disorder_signal
--   severity ∈ watch | urgent | imminent
-- 988 + Crisis Text Line surface IN the conversation on crisis_language /
-- self_harm_plan, every time, regardless of mode (chat-layer duty; this table
-- is the durable record). No auto-parent-notification absent imminent risk —
-- that routing belongs to the safety router, not the emitter.
--
-- 18+ GATE (FR-AI-002): "Unfiltered" is dead as a word and a promise. Direct
-- Mode = same safety, blunter tone. The gate input is a VERIFIED date of
-- birth (user_verifications). Under-18: the mode does not exist in the UI
-- and the API returns 403 regardless of client state. Age is computed
-- server-side at request time.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- safety_events: emitter contract (chat layer writes; safety router reads)
-- ---------------------------------------------------------------------------
-- NOTE: owned by Squad 3 (School) as the emitter contract per sol-school-ai
-- §12.3; the Safety squad owns the router/consumers. CREATE TABLE IF NOT
-- EXISTS keeps this safe if the router migration lands first.
CREATE TABLE IF NOT EXISTS public.safety_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid REFERENCES public.children(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES public.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  type        text NOT NULL
              CHECK (type IN ('crisis_language','abuse_disclosure',
                              'mandatory_reporter_tripwire','self_harm_plan',
                              'eating_disorder_signal')),
  severity    text NOT NULL CHECK (severity IN ('watch','urgent','imminent')),
  context_ref text,                            -- pointer to the scoped excerpt
  handled     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_events_child_occurred_idx
  ON public.safety_events (child_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS safety_events_unhandled_idx
  ON public.safety_events (handled, occurred_at) WHERE NOT handled;

ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

-- No client SELECT: events are router-consumed via service_role. The teen can
-- see that an event was emitted about them via the audit surface (separate).
-- Emitters write through emit_safety_event() only.

-- ---------------------------------------------------------------------------
-- emit_safety_event(): the ONLY write path (chat layer calls this).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_safety_event(
  p_child_id uuid,
  p_type text,
  p_severity text,
  p_context_ref text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_id uuid;
BEGIN
  IF p_type NOT IN ('crisis_language','abuse_disclosure',
                    'mandatory_reporter_tripwire','self_harm_plan',
                    'eating_disorder_signal') THEN
    RAISE EXCEPTION 'safety_event_bad_type';
  END IF;
  IF p_severity NOT IN ('watch','urgent','imminent') THEN
    RAISE EXCEPTION 'safety_event_bad_severity';
  END IF;
  IF p_child_id IS NOT NULL AND NOT (p_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'tenant_scope_violation';
  END IF;

  INSERT INTO public.safety_events (child_id, user_id, type, severity, context_ref)
  VALUES (p_child_id, v_uid, p_type, p_severity, p_context_ref)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_safety_event(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_safety_event(uuid, text, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- user_verifications: verified DOB for the 18+ gate.
-- Written by the identity-verification flow (service_role); never by clients.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_verifications (
  user_id       uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  date_of_birth date NOT NULL,
  verified_at   timestamptz NOT NULL DEFAULT now(),
  verified_by   text NOT NULL,                   -- 'id-verification' | 'staff' | ...
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
-- No client policies: service_role only. The gate reads via SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- direct_mode_eligible(p_user_id): server-side 18+ gate for Direct Mode.
-- TRUE only with a verified DOB proving age >= 18. NULL/unverified → FALSE.
-- Emancipated minors route to the adult track via verified_by='court-order'
-- (recorded by the verification flow; the gate trusts the verified record).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.direct_mode_eligible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_verifications uv
     WHERE uv.user_id = p_user_id
       AND uv.date_of_birth <= CURRENT_DATE - interval '18 years'
  )
$$;

REVOKE ALL ON FUNCTION public.direct_mode_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.direct_mode_eligible(uuid) TO authenticated, service_role;
