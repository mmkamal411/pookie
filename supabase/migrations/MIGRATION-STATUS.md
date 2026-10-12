# Pookie Migration Status — Squad 3 Data-Layer Sweep (2026-10-12)

Single-page status for the founder's dashboard apply session. The full
apply-order manifest is `APPLY_ORDER.md` (same directory). **Nothing here has
been applied to any live DB** — files only, per task rules. No deploys.

## New migrations (this sweep)

| # | File | What | Verified |
|---|------|------|----------|
| 054 | `054_invite_preview_pii_fix.sql` | CRITICAL-1: `get_invite_preview()` returns valid/expired/used/inviter only (DROP+CREATE — return shape changes, OR REPLACE would fail). NEW `get_invite_detail()` — authenticated-only post-auth enrichment, email-ownership gated. | pglast parse OK; check.sh clean; deps 001/014/015 traced |
| 055 | `055_consume_invite_age_gate.sql` | CRITICAL-2: age-gated `consume_invite()` (strict superset of 001's — all behaviors preserved), `dob_under13()`, `children_dob_guard()` BEFORE trigger. Coexists with 027's AFTER sever trigger. | pglast parse OK; check.sh clean; 001-vs-staged behavior diff done; deps 001/004/014/018 traced |
| 056 | `056_transaction_notes.sql` | `transaction_notes` table — `src/server/services/plaid.ts:303` reads it, no migration ever created it. Owner-scoped RLS, unique (owner, plaid_transaction_id). | pglast parse OK; check.sh clean; app read path traced |
| 057 | `057_faq_seed.sql` | Squad 5's 23 reviewed FAQ articles into 046's `faq_articles` (ON CONFLICT DO UPDATE). All CHECK values (age_band, legal_basis, status) validated against 046. | pglast parse OK; column/value cross-check done |
| 058 | `058_go_independent.sql` | `go_independent()` teen flow from staged `01_grant_revoke.sql` (only piece of that file never migrated), adapted to 051's canonical 8-arg `log_access_event`; `child_access_expiry_sweep_idx` for 030's `expire_timeboxed_grants()`. | pglast parse OK; check.sh clean; `child_age_tier` tiers + status CHECK + event CHECK cross-checked |

Concurrent (Squad 1 "auth ignition", same session — reviewed, not double-built):
- `052_provision_onboarding_child.sql` — promotes the standalone onboarding RPC
  into the chain (standalone file deleted). **Fixed its REQUIRES comment:**
  the INSERT writes 018's `granted_by`/`granted_by_user_id`, so 018 must apply first.
- `053_create_child_dob.sql` — `create_child()` gains trailing `p_date_of_birth`
  (DROP+CREATE the 7-arg overload — OR REPLACE cannot change a signature).

Comment-only fixes: `049_second_parent_claim.sql` header said "Migration 031" → "049".

## What needs live DB apply (ordered)

1. Check `supabase_migrations.schema_migrations` first; skip anything listed.
2. Apply 001→058 in filename order (duplicates apply alphabetically — rule 5).
3. Hard ordering: 015→016; 017→(onboarding); 018→023 and 018→052; 021→(event writers);
   048→049; 051→058.
4. **054 is BLOCKED on a frontend change**: `src/app/verify-invite/page.tsx`
   reads `preview.child_id/invite_email/child_first_name/child_nickname` from
   `get_invite_preview()` — those fields disappear with 054. The page must
   switch its authenticated branch to `get_invite_detail()` first (Squad 1).
5. **051 breaks 6-arg `log_access_event` callers**: 023, 024,
   `030_sud_separation`, 034 call the old 7-param form positionally and fail
   at runtime after 051 drops it — those squads must move to the canonical
   8-arg form before the apply session. `031_safety_pending_revokes` passes
   `jsonb` as the 8th arg (text param) in 4 calls — same fix needed (Squad 1).
6. `provision_onboarding_child` (052) may already be live — a browser task
   applied the standalone file via dashboard on 2026-10-12. 052 is
   idempotent (CREATE OR REPLACE); re-applying is a safe no-op. Confirm via
   the DB either way.

## Gaps found (file:line evidence)

1. **FIXED — `provision_onboarding_child` never migrated** (tonight's outage):
   `src/lib/onboarding/provision_onboarding_child.sql` existed standalone → now
   `052` (Squad 1, reviewed).
2. **FIXED — `transaction_notes` table missing**: `src/server/services/plaid.ts:303`
   reads it; zero CREATE in the chain → `056`.
3. **FIXED — staged CRITICAL-1/2 compliance fixes never folded**:
   `supabase/functions/staged-compliance-fixes/01_*.sql` → `054`;
   `02_*.sql` → `055`. (Note: 054's DROP is required — the staged file's bare
   CREATE OR REPLACE would fail live with "cannot change return type".)
4. **FIXED — `go_independent()` never migrated**: staged `01_grant_revoke.sql:508`
   → `058` (adapted to 051's canonical event signature).
5. **FIXED — `child_access_expiry_sweep_idx` never created**: staged
   `05_timeboxed.sql` calls for it; 030's `expire_timeboxed_grants()` sweeps
   without it → added in `058`. (030's sweeper itself covers staged 05's
   `apply_expired_grants` — no gap.)
6. **FIXED — FAQ seed never migrated**: `docs/squads/squad5/work/faq_seed.sql`
   (23 articles) → `057`.
7. **RESOLVED (Squad 1, same session) — `create_child()` "Just me" dead-end (4a)**:
   053 keeps `parent_membership_required` and routes zero-membership users to
   052's onboarding RPC. Squad 1 closed the product loop with `/add-child`
   reusing `createChildProfile` → 052 RPC (commit `2d12d2a`), and wired DOB
   through `services/children.ts:100` (`p_date_of_birth` — matches 053's param
   name; verified). No SQL action remaining.
8. **OPEN — staged `04_emergency_access.sql` (emergency_grants + 3 RPCs)**:
   never folded; 036 shipped a *different* break-glass model
   (`emergency_requests`). Fold or declare superseded — needs MD/Safety decision
   (counsel-gated surface; not folded unilaterally).
9. **OPEN — 031 `log_access_event` jsonb-as-8th-arg** (4 calls,
   `031_safety_pending_revokes.sql:271,289,405,491`): `p_ip_hash` is text —
   runtime type error. Squad 1 must fix (NULL, NULL + audit_event detail).
10. **OPEN — 051 vs 6-arg callers** (023, 024, `030_sud_separation`, 034):
    runtime "function does not exist" after 051 applies. Owning squads must adapt.
11. **PRE-EXISTING — `check.sh` fails on `002_school_systems.sql`** (13 policies
    not preceded by DROP POLICY IF EXISTS). Historical file — left untouched.

## Founder decisions needed

- D1: fold or drop staged `04_emergency_access.sql` (gap 8)?
- D2: "Just me" skipper adding first child post-onboarding — route to 052's RPC
  or relax `create_child()`'s gate (gap 7)?
- D3: confirm apply-session order of operations for 054 (frontend first) and
  051 (caller fixes first) — gaps 4, 5, 9, 10.
- D4: number-collision ruling still open (030×2, 031×2, 032×3, 033×3, 034×2,
  035×2, 036×2, 049×2) — documented as filename-order in APPLY_ORDER.md rule 5;
  no renumbering per applied-history safety.
