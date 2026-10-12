# Under-13 Technical Ban — Verification Checklist

**Track:** Fractional Team 1 — Compliance (Security Engineer input)
**Branch:** `staging-build` · **Date:** 2026-10-12
**Requirement source:** `docs/solutions/sol-legal.md` §1.1.4, NFR-PRIVACY-003 (FR-AGE-001)

> **Scope note (engineering, not legal):** This checklist verifies that the under-13 ban is
> enforced by *code*, not policy. COPPA conclusions belong to counsel. Statuses marked
> VERIFIED come from reading the repo on this branch; UNKNOWN means DB/staging access or a
> feature build is needed to confirm.

**Authoritative age primitive:** `public.child_age_tier(uuid)` (`supabase/migrations/018_access_authority.sql`,
lines 121–156) computes the tier server-side from `children.date_of_birth`:
`'under13' | 't13_15' | 't16_17' | 'adult' | 'unknown'` (NULL DOB → `'unknown'`, fails closed).

---

## 🔴 BLOCKERS found during this audit (read first)

### 🔴 CRITICAL-1 — `consume_invite()` has NO server-side age gate
- **Where:** `supabase/migrations/001_tenancy_core.sql` — `consume_invite(p_token)`, lines ~488–575.
- **What:** When an invite has `role='child'`, the RPC inserts a `child_access` row with
  `role='child'` for the caller **without checking `child_age_tier()`**. It checks email
  ownership, duplicate provisioning, and role conflicts — but never age.
- **Consequence:** A parent can set an under-13 DOB on a `children` row (via `updateChild`
  PATCH, which has no server-side age validation) and invite the child's email; the
  under-13 child then gets an **auth session linked to an under-13 identity** — exactly
  what §1.1.4 ("session tokens never minted for an under-13 principal") forbids.
- **Contrast:** `redeem_link_code()` (`019_link_codes.sql` lines ~176–184) *does* raise
  `under13_link_forbidden` / `age_verification_required`. The two linking paths are
  inconsistent; the email path is the hole.
- **Required fix (docs only — do not implement here):** `consume_invite()` must call
  `public.child_age_tier()` when `v_invite.role='child'` and raise on `'under13'`/`'unknown'`
  before inserting the `child_access` row.
- **Status:** 🔴 VERIFIED PRESENT (gap).

### 🔴 CRITICAL-2 — Migration 021 (the `access_events` table) is missing from the branch
- **Where:** `supabase/migrations/APPLY_ORDER.md` line 32 lists `021` as
  "❌ File not yet on branch"; migrations 018, 019, 020, 022 all reference
  `public.access_events` / call `public.log_access_event(...)`, which is defined nowhere
  in the repo.
- **Consequence:** A fresh-DB apply of 018+ fails (`log_access_event` undefined) or — if
  021 was hand-applied out of band — the append-only audit trail (FR-ACCESS-009) is
  **unverifiable in code review**. Every grant/revoke/cooling-off/link-code event the
  panel requires to be logged cannot be proven to land anywhere.
- **Required fix:** land `021_*.sql` with the `access_events` table, RLS, and
  `log_access_event()`; re-verify this checklist afterward.
- **Status:** 🔴 VERIFIED MISSING.

---

## Checklist

### 1. Server-side DOB gate on child-profile creation
- [ ] **Check:** `public.create_child()` in `supabase/migrations/001_tenancy_core.sql`
      (lines ~589–660). Confirm it accepts a DOB parameter, computes
      `child_age_tier()` at write time, and **rejects** (raises) on `'under13'`.
- **Expected:** `RAISE EXCEPTION 'under13_creation_forbidden'` for any birthdate making
  the child under 13 at insert time; client-supplied age is never read.
- **Current status:** ❌ FAIL — `create_child()` has **no DOB parameter at all**
  (`p_first_name/last_name/nickname/slug/school_name/grade_level/timezone` only).
  DOB is set later via `updateChild()` → `.from('children').update()` →
  `children_parent_write` policy (FOR ALL) with **zero server-side age validation**
  (`src/server/services/children.ts`). There is currently no enforceable point where a
  server-side gate on creation could even run, because the DOB arrives on a separate,
  unvalidated PATCH.
