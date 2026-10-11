# ENGINEERING HANDBOOK — Pookie

> The ultimate mother app powered by AI. Greenfield multi-tenant SaaS.
> Status: v1.0 — all components signed off 2026-10-11.
> Owner: Director of Engineering. Changes via ADR in §04.

## Contents
- [01 — Backend API Conventions](./handbook-sections/01-api-conventions.md)
- [02 — Frontend Component Patterns](./handbook-sections/02-frontend-patterns.md)
- [03 — Architecture Overview (Pookie)](./handbook-sections/03-architecture-overview.md)
- [Design Decisions — Architecture Decision Records](./handbook-sections/04-design-decisions.md)
- [05 — CI/CD Pipeline & Delivery](./handbook-sections/05-cicd-pipeline.md)
- [06. RLS & Data — Tenancy, Policies, Functions, Indexes](./handbook-sections/06-rls-and-data.md)
- [07 — Integration Patterns: Adapter Registry, Contracts & Credential Flow](./handbook-sections/07-integration-patterns.md)
- [08 — Next.js 16 App Router Implementation Standards](./handbook-sections/08-nextjs-standards.md)
- [Pookie Engineering Handbook — §09 Application Security](./handbook-sections/09-appsec.md)
- [10. Zero-Trust Architecture](./handbook-sections/10-zero-trust.md)
- [11 — Design Language](./handbook-sections/11-design-language.md)

---

<!-- BEGIN handbook-sections/01-api-conventions.md -->
# 01 — Backend API Conventions

**Owner:** Backend/API conventions manager · **Status:** normative for pod review · **Date:** 2026-10-11
**Reconciliation note (2026-10-11):** reconciled with the Technical Architect's ADR-001 in
`docs/handbook-sections/04-design-decisions.md` — **REST only, no tRPC** (decisive evidence: a
repo-wide grep of the old app proves `@trpc/*` declared but zero imports; the pod has no real
tRPC experience; Supabase already *is* the typed API). Also aligned with ADR-002 (neither Server
Actions nor Route Handlers as primary; client→Supabase direct under RLS, Edge Functions for
privileged I/O). §2 and §3 below reflect the decided position; the earlier tRPC recommendation is
superseded and must not be cited.

**Stack:** Next.js 16 + TypeScript + Tailwind (App Router) · Supabase (`pookie` project) ·
Cloudflare Pages (static-export semantics) · Cloudflare Worker (`pookie-tutor-v2`) · laptop sync
workers (Python).

---

## 1. Layer map — where backend code is allowed to live

The API surface is: **versioned REST** (machine clients, served from Supabase Edge Functions) +
**Supabase direct under RLS** (browser clients via `supabase-js`) + **Postgres RPCs** (privileged
primitives) + **Edge Functions** (privileged/external-I/O operations). Per ADR-001 there is no
tRPC; per ADR-002 there are no Server Actions and no Next.js Route Handlers — the Pages app stays
static-export-compatible.

| Layer | Used for | Must NOT be used for |
|---|---|---|
| **Client Components** (`src/app/**`, via singleton `supabase-js` client) | Reads and writes the user is authorized for; RLS is the policy engine, the user's JWT is the credential | Privileged writes the user must not do directly (credential storage, invite consumption, sync claiming); service_role in the browser |
| **Supabase RPC** (`public.*` functions, `SECURITY DEFINER`) | Privileged primitives only: `rpc_claim_sync`, `consume_invite`, `audit_event`, `agent_assert_scope`, `get_tenant_secret`, sync-claim/finish RPCs; complex multi-table writes that must be atomic | Business logic; anything callable without an assertion; client-visible exception strings (fix per audit H2) |
| **Supabase Edge Functions** (Deno, per-function secrets) | Privileged or external-I/O ops: `portal-credential-write`, test-connection probes against school portals, webhook receivers needing secrets, versioned REST for machine clients (`/api/v1/*`) | Anything a plain RPC or direct client call can do; business logic that belongs in Postgres or shared services |
| **Python workers** (`dawson-windows-sync.py` lineage) | Student-side sweeps (StudentVUE/CTLS), pushing results via versioned REST or direct RPCs | Holding credentials in code; bypassing the sync-claim protocol |
| **`src/lib/`** (framework-free TS) | Error-code registry, assert helpers, zod schemas, response shaping shared by client + Edge Functions | Anything importing `service_role` (lives only in Edge Function secrets, the Secure Vault, and worker envs) |

Rules:
1. **Browser data access goes direct: Client Component → `supabase-js` → PostgREST/RPC.** RLS is the
   authorization layer; the anon key + `current_child_ids()` enforcement is the enforcement point,
   not a fallback. Every query runs under the user's JWT — no query without it.
2. **The `service_role` key lives in exactly three places:** the Secure Vault (source of truth),
   Supabase Edge Function secrets (per-function), and the Python worker environments. It is never in
   the repo, never in Next.js code or `NEXT_PUBLIC_*`, never bundled, never logged. Any import of
   `service_role` into a Server Action or Route Handler is exactly the key-leak the plan's §4.7
   residual-risk list warns about — and those surfaces do not exist anyway (ADR-002).
3. **Business logic lives in `src/lib/services/`** (plain TS modules, framework-free, unit-testable)
   **and in Postgres** (views, RPCs) where the query planner and RLS see them. Edge Functions are
   thin adapters: validate → resolve tenant → call RPC/service → shape response.
4. **Remove `@trpc/*` (and `drizzle-orm`) from `package.json`** — dead dependencies are a
   supply-chain and confusion cost (ADR-001, ADR-003).

---

## 2. API shape — decided by ADR-001: REST + Supabase. No tRPC.

**Decision: no tRPC. The API surface is Supabase: PostgREST (via `supabase-js`) for CRUD under
RLS, Postgres `SECURITY DEFINER` RPCs for privileged/multi-step operations, and versioned REST
(`https://…/api/v1/*`, served from Supabase Edge Functions, not Next.js) for machine clients.**
The earlier recommendation of tRPC v11 for app-internal traffic is **withdrawn** — superseded by
ADR-001 (2026-10-11, `04-design-decisions.md`).

### Why tRPC lost (ADR-001 evidence, binding)
- **No real tRPC experience:** `@trpc/client`, `@trpc/react-query`, `@trpc/server` are declared in
  the old app's `package.json` but have **zero imports anywhere in source** (verified by repo-wide
  grep). The "team tRPC experience" argument is void.
- **Supabase already is a typed API.** PostgREST exposes every table as REST; `supabase gen types`
  (CI-generated, checked into the repo) gives end-to-end TypeScript types from the live schema.
  A tRPC router would be a second API surface hand-mapping the same tables — every query written
  twice, every schema change touched twice.
- **Tenant context propagation.** The tenancy model (`child_id = ANY (current_child_ids())` via
  RLS) works because the *user's JWT* rides the request. Direct `supabase-js` carries it for free;
  a tRPC layer would have to forward the JWT into each procedure context and re-assert per call —
  new code on the hottest security path, i.e. new ways to leak across tenants.
- **Non-Next.js clients always exist.** The laptop sync workers are Python; the Pookie tutor is a
  Cloudflare Worker. Both speak REST/RPC natively.
- **Deployment.** The app targets Cloudflare Pages with static-export semantics. tRPC needs a
  server runtime; the current architecture is static-friendly precisely because the database *is*
  the API server.

### The three non-negotiables — how REST+Supabase satisfies them
The backend requirements outlive the tRPC debate; every surface must satisfy them:
- **(a) A single inheritable tenant-assertion primitive:** RLS (`current_child_ids()`) on every
  query — automatic, not per-route hand-rolled — plus the shared `assertTenant(child_id)` helper
  (§6) for service-role paths. No endpoint may invent its own assertion logic.
- **(b) Generated/checked client types:** `supabase gen types` runs in CI on every migration; the
  generated `Database` type is checked into the repo and CI fails on drift (per ADR-003). No
  handwritten client types for DB shapes.
- **(c) zod input validation at every boundary:** client mutation params, Edge Function bodies and
  query strings, RPC params, worker payloads. Parse, don't validate-and-cast.

### Machine clients (versioned REST)
The laptop sync workers (Python), cron runners, and any future third-party integration get **REST**
— predictable, curl-able, documentable. These endpoints live on Supabase Edge Functions (ADR-002),
never on Next.js Route Handlers, so the app stays static-export-compatible:
- `POST /api/v1/sync/claim`, `/api/v1/sync/finish`, `/api/v1/sync/heartbeat` (workers may equally
  call the underlying RPCs directly via PostgREST — decide per endpoint, but the HTTP surface is
  REST either way);
- `POST /api/v1/tutor/chat` proxy → `pookie-tutor-v2` (keeps the worker URL and CORS config out of
  the client bundle; adds tenant scoping server-side);
- Webhook receivers (if any) — REST only, Edge Function only.

---

## 3. Direct client vs Edge Function vs RPC — guidance under ADR-002

**Default: client → Supabase directly under RLS. Postgres RPCs for privileged atomic primitives.
Edge Functions for privileged/external-I/O. No `'use server'` Server Actions, no `app/api` Route
Handlers** — both require a server runtime and would break the app's static-export deployment on
Cloudflare Pages (ADR-002). Any future need for a server runtime is a deployment-architecture
change requiring its own ADR — not something to drift into one endpoint at a time.

