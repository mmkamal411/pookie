# Squad 2 — Health Track 💚 · QA Plan

**Status:** PLAN ONLY — executable the moment build starts. No deploys.
**Date:** 2026-10-12 · **Author:** QA Engineer, Squad 2 (Health Track)
**Sources:** `docs/solutions/sol-health.md` (v2026-10-12) · `docs/pm/QUALITY-PLAN.md` ·
`docs/BUILD-SPECIFICATION.md` (§FR-HEALTH, NFR-SEC, NFR-PRIVACY).
**Branch:** `staging-build` — health build starts on migrations **022–028** (after 021
`access_events`).

## 0. How to read this plan

- Every test has an ID (`HT-…`, `RLS-…`, `CO-…`, `DEL-…`, `NEG-…`, `NF-…`, `CH-…`) and maps to
  one or more FR/NFR IDs. **🛑 = launch gate**: the health track does not touch a real family
  until the test passes (per `docs/solutions/sol-health.md` §12 gating and Mehedi's standing
  rule: "health data is the most legally sensitive surface").
- **Deny-by-default is the invariant.** For every positive test there is a paired negative test:
  the denied caller gets **403 / empty set, never leaked content** — including no
  row-existence signals, no "3 hidden records" counters, no timing oracles.
- Mehedi's 7-area protocol coverage is marked per test where applicable:
  **F**unctional, **NF**on-functional, **S**ecurity, **RT**ed-team, **CH**aos,
  **D**aily-audit, **H**ousekeeping.

## 1. Test harness & fixtures

### 1.1 SQL test harness (CI)

A single idempotent seed script, `tests/health/seed_health_qa.sql`, run with `service_role`
against staging before the suite. It creates test identities with fixed, discoverable IDs:

| Identity | Role | Purpose |
|---|---|---|
| `t2_parent_a` | adult user, steward/parent | parent of all fixture children |
| `t2_parent_b` | adult user, second parent | sibling/second-parent and parallel-parenting cases |
| `t2_teen_14` | child, band `teen_13_15` (DOB 2012-03-15) | shared-agency subject |
| `t2_teen_16` | child, band `teen_16_17` (DOB 2009-07-01) | full-agency subject |
| `t2_kid_10` | child, band `under13` (DOB 2015-11-20) | stewardship subject |
| `t2_adult_20` | user, band `adult` (DOB 2005-01-10) | 18+ re-consent subject |
| `t2_teen_nodob` | child, DOB NULL | unknown-DOB fails-closed subject |
| `t2_teen_18today` | child, 18th birthday = job run date | cutover subject |

All fixture rows are tagged `qa_tag='squad2-qa'` and torn down by `tests/health/teardown_health_qa.sql`.
**Non-invasiveness:** the teardown asserts no non-`qa_tag` health rows were touched (rowcount
snapshots before/after).

### 1.2 How RLS tests assert "denied"

Each RLS test runs the same `SELECT`/`INSERT`/`UPDATE` twice:
1. As the subject's own role (expected: rows), and
2. As the denied caller's role (expected: **zero rows / 403**).

RLS is asserted with `EXPLAIN (ANALYZE, BUFFERS)` off by default for pass/fail; the
predicate function `health_tier_visible()` is unit-tested directly with expected
true/false per (subject, caller, tier) triple — the matrix in §2 *is* the expected truth
table, committed as `tests/health/expected_tier_matrix.json`. **A schema change that alters
the truth table without updating the JSON fails the build** (H3-absolute regression guard).

### 1.3 Test conventions

- All SQL assertions fail loudly: `ASSERT` in pgTAP style or a shell harness that diffs
  actual vs expected rowcounts. No silent pass.
- Health **content** never appears in CI logs or `access_events` detail fields — log
  assertions check event *types* (`health_cutover_18`, `h0_minor_refusal`, `health_deletion`),
  never values.
- Per Mehedi's protocol, every security-defect found **stops the line**: the health track
  exits the phase only when fixed and re-tested (§5 defect handling, QUALITY-PLAN.md).

---

## 2. Tier × band access matrix tests (🛑 all)

§1.3 of sol-health.md defines the matrix. Each cell gets a **positive** (allowed sees) and
**negative** (denied gets empty/403) test. `P` = positive, `N` = negative.
FR trace: **FR-HEALTH-001** (taxonomy), **FR-HEALTH-007** (per-subcategory consent),
**FR-HEALTH-008** (GA minor-consent confidentiality); NFR: **NFR-SEC-001** (RLS),
**NFR-SEC-007** (server-side enforcement).

### 2.1 <13 — stewardship band

| ID | Tier | P/N | Test | Expected |
|---|---|---|---|---|
| HT-001 🛑 | H1 | P | `t2_parent_a` reads `t2_kid_10` H1 rows (steps, immunizations) | Rows returned |
| HT-002 🛑 | H1 | N | `t2_parent_b` (no grant) reads `t2_kid_10` H1 | Empty set |
| HT-003 🛑 | H2 | P | `t2_parent_a` reads `t2_kid_10` H2 rows (weight, allergies) | Rows returned (stewardship) |
| HT-004 🛑 | H2 | N | `t2_parent_b` (no grant) reads `t2_kid_10` H2 | Empty set |
| HT-005 🛑 | H3 | N | `t2_parent_a` (steward!) attempts `t2_kid_10` H3 read | **Empty set** — H3 not collected for <13; parent-entered sexual-health content lands H2 flagged, never H3 |
| HT-006 🛑 | H0 | N | INSERT genetic-risk metric for `t2_kid_10` | Refused, `h0_minor_refusal` in `access_events` |

### 2.2 13–15 — shared agency band

