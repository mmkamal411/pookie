# Pookie Build Log — 3-agent team coordination

Team: Senior Full-Stack Developer (frontend) · Senior Backend Developer (API/data) · DevOps Manager (CI/CD, Pages, envs).
Rule: append entries newest-first. Keep it tight: what changed, what's blocked, what's next.

---

## 2026-10-11 — Security Engineer (Phase 2b: M1 fix prescription [verbatim SQL] + 013_sync_queue review)

**M1 FIX — verbatim prescription for the follow-up agent.** Root cause: `auth.uid()` casts the JWT `sub` to uuid and RAISES on non-UUID subs instead of failing closed. Fix has 4 parts (all target migrations are file-only, not yet applied — safe to edit directly):

**Part 1 — new `safe_auth_uid()` helper (insert into 006 BEFORE its `-- RLS:` block; CREATE POLICY validates expressions at creation time, so it must exist first):**
```sql
CREATE OR REPLACE FUNCTION public.safe_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_sub text := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub');
BEGIN
  IF v_sub IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_sub::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.safe_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_auth_uid() TO authenticated, service_role, agent_reader;
```
(NOT security definer — reads only the request JWT claims. NULL on missing claim or non-UUID sub → every predicate using it fails closed.)

**Part 2 — swap the three `auth.uid()` call sites to `public.safe_auth_uid()`:**
- 006 `study_plans_tenant_read`: `WHERE ca.user_id = auth.uid()` → `WHERE ca.user_id = public.safe_auth_uid()`
- 007 `is_household_member`: `SELECT p_owner = auth.uid()` → `SELECT p_owner = public.safe_auth_uid()`
- 008 `is_household_parent`: `ON ca.child_id = c.cid AND ca.user_id = auth.uid() AND ca.role = 'parent'` → `... AND ca.user_id = public.safe_auth_uid() AND ...`

**Part 3 — missing EXECUTE grants for agent_reader (without these, every agent query on 007/008 tables dies with "permission denied for function" even after the UUID-sub fix — Postgres checks EXECUTE on policy-referenced functions as the caller, SECURITY DEFINER notwithstanding):**
- 007: `GRANT EXECUTE ON FUNCTION public.household_owner_for_child(uuid) TO authenticated, service_role, agent_reader;`
- 007: `GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated, service_role, agent_reader;`
- 008: `GRANT EXECUTE ON FUNCTION public.is_household_parent(uuid) TO authenticated, service_role, agent_reader;`
(`current_child_ids()` keeps default PUBLIC execute — no change needed there.)

**Part 4 — mint-time enforcement (005 AGENT JWT CONTRACT comment; the minter is backend code, not SQL):** replace `"sub": "muse-agent"` with `"sub": "<uuid>"` and append: `SUB MUST BE A UUID — e.g. a fixed per-deployment agent UUID or uuidv5(job_id). The old 'muse-agent' string sub is FORBIDDEN. Backend minters: UUID-parse the sub and refuse to mint otherwise (fail-closed at mint time).`
**Negative tests for the follow-up:** (a) agent JWT, non-UUID sub, valid scope → shopping_items SELECT returns 0 rows, NO error; (b) UUID sub + valid scope → job's household rows; (c) UUID sub + expired scope → 0 rows; (d) agent JWT on `child_portals_public` → 0 rows, no error.

