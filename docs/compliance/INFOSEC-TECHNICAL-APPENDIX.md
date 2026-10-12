# Infosec Program — Technical Appendix

**Track:** Fractional Team 1 — Compliance (Security Engineer input)
**Branch:** `staging-build` · **Date:** 2026-10-12
**Purpose:** Concrete technical controls the written infosec program (being drafted by
the Compliance Reviewer in parallel, per `docs/solutions/sol-legal.md` §1b) should
mandate. This appendix is engineering input; the program's legal adequacy is counsel's
judgment (FTC Safeguards-style), not this document's.

> **Repo reality check:** findings marked 🔴/🟡 below were verified in the repo on this
> branch. Statuses marked UNKNOWN require dashboard/staging access or a feature build.

---

## 1. Encryption

### 1.1 At rest
- **Supabase default:** Postgres at-rest encryption is provider-managed (AWS EBS
  encryption under Supabase). The program must record this as the baseline and name
  the residual risk: provider-managed keys mean Supabase/AWS can decrypt; field-level
  encryption is required for the credential vault regardless.
- **Field-level (credentials vault — NFR-SEC-006):** every stored credential
  (username, password, tokens, portal-automation session cookies) encrypted at the
  field level **before any real credential is stored** (`sol-legal.md` §10:
  "encrypt before ANY real credentials stored").
  - Envelope encryption: per-credential data keys wrapped by a KMS-held master key.
  - The app **never holds the master key in code/config**; separation of duties.
  - Migration `003_credential_vault.sql` exists — verify it implements field-level
    encryption (not just a table) before the first real credential lands.
  - 🟡 Current status: vault schema exists; encryption-path liveness in staging is
    UNKNOWN — gate the first real credential on a staging verification run.
- **Backups:** backup encryption inherits the provider; backup *purge* ≤30 days after
  source deletion (`sol-legal.md` §1a.5) must be a verified vendor setting, not an
  assumption.

### 1.2 In transit
- TLS everywhere: app ↔ Supabase (PostgREST/Auth/Storage all HTTPS), app ↔
  Cloudflare Workers, Workers ↔ Workers AI (internal). No plaintext HTTP in any
  environment including staging.
- HSTS on the Pages domains; certificate management is Cloudflare-automatic — record
  it, don't hand-roll it.

### 1.3 Key management
- **Who holds what:** KMS (or Supabase Vault / Cloudflare equivalent — decision
  recorded in the program) holds master keys; the app holds only wrapped data keys
  in memory for the minimum time needed.
- **Rotation cadence:** master key rotation annually or on personnel change in the
  key-custodian role; data-key rotation on every credential rotation; old data keys
  destroyed after re-wrap (evidence logged).
- **Cryptographic erasure:** deleting the data key = rendering the credential
  unrecoverable — the mechanism for teen deletion requests and deprovisioning
  (`sol-legal.md` §10.3).
- **Never-log-plaintext rule** (`sol-legal.md` §10.2): enforced at application
  logging, error reporting, sync-worker logs, support tooling, DB query logs. Repo
  already has one good control — the `audit_log_detail_secret_guard` trigger
  (migration 004) rejects secret-shaped top-level keys in `audit_log.detail` for
  *every* writer including service_role. The program should mandate the same class
  of guard at every logging boundary, plus a CI canary test (submit a canary
  credential in staging, assert it appears nowhere in logs).

---

## 2. Auth / session

Supabase Auth config checklist (most of this lives in the Supabase dashboard, not the
repo — the program must name each setting and its required value):
- [ ] **MFA:** required for all admin/dashboard users and any support role with
      scoped data access. TOTP minimum; WebAuthn preferred for admins.
- [ ] **Session lifetimes:** access-token lifetime short (≤1h); refresh-token
      lifetime bounded; **refresh-token rotation enabled** (reuse detection on).
- [ ] **Self-signup posture:** invite/link-code-only per the access model; no open
      self-signup that could mint an under-13 principal (ties to the under-13
      checklist — `docs/compliance/UNDER13-TECHNICAL-BAN-CHECKLIST.md`).
- [ ] **Password policy:** minimum length/complexity per current NIST guidance;
      breached-password screening on.
- [ ] **Email verification:** required before any grant is usable (the invite flow's
      email-ownership check in `consume_invite()` is the in-code counterpart).
- [ ] **JWT claims:** `role='agent_reader'` service-minted JWTs carry `job_id` +
      `exp`; `current_child_ids()` / `agent_assert_scope()` enforce the agent
      boundary (migration 001, lines ~50–96) — the program must require that no new
      privileged claim type is added without the same scope-resolution treatment.
