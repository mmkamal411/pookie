# Zero-Trust Security Audit — Tenant-Isolation Proof

**Author:** Senior Manager, Integrations & Security workstream / Manager, Tenant-isolation proof
**Date:** 2026-10-11 (Round 1)
**Scope:** All five migrations (`001_tenancy_core` → `005_agent_access`). I own `002` and `003` — findings there were **fixed in place** (marked `-- FIX 2026-10-11`). Findings in `001`/`004`/`005` are documented below for the Database expert's Round 2 — those files were **not edited**.
**Threat model:** children's education records — HIGH sensitivity, zero-risk tolerance.

---

## 1. What I changed in my files (002, 003)

### 003_credential_vault.sql — 3 CRITICAL-class defects fixed

**C1 — `child_portals_public` view bypassed RLS entirely (CRITICAL).**
The view was created without `security_invoker`, so it executed with the view *owner's* (postgres) privileges. RLS does not apply to the table owner. Net effect: **any authenticated user could `SELECT` every tenant's portal metadata** (portal keys, usernames, verification timestamps) through the view, despite the base-table `REVOKE ALL`. The REVOKE gave a false sense of safety.
*Fix:* `WITH (security_invoker = true)` on the view (view now runs as the caller → RLS applies) **plus** real column-level GRANTs — `vault_secret_id` is granted to no client role, so direct `SELECT vault_secret_id` / `SELECT *` on the base table is permission-denied even where RLS would allow the row. Defense in depth: RLS gates *rows*, column grants gate *columns*.

