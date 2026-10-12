# Squad 1 Safety Track — API Contracts

**Owner:** Squad 1 Tech Lead (Safety Track) · 2026-10-12 · branch `staging-build`
**Source of truth:** `docs/solutions/sol-safety.md` (+ MD decisions D1/D6/D7)
**Migrations:** `029`–`036` (`supabase/migrations/029_safety_*.sql` … `036_safety_extensions.sql`)

Every RPC below is `SECURITY DEFINER, SET search_path = public`, fails closed,
and raises bare machine-readable error codes (surfaced by PostgREST as the
error message). Server actions live in `src/lib/safety/actions.ts` and return
`{ ok: true, data } | { ok: false, error: { code, message } }`.

Conventions: `teen` = caller holds an active `role='child'` row on the child.
Age tiers come from `public.child_age_tier()` (`under13 | t13_15 | t16_17 |
adult | unknown`; `unknown` fails closed into the most restrictive tier).
`granted_by` (`child | parent | system`) is always derived server-side from the
verified caller — never accepted from the client.

---

## 1. Trusted adults (`029`)

### `rpc_nominate_trusted_adult(p_child_id uuid, p_display_name text, p_relationship text, p_contact_channel text, p_contact_value text, p_note text DEFAULT NULL, p_roles text[] DEFAULT '{crisis_alert}', p_verification_method text DEFAULT 'link_code', p_parent_user_id uuid DEFAULT NULL)` → `jsonb`
Teen-only (13+). Nominates a trusted adult. Enforces: ≤5 nominations/day,
≤5 active adults, roles ⊆ `{crisis_alert, revoke_guardian, outing_contact}`.
`parent_vouched` requires `p_parent_user_id` to hold a LIVE parent grant; a
revoked parent raises `revoked_parent_not_eligible` (FR-SAFETY-013 invariant).
Contact value is vaulted server-side (Supabase Vault); the teen-visible row
carries only `contact_masked`.
Returns `{ trusted_adult_id, verification_token, verification_code,
verification_status }`. `verification_code` is returned ONLY to the server
caller so the server action can dispatch it — never to the browser.
Errors: `teen_only`, `age_verification_required`, `nomination_rate_limited`,
`trusted_adult_cap_reached`, `revoked_parent_not_eligible`,
`parent_grant_not_active`, `vault_unavailable`, `invalid_roles`.

### `rpc_verify_trusted_adult(p_token text, p_code text)` → `jsonb`
Public-safe; `GRANT EXECUTE TO anon, authenticated, service_role` (016
convention). Redeems the 6-digit code on `/verify-adult`. 15-min expiry,
5-attempt lockout (`verification_locked`, adult row → `failed`).
Returns `{ trusted_adult_id, display_name, verification_status }`.
Errors: `token_required`, `code_required`, `verification_not_found`,
`verification_expired`, `verification_locked`, `verification_code_mismatch`.

### `rpc_decline_trusted_adult(p_child_id uuid, p_ack_version text)` → `boolean`
Teen-only. Records the informed decline (`crisis_alert.declined_path` with the
pinned ack version). `p_ack_version` must be `'v1'` (the checkbox copy version).
Errors: `teen_only`, `ack_version_mismatch`.

### `rpc_revoke_gate_status(p_child_id uuid)` → `jsonb`
Teen-only. Returns `{ satisfied, via: 'trusted_adult' | 'declined_path' |
'none', trusted_adult_id }`. The Sharing flow calls this before Step 3; the
revoke RPCs enforce it server-side regardless.

### Tables
- `trusted_adults` — teen-only RLS (full CRUD). Parents/grantees have NO
  SELECT — the list is teen-visible only. A trusted adult is a NOTIFICATION
  TARGET ONLY; designation grants zero data access (scope firewall).
- `trusted_adult_contacts` — Vault-backed contact values. No SELECT policy
  for `authenticated`; reads via RPC/service_role only.
- `trusted_adult_verifications` — bcrypt code hashes, 15-min TTL, attempts.
- Trigger `trusted_adults_strip_on_parent_revoke`: revoking a parent's grant
  deactivates their trusted-adult rows and strips `crisis_alert` /
  `revoke_guardian` roles. A revoked adult can never serve as crisis routing.