- **Hardening needed:** make DOB a required `p_date_of_birth` param of `create_child()`,
  fail closed on NULL, and gate `'under13'` → parent-managed-profile-only path
  (no `child_access` row ever minted for that child — see item 2).

### 2. No auth session issuable for an under-13 identity
- [ ] **Check:** link every path that inserts `child_access.role='child'` and confirm
      each calls `child_age_tier()` server-side before the insert:
  - `redeem_link_code()` — 019 — ✅ VERIFIED: raises `under13_link_forbidden` /
    `age_verification_required`.
  - `consume_invite()` — 001 — ❌ VERIFIED GAP (CRITICAL-1 above).
  - Any future path (OAuth linking, claim dedupe accept) — must inherit the same gate;
    grep `role='child'` INSERTs across migrations on each release.
- [ ] **Check:** `public.profiles` row for a teen (`017_profiles.sql`) — `legal_status`
      (`adult|minor|emancipated`) and `dob_verified` exist; confirm the signup flow sets
      `dob_verified=true` only from a verified source (currently UNKNOWN — no signup UI
      ships on this branch; the gate is a schema stub).
- [ ] **Check:** Supabase Auth config (dashboard, not in repo) — self-signup settings,
      and confirm no trigger/RPC mints a session for a `user_id` tied via
      `child_access` to a `children` row with tier `'under13'`.
- **Expected:** no `child_access` row with `role='child'` can exist for a
  `tier='under13'` child; under-13 `children` rows carry parent-linked access only.
- **Current status:** ❌ FAIL (CRITICAL-1).

### 3. Link codes / invites cannot target under-13 profiles
- [ ] **Check:** `generate_link_code(p_child_id)` in `019_link_codes.sql` — confirm a
      server-side `child_age_tier()` check that **refuses generation** for `'under13'`
      and `'unknown'`.
- **Expected:** raise `under13_link_forbidden` at generation, not just redemption
  (defense in depth; a generated-but-unredeemable code is a social-engineering prop).
- **Current status:** ❌ FAIL — generation performs **no age check**; only
  `redeem_link_code()` rejects. A parent can generate a valid 15-minute code for an
  under-13 child; the teen sees a working code that fails at the last step.
- [ ] **Check:** `redeem_link_code()` age gate — ✅ VERIFIED PRESENT (lines ~176–184).
- [ ] **Check (brute force):** `019` documents "lockout at 5" via `attempt_count`.
  **Finding:** `attempt_count` is incremented **only on a hash match**
  (`019` lines ~163–168: the `UPDATE ... SET attempt_count = attempt_count + 1` runs
  after the `crypt(p_code, code_hash)` select succeeds). Failed guesses match nothing
  and increment nothing, so **the documented lockout never fires for wrong guesses**.
  The `IF v_code.attempt_count >= 5` check is dead code for attackers. NFR-SEC-005 is
  therefore not satisfied by this migration. Required: per-code wrong-attempt counting
  (requires identifying the target code row without the hash — e.g., rate-limit by
  `(child_id, source IP)` in the API layer) or an application-level rate limiter in
  front of the redeem RPC. **Status:** ❌ FAIL — finding, needs code change.
- [ ] **Check:** invites table token storage — ❌ FAIL — `invites.token` in
  `001_tenancy_core.sql` is `encode(gen_random_bytes(24),'hex')` stored **in plaintext**
  (192 bits, good entropy; bad storage). Spec §9 requires salted-hash storage. Anyone
  with DB read access (backup, replica, support SQL) can redeem any invite. Compare:
  `link_codes.code_hash` is bcrypt via pgcrypto — the invites table should match that
  pattern.
- [ ] **Check:** `/verify-invite` pre-auth surface — ✅ VERIFIED: `get_invite_preview()`
      (016) returns only validity + the *inviting adult's* display name/email; zero child
      PII pre-auth; identical error shapes per spec §9.

### 4. No typable/free-text input in any under-13 context
- [ ] **Check:** enumerate all `<input>`, `<textarea>`, contentEditable surfaces and
      confirm none are reachable when the viewed child has `tier='under13'`. Grep
      `src/components` and `src/app/c` for free-text fields (check-in, mood, chat).
- **Expected:** check-in/mood/chat render parent-facing only for under-13; the child
  has no login (item 2) so no surface should exist, but confirm no "parent enters for
  child" free-text field is attributed *to the child* (COPPA "from the child"
  collection concern).
