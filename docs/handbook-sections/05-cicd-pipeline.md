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