- [ ] **Session revocation:** on grant revoke / block / safe-exit, existing sessions
      for the affected principal must be invalidated (verify Supabase Auth admin
      revoke is wired into `revoke_child_access()` — UNKNOWN, check before launch).
- **Status:** 🟡 UNKNOWN — none of this is verifiable from the repo; the program must
  include a quarterly config-audit step (screenshot/export of Auth settings).

---

## 3. Secrets

- **No secrets in repo or client bundle (NFR-SEC-002):** verified in CI.
  - 🟡 **Gap:** `.github/workflows/ci.yml` currently runs lint/typecheck/build only —
    **no secret-scanning step exists.** The program must mandate gitleaks (or
    trufflehog) on every PR and on the default branch, plus a bundle-content check
    that `POOKIE_TUTOR_URL`'s *server-side* variant and any service-role key never
    appear in client output. (Note: `NEXT_PUBLIC_POOKIE_TUTOR_URL` is intentionally
    public — the secret is the *server-side* `POOKIE_TUTOR_URL` and the Cloudflare
    API token, which live in GitHub Secrets → Pages env.)
- **Vault for credentials (NFR-SEC-006):** school portal credentials live only in the
  encrypted vault (§1.1); never in env vars, never in code.
- **Env-var hygiene on Cloudflare Pages:** production and preview environments use
  separate values; preview deploys must never carry production secrets; secret
  rotation on team-member offboarding.
- **Secure Vault usage:** human-held credentials (RustDesk, portal logins) stay in the
  operator's Secure Vault; the repo must never contain a credential even redacted in
  a way that implies the real one.

---

## 4. Rate limiting & brute force

| Surface | Required control | Current status |
|---------|-----------------|----------------|
| Link-code redemption (`redeem_link_code`) | Per-IP + per-child attempt caps, exponential backoff; the DB `attempt_count` lockout must count *failed* guesses, not just hash matches | ❌ FAIL — `attempt_count` increments only on hash match (`019_link_codes.sql`); documented "lockout at 5" never fires for wrong guesses. Needs app-layer rate limiting. |
| Email-invite redemption (`consume_invite`) | Per-IP attempt caps; tokens are 192-bit (guessing infeasible) but enumeration probing must be throttled | 🟡 UNKNOWN — no limiter found in `src/` |
| Login endpoints (Supabase Auth) | Built-in brute-force protection enabled; verify in dashboard | 🟡 UNKNOWN |
| Ticket creation (S3, seedling) | Per-user/per-IP rate cap to prevent ticket spam | ⬜ Not built — gate the feature |
| Invite sending | Per-parent daily cap; abuse alerting | 🟡 UNKNOWN |
| `/verify-invite` preview | Rate-limited; uniform responses (already identical error shapes per §9) | 🟡 UNKNOWN |

The program must require a **single rate-limiting utility** in `src/server/` (not ad
hoc per route) with per-IP and per-identity buckets, and a security-event emit on
lockout (feeds §5 logging).

---

## 5. Logging

### 5.1 Security-event taxonomy (minimum set)
`audit_log` (migration 004) and `access_events` (migration 021 — 🔴 **missing from
branch**, see under-13 checklist CRITICAL-2) must record:
- `auth.login_success` / `auth.login_failure` (failure counts feed §4 lockout)
- `auth.mfa_challenge_failure`
- `access.grant` / `access.revoke` / `access.request` / `access.block` /
  `access.safe_exit` with `granted_by`, reason code, device/IP **hash** (never raw IP
  in long-term storage)
- `access.link_code_generated` / `access.link_code_redeemed` (incl. `coerced` flag —
  teen-private, never surfaced to the parent)
