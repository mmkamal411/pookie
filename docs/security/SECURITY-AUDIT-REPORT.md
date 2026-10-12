# Pookie Security Audit Report — Fractional Team 2 (Security Engineer)

**Auditor:** Security Engineer, Fractional Team 2 · **Coordinator:** parent orchestrator
**Date:** 2026-10-12 · **Branch:** `staging-build` · **Scope snapshot:** migrations 001–016 fully audited (47 tables, 114 CREATE POLICY statements); migrations 017–050 reviewed for blocking/critical issues as landed.
**Method:** static code + SQL review per NFR-SEC-001…008 and Mehedi's test protocol (auth-bypass attempts, attack chains, SAST; no live DB — staging has no test tenant and apply-state of 001–014 is unverified, see §6).

> **Environment note:** the migration tree grew from 16 to ~59 files *during* this audit (Platform Team 1 + squads landing concurrently, renumbering up to 050). Table/policy counts below are frozen at the 001–016 scope per the task; §1.2 lists what 017+ adds and the critical defects found there. A re-run is required after the tree stabilizes.

---

## Executive summary

| Metric | Count |
|---|---|
| Tables audited (001–016) | **47** |
| CREATE POLICY statements checked (001–016) | **114** |
| Tables with RLS enabled | 47/47 (100%) |
| Overly-broad `USING (true)` on user-data tables | 0 (all 8 occurrences are intentional public registries) |
| Storage buckets | 4 (`mail-photos`, `test-score-reports`, `nutrition-photos`, immunization-reports) — all private, RLS-gated |
| API routes enumerated | 57 (`src/app/api/**`) |
| Findings | 🔴 **4 Critical** · 🟠 **8 High** · 🟡 **6 Medium** · 🟢 **5 Low** |

**Bottom line:** the 001–016 tenancy core is well-architected (deny-by-default funnel through `current_child_ids()`, column-level grants, SECURITY DEFINER RPCs with pinned `search_path`). **But the access-authority layer (017+) cannot be applied as-is:** the `current_child_ids()` status filter lives only in a truncated file, the `log_access_event()` signature doesn't match its callers, and the legacy `revoke_child_access()` bypasses the granted_by matrix. **Do not apply migrations 017+ or ship access-control UI until SEC-C1…C3 are resolved.** The 4 criticals are also appended to `docs/BUILD-LOG.md` and block the owning teams' phases.

---

## §1 — RLS per-table audit matrix (migrations 001–016)

Verdict key: **PASS** = policy set matches the access-authority matrix, fail-closed, least-privilege grants. **GAP** = weakness that is not directly exploitable through the shipped routes but violates defense-in-depth or a locked spec. **FAIL** = exploitable misconfiguration.

