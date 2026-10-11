# DevOps Audit Findings — Migrations 001–005 (deployability review)

- **Auditor:** Senior Manager, Platform & Delivery / Manager, CI/CD Pipeline (Pookie engineering pod)
- **Date:** 2026-10-11
- **Scope:** `supabase/migrations/001_tenancy_core.sql` → `005_agent_access.sql`
- **Role:** findings only — no migration files were modified (per Director's instruction)
- **Severity scale:** CRITICAL (blocks deploy/cutover) · HIGH (will fail or leak in staging/prod if unaddressed) · MEDIUM (correctness/data-integrity risk) · LOW (hygiene/dead code) · INFO (verified OK / operational note)

**Bottom line:** the migration set is *structurally sound* (ordering is a valid topological order, extension choice is correct for the tier) but **not re-runnable as written** — a re-run of 001–004 dies on `CREATE POLICY`, which breaks the rehearsal/dry-run discipline the cutover plan depends on. Fix F-001 before the first staging rehearsal. F-002 and F-003 must be resolved before any agent integration test.

---

## F-001 — HIGH — `CREATE POLICY` is not re-runnable (16 statements across 001–004)

**Where:** 001 (8 policies), 002 (4), 003 (1), 004 (3). 005 has none.

**What:** Every policy uses bare `CREATE POLICY <name> ON <table>`. PostgreSQL has **no `IF NOT EXISTS` clause for `CREATE POLICY`** (true through PG 17, which Supabase runs). Re-running any of migrations 001–004 — rehearsal runs, `supabase db reset`, a second `db push` after a partial failure — aborts at the first policy with `ERROR: policy "<name>" for table "<table>" already exists`. Because Supabase applies each migration file in a transaction, the file fails atomically, but the *migration* is then stuck: it can't be re-applied without manual cleanup.

**Why it matters:** PLAN.md §3.7 and the ETL plan explicitly assume idempotent, re-runnable operations (dry-runs, nightly rehearsals, final delta). A migration set that can't survive a re-run breaks that discipline at the foundation.

**Fix (suggested, not applied):** prepend `DROP POLICY IF EXISTS <name> ON <table>;` before each `CREATE POLICY`. Everything else in the files is already re-runnable (`IF NOT EXISTS` / `OR REPLACE` / `ON CONFLICT DO NOTHING` / `DO` block / `GRANT` / `REVOKE` / `COMMENT` — all verified; see F-009).

```sql
-- idempotent policy pattern for this project
DROP POLICY IF EXISTS users_self_read ON public.users;
CREATE POLICY users_self_read ON public.users FOR SELECT USING (...);
```

---

## F-002 — HIGH — `agent_tenant_scope` (005) has no RLS — reachable via PostgREST

**Where:** `005_agent_access.sql` — table `public.agent_tenant_scope` is created but never gets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and no policies are defined on it.

**What:** Under Supabase's default privileges, tables in `public` are reachable through PostgREST by the `anon` and `authenticated` roles unless RLS is enabled. This table maps `job_id → child_id` (the agent's per-job tenant scope). Without RLS it is world-readable (scope disclosure) and world-writable (an attacker with the anon key can insert/overwrite scopes, and can read which job acts on which child).

**Fix (suggested):** `ALTER TABLE public.agent_tenant_scope ENABLE ROW LEVEL SECURITY;` with **no client-facing policies** (deny-by-default). All reads/writes to this table should go through `SECURITY DEFINER` RPCs (`agent_assert_scope` and a future scope-issuer) or `service_role`. Verify with the Supabase database linter ("RLS Disabled in Public") before staging sign-off.

---

## F-003 — HIGH — `agent_reader` role has no functional read path (scoping unenforced at DB layer)

**Where:** `005_agent_access.sql`.

**What:** The migration grants `SELECT` on the tenant tables to `agent_reader` and states "RLS still applies" plus "Per-job scoping via agent_tenant_scope". But:
1. Every RLS policy on those tables gates on `public.current_child_ids()`, which resolves `auth.uid()`'s tenant set. An `agent_reader` session has no `auth.uid()` → `current_child_ids()` returns `'{}'` → **all policies deny → the agent reads zero rows**. The role's grants are inert under RLS.
2. No policy references `agent_tenant_scope` and nothing calls `agent_assert_scope()` — per-job scoping exists only in comments. It is unenforced at the database layer.
3. The only working alternative today is `service_role`-issued access, which **bypasses RLS entirely** — the opposite of the stated design.

