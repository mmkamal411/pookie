# 01 — Backend API Conventions

**Owner:** Backend/API conventions manager · **Status:** draft for pod review · **Date:** 2026-10-11
**Reconciliation flag:** the tRPC-vs-REST recommendation below (§2) overlaps the Technical
architect's ADR surface. No ADR file exists yet in `docs/`; this section states the backend
recommendation with rationale and is **flagged for reconciliation** with the architect's ADR before
it becomes normative.

**Stack:** Next.js 16 + TypeScript + Tailwind (App Router) · Supabase (`pookie` project) ·
Cloudflare Pages · Cloudflare Worker (`pookie-tutor-v2`) · laptop sync workers (Python).

---

## 1. Layer map — where backend code is allowed to live

| Layer | Used for | Must NOT be used for |
|---|---|---|
| **Server Components / Server Actions** (`src/app/**`) | Rendering; form-driven mutations from React UI | Machine clients, webhooks, anything needing custom status codes/headers, file downloads, SSE |
| **Route Handlers** (`src/app/api/**/route.ts`) | REST surface for workers, sync scripts, crons, webhooks; proxying to `pookie-tutor-v2`; uploads/downloads | Business logic that belongs in shared lib (keep handlers thin) |
| **tRPC router** (`src/server/**`, served via a Route Handler) | All app-internal data access from React (queries + mutations) | External/machine clients (they get REST) |
| **Supabase RPC** (`public.*` functions) | Privileged primitives only: `consume_invite`, `audit_event`, `agent_assert_scope`, `get_tenant_secret`, sync-claim RPCs | Business logic; anything callable without an assertion |
| **Edge Functions** | Credential verification, webhook receivers needing secrets | Anything that can run in a Route Handler instead |

Rules:
1. **No direct Supabase client data access from Client Components** except through tRPC/Server
   Actions/Route Handlers. The anon key + RLS is the *last* line of defense, never the authorization
   layer for writes.
2. **The `service_role` key lives in exactly two places:** server-side Route Handlers/Server Actions
   (via env var, never bundled) and the Python workers. It is never in client bundles, never in
   `NEXT_PUBLIC_*`, never logged.
3. **Business logic lives in `src/server/services/`** (plain TS modules, framework-free, unit-testable).
   Handlers, actions, and tRPC procedures are thin adapters: validate → resolve tenant → call service →
   shape response.

---

## 2. tRPC vs REST — recommendation

**Recommendation: tRPC v11 for app-internal traffic; versioned REST (`/api/v1`) for machine traffic.
Flagged for reconciliation with the Technical architect's ADR.**

### Rationale for tRPC (app ↔ app-server)
- **Team precedent:** the current production app (`~/workspace/d-dash-app/`) runs tRPC v11 on
  Next.js 16. The pod already knows its failure modes; no retraining cost, and patterns can be
  ported (minus the child-specific couplings).
- **End-to-end type safety** across the React ↔ server boundary eliminates an entire class of
  contract drift (field renames, enum changes like `tutor_chat.role`) at compile time — valuable in
  a greenfield where the schema is still churning.
- **One enforcement point:** a `tenantProcedure` middleware (§6) asserts `child_id` membership for
  *every* procedure. With REST we'd hand-roll the same guard per route; with tRPC it's inherited.
- **Batching + input validation** (zod) come free; procedures compose for the dashboard's
  many-small-queries render pattern without N+1 HTTP round trips.

### Why REST anyway (machine ↔ server)
tRPC's JSON-RPC-over-HTTP is a poor contract for non-TS clients. The laptop sync workers (Python),
cron runners, and any future third-party integration get **REST**: predictable, curl-able,
documentable. Specifically:
- `POST /api/v1/sync/claim`, `/api/v1/sync/finish`, `/api/v1/sync/heartbeat` (or keep calling the
  Supabase RPCs directly — decide per endpoint, but the HTTP surface is REST either way);
- `POST /api/v1/tutor/chat` proxy → `pookie-tutor-v2` (keeps the worker URL and CORS config out of
  the client bundle; adds tenant scoping server-side);
- Webhook receivers (if any) — REST only.

### Reconciliation note for the architect
If the ADR prefers REST-only or GraphQL, the non-negotiable backend requirements are: (a) a single
inheritable tenant-assertion middleware, (b) generated/checked client types, (c) zod (or equivalent)
input validation at every boundary. tRPC satisfies all three with the least new code; any
alternative must show how it does.

---

## 3. Server Action vs Route Handler — Next.js 16 guidance

**Default to Server Actions for UI-initiated mutations; Route Handlers for everything else.**

Use a **Server Action** when ALL are true:
- Initiated from a React form/interaction (progressive enhancement matters);
- Caller is an authenticated browser session (cookies available);
- No custom status code, header, or streaming needed;
- Not called by workers, crons, or external systems.

Use a **Route Handler** when ANY is true:
- Caller is a machine (worker, cron, webhook, Python script);
- Needs custom status codes/headers (`429`, `Content-Disposition`, SSE);
- File upload/download, request signing, or raw-body access (webhook HMAC);
- Proxies to another service (`pookie-tutor-v2`, Supabase Storage signed URLs).

Security notes (both):
- Both run server-side with the request's auth context. **Both must resolve and assert `child_id`
  (§6)** — Server Actions are not exempt just because "the component already checked."
- Server Actions are POST-only and harder to rate-limit distinctly: apply the global action rate
  limit (§7) and keep consequential actions idempotent.
- Never trust a `child_id` (or `childSlug`) passed from the client as *authorization*. It is a
  *selection* among the caller's tenants; the server verifies `child_id = ANY(current_child_ids())`
  before touching data. Route params `/[childSlug]/…` are resolved slug→id server-side, then
  asserted the same way.

---

## 4. Error-response shape (canonical)

All machine-facing surfaces (tRPC errors, REST, Server Action failures surfaced to UI) map to one
envelope. tRPC keeps its native error shape on the wire; the *client adapter* normalizes to this:

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
- **Codes are stable API.** Add new ones; never rename. Maintain `src/server/errors.ts` as the
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
| tRPC procedure | `childId` in input schema (zod uuid) | `tenantProcedure` middleware: `assertTenant(ctx, input.childId)` → throws `TENANT_SCOPE_VIOLATION`; also set for RLS via `current_child_ids()` (session JWT) |
| Server Action | `childId` arg (or from `[childSlug]` route params, resolved server-side) | Same assertion helper as tRPC; do not rely on the component having checked |
| Route Handler (user) | Path `/api/v1/children/[childId]/…` or body | Session → membership check before any query |
| Route Handler (machine) | Body/header `x-child-id` + job token | service_role: verify `child_id` ∈ the job's allowlist (`sync_requests.child_id`, `worker_children`); reject empty/ambiguous |
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

- **Validation:** zod schemas at every boundary (tRPC input, REST body/query, Server Action args,
  worker payloads). Parse, don't validate-and-cast.
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

## 8. Open items / reconciliation

1. **tRPC vs REST** — reconc
...[truncated 561 chars]