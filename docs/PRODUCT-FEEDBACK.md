# Pookie Product Feedback Log

Founder-observed issues, captured verbatim-ish with date. These are Mehedi's
direct product reactions — treat as high-priority UX input, not backlog noise.

## Guiding principle (Mehedi, 2026-10-12)

> "We can build the most modern rocket ship, but if no one can start it,
> then there is no use of it right?"

Auth + onboarding is the ignition. Every feature behind a broken signup is
wasted work. Signup reliability outranks all feature work until a new user
can go from landing → signed in → dashboard with zero troubleshooting.

## 2026-10-12 — Signup friction (Mehedi, during staging tour)

> "A new user will likely not go through all these extra steps to troubleshoot
> and sign up. We will lose that user before they even sign up."

Context: the staging product tour hit email-verification friction (magic link
required leaving the app, opening Gmail, clicking back; test inbox unreachable;
credential redaction blocked the automated tour). Some of that was tour
tooling, but the core observation stands: **signup is the #1 drop-off point
and the current flow has too many steps.**

Candidate mitigations (not yet decided):
- Make "Continue with Google" the primary, one-tap path (it already exists on
  the login card — promote it above the email field).
- Consider passkeys / device-native auth for the mobile app.
- Keep magic link as fallback, but add: resend link button, "check spam"
  hint, and in-app polling so the user doesn't have to manually come back.
- Measure: instrument signup funnel (landed → email entered → link sent →
  link clicked → onboarding complete) before changing anything.

Status: **open** — needs a signup-flow review pass before production launch.

## 2026-10-12 — Magic-link redirect bug (found during staging tour)

**Bug:** magic links issued from `staging-build.pookie-staging.pages.dev`
redirect to `https://pookie-2ey.pages.dev` — a *different, currently DOWN*
deployment (Cloudflare 522). The app code is correct
(`emailRedirectTo: ${window.location.origin}/auth/callback` in
`src/app/login/page.tsx:83`), so the wrong `redirect_to` comes from the
**Supabase project's Site URL setting**, not the app.

**Impact:** any user signing up via magic link lands on a dead domain and can
never complete sign-in. This is a signup-killing bug — exactly the drop-off
Mehedi flagged above.

**Fix (Supabase dashboard → Authentication → URL Configuration):**
- Site URL → `https://staging-build.pookie-staging.pages.dev`
- Redirect URLs → add `https://staging-build.pookie-staging.pages.dev/**`
  and `https://*.pookie-staging.pages.dev/**`

Status: **FIXED 2026-10-12 ~05:06 EDT** — Site URL now
`https://staging-build.pookie-staging.pages.dev`; redirect allow list extended
with `https://staging-build.pookie-staging.pages.dev/**` and
`https://*.pookie-staging.pages.dev/**` (6 entries total, nothing removed).
Old dead entry `https://pookie-2ey.pages.dev/**` intentionally left in place —
remove it during the production-URL cleanup pass.

## 2026-10-12 — "Continue with Google" dead on staging + `/` 500 (found during tour)

**Bug 1:** clicking "Continue with Google" on the staging login page
navigates to `/` instead of starting Supabase Google OAuth. The repo code is
correct (`signInWithOAuth({provider:"google"})` in `src/app/login/page.tsx:56`;
the Supabase authorize endpoint 302s to Google properly when hit directly).
Likely cause: **staging is serving a stale bundle** (known issue — DevOps
already flagged staging serves a deleted `/demo`). Fix = redeploy staging
from current `staging-build`.

**Bug 2:** `/` renders a Cloudflare Pages 500 ("This page couldn't load",
ERROR 4130754028@E1180) instead of the expected 307 → `/login`. The root
route (`src/app/page.tsx`) is a server component doing session + tenant DB
reads — something in that path throws on the deployed Function. Needs Pages
Function logs to pin down (check via Cloudflare dashboard → Pages →
pookie-staging → Functions → Real-time Logs).

Status: **open** — redeploy staging first; if `/` still 500s after a fresh
deploy, pull Function logs.
