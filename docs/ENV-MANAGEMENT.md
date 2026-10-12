# Environment Management — staging vs. production

## Principles

1. **No secrets in the repo. Ever.** `.env.local` is gitignored. Real values live
   in Cloudflare Pages project settings and GitHub Actions secrets.
2. **`.env.example` is documentation**, not configuration. Every variable the app
   reads must be listed there with a comment explaining it. If you add a new
   env var, you update `.env.example` in the same commit.
3. **Staging and production are separate Pages projects** (`pookie-staging` /
   `pookie`) with separate env values. They currently share one Supabase
   project; a dedicated staging Supabase project is recommended before
   production traffic (founder decision).
4. **Build-time vs. runtime:** the pipeline builds with OpenNext
   (`npm run build` → `npx opennextjs-cloudflare build` → `.open-next/` →
   `.pages-deploy/`). Every `NEXT_PUBLIC_*` var is **baked into the JS bundle
   at build time** — changing one requires a rebuild + redeploy; editing the
   Cloudflare dashboard alone does nothing for these. Server-side vars are
   read **at request time** from the Pages dashboard and must NEVER be
   prefixed `NEXT_PUBLIC_` (that would leak them into the client bundle).

## Variable inventory

| Variable | Public? | Set where | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | GH secrets (CI build env) | Pookie Supabase project (`fspvcuaupkdsekpwmnep`); same value both envs for now |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | GH secrets (CI build env) | Anon key is public by design; RLS enforces access |
| `NEXT_PUBLIC_POOKIE_TUTOR_URL` | yes | GH secret `POOKIE_TUTOR_URL` (CI build env) | Tutor worker URL, baked into client bundle |
| `POOKIE_TUTOR_URL` | **NO — server only** | Pages dashboard env | Same worker URL for the `/api/v1/tutor/chat` server proxy; never in client bundle |
| `NEXT_PUBLIC_APP_URL` | yes | CI build env (`https://pookie-staging.pages.dev` / `https://pookie.pages.dev`) | Invite/claim links default to the **production** URL when unset — staging builds MUST bake the staging URL (src/lib/safety/actions.ts, src/server/services/parent-claim.ts) |
| `NEXT_PUBLIC_ASSET_VERSION` | yes | CI (`${{ github.sha }}`) | Never set manually; pipeline injects it. Not yet consumed by the frontend (see `?v=` below) |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO — server only** | Pages dashboard env | Server-side Supabase admin (`supabaseAdmin` is lazy — no import-time throw). Sync/heartbeat/workers/sync-runs routes answer 503 `SERVICE_NOT_READY` ("not connected yet", never a 500) without it; the settings UI renders the honest unavailable panel. |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` | **NO — server only** | Pages dashboard env | Plaid; phone-held tokens, server never persists access_token |
| `EIA_API_KEY`, `FOURSQUARE_API_KEY`, `NPS_API_KEY`, `OPENCHARGEMAP_API_KEY` | **NO — server only** | Pages dashboard env | Travel/marketplace data APIs |
| `VAULT_DOC_ENCRYPTION_KEY` | **NO — server only** | Pages dashboard env | Document vault encryption |

`ci.yml` uses build-safe placeholders (`https://placeholder.supabase.co`) since
its build only gates, never ships. The deploy workflows' real build env lives
in the "Build (Next.js)" step of `deploy-staging.yml` / `deploy-production.yml`.

## Dashboard cleanup (manual — Cloudflare dashboard)

- [ ] **REMOVE `NEXT_PUBLIC_DEMO_MODE`** from the `pookie-staging` Pages
  project env vars — **both the production and preview scopes**. Demo mode
  was deleted from source in commit 35344d7; zero references remain in `src/`
  (verified 2026-10-12). Live-verified 2026-10-12 (Cloudflare API, read-only):
  the var is still present in both scopes. Dead config from the stale-build
  incident era — its presence in a future Pages-built bundle would defeat the
  staleness grep (`deploy-staging.py` / CI fail on `NEXT_PUBLIC_DEMO_MODE`).
- [ ] Confirm no other `NEXT_PUBLIC_*` vars are set in the dashboard that
  contradict the CI-baked values above (dashboard values do NOT override
  build-time baking; duplicates only cause confusion). Live-verified
  2026-10-12 — `pookie-staging` production scope holds exactly:
  `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEMO_MODE` (remove),
  `NEXT_PUBLIC_POOKIE_TUTOR_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  Preview scope holds the same minus `NEXT_PUBLIC_POOKIE_TUTOR_URL` —
  consider adding it there too if preview builds are ever used (or remove
  dashboard NEXT_PUBLIC_* vars entirely, since nothing bakes from them).

## GitHub Secrets checklist (repo Settings → Secrets and variables → Actions)

| Secret | Used by | Status |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy-staging.yml, deploy-production.yml (wrangler-action) | **MANUAL — the founder must add this himself** (no workaround; deploys fail without it) |
| `NEXT_PUBLIC_SUPABASE_URL` | CI build env | verify present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CI build env | verify present |
| `POOKIE_TUTOR_URL` | CI build env → `NEXT_PUBLIC_POOKIE_TUTOR_URL` | verify present |

## Asset versioning (`?v=`)

The deploy pipeline injects `NEXT_PUBLIC_ASSET_VERSION=${{ github.sha }}` at
build time. The frontend MUST append `?v=<version>` to asset URLs it controls
(static assets, worker URLs, any cache-busted reference). After every deploy,
`scripts/verify-asset-version.sh` curls the live site and fails the deploy if
more than one unique `?v=` version is found (the d-dash mismatched-assets
incident — see AGENTS.md).

**Frontend handoff:** implement the `?v=` append in the app shell. Until then
the script warns (does not fail).

## Local development

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_ANON_KEY from the Supabase dashboard
npm run dev
```

`deploy-staging.py` runs `npm run build` locally, which reads `.env.local`;
it defaults `NEXT_PUBLIC_APP_URL` to `https://pookie-staging.pages.dev` when
unset. Never commit `.env.local`.
