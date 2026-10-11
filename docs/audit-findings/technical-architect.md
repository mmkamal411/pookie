# Technical Design Audit — Migrations 001–005
**Auditor:** Technical Architect, Pookie engineering pod (manager: Technical design decisions)
**Date:** 2026-10-11 · **Scope:** reviewer role — findings only, no migration edits
**Files reviewed:**
- `supabase/migrations/001_tenancy_core.sql`
- `supabase/migrations/002_school_systems.sql`
- `supabase/migrations/003_credential_vault.sql`
- `supabase/migrations/004_compliance.sql`
- `supabase/migrations/005_agent_access.sql`

Reference: `~/workspace/your_files/app-rename-multi-child-plan/PLAN.md` §§3.1, 4.1–4.10.

**Verdict summary:** the tenancy skeleton is sound — `child_access` as single source of truth, `current_child_ids()` STABLE/SECURITY DEFINER, partial unique index for the child-role invariant, and consistent `SET search_path` on definer functions are all correct calls. But there are **1 CRITICAL** and **4 HIGH** findings that must be fixed before any data flows, plus a set of MEDIUM gaps. The single most dangerous assumption is in 005: the `agent_reader` boundary cannot work as written.

---

## CRITICAL

### C1 — `agent_reader` RLS boundary is non-functional as written (005)
Every RLS policy in 001–004 keys tenancy off `auth.uid()` via `current_child_ids()`, which reads `child_access`. The `agent_reader` role is `NOLOGIN`; it is meant to be used "via service-role-issued scoped JWTs or SET ROLE". Whichever way it authenticates, its `auth.uid()` has **no rows in `child_access`** — so `current_child_ids()` returns `'{}'` and every `child_id = ANY (current_child_ids())` policy evaluates to false. The agent can read **zero rows** through PostgREST.

Meanwhile `agent_tenant_scope` (the per-job allowlist the plan relies on, §4.10) is **never consulted by any policy**, and `agent_assert_scope()` is an orphaned helper — nothing calls it. There are only two outcomes: (a) agent reads silently return nothing and every agent cron fails closed-but-useless, or (b) someone "fixes" it by handing the agent `service_role`, which deletes the entire boundary this migration was built to create.

**Required fix:** make the tenancy helper agent-aware. E.g. `current_child_ids()` (or a `current_agent_child_ids()` variant used by agent-facing policies) resolves the tenant set from `agent_tenant_scope` when `current_user = 'agent_reader'`, keyed by a `job_id` passed in a custom JWT claim (`request.jwt.claims ->> 'job_id'`) or `SET LOCAL app.job_id`, with expiry enforced. Wire `agent_assert_scope()` into the write-path RPCs. Until this is designed, 005 is a locked door with no key — fail-closed, but non-functional.

## HIGH

### H1 — Migrations are not idempotent: `CREATE POLICY` has no `IF NOT EXISTS`
Postgres has no `CREATE POLICY IF NOT EXISTS`. Every migration uses `CREATE POLICY` bare (001: 8 policies; 002: 4; 003: 1; 004: 3). Re-running any migration — which the ETL rehearsal plan and any `supabase db reset` flow will do — fails at the first policy with `policy "..." already exists`. `CREATE TABLE/INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION/VIEW`, and `DROP TRIGGER IF EXISTS` are all correctly idempotent; the policies break the chain. **Fix:** precede each with `DROP POLICY IF EXISTS <name> ON <table>;`.

### H2 — `invites` write policy has no parent-role check (001)
`invites_parent_write ... FOR ALL USING (child_id IS NULL OR child_id = ANY (current_child_ids()))` — the USING doubles as the WITH CHECK for INSERT, and there is **no role predicate**. Any tenant member, including a **child-role user**, can INSERT invites for their own child (e.g. invite a friend's email as `role='child'` → the friend consumes it and sees the child's data), and can UPDATE/DELETE (revoke) other invites in the tenant. The file's own comment says "inviting parent + invitee only" — the policy doesn't enforce it. **Fix:** add the same `ca.role = 'parent'` EXISTS predicate used everywhere else; consider also restricting which roles a parent may grant.

### H3 — `UNIQUE (child_id, portal_key)` does not deduplicate NULL `child_id` (003)
Postgres treats NULLs as distinct in unique constraints, so any number of `(NULL, 'parentvue')` rows can coexist. Two consequences: (a) `set_tenant_secret`'s `ON CONFLICT (child_id, portal_key) DO UPDATE` **never fires for parent-level portals** — every "update" inserts a duplicate row; (b) `get_tenant_secret`'s `ORDER BY child_id NULLS LAST LIMIT 1` then picks an arbitrary one of the duplicates, potentially returning a **stale secret** after a rotation. **Fix:** on PG15+ use `UNIQUE NULLS NOT DISTINCT (child_id, portal_key)`, or add a partial unique index `ON child_portals (portal_key) WHERE child_id IS NULL` alongside the composite.

