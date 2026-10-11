# 06. RLS & Data — Tenancy, Policies, Functions, Indexes

**Owner:** Data & Tenancy workstream · **Status:** normative for all contributors.
Every future migration that touches tenant data must follow these patterns. RLS is the primary isolation mechanism (see §10 for the zero-trust rationale); this section is the *authoring* discipline that keeps it correct.

## 06.1 The tenancy contract (non-negotiable)

1. **`child_access(child_id, user_id, role)` is the single source of truth.** No policy, function, trigger, or worker may derive tenancy from `children.parent_user_id` (billing anchor only), from a client-supplied `child_id` alone, or from configuration/env.
2. **`public.current_child_ids()` is the single choke point.** Every tenant-table policy predicate is `child_id = ANY (public.current_child_ids())`. It is `STABLE`, `SECURITY DEFINER`, `SET search_path = public`, and it never returns NULL (COALESCE → `'{}'`; `x = ANY('{}')` is false, never NULL). Anon (`auth.uid()` NULL) always resolves to `'{}'` → every predicate fail-closed.
3. **Role checks always read `child_access.role`, never `users.role`.** `users.role` is a display/profile attribute; only `child_access` rows confer authority. A policy that branches on `users.role` is a privilege-escalation bug until proven otherwise.
4. **Service role bypasses RLS — so every service_role path carries and asserts an explicit `child_id` in SQL**, not by convention. The enforcement points: `get_tenant_secret` raises on NULL `p_child_id`; `audit_event` requires an explicit, existing `child_id` from service_role callers (NULL only for `actor_kind='system'`); workers learn the authoritative id from the claimed queue row.

## 06.2 RLS authoring rules

Write every policy as if an adversary will read it. The canonical shapes:

```sql
-- Tenant read: members of the set. Nothing else.
DROP POLICY IF EXISTS <table>_tenant_read ON public.<table>;
CREATE POLICY <table>_tenant_read ON public.<table>
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

-- Tenant write: parent-role holders in the set. Split by command —
-- never FOR ALL without a role predicate (FOR ALL invites exactly the
-- H1-class bug: one over-broad USING clause becomes the write check too).
DROP POLICY IF EXISTS <table>_parent_insert ON public.<table>;
CREATE POLICY <table>_parent_insert ON public.<table>
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.<table>.child_id
                  AND ca.role = 'parent')
  );
-- Repeat for UPDATE (USING + WITH CHECK) and DELETE (USING) as needed.
```

Rules:

1. **Schema-qualify the helper**: always `public.current_child_ids()`, never bare. Policies run under caller-controlled `search_path` in some paths; the qualification removes the ambiguity.
2. **Self-referencing policies** (a policy on `child_access` whose EXISTS subquery reads `child_access`) are allowed *only* because the subquery re-enters through the table's own SELECT policy, which is equally restrictive. If you add such a policy, write the F12-style justification in a comment: who the subquery is visible to, and why it cannot be satisfied for foreign tenants.
3. **`DROP POLICY IF EXISTS` before every `CREATE POLICY`.** Postgres has no `CREATE POLICY IF NOT EXISTS`; without the drop, re-running a migration fails on duplicates and breaks rehearsal/CI.
4. **No policy may be satisfiable by `child_id IS NULL` unless NULL rows are genuinely cross-tenant-safe.** The invites NULL arm was a privilege-escalation hole; the audit_log NULL arm was a cross-tenant read leak. Default: NULL fails the predicate; carve-outs need a written justification.
5. **Destructive operations go through audited RPCs, not direct policies.** Pattern: `revoke_child_access()` — asserts parent membership, enforces invariants the policy language cannot (never remove the last parent), audit-logs, and the table carries *no* DELETE grant/policy for clients. Direct DELETE policies on membership or tenant-root tables are a review red flag.
6. **Append-only tables** (`consents`, `audit_log`): no UPDATE/DELETE policies **and** no UPDATE/DELETE grants. Revocation/correction is a new row. Attribution columns (`granted_by`) must be constrained to `auth.uid()` in WITH CHECK — otherwise the ledger's "who" is forgeable.
7. **Child-role users never get write policies on structural tables.** If PLAN prescribes member-wide writes on some table, that is a product decision recorded in the plan — not a default. When in doubt, parent-write-only.

## 06.3 GRANT discipline — policies alone grant nothing

PostgREST checks **both** the GRANT and the RLS policy. A perfect policy with no GRANT is a dead app; a broad GRANT with a sloppy policy is a breach. Rules:

