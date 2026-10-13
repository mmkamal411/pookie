# Pookie Migrations — Apply Order Manifest

Single source of truth for the order Supabase migrations apply. Files must
apply in this exact order; each depends on the one before it. Migrations are
tracked by Supabase in `supabase_migrations.schema_migrations` — never re-run
a file that already applied; always check that table first.

## Apply order (001 → 025)

| # | File | Purpose | Applied live? |
|---|------|---------|---------------|
| 001 | `001_tenancy_core.sql` | Multi-tenant core: users, children, child_access, invites, access_requests | ❓ UNVERIFIED (see note) |
| 002 | `002_school_systems.sql` | School adapter registry + classes + bell schedules + child_settings | ❓ UNVERIFIED (see note) |
| 003 | `003_credential_vault.sql` | Per-child credential vault + Portals UI metadata | ❓ UNVERIFIED (see note) |
| 004 | `004_compliance.sql` | Compliance: consents ledger (append-only) + audit log | ❓ UNVERIFIED (see note) |
| 005 | `005_agent_access.sql` | Agent (Muse) access boundary — SELECT-only agent_reader role | ❓ UNVERIFIED (see note) |
| 006 | `006_w1_school_core.sql` | W1 school core: grades, assignments, study plans, teacher messages, check-ins | ❓ UNVERIFIED (see note) |
| 007 | `007_w20_shopping.sql` | W20 shared shopping list + household helpers | ❓ UNVERIFIED (see note) |
| 008 | `008_w21_mail.sql` | W21 mail intelligence: mail items, action items, dispute drafts, OCR registry | ❓ UNVERIFIED (see note) |
| 009 | `009_w5_college_prep.sql` | W5 college prep: registry, list, deadlines, essays, recommenders, scores, transcript releases | ❓ UNVERIFIED (see note) |
| 010 | `010_w16_minutiae.sql` | W16 school minutiae — small school tasks that still need doing | ❓ UNVERIFIED (see note) |
| 011 | `011_w22_health_tracker.sql` | W22 health tracker: person registry, metric readings, privacy tiers, safety overrides | ❓ UNVERIFIED (see note) |
| 012 | `012_w23_nutrition.sql` | W23 nutrition tracker: food logs, targets, weekly patterns, food swaps | ❓ UNVERIFIED (see note) |
| 013 | `013_sync_queue.sql` | Sync queue + atomic sweep upsert for school portal workers | ❓ UNVERIFIED (see note) |
| 014 | `014_fix_safe_auth_uid.sql` | M1 fix: safe_auth_uid() for UUID-cast-safe RLS | ❓ UNVERIFIED (see note) |
| 015 | `015_child_account_management.sql` | Parent-facing child account management (account lifecycle flows) | ✅ Applied live 2026-10-12 (Squad Harbor, mgmt API) |
| 016 | `016_invite_preview.sql` | Public invite preview RPC (requires 015's invites.invited_by_user_id + graduate_child_access) | ✅ Applied live 2026-10-12 (Squad Harbor, mgmt API) |
| 017 | `017_*.sql` | Onboarding / profiles (Backend — not landed yet) | ❌ File not yet on branch |
| 018 | `018_*.sql` | child_access.granted_by column (Backend — must land before 023) | ❌ File not yet on branch |
| 019 | `019_*.sql` | TBD (Backend — not landed yet) | ❌ File not yet on branch |
| 020 | `020_*.sql` | TBD (Backend — not landed yet) | ❌ File not yet on branch |
| 021 | `021_*.sql` | TBD (Backend — must land before any RPC that writes events) | ❌ File not yet on branch |
| 022 | `022_health_tiers.sql` | **DRAFT (NFR-LEGAL gate).** H0–H3 taxonomy: tier enum, tier/provenance/anomaly/tombstone columns on health_metrics, health_consent_grants, allergy_list, health_medications, health_alert_thresholds, predicate health_tier_visible() | ❌ Pending — Mehedi dashboard apply |
| 023 | `023_health_reconsent.sql` | **DRAFT (NFR-LEGAL gate).** 18+ re-consent: health_reconsent_status, health_corrections, health_device_tokens lifecycle, nightly_health_birthday_cutover() + pg_cron, re-consent RPCs | ❌ Pending — Mehedi dashboard apply |
| 024 | `024_health_grace_and_deletion.sql` | **DRAFT (NFR-LEGAL gate).** health_grace (historical-only, revoke_cutoff), tombstones, health_retention_policies, sweep/purge jobs + pg_cron, hide-past + deletion RPCs | ❌ Pending — Mehedi dashboard apply |
| 025 | `025_access_scopes.sql` + `025_w11_spending.sql` + `025_wellbeing.sql` | Visibility scopes + W11 spending + Wellbeing shell (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 026 | `026_immunizations.sql` + `026_support_tickets.sql` | Immunizations + support tickets (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 027 | `027_faq.sql` + `027_nutrition_agegate.sql` | FAQ + nutrition age gate (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 028 | `028_wellbeing.sql` | **DRAFT (NFR-LEGAL gate).** wellbeing_entries (teen-only RLS, H3 auto-tier trigger), wellbeing_events (metadata-only), emit_wellbeing_event(), pattern detection, purge_expired_wellbeing() + pg_cron | ❌ Pending — Mehedi dashboard apply |
| 029 | `029_immunizations.sql` | **DRAFT (NFR-LEGAL gate).** immunizations (CVX, GA Form 3231 tracking), college_immunization_reqs, health-documents bucket, 3231 reminder job | ❌ Pending — Mehedi dashboard apply |
| 030 | `030_safety_crisis_and_grant_tiers.sql` + `030_sud_separation.sql` | Squad 1: crisis_rulesets/events/alerts + D6 grant_ledger + grant_access redefined (D6 caps/co-approval) + SUD separation (multiple files share the number; `030_safety_*` sorts first) | ❌ Pending — Mehedi dashboard apply |
| 031 | `031_nutrition_agegate.sql` + `031_safety_pending_revokes.sql` | Nutrition age gate + Squad 1: pending_revokes + parent_sync_frozen_until + revoke/safe-exit RPCs (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 032 | `032_college_504_graduation.sql` + `032_support_tickets_base.sql` + `032_safety_outing_plans.sql` | College 504/graduation + support tickets base + Squad 1: outing_plans + Explorer Setup gate (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 033 | `033_ai_governance.sql` + `033_support_tickets_rbac.sql` + `033_safety_emergency.sql` | AI governance + support tickets RBAC + Squad 1: W19 emergency_resources + emergency_medical + break-glass tokens (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 034 | `034_support_grants.sql` + `034_safety_trails.sql` | Support grants + Squad 1: trails + trail_safety_guidance + age-gated rpc_get_trails (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 035 | `035_w11_spending.sql` + `035_safety_events.sql` | W11 spending + Squad 1: events vetting model + age-gated rpc_get_events + reports (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 036 | `036_w7_vault.sql` + `036_safety_extensions.sql` | W7 vault + Squad 1: emergency_requests (break-glass Paths A+B, counsel-gated schema only) + court_orders (multiple files share the number) | ❌ Pending — Mehedi dashboard apply |
| 037 | `037_w24_credit.sql` | W24 Credit — minor security-freeze management (FR-MOD-W24) | ❌ Pending — Mehedi dashboard apply |
| 038 | `038_w14_coparenting.sql` | W14 Co-parenting — immutable logistics log, parallel-parenting (FR-MOD-W14) | ❌ Pending — Mehedi dashboard apply |
| 039 | `039_w12_babysitters.sql` | W12 Babysitters — directory + time-boxed grants with D6 tiered caps (FR-MOD-W12) | ❌ Pending — Mehedi dashboard apply |
| 040 | `040_w21_mail_retention.sql` | W21 mail — extract-then-mask enforcement + raw-image auto-deletion (FR-MOD-W21, NFR-PRIVACY-009) | ❌ Pending — Mehedi dashboard apply |
| 041 | `041_school_provenance.sql` | School data provenance + teacher/counselor inbox segregation | ❌ Pending — Mehedi dashboard apply |
| 042 | `042_checkin_calibration.sql` | Teen-owned check-in calibration system (FR-SCHOOL-003) | ❌ Pending — Mehedi dashboard apply |
| 043 | `043_study_sparks.sql` | Study Sparks (FR-SCHOOL-004, G8, R6) | ❌ Pending — Mehedi dashboard apply |
| 044 | `044_quiz_flashcards.sql` | Quiz pipeline (fail-closed) + source-text flashcards + formula bank | ❌ Pending — Mehedi dashboard apply |
| 045 | `045_path90_forecast.sql` | Path-to-90 forecast store + teen checkbox actions (FR-SCHOOL-007) | ❌ Pending — Mehedi dashboard apply |
| 046 | `046_faq.sql` | FAQ corpus tables (S1 Help Center) | ❌ Pending — Mehedi dashboard apply |
| 047 | `047_school_track_frontend.sql` | School track frontend contracts (Squad 3, 2026-10-12) | ❌ Pending — Mehedi dashboard apply |
| 048 | `048_safety_trusted_adults.sql` | Squad 1: trusted_adults + Vault-backed contacts + link-code verification + is_teen_of() + log_access_event 8-arg overload (repairs 018's call shape). NOTE: 030–036 were written apply-order-independent of this file (inlined teen checks; FKs backfilled in 049) | ❌ Pending — Mehedi dashboard apply |
| 049 | `049_second_parent_claim.sql` + `049_safety_trusted_adult_fks.sql` | Second-parent claim + Squad 1: FK backfill trusted_adults → crisis_events/crisis_alerts/outing_plans/emergency_requests (multiple files share the number; `049_safety_*` sorts first, both after 048) | ❌ Pending — Mehedi dashboard apply |
| 050 | `050_checkins_teen_privacy_fix.sql` | SEC-001 corrective — teen-only check-in RLS (+ SEC-002 throttle table) | ❌ Pending — Mehedi dashboard apply |
| 051 | `051_log_access_event_canonical.sql` | Canonical log_access_event signature (fixes SEC-C2): drops the 021 7-param overload, keeps the 8-param canonical form | ❌ Pending — Mehedi dashboard apply |
| 052 | `052_provision_onboarding_child.sql` | Squad 1 (auth ignition): onboarding first-child RPC — atomic children row (with date_of_birth) + caller parent access row for zero-membership users; guardian attestation gate; promoted from standalone `src/lib/onboarding/provision_onboarding_child.sql` (deleted) | ❌ Pending — Mehedi dashboard apply |
| 053 | `053_create_child_dob.sql` | Squad 1 (auth ignition): create_child() gains optional trailing `p_date_of_birth` (drops + recreates the 7-arg overload so old callers resolve to the new signature); feeds 018 age tiering for post-onboarding adds | ❌ Pending — Mehedi dashboard apply |
| 054 | `054_invite_preview_pii_fix.sql` | CRITICAL-1 (Fractional Compliance): get_invite_preview() returns valid/expired/used/inviter only (DROP+CREATE — return shape changes); NEW get_invite_detail() authenticated-only post-auth enrichment (email-ownership gated). ✅ verify-invite/page.tsx switched to get_invite_detail() (Squad 4 DB remediation, with pre-054 legacy fallback) — safe to apply | ❌ Pending — Mehedi dashboard apply |
| 055 | `055_consume_invite_age_gate.sql` | CRITICAL-2 (Fractional Compliance): consume_invite() COPPA age gate (under_13_no_login / age_verification_required) + dob_under13() + children_dob_guard BEFORE trigger; coexists with 027's AFTER sever trigger | ❌ Pending — Mehedi dashboard apply |
| 056 | `056_transaction_notes.sql` | transaction_notes table (Plaid user annotations read by src/server/services/plaid.ts); owner-scoped RLS | ❌ Pending — Mehedi dashboard apply |
| 057 | `057_faq_seed.sql` | FAQ seed corpus (Squad 5): 23 reviewed articles into 046's faq_articles; ON CONFLICT DO UPDATE | ❌ Pending — Mehedi dashboard apply |
| 058 | `058_go_independent.sql` | go_independent() teen flow (13–15 cooling-off / 16–17 instant revoke; staged 01 leftover) adapted to the 051 canonical 8-arg log_access_event + child_access_expiry_sweep_idx for 030's expire_timeboxed_grants() | ❌ Pending — Mehedi dashboard apply |
| 059 | `059_log_access_event_compat.sql` | Squad 4 (DB remediation): restores 021's 7-param log_access_event() overload verbatim — repairs the 051 caller breakage in 023 (x5), 024 (x3), 030_sud (x2), 034 (x1) + support/travel route fallbacks. Unambiguous vs the canonical 8-arg form (verified by sweep). | ❌ Pending — Mehedi dashboard apply |
| 060 | `060_support_ticket_grant_rpcs.sql` | Squad 4 (DB remediation): promotes Squad 5 UNIT P1 drafts for the 3 app-called RPCs — rpc_user_confirm_resolution, rpc_user_reopen (+30-day closed guard the draft omitted), rpc_decide_support_grant — plus P1.0 columns (resolved_at, lead_review) + support_grant_consenter(). Rest of P1 stays with Squad 5. | ❌ Pending — Mehedi dashboard apply |
| 061 | `061_driving_school.sql` | Squad 4 (DB remediation): promotes Squad 5 UNIT P3 verbatim — driving_rules (+GA/FL seeds), driving_log table + family RLS, rpc_log_driving_hours, rpc_driving_hours_progress. | ❌ Pending — Mehedi dashboard apply |
| 062 | `062_set_health_grant.sql` | Squad 4 (DB remediation): rpc_set_health_grant(p_child_id, p_grantee_user_id, p_tier, p_enabled) per sol-health §2.3 — subject-or-under13-steward authority, H3/H0 refused, one active row per (child, granter, grantee, tier), 'scope_changed' audit. Squad 2 backend: please review vs §2.3. | ❌ Pending — Mehedi dashboard apply |
| 066 | `066_school_telemetry.sql` | Squad Telemetry E4: school telemetry schema — extends classes/grade_snapshots/assignments/teacher_messages (room, current_unit, color, category_averages, assignment_type, external_id/received_at/summary); NEW school_attendance, school_calendar (2-yr retention), checkin_class_details, school_sync_health (status-dashboard contract, 1 row per child+source+machine) + school_sync_runs (90-day per-run log), recompute_school_sync_health(), purge helpers. | ✅ Applied live 2026-10-12 (E4, mgmt API) |
| 067 | `067_class_resources_checkin_uploads.sql` | Squad Telemetry E4 (Mehedi Classes requirements): NEW class_resources (per-class library, seeded vs student-added), checkin_uploads (handout metadata); checkin_class_details renames worked_on→covered, confusing→fuzzy + clicked column. Final per-class fields: covered/clicked/fuzzy/due_next/confidence. | ✅ Applied live 2026-10-12 (E4, mgmt API) |
| 068 | `068_class_handouts_storage.sql` | Squad Telemetry E4: `class-handouts` private bucket (50 MB) + child-scoped storage policies (`<child_id>/<class_slug>/<filename>`). | ❌ Pending — dashboard SQL editor ONLY (mgmt API role 42501 on storage schema) |
| 069 | `069_shared_shopping_lists.sql` | Squad Village: `shopping_list_shares` (one row per list↔user, active/revoked), `can_access_shopping_list()` DEFINER helper, additive RLS extending list/item/price-report visibility to share recipients; recipients can self-revoke (leave). | ❌ Pending — Mehedi dashboard apply |
| 070 | `070_child_mentors_village.sql` | Squad Village (The Village): `child_mentors` (age-tiered consent — <13 parent-immediate, 13–15 consent+7d cooling-off, 16+ consent-instant), `mentor_access_log` (append-only audit), `mentor_kudos`; `is_active_mentor()`/`mentor_can_see_class()` helpers; mentor read policies on classes/grades/assignments (scoped). Health/teacher-messaging explicitly NOT granted. | ❌ Pending — Mehedi dashboard apply |
| 076 | `076_parental_consent_under13_login.sql` | Squad Cradle: verifiable parental consent for under-13 child login (COPPA); grant/revoke/has_valid consent RPCs; consume_invite() amended gate. Fixed 2 syntax bugs during apply (END→END IF, LOOP;→END LOOP;). | ✅ Applied live 2026-10-12 (Squad Harbor, mgmt API) |
| 071 | `071_meal_recipes_preferences.sql` | Phase1 Meals (W13 elevate): NEW meal_recipes (structured ingredients, instructions, photo, tags, favorites) + meal_preferences (per-person likes/dislikes/allergen flags, one row per person label) for the recipe library, smart shopping list, and Surprise Me. H1, no calories, explicit entry only. | ❌ Pending — Mehedi dashboard apply |
| 074 | `074_activity_tracking.sql` | Phase1 Activity (W22): NEW workouts (type, duration_min, distance_mi, optional calories — logged only, never a target, notes, logged_at; child_id null = self) + activity_steps (manual daily step goal + count, device sync is a later phase); household RLS via is_household_member(). | ❌ Pending — Mehedi dashboard apply |
| 078 | `078_automation_feed.sql` | Background AI (Phase 1): `automation_nudges` (plain-English activity feed; unique (household_id, dedup_key) makes cron double-fires a no-op; client update-only, no insert/delete) + `cockpit_layout_overrides` (pilot layout locks/hides — AI proposes, pilot disposes) + `cockpit_layout_plans` (current computed LayoutPlan per household); household RLS via is_household_member(). | ❌ Pending — Mehedi dashboard apply |


### Status notes
- **2026-10-12 (Squad 3 data-layer sweep):** manifest completed — rows added for
  037–047, 050, 051 and new 054–058 (CRITICAL-1/2 compliance folds,
  transaction_notes, FAQ seed, go_independent). 052/053 landed concurrently
  from Squad 1 (auth ignition). Dependency rules 5–11 added (duplicate-number
  filename order; 018→052; 048→049; 051→058; 054 frontend blocker; 051 caller
  breakage in 023/024/030_sud/034/031).
- **2026-10-12 (Squad 2 reconciliation):** health rows 022–024, 028, 029 updated to the
  files actually on `staging-build`. 017–021 exist now (manifest still says TBD).
  Number collisions are REAL and need a coordinator ruling before live apply:
  030×2, 031×2, 032×3, 033×3, 034×2, 035×2, 036×2, 049×2. Rule 5 documents the
  filename-order apply behavior; no renumbering (applied-history safety).
- **2026-10-12 (Squad 4 DB remediation):** 059–062 landed (log_access_event 7-param compat restores the audit calls 051 broke in 023/024/030_sud/034 — that breakage is now REPAIRED; support ticket/grant RPCs + driving school promoted from Squad 5's P1/P3 drafts; rpc_set_health_grant per §2.3). 7 phantom-arg call sites fixed in src/lib/health/actions.ts; verify-invite/page.tsx switched to get_invite_detail() (054 frontend blocker CLEARED). Next free number: 063.
- **001–014:** last BUILD-LOG evidence (2026-10-12, DBA/BE entries) says these were delivered
  **files-only, NOT applied to any live DB**; a subagent could not query
  `schema_migrations` from the sandbox. Whoever runs the apply MUST run
  `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;`
  first and skip any file already listed. Status flips to ✅ only when the
  applier confirms via the DB.
- **015–058:** committed on `staging-build`, pending Mehedi's dashboard apply
  (single apply-and-verify session per SCHEDULE.md).

## Dependency rules (enforced at apply time)
1. **017 before** any onboarding code that references `profiles`.
2. **018 before 023** — `granted_by` must exist before `expires_at` logic builds on it.
3. **021 before** any RPC that writes events.
4. **016 after 015** — requires `invites.invited_by_user_id` + `graduate_child_access()` from 015.
5. **Duplicate numbers apply in filename order** — Supabase applies migrations
   lexicographically, so within a shared number the alphabetical order IS the
   apply order (e.g. `030_safety_crisis_and_grant_tiers.sql` before
   `030_sud_separation.sql`; `049_safety_trusted_adult_fks.sql` before
   `049_second_parent_claim.sql`). Never rely on creation order.
6. **018 before 052** — 052's `child_access` INSERT writes `granted_by` /
   `granted_by_user_id` (018 columns).
7. **048 before 049** — `049_safety_trusted_adult_fks.sql` backfills FKs onto
   `trusted_adults` (048).
8. **051 before 058** — 058's `go_independent()` calls the canonical 8-arg
   `log_access_event`; 051 drops the old 7-param overload it would otherwise
   (mis)resolve against.
9. **054 before live use of the invite flow** — the return shape of
   `get_invite_preview()` changes; `src/app/verify-invite/page.tsx` must be
   switched to `get_invite_detail()` first (frontend blocker, Squad 1).
10. **051 breaks 6-arg `log_access_event` callers** — 023, 024,
    `030_sud_separation`, 034 call the old 7-param form positionally and will
    fail at runtime after 051 applies; those squads must adapt to the 8-arg
    canonical form before the apply session. (`031_safety_pending_revokes`
    passes `jsonb` as the 8th arg in 4 calls — same class of break; Squad 1.)
11. Each migration must be **re-runnable** without error: `IF NOT EXISTS` on
   CREATE TABLE, `DROP POLICY IF EXISTS` before CREATE POLICY (Postgres has no
   CREATE POLICY IF NOT EXISTS), `DROP TRIGGER IF EXISTS` before CREATE TRIGGER,
   `CREATE OR REPLACE` on functions. CI check: `supabase/migrations/check.sh`.
   NOTE: `check.sh` currently FAILS on the 13 pre-existing policies in
   `002_school_systems.sql` (not preceded by DROP POLICY IF EXISTS) — 002 is
   historical; do not edit applied history to fix the heuristic.

## Update procedure (no placeholders — keep this file live)
When a new migration file lands on the branch:
1. Insert its row in numeric order with a one-line purpose taken from the
   file's own header comment.
2. Run `bash supabase/migrations/check.sh` — the file must PASS before it
   counts as "ready for apply".
3. Set "Applied live?" to ❌ Pending until the applier confirms the version in
   `supabase_migrations.schema_migrations`; only then flip to ✅.
4. If a number is skipped or renumbered, note it in the row — never leave a
   gap unexplained.

## ⚠️ Active collision risk (2026-10-12)
Multiple teams have claimed overlapping ranges. RESOLVED for Squad 1: the
022–029 safety migrations renumbered to **029–036** (landed 2026-10-12, rows
above). Squad 2 health amendments stay DRAFT or take 030+ — note 030 is now
taken by Squad 1 (crisis + grant tiers). Platform Team 1 Backend 017–023 all
landed. Coordinators: the next free number is 037.
