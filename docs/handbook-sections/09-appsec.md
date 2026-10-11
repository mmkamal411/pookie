# Pookie Engineering Handbook — §09 Application Security

**Status:** Normative policy. Binding on all engineering work, all pods, and all AI agents.
**Owner:** Application Security Manager (security engineer, engineering pod).
**Version:** 1.0 — 2026-10-11.
**Source audits:** `docs/audit-findings/security-engineer.md` (migrations 001–005).

This is the application-security component of the Pookie platform. Nothing in this component
is done until the Application Security Manager signs off in writing. These are rules, not
suggestions. Where this section conflicts with another handbook section, this section wins on
security matters.

Data-sensitivity posture: **HIGH**. Pookie holds children's education records, portal
credentials, health-adjacent data, and family PII across tenants. The threat model explicitly
includes the child user as a misaligned actor (a grounded teenager has strong incentives to
evade controls) and the parent's browser as a compromise vector (XSS → JWT theft).

---

## 1. Secret-Handling Rules — What NEVER Goes Where

### 1.1 The definitive NEVER list

A "secret" here means: portal passwords, Vault secret IDs, OTP codes, invite tokens,
`service_role` keys, anon keys used server-side, session/refresh tokens, API keys, and any
value that would grant access if disclosed. The following placements are **forbidden**,
no exceptions, no "temporary" exceptions:

| # | NEVER place a secret in… | Why (the failure it causes) |
|---|---|---|
| 1 | **Client bundles** (`out/`, JS shipped to browsers) | Bundles are public. `NEXT_PUBLIC_*` is baked into the build at compile time and readable by anyone. The anon key is public *by design*; the `service_role` key in a bundle is a full database takeover. |
| 2 | **URLs** (query params, path segments, fragments) | URLs land in browser history, server access logs, `Referer` headers, and screen shares. Passwords never; invite tokens only as single-use, expiring exceptions on a dedicated route with `Referrer-Policy: no-referrer`. |
| 3 | **Logs** (app logs, worker logs, Postgres logs, `pg_stat_activity`) | Logs are read by more people and retained longer than anyone remembers. Sanitize at the logging boundary: credential-shaped strings are scrubbed before the log call, never after. `log_statement` must never be `'all'`/`'mod'` on the project. |
| 4 | **Error messages** (RAISE EXCEPTION strings, API error bodies, UI toasts) | Errors propagate to clients and log aggregators. Audit verified: every `RAISE EXCEPTION` in migrations 001–005 is a static literal — **this is a permanent invariant**. Never interpolate a value into an error string. |
| 5 | **localStorage / sessionStorage / IndexedDB** | Readable by any script on the origin (XSS = secret theft) and never cleared reliably. `active_child_id` is fine here — it is not a secret. Passwords, tokens, OTP codes are not. |
| 6 | **`audit_log.detail`** | Unconstrained jsonb readable by all tenant members including the child user (see audit SEC-001). Append-only does not mean append-anything. A trigger enforces a secret-key denylist; the normative rule is: metadata only, never credential material. |
| 7 | **Git** (repo history, `.env` files, migration comments, seed data) | History is forever; clones multiply. `.env*`, `credentials*`, `*secret*`, `*.pem`, `*.key` are git-ignored and pre-commit-scanned. Real credentials never appear in migrations or seeds — only placeholders. |
| 8 | **Crash reports / diagnostics payloads** | Crash payloads ship off-device to third parties. Scrub before capture; never attach request bodies or memory dumps containing secrets. |
| 9 | **Push notification payloads** | APNs/FCM payloads transit Apple/Google infrastructure. Payloads carry wake-up hints only ("New grades available"), never grades, names, or secrets. Content is fetched in-app after unlock. |
| 10 | **Email / chat / screenshots** | Operational habit rule. Credentials move through the Portals UI or the agent Secure Vault, never through Gmail threads, chat transcripts, or screen shares. |
| 11 | **On-device plaintext stores** (UserDefaults, SharedPreferences, plain files) | See §6.5. Device storage for auth material is Keychain/Keystore or nothing. |
| 12 | **`Referer` headers** (outbound links carrying tokens) | Invite/token links use `Referrer-Policy: no-referrer`; tokens never ride on links to third parties. |

### 1.2 The allowed paths (the complete list — if it isn't here, it isn't allowed)

