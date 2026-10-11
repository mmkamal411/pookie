# 03 — Architecture Overview (Pookie)

**Owner:** Solution Architect · **Date:** 2026-10-11 · **Status:** living section —
updated as migrations land. Companion: `docs/audit-findings/solution-architect.md`
(full migration audit with severities).

## 1. What Pookie is

Pookie is a greenfield, multi-tenant "mother app" for families: one Supabase
project, one backend, N children (tenants). Tenancy is keyed on the login
email — email X resolves to exactly X's data, nothing else. The old Dawson-only
stack stays live and untouched until DNS cutover; data moves by idempotent ETL.

**Stack:** Next.js 16 + TypeScript + Tailwind (Cloudflare Pages, `pages.dev`
for now) · Supabase project `pookie` (Postgres + Auth + Vault + Storage) ·
Cloudflare Worker `pookie-tutor-v2` (Llama 3.3 70B) + KV · laptop sync workers
(Windows/Mac) · Muse agent (crons, merges, briefings).

## 2. Tenancy model — the core pillar

Four tables, one helper, one invariant:

- **`children`** — the tenants (`slug` unique, e.g. `dawson-kamal`; `grade_scale`
  JSONB per child; `parent_user_id` is the owner/billing anchor **only**).
- **`users`** — 1:1 with `auth.users` (trigger-created), `role ∈ (parent, child)`.
- **`child_access(child_id, user_id, role)`** — the membership table and **single
  source of truth**. Partial unique index: a `child`-role user holds exactly one
  row globally; parents hold N.
- **`invites`** — the allowlist (`email, role, child_id, token, status`).
- **`current_child_ids()`** — STABLE, SECURITY DEFINER helper returning the
  caller's tenant set from `child_access`.
- **Normative RLS:** every tenant table enforces
  `child_id = ANY (current_child_ids())` on all operations. **No policy
  references `children.parent_user_id`.** Service role bypasses RLS — therefore
  **every service_role path carries and asserts an explicit `child_id`**.

**Login → tenant flow:** OTP sign-in → ensure `users` row →
`SELECT child_id, role FROM child_access WHERE user_id = auth.uid()` →
0 rows: invite check → consume or pending-invite state ·
1 row: straight into that child's dashboard (child-role users never see a
switcher) ·
N rows (parent): child-switcher → per-child dashboard.
The chosen `child_id` becomes `active_child_id` (app state + per-user
localStorage). A forged `active_child_id` fails RLS server-side regardless —
**the client never enforces tenancy; the database does.**

## 3. Data flow: login → tenant → data

```
OTP login → auth.users → users (trigger) → child_access lookup
  → active_child_id → PostgREST / RPCs with caller's JWT
  → RLS: child_id = ANY(current_child_ids()) → rows for exactly one tenant
```

Writes go through the same RLS gate. Privileged writes (invite consumption,
credential rotation, audit) go through SECURITY DEFINER functions that assert
membership first. Reads of other tenants' rows are impossible by construction,
not by convention.

## 4. Worker / sync flow

Per-child sync is a queue, and the queue is where the non-crossing proof lives:

1. App/parent cron inserts `sync_requests(child_id, …)` (SYNC NOW = queue insert).
2. Worker claims via **`rpc_claim_sync(p_worker_id, p_child_ids)`**
   (`FOR UPDATE SKIP LOCKED`, rejects empty whitelists) — learns the
   authoritative `child_id` **from the claimed row**, never from config.
3. Worker calls **`get_tenant_secret(claimed.child_id, system)`** —
   fetch-at-claim, held in process memory only, **zeroized after the job**.
4. The **adapter registry** (`school_systems`) selects the module; Cobb County
   (`cobb_adapter`) is Adapter #1 implementing the 4-method contract
   (`get_grades/get_assignments/get_attendance/get_messages`, all normalized).
5. Every write carries `claimed.child_id` with a fail-closed assertion.
   A misconfigured worker causes **starvation** (unclaimed syncs, caught by a
   per-child pending-age monitor), never leakage.

Portal passwords live in **Supabase Vault** (AES-256-GCM); `child_portals`
holds metadata only, and clients see it through a secret-less view
(`vault_secret_id` never leaves service_role/Edge-Function paths).

## 5. AI placement

One invariant governs all AI: **no prompt, worker request, or cron ever runs
without a resolved `child_id`**, enforced at three chokepoints — the cron
schema (required field), the Worker entry (rejects unverified `child_id`
before any model call), the agent runbook (resolve-and-log first, abort if
ambiguous).

- **Pookie tutor Worker v2:** app sends `child_id` + Auth JWT; Worker verifies
  the JWT and confirms `child_id` ∈ caller's `child_access` (never trusts the
  client value alone). System prompt assembled per request from that child's
  record only; history always `WHERE child_id = $child_id` with a
  `count(DISTINCT child_id) = 1` assertion. KV keys prefixed
  `tenant:<child_id>:`. Roles canonical `('user','pookie')`.