1. **Every migration that creates tables or functions ends with an explicit GRANT block.** Never rely on defaults. `anon` gets nothing on tenant tables (the only anon-readable surface is the `school_systems` registry, granted in 002).
2. **Least privilege per table**: grant only the commands the app actually uses. `child_access` → `SELECT, INSERT` (no UPDATE/DELETE: role changes are revoke+grant; deletes are the RPC). `invites` → `SELECT, INSERT, UPDATE` (no DELETE: revocation is a status update). `audit_log` → `SELECT` only (writes via `audit_event`).
3. **Column-level GRANTs for security-critical columns.** `GRANT UPDATE (display_name) ON users` — `role`/`email` can never be client-rewritten even if a future policy is sloppy. `children`'s UPDATE grant allowlists every column **except** `parent_user_id`. `vault_secret_id` is granted to no client role, period. Prefer allowlist column grants over REVOKEs: they read as documentation.
4. **Functions: `REVOKE ALL ... FROM PUBLIC` then grant to named roles.** New functions default to `EXECUTE TO PUBLIC` (anon-invocable). `consume_invite`, `create_child`, `revoke_child_access`, `audit_event`, `get/set_tenant_secret` are all revoked from PUBLIC. Exception: `current_child_ids()` stays PUBLIC — RLS policy evaluation needs it for every role including anon.
5. **Views do not inherit safety.** A view without `security_invoker = true` runs as its *owner* and silently bypasses RLS on the base tables (this was a Round-1 critical on `child_portals_public`). Any new view over tenant tables gets `WITH (security_invoker = true)` **plus** the column-grant treatment — RLS gates rows, grants gate columns.

## 06.4 SECURITY DEFINER discipline

A DEFINER function is a trust boundary: it runs as the owner and bypasses RLS. Every one must:

1. **`SET search_path = public`** (or `public, vault` where Vault is needed) — non-negotiable; without it, a caller-controlled `search_path` can redirect unqualified table/function references.
2. **Re-assert membership itself.** Never trust that "the caller must have passed RLS to get here" — RPCs are directly invocable. The assertion shape:
   ```sql
   -- service_role branch: explicit child_id, verified to exist (RLS is bypassed, so assert here)
   -- agent_reader branch: current_child_ids() already resolves the job scope; the member check below just works
   -- everyone else: must satisfy the same predicate the RLS policy would
   IF NOT (p_child_id = ANY (public.current_child_ids())) THEN
     RAISE EXCEPTION 'tenant_membership_required';
   END IF;
   ```
   For functions where service_role is a legitimate caller, branch on the verified JWT role claim first: `(current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'`, and in that branch require an explicit, existing `child_id`. Direct-psql callers have no claims → fall into the membership branch → `auth.uid()` NULL → raise. Fail-closed by construction.