1. **Portal passwords:** Supabase Vault only (AES-256-GCM, Supabase-managed). Written via
   `set_tenant_secret()` called from the `portal-credential-write` Edge Function, which
   validates parent-role `child_access` first. Read only via `get_tenant_secret()` —
   `service_role` callers (workers) only; revoked from `anon`/`authenticated` (audit SEC-005).
   The Portals UI **never** receives a secret value back, only metadata + masked usernames.
2. **Worker runtime:** fetch-at-claim (`rpc_claim_sync` → `get_tenant_secret`), held in
   process memory for one job, **zeroized** (overwrite + dereference) before the job
   completes. No disk, no env vars, no caches. Rotation needs no invalidation because there
   is nothing cached — staleness is structurally impossible beyond one job's lifetime.
3. **Agent automation credentials:** the agent's Secure Vault (a system separate from
   Supabase Vault — never conflate them in UI or docs). Per-credential approval from Mehedi
   before any migration into Supabase Vault.
4. **End-user auth:** Supabase Auth OTP (email). No passwords for end users in v1. Session
   tokens in httpOnly cookies or platform Keychain/Keystore (§6.5); never in JS-accessible
   storage.
5. **Transit:** TLS everywhere. `service_role` key lives in the Secure Vault and in
   server/worker environments only.

### 1.3 Rotation and compromise response

- **Planned rotation:** parent updates via Portals UI → new Vault secret version →
  `child_portals.credentials_updated_at` bumped → next worker claim fetches the new value
  automatically.
- **Suspected compromise:** rotate the Vault value **and** delete the old secret
  (`remove_tenant_secret()` — audit SEC-010); rotate any derived sessions; audit-log the
  removal (metadata only); notify the parent. No schema change is ever needed for rotation.
- **`service_role` key suspected leaked:** rotate in Supabase dashboard immediately; the key
  bypasses all RLS and exposes every tenant — treat as a P0 incident.

---

## 2. XSS Prevention Standards

Pookie renders three classes of untrusted content: **AI-generated** (tutor chat, peer tips,
study plans), **user-supplied** (check-ins, notes, uploads, user-added links), and
**third-party** (teacher emails, synced portal HTML). All three are attacker-controlled
until proven otherwise.

### 2.1 Normative rules

1. **React's default escaping is the baseline, not the strategy.** `dangerouslySetInnerHTML`
   is banned by lint (`react/no-danger`). Any exception requires security-manager approval,
   a named allowlist, and DOMPurify sanitization — and is re-reviewed quarterly.
2. **AI output is untrusted input.** Tutor messages, generated quizzes, and peer tips render
   through a sanitized-markdown pipeline (allowlisted tags/attributes; no `<script>`,
   `<iframe>`, `<object>`, event-handler attributes, `javascript:` URLs). A model that emits
   HTML is not a feature — it is an injection vector.
3. **Teacher/school emails render as sanitized HTML or plaintext.** The teacher inbox is a
   classic stored-XSS surface (a compromised school mailbox → malicious HTML → parent's
   browser → JWT theft). Sanitize with the same pipeline as AI output; remote images blocked
   by default (tracking pixels).
4. **User-addable links** (Khan/YouTube/game links on class pages): scheme allowlist
   `https:` only; validate at write time (definer function or Edge Function), not just in
   the UI; render with `rel="noopener noreferrer"`.
5. **No inline event handlers, no `eval`, no `new Function`** anywhere in first-party code.
6. **Uploads:** user files (handouts, ebooks, screenshots) are served with
   `Content-Disposition: attachment` or rendered in a sandboxed viewer; **SVG uploads are
   treated as executable** — serve as downloads or sanitize; never inline unsanitized SVG.
   Signed URLs are short-lived and scoped to the tenant path.
7. **Error and validation messages** never reflect raw user input into HTML without escaping
   (reflected-XSS via `?error=` params is a perennial finding — our error strings are static
   literals end to end).
8. **Post-XSS blast-radius control:** session tokens are httpOnly (not JS-readable); RLS
   re-validates every request server-side, so a stolen JWT is still tenant-scoped; short
   token lifetimes bound the window.

---

## 3. Content Security Policy

### 3.1 Policy (served via `public/_headers`, verified on the LIVE header)

