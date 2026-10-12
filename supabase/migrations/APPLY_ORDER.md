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
| 022 | `022_*.sql` | TBD (Backend — not landed yet) | ❌ File not yet on branch |
| 023 | `023_*.sql` | TBD incl. expires_at column (Backend — must land AFTER 018; Squad 4 W12 depends on expires_at) | ❌ File not yet on branch |
| 024 | `024_*.sql` | TBD (Security — not landed yet) | ❌ File not yet on branch |
| 025 | `025_*.sql` | TBD (Security — not landed yet) | ❌ File not yet on branch |

### Status notes
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
Multiple teams have claimed overlapping ranges: Squad 1 Tech Lead owns 022–029
(`trusted_adults`, crisis tables), Squad 2 Tech Lead drafted 022–027
(health_tier enum — DRAFT, explicitly not for apply). Platform Team 1 Backend
reserves 017–023 here. **Coordinators: renumber Squad 1 to 026+ and Squad 2
health amendments to stay DRAFT or take 030+ before any of these apply.**