**Deployability impact:** the first staging smoke test of the agent read path will fail closed (empty reads) or, if "fixed" by reaching for `service_role`, will silently drop tenant scoping. Either way this blocks the §4.4 "no AI without a resolved child_id" invariant.

**Fix (suggested, pick one and document it):**
- (a) Agent connects with a real user JWT (`auth.uid()` set) and every agent read is wrapped by an RPC that calls `agent_assert_scope(p_job_id, p_child_id)` first; or
- (b) dedicated `SECURITY DEFINER` read RPCs for the agent that assert `agent_tenant_scope` internally and return only that child's rows.
- Either way: F-002's RLS must land first, and `agent_assert_scope` must actually be invoked somewhere — currently it has zero callers.

---

## F-004 — MEDIUM — `UNIQUE (child_id, portal_key)` does not dedupe NULL `child_id` (003)

**Where:** `public.child_portals`, `003_credential_vault.sql`.

**What:** `child_id` is NULLABLE (NULL = parent-level portal, e.g. ParentVUE covering all children). PostgreSQL treats NULLs as distinct in unique constraints, so **multiple `(NULL, 'studentvue')` rows are legal**. Consequences:
1. `set_tenant_secret()`'s `ON CONFLICT (child_id, portal_key) DO UPDATE` **never fires for parent-level portals** — re-running it inserts a duplicate row (and a duplicate Vault secret) instead of rotating in place.
2. `get_tenant_secret()` then picks among duplicates with `ORDER BY cp.child_id NULLS LAST LIMIT 1` — no deterministic tiebreak, so which credential the worker gets is arbitrary.

**Fix (suggested):** add a partial unique index `CREATE UNIQUE INDEX ... ON public.child_portals (portal_key) WHERE child_id IS NULL;` (keeping the composite for non-NULL), and make `get_tenant_secret()`'s tiebreak deterministic (`ORDER BY cp.child_id NULLS LAST, cp.created_at DESC` — or better, guarantee uniqueness so the tiebreak can't matter).

---

## F-005 — MEDIUM — 002 tenant tables grant writes to child-role members

**Where:** `classes_tenant_all`, `bell_schedules_tenant_all`, `child_settings_tenant_all` (002) use `FOR ALL USING (child_id = ANY (public.current_child_ids()))` with **no role check**.

**What:** Any member of the tenant set — including a `role='child'` user — can INSERT/UPDATE/DELETE rows in `classes` (incl. `grade_weights`, which feed the grade forecaster), `bell_schedules`, and `child_settings` (notifications, send window, **retention**). Contrast 001's `children` table, which correctly restricts writes to parent-role holders (`children_parent_write`). The two files are inconsistent; the 002 behavior looks unintended.

**Fix (suggested):** mirror 001 — add the parent-role membership check to the USING/WITH CHECK clauses, or split into separate SELECT (members) vs write (parents) policies.

---

## F-006 — MEDIUM — `invites_parent_write` lets child-role members mutate invites

**Where:** 001, `CREATE POLICY invites_parent_write ... FOR ALL USING (child_id IS NULL OR child_id = ANY (public.current_child_ids()))`.

**What:** The policy is `FOR ALL` with no role restriction, so a child-role member of a tenant can UPDATE or DELETE invite rows in their tenant — e.g. revoke someone else's pending invite, or flip `status`. Reads for the invitee are fine (`invites_parent_read` covers email match); writes should be parent-only.

**Fix (suggested):** add the parent-role check (same pattern as `child_access_parent_insert`), or split SELECT (parent + invitee) from INSERT/UPDATE/DELETE (parents only).

---

## F-007 — LOW — `child_portals_parent_all` policy is unreachable (dead code)

**Where:** 003. The migration does `REVOKE ALL ON public.child_portals FROM anon, authenticated;` and exposes only the secret-less view `child_portals_public` + the `set_tenant_secret()` RPC. With no table-level grants, the base-table RLS policy can never fire for client roles — it only documents intent. Harmless, but misleading to future readers; either annotate it as defense-in-depth or drop it. Related gap: there is **no delete/retire path** for a portal credential (no RPC) — rotation only. Per-tenant credential deletion (PLAN §4.3 separability) needs one.

---

## F-008 — INFO — `supabase_vault` extension: privilege notes for Free tier

**Where:** 003, `CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;`.

