# TEAM DIRECTIVE — `@cloudflare/next-on-pages` adoption
**From:** Director of Engineering · **To:** Pookie build team (Backend, DevOps)
**Date:** 2026-10-11 · **Authority:** ADR-004 (`docs/handbook-sections/04-design-decisions.md`)
**Status:** BLOCKING — read before any further API/pipeline work

## What was decided (not re-litigated)
- The app ships as a **full Next.js runtime on Cloudflare Pages** via `@cloudflare/next-on-pages`. Static export is **rejected**.
- **ADR-001 STANDS:** no tRPC. The tRPC handler is converted to REST API routes.
- **ADR-002 AMENDED:** `service_role` lives **ONLY in API routes** (never client bundles — CI must grep build output for leaks). Every API route asserts `child_id` per the child_id rule: **resolve → assert → use → audit**.
- **pookie-tutor stays a separate Cloudflare Worker** (`pookie-tutor-v2`). No change.
- Supabase Edge Function stubs (`verify-credential`, `worker-webhook`) stay Supabase Edge Functions. No change.

---

## BACKEND TEAM

### 1. Convert the tRPC handler to REST routes (per ADR-001)
The following tRPC code **must not ship**:
- `src/app/api/trpc/[trpc]/route.ts` — delete after conversion
- `src/server/trpc.ts`, `src/server/routers/_app.ts`, `src/server/routers/children.ts` — the router tree
- `src/lib/trpc/client.tsx` — the client
- `@trpc/*` entries in `package.json` — dead dependencies are a supply-chain and confusion cost

**Conversion rule:** each tRPC procedure becomes a REST Route Handler under `src/app/api/v1/`, matching the existing convention (e.g. `src/app/api/v1/children/[childId]/route.ts`, `src/app/api/v1/tutor/chat/route.ts`). Procedure input schemas become zod-validated request bodies; tRPC's error codes map to HTTP status codes (use the existing `src/server/errors.ts` mapping — keep the file, drop the tRPC wiring).

### 2. Keep `/api/v1/*` — every route asserts child_id
**This is the hottest security path in the app. The rule is resolve → assert → use → audit:**
1. **Resolve** the child from the **server-side auth context** (session/JWT → `current_child_ids()`), never from client-supplied `childId` path params or bodies. A `[childId]` param is a *hint the route validates*, not an identity.
2. **Assert** the resolved child against `child_access` (or the equivalent policy check). Requests with no resolvable, authorized child are rejected with 403 — not degraded, rejected.
3. **Use** the asserted `child_id` on every privileged query (remember: `service_role` bypasses RLS, so the route *is* the authorization layer).
4. **Audit** via the `audit_event` RPC.

No new route may be merged without this sequence. No exceptions for "internal" or "low-risk" routes.

### 3. service_role stays server-only
- `src/lib/supabase/admin.ts` is the **only** module that may touch `SUPABASE_SERVICE_ROLE_KEY`. Its `typeof window !== 'undefined'` guard is now a mandatory convention — any server-only module you add gets the same guard.
- Service-role usage in Server Components is **forbidden** (API routes only). RSC payloads serialize to the client; a key imported there is a leak by construction.
- Follow the existing env convention: the key is `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`-prefixed — anything `NEXT_PUBLIC_*` is in the client bundle by definition).

### 4. Edge Function stubs — do not touch
`supabase/functions/verify-credential` and `supabase/functions/worker-webhook` remain Supabase Edge Functions (Deno, per-function secrets). They are not being migrated into Next.js routes.

### 5. workerd compatibility
next-on-pages runs route code in the **edge runtime**, not Node. Write routes against the Web/edge API surface with the `nodejs_compat` flag; do not import Node-only APIs. If a route genuinely needs a missing API, escalate: the fix is a rewrite or a move to an Edge Function, never a polyfill hack.

**Backend acceptance checklist:**
- [ ] tRPC handler + router tree + client removed; `@trpc/*` out of `package.json`
- [ ] Every `/api/v1/*` route implements resolve → assert → use → audit
- [ ] `SUPABASE_SERVICE_ROLE_KEY` referenced only from `src/lib/supabase/admin.ts` (grep-verified)
- [ ] No `service_role` import in any Server Component or client file
- [ ] Routes verified working under the edge runtime (`nodejs_compat`)

---

## DEVOPS TEAM