### H4 — NULL-`child_id` rows are visible across families (001, 003)
`child_portals_parent_all` and both `invites` policies allow **any parent in the project** to read/manage rows with `child_id IS NULL` (the EXISTS only requires being a parent of *some* child). Parent-level portals ("ParentVUE covering all children") and parent-level invites are therefore a cross-family shared namespace. Acceptable in Phase 1 (single family) but the schema is specified as multi-tenant — the second family's parent would see the first family's parent-level portal metadata. **Fix:** scope NULL rows to the creating family (e.g. `owner_user_id` on `child_portals`/`invites`, checked in the policy), or disallow NULL until the wizard creates the first child.

## MEDIUM

### M1 — Child-role users can write class/config tables (002)
`classes_tenant_all`, `bell_schedules_tenant_all`, `child_settings_tenant_all` are `FOR ALL` with only the tenant-membership check. A child-role user can therefore DELETE classes, rewrite `grade_weights`, edit bell schedules, and change their own `child_settings.send_window`/`notifications`. Per PLAN §4.5 the child dashboard is "own data only" — class config is parent-managed. **Fix:** split into member-SELECT plus parent-only write policies (mirror `children_parent_write`).

### M2 — `audit_log` NULL-`child_id` rows readable by every member (004)
`audit_log_tenant_read ... (child_id IS NULL OR child_id = ANY (...))` exposes system-level audit events to all authenticated members of all tenants. **Fix:** require `child_id NOT NULL` for tenant events and route system events through a separate service-role-only surface, or scope NULL rows explicitly.

### M3 — `consume_invite` email comparison is case-sensitive (001)
`v_invite.email <> (SELECT email ...)` — Supabase Auth lowercases `auth.users.email`, but invite rows are created from UI input. `Mehedi@Gmail.com` vs `mehedikamal@gmail.com` raises `invite_email_mismatch` for the rightful invitee. **Fix:** compare `lower()` on both sides (or normalize at invite creation).

### M4 — `handle_new_auth_user` failure modes (001)
- Any non-`id` failure inside the trigger (e.g. a stale `public.users` row holding the same email with a different id → unique violation on `email`) **rolls back the `auth.users` INSERT** — sign-up fails with an opaque error.
- `ON CONFLICT (id) DO NOTHING` is correct for retries, but an auth user whose `public.users` row was deleted by other means never recovers: the trigger only fires on INSERT. **Fix:** add an idempotent `ensure_user()` SECURITY DEFINER RPC called at every login as a backstop.

### M5 — Auth-user deletion wipes tenancy (001, operational)
`child_access.user_id` and `users.id` are `ON DELETE CASCADE` from `auth.users`. Deleting a family member in the Supabase dashboard (a plausible admin action) silently destroys all their tenant membership; re-registration starts at zero rows and the invite flow must be re-run. **Fix:** document "never delete auth users; revoke via `child_access` DELETE + invite revocation" in the runbook; consider a `users.status` soft-delete instead.

### M6 — No parent-accessible child-creation path (001)
`children_parent_write ... FOR ALL USING (id = ANY (current_child_ids()) ...)` — on INSERT the new row's `id` cannot already be in the caller's tenant set, so direct INSERT of a child is impossible by design. But there is **no `create_child()` function** either; the only creation path is `consume_invite`'s shell-child branch. The Add-a-child wizard (§4.11) has nothing to call. **Fix:** add a `create_child(...)` SECURITY DEFINER function (parent-only, seeds `child_settings`/default rows — see M9).

### M7 — No role-change path on `child_access` (001)
There is no UPDATE policy on `child_access`, and `consume_invite` only ever upgrades `users.role` to `'child'`. Promoting/demoting a member (e.g. child → parent, or correcting a mis-assigned role) has no supported path, and any hand-rolled UPDATE must respect the partial unique index (a user promoted to `child` while holding N rows would violate it). **Fix:** a `set_access_role()` definer function that enforces the invariant atomically.

### M8 — `audit_event()` permits audit forgery; PUBLIC EXECUTE on definer functions (003, 004, 005)
`audit_event()` does not check tenant membership — any authenticated caller can append audit rows for **any** `child_id` with arbitrary `actor_kind`/`action` (log injection against the FERPA-aligned trail). More broadly, `get_tenant_secret`, `set_tenant_secret`, `audit_event`, `agent_assert_scope`, and `consume_invite` rely on default `PUBLIC` EXECUTE. They fail closed today, but the posture is wrong. **Fix:** add a membership/service_role assertion to `audit_event`; `REVOKE ALL ... FROM PUBLIC` on all definer functions and `GRANT EXECUTE` narrowly (`authenticated`, `service_role`, `agent_reader` as appropriate).