```
default-src 'self';
script-src 'self';
style-src 'self';
connect-src 'self' https://<pookie-supabase>.supabase.co https://pookie-tutor-v2.<account>.workers.dev;
img-src 'self' data: https:;
font-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

Notes:
- **No `unsafe-inline`, no `unsafe-eval`.** Next.js 16 requires care here — use nonces for
  any inline script the framework needs; do not relax the policy to accommodate a component.
- `frame-src 'none'` until a specific embed (e.g., a video provider) is approved per-embed
  with a named source — embeds are XSS-adjacent and each one needs security review.
- `img-src` allows `https:` for teacher-email remote content only if remote images are
  ever enabled (default: blocked — see §2.1.3).

### 3.2 `connect-src` discipline (standing lesson — zero exceptions)

Every new backend domain goes into `connect-src` in `public/_headers` **before** the code
that calls it ships. `curl` does not enforce CSP, so verification is always against the
**live** response header (`curl -sI https://<host> | grep -i content-security-policy`),
never against source. The deploy checklist includes a `connect-src` audit: every domain in
the header must have a live caller, and every live caller must be in the header. Stale
entries are removed — an over-broad `connect-src` is a data-exfiltration allowlist.

### 3.3 Reporting

`report-uri` / `report-to` points at a first-party endpoint; CSP violation reports are
triaged as security signals (an unexpected `connect-src` violation is how you learn about
a compromised dependency phoning home). Reports are sampled, never logged with full
request bodies.

---

## 4. Auth-Flow Security

### 4.1 OTP (Supabase Auth, email)

- **OTP-only for end users in v1** (no passwords to phish, no password database to breach).
  The 4 family emails register via OTP; the login form never prefills a real address in
  production builds.
- OTP codes are short-lived and rate-limited by Supabase Auth. **Never implement a custom
  OTP flow** — the platform's rate limiting, expiry, and anti-enumeration are the control.
- OTP codes are never logged, never persisted, never placed in `audit_log.detail`.
- **hCaptcha (standing lesson):** automated Supabase sign-in loops on hCaptcha. Automation
  (SYNC NOW triggers, staging verification) uses the approved Gmail/sign-in-code path with
  Mehedi signing in manually where required — never attempt to bypass the captcha.
- Login error messages are generic ("If an account exists, a code was sent") — no
  account-enumeration oracle.

### 4.2 Sessions

- Session tokens live in **httpOnly, Secure, SameSite=Lax cookies** (web) or
  Keychain/Keystore (mobile, §6.5). Never in `localStorage`.
- Refresh-token rotation is on; sign-out revokes server-side and wipes client storage.
- Session persists across restarts (standing rule: re-login only in incognito, cleared
  site data, sign-out, or new device) — therefore **token theft is the primary session
  threat**, which is why §2.1.8 (httpOnly) and short lifetimes are normative.
- Child-access revocation (remove from `child_access`) must best-effort invalidate
  outstanding sessions; RLS re-checks membership on every request, so revoked users fail
  closed on their next call regardless.

### 4.3 Invites (the tenant-join flow)

- Tokens: 192-bit, single-use, 14-day expiry, email-match enforced server-side in
  `consume_invite` (audit SEC-002/SEC-003/SEC-015 for the hardening backlog:
  parent-gated writes, token hidden from members, case-insensitive email match).
- Invite links are dedicated routes with `Referrer-Policy: no-referrer`.
- Pending-invite state renders **no data** — a user with zero `child_access` rows sees
  nothing but the pending screen.

### 4.4 Service-role discipline