- **Current status:** UNKNOWN — no check-in/mood/chat UI ships on this branch yet
  (W8 Wellbeing, S2 support chat are seedlings in `src/lib/modules.ts`). Gate the
  feature launch on this check. (The panel's §1.1.4 item 4 is a build-time gate, not a
  current-code bug.)

### 5. No persistent identifiers set for under-13
- [ ] **Check:** enumerate everything the app sets: cookies (Supabase auth cookies via
      `src/lib/supabase/middleware.ts`), `localStorage` keys, device IDs.
- **What the app sets today (repo-verified):**
  - Supabase auth cookies — scoped to the *logged-in principal* (parent). ✅ Scoped
    correctly **iff** item 2 holds (no under-13 principal ever gets a session).
  - `localStorage`: `pookie-theme`, `menu-access` recents (`src/lib/menu-access.ts`),
    `pookie-nudge` seen-map, **`pookie.viewer.age`** (`src/lib/use-viewer-profile.ts`).
- **Finding:** `pookie.viewer.age` is a **client-settable age value read from
  localStorage** (with `Number.parseInt` validation). The file's own comment states it
  drives *menu presentation only* and "the API layer enforces real access server-side"
  — which is the correct architecture. **Check required:** on every release, verify no
  server route or RPC reads `pookie.viewer.age` or any client-supplied age for an
  access decision. Server-side decisions must use `child_age_tier()` only. Status: 🟡
  ACCEPTABLE AS UI-ONLY — verify it stays UI-only.
- **Expected:** no cookie/localStorage/device identifier is ever written in an
  under-13-attributed context; analytics disabled for under-13 profile views
  (no analytics SDK found in `src` — ✅ currently clean).
- **Current status:** ✅ PASS on scoping, conditional on item 2; item to re-verify per
  release.

### 6. RLS policies — no non-parent session can read/write under-13-linked rows
- [ ] **Check these policies** in `supabase/migrations/` (verify with
      `SELECT * FROM pg_policies WHERE schemaname='public'` on staging):
  - `children_tenant_read` / `children_parent_write` (001, lines 760–770): read = tenant
    member; write = parent-role member of that child. ✅ Correct shape; **but** it
    allows a parent to set an under-13 DOB via `updateChild` — the policy is fine, the
    missing piece is the server-side age *validation* on the write path (item 1).
  - `child_access_member_read` / `child_access_parent_insert` (001): ✅ correct shape.
  - `link_codes_parent_read` (019): parent members see **metadata including
    `code_hash`** — bcrypt hashes of 6-digit codes. 🟡 Note: 6-digit space is
    brute-forceable offline if a hash leaks to a non-parent; confirm the SELECT policy
    truly restricts to parent members and that service-role logs don't export this
    table. Bcrypt cost (`bf`,10) buys time but 10^6 candidates is a small space —
    consider withholding `code_hash` from the SELECT policy (metadata minus hash).
  - `audit_log_tenant_read` (004): tenant members read; NULL-child system rows
    service_role-only. ✅ Append-only enforced (no UPDATE/DELETE policies or grants).
    Plus the `audit_log_detail_secret_guard` trigger rejecting secret-shaped top-level
    keys — ✅ VERIFIED, good defense-in-depth for credential leakage into logs.
  - `access_events` policies: ❌ **UNVERIFIABLE** — table doesn't exist on branch
    (CRITICAL-2). Required shape when 021 lands: SELECT by teen + parents of that
    child only, never by revoked parties; INSERT via `log_access_event()` definer only;
    no UPDATE/DELETE for anyone (append-only), mirroring `audit_log`.
  - Per-module tables (002, 006–012, 022–024): spot-check that each SELECT/USING arm
    gates on `current_child_ids()` or `child_access` membership — and that none
    permit a **child-role** session to read a sibling's rows. The
    `child_access_one_child_per_child_user` partial unique index (001) structurally
    limits a child login to one child, which bounds sibling leakage at the identity
    layer. **Status:** PARTIAL — needs the per-table sweep before Phase 0 sign-off.
- **Expected:** no policy arm admits `auth.uid()` of a non-member or a child-role
  user into another child's rows.
