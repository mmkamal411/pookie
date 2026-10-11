# Database Expert Audit — Tenancy Core, RLS Correctness, Compliance, Agent Boundary

**Author:** Senior Manager, Data & Tenancy workstream / Manager, RLS correctness
**Date:** 2026-10-11 (Round 1)
**Scope:** `001_tenancy_core.sql`, `004_compliance.sql`, `005_agent_access.sql` — owned, **fixed in place** (marked `-- FIX 2026-10-11`). `002`/`003` read-only; findings there are flagged for their owners, not edited.
**Method:** line-by-line policy/function/index/trigger review against PLAN.md §3.1, §4.1, §4.2, §4.10; cross-checked with the zero-trust architect's Round-1 findings (several independently confirmed — noted as "confirmed"). All five migration files parse (verified with `pglast`).

---

## 1. What I changed in my files

### 001_tenancy_core.sql — 12 fix groups

**F1 (CRITICAL, confirmed) — `invites_parent_write` privilege escalation → split into parent-only policies.**
The old `FOR ALL USING (child_id IS NULL OR child_id = ANY (current_child_ids()))` had no role check at all: once GRANTs exist (F2), *any* authenticated user could INSERT `child_id`-NULL invites (no membership predicate on the NULL arm), and any child-role user could mint invites — including `role='parent'` — for their own tenant. Since `consume_invite()` is SECURITY DEFINER, such an invite converts directly into a parent `child_access` row: full privilege escalation via a self-issued invite. Fixed: `invites_parent_insert` / `invites_parent_update` require a parent-role `child_access` row on the invite's child (USING **and** WITH CHECK); `invites_parent_read` allows parent members plus the invitee themself (case-insensitive email match); **no DELETE policy** — revocation is `UPDATE status='revoked'` (ledger-like), expired-row cleanup is a service_role job; `child_id IS NULL` (new-family) invites have **no RLS write path** — service_role only.

**F2 (HIGH, confirmed) — missing GRANTs.** RLS policies alone grant nothing; without these PostgREST returns permission-denied for every client role. Added least-privilege grants: `users` → `SELECT` + column-level `UPDATE (display_name)` to `authenticated`; `children` → `SELECT`, column-allowlisted `UPDATE` (everything **except** `parent_user_id` — the billing anchor is never client-rewritable), `DELETE` to `authenticated`, **no INSERT** (see F4); `child_access` → `SELECT, INSERT` only (no UPDATE/DELETE — see F5); `invites` → `SELECT, INSERT, UPDATE` (no DELETE). `anon` gets nothing on tenancy tables. `agent_tenant_scope` gets no grants to any client role.

**F3 (MEDIUM) — `users` had no UPDATE path at all; role-escalation guard.** Added `users_self_update` (`id = auth.uid()`). The security property is carried by the **column GRANT** (`UPDATE (display_name)` only), not by policy text — it survives future policy edits and makes a self `role='parent'` escalation impossible at the grant layer.