- `break_glass.access` (Proposal 1 — every break-glass access with justification)
- `agent.data_access` (support agents' scoped reads — S3 RBAC requirement)
- `vault.credential_added` / `vault.credential_rotated` / `vault.credential_erased`
- `invite.sent` / `invite.consumed` / `invite.expired`
- `security.rate_limit_lockout`
- `court_order.ingested` / `court_order.applied` (human-review path only)

### 5.2 Retention & tamper-evidence
- `audit_log`: append-only in code (no UPDATE/DELETE policies *and* no grants —
  migration 004; anon gets nothing). Retention window is attorney-set (needed for
  breach scoping, `sol-legal.md` §6) — bounded, never indefinite.
- `access_events` (when 021 lands): same append-only treatment; **teen-visible, never
  shown to a revoked parent** (FR-ACCESS-009).
- Tamper-evidence: consider hash-chaining (`prev_hash` column) on `access_events`
  when 021 is written — cheap, and it turns "append-only by policy" into
  "append-only by evidence." At minimum, any UPDATE/DELETE attempt must raise, and
  service_role writes must be as restricted as the RPC path (the 004 trigger pattern
  — firing for every writer — is the model to copy).
- Log integrity monitoring: alert on gaps in `audit_log` sequence per child (missing
  rows = possible tampering or a broken writer).

---

## 6. Vulnerability management

- **Dependency scanning:** `npm audit` (or Dependabot/Renovate) on every PR; the
  program sets a **patch SLA by severity**: critical — 48h; high — 7 days; medium —
  30 days; low — next scheduled release. Emergency out-of-band deploys bypass the
  staging gate only with Managing Director approval + post-deploy verification.
- **SAST/DAST:** per Mehedi's standing test protocol (AGENTS.md) — SAST on every PR,
  DAST against staging on every staging deploy, plus the advanced battery (red team,
  fuzz, property-based, chaos) on the release cadence the protocol defines.
- **Migration hygiene:** `supabase/migrations/check.sh` (idempotency) runs in CI —
  extend it with the retention-schedule completeness gate proposed in the under-13
  checklist §8, and add a **migration-order check** (the 021 gap proves the need:
  fail CI if any migration references an object defined only in a later-numbered or
  missing migration — a simple undefined-symbol scan over `public.*` references vs
  definitions would have caught CRITICAL-2).
- **Pen-test cadence:** external pen test before production launch, annually after,
  and after any material architecture change (new auth path, new AI vendor, vault
  changes). Findings feed the patch SLA above.

---

## 7. Platform-specific hardening (examples the program must capture)

Platform quirks are where silent failures live. The program must maintain a living
"platform hardening notes" section; entries so far:

1. **Cloudflare Workers cookie rule (d-dash-app commit `538f288`, 2026-10-12):** in
   Next.js Route Handlers that touch auth cookies, never rely on `next/headers`
   `cookies().set()` propagating to a freshly constructed `NextResponse`. On
   Cloudflare Workers (OpenNext) the `Set-Cookie` headers are silently dropped and
   the browser follows the redirect with no session — this caused a post-login 404
   in production. Fix pattern: capture cookies from the SSR client's `setAll()`
   into a local array, read incoming cookies from `NextRequest`, and explicitly
   call `response.cookies.set()` for each on the redirect response. **Any auth
   callback route deployed to Cloudflare must follow this pattern and be covered by
   the post-deploy smoke test.**
2. **PostgREST read vs RPC write asymmetry:** `sync_requests` is readable by the anon
   key via plain GET (the "RPC-only" claim in older docs applied to writes, not
   reads) — the program's data-classification must be verified against actual
   PostgREST behavior, not documentation assumptions (lesson 2026-10-10).
3. **RLS policies alone grant nothing:** every table needs explicit GRANTs alongside
   policies (migration 004, F2) — the program's DB review checklist must check both.
4. **`DROP POLICY IF EXISTS` before every `CREATE POLICY`** (Postgres has no
   `CREATE POLICY IF NOT EXISTS`) — enforced by `check.sh`; keep it.
5. **Supabase Auth has no age concept** — every age-dependent guarantee must be a
   compensating control in our code (see the under-13 checklist); never assume the
   identity layer enforces it.

---

## 8. Child-data heightened controls (ties to `sol-legal.md` §1b.5)

Where under-13 data is in play (parent-managed profiles, sibling data, accidental DOB
entries):
- Restricted access lists: under-13 rows readable only by parent-role members of
  that child — enforced by RLS, verified per the under-13 checklist §6.
- Purge verification: every purge job emits evidence (counts, dates) to the audit
  log; failures alert.
- Export controls: no bulk export of under-13 rows; per-row export only via the
  parent's own access, logged.
- Support-agent RBAC (S3): agents never see health/grades without consent; **all
  agent access audited**; under-13 support handled via the parent only.

---

## 9. Open items for the Compliance Reviewer (program drafter)

1. Confirm the **retention windows** for `audit_log`/`access_events` with counsel
   (breach-scoping need vs minimization).
2. Decide the **hash-chaining** question for `access_events` (§5.2).
3. Name the **program owner** and the **key-custodian role** (§1.3).
4. Set the **patch SLAs** (§6) — proposal above is a starting point.
5. Schedule the **first external pen test** (before production launch).
6. Record the **quarterly Auth-config audit** (§2) as a recurring obligation.
7. Track the **🔴/🟡 findings** in this appendix and the two companion docs as
   Phase 0 exit criteria — the program should reference them, not duplicate them.