### 1. Switch the Pages pipeline to `@cloudflare/next-on-pages`
- **Build command** (Pages project settings + deploy scripts): run the standard Next.js build, then `npx @cloudflare/next-on-pages`. The adapter consumes `.vercel/output/` and produces the Pages Functions worker (`_worker.js`). This replaces the old static-export flow (`output: 'export'` → deploy `out/`).
- **Compatibility flags:** set `nodejs_compat` on both projects (`pookie-staging`, `pookie`). Confirm flags apply to preview deployments too.
- **Projects unchanged:** Staging = `pookie-staging` project (`https://pookie-staging.pages.dev`, `main` branch auto-deploy, PR previews at `<branch>.pookie-staging.pages.dev`); Production = `pookie` project (`https://pookie.pages.dev`, Mehedi's explicit go-ahead every time). Supabase Auth redirect allowlist (`https://pookie.pages.dev/**`, `https://*.pookie-staging.pages.dev/**`) is unaffected.

### 2. Env handling — server-only vs `NEXT_PUBLIC_*` split
- **Server-only** (Pages env, staging + prod + previews): `SUPABASE_SERVICE_ROLE_KEY` and any other secret. Set on the Pages projects via dashboard/`wrangler pages secret`-equivalent; never in the repo.
- **Public:** `NEXT_PUBLIC_*` (Supabase URL, anon key, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEPLOY_VERSION`) — these ship in the client bundle by design.
- **Previews need secrets too:** PR preview deployments build the same API routes; `SUPABASE_SERVICE_ROLE_KEY` must exist in the preview environment or previews 500 on any privileged route. Set it on the preview environment of both projects.

### 3. CI: service_role leak grep (new mandatory step)
Add a CI step that greps the **built output** for secret leakage. The built output is now `.vercel/output/static/` plus the bundled `_worker.js` — not `out/`. The check:
- Grep for `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, and the key-value pattern itself across the built assets.
- **Fail the build loudly on any hit.** A hit means a server-only module leaked into the client bundle — treat it as a P0.
- Note: the literal *name* `SUPABASE_SERVICE_ROLE_KEY` will legitimately appear in server-side code that *reads* `process.env`; the grep must distinguish the **key value** (the actual secret) from the env-var name. Tune the pattern so reading the env var on the server is not a false positive.

### 4. Update the `?v=` verification step
The standing `?v=` procedure (rewrite ALL `?v=` params in built output unconditionally; post-deploy `curl … | grep -o '?v=…' | sort -u` must show exactly one version) still applies, with two changes:
- The rewrite target is now `.vercel/output/static/` (the adapter's static output), not `out/`.
- The version check must run against `/` **and** at least two sub-pages, and against one API route smoke check (e.g. an unauthenticated GET returns the expected 401/403, not a 404 or 500) — Functions-served pages can mask build breakage behind a 200 shell.

### 5. CSP `connect-src` step — unchanged, but re-verify
`public/_headers` still ships with the Pages deployment under next-on-pages, and the procedure still verifies the **served header text** (`curl -sI https://pookie-staging.pages.dev/ | grep -i 'content-security-policy'`), because `curl` doesn't enforce CSP. After the runtime switch, re-run the full `connect-src` allowlist check on staging — the adapter changes how assets are served, and a missing entry only explodes in a real browser.

### 6. Standing watch item: 100k req/day free-tier limit
Pages Functions free tier allows **100k requests/day**. Family scale is far under it, but requests are now metered — add a standing watch item to the deploy runbook: alert threshold at **50k req/day sustained**. If we ever approach it, the fix is optimization or the paid tier, decided by ADR — not silent overage.

**DevOps acceptance checklist:**
- [ ] Build command = Next.js build + `npx @cloudflare/next-on-pages` on both projects
- [ ] `nodejs_compat` flag set on `pookie-staging` + `pookie` (prod + previews)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in staging, prod, **and** preview environments (server-only)
- [ ] CI leak-grep step on `.vercel/output/static/` + `_worker.js`; fails loudly on key value
- [ ] `?v=` rewrite targets `.vercel/output/static/`; single-version check passes on `/` + 2 sub-pages; API smoke check added
- [ ] Live CSP header re-verified on staging after the switch
- [ ] 100k req/day watch item in the runbook (50k alert threshold)

---

## Rollback / revert note
If next-on-pages proves unworkable, that is a new ADR — not a quiet drift back to static export. The rollback story is unchanged: promote the previous Pages deployment (both projects).