- The `service_role` key bypasses **all** RLS. Every `service_role` code path carries and
  asserts an explicit `child_id` (the PLAN's invariant) — RLS will not save a confused
  service_role caller.
- Prefer narrow Postgres roles (`agent_reader`) over `service_role` wherever the access
  pattern allows; `service_role` is for workers and migrations, not for app servers that
  can scope down.
- Key custody: Secure Vault only; rotation on suspicion is a P0 (see §1.3).

---

## 5. IDOR Prevention Checklist

"Insecure Direct Object Reference" here means: any request that names a tenant object
(`child_id`, row UUID, storage path, invite token) must prove the caller may touch it.
Client-supplied identifiers are **hints**, never authority.

### 5.1 The checklist (every feature PR answers each line)

- [ ] **Tenant scoping:** every tenant-table query filters `child_id = ANY (current_child_ids())`
      via RLS — no endpoint, RPC, or worker query touches a tenant table without it.
- [ ] **Client `child_id` is never trusted alone.** The worker learns `child_id` from the
      claimed `sync_requests` row; the tutor Worker verifies the JWT and confirms
      `child_id ∈` caller's `child_access`; the app rejects an `active_child_id` outside
      the access set client-side **and** it fails RLS server-side regardless.
- [ ] **Deep links:** child-slug URLs resolve through the access set; out-of-access slugs
      render "not found" (no existence oracle distinguishing "no such child" from
      "not yours" — same response both ways).
- [ ] **No role confusion:** write policies gate on `child_access.role='parent'` where the
      PLAN requires it (audit SEC-004: `classes`/`bell_schedules`/`child_settings` still
      need this fix).
- [ ] **Storage:** object paths `<uid>/<child-slug>/<class>/<yyyy-mm-dd>/<file>` with RLS
      on `storage.objects`; signed URLs short-lived; no public buckets for tenant data.
- [ ] **Unpredictable identifiers:** UUIDs everywhere; no sequential IDs on tenant objects;
      slugs are not secrets but are access-checked anyway.
- [ ] **No `parent_user_id` shortcuts:** access derives exclusively from `child_access`
      (audit verified: no policy references `children.parent_user_id`).
- [ ] **Cross-tenant writes fail closed:** the write-path assertion (claimed `child_id`
      carried on every write) is tested, not just documented — misconfiguration must cause
      starvation (unclaimed syncs, caught by monitor), never leakage.
- [ ] **Child-role users can never:** list other children, read another tenant's rows,
      modify shared config, issue invites (post SEC-002 fix), or reach Vault (no grant,
      RLS, and `get_tenant_secret` revoked from `authenticated` post SEC-005 fix).
- [ ] **Negative tests ship with the feature:** parent-A cannot read child-B rows;
      child user cannot write `classes`; anon denied on every tenant table; revoked member
      fails closed. These are automated, not manual.

### 5.2 IDOR patterns already verified in migrations 001–005

`current_child_ids()` is STABLE + SECURITY DEFINER with fixed `search_path`;
`child_access` has no UPDATE policy (roles can't be flipped); `consents` is append-only by
RLS; `audit_log` has no direct-write policy; invite consumption is row-locked, single-use,
and email-matched. The open IDOR-adjacent items are SEC-002/003/004/005/007/009 in the
audit — all have concrete remediation.

---

## 6. Store Compliance & Children's Privacy

**Status:** normative. Items marked 🔴 **BLOCKER** must be satisfied before the
corresponding store submission; 🟢 **NICE-TO-HAVE** items are scheduled post-launch.
Apple and Google rules change; re-verify against the live guidelines during every
submission. **Store compliance is not legal compliance** — COPPA/GDPR-K obligations apply
regardless of category, rating, or program (§6.4).

### 6.1 Apple: Kids category vs. 12+ general — recommendation

**What the Kids category (Guideline 1.3) demands:** no links out of the app, no purchasing
opportunities, and no other distractions to kids except in a designated area behind a
**parental gate**; no third-party analytics or third-party advertising (narrow carve-outs
only, with human review); no transmission of PII or device information to third parties;
compliance with children's privacy statutes (COPPA, GDPR-K); and the obligations **persist
even if the category is later deselected**.

| | Kids category | General app, rated 12+ |
|---|---|---|
| External Learn links (YouTube, Khan, Gimkit…) | Every link behind a parental gate — heavy UX tax on the core study flow | No gate required by Apple (gates still recommended as defense-in-depth in the child's view) |
| Third-party analytics/ads | Banned (carve-outs only) | Allowed with consent — but we ship none either way |
| Review scrutiny | Highest; category sticks to future updates | Standard; still elevated for family/children's apps |
| Positioning | "Made for kids" shelf trust | Honest for a parent-operated family dashboard |
| Rating | 4+/9+ | 12+ fits Dawson (15) and the teen user base |

**Recommendation: ship as a general app rated 12+, NOT in the Kids category, for v1.**
Reasons: (1) the account holder is the **parent** — this is a mixed-audience family product,
not a child-primary experience; (2) the education framework's external-resource model would
require a parental gate on every Learn link under 1.3, taxing the exact flow students use
most; (3) Kids-category obligations are sticky across deselection; (4) our data practices
already satisfy the substantive constraints (zero third-party data SDKs, no IDFA, no ads,
no data sale), so the marginal trust gain is small versus the review and UX cost.
**Counter-consideration:** Apple judges independently — a family/children's app may still
draw kids-app scrutiny. Mitigation: build the parental-gate component anyway (🟢 now;
🔴 **BLOCKER** if Apple reclassifies during review) and keep data practices clean enough
to survive a 1.3 audit at any time. Revisit the Kids category if we ship a child-primary
mode or onboard under-13 tenants.

### 6.2 Apple specifics

- **Privacy nutrition labels** 🔴 **BLOCKER** (must be accurate at submission; labels are
  legally attestations). Module mapping for v1:
  - *Contact info (email):* collected — used for OTP login / account identity; linked to
    the user; **not used for tracking**; not shared with third parties.
  - *Identifiers (Supabase user UUID):* collected — app functionality; linked; not
    tracking; not shared. **Do not collect IDFV** unless a feature needs it — each new
    identifier re-opens the label.
  - *Health & Fitness:* **not collected in v1** (vitals are manual parent/child entries —
    user-provided health data; disclose as such if the label questionnaire asks). If
    HealthKit ships later, the label, the HealthKit entitlement justification, and the
    privacy policy all update together — 🔴 at that time.
  - *Location, Contacts:* **not collected, not requested.** Do not add these permissions
    without a security-manager review — each one is a label change and a review risk.
  - *Usage / Diagnostics:* only if first-party crash reporting ships — first-party only,
    never a third-party SDK (see below).
  - **Rule:** the label must match the binary. **Every new SDK triggers a label re-audit.**
    We ship **zero third-party data-collecting SDKs** — keep it that way; adding one is a
    🔴 review event, and in a children's app it is a likely rejection.
- **App Tracking Transparency:** we do not request tracking, collect no IDFA, and do no
  fingerprinting. The ATT prompt is never shown. Any future analytics/ads SDK = 🔴 BLOCKER
  review before integration.
- **Parental-controls entitlements — what third-party apps can actually do:**
  `com.apple.developer.family-controls` is a **per-bundle-ID entitlement granted by Apple on
  request** (request on day one — approvals are slow). With it, DeviceActivity/ManagedSettings
  let a third-party app enforce app/website restrictions and monitor activity through
  Apple's privacy-preserving APIs, **with explicit parent authorization**. This is **not
  MDM**: MDM enrolls organization-owned devices via an MDM server and is unavailable to
  consumer App Store apps. A third-party app **cannot** read browsing content, bypass Ask
  to Buy, or manage devices it does not own. **For Pookie v1: we do not need
  FamilyControls** (we are a dashboard, not a screen-time enforcer) — 🟢 future only, and
  only if a screen-time feature is explicitly approved.
- **Age signals:** iOS shares only an age *range* with apps, opt-in and reversible — use it
  solely to tailor an age-appropriate experience, never for advertising or profiling.
- **Push notifications:** APNs permission via the system prompt; no push without explicit
  opt-in (consider provisional/quiet push for nudges). Payloads are wake-up hints only —
  never grades, names, or secrets (§1.1.9). 🔴 for the notification design review.
- **Sign-in:** OTP email only — Sign in with Apple is required only if we offer third-party
  login (we don't). If Google OAuth is ever added, Sign in with Apple becomes 🔴.
- **Product-page disclosures:** Apple surfaces whether an app includes messaging,
  user-generated content, or parental controls — our listing must disclose the AI tutor
  chat honestly.

### 6.3 Google Play

- **Families Policy** 🔴 **BLOCKER**: applies when children are in the target audience —
  **Google judges this independently of our declared audience**. Requirements: age-appropriate
  content and functionality (no bare-webview wrappers); accurate Play Console answers
  (Target Audience, Data safety, IARC questionnaire); **zero advertising ID** — remove the
  `AD_ID` permission entirely; no device IDs (IMEI/serial/MAC) from child users; no precise
  location for child-directed use; only child-appropriate SDKs (ours: none third-party);
  social features need an "adult action" (PIN/password) before a child can exchange personal
  info — the tutor is AI chat, not stranger chat, but any future open-ended discussion
  feature gets a 🔴 review; COPPA/GDPR-K compliance (§6.4).
- **Designed for Families program:** OPTIONAL opt-in shelf. **Recommendation: do not opt in
  for v1** — it adds self-certified-ads-SDK obligations and review burden for zero benefit
  (we have no ads). Revisit only if we want the family shelf. 🟢
- **IARC questionnaire** 🔴: answer honestly at submission; AI tutor chat is disclosed as
  interactive/AI-generated content per the questionnaire's wording.
- **Data safety form** 🔴 **BLOCKER** (the #1 rejection cause is declaration-vs-reality
  mismatch — audit the binary, including every SDK, against the form before submission):
  declare email (account), health/fitness data **only if/when** Health Connect ships,
  **no data shared with third parties**, encryption in transit (TLS), and the user deletion
  path (per-tenant delete in the Data tab, §4.5).
- **Health Connect** 🔴 **at the time it ships** (not v1 — our health integration is
  pending): separate Play Console declaration (App content → Health apps), **per-data-type
  justification** (declare only types actually used — unused permissions are rejected),
  privacy policy must name each data type, and the Data safety form must reflect it.
  Ship health permissions as their own release, never bundled with unrelated changes.
- **Target SDK:** API 35+ baseline (2026) — build-config 🔴.
- **New personal Play accounts** 🔴 **planning item**: 12 testers × 14-day closed test
  before production access — schedule this from day one; use an organization account if
  eligible.

### 6.4 COPPA intersection with store policies (under-13)

Store category and age rating do **not** determine COPPA applicability — **operating with
under-13 users does**. Our posture, which must hold regardless of the §6.1 decision:

1. **Verifiable parental consent at onboarding:** the parent is the account holder; a child
   account exists **only** via a parent-issued invite. Document this invite flow as the
   COPPA consent mechanism and record it in the `consents` ledger
   (scope `coppa:parental-consent`) — 🔴 **BLOCKER before the first under-13 tenant**.
   (Dawson is 15 — COPPA does not apply to him, but the platform must be COPPA-ready.)
2. **Data minimization:** collect only what the dashboard needs; no behavioral advertising,
   no data sale, no third-party analytics — ever.
3. **Parental rights:** review, export, and delete the child's data (Data tab: per-tenant
   export + per-tenant delete = the right-to-erasure unit is the child). 🔴 at v1.
4. **Mixed audience:** neutral age gate at add-a-child (no steering toward a particular
   answer); 13–17 users get the 12+ treatment, not COPPA treatment.
5. **Retention:** per-tenant retention controls exist (`child_settings.retention`); defaults
   are minimal, and check-in/email retention policies must be decided before under-13
   onboarding (currently undecided — 🟢 now, 🔴 then).

### 6.5 On-device secret storage doctrine

- **Store here:** iOS Keychain / Android Keystore (hardware-backed where available) for
  refresh/session tokens, device keys, and biometric-bound items. iOS:
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` (no iCloud sync of auth tokens unless
  explicitly approved). Android: Keystore-backed `EncryptedSharedPreferences`.
- **NEVER persists on device:** portal passwords (the mobile app never holds them —
  fetch-at-claim is worker-side; the Portals form holds the password in memory only during
  entry, POSTs over TLS, clears on submit); `service_role` keys (mobile uses anon key +
  RLS + user JWT only); OTP codes; Vault secret IDs outside the metadata the API returns.
  The Supabase URL + anon key are public by design — still build-configured, not hardcoded.
- **Lifecycle:** short-lived access tokens, rotating refresh tokens; sign-out wipes device
  auth material; child-access revocation best-effort wipes sessions (server-side RLS fails
  closed regardless). Exclude token stores from cloud backups where the platform allows
  (`ThisDeviceOnly`; Android auto-backup exclusions).
- **Biometric gating** for parental actions (portal update, child removal): 🟢 nice-to-have.
- **Jailbreak/root detection:** 🟢 nice-to-have, never a blocker — it punishes legitimate
  users and the real boundary is server-side RLS, not device posture.

---

## 7. Compliance of this document

- New migrations, RPCs, Edge Functions, workers, and app surfaces are reviewed against §1–§6
  **before** merge. The Application Security Manager signs off in the audit record.
- Findings live in `docs/audit-findings/`; remediation priority is set with the Director of
  Engineering. Zero-risk tolerance means: no "accept the risk" on HIGH/CRITICAL without
  Mehedi's explicit written approval, and even then with a dated remediation plan.
- This document is versioned. Changes are proposed as diffs, reviewed, and signed off —
  never edited silently.
