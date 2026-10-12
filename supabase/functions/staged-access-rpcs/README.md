# Staged access-model RPCs — Platform Team 1 Backend

**Status (2026-10-12):** STAGED for fold-in. Per the MD freeze on
`supabase/migrations/`, these are the final, corrected RPC definitions.
The Managing Director is renumbering migrations into a clean sequence;
fold each file's contents into the renumbered migration that owns its
tables (suggested mapping in each file header).

**Interface contract:** every function below writes to the canonical
`access_events` ledger via:

```sql
public.log_access_event(
  p_child_id uuid, p_actor_user_id uuid, p_event_type text,
  p_subject_user_id uuid DEFAULT NULL, p_reason_code text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}', p_amount_cents integer DEFAULT NULL)
```

`p_reason_code` is a foreign key to `access_reason_codes(code)` — every
reason used below is either seeded by the canonical 021 or by
`00_reason_codes.sql` in this directory (apply the seed before any RPC
executes).

**Event vocabulary used**

| Call site | event_type | reason_code |
|---|---|---|
| grant_access (effective) | `grant` | `teen_choice` / `regrant` |
| grant_access (D6 co-approval pending) | `grant` | `pending_coapproval` |
| revoke_access (instant / self / granter) | `revoke_effective` | `teen_choice` |
| revoke_access (13–15 cooling start) | `cooling_off_started` | `teen_choice` |
| revoke_access (pending cancelled) | `revoke_cancelled` | `teen_choice` |
| approve_grant | `grant` | `coapproval_granted` |
| decline_grant | `revoke_cancelled` | `coapproval_declined` |
| apply_cooling_off_revocations | `revoke_effective` | `cooling_off_expired` |
| go_independent (per parent row) | `cooling_off_started` / `revoke_effective` | `teen_choice` |
| go_independent (flow marker) | `go_independent` | `teen_choice` |
| redeem_link_code | `link_code_redeemed` | `teen_choice` / `coerced_link` |
| request_access | `request_created` | `teen_choice` |
| decide_access_request | `request_approved` / `request_denied` / `block_added` | `teen_choice` |
| expire_stale_access_requests | `request_denied` | `request_expired` (+ metadata `{"expired":true}`) |
| create_emergency_grant | `grant` | `emergency_teen_path` / `emergency_le_path` / `emergency_court_order` |
| revoke_emergency_grant | `revoke_effective` | `emergency_revoked` |
| expire_emergency_grants | `revoke_effective` | `emergency_expired` |
| apply_expired_grants (timeboxed) | `revoke_effective` | `expiry` |

**MD decisions applied:** D6 (tiered caps 8/30d trusted, 2/30d new;
teen co-approval for new grantees 13–15), D5 (no auto-grant claim logic;
custody stay-out — no court-order enforcement in these RPCs), D7
(location coarse-only — these RPCs touch no location data).

**Conventions:** `SECURITY DEFINER`, `SET search_path = public`,
`safe_auth_uid()` for caller identity (fail closed), `REVOKE ALL FROM PUBLIC`
+ `GRANT EXECUTE TO authenticated, service_role` on every RPC (cron-only
sweeps: service_role only). No placeholders — every function is complete.