### M9 — Per-child seed gap (001, 002)
`consume_invite`'s new-family branch inserts a `children` row but no `child_settings`, `classes`, `bell_schedules`, or `child_portals` rows. Either the app must NULL-handle every one of these on first run, or creation should seed them. **Fix:** seed defaults in the `create_child()` function from M6 (or an `AFTER INSERT ON children` definer trigger).

### M10 — Missing indexes on FK / lookup columns
- `children(parent_user_id)` — FK with no index; "children of parent" scans. (The partial `children_one_default_per_parent` only covers `is_default`.)
- `invites(child_id)` — FK with no index; `child_id = ANY (...)` policy checks scan.
- `agent_tenant_scope(child_id)` — no index; cleanup/scope lookups scan.
- `consents(granted_by)` — low traffic; optional.
**Fix:** add the first three.

### M11 — `agent_tenant_scope`: no RLS, no expiry cleanup (005)
The table has no `ENABLE ROW LEVEL SECURITY` and expired rows are never reaped. **Fix:** enable RLS (service_role/agent_reader-only via policy) and add a scheduled cleanup (pg_cron or app cron) deleting `expires_at < now()`.

### M12 — `users.role` drifts from `child_access.role` (001)
The trigger defaults everyone to `'parent'`; only `consume_invite` corrects to `'child'`, and nothing reconciles afterward. Policies correctly use `child_access.role`, but any app code reading `users.role` sees stale data. **Fix:** either derive role at read time from `child_access` (preferred — single source of truth stays single) or add a reconciling trigger.

## LOW

- **L1** — `school_systems_read USING (true)` exposes `adapter_module` names to anon. Internal naming only; acceptable, note for the record.
- **L2** — `consume_invite` with `auth.uid() IS NULL` fails closed only via the `NOT NULL` constraint on `child_access.user_id`. Add an explicit `IF auth.uid() IS NULL THEN RAISE` guard for a legible error.
- **L3** — New-parent shell slug `'child-' || substr(md5(random()::text),1,8)` can theoretically collide on the UNIQUE constraint (negligible); either loop on conflict or accept the 1-in-4-billion retry.
- **L4** — `invites.token` is a 192-bit bearer stored in plaintext. Fine for invite links; note the hashing option if threat posture tightens.
- **L5** — `children_one_default_per_parent` is correct, but nothing sets `is_default` on the first child — seed responsibility; document it.
- **L6** — Smoke-test on the real project: confirm `gen_random_bytes`/`gen_random_uuid` resolve inside the `SET search_path = public` definer functions (analysis says pg_catalog builtins are fine and Vault calls are schema-qualified, but verify before cutover).
- **L7** — `set_tenant_secret` has a create-race on the Vault secret name under concurrency; admin-UI frequency makes this acceptable — note only.
- **L8** — `get_tenant_secret` performs no audit logging of secret reads. For a credential-adjacent function, an `audit_event('credential.read', ...)` (never logging the secret) is worth adding when M8 is fixed.

## What the migrations get right (for the record)
- `current_child_ids()` as **STABLE** (not VOLATILE, not IMMUTABLE) is the correct volatility: evaluated once per query for `= ANY (...)`, re-evaluated per statement. VOLATILE would force per-row evaluation — a performance cliff on every tenant table.
- The partial unique index `child_access_one_child_per_child_user ... WHERE role = 'child'` is the right enforcement of "a child-role user holds at most one row globally"; "exactly one" is correctly left to the invite flow (0 rows = pending-invite state).
- `SECURITY DEFINER` + `SET search_path` is applied consistently on every definer function — the #1 Postgres privilege-escalation footgun is handled.
- `SELECT ... FOR UPDATE` in `consume_invite` correctly serializes double-consume: the loser re-reads `status='accepted'` and raises.
- `REVOKE ALL ON child_portals FROM anon, authenticated` + secret-less view is a sound column-hiding pattern (views execute underlying-table access as owner; RLS still applies as caller; clients see only view columns).
- Append-only `consents`/`audit_log` are correctly enforced by the *absence* of UPDATE/DELETE policies under RLS.
- `CREATE EXTENSION IF NOT EXISTS supabase_vault`, `ON CONFLICT DO NOTHING` seeds, and `DROP TRIGGER IF EXISTS` are idempotent — only the policies (H1) break re-runnability.

**Reviewer sign-off on audit scope:** the five migrations are *structurally* sound but **not shippable** until C1, H1–H4 are fixed and M1–M12 are dispositioned. The critical path is C1 (agent access design) → H1 (idempotency) → H2/H3/H4 → M6/M9 (child-creation + seeding, needed by the wizard).
