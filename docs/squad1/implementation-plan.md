# Squad 1 — Safety Track ⛑️: Implementation Plan

**Author:** Product Manager (PMP), Squad 1 · 2026-10-12
**Branch:** `staging-build` · **No deploy.**
**Source of truth:** `docs/solutions/sol-safety.md` · Requirements: `docs/BUILD-SPECIFICATION.md` §FR-SAFETY-001–015 · Break-glass redesign: `docs/PANEL-ROUND2-SOLUTIONS.md` Proposal 1 · Build order: `docs/MASTER-BUILD-CHECKLIST.md` §B · MD decisions: `docs/MD-DECISIONS.md` (D1, D3, D4, D6, D7 incorporated) · Mehedi directive 2026-10-12: **NO PLACEHOLDERS**.

## 0. Directives incorporated (change log)

- **D1 (vendor contract, not in-house):** break-glass Path A human review goes to a contracted crisis-response vendor. We build the **seam** (request schema, corroboration payload, HMAC review callback, 12h grant issuance) — not the staffing. Vendor selection is an MD action item; Path A cannot go live without it.
- **D4 (support):** crisis escalation on holidays routes to the rotating on-call agent (no blackout); after-hours/holiday honest-banner copy variant. Agent $50 in-ticket authority is S3 scope — Squad 1 only defines the crisis→ticket handoff contract.
- **D6 (tiered grants):** 8 grants/30d rolling window for trusted grantees; 2/30d for new grantees; teen co-approval (13–15) for **new** grantees only. Applies to shared grant infra; W12 babysitters built by Squad 4 against this rule contract.
- **D7 (coarse-only location):** city/ZIP max, never precise GPS — architectural constraint. Precise coordinates are **rejected at ingestion** (not truncated), aligned with QA `LC-001–012`.
- **Mehedi NO-PLACEHOLDERS directive:** every shipped work package is a full working implementation — real tables, real RPCs, real UI on real data, real RLS. Banned: mock data, "coming soon" screens, stubbed functions, TODO/FIXME comments. Each WP below carries an explicit Definition of Done and a placeholder audit in the phase-exit checklist.

## 1. Work breakdown

Ownership: backend = migrations `022–029`, `src/lib/safety/`, `supabase/functions/crisis-router/`; frontend = `src/components/safety/` + safety routes; UX = `docs/squad1/ux-specs.md`; QA = `docs/squad1/test-plan.md`.

### WP-1 · Trusted-adult designation flow (FR-SAFETY-001, FR-SAFETY-010)
Resolves the crisis-tripwire vs revoke contradiction: alerts route to the teen's designated trusted adult, never a revoked parent. **Blocks WP-2, WP-3, WP-6, WP-7.**

- AC-001 Nomination: teen adds adult (display name, relationship chip, phone/email, optional note) → row created in `trusted_adults` with `verification_status='pending'`, 6-digit code issued, SMS/email sent. Cap 5 active adults; 6th requires deactivating one.
- AC-002 Verification: `/verify-adult` public page accepts code; 15-min expiry; 5-attempt lockout; sets `verified` + audit. Parent-vouched path auto-verifies.
- AC-003 Decline path: unchecked-by-default acknowledgment checkbox ("I understand no adult will be alerted") → `access_events` row `crisis_alert.declined_path` with ack version pinned; no sentinel row in `trusted_adults`.
- AC-004 Revoke gate: `rpc_revoke_grant` **refuses** teen 13–17 revoke/go-independent unless ≥1 verified `revoke_guardian`-role adult OR valid decline event exists; error copy plain-language.
- AC-005 Scope firewall: parent/grantee has **no SELECT** on `trusted_adults` (teen-RLS-only); a revoked parent's row auto-deactivates via trigger.
- AC-006 Management screen: Settings → Safety → "My trusted adults" — add/verify/remove, status chips, yearly re-confirmation nudge; removal never blocked.
- **DoD:** works end-to-end against real Supabase data (nominate → code SMS/email → verify → gate passes); RLS tests prove parent-invisibility; zero placeholder tokens.

### WP-2 · Crisis protocol L1–L4 (FR-SAFETY-002)
**Launch-blocks Wellbeing (W8).** Detection sources: mood pulse, check-in text, AI chat. All detection server-side (Edge Function + tutor Worker safety middleware), never client-side.

