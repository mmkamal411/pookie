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
| 015 | `015_child_account_management.sql` | Parent-facing child account management (account lifecycle flows) | ❌ Pending — Mehedi dashboard apply |
| 016 | `016_invite_preview.sql` | Public invite preview RPC (requires 015's invites.invited_by_user_id + graduate_child_access) | ❌ Pending — Mehedi dashboard apply |
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
| 048 | `048_safety_trusted_adults.sql` | Squad 1: trusted_adults + Vault-backed contacts + link-code verification + is_teen_of() + log_access_event 8-arg overload (repairs 018's call shape). NOTE: 030–036 were written apply-order-independent of this file (inlined teen checks; FKs backfilled in 049) | ❌ Pending — Mehedi dashboard apply |
| 049 | `049_second_parent_claim.sql` + `049_safety_trusted_adult_fks.sql` | Second-parent claim + Squad 1: FK backfill trusted_adults → crisis_events/crisis_alerts/outing_plans/emergency_requests (multiple files share the number; `049_safety_*` sorts first, both after 048) | ❌ Pending — Mehedi dashboard apply |
| 052 | `052_provision_onboarding_child.sql` | Squad 1 (auth ignition): onboarding first-child RPC — atomic children row (with date_of_birth) + caller parent access row for zero-membership users; guardian attestation gate; promoted from standalone `src/lib/onboarding/provision_onboarding_child.sql` (deleted) | ❌ Pending — Mehedi dashboard apply |
| 053 | `053_create_child_dob.sql` | Squad 1 (auth ignition): create_child() gains optional trailing `p_date_of_birth` (drops + recreates the 7-arg overload so old callers resolve to the new signature); feeds 018 age tiering for post-onboarding adds | ❌ Pending — Mehedi dashboard apply |

### Status notes
- **2026-10-12 (Squad 2 reconciliation):** health rows 022–024, 028, 029 updated to the
  files actually on `staging-build`. 017–021 exist now (manifest still says TBD).
  Number collisions are REAL and need a coordinator ruling before live apply:
  030×2, 031×2, 032×3, 033×2, 034×2, 035×2, 036×2.
- **001–014:** last BUILD-LOG evidence (2026-10-12, DBA/BE entries) says these were delivered
  **files-only, NOT applied to any live DB**; a subagent could not query
  `schema_migrations` from the sandbox. Whoever runs the apply MUST run
  `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;`
  first and skip any file already listed. Status flips to ✅ only when the
  applier confirms via the DB.
- **015–016:** committed on `staging-build`, pending Mehedi's dashboard apply.
- **017–025:** reserved for Platform Team 1 Backend (017–023) + Security (024–025).
  Numbering is provisional until files land.

## Dependency rules (enforced at apply time)
1. **017 before** any onboarding code that references `profiles`.
2. **018 before 023** — `granted_by` must exist before `expires_at` logic builds on it.
3. **021 before** any RPC that writes events.
4. **016 after 015** — requires `invites.invited_by_user_id` + `graduate_child_access()` from 015.
5. Each migration must be **re-runnable** without error: `IF NOT EXISTS` on
   CREATE TABLE, `DROP POLICY IF EXISTS` before CREATE POLICY (Postgres has no
   CREATE POLICY IF NOT EXISTS), `DROP TRIGGER IF EXISTS` before CREATE TRIGGER,
   `CREATE OR REPLACE` on functions. CI check: `supabase/migrations/check.sh`.

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