**013 REVIEW (`013_sync_queue.sql`; reviewed pre-renumber as `009_sync_queue.sql` — content verified identical, findings carry over unchanged):** CRITICAL 0 / HIGH 0. Tables `sync_jobs`, `sync_heartbeats`: RLS enabled, zero policies (deny-all, same as agent_tenant_scope) ✓; GRANT ALL only to service_role, no client grants ✓. All 6 RPCs (dev reported 7; file has 6: sync_request_job, sync_claim_job, sync_finish_job, sync_append_log, sync_heartbeat, sync_upsert_sweep): definer + pinned search_path + REVOKE ALL FROM PUBLIC + EXECUTE-to-service_role ✓. `sync_claim_job` double-claim verified SAFE: SELECT…FOR UPDATE SKIP LOCKED + UPDATE in one transaction — concurrent workers skip locked rows, committed rows filter on status='pending'. `sync_upsert_sweep` child-scoping verified: every class lookup filters `child_id = p_child_id`, every INSERT stamps `p_child_id`, dedupe check is child-scoped, NULL/unknown child raises; no dynamic SQL (no injection); only `direction='inbound'` rows inserted (worker cannot forge outbound drafts) ✓.
**LOW (4):** 009-L1 — assignments upsert with NULL `source_id` never matches ON CONFLICT → duplicate rows per sync if the worker omits it (unbounded growth, due_next dupes); require source_id in the worker contract or raise in the RPC. 009-L2 — `sync_append_log` SELECT-then-UPDATE without FOR UPDATE → lost log lines under concurrent appends; add FOR UPDATE. 009-L3 — `sync_finish_job` accepts any job in any status (no `status='claimed'` check); a worker bug could complete a pending job and skip the sync; add the check. 009-L4 — `sync_upsert_sweep` casts (`::numeric`, `::timestamptz`) raise on malformed input → whole sweep rolls back (fail-closed, but one bad row kills the sync); add per-row validation or worker contract tests.
**INFO (3):** stuck 'claimed' jobs have no timeout/reaper — dead worker wedges the child's queue (recommend `sync_reap_stale_claims()` or heartbeat watchdog); laptop workers hold service_role (trusted-worker model — track worker key hardening); the upcoming SYNC NOW route must assertTenant/assertParent before calling service_role `sync_request_job` and scope job-status reads to the asserted child_id (the RPC does no caller authz by design — will verify when routes land).
**COORDINATION FLAG — RESOLVED:** the earlier migration filename collision (`009_sync_queue.sql` vs batch-2's `009_w5_college_prep.sql`, plus 010/011/012 dupes) is resolved per the coordinator's entry below ("009 collision resolved", commit `316255d`): sync queue renumbered to `013_sync_queue.sql`, batch-2 keeps canonical 009–012, competing fork removed (`a3c3a6e`). Final map: 001–005 foundation · 006–008 batch-1 · 009–012 batch-2 · 013 sync queue. No duplicates. All findings above now reference `013_sync_queue.sql`.
**Next:** reviewing builders' API routes (W20 routes already delivered per the log — picking those up on notify).

---

## 2026-10-11 — SQL DBA: migrations 009–012 (W5/W16/W22/W23) DELIVERED

**Delivered (files only — NOT applied to any live DB):** `supabase/migrations/009_w5_college_prep.sql`, `010_w16_minutiae.sql`, `011_w22_health_tracker.sql`, `012_w23_nutrition.sql` — committed + pushed to mmkamal411/pookie main.
- **009 (W5):** 10 tables, all child_id-scoped via `current_child_ids()` except 4 public registries (anon+authenticated read, no client writes): `colleges` (50-seed: 15 GA in-state + 20 Southeast + 15 national pre-med — names/locations only, NO fabricated stats), `college_stats` (`as_of` + `source` NOT NULL — undated/uncited stats unrepresentable; zero stats seeded, P2 Scorecard ETL owns population), `requirement_templates` (5 generic seeds, natural `template_key`), `college_aid_programs` (HOPE 3.0 + Zell Miller 3.7/1200/26, as_of 2026-10-11, source gsfc.org); tenant tables `college_list` (UNIQUE child+college), `deadlines`, `essays`, `recommenders`, `test_scores` (manual+upload-verified, `report_path` → new private **`test-score-reports`** bucket), `transcript_releases` (`release_authorization_integrity` CHECK mirrors 008's dispute constraint); `release_authority_for()` (lazy DOB: student at 18, unknown DOB fails closed to parent); `simulate_gpa()` RPC (SECURITY DEFINER + explicit tenant assert, reads W1 `grades`, what-if adjustments, NULL when no data). No diagnostic/dosing columns (grep-verified). No CollegeBoard/ACT scraping surface (by absence).
- **010 (W16):** `school_events` (child_id-scoped): kind CHECK, title/detail, event_date, prep_deadline, reminder_at/+sent, ack/+by/+at, owner parent|child|both, source manual|extractor, `source_message_id` claim column (FK belongs to the comms pipeline's migration), `dedupe_key` UNIQUE tenant-bound by construction (`<child_id>:<kind>:<stable-id>`) for extractor ON CONFLICT DO NOTHING.
- **011 (W22):** `health_subjects` registry (owner_user_id anchor with ZERO auth semantics — every policy funnels through `current_child_ids()`; child_access stays the single source of truth), `metric_defs` (10 wellness metrics seeded; weight/blood_glucose/hba1c sensitive-default), `health_metrics` (observed values + provenance only; NO diagnosis/dose/dosage/insulin/prescription columns — grep-verified), `health_safety_overrides` (parent-only INSERT, reason ≥20 chars CHECK, `teen_notified_at` NOT NULL, append-only), **`state_minor_consent_rules` — COUNSEL-GATED: vision §5 requires licensed-counsel review before W22/W23 ships; `counsel_reviewed` defaults false and nothing treats rows as reviewed**; `health_subject_age_band()` + `health_metric_visible()` (sensitive 13–17 default-private: teen-self or active audited override; unknown DOB fails into the teen tier) + `assert_health_subject()` (DB-side; backend's TS `assertHealthSubject()` in tenant.ts remains backend-owned). W22=data layer, W2=interpretation (neither writes the other's tables). No agent_reader grants (M1).
- **012 (W23, hard-depends on 011):** `food_logs` (calorie low/high NOT NULL + high≥low — uncertainty ranges unrepresentable to skip; macro pairs optional), `nutrition_targets` (`target_kind` IN maintain/athletic_performance/healthy_gain/medical_recovery — NO deficit kind, under-18 weight-loss unrepresentable by schema; one active per subject), `food_swaps` (12 real-food-first seeds, public read), `nutrition_weekly_patterns()` aggregates-only RPC (trailing-7-day averages/ranges JSONB; parent-role or teen-self; parents get zero `food_logs` rows for teen subjects — the diary split), new private **`nutrition-photos`** bucket.
**Conventions:** `IF NOT EXISTS` / `DROP POLICY IF EXISTS` before `CREATE POLICY` / drop-then-add CHECKs / all definer fns `SET search_path=public` + `REVOKE ALL FROM PUBLIC` + least-privilege GRANTs / route-level `audit_event()` (no per-table triggers) / `data_class` S on health+nutrition, T on college+minutiae / no client DELETE where ledger-like (health_metrics, overrides, nutrition_targets).
**Deviations from brief:** (a) spec doc `MODULE-ARCHITECTURE-BATCH2.md` was never committed — built from the coordinator's task brief + the batch-2 decision log entries; (b) seeded ZERO `college_stats` rows (honesty rule: no fabricated selectivity stats; table + NOT NULL as_of/source constraints are the enforcement); (c) `assertHealthSubject()` delivered as SQL `assert_health_subject()` — the TS helper in `src/server/tenant.ts` is backend's per the spec; (d) unresolved: **duplicate `009_sync_queue.sql`** (uncommitted, unclaimed, no log entry) still in the tree — coordinator must renumber it; my `009_w5_college_prep.sql` was committed per the brief's numbering.
**For Security Engineer:** Phase 2 review requested — especially `health_metric_visible()` teen-tier arms, the food_logs diary-split policy, the safety-override insert/read/update policies, `release_authorization_integrity`, and the two new bucket storage predicates. **Not verified:** no local Postgres available — migrations are spec-faithful but not syntax-executed (same caveat as 006–008); recommend dry-run apply on a scratch project before the live `pookie` project.

---

## 2026-10-11 — Full-Stack Developer B: W20 shared shopping list (API + UI)

**Delivered (spec: docs/MODULE-ARCHITECTURE.md §2; migration 007):**
- `src/server/tenant.ts`: `assertHousehold()` + `assertHouseholdParent()` + `HouseholdContext` per spec §1.2 — parent→default child else first parent-row child, child-role→their child, agent fall-through→first scoped child with least-privilege 'child' role; owner anchor via `household_owner_for_child()` RPC (never client-supplied).
- `src/server/services/shopping.ts`: list ensure/resolve, add with normalized-name dedupe-merge (needed/claimed), forward-only transitions (`claimed→needed` unclaim allowed; `removed` terminal), receipt-learning price insert on bought (best-effort), append-only price reports, server-side preference merge. User-JWT only — no service_role.
- 7 API routes under `/api/v1/household/shopping/`: `list` (GET), `items` (POST), `items/batch` (POST, W13 seam, parent-only for `meal-plan`), `items/[itemId]` (PATCH transitions), `items/[itemId]/remove` (POST soft-remove; route enforces parent-only removal of others' items), `prices` (GET/POST), `preferences` (PATCH, parent-only). All: handleRoute → assertHousehold → use → auditEvent(anchorChildId). Added `shopping_list.viewed`, `shopping_items.batch_added`, `shopping_item.unclaimed` audit actions.
- UI `/household/shopping` (+ `/household/layout.tsx`): add form, Needed/Claimed/Recently bought sections, who-added tags ("milk — Dawson"), claim/buy/unclaim/remove, buy sheet with store+price, per-item price memory with best-price hint labeled "based on your reported prices" (honest v1), parent-only store preferences. Demo mode supported (`src/lib/shopping-demo.ts`); demo gating untouched.
- `tsc` + `eslint` green on all W20 files. Deviations: (1) PATCH accepts `status:'needed'` so the sanctioned unclaim is API-reachable (spec's Zod sketch listed only claimed/bought); (2) GET list adds `role`/`userId` fields for UI role-gating; (3) child-role callers see other members' items tagged "Family" (users RLS self_read) — recommend DBA-owned `household_member_names()` definer RPC to close; (4) receipt-learning price insert is sequential, not single-txn (no tx helper exists) — logged, never fails the buy.
- **Security review ready.** NOTE: tree-level `next build` is currently red from teammates' in-flight W16 minutiae files (untracked `school/minutiae` routes + `src/lib/demo.ts` edit referencing missing `@/lib/school/minutiae`) — unrelated to W20; my commit contains only HEAD + W20 files.

---

## 2026-10-11 — SQL DBA: migrations 009–012 (W5/W16/W22/W23) STARTED

**Claiming per coordinator brief:** `009_w5_college_prep.sql` → `010_w16_minutiae.sql` → `011_w22_health_tracker.sql` → `012_w23_nutrition.sql` (012 hard-depends on 011).
**Flags raised before writing:** (1) `docs/MODULE-ARCHITECTURE-BATCH2.md` is MISSING from the repo (referenced in the log but never committed) — building from the coordinator's task brief + the batch-2 decision entries in this log; assumptions documented per-file and in the delivery entry. (2) **Number collision:** an uncommitted, unclaimed `supabase/migrations/009_sync_queue.sql` already exists in the tree (no BUILD-LOG claim). My batch claimed 009–012 in this log first. Writing my files as `009_w5_college_prep.sql` etc. per the brief — coordinator must resolve the duplicate 009 (recommendation: renumber the sync-queue file, which has no log claim).
**Compliance flag (per brief):** `state_minor_consent_rules` ships in 011 but is COUNSEL-GATED — vision §5 requires licensed-counsel review before the health module ships. Table carries `counsel_reviewed=false` default; nothing in 011/012 treats it as reviewed.

---

## 2026-10-11 — Expert Python: Pookie sync scripts redesign (multi-tenant)

**Delivered** in `sync-scripts/` (canonical package, no forks):
- `pookie_sync/` — config (no secrets on disk), credentials (OS keychain → Pookie vault; service_role via env/`~/.pookie/service-role.key` 0600), transport (curl-style UA — the 403 lesson), supabase client (slug→child_id, class slug/alias matching), queue (claim→finish→append_log→heartbeat), pipeline (`do_sync`: claim → sweep → upsert → finish), CLI (`--once/--sync-now/--request-sync/--store-password`).
- `adapters/cobb.py` — StudentVUE + Office 365 sweep ported from the working 2026-10-10 script with all parser fixes intact (week-section parser, separate-lines dates, iframe frame-search, "Show Done=All", modal-close, parser-degradation alert); `_launch_browser` now also installs `chromium-headless-shell` (the Windows lesson); password injected transiently (memory-only), never in config.
- `pookie-sync-windows.py` / `pookie-sync-mac.py` — thin wrappers (platform UA; Mac `--auto` writes the 3:05 AM marker).
- `INSTALL-RUNBOOK.md` — per-machine install + test steps (backup-first, install-alongside, Task Scheduler/launchd, rollback).
- `supabase/migrations/009_sync_queue.sql` — **authored, NOT applied**: `sync_jobs` + `sync_heartbeats` tables; RPCs `sync_request_job / sync_claim_job (SKIP LOCKED) / sync_finish_job / sync_append_log (capped 500) / sync_heartbeat / sync_upsert_sweep` (atomic: classes resolve-or-create → grades upsert → snapshots append → assignments upsert → inbound messages deduped). All SECURITY DEFINER + service_role-only, plain-name convention (not the old `rpc_` prefix). Syntax-checked with pglast; client↔migration RPC cross-check green.
**Dry-run E2E: 6/6 green** (`tests/test_pipeline.py`) — mocked adapter + schema-faithful fake backend: claim→upsert→finish order, ledger counts (6 classes/grades/snapshots, 5 assignments, 3 messages), idempotent re-run (snapshots append, messages deduped), child_id on every row, no secrets in RPC payloads, new-class-never-drops-grades.
**Table-name review:** sync surface reads clean (`sync_jobs`, `sync_heartbeats`, `grade_snapshots` vs `grades`). One proposal: partial unique index on `teacher_messages(child_id, thread_key, sent_at) WHERE thread_key IS NOT NULL` to make inbound dedupe declarative (currently enforced in the RPC).
**Blocked on:** DBA to apply 009 to the pookie project + confirm the `dawson-kamal` child row; then the laptop installs (runbook ready — needs a live-browser delegate; I can't operate RustDesk). Old scripts untouched — old project stays live until cutover.
**Changed vs old:** writes go to 006 tables (`grades`, `grade_snapshots`, `assignments`, `teacher_messages`) via one atomic RPC instead of the `studentvue_syncs` JSON blob; every write child-scoped; credentials out of config; single package for both platforms.

---

## 2026-10-11 — Security Engineer (Phase 2: migrations 006/007/008 review — W1/W20/W21)

**Reviewed:** `006_w1_school_core.sql`, `007_w20_shopping.sql`, `008_w21_mail.sql` against `docs/MODULE-ARCHITECTURE.md` §1–§4 + the Phase 2 checklist in `docs/SECURITY-BASELINE-AUDIT.md`. Per-migration verdicts + findings below (CRITICAL 0).
**006 (W1):** all 6 tables RLS-enabled, tenant-scoped via `current_child_ids()`; `due_next` is `security_invoker=true` ✓; write discipline matches spec (grades/snapshots read-only, parents write assignments/study_plans/teacher_messages, members write checkins); grants least-privilege; no client DELETE where ledger-like. **007 (W20):** household helpers are definer/STABLE/search_path-pinned; all policies funnel through `is_household_member()` (incl. the `p_owner = auth.uid()` co-parent arm); no DELETE policy/grant on items/price_reports ✓; `data_class='T'` ✓. **008 (W21):** `is_household_parent()` correctly gates parent-only; `dispute_approval_integrity` CHECK is sound (approved/sent impossible without frozen `approved_text` + `approved_by`); `mail-photos` bucket private with owner-anchored storage predicate; no DELETE grants ✓; `data_class='S'` ✓.
**HIGH (1):** H1 — Phase-1 M1's blast radius is now module-wide. Agent JWT `sub='muse-agent'` (non-UUID) makes `auth.uid()` raise instead of fail-closed. `is_household_member()` calls `auth.uid()` directly (`p_owner = auth.uid()` arm) and `is_household_parent()` joins on it — so EVERY 007/008 RLS evaluation hard-errors for `agent_reader` instead of scoping (007, where the spec requires agents to resolve via the household funnel) or denying (008, where the spec requires zero rows). Same landmine in 006's `study_plans` child-gate (`NOT EXISTS` arm): approved plans read fine for the agent, unapproved ones error. Fail-raise, not fail-open (no leak), but the spec'd agent boundary is non-functional and any exception-swallowing hotfix would risk fail-open. **Fix (blocking for agent paths): mint agent JWTs with a UUID `sub`** — then 007 resolves per spec and 008 denies per spec, with zero migration changes.
**MEDIUM (1):** M2 — no `GRANT SELECT ... TO agent_reader` on any 006 table, yet the spec + `study_plans` policy comment describe agent reads ("machine readers see all rows, scoped by their job's tenant set"). Either add the grants (RLS already scopes via the job tenant set) or document W1 as agent-inaccessible. Caution: granting on `checkins` exposes raw `text` to the agent — check against the W8 confidentiality contract first (consider a text-excluding view).
**LOW (6):** L1 — `household_owner_for_child()` is EXECUTE-to-`authenticated` with no membership assertion: child_id→owner oracle. Child UUIDs unguessable, owner UUIDs non-secret, policies never trust caller-supplied owner — harden with a membership assert or document as accepted. L2 — W8 check-in `text` privacy is route-level only; direct PostgREST SELECT exposes raw text to tenant members (spec-acknowledged; a text-excluding view would make it DB-airtight). L3 — `teacher_messages` draft→approved→sent ordering is route-only; direct status flips can't transmit anything (send route still requires approved + stamps `approved_by`) — accepted. L4 — `shopping_items` attribution columns (`claimed_by`/`bought_by`) and forward-only state machine are route-only; intra-household only — accepted per spec. L5 — `mail-photos` storage predicate `::uuid`-casts a path segment: malformed paths raise instead of deny (defense-in-depth only; primary upload path is service_role) — consider a safe cast. L6 — `dispute_approval_integrity` guarantees approval presence, not `approved_text` immutability post-approval; no privilege boundary crossed (parent is the approver) — accepted.
**Checklist cross-check:** re-runnable ✓ (IF NOT EXISTS / DROP-IF-EXISTS / ON CONFLICT DO NOTHING throughout); explicit GRANTs, no anon except the two registry reads ✓; no cross-module FKs before target tables exist (W11 seams are bare uuid) ✓; letters not stored ✓.
**Next:** reviewing the 4 builders' API routes before staging deploy (awaiting notify). `assertHousehold()` (§1.2) implementation will be checked then.

---

## 2026-10-11 — Technical Architect: MODULE-ARCHITECTURE-BATCH2.md DELIVERED (W5/W16/W22/W23 spec)

**Delivered:** `docs/MODULE-ARCHITECTURE-BATCH2.md` (~1,100 lines) — data models, API contracts, UI route map, 12 open questions with recommendations, DBA checklist, demo/conflict flags. Claims **migrations 009–012**: `009_college_prep.sql` (W5) → `010_school_minutiae.sql` (W16) → `011_health_tracker.sql` (W22) → `012_nutrition_tracker.sql` (W23, depends on 011).
**Key decisions:** (1) W5 child_id-scoped; College Scorecard = static v1 seed with as-of dates, live refresh deferred to P2 system-scope ETL (public Class-P rows only — documented iron-rule carve-out); honesty rules non-negotiable (bands never point probabilities, every stat as-of+cited, copy-lint blocklist, no "guarantee" language); transcript releases carry a `release_authorization_integrity` CHECK + authority flips to student at 18 (lazy DOB check); test scores manual+upload-verified, hard ban on CollegeBoard/ACT scraping encoded by absence. (2) W16 child_id-scoped; extractor writes with `dedupe_key` ON CONFLICT DO NOTHING; `source_message_id` is a claim column (FK added by the comms pipeline's migration); deterministic lead-time map per kind. (3) W22 scoping = new minimal `health_subjects` person registry (owner_user_id anchor + subject_id) — NOT a second membership system; `child_access` stays the single source of truth, access funnels through `current_child_ids()`; per-metric visibility via `health_metric_visible()` predicate; 13–17 sensitive-default-private + audited safety override (parent-only insert, 20-char reason minimum, teen notified in-transaction, override reads audited); W22 = data layer, W2 = interpretation (neither writes the other's tables); Dexcom real API via Edge Functions (tokens in Vault), BP/Libre/Accu-Chek manual v1; wellness-only guardrails (no diagnostic/dosing endpoints exist, deterministic phrase blocklist, trends-only framing). (4) W23 rides `health_subjects`; photo estimates must store uncertainty ranges (route refuses without them); `nutrition_targets` CHECK has no deficit kind — under-18 weight-loss mode unrepresentable in schema; parents get `nutrition_weekly_patterns()` aggregates-only RPC, never the diary; real-food-first as data (`food_swaps` seed + deterministic supplement gate); Nutritionix primary, USDA backstop, Open Food Facts barcode. (5) New `assertHealthSubject()` helper spec'd (append-only in `src/server/tenant.ts`); 7 new Edge Functions named with contracts. (6) Demo/conflict flags: no changes needed to middleware.ts/tenant/actions.ts/page.tsx (no conflict with demo agent expected); M1/M2 from the security audit still gate role-based routes; DBA sequencing 009→010→011→012.
**For team:** DBA owns 009–012 + 2 new private buckets (`test-score-reports`, `nutrition-photos`) + `security_invoker` on the two new views; backend owns routes + `assertHealthSubject()` + Edge Functions; frontend owns 8 UI routes + copy-lint CI check; QA owns the honesty (§1.4) + teen-safety (§4.3) checklists.
**Blocked on:** nothing — spec is complete; 12 open questions all carry recommendations.

## 2026-10-11 — Technical Architect: MODULE-ARCHITECTURE-BATCH2.md STARTED (W5/W16/W22/W23 spec)

**Claiming migrations 009–012** (006–008 taken by batch 1): `009_college_prep.sql` (W5) → `010_school_minutiae.sql` (W16) → `011_health_tracker.sql` (W22) → `012_nutrition_tracker.sql` (W23; depends on 011's `health_subjects`).
**Spec in progress.** Key decisions already locked for the doc: (1) W5 child_id-scoped; College Scorecard = static v1 seed with as-of dates, live refresh deferred to a P2 system-scope ETL (public Class-P data only — documented iron-rule carve-out); transcript releases carry a DB CHECK mirroring `dispute_approval_integrity`; (2) W16 child_id-scoped, extractor writes with `dedupe_key` ON CONFLICT DO NOTHING; (3) W22 scoping = new minimal `health_subjects` person registry (owner_user_id anchor + subject_id), NOT a second membership system — `child_access` stays the single source of truth; per-metric visibility with teen 13–17 sensitive-default-private + audited safety override per the founder-locked guidance contract; W22 is the data layer, W2 the interpretation (seam contract: neither writes the other's tables); (4) W23 rides `health_subjects`; photo estimates must store uncertainty ranges (route refuses without them); no deficit targets under 18 (route-enforced); parents get a `nutrition_weekly_patterns` aggregates-only RPC, never the diary.
**For team:** nothing to implement until the spec lands — DBA holds 009–012.

---

## 2026-10-11 — Security Engineer (Phase 1 prep — batch-2 security review checklist)

**Delivered:** new "Phase 1 — Security Review Checklist for Batch 2 (W5, W16, W22, W23)" section appended to `docs/SECURITY-BASELINE-AUDIT.md` (sections A–G): universal gates (RLS/GRANTs/definer-fn hygiene/route pattern/service_role allowlist/data_class + retention_class/no secrets in seeds/audit-detail values ban/L3 throttles/storage bucket rules), W22 health (privacy tiers as RLS with parent-JWT negative tests, no-silent-backdoor suite, audited minimum-necessary safety override with server-attributed audit rows, no-diagnosis/no-dosing enforcement at code+schema level, rollup-only cross-module reads, Dexcom tokens in the vault, HMAC'd webhooks), W23 nutrition (teen diary-vs-patterns RLS split, under-18 weight-loss target unrepresentable via CHECK on `children.dob` + route refine, Nutritionix key server-only), W5 transcripts (state machine as CHECK constraints, per-college/per-document binding, authority flip at 18 tested both sides of the birthday boundary, disclosure accounting), W16 minutiae (per-child scoping, tenant-bound dedupe keys), baseline touch points (M2 fail-open role default is a MERGE BLOCKER for batch-2 routes given the heavy parent/child role gating; M1 agent-JWT landmine — no agent_reader grants on health tables; L1 actor_kind coercion extended to safety-override/release audit codes; L3 throttles on ingestion/simulator endpoints; L4 seed hygiene), and the Phase 2 sign-off procedure (line-by-line diff review, JWT negative-test matrix, grep gates, binary PASS/FAIL — nothing ships to staging without sign-off).
**Standing by for:** migrations 009–012 + new routes (W5/W16/W22/W23) from the DBA and devs — I am the gate before staging deploy.

---

## 2026-10-11 — SQL DBA: migrations 006/007/008 (W1/W20/W21 schema)

**Delivered (files only — NOT applied to any live DB):**
- `supabase/migrations/006_w1_school_core.sql` — W1, all `child_id`-scoped: `grades` (read-only tenant; sync via service_role), `grade_snapshots` (append-only, 13-mo retention planned), `assignments` (parent-write manual rows + sync; unique `(child_id,class_id,source_id)`), `due_next` view **`WITH (security_invoker = true)`** (tenant-leak flag per spec — DBA-verified present; Security Engineer to confirm via `\d+`), `study_plans` (child-role SELECT gated on `safety_status='approved'`, fail-closed — policy implemented verbatim per spec), `teacher_messages` (parent draft/approve/send), `checkins` (any tenant member INSERT/UPDATE; no DELETE).
- `supabase/migrations/007_w20_shopping.sql` — W20, all `owner_user_id`-scoped (NO `households` table, NO `child_id`): helpers `household_owner_for_child()` (billing anchor + earliest-parent fallback) and `is_household_member()` (owner arm + `current_child_ids()` funnel — the single-membership-system decision); `shopping_lists` (UNIQUE owner, owner-only writes), `shopping_items` (states needed→claimed→bought + `removed`, ledger-like; INSERT requires `added_by=auth.uid()`; NO DELETE policy/grant), `shopping_price_reports` (append-only: no UPDATE/DELETE). W20 `data_class='T'` defaults on all 3 tables (spec §4.4); seams present: `source`/`source_ref` (W13), `ledger_entry_id uuid` with **no FK** (W11 adds it later).
- `supabase/migrations/008_w21_mail.sql` — W21, all `owner_user_id`-scoped, parent-only: `is_household_parent()` (membership + parent role); `mail_ocr_providers` registry (public read like `school_systems`; seeded with local `workers-ai-vision` active, externals ship inactive) + `GRANT SELECT TO anon`; `mail_items`, `mail_action_items`, `mail_dispute_drafts` — all 8 Class-S properties enforced: `data_class='S'` on all 3 tables, `account_last4` only, `photo_path` into new private **`mail-photos`** storage bucket (created here, re-runnable; storage RLS predicate per spec — defense-in-depth since v1 uploads via service_role), `external_ocr_consent` gate, parent-only RLS, no client DELETE anywhere, `ocr_text` excluded from list payloads (route contract). `dispute_approval_integrity` CHECK constraint present (approved/sent impossible without frozen `approved_text` + `approved_by`). Seam: `ledger_entry_id uuid`, no FK (W11).
**Conventions followed:** `CREATE TABLE/INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` before every `CREATE POLICY`, drop-then-add for the CHECK constraint, explicit least-privilege GRANTs (anon: nothing except the 2 registry reads), no table audit triggers, all definer fns pin `search_path = public` + `REVOKE ALL FROM PUBLIC`.
**Spec deviations:** none. 3 files sufficed — no 009 needed.
**For Security Engineer:** Phase 2 review requested — especially `study_plans` child-gate predicate, the `security_invoker` flag, `is_household_member` owner arm, `is_household_parent` parent-only gate, and the storage policies. **M1** (agent JWT `sub` handling) confirmed app-code, NOT a migration — no SQL change made.
**Not verified:** no local Postgres available — migrations are spec-faithful but not syntax-executed. Recommend a dry-run apply on a scratch project before the live `pookie` project.

---

## 2026-10-11 — Technical Architect: MODULE-ARCHITECTURE.md (W1/W20/W21 spec)

**Delivered:** `docs/MODULE-ARCHITECTURE.md` (563 lines) — data models, API contracts, cross-module seams, UI route map, 10 open questions with recommendations, DBA checklist. Unblocks DBA (migrations 006–008), backend, frontend, edge/worker, QA.
**Key decisions:** (1) W20/W21 household scoping = `owner_user_id`-anchored, NO `households` table, NO `child_id` — membership derived from `child_access` via new `household_owner_for_child()` / `is_household_member()` / `is_household_parent()` helpers, so `child_access` stays the single source of truth and co-parenting (2 parents, 1 shared child → 2 lists) works. (2) Letters never stored — numeric only; `src/lib/grades.ts → letterGrade()` is a frontend TO-DO (util doesn't exist in repo yet; verified). (3) Class S in schema terms = 8 enforceable properties (`data_class` column, last-4 only, private bucket + path-only column, per-document external-OCR consent gate, parent-only RLS, audited reads, no client DELETE, no OCR text in list payloads). (4) No per-table audit triggers — route-level `audit_event()` per platform convention; one exception: audited reads on mail detail. (5) OCR = pluggable `OcrProvider` interface in new `supabase/functions/mail-ocr` Edge Function + `mail_ocr_providers` registry; deterministic date/amount extraction verified against raw text; handwriting → human review. (6) New `/household/*` UI namespace (`/household/shopping` all-roles, `/household/mail*` parent-only) — never under `/c/[childSlug]`. (7) New `assertHousehold()` helper spec'd for `src/server/tenant.ts`; `dispute_approval_integrity` CHECK constraint enforces "AI drafts, parent acts" at the DB layer.
**For team:** DBA owns 006/007/008 + `mail-photos` bucket + `security_invoker` on the `due_next` view (flagged as a leak risk without it); backend owns routes + `assertHousehold()`; frontend owns `letterGrade()` + routes; worker owns `mail-ocr`.
**Blocked on:** nothing — spec is complete; 10 open questions all carry recommendations.

---

## 2026-10-11 — Security Engineer (Phase 1 baseline audit)

**Audited:** migrations 001–005 (all RLS policies + 23 SECURITY DEFINER fns), all 4 `/api/v1` routes, `src/server/rest.ts`, `src/server/tenant.ts`, `src/lib/supabase/*`, `src/lib/tenant/actions.ts`, `middleware.ts`, demo-mode gating, service_role grep, `.env*`/deploy env hygiene.
**Verdict:** no CRITICAL/HIGH. 2 MEDIUM + 6 LOW. Full writeup: `docs/SECURITY-BASELINE-AUDIT.md`.
**MEDIUM:** (M1) agent JWT `sub='muse-agent'` is non-UUID → `auth.uid()` raises instead of failing closed; breaks the agent's `audit_event` path and makes `child_portals_public` error for the agent — fix by minting agent JWTs with a UUID sub before the agent read path goes live. (M2) `assertTenant` defaults role to `'parent'` on missing access row (tenant.ts:59) — fail-open default, no live exploit (RLS is the real gate, `assertParent` unused) but must flip to least-privilege before any route gates on `ctx.role`.
**LOW:** L1 `audit_event` actor_kind caller-forgeable; L2 `audit_log.detail` secret guard is top-level-keys only (known); L3 no rate limiting on `/api/v1` (codes defined, unenforced); L4 `school_systems` anon-readable — never seed secret values there; L5 parent can grant parent-role access rows without handshake (accepted intra-tenant trust); L6 demo-mode prod safety rests on build-time env var — code gating correct, needs CI assertion + Pages prod settings check.
**Clean (verified):** service_role only in `admin.ts` (server-only); RLS on all 12 tables; all definer fns pin `search_path`; all tenant policies funnel via `current_child_ids()` (fail-closed); invite flow, vault RPCs, audit authz all re-verified; routes follow resolve→assert→use→audit with no oracle leaks.
**Next:** standing by for Phase 2 — will review migrations 006+ and new routes (W1/W20/W21) against the checklist in the audit doc before staging deploy.

---

## 2026-10-11 — Backend rework (tRPC → REST, per ADR-001/ADR-004)

**Converted:** tRPC procedures → REST Route Handlers. `GET /api/v1/children` (was `children.listMine`), `GET /api/v1/children/[childId]` (was `children.get`), `POST /api/v1/invites/consume` (was `invites.consume`, new route), `POST /api/v1/tutor/chat` (unchanged surface). New `src/server/rest.ts`: shared wrapper (requestId, session auth, canonical envelope, Zod→400) + best-effort `auditEvent()` via `audit_event()` RPC. Every route: resolve → assert (`assertTenant`) → use → audit.
**Deleted:** `src/app/api/trpc/`, `src/server/trpc.ts`, `src/server/routers/`, `src/lib/trpc/`; removed `@trpc/*`, `@tanstack/react-query`, `superjson` from package.json. `errors.ts`: `ApiError` + `failWith()` replace `TRPCError`/`trpcError`. Edge-safe: Web Crypto `randomUUID`, no node: imports in routes. `SUPABASE_SERVICE_ROLE_KEY` referenced only from `src/lib/supabase/admin.ts` (grep-verified).
**Verified:** `tsc` clean, `eslint` clean, `next build` green (4 dynamic API routes). Pushed to main (`e15589d`).
**Notes for team:** frontend's `src/lib/tenant/actions.ts` (Server Actions, anon-key + RLS, HttpOnly cookies) is compliant with amended ADR-002 — left untouched; its `consumeInvite` action and the new REST endpoint are both thin adapters over the `consume_invite()` RPC (per the services/children.ts adapter pattern). `src/server/machine.ts` kept (unused today, but it's the documented service_role allowlist pattern for the upcoming worker-webhook work — flagging, not forgetting). List endpoint `GET /api/v1/children` is not per-child audited (audit_event requires a single child_id; RLS scopes the read) — deliberate exception to the audit step. Pod's handbook/docs/audit edits left uncommitted in the tree for their owners.
**Blocked on:** nothing in code — live-DB verification still pending migrations on the `pookie` project.

---

## 2026-10-11 — Senior Full-Stack Developer

**Foundation built + design language applied:**

**Removed (scaffold dead weight):**
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` — template SVGs, unused
- Replaced `src/app/page.tsx` template hero entirely (now the tenant router)
- Stripped `src/app/globals.css` template theme down to the Pookie token system

**Built:**
- Supabase singleton clients: `src/lib/supabase/client.ts` (browser, module singleton — never per-call), `server.ts`, `middleware.ts`; root `middleware.ts` refreshes sessions
- Tenant layer: `src/lib/tenant/types.ts`, `actions.ts` (getMemberships, setActiveChild via HttpOnly cookie, consumeInvite via rpc, signOut), `src/components/tenant-provider.tsx` (React context)
- Routes: `/` (tenant router: 0→login, 1→direct, N→switcher), `/login` (OTP magic-link + landing), `/auth/callback`, `/select-child` (parents only), `/c/[childSlug]` (slug-routed dashboard shell + skeleton)
- `src/components/pookie-orb.tsx` — Pookie as a ball of light: breathing golden-green orb, halo, slow-turning light rays

**Design tokens (nature + divine light) — `src/app/globals.css`, Tailwind v4 `@theme`:**
- Canopy (bg): `canopy-950 #060f0a` → `canopy-700 #173322`
- Leaf (brand): `leaf-300 #86efac` → `leaf-700 #15803d`
- Moss (soft): `moss-200 #bbf7d0`, `moss-300 #86efac`
- Dew (highlights): `dew-100 #ecfdf5`, `dew-200 #d1fae5`
- Sunlight (warm gold): `sunlight-200 #fef3c7` → `sunlight-400 #fbbf24`
- Halo (divine): `halo-100 #fffbeb` → `halo-300 #fde68a`
- Bark (text): `bark-100 #e8f5ee`, `bark-300 #b8d4c2`, `bark-500 #7d9b88`
- Shadows: `shadow-glow-sm/md`, `shadow-sun-warm`, `shadow-halo-sm/md`
- Motion: `animate-bloom`, `animate-breathe`, `animate-sway`, `animate-dapple`, `animate-rise`, `animate-halo-spin`, `animate-ascend` — all disabled under `prefers-reduced-motion`
- Utilities: `.text-sunlit`, `.btn-dapple`, `.card-living`, `.input-rooted`, `.halo`, `.light-rays`, `.firefly`, `.ascend-particle`

**Build:** `npm run build` green. Note: installed missing `superjson` etc. from package.json (arch pod added deps without installing). Next.js 16 note: tenant routes use `export const instant = false` (the `dynamic` export is incompatible with cacheComponents).

**Blocked on:** Supabase migrations still under audit (did not touch `supabase/migrations/`); auth flow untested until migrations land.

---

## 2026-10-11 — DevOps Manager

**Pipeline live (this commit):**
- `.github/workflows/ci.yml` — lint + typecheck + build on push/PR to `main`; reusable via `workflow_call`
- `.github/workflows/deploy-staging.yml` — auto-deploys `pookie-staging` on push to `main` (after CI gate), then `?v=` version check
- `.github/workflows/deploy-production.yml` — MANUAL ONLY (`workflow_dispatch` + `VERIFIED` input). Founder's staging-first rule enforced.
- `scripts/verify-asset-version.sh` — post-deploy `?v=` guard: fails on mixed versions, warns if versioning not yet implemented (d-dash lesson)
- `package.json`: added `typecheck` script (`tsc --noEmit`)
- `.env.example` — reconciled with backend: tutor URL is server-only `POOKIE_TUTOR_URL` (proxy pattern, never in client bundle)

**Docs:**
- `docs/CLOUDFLARE-SETUP-CHECKLIST.md` — founder provisions 2 Pages projects, env vars, 4 GitHub secrets (`CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POOKIE_TUTOR_URL`). Auto-deploy DISABLED on Pages (Actions drive deploys via wrangler).
- `docs/ENV-MANAGEMENT.md` — env separation plan, `?v=` mechanism spec, local dev instructions.

**ESCALATED to Managing Director — architecture decision blocking first deploy:**
Static export (`./out` deploy, proven d-dash pattern) vs. server runtime (`@cloudflare/next-on-pages`).
The backend scaffold has API routes + server-only env usage, which need a runtime; static export has none.
My pipeline assumes static export until decided. Recommend: decide before Cloudflare provisioning.

**Handoffs:**
- Frontend: implement `?v=` append from `NEXT_PUBLIC_ASSET_VERSION` (spec in `docs/ENV-MANAGEMENT.md`); confirm `output: "export"` vs next-on-pages per the decision above.
- Founder: `docs/CLOUDFLARE-SETUP-CHECKLIST.md` is ready for provisioning.

---

## 2026-10-11 — Senior Backend Developer

**API-layer decision (ratified, not relitigated):** tRPC v11 for app-internal traffic, versioned REST
(`/api/v1`) for machine clients (Python workers, crons), Server Actions for UI-initiated mutations.
Adopts `docs/handbook-sections/01-api-conventions.md` §2 recommendation. Rationale: d-dash-app team
precedent (tRPC v11 in prod), end-to-end type safety, single inheritable `tenantProcedure`
middleware. Reconciliation with the technical architect's ADR still open — the three
non-negotiables (inheritable tenant middleware, generated client types, zod at every boundary) are
met by this choice.

**Built (this commit):**
- `src/lib/supabase/{client,server,admin}.ts` — browser singleton (per AGENTS.md lesson),
  server client (SSR cookies), service_role admin client (server-only, throws if bundled).
- `src/server/errors.ts` — canonical error-code registry (`TENANT_SCOPE_VIOLATION`, etc.),
  DB-exception → code mapping, HTTP status mapping. Raw Postgres messages never reach clients.
- `src/server/tenant.ts` — `assertTenant()` / `resolveChildSlug()`: resolve → assert →
  child_id. Used by every entry point.
- `src/server/trpc.ts` — tRPC init, `tenantProcedure` middleware (asserts `childId` input against
  `child_access` via RPC/session), request-id + error shaping.
- `src/server/routers/{_app,children,invites}.ts` — `children.listMine`, `children.get`,
  `invites.consume` (wraps `consume_invite()` RPC with error mapping).
- `src/server/services/children.ts` — framework-free business logic (thin-handler rule).
- `src/app/api/trpc/[trpc]/route.ts` — tRPC fetch handler.
- `src/app/api/v1/children/[childId]/route.ts` — example versioned REST (user session).
- `src/app/api/v1/tutor/chat/route.ts` — proxy stub → `pookie-tutor-v2` (tenant-scoped server-side;
  worker URL stays out of the client bundle).
- `src/lib/trpc/client.tsx` — minimal React Query + tRPC provider (frontend dev: wire into layout).
- `supabase/functions/{verify-credential,worker-webhook}/index.ts` — STUBS ONLY. No secrets logic
  until the migration audit signs off (C2/C3, H1/H2 open).
- `.env.example` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only), `POOKIE_TUTOR_URL`. No real keys committed.

**Migration review (read-only, per orders):** did NOT re-audit — engineering pod's audit findings
(`docs/audit-findings/backend-dev.md`: C1, C2, C3, H1–H4) already cover 001/004/005 deeply and are
more thorough than a second pass would add. Flagging for the record: C1 (invite privilege
escalation), C2 (agent_tenant_scope RLS off), C3 (agent_reader blind-or-bypassed) are the three
that gate any backend work touching invites/agent paths. My scaffold avoids those paths (invites
go through the existing RPC; agent reads not yet built).

**For Frontend dev:** `useTRPC()` from `src/lib/trpc/client.tsx`; every procedure takes
`{ childId }` — resolve the active child slug→id via `children.listMine` first. Error envelope is
`{ ok, error: { code, message, requestId } }` — map `code` to UI copy, never show raw messages.

**For DevOps:** new env vars needed (see `.env.example`). `SUPABASE_SERVICE_ROLE_KEY` must be set
in Cloudflare Pages env (never `NEXT_PUBLIC_`). tRPC route is edge-compatible (fetch handler, no
Node APIs).

**Blocked on:** migration audit sign-off (engineering pod) before building anything on
`consume_invite` hardening, `get_tenant_secret`, or agent paths. Nothing else.

### 2026-10-11 (later) — Senior Backend Developer: typecheck/lint fixes

- Fixed `src/lib/trpc/client.tsx` for the tRPC v11 API (`createTRPCReact`, no `TRPCProvider`
  export) and installed the missing `superjson` dep.
- Excluded `supabase/functions` (Deno) from the Next.js `tsconfig.json`.
- Fixed a type error in the frontend dev's `src/lib/tenant/actions.ts` (`row.children` is an
  array under the `!inner` join) — minimal fix, build now passes `tsc --noEmit` + `eslint` clean.
  Frontend dev: yours to review.
- `tsc --noEmit` ✅ · `eslint` ✅ on all touched paths.
- Pushed to `mmkamal411/pookie` main (`44e3043`). **Blocker for DevOps:** the GitHub token
  lacks `workflow` scope, so `.github/workflows/ci.yml` was rejected on push and is held
  locally (untracked). CI workflow needs a token with workflow scope or manual upload.

---

## 2026-10-11 — Coordinator (batch-2): migration fork resolved

**Schema fork detected and killed.** A competing untracked migration set appeared (`010_school_minutiae.sql`, `011_health_tracker.sql`, `012_nutrition_tracker.sql`, `013_college_prep.sql`) with divergent table names (`school_minutiae` vs DBA's `school_events`). Halt orders sent to all three batch-2 devs: canonical schema is the DBA's committed 009–012 set (commit `aefd4b2`); devs rework to DBA table names; `next build` must go green.

**009 collision resolved:** `009_sync_queue.sql` (batch-1 Python dev, no log claim) → renumbered to `013_sync_queue.sql` (commit `316255d`). Batch-2 claimed 009–012 first in this log. Neither file applied to any live DB — safe.

**Competing fork removed** (commit `a3c3a6e`): `011_health_tracker.sql`, `012_nutrition_tracker.sql`, `013_college_prep.sql` deleted. `010_school_minutiae.sql` was already removed from the tree.

**Final migration map:** 001–005 foundation · 006–008 batch-1 (W1/W20/W21) · 009–012 batch-2 DBA canonical (W5/W16/W22/W23) · 013 sync queue. No duplicates, no forks.

**Still open:** `docs/MODULE-ARCHITECTURE-BATCH2.md` was never committed by the architect — DBA built from the task brief + log entries. Doc needs to land in the repo.