- AC-007 Ladder: L0 baseline → L1 empathy + optional resources (teen-side only) → L2 "heavy week" nudge + designation prompt (never parent-visible, incl. aggregates) → L3 988/CTL persistent card + trusted-adult SMS (T2 routing) → L4 + 911 nudge + grounding flow + immediate trusted-adult SMS + DFCS-escalation evaluation hook (G7 compliance owner).
- AC-008 Versioned ruleset: `crisis_rulesets(version, rules_json, active_from)`; every alert audit row pins `ruleset_version` (reproducible decisions).
- AC-009 Alert content: presence-only ("may be in crisis"), never mood text/chat excerpts. T1 re-alert +15 min once if no ack; T2 no re-alert. No fallback to revoked parents.
- AC-010 Teen-controlled "tell a trusted adult": teen picks message tier (presence-only or +280-char note), preview-before-send, logged to `access_events` (teen-visible).
- AC-011 AI self-harm protocol (CA SB 1119 shape): T1/T2 response contract; never "just between us" (G10 line verbatim); never diagnosis/therapy role-play/means discussion; mode-independent (Pookie and Muse-direct identical).
- AC-012 "Private spaces are not safety-monitored" copy shown at Wellbeing first-open, check-in first use, AI chat first use; re-findable in Settings → Safety.
- AC-013 S2 escalation handoff (D4): AI-chat → human escalation routes to support queue in hours, **rotating on-call on holidays** (no blackout); honest banner carries a holiday variant ("Our team is on a holiday rotation — if you need help right now, call or text 988…"); crisis tickets attach the in-app crisis-resources card and are excluded from the $50 financial-authority workflow.
- **DoD:** full ladder fires end-to-end on real data (test harness triggers T1/T2 against seeded ruleset; real SMS via provider sandbox); teen-privacy verified (L1/L2 never leave teen-side); DV-advocate reviewed strings.

### WP-3 · W19 Emergency module (FR-SAFETY-008)
Storage, not a response service.

- AC-014 "Call 911 first" posture: persistent verbatim banner on module top and every emergency card; module subtitle "Your info, ready when you need it. Not a replacement for 911."
- AC-015 GA resource preload: `emergency_resources` seeded (911, Poison Control 1-800-222-1222, 988, GCAL 1-800-715-4225, Crisis Text Line, DFCS 1-855-422-4453, Cobb County non-emergency) with "Numbers verified [date]".
- AC-016 Break-glass medical card: `emergency_medical` per child (blood type, allergies, conditions, meds, doctor, vault-encrypted insurance card); teen generates 24h single-viewer QR + 6-digit code; every view audit-logged (`access_events.emergency.break_glass_viewed`); works regardless of parent access state.
- AC-017 Lock-screen/QR card (G25): wallet-pass-style card, teen-selected fields, works phone-locked without login.
- AC-018 Lab emergency quick-card: per lab class — teacher, room, nurse/front-office number, universal lab rules.
- AC-019 Action-plan templates (allergy/asthma/seizure): "my signs → my meds → who to call → what to tell 911"; informational scaffolding, no diagnostic language.
- **DoD:** real `emergency_medical` row → real QR → real unauthenticated read of exactly the medical card scope; audit row written; nothing else readable via the break-glass token.

### WP-3B · Out & About safety gate + Explorer Setup (FR-SAFETY-007)
One-time gate for 13–15 on first open of Events/Trails/Restaurants (Weather exempt, informational).

- AC-020 Explorer Setup: Screen 1 trusted-adult outing contact (required <16); Screen 2 Safety Basics 3-min interactive cards (DV-advocate reviewed); Screen 3 family-aware defaults (until 16). Under-16 cannot dismiss without completing; completion recorded server-side.
- AC-021 Share-my-plan (first-class, voluntary): teen composes itinerary → one-tap send to chosen outing_contact; check-in timers ("nudge me at 4pm"); missed → nudge teen → +15 min → notify plan recipient with plan card; offline plan card cached on device.
- AC-022 `outing_plans` (025): statuses active/completed/overdue/cancelled; auto-complete at return_at+2h; teen-deletable; **no location history retained <18** (itinerary only, destination as text — no coordinates, per D7).
- AC-023 Server-side gating: dusk check (astronomical sunset calc; 13–15 hard warning, override requires trusted-adult share); gating enforced in RPCs, not just UI.
- **DoD:** 13-year-old API-direct plan-save gets server-side refusal; dusk guard blocks/permits correctly; overdue flow notifies the teen-chosen contact, never auto-parents.

