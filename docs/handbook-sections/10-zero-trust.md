# 10. Zero-Trust Architecture

**Owner:** Integrations & Security workstream · **Status:** normative for all contributors.
Zero-trust here is not a slogan — it is a set of enforceable SQL properties. If a rule below is not enforced by a GRANT, an RLS policy, a function assertion, or a key boundary, it does not exist.

## 10.1 Principles as applied to this stack

1. **Never trust, always verify — per request, per row.** `child_access` is the single source of truth for tenancy. No policy, function, or worker may derive tenancy from `children.parent_user_id`, from a client-supplied `child_id` alone, or from configuration. `current_child_ids()` re-resolves the caller's tenant set on every call (STABLE, SECURITY DEFINER).
2. **Defense in depth is layered, not alternative.** RLS gates *rows*; GRANTs gate *operations and columns*; SECURITY DEFINER functions gate *procedures*; the Vault gates *secrets*; key custody gates *service_role*. The Round-1 audit proved any single layer is bypassable on its own (a view without `security_invoker` silently bypassed RLS; a REVOKE without column grants left `vault_secret_id` one `SELECT` away).
3. **Fail closed.** Every authorization check is written so that NULLs, missing JWTs, and unexpected roles raise or return empty — never default-allow. New users see nothing until invite consumption grants membership.
4. **Least privilege, including for children.** Child-role users read their own tenant's data and write nothing structural: class config, schedules, settings, and credentials are parent-writable only.
5. **Secrets are never data.** Passwords live only in Supabase Vault. The database holds metadata; the application holds nothing at rest; workers hold secrets in process memory for one job, then zeroize.
6. **The service_role key is the crown jewels.** It bypasses every control in this document. Its compromise is total by design — mitigated by custody, not by SQL.

## 10.2 Tenant-isolation proof — summary