3. **Fail closed on NULLs.** Prefer `IS DISTINCT FROM` over `<>` in security comparisons — `x <> NULL` is NULL, and `IF NULL` silently skips the check (this was a Round-1 critical in `consume_invite`'s email match). Add `lower()` on email comparisons.
4. **Serialize claim-then-act on bearer tokens.** `consume_invite` does `SELECT ... FOR UPDATE` on the invite row: concurrent consumptions serialize; the loser sees a non-pending status and raises. Any future "redeem this token/code" function needs the same row lock.
5. **Keep DEFINER functions small and auditable.** One authorization decision at the top, then the work. If a function needs two different authority levels, split it.

## 06.5 Migration hygiene

1. `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` + `CREATE POLICY`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — migrations must be re-runnable (rehearsal, CI, fresh projects).
2. **`LANGUAGE sql` function bodies are validated at CREATE time** (unlike plpgsql, which resolves at first execution). A SQL-language function may only reference objects created *earlier* in migration order — this is why `agent_tenant_scope` lives in 001, not 005. If you add a SQL-language helper, check its dependencies against migration order.
3. Cross-migration *runtime* references (001's `consume_invite` calling 004's `audit_event`) are fine for plpgsql but must be noted in a comment — the dependency is invisible to the migration runner.
4. Every security-relevant change gets a `-- FIX YYYY-MM-DD: <what/why>` comment. The audit trail lives in the SQL, not just in docs.

## 06.6 Index conventions

RLS predicates run on *every row considered*. An unindexed predicate column turns every tenant query into a sequential scan — on the free tier, that is the difference between 5 ms and 5 s at scale.

1. **Every column appearing in a policy predicate gets an index**: `child_id` on every tenant table (composite `(child_id, …)` where the table has a natural second filter: `consents(child_id, scope, created_at DESC)`, `audit_log(child_id, at DESC)`).
2. **`child_access(user_id)`** — `current_child_ids()` filters on it per statement; the PK `(child_id, user_id)` does not serve it.
3. **Foreign-key columns** get indexes even when Postgres doesn't require them (`invites.child_id`, `agent_tenant_scope.expires_at` for the cleanup scan).
4. **Partial unique indexes for business invariants**, not just PKs: one-default-child-per-parent, one-child-per-child-user, one-parent-level-portal-per-owner. Invariants that live only in app code do not exist.
5. **Audit-log access patterns**: `(child_id, at DESC)` for the tenant timeline, `(actor_user_id, at DESC)` for per-actor disclosure accounting ("everything the agent read about this child").

## 06.7 Performance on Supabase free tier (RLS-heavy workload)

1. **`current_child_ids()` is STABLE → evaluated once per statement**, not per row. Never mark it VOLATILE, and never inline its body into policies (inlining re-evaluates per row). If you add another helper used in policies, it must be STABLE (or IMMUTABLE) for the same reason.
2. **Prefer `= ANY (array)` over `IN (subselect)`** in policies: the array is computed once; the subselect form can re-plan per row.
3. **EXPLAIN ANALYZE with RLS on.** `EXPLAIN` as the table owner does *not* show RLS costs (owner bypasses). Test query plans as `authenticated` with a real JWT (or `SET ROLE authenticated` + `SET request.jwt.claims`), or the plan you see is fiction.
4. **RLS + connection pooling**: `auth.uid()` and `request.jwt.claims` are per-transaction GUCs set by PostgREST — safe under PgBouncer transaction pooling. Do not cache tenant resolution in session-level state.
5. **Free-tier budgets that RLS touches**: 500 MB database — audit_log is append-only and unbounded; the retention policy (per-child, Data tab) must actually delete, or the table eats the budget. Statement timeouts: keep policy subqueries to single indexed EXISTS lookups; the parent-write `EXISTS (SELECT 1 FROM child_access WHERE user_id = … AND child_id = … AND role = 'parent')` is the most expensive common shape and is fully index-served.
6. **Realtime**: if Realtime is enabled on tenant tables later, its RLS evaluation follows the same rules — test subscriptions as the subscriber's JWT, not as owner.

## 06.8 Agent (Muse) data-access boundary

Normative contract (implements PLAN §4.10):

1. The agent authenticates with a **service-minted, short-lived JWT**: `{ "role": "agent_reader", "job_id": "<agent_tenant_scope.job_id>", "sub": "muse-agent", "exp": … }`. It cannot mint or widen its own scope — only the backend holding the JWT secret can.
2. `current_child_ids()` resolves the agent's tenant set from `agent_tenant_scope` via the `job_id` claim. All existing tenant RLS policies then scope the agent automatically. Missing/expired scope → `'{}'` → deny.
3. Backend job-creation flow: insert scope row (service_role) → mint JWT → agent uses it for PostgREST/RPC for that job only. Scope rows expire after 2 h.
4. `agent_assert_scope(job_id, child_id)` is the explicit assertion for code that wants it, and the *only* scoping mechanism on the direct-psql/`SET ROLE` path (no JWT claims there). EXECUTE is restricted to `service_role` + `agent_reader`.
5. Grants: SELECT-only on tenant tables; **never** `vault.secrets`, `child_portals.vault_secret_id`, `auth.users`, `public.users`, `invites` (tokens are bearer secrets), `child_access`. Every agent read/write is audit-logged (`audit_event` is EXECUTE-granted to `agent_reader`; its member branch resolves the job scope).
6. The `child_portals_public` grant to `agent_reader` is currently inert (003's parent-only policy) — pending the 003 owner's decision (drop it or add an agent SELECT arm).

## 06.9 Append-only tables

`consents` and `audit_log` are ledgers, not state:

1. No UPDATE/DELETE policies **and** no UPDATE/DELETE grants — enforced at both layers.
2. Corrections are new rows (`consents.status='revoked'` supersedes `'granted'`; never edit).
3. Every row carries its tenant (`child_id` NOT NULL on `consents`; mandatory on `audit_log` for all non-`system` events).
4. Attribution is non-forgeable: `granted_by = auth.uid()` (WITH CHECK), `actor_user_id = auth.uid()` (set inside `audit_event`, never a parameter).
5. Retention/deletion policy must be explicit — append-only tables grow monotonically against the 500 MB free-tier budget.

## 06.10 Review checklist (sign-off gate for future migrations)

- [ ] Every new tenant table has `child_id NOT NULL` (no DEFAULT — callers pass it explicitly), an index on it, and RLS enabled with `child_id = ANY (public.current_child_ids())` predicates.
- [ ] Write policies split by command with parent-role EXISTS checks; no `FOR ALL` without a role predicate; `DROP POLICY IF EXISTS` guards present.
- [ ] GRANT block present and least-privilege; column-level grants for sensitive columns; `anon` gets nothing on tenant tables.
- [ ] Every new SECURITY DEFINER function: `SET search_path`, membership re-assertion, fail-closed NULL handling, EXECUTE revoked from PUBLIC.
- [ ] `LANGUAGE sql` helpers only reference objects created earlier in migration order.
- [ ] No policy satisfiable by `child_id IS NULL` without a written justification.
- [ ] New views over tenant tables: `security_invoker = true` + column grants.
- [ ] Negative tests written (anon denied, child-role confined, cross-tenant reads return 0 rows, forged writes raise).
