# Squad 2 — Health Track 💚 · PM Backlog

**Date:** 2026-10-12 · **Branch:** `staging-build` · **No deploys.**
**Sources:** `docs/solutions/sol-health.md` (2026-10-12) · `docs/solutions/sol-ux.md` ·
`docs/squads/squad2-health/UX-SPECS.md` · `docs/squads/squad2-health/QA-PLAN.md`

## Managing Director directive (Mehedi, 2026-10-12) — NO PLACEHOLDERS

Applied to this entire backlog, effective immediately.

### Backlog-wide rules (acceptance gates)

1. **Any story containing mock/stub/TODO/fake-data fails acceptance.** No exceptions.
2. **Every story's Definition of Done requires full working implementation:** real
   tables, real endpoints (server actions / RPCs), real UI on real data, real RLS.
   Product code uses the user-JWT server client only. No service_role in product paths.
3. **Unbuilt-dependency stories cite the spec'd contract (file + section)** and the
   implementation must work against it — verified by contract-conformance, never by
   stubbing the interface.
4. **Legal/counsel gates are launch preconditions, not code placeholders.** Code ships
   complete against the contracts below; health data flows open only when the sol-health
   §12 gates clear. The `backend_not_ready` error path in the frontend is a real error
   path for a real dependency, not a placeholder.

### Tier naming (UI contract)

User-facing copy uses the plain-language names (`UX-SPECS.md` global design language):
**Everyday wellness** (H1) · **Private health** (H2) · **Most personal** (H3) ·
**Never collected** (H0). Tier codes never appear in UI strings.

---

## E1 — W2 Health hub

### FE-HEALTH-001 — Health hub route + tier-badged sections ✅ Implemented
**Files:** `src/app/c/[childSlug]/health/page.tsx` · `src/components/health/health-hub.tsx` ·
`src/components/health/ui.tsx`
**Contracts:** `sol-health.md` §4 (W2), §1.3 (access matrix), §4.2 (disclaimers), §1.6 (tiers)
**Acceptance criteria:**
- Renders Everyday wellness / Private health / Most personal as collapsed-by-default sections with tier badges.
- Parent viewers: Most personal section is **hidden** (never counted — §8.2, no existence signals); Private health shows the locked state without content.
- Every reading carries a provenance line ("From Apple Health · descriptive only" / "Entered by you").
- Persistent "not a medical device" header + footer on every visit (§4.2).
- Device-sync card reflects the real `health_device_tokens` state; disconnect works.
**DoD:** Works against `health_metrics` (022, §1.6) on real data. No mock readings anywhere.

### FE-HEALTH-002 — Tier-aware hub actions ✅ Implemented
**Files:** `src/lib/health/actions.ts` (`getHealthHub`, `disconnectDeviceSync`, `tierVisibleFor`)
**Contracts:** `sol-health.md` §1.6 (predicate), §2.1 (device tokens)
**Acceptance criteria:**
- `tierVisibleFor()` mirrors `health_tier_visible()` deny-by-default in code: H3 has no grant arm, H0 refused under 18, unknown DOB fails closed.
- Missing tables/RPCs → `backend_not_ready` with honest copy (error path, not a stub).
**DoD:** RLS remains the backstop (user-JWT client); the code layer is never more permissive than the predicate.

## E2 — W8 Wellbeing

### FE-HEALTH-003 — Wellbeing route + teen-private gate ✅ Implemented
**Files:** `src/app/c/[childSlug]/health/wellbeing/page.tsx` · `src/components/health/wellbeing-view.tsx`
**Contracts:** `sol-health.md` §5.1 (teen-only RLS, no parent aggregates), §5.5/C4 (firewall)
**Acceptance criteria:**
- Parent of a 13–17 teen gets the private-space notice: zero content, zero counts, zero aggregates.
- Under-13 steward parent exception works (COPPA stewardship, §1.3).
- No parent aggregate endpoint exists anywhere in the health actions.
**DoD:** Verified by QA RLS-… negative tests (denied caller gets empty set, never content).

### FE-HEALTH-004 — Mood pulse, journal, retention, deletion ✅ Implemented
**Files:** `src/lib/health/actions.ts` (`getWellbeingState`, `submitWellbeingCheckin`, `deleteWellbeingEntry`, `setWellbeingRetention`)
**Contracts:** `sol-health.md` §5.1 (`wellbeing_entries`), §5.2 (retention), §3.3 (deletion)
**Acceptance criteria:**
- Mood 1–5 + optional note + tags insert real rows tiered H2; entries list is the teen's own only.
- Per-entry delete tombstones immediately; retention picker persists the auto-purge setting.
- Crisis-event emission stays a database trigger (metadata only); the client never sends content anywhere.
**DoD:** Real inserts/tombstones against `wellbeing_entries` (025). No local-only journaling.