- **Current status:** 🟡 PARTIAL — core policies verified; `access_events` missing;
  module-table sweep outstanding.

### 7. Sibling-data leakage through parent-visible aggregates
- [ ] **Check:** household dashboards, "Tonight's plan", briefing/digest generators —
      confirm every aggregate is computed **per-child with per-scope filtering
      server-side** (NFR-PRIVACY-004, FR-ACCESS-006) and that an under-13 child's data
      never appears in a shared/household view visible to a non-parent (e.g., a teen
      sibling's view, a sitter's temporary grant).
- [ ] **Note:** W10 (Fairness) was **removed** from the module registry
      (`src/lib/modules.ts` header comment, 2026-10-12) — the highest-risk
      cross-child comparison surface is gone. ✅
- [ ] **Check:** temporary grants (FR-ACCESS-011) — RPC must reject Reflection /
      Wellness / H2 / H3 / full-communications scopes; verify the scope allowlist is
      enforced in the RPC, not just the scope picker UI.
- **Expected:** under-13 rows are parent-visible only; aggregates never cross the
  parent boundary.
- **Current status:** UNKNOWN — briefing/digest surfaces are not built on this branch
  (no aggregation code found in `src/server` beyond per-class school services).
  Gate each aggregation feature on a per-release sibling-leakage review.

### 8. CI/release gate — retention-schedule completeness
- [ ] **Proposal:** add a CI job (`.github/workflows/ci.yml`) that fails the build if
      any table in `supabase/migrations/` lacks a corresponding row in the
      per-source retention schedule (maintained by the Compliance Reviewer —
      tie to the G6 schedule table in `sol-legal.md` §1a).
- **Implementation sketch (docs only):**
  1. Keep a machine-readable schedule: `docs/compliance/retention-schedule.json`
     with one row per source: `source | table(s) | data class | retention period |
     deletion method | purge cadence | owner`. **No row may say `indefinite`/`TBD`.**
  2. CI script parses `CREATE TABLE` names from `supabase/migrations/*.sql` and
     asserts every table maps to ≥1 schedule row (allowlist for pure-config tables
     like `mail_ocr_providers` with a documented justification).
  3. The `check.sh` migration-idempotency script already runs in CI — extend the same
     job; keep the gate in one place.
- [ ] **Check:** `312.10` hard rule — any schedule row with `retention=indefinite`
      fails policy review and blocks that source's launch (policy axiom from §1a).
- **Current status:** 🟡 PROPOSAL — `check.sh` exists for idempotency; the
  retention-completeness gate is not yet built. Note: today **CI has no
  secret-scanning step** either (`.github/workflows/ci.yml` runs lint/typecheck/build
  only) — NFR-SEC-002 ("no secrets in repo/bundle, verified in CI") is currently
  unverifiable. Add gitleaks/trufflehog to the same CI job when adding this gate.

---

## Verdict summary

| # | Item | Status |
|---|------|--------|
| 1 | Server-side DOB gate at child creation | ❌ FAIL — no DOB param on `create_child()`; unvalidated PATCH path |
| 2 | No auth session for under-13 identity | ❌ FAIL — 🔴 CRITICAL-1 (`consume_invite` gap) |
| 3 | Link codes/invites vs under-13 | 🟡 MIXED — redeem gate ✅; generation gate ❌; lockout ineffective ❌; invite tokens plaintext ❌ |
| 4 | No free-text input in under-13 context | UNKNOWN — surfaces not built; gate the feature |
| 5 | No persistent identifiers for under-13 | ✅ PASS (conditional on #2) |
| 6 | RLS: no non-parent access to under-13 rows | 🟡 PARTIAL — core ✅; `access_events` missing (🔴 CRITICAL-2); module sweep outstanding |
| 7 | Sibling-data leakage | UNKNOWN — aggregates not built; W10 removal ✅ |
| 8 | CI retention gate | 🟡 PROPOSAL — not built; CI also lacks secret scanning |

**Phase 0 gate decision: NOT READY.** The under-13 ban is not yet technical. Minimum to
clear the gate: fix CRITICAL-1 (`consume_invite` age gate), land migration 021, add the
DOB parameter + gate to `create_child()`, and add the age check to
`generate_link_code()`. The invite-token hashing and link-code lockout fixes should ride
in the same change set.
