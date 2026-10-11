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