**Verdict:** the one-liner is the right approach and works on the Free tier — `supabase_vault` is on Supabase's extension allowlist for all plans, and the migration runner (`postgres` via CLI `db push` or the dashboard SQL editor) has the CREATE privilege needed for the implicit `vault` schema creation. Gotchas to record in runbooks, not blockers:
- If the `vault` schema already exists owned by a different role (e.g. a half-failed earlier attempt), `WITH SCHEMA vault` fails with permission denied — ensure first-run cleanliness or `DROP SCHEMA` recovery is documented.
- `vault.decrypted_secrets` is readable only by the extension owner/`postgres`; the `SECURITY DEFINER` functions (`get_tenant_secret`, `set_tenant_secret`) depend on being **owned by `postgres`**, which holds only if migrations are applied via the standard runner. A future migration applied under a different owner would silently break credential reads — note the owner assumption in the DB runbook.
- `vault.create_secret` / `vault.update_secret` signatures used here match the current extension API; pin/verify against the installed extension version at setup time (`SELECT * FROM pg_extension WHERE extname = 'supabase_vault'`).

---

## F-009 — INFO — Migration ordering is a valid topological order (verified)

- **003 → needs 001:** references `public.children`, `public.users`, `public.child_access` ✓ (001 < 003).
- **004 → needs 001:** references `public.children`, `public.users` ✓.
- **005 → needs 001** (`children`), **002** (`classes`, `bell_schedules`, `child_settings`, `school_systems`), **003** (`child_portals_public` view), **004** (`consents`, `audit_log`) ✓ — numeric order satisfies all of them; no forward references found.
- **002 internal:** `child_settings.school_system` FK → `school_systems` is created earlier in the same file ✓; the Cobb seed `INSERT ... ON CONFLICT (system_key) DO NOTHING` is idempotent (note: it never *updates* the seed — future seed changes need `DO UPDATE`; acceptable as documented).
- **Future dependency (watch item):** 005's comment says carried-over ETL tables get their `agent_reader` grants "in the ETL migration" — that migration does not exist yet. Add a checklist item so the grant isn't forgotten, or the agent will fail closed on ETL tables exactly as in F-003.

---

## F-010 — INFO — Re-runnability of everything except `CREATE POLICY` (verified)

Spot-checked every statement class for re-run safety: `CREATE TABLE IF NOT EXISTS` ✓, `CREATE UNIQUE INDEX IF NOT EXISTS` ✓, `CREATE INDEX IF NOT EXISTS` ✓, `CREATE OR REPLACE FUNCTION` ✓ (all six), `CREATE OR REPLACE VIEW` ✓, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` ✓, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (re-enabling is a no-op, no error) ✓, `INSERT ... ON CONFLICT DO NOTHING` ✓, `DO $$` role guard ✓, `GRANT`/`REVOKE` (idempotent in PG) ✓, `COMMENT ON` ✓. The **only** non-idempotent statements are the 16 `CREATE POLICY`s (F-001).

---

## F-011 — INFO — `auth.users` trigger (001) is Supabase-legal

`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users` + `CREATE TRIGGER` is an allowed pattern on Supabase and is re-runnable as written. Note for the Auth runbook: with project signups OFF (per PLAN §3.2 item 7), the trigger fires for users created via the Admin API / invite acceptance — the `handle_new_auth_user` default `role='parent'` is then corrected by `consume_invite()` for child invites. No change needed.

---

## F-012 — LOW — Append-only ledgers are RLS-conventional, not DB-enforced

`consents` and `audit_log` achieve append-only by *omitting* UPDATE/DELETE policies — which `service_role` and the table owner bypass freely. That matches the threat model (those keys live in the Secure Vault, never in app code), but the assumption should be written down in the DB runbook. Belt-and-braces option: `REVOKE UPDATE, DELETE ON public.consents, public.audit_log FROM authenticated, anon;` — costs nothing, removes the ambiguity.

---

## Remediation order (recommended)

1. **Before first staging rehearsal:** F-001 (DROP+CREATE policy pattern, all 16), F-002 (RLS on `agent_tenant_scope`).
2. **Before agent integration / §4.4 sign-off:** F-003 (choose and implement the agent read path), F-004 (NULL-child dedupe).
3. **Before ETL/cutover:** F-005, F-006 (role-guard the write policies), F-007 (portal delete RPC), F-012 (explicit revokes), F-009 watch item (ETL grants).
4. **Runbook entries:** F-008 (extension/owner assumptions), F-011 (trigger behavior with signups OFF).
