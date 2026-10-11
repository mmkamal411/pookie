# Cloudflare Setup Checklist — for Mehedi (founder provisions)

The DevOps Manager does NOT create these — Cloudflare resources are provisioned
by the founder per the zero-risk rule. Complete each item, then tell the team.

## 1. Pages projects (2)

| # | Project | Purpose | Build settings |
|---|---------|---------|----------------|
| 1 | `pookie-staging` | Staging. Auto-deploys on push to `main` via GitHub Actions. | Framework: Next.js (static export). Build cmd: `npm run build`. Output dir: `out`. |
| 2 | `pookie` | Production. Deploys ONLY via manual `deploy-production.yml` run. | Same as staging. |

Steps per project: Cloudflare dashboard → Workers & Pages → Create → Pages →
Connect to Git → select `mmkamal411/pookie` → set build command `npm run build`,
output directory `out`, production branch `main` → Save.
**Then DISABLE automatic deployments** on both projects (Settings → Builds →
disable "Automatic deployments"): GitHub Actions drives deploys via wrangler,
not the Pages Git integration. This prevents double-deploys.

## 2. Environment variables (per project — values DIFFER)

Set in Pages project → Settings → Environment variables.
Use **Production** and **Preview** environments to separate prod vs staging.

| Variable | `pookie-staging` value | `pookie` value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fspvcuaupkdsekpwmnep.supabase.co` | same |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (same project for now) | same |
| `POOKIE_TUTOR_URL` | tutor worker URL (when built) | same |
| `NEXT_PUBLIC_APP_URL` | `https://pookie-staging.pages.dev` | `https://pookie.pages.dev` |
| `NEXT_PUBLIC_ASSET_VERSION` | *(set by CI from git SHA — do not set manually)* | *(same)* |

`SUPABASE_SERVICE_ROLE_KEY` is NOT set on Pages (no server runtime in static
export). It lives in the Secure Vault for local ops / Edge Functions only.

## 3. GitHub secrets (repo: mmkamal411/pookie → Settings → Secrets → Actions)

| Secret | Value | Used by |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Pages:Edit** scope (Account → Workers & Pages) | deploy-staging.yml, deploy-production.yml |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fspvcuaupkdsekpwmnep.supabase.co` | build steps |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | build steps |
| `POOKIE_TUTOR_URL` | tutor worker URL (add when built) | build steps |

Create the token at: Cloudflare dashboard → My Profile → API Tokens →
Create Custom Token → template "Edit Cloudflare Workers" is close, but scope it
to **Account → Workers & Pages → Edit**.

## 4. Verification (after setup)

- [ ] Push to `main` → Actions: CI passes → deploy-staging runs → `?v=` check passes
- [ ] Open https://pookie-staging.pages.dev — site loads
- [ ] `deploy-production.yml` does NOT run on push (manual only)
- [ ] Tell the team — we proceed to staging verification