| ID | Tier | P/N | Test | Expected |
|---|---|---|---|---|
| HT-007 🛑 | H1 | P | `t2_parent_a` (Wellness grant default ON at link) reads `t2_teen_14` H1 | Rows returned |
| HT-008 🛑 | H1 | N | `t2_parent_a` reads `t2_teen_14` H1 **after teen revokes Wellness grant** (cooling-off completes) | Empty set; no existence signal |
| HT-009 🛑 | H2 | P | `t2_teen_14` reads own H2 | Rows returned |
| HT-010 🛑 | H2 | N | `t2_parent_a` reads `t2_teen_14` H2 (no teen grant, no override) | Empty set |
| HT-011 🛑 | H2 | P | `t2_parent_a` reads `t2_teen_14` H2 **with teen's explicit H2 grant active** | Rows returned |
| HT-012 🛑 | H2 | P | `t2_parent_a` reads `t2_teen_14` H2 **under active, unexpired, teen-notified safety override** (`health_safety_overrides`, tier='H2') | Rows returned |
| HT-013 🛑 | H2 | N | Override **expired** (>30d) or `teen_appealed_at` set → parent reads `t2_teen_14` H2 | Empty set (expiry enforced in predicate, not just the job) |
| HT-014 🛑 | H3 | N | `t2_parent_a` reads `t2_teen_14` H3 **with a full H2 grant + active safety override** | **Empty set** — overrides are H2-only (CHECK `tier='H2'`); H3 arm is teen-only |
| HT-015 🛑 | H0 | N | INSERT 23andMe-style risk score for `t2_teen_14` | Refused, `h0_minor_refusal` logged |

### 2.3 16–17 — full agency band

| ID | Tier | P/N | Test | Expected |
|---|---|---|---|---|
| HT-016 🛑 | H1 | P | `t2_parent_a` (Wellness grant) reads `t2_teen_16` H1 | Rows returned |
| HT-017 🛑 | H2 | N | `t2_parent_a` reads `t2_teen_16` H2 (no grant) | Empty set |
| HT-018 🛑 | H2 | N | `t2_teen_16` revokes safety override early (one tap) → `t2_parent_a` reads H2 | Empty set immediately |
| HT-019 🛑 | H3 | P | `t2_teen_16` reads own H3 (e.g., therapy notes, mental-health care at 16+ per GA) | Rows returned |
| HT-020 🛑 | H3 | N | `t2_parent_a` reads `t2_teen_16` H3 via **every** non-teen path: grant, override, aggregate RPC, break-glass, emergency contact | Empty set on all paths |
| HT-021 🛑 | H0 | N | INSERT fertility-planning data for `t2_teen_16` | Refused, `h0_minor_refusal` logged |

### 2.4 18+ — ownership band

| ID | Tier | P/N | Test | Expected |
|---|---|---|---|---|
| HT-022 🛑 | H1 | N | `t2_parent_a` reads `t2_adult_20` H1 **before any re-consent** (cutover ran) | Empty set — all tiers flip private at 18, including H1 |
| HT-023 🛑 | H1 | P | `t2_parent_a` reads `t2_adult_20` H1 **after affirmative H1 re-consent toggle** | Rows returned |
| HT-024 🛑 | H2 | P | `t2_adult_20` reads own H2/H3 | Rows returned |
| HT-025 🛑 | H3 | N | `t2_parent_a` reads `t2_adult_20` H3 after full H1+H2 re-consent | **Empty set** — H3 never under a general grant |
| HT-026 🛑 | H3 | P | `t2_adult_20` shares **one specific H3 record** via explicit per-record consent | That record visible to named recipient only; other H3 rows remain teen-only |
| HT-027 🛑 | H0 | P | `t2_adult_20` enters genetic-test results (18+) | Stored as **H3-equivalent**: adult-only, never under general grant |

### 2.5 Cross-cutting: H3 absolute (🛑 gate set)

H3 has **no parent path — ever**. These tests enumerate every conceivable bypass vector and
must all fail closed. FR: **FR-HEALTH-008**; NFR: **NFR-SEC-001**, **NFR-SEC-004**.

| ID | Bypass attempt | Expected |
|---|---|---|
| H3-001 🛑 | `health_consent_grants` row for tier H3 inserted directly (DB-level) | RLS/policy rejects the row; `health_tier_visible()` has no grant arm for H3 |
| H3-002 🛑 | `health_safety_overrides` with tier='H3' | **CHECK constraint violation** — overrides are H2-only by schema |
| H3-003 🛑 | Aggregate RPC over teen's H3 rows (averages, counts) | No such RPC exists for parents; server never computes parent-facing H3 aggregates |
| H3-004 🛑 | Break-glass / emergency-contact path reading H3 | Break-glass card populated from user-selected H1/H2 only; H3 unreachable |
| H3-005 🛑 | `wellbeing_events` metadata for an H3-linked crisis | Event carries teen/type/timestamp/severity only — **no content, no scores, no record refs** |
| H3-006 🛑 | Parent-entered sexual-health content for a 13+ teen (INSERT) | **Refused** at write (`h3_parent_write_refusal`) — no surveillance-laundering into H3 |
| H3-007 🛑 | Migration-time assertion: scan all function bodies / `pg_depend` for cross-references to H3 tables from non-teen paths | Build fails if any reference found |
| H3-008 🛑 | Invariant comment present in codebase stating "no H3 path" | Code-review check; regression gate |

### 2.6 Cross-cutting: unknown DOB fails closed (🛑)

| ID | Test | Expected |
|---|---|---|
| DOB-001 🛑 | `t2_teen_nodob` (DOB NULL) band resolution | Treated as **teen_13_15 arm** (most restrictive applicable, per §1.3/§1.7) |
| DOB-002 🛑 | `t2_parent_a` reads `t2_teen_nodob` H2 without teen grant | Empty set — no default parent visibility |
| DOB-003 🛑 | DOB verification flow flips band; re-run HT-009/HT-010 matrix cell | Access follows verified band only after verification timestamp |