| # | Table | RLS | Policies (effective) | Verdict | Finding details |
|---|---|---|---|---|---|
| 1 | `users` | ✅ | 2 (`users_self_read`, `users_self_update`) | PASS | Self-read; parents read co-member rows (family directory, by design). UPDATE restricted to `display_name` by **column GRANT** (not just policy) — `role`/`email` can never be client-rewritten even if a future policy is sloppy. No anon grants. |
| 2 | `children` | ✅ | 2 (`children_tenant_read`, `children_parent_write`) | PASS | Read iff `id = ANY(current_child_ids())`; write requires parent-role membership. No client INSERT grant — `create_child()` RPC is the only path. `parent_user_id` excluded from the UPDATE column grant (billing anchor never client-writable). |
| 3 | `child_access` | ✅ | 2 (`child_access_member_read`, `child_access_parent_insert`) | GAP→FAIL* | *FAIL via SEC-C3: the 001 `revoke_child_access()` RPC (still EXECUTE-granted) DELETEs rows without checking `granted_by` — bypasses the §3 matrix. No UPDATE/DELETE policies or grants (good). INSERT policy doesn't constrain the inserted `role`/`user_id` (SEC-M2). `granted_by` itself lands in 018 — absent in the 001–016 scope. |
| 4 | `invites` | ✅ | 4 (`invites_parent_read`, `invites_parent_insert`, `invites_parent_update`, `invites_sender_read` via 015) | PASS | Round-1 escalation fixed: child-role users cannot mint invites; NULL-child (new-family) invites are service_role-only. 015 adds sender attribution via trigger (caller cannot spoof `invited_by_user_id`) + 7-day TTL clamp for child invites + defense-in-depth membership re-assert. No DELETE policy/grant (ledger-like). |
| 5 | `access_requests` | ✅ | 4 (`access_requests_read`, `access_requests_requester_insert`, `access_requests_parent_update`, requester_id arm via 020) | PASS | Requester identified by email/user-id match; parents update `status` only via column grant (`child_id`/`requester_email` never client-rewritable). Partial unique index blocks duplicate pendings. |
| 6 | `agent_tenant_scope` | ✅ | 0 (intentional) | PASS | RLS enabled, **zero policies = deny-all**, documented. Reads only via SECURITY DEFINER helpers; writes service_role-only. Matches the agent JWT contract (`role='agent_reader'` + `job_id` claim). |
| 7 | `audit_log` | ✅ | 1 (`audit_log_tenant_read`) | PASS | Members read own tenant's log only (`child_id IS NULL` arm removed — system rows are service_role-only). No UPDATE/DELETE policies **and** no grants (append-only enforced twice). `audit_event()` is authorized (membership assert; service_role must carry explicit child_id) with a secret-key denylist trigger on `detail` (R2-3). Users cannot DELETE their own audit rows. |
| 8 | `consents` | ✅ | 2 (`consents_tenant_read`, `consents_parent_insert`) | PASS | Append-only; `granted_by = auth.uid()` enforced in WITH CHECK (no forged attribution); non-empty scope CHECK. |
| 9 | `child_portals` | ✅ | 1 (`child_portals_parent_select`) | PASS | SELECT-only, family-scoped; NULL-child rows visible only to parents sharing a child with the row owner. `vault_secret_id` granted to **no** client role; secret-less `security_invoker` view for clients. All writes via SECURITY DEFINER RPCs (`set_tenant_secret` parent-only; `get_tenant_secret` service_role-only; `remove_tenant_secret` deletes the vault secret = erasure). |
| 10 | `school_systems` | ✅ | 1 (`school_systems_read`, `USING (true)`) | PASS | Intentional public registry (anon read, no client write — adapter config ships as migrations). |
| 11 | `classes` | ✅ | 4 (read + parent insert/update/delete) | PASS | Tenant read; parent-role writes. Write policies gate on `ca.role='parent'`. |
| 12 | `bell_schedules` | ✅ | 4 | PASS | Same pattern as `classes`. |
| 13 | `child_settings` | ✅ | 4 | PASS | Same pattern as `classes`. |
| 14 | `grades` | ✅ | 1 (`grades_tenant_read`) | PASS | Tenant read only; **no client write policies** — sync pipeline via service_role. Verified trace: `GET /api/v1/children/[childId]/school/overview` → `assertTenant()` → `current_child_ids()`; a parent without membership gets 403. Letters never stored (numeric only). |
| 15 | `grade_snapshots` | ✅ | 1 | PASS | Same as `grades`. |
| 16 | `assignments` | ✅ | 4 (read + parent insert/update/delete) | PASS | Parents manage manual rows; sync upserts via service_role. |
| 17 | `study_plans` | ✅ | 4 (read + parent insert/update/delete) | PASS | Child-role callers see only `safety_status='approved'` rows (fail-closed; unreviewed committee output never renders). Agent readers take the NOT EXISTS arm via `safe_auth_uid()` (014 fix). |
| 18 | `teacher_messages` | ✅ | 3 (read + parent insert/update) | PASS | Parent-role writes; draft→approved→sent transitions additionally gated in the service layer (`requireParentRole`) — see §4. |
| 19 | `checkins` | ✅ | 3 | GAP (remediated) | In the 001–016 scope, `checkins_tenant_read` let **any tenant member (incl. parents) SELECT raw teen text** via PostgREST — privacy was route-only. **Remediated by `050_checkins_teen_privacy_fix.sql`** (teen-only RLS + `checkin_daily_summary()` aggregates RPC for parents). Recorded as SEC-M6 (fixed). |
| 20 | `shopping_lists` | ✅ | 2 (household read + owner write) | PASS | Household-anchored via `is_household_member()`; tenant key derived server-side, never client-supplied. |
| 21 | `shopping_items` | ✅ | 3 (household read/insert/update) | PASS | `added_by = auth.uid()` on INSERT; no DELETE policy/grant (status='removed' ledger pattern). |
| 22 | `shopping_price_reports` | ✅ | 2 | PASS | Append-only (no UPDATE/DELETE). |
| 23 | `mail_items` | ✅ | 3 (parent read/insert/update) | PASS | Class-S: `is_household_parent()` gate (children get zero rows), `data_class` labeling, `account_last4` only, photo in private `mail-photos` bucket, `external_ocr_consent` gate, no client DELETE, audited reads. |
| 24 | `mail_action_items` | ✅ | 3 | PASS | Same Class-S pattern. |
| 25 | `mail_dispute_drafts` | ✅ | 3 | PASS | `dispute_approval_integrity` CHECK — approved/sent impossible without frozen `approved_text` + `approved_by`. |
| 26 | `mail_ocr_providers` | ✅ | 1 (`USING (true)`) | PASS | Intentional public registry; no client writes. |
| 27 | `colleges` | ✅ | 1 (`USING (true)`) | PASS | Public facts registry (50-seed, no stats). |
| 28 | `college_stats` | ✅ | 1 (`USING (true)`) | PASS | Public registry; honesty rules (`as_of` + `source` NOT NULL). |
| 29 | `requirement_templates` | ✅ | 1 (`USING (true)`) | PASS | Public registry. |
| 30 | `college_aid_programs` | ✅ | 1 (`USING (true)`) | PASS | Public registry; dated/cited terms. |
| 31 | `college_list` | ✅ | 2 | PASS | Tenant-scoped read/write. |
| 32 | `deadlines` | ✅ | 2 | PASS | Tenant-scoped read/write. |
| 33 | `essays` | ✅ | 2 | PASS | Tenant-scoped read/write. |
| 34 | `recommenders` | ✅ | 2 | PASS | Tenant-scoped read/write. |
| 35 | `test_scores` | ✅ | 2 | PASS | Tenant-scoped; report PDFs in private `test-score-reports` bucket (tenant-scoped storage policies). |
| 36 | `transcript_releases` | ✅ | 2 | PASS | `release_authorization_integrity` CHECK mirrors the dispute bright line; 18+ authority flip via `release_authority_for()` (unknown DOB fails closed to parent). |
| 37 | `school_events` | ✅ | 2 | PASS | Tenant-scoped read/write. |
| 38 | `health_subjects` | ✅ | 4 | PASS | Tenant read; insert requires `owner_user_id = auth.uid()`; `owner_user_id` carries zero auth semantics (documented). |
| 39 | `metric_defs` | ✅ | 1 (`USING (true)`) | PASS | Intentional authenticated-read registry (amended 011: `health_tier` replaces `default_sensitivity`). |
| 40 | `health_metrics` | ✅ | 4 (privacy read + tenant insert/update) | PASS | SELECT through `health_metric_visible()` (deny-by-default; teen-sensitive metrics visible to parents only with an active, unexpired, unappealed safety override or explicit grant; unknown DOB fails closed). No DELETE grant. Amended 011 + 022 move this to `health_tier_visible()` (H0–H3). |
| 41 | `health_safety_overrides` | ✅ | 3 (parent insert/read, creator update) | PASS | Parent-only insert, self-attributed; 20-char reason minimum; `teen_notified_at` NOT NULL; H2-only + ≤30-day expiry (amended 011/022); append-only (no DELETE). |
| 42 | `state_minor_consent_rules` | ✅ | 1 (`USING (true)`) | PASS | Authenticated-read; no client writes; `counsel_reviewed=false` default with explicit do-not-ship gate. |
| 43 | `food_logs` | ✅ | 5 (diary read + tenant insert/update/delete) | PASS | **Teen-diary predicate at the data layer**: parents of 13+ subjects get zero rows; parent path is the aggregates-only `nutrition_weekly_patterns()` RPC. Amended 012 adds a `<18 no-calories` backstop trigger. |
| 44 | `food_swaps` | ✅ | 1 (`USING (true)`) | PASS | Public reference data. |
| 45 | `nutrition_targets` | ✅ | 3 (tenant read + parent insert/update) | PASS | No DELETE (supersede via `active=false`); no deficit/weight-loss kind representable (by schema). |
| 46 | `sync_jobs` | ✅ | 0 (intentional) | PASS | RLS enabled, zero policies = deny-all; service_role-only via RPCs (`sync_request_job`, `sync_claim_job`, `sync_finish_job`, `sync_append_log`, `sync_heartbeat`), all REVOKE'd from PUBLIC. |
| 47 | `sync_heartbeats` | ✅ | 0 (intentional) | PASS | Same as `sync_jobs`. |

