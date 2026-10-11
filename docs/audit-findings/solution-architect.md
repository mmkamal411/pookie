# Architecture Coherence Audit — Migrations 001–005

**Reviewer:** Solution Architect, Pookie engineering pod (Architecture coherence component)
**Date:** 2026-10-11
**Scope:** read-only review of all five migrations
(`001_tenancy_core.sql`, `002_school_systems.sql`, `003_credential_vault.sql`,
`004_compliance.sql`, `005_agent_access.sql`) against PLAN.md §3.1 (schema),
§3.7 (build order), and §4 (multi-tenant architecture: §4.1 identity→tenant,
§4.3 non-crossing proof, §4.8 vault, §4.9 adapters, §4.10 agent boundary).
Nothing in the migrations was edited.
**Method:** full read of each migration + PLAN.md §§0–4.11; targeted greps to verify
structural claims (e.g. no policy references `children.parent_user_id` — confirmed).

**Headline verdict: the foundation is coherent and the core tenancy model is
faithful to the plan — but it is not shippable as a set.** Five HIGH findings
(H1–H5) break explicit plan promises (storage RLS, `rpc_claim_sync`, the agent
boundary, the Vault read boundary, and NULL-child portal isolation), plus one
corroborated HIGH (H6, sibling-filed) that leaks cross-tenant portal metadata
through a view. The ~20 carried-over tables are correctly absent (they belong to
the ETL migration — see the deferred-by-design contract at the end), but
`rpc_claim_sync` and `worker_children` should have been specified or shipped
with this set. **Recommendation: fix H1–H6 and M1–M4 before the ETL migration
is written**, because the ETL migration must build on the corrected contracts
(RPC signatures, storage paths, agent scope wiring).

Sibling findings I corroborate from the architecture side: frontend-dev **F1/F2**
(invites writable by child-role users; `child_id IS NULL` self-provisioning loop)
and ui-fullstack **HIGH-1/HIGH-2** (view RLS bypass; allowlist inserts with zero
membership). I do not re-argue them below; I add the coherence implications.

---

## Corroborated sibling findings (architecture implications)

- **frontend-dev F1** (`invites_parent_write` not role-gated — child-role users can
  mint invites): breaks PLAN §4.2's load-bearing assumption "parent controls all
  disclosure" and §4.1 "child_access … writable by parents + invite-consumption
  function". A child-issued invite is a minor-initiated data-sharing path to
  third parties. Endorse severity CRITICAL; fix as frontend-dev recommends
  (add `role='parent'` to USING/WITH CHECK).
- **frontend-dev F2** (`child_id IS NULL` invite → `consume_invite` child-shell =
  open self-provisioning): contradicts the §4.1 closed-tenancy login flow
  ("0 rows → pending-invite state"). Needs the Director decision frontend-dev
  requests before the invite UI is built.