---

## 2. Crisis protocol (`030`) + crisis-router Edge Function

### Tables
- `crisis_rulesets(version PK, rules_json, active_from)` — versioned T1/T2/T3
  routing contract. Seed `v1` (sol-safety §1.4). The active version is pinned
  on every `crisis_events` / `crisis_alerts` row (reproducible decisions).
- `crisis_events` — detection audit. Teen SELECT own; service_role writes.
- `crisis_alerts` — outbound alert audit (`sent | delivered | undelivered |
  failed`, `ack_at`). Teen SELECT own; service_role writes. **There is no
  client-callable send path** — `rpc_send_crisis_alert` does not exist by design.

### `POST /functions/v1/crisis-router`
Service-role only. Header `x-crisis-router-secret` must equal
`CRISIS_ROUTER_SECRET` (503 `crisis_router_not_configured` if the env var is
unset — fail closed; 401 on mismatch).

Request:
```json
{
  "child_id": "uuid",
  "tier": "T1 | T2 | T3",
  "source": "mood_pulse | checkin | ai_chat",
  "detected_at": "2026-10-12T03:00:00Z",
  "teen_first_name": "Dawson",
  "location": { "city": "Marietta", "postal_code": "30064" }
}
```
D7: any `lat`/`lng` key in `location` → `400 precise_location_rejected`.
Detection sources (mood pulse, check-ins, AI-chat safety middleware) call this;
detection logic is never client-side.

Behavior:
- **T3** → `200 { routed: false, teen_nudge: true }`. No external alert, ever.
- **T1/T2** → resolves the routing chain: verified + active + `crisis_alert`
  role, priority order, with a live-grant re-check for `is_parent` adults.
  SMS via `SAFETY_SMS_WEBHOOK_URL`; failure → email if on file → secondary
  adult → `crisis_alert.no_reachable_adult` + persistent in-app card.
  The chain NEVER falls back to a parent (G1 contradiction resolved).
  Alert copy comes from the ruleset (`alert_copy_sms`); presence-only, no
  mood/check-in/chat content.
- No verified adult + recorded `crisis_alert.declined_path` → in-app only
  (`reason: "declined_path"`).
- **Provider unconfigured → `500 crisis_sms_provider_unconfigured`** after
  writing the failed audit row. Loud failure, never a silent skip.
- T1 additionally: `realert_at` (+15 min; the scheduler re-fires on no ack)
  and a `dfcs_evaluation: pending_compliance_review` marker for the
  compliance owner (G7 — the owner decides; the function does not file).
- `app_push` contacts fall through to the next adult; push delivery is owned
  by the push fan-out reading `crisis_alerts` rows.

Response: `{ ok, tier, routed, via?, trusted_adult_id?, crisis_event_id?,
crisis_alert_id?, teen_inapp_card, realert_at? }`.

### Detection-source contract
Sources POST the event above. They MUST NOT send raw mood text, check-in
content, or chat excerpts — the router needs only the tier. The AI-chat
detection lives in the tutor Worker's safety middleware, not in the model
prompt. R12 tripwire: the moment any human (or non-safety AI read) touches
check-in content, re-run the G7 mandatory-reporter analysis.

---

## 3. Revoke / safe-exit (`031`)

Grant-state columns live on `child_access` (018/025); this layer adds the
safety workflow: `pending_revokes` ledger + `children.parent_sync_frozen_until`.

### `rpc_initiate_revoke(p_child_id uuid, p_grantee_user_id uuid, p_notify_mode text, p_scopes_removed text[] DEFAULT NULL)` → `jsonb`
Teen-only (13+). Enforces the trusted-adult gate (`trusted_adult_required`),
then delegates the grant-state change to `revoke_access()` (tier logic:
13–15 → `scheduled_revoke` + 7d; 16–17 → instant). Cooling path: writes the
`pending_revokes` row (`status='pending'`, `effect_at`), pins the parent's
visible snapshot (`frozen_view_at`), sets `parent_sync_frozen_until`, records
`notify_mode`. `p_notify_mode ∈ {at_effect, immediate}` (`suppressed` is
safe-exit only). v1 always removes the whole grant; `scopes_removed` records
teen intent for the future scope model.
Returns `{ pending_revoke_id, status, effect_at, notify_mode }`.