**Attacker queries tested (static, low-privilege JWT):**
- `GET /rest/v1/grades?child_id=eq.<foreign>` → denied: `child_id = ANY(current_child_ids())` fails closed (anon → `'{}'`).
- `GET /rest/v1/child_portals?vault_secret_id=...` → denied at grant level (column not granted) + RLS.
- `DELETE /rest/v1/audit_log?id=eq.<own>` → denied: no policy, no grant.
- `POST /rest/v1/child_access` with `(foreign_child, self, 'parent')` → denied: WITH CHECK requires existing parent membership on that child.
- `GET /rest/v1/invites?token=eq.<guess>` → denied by RLS (only parent members or the email-matched invitee); token is 192-bit CSPRNG (enumeration infeasible).
- Storage: `mail-photos`, `test-score-reports`, `nutrition-photos` are `public=false` with RLS policies scoping path segment 1 to the caller's tenant/household. No public buckets in tree.

### §1.2 — Migrations 017+ (snapshot; tree was churning during audit)

Tables they add (for extending this audit once the tree stabilizes): `profiles` (017), `child_access` columns `granted_by/granted_by_user_id/status/cooling_off_until/revoked_at/re_request_locked_until` + RPCs `grant_access/revoke_access/apply_cooling_off_revocations` (018), `link_codes` + `generate_link_code/redeem_link_code` (019), `access_requests` amendments + `request_access` (020), `access_reason_codes` + `access_events` + `log_access_event()` (021), health tier columns + `health_consent_grants` + `allergy_list` + `health_medications` (022), `health_corrections` + `health_device_tokens` + re-consent RPCs (023), `health_grace` + `health_retention_policies` (024), `access_scopes` + `resolve_visible_scopes()/has_scope()` (025), `vault_documents` (036), `checkin_daily_summary()` + teen-only checkins RLS (050), plus support/faq/wellbeing/immunizations/SUD/trusted-adults tables (026–049).

