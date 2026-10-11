# Pookie Build Log — 3-agent team coordination

Team: Senior Full-Stack Developer (frontend) · Senior Backend Developer (API/data) · DevOps Manager (CI/CD, Pages, envs).
Rule: append entries newest-first. Keep it tight: what changed, what's blocked, what's next.

---

## 2026-10-11 — Senior Full-Stack Developer

**Foundation built + design language applied:**

**Removed (scaffold dead weight):**
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` — template SVGs, unused
- Replaced `src/app/page.tsx` template hero entirely (now the tenant router)
- Stripped `src/app/globals.css` template theme down to the Pookie token system

**Built:**
- Supabase singleton clients: `src/lib/supabase/client.ts` (browser, module singleton — never per-call), `server.ts`, `middleware.ts`; root `middleware.ts` refreshes sessions
- Tenant layer: `src/lib/tenant/types.ts`, `actions.ts` (getMemberships, setActiveChild via HttpOnly cookie, consumeInvite via rpc, signOut), `src/components/tenant-provider.tsx` (React context)
- Routes: `/` (tenant router: 0→login, 1→direct, N→switcher), `/login` (OTP magic-link + landing), `/auth/callback`, `/select-child` (parents only), `/c/[childSlug]` (slug-routed dashboard shell + skeleton)
- `src/components/pookie-orb.tsx` — Pookie as a ball of light: breathing golden-green orb, halo, slow-turning light rays

**Design tokens (nature + divine light) — `src/app/globals.css`, Tailwind v4 `@theme`:**
- Canopy (bg): `canopy-950 #060f0a` → `canopy-700 #173322`
- Leaf (brand): `leaf-300 #86efac` → `leaf-700 #15803d`
- Moss (soft): `moss-200 #bbf7d0`, `moss-300 #86efac`
- Dew (highlights): `dew-100 #ecfdf5`, `dew-200 #d1fae5`
- Sunlight (warm gold): `sunlight-200 #fef3c7` → `sunlight-400 #fbbf24`
- Halo (divine): `halo-100 #fffbeb` → `halo-300 #fde68a`
- Bark (text): `bark-100 #e8f5ee`, `bark-300 #b8d4c2`, `bark-500 #7d9b88`
- Shadows: `shadow-glow-sm/md`, `shadow-sun-warm`, `shadow-halo-sm/md`
- Motion: `animate-bloom`, `animate-breathe`, `animate-sway`, `animate-dapple`, `animate-rise`, `animate-halo-spin`, `animate-ascend` — all disabled under `prefers-reduced-motion`
- Utilities: `.text-sunlit`, `.btn-dapple`, `.card-living`, `.input-rooted`, `.halo`, `.light-rays`, `.firefly`, `.ascend-particle`

**Build:** `npm run build` green. Note: installed missing `superjson` etc. from package.json (arch pod added deps without installing). Next.js 16 note: tenant routes use `export const instant = false` (the `dynamic` export is incompatible with cacheComponents).

**Blocked on:** Supabase migrations still under audit (did not touch `supabase/migrations/`); auth flow untested until migrations land.

---

## 2026-10-11 — DevOps Manager

**Pipeline live (this commit):**
- `.github/workflows/ci.yml` — lint + typecheck + build on push/PR to `main`; reusable via `workflow_call`
- `.github/workflows/deploy-staging.yml` — auto-deploys `pookie-staging` on push to `main` (after CI gate), then `?v=` version check
- `.github/workflows/deploy-production.yml` — MANUAL ONLY (`workflow_dispatch` + `VERIFIED` input). Founder's staging-first rule enforced.
- `scripts/verify-asset-version.sh` — post-deploy `?v=` guard: fails on mixed versions, warns if versioning not yet implemented (d-dash lesson)
- `package.json`: added `typecheck` script (`tsc --noEmit`)
- `.env.example` — reconciled with backend: tutor URL is server-only `POOKIE_TUTOR_URL` (proxy pattern, never in client bundle)

**Docs:**
- `docs/CLOUDFLARE-SETUP-CHECKLIST.md` — founder provisions 2 Pages projects, env vars, 4 GitHub secrets (`CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POOKIE_TUTOR_URL`). Auto-deploy DISABLED on Pages (Actions drive deploys via wrangler).
- `docs/ENV-MANAGEMENT.md` — env separation plan, `?v=` mechanism spec, local dev instructions.

**ESCALATED to Managing Director — architecture decision blocking first deploy:**
Static export (`./out` deploy, proven d-dash pattern) vs. server runtime (`@cloudflare/next-on-pages`).
The backend scaffold has API routes + server-only env usage, which need a runtime; static export has none.
My pipeline assumes static export until decided. Recommend: decide before Cloudflare provisioning.