### WP-4 · Break-glass: vendor seam (Path A) + LE schema (Path B) (FR-SAFETY-013/014/015, D1)
**Hard constraint (NFR-LEGAL-006):** do NOT build disclosure tooling, LE portal, or approval UI before counsel sign-off. We build **schema + the vendor seam**; grants issue only against a signed vendor contract.

- AC-024 `emergency_requests` (folded into migration 026 — see §5 collision note): append-only `(requester, path, verification_artifacts, corroboration, reviewer, decision, scope, expiry, outcome)`; spoliation guard: auto-expiry kills grants only, records go on 7-year litigation hold.
- AC-025 Vendor interface contract (the seam we build):
  - Outbound `POST {vendor}/v1/emergency-review`: `{request_id, teen_ref (opaque pseudonym), attester: {trusted_adult_id_hash, relationship, attestation_text, attested_at}, second_channel: {type, detail_hash}, coarse_location: {city, zip}, requested_scopes: ["coarse_location","emergency_medical_card"], onboarding_scopes}` — never teen name, never precise location (none exists), never content scopes.
  - Inbound `POST /api/vendor/emergency-review/callback` (HMAC-SHA256, vault secret): `{request_id, decision: approved|denied|escalate_le, reviewer_id, reviewed_at, grant_hours ≤ 12, notes_redacted}`.
  - Grant issuance is server-side only on `approved`; 12h auto-expiry; mandatory active closure with access log; `access_events` with `reason_code='emergency'`, teen-visible only.
  - Corroboration rules: two independent confirmations; **missing-person report filed BY a revoked parent is treated as suspect** (requires independent corroboration); "parent can't locate teen" is explicitly NOT an emergency.
- AC-026 Path A invariants: trigger ONLY by teen's pre-designated trusted adult; **revoked adult can never be break-glass contact** (server-side invariant); civilian self-serve trigger impossible (no public endpoint); scope fixed in policy — requester never chooses; teen notified via silent in-app card on next login (never push/SMS); product name "Emergency safety access".
- AC-027 Path B schema only: SCA §2702(b)(8) spine; verification fields (callback number, 24h written confirmation, two-employee approval); scope location-only read-once; 72h incident-bounded cap; disclosure timing layers + post-use repair flow designed, tooling gated.
- AC-028 Safe default: without a signed vendor contract, the seam exists but `approved` decisions cannot be honored (deny-closed); documented as `INTEGRATION POINT: awaits MD vendor selection`.
- **DoD:** schema real; callback endpoint real with HMAC verification; corroboration rules enforced server-side; deny-closed without vendor; zero disclosure UI shipped.

### WP-5 · W3 Safety (insurance docs) + W15 Screen Time (co-set)
- AC-029 W3: insurance documents upload to encrypted vault (GIPA masking); family-safety scope rows on Sharing screen are **non-toggleable** (FR-SAFETY-003); `revokeAccess` never touches this scope; separate safety channel in the API.
- AC-030 W15 co-set: teen proposes limits → parent approves / counter-proposes (counters return to teen, never silently applied) / declines with reason; active plan identical on both sides; **no parent-only dashboard, no secret reports**.
- AC-031 Teen appeal: "Ask for a change" → teen writes reason → parent responds in-app; appeal history visible to both; ignored appeals keep the plan running (no auto-escalation).
- AC-032 Under-13: **no device agent, no MDM, no background monitoring** (COPPA); parent-managed routines + OS-native controls guidance only.
- AC-033 Transparency copy shipped verbatim: "Pookie never watches secretly — if it's limited, it's listed here."
- **DoD:** propose→counter→approve round-trip on real data; identical plan rendered on both sides; no covert data collection exists anywhere in the code path.

### WP-6 · Safe-exit UI (FR-SAFETY-004/005)
- AC-034 Safe-exit checkbox on the revoke safety screen ("Telling my parents about this could put me at risk") → **immediate** grant deactivation, notification **suppressed (not delayed)**, crisis resources card shown (988/CTL + trusted-adult confirm).
- AC-035 Visually boring by design: neutral screens, no celebration/confetti anywhere an abuser might see; `safe_exit.executed` event teen-visible only, excluded from parent-facing audit surfaces.
- AC-036 Parent end-state indistinguishable from standard revoke end-state (neutral "no longer shared").
- AC-037 Undo: re-grant after safe-exit triggers gentle "are you sure?" anti-coercion confirm.
- AC-038 Framing split: **gaining** independence = celebration (confetti, own Pookie); **removing** a parent = calm, neutral, respectful (FR-SAFETY-005).
- **DoD:** safe-exit executes in one action with zero parent notification ever sent; parent UI shows no pending-state signal.