**Critical defects in 017+ are §2 findings SEC-C1…C4, SEC-H1…H7 below — do not apply 017+ until they are resolved.**

---

## §2 — Pen-test findings

### 🔴 SEC-C1 — `024_rls_foundation.sql` is truncated; revoked parents keep full data access
**File:** `supabase/migrations/024_rls_foundation.sql` (ends mid-function with the literal text `...[truncated 16210 chars]`; unbalanced `$$` — unappliable).
**Exploitability:** High. Migration 018 introduced soft-revoke (`child_access.status='revoked'` rows are *retained*, not deleted). The only `current_child_ids()` rewrite that filters `ca.status='active'` lives in this broken file. With it unapplied, `current_child_ids()` (001) returns revoked parents' child_ids, so **every tenant-scoped RLS policy still admits a revoked parent** — grades, mail, health, vault metadata, audit log. `getMemberships()` (src/lib/tenant/actions.ts) also lacks a status filter, so `sendChildInvite`'s parent check passes for revoked parents, and the 015 `invites_before_write` trigger (no status check in the landed version) lets them mint invites.
**Fix:** fold the staged replacement `~/workspace/pookie-security-staging/rls_foundation.sql` (parse-clean per BUILD-LOG 2026-10-12 ~04:20) into the renumbered sequence; add a status filter to `getMemberships()`; re-run `check.sh`. **Blocks: all of 017+.**