**Handoffs:**
- Frontend: implement `?v=` append from `NEXT_PUBLIC_ASSET_VERSION` (spec in `docs/ENV-MANAGEMENT.md`); confirm `output: "export"` vs next-on-pages per the decision above.
- Founder: `docs/CLOUDFLARE-SETUP-CHECKLIST.md` is ready for provisioning.

---

## 2026-10-11 — Senior Backend Developer

**API-layer decision (ratified, not relitigated):** tRPC v11 for app-internal traffic, versioned REST
(`/api/v1`) for machine clients (Python workers, crons), Server Actions for UI-initiated mutations.
Adopts `docs/handbook-sections/01-api-conventions.md` §2 recommendation. Rationale: d-dash-app team
precedent (tRPC v11 in prod), end-to-end type safety, single inheritable `tenantProcedure`
middleware. Reconciliation with the technical architect's ADR still open — the three
non-negotiables (inheritable tenant middleware, generated client types, zod at every boundary) are
met by this choice.

**Built (this commit):**
- `src/lib/supabase/{client,server,admin}.ts` — browser singleton (per AGENTS.md lesson),
  server client (SSR cookies), service_role admin client (server-only, throws if bundled).
- `src/server/errors.ts` — canonical error-code registry (`TENANT_SCOPE_VIOLATION`, etc.),
  DB-exception → code mapping, HTTP status mapping. Raw Postgres messages never reach clients.
- `src/server/tenant.ts` — `assertTenant()` / `resolveChildSlug()`: resolve → assert →
  child_id. Used by every entry point.
- `src/server/trpc.ts` — tRPC init, `tenantProcedure` middleware (asserts `childId` input against
  `child_access` via RPC/session), request-id + error shaping.
- `src/server/routers/{_app,children,invites}.ts` — `children.listMine`, `children.get`,
  `invites.consume` (wraps `consume_invite()` RPC with error mapping).
- `src/server/services/children.ts` — framework-free business logic (thin-handler rule).
- `src/app/api/trpc/[trpc]/route.ts` — tRPC fetch handler.
- `src/app/api/v1/children/[childId]/route.ts` — example versioned REST (user session).
- `src/app/api/v1/tutor/chat/route.ts` — proxy stub → `pookie-tutor-v2` (tenant-scoped server-side;
  worker URL stays out of the client bundle).
- `src/lib/trpc/client.tsx` — minimal React Query + tRPC provider (frontend dev: wire into layout).
- `supabase/functions/{verify-credential,worker-webhook}/index.ts` — STUBS ONLY. No secrets logic
  until the migration audit signs off (C2/C3, H1/H2 open).
- `.env.example` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only), `POOKIE_TUTOR_URL`. No real keys committed.

**Migration review (read-only, per orders):** did NOT re-audit — engineering pod's audit findings
(`docs/audit-findings/backend-dev.md`: C1, C2, C3, H1–H4) already cover 001/004/005 deeply and are
more thorough than a second pass would add. Flagging for the record: C1 (invite privilege
escalation), C2 (agent_tenant_scope RLS off), C3 (agent_reader blind-or-bypassed) are the three
that gate any backend work touching invites/agent paths. My scaffold avoids those paths (invites
go through the existing RPC; agent reads not yet built).

**For Frontend dev:** `useTRPC()` from `src/lib/trpc/client.tsx`; every procedure takes
`{ childId }` — resolve the active child slug→id via `children.listMine` first. Error envelope is
`{ ok, error: { code, message, requestId } }` — map `code` to UI copy, never show raw messages.

**For DevOps:** new env vars needed (see `.env.example`). `SUPABASE_SERVICE_ROLE_KEY` must be set
in Cloudflare Pages env (never `NEXT_PUBLIC_`). tRPC route is edge-compatible (fetch handler, no
Node APIs).

**Blocked on:** migration audit sign-off (engineering pod) before building anything on
`consume_invite` hardening, `get_tenant_secret`, or agent paths. Nothing else.

### 2026-10-11 (later) — Senior Backend Developer: typecheck/lint fixes

- Fixed `src/lib/trpc/client.tsx` for the tRPC v11 API (`createTRPCReact`, no `TRPCProvider`
  export) and installed the missing `superjson` dep.
- Excluded `supabase/functions` (Deno) from the Next.js `tsconfig.json`.
- Fixed a type error in the frontend dev's `src/lib/tenant/actions.ts` (`row.children` is an
  array under the `!inner` join) — minimal fix, build now passes `tsc --noEmit` + `eslint` clean.
  Frontend dev: yours to review.
- `tsc --noEmit` ✅ · `eslint` ✅ on all touched paths.
- Pushed to `mmkamal411/pookie` main (`44e3043`). **Blocker for DevOps:** the GitHub token
  lacks `workflow` scope, so `.github/workflows/ci.yml` was rejected on push and is held
  locally (untracked). CI workflow needs a token with workflow scope or manual upload.
