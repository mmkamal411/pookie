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