Use a **direct client call** (`supabase-js`, user's JWT, RLS enforced) when ALL are true:
- The user is authorized for the read/write by RLS policy alone;
- No secrets, no external HTTP calls, no multi-step orchestration beyond what PostgREST/RPCs do;
- No custom status codes, headers, or streaming needed (e.g. use signed URLs from Storage instead
  of proxying downloads).

Use a **Postgres RPC** (`SECURITY DEFINER`) when ANY is true:
- The write is privileged or multi-statement and must be atomic (sync claim, invite consumption,
  `audit_event`, `get_tenant_secret`, `agent_assert_scope`);
- The client must not see intermediate state or raw exception strings (map them to error codes,
  §4).

Use an **Edge Function** (Deno, per-function secrets) when ANY is true:
- Caller is a machine (worker, cron, webhook, Python script) needing a versioned REST contract;
- External I/O with secrets (portal test-connection probes, Vault credential writes via
  `portal-credential-write`);
- Webhook receivers needing HMAC verification with a secret.

Security notes (all paths):
- All paths run with the request's auth context and **must resolve and assert `child_id` (§6)**.
  The client having filtered by `child_id` in a query is *not* authorization — RLS plus the shared
  assert helper is.
- Edge Functions verify the caller's JWT and resolve/assert `child_id` as step one of the handler;
  reject requests without a resolved `child_id` before any other work.
- Machine endpoints (workers/crons) apply per-caller rate limits and require signed job tokens;
  `429` + `Retry-After`.
- Never trust a `child_id` (or `childSlug`) passed from the client as *authorization*. It is a
  *selection* among the caller's tenants; the server/RPC verifies `child_id = ANY(current_child_ids())`
  before touching data. Route params `/[childSlug]/…` are resolved slug→id in the client against
  `child_access`, then asserted by RLS the same way.

---

## 4. Error-response shape (canonical)

All machine-facing surfaces (PostgREST/RPC errors normalized by the client adapter, Edge Function
responses, worker-visible failures) map to one envelope. `supabase-js` errors are normalized by
the client adapter to this shape; Edge Functions emit it directly:

```jsonc
{
  "ok": false,
  "error": {
    "code": "TENANT_SCOPE_VIOLATION",   // SCREAMING_SNAKE, stable, documented
    "message": "You don't have access to this child's data.",  // human-safe
    "details": { "field": "child_id" }, // optional, never internals
    "requestId": "req_9f3a…"            // for log correlation
  }
}
```

Success: `{ "ok": true, "data": { … }, "page": { … }? }`.

Conventions:
- **Codes are stable API.** Add new ones; never rename. Maintain `src/lib/errors.ts` as the
  registry: `INVITE_NOT_FOUND`, `INVITE_EMAIL_MISMATCH`, `TENANT_SCOPE_VIOLATION`,
  `PARENT_ROLE_REQUIRED`, `RATE_LIMITED`, `VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`,
  `UPSTREAM_UNAVAILABLE`, `INTERNAL`.
- **DB exception → code mapping** lives in one place. Raw Postgres messages (constraint names,
  `agent_scope_violation`, `parent_membership_required`) are **never** returned to clients; log them
  with `requestId`, return the mapped code. (Audit C1/H2 findings depend on this: `RAISE EXCEPTION`
  strings are currently client-visible via PostgREST.)
- **HTTP status mapping:** `VALIDATION_FAILED`→400, `INVITE_*`/auth→401/403 (`TENANT_SCOPE_VIOLATION`
  →403, never 404 — do not confirm/deny tenant existence), `NOT_FOUND`→404, `CONFLICT`→409,
  `RATE_LIMITED`→429 (with `Retry-After`), `UPSTREAM_UNAVAILABLE`→502/503, `INTERNAL`→500.
- Every error is logged server-side with `requestId`, `child_id` (if resolved), `actor`, and full
  detail. Client gets the safe subset.

---

## 5. Pagination, filtering, sorting

**Pagination — cursor (keyset) by default.** Offset pagination is allowed only for small, bounded
admin lists (< 500 rows total).

Request: `?cursor=<opaque>&limit=<n>` — `limit` default 25, max 100, clamped server-side.
Response:
```jsonc
{ "ok": true, "data": [ … ], "page": { "nextCursor": "…", "hasMore": true } }
```
- Cursors are opaque (base64 of `(sort_key, id)` tuple), never raw offsets or SQL.
- Default sort is stable and documented per endpoint (e.g. `audit_log`: `at DESC, id DESC`).
  Keyset pagination *requires* a unique tiebreaker — always include `id`.

**Filtering:** query params are **allowlisted per endpoint** (zod schema). Never pass through
arbitrary filters to the query builder. Conventions:
- `?status=verified`, `?portal_key=studentvue` — exact match on indexed columns;
- `?since=2026-10-01T00:00:00Z` / `?until=…` — RFC 3339, inclusive/exclusive documented;
- `?q=…` — substring search only where a trigram/GIN index exists; max length 120.

**Sorting:** `?sort=-at` / `?sort=created_at` — allowlisted fields only; `-` prefix = descending.
Reject anything else with `VALIDATION_FAILED`.

---

## 6. The child_id rule — every backend entry point carries and asserts it

This is the backend restatement of the tenancy model: `child_access` is the single source of truth;
`current_child_ids()` is the enforcement primitive; **service_role bypasses RLS, so every
service_role path must carry and assert an explicit `child_id`.**

### 6.1 The pattern (all entry points)

```
1. RESOLVE  — obtain child_id: route param slug→id, body field, job payload, cron config.
2. ASSERT   — one of:
     user session →  child_id = ANY (current_child_ids())          [RLS + app check]
     agent job    →  agent_assert_scope(job_id, child_id)           [after C2/C3 fixes]
     worker/cron  →  child_id ∈ worker's assigned set (worker_children / job payload allowlist)
3. USE      — queries filter by the asserted child_id; writes stamp it explicitly
             (no column DEFAULT — code must pass it, per PLAN §3.1).
4. AUDIT    — consequential writes call audit_event() with the asserted child_id.
```

Step 2 is **never skipped, never cached across requests**, and never derived from client input alone.

### 6.2 Per entry point

| Entry point | Carry | Assert |
|---|---|---|
| Client Component → PostgREST (user) | `child_id` column filter on every query; never omitted, never from `localStorage` alone | RLS: `child_id = ANY (current_child_ids())` on the user's JWT — automatic per row; the shared `assertTenant(child_id)` helper for anything that decides *which* tenant is selected |
| Client Component → RPC (user) | `p_child_id` param (uuid) | Function body asserts membership first (see `get_tenant_secret` — the model to copy; fix `audit_event` per H2) |
| Edge Function (user) | JWT in `Authorization` + `child_id` in body/query | Verify JWT, then `child_id = ANY(current_child_ids())` as step one; reject before any other work |
| Edge Function (machine, versioned REST) | Body/header `x-child-id` + signed job token | service_role: verify `child_id` ∈ the job's allowlist (`sync_requests.child_id`, `worker_children`); reject empty/ambiguous; never accept a worker-supplied `child_id` without an allowlist check |
| Supabase RPC (direct) | `p_child_id` param | Function body asserts membership first (see `get_tenant_secret` — the model to copy; fix `audit_event` per H2) |
| Cron job | `{"child_id","child_slug"}` in job config (PLAN §1.6 rule) | Step one of the job body: resolve-and-log; **abort if missing/ambiguous** |
| Worker endpoint (`pookie-tutor-v2` `/muse-queue*`) | `tenant:<child_id>:` key prefix; `child_id` in payload | Worker checks `child_id` ∈ its assigned set at claim time; prompts parameterized from `children` row, never from client text |
| Agent (Muse) reads | `job_id` + `child_id` | `agent_assert_scope()` + session-scoped RLS (pending C2/C3 fixes — do not build on the current shape) |

### 6.3 Anti-patterns (forbidden in review)

- `supabaseAdmin.from('x').select()` without a `child_id` filter derived from step 2.
- Reading `child_id` from `localStorage`/client state and using it in a `service_role` query.
- `profiles`-style nullable `child_id` writes that "fill it in later."
- Catching `TENANT_SCOPE_VIOLATION` and retrying with a different `child_id`.
- Logging or returning `vault_secret_id`, raw tokens, or `service_role` key material.

---

## 7. Cross-cutting conventions

- **Validation:** zod schemas at every boundary (client query/mutation params, Edge Function
  REST body/query, RPC params, worker payloads). Parse, don't validate-and-cast.
- **Idempotency:** mutations that workers/crons retry (sync claims, ETL upserts, email sends) take
  `Idempotency-Key` (REST header) or a deterministic natural key; upsert on PK/unique constraints.
- **Rate limiting:** global per-IP + per-user buckets on auth and invite endpoints (invite/OTP paths
  are the abuse surface — see audit C1); `429` + `Retry-After`.
- **Secrets:** `get_tenant_secret()` fetch-at-claim, no caching, zeroize after use (per 003 design).
  Never log secret values or lengths.
- **Time:** UTC in DB/API; convert to `children.timezone` at render.
- **Audit:** every consequential write (grade-affecting, credential, consent, disclosure, invite
  lifecycle) emits `audit_event()` with the asserted `child_id` — after H2 is fixed.
- **Testing the boundary:** each endpoint ships a test proving (a) cross-tenant `child_id` → 403,
  (b) missing `child_id` → 400/validation error, (c) service_role path with unlisted `child_id` →
  rejected. The tenant-boundary test matrix is part of CI, not optional.

---

## 8. Reconciliation record

1. **tRPC vs REST — reconciled 2026-10-11 with ADR-001** (`04-design-decisions.md`): tRPC out,
   REST-only. The earlier recommendation of tRPC v11 (§2, round 1) is withdrawn. Binding evidence:
   repo-wide grep proved `@trpc/*` declared but zero imports in the old app (no real tRPC
   experience); Supabase is already the typed API (`supabase gen types` in CI); JWT+RLS carries
   tenant context for free; Python/Worker clients speak REST natively; static-export deployment on
   Cloudflare Pages needs no server runtime. Action: remove `@trpc/*` from `package.json`.
2. **Server Actions / Route Handlers — reconciled 2026-10-11 with ADR-002**: neither as primary.
   Primary data plane is client→Supabase direct (RLS + RPCs, singleton browser client); Edge
   Functions for privileged/external-I/O, including the versioned REST machine surface. No
   `'use server'`, no `app/api`. Any future server runtime needs its own ADR.
3. **Non-negotiables preserved across the change** (not weakened): single inheritable
   tenant-assertion (RLS + `assertTenant(child_id)`; §6), generated/checked client types (CI,
   `Database` type; ADR-003), zod at every boundary (§7), the canonical error envelope (§4),
   cursor-pagination and filter/sort conventions (§5), the service_role three-place rule (§1.2).
   ADR-003 (supabase-js as sole data-access library; no Drizzle) is assumed throughout.
...[truncated 561 chars]
<!-- END handbook-sections/01-api-conventions.md -->

<!-- BEGIN handbook-sections/02-frontend-patterns.md -->
# 02 — Frontend Component Patterns

**Owner:** Senior Frontend Developer (Frontend component patterns)
**Status:** draft for pod review
**Applies to:** the Pookie greenfield app — Next.js 16 + TypeScript + Tailwind,
Supabase (`pookie` project), Cloudflare Pages.
**Normative companion:** `docs/audit-findings/frontend-dev.md` (findings F1–F13).
Where this handbook and the migration disagree about authority, **the database
wins**: `child_access` is the single source of truth, RLS is the enforcement
point, and the frontend is a well-behaved client of both.

---

## 1. The one rule that governs everything

> **The frontend never decides who may see what. It only decides what to render
> once the server has decided.**

Every pattern below is an instance of this. `active_child_id` is a *hint* the
client keeps for convenience; the *authority* is `child_access` read through
RLS. Any component, hook, or route that treats client state as proof of access
is a bug, even if RLS would have stopped the data — because the UI would have
already promised something untrue (wrong child's name in the header, a switcher
for a child-role user, cached rows after revocation).

---

## 2. Tenant-context plumbing: how `active_child_id` flows

### 2.1 Source of truth and session cache

```
auth.uid()  →  child_access (via RLS)  →  access set: [{child_id, role}, …]
                                                    ↓ (client keeps a copy)
                                          TenantProvider state
                                           + localStorage hint
```

- **Resolution** happens once per session start (and again on window focus, on
  consume/revoke events — see §6): `supabase.from('child_access').select('child_id, role')`.
  This is a cheap, RLS-protected query. Do not cache it aggressively; it is the
  cheapest revalidation we have.
- **The hint:** `localStorage['pookie:active_child:<authUserId>']`. Namespaced
  per auth user — never a global key (shared family devices). The app may
  *propose* this value at boot, but must intersect it with the freshly resolved
  access set before rendering anything tenant-scoped. Mismatch → discard the
  hint, re-route (switcher / straight-in / pending-invite per §4).
- **In-memory:** a `TenantProvider` (React context) holds `{ accessRows,
  activeChildId, activeRole, setActiveChild }`. All tenant-scoped data hooks read
  the child id from this context — never from props drilled five levels, never
  from `useSearchParams`, never from localStorage directly.

### 2.2 Setting a new tenant (the switcher)

`setActiveChild(childId)` must:

1. Assert `childId ∈ accessRows` **client-side** (fail fast, friendly error).
2. Persist the namespaced localStorage hint.
3. **Purge the previous tenant's cache** — `queryClient.clear()` (or
   `removeQueries` keyed by the old child id), reset Zustand/in-memory stores,
   abort in-flight tenant queries. There is no "keep the old dashboard warm in
   the background": cross-tenant caches are forbidden (see §8).
4. Navigate to the new dashboard. Server-side, RLS re-enforces membership on
   every query regardless — step 1 is UX, RLS is the guarantee.

### 2.3 Server re-validation

- Server Components, Route Handlers, and Server Actions **never accept a
  `child_id` from the client as authority**. They derive the caller via
  `supabase.auth.getUser()` and filter by the access set (or rely on RLS on the
  anon/authenticated client — same thing, enforced in Postgres).
- Service-role paths (sync workers, admin jobs) **bypass RLS** and must therefore
  carry an explicit `child_id` parameter and **assert membership in application
  code** before touching data. A service-role call without an asserted `child_id`
  is a defect by definition.

### 2.4 What goes in the URL

- Prefer **no `child_id` in URLs**: the tenant lives in session context, so
  `/dashboard`, `/classes/geometry`, `/track` are all implicitly "for the active
  child". This removes an entire class of spoofing/validation bugs.
- Where a child must be addressable (invite accept links, share links), use
  opaque tokens or the canonical `slug` — and **validate membership server-side
  before rendering**. A URL is user input; treat it as hostile.

---

## 3. Component patterns

### 3.1 Page anatomy (every route)

```
app/<route>/page.tsx            — Server Component: auth + tenant resolution,
                                   redirects; renders <RouteShell>
components/<domain>/<X>View.tsx — client boundary: TenantProvider consumer,
                                   data hooks, composition only
components/<domain>/sections/*  — presentational sections; props in, UI out;
                                   no direct Supabase calls
```

- Pages stay thin: resolve session → resolve tenant → redirect-or-render.
- Data fetching lives in hooks (`hooks/useGrades.ts`, …), keyed by
  `['tenant', activeChildId, ...]`. Hooks are the *only* place that call
  Supabase from client components.
- Presentational sections take plain props and are unit-testable without a
  Supabase mock. They never import the Supabase client.
- **Hooks above all early returns** (React #310 — a standing rule from the old
  stack that carries over). Every tenant hook handles `activeChildId == null`
  by returning `{ data: null, status: 'no-tenant' }`, never by throwing.

### 3.2 Error boundaries and null-safety

- Each page gets a per-section error boundary; one failing widget (grades,
  inbox, health) must not take down the dashboard. This is a standing pattern.
- Loaders are null-safe: `data?.classes ?? []`, never `data.classes.map` on a
  possibly-null payload. RLS-denied or revoked-mid-session responses arrive as
  *empty*, not as errors — code accordingly (§6).

### 3.3 Theming and tone

- Clean-teal design tokens (`bg-ink-900`, `text-paper`, `text-paper-dim`; light
  `#eef7f8`, deep-teal; dark deep-sea; neon soft/diffused, never harsh).
- Class pages follow the standing psychology-first contract: lead with the gap
  to 90 (mission framing), numeric + letter grade side by side separated by a
  line, color-coded sections, no light-on-white contrast, top-3 ranked actions,
  shame-free language, per-action checkboxes.

### 3.4 Reusable primitives

- `TenantGate` — renders children only when `activeChildId` is resolved and in
  the access set; otherwise renders the tenant-resolution skeleton (never a
  flash of wrong-tenant content).
- `RoleGate({ allow: ['parent'] })` — hides parent-only UI (Family management,
  invites, per-child Data tab with export/delete). **Visibility only** — the DB
  policies are the enforcement; the gate just keeps the UI honest.
- `EmptyState`, `ErrorState`, `Skeleton` — shared, themed, copy-reviewed (§5).

---

## 4. Auth-gate patterns

### 4.1 The resolution cascade (single implementation, used everywhere)

After OTP sign-in (or session restore), run exactly one cascade:

```
1. getUser() → no session → /login
2. fetch child_access rows (user_id = auth.uid())
3. rows.length === 0:
     a. fetch invites WHERE email = own email AND status = 'pending'
        → found: render invite-accept screen → consume_invite(token)
                 → on ANY failure, re-run step 2 (finding F8), then (b)
        → none:  render pending-invite state (finding F3 — informational only,
                 no dead "Request access" button until the backend exists)
4. rows.length === 1:
     role child  → straight to that child's dashboard. No switcher. Ever.
     role parent → straight to that child's parent dashboard.
5. rows.length > 1 (parent by construction — DB forbids N rows for child-role):
     → child-switcher screen (cards: name, photo, school)
```

- Implement this cascade **once** (a `useTenantResolution` hook + a server-side
  equivalent for Server Components) and reuse it in every entry point. Forked
  copies of the cascade are how "sometimes the switcher flashes for a child"
  bugs are born.
- Derive role from the `child_access` rows only — never from `users.role`
  (finding F5: it reads `'parent'` for child invitees until consumption).

### 4.2 Route guards