**F4 (HIGH) — `children` had no working INSERT path (add-a-child wizard was silently broken).** The old `FOR ALL USING` could never permit INSERT (a fresh id is never in `current_child_ids()`). New `create_child()` SECURITY DEFINER RPC: asserts the caller already holds a parent-role row (a family's *first* child always comes from `consume_invite`), creates the child row **and** the caller's parent access row atomically (no orphan-tenant window), generates a clean slug with a retry loop on `unique_violation`, audit-logs `child.created`.

**F5 (MEDIUM) — direct DELETE on `child_access` replaced by `revoke_child_access()` RPC.** A parent could previously delete any access row, including the last parent row — orphaning the tenant (unmanageable, unrecoverable without admin). The RPC refuses `cannot_remove_last_parent`, audit-logs every revocation, and logs *before* deleting (otherwise a parent removing their own row would fail `audit_event`'s membership check and roll back). Old `child_access_parent_delete` policy dropped.

**F6 (CRITICAL) — `consume_invite()` hardening, 6 sub-fixes.**
- (a) **Fail-open email check → fail-closed.** Old: `IF v_invite.email <> (SELECT email ...)` — a missing `users` row yields NULL → `IF NULL` → check *skipped*. New: `lower(v_invite.email) IS DISTINCT FROM lower(v_caller_email)` — NULL can never pass, and case mismatches (`MehediKamal@` vs `mehedikamal@`) no longer strand legit users in pending-invite state.
- (b) **Double-provisioning / mixed-role guards.** A login holding any access rows cannot consume a second `child` invite (clear `already_provisioned` error instead of a raw unique-violation). A `parent` invite for a current child-role holder promotes the *same-child* row in place; child-of-A → parent-of-B raises (`role_conflict_requires_admin` — mixed roles unsupported, admin path only).
- (c) New-family slug is deterministic per invite with a 5-attempt retry loop on `unique_violation` (concurrent consumes of one token serialize on `FOR UPDATE`; the loser sees `status='accepted'` and raises first).
- (d) `users.role` synced to the granted role in both directions (was child-only).
- (e) Logs `access.granted` via `audit_event()` (defined in 004; plpgsql resolves it at execution time — safe cross-migration reference, noted in-file).
- (f) `EXECUTE` revoked from PUBLIC → `authenticated, service_role` only. Blank tokens rejected up front.

**F7/F8** — the two new RPCs above (`create_child`, `revoke_child_access`), both `SECURITY DEFINER`, `SET search_path = public`, EXECUTE revoked from PUBLIC.

**F9 (HIGH) — agent path made actually functional + enforceable.** `agent_reader` holds no `child_access` rows, so every granted table returned EMPTY — the boundary was specified but dead. `current_child_ids()` is now agent-aware: when the verified JWT carries `role='agent_reader'`, the tenant set resolves from `agent_tenant_scope` via the service-minted `job_id` claim (missing/expired scope → `'{}'` → fail-closed). Every tenant RLS policy funnels through `current_child_ids()`, so the per-job boundary is enforced **by RLS itself, not by query convention** — no per-table agent policies needed. `agent_tenant_scope` table **moved from 005 to 001** (Postgres validates a `LANGUAGE sql` function body at CREATE time, so the table must exist first); RLS enabled with **no policies** (deny-all; definer-only reads, service_role-only writes).

**F10 (MEDIUM) — `handle_auth_user_updated` trigger.** `auth.users` email changes now propagate to `public.users.email`. The platform is email-keyed; a stale email silently breaks invite matching and the tenant resolver.

**F11 (MEDIUM) — `DROP POLICY IF EXISTS` before every `CREATE POLICY`.** Postgres has no `CREATE POLICY IF NOT EXISTS`; re-running the migration used to fail on duplicates.

**F12 (verified, no change) — explicitly checked per the Director's hunt list:**
- `users_self_read` join: **no cross-tenant email leak.** The EXISTS arm requires the *caller* to hold `role='parent'` on the *shared* child; child-role callers see only their own row; anon sees nothing.
- `child_access_parent_insert` self-reference: **not abusable.** The EXISTS subquery re-enters `child_access` through the SELECT policy, which is equally restrictive — a caller cannot observe (hence cannot satisfy the check for) a child they are not a member of; child-role callers fail the `ca.role='parent'` predicate even for their own child.
- `handle_new_auth_user` default-role window: **harmless.** Every policy gates on `child_access`, never on `users.role` — `role='parent'` with zero access rows sees nothing.
- `current_child_ids()` NULL/`'{}'` edges: **never NULL** (COALESCE); `x = ANY('{}')` is false, never NULL; anon (`auth.uid()` NULL) always gets `'{}'` → every predicate fail-closed.
- Privilege-escalation sweep: no child-role path reaches any parent-only branch (all parent branches predicate on `child_access.role='parent'`, never on the client-settable `users.role`).

### 004_compliance.sql — 6 fix groups

**F1 (HIGH) — `consents_parent_insert` forged attribution.** Added `granted_by = auth.uid()` to WITH CHECK — a parent could previously file a consent "granted by" any user in an append-only *legal* ledger. Also added a `consents_scope_nonempty` CHECK (empty-scope consents are meaningless).

**F2 (HIGH, confirmed) — missing GRANTs.** `consents` → `SELECT, INSERT`; `audit_log` → `SELECT` (to `authenticated`). No UPDATE/DELETE grants anywhere — append-only enforced by grants *and* by absent policies.

**F3 (CRITICAL, confirmed) — `audit_event()` forgery.** Was PUBLIC-execute with zero authorization: anyone (including anon) could forge rows for any `child_id` with any `actor_kind`/`action`. Now: EXECUTE revoked from PUBLIC (`authenticated` + `service_role`; `agent_reader` granted in 005); non-service callers must be members of `p_child_id` (NULL rejected); **service_role must carry an explicit, existing `child_id`** — the platform invariant, enforced here because service_role bypasses RLS (NULL allowed only for `actor_kind='system'` global events); empty actions rejected; `actor_user_id` is always `auth.uid()` (callers cannot attribute to others).

**F4 (HIGH, confirmed) — `audit_log_tenant_read` cross-tenant leak.** Dropped the `child_id IS NULL OR ...` arm: system-level audit rows were readable by *every* tenant's members. Tenant events must carry their `child_id`; NULL-child rows are now service_role/admin-only.

**F5** — `DROP POLICY IF EXISTS` guards. **F6** — new `audit_log_actor_idx (actor_user_id, at DESC)` for per-actor disclosure queries.

### 005_agent_access.sql — 6 fix groups

**F1** — scope table moved to 001 (see above); contract documented here. **F2** — agent JWT contract documented (`role` + `job_id` claims, short-lived, service-minted); RLS auto-scopes via the 001 fix. **F3** — `agent_assert_scope` EXECUTE revoked from PUBLIC → `service_role, agent_reader` (it is a `(job_id, child_id)` validity oracle; not for anonymous callers); `audit_event` EXECUTE granted to `agent_reader` here (role doesn't exist when 004 runs). **F4** — explicit `GRANT USAGE ON SCHEMA public TO agent_reader`. **F5/F6** — cross-workstream flags (below).

---

## 2. Findings for other workstreams (NOT edited — their files)

### For the 003 (credential vault) owner
- **FLAG-1:** the `GRANT SELECT ON child_portals_public TO agent_reader` in 005 is currently **inert** — 003's Round-1 `security_invoker` + parent-only policy means the agent (never a parent member) reads 0 rows through it. Either drop the grant or add an agent-reader SELECT arm to 003's policy. No data leaks today; the grant is dead weight until decided.
- **FLAG-2 (verify):** with my agent-aware `current_child_ids()`, any *future* 003 policy arm written as `child_id = ANY (public.current_child_ids())` automatically scopes the agent — no special-casing needed. If you add the FLAG-1 arm, that single predicate suffices.

### For the ETL migration owner
- **FLAG-3:** carried-over tables (`checkins`, `tutor_chat`, `private_notes`, `class_emails`, `sync_requests`, `studentvue_syncs`, `parent_sync`, `merged_syncs`, `grade_history`, `daily_content`, `peer_tips`, …) need `GRANT SELECT ... TO agent_reader` in the ETL migration, or agent reads fail with permission-denied. Their RLS (`child_id = ANY (current_child_ids())` per PLAN §3.1) will scope the agent automatically — no per-table agent policies required. Also: those tables need the same explicit client GRANTs (policies alone grant nothing) and `DROP POLICY IF EXISTS` guards.

### For the 002 (school systems) owner
- **FLAG-4:** 002's policies lack `DROP POLICY IF EXISTS` — re-running 002 fails on duplicates (001/004 now have the guards; 003 already did).
- **Confirmed sane:** member-SELECT + parent-write split, explicit GRANTs, public `school_systems` registry (audited: no secrets/PII/tenant data).

### Cross-cutting (all workstream leads)
- **X-1 — storage/bucket RLS** (PLAN §3.1: `class-files` bucket paths `<uid>/<child-slug>/…`) is not covered by any migration yet — whoever owns the storage migration must apply the same `child_id`-via-`current_child_ids()` discipline; note `storage.objects` has no `child_id` column, so the policy must join through the path convention or a metadata table.
- **X-2 — user-deletion cascades vs. append-only ledgers:** `users.id → auth.users` is `ON DELETE CASCADE`, but `consents.granted_by` and `audit_log.actor_user_id` are plain FKs — deleting an auth user with ledger rows *fails*. Per-tenant erasure (Data tab, PLAN §4.5) needs a defined order (anonymize ledger attribution → delete). Not fixed here — needs a product decision.
- **X-3 — `service_role` remains the accepted residual** (PLAN §4.7 #1): it bypasses everything. Mitigations are key-management (Secure Vault only, rotation, anomalous `get_tenant_secret` volume alerts), not SQL.

---

## 3. Negative-test checklist for Round 2 (staging, new `pookie` project)

- [ ] Apply 001→005 in order on a fresh project; re-apply each (idempotency: no duplicate-policy errors).
- [ ] Anon JWT: `SELECT * FROM users/children/child_access/invites/consents/audit_log` → 0 rows or permission-denied; `SELECT audit_event(...)` → permission-denied (EXECUTE revoked); `SELECT consume_invite('x')` → permission-denied.
- [ ] Child-role JWT (child X): `SELECT * FROM children` → only X; `SELECT email FROM users` → own row only; `INSERT INTO invites ...` → RLS deny (parent-only); `INSERT INTO children ...` → permission-denied (no grant); `DELETE FROM child_access ...` → permission-denied (no grant); `SELECT * FROM invites` → 0 rows unless an invite names their email.
- [ ] Parent-role JWT: `SELECT create_child('A','B')` → new child + own parent row, visible immediately; second parent: `SELECT revoke_child_access(child, other_parent)` → ok; `SELECT revoke_child_access(child, self)` as sole parent → `cannot_remove_last_parent`; as non-sole parent → ok, then own queries return 0 rows for that child.
- [ ] Invite flow: parent creates invite (child_id set) → invitee (matching email, case-variant) consumes → access row + `users.role` correct + `audit_log` has `access.granted`; double-consume → `invite_not_found_or_expired`; tampered token → same; wrong-email caller → `invite_email_mismatch`; child-role caller consuming parent invite for another child → `role_conflict_requires_admin`.
- [ ] `consents`: parent inserts with `granted_by` = someone else → RLS deny; child-role insert → deny; UPDATE/DELETE → deny for all client roles.
- [ ] `audit_event` as parent for another tenant's child_id → `tenant_membership_required`; as anon → deny; service_role without child_id (non-system) → `service_role_audit_requires_child_id`; `audit_log` NULL-child rows invisible to tenant members.
- [ ] Agent: mint JWT `{role:'agent_reader', job_id}` with scope row → `SELECT * FROM children` → exactly the scoped child; `SELECT * FROM consents` → scoped child's rows; expired scope → 0 rows; JWT without `job_id` → 0 rows; `SELECT agent_assert_scope('bad','...')` → `agent_scope_violation`.
- [ ] `handle_auth_user_updated`: change email in auth.users → `public.users.email` follows.

---

## 4. Residual risks & open questions

1. `users.role` is a single column but access is per-child: a login that is parent-of-A and (via admin action) parent-of-B is fine; child+parent mixes are refused by `consume_invite` — the model stays coherent, but a future "co-parent who is also a student" edge would need schema work, not policy work.
2. `children` DELETE is directly granted to parent members (per PLAN §4.5 per-tenant erasure) — it cascades to *everything* with no confirmation and no pre-delete export. Recommend the app route erasure through a reviewed RPC (export → audit → delete) in a later migration; the grant is the backstop.
3. `create_child` does not seed `child_settings` (002's table) — the app must insert it after creation (RLS permits: the new child is in the caller's set). Consider a later migration-time helper if the app shouldn't own this.
4. Rate-limiting on `consume_invite` token guessing: 192-bit tokens — infeasible; noted for completeness (agrees with zero-trust L6).

---

**Round-1 sign-off status:** my component's fixes (001/004/005) are written, parse-verified, and internally reviewed against the hunt list. Final sign-off pending the Director's Round-2 consolidated fix list — per instruction, Round 1 is not final.