Full attacker × path matrix with mechanisms: `docs/audit-findings/zero-trust-architect.md` §2. Condensed verdicts (Y = another tenant's child):

| Attacker | Direct table reads of Y | Via SECURITY DEFINER fns | Via `child_portals_public` | Via invites | Via `agent_reader` |
|---|---|---|---|---|---|
| (a) Child-role user of X | BLOCKED (RLS tenant set = {X}) | BLOCKED (parent/service_role assertions); ⚠️ `audit_event` forgeable (H3) | BLOCKED (parent-only policy) | Scoped to own email; ❌ can *create* parent invites (H1) | N/A |
| (b) Parent-role user of X | BLOCKED (RLS) | BLOCKED for Y (`tenant_membership_required`); family-scoped NULL-portal fallback | BLOCKED from other families' rows | Scoped (intended) | N/A |
| (c) Anonymous / (d) leaked anon key | BLOCKED (`auth.uid()` NULL → empty set) | BLOCKED (fail-closed); ❌ `audit_event` injectable (H3) | BLOCKED (no grant) | BLOCKED | N/A |
| (e) Compromised worker (service_role) | **NOT BLOCKED — by design** | **NOT BLOCKED — by design** | **NOT BLOCKED — by design** | N/A | N/A |

Two structural truths fall out of the matrix:
- **Everything except (e) is blocked by at least two independent mechanisms** (e.g., `vault_secret_id` is protected by *both* the RLS policy *and* the absence of a column grant). Single-mechanism protections were the source of every Round-1 critical.
- **Attacker (e) cannot be constrained in SQL.** The compensating controls are: key in Secure Vault only, never in bundles/repos/logs; rotation on suspicion; per-claim secret fetching (no standing cache to steal); anomaly alerting on `get_tenant_secret` volume. Long-term: replace broad service_role workers with narrow per-worker DB roles.

Known holes handed to Round 2 (Database expert): **H1** child-created parent invites (privilege escalation), **H3** `audit_event` forgery, **H4** cross-tenant system audit rows, **M2** `agent_reader` cannot actually read anything as specified (no membership → RLS returns empty; needs dedicated policies or agent identity membership).

## 10.3 Service-role path rules

Service role bypasses RLS. Therefore every service_role path obeys these invariants — enforced in code review and, where possible, in SQL:

1. **Every service call carries an explicit `child_id`.** No ambient, configured, or defaulted tenant. `get_tenant_secret` raises `child_id_required` on NULL — the invariant is enforced at the trust boundary, not by convention.
2. **Every service call asserts its `child_id`.** Workers learn the authoritative `child_id` from the claimed queue row (`rpc_claim_sync`), never from config; credential fetch and all writes use that same id; write-path assertions fail closed on mismatch. A misconfigured worker causes *starvation* (unclaimed jobs → pending-age monitor), never leakage.
3. **Fetch-at-claim, never cache.** Secrets are fetched at job-claim time, held in process memory for that job only, then zeroized. There is no credential cache to invalidate and none to steal. Rotation takes effect on the next claim by construction.
4. **Secrets never touch disk or logs.** No config files, no env files, no crash dumps, no interpolation into log lines or error strings. Sanitization at the logging boundary.
5. **`set_tenant_secret` is never called with service_role.** It asserts `auth.uid()` parent membership; the portal-credential-write Edge Function forwards the end-user's JWT. Service-side writes use reviewed admin paths.

## 10.4 Vault access doctrine

- **Passwords exist in exactly one place:** Supabase Vault (`vault.secrets`, AES-256-GCM, Supabase-managed master key). `child_portals` holds metadata only: `username` (non-secret), `vault_secret_id`, `status`, timestamps.
- **Naming:** `tenant_<child_id>__<system>` for child-scoped; `tenant_parent_<owner_user_id>__<system>` for parent-level. Names are per-tenant/per-owner — never shared across families (a shared name was a cross-family overwrite vector).
- **Read path:** only `get_tenant_secret(p_child_id, p_system)` — SECURITY DEFINER, asserts (service_role JWT role-claim) OR (caller is parent of `p_child_id`), then reads `vault.decrypted_secrets`. The role-claim check reads `request.jwt.claims`, set by PostgREST from the verified JWT; direct-SQL callers have no claims and fail closed into the membership assertion. Child-role users, anon, and leaked-anon-key holders can never satisfy either branch.
- **Write path:** only `set_tenant_secret(...)` — parent-only, rejects empty secrets, upserts the Vault secret by name, stores only the id. Parent-level rows are family-scoped by `owner_user_id` (partial unique index; CHECK constraint).
- **Client visibility:** `vault_secret_id` is granted to **no** client role (column-level grants). The `child_portals_public` view is `security_invoker` (caller's RLS applies) and exposes metadata only. `agent_reader` gets the secret-less view, never the base table.
- **Rotation:** parent updates via Portals UI → `vault.update_secret` → next worker claim fetches the new value. Compromised secret: rotate the value; no schema change, no re-encryption ceremony.
- **Blast radius note:** Vault is project-scoped. A service_role compromise exposes all tenants' secrets — this is the same boundary as §10.2(e) and is handled the same way.

## 10.5 Standing review rules (from Round 1)

- Any new view over tenant tables ships with `security_invoker = true` and an explicit GRANT list. A view without it is a presumed RLS bypass until proven otherwise.
- Any new SECURITY DEFINER function ships with `REVOKE ALL … FROM PUBLIC` + explicit grants, `SET search_path`, and fail-closed NULL handling on every authorization input.
- Any new nullable-`child_id` concept must answer: *who owns the NULL rows in a multi-family future?* "Nobody / everybody" is not an answer.
- `UNIQUE` constraints do not fire on NULLs — any upsert keyed on a nullable column needs a partial unique index and a matching `ON CONFLICT … WHERE` clause, plus a test proving rotation doesn't duplicate.
- GRANTs are part of the migration, not an afterthought: RLS without GRANTs is a locked door with no hinges — PostgREST denies everything and the app silently breaks.