### WP-7 · Cooling-off redesign (FR-AGE-002; was 🛑 blocked)
- AC-039 Step flow: scope & consequences → trusted-adult gate (WP-1) → notify-now vs notify-at-effect choice (default at-effect, revoked parent only, never both) → safety screen (WP-6) → confirm pending.
- AC-040 Pending mechanics: `pending_revokes` row (024); `parent_sync_frozen_until` flag checked by sync workers before any parent-destined write; parent UI **literally unchanged** (frozen timestamps, no countdown banner); teen may cancel (freeze lifted, no parent ever knew).
- AC-041 Effect runner: daily cron `revoke-effect-runner` → `rpc_execute_revoke` (service_role); grant deactivated, API tokens cleaned up; notification per Step-3 choice (at-effect default, neutral copy, no reason given).
- AC-042 16–17 instant path: same screens, immediate effect, notify defaults intact, safe-exit still available.
- AC-043 Post-effect: no re-request for 30 days (welfare); re-request goes to teen only; non-revoked other parent sees nothing at any stage.
- **DoD:** full 13–15 pending lifecycle on real data (initiate → frozen parent view → cancel AND initiate → effect → notify-at-effect only); safe-exit bypass verified; 16–17 instant path verified.

### WP-8 · Tiered time-boxed grants (D6)
Shared grant-infrastructure rule contract. **W12 babysitters (Phase 6) is built by Squad 4 against this contract** — Squad 1 owns the rule definition + its own flows.

- AC-044 Frequency caps: rolling 30d window — **8 grants/grantee/30d** for trusted grantees (previously approved, no blocks); **2 grants/grantee/30d** for first-time grantees.
- AC-045 Teen co-approval (13–15): **required for NEW grantees only**; renewals of trusted grantees skip co-approval.
- AC-046 Installment-evasion detection stays active regardless of tier.
- AC-047 Trusted-adult outing-contact grants use the trusted tier.
- **DoD:** cap enforcement tested at boundaries (8th grant blocked, 9th next window; new grantee 3rd blocked); co-approval fires only for new grantees; evasion detection triggers.

### WP-9 · Coarse-only location architecture (D7) — NFR-LOC-001
Applies to every location-touching code path, from day one.

- AC-048 **Rejection at ingestion:** any API/Edge Function/RPC receiving coordinates more precise than city/ZIP **rejects** (not truncates) — aligned with QA LC-001–012.
- AC-049 Weather RPC: coarse locator only (ZIP/city); precise coordinates rejected server-side for <18 outside an active outing plan.
- AC-050 Break-glass scope is "coarse location + W19 medical card" **by construction** (no precise data exists to disclose) — vendor payload carries `{city, zip}` only.
- AC-051 `outing_plans` destination is free-text itinerary; no coordinates stored; no location history retained <18 (G14).
- AC-052 Any future precise-location need triggers a separate privacy review (documented gate).
- **DoD:** precise-coordinate payloads return 4xx on every location endpoint; DB contains no precise coords; audit shows rejections.

### WP-10 · Crisis escalation ops interface (D4) — spec'd seam to Support
S3 ticket workflow is Phase 4 Support scope; Squad 1 defines only the safety-side contract.

- AC-053 Escalation routing spec: in-hours → support agents; after-hours/holidays → rotating on-call (no blackout); the honest banner copy has after-hours and holiday variants (UX ships all three).
- AC-054 Crisis tickets: carry the in-app crisis-resources card; excluded from the $50 financial-authority track; route to human support option, not to refunds/credits.
- **DoD:** routing table + banner variants implemented in the crisis path; handoff payload to S3 schema-defined (S3 implementation by Support squad).

## 2. Dependency sequence