### `rpc_cancel_revoke(p_pending_revoke_id uuid)` → `boolean`
Teen-only. Voids the pending row, restores the grant, lifts the freeze. The
parent never knew (nothing ever changed for them). `safe_exit` rows are not
cancellable (`safe_exit_not_cancellable`).

### `rpc_execute_revoke()` → `integer` — service_role only (daily cron)
Finalizes due `pending_revokes` rows: grant → `revoked`, notification intent
per `notify_mode` (`at_effect` fires now; `immediate` already sent at
initiation), freeze cleared. Owns the rows `apply_cooling_off_revocations()`
skips (031 redefines it to defer). Returns the effected count.
INTEGRATION POINT: notification DELIVERY (push/SMS/email) is the notify
fan-out workstream, which reads `access_events` rows carrying `notify_mode`.
This RPC records intent + timing; it does not deliver (same split as 001's
`access_requests`).

### `rpc_safe_exit(p_child_id uuid, p_grantee_user_id uuid)` → `jsonb`
Teen-only (13+). "Telling my parents could put me at risk": immediate cutoff
at every age tier (bypasses cooling), `notify_mode='suppressed'` (no
notification is EVER sent — not delayed, suppressed), `parent_sync_frozen_until
= 'infinity'` until re-grant, all scopes zeroed (`zero_access_scopes`).
FR-SAFETY-004: the response carries no fanfare — safe exits stay visually
boring. The `safe_exit` access event is teen-visible only (021 RLS).

### `rpc_regrant_access(p_child_id uuid, p_grantee_user_id uuid)` → `boolean`
Teen-only. Re-grants via `grant_access()` (D6 caps apply; the teen waives the
30-day re-request lockout), clears the freeze, resets `safe_exit`. Post-safe-
exit anti-coercion confirm is client-side.

### Sync-worker contract (`parent_sync_frozen_until`)
Workers MUST read `children.parent_sync_frozen_until` before ANY
parent-destined write (grades, digests, notifications, dashboard pushes):
- `NULL` → not frozen; proceed.
- future timestamp → FROZEN: skip all parent-destined writes for this child.
  Already-pulled data stays as-is; nothing new flows.
- `'infinity'` → frozen until the teen re-grants (safe-exit).
Additionally (FR-SAFETY-006): a revoked parent's credentials must never keep
syncing the teen's data — workers must join `child_access` and skip grantees
whose `status <> 'active'`. Documented in the Engineering Handbook sync chapter.

---

## 4. D6 time-boxed grants (`030`)

