# Zero-Trust Security Audit — Tenant-Isolation Proof

**Author:** Senior Manager, Integrations & Security workstream / Manager, Tenant-isolation proof
**Date:** 2026-10-11 (Round 1)
**Scope:** All five migrations (`001_tenancy_core` → `005_agent_access`). I own `002` and `003` — findings there were **fixed in place** (marked `-- FIX 2026-10-11`). Findings in `001`/`004`/`005` are documented below for the Database expert's Round 2 — those files were **not edited**.
**Threat model:** children's education records — HIGH sensitivity, zero-risk tolerance.

---

## Round 2 (2026-10-11) — Director's fix list, all 8 items applied

All edits are in `002_school_systems.sql` / `003_credential_vault.sql`, marked
`-- FIX 2026-10-11 R2`. Both files re-parsed with pglast after editing
(002: 29 statements OK; 003: 24 statements OK). Semantic checks: all four
SECURITY DEFINER functions pin `SET search_path = public`; zero unqualified
Vault references; no residual parent branch in `get_tenant_secret`.

### R2-1 (CRITICAL) — plaintext-secret return to parents removed; `test_portal_connection` added
- `get_tenant_secret()`: the `OR EXISTS (… role='parent' …)` caller branch is
  **deleted**. The function is now service_role-only: the membership assertion
  accepts the PostgREST `request.jwt.claims → role = 'service_role'` signal OR
  `current_user = 'service_role'`. `GRANT EXECUTE` was narrowed from
  `authenticated, service_role` to **`service_role` only** (defense in depth —
  the assertion already raises for client roles, but the RPC is no longer even
  invocable by them). This closes integration-expert C1, security-engineer
  SEC-005, and solution-architect H4 in one move: no parent JWT can reach
  decrypted portal passwords via PostgREST RPC, matching PLAN §4.8 ("only
  service_role + credential-test Edge Function ever see the secret"; "The Edge
  Function never returns the secret value").
- New `test_portal_connection(p_child_id uuid, p_portal_key text) RETURNS
  boolean` (SECURITY DEFINER, parent-only, `SET search_path = public`):
  resolves the portal row with the *same family-scoped logic* as
  `get_tenant_secret` (child row preferred, then the caller's family's
  parent-level row; NULL `p_child_id` resolves only rows the caller owns —
  `owner_user_id = auth.uid()` in the predicate), decrypts the secret
  **server-side** to prove the Vault material is intact, and returns a boolean
  — the secret never leaves the database. Documented scope honesty: this is a
  credential-material integrity check, NOT a live portal login; the live login
  belongs to the credential-test Edge Function (PLAN §4.8), which calls
  `get_tenant_secret()` with the service_role key after its own parent check
  and returns only `{ok, checked_at}`. Status is untouched (verification flips
  belong to the future `mark_portal_verified`). Error strings stay static
  literals. Non-members raise `parent_membership_required` (fail-closed); no
  credential returns FALSE (idempotent UI behavior, no existence oracle beyond
  what the parent already sees in `child_portals_public`).
- Residual risk noted: none new — the parent JWT attack surface that existed
  in R1 (two RPC calls → all portal passwords) is eliminated at the DB layer.

### R2-2 — `current_user = 'service_role'` accept condition on direct SQL
- `get_tenant_secret` now accepts `current_user = 'service_role'` alongside
  the `request.jwt.claims` GUC check (integration-expert H1). The comment
  documents both paths: PostgREST sets the GUC from the verified JWT
  (REST/RPC); direct-SQL sessions (psql, psycopg/pgBouncer workers) have no
  GUC, so the old check failed closed against *legitimate* workers.
  `current_user` is set by Postgres from the authenticated connection role —
  not forgeable by SQL text — and under PostgREST the session role already
  equals the JWT role, so the RPC path stays sound. Workers should still
  **prefer the PostgREST/RPC path**; direct SQL is a supported fallback.
  (Not applied to `test_portal_connection`/`set_tenant_secret`/
  `remove_tenant_secret`: those are parent-JWT flows where `auth.uid()` is
  the correct authority.)

### R2-3 — registry completeness (002)
- `school_systems` gains `oauth_config`, `auth_requirements`,
  `api_endpoints`, `rate_limits`, `capabilities` (jsonb, nullable) and
  `contract_version text NOT NULL DEFAULT 'v1'` via
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (idempotent on re-run).
- Cobb seed row's `credential_fields` upgraded to the fuller spec
  `{key,label,type,secret,required,placeholder?,order}` (integration-expert
  H9), plus its known `auth_requirements` (Cobb Conditional Access warning —
  the Portals UI must warn BEFORE a parent saves credentials) and
  `capabilities` (`get_grades/get_assignments/get_attendance/get_messages`
  all true — the four Adapter #1 contract methods). Applied as an UPDATE
  guarded on `system_key`, so re-runs backfill projects seeded by the older
  row shape. `oauth_config`/`api_endpoints`/`rate_limits` intentionally left
  NULL for Cobb: unknown or per-district — invented values would be worse.
  M2 note: workers must fail closed on unknown contract majors (worker-side
  rule, documented in the column comment).

### R2-4 — failure-mode schema (003)
- `child_portals` gains `consecutive_failures int NOT NULL DEFAULT 0` and
  `credentials_updated_at timestamptz NOT NULL DEFAULT now()` (in the CREATE
  TABLE plus an idempotent ALTER backfill). `set_tenant_secret()` bumps
  `credentials_updated_at = now()` on every rotation (both upsert branches)
  so long jobs can detect mid-job staleness.
- Claim-pausing documented as an **enforcement contract** in the migration:
  the worker owns the counter (increment on sanitized auth failure, reset on
  success); after N failures the worker pauses claims and the app nudges the
  parent with a Portals deep link. The DB records; it does not gate. `status`
  stays `('unverified','verified','failed')` — `'paused'` is intentionally
  not a status value (pausing is a worker claim decision, not row state).
- Both columns are portal *metadata* (never secrets): added to
  `child_portals_public` and to the base-table column GRANT so the Portals UI
  can render the failure/nudge UX. `vault_secret_id` remains granted to no
  client role.

### R2-5 — `remove_tenant_secret` RPC
- New `remove_tenant_secret(p_child_id uuid, p_portal_key text) RETURNS
  boolean` (SECURITY DEFINER, parent-only, `SET search_path = public`,
  EXECUTE to `authenticated, service_role`, revoked from PUBLIC). Same
  end-user-JWT contract note as `set_tenant_secret`.
- **Decision (documented in the migration): the metadata row is DELETED, not
  kept with `status='unverified'.** A kept row would render a phantom portal
  card ("unverified" with no credential behind it) and reintroduce the
  NULL-row bookkeeping the partial unique index was built to avoid. The Vault
  secret is truly deleted — closing security-engineer SEC-010 (compromised-
  secret response requires deletion, not overwrite).
- Implementation note: `vault.delete_secret()` **does not exist** in the
  supabase_vault extension (verified 2026-10-11: only `create_secret` /
  `update_secret` are exposed; community docs confirm deletion is
  `DELETE FROM vault.secrets` directly). The function deletes via
  `DELETE FROM vault.secrets WHERE id = …` inside the definer (the caller
  holds no vault privileges). Known residue documented: the secret's
  pgsodium key row is orphaned (operational housekeeping, not a security
  issue). Returns FALSE when nothing matched (idempotent UI). Removal
  audit-logging is the calling Edge Function's job — `audit_event` lives in
  004, applied after this migration, so 003 stays self-contained.

### R2-6 — agent portal-metadata grant: DECISION
- **Decision: YES, the agent needs portal metadata** (status / username /
  `consecutive_failures` — e.g. Pookie answering "is ParentVUE connected?",
  briefing copy saying "sync paused, ask a parent to re-enter the password"),
  **never secrets** — and the secret-less view already guarantees that
  (`vault_secret_id` is not in the select list and is granted to no client
  role).
- The grant already exists in 005 (`GRANT SELECT ON
  child_portals_public TO agent_reader`) and is documented there as
  currently INERT — I did not add a grant in 002/003 and did not touch 005
  (read-only this round). The grant becomes live only through the
  agent-aware RLS scope bridge (solution-architect H3 / security-engineer
  SEC-008), which does not exist yet; today `agent_reader` has no
  `auth.uid()`, so the view's RLS policy returns zero rows for it. **Do NOT
  remove the 005 grant** (removal would just require re-adding it when the
  bridge ships); **do NOT add any wider grant** (no Vault, no base table).
  The bridge migration must include the negative test: expired scope row ⇒
  denied. Documented in 003 next to the view.

### R2-7 — search_path hygiene
- `vault` removed from `SET search_path` in `get_tenant_secret` and
  `set_tenant_secret`; both new functions use `SET search_path = public`.
  Verified by grep: every Vault reference is schema-qualified
  (`vault.secrets`, `vault.decrypted_secrets`, `vault.create_secret`,
  `vault.update_secret`, `DELETE FROM vault.secrets`) — zero bare
  references. Pinned `search_path` on all SECURITY DEFINER functions also
  blocks search_path hijacking (defense in depth, not just hygiene).

### R2-8 — verification
- pglast parse: 002 → 29 statements OK; 003 → 24 statements OK.
- Grep checks: 4/4 definer functions `SET search_path = public`; no
  unqualified vault refs; no residual parent caller branch in
  `get_tenant_secret` (the remaining `child_access … role='parent'` match is
  the *worker-side* family-scoping predicate for the parent-level fallback
  row — row resolution, not caller authorization — and is intended).
- Still needs a live project (carried over from R1 checklist, extended):
  negative tests for `test_portal_connection` (non-member raises;
  cross-family NULL-row test returns FALSE, not the other family's row);
  `remove_tenant_secret` deletes both row and `vault.secrets` entry;
  `get_tenant_secret` via parent JWT raises; the partial-index
  `ON CONFLICT (owner_user_id, portal_key) WHERE child_id IS NULL` inference
  on a real Postgres.

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

**Round-2 sign-off (2026-10-11):** all 8 Director-assigned R2 items are
applied, marked `-- FIX 2026-10-11 R2`, and parse-verified (pglast: 002 = 29
statements, 003 = 24 statements, zero errors). Semantic spot-checks pass
(pinned `search_path = public` on all 4 definer functions, zero unqualified
Vault references, no residual parent branch in `get_tenant_secret`).

**Component verdict: 002 + 003 are SIGNED OFF at the migration-SQL level.**
The R1 CRITICALs (view RLS bypass, NULL-row family scoping, secret-name
collision, NULL trap) and the R2 CRITICAL (parent plaintext-secret return)
are all closed in SQL. The highest remaining risks in my component are now
*outside* these files: (a) the agent scope bridge (005/H3/SEC-008) must land
before `agent_reader` reads anything real; (b) `mark_portal_verified` and
the worker-side failure counter/claim-pausing (documented contracts, not yet
implemented); (c) the credential-test and portal-credential-write Edge
Functions must be audited before they ship (they are the only callers of
`get_tenant_secret` and `set_tenant_secret`); (d) live-project negative
tests from the R2-8 checklist must run on the provisioned `pookie` project.

Round-1 sign-off status (superseded): my component (002, 003) fixes were
written and internally reviewed. Final sign-off pending Round-2
consolidated fix list from cross-workstream reviewers — per the Director's
instruction, Round 1 is not final.
