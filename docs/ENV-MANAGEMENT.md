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
4. **Build-time vs. runtime:** the deploy pipeline currently assumes a static export
   (`output: "export"`, proven d-dash pattern). Every `NEXT_PUBLIC_*` var is baked
   in at build time — changing one requires a rebuild + redeploy.
   **OPEN DECISION (Managing Director):** the backend scaffold includes API routes
   (`/api/trpc`, `/api/v1/*`) and server-only env usage (`POOKIE_TUTOR_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`), which REQUIRE a server runtime — incompatible
   with static export. Options: (a) commit to static export and move all
   server logic to Supabase Edge Functions, or (b) adopt
   `@cloudflare/next-on-pages` for a real server runtime on Pages. The deploy
   workflows deploy `./out`; if (b) is chosen, the wrangler deploy step and this
   doc must be updated. Nothing deploys until this is decided.

## Variable inventory

| Variable | Public? | Set where | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Pages env + GH secrets | Same value both envs (for now) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Pages env + GH secrets | Anon key is public by design; RLS enforces access |
| `POOKIE_TUTOR_URL` | **NO — server only** | Pages env + GH secrets | Tutor worker URL; consumed by `/api/v1/tutor/chat` proxy (never in client bundle) |
| `NEXT_PUBLIC_APP_URL` | yes | Pages env | Canonical URL per env (redirects, links) |
| `NEXT_PUBLIC_ASSET_VERSION` | yes | CI (git SHA) | Never set manually; pipeline injects it |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO — server only** | Secure Vault / Edge Functions | Never `NEXT_PUBLIC_`. Never in Pages client env. |

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