| Route | Guard |
|---|---|
| `/login`, `/auth/callback` | If session exists → run cascade (don't strand logged-in users on the login page) |
| `/switcher` | If all rows are `role='child'` → redirect to their dashboard (finding F10). If 1 row total → redirect per §4.1 step 4 (switcher with one card is a bug). |
| `/family/**`, `/children/**`, invite management | Parent-role rows required; child-role → 404-style redirect to dashboard (with `RoleGate` hiding the nav too). |
| `/pending-invite` | Reachable with 0 rows; renders **zero** tenant data, zero tenant nav, generic document title (finding: no data leakage before access is granted). |
| Everything else | `TenantGate`: no resolved `activeChildId` → skeleton, never partial render. |

### 4.3 OTP session handling

- Email-link OTP lands on `/auth/callback?token_hash=…&type=…`: exchange via
  `exchangeCodeForSession` (PKCE — required on Cloudflare Pages; the implicit
  flow is not reliable cross-domain), then `router.replace` to strip the token
  from the URL immediately. A token lingering in the address bar is shareable.
- Client-side resend rate limiting (e.g., 60s cooldown); expired/invalid codes
  get "request a new link" copy, never token internals.
- Render the CAPTCHA container if the new project's Auth settings enable it
  (carried-over standing rule from the old stack).
- Sign-out is a full teardown: `supabase.auth.signOut()` → clear all `pookie:*`
  storage → reset query caches → navigate to `/login`. There is no "soft" logout.

### 4.4 Invite acceptance UX

- Entry: link `?token=…` or the pending-invite screen's fetched pending invite.
- Before calling `consume_invite`, show the signed-in email verbatim and confirm
  it matches the invite's recipient ("This invite was sent to X — you're signed
  in as Y" → offer to sign out and switch). This pre-empts finding F6 dead-ends.
- After consumption (or on any consume error): **re-run the cascade** (F8).
- Never render raw `token` values anywhere; discard from state after the call.

---

## 5. Loading / error / empty states

| State | Pattern |
|---|---|
| Tenant resolving | Full-screen themed skeleton with neutral copy ("Getting your workspace ready…"). No tenant name, no child photo — the hint may be wrong. |
| Data loading (per section) | Section skeletons; dashboard renders sections independently so one slow query doesn't block the rest. |
| Empty (legitimately no data) | `EmptyState` with a next action ("No check-ins yet — add today's"), never a blank card. Distinguish *empty* from *denied* in code, even if the copy is similar. |
| RLS-denied / revoked mid-session | Treat as a tenant event, not a data error: re-run resolution; if the active child vanished from the access set → purge its cache → switcher or pending-invite (finding F9). Copy: "Your access changed — pick a workspace." Log the transition for audit. |
| Invite errors | One generic message for all consume failures (finding F7). Raw codes to console/telemetry only. |
| Network failure | `ErrorState` with retry; retry re-runs the hook, not a page reload. |
| Pending-invite (0 rows, no invite) | Informational only until the request-access backend exists (F3): identity shown, "no family workspace found for this email", human next step. No tenant nav, no prefetch of tenant queries, generic `<title>`. |

**Copy rules for auth-adjacent states:** never name a child the user can't
access, never confirm or deny the existence of other tenants ("not found" and
"no access" get the same screen), never expose token or error-code internals.

---

## 6. The child-switcher UX contract

1. **Who sees it:** sessions with ≥2 access rows. By DB construction these are
   all parent-role. **Child-role users never see it** — not as a screen, not as
   a nav item, not as an empty state. The `/switcher` route guard (§4.2) is the
   backstop; the cascade (§4.1) is the primary path.
2. **What it shows:** cards with child name, photo, school — data that comes
   from the already-RLS-filtered `children` query. Nothing else. No grades, no
   snippets, no badges with counts (those are separate queries and separate
   latency; the switcher must be instant).
3. **What switching does:** the `setActiveChild` sequence in §2.2 — client-side
   membership assert, hint persist, **full previous-tenant cache purge**,
   navigate. The outgoing tenant's data must be unrecoverable from the client
   afterwards (memory + storage).
4. **Single-child sessions never see it**, even transiently: the cascade routes
   1-row sessions straight to the dashboard. A flash of the switcher for a
   1-row user is a routing bug — fix the cascade, don't add a loading delay.
5. **Switcher is not a security boundary.** It is a convenience. If someone
   hand-crafts state to "select" a child outside their access set, step 1 of
   §2.2 rejects it client-side and RLS rejects it server-side. Both must hold.

---

## 7. What the frontend must NEVER do

1. **Never treat `active_child_id` (or anything in localStorage) as proof of
   access.** It is a hint. Membership is re-derived from `child_access` via RLS.
2. **Never cache data across tenants.** Query keys include the child id; tenant
   switch = cache purge. No "recently viewed child" preloads, no background
   refetch of the inactive tenant.
3. **Never put a raw `child_id` in a URL as the authority.** Tenant comes from
   session context; URLs stay child-agnostic. Addressable links use opaque
   tokens/slugs and are validated server-side.
4. **Never gate role UI on `users.role` or `children.parent_user_id`.**
   Role comes from `child_access` rows; `parent_user_id` is a billing anchor.
5. **Never render the switcher (or its nav entry) for child-role sessions.**
6. **Never render invite issuance/management for child-role sessions** — and
   never assume hiding it is sufficient (finding F1: the policy must also be
   tightened).
7. **Never fire tenant-scoped queries in the pending-invite / logged-out states.**
   RLS would return empty, but the *attempt* is the leak-shaped bug: prefetch
   lists, nav badges, and service workers must all be tenant-gated.
8. **Never persist cross-account state under a global key.** All persisted keys
   are namespaced `pookie:<scope>:<authUserId>`. Sign-in as a different email =
   full client reset.
9. **Never echo backend error codes, tokens, or invite internals in UI copy.**
   One generic message for auth failures; details to telemetry.
10. **Never let a service-role call run without an asserted `child_id`.**
    Service role bypasses RLS — the frontend/backend code that invokes it owns
    the membership check. "The worker needs it" is not an assertion.
11. **Never show placeholder seed data as real.** The `consume_invite` child
    shell (`'New'/'Child'`) is behind a mandatory profile-completion gate; no
    dashboard renders until it completes.
12. **Never keep showing cached rows after access is revoked.** Empty-set
    responses are tenant events: re-resolve, purge, re-route (§5).

---

## 8. Review checklist (sign-off gate for any frontend change touching auth/tenancy)

- [ ] Tenant resolution goes through the single cascade (§4.1) — no forks.
- [ ] Role derived from `child_access` rows only.
- [ ] `setActiveChild` asserts membership client-side AND purges prior tenant cache.
- [ ] No `child_id` in URLs as authority; no client-supplied `child_id` trusted by server code.
- [ ] Switcher unreachable/unrendered for child-role and 1-row sessions.
- [ ] Pending-invite state renders zero tenant data and fires zero tenant queries.
- [ ] Sign-out clears namespaced storage + in-memory caches.
- [ ] Auth error copy is generic; no tokens/codes in UI or logs.
- [ ] New family shell gated behind profile completion; no placeholder names rendered.
- [ ] Service-role invocations carry and assert an explicit `child_id`.

*End of section 02. Open items: F1–F3 + Director decisions 1–3 in
`docs/audit-findings/frontend-dev.md` must be resolved before invite UI is built.*

<!-- END handbook-sections/02-frontend-patterns.md -->

<!-- BEGIN handbook-sections/03-architecture-overview.md -->
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

<!-- END handbook-sections/03-architecture-overview.md -->

<!-- BEGIN handbook-sections/04-design-decisions.md -->
# Design Decisions — Architecture Decision Records
**Owner:** Technical Architect, Pookie engineering pod (component: Technical design decisions)
**Date:** 2026-10-11 · **Status:** DECIDED — signed off at the end of this file
**Stack context:** Next.js 16 + TypeScript + Tailwind on Cloudflare Pages (pages.dev), greenfield Supabase project `pookie`, email-keyed multi-tenancy enforced by Postgres RLS (`child_access` + `current_child_ids()`).

> How these were decided: each ADR records the context as actually observed (not as assumed), the decision with no hedge, and the consequences the team must live with. ADRs are append-only — a reversal gets a new ADR that supersedes, never an edit.

---

## ADR-001: tRPC vs REST — **DECIDED: REST (PostgREST via supabase-js + Postgres RPCs). No tRPC.**

### Context
The reference plan notes "the existing team's tRPC v11 experience" as a factor. I verified it: a repo-wide grep of `~/workspace/d-dash-app/` shows `@trpc/client`, `@trpc/react-query`, and `@trpc/server` **declared in package.json but with zero imports anywhere in source**. The team's real, production-hardened pattern is direct `supabase-js` calls from the client (e.g. `sync-button.tsx`, `tab-bar.tsx` hitting `sync_requests`), RLS as the authorization layer, and Postgres RPCs for privileged operations. The "tRPC experience" is dependency-declaration experience, not production experience — it must not weigh in the decision.

Other facts on the table:
- **Supabase already is a typed API.** PostgREST exposes every table as REST; `supabase gen types` gives end-to-end TypeScript types from the live schema. A tRPC router would be a *second* API surface hand-mapping the same tables — every query written twice, every schema change touched twice.
- **Tenant context propagation.** The tenancy model (`child_id = ANY (current_child_ids())` via RLS) works because the *user's JWT* rides the request. Direct supabase-js carries it for free. A tRPC layer would have to forward the JWT into each procedure context and re-assert `child_id` per call — new code on the hottest security path, i.e. new ways to leak across tenants.
- **Non-Next.js clients exist and always will.** The laptop sync workers are Python; the Pookie tutor is a Cloudflare Worker. Both speak REST/RPC natively. tRPC's HTTP batch protocol is consumable from Python, but it's hand-rolled client code against an undocumented-by-default wire format — strictly worse than PostgREST.
- **Deployment.** The app targets Cloudflare Pages. tRPC needs a server runtime (Pages Functions / SSR adapter) just to exist; the current architecture is static-export-friendly precisely because the database *is* the API server.

### Decision
**No tRPC.** The API surface is Supabase: PostgREST (via `supabase-js`) for CRUD under RLS, Postgres `SECURITY DEFINER` RPCs for privileged/multi-step operations (`rpc_claim_sync`, `consume_invite`, `get_tenant_secret`, `audit_event`, …). Remove `@trpc/*` from `package.json` — dead dependencies are a supply-chain and confusion cost.

### Consequences
- **Lose** tRPC's end-to-end procedure type inference. **Mitigate** with generated DB types (`supabase gen types` in CI, checked into the repo) and zod validation at trust boundaries where input shape matters.
- **Keep** the RLS-first discipline this decision depends on: no query without the user's JWT, no `service_role` in the browser, explicit `child_id` on every service-role path (per the plan's invariant).
- Complex multi-table writes go into RPCs, not client-side multi-call sequences — the RPC catalog becomes the "backend" and gets the same review bar as app code.
- If a future surface genuinely needs server-side orchestration that doesn't fit Postgres (e.g. multi-provider fan-out), that gets its own ADR — it does not reopen this one by drift.

---

## ADR-002: Server Actions vs Route Handlers — **DECIDED: neither as primary. Client→Supabase direct (RLS) + Supabase Edge Functions for privileged ops.**