### 2.7 Cross-cutting: `entered_by`-parent rows don't widen visibility (🛑)

| ID | Test | Expected |
|---|---|---|
| EB-001 🛑 | Parent manually logs weight for `t2_teen_14` (`entered_by=t2_parent_a`, tier H2) → parent re-reads the row | **Empty set** — the row is H2 teen-private; the parent's own entry does not grant a read |
| EB-002 🛑 | Same rows appear in teen's **review queue** (`rpc_health_review_queue`) and 18+ review–correct–seal | Teen sees what was entered, when, by whom |
| EB-003 🛑 | Parent-entered H2 rows for 13+ are parent **read-only after entry** (no silent edit of own entry to exfiltrate) | UPDATE by parent → 403 |

### 2.8 Property-based tests (RT, per QUALITY-PLAN §2)

Grant/revoke invariants must hold across generated input spaces (Mehedi's advanced directive):
- **INV-1:** for all (grant tier ∈ {H1,H2}, band ∈ {13–15,16–17,18+}) — no sequence of grant →
  revoke → override → grace creates a readable path to H3. Fuzz-generated operation sequences,
  assert `health_tier_visible()=false` for non-teen callers on H3 after each sequence.
- **INV-2:** revoke is monotonic — once a grant is revoked, no later non-teen operation
  re-enables visibility except a *new explicit teen grant* (fresh `granted_at`).
- **INV-3:** tier monotonicity — a row's tier can only move toward *more* restrictive
  (H1→H2, any→H3), never less, without teen action.
- **INV-4:** grace never widens — grace rows only cover `recorded_at < revoke_ts` and expire;
  new rows post-revoke are never graced.

---

## 3. RLS deny-by-default proofs (🛑)

FR: **FR-HEALTH-001**; NFR: **NFR-SEC-001**, **NFR-SEC-007**.

| ID | Test | How |
|---|---|---|
| RLS-001 🛑 | **Predicate unit tests**: `health_tier_visible()` returns exact expected true/false for the full (subject × caller × tier × grant/override/grace-state) truth table | Direct SQL calls; committed JSON truth table (§1.2). Covers every arm: unknown subject, subject not in `current_child_ids()`, every band, grant present/absent/expired/revoked, override active/expired/appealed, grace active/expired. |
| RLS-002 🛑 | **Deny-by-default on empty context**: caller with no grants, no overrides, no grace | All tiers false for every health table's SELECT policy |
| RLS-003 🛑 | **Policy coverage audit**: every health content table (`health_metrics`, `food_logs`, `meal_checkins`, `wellbeing_entries`, `health_notes`, `medications`, `cycle_data`, `immunizations`, `sud_records`, `allergy_list`) has RLS **ENABLED** + **FORCED**, with SELECT/INSERT/UPDATE/DELETE policies present | Query `pg_policies` + `pg_class.relrowsecurity`; missing policy = fail |
| RLS-004 🛑 | **INSERT gating**: H3 INSERT requires child-role on the child; H0 INSERT requires band adult | `health_tier_insert_allowed()` unit tests |
| RLS-005 🛑 | **`search_path` pinning**: `health_tier_visible()` and SECURITY DEFINER functions pin `search_path`; no `agent_reader` grant | Inspect function definitions; attempt search_path hijack in test transaction |
| RLS-006 🛑 | **No service_role read path for product code**: wellbeing/aggregate jobs use SECURITY DEFINER functions returning metadata only | Audit function bodies for raw content-table SELECTs in job paths |

### 3.1 Sibling-leakage tests (🛑)

Two children, same parent — no cross-child reads. FR: **FR-HEALTH-001**; NFR: **NFR-SEC-001**.

| ID | Test | Expected |
|---|---|---|
| SIB-001 🛑 | `t2_parent_a` holds Wellness grant for `t2_teen_14` only; reads `t2_teen_16` H1 | Empty set — grants are per-child |
| SIB-002 🛑 | Parent switches context via child switcher; API returns only the active child's rows | No `child_id` param tampering widens reads (IDOR test on all health endpoints) |
| SIB-003 🛑 | Aggregate RPCs (`nutrition_weekly_patterns`, activity summaries) called with `t2_teen_16` subject by parent granted only on `t2_teen_14` | 403 / empty — never sibling aggregates |
| SIB-004 🛑 | Parent revokes nothing; teen A's H2 grant does not leak teen B's H2 | Per-child isolation under same parent login |

### 3.2 Revoked-grant immediacy (🛑)

| ID | Test | Expected |
|---|---|---|
| REV-001 🛑 | Teen revokes parent H1 grant mid-session → parent's next read (same session, new query) | Empty set **immediately** — the predicate reads grant state per query; no cache TTL |
| REV-002 🛑 | 16–17 instant revoke of H2 grant → parent's open dashboard view refresh | No H2 rows; grace covers historical only, and "hide past too" deletes grace rows instantly |
| REV-003 🛑 | Revocation writes `access_events` teen-visible entry; revoked viewer sees only neutral "Health sharing ended" | No per-record tombstone leakage to the viewer |

---

## 4. 18+ cutover tests (🛑)

FR: **FR-HEALTH-007** (per-subcategory re-consent); NFR: **NFR-PRIVACY-001** (retention),
**NFR-SEC-007**. Source: sol-health.md §2.

### 4.1 Midnight job — `nightly_health_birthday_cutover()`

| ID | Test | Expected |
|---|---|---|
| CO-001 🛑 | Job runs for `t2_teen_18today` (18th birthday = run date) with **no login that day** | All steps execute: grants expired (`expires_at=now()` where grantee ≠ subject), `health_grace` rows created for historical tiers, `health_reconsent_status='pending'`, `access_events` (`health_cutover_18`, per-tier detail, no content) |
| CO-002 🛑 | Parent reads any tier post-cutover, pre-re-consent | Empty set on H1/H2/H3 — **including H1** (health carve-out from the spec's continuity default; C1) |
| CO-003 🛑 | `health_device_tokens` for the subject's wearables connected under parent | Status = `suspended_pending_reauth`; parent token **never resumes** — adult re-authorizes own HealthKit/Health Connect feed |
| CO-004 🛑 | Emancipated minor flagged (G11 adult track) | Treated as adult track in the same run |
| CO-005 | Cutover job **idempotency**: run twice for the same date | Second run is a no-op for already-cut-over subjects (guarded by `health_reconsent_status`); no duplicate grace rows, no duplicate events |
| CO-006 🛑 | Cutover for a subject with **no health rows at all** | Completes cleanly; status `pending`; re-consent screen still offered |

### 4.2 Re-consent screen semantics (`/health/review-18`)

| ID | Test | Expected |
|---|---|---|
| RC-001 🛑 | `rpc_health_reconsent_submit` with H1+H2 toggles ON for `t2_parent_a` | Exactly two `health_consent_grants` rows (one per tier per grantee), `granted_at ≥ 18th birthday`, `expires_at=NULL`, status → `complete` |
| RC-002 🛑 | Submit with a blanket "health" grant / tier ∉ {H1,H2} / H3 toggle attempted | **Validation rejects** — grants are per-tier, never blanket; H3 never gets a row |
| RC-003 🛑 | `rpc_health_reconsent_skip()` | Status → `skipped_private`; **zero grants written**; privacy outcome identical to submit-with-all-OFF |
| RC-004 🛑 | Caller is not the adult subject (parent calls submit for their own benefit) | 403 — granter must be the adult subject |
| RC-005 🛑 | Re-consent is per-parent: grant to Mom does not grant Dad | Parallel-parenting safe; separate toggles, separate rows |
| RC-006 🛑 | Adult changes toggles later in Settings → Sharing → Health | Revoke is one tap, instant, reversible; `health_tier_visible()` reflects immediately |

### 4.3 Review–correct–seal + sealed history

| ID | Test | Expected |
|---|---|---|
| RC-007 🛑 | `rpc_health_review_queue()` returns all parent-entered rows (`entered_by ≠ subject`) grouped by category, with enterer + timestamp | Teen sees full provenance |
| RC-008 🛑 | Per-row Keep / Correct / Delete: Correct writes `health_corrections` (old/new/by/at) and seals; Delete tombstones immediately (§5) | Append-only correction history; `sealed_at` stamped on survivors |
| RC-009 🛑 | Post-consent parent read of **sealed history** without explicit "Include records from before I turned 18" opt-in | **Excluded** — sealed rows visible to the user and their own trends, invisible to grantees until default-OFF include checkbox |
| RC-010 | Transition-summary export (`rpc_export_transition_summary` PDF + JSON) | Subject-only RPC; audit-logged; H3 excluded by default; PDF streamed, never persisted; per-record H3 opt-in checkbox default OFF |

### 4.4 Emergency-contact decoupling (🛑)

| ID | Test | Expected |
|---|---|---|
| RC-011 🛑 | Adult lists Mom as emergency contact with all health toggles OFF | Mom can be *called*; Mom sees **zero health data** — `emergency_contacts` and `health_consent_grants` have no FK/trigger relationship; no code path derives one from the other |
| RC-012 🛑 | Break-glass medical card populated from user-selected H1/H2 | Works with zero parental grants (independent of parental access, G25) |

---

## 5. Deletion & retention tests (🛑)

FR: **FR-HEALTH-001** (§1.5 retention), **FR-HEALTH-003** (W8 retention);
NFR: **NFR-PRIVACY-001** (no indefinite retention — COPPA 312.10 🛑),
**NFR-PRIVACY-002** (per-source schedule, backup purge ≤30d).

### 5.1 Deletion pipeline

| ID | Test | Expected |
|---|---|---|
| DEL-001 🛑 | `rpc_request_health_deletion(scope='tier:H3')` → read immediately after | Rows **tombstoned instantly**: `deleted_at` set, H3 content nulled; reads exclude them |
| DEL-002 🛑 | H3 hard-delete | Next nightly `purge_tombstoned_health()` run **hard-deletes H3** (fast path, not 30 days) |
| DEL-003 🛑 | H1/H2 deletion | Hard DELETE **≤30 days**; storage objects (nutrition photos, 3231 PDFs, check-in attachments) deleted in the same run |
| DEL-004 🛑 | Deletion audit stub | `access_events` keeps anonymized stub (`event='health_deletion'`, scope, timestamp — **no content, no content-resolvable record IDs**) |
| DEL-005 🛑 | Parent (non-teen) calls `rpc_request_health_deletion` on teen's H3 | 403; teen-only deletion |
| DEL-006 🛑 | **Tombstone immediacy under revoked grant**: teen deletes, revoked parent re-reads | Empty set instantly — tombstones excluded at read time, not at job time |

### 5.2 Retention / no-indefinite-retention audit (🛑)

| ID | Test | Expected |
|---|---|---|
| RET-001 🛑 | **No-indefinite-retention audit query**: scan all health tables for rows older than tier TTL — H1 raw >24 months, H3 >12 months, `wellbeing_entries.journal_text` >12 months, mood scores >24 months, tombstoned rows >30 days | **Zero rows**; this query runs in CI nightly and fails the build on any hit |
| RET-002 🛑 | `purge_expired_health()` nightly: H1 rows past 24-month rolling window | Raw deleted; anonymized aggregates retained (account-close anonymization verified) |
| RET-003 🛑 | `purge_expired_wellbeing()` nightly: journal_text >12mo default; teen-configured 30/90/365-day auto-purge honored | Raw journal purged per policy; per-entry delete anytime works (tombstone → §5 pipeline) |
| RET-004 🛑 | Teen-configurable H2 auto-purge (12/24 mo) in `health_retention_policies` | Per-child override respected by the purge job |
| RET-005 🛑 | **Backup purge**: after hard-delete, rows excluded from any restore after 30 days; restore-within-window re-runs purge before serving traffic | Runbook test against the infosec program (G6); PITR + storage backups covered |

### 5.3 Grace auto-restrict

| ID | Test | Expected |
|---|---|---|
| GRC-001 🛑 | Revoke → `health_grace` rows created per (viewer, tier); viewer reads **historical** records (`recorded_at < revoke_ts`) | Visible during grace; UI labels state with dates |
| GRC-002 🛑 | Viewer reads **new** records (`recorded_at > revoke_ts`) during grace | Empty set — grace is historical-only, never new records |
| GRC-003 🛑 | `grace_expires_at` passes with `sweep_health_grace()` **skipped** (simulated job failure) | Predicate still fails closed (`grace_expires_at > now()` enforced in the predicate) — the job is not the enforcement point |
| GRC-004 🛑 | `rpc_hide_past_health()` ("Hide my past health data too") | All grace rows for the subject deleted **immediately**; viewer sees neutral "Health sharing ended" — never per-record tombstones (welfare/no-retaliation) |
| GRC-005 🛑 | H3 grace never created | 18th cutover and revokes create **no H3 grace rows** — nothing to grace |

---

## 6. Negative & abuse tests (🛑)

NFR: **NFR-SEC-001**, **NFR-SEC-004** (pen-test), **NFR-SEC-005** (brute-force lockout);
FR: **FR-HEALTH-006** (W23 <18), **FR-ACCESS-002** (link codes).

| ID | Abuse | Expected |
|---|---|---|
| NEG-001 🛑 | H0 INSERT for a minor via any API route | **Refused** with `h0_minor_refusal`; logged to `access_events` (no health content); no row stored |
| NEG-002 🛑 | H0 INSERT attempt as 18+ without per-record consent flow | Refused or held at H3-equivalent private; never storable under general consent |
| NEG-003 🛑 | **H3 INSERT by parent** (parent role, teen's subject_id) | **403 + `access_events` entry**; no row created |
| NEG-004 🛑 | **Calorie-field injection into `meal_checkins`**: POST with `calories`, `macros`, `weight` fields | **Schema rejects** — columns don't exist; request fails validation; for 18+ `food_logs`, `enforce_no_calories_minor()` trigger raises `nutrition_minor_calorie_refusal` when band is minor and any calorie/macro column is non-NULL (route check first, trigger as backstop) |
| NEG-005 🛑 | `target_kind='weight_loss'` / deficit target for <18 | **Unrepresentable** — no deficit kind in schema for minors; creation refused; 18+ deficit requires `clinician_supervised` kind + valid `clinician_gates` row (NPI verified via CMS registry) |
| NEG-006 🛑 | **Link-code brute force**: N failed 6-digit redemptions | Lockout after N attempts (NFR-SEC-005 / FR-ACCESS-002); codes 15-min TTL, single-use; anti-coercion confirmation intact |
| NEG-007 🛑 | Direct PostgREST read on health tables with the **anon key**, bypassing RPCs | RLS denies (anon has no `current_child_ids()` membership) — plain GET returns empty, same lesson as `sync_requests` anon-readability audit |
| NEG-008 🛑 | `granted_by` forgery: insert `health_consent_grants` row naming another granter | Writable only by the granter via RPC; server stamps `granted_by` from `auth.uid()`, never from client input |
| NEG-009 🛑 | IDOR: parent swaps `child_id` / `subject_id` in any health endpoint | 403/empty for the ungranted child (ties to SIB-002) |
| NEG-010 🛑 | Copied/expired JWT replayed against health endpoints | Rejected at auth layer; no health reads |
| NEG-011 | **Fuzz: ingest endpoint** (`/api/health/ingest`) with out-of-range values, future `recorded_at`, duplicate (subject, metric, recorded_at, source), unallowlisted `metric_key`, diagnosis-mapped keys (AFib classification, genetic risk) | Validation refuses; dedupe holds; diagnosis/H0 keys refused at the Edge Function allowlist; sane-range clamps per `metric_defs` |

### 6.1 Red-team attack chains (RT)

| ID | Chain | Expected outcome |
|---|---|---|
| RT-001 🛑 | Parent → requests safety override with vague reason → override granted → attempts H3 read + H3 aggregate + wellbeing journal read | Override is H2-only, ≤30d, teen-notified, audited; H3/wellbeing stay teen-only |
| RT-002 🛑 | Teen (13) colludes with parent: parent asks teen to "share screen" — out of scope; instead: parent enters H3-category data *about* the teen | Refused at write (`h3_parent_write_refusal`); cannot launder surveillance into H3 |
| RT-003 🛑 | Compromised `health_device_tokens`: parent replays suspended token post-cutover to resume teen's HealthKit feed | Token state `suspended_pending_reauth` — ingestion rejects; adult must re-authorize |
| RT-004 🛑 | Support agent (S1–S3 scoped RBAC) attempts to read `sud_records` or teen H3 for a ticket | No read path; audited denial (support standard: never health/grades without consent) |
| RT-005 | XSS probe on all health-rendered surfaces (journal text, meal notes, allergy free-text) | Escaped rendering; CSP verified (NFR-SEC-003) |
| RT-006 | SAST/DAST on the health Edge Functions + RPCs; dependency scan | Clean; findings tracked as security defects (stop-the-line) |

---

## 7. Module-specific functional tests

### 7.1 W2 — device ingestion & no-diagnosis (FR-HEALTH-002 🛑)

| ID | Test | Expected |
|---|---|---|
| W2-001 🛑 | Ingest pipeline stamps `provenance` + `device_name` + `app_version` + tier from `metric_defs` on every row | No reading ever appears sourceless in UI/API |
| W2-002 🛑 | UI/API response text scan for banned words (*diagnose, disorder, condition, abnormal, risk*) | **Zero occurrences** (string-lint rule, CI-enforced) |
| W2-003 🛑 | Reading trips counsel-reviewed threshold → teen surface shows "This reading looks unusual…" + resources (911/988/GA Crisis line) | No condition named; **never auto-alerts parents**; `wellbeing_event` (`health_anomaly_flag`, metadata only) emitted |
| W2-004 🛑 | Anomaly flag visibility to granted parent | **Not parent-visible** — parent sees the reading (if H1+granted) with neutral label only |
| W2-005 🛑 | "Tell a trusted adult" action | Teen-initiated, teen-chosen recipient; adult gets notification, **not readings/trends**; decline recorded with G1 acknowledgment |
| W2-006 | Persistent "Not a medical device" header + per-chart footnote present on every W2 visit | Disclaimer never one-time |
| W2-007 🛑 | Counsel-unreviewed threshold rows (`counsel_reviewed=false`) | Pipeline treats them as **inert** — no flagging until counsel review |

### 7.2 W8 — wellbeing teen-privacy (FR-HEALTH-003 🛑)

| ID | Test | Expected |
|---|---|---|
| W8-001 🛑 | Parent attempts `wellbeing_entries` read for `t2_teen_14` (any tier, any grant) | Empty set — teen-only RLS, no parent arm, no override arm, no service_role product read path |
| W8-002 🛑 | Parent aggregate endpoint for wellbeing exists? | **Must not exist** — enforced by absence; any future aggregate RPC needs a new migration + panel re-review |
| W8-003 🛑 | `pattern_flag` / `mood_critical` / `ed_signal` / `self_harm_disclosure` emission | `wellbeing_events` carries teen/type/timestamp/severity **only** — no content, no scores, no journal text |
| W8-004 🛑 | Safety response to a crisis event | Does **not** grant anyone H2/H3 reads (C4 firewall); trusted adult gets resources + teen's chosen message |
| W8-005 | 988 / Crisis Text Line / GA Crisis line surfacing on high-severity events | Present; teen-controlled "tell a trusted adult" offered |
| W8-006 🛑 | H3-flagged journal entry delete | Tombstone → hard delete **next nightly run** (H3 fast path) |

### 7.3 W23/W13 — nutrition age-gate (FR-HEALTH-006 🛑, FR-HEALTH-004)

| ID | Test | Expected |
|---|---|---|
| W23-001 🛑 | <18 requests calorie logging UI/API | UI absent; API refuses (`nutrition_minor_calorie_refusal`); schema trigger backstop (NEG-004) |
| W23-002 🛑 | `nutrition_weekly_patterns()` for minor subject, parent caller | Returns **engagement only** (`week_start, days_logged, entries, meals_by_type`); calorie/macro fields `null` with `detail='engagement_only_minor'` |
| W23-003 🛑 | Copy-lint: <18 nutrition/meals surfaces scanned for banned framing (calories, burn, deficit, cheat meal, clean eating, guilt-free, good/bad foods, bikini body, before/after, BMI-framing, "light") | Zero occurrences |
| W23-004 🛑 | `meal_checkins` schema | No calorie/macro/weight columns exist; `meal` CHECK enum; hunger/fullness 1–5 |
| W23-005 🛑 | Clinician gate: numeric target for <18 without verified NPI | Refused; with fake/expired NPI | Refused (CMS registry check); coaches/trainers/unlicensed "nutritionists" do not satisfy |
| W23-006 🛑 | ED-signal: ≥3 skipped meals/7d with low-energy notes | `ed_signal` (medium) to `wellbeing_events` → safety ladder + NEDA surfacing; **never** a parent "your teen may have an eating disorder" notification |
| W23-007 | NEDA card present and one-tap from all W23/W8 surfaces; viewing it is never logged parent-visible | Persistent, dismissible-but-returning, never a shame-interrupt modal |
| W13-001 | W13 meal plans for <18 | No calorie budgets/caps, no "lightened-up"-as-weight-control, no fasting schedules; plan view never displays calories |

### 7.4 W22 — activity age rules (FR-HEALTH-005)

| ID | Test | Expected |
|---|---|---|
| W22-001 | `activity_feed`/`activity_summary` for <18 subject | Omits `streak_days`, `streak_badges`; no streak component rendered (absent, not hidden) |
| W22-002 | `calories_burned`/`active_calories` for <18 | Stripped server-side; dropped at ingest even if HealthKit reports them |
| W22-003 | Rest days in <18 weekly view | Rendered complete/positive ("Rest day — muscles rebuild when you rest"); never "missed", never red |
| W22-004 | Leaderboards including <18 members | None; family leaderboard excludes minors server-side; no ranked teen comparisons |
| W22-005 | 18+ streaks/calorie-burn | Available only via explicit opt-in, default OFF |

### 7.5 W28 — allergy hard-blocks (sol-health §10)

| ID | Test | Expected |
|---|---|---|
| W28-001 🛑 | `rpc_restaurant_recommendations` with teen's peanut-anaphylaxis allergy | Dishes listing peanut **excluded** (not downranked); unsafe restaurants excluded with `allergen_block` |
| W28-002 🛑 | Allergen info unavailable | Labeled "allergen info unavailable — call ahead"; never assumed safe |
| W28-003 | Copy scan: "allergy-safe" / "allergen-free guarantee" | Zero occurrences; required footnote present |
| W28-004 | Allergy list inference from order history | **Banned** — list populated only by explicit entry; no inference columns/jobs |
| W28-005 | <18 diner: filter tags `low-cal`, `diet`, `skinny`, `guilt-free`, `light` | Suppressed; "healthy" relabeled "balanced options", no calorie numbers |

### 7.6 Immunizations — G22 (FR-HEALTH-010)

| ID | Test | Expected |
|---|---|---|
| IMM-001 | Parent <18 reads immunizations + 3231 PDF | Visible via H1/Wellness scope; CVX codes valid |
| IMM-002 🛑 | 3231 expiry reminders | 90/30/7-day reminders to parent (<18) / adult (18+); provisional-expiry aware |
| IMM-003 🛑 | At 18, immunization rows follow cutover | Parent loses access until re-consent (like all health data) |
| IMM-004 | HPV catch-up reminder | Annual max, dismissible, clinician-deferring framing only; never a medical recommendation |

### 7.7 SUD separation — 42 CFR Part 2 (FR-HEALTH-009 🛑)

| ID | Test | Expected |
|---|---|---|
| SUD-001 🛑 | `sud_records` content is application-layer encrypted with a **separate key** from general health data | DB never sees plaintext; key rotation independent |
| SUD-002 🛑 | Cross-reference scan: no view, RPC, or join touches `sud_records` with general health tables | Migration-time assertion fails the build on any reference |
| SUD-003 🛑 | Disclosure requires explicit `sud_disclosure_consents` row naming records/recipient/purpose/expiry | General health grant, Wellness grant, 18+ re-consent, transition export **never** cover `sud_records` |
| SUD-004 🛑 | Export UI lists SUD records separately, default-OFF per-record checkboxes | No co-mingling in transition summary |
| SUD-005 🛑 | Break-glass for `sud_records` | **None exists** — consistent with H3-absolute |

### 7.8 Consent UX contracts (FR-HEALTH-007, FR-ACCESS-001)

| ID | Test | Expected |
|---|---|---|
| UX-001 🛑 | Consent screens enumerate health subcategories (tiers) — never one "health" checkbox | Copy ≤8th-grade; per-tier toggles all default OFF at 18+ |
| UX-002 🛑 | No consent re-prompt for 90 days after a teen declines | (NFR-PRIVACY-007) |
| UX-003 | Sharing screen carries the H3 firewall line; **no per-record existence signals** | No "3 hidden records" counters — existence is disclosure |

---

## 8. Non-functional tests

### 8.1 Performance (NF)

| ID | Test | Target |
|---|---|---|
| NF-001 | **RLS policy performance**: `EXPLAIN (ANALYZE)` on tier-filtered queries at **10k rows** per table (`health_metrics` with mixed tiers/bands) | Predicate short-circuits; indexed `(subject_id, health_tier)`; p95 read <200 ms on staging hardware. Regression: >2× slowdown vs baseline fails CI |
| NF-002 | `health_tier_visible()` hot-path cost at scale | Called once per row — verify planner doesn't re-evaluate per-row subqueries pathologically; consider STABLE marking |
| NF-003 | `nutrition_weekly_patterns()` engagement-only path for minors | Same SLA; no calorie computation even attempted |
| NF-004 | **pg_cron job idempotency**: `nightly_health_birthday_cutover()`, `sweep_health_grace()`, `purge_tombstoned_health()`, `purge_expired_health()`, `purge_expired_wellbeing()` run twice back-to-back and after partial failure | No duplicate rows, no double events, safe to retry |
| NF-005 | **Export PDF generation** (`rpc_export_transition_summary`) | p95 <5 s for a 2-year history; PDF streamed, never persisted to storage |
| NF-006 | Load: 200 concurrent tier-filtered reads (mixed roles) | No RLS-induced serialization; error rate 0; latency within 2× single-user p95 |
| NF-007 | Daily-update audit (protocol area): health source → pull → storage → render with **zero manual intervention** — device ingest, purge jobs, cutover | Each source named; each pull automated; each render provenance-labeled |

### 8.2 Usability / accessibility (NF, Mehedi's protocol)

| ID | Test | Expected |
|---|---|---|
| NF-008 | Re-consent interstitial usable at 375px; toggles operable by keyboard; `prefers-reduced-motion` honored | WCAG 2.2 AA on the consent flow; labels on every toggle |
| NF-009 | Denied states render as neutral "not shared" — never error dumps, never per-record hints | No information leakage through UI copy |

### 8.3 Housekeeping (H, standing rule)

- No dead code, no console.logs, no commented-out blocks in health code paths.
- Migration files 022–028 idempotent and ordered (after 021); `APPLY_ORDER.md` updated.

---

## 9. Chaos engineering (CH)

Per Mehedi's standing directive — disrupt dependencies, verify graceful degradation +
automatic recovery.

| ID | Scenario | Expected |
|---|---|---|
| CH-001 🛑 | **Supabase down during cutover**: kill the DB connection mid-`nightly_health_birthday_cutover()` | Job is **idempotent and retryable**: partial run leaves no half-expired state visible to parents (grant expiry + grace creation are transactional per subject); next scheduled run completes remaining subjects; no parent gains access from a partial run |
| CH-002 🛑 | **Device token revoked mid-sync**: HealthKit/Health Connect token revoked while a batch ingest is in flight | In-flight batch fails closed (no partial rows without provenance); next sync resumes from last committed `recorded_at` (dedupe on (subject, metric, recorded_at, source) prevents doubles); no parent-visible error leaks teen data |
| CH-003 | Network drop mid-`rpc_export_transition_summary` | No partial PDF persisted (streamed + discarded); audit event only on completed export |
| CH-004 | `sweep_health_grace()` missed two nights (cron outage) | Predicate still fails closed on expired grace (GRC-003); sweep catches up idempotently |
| CH-005 | Clock skew: birthday-boundary subjects (born on cutover date in another timezone) | Cutover uses **subject-local** 00:00; no early/late flip from server TZ |

---

## 10. Launch-gate rollup (🛑)

The health track holds **no real teen data** (W2/W8 stay seedlings) until every 🛑 test
below passes on staging **and** sol-health.md §12 gates 2–6 clear (counsel review, safety
sign-off, UX copy, infosec program, R9 seedling rule).

| Gate group | Tests | FR/NFR |
|---|---|---|
| Tier × band matrix (all 27 cells) | HT-001…HT-027 | FR-HEALTH-001/007/008 · NFR-SEC-001/007 |
| H3 absolute (no parent path) | H3-001…H3-008 | FR-HEALTH-008 · NFR-SEC-001/004 |
| Unknown DOB fails closed | DOB-001…DOB-003 | FR-HEALTH-001 · NFR-SEC-001 |
| `entered_by` doesn't widen | EB-001…EB-003 | FR-HEALTH-001 · NFR-SEC-007 |
| RLS deny-by-default proofs | RLS-001…RLS-006 | NFR-SEC-001/007 |
| Sibling leakage | SIB-001…SIB-004 | NFR-SEC-001 |
| Revoked-grant immediacy | REV-001…REV-003 | FR-HEALTH-007 · NFR-SEC-007 |
| 18+ cutover + re-consent | CO-001…CO-004, CO-006, RC-001…RC-012 | FR-HEALTH-007 · NFR-SEC-007 |
| Deletion pipeline + tombstone immediacy | DEL-001…DEL-006 | NFR-PRIVACY-001/002 |
| No-indefinite-retention audit | RET-001…RET-005 | NFR-PRIVACY-001/002 🛑 (COPPA 312.10) |
| Grace auto-restrict | GRC-001…GRC-005 | FR-HEALTH-007 |
| Negative/abuse (H0, H3 insert, injection, lockout, anon bypass, IDOR) | NEG-001…NEG-010 | NFR-SEC-001/004/005 |
| W2 no-diagnosis | W2-001…W2-005, W2-007 | FR-HEALTH-002 🛑 |
| W8 teen-privacy | W8-001…W8-004, W8-006 | FR-HEALTH-003 |
| W23 age-gate + W13 | W23-001…W23-006 | FR-HEALTH-006 🛑 |
| SUD separation | SUD-001…SUD-005 | FR-HEALTH-009 |
| Cutover chaos | CH-001, CH-002 | NFR-SEC-004 |

## 11. Execution checklist

1. **Migrations 022–028 applied to staging** (after 021) → run `seed_health_qa.sql`.
2. Run predicate unit tests (RLS-001) → matrix tests (§2) → RLS proofs (§3).
3. Run cutover simulation: set `t2_teen_18today` DOB so birthday = run date; invoke
   `nightly_health_birthday_cutover()` directly; assert §4.
4. Run deletion/retention/grace suites (§5); run the no-indefinite-retention audit query.
5. Run negative/abuse + red-team chains (§6); run fuzz on ingest.
6. Run NF suite (§8): EXPLAIN at 10k rows, cron idempotency, export timing, load.
7. Run chaos scenarios (§9).
8. **Any 🛑 failure stops the line** — fix in-phase, re-test, then proceed (QUALITY-PLAN §5).
9. Teardown fixtures; verify no non-QA rows touched.
10. Commit results to BUILD-LOG.md with evidence (rowcounts, EXPLAIN outputs, never content).

## Appendix — Traceability

| FR/NFR | Tests |
|---|---|
| FR-HEALTH-001 | HT-001…HT-027, RLS-001…RLS-006, SIB-001…SIB-004, DOB-001…DOB-003, EB-001…EB-003, INV-1…INV-4 |
| FR-HEALTH-002 | W2-001…W2-007 |
| FR-HEALTH-003 | W8-001…W8-006, DEL/RET wellbeing rows |
| FR-HEALTH-004 | W13-001, W23-003 |
| FR-HEALTH-005 | W22-001…W22-005 |
| FR-HEALTH-006 | W23-001…W23-007, NEG-004, NEG-005 |
| FR-HEALTH-007 | HT-007/008/011/022/023, REV-001…REV-003, CO-001…CO-006, RC-001…RC-012, GRC-001…GRC-005, UX-001/UX-002 |
| FR-HEALTH-008 | HT-019/020/025/026, H3-001…H3-008, NEG-006-in-spirit (write refusal NEG-003) |
| FR-HEALTH-009 | SUD-001…SUD-005 |
| FR-HEALTH-010 | IMM-001…IMM-004 |
| FR-ACCESS-002 | NEG-006 |
| NFR-SEC-001 | RLS-001…RLS-006, SIB-*, NEG-001…NEG-010, H3-* |
| NFR-SEC-003 | RT-005 |
| NFR-SEC-004 | RT-001…RT-006, INV-*, NEG-011, CH-001…CH-005, NF-006 |
| NFR-SEC-005 | NEG-006 |
| NFR-SEC-007 | HT-*, EB-*, REV-*, RC-*, NF-007 |
| NFR-PRIVACY-001/002 | DEL-001…DEL-006, RET-001…RET-005 |
| NFR-PRIVACY-007 | UX-002 |

*Non-goals for this plan: crisis-response protocol testing (safety designer's ladder consumes
our metadata-only events — interface contract test only, §5.3), consent-screen copy QA
(UX designer's copy, ≤8th-grade — content spec only), counsel sign-offs (sol-health §12.2).*