```
Phase-0 legal gates (COPPA package + ToS + mandatory-reporter designation + counsel engagement)
   │  (run in parallel; NFR-LEGAL-006 blocks WP-4 disclosure tooling only, not schema/seam)
   ▼
WP-1 trusted_adults (022) ───────────────────────────────────────── FIRST: everything below depends on it
   ├─► WP-2 crisis protocol (023 + crisis-router) ──► W8 launch-blocked until live
   ├─► WP-6 safe-exit + WP-7 cooling-off (024 + revoke RPCs; gate on WP-1)
   ├─► WP-3 W19 (026) ──► WP-4 break-glass seam (vendor interface; schema in 026)
   └─► WP-3B explorer setup + outing_plans (025)
WP-5 W3/W15 ── mostly independent (W15 parent view reads access grants — spec contract only)
WP-8 grant tiers ── needs access-model grant schema (Phase 0) ──► Squad 4 W12 builds against it
WP-9 location NFR ── enforced from day one in ALL WPs (backend + frontend)
WP-10 crisis ops seam ── spec only; Support squad implements S3 side
Gates: QA sign-off per flow → Fractional Team 2 (security) review → phase completion
Launch gates: DV-advocate string review · licensed-attorney sign-offs (checklist §5: ToS, cooling-off
notification matrix, law-enforcement policy, break-glass disclosure tooling, court-order workflow,
mandatory-reporter program) · R1 6-month review scheduled · R12 tripwire documented
```

## 3. API contract summary

Derived from sol-safety.md Appendix B. Backend owns `docs/squad1/api-contracts.md` — **contract drift watch:** it has not landed yet; the signatures below are the PM's canonical reference. Any drift must be reconciled here before code review.

| RPC / Function | Signature | Notes |
|---|---|---|
| `rpc_nominate_trusted_adult` | `(p_child_profile_id uuid, p_display_name text, p_relationship text, p_contact_channel text, p_contact_value_enc text, p_note text)` → `{trusted_adult_id uuid, verification_code_issued bool}` | rate-limit ≤5/day/teen; encrypts contact; sends SMS/email; writes `access_events(trusted_adult.added)` |
| `rpc_verify_trusted_adult` | `(p_token text, p_code text)` → `{ok bool, status text}` | public-safe; 5-attempt lockout; 15-min expiry |
| `rpc_decline_trusted_adult` | `(p_child_profile_id uuid, p_ack_version text)` → `void` | requires checkbox ack version match; writes `crisis_alert.declined_path` |
| `rpc_initiate_revoke` | `(p_child_profile_id uuid, p_grantee_id uuid, p_scopes text[], p_notify_mode text)` → `pending_revoke_id uuid` | refuses without WP-1 gate (AC-004); freezes parent syncs |
| `rpc_cancel_revoke` | `(p_pending_revoke_id uuid)` → `void` | lifts freeze; no parent notification |
| `rpc_execute_revoke` | `(p_pending_revoke_id uuid)` → `void` | cron/service_role only; deactivates grant, cleans tokens, sends notification per notify_mode |
| `rpc_safe_exit` | `(p_child_profile_id uuid, p_grantee_id uuid, p_scopes text[])` → `void` | immediate; suppressed notification; teen-visible audit only |
| `rpc_regrant_access` | `(p_child_profile_id uuid, p_grantee_id uuid, p_scopes text[])` → `void` | post-safe-exit triggers confirm flow |
| `edgefn_crisis_router` | Edge Function, service_role only | versioned ruleset; sends alerts; writes `crisis_events` + `crisis_alerts` |
| `POST /api/vendor/emergency-review/callback` | HMAC-SHA256 body `{request_id, decision, reviewer_id, reviewed_at, grant_hours, notes_redacted}` | vendor seam (D1); deny-closed without signed vendor contract |

### Integration points (spec'd interfaces from BUILD-SPECIFICATION.md — no mocks)
Convention: every seam carries the marker comment `// INTEGRATION POINT: awaits <owner> — spec <ref>` and is listed here.

- `src/lib/safety/actions.ts` — INTEGRATION POINT: awaits **Platform Team 1**, `access_events` (migration 021, spec `docs/ACCESS-MODEL-REVIEW-CHECKLIST.md`). We build against the spec'd event-type contract (`trusted_adult.*`, `crisis_alert.*`, `revoke.*`, `safe_exit.*`, `emergency.break_glass_viewed`, `reason_code='emergency'`); all writes are real calls to that contract.
- `supabase/functions/crisis-router/` — INTEGRATION POINT: awaits **MD vendor selection** (D1). Vendor callback endpoint ships real; grants issue only on real signed `approved` callbacks.
- `src/lib/safety/grants.ts` (WP-8) — INTEGRATION POINT: consumed by **Squad 4** for W12; tier rules are the contract both sides implement.
- `src/lib/safety/crisis-escalation.ts` (WP-10) — INTEGRATION POINT: consumed by **Phase 4 Support squad** (S3 ticket workflow).
- `src/lib/location.ts` (WP-9) — shared NFR guard; all squads import the same reject-on-precise validator.