- **ui-fullstack HIGH-1** (`child_portals_public` without `security_invoker=true`
  bypasses RLS — view executes with the superuser owner's rights): I verified the
  mechanism independently — the view is the only view in the five migrations, it
  is owned by the migration superuser, and the base-table RLS is bypassed for
  view queries. Net effect: any `authenticated` user (and `agent_reader`) can
  read **every tenant's** portal metadata. This voids the §4.8 tenant boundary
  for portal metadata. Endorse HIGH; fix is `WITH (security_invoker = true)` or a
  tenant-filtered definer function. Filed below as **H6** for tracking.
- **ui-fullstack HIGH-2** (allowlist inserts with zero membership): same root as
  F2; endorse.

---

## HIGH

### H1. Storage: `class-files` bucket + `storage.objects` RLS are entirely absent
- **Location:** none of the five migrations; PLAN.md §3.1 RLS section: "Storage:
  new `class-files` bucket, paths `<uid>/<child-slug>/<class>/<yyyy-mm-dd>/<file>`,
  RLS on uid + slug." Also §3.4 cutover step 7 and §3.3 ETL ("storage copy")
  depend on it.
- **Finding:** No `storage.buckets` insert, no `storage.objects` policies. The
  Study Materials feature (uploads per class page) has no tenant-secured home.
  Shipping the app without this means uploads either fail or land in an
  unprotected bucket.
- **Secondary:** PLAN §3.1 says paths `<uid>/<child-slug>/…` while §4.7 risk 7
  says "bucket paths become `<child_id>/…`". The ETL plan (§3.3) uses
  `<new_uid>/dawson/…`, consistent with §3.1. Adopt §3.1 as canonical; the slug
  is human-debuggable and the uid binds the Supabase Auth owner.
- **Recommendation:** new migration `006_storage.sql`: create bucket `class-files`
  (private), policies on `storage.objects` enforcing
  `(storage.foldername(name))[1] = auth.uid()::text` AND foldername[2] ∈ slug of a
  child in `current_child_ids()` (resolve slug→child server-side, never trust the
  path segment alone).

### H2. `rpc_claim_sync` is missing — the non-crossing proof has no DB anchor
- **Location:** absent; PLAN.md §3.1 "RPCs: new `rpc_claim_sync(p_worker_id text,
  p_child_ids uuid[])` with `FOR UPDATE SKIP LOCKED` (rejects empty whitelist)";
  §3.7 build order puts "schema (+ RLS + RPCs)" in this phase; §4.3 non-crossing
  proof and §3.4 cutover step 7 depend on it.
- **Finding:** The single most load-bearing RPC in the architecture does not
  exist. Yes, it claims rows from `sync_requests`, a carried-over table that
  does not exist yet — so it cannot be fully shipped here. But its **signature
  contract** should have been specified now (it is referenced by §4.3, §4.8,
  and the worker runbook), and nothing flags it as a tracked deferred item.
  As written, the worker flow is unimplementable and the §4.3 "starvation, never
  leakage" guarantee is prose without an enforcement point.
- **Recommendation:** (1) Record the contract now: `rpc_claim_sync(p_worker_id
  text, p_child_ids uuid[]) RETURNS sync_requests` — rejects empty `p_child_ids`
  (`RAISE EXCEPTION 'empty_whitelist'`), `SELECT … FOR UPDATE SKIP LOCKED`
  oldest pending row `WHERE child_id = ANY(p_child_ids)`, stamps
  `claimed_by`/`claimed_at`. (2) Ship it in the ETL migration that creates
  `sync_requests`, with a test that an empty whitelist raises and that two
  concurrent workers never double-claim. (3) The write-path assertion ("every
  write carries `claimed.child_id`, fails closed") lives in worker code — add it
  to the worker acceptance checklist; the DB cannot enforce it for service_role.

### H3. Agent boundary (§4.10) is specified but not wired — `agent_reader` cannot work as designed
- **Location:** `005_agent_access.sql`; PLAN.md §4.10.
- **Finding:** The migration grants SELECT and creates `agent_tenant_scope` +
  `agent_assert_scope()`, but **no RLS policy consults `agent_tenant_scope`**.
  Every tenant policy keys on `current_child_ids()`, which reads `child_access`
  by `auth.uid()`. The agent is not a `child_access` member ("the agent
  authenticates as itself"), so `current_child_ids()` returns `'{}'` and **every
  agent read is denied**. Failure is closed (safe — no leak), but §4.10's core
  promise (scoped agent reads for merge jobs, briefings, support) is
  non-functional. The only way reads succeed today is a JWT whose `sub` is a
  real member user — which grants that user's *whole* tenant set, ignoring the
  per-job scope, and nothing forces callers to invoke `agent_assert_scope()`.
- **Recommendation:** Director-level design decision, then a follow-up migration.
  Cleanest option: extend the helper — when `current_setting('request.jwt.claims')`
  carries `role='agent_reader'` and a `job_id` claim, return the (unexpired)
  `agent_tenant_scope.child_id` for that job instead of the `child_access`
  lookup. Keep `agent_assert_scope()` as the write-path guard. Add a negative
  test: expired scope row ⇒ denied.

### H4. `get_tenant_secret` lets parent JWTs read plaintext secrets — contradicts §4.8
- **Location:** `003_credential_vault.sql` → `get_tenant_secret`, the
  `OR EXISTS (… role='parent' …)` branch; PLAN.md §4.8: "only service_role +
  credential-test Edge Function read Vault" and "The Edge Function never returns
  the secret value."
- **Finding:** Any parent-role user can call the RPC directly via PostgREST and
  receive the **decrypted portal password** — for any child in their tenant set.
  The plan's §3.1 RPC description ("asserts tenant membership first") is
  ambiguous, and the migration resolved the ambiguity toward the loose reading,
  contradicting §4.8's explicit boundary. (The parent's *own* credential is at
  issue, so this is a boundary violation, not a cross-tenant leak — but the
  plan drew the line deliberately: read-back enables silent exfiltration, and
  **no `audit_event` is emitted on credential reads**, the most sensitive read
  in the system.)
- **Recommendation:** tighten to service_role-only; the credential-test Edge
  Function calls it with the service_role key after performing its own parent
  check (which §4.8 already requires it to do). Add `audit_event()` logging to
  both `get_tenant_secret` and `set_tenant_secret` (who/what/when, never the
  value). `set_tenant_secret` stays parent-callable (write path is correct).

### H5. NULL-`child_id` portal rows are cross-tenant readable/writable
- **Location:** `003_credential_vault.sql` → `child_portals_parent_all`; PLAN.md
  §3.1: "`child_id` NULLABLE (NULL = parent-level ParentVUE covering all children)".
- **Finding:** For a NULL row, the policy's EXISTS clause reduces to "caller is a
  parent in *any* tenant". A parent of family B can SELECT/UPDATE/DELETE family
  A's parent-level portal row, and `set_tenant_secret(NULL, …)` names the Vault
  secret `tenant_parent__<portal_key>` — **one shared name across all families**,
  so family B's write overwrites family A's secret. `get_tenant_secret`'s
  `OR cp.child_id IS NULL` fallback then hands family A's ParentVUE password to
  family B's worker. The NULL convention is unscoped: "parent-level" is not bound
  to any family. Invisible at N=1; a genuine isolation break at N=2 — directly
  against the multi-tenant core pillar.
- **Recommendation:** replace the NULL convention before the second tenant.
  Options: (a) `owner_user_id` on parent-level rows (RLS: owner or parents
  sharing the owner's tenant set); (b) drop parent-level portals in Phase 1 and
  require per-child rows (ParentVUE credential duplicated per child — the worker
  already fetches per claim). Also fix the unique constraint (see M3): NULLs
  bypass `UNIQUE(child_id, portal_key)`.

### H6. `child_portals_public` view bypasses RLS (corroborated, ui-fullstack HIGH-1)
- **Architecture implication:** the secret-less-view pattern is the plan's
  chosen column-hiding mechanism (§3.1: "secret-less view / column GRANTs — RLS
  alone doesn't hide columns"). As shipped, the pattern is inverted: the view
  *removes* the tenant filter instead of preserving it. Any `authenticated` user
  enumerates all tenants' portal metadata (usernames, labels, statuses).
  Metadata is not the password, but usernames + portal labels across families is
  a cross-tenant disclosure of minors' school-account metadata.
- **Recommendation:** `ALTER VIEW … WITH (security_invoker = true)` (PG15+) and
  a regression test: authenticated user of tenant B gets zero rows from the view
  for tenant A's portals. Re-audit after fix.

---

## MEDIUM

### M1. `worker_children(worker_id, child_id)` table missing
- **Location:** absent; PLAN.md §3.1 lists it as a **new** table (not carried-over),
  and §4.3 references it ("served-set via `worker_children`").
- **Finding:** Unlike `rpc_claim_sync`, this table has no dependency on
  carried-over tables and should have shipped here. It is the DB-side record of
  which worker may serve which child — the whitelist `rpc_claim_sync` enforces.
  Without it, worker→child authorization lives only in laptop config files.
- **Recommendation:** add in `006` (or the ETL migration): `(worker_id text,
  child_id uuid REFERENCES children, PRIMARY KEY (worker_id, child_id))`,
  parent-managed RLS, and have the worker resolve its claim whitelist from it
  at startup (fail closed on empty).

### M2. `teacher_contacts` table missing
- **Location:** absent; PLAN.md §3.1 lists it as a new table.
- **Finding:** The teacher-comms subsystem (contact log, courtesy nudges, reply
  tracking) has no DB home. No carried-over dependency; should have shipped here.
- **Recommendation:** add in `006`: `(child_id, teacher_name, teacher_email,
  class_slug, last_contact_at, …)` tenant-scoped via `current_child_ids()`.

### M3. `UNIQUE(child_id, portal_key)` does not constrain NULL rows
- **Location:** `003_credential_vault.sql`.
- **Finding:** In Postgres, `NULL ≠ NULL`, so unlimited duplicate
  `(NULL, 'parentvue')` rows are allowed — compounding H5.
- **Recommendation:** replace with two partial unique indexes:
  `ON (portal_key) WHERE child_id IS NULL` and `ON (child_id, portal_key) WHERE
  child_id IS NOT NULL` (or keep single index on
  `(COALESCE(child_id, '00000000-0000-0000-0000-000000000000'), portal_key)`).

### M4. No INSERT path for an existing parent adding a second child
- **Location:** `001_tenancy_core.sql` → `children_parent_write (FOR ALL)`.
- **Finding:** `USING (id = ANY(current_child_ids()) …)` on a not-yet-existing
  row can never be true, so a parent with one child cannot INSERT the second —
  except via `consume_invite` (which only covers the new-family case, and mints
  placeholder `'New'/'Child'` rows). PLAN §4.11's Add-a-child wizard ("built but
  gated") has no DB path.
- **Recommendation:** a SECURITY DEFINER `add_child(…)` function: asserts caller
  is a parent in good standing, inserts the `children` row + `child_access` row
  + `child_settings` row atomically, returns the id. (Also fixes the L2 gap
  below for wizard-created children.)

### M5. No UPDATE policy on `public.users`
- **Location:** `001_tenancy_core.sql` (only a SELECT policy).
- **Finding:** Nobody — not even the row owner — can update `display_name`.
  PLAN §4.11 "Child settings → Profile" implies profile management; the trigger
  default (`split_part(email,'@',1)`) will embarrass someone eventually.
- **Recommendation:** `users_self_update`: `FOR UPDATE USING (id = auth.uid())`
  (never allow `role` changes through it — role is invite-driven).

### M6. Credential reads/writes are not audit-logged
- **Location:** `003_credential_vault.sql` (`get_tenant_secret`,
  `set_tenant_secret` never call `audit_event`); PLAN §4.8 silent, §4.10 covers
  agent reads only.
- **Finding:** The most sensitive operation in the system — plaintext portal
  password retrieval — leaves no FERPA-accounting trace. `child_portals.status`
  flips on rotation but records no actor.
- **Recommendation:** `audit_event(p_child_id, 'vault.secret_read'/'vault.secret_rotated',
  actor_kind, 'child_portals', row_id)` inside both functions (detail carries
  `portal_key` + caller, never the value).

---

## LOW

- **L1.** `agent_tenant_scope` has no RLS and no grants (safe by default-deny,
  but inconsistent): enable RLS with no policies (deny-all) to make the posture
  explicit; all access stays via the definer `agent_assert_scope()`.
- **L2.** `child_settings` row is not auto-created with a child (`consume_invite`
  inserts `children` only). The app must remember to insert it or the
  `school_system` default never applies. Consider a trigger; M4's `add_child`
  should include it.
- **L3.** `school_systems` is world-readable including anon (`USING (true)`).
  No secrets in the registry — acceptable; confirm intent is "public catalog".
- **L4.** `consume_invite` compares emails case-sensitively; OTP-normalized
  emails may differ in case. `lower()` both sides.
- **L5.** `child_settings.school_system` defaults to `'cobb-county-ga'` —
  correct for Phase 1 (§4.11: Cobb pre-selected), but it hardcodes the district
  for future tenants; the Add-a-child wizard must set it explicitly.
- **L6.** No seed migration: PLAN §4.1 seed (Dawson row `slug='dawson-kamal'`,
  `mehedikamal@gmail.com`→parent, three Dawson aliases→child) and §3.3 "Seed
  (not ETL)" are unaccounted for. The ETL user-remap needs the `users` rows to
  exist. Recommend an explicit, reviewable `007_seed.sql` (or documented seed
  script) run before ETL — not hand-run SQL.
- **L7.** `classes` adds `class_slug` + `UNIQUE(child_id, class_slug)` beyond
  §3.1's column list. **Approved deviation:** it implements the plan's own risk-#5
  intent ("greenfield `classes` table owns the canonical slug list") and gives
  the ETL slug-validation step something to validate against.
- **L8.** `child_access` has no UPDATE policy (role changes need a function).
  Fine for now; flag when role-change UX is designed.
- **L9.** `agent_reader` grants on carried-over tables are deferred to the ETL
  migration — 005 says so inline; consistent with the deferred contract below.
- **L10.** `adapter_module='cobb_adapter'` vs plan example `'adapters.cobb_parentvue'`:
  cosmetic; internally consistent with the `child_settings` default.
- **L11.** `users_self_read` lets parents read co-tenant users' rows (needed for
  switcher/invite UX); child-role users see only themselves — consistent with
  §4.5 "no disclosure of other children's existence" for child sessions.

---

## Benign deviations ledger (migrations do more than the plan — accepted)

- D1. `invites.token` default `encode(gen_random_bytes(24),'hex')`, 14-day
  expiry — plan-unspecified, reasonable.
- D2. `bell_schedules.day_type` + `UNIQUE(child_id, day_type)` — plan lists the
  table without columns; reasonable shape for regular/early-release/late-start.
- D3. `set_tenant_secret()` RPC — plan §4.8 specifies the `portal-credential-write`
  Edge Function for the UI path; a parent-gated RPC is an equivalent write path.
  Accepted provided the Edge Function remains the UI path and the RPC never
  returns secret values (it doesn't).
- D4. `audit_event()` and `agent_assert_scope()` helpers — additive, consistent
  with plan intent.
- D5. Trigger-derived `display_name` fallback — cosmetic.
- D6. `users` SELECT policy for co-tenant parents (see L11) — plan-unspecified,
  justified by switcher/invite UX.

---

## Deferred by design — contract for the ETL / carried-over migration

Correctly absent from this set; the ETL migration MUST include each item
(verify against live `pg_dump --schema-only` first, per plan §3.1):

1. ~20 carried-over tables, each gaining `child_id uuid NOT NULL REFERENCES
   children(id)` **with no DEFAULT** (code passes it explicitly): `checkins`
   (unique→`(child_id, checkin_date)`), `daily_content` (PK→`(child_id,
   content_date)`, **service-role-write-only RLS**), `sync_requests` (+ index
   `(child_id, status, created_at)`), `studentvue_syncs`, `tutor_chat` (role
   check → `('user','pookie')`), `parent_sync` (**drop `student_name`**),
   `merged_syncs`, `grade_history` (unique→`(child_id, class_slug, recorded_at)`),
   `private_notes`, `class_emails` (unique→`(child_id, class_slug, email_from,
   email_subject, email_date)`), `merge_audit_log`, `peer_tips`,
   `course_materials`, `course_units`, `material_views`, `path90_actions`,
   `tonight_picks`, `sat_overlaps`, `manual_assignments`, `user_resources`,
   `user_preferences`, `subject_units`, `subject_mastery`.
2. `profiles.child_id` **nullable** (parent rows NULL); `worker_heartbeats`
   (no FK — served-set via `worker_children`, see M1).
3. `child_id = ANY (current_child_ids())` RLS on **every** carried-over table,
   all operations; no policy references `parent_user_id` (verified pattern).
4. `rpc_claim_sync` per the H2 contract (empty-whitelist rejection,
   `FOR UPDATE SKIP LOCKED`, oldest-pending).
5. Carry-over RPCs: `rpc_append_sync_log`, `rpc_finish_sync`,
   `rpc_fail_stale_syncs`, `rpc_worker_heartbeat`,
   `rpc_upsert_dashboard_content`, `rpc_refresh_course_unit_stats` — rewritten
   to require/assert explicit `child_id` on every service_role path.
6. `agent_reader` SELECT grants on the carried-over tables (secret-less views
   where applicable); the H3 scope-wiring decision applied to the helper.
7. Storage: `class-files` bucket + `storage.objects` RLS (H1) if not shipped
   as `006` first.
8. `worker_children` + `teacher_contacts` (M1/M2) if not shipped as `006` first.
9. `get_tenant_secret` tightened to service_role-only (H4); NULL-child portal
   isolation resolved (H5); view fixed (H6); `add_child()` (M4).

**Explicitly out of schema scope (plan open questions, §4.7):** COPPA
verifiable-consent flow for under-13 tenants; per-tenant backup granularity
(Supabase PITR is project-level — known limitation); agent long-term memory
partitioning; peer-tip cost scaling.

---

## Verification notes

- Grep-confirmed: no RLS policy in any migration references
  `children.parent_user_id` (only the column definition, the partial index, and
  `consume_invite`'s anchor insert) — the plan's normative "never the access
  mechanism" holds.
- Grep-confirmed: `current_child_ids()` is `STABLE … SECURITY DEFINER` with
  `SET search_path = public` in all three definer functions that need it.
- `001`'s `child_access_one_child_per_child_user` partial unique index enforces
  the "child-role user holds exactly one row globally" invariant at the DB level.
- The five migrations are internally consistent on the Cobb seed key
  (`'cobb-county-ga'` in both the `school_systems` seed and the
  `child_settings.school_system` default/FK).
- The `REVOKE ALL ON child_portals FROM anon, authenticated` + view pattern is
  *intended* as defense-in-depth, but H6 shows the view undoes the RLS it was
  meant to preserve — the pattern needs `security_invoker`, not just REVOKE.

**Component sign-off (architecture coherence): CONDITIONAL PASS.** The tenancy
core (001), adapter registry (002), and compliance ledger (004) are coherent
with PLAN.md and need only the LOW items. The vault (003) and agent boundary
(005) migrations are **not signed off** — H4/H5/H6 and H3 respectively must be
resolved, and H1/H2/M1/M2/M4 closed by follow-up migrations, before this
component is done. Re-audit scheduled on the fix migrations.
