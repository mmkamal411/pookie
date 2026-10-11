# 07 — Integration Patterns: Adapter Registry, Contracts & Credential Flow

**Owner:** Integration expert (engineering pod) — component manager sign-off at end.
**Status:** Contract specification v1. Defines the school-system adapter interface,
the registry contract, worker wiring, webhook patterns, and the credential-flow
rules. Normative language: MUST / MUST NOT / SHOULD per RFC 2119.
**Companion:** audit findings in `docs/audit-findings/integration-expert.md`
(several registry/vault columns referenced here as *proposed* are not yet in
migrations 002/003 — they are marked **[PROPOSED]**).

---

## 1. Purpose and non-goals

Pookie MUST NOT hardcode any school system. Cobb County (ParentVUE/StudentVUE +
CTLS) is Adapter #1. Every supported system implements the standard adapter
contract in this section; the `school_systems` registry row selects and configures
it. Adding a system = one adapter module + one registry row — no app rewrite.

Non-goals for v1: real-time webhooks from school systems (polling adapters only);
multi-credential OAuth refresh orchestration beyond per-system config; scraping
frameworks (adapters use official APIs/portal endpoints).

---

## 2. The adapter contract

### 2.1 Module layout

Each adapter is a Python module in the worker's `adapters/` package:

```
adapters/
  __init__.py          # exports CONTRACT_VERSION, registry of local modules
  base.py              # AdapterBase, error taxonomy, child_ctx helpers
  cobb_adapter.py      # Adapter #1: ParentVUE + StudentVUE + CTLS
  powerschool_adapter.py  # future
```

**Import rule (security):** the worker resolves `adapter_module` from the
registry row, validates it against `^[a-z][a-z0-9_]*$`, and imports only from the
`adapters.` package (`importlib.import_module("adapters." + name)`). Any other
value MUST be rejected before import — never import an arbitrary dotted path
from a database row.