### 🔴 SEC-C2 — `log_access_event()` signature mismatch breaks every access-mutation RPC
**Files:** callers `018_access_authority.sql` (grant_access, revoke_access, apply_cooling_off_revocations), `019_link_codes.sql` (redeem_link_code), `020_access_requests.sql` (request_access) → callee `021_access_events.sql`.
Callers invoke 8 positional args `(child_id, actor, subject, event_type, granted_by, reason, NULL, NULL)`; 021 defines 7 params `(p_child_id, p_actor_user_id, p_event_type, p_subject_user_id, p_reason_code, p_metadata, p_amount_cents)` in a different order. At runtime: `function log_access_event(uuid,uuid,uuid,text,text,text,unknown,unknown) does not exist` → **every grant/revoke/link/redeem/request rolls back**. Fail-closed, but the entire access-control mutation path is non-functional.
**Fix:** reconcile on ONE signature (recommend 021's 7-param form; update 018/019/020 call sites), add an apply-order CI check that every `PERFORM public.<fn>(` resolves (e.g. `SELECT` from `pg_proc` with matching arg count in `check.sh`).

### 🔴 SEC-C3 — Legacy `revoke_child_access()` bypasses the granted_by matrix
**File:** `001_tenancy_core.sql` (function `revoke_child_access(uuid,uuid)`), still `GRANT EXECUTE TO authenticated`.
It DELETEs any `child_access` row (except the last parent) with only a parent-membership check — **no `granted_by` check**. A parent can therefore revoke a grant the *child* made, directly violating the locked rule "only the granter or the child can revoke; Parent A can never revoke a child-made grant to Parent B" (USER-FIRST-ACCESS-MODEL-SPEC §3). The new `revoke_access()` (018) enforces the matrix, but the old RPC remains a live bypass on the same table.
**Fix:** `REVOKE EXECUTE ON public.revoke_child_access(uuid,uuid) FROM authenticated` (or rewrite it to delegate to `revoke_access()`), in the same migration that lands 018.

### 🔴 SEC-C4 — Visibility scopes are defined but enforced nowhere
**Files:** `025_access_scopes.sql` (table `access_scopes`, `resolve_visible_scopes()`, `has_scope()`); `src/lib/api/scopes.ts` (`applyScopeFilter`/`withScope`).
**Exploitability:** High. **No RLS policy in the tree references `resolve_visible_scopes()`/`has_scope()`, and `applyScopeFilter`/`withScope` are imported by zero routes/services** (dead code). A parent holding a Performance-only grant (reflection/wellness denied) can still read reflection/wellness rows via direct PostgREST wherever a table-level predicate doesn't already stop them. NFR-SEC-007 ("every route enforces the access matrix + visibility scopes server-side") is not met at the data layer. (Teen-private tables with their own predicates — `food_logs`, `health_metrics`, `sud_records`, `checkins` post-050 — are covered; the gap is the general mechanism.)
**Fix:** wire `has_scope(auth.uid(), child_id, '<scope>')` into SELECT policies of scope-tagged tables (or enforce `applyScopeFilter` in `handleRoute` with services tagging rows via `withScope`), plus a negative test per scope.

### 🟠 SEC-H1 — `access_events_teen_select` references a nonexistent column
**File:** `021_access_events.sql`. Policy: `EXISTS (SELECT 1 FROM public.children c WHERE c.id = access_events.child_id AND c.user_id = auth.uid())` — **`children` has no `user_id` column** (it's `parent_user_id`). The policy errors on every SELECT. The spec'd "never shown to a revoked parent" rule is also not implemented (comment defers it to "a later security migration").
**Fix:** rewrite using `child_access` (teen arm: `role='child'`; viewer arm excluding `status='revoked'`).

### 🟠 SEC-H2 — 022 cannot apply: references a column the amended 011 removed
**Files:** `011_w22_health_tracker.sql` (amended: `metric_defs.default_sensitivity` **replaced** by `health_tier`) vs `022_health_tiers.sql` (`UPDATE public.metric_defs SET default_sensitivity = ...`; `INSERT ... (..., default_sensitivity, health_tier, ...)`). 022 fails at apply time. Separately, 022's `health_tier_visible()` queries `public.health_grace`, which only exists in `024_health_grace_and_deletion.sql` — hard apply-order dependency that must be encoded in APPLY_ORDER.md.
**Fix:** rewrite 022's backfill to use `health_tier` only; pin `024_health_grace_and_deletion` before 022.

### 🟠 SEC-H3 — `allergy_list_teen_update` has `WITH CHECK (TRUE)`
**File:** `022_health_tiers.sql`. Any parent/child member passing USING can UPDATE an allergy row to **any** `subject_id` (re-homing across subjects) and can **downgrade `health_tier` H2→H1**, silently widening teen-private allergy data to H1 visibility.
**Fix:** `WITH CHECK` must re-assert tenant scope, same-subject, and forbid tier downgrade (or stamp tier from `metric_defs` and exclude it from the updatable column set).

### 🟠 SEC-H4 — `health_corrections` SELECT leaks teen-private correction values
**File:** `023_health_reconsent.sql`. Policy `health_corrections_tenant_read` is plain `child_id = ANY(current_child_ids())`, but rows carry `old_value`/`new_value` **text of H2/H3 content** (e.g. corrected food-log descriptions, allergy names). The comment claims "the tier of the underlying row governs" — it doesn't; any tenant member (parent included) can read them.
**Fix:** gate SELECT through `health_tier_visible()` on the underlying row's tier, or restrict to the subject + auditors.

### 🟠 SEC-H5 — `rpc_export_transition_summary` references later-migration tables unguarded
**File:** `023_health_reconsent.sql`. The `immunizations` subquery is not guarded by `to_regclass()` (only `emergency_contacts` is). Until the immunizations table lands, the export RPC errors. Same class of issue: `nightly_health_birthday_cutover` and `health_tier_visible` reference `health_grace`/`access_events` from other migrations.
**Fix:** guard optional tables with `to_regclass()` or pin apply order; add a CI "undefined relation" check.

### 🟠 SEC-H6 — `access_scopes_select` teen arm references nonexistent `children.user_id`
**File:** `025_access_scopes.sql`: `EXISTS (SELECT 1 FROM public.children c WHERE c.id = access_scopes.child_id AND c.user_id = auth.uid())` — same broken-column pattern as SEC-H1 (should be the teen's `child_access` row).
**Fix:** `EXISTS (SELECT 1 FROM public.child_access ca WHERE ca.child_id = access_scopes.child_id AND ca.user_id = auth.uid() AND ca.role='child')`.

### 🟠 SEC-H7 — `grant_access()` bypasses the invite/email-verification flow
**File:** `018_access_authority.sql`. A parent caller can grant parent access to **any** `auth.users` id — no invite token, no email-ownership proof, no grantee consent. Conflicts with MD decision D5 ("second-parent → invite-only v1").
**Fix:** require a consumed invite or a pending `access_requests` approval as the grant precondition (or record an explicit founder exception).

### 🟠 SEC-H8 — Live DB state vs tree is unverified
`APPLY_ORDER.md` says 001–014 were "delivered files-only, NOT applied to any live DB", while `014_fix_safe_auth_uid.sql`'s header says 006–008 "were already applied to the live pookie project". Until someone runs `SELECT version FROM supabase_migrations.schema_migrations`, no audit conclusion can be tied to production.
**Fix:** applier runs the schema_migrations check first (per APPLY_ORDER.md procedure) and flips rows to ✅ only on DB confirmation.

### 🟡 SEC-M1 — Link-code brute-force lockout is ineffective
**File:** `019_link_codes.sql` (`redeem_link_code`). `attempt_count` is incremented **only after a hash match** — i.e., only attempts against the *correct* code count. Wrong guesses raise `code_invalid_or_expired` without incrementing anything, so an attacker gets unlimited guesses within the 15-minute TTL (NFR-SEC-005 not met in spirit).
**Fix:** increment the live code row's counter per redeem *attempt* (failed match → increment the single live row for the child), and/or add per-IP/device throttling; consider 8-digit codes.

### 🟡 SEC-M2 — `child_access_parent_insert` doesn't constrain the new row
**File:** `001_tenancy_core.sql`. WITH CHECK verifies the *caller's* parent membership but not the inserted row's `role`/`user_id` — a parent can INSERT `role='child'` rows for arbitrary users (mixed-role states; the partial unique index only stops a second child-row per user). Not cross-tenant (membership required), but violates "roles are assigned by server functions only" (spec §3).
**Fix:** add `AND child_access.role = 'parent'` … or better, route all grants through `grant_access()` and drop the direct INSERT policy.

### 🟡 SEC-M3 — W7 vault: single env key, no rotation
**Files:** `036_w7_vault.sql`, `src/server/services/vault.ts`. `VAULT_DOC_ENCRYPTION_KEY` is one symmetric key in env; **no rotation procedure** (rotating = re-encrypting every row, unscripted); the key is passed as an RPC argument (lands in PostgREST/pg logs). 003's Supabase-Vault path (AES-256-GCM, managed keys) is the stronger pattern.
**Fix:** document rotation runbook (dual-key re-encrypt), or migrate W7 docs into Supabase Vault; strip `p_key` from logged statements.

### 🟡 SEC-M4 — `class-files` bucket not provisioned
`src/app/api/v1/children/[childId]/school/classes/[classId]/uploads/route.ts` + `src/server/services/school.ts` reference a `class-files` bucket that **no migration creates**. Uploads are broken or the bucket was created out-of-band (unreviewed policies).
**Fix:** add the bucket + private RLS policies to a migration (path `<uid>/<child-slug>/<class-slug>/…`, tenant-scoped).

### 🟡 SEC-M5 — `health_device_tokens` tenant-wide SELECT exposes `vault_ref`
**File:** `023_health_reconsent.sql`. Any tenant member can read the vault *pointer* (not the secret). Low sensitivity, but the comment says "clients never read vault_ref" while the grant allows it.
**Fix:** column-level grant excluding `vault_ref`, or restrict to subject/service_role.

### 🟡 SEC-M6 — Checkins teen-privacy (route-only) — **REMEDIATED**
In 001–016, `checkins_tenant_read` admitted parents to raw teen text via PostgREST (route enforced, RLS didn't). **`050_checkins_teen_privacy_fix.sql` fixes it at the data layer** (teen-only SELECT/UPDATE/DELETE + `checkin_daily_summary()` aggregates RPC). Verify on apply.

### 🟢 SEC-L1 — `access_reason_codes` has no RLS
**File:** `021_access_events.sql`. Reference table; no grants issued so default-deny applies, but NFR-SEC-001 says RLS on *every* table. One-line fix: `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + authenticated SELECT.

### 🟢 SEC-L2 — 015 invites trigger treats no-JWT direct SQL as privileged
Same pattern as 003's documented `get_tenant_secret` acceptance (direct-SQL = operator). Consistent; note only.

### 🟢 SEC-L3 — `get_invite_preview` anon oracle
**File:** `016_invite_preview.sql`. Anon-executable by design (`/verify-invite` is a public page); token is 192-bit CSPRNG (enumeration infeasible); reveals only inviter/invitee identity to the token holder. Acceptable.

### 🟢 SEC-L4 — Single `dangerouslySetInnerHTML` is a static theme script
`src/app/layout.tsx:30` — hardcoded localStorage theme snippet, no user input. Safe.

### 🟢 SEC-L5 — `agent_reader` grant on `child_portals_public` is inert
Documented in 005 (F5) and 003 (R2): the view's parent-only RLS returns zero rows for the agent today. No data exposure; needs the scope bridge before it becomes live.

---

## §3 — Vault findings (NFR-SEC-006)

**003 credential vault (portal passwords): PASS.**
- Supabase Vault (`supabase_vault` extension; AES-256-GCM via pgsodium, managed keys). Metadata table holds IDs only.
- `get_tenant_secret()` — service_role-only (the R2 parent branch was removed); rejects NULL child_id; family-scoped NULL-row fallback; `EXECUTE` revoked from `authenticated`.
- `set_tenant_secret()` — parent-only, rejects empty secrets, per-family vault secret names (no cross-family overwrite), bumps `credentials_updated_at` on rotation.
- `remove_tenant_secret()` — deletes the vault secret row (true erasure; orphaned pgsodium key row is inert).
- `test_portal_connection()` returns boolean only — secret never leaves the DB.
- `audit_log_reject_secret_keys()` trigger blocks secret-shaped keys in audit detail (top-level keys only — nested scanning noted as future hardening).
- Code: `src/server/services/portals.ts` — password appears only as a function parameter passed straight into `set_tenant_secret()`; "never logged" is asserted in comments and no `console.log` exists near credential handling. Audit rows carry portal key only.

**036 W7 documents vault: PASS with gaps (SEC-M3).** `pgp_sym_encrypt` ciphertext in `vault_documents.encrypted_blob`; `last4_ref` CHECK rejects >4 digits; `assertNoFullPan()` rejects 13–19 digit runs pre-encryption; reveal is parent-only + audited (`vault_document.revealed`); deletion = row delete (erasure). Gaps: single env key with no rotation runbook; key travels as RPC arg.

**Repo secret scan: PASS.** No hardcoded API keys/tokens/passwords in `src/`; `.env*` gitignored (`.env.example` committed as docs); `.env.local` present locally and ignored. `NEXT_PUBLIC_*` surface = URL, anon key, tutor URL only — no secrets.

---

## §4 — API findings (NFR-SEC-007/008)

**Route inventory:** 57 route handlers under `src/app/api/v1/`. Uniform pattern `handleRoute` (requires authenticated user) → `assertTenant`/`assertParent`/`assertHousehold` (membership via `current_child_ids()`) → service → `auditEvent`. Spot-checked:
- Grades overview: `assertTenant` + `current_child_ids()` — parent without membership → 403. ✅
- Checkins GET/POST: route asserts tenant; **service enforces `requireChildRole`** — parents get 403, never raw text (and 050 now enforces at RLS too). ✅
- Teacher-message approve/send: routes use `assertTenant`, but services call `requireParentRole()`; send-window (06:00–22:00 child-local) + exact-body approval + optimistic `status` guards; audited. NFR-SEC-008 satisfied. ✅ (Recommend `assertParent` at the route too for defense-in-depth clarity.)
- Portals: `assertParent`; passwords via `set_tenant_secret()` with caller JWT (never service_role — matches the 003 contract). ✅
- SYNC NOW: `assertParent`. ✅
- Vault reveal: parent-only + audited. ✅
- Tutor chat: tenant-scoped proxy; worker URL server-side; messages capped (50 × 8k chars). No per-user rate limit — recommend one. 🟡

**Rate limiting:** invite creation has a daily pending-invite cap (`sendChildInvite`, `src/lib/tenant/actions.ts`) — but count-then-insert is not atomic (soft limit). Link-code redemption lockout is ineffective (SEC-M1). No rate limits on ticket creation (no routes yet), invite preview, or tutor chat. Recommend a shared rate-limit helper (Upstash or in-DB token bucket).

**Scope-filtering trace (assigned):** grades path traced end-to-end. A parent WITHOUT membership cannot retrieve rows (403 at `assertTenant`, denied at RLS). **A parent with a Performance-only grant CAN retrieve Reflection/Wellness rows today** — scope enforcement is not wired anywhere (SEC-C4). The `access_scopes` defaults (performance+communications allowed) exist only as data.

---

## §5 — XSS findings (NFR-SEC-003)

| Surface | Status |
|---|---|
| FAQ search (S1) | UI not built yet (tables landed in 046). **Preventive:** render FAQ bodies as text or sanitized HTML (DOMPurify) — FAQ content is admin-authored but versioned; treat as untrusted. |
| Ticket threads (S3) | UI not built yet (tables in 032). **Preventive:** agent notes + user messages must be text-rendered; never `dangerouslySetInnerHTML`. |
| Check-in text | Rendered via React (auto-escaped). No `dangerouslySetInnerHTML`. ✅ |
| AI/tutor chat | Proxied as JSON; no markdown renderer in tree. ✅ |
| Shopping items / mail OCR text / teacher-message drafts | React-escaped; no raw HTML injection points. ✅ |
| `package.json` | **No DOMPurify / sanitize-html / markdown renderer** — nothing to misconfigure, but add DOMPurify when rich-text rendering ships (FAQ, ticket threads, AI chat). |
| `dangerouslySetInnerHTML` | 1 occurrence (`src/app/layout.tsx:30`), static theme script — safe (SEC-L4). |

**Verdict:** no exploitable XSS in the shipped UI. Add DOMPurify + a "no raw HTML for user content" lint rule before S1/S3 UI ships.

---

## §6 — Residual risks + retest plan

**Residual risks**
1. **Apply-state uncertainty** (SEC-H8): no conclusion here is verified against the live DB. The applier must diff `schema_migrations` first.
2. **Concurrent migration landing:** 5+ teams are writing migrations simultaneously with ad-hoc renumbering (001→050 during this audit). Collision/ordering risk is the top process risk — APPLY_ORDER.md's procedure + `check.sh` must gate every landing.
3. **Agent boundary:** `agent_reader` grants exist but the scope bridge for portal metadata is pending (documented, inert — SEC-L5). Re-audit when it ships.
4. **Audit `detail` secret-sink:** trigger covers top-level keys only; nested objects can still carry secrets.
5. **Health module:** counsel gate (`counsel_reviewed=false`) must stay closed until licensed-counsel review; `state_minor_consent_rules` GA row is an unreviewed placeholder.

**Retest plan (post-fix)**
1. Apply-order dry run: `check.sh` + a fresh-project apply of 001→050 in order; assert zero errors (catches SEC-H2/H5 class issues).
2. Function-signature CI: every `PERFORM public.<fn>(` / `.rpc('<fn>'` in tree must resolve to a `pg_proc` entry with matching arity (catches SEC-C2 class issues).
3. Revocation matrix test (SEC-C1/C3): fixtures — parent A grants B (granted_by='parent'), teen grants C (granted_by='child'); assert B cannot revoke C's grant (`child_grant_untouchable`), A cannot revoke another parent's grant (`not_your_grant`), revoked parent's `current_child_ids()` is empty and PostgREST reads return 0 rows.
4. Scope negative tests (SEC-C4): Performance-only grantee → 0 rows on reflection/wellness surfaces via direct PostgREST.
5. Link-code brute force (SEC-M1): 6 wrong attempts → 7th (even correct) raises `code_locked`.
6. Auth-bypass re-run per Mehedi's protocol on every phase: anon/authenticated JWTs against all tables + storage buckets.
7. Re-run this audit after the tree stabilizes (no new migrations for 48h) and after 017+ first applies to staging.

---

*Report written to `docs/security/SECURITY-AUDIT-REPORT.md`. The 4 critical findings are appended to `docs/BUILD-LOG.md` (newest-first) as phase blockers. No deployment performed. No files outside `docs/security/` + `docs/BUILD-LOG.md` were modified by this audit.*