`grant_access()` is redefined (018's authority model preserved) with optional
`(p_expires_at, p_grant_kind, p_purpose)` — existing 3-arg callers (e.g. 020's
`decide_access_request`) are unaffected.

- **Trust tier** is DERIVED from `grant_ledger`: a grantee is `trusted` with
  prior good-standing rows (`active`/`expired`); otherwise `new`.
- **Caps** (rolling 30d, per grantee): 8 for trusted, 2 for new.
  Over cap → `grant_cap_exceeded` (logged with cap/window detail).
- **Teen co-approval**: new grantee + parent caller → `child_access.status =
  'pending_coapproval'`; the grant activates only via `rpc_approve_grant`
  (teen-only, 13+). Teen callers and trusted re-grants activate immediately.
  `rpc_reject_grant` voids the pending grant.
- **Installment detection**: issuance within 24h of the prior grant's expiry
  sets `grant_ledger.installment_suspect = true` (flagged for review, not
  blocked — Round 2).
- **Timeboxed rules**: `grant_kind='timeboxed'` requires `expires_at` ≤ 90d;
  timeboxed grants are operational-scope only (`reflection`, `wellness`,
  `location`, `itinerary` zeroed at issuance — the RPC layer rejects them).
- `expire_timeboxed_grants()` (service_role cron): flips elapsed timeboxed
  grants to `expired`.
- `grant_ledger` RLS: teen SELECT own; service_role writes.

Squad 4 (W12) builds the grant-request UX against `grant_access`,
`rpc_approve_grant`, `rpc_reject_grant`, and `grant_ledger` reads.

---

## 5. Outing plans (`032`)

`children.explorer_setup_completed_at` / `explorer_setup_version` — the
one-time Out & About gate (13–15): trusted-adult contact + 3-min Safety
Basics + family-aware defaults until 16. Content versioned for DV-advocate
review.

### `rpc_save_outing_plan(p_child_id, p_destination, p_return_at, p_sunset_at, p_recipient_trusted_adult_id DEFAULT NULL, p_companions DEFAULT NULL, p_depart_at DEFAULT NULL, p_checkin_at DEFAULT NULL, p_city DEFAULT NULL, p_postal_code DEFAULT NULL, p_dusk_override_ack DEFAULT false)` → `jsonb`
Teen-only. Server-side gating (never UI-hiding alone):
- 13–15: Explorer Setup completed required (`explorer_setup_required`).
- 13–15: verified `outing_contact` recipient required (`outing_contact_required`).
- Dusk guard: `return_at` within 90 min of sunset → 13–15: hard block unless
  explicit teen override AND trusted-adult share (`dusk_guard_blocked`);
  16–17: saved with `dusk_warning: true`.
- D7: no precise coordinates accepted — `city`/`postal_code` text only.
Returns `{ outing_plan_id, dusk_warning }`.

### `rpc_update_outing_plan_status(p_plan_id, p_status)` → `boolean`
Teen-only. `p_status ∈ {completed, cancelled}`.
### `rpc_flag_overdue_outing_plans()` → `jsonb` — service_role only
Marks rows past `return_at + 2h` as `overdue`; returns them for the notify
fan-out (nudge the TEEN first; +15 min no response → the plan's teen-chosen
recipient; never auto-to-parents).

`outing_plans` RLS: teen-only CRUD. The plan is an itinerary, not a track:
no location history <18 (G14); rows teen-deletable.

---

## 6. Emergency W19 (`033`)

"**Pookie is not an emergency service. In an emergency, call 911 first —
then use this page.**" (persistent client banner; module subtitle: "Your
info, ready when you need it. Not a replacement for 911.")

### `getEmergencyResources` (action; public read)
`emergency_resources(region_code, name, number, sms, url, sort,
verified_at)` seeded for `US-GA`: 911, Poison Control 1-800-222-1222,
988, GCAL 1-800-715-4225, Crisis Text Line (text HOME to 741741),
DFCS 1-855-422-4453, Cobb County Police non-emergency 770-499-3911.
Copy honesty: "Numbers verified [date]. If one doesn't work, call 911."

### Emergency medical card
`emergency_medical` (teen-only RLS): blood type, allergies (hard-block list
shared with W28 — never inferred), conditions, medications, doctor, insurance
ref, teen-fillable action plans (informational scaffolding, not medical
advice), teen-controlled `lockscreen_fields`.
**Independent-teen rule:** break-glass reads the TEEN'S OWN record — parent
grants are irrelevant.

### `rpc_create_breakglass_token(p_child_id)` → `jsonb` (action: `createBreakglassToken`)
Teen-only (13+). Issues one live token per child (revokes prior): 6-digit
code (bcrypt-hashed), 24h expiry, single-viewer. Returns `{ token_id, code,
expires_at, max_views }` — the code is shown ONCE for the QR card.

### `rpc_redeem_breakglass_token(p_code text)` → `jsonb`
Public-safe; `GRANT EXECUTE TO anon, authenticated, service_role`. Token-gated
read-only medical card + emergency contact (trusted adult, masked) — no
login, no Pookie account. Every view is audit-logged
(`emergency.break_glass_viewed`, teen-visible).

---

## 7. Trails (`034`) and Events (`035`)

### `rpc_get_trails(p_child_id, p_city DEFAULT NULL, p_postal_code DEFAULT NULL, p_difficulty DEFAULT NULL, p_solo_only DEFAULT false)` → `jsonb`
Teen or active-parent caller. Server-side age gating: <16 with
`p_solo_only=true` → `solo_filter_unavailable_under_16` (the solo filter is
refused, not shown-locked). Every card carries the fixed safety block
(source, official difficulty, group guidance, dusk close, share-my-plan +
official park page links) — never omitted, never LLM-generated. D7:
`city`/`postal_code` text only; no coordinates anywhere.

### `rpc_get_events(p_child_id, p_city DEFAULT NULL, p_audience DEFAULT NULL)` → `jsonb`
Teen or active-parent caller. <18: `18+`/`21+` rows EXCLUDED (not
shown-locked). <13: `all_ages` + `family` only. Teen audience default per tier
(13–15: family/teen). Every card: age-tag chip, host-type chip, source link,
share-my-plan button, report button. D7: venue addresses are PUBLIC VENUE
data (curation), not the teen's location; searcher location is city text only.

### `rpc_report_event(p_event_id uuid, p_reason text)` → `uuid`
Teen-only. Files to the human review queue (48h SLA → takedown or tag
correction; reporter notified of outcome).

Curation invariants (in SQL, `035`): `host_type` CHECK rejects anything
outside `{ticketed_public, municipal, school, nonprofit, verified_host}`;
`events_no_private_residence` rejects private-residence rows at insert.

---

## 8. Break-glass Paths A+B — `vendor_crisis_review` interface (`036`, D1)

**COUNSEL GATE (FR-SAFETY-015 / NFR-LEGAL-006):** schema only. No disclosure
tooling, LE portal, approval UI, or grant-issuance code is built before
licensed-counsel sign-off. `emergency_requests` is the append-only record the
future counsel-approved flow will write. Vendor selection is the MD's action
item.

### Path A — teen-configured safety net ("Emergency safety access" in product)
Human review is performed by the CONTRACTED crisis-response vendor (D1), not
in-house staff. Pookie builds the integration seam against this contract:

**Outbound request** `POST {VENDOR_API_BASE}/v1/emergency-reviews`
```json
{
  "vendor_request_id": "uuid (Pookie-generated, idempotency key)",
  "teen": { "child_id": "uuid", "first_name": "string", "age_tier": "t13_15 | t16_17" },
  "trigger": {
    "triggered_by_trusted_adult_id": "uuid",
    "triggered_by_name": "string",
    "triggered_at": "timestamptz",
    "statement": "adult-authored free text (≤500 chars)"
  },
  "corroboration": [
    { "channel": "string", "confirmed_at": "timestamptz", "note": "string" },
    { "channel": "string", "confirmed_at": "timestamptz", "note": "string" }
  ],
  "scope_requested": { "coarse_location": true, "emergency_medical_card": true },
  "callback_url": "https://<pookie>/functions/v1/vendor-crisis-callback",
  "callback_deadline": "timestamptz (submitted_at + 30 min)"
}
```
Scope is FIXED by policy (requester never chooses): coarse city/ZIP location
(D7 — precise GPS is never held) + W19 emergency medical card. NEVER
reflections, check-ins, mood, journals, AI chats, health history, messages,
grades (server-side invariant). Hard invariant: a revoked adult can never be
the trigger.

**Inbound callback** `POST /functions/v1/vendor-crisis-callback`
```json
{
  "vendor_request_id": "uuid",
  "decision": "approved | denied",
  "decided_at": "timestamptz",
  "reviewer_id": "string (vendor reviewer reference)",
  "scope_necessity_note": "string (required when approved)",
  "signature": "HMAC-SHA256 hex of the canonical body with the shared secret"
}
```
Auth: HMAC-SHA256 over the raw body with `VENDOR_WEBHOOK_SECRET`; timestamp
freshness ≤ 5 min; idempotent on `vendor_request_id`.

**Grant issuance handshake** (counsel-gated, NOT BUILT): on verified
`approved`, the (future) issuance function creates a 12-hour grant scoped to
`{coarse_location, emergency_medical_card}` for the requesting trusted adult,
sets `emergency_requests.status='grant_active'`, `grant_expires_at =
approved_at + 12h`. Mandatory active closure with access log; the teen gets a
silent in-app "What happened" card on next login (never push/SMS);
LE-requested deferral ≤ 14 days, then automatic. Post-use repair flow:
per-scope receipts → one-tap re-lock → false-alarm track with plain apology →
human support option.

**Timeout handling:** `expire_stale_emergency_requests()` (service_role,
BUILT — bookkeeping only, discloses nothing) marks `submitted_to_vendor`
past `vendor_callback_deadline` → `vendor_timeout`; `grant_active` past
`grant_expires_at` → `expired` (auto-expiry kills grants only; records go on
7-year litigation hold — spoliation guard).

### Path B — law-enforcement exigent (legal path, SCA §2702(b)(8))
Legal spine: voluntary disclosure on good-faith belief of emergency involving
danger of death/serious physical injury requiring disclosure without delay.
Verification: callback to an independently-sourced agency number + written
official-channel confirmation within 24h + two-employee approval; time
pressure never lowers the bar. Scope: coarse location only (D7), read-only
one-time pull. 72-hour incident-bounded cap, renewable on fresh attestation;
terminate on case closure. Court orders/warrants go through the
FR-SAFETY-011/012 front door, not break-glass. Verification artifacts live in
`emergency_requests.verification_artifacts`. Categorical exclusions: revoked/
blocked parents can never trigger, receive, or be notified; "parent can't
locate teen" is NOT an emergency; a missing-person report filed BY a revoked
parent is treated as suspect.

### Court orders (`036`, FR-SAFETY-011/012)
`court_orders` + `children.court_order_restriction` +
`children.travel_restriction_profile`. Schema only: verified orders supersede
via HUMAN review; the teen is told plainly why access changed. D5: custody
STAY OUT for v1 — Pookie does not adjudicate custody; no auto-enforce.

---

## 9. Safety notification provider contract (`notify`)

Shared by `src/lib/safety/notify.ts` and the crisis-router Edge Function.

- SMS: `POST {SAFETY_SMS_WEBHOOK_URL}` JSON `{ to, body }`
- Email: `POST {SAFETY_EMAIL_WEBHOOK_URL}` JSON `{ to, subject, body }`
- Auth: `Authorization: Bearer ${SAFETY_SMS_WEBHOOK_SECRET /
  SAFETY_EMAIL_WEBHOOK_SECRET}`
- Provider must answer 2xx with `{ ok: true }`.
- Missing URL / non-2xx / non-confirming response → loud typed error
  (`sms_provider_unconfigured`, `provider_rejected`, …). Safety alerts are
  NEVER silently skipped.

---

## 10. Error-code index (selection)

`teen_only`, `age_verification_required`, `authentication_required`,
`trusted_adult_required`, `revoked_parent_not_eligible`,
`nomination_rate_limited`, `trusted_adult_cap_reached`,
`verification_locked`, `verification_code_mismatch`, `verification_expired`,
`ack_version_mismatch`, `grant_cap_exceeded`, `grant_not_pending`,
`grant_already_active`, `re_request_locked`, `child_grant_untouchable`,
`not_your_grant`, `access_not_found`, `child_access_irrevocable`,
`explorer_setup_required`, `outing_contact_required`, `dusk_guard_blocked`,
`solo_filter_unavailable_under_16`, `audience_not_allowed`,
`invalid_or_expired_token`, `service_role_only`,
`crisis_sms_provider_unconfigured`, `precise_location_rejected`,
`ruleset_not_configured`, `vault_unavailable`.

---

## 11. Launch gates (from sol-safety Appendix C)

1. DV-advocate review of ALL revoke/notify/safe-exit strings, crisis protocol
   strings, Safety Basics content, retaliation matrix — before launch.
2. Licensed-attorney sign-offs per checklist §5 (ToS, mandatory-reporter
   program, FERPA consent design, retention/litigation-hold, COPPA package,
   law-enforcement policy). The panel memo is issue-spotting, not legal advice.
3. Wellbeing (W8) does not ship until §§1–2 (trusted adults + crisis protocol)
   are live.
4. R1 6-month review: revoke counts, delayed-notification uptake, cancellation
   rate, retaliation reports, safe-exit clustering.
5. R12 tripwire: first human/AI read of check-in content → re-run G7 analysis.
6. FR-SAFETY-015: no disclosure tooling / LE portal / approval UI before
   counsel sign-off (NFR-LEGAL-006).
