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

## ADR-004: Deployment runtime — **DECIDED: `@opennextjs/cloudflare` (full Next.js runtime on Cloudflare Pages). Static export is rejected for this project.**

> **Amendment (2026-10-11):** `@cloudflare/next-on-pages` is abandoned for Next 16 (its peer dependency caps at Next 15.5.2). The adapter is now **`@opennextjs/cloudflare`** — the official successor, supporting Next 16. Separately, **Next.js is pinned to `~16.3.8`**: Next 16.4.0 reads `preview-props.json` via `loadManifest`, which OpenNext 1.20.x does not bundle (open PR #1356, unmerged at time of writing). Unpin only after that PR merges or OpenNext cuts a 16.4-compatible release.

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
- **ADR-004 amendment (2026-10-11):** adapter switched to `@opennextjs/cloudflare` (next-on-pages is dead for Next 16 — peer dep caps at 15.5.2); Next.js pinned to `~16.3.8` (16.4.0 incompatible with OpenNext 1.20.x, PR #1356 unmerged). Static preview deployed to `preview-static.pookie-staging.pages.dev`; full dynamic Worker deployment pending (error 1101 hang, Supabase SSR middleware suspected).
- **Founder decisions (2026-10-11):** (1) **Closed signup for v1** — invite-only; the NULL-child invite branch stays closed-by-construction. Public signups remain OFF. (2) **App Store / Play rating 12+** (not Kids category) for v1 — avoids Kids-category constraints (no third-party analytics, no external links, parental gates); the app is parent-driven, so 12+ is the honest rating. (3) **Teen health privacy tiers** follow the Guidance pod's framework (`docs/GUIDANCE-FRAMEWORK.md` — child's privacy contract) unless the founder directs otherwise.