- **Muse agent:** reads through the dedicated `agent_reader` role —
  SELECT-only, no Vault, no `auth.users`, RLS still applies. Per-job tenant
  scope recorded in `agent_tenant_scope(job_id, child_id)`; every agent
  read/write is appended to `audit_log`. Cross-tenant comparison fails closed.
- **Peer-tips generator:** takes `child_id` as a parameter; cost scales
  linearly per child — budgeted per tenant, no cross-tenant peer features
  without explicit per-child parent opt-in.

## 6. Component map

| Component | Role | Tenant binding |
|---|---|---|
| Next.js app (`/[childSlug]/…`) | Slug-routed UI, `useChild()` context | `active_child_id`; RLS is the real gate |
| Supabase Postgres + RLS | System of record | `child_id` on every tenant row |
| Supabase Auth (OTP) | Identity | email → `child_access` |
| Supabase Vault | Portal passwords | `tenant_<child_id>__<system>` secrets |
| Supabase Storage (`class-files`) | Uploads | `<uid>/<child-slug>/<class>/<yyyy-mm-dd>/<file>` |
| Worker `pookie-tutor-v2` + KV | Tutor chat, Muse queue | JWT-verified `child_id`, `tenant:` key prefix |
| Laptop workers | StudentVUE/CTLS sync | `TENANT_CHILD_ID` + `rpc_claim_sync` whitelist |
| Edge Functions | `portal-credential-write`, credential test | parent-membership check, then service_role |
| Crons / Muse agent | Briefings, merges, monitors | required `child_id` param, `agent_reader` |
| `audit_log` + `consents` | FERPA-aligned accounting, consent ledger | append-only, per `child_id` |

**Adapter registry** (`school_systems`): adding a district = implement the 4
methods + insert one row. The School tab selector drives adapter choice,
credential fields, grade-scale default, and worker-pool eligibility per child.

## 7. Coherence verdict

- **Solid:** tenancy core (001) — `child_access` as single source of truth,
  `current_child_ids()` RLS pattern, no `parent_user_id` in any policy;
  adapter registry + Cobb seed (002); consents/audit append-only ledgers (004).
- **Deferred by design:** ~20 carried-over tables + their RLS/RPCs (ETL
  migration contract recorded in the audit); COPPA consent flow and per-tenant
  backup granularity (plan open questions).
- **Must be added/fixed before cutover:** `class-files` storage RLS;
  `rpc_claim_sync` contract + implementation; agent scope→RLS wiring;
  Vault read boundary (service_role-only); NULL-child portal isolation;
  `security_invoker` on the secret-less view; `worker_children`,
  `teacher_contacts`, `add_child()`; family seed. (Full list with severities:
  `docs/audit-findings/solution-architect.md`.)

## 8. Mobile architecture coherence

**Directive:** Pookie ships on the Apple App Store and Google Play — native
mobile apps, not web-only. The UI full-stack expert is evaluating
Capacitor vs React Native/Expo vs PWA; no mobile section file from that expert
exists yet, so this subsection evaluates **conditionally** — the coherence
constraints below hold regardless of which option wins, with per-option notes.

### 8.1 Coherence check on the mobile choice

**The choice does not contradict the multi-tenant architecture, because
tenancy is enforced server-side.** RLS keyed on `current_child_ids()` never
trusts the client's `active_child_id`, so a WebView (Capacitor), a React
Native client, or a PWA are all equally unable to spoof tenancy at the data
layer. The residual spoofing surface is UI-level (displaying the wrong child's
cached data), identical in kind to the web app's — mitigated the same way:
resolve slug→`child_id` server-side on every context switch and treat
`active_child_id` as a display hint.

Per-option coherence notes:

- **Capacitor (WebView wrapping the Next.js app):** most coherent — one
  codebase, same Supabase project, same RPCs, same RLS. New surfaces to close:
  (a) auth tokens must live in **secure storage** (Keychain/Keystore via a
  Capacitor plugin), never WebView localStorage — the standing hCaptcha rule
  already forces manual sign-in, which works in a WebView via the normal OTP
  flow; (b) deep links (`pookie://…`) must validate the child slug against
  `child_access` server-side before switching context — never trust the link;
  (c) disable WebView debugging in production builds and cleartext traffic;
  (d) no Capacitor JS bridge may expose the service_role key, Vault secrets,
  or raw tokens to injected JS — the bridge surface is audited like an API.
  Caveat: if the WebView loads a *remote* URL, offline ( §8.3) requires a
  bundled build instead.
- **React Native / Expo:** coherent as a second client on the same backend —
  same Supabase JS client, same RPCs, same RLS. Costs: duplicated UI and a
  second auth-session implementation (SecureStore/Keychain). Push is native
  here (Expo Push / FCM / APNs) rather than bolted on. No backend changes
  beyond §8.2.
- **PWA alone:** fails the founder directive (no App Store / Play presence).
  Keep as a free fallback, not the strategy.

**Worker/adapter model:** unaffected — laptop workers and `rpc_claim_sync`
don't know or care what client queued the sync. **AI committee backend:**
unaffected — the Worker v2 entry already requires a verified `child_id` + JWT,
which any mobile client sends identically; the `agent_reader` boundary and
the no-AI-without-`child_id` invariant are client-agnostic.

### 8.2 Backend-for-mobile: same project, small schema additions

**No mobile-specific data API.** Mobile uses the same Supabase project,
PostgREST, and RPCs as web — one backend, N clients. The additions implied are
device-scoped, not data-scoped:

- **`devices` table** (new): `id uuid PK`, `user_id uuid NOT NULL REFERENCES
  users(id) ON DELETE CASCADE`, `platform text CHECK (platform IN
  ('ios','android'))`, `push_token text UNIQUE NOT NULL`, `app_version text`,
  `last_seen_at timestamptz`, `created_at`. RLS: a user manages **own** rows
  (`user_id = auth.uid()`); parents can SELECT devices of users sharing their
  tenant set (device-management UI); all writes of other users' rows denied.
  Push tokens are sensitive (they address the user) — never exposed across
  users; only service_role / the push dispatcher reads them.
- **Push dispatcher** (Edge Function or worker-side): input `child_id` →
  resolve recipients from `child_access` at send time (per plan §4.3, never a
  global recipient list) → look up their `devices` → send via FCM/APNs.
  Honors the per-tenant send window (`child_settings.send_window`,
  default 06:00–22:00 America/New_York). Token rotation/deletion on app
  reinstall handled by upsert on `push_token`.
- **Device management UI** (Menu → Family → Devices): parent sees per-member
  devices, can revoke (delete row + revoke refresh tokens via Auth admin).
- **Auth config:** Supabase redirect URLs must include the mobile custom
  scheme (e.g. `pookie://auth/callback`) alongside the web URLs (plan §3.2 #7).
- **`app_version` gating:** record per device; a `min_supported_version`
  value in app config drives force-upgrade prompts — enforced client-side,
  recorded server-side.
- **Per-tenant delete** (Data tab) must cascade to `devices` rows of the
  family's users and invalidate their push tokens — push tokens are personal
  data under the same erasure unit as the child.

### 8.3 Offline architecture — the offline contract

A kids' school app must be useful on the bus with no signal. Contract, at the
architecture level:

- **Works offline (read):** last synced dashboard (grades, daily briefing
  content), cached Learn materials explicitly downloaded, tutor history
  (read-only), check-in form (draft locally).
- **Queues offline (write):** check-in submissions, Path-to-90 checkbox
  toggles, private notes, manual assignments, material-view events. Client-side
  **outbox**: `[op, child_id, payload, client_uuid, queued_at]`, persisted
  on-device (SQLite/MMKV — never plain localStorage for anything sensitive;
  drafts containing free text are fine locally, tokens are not).
- **Never offline:** portal credential entry/rotation, Vault operations,
  invite consumption, anything requiring fresh auth — these require
  connectivity by policy, not just by implementation.
- **Reconnect protocol:** push outbox in order through the *same* RPCs /
  PostgREST endpoints as online writes (no parallel write path — the RLS and
  `child_id` assertions apply identically); then pull deltas
  (`updated_at > last_sync_watermark` per `(device, child_id)`); then update
  watermarks. Idempotency via `client_uuid` — the server dedupes replays
  (unique constraint on `client_uuid` for outbox-originated mutations).
- **Conflict resolution:** server-authoritative for sync data (grades,
  assignments — never written offline, so no conflicts); **last-write-wins by
  server timestamp** for simple fields (checkboxes, notes); check-ins upsert on
  the existing `(child_id, checkin_date)` unique rule keeping
  max(`updated_at`) — the same dedupe rule the ETL uses (§3.3), so offline and
  ETL agree. Tutor chat requires connectivity (the model call is server-side);
  the client may queue the message text and send on reconnect, or disable
  offline compose — a UX decision, not an architecture fork.
- **Capacitor note:** offline reads come from the on-device cache populated at
  last sync; this requires the app shell to be bundled (static export), not a
  remote-URL WebView. The sync engine above is identical for Capacitor and
  React Native — it sits behind the Supabase client, not the UI framework.

**Coherence bottom line for mobile:** the backend needs no fork — one
Supabase project, one RLS model, one RPC surface. The mobile work is a client
choice (Capacitor recommended for single-codebase coherence), plus the
`devices` table, push dispatcher, custom-scheme auth URLs, and the
outbox-based offline contract above. None of it weakens the tenant boundary;
the `devices` RLS and the dispatcher’s per-`child_id` recipient resolution are
the two load-bearing additions, and both follow the existing
`child_id = ANY (current_child_ids())` pattern.
