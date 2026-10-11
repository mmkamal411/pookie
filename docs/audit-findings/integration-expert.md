# Audit findings — Integration expert (adapter registry + credential vault)

**Auditor:** Integration expert, Pookie engineering pod
**Date:** 2026-10-11
**Scope:** `supabase/migrations/002_school_systems.sql`, `supabase/migrations/003_credential_vault.sql`
(cross-checked against `001_tenancy_core.sql`, `005_agent_access.sql`, and
`~/workspace/your_files/app-rename-multi-child-plan/PLAN.md` §§4.8–4.10).
**Role:** reviewer — findings only, no migration edits made.

## Verdicts on the three review questions

1. **Registry completeness for workers:** NO — `school_systems` is missing endpoint
   config, rate-limit config, `auth_requirements`, OAuth config, and capability
   declarations. A PowerSchool adapter cannot be configured declaratively from the
   current row shape (see H2–H5, M1).
2. **`credential_fields` sufficiency for the Portals UI:** NO — the JSONB schema
   (`key/label/type` only) lacks `secret`, `required`, `placeholder`, and `options`
   fields that PLAN §4.9 specifies, and key naming (`key`) mismatches PLAN (`name`)
   (see H9). OAuth systems have nowhere to put connect-button config.
3. **`get_tenant_secret()` membership assertion:** PARTIALLY — the assertion is
   correct for the PostgREST/RPC path but (a) **returns plaintext secrets to any
   parent-role caller**, contradicting PLAN §4.8 ("Edge Function never returns the
   secret value") — CRITICAL; and (b) relies solely on `request.jwt.claims`, which
   is unset on direct-SQL worker connections, so legitimate service_role workers
   fail closed incorrectly — HIGH.
4. **`child_portals_public` view + REVOKE/GRANT pattern:** SOUND with caveats.
   Under PostgREST, a query on the view executes with the caller's identity for
   RLS evaluation on the base table, so `vault_secret_id` stays invisible to
   `authenticated` while rows stay tenant-scoped. Caveats: child-role users see
   zero rows (intended but unstated), and the base-table `child_portals_parent_all`
   FOR ALL policy is inert given the REVOKE (writes must go through definer RPCs —
   fine, but the policy misleads future readers).

---

## CRITICAL

### C1 — `get_tenant_secret()` discloses plaintext secrets to parent-role callers (003)

`get_tenant_secret(p_child_id, p_system)` grants access when the caller is
`service_role` **OR** a parent in the tenant set, and then returns the decrypted
secret. PLAN §4.8 states explicitly: *"The Edge Function never returns the secret
value."* Any parent can call the RPC via PostgREST (`rpc/get_tenant_secret`) and
read back raw portal passwords — for their own credentials this is a
design-contradiction, and it makes the RPC unsafe to expose. The parent's
legitimate flows (Test connection, status display) never need the raw value.

**Fix:** remove the parent branch from `get_tenant_secret()` (workers =
service_role only), and add a separate SECURITY DEFINER function
`test_portal_connection(p_child_id, p_portal_key)` that fetches the secret
server-side, attempts auth, and returns only `{ok: boolean, checked_at}` —
never the secret.

---

## HIGH

### H1 — service_role check fails on direct-SQL worker connections (003)

Membership assertion: `(SELECT current_setting('request.jwt.claims', true)::jsonb
->> 'role') = 'service_role'`. `request.jwt.claims` is set by PostgREST per
request; it is **absent** on direct SQL connections (psql, psycopg/pgBouncer
workers). A worker connecting as the `service_role` database role over a direct
connection gets `tenant_membership_required` incorrectly — the function fails
closed against its own legitimate caller. It is not forgeable via PostgREST
(PostgREST sets the claim from the signed JWT), but it is not portable across
both intended call paths.

**Fix:** accept either signal — e.g.
`current_user = 'service_role' OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'`.
Under PostgREST the session role equals the JWT role, so this stays sound on the
RPC path and works on direct connections.

### H2 — No OAuth configuration: OAuth adapters cannot be registered (002)

`auth_flow` allows `'oauth'`, but the row has nowhere to store OAuth config
(authorize URL, token URL, scopes, client-id reference, redirect URI). The Portals
UI cannot render an "OAuth connect" flow from `credential_fields` alone, and the
worker has no token endpoint to hit. PLAN §4.9's Canvas example is unimplementable
declaratively.

**Fix:** add `oauth_config JSONB` (nullable; required when `auth_flow='oauth'`)
and document that `credential_fields` is ignored/empty for OAuth systems.

### H3 — No `auth_requirements` though PLAN §4.9 requires it (002)

PLAN §4.9: *"the adapter surfaces `auth_requirements` so the UI can warn"*
(e.g., Cobb Conditional Access — worker must run on an approved device/profile).
No such column exists; there is no declarative place for per-system auth
constraints, so the UI cannot warn before a parent saves credentials.

**Fix:** add `auth_requirements JSONB` (e.g. `{"approved_device_required": true,
"notes": "...", "sso_hint": "..."}`), rendered as a warning banner in Portals UI.

### H4 — No endpoint configuration for per-district/per-system URLs (002)

PowerSchool deployments have per-district base URLs; OAuth systems have distinct
authorize/token endpoints; CTLS Learn vs ParentVUE have different hosts. The row
carries no `api_endpoints`/`base_urls`, forcing URLs into adapter code — defeating
the "config table, not code" registry goal and making per-district onboarding a
code change.

**Fix:** add `api_endpoints JSONB` (e.g. `{"base_url": "...", "token_url": "...",
"sso_url": "..."}`); per-district overrides live in adapter config or
`child_settings` extension, not in the module.

### H5 — `sync_cadence` is free text; workers cannot throttle claims (002)

`sync_cadence text DEFAULT 'daily'` is UI copy, not a machine contract. Workers
need numeric bounds for claim frequency (PLAN open question: "per-adapter
rate-limit budgets at N children"). A future aggressively rate-limited system has
no declarative way to bound claims per child.

**Fix:** add `rate_limits JSONB` (e.g. `{"min_claim_interval_seconds": 300,
"max_concurrent_jobs": 1, "requests_per_minute": 30}`); keep `sync_cadence` as a
human label or derive it.

### H6 — `child_portals` lacks `updated_at` / `credentials_updated_at` (003)

PLAN §4.8's push mechanism references `child_portals.credentials_updated_at` for
mid-job staleness detection ("if a long job spans a rotation, the next claim
re-fetches"). The table has no such column — `set_tenant_secret()` resets
`last_verified_at` on update, but nothing records rotation time, so the staleness
check described in the plan is unimplementable.

**Fix:** add `updated_at timestamptz NOT NULL DEFAULT now()`, bumped to `now()`
on every `vault.update_secret` rotation inside `set_tenant_secret()`; workers
compare job-start time against it.

### H7 — PLAN §4.8 failure mode has no schema backing (003)

The plan requires: sanitized auth-failure recording, a per-child
consecutive-failure counter, claim pausing after N failures, and a parent nudge
with a Portals deep link. The schema has none of this: no `consecutive_failures`
counter, no pause flag, and `status` CHECK (`unverified/verified/failed`) has no
`paused` state.

**Fix:** add `consecutive_failures int DEFAULT 0`, `claims_paused_until
timestamptz`, extend `status` with `'paused'`; define the increment/reset/pause
rules in worker wiring (see handbook §07).

### H8 — No `remove_tenant_secret` RPC; UI [Remove] has no server path (003)

PLAN §4.8's Portals UI has `[Test connection] [Update] [Remove]`. Clients are
revoked from the base table, and `set_tenant_secret()` only upserts — there is no
definer function to delete a credential (and its Vault secret). The UI button
cannot be wired without one.

**Fix:** add `remove_tenant_secret(p_child_id, p_portal_key)` (parent-only,
definer): deletes the Vault secret and the `child_portals` row; audit-logs the
removal (metadata only, never the value).

### H9 — `credential_fields` schema underspecified vs PLAN §4.9 (002)

PLAN §4.9 specifies `[{name, label, type, secret: true}]`; the migration seeds
`[{key, label, type}]` — no `secret` flag, no `required` flag, no `placeholder`,
no `options` (for select/radio types), and `key` vs `name` naming mismatch. The
Portals UI contract is ambiguous for any non-trivial form.

**Fix:** adopt the documented field schema
`{key, label, type, secret, required, placeholder?, options?}` and update the
Cobb seed row accordingly.

### H10 — Parent-level portal uniqueness is unenforced (003) — the NULL trap

`UNIQUE (child_id, portal_key)` does not constrain `child_id IS NULL` rows:
Postgres treats NULLs as distinct, so repeated `set_tenant_secret(NULL,
'parentvue', ...)` calls never hit `ON CONFLICT` and insert a **new row every
time**. `get_tenant_secret` then `LIMIT 1`s over duplicates. Parent-level
portals (ParentVUE — the primary credential) accumulate orphan rows and the
upsert path silently degrades to insert-always.

**Fix:** add a partial unique index `UNIQUE (portal_key) WHERE child_id IS NULL`
and rework `set_tenant_secret()`'s upsert to handle the NULL case (e.g.
`ON CONFLICT` on the partial index, or an explicit SELECT-then-UPDATE branch).

---

## MEDIUM

### M1 — No capability declaration: workers can't know which methods exist (002)

Not every system supports all four contract methods (e.g. a system with no
attendance API). Nothing in the registry declares supported methods, so workers
must try/except `NotImplementedError` at runtime.

**Fix:** add `capabilities JSONB` (e.g. `{"get_grades": true, "get_attendance":
false, ...}`); workers skip unsupported methods and the UI hides the
corresponding sections.

### M2 — No adapter contract versioning (002)

`adapter_module` is free text with no version. When the contract gains a method
or changes a normalized shape, old worker pools and new registry rows can
silently disagree.

**Fix:** add `contract_version text NOT NULL DEFAULT '1'`; workers assert
compatibility at import and refuse unknown major versions (fail closed).

### M3 — Dynamic `adapter_module` import needs an allowlist rule (002)

Worker discovery = "import `adapter_module` named by the registry row". Registry
rows are service_role/admin-written today, but without a stated rule a future
admin UI or compromised row could inject a module path.

**Fix:** handbook rule — workers import only from the `adapters.` package and
validate `adapter_module` against `^[a-z][a-z0-9_]*$` before import; reject
anything else.

### M4 — `school_systems` is world-readable including `notes` (002)

`FOR SELECT USING (true)` exposes the registry to `anon`. Intended for config —
but `notes` is a free-text field where operators will write internal remarks
("Conditional Access blocks sandbox…"). One careless note leaks internals to
unauthenticated clients.

**Fix:** either restrict `notes` (convention: no internal detail) or split into
`notes` (public-safe) / `operator_notes` (service_role only via a definer view).

### M5 — `get_tenant_secret` does not gate on credential status (003)

The function returns the secret regardless of `status` (`failed`) — a worker
will burn rate-limited attempts against known-bad credentials instead of
short-circuiting.

**Fix:** raise `credential_unverified`/`credential_paused` unless status is
`verified` (or add an explicit `allow_unverified` param defaulting false; first
verification flow must define how `verified` gets set — see M6).

### M6 — Nothing sets `status='verified'` (003)

`set_tenant_secret()` always writes `unverified`; no definer RPC exists for a
worker/Edge Function to mark `verified` after a successful test. Combined with
M5's gate, credentials could never become usable.

**Fix:** add `mark_portal_verified(p_child_id, p_portal_key)` (definer; callable
by the test-connection function/worker on success), setting `status='verified'`,
`last_verified_at=now()`, resetting `consecutive_failures`.

### M7 — Secret fetches are not audit-logged (003)

`audit_log` (001/004) covers agent reads, but `get_tenant_secret()` — the single
most sensitive read in the system — writes no audit row. Post-incident, there is
no record of which worker fetched which child's secret when.

**Fix:** `get_tenant_secret()` inserts into `audit_log`
`(child_id, actor='sync-worker', action='secret_fetch', table_name='child_portals',
row_id=<portal row id>, at=now())` — metadata only, never the value.

### M8 — `set_tenant_secret` has no rate limiting (003)

Any parent can call the RPC in a loop, creating unbounded Vault secret versions
(`vault.update_secret` versions history). Minor cost/abuse vector.

**Fix:** Edge Function (or RPC) rate-limit: e.g. max 10 writes/hour per
(child_id, portal_key); document the bound.

### M9 — Base-table `child_portals_parent_all` FOR ALL is inert; child users see nothing (003)

Because of `REVOKE ALL … FROM anon, authenticated`, the base-table policy never
applies to clients; writes flow only through definer RPCs. Harmless but
misleading to future readers — add a comment stating writes are RPC-only. Also:
child-role users get zero rows from `child_portals_public` (policy requires
`role='parent'`). If any future UI shows portal status to the student, a
child-visible policy/view will be needed — currently unstated.

### M10 — Parameter naming inconsistency: `p_system` vs `p_portal_key` (003)

`get_tenant_secret(p_child_id, p_system)` matches on `portal_key`; `set_tenant_secret`
takes `p_portal_key`. Same concept, two names — a paper cut for worker authors.

**Fix:** rename to `p_portal_key` in both (and in `remove_tenant_secret`).

### M11 — Term definitions are not modeled anywhere (002)

PLAN §4.9 says the normalized `get_grades` shape carries `term_id` and "the UI's
grading-period logic reads the child's system config" — but no table/column
defines terms (ids, names, date ranges) per child/system. Adapters will invent
incompatible `term_id` schemes.

**Fix:** add `term_definitions JSONB` to `school_systems` (system defaults) with
per-child override in `child_settings`, or a `terms` table; contract pins the
`term_id` format (see handbook §07).

---

## LOW

### L1 — `get_tenant_secret` fallback ordering is correct but fragile (003)

`ORDER BY cp.child_id NULLS LAST LIMIT 1` correctly prefers child-level over
parent-level portals. Fine once H10 lands; until then duplicate NULL rows make
the `LIMIT 1` pick arbitrary (all duplicates point at the same Vault secret by
name, so impact is limited to row-level metadata confusion).

### L2 — `vault` extension creation inside migration (003)

`CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;` requires
superuser-ish privilege; on Supabase this works via the dashboard SQL editor but
may fail in some CI/CLI roles. Operational note only — verify it runs in the
project's actual migration runner before cutover.

### L3 — `child_settings.school_system` FK has no `ON UPDATE` action (002)

Renaming a `system_key` would orphan `child_settings` rows. `system_key`s are
immutable by convention; add a comment stating keys are never renamed, or add
`ON UPDATE CASCADE`.

---

## Interaction notes (001 / 005 — no findings)

- `005_agent_access.sql` grants `agent_reader` SELECT on `child_portals_public`
  (the secret-less view) only — correct; no Vault grant. Consistent with this
  audit's view-security verdict.
- `current_child_ids()` (001) is the right primitive for the RPC membership
  checks; no issue with its use in 003.

## Recommended migration deltas (for the Director — not applied)

A follow-up migration (e.g. `006_integration_hardening.sql`) should: add
`oauth_config`, `auth_requirements`, `api_endpoints`, `rate_limits`,
`capabilities`, `contract_version`, `term_definitions` to `school_systems`;
standardize `credential_fields`; fix `get_tenant_secret` (remove parent branch,
add `current_user` check, status gate, audit row); add `updated_at`,
`consecutive_failures`, `claims_paused_until`, `paused` status to
`child_portals`; add partial unique index for NULL `child_id`; add
`test_portal_connection`, `mark_portal_verified`, `remove_tenant_secret` RPCs.