What ships must work end-to-end against these contracts. If the other side is not built yet, we build against the spec'd interface — never a mock.

## 4. Phase-exit checklist (all must be true before QA sign-off)

1. Every AC in the shipped WPs passes against real Supabase data (staging project).
2. RLS policies verified: parent/grantee invisibility on `trusted_adults`, teen-visibility of own crisis audit, revoked-parent exclusion everywhere.
3. **Placeholder audit: zero hits** — grep `TODO|FIXME|XXX|HACK|mock|stub|placeholder|"coming soon"|lorem` (case-insensitive) across `src/`, `supabase/` returns zero hits before QA sign-off.
4. QA sign-off per flow (`docs/squad1/test-plan.md` matrices).
5. Fractional Team 2 (security) review complete.
6. Code cleanliness: no dead code, no commented-out blocks, no unused imports (repo rule).

## 5. Risk / issue log

| # | Risk / issue | Owner | Mitigation / status |
|---|---|---|---|
| R-01 | **Vendor selection (D1)** — MD action item; Path A cannot go live without a signed vendor contract | MD (Mehedi) | External dependency; seam is vendor-agnostic; deny-closed until signed |
| R-02 | Counsel gate NFR-LEGAL-006 — no disclosure tooling/LE portal/approval UI before sign-off | Fractional Team 1 | Schema + seam only in this plan; tooling explicitly out of scope |
| R-03 | Migration-number collision: Proposal 1 suggested `022_emergency_requests`; sol-safety Appendix A fixes 022 = `trusted_adults` | Backend | **Resolved:** `emergency_requests` folds into migration 026 |
| R-04 | Proposal 1's `trusted_adult_contacts` vs sol-safety's `trusted_adults` — parallel tables would drift | Backend | **Resolved:** single table; emergency-consent captured as a flag on `trusted_adults` |
| R-05 | `profiles.safe_notification_pref` (Proposal 1) — profiles migration 017 exists (Platform Team 1) | Backend × Platform Team 1 | Add column via 022 or coordinate on 017; confirm in api-contracts.md |
| R-06 | `access_events` (021) not yet built — our audit writes depend on it | Platform Team 1 | Build against spec'd contract; tracked as INTEGRATION POINT |
| R-07 | Mehedi's DB access to apply migrations (MASTER-BUILD-CHECKLIST §B blocker) | MD | Escalate; no migration can land without it |
| R-08 | DV-advocate string review (revoke/notify/safe-exit/crisis/Safety Basics) — launch gate | Fractional Team 1 | Schedule early; strings flagged in ux-specs.md |
| R-09 | Attorney sign-offs: cooling-off notification matrix, law-enforcement policy, mandatory-reporter program, court-order workflow | Fractional Team 1 | Launch gates; do not skip |
| R-10 | `rpc_revoke_grant` gate error copy must survive DV review — refusal UX is safety-critical | UX × QA | AC-004 test asserts exact reviewed copy |
| R-11 | Holiday on-call boundary: crisis L3/L4 resources are automated; human escalation → on-call; break-glass review → vendor — three different humans | PM | Documented in WP-10; no conflation |
| R-12 | Squad 4 W12 must implement D6 tiers — cross-squad contract | Squad 4 | Tier rules published here as the contract; alignment check at their kickoff |
| R-13 | Precise-location rejection (AC-048) must be known to ALL squads, not just Squad 1 | PM → Engineering Handbook | NFR-LOC-001 proposed for the handbook's shared-constraints chapter |
| R-14 | QA test-plan already references D1/D4/D6/D7 (BGA/SUP/TG/LC matrices) — keep plan ↔ test plan in sync | PM × QA | This plan adopts the same semantics (reject-not-truncate, vendor seam, tiered caps, holiday routing) |

## 6. Contract drift watch (PM note)

- Backend's `docs/squad1/api-contracts.md` has **not landed yet** — signatures in §3 are canonical until then; reconcile on landing.
- QA `docs/squad1/test-plan.md` (landed): references vendor API per D1, holiday routing (SUP), tiered caps (TG), coarse-reject (LC) — **aligned** with this plan. One nuance adopted from QA: precise GPS is *rejected*, not truncated (AC-048).
- UX `docs/squad1/ux-specs.md` (landed): screen specs exist; DV-advocate review flags must be cross-checked against the strings referenced in AC-007/011/012/020 — PM to run the cross-check before QA sign-off.
- No drift detected as of 2026-10-12. Recheck at api-contracts.md landing.