### Context
Next.js 16 offers two in-framework server paths: Server Actions (`'use server'`) and Route Handlers (`app/api/...`). Both require a server runtime. The deployment target is Cloudflare Pages, and the standing architecture already answers where privileged logic lives:
- Reads/writes the user is authorized for → direct client→Supabase under RLS (the user's JWT is the credential; RLS is the policy engine).
- Writes the user must *not* do directly (Vault credential storage, invite consumption, sync claiming) → `SECURITY DEFINER` Postgres functions or a dedicated Supabase Edge Function (`portal-credential-write`), never app-server code holding `service_role`.
- The old production app runs as a static export (`out/` → Pages); its entire data plane works without a single Next.js server endpoint.

Adopting Server Actions would force the deployment off static export onto the Pages Functions/SSR adapter — a strictly heavier runtime for zero capability gain, since every Action would just re-implement what RLS+RPC already do, with the added risk of someone importing `service_role` into an Action (the exact key-leak the plan's §4.7 residual-risk list warns about). Route Handlers have the same deployment cost and would become a shadow API next to PostgREST — the same "written twice" problem as ADR-001.

There is one legitimate gap neither RLS nor RPCs cover well: operations needing *external* I/O with secrets (e.g. the Portals UI writing to Vault, test-connection probes against school portals). That is what Supabase Edge Functions (Deno, per-function secrets, no `service_role` in the client bundle) are for — and the plan already names `portal-credential-write` as one.

### Decision
**Primary data plane: client → Supabase directly** (RLS + RPCs), using the singleton browser client (carry forward the documented singleton lesson: one shared client per page load, or OTP auth breaks). **Privileged/external-I/O operations: Supabase Edge Functions.** No `'use server'` Server Actions. No `app/api` Route Handlers. Keep the Next.js app static-export-compatible so the Cloudflare Pages deployment stays simple.

### Consequences
- The app must be shippable with `output: 'export'` semantics: no server components fetching with secret keys, no cookies-based SSR auth. If SSR is ever genuinely needed (SEO, first-paint data), that is a deployment-architecture change requiring its own ADR — not something to drift into one Route Handler at a time.
- Auth on the client uses the anon key + RLS exclusively; the `service_role` key lives only in the Secure Vault, Edge Function secrets, and worker environments — never in the repo, never in the bundle.
- Edge Functions become a first-class backend surface: they get versioning, review, and the same tenant-context rule (resolve and assert `child_id` first; reject requests without it).
- **Standing rule carried forward:** hCaptcha loops on automated Supabase sign-in — sign-ins stay manual (Mehedi), automation uses the approved Gmail/OTP-code path.

---

## ADR-003: Drizzle vs direct supabase-js — **DECIDED: supabase-js as the single primary data-access library. No Drizzle.**

### Context
`drizzle-orm` is declared in the old app's `package.json`; like tRPC, it has **zero usages in source** (verified by repo-wide grep). So this is not "migrate off Drizzle" — it is "do not adopt Drizzle."

The deciding factor is the tenancy model, not query-builder ergonomics. RLS enforces `child_id = ANY (current_child_ids())` where the identity comes from `auth.uid()` — i.e. from the **JWT on the database connection**. `supabase-js` (PostgREST) attaches the user's JWT to every request natively; RLS just works, including for the `agent_reader` role design. Drizzle over a direct Postgres connection would need per-query `SET LOCAL request.jwt.claims` (or `SET ROLE`) to get the same enforcement — hand-rolled session plumbing on pooled connections, which the plan explicitly calls out as "easy to get subtly wrong" (§4.2, rejecting per-tenant schemas for the same reason). A second query path that *can* forget the JWT is a second query path that *will* forget the JWT, and in a minors'-education-records system that failure mode is a cross-tenant leak.

Secondary factors: supabase-js also covers Realtime subscriptions and Storage (signed URLs, `<uid>/<child-slug>/…` paths) under the same auth — Drizzle covers none of that, so adopting it wouldn't even remove supabase-js. One library, one auth story, one audit surface.

### Decision
**`supabase-js` (+ `@supabase/ssr` only if/when SSR is adopted per ADR-002) is the sole data-access library.** Remove `drizzle-orm` from `package.json`. Complex joins and multi-statement logic live in Postgres (views, RPCs) where the query planner and RLS see them — not in client-side query-builder chains.

### Consequences
- **Lose** Drizzle's relational query builder and its migration runner. **Mitigate:** migrations are plain SQL files under `supabase/migrations/` (already the convention); complex reads become views/RPCs with generated types.
- Every engineer learns one mental model: "the JWT + RLS is the backend." No alternate connection path may be introduced without an ADR.
- The generated `Database` type (from `supabase gen types`) becomes a first-class artifact: regenerate on every migration, fail CI on drift.

---

## Standing principles these ADRs rest on (not re-debatable without a new ADR)
1. **RLS is the authorization layer.** `child_access` is the single source of truth; no policy references `children.parent_user_id`.
2. **`service_role` never reaches the browser.** Every service-role path carries and asserts an explicit `child_id`.
3. **No AI prompt, worker request, or cron runs without a resolved `child_id`.**
4. **Supabase client singleton** in the browser (OTP-auth lesson from the old app).
5. **Staging first, Mehedi's explicit go-ahead for production** — unchanged.

## Sign-off
I, Technical Architect (manager of the **Technical design decisions** component), sign off on this component: the migration audit is delivered (`docs/audit-findings/technical-architect.md`, 1 CRITICAL / 4 HIGH / 12 MEDIUM / 8 LOW with fixes specified), and the three ADRs above are **decided** — **REST over tRPC, direct-client-plus-Edge-Functions over Server Actions/Route Handlers, supabase-js over Drizzle** — with written rationale grounded in verified evidence from the current production codebase. Nothing in this component is left undecided. The audit findings at CRITICAL/HIGH severity must be resolved before data flows, but the *decisions* are final.

---

## ADR-004: Deployment runtime — **DECIDED: `@cloudflare/next-on-pages` (full Next.js runtime on Cloudflare Pages). Static export is rejected for this project.**

### Context
ADR-002 decided "no `app/api` Route Handlers" and "keep the Next.js app static-export-compatible," on the premise that the app's server-side needs were zero and its backend was RLS + RPCs + Supabase Edge Functions. That premise did not survive contact with the actual build.

Facts as observed in the repo (2026-10-11):
- The build team has **already written a Next.js backend surface**: `src/app/api/trpc/[trpc]/route.ts` (tRPC handler), `src/app/api/v1/children/[childId]/route.ts`, `src/app/api/v1/tutor/chat/route.ts`, plus the full tRPC server tree (`src/server/trpc.ts`, `src/server/tenant.ts`, `src/server/errors.ts`, `src/server/routers/_app.ts`, `src/server/routers/children.ts`) and a client (`src/lib/trpc/client.tsx`).
- **Server-only env usage exists and is designed correctly**: `src/lib/supabase/admin.ts` is a service-role client with a hard `typeof window !== 'undefined'` guard that throws if it ever lands in a client bundle — the team already internalized "service_role never reaches the browser."
- Supabase **Edge Function stubs exist and stay**: `supabase/functions/verify-credential`, `supabase/functions/worker-webhook` (Deno, per-function secrets).
- DevOps built the Pages pipeline assuming static export (the proven d-dash pattern: `next build` with `output: 'export'`, deploy `out/`).

The collision: `next build` with `output: 'export'` **hard-errors on Route Handlers** — API routes cannot exist under static export, full stop. So the choice was binary:

- **Option A — rework to static:** rewrite the API surface out of Next.js entirely (Portals credential probes, tenant-scoped orchestration, tutor-chat relay) into Cloudflare Workers or Supabase Edge Functions, plus move the server-only `service_role` usage with it. Estimated cost: days of rework, and it would push the first staging deploy back by days.
- **Option B — full Next.js runtime on Pages via `@cloudflare/next-on-pages`:** Next.js builds normally (Route Handlers included), the adapter compiles the app into a Pages Functions worker, static export is not used. Estimated cost: hours — change the build command, add the `nodejs_compat` compatibility flag, adjust the `?v=`/CSP verification steps.

Supporting factors that independently push toward a runtime:
- **The Capacitor mobile decision** uses remote-URL mode: the WebView loads `https://pookie.pages.dev` and RSC streams come from Pages. Streaming RSC responses need a server runtime; static export cannot serve them.
- **The server-side tenant firewall** planned for the `/c/[childSlug]` layout (resolve child from session → assert against `child_access` before any render) needs server code at request time — there is no static-export equivalent that isn't just client-side trust.
- **pookie-tutor remains a separate Cloudflare Worker** (`pookie-tutor-v2`, CORS + `MUSE_QUEUE` KV bindings) — unchanged by this decision; the tutor-chat API route is a relay, not a reimplementation.

### Decision
**Adopt `@cloudflare/next-on-pages`. Static export is rejected for the Pookie app.** This is the deployment-architecture change ADR-002 anticipated ("that is a deployment-architecture change requiring its own ADR — not something to drift into one Route Handler at a time"): we are making it deliberately, in one ADR, rather than drifting into it one Route Handler at a time.

What changes vs ADR-002, exactly:
- **ADR-001 STANDS.** The tRPC handler must be **converted to REST API routes**, not kept. ADR-001's rationale (Supabase is already a typed API; the JWT+RLS story; non-Next.js clients) applies word-for-word to Route Handlers serving as the REST surface.
- **ADR-002 is AMENDED.** Its premise — "no `service_role` near Next.js server code" — is replaced. The new invariant: **`service_role` lives ONLY in API routes** (never in Server Components, never in client bundles — CI must grep the built output for leaks), and **every API route asserts `child_id` per the child_id rule: resolve → assert → use → audit**. Resolve the child from the server-side auth context (never from client-supplied values); assert it against `child_access`; use it on every privileged query; audit via the `audit_event` RPC.
- The primary read path is unchanged: client → Supabase direct under RLS with the singleton browser client. Route Handlers exist only for what RLS/RPCs can't do (external I/O with secrets, server-side tenant firewall, the tutor-chat relay). Supabase Edge Functions remain the home for Deno-native privileged ops (`verify-credential`, `worker-webhook`); they are not being migrated into Next.js.

### Consequences
- **Lose** the simplicity and zero-runtime-cost profile of static export. **Gain** a real server runtime without leaving Cloudflare Pages (no new hosting bill, same `pookie-staging` / `pookie` projects, same rollback story — promote the previous Pages deployment).
- **New runtime quirks to live with:** the adapter runs app code in the workerd edge runtime, not Node. Some Node APIs are unavailable; code must run under `nodejs_compat`. Any route that discovers a missing API gets rewritten or moved to an Edge Function — it does not get a polyfill hack.
- **Free-tier limit watch:** Pages Functions free tier allows 100k requests/day. At family scale (a handful of users + sync workers) this is headroom, not a constraint — but it is now a metered resource, so the deploy runbook carries it as a standing watch item (alert threshold at 50k req/day sustained).
- **Larger security surface, honestly:** there is now a place in the stack where `service_role` exists (API routes). The mitigations are the new invariants: service-role only in API routes, the `window` guard pattern from `src/lib/supabase/admin.ts` as mandatory convention, CI grep of build output for key leakage, and the resolve→assert→use→audit child_id rule on every route. This is the cost of the runtime; it does not get relaxed later by drift.

---

## Amendment log
- **ADR-004 (2026-10-11):** deployment runtime decided as `@cloudflare/next-on-pages`; static export rejected; ADR-002 amended (premise replaced with the service-role-only-in-API-routes + child_id rule invariant); ADR-001 unchanged (tRPC handler to be converted to REST routes). Directives for the build team: `docs/TEAM-DIRECTIVE-next-on-pages.md`.

<!-- END handbook-sections/04-design-decisions.md -->

<!-- BEGIN handbook-sections/05-cicd-pipeline.md -->
# 05 — CI/CD Pipeline & Delivery

- **Workstream:** Platform & Delivery
- **Component manager:** Senior Manager, Platform & Delivery / Manager, CI/CD Pipeline
- **Status:** Draft — pending cross-expert review and Director sign-off
- **Applies to:** Pookie greenfield (Next.js 16 + TypeScript + Tailwind, Supabase project `pookie`, Cloudflare Pages)

This section is the single source of truth for how code becomes a running product: pipeline topology, environment variables, versioning, header/CSP management, the Supabase project setup checklist, and the gates every deploy must pass. Standing lessons from the current production system are encoded here as requirements, not folklore.

---

## 5.1 Pipeline design

### Projects and environments

| Environment | Cloudflare Pages project | URL | Deploys from | Gate |
|---|---|---|---|---|
| Preview | `pookie-staging` (preview deployments) | `https://<branch>.pookie-staging.pages.dev` | Every PR / branch push | Automatic |
| Staging | `pookie-staging` (production deployment of that project) | `https://pookie-staging.pages.dev` | `main` branch | Automatic on merge to `main` |
| Production | `pookie` | `https://pookie.pages.dev` (custom domain only at cutover, on explicit go-ahead) | `main` branch | **Explicit go-ahead from Mehedi, every time** |

- **Staging-first is absolute** (standing rule from the current system): no production deploy without Mehedi's explicit word, even during heavy deploy traffic. Staging auto-deploys; production never does.
- Preview deploys give every PR a live URL for review. The Supabase Auth config must therefore allow the wildcard `https://*.pookie-staging.pages.dev/**` as a redirect URL (§5.6).
- The old `d-dash` / `d-dash-staging` projects and the `dawsonkamal.com` domain stay on the old stack until the cutover flip (PLAN §3.4). The Pookie pipeline never touches them.

### Branch strategy

- `main` is the only long-lived branch. Feature work happens on short-lived branches → PR → preview deploy → review → merge → staging auto-deploy → verify → production on go-ahead.
- No `develop` branch: staging *is* the integration branch (`main`'s production deployment on the staging project).
- Hotfixes follow the same path (branch → PR → staging → go-ahead → prod). There is no "fast lane" around staging — the one time you skip it is the one time it matters.

### Deploy scripts (workstream deliverable)

Following the proven pattern from the current system, deploys run through versioned scripts in `deploy/` (to be created in build phase — not app code, pipeline tooling):

```
python3 deploy/deploy-pookie-staging.py pookie-staging main   # staging (may run unattended after merge)
# ... Mehedi verifies staging ...
python3 deploy/deploy-pookie.py pookie main                   # production — ONLY on explicit go-ahead
```

Each script must: build → run the favicon RGBA check (§5.2) → rewrite `?v=` unconditionally (§5.4) → deploy → run the post-deploy verification commands (§5.4, §5.5) and **fail loudly** if any check fails. A deploy that "succeeded" without verification is not a deploy.

---

## 5.2 Build & deploy procedure

1. **Install & typecheck/lint:** `npm ci`, `npx tsc --noEmit`, `npm run lint`. Zero errors is the bar; warnings are triaged, not ignored.
2. **Build-time env injection.** The following must be present in the build environment or the build is **rejected, not warned**:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_POOKIE_TUTOR_URL` — standing lesson: a build without the tutor URL ships a silently dead AI. The build script asserts it is non-empty and looks like a `*.workers.dev` URL.
   - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEPLOY_VERSION` (§5.4)
   
   Rationale: `NEXT_PUBLIC_*` values are baked into the client bundle at build time. A missing value is a runtime outage that no deploy-time check can catch — so the build fails instead.
3. **Favicon RGBA check.** Next.js 16 + Turbopack fails the *entire build* if `src/app/favicon.ico` contains non-RGBA embedded PNGs ("Format error decoding Ico: The PNG is not in RGBA format!"). The build script verifies the ICO frames are RGBA PNG-compressed (16/32/48/64) before invoking `next build`, and copies `public/favicon.ico` over the build output's `favicon.ico` after every build, before deploy (standing rule).
4. **`?v=` rewrite** (§5.4) — unconditional, post-build.
5. **Deploy** to the target Pages project.
6. **Post-deploy verification** (§5.4 CSP/header checks) — the deploy is not done until these pass.

### Headers file

Cloudflare Pages reads `public/_headers` at deploy time (this file does not exist yet in the shell — it is created in build phase). It carries the CSP (including `connect-src`, §5.5) and any other security headers. Because it ships with the static output, a header change is a normal web deploy — no infra ticket needed.

---

## 5.3 Environment variable inventory

**Rule: if it starts with `NEXT_PUBLIC_`, it ships to every browser.** Anything secret stays server-side, in CI, or in the Secure Vault — never in the bundle, never in git.

### Client-safe (build-time, `NEXT_PUBLIC_*`)

| Variable | Lives in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pages env (staging + prod), `.env.local` (gitignored) | e.g. `https://<ref>.supabase.co`. Public by design. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pages env (staging + prod), `.env.local` | Public by design; RLS is the real protection. Rotatable in Supabase dashboard. |
| `NEXT_PUBLIC_POOKIE_TUTOR_URL` | Pages env (staging + prod) — **required at build** | `pookie-tutor-v2` Worker URL (`https://pookie-tutor-v2.<acct>.workers.dev`). Staging and prod may point at different worker deployments. Build fails if unset. |
| `NEXT_PUBLIC_APP_URL` | Pages env (staging + prod) | Canonical app URL (`https://pookie.pages.dev`, staging `https://pookie-staging.pages.dev`). Used for links, OAuth/OTP callbacks. |
| `NEXT_PUBLIC_DEPLOY_VERSION` | Set by the deploy script per deploy | The `?v=` value (§5.4). Never hand-edited. |

### Server-side only (NEVER `NEXT_PUBLIC_`, never in the client bundle)

| Variable | Lives in | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Pages env as **encrypted** variable (Functions/server routes only), Secure Vault as source of truth | Bypasses RLS — the crown jewels. Any suspected exposure = rotate immediately in the Supabase dashboard, then update Pages env + Vault. |
| `POOKIE_TUTOR_WORKER_SECRET` | Worker v2 env + Pages server env | Shared secret / JWT verification between app server and the tutor worker (exact mechanism per worker auth design). |
| `RESEND_API_KEY` | Server env only | Optional — only if OTP email rate-limits bite (PLAN §3.2 item 11). |

### CI / pipeline only (never in the app at all)

| Variable | Lives in | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | CI secret store | Needs Pages + Workers deploy scopes. Rotated per the Cloudflare runbook. |
| `CLOUDFLARE_ACCOUNT_ID` | CI secret store | |
| Mobile signing secrets | CI secret store + Secure Vault backup | §5.9 — certificates, provisioning profiles, keystore, Play service account. Never in git, never in the bundle. |

### What NEVER goes client-side (non-exhaustive)

`SUPABASE_SERVICE_ROLE_KEY` · Cloudflare API tokens · any `*_SECRET`, `*_KEY` (non-anon), `*_PASSWORD`, `*_TOKEN` · Vault-decrypted portal passwords · App Store Connect API keys · Android keystore or its passwords · Google Play service-account JSON · Resend API key. If a value can act *as* the user/server rather than *identify* the project, it does not get a `NEXT_PUBLIC_` prefix, full stop.

### Where each class lives (summary)

- **Local dev:** `.env.local` (gitignored; template in `.env.example` with empty values — the example file documents *names*, never values).
- **Cloudflare Pages:** project Settings → Environment variables, set **separately** for `pookie-staging` and `pookie`. Production values are entered by the pipeline owner; staging may use staging equivalents.
- **Source of truth for human-held secrets:** the agent Secure Vault (service_role key, Cloudflare token, keystore passwords). CI reads from the CI secret store; the Vault is the backup/restore path.
- **Git:** only `.env.example` (names, no values). A pre-commit scan rejects anything matching `service_role`, `sk-`, `BEGIN PRIVATE KEY`, `*.p12`, `*.keystore`, `*.jks`, `google-play-*.json`.

---

## 5.4 Deploy versioning (`?v=` procedure)

**Standing lesson (encoded as requirement):** bumping `?v=` via `sed` replacing the *old* version string is fragile — any asset missed in a prior bump is silently skipped and the deploy ships mismatched assets (new HTML, stale JS). 

**Procedure:**
1. The deploy script generates one version string per deploy: `v<UTC timestamp>-<short git SHA>`, e.g. `v20261011-1530-a1b2c3d`. This becomes `NEXT_PUBLIC_DEPLOY_VERSION`.
2. **Post-build, the script rewrites ALL `?v=` parameters in the built output to the new version unconditionally** — it does not search for the old value. Any `?v=` in HTML/JS/CSS asset references gets the new stamp.
3. **Post-deploy verification (mandatory, scripted):**
   ```bash
   curl -s https://<site>/ | grep -o '?v=[0-9A-Za-z._-]*' | sort -u
   ```
   **This must output exactly one version string.** Zero (rewrite missed) or more than one (mismatched assets) = failed deploy: roll back or re-deploy, do not "note it and move on." Repeat the check on 2–3 representative sub-pages (login, one dashboard route).
4. CDN: after a version bump, purge the Cloudflare cache for the changed paths if Pages' cache behavior ever serves a stale `?v=` HTML shell — the single-version check above is what catches it.

---

## 5.5 CSP `connect-src` management

**Standing lesson (encoded as requirement):** `curl` does not enforce CSP — a missing `connect-src` entry is invisible to every script-based check and only explodes in a real browser. So the procedure verifies the *served header text*, not browser behavior.

**Current `connect-src` allowlist** (in `public/_headers`):
```
connect-src 'self'
  https://<ref>.supabase.co        # REST, Auth, Realtime (wss:), Storage
  wss://<ref>.supabase.co
  https://pookie-tutor-v2.<acct>.workers.dev   # Pookie tutor worker
```
(`<ref>` and `<acct>` are filled at setup; the file documents the pattern.)

**Procedure for adding a new backend domain** (new worker, new API, analytics, etc.):
1. Add the domain to `connect-src` in `public/_headers`.
2. Deploy to **staging** first.
3. Verify the **live served header** (this is the check curl *can* do):
   ```bash
   curl -sI https://pookie-staging.pages.dev/ | grep -i 'content-security-policy'
   # and confirm the new domain appears in connect-src
   ```
4. Exercise the feature in a real browser session on staging (login → the flow that calls the new domain) and confirm no CSP violations in the console.
5. Only then promote to production on go-ahead, and re-run the live-header check on prod.

**Related:** the worker's own CORS config (`PROD_ORIGIN` on `pookie-tutor-v2`) and the KV namespace binding (`MUSE_QUEUE`, keys prefixed `tenant:<child_id>:`) are worker-side settings — they ship with worker deploys, not the web pipeline, but a web feature that calls a new worker endpoint needs *both* the worker CORS entry and the web `connect-src` entry. The deploy checklist (§5.7) asks for both.

---

## 5.6 Supabase project setup checklist ("setup the project")

When Mehedi grants access, "set up the project" means the following, in order. (Project: **`pookie`**, **Free tier** — founder decision. Region: nearest to the user, US East.)

**Project creation**
- [ ] Create project `pookie` (Free tier). Record the project ref, URL, anon key, service_role key → Secure Vault immediately.
- [ ] Note Free-tier limits in the runbook (500 MB DB, 1 GB storage, 50K MAU, weekly backups) and the standing recommendation: Supabase Pro ($25/mo, daily backups + 7-day PITR) is the honest upgrade path under zero-risk tolerance — needs Mehedi's explicit approval, verify current pricing at supabase.com/pricing first.

**Schema**
- [ ] Apply migrations 001–005 **in numeric order** — only after the audit remediation lands (audit-findings/devops.md F-001 at minimum: the `DROP POLICY IF EXISTS` pattern, or no rehearsal run will succeed twice).
- [ ] Verify extension: `SELECT * FROM pg_extension WHERE extname = 'supabase_vault';` — and record the owner assumption (definer functions must be owned by `postgres`; see audit F-008).
- [ ] Run the database linter; zero "RLS Disabled in Public" findings (audit F-002's `agent_tenant_scope` must be covered).

**Auth config**
- [ ] Email OTP sign-in **enabled** (magic-link/OTP is the chosen login — no Google OAuth unless Mehedi asks).
- [ ] **Signups OFF** (public signups disabled; family-email allowlist enforced via `invites` + RLS, mirroring the current system's lockdown).
- [ ] Site URL: `https://pookie.pages.dev`.
- [ ] Redirect URLs allowlist: `https://pookie.pages.dev/**`, `https://*.pookie-staging.pages.dev/**` (wildcard covers PR previews), `http://localhost:3000/**` (dev only — remove or keep per team policy; never in prod).
- [ ] Email templates reviewed (OTP email branding/sender); SMTP default is fine unless rate-limits bite → Resend (PLAN §3.2 item 11).

**Storage**
- [ ] Buckets per the data design (e.g. `class-files` private, path `<uid>/<class>/<yyyy-mm-dd>/<file>`, RLS uid-prefixed) — created with RLS policies, verified with an anon-denied spot check.

**Keys & handoff**
- [ ] Anon key → Pages env vars (staging + prod). Service_role key → Pages **encrypted** env + Secure Vault. Neither in git, ever.
- [ ] Document the key-rotation procedure in the runbook (dashboard → Vault → Pages env → redeploy).

---

## 5.7 Pre-deploy security checklist

Run on **every** production deploy (scripted where possible; human-confirmed where not):

- [ ] Secrets scan: `rg -i 'service_role|supabase.*service|BEGIN PRIVATE KEY|\.p12|keystore|sk-' src/ public/ --glob '!.env.example'` returns nothing unexpected; no `.env.local` in the tree.
- [ ] RLS enabled on all `public` tables (linter clean); spot-check: anon GET on a tenant table → 0 rows / 401.
- [ ] Signups still OFF (Auth settings); redirect-URL allowlist unchanged and tight.
- [ ] `?v=` single-version check passes on `/` + 2 sub-pages (§5.4).
- [ ] Live CSP header contains the current `connect-src` allowlist (§5.5); no `unsafe-inline`/`unsafe-eval` additions since last review.
- [ ] Worker CORS `PROD_ORIGIN` matches the prod origin (after cutover: the custom domain).
- [ ] Favicon ICO is RGBA (build script asserts; §5.2).
- [ ] Staging smoke passed on this exact commit: OTP login, child switcher/tenant resolution, SYNC NOW → worker claim → completion, tutor chat round-trip, file upload lands at `<uid>/…`, RLS spot-checks (anon denied on private tables; child-role alias sees only own data — the D1 gating test).
- [ ] No new `NEXT_PUBLIC_*` variables since last review — or the new ones are in the inventory table (§5.3) with a documented reason.
- [ ] Backup/export: pre-cutover deploys confirm the latest DB export exists (Free tier = weekly automated backups; export critical tables before any migration or cutover step).

---

## 5.8 Rollback & incidents

- **Web (Cloudflare Pages):** every production deployment is retained — rollback is "promote the previous production deployment" in the Pages dashboard (or re-run the prod deploy script pinned to the previous SHA). Target: < 10 minutes. DNS is not involved (pages.dev), so there is no TTL wait.
- **At/after custom-domain cutover:** rollback = flip the CNAME back (TTL kept at 300s during the cutover window per PLAN §3.4) *plus* promote the previous Pages deployment. Both steps, verified with `dig` + the `?v=` check.
- **Database:** migrations are forward-only. A bad migration is fixed by a new migration, never by editing history — except before first staging rehearsal, where the audit remediation (F-001 etc.) lands as corrected files. After data exists: restore from backup/export, then replay.
- **Incident rule:** the deployer owns the debrief — what shipped, what the verification showed, what the rollback point was. "It looked fine" is not a verification result; paste the command output.

---

## 5.9 Mobile build & release

*Founder directive: Pookie ships as native mobile apps on the Apple App Store and Google Play — not web-only. The UI full-stack expert owns the A/B/C recommendation (Capacitor vs React Native/Expo vs PWA) and the native-shell implementation. This subsection covers the pipeline the workstream will operate **whichever** option is chosen; option-specific wiring is marked [CONDITIONAL] and must be finalized against that recommendation before the first mobile build.*

### 5.9.1 Build & signing pipeline (both stores)

**Apple — Developer Program & signing**
- Enrollment in the **Apple Developer Program** (paid membership, Apple-billed) is a Mehedi action — the workstream cannot enroll on his behalf. Until enrollment completes, iOS builds are limited to local/debug; no TestFlight, no App Store.
- Bundle ID (e.g. `com.pookie.app` — exact value confirmed by Mehedi at registration) is chosen once and **never changed**; it must match across the Apple developer account, the app config, and (for push, later) any service credentials.
- Certificates (Apple Distribution) + provisioning profiles are generated via App Store Connect API and **stored in CI secrets only — never in git, never in the repo**. Rotation: revoke + regenerate in the developer account, update CI secrets, rebuild. If the team adopts Expo, EAS credentials service may hold them instead ([CONDITIONAL] — same rule: never in git).
- Versioning: `CFBundleShortVersionString` = the shared semver (§5.9.3); `CFBundleVersion` (build number) = the shared monotonic build number. Both are stamped by CI at build time, never hand-edited in Xcode.

**Android — keystore & Play Console**
- One **upload keystore**, generated once (`keytool -genkeypair`), for the life of the app. The keystore file (base64) + store password + key alias + key password live in **CI secrets**, with an **offline backup in the Secure Vault**. Losing the keystore (and the passwords) means the app can never be updated again — a new Play listing would be required. This is the single highest-stakes secret in the mobile pipeline; its backup is verified, not assumed.
- Play Console: create the app, enroll in **Play App Signing** (Google holds the final signing key; we upload with our upload key), complete the data-safety + content-rating questionnaires before the first internal-testing release.
- `versionName` = shared semver, `versionCode` = shared monotonic build number (§5.9.3), stamped by CI.

**Version/code numbering across iOS + Android + web**
- Single source of truth: `version` (semver, e.g. `1.4.0`) in the app config / `package.json`, and a monotonic `buildNumber` (e.g. `2026101107` — UTC date + daily counter, or the CI run number). CI derives all three platform stamps from these two values:
  - Web: `NEXT_PUBLIC_DEPLOY_VERSION` = `v<semver>+<buildNumber>` (feeds the `?v=` procedure, §5.4).
  - iOS: `CFBundleShortVersionString` = semver, `CFBundleVersion` = buildNumber.
  - Android: `versionName` = semver, `versionCode` = buildNumber (must be an integer and strictly increasing — the date-counter scheme satisfies this).
- A release is named by the pair (`1.4.0 / 2026101107`); the release notes, the store listings, and the web `?v=` check all reference it. No platform ever invents its own number.

### 5.9.2 CI shape

- **Runners:** iOS builds **require macOS runners** (Xcode toolchain) — GitHub Actions `macos-latest` (or a self-hosted Mac if build minutes become a concern). Android builds run on standard `ubuntu-latest` runners (Gradle). Web builds stay on the Cloudflare Pages pipeline (§5.1), not Actions.
- **Workflows** (to be created in build phase, owned by this workstream):
  - `mobile-ios.yml` — on demand + on release tags: checkout → stamp versions → build signed IPA → upload to TestFlight (App Store Connect API key from CI secrets).
  - `mobile-android.yml` — on demand + on release tags: checkout → stamp versions → build signed AAB → upload to the Play **internal testing** track (service-account JSON from CI secrets).
  - Pull requests do **not** build store binaries; they get web previews (§5.1). Native binaries are built from release branches/tags only, so every binary maps to a reviewed commit.
- **How the Next.js web build feeds the native shell** [CONDITIONAL on the A/B/C recommendation]:
  - *If Capacitor:* `next build` (static export) → `npx cap sync` copies the web output into the native `ios/` + `android/` shells → CI builds the signed binaries from those shells. The web bundle inside the binary is a **pinned snapshot** — it is exactly the staging-verified commit, never "latest main."
  - *If React Native / Expo:* the native app is its own codebase sharing the Supabase backend, design tokens, and (where practical) TypeScript types via a monorepo package. The web pipeline and the native pipeline are independent builds against the same API contract; contract changes are versioned.
  - *If PWA:* there are no native binaries — which does **not** satisfy the founder's App Store / Play directive, so this option would need a wrapper decision recorded explicitly.
- **Pre-release tracks:** iOS → **TestFlight** (internal testers: Mehedi + workstream; external testers only when Mehedi approves). Android → Play **internal testing** track first, then closed track, then production. A build reaches a store track only after the staging web smoke (§5.7) passes on the pinned commit.

### 5.9.3 Release-train relationship (web vs mobile)

- **Web ships independently.** Cloudflare Pages deploys (staging auto, prod on go-ahead) run on their own cadence — daily if needed. A web deploy never requires a mobile release.
- **Mobile releases bundle a pinned web snapshot** ([CONDITIONAL]: Capacitor) **or target a pinned API contract** ([CONDITIONAL]: RN/Expo). Either way, the mobile release notes record the web commit / contract version it was built against.
- **The reverse dependency is the one that bites:** a web change that alters something the native shell depends on — deep-link routes, native plugin APIs, auth callback URLs, push-notification payloads — **must not ship to web prod until the mobile build that understands it is released** (or the web change is backward-compatible). The pre-deploy checklist (§5.7) gains a mobile-impact question: *"does this change anything the native shell consumes?"*
- **OTA / live-update policy and Apple's boundary:** over-the-air updates to web content are acceptable to Apple **only** within the reviewed feature set — bug fixes, content, copy, styling. They must not download native/executable code, add major features to evade review, or change the app's purpose (App Store Review Guidelines §2.5.2 and the "minimum functionality" / "code download" rules). Workstream policy: OTA (e.g. Capacitor live-update channel, [CONDITIONAL] on stack choice) is the **hotfix lane for web-content bugs only**; any new capability, new native plugin, or permission change goes through full store review. When in doubt, ship it through the store.
- **Recommended cadence:** web — continuous (staging auto; prod on go-ahead, same-day for fixes). Mobile — a **release train every 2 weeks** (cut from the latest staging-verified `main`; TestFlight + Play internal → staged rollout), plus the OTA hotfix lane for web-content emergencies. The train schedule is published; anything missing the cut waits for the next train — no ad-hoc store submissions under time pressure.

### 5.9.4 Mobile pipeline secrets & env vars (added to the §5.3 inventory)

| Variable | Scope | Lives in | Notes |
|---|---|---|---|
| `IOS_BUNDLE_ID` / `ANDROID_APPLICATION_ID` | Config (not secret) | App config, CI env | e.g. `com.pookie.app`. Set once at registration; changing it later = new app. Mehedi confirms the exact value. |
| `APPLE_TEAM_ID` | Config | CI env | Apple Developer Team ID. |
| `APP_STORE_CONNECT_API_KEY_ID` + `APP_STORE_CONNECT_ISSUER_ID` + `APP_STORE_CONNECT_P8` | **CI secret** | CI secret store | API key for TestFlight upload + notarization-adjacent calls. The `.p8` never touches disk outside the runner. |
| `IOS_DISTRIBUTION_P12_B64` + `IOS_DISTRIBUTION_P12_PASSWORD` | **CI secret** | CI secret store | Distribution certificate, base64-encoded. Never in git. |
| `IOS_PROVISIONING_PROFILE_B64` | **CI secret** | CI secret store | Per release type (development / app-store). Regenerated on cert rotation. |
| `ANDROID_KEYSTORE_B64` | **CI secret + Secure Vault backup** | CI secret store; Vault holds the offline backup | The upload keystore. Loss = permanent loss of update ability (§5.9.1). |
| `ANDROID_KEYSTORE_PASSWORD` + `ANDROID_KEY_ALIAS` + `ANDROID_KEY_PASSWORD` | **CI secret + Secure Vault backup** | CI secret store; Vault backup | Without these, the keystore file is useless — back up together, restore together. |
| `PLAY_SERVICE_ACCOUNT_JSON` | **CI secret** | CI secret store | Google Cloud service account with Play Console release-manager role; used for AAB upload + track promotion. |
| `EXPO_TOKEN` | **CI secret** | CI secret store | [CONDITIONAL] — only if the Expo/EAS path is chosen. |
| `APPLE_ID_EMAIL` | Config | CI env | Apple ID used for notarization stapling, if needed. Not a secret by itself; the API key above does the auth. |

**Storage rules (mobile):** CI secret store is the runtime source (GitHub Actions secrets, or EAS secrets [CONDITIONAL]); the **Secure Vault is the human-held backup** for the irreplaceable items (keystore + passwords, `.p8`). Nothing in this table goes in git, in the client bundle, or behind a `NEXT_PUBLIC_` prefix. Keystore backup restoration is **tested once** after creation (decrypt → verify fingerprint matches the Play Console upload certificate) — an untested backup is not a backup.

---

## 5.10 Ownership & pending deliverables

- **Owns this section:** Senior Manager, Platform & Delivery / Manager, CI/CD Pipeline. Changes to pipeline topology, the env inventory, or any checklist require this workstream's review.
- **Pending (build phase, this workstream):** `deploy/` scripts (`deploy-pookie-staging.py`, `deploy-pookie.py`) with embedded verification; `public/_headers` with the §5.5 CSP; `.env.example`; pre-commit secret scan; GitHub Actions workflows for mobile (§5.9.2) once the A/B/C recommendation lands; the Supabase setup runbook entries (key rotation, Vault owner assumption per audit F-008).
- **Inputs needed from others:** the UI full-stack expert's A/B/C recommendation (unlocks §5.9 [CONDITIONAL] items); Mehedi's Apple Developer Program enrollment, bundle-ID confirmation, and Supabase project access grant.
- **Review status:** draft — awaiting cross-expert review; Director sign-off recorded in the handbook sign-off table on assembly.

<!-- END handbook-sections/05-cicd-pipeline.md -->

<!-- BEGIN handbook-sections/06-rls-and-data.md -->
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

<!-- END handbook-sections/06-rls-and-data.md -->

<!-- BEGIN handbook-sections/07-integration-patterns.md -->
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

<!-- END handbook-sections/07-integration-patterns.md -->

<!-- BEGIN handbook-sections/08-nextjs-standards.md -->
# 08 — Next.js 16 App Router Implementation Standards

**Owner:** UI Full-Stack (Engineering Pod) — spec → review → fix → sign-off.
**Applies to:** `~/workspace/pookie-app` (Next.js 16.4, React 19.3, Tailwind v4, `--src-dir`).
**Normative language:** MUST / MUST NOT = blocking; SHOULD = strong default, deviate only with a
written reason in the PR.

Companion findings: `docs/audit-findings/ui-fullstack.md` (migration 001 review),
`docs/audit-findings/ui-fullstack-mobile.md` (mobile scaffold audit).

---

## 8.0 Purpose and non-goals

This section defines how the Pookie web app is built: routing, tenancy enforcement in the App
Router, the Supabase client pattern, component boundaries, mutations, caching, styling, and
deployment. It does **not** define the data model (schema pod), the visual design system (design
pod), or backend worker contracts (workers pod) — it defines how the frontend *uses* them.

Standing context this section encodes:

- Multi-tenant SaaS, email-keyed tenancy; `child_access` is the single source of truth; RLS on all
  tenant tables; `service_role` bypasses RLS (PLAN §3.7, §4.1–§4.2).
- Slug-routed child context from day one: `/c/[childSlug]/...`. Login: OTP → resolve tenants →
  switcher or straight in.
- **Production lesson (binding):** the Supabase client MUST be a singleton. Creating a new client
  per `createClient()` call breaks OTP auth — login "goes nowhere" after the code is accepted.
- Zero-risk tolerance. Staging first; production only on the founder's explicit go-ahead.

---

## 8.1 The Supabase client pattern — singleton in the browser, per-request on the server

### Why the singleton matters (the production lesson, stated precisely)

Supabase browser auth state lives in the client instance's storage adapter and its internal
`auth` event emitter. If module A calls `createClient()` and module B calls `createClient()`
again, the OTP/magic-link verification lands in A's session while the auth gate subscribes to
B — the user is authenticated in one instance and anonymous in the other. Symptom: code accepted,
login "goes nowhere", no errors. **This is not a style preference; it is a correctness rule.**

### The rule, split by environment

| Environment | Rule |
|---|---|
| **Browser** | Exactly **one** client instance for the app lifetime, exported from a single module (`src/lib/supabase/client.ts`). Every Client Component imports it from there. No component, hook, or util may call `createClient()` directly. |
| **Server (RSC, Server Actions, Route Handlers)** | Exactly **one client per request**, built from that request's cookies (`src/lib/supabase/server.ts`). Wrap creation in React `cache()` so all code in one request shares the instance. Never create one client per query. Never hoist a server client to module scope (cookies would leak across requests). |

```ts
// src/lib/supabase/client.ts — BROWSER singleton
"use client"; // not needed; this module is imported by client code only
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
```

```ts
// src/lib/supabase/server.ts — per-REQUEST client (RLS-enforcing)
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const getSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a Server Component: read-only context, ignore */
          }
        },
      },
    },
  );
});
```

Additional MUSTs:

- The **anon key** is the only key the browser and request-scoped server clients may hold. It is
  public by design; RLS is the enforcement layer.
- `service_role` key: **server-only** (`import "server-only"`), read from a non-`NEXT_PUBLIC_`
  env var, used only in explicitly marked modules (e.g. `src/lib/supabase/admin.ts`). Every
  `service_role` code path MUST assert `child_id` explicitly — RLS does not apply, so the
  explicit-child_id invariant (PLAN §4.2) is the only guard. Grep-able marker comment required:
  `// SERVICE_ROLE: asserts child_id explicitly — see §8.6`.
- Never put any key in a Client Component bundle except `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 8.2 Route architecture — slug-routed tenancy from day one

```
/                          marketing / landing (public; includes login entry)
/login                     OTP request + code entry (public)
/auth/callback             OTP/magic-link exchange (route handler)
/start                     post-login tenant resolution (private)
/c/[childSlug]/...         tenant shell — EVERYTHING tenant-scoped lives here
/c/[childSlug]/dashboard
/c/[childSlug]/academics
/c/[childSlug]/learn
/c/[childSlug]/plan
/c/[childSlug]/pookie
/c/[childSlug]/track
/c/[childSlug]/grow
/c/[childSlug]/settings
```

Rules:

- No tenant data is ever rendered outside `/c/[childSlug]`. The `/start` page renders only the
  switcher (or redirects); it fetches `child_access` rows + child display fields, nothing deeper.
- `childSlug` is the **display key only**. The authoritative tenant identifier inside the app is
  always `child_id` (uuid), resolved server-side per request (§8.4). Client code never invents,
  caches across sessions, or transmits `child_id` as authority — the server re-resolves it.
- Slugs are lowercase `^[a-z0-9-]{3,64}$` (audit MEDIUM-2). Writes validate; reads lowercase the
  URL segment before lookup.

---

## 8.3 Proxy — not middleware

Next.js 16 **deprecated `middleware.ts` and renamed it to `proxy.ts`** (per the bundled Next 16
API reference). This codebase MUST use `src/proxy.ts` (same level as `src/app`). Do not create
`middleware.ts` — it will rot under a deprecated convention.

Proxy's job is deliberately **small and cheap** (it runs at the edge, before render, with no DB
access by design):

1. If the request targets `/c/*`, `/start`, or other private routes and **no Supabase session
   cookie is present** → redirect to `/login?next=<path>`.
2. If the request targets `/login` or `/` and a session cookie **is** present → redirect to
   `/start` (tenant resolution decides the rest).
3. Nothing else. **Proxy MUST NOT resolve slugs to tenants, read `child_access`, or branch on
   user roles.** Those need the database; the `[childSlug]` layout owns them (§8.4). Proxy also
   must not import the server Supabase client or any DB helper — keep it dependency-light so it
   stays deployable at the CDN edge.

```ts
// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE_PREFIXES = ["/c/", "/start"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  const isPrivate = PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );

  if (isPrivate && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/") && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/start";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

Session-*presence* is a routing hint, not authentication: every protected read still goes through
the RLS-enforcing server client. A forged cookie buys nothing — RLS rejects it.

---

## 8.4 The `[childSlug]` layout — resolve, validate, reject spoofed slugs

This layout is the **tenant firewall**. Every page under `/c/[childSlug]` inherits its verdict.
It runs on **every request** (it reads cookies ⇒ dynamic; it MUST NOT be prerendered — see §8.8).

Resolution algorithm (server-side, in order):

1. `const { childSlug } = await params;` — **params is a Promise in Next 16; you MUST await it.**
   (In layouts, avoid awaiting at the very top level if it blocks the static shell — pass the
   promise down; here the whole layout is dynamic anyway, so awaiting is correct.)
2. Normalize: `slug = childSlug.toLowerCase()`; reject (→ `notFound()`) if it fails
   `^[a-z0-9-]{3,64}$`.
3. `const supabase = await getSupabaseServerClient();` then
   `const { data: user } = await supabase.auth.getUser();` — unauthenticated → `redirect("/login")`.
   (Use `getUser()`, not `getSession()` — `getUser()` revalidates the JWT with the Auth server;
   `getSession()` trusts the cookie.)
4. Resolve the tenant **through RLS**:
   ```ts
   const { data: child } = await supabase
     .from("children")
     .select("id, slug, first_name, nickname, status")
     .eq("slug", slug)
     .eq("status", "active")          // audit MEDIUM-3: archived slugs must not resolve
     .maybeSingle();
   if (!child) notFound();            // spoofed, foreign, or archived slug → 404, never a redirect guess
   ```
   Because `children_tenant_read` requires `id = ANY (current_child_ids())`, a slug belonging to
   another tenant returns **zero rows** — the spoof is rejected by the database, not by app logic.
5. Load the caller's `child_access` rows; branch the shell (audit MEDIUM-1 — **never branch on
   `users.role`**):
   - 0 rows → render the pending-invite/onboarding state (no tenant chrome, no tenant data).
   - role `'child'` → the resolved `child.id` MUST equal their single access row's `child_id`;
     otherwise `redirect()` to their canonical slug (prevents URL confusion, not a security
     boundary — RLS is the boundary).
   - role `'parent'` → render parent shell for this child.
6. Provide the verified context to the subtree via a server-side context module — **not** via
   client props that a component could tamper with:
   ```ts
   // resolved in the layout, consumed by Server Components below it
   <ChildProvider value={{ childId: child.id, slug: child.slug, role }}>
     {children}
   </ChildProvider>
   ```
   `ChildProvider` here is a Server Component context (or simply prop-drilling through server
   components). Client Components receive `childId` only as a **display/reference value**; any
   mutation re-resolves it server-side (§8.6).

What the layout MUST NOT do:

- MUST NOT call `generateStaticParams` with real slugs (would prerender one tenant's shell into
  a shared cache — cross-tenant leak vector). With `cacheComponents`, dynamic params stay dynamic.
- MUST NOT cache the membership verdict across requests (§8.8).
- MUST NOT trust `users.role` for anything rendering-related.

---

## 8.5 Server vs Client component rules

Default: **Server Component**. Reach for `"use client"` only when you need interactivity, browser
APIs, or client-side state. Concretely:

**Server Components do:** all data reads (via the §8.1 request client ⇒ RLS applies), tenant
resolution, metadata, and composition. They are the only place tenant queries happen.

**Client Components do:** event handlers, form state, animations, charts, editors, and anything
touching `window`/`navigator`/WebView bridges. They receive **already-authorized, minimal data**
as props — never raw query builders, never the server client.

Boundary rules (enforced in review):

1. `import "server-only"` at the top of every data-access module. If a Client Component
   transitively imports it, the build fails — that is the guardrail working.
2. Client Components never import `src/lib/supabase/server.ts`. They use the browser singleton
   (§8.1) only for auth-state subscriptions and realtime; **all tenant reads/writes go through
   Server Components or Server Actions**.
3. Props crossing the boundary must be serializable and **minimal** — pass the rows the UI needs,
   not the query. (Next.js data-security guidance: keep data access on the server.)
4. Hooks (`useState`, `useEffect`, …) always **above all early returns** — React #310. No
   exceptions; this is a review-blocking rule.
5. `next/root-params` (root-level dynamic params) does **not** apply here — `[childSlug]` is not
   a root segment — and it cannot be used in Server Actions or Route Handlers. Pass `childSlug`
   explicitly as a function argument where needed.

---

## 8.6 Server Action conventions — assert `child_id` server-side, never trust the client

Every Server Action that touches tenant data follows this exact shape:

```ts
"use server";
import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveChildContext } from "@/lib/tenant"; // slug → { childId, role } or throws

const Input = z.object({
  childSlug: z.string().regex(/^[a-z0-9-]{3,64}$/),
  // ...action-specific fields, validated
});

export async function updateStudyPlan(rawInput: unknown) {
  const input = Input.parse(rawInput);              // 1. validate shape
  const supabase = await getSupabaseServerClient();
  const { childId, role } = await resolveChildContext(supabase, input.childSlug);
  // 2. childId came from the ROUTE SLUG re-resolved against child_access — never from client state
  if (role !== "parent") throw new Error("forbidden"); // 3. authorize the operation
  const { error } = await supabase
    .from("study_plans")
    .update({ ... })
    .eq("child_id", childId)                         // 4. scope the write explicitly (defense in depth; RLS also applies)
    .eq("id", input.planId);
  if (error) throw error;
  // 5. audit consequential writes
  await supabase.rpc("audit_event", { p_child_id: childId, p_action: "study_plan.updated", ... });
  revalidatePath(`/c/${input.childSlug}/plan`);       // 6. revalidate the tenant-scoped path only
  return { ok: true };
}
```

Rules:

1. **Never accept `child_id` from the client.** Accept `childSlug` (from the route, which the
   layout already validated) and re-resolve it against `child_access` inside the action. A
   mismatched or spoofed slug fails closed at step 2.
2. **RLS is the floor, explicit scoping is the wall.** Always include `.eq("child_id", childId)`
   on writes even though RLS would reject cross-tenant writes — belt and suspenders, and it
   makes tenant scoping grep-able.
3. **Authorize the operation**, not just the tenant: check `role` from `child_access`
   (parent-only vs child-allowed) per action.
4. **Validate all input** with zod at the action boundary. Reject unknown fields (`.strict()`).
5. **Audit consequential mutations** via the `audit_event` RPC (migration 004) — grades-affecting
   writes, consent changes, credential rotations, invites, messages sent.
6. **Revalidate narrowly**: `revalidatePath`/`revalidateTag` scoped to the tenant path. Never
   `revalidatePath("/", "layout")`.
7. Actions return small serializable results `{ ok, ... }` — never full rows the client didn't
   already have access to.
8. `service_role` actions (rare: e.g. worker-adjacent admin jobs) MUST carry the
   `// SERVICE_ROLE` marker and assert `child_id` explicitly before any query (PLAN §4.2).
   Prefer RLS paths; service_role is the exception, not the tool.

---

## 8.7 Auth flow — OTP → resolve → switcher → tenant

1. `/login` — user enters email → `supabase.auth.signInWithOtp({ email })`. Rate-limit the button
   client-side; surface "check your email".
2. `/auth/callback` (Route Handler) — exchanges the `code` for a session, sets cookies, then
   redirects to `/start`. It MUST use the per-request server client (§8.1) so cookies land on the
   response. Edge-safe (fetch-based; no Node APIs).
3. `/start` — the tenant resolver (Server Component):
   - `getUser()` → unauthenticated ⇒ `/login`.
   - `SELECT child_id, role FROM child_access WHERE user_id = auth.uid()`:
     - **0 rows** → check for a pending invite for this email → if found, call `consume_invite`
       and re-query; else render the pending-invite state (PLAN §4.1). Never render tenant UI.
     - **1 row, role='child'** → `redirect(/c/<slug>)`. No switcher, ever.
     - **1 row, role='parent'** → `redirect(/c/<slug>)`.
     - **N rows, role='parent'** → render the switcher (cards: name, photo, school). The chosen
       card links to `/c/<slug>` — the layout re-validates on arrival.
4. `/c/[childSlug]/...` — layout firewall (§8.4) takes over.

Notes:

- The hCaptcha lesson from the legacy stack stands: **automated sign-in flows loop on hCaptcha —
  the user signs in manually**; the app never attempts programmatic OTP completion.
- Public signups stay OFF (Supabase Auth config); the invite allowlist is the only door.
- `active_child_id` as a UI hint may live in localStorage, but it is **never authoritative** —
  the server re-resolves from the slug on every request.

---

## 8.8 Caching rules under `cacheComponents: true`

`next.config.ts` sets `cacheComponents: true` (and `partialPrefetching`). Consequences the team
must internalize:

1. **Routes prerender by default.** Any component that reads the session/cookies (tenant layout,
   `/start`, all of `/c/*`) opts into dynamic rendering automatically — do not fight this, and
   do not try to force-static tenant routes.
2. **Session reads stream behind `<Suspense>`.** Per the Next 16 auth-with-cache-components
   guidance: the static shell (branding, skeleton) prerenders; the authenticated/tenant UI streams
   in. Design every tenant page as shell + Suspense holes.
3. **`'use cache'` may not read the session.** A cached function cannot call `cookies()` and
   cannot receive a session-derived value smuggled in as an argument. Therefore: **tenant data
   fetches are never `'use cache'`-cached by tenant implicitly** — if you cache derived data,
   the cache key must include the resolved `childId` explicitly AND the lifetime must be short,
   AND revocation-sensitive data (membership, consents) must stay uncached/dynamic.
4. **Membership is resolved per request, never cached across requests** (audit MEDIUM-4). A
   revoked parent must lose access on the next navigation, not after a cache TTL.
5. **`'use cache: private'`** (browser-only cache) is acceptable for non-authoritative UI hints
   (display name, avatar) — never for authorization decisions.
6. Prefetching (`<Link prefetch>`) of `/c/[slug]` pages is safe: prefetches execute with the
   requester's cookies and RLS still applies per request.

---

## 8.9 React 19 patterns in use

- **No `forwardRef`.** Ref is a normal prop in React 19: `function Input({ ref, ...props })`.
- **`use()` for promises** in Client Components (e.g. unwrapping a passed promise) instead of
  manual `useEffect`+state.
- **Forms:** `useActionState` + `useFormStatus` for Server-Action-backed forms (pending states,
  optimistic UI via `useOptimistic` where warranted). No ad-hoc `fetch` to hand-rolled endpoints
  when a Server Action will do.
- **Server functions as props:** a Client Component may receive a Server Action as a prop and call
  it — this is the standard interactive-mutation path (progressive enhancement preserved).
- **Error boundaries per section:** every major tenant section gets its own `error.tsx` so one
  failing widget (grades, sync console) doesn't take down the dashboard. Pair with per-section
  `loading.tsx` skeletons that match the Suspense design (§8.8).
- **No `useMemo`/`useCallback` cargo-culting.** React Compiler territory aside, memoize only with
  measured cause.

---

## 8.10 Tailwind v4 conventions

Tailwind v4 is CSS-first: theme tokens live in `globals.css` under `@theme`, not in a JS config.

```css
@import "tailwindcss";

@theme {
  /* semantic tokens — components never use raw hex */
  --color-ink-900: #0b3b3e;      /* deep teal (dark surfaces) */
  --color-paper: #eef7f8;        /* light surface */
  --color-paper-dim: #d7e9eb;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --spacing-safe-top: env(safe-area-inset-top);
  --spacing-safe-bottom: env(safe-area-inset-bottom);
}
```

Rules:

- **Semantic tokens only in components.** No arbitrary hex (`bg-[#383838]`) outside the theme
  definition. The legacy clean-teal palette carries over as named tokens.
- **Dark mode:** class-based (`dark:` variant) with a single source of truth for the theme toggle;
  do not rely on `prefers-color-scheme` alone (the scaffold's media-query approach is replaced).
- **Contrast:** no light-on-white / low-contrast pairs — a review gate, especially for the
  grade-gap "mission framing" headers.
- **Motion:** `motion-safe:` / `motion-reduce:` variants; respect `prefers-reduced-motion`.
- **Mobile:** `dvh` units, safe-area tokens, `active:` states paired with every `hover:`
  (audit `ui-fullstack-mobile.md`).

---

## 8.11 Cloudflare Pages deployment constraints — edge vs node runtime

The app deploys to Cloudflare Pages (`pookie.pages.dev`, staging `pookie-staging`). Next.js on
Pages runs on **Workers (V8 isolates)** — there is no Node.js server. This constrains the code:

1. **Default to edge-safe code everywhere.** Use Web APIs (`fetch`, `Request`/`Response`,
   `crypto.subtle`, `TextEncoder`) — never Node builtins (`fs`, `path`, `crypto` node module,
   `child_process`) in app code. If a dependency pulls Node builtins, it cannot ship in a route
   that runs on Pages.
2. **Declare runtime explicitly** on any route that needs it:
   `export const runtime = "edge";` — the default for new routes SHOULD be edge. `runtime =
   "nodejs"` is only meaningful with the `nodejs_compat` flag and SHOULD be avoided; if ever
   needed, it requires a written justification and DevOps sign-off.
3. **Supabase clients are edge-safe** (`@supabase/ssr` is fetch-based) — no constraint there.
4. **`next/image` optimization** on Pages is served by the platform adapter — verify remote image
   domains in `next.config.ts` `images.remotePatterns`; no custom loader hacks.
5. **No long-running work in routes/actions.** Syncs, ETL, and tutor inference belong to workers
   and laptop cron jobs, not to the request path. Route handlers have CPU/wall-clock limits —
   keep them to auth exchange, webhooks, and thin proxies.
6. **Env vars:** `NEXT_PUBLIC_*` are inlined at build time per environment (staging vs prod get
   separate builds). Secrets (`SUPABASE_SERVICE_ROLE_KEY`, worker tokens) are Pages environment
   variables / secrets — never `NEXT_PUBLIC_`, never in the repo.
7. **CSP:** new backend domains (worker hosts, Supabase URL) go into `connect-src` in the
   platform headers config and the live header is verified post-deploy (legacy lesson, still
   binding).
8. **Deploy hygiene (binding legacy lessons):** staging first, founder verifies, production only
   on explicit go-ahead; `?v=` asset bumps rewritten unconditionally with a single-version
   post-deploy check; favicon ICO rebuilt as RGBA and copied over `out/favicon.ico` after build.

---

## 8.12 Error, loading, and not-found conventions

- `not-found.tsx` at `/c/[childSlug]` level: "We couldn't find this child space." — identical
  copy for nonexistent, foreign, and archived slugs (never distinguish; distinguishing leaks
  tenant existence).
- `forbidden.tsx` (Next 16 convention): operation not permitted for this role.
- `error.tsx` per section (§8.9) with a retry affordance and an error report hook (audit-logged
  client error, no PII in the message).
- `loading.tsx` skeletons mirror the final layout to avoid CLS.

---

## 8.13 Mobile strategy — native apps via Capacitor (founder directive)

**Directive:** Pookie ships on the Apple App Store and Google Play as native mobile apps.

### Recommendation: Option A — Capacitor (native shells around the Next.js app)

**Justification, weighed against the alternatives:**

- **Option C (PWA) is honestly disqualified.** It cannot satisfy the directive: no App Store /
  Google Play presence without a wrapper (which would just be Capacitor/TWA with extra steps),
  no HealthKit / Health Connect access, no background GPS, and iOS Web Push remains second-class
  (home-screen-web-app only, user-hostile enrollment). PWA-grade web hygiene is still required —
  it improves the WebView too — but PWA is not the deliverable.
- **Option B (React Native / Expo) is the stronger *native* technology and the fallback**, but it
  means a second codebase: Expo Router instead of the App Router, no React Server Components, and
  every tenant-isolation rule in this document re-implemented and re-audited in a second client.
  For a zero-risk-tolerance, small-team build where the web app already encodes the security model
  (RLS + server-resolved `child_id` + Server Actions), duplicating the client doubles the
  isolation-audit surface for marginal UX gain. Defer unless WebView UX demonstrably fails.
- **Option A wins on:** one codebase (the Next.js app *is* the mobile app UI); the entire
  tenant-security model (§8.4–§8.8) applies unchanged because it all executes server-side;
  native API needs (push, HealthKit/Health Connect, GPS, camera, secure storage, biometrics) are
  covered by Capacitor plugins; and the team stays web-shaped.

### How the App Router survives inside a Capacitor WebView (the critical mechanics)

Server Components need a server — and they keep theirs. Capacitor is **not** asked to bundle the
Next.js app:

- The native shells load the app from a **remote URL** (`server.url`, e.g.
  `https://pookie.pages.dev`) — the Cloudflare Pages deployment. The WKWebView (iOS) / Android
  WebView is purely a rendering client: it receives RSC payloads, streams Suspense boundaries,
  and POSTs Server Actions back to the same origin. The full App Router model — Server Components,
  RLS-enforcing per-request clients, Server Actions, proxy redirects — works unchanged.
- **Static export (`output: "export"`) is FORBIDDEN for this architecture.** It would kill Server
  Components, SSR, and Server Actions — the entire security model. Capacitor MUST run in
  remote-URL mode. This is a binding constraint, not a preference.
- **Auth in the WebView:** Supabase session cookies are first-party to the loaded origin, so
  `httpOnly` cookies work normally. OTP magic links must open *inside* the WebView: configure
  universal links (iOS) / app links (Android) for the app domain so `/auth/callback` completes
  in-app and cookies land in the WebView's jar. Test the cold-start-from-email-link path on both
  platforms before TestFlight.
- **Gotchas:** (1) WKWebView has no shared cookie jar with Safari — users sign in separately
  in-app (expected). (2) Streaming/Suspense works — WKWebView is a modern engine. (3) `100vh`
  quirks and safe areas apply with extra force — see the mobile audit checklist (§8.13.4).
  (4) Offline = the honest degraded mode (§8.8/MEDIUM-4): no network, no server render; the
  native shell should show a branded offline screen, not a blank WebView.

### Bridge inventory — which device API serves which module

| Module need | iOS | Android | Notes |
|---|---|---|---|
| **Push notifications** (core "proactive mother" thesis: nudges, geofence alerts, school alerts) | `@capacitor/push-notifications` → APNs | same plugin → FCM | Server sends via APNs/FCM using per-device tokens. **Tenant rule:** token registration MUST bind `device_token ↔ (user_id, child_id)` server-side; push topics/channels are per-`child_id` (e.g. `tenant:<child_id>:alerts`). Never trust a client-claimed topic. (Security pod: token↔child binding review.) |
| **Health sync — Apple HealthKit** | community `capacitor-healthkit` plugin (read steps, sleep, HR, workouts) | — | Read-only; user grants per data type in-app. |
| **Health sync — Health Connect** | — | community Health Connect plugin (fragmented — verify maintenance before committing; fallback: thin in-house native bridge) | Same read-only posture; record provenance per tenant. |
| **Location — foreground** | `@capacitor/geolocation` | same | Arrival/departure checks while app is open. |
| **Location — background / geofence** | dedicated background-geolocation plugin (low-power significant-change + region monitoring first) | same | **App Store review risk:** always-on background location needs a defensible justification (family safety) and a visible user benefit; design geofence-first, continuous-tracking-never. Foreground-only v1 is acceptable. |
| **Secure storage** (refresh tokens, device secrets) | Keychain via secure-storage plugin | Keystore via same | Never `localStorage` for secrets. |
| **Camera** (physical-mail intake photo snap — existing product flow) | `@capacitor/camera` | same | Upload path unchanged: signed URLs to the tenant Storage prefix. |
| **Biometrics** (app lock) | community fingerprint/biometrics plugin (Face ID/Touch ID) | same (fingerprint/face) | Convenience lock only — never a substitute for the Supabase session. |
| **Haptics / share / filesystem** | `@capacitor/haptics`, `share`, `filesystem` | same | Polish and export flows. |

### How the Next.js codebase maps to the native shell

- `src/app/**` — unchanged. The same routes serve web and WebView; add a `?shell=native`
  (or user-agent) hint only for chrome differences (hide "install app" banners, adjust safe-area
  padding), never for security decisions.
- `src/lib/native/` (new) — the bridge layer: a typed wrapper around Capacitor plugins with
  **web fallbacks** (e.g. `getPushToken()` resolves `null` on web). Client Components call this
  layer, never `@capacitor/*` directly — one seam to mock in tests and to stub on web.
- Token/health/location writes from the device go through **Server Actions / route handlers**,
  which re-resolve `child_id` from the session + route slug (§8.6). The native bridge never
  asserts tenancy.
- Native shell projects (`ios/`, `android/`) are thin: plugin config, icons/splash, universal
  links, entitlements (HealthKit, background modes, push). They contain no product logic and no
  secrets. DevOps owns the signing/pipeline (parallel input).

### Mobile-web standards that ship with v1 (from the scaffold audit)

- `viewport` export (`device-width`, `initialScale: 1`, `viewportFit: "cover"`, `themeColor`).
- `dvh` app shell, safe-area tokens on all fixed chrome.
- `active:` + `focus-visible:` paired with every `hover:`; 44pt minimum touch targets.
- Form inputs ≥16px (iOS auto-zoom trap).
- Global offline indicator + per-screen degraded states.
- Client-JS budget per route (CI gate).

---

## 8.14 Sign-off checklist (component complete only when all are true)

- [ ] Browser singleton module + per-request server client module exist and are the only
      Supabase entry points; `server-only` guards data-access modules.
- [ ] `src/proxy.ts` exists (no `middleware.ts`); it does session-presence routing only.
- [ ] `/c/[childSlug]` layout implements the §8.4 firewall: per-request RLS resolution,
      `status='active'` filter, slug normalization, `notFound()` on miss, `child_access`-based
      shell branching (never `users.role`), 0-row pending state.
- [ ] No `generateStaticParams` with real slugs; no cross-request caching of membership.
- [ ] Server Actions follow the §8.6 shape (zod, re-resolve, authorize, scope, audit,
      narrow revalidation).
- [ ] Auth flow matches §8.7; signups OFF; hCaptcha lesson observed.
- [ ] `08` audit compensations all addressed or tracked.
- [ ] Mobile: Capacitor remote-URL decision recorded; `output: "export"` banned in config review;
      bridge inventory reviewed with Security (token↔child binding) and DevOps (signing/pipeline).

---

*End of §08. Signed: UI Full-Stack, Engineering Pod — 2026-10-11.*

<!-- END handbook-sections/08-nextjs-standards.md -->

<!-- BEGIN handbook-sections/09-appsec.md -->
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

<!-- END handbook-sections/09-appsec.md -->

<!-- BEGIN handbook-sections/10-zero-trust.md -->
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

<!-- END handbook-sections/10-zero-trust.md -->

<!-- BEGIN handbook-sections/11-design-language.md -->
# 11 — Design Language

**Owner:** Senior Frontend Developer (Frontend component patterns) · **Status:** draft for pod review · **Date:** 2026-10-11
**Authority:** founder hard requirement / standing design standard (AGENTS.md, 2026-10-11).
**Applies to:** every surface of the Pookie app, no exceptions.
**Theme:** *nature and love* — organic, warm, nurturing. Sunlight through leaves,
not a tech dashboard.
**Divine light** (founder addition, 2026-10-11): soft glows with neon colors are
woven through every surface — God- and angel-like touches. Pookie is a ball of
light, an angel; the app should feel heavenly, protective, watched-over-with-love.
"Everywhere" means *presence*, not intensity: the glow is ambient and diffused
(§2 budgets still bind), like light you feel rather than stare at.

**Stack grounding:** Tailwind CSS v4 (`@theme` tokens in `src/app/theme.css`),
Next.js 16 App Router. Dark mode via `class="dark"` strategy; light mode is the
default. All values below are normative tokens, not suggestions.

---

## 1. Green token palette

### 1.1 The ramp (Tailwind v4 `@theme`)

```css
@theme {
  /* Deep forest → emerald → mint */
  --color-pine-950: #0b1f14;   /* near-black green: page bg (dark) */
  --color-pine-900: #12291a;   /* app chrome (dark), primary CTA bg */
  --color-pine-800: #1a3a24;   /* raised surfaces (dark) */
  --color-pine-700: #245231;   /* borders on dark, hover states */
  --color-moss-600: #2f6b3f;   /* primary actions on light, AA-safe */
  --color-leaf-500: #3f9153;   /* brand emerald: accents, charts */
  --color-leaf-400: #5cb877;   /* interactive highlights on dark */
  --color-mint-300: #93dcb0;   /* glow color, sparkle */
  --color-mint-200: #c4efd8;   /* secondary text on dark */
  --color-mint-100: #e3f8ec;   /* primary text on dark */
  --color-mint-50:  #f2fbf5;   /* page bg (light) */

  /* Sunlight — the "love" in nature-and-love. Sparing, deliberate. */
  --color-sun-300: #f5d98b;    /* mascot sparkle, celebration only */
  --color-sun-500: #e8b84b;    /* warning/attention (never error) */
}
```

Error/destructive keeps a muted botanical red (`--color-ember-500: #c0564d`)
so it reads as "fallen leaf," not alarm. Info uses deep water
(`--color-pond-500: #3d7a8c`). Both are supporting cast; green leads everywhere.

### 1.2 Semantic aliases

```css
@theme {
  --color-ink:      var(--color-pine-950);  /* body text on light */
  --color-ink-soft: var(--color-pine-800);  /* secondary text on light */
  --color-paper:    var(--color-mint-50);    /* page bg (light) */
  --color-surface:  #ffffff;                 /* cards on light */
  --color-primary:  var(--color-moss-600);   /* main actions on light */
  --color-accent:   var(--color-leaf-500);   /* highlights, active states */
  --color-success:  var(--color-leaf-500);
  --color-glow:     var(--color-mint-300);    /* the neon source color */
}
```

Dark mode remaps (same alias names, `dark:` variant or `.dark` overrides):
`--color-ink` → `mint-100`, `--color-paper` → `pine-950`,
`--color-surface` → `pine-900`, `--color-primary` → `leaf-400`.
**Components reference aliases only** (`bg-surface`, `text-ink`), never ramp
names directly — that is what makes the mode flip free.

### 1.3 Dark / light mappings

| Alias | Light | Dark |
|---|---|---|
| page bg (`paper`) | `mint-50` | `pine-950` |
| card (`surface`) | `#ffffff` | `pine-900` |
| primary text (`ink`) | `pine-950` | `mint-100` |
| secondary text | `pine-800` | `mint-200` |
| primary CTA bg | `moss-600` | `leaf-400` on `pine-900` |
| borders | `pine-700` at 15% | `mint-300` at 12% |

### 1.4 Contrast rules — WCAG AA minimum on every pairing

**Approved pairings (verified AA, do not re-check):**

| Foreground | Background | Use |
|---|---|---|
| `mint-100` | `pine-950` / `pine-900` | body text (dark) |
| `mint-200` | `pine-950` / `pine-900` | secondary text (dark) |
| `pine-950` | `mint-50` / `mint-100` | body text (light) |
| `pine-800` | `mint-50` | secondary text (light) |
| `#ffffff` | `moss-600` | primary button text (light) |
| `pine-950` | `leaf-400` | primary button text (dark) |
| `leaf-400` | `pine-950` | large text (≥18pt) / icons only (dark) |
| `moss-600` | `mint-50` | large text / icons only (light) |

**Rules:**
- Body text (< 18pt): 4.5:1 minimum. Only the first six rows qualify.
- `leaf-500` and `leaf-400` are **never body text** on any background — icons,
  large headings, and glow only.
- `sun-*` is never text. Ever.
- Any pairing not in this table must be checked with a contrast tool and added
  to the table in the same PR. "Looks fine" is not a contrast check.

---

## 2. Neon glow / shine / sparkle — subtle, never harsh

**Principle: diffused neon, never laser.** Glow reads as *light through leaves*:
soft, broad, low-opacity. If it has a hard edge, a thin radius, or pure
saturated color, it is wrong.

### 2.1 Where glow is allowed

- **Primary CTAs** — one soft halo at rest, slightly stronger on hover/active.
- **Active states** — the selected tab, the active child card in the switcher.
- **Pookie mascot moments** — greeting, celebration, streak milestones: Pookie
  renders as a soft ball of light (radial `mint-300`→transparent halo, gentle
  float). Sparkle particles in `mint-300` / `sun-300` suggest the angelic
  presence — protective, never startling.
- **Ambient divine light** — one soft, large, low-opacity radial wash per key
  screen (dashboard hero, login) in `mint-300` at ≤ 8% opacity, evoking
  watched-over-with-love. It is atmosphere, not a glowing object: no edges,
  no animation loop (static; gentle breathe only with user consent of motion,
  disabled under reduced motion).
- **Focus rings** — the accessible glow: 2px `leaf-400` outline at 60% + soft
  outer blur. This is the *only* glow allowed on form controls.

### 2.2 Intensity caps (budgets, not vibes)

```css
/* utilities in theme.css — the ONLY glow values permitted */
.glow-cta    { box-shadow: 0 0 24px 0 rgb(147 220 176 / 0.35); }
.glow-cta-hover { box-shadow: 0 0 32px 4px rgb(147 220 176 / 0.45); }
.glow-active { box-shadow: 0 0 20px 0 rgb(92 184 119 / 0.30); }
.glow-mascot { box-shadow: 0 0 40px 8px rgb(147 220 176 / 0.25); }
```

- Max blur radius: **40px** (mascot only). Max opacity: **0.45**.
- Glow color is always `mint-300`/`leaf-400` from the palette — never `#00ff00`,
  never white, never ad-hoc.
- One glowing element per viewport is the norm; two is the max. A screen full
  of halos is a screen with no hierarchy.

### 2.3 No-glow zones

- **Body text** — `text-shadow` is forbidden on all text. No exceptions.
- **Data tables, grade lists, dense UI** — glow creates visual noise where the
  user is trying to read numbers.
- **Form inputs** — focus ring only (§2.1). No glow on fill, no glow on error
  (error uses `ember-500` border + message).
- **Backgrounds** — no full-screen glow washes; atmosphere comes from the
  palette and gradients, not halos. The one exception is the single ambient
  divine-light wash per key screen (§2.1), which is static atmosphere, not glow.

### 2.4 Shine / sparkle

- **Shine:** a slow diagonal sheen sweep on primary CTAs only
  (`--anim-shine: 2.4s`, opacity ≤ 0.25, `linear-gradient` overlay). Max one
  shine sweep per 5 seconds per element; disabled under `prefers-reduced-motion`.
- **Sparkle:** tiny `mint-300`/`sun-300` particles reserved for mascot moments
  and celebrations. Cap: 12 particles, ≤ 1.2s lifetime, never on data screens,
  never looping indefinitely (max 3 iterations, then rest).

---

## 3. Animation standards

### 3.1 Performance budgets

- **60fps target.** Animated properties are restricted to `transform` and
  `opacity` — the compositor-only set. Animating `width`, `height`, `top`,
  `margin`, `box-shadow`, or `filter` in a transition is a defect.
  (The one exception: `box-shadow` may *transition* between the fixed utility
  values in §2.2 on CTA hover — 150ms, never keyframed.)
- No layout thrash: measure once, animate with transforms. Lists render with
  `content-visibility: auto` where long.
- `will-change` is opt-in per element and removed after the animation ends;
  never applied globally.

### 3.2 Duration / easing tokens

```css
@theme {
  --anim-instant: 0ms;
  --anim-fast: 120ms;   /* micro-interactions: press, toggle, checkbox */
  --anim-base: 200ms;   /* hovers, focus, small reveals */
  --anim-slow: 320ms;   /* page transitions, sheet slides */
  --anim-mascot: 600ms; /* mascot celebrate — the only slow animation */

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);      /* entrances */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* state changes */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);/* playful pops (mascot, badges) */
}
```

No ad-hoc durations/easings. If a motion needs a value not here, add the token
with a name and a reason.

### 3.3 `prefers-reduced-motion` — mandatory

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

What this means in practice:
- **Disables entirely:** sparkle particles, shine sweeps, mascot idle bounce,
  parallax, skeleton shimmer (show a static placeholder), glow pulsing.
- **Degrades to instant:** page transitions, sheet/modal entrances, accordion
  expands — content appears, no travel.
- **Keeps:** opacity fades ≤ 120ms are acceptable but not required; when in
  doubt, instant wins.
- JS-driven animation must check `matchMedia('(prefers-reduced-motion: reduce)')`
  before starting. The CSS blanket rule above is the backstop, not the plan.

### 3.4 Restraint rules — what animates, what never does

**Animates:**
- Page/route transitions: fade + 8px rise, `--anim-slow` + `--ease-out`.
- Micro-interactions on key actions: CTA press (`scale(0.97)`, `--anim-fast`),
  toggles, checkboxes, tab selection.
- Mascot moments: the ball-of-light float (slow `translateY` ±6px, 4s loop —
  the *only* indefinite animation permitted) and celebrate
  (`--anim-mascot` + `--ease-spring`), capped.
- Skeletons: shimmer (opacity only), static under reduced motion.

**Never animates:**
- Data-dense lists: no stagger, no per-row entrances. Content appears.
- Anything during data entry: inputs, forms, steppers — no layout shift, no
  travel, no glow pulses while the user types.
- Numbers that update (grades, counts): crossfade at most; never count-up
  tickers on grades — a ticking grade reads as unstable.
- Navigation chrome: the tab bar and header do not bounce, slide, or shimmer.

---

## 4. Responsive / interaction requirements

### 4.1 Breakpoints (Tailwind defaults, mobile-first)

`sm:640` · `md:768` · `lg:1024` · `xl:1280` · `2xl:1536`.
Author base styles for the smallest viewport first; `md:`+ only *adds*.
The primary design target is the phone — Dawson's daily surface — with tablet
and desktop as progressive enhancement, never the other way around.

### 4.2 Touch targets

- Minimum **44×44px** for every tappable element (buttons, links, checkboxes,
  tab items, switcher cards' hit areas). This closes audit finding LOW-1.
- 8px minimum gap between adjacent targets.
- No hover-dependent interactions, anywhere: every `hover:` is paired with
  `active:` (tap feedback) and `focus-visible:` (keyboard). Hover is enhancement;
  `active` is the contract (audit finding MEDIUM-3).

### 4.3 Capacitor WebView implications

(Cross-reference: `docs/audit-findings/ui-fullstack-mobile.md`, findings
MEDIUM-2, MEDIUM-3, LOW-1.)

- **Safe-area insets:** `viewport-fit=cover` in the meta viewport; fixed chrome
  (tab bar, headers, FABs) pads with tokens:
  `--spacing-safe-top: env(safe-area-inset-top)` etc. Never hardcode notch padding.
- **Viewport units:** app shell and full-height screens use `dvh` (`h-dvh`,
  `min-h-dvh`), not `vh` — the URL bar show/hide jump is real on mobile browsers
  even though the Capacitor WebView itself has no URL bar.
- **No hover, no cursor:** assume touch-first in the WebView. Long-press is not
  a discoverable gesture — put destructive/advanced actions behind explicit
  buttons, not gestures.
- **Tap highlight:** `-webkit-tap-highlight-color: transparent` globally; our
  `active:` states replace it.
- **Performance:** the WebView is a thin client — keep JS bundles lean, prefer
  CSS animations over JS ones, and treat every animation token above as a
  battery budget too.

### 4.4 Offline / degraded-state visual language

- **Offline banner:** a slim `pine-800` bar under the header — "You're offline.
  Changes will sync when you reconnect." Never red; offline is a state, not an error.
- **Stale data:** desaturate to 60% + show "Updated {relative time}" under the
  section title. The user must always be able to tell live from cached.
- **Queued actions:** pending mutations show a sprout-seedling pending dot
  (`sun-500`) on the affected row with "waiting to sync" copy; they resolve
  into the normal success state on reconnect — no separate "synced!" fanfare.
- **Full degradation:** if a section can't load and has no cache, the themed
  `ErrorState` with retry (§5 of handbook 02) — never a blank screen, never a
  stack trace.

---

## 5. Enforcement — how this is enforced in code review

1. **Token-only colors.** No raw hex, `rgb()`, or arbitrary color values outside
   `theme.css`. In review: any `bg-[#…]`, `text-[#…]`, or `#[0-9a-f]{6}` in a
   component file is a blocking comment. (Tailwind v4 arbitrary values make this
   easy to sneak in — grep for it.)
2. **Glow utilities, not ad-hoc shadows.** `box-shadow` appears only via the
   `.glow-*` utilities in §2.2 or Tailwind's scale for neutral elevation
   (`shadow-sm`…`shadow-xl`). A custom `box-shadow` with a green tint that isn't
   a utility = blocking comment.
3. **Contrast table is the law.** New text/background pairings must be added to
   §1.4 with their ratio in the same PR. Screenshots are not contrast evidence.
4. **Reduced-motion check.** Every PR that adds or changes animation must state
   the reduced-motion behavior in the PR description. No statement = not approved.
5. **Touch-target audit.** New interactive elements must meet 44px; reviewers
   spot-check on a 360px viewport.
6. **Animation restraint.** Stagger on lists, animation during form entry, or
   count-up on grades = blocking comment, with a pointer to §3.4.
7. **Founder override path.** This standard is a founder hard requirement. Any
   exception (e.g., a one-off celebration moment that wants a bigger glow) needs
   the founder's explicit sign-off *in the PR*, and the exception is documented
   in the PR — never silently merged.

*End of section 11. Companion: handbook 02 (frontend patterns) for component
structure and tenant-context rules; `docs/audit-findings/ui-fullstack-mobile.md`
for the mobile findings this section closes.*

<!-- END handbook-sections/11-design-language.md -->

---

## Sign-off table

Nothing ships without sign-off. Every component below is signed off in writing by its Manager.

| Component | Manager | Review status | Date |
|---|---|---|---|
| Backend/API conventions (§01) | Senior backend developer | Signed off — reconciled to ADR-001 (REST) | 2026-10-11 |
| Frontend component patterns (§02) | Senior frontend developer | Signed off | 2026-10-11 |
| Architecture coherence (§03) | Solution architect | Signed off — conditional pass on migrations (follow-ups tracked) | 2026-10-11 |
| Technical design decisions (§04) | Technical architect | Signed off — ADR-001/002/003/004 | 2026-10-11 |
| CI/CD pipeline (§05) | DevOps expert (Sr Mgr, Platform & Delivery) | Signed off | 2026-10-11 |
| RLS correctness (§06) | Database expert (Sr Mgr, Data & Tenancy) | Signed off — round 2 | 2026-10-11 |
| Adapter registry + integration patterns (§07) | Integration expert | Signed off | 2026-10-11 |
| Next.js 16 implementation standards (§08) | UI full-stack expert | Signed off — incl. mobile strategy (Capacitor) | 2026-10-11 |
| Application security (§09) | Security engineer | Signed off — incl. store compliance | 2026-10-11 |
| Tenant-isolation proof / zero-trust (§10) | Zero-trust architect (Sr Mgr, Integrations & Security) | Signed off — round 2 | 2026-10-11 |
| Design language (§11) | Senior frontend developer | Signed off — green palette, divine-light theme | 2026-10-11 |
| Mobile architecture (§08.13, §05.9, §09.6, §03.8) | UI full-stack expert + DevOps + Security + Solution architect | Signed off | 2026-10-11 |

## Migration audit — final state

- 001/004/005 (Data & Tenancy): audited, fixed in place across 2 rounds, parse-verified. Signed off.
- 002/003 (Integrations & Security): audited, fixed in place across 2 rounds, parse-verified. Signed off.
- 3 most serious findings: (1) invites privilege escalation — child could mint parent invites (fixed: parent-only policies); (2) child_portals_public view bypassed RLS — any user could read all tenants' portal metadata (fixed: security_invoker + column GRANTs); (3) get_tenant_secret returned plaintext secrets to parent JWTs (fixed: service_role-only + boolean test RPC).
- Not yet applied to a live project — negative-test checklists in docs/audit-findings/ must run against the provisioned pookie project.
- Follow-up migrations tracked: 006 (storage bucket RLS, rpc_claim_sync, worker_children, teacher_contacts), ETL migration (carried-over tables + child_id).
- Founder decisions flagged (not engineering): open-vs-closed signup; Kids-category vs 12+ rating (recommendation: 12+); teen-health-privacy tiers.