### FE-HEALTH-005 — Crisis-ladder surfaces ✅ Implemented
**Files:** `src/components/health/wellbeing-view.tsx` (`CrisisScreen`), `src/components/health/ui.tsx` (`CrisisResources`, `NedaCard`)
**Contracts:** `sol-health.md` §5.3/§5.4, `sol-ux.md` §11, `sol-health.md` §6.5 (NEDA)
**Acceptance criteria:**
- Rung 1: low check-in gets in-place warmth, no escalation UI. Rung 3: full-screen neutral crisis surface with one-tap `tel:988` / `sms:741741` / GA line.
- Persistent "Get help" in the W8 header; "I need help now" routes immediately.
- NEDA card always one tap away, never a blocking modal. First-run "not safety-monitored" line present.
- No auto-alert to parents, ever.
**DoD:** Buttons dial/message for real. Crisis *response* protocol remains the safety designer's (dependency D3).

## E3 — W23 Nutrition + W13 Meals

### FE-HEALTH-006 — Minor meal check-ins (no numbers by schema) ✅ Implemented
**Files:** `src/components/health/nutrition-view.tsx` · `src/lib/health/actions.ts` (`logMealCheckin`, `getNutritionState`)
**Contracts:** `sol-health.md` §6.2 (`meal_checkins`), §6.3 (weight-neutral copy), §6.5 (NEDA)
**Acceptance criteria:**
- Check-in form has no calorie/protein/weight inputs; zod `.strict()` + `refuseMinorNumerics` refuse numeric payloads with `minor_numeric_refusal`.
- Weight-neutral copy throughout (copy-lint list in §6.3); NEDA card persistent.
- Parent of a minor sees engagement-only via `nutrition_weekly_patterns()` (days logged, meals recorded) — never calories.
**DoD:** Works against `meal_checkins` (027). A minor cannot submit what the schema cannot hold.

### FE-HEALTH-007 — 18+ food diary ✅ Implemented
**Files:** `src/lib/health/actions.ts` (`logFoodDiary`)
**Contracts:** `sol-health.md` §6.1, §6.7
**Acceptance criteria:**
- 18+ only (`adult_only` refusal for minors); calories_low/high required with high ≥ low (uncertainty ranges).
- Diary stays Private health; parent of an 18+ adult sees the locked state without a grant.
**DoD:** Real writes to `food_logs` (012 as amended by 027).

### FE-HEALTH-008 — Meals planner ✅ Implemented
**Files:** `src/app/c/[childSlug]/health/meals/page.tsx` · `src/components/health/meals-view.tsx`
**Contracts:** `sol-health.md` §6.3 (W13)
**Acceptance criteria:**
- 7-day dinner ideas + grocery list; no calorie fields at any age (strict schema refuses them).
- Plans never link to food-log calorie data.
**DoD:** Real reads/writes against `meal_plans` (Squad 2 backend, 027 scope — dependency D1).

## E4 — 18th-birthday review

### FE-HEALTH-009 — review-18 interstitial ✅ Implemented
**Files:** `src/app/c/[childSlug]/health/review-18/page.tsx` · `src/components/health/review-18-view.tsx`
**Contracts:** `sol-health.md` §2.2 (screen), §2.3 (toggle semantics), §2.4 (review–correct–seal), §2.5 (export), §2.6 (emergency contacts)
**Acceptance criteria:**
- Step 1: per-tier, per-parent grant cards; H1/H2 toggles default OFF; H3 is a static "always private" line (no toggle); reading counts from real hub data.
- Step 2: review–correct–seal queue wired to `rpc_health_review_queue` / `rpc_health_record_correct` / `rpc_health_record_delete` (Appendix B).
- Step 3: transition-summary export via `rpc_export_transition_summary` (PDF + JSON download).
- Step 4: emergency contacts with the decoupled copy ("Emergency contact is not the same as access"); save reports the Squad 1 table dependency honestly (dependency D3) — no fake write.
- Step 5: "Save my choices" → `rpc_health_reconsent_submit` (H3 in the payload is refused with `h3_no_grant_path`); "Skip — keep everything private" → `rpc_health_reconsent_skip`.
- Non-subjects (parents) get the private-review notice, never the flow.
**DoD:** All five steps work against the Appendix B RPCs. Login-time enforcement hook is Platform Team 2 (dependency D4).

## E5 — Sharing → Health