**C2 — Parent-level (`child_id IS NULL`) portals had no family scoping (CRITICAL, multi-family).**
Four compounding defects, all in the NULL-child_id path:
1. `get_tenant_secret` matched `cp.child_id IS NULL` with **no family predicate** → a parent of child A could read the parent-level portal *credential* created by child B's family.
2. The RLS policy likewise exposed every family's NULL rows' *metadata* to any parent of any child.
3. Vault secret names collided across families (`tenant_parent__<system>`) → family B's `set_tenant_secret` would silently **overwrite family A's Vault secret**.
4. `UNIQUE (child_id, portal_key)` never fires on NULLs (Postgres NULL semantics) → the `ON CONFLICT` upsert never matched NULL rows → rotations created **duplicate rows**, and the reader's `LIMIT 1` picked one at random.
*Fix:* new `owner_user_id` column (CHECK-enforced non-null for NULL-child_id rows), partial unique index `(owner_user_id, portal_key) WHERE child_id IS NULL`, family predicate in both `get_tenant_secret` (owner must be a parent of `p_child_id`) and the RLS policy (caller must share ≥1 child with the row's owner — covers shared custody), per-owner Vault names (`tenant_parent_<owner_uuid>__<portal_key>`), branched upsert with partial-index `ON CONFLICT`.

**C3 — Missing guards + over-broad EXECUTE (HIGH).**
- `get_tenant_secret(NULL, …)` previously matched `cp.child_id IS NULL … LIMIT 1` → returned an **arbitrary family's credential**. Now raises `child_id_required`. This is where the "every service_role path carries an explicit child_id" invariant is enforced in SQL.
- `set_tenant_secret` accepted empty-string secrets. Now rejected.
- Both functions defaulted to `EXECUTE TO PUBLIC` (anon-invocable). Now `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role`. All paths fail closed (no JWT → membership assertion fails → raise).
- Base-table policy changed from `FOR ALL` to **SELECT-only**; clients hold **no write GRANTs** — all writes go through `set_tenant_secret()` (definer + explicit parent check). A client can no longer rewrite `vault_secret_id` directly.
- Contract note added: `set_tenant_secret` must be invoked with the **end-user's JWT** (Edge Function forwards the caller token), never service_role (`auth.uid()` is NULL under service_role → correctly raises).

### 002_school_systems.sql — fixed
- **M5 (was MEDIUM):** `classes` / `bell_schedules` / `child_settings` had `FOR ALL` tenant policies → **child-role users could INSERT/UPDATE/DELETE** class config, grade weights, and schedules. Split into member-wide SELECT + parent-role-only writes.
- **Functional:** added the missing `GRANT`s (RLS policies alone grant nothing — without these, PostgREST returns permission-denied for every client role): `SELECT` on `school_systems` to `anon, authenticated`; full DML to `authenticated` on the three tenant tables (RLS remains the narrow gate).
- Documented intent: `school_systems` has no write policy → owner/service_role-only (registry ships via migration, never client write). Registry contents audited: labels and operational notes only — **no secrets, no PII, no tenant data** → public `USING (true)` read is acceptable.

### jwt role-claim check reliability (investigated, no change needed)
`current_setting('request.jwt.claims', true)::jsonb ->> 'role'`:
- **PostgREST (REST + RPC):** the GUC is set from the *verified* JWT per request — reliable for workers (service_role key) and Edge Functions.
- **Direct psql:** GUC unset → `NULL` (missing_ok) → comparison yields NULL → falls through to the membership assertion, where `auth.uid()` is NULL → raises. **Fail-closed by construction.** Documented in the migration: workers must call via PostgREST/RPC, never direct SQL.
- A caller cannot forge the claim (PostgREST sets it from the signature-verified JWT).

---

## 2. Tenant-isolation proof — attackers × paths

Child X belongs to family F_X. Attacker tries to reach child Y (family F_Y). "Blocked by" names the mechanism; verdicts assume Round-1 fixes applied.

### (a) Authenticated child-role user of child X

| Path | Verdict | Blocked by |
|---|---|---|
| Direct table reads (children, classes, consents, …) | ✅ BLOCKED from Y | RLS `child_id = ANY(current_child_ids())` → set is exactly {X} |
| `users` table | ✅ BLOCKED from others | Policy: own row only (`ca1.role='parent'` branch excludes child role) |
| `child_portals` / `child_portals_public` | ✅ BLOCKED (metadata too) | Policy requires `ca.role='parent'`; column grants exclude `vault_secret_id` regardless |
| `get_tenant_secret` / `set_tenant_secret` | ✅ BLOCKED | Membership assertion requires parent role or service_role → raises |
| `consume_invite` | ✅ scoped | Token (48 hex chars) + invite-email match + `FOR UPDATE`; can only consume own invites (intended) |
| `current_child_ids()` | ✅ own set only | Returns {X} by construction |
| `agent_assert_scope` | ✅ no data | Returns boolean / raises; no row access |
| `audit_event` | ❌ **HOLE (H3)** | No authorization — can forge audit rows for any child_id |
| `audit_log` reads | ⚠️ **LEAK (H4)** | `child_id IS NULL` system rows readable by every tenant's members |
| `agent_reader` role | ✅ N/A | Separate role; child has no access path to it |
| Invite *creation* | ❌ **HOLE (H1)** | See (a)→invites below |

### (b) Authenticated parent-role user of child X

| Path | Verdict | Blocked by |
|---|---|---|
| Direct table reads | ✅ BLOCKED from Y | RLS tenant-set scoping on every table |
| `child_portals` metadata | ✅ BLOCKED from F_Y | SELECT-only policy + family predicate on NULL rows (C2 fix) |
| `vault_secret_id` direct read | ✅ BLOCKED | Column not granted to any client role (C1 fix) |
| `get_tenant_secret(Y, …)` | ✅ BLOCKED | Membership assertion (`tenant_membership_required`) |
| `get_tenant_secret(X, F_Y-family-NULL-row)` | ✅ BLOCKED | Owner-must-be-parent-of-`p_child_id` predicate (C2 fix) |
| `get_tenant_secret(X, own)` / `set_tenant_secret(X/own-NULL, …)` | ✅ ALLOWED (intended) | Parent membership in X's set |
| `set_tenant_secret` for Y | ✅ BLOCKED | `parent_membership_required` |
| `consume_invite` | ✅ scoped | Own-email invites only (intended) |
| `audit_event` | ❌ **HOLE (H3)** | Same as (a) |
| `audit_log` NULL rows | ⚠️ **LEAK (H4)** | Same as (a) |

### (c) Anonymous user / (d) Holder of a leaked anon key

Identical verdicts — the anon key confers exactly the `anon` role's privileges, no more.

| Path | Verdict | Blocked by |
|---|---|---|
| All tenant tables | ✅ BLOCKED | `auth.uid()` is NULL → `current_child_ids()` = `'{}'` → every RLS predicate false |
| `school_systems` | ✅ ALLOWED (intended) | Public registry, no secrets/PII/tenant data |
| `invites` | ✅ BLOCKED | Email subquery returns NULL; child predicate false |
| `child_portals_public` view | ✅ BLOCKED | No GRANT to `anon` |
| `get/set_tenant_secret` | ✅ BLOCKED | Fail-closed (no JWT claims, no membership) → raise |
| `consume_invite` | ✅ BLOCKED | `auth.uid()` NULL → email mismatch → raise |
| `audit_event` | ❌ **HOLE (H3)** | PUBLIC execute, no authz — anon can inject audit rows |
| `agent_assert_scope` | ✅ no data | Boolean only |

### (e) Compromised worker holding service_role

| Path | Verdict | Blocked by |
|---|---|---|
| Direct reads/writes, all tables | ❌ **NOT BLOCKED** | service_role bypasses RLS by design |
| `vault.decrypted_secrets` | ❌ **NOT BLOCKED** | Same bypass |
| `get_tenant_secret(any child, any system)` | ❌ **NOT BLOCKED** | Explicitly trusted path; returns plaintext |
| `auth.users` | ❌ **NOT BLOCKED** | Service-role bypass extends to auth schema |

This is the **accepted residual** (PLAN §4.7 #1): it cannot be closed in SQL. Mitigations are key-management, not policy: service_role key lives in the Secure Vault only, never in bundles/repos/logs; rotate on suspicion; prefer narrow per-worker DB roles long-term; alert on anomalous `get_tenant_secret` volume per child. The per-claim design still bounds blast radius in *time* (fetch-at-claim, zeroize after — no standing credential cache to steal).

---

## 3. Findings for Database expert — Round 2 (001 / 004 / 005 — NOT edited)

### HIGH
- **H1 — `001.invites_parent_write` has no role check → child-role privilege escalation.** The policy (`FOR ALL USING (child_id IS NULL OR child_id = ANY(current_child_ids()))`) lets a **child-role user create invites for their own child — including `role='parent'`**. `consume_invite` is SECURITY DEFINER (bypasses the `child_access_parent_insert` role check), so the invited accomplice lands in `child_access` as a parent with full access to the child's data. Recommended fix: add `AND EXISTS (SELECT 1 FROM child_access ca WHERE ca.user_id = auth.uid() AND ca.role='parent' AND (invites.child_id IS NULL OR ca.child_id = invites.child_id))` to the policy's WITH CHECK (children may still need a narrow "invite a sibling/parent-request" path — product decision).
- **H2 — `001` tables have no GRANTs.** `users`, `children`, `child_access`, `invites` define RLS policies but grant nothing to `anon`/`authenticated` → PostgREST returns permission-denied for every client; the app cannot function. Recommended: `GRANT SELECT, INSERT, UPDATE, DELETE ON … TO authenticated` (RLS stays the narrow gate). Same gap on `004` (`consents` needs SELECT+INSERT; `audit_log` needs SELECT).
- **H3 — `004.audit_event` has PUBLIC execute and zero authorization → audit-trail forgery.** Any anon or authenticated user can insert arbitrary rows for any `child_id` with any `actor_kind`/`action`. Recommended: `REVOKE ALL ON FUNCTION … FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role;` and assert caller membership for `p_child_id` (or force `actor_user_id = auth.uid()` and a fixed `actor_kind='user'` for non-service callers).
- **H4 — `004.audit_log_tenant_read` leaks system rows cross-tenant.** The `child_id IS NULL OR …` arm makes every tenant's members able to read all system-level audit events. Recommended: scope NULL rows to a support/admin role or drop the NULL arm (route system events through a separate table).

### MEDIUM
- **M2 — `005.agent_tenant_scope` has no RLS and the agent path is a design gap.** Table created without `ENABLE ROW LEVEL SECURITY` and without documented readers/writers. Worse: `agent_reader` holds no `child_access` membership, so `auth.uid()`-based RLS on every granted table returns **empty** — as specified, the agent cannot read anything. Decide one: (i) dedicated RLS policies for `agent_reader` keyed on `agent_tenant_scope` + a per-request GUC carrying `job_id`; or (ii) membership rows for the agent identity. Note: my Round-1 `security_invoker` fix on `child_portals_public` (correct) also gates the `005` grant on that view — confirm whether the agent genuinely needs portal metadata, and if so, via which of the two options.
- **M3 — All SECURITY DEFINER functions default to `EXECUTE TO PUBLIC`.** `consume_invite`, `current_child_ids`, `audit_event`, `agent_assert_scope` are anon-invocable (fail-closed today, but harden: `REVOKE FROM PUBLIC`, grant to `authenticated` ± `service_role`).
- **M6 — `001.children_parent_write` lets parents rewrite `parent_user_id`.** Low blast radius (nothing authz-references the billing anchor), but tighten to exclude the anchor column or log the change.

### LOW
- **L4 — `001.handle_new_auth_user` defaults new users to `role='parent'`.** Benign today (zero `child_access` rows → sees nothing until invite consumption corrects the role), but a fail-open-shaped default; consider defaulting to `'child'` or adding a `'pending'` role value.
- **L5 — `001.child_access_parent_delete` lets a parent remove any member of their child, including co-parents and themselves.** Family-management by design; orphaning self is an operational footgun — consider preventing self-removal as the last parent.
- **L6 — `consume_invite` has no rate limiting on token guessing.** 48 hex chars (192 bits) — infeasible; noted for completeness.

---

## 4. Verification checklist for Round 2 (my component)

- [ ] Apply 001–005 to the new `pookie` project; confirm the partial-index `ON CONFLICT (owner_user_id, portal_key) WHERE child_id IS NULL` infers correctly (else name the index in the conflict target).
- [ ] Negative tests: child-role JWT → `SELECT * FROM child_portals_public` returns 0 rows; `SELECT vault_secret_id FROM child_portals` → permission denied; `SELECT get_tenant_secret('…','parentvue')` → raises.
- [ ] Cross-family test: parent_B calls `get_tenant_secret(child_A, 'parentvue')` → `tenant_membership_required`; parent_A's NULL row invisible in parent_B's `child_portals_public`.
- [ ] Vault-name collision test: two owners set NULL `parentvue` → two distinct `vault.secrets` rows (`tenant_parent_<uuidA>__parentvue`, `tenant_parent_<uuidB>__parentvue`).
- [ ] Rotation test: second `set_tenant_secret(NULL,'parentvue',…)` by same owner → exactly one row (no duplicates).
- [ ] Confirm the `portal-credential-write` Edge Function forwards the **user JWT** (not service_role) when calling `set_tenant_secret`.

---

**Round-1 sign-off status:** my component (002, 003) fixes are written and internally reviewed. Final sign-off pending Round-2 consolidated fix list from cross-workstream reviewers — per the Director's instruction, Round 1 is not final.
