# Security Audit Findings — Migrations 001–005 (pookie project)

**Auditor:** Application Security Manager, Pookie engineering pod
**Date:** 2026-10-11
**Scope:** `~/workspace/pookie-app/supabase/migrations/001_tenancy_core.sql`,
`002_school_systems.sql`, `003_credential_vault.sql`, `004_compliance.sql`,
`005_agent_access.sql` — reviewed line by line, read-only. No migrations were modified.
**Reference:** `~/workspace/your_files/app-rename-multi-child-plan/PLAN.md` (§3.1, §4.1, §4.8, §4.10).
**Data-sensitivity posture:** HIGH (children's platform; education records; portal credentials).

## Verdict

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 8 |
| LOW | 12 |

No CRITICAL findings: there is no unauthenticated path to tenant data or secrets in these
migrations, and no secret material is interpolated into error strings. The two HIGH findings are
a latent credential-exposure sink (audit log) and an invite-integrity hole whose worst-case
escalation currently fails closed only by accident of a PK conflict — the policy must be fixed
regardless (see SEC-002).

## Severity rubric

- **CRITICAL** — exploitable now, unauthenticated or low-privilege, with cross-tenant data or
  secret disclosure.
- **HIGH** — exploitable by an authenticated tenant member (including the child user, who is an
  explicit threat actor in this product's model), or a latent design gap with severe impact the
  moment a foreseeable caller misbehaves.
- **MEDIUM** — exploitable under conditions, latent multi-tenant flaws, or missing hardening that
  contradicts the PLAN's stated security posture.
- **LOW** — defense-in-depth, functional edges with security implications, accepted residuals.

---

## HIGH

### SEC-001 — `audit_log.detail` is an unconstrained jsonb secret sink readable by tenant members
- **Location:** `004_compliance.sql` — `audit_log` table + `audit_event()` + `audit_log_tenant_read` policy.
- **Description:** `detail jsonb NOT NULL DEFAULT '{}'` accepts arbitrary caller-supplied content
  with no key allowlist, no denylist, and no sanitization. `audit_log_tenant_read`
  (`child_id IS NULL OR child_id = ANY (current_child_ids())`) exposes every row — including
  `detail` — to **all** tenant members, child-role users included. `audit_event()` is a
  SECURITY DEFINER function callable by any authenticated user (no REVOKE), so any client,
  worker, or agent can persist credential-shaped material (passwords, tokens, OTP codes,
  exception strings containing secrets) into `detail`, where it sits in plaintext.
- **Why HIGH not MEDIUM:** the PLAN's own failure-mode design (§4.8) has workers "record a
  sanitized error" on portal-auth failure — the exact call site where a hurried implementation
  dumps an exception string containing the password. Convention ("sanitize at the logging
  boundary") is not enforcement, and the readership includes the child user. One bad caller =
  portal passwords readable by the teen. `agent_reader` also holds SELECT on `audit_log`.
- **Recommendation:**
  1. Normative ban in the appsec handbook (done — `09-appsec.md` §1: secrets NEVER in
     `audit_log.detail`).
  2. Add a trigger on `audit_log` rejecting `detail` keys matching a secret denylist
     (`password`, `passwd`, `secret`, `token`, `otp`, `code`, `credential`, `vault_secret_id`,
     `private_key`, …) — defense in depth, fails closed on future callers.
  3. Restrict `audit_event()` callers (REVOKE from `authenticated`; grant to the Edge
     Function / worker roles) and assert `p_child_id ∈ current_child_ids()` or service_role
     (see SEC-006).

### SEC-002 — Invite rows are mutable by any tenant member; invite integrity is exposed
- **Location:** `001_tenancy_core.sql` — `invites_parent_write` policy
  (`FOR ALL USING (child_id IS NULL OR child_id = ANY (public.current_child_ids()))`).
- **Description:** The policy has **no parent-role gate**. Any tenant member — including a
  child-role user — can INSERT, UPDATE, and DELETE invite rows for their tenant:
  - UPDATE another invitee's row: change `email` to their own, flip `status`, or retarget
    `child_id` to NULL (the WITH CHECK defaults to the USING clause, and `child_id IS NULL`
    passes it).
  - Combined with SEC-003 (tokens readable by members), a member can consume someone else's
    pending invite, burning the token and marking it `accepted` — a full denial of the
    legitimate invitee's onboarding.
- **Escalation analysis (traced to ground):** the worst case — a child hijacking a
  `role='parent'` invite to escalate — currently **fails closed**, but only by accident: the
  attacker already holds a `child_access` PK row `(child_id, user_id)`, so the escalated
  INSERT hits `ON CONFLICT DO NOTHING` and silently no-ops. This is an incidental guard, not
  a designed one. If anyone later "fixes" the silent swallow (e.g., upserting the role), the
  escalation opens. The policy must be fixed regardless of the PK accident.
- **Recommendation:** gate all invite writes on parent role:
  `EXISTS (… ca.role='parent' AND ca.child_id = invites.child_id)`; keep the invitee's
  read path. Additionally hide the `token` column from members (SEC-003).

---

## MEDIUM

### SEC-003 — Pending invite tokens are readable by all tenant members
- **Location:** `001_tenancy_core.sql` — `invites_parent_read`
  (`child_id = ANY (current_child_ids()) OR email = …`).
- **Description:** `token` is a bearer credential (192-bit, single-use, 14-day expiry). The
  policy exposes the full row — token included — to every tenant member, not just the
  inviting parent and the invitee as PLAN §4.1 intends. The `consume_invite` email-match
  check mitigates token-only abuse, but combined with SEC-002 it enables invite hijack +
  token burn. Bearer tokens must follow least privilege.
- **Recommendation:** split into a secret-less member view (no `token`) and restrict the
  token column to the inviting parent (or store only a hash and compare in `consume_invite`).

### SEC-004 — `classes`, `bell_schedules`, `child_settings` are writable by child-role users
- **Location:** `002_school_systems.sql` — `classes_tenant_all`, `bell_schedules_tenant_all`,
  `child_settings_tenant_all` (`FOR ALL USING (child_id = ANY (…))`, no role gate).
- **Description:** Any authenticated tenant member can INSERT/UPDATE/DELETE via direct
  PostgREST calls — the app UI not exposing a surface is not a control. A child user can
  rewrite `grade_weights` (corrupting the grade forecaster), `teacher_email`, notification
  routing, `send_window`, and `retention` policy. For a product whose study plan and
  parent notifications derive from these tables, this is data-integrity tampering by the
  exact actor the controls are meant to constrain.
- **Recommendation:** split policies — SELECT for members, INSERT/UPDATE/DELETE gated on
  `ca.role='parent'` (same pattern as `children_parent_write`).

### SEC-005 — `get_tenant_secret()` returns plaintext secrets to parent-role callers via PostgREST RPC
- **Location:** `003_credential_vault.sql` — `get_tenant_secret(p_child_id, p_system)`.
- **Description:** The in-function membership check deliberately admits parent-role members,
  and the function is exposed via PostgREST (no REVOKE). Any parent JWT — including one
  obtained via XSS on the parent's browser or a leaked token — can dump every portal
  password in the tenant with two RPC calls. This contradicts PLAN §4.8 ("The Edge Function
  never returns the secret value") and the "metadata only to clients" posture: once stored,
  passwords should not be retrievable by clients at all.
- **Recommendation:** `REVOKE ALL ON FUNCTION public.get_tenant_secret FROM anon, authenticated;`
  grant EXECUTE to `service_role` only (workers already call with the service_role key; the
  JWT `role='service_role'` claim passes the existing check). Keep the membership assertion
  as defense in depth.

### SEC-006 — `audit_event()` has no tenant-membership assertion; `actor_kind` is caller-controlled
- **Location:** `004_compliance.sql` — `audit_event()`.
- **Description:** Any authenticated user can append rows for **any** `child_id` (including
  other tenants' — cross-tenant log spam, readable by that tenant) with arbitrary `action`,
  `table_name`, `row_id`, `detail`, and any `actor_kind` (`'system'`, `'worker'`). This is
  audit-log forgery: a child user can plant fake `portal.verified` / `grades.read` events,
  undermining the FERPA-aligned disclosure accounting the table exists to provide.
- **Recommendation:** assert `p_child_id IS NULL AND service_role` OR
  `p_child_id = ANY (current_child_ids())`; derive `actor_kind` server-side where possible;
  REVOKE from `authenticated`.

### SEC-007 — Parent-level (`child_id IS NULL`) portal rows: duplicate credentials + cross-tenant fallback
- **Location:** `003_credential_vault.sql` — `child_portals` UNIQUE + `get_tenant_secret()`
  fallback `WHERE (cp.child_id = p_child_id OR cp.child_id IS NULL) … LIMIT 1`.
- **Description:** two defects:
  1. `UNIQUE (child_id, portal_key)` does **not** fire when `child_id IS NULL` (Postgres
     treats NULLs as distinct). Duplicate global credential rows for the same `portal_key`
     can coexist; `get_tenant_secret` picks one arbitrarily (`LIMIT 1`) — a rotated
     credential may lose to a stale one. Needs a partial unique index
     `ON child_portals (portal_key) WHERE child_id IS NULL`.
  2. `set_tenant_secret`'s NULL path requires only "parent in *some* tenant". A parent in
     tenant A can write a global row that becomes the fallback credential for tenant B's
     workers (when B has no child-specific row) — tenant A's ParentVUE credentials used to
     sync into tenant B's tables. Latent in single-family phase 1; must be re-scoped before
     second-tenant onboarding.
- **Recommendation:** partial unique index; scope the NULL path to a family/billing anchor
  (or disallow NULL until the multi-family model defines what "global" means).

### SEC-008 — `agent_reader` cannot read anything: RLS is `auth.uid()`-keyed, the scope table is not bridged
- **Location:** `005_agent_access.sql` — grants + `agent_tenant_scope` + `agent_assert_scope()`.
- **Description:** All RLS policies key on `current_child_ids()`, which keys on `auth.uid()`.
  The agent role has no login and no JWT `sub` → `auth.uid()` is NULL → tenant set is `{}`
  → **every** agent read fails closed. `agent_tenant_scope(job_id, child_id)` exists but no
  policy or helper consults it; `agent_assert_scope()` only raises/returns boolean and
  establishes no RLS context. As written, the agent is either broken or operators will
  bypass via `service_role`, defeating the entire §4.10 boundary (and its auditability).
- **Recommendation:** implement the missing bridge — e.g., a definer `agent_begin_job(job_id)`
  that validates the scope row and `SET LOCAL` a session `child_id`, consumed by an
  RLS-aware helper — or per-job scoped JWTs as the migration comment suggests. Until then,
  document that `agent_reader` is non-functional.

### SEC-009 — Global audit rows (`child_id IS NULL`) are readable by every tenant member
- **Location:** `004_compliance.sql` — `audit_log_tenant_read` (`child_id IS NULL OR …`).
- **Description:** any global event's `detail` is visible to all tenants. With multi-tenant
  growth this is a cross-tenant information leak by design.
- **Recommendation:** global rows readable by service_role / a dedicated auditor role only;
  tenant members see only their `child_id` rows.

### SEC-010 — No credential-removal path: Portals UI `[Remove]` has no backend
- **Location:** `003_credential_vault.sql` (absence).
- **Description:** PLAN §4.8 specifies `[Test connection] [Update] [Remove]` per portal card,
  but there is no `remove_tenant_secret()` RPC and no Vault-secret deletion handling.
  Stale credentials cannot be removed through the designed path; rotation without deletion
  leaves orphaned Vault secrets (compromised-secret response requires deletion, not just
  overwrite).
- **Recommendation:** add a parent-gated definer `remove_tenant_secret()` that deletes the
  `child_portals` row **and** the Vault secret, and audit-logs the removal (metadata only).

---

## LOW

### SEC-011 — `handle_new_auth_user` defaults new users to `role='parent'`
`001` trigger. Harmless today (signups OFF; `child_access` is the real gate), but if signups
are ever enabled, self-registered users land as `parent` in `users`. Recommend defaulting to
the least-privilege role or adding a neutral `'pending'` value to the CHECK.

### SEC-012 — Secret retrievals are unaudited
`get_tenant_secret()` writes nothing to `audit_log`. Parent-initiated fetches (while SEC-005
stands) leave no trail. Recommend `audit_event(child_id, 'credential.read', …)` for
non-service_role callers (skip for high-volume worker fetches, or sample).

### SEC-013 — `school_systems` is world-readable including `adapter_module`
`002` `USING (true)` exposes internal module names to anon. Minor info disclosure; acceptable
for a config registry, but split `notes`/internal fields out if the registry ever holds
anything sensitive.

### SEC-014 — Child consuming a second invite silently no-ops but burns the invite
`001` `consume_invite`: `ON CONFLICT DO NOTHING` on the PK swallows the partial-unique-index
violation for a child-role user with an existing row; the invite is still marked `accepted`.
Fails closed (no extra access) but is confusing and destroys the invite. Recommend an
explicit check with a clear error (`already_enrolled_elsewhere`).

### SEC-015 — `consume_invite` email comparison is case-sensitive
`v_invite.email <> (SELECT email …)` — `Foo@Bar.com` vs `foo@bar.com` locks out a legitimate
invitee. Use `lower()` on both sides.

### SEC-016 — `child_portals` lacks `credentials_updated_at`
PLAN §4.8's rotation/staleness design ("worker detects mid-job staleness") has no column to
read. `set_tenant_secret` should bump it on every write.

### SEC-017 — Plaintext secret in RPC params is briefly visible in `pg_stat_activity`
`set_tenant_secret(p_secret)` transits as a query parameter. Accepted residual of the
Vault-via-RPC pattern; ensure `log_statement` is never `'all'`/`'mod'` on the project and
note it in the runbook.

### SEC-018 — Vault secret-name race can orphan duplicates
`set_tenant_secret` SELECT-then-`vault.create_secret` is not atomic; concurrent calls can
create two Vault secrets with the same `tenant_<id>__<system>` name (no unique constraint
on `vault.secrets.name`), and the subsequent SELECT picks arbitrarily. Low likelihood
(single-parent UI); consider advisory lock (`pg_advisory_xact_lock`) on the secret name.

### SEC-019 — No explicit REVOKE/GRANT on any SECURITY DEFINER function
`consume_invite`, `get/set_tenant_secret`, `audit_event`, `agent_assert_scope`,
`current_child_ids` rely solely on in-function checks for their PostgREST exposure.
Defense in depth: `REVOKE … FROM anon, authenticated` and grant explicitly per caller.

### SEC-020 — `audit_event` free-text fields allow log injection
`p_action`, `p_table_name`, `p_row_id` are unconstrained text; newlines/control characters
can break downstream log parsers. Constrain `action` to a vocabulary or strip controls.

### SEC-021 — Mixed parent+child rows across tenants are possible
The partial unique index caps a user at one `role='child'` row but does not prevent
`parent` rows in other tenants for the same user. Probably harmless; document the intended
invariant (a human is either a parent or a child, globally) or accept explicitly.

### SEC-022 — `get_tenant_secret` does not verify the Vault secret's name before decrypting
The `vault_secret_id` comes from a membership-gated row, but a name-pattern assertion
(`tenant_<p_child_id>__<p_system>`) before `decrypted_secrets` would close a confused-deputy
edge if a row were ever pointed at the wrong secret. Cheap hardening.

---

## Verified clean (positive findings)

- **RAISE EXCEPTION strings are all static literals** (`invite_not_found_or_expired`,
  `invite_email_mismatch`, `tenant_membership_required`, `no_credential_for_system`,
  `parent_membership_required`, `agent_scope_violation`). No secret, `vault_secret_id`, or
  caller value is interpolated into any error message. **Keep this invariant permanently**
  (handbook §1 makes it normative).
- **RLS is enabled on every table** created in 001–004; `agent_tenant_scope` intentionally
  has no grants (service_role/definer only).
- **The 003 view+REVOKE pattern is sound:** base-table REVOKE from `anon, authenticated`
  plus the secret-less `child_portals_public` view correctly keeps `vault_secret_id` out of
  client reach — underlying-table RLS still applies to the invoker through the view, and the
  `child_portals_parent_all` policy fails closed for child-role callers.
- **`child_access` is the single access mechanism** — no policy references
  `children.parent_user_id`, per PLAN.
- **Invite tokens:** 192-bit (`gen_random_bytes(24)`), single-use (`status='pending'` check),
  14-day expiry, email-match enforced in `consume_invite`, row locked `FOR UPDATE`.
- **`consents` append-only** is actually enforced (no UPDATE/DELETE policy); `audit_log` has
  no direct-write policy (definer/service_role only).
- **`child_access` has no UPDATE policy** — roles cannot be flipped via direct UPDATE;
  self-deletion fails closed (re-insert requires parent status).
- **`get_tenant_secret` checks membership before existence** — no credential-existence oracle
  for non-members.

## Out of scope / not yet reviewable

- Storage bucket RLS (`class-files`, `<uid>/<child-slug>/…` paths) — no storage migration in
  001–005; must be audited when it lands.
- `portal-credential-write` Edge Function — does not exist yet; audit before it ships
  (it is the sole writer path for `set_tenant_secret`).
- Worker implementations (`rpc_claim_sync`, `get_tenant_secret` call sites, zeroization,
  log sanitization) — review against PLAN §4.8 when written.
- ETL migration (carried-over tables' grants for `agent_reader`) — pending.

## Remediation priority (suggested order)

1. SEC-002 + SEC-003 (invite policy + token visibility) — one migration.
2. SEC-001 (audit_log.detail guardrails) — trigger + handbook rule (rule written).
3. SEC-005 (revoke `get_tenant_secret` from `authenticated`) — one-liner, high leverage.
4. SEC-006 (`audit_event` membership assertion).
5. SEC-004 (parent-gate writes on 002 tables).
6. SEC-007 (partial unique index on NULL child_id; scope the global path).
7. SEC-008 (agent scope bridge) — before any agent reads go live.
8. SEC-010 (`remove_tenant_secret`).
9. SEC-009 (global audit rows).
10. LOW items as hygiene in the same pass.