### FE-HEALTH-010 — Settings → Sharing → Health ✅ Implemented
**Files:** `src/app/c/[childSlug]/settings/sharing/page.tsx` · `src/components/health/sharing-health-view.tsx` · `src/components/settings/settings-ui.tsx` (Sharing tab)
**Contracts:** `sol-health.md` §1.6 (grants), §2.3 (toggle semantics), §3.1 (grace), §3.2 (hide-past), §8.2 (firewall line)
**Acceptance criteria:**
- Per-parent collapsed cards with "Sees: …" / "Sees nothing right now" summaries; H1/H2 toggles flip one grant row each (no row = no access).
- Toggle writes go through `rpc_set_health_grant` (Squad 2 backend provides it per §2.3 semantics and the 023 "writable by granter only via RPC" rule — dependency D1).
- H3 static line + firewall line; no per-record existence signals.
- Active grace windows render ("can still see records from before [date] until [date]") from `health_grace`.
- "Hide my past health data too" (13+, explicit non-guilted confirm) → `rpc_hide_past_health`.
- "Who has looked" audit renders `access_events` health events in plain language.
- Delete-my-data lever → `rpc_request_health_deletion`.
- Grant authority enforced: under-13 steward parent; 13+ the teen; 18+ the adult. A parent of a teen gets the honest "managed by the teen" state.
**DoD:** Every control mutates real grant/grace/audit state. No toggle is decorative.

## E6 — Backend (Squad 2 backend squad)

### BE-HEALTH-001 — Migrations 022–028
**Contract:** `sol-health.md` Appendix A (migration plan)
**Acceptance criteria:** `health_tier` enum; tier columns on all health tables; `health_tier_visible()` replacing `health_metric_visible()`; `health_consent_grants`; `health_grace`; tombstone columns; `wellbeing_entries` + `wellbeing_events` (teen-only RLS); `meal_checkins`; `clinician_gates`; `immunizations`; `sud_records` with app-layer encryption + separate key; `health_device_tokens` lifecycle; `health_preferences`; `meal_plans`; 011/012 amendments (H2-only overrides ≤30d, minor calorie-refusal trigger, engagement-only patterns RPC).
**DoD:** Applied to staging; QA tier × band RLS matrix green (deny-by-default proven).

### BE-HEALTH-002 — RPC inventory
**Contract:** `sol-health.md` Appendix B
**Acceptance criteria:** All listed RPCs exist with spec'd signatures, plus `rpc_set_health_grant(p_child_id, p_grantee_user_id, p_tier, p_enabled)` implementing the §2.3 toggle semantics.
**DoD:** Frontend stories FE-HEALTH-001–010 pass contract-conformance against these RPCs.

### BE-HEALTH-003 — Nightly jobs
**Contract:** `sol-health.md` §2.1 (cutover), §3.1 (grace sweep), §3.3 (purge), §5.2 (wellbeing purge)
**Acceptance criteria:** pg_cron schedules live; enforcement sits in the predicates (fail closed), not just the jobs.
**DoD:** Cutover runs at 00:00 local on 18th birthdays whether or not the user logs in.

## E7 — QA

### QA-HEALTH-001 — Tier × band matrix + red-team
**Contract:** `docs/squads/squad2-health/QA-PLAN.md`
**Acceptance criteria:** Full HT-/RLS-/CO-/DEL-/NEG-/CH- suites green on staging. 🛑 launch gates hold: no real family touches health until the suite passes.
**DoD:** Deny-by-default proven per tier × age band, including no-existence-signal proofs.

## E8 — UX

### UX-HEALTH-001 — Copy deck conformance
**Contract:** `docs/squads/squad2-health/UX-SPECS.md`
**Acceptance criteria:** All health strings ≤8th grade, plain tier names, no em dashes, shame-free, firewall lines in place.
**DoD:** DV-advocate review signs the safe-exit/crisis strings before launch.

---

## Dependency register

| ID | Dependency | Owner | Contract |
|---|---|---|---|
| D1 | Migrations 022–028 + `rpc_set_health_grant` + `meal_plans`/`health_preferences` tables | Squad 2 backend | `sol-health.md` App A/B, §2.3 |
| D2 | `access_events` (021), `child_access`, profiles | Platform Team 1 | access-model spec |
| D3 | `emergency_contacts` write contract; trusted-adult list; `wellbeing_events` safety-pipeline sign-off | Squad 1 (safety) | `sol-health.md` §5.5/C4 |
| D4 | Login-time interstitial hook (first login ≥18 → `/health/review-18`) | Platform Team 2 | `sol-health.md` §2.1 |
| D5 | Counsel sign-off on taxonomy + thresholds + Health Breach Notification Rule determination | Legal | `sol-health.md` §12.2 — **launch gate** |

## Launch gates (sol-health §12)

Migrations applied + RLS matrix green → counsel review → safety sign-off → UX copy deck →
infosec program. Until then, health modules hold no real teen data. Module tiles are `live`
in the shell because the code is complete against the contracts; the gates above control
data flow, not code completeness.