**Contract versioning:** `adapters/base.py` defines `CONTRACT_VERSION = "1"`.
Each registry row carries `contract_version` **[PROPOSED]**. The worker asserts
`row.contract_version.split('.')[0] == CONTRACT_VERSION.split('.')[0]` at import;
on mismatch the worker MUST refuse the job and log `contract_version_mismatch`
(fail closed — never run a mismatched adapter against a child's credentials).

### 2.2 `child_ctx` — the only context an adapter receives

```python
@dataclass(frozen=True)
class ChildContext:
    child_id: str            # UUID string — every downstream write is tagged
    system_key: str          # e.g. 'cobb-county-ga'
    adapter_config: dict     # the school_systems row as JSON (endpoints, rate limits, …)
    grade_scale: dict        # resolved scale: child override else system default
    term_structure: str      # 'semesters' | 'trimesters' | 'quarters'
    term_definitions: list   # [{'term_id': 'S1', 'name': 'Semester 1', 'start': '2026-08-03', 'end': '2026-12-18'}, …]
    capabilities: dict       # which contract methods this adapter supports
    fetch_secret: Callable[[str], str]   # portal_key -> secret; worker-provided
    log: SanitizingLogger   # credential-scrubbing logger (see §6)
```

Rules:

- The adapter MUST NEVER receive raw passwords as arguments, environment
  variables, or config. The only secret path is `fetch_secret(portal_key)`,
  which the worker implements as a single `get_tenant_secret()` call at
  job-claim time (§6).
- `fetch_secret` results MUST NOT be stored on the adapter instance, in
  `adapter_config`, or anywhere outside the `authenticate()` call frame.
- `child_id` MUST be threaded into every record the adapter yields (provenance)
  and every log line.

### 2.3 Required methods

```python
class AdapterBase(abc.ABC):
    # --- auth -----------------------------------------------------------
    @abc.abstractmethod
    def authenticate(self, ctx: ChildContext) -> Session:
        """Establish an authenticated session using ctx.fetch_secret().
        MUST raise AuthFailed (sanitized) on bad credentials — never include
        the secret, username+password combos, or raw HTML in the message."""

    def close(self, session: Session) -> None:
        """Release the session. Default: no-op."""

    # --- data (normalized shapes, §2.4) --------------------------------
    @abc.abstractmethod
    def get_grades(self, ctx: ChildContext, session: Session) -> list[Grade]: ...
    @abc.abstractmethod
    def get_assignments(self, ctx: ChildContext, session: Session,
                        start: date | None = None,
                        end: date | None = None) -> list[Assignment]: ...
    @abc.abstractmethod
    def get_attendance(self, ctx: ChildContext, session: Session,
                       term_id: str) -> list[AttendanceRecord]: ...
    @abc.abstractmethod
    def get_messages(self, ctx: ChildContext, session: Session,
                     since: datetime) -> list[Message]: ...
```

Notes:

- `authenticate` is a required method (clarifies PLAN §4.9): the four data
  methods receive an already-authenticated `session`, keeping credential handling
  in exactly one place per adapter.
- An adapter that cannot support a method (e.g. no attendance API) MUST declare
  it in the registry `capabilities` map **[PROPOSED]** and raise
  `UnsupportedCapability`; the worker skips the method and the UI hides the
  section. The method MUST still exist (raising), so `hasattr` checks are never
  the discovery mechanism.
- Date/datetime inputs and outputs are ISO-8601 strings at the boundary;
  `updated_at` is UTC.

### 2.4 Normalized return shapes

All adapters return these shapes; system quirks are absorbed inside the adapter.
`None` means "the system does not provide this" — never an empty-string lie.

```python
@dataclass(frozen=True)
class Grade:
    class_id: str          # stable adapter-side id for the class/section
    class_slug: str        # normalized slug matching the classes table
    class_name: str        # canonical display name
    period: str | None
    teacher: str | None
    numeric_grade: float | None   # None = no grade posted yet
    letter_grade: str | None      # computed via letterGrade(scale) — see §2.5
    term_id: str           # MUST match a term_definitions entry
    updated_at: str        # ISO-8601 UTC

@dataclass(frozen=True)
class Assignment:
    class_id: str
    title: str
    due_date: str | None         # ISO-8601 date; None = no due date
    status: str                  # 'upcoming' | 'submitted' | 'graded' | 'missing' | 'late'
    score: float | None
    max_score: float | None
    category: str | None         # e.g. 'Tests', 'Classwork'
    weight: float | None         # category weight if the system exposes it
    term_id: str

@dataclass(frozen=True)
class AttendanceRecord:
    date: str                    # ISO-8601 date
    period: str | None
    status: str                  # 'present' | 'absent' | 'tardy' | 'excused' | 'unknown'

@dataclass(frozen=True)
class Message:
    from_name: str
    from_email: str | None
    subject: str
    body: str                    # plain text; adapters strip HTML
    date: str                    # ISO-8601 UTC
    thread_id: str | None
    class_id: str | None
```

### 2.5 Grade scale rule

Letter grades are ALWAYS computed client-side/worker-side via the single
`letterGrade(numeric, scale)` function, where `scale` = child's
`children.grade_scale` override if present, else the registry
`grade_scale_default`. Adapters MUST return raw numerics and MUST NOT apply
their own letter logic (kills the N-duplicate-helpers problem). `term_id`
format is pinned: `{system_key}:{term_code}` is NOT required — instead the
`term_id` MUST equal a `term_id` in the resolved `term_definitions`
**[PROPOSED]**; workers validate membership and reject unknown terms.

### 2.6 Error taxonomy

Adapters MUST raise only these error types from contract methods. Messages MUST
be sanitized: no secrets, no session tokens, no raw HTML dumps, no usernames
paired with passwords.

| Error | Meaning | Worker's response |
|---|---|---|
| `AuthFailed` | credentials rejected | increment `consecutive_failures`; after N, pause claims + nudge parent (§6) |
| `AccountLocked` / `MfaRequired` | portal-side block | pause claims immediately; nudge parent with portal-specific guidance |
| `RateLimited(retry_after_s)` | upstream 429 / throttle | back off `retry_after_s`; do not count as auth failure |
| `NetworkError` | DNS/TLS/timeout | retry with backoff (max 3); then fail job cleanly |
| `ParseError` | upstream shape changed | fail job; alert operator (likely adapter drift — page, don't retry-loop) |
| `UpstreamMaintenance` | portal maintenance page | reschedule job; no failure counter increment |
| `UnsupportedCapability` | method not supported | skip method (must match `capabilities` map) |
| `NoCredential` | `fetch_secret` found nothing | fail job; nudge parent to complete Portals setup |

`AuthFailed` messages MUST be of the form `auth_failed:<system_key>:<utc-timestamp>`
— never include the attempted username.

---

## 3. The registry contract (`school_systems`)

Current columns (migration 002) plus **[PROPOSED]** additions from the audit.
The worker reads the row for the child's `child_settings.school_system` at
job-claim time and builds the `ChildContext` from it.

| Column | Type | Purpose |
|---|---|---|
| `system_key` | text PK | immutable id, e.g. `cobb-county-ga` (never renamed) |
| `display_name` | text | UI label |
| `adapter_module` | text | module name in `adapters/` (validated `^[a-z][a-z0-9_]*$`) |
| `contract_version` **[PROPOSED]** | text | adapter interface version; worker asserts major match |
| `auth_flow` | text | `userpass` \| `oauth` \| `sso` |
| `credential_fields` | jsonb | Portals UI form schema: `[{key, label, type, secret, required, placeholder?, options?}]` (`secret: true` ⇒ password input, never repopulated) |
| `oauth_config` **[PROPOSED]** | jsonb | required when `auth_flow='oauth'`: `{authorize_url, token_url, scopes[], redirect_uri}` |
| `auth_requirements` **[PROPOSED]** | jsonb | UI warning banner, e.g. `{approved_device_required: true, notes: "…"}` |
| `api_endpoints` **[PROPOSED]** | jsonb | `{base_url, token_url?, sso_url?}` — per-district URLs live here, not in code |
| `rate_limits` **[PROPOSED]** | jsonb | `{min_claim_interval_seconds, max_concurrent_jobs, requests_per_minute}` |
| `capabilities` **[PROPOSED]** | jsonb | `{get_grades: true, get_assignments: true, get_attendance: false, get_messages: true}` |
| `grade_scale_default` | jsonb | letter boundaries; overridden per child by `children.grade_scale` |
| `term_structure` | text | `semesters` \| `trimesters` \| `quarters` |
| `term_definitions` **[PROPOSED]** | jsonb | `[{term_id, name, start, end}]`; per-child override in `child_settings` |
| `sync_cadence` | text | human label (`daily`); machine bounds come from `rate_limits` |
| `notes` | text | MUST stay public-safe — the table is world-readable (anon SELECT) |
| `active` | bool | inactive systems are hidden from the selector; existing jobs drain |

**Write access:** registry rows are written by service_role/admin only (no
client INSERT/UPDATE policies by design). Adding a system is an operator action,
reviewed like a migration.

---

## 4. Adding a new school system — step-by-step

Example: adding PowerSchool as Adapter #2.

1. **Write the adapter module** (`adapters/powerschool_adapter.py`):
   implement `AdapterBase` — `authenticate()` + the four data methods (or raise
   `UnsupportedCapability` for methods the system lacks). Absorb ALL quirks
   inside: per-district base URLs come from `ctx.adapter_config['api_endpoints']`,
   never hardcoded. Unit-test against recorded fixtures: grades math, date
   parsing, and the sanitizer (assert no secret-shaped string survives logging).
2. **Insert the registry row** (service_role, reviewed):
   `system_key='powerschool'`, `adapter_module='powerschool_adapter'`,
   `contract_version='1'`, `auth_flow`, `credential_fields` (Portals form),
   `oauth_config` if OAuth, `auth_requirements`, `api_endpoints`, `rate_limits`,
   `capabilities`, `grade_scale_default`, `term_structure`, `term_definitions`.
   One `INSERT` — no app code changes.
3. **Portals UI — no code change:** the UI renders `credential_fields`
   generically; for `auth_flow='oauth'` it renders the OAuth connect button from
   `oauth_config` and shows `auth_requirements` as a warning banner. Verify the
   new system renders correctly in the School-tab selector and Portals tab.
4. **Worker wiring:**
   - Worker pool declares supported systems (e.g. `SUPPORTED_SYSTEMS =
     ['cobb-county-ga', 'powerschool']`); `rpc_claim_sync` only hands a worker
     jobs whose child's system it supports.
   - Claim path: `rpc_claim_sync` → read `school_systems` row → assert
     `contract_version` → `importlib` the module (allowlist rule §2.1) →
     build `ChildContext` → `adapter.authenticate(ctx)` (single
     `get_tenant_secret()` call inside) → run supported data methods →
     `rpc_upsert_dashboard_content` → **zeroize** → `rpc_finish_sync`.
5. **Verification checklist (must all pass before the row goes `active=true`):**
   - [ ] all four methods return normalized shapes on fixtures
   - [ ] `AuthFailed` raised (sanitized) on bad credentials; failure counter increments
   - [ ] `RateLimited` backoff honored; no failure-counter increment
   - [ ] `term_id`s validate against `term_definitions`
   - [ ] letter grades computed only via `letterGrade(scale)`
   - [ ] no secret appears in logs, errors, or stored rows (grep test)
   - [ ] Portals UI renders fields / OAuth button / requirements banner
   - [ ] worker refuses `contract_version` major mismatch

---

## 5. Webhook patterns (future — not v1)

v1 adapters poll. When a system offers webhooks, follow this pattern:

- **Inbound:** one Edge Function per event class (`school-webhook`), verifying
  HMAC signatures with a per-system secret from Vault; resolve `child_id` from
  the payload's account mapping table (never trust a client-supplied
  `child_id`); enforce idempotency via an `event_id` unique constraint; enqueue
  a sync job rather than writing grades directly.
- **Outbound** (parent nudges, §6): queue in `notifications_outbox` with
  `child_id` NOT NULL; a sender resolves recipients per child at send time;
  retries with exponential backoff; never include secrets in payloads.
- Webhook secrets rotate via the same Vault path as portal credentials
  (`set_tenant_secret`-style RPC, service_role only).

---

## 6. Credential-flow rules (normative)

These rules implement PLAN §4.8's fetch-at-claim design. They apply to every
worker, Edge Function, and adapter.

1. **Fetch-at-claim, no cache:** the worker calls `get_tenant_secret(child_id,
   portal_key)` exactly once per job, after `rpc_claim_sync`. Secrets MUST NOT
   be cached in memory across jobs, in KV, on disk, or in environment variables.
2. **Never log:** no secret (or credential-shaped string) in logs, error
   messages, exception tracebacks, or audit rows. All worker logging goes through
   the `SanitizingLogger`, which scrubs values matching known secret patterns and
   any string returned by `fetch_secret` (registered at fetch time, deregistered
   at zeroize).
3. **Never to clients:** the secret value MUST NEVER transit to the browser —
   not in API responses, not in the Portals UI (password fields are write-only,
   never repopulated). `child_portals_public` exposes metadata only.
4. **Zeroize after use:** after the sync (or on any exception path — use
   try/finally), overwrite the secret bytes and drop the reference before
   `rpc_finish_sync`. In Python: `ctypes.memset`-style overwrite of the
   underlying buffer where feasible, then `del`.
5. **Mid-job staleness:** workers record job-start time; if a job spans a
   credential rotation (`child_portals.updated_at` **[PROPOSED]** newer than
   job start), the next claim re-fetches — there is no cache to invalidate.
6. **Failure handling:** `AuthFailed` → sanitized record (`auth_failed:<system>:
   <ts>`) → increment `consecutive_failures` **[PROPOSED]** → after N (default
   3), set `claims_paused_until` / `status='paused'` and nudge the parent
   ("ParentVUE password for <child> needs updating" + Portals deep link). Other
   children's claims are unaffected. Success resets the counter via
   `mark_portal_verified` **[PROPOSED]**.
7. **Laptop workers:** no config files, no env files, no crash-log inclusion;
   process env holds only `TENANT_CHILD_ID`, Supabase URL/keys, worker identity.
   Known accepted residual: an OS-level memory dump during a job could contain
   the secret — mitigated by short in-memory lifetime; documented, not solved.
8. **Rotation:** parent updates via Portals UI → `set_tenant_secret()` writes a
   new Vault version → `updated_at` bumped → next claim fetches the new value
   automatically. Compromised-secret response: rotate value + rotate derived
   sessions; no schema change.
9. **Audit:** every `get_tenant_secret()` call writes an `audit_log` row
   (child_id, actor, `secret_fetch`, portal row id, timestamp) — metadata only.
   **[PROPOSED]**
10. **Parents never read secrets:** `get_tenant_secret()` MUST NOT have a parent
    branch (audit C1). Parent flows (Test connection) use a server-side function
    returning only success/failure — never the value.

---

## 7. Portals UI contract (for the frontend pod)

- The Portals tab is **fully registry-driven**: given the child's
  `child_settings.school_system`, fetch the `school_systems` row and render:
  `credential_fields` as the form (fields with `secret: true` ⇒ password input,
  write-only), `auth_requirements` as a warning banner, OAuth connect button
  when `auth_flow='oauth'` (from `oauth_config`).
- Submit POSTs over TLS to the `portal-credential-write` Edge Function, which
  validates parent membership for the `child_id` and calls
  `set_tenant_secret()`. The function MUST NEVER return the secret value.
- Card states come from `child_portals_public`: `status` dot, masked username,
  `[Test connection]` (server-side boolean RPC), `[Update]`, `[Remove]`
  (`remove_tenant_secret` **[PROPOSED]**).
- Passwords live in component state only during form entry — never localStorage,
  IndexedDB, or URL params.

---

## Sign-off

I, the Integration expert and manager of the **Adapter registry + integration
patterns** component, have:

- Audited migrations 002 and 003 for integration-design soundness (findings in
  `docs/audit-findings/integration-expert.md`: 1 CRITICAL, 10 HIGH, 11 MEDIUM,
  3 LOW — no migration edits made, reviewer role only).
- Written this component specification (`docs/handbook-sections/07-integration-patterns.md`):
  adapter contract (signatures, `child_ctx`, normalized shapes, error taxonomy),
  registry contract including proposed hardening columns, the step-by-step
  add-a-system procedure, webhook patterns, credential-flow rules, and the
  Portals UI contract.

**Component status: SPEC COMPLETE — signed off**, with the explicit caveat that
the **[PROPOSED]** items require a follow-up migration (`006_integration_hardening.sql`
per the audit) before a second adapter or production credential rotation can rely
on them. Nothing in this component is done until that migration lands, but the
specification itself is final for v1.

— Integration expert, 2026-10-11
