# Backend Audit Findings — Migrations 001 / 004 / 005

**Auditor:** Backend/API conventions manager (engineering pod)
**Date:** 2026-10-11
**Scope:** backend-callable surface of `001_tenancy_core.sql`, `004_compliance.sql`, `005_agent_access.sql`
(read-only review; no migration files were modified)
**Out of scope but noted:** one adjacent finding from `003_credential_vault.sql` (§6) because it
directly affects the backend-readable surface.

Severity scale: **CRITICAL** (exploitable privilege/data breach) · **HIGH** (realistic abuse path or
cross-tenant leak) · **MEDIUM** (integrity/consistency gap, needs a decision) · **LOW** (hygiene).

---

## 1. CRITICAL

### C1 — `invites_parent_write` lets any authenticated user mint invites (privilege escalation)
**Location:** `001_tenancy_core.sql` — policy `invites_parent_write` (`FOR ALL USING (child_id IS NULL OR child_id = ANY (public.current_child_ids()))`)

The policy has **no role check** and no membership requirement for the `child_id IS NULL` branch.
Consequences (verified by reading the policy logic against the schema):

1. **Zero-access user → self-onboarding.** A freshly signed-up user with zero `child_access` rows
   satisfies `child_id IS NULL`, so they can `INSERT` a `pending` invite for their own email with
   `role='parent'`, then call `consume_invite()` (the email-mismatch check passes — it's their email)
   and become a family parent. The `invites` allowlist is therefore **not an allowlist** while
   signups are on: anyone with an email address can self-provision a tenant.
2. **Child → parent escalation inside a tenant.** A `role='child'` user satisfies
   `child_id = ANY(current_child_ids())` for their own child, so they can `INSERT` an invite with
   `role='parent'` for that child, addressed to any email they control. Whoever holds that email
   consumes it and gets parent powers over the child's tenant.
3. **Blind write/delete on invites.** `FOR ALL USING` without `WITH CHECK` means the `USING`
   expression also gates INSERTs; `UPDATE`/`DELETE` evaluate `USING` against the old row only.
   Any tenant member (including a child-role user) can `UPDATE` any invite in their tenant —
   including rewriting `token` or `email` (invite hijack) — and `DELETE`/`revoke` anyone's invite,
   without needing to be able to `SELECT` it.

**Recommendation:**
- Rewrite as separate per-command policies with explicit parent-role membership, mirroring the
  `child_portals_parent_all` pattern, e.g. `WITH CHECK` on INSERT requiring
  `EXISTS (… child_access … role='parent' AND (invites.child_id IS NULL OR ca.child_id = invites.child_id))`.
- Decide who may create `child_id IS NULL` (new-family) invites. If anyone except an admin can,
  C1.1 stands. Recommended: new-family invites are created only via a `SECURITY DEFINER`
  `request_invite()` function (rate-limited, email-normalized) or by service_role/admin; remove the
  `child_id IS NULL` branch from the client-facing policy entirely.
- Split `FOR ALL` into `SELECT` / `INSERT` / `UPDATE` / `DELETE` with proper `WITH CHECK` clauses so
  UPDATE cannot touch `token`/`email`/`role` (restrict updatable columns to `status` for revocation).

### C2 — `agent_tenant_scope` has RLS disabled (agent scope is forgeable)
**Location:** `005_agent_access.sql` — table `public.agent_tenant_scope`

The migration never runs `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on `agent_tenant_scope`.
Any authenticated user can therefore `SELECT` all `(job_id, child_id)` mappings (job inventory leak)
and — critically — `INSERT`/`UPDATE`/`DELETE` rows. `agent_assert_scope()` trusts this table
completely: an attacker inserts `(job_id='anything', child_id=<victim child>)` and the assertion
passes. Every downstream "scoped" agent read is then unscoped.

**Recommendation:**
- `ALTER TABLE public.agent_tenant_scope ENABLE ROW LEVEL SECURITY;` with **no** client policies
  (service_role/definer-only writes), or at minimum `FOR ALL … USING (false)` for anon/authenticated.
- Writes to this table must go through a `SECURITY DEFINER` `agent_begin_scope()` that derives
  `child_id` from the worker's assigned set (`worker_children`), never from caller input.
- Add a cleanup path for expired rows (2h TTL with no reaper → unbounded growth; a reused `job_id`
  also collides on the PK — use `gen_random_uuid()` job ids issued server-side).

### C3 — agent read path cannot satisfy RLS as written (broken *or* bypassed — pick one)
**Location:** `005_agent_access.sql` — `agent_reader` grants + `agent_assert_scope()`

The design says "RLS still applies" to `agent_reader`, but every tenant-table policy is written in
terms of `current_child_ids()`, which is `WHERE ca.user_id = auth.uid()`. The agent has no
`auth.users` row and no `child_access` rows:

- If the agent connects with a JWT carrying `role = agent_reader`, `auth.uid()` is null/synthetic →
  `current_child_ids()` = `'{}'` → **every SELECT returns zero rows**. The agent is blind.
- If instead the agent connects with the **service_role** key (the only other documented option),
  **RLS is bypassed entirely** and `agent_reader`'s SELECT-only grants are irrelevant — the agent
  (and any code path holding that key, e.g. a compromised worker) has full read/write on everything,
  `agent_assert_scope()` is advisory only, and "no Vault" is enforced by nothing.

`agent_assert_scope()` asserts but does not *enforce*: nothing in the data path requires it to be
called, and its verdict isn't visible to RLS.

**Recommendation (choose one, document it):**
- **(a) Session-scoped tenant for agents (preferred):** add `agent_child_ids()` —
  `SECURITY DEFINER, STABLE` — returning the `child_id` from `agent_tenant_scope` for the job bound
  to the session (job id passed via `SET LOCAL app.agent_job_id` after `agent_assert_scope()`, or via
  a JWT claim). Change tenant policies to `child_id = ANY (public.current_child_ids() || public.agent_child_ids())`
  (empty array when not an agent session). Keep `GRANT SELECT` as the write guard.
- **(b) Give the agent a real identity:** an `auth.users` row + `child_access` row per job. Heavier;
  still needs (a)-style scoping for per-job least privilege.
- In both cases: the worker/service path that *issues* the agent session must itself carry and
  assert an explicit `child_id` (see `01-api-conventions.md`).

---

## 2. HIGH

### H1 — `child_portals_public` view bypasses RLS (cross-tenant username leak) [adjacent: 003]
**Location:** `003_credential_vault.sql` — `CREATE OR REPLACE VIEW public.child_portals_public`

Standard PostgreSQL behavior: a plain (non-`security_invoker`) view accesses underlying tables with
the **view owner's** privileges. The migration runs as the table owner, and table owners bypass RLS.
`REVOKE ALL ON child_portals FROM anon, authenticated` + `GRANT SELECT ON child_portals_public TO
authenticated` therefore exposes **every tenant's** `username`, `portal_key`, `label`, and `status`
to **any** authenticated user. (`vault_secret_id` stays hidden only because it isn't in the select
list — the design intent "never exposed to client roles" for metadata is not met for usernames.)

**Recommendation:** `ALTER VIEW public.child_portals_public SET (security_invoker = true);`
(PG 15+, Supabase-supported) so base-table RLS evaluates as the invoker; add a regression test that
queries the view as two users from different tenants. Audit the same pattern anywhere else a view is
granted to client roles over an RLS table.

### H2 — `audit_event()` accepts unvalidated `child_id`, `action`, and `actor_kind`
**Location:** `004_compliance.sql` — `public.audit_event(...)`

`SECURITY DEFINER` + no RLS INSERT policy on `audit_log` is the right shape (lets workers/agents
write), but the function performs **no membership assertion**: any authenticated caller can insert
rows for **any `child_id`** with arbitrary `action` strings and forged `actor_kind`
(`'agent'`/`'system'`). For an append-only FERPA disclosure-accounting log, forged entries destroy
evidentiary value — a caller can fabricate `transcript.sent` events or bury real ones in noise.

**Recommendation:**
- Assert `p_child_id IS NULL OR p_child_id = ANY (public.current_child_ids())`, **or** service_role;
  reject otherwise. (Decide whether user-callable paths may write `child_id IS NULL` rows at all —
  see H3.)
- Derive `actor_kind` server-side: `auth.uid()` present → `'user'` unless the caller is service_role
  carrying an explicit, allowlisted kind; never accept `'system'` from a client JWT.
- Allowlist or length-cap `action` (e.g. `CHECK (action ~ '^[a-z0-9_.]{1,64}$')`) and cap
  `pg_column_size(detail)` to bound log-spam; consider per-user rate limiting if the function stays
  client-callable.

### H3 — `audit_log` rows with `child_id IS NULL` are visible to every tenant member
**Location:** `004_compliance.sql` — policy `audit_log_tenant_read`
(`child_id IS NULL OR child_id = ANY (…)`)

Intended for system-level events, but any member of *any* tenant can read them, and (via H2) any
authenticated user can currently *write* them. Cross-tenant information leak by design.

**Recommendation:** make `child_id NOT NULL` for user/agent/worker writes; reserve `NULL` for a
separate system log or gate NULL rows behind service_role-only reads. At minimum, change the read
policy to require service_role for `child_id IS NULL` rows.

### H4 — dual role model: global `users.role` vs per-tenant `child_access.role`
**Location:** `001_tenancy_core.sql` — `users.role` + `consume_invite()` role correction

`users.role` is a single global column, but roles are per `(child_id, user_id)`. `consume_invite()`
sets `users.role='child'` when the *inv
...[truncated 6871 chars]