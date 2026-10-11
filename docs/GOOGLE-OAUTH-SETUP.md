# Google OAuth Setup — Pookie

The Google sign-in button is built into the login page
(`src/app/login/page.tsx` → `supabase.auth.signInWithOAuth({ provider: "google" })`).
It does nothing until the Supabase **pookie** project is wired to Google.
This doc walks through that wiring (~10 minutes, one-time).

## Part 1 — Google Cloud Console (create the OAuth client)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and sign in.
2. Create a project (or reuse one), e.g. **Pookie**.
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Pookie`, support email: your Gmail
   - Scopes: leave defaults (openid, email, profile are added automatically)
   - Test users: add the family Gmail addresses that may sign in while the
     app is in testing mode (e.g. mehedikamal@gmail.com, dawsonkamal@gmail.com)
   - Save.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Pookie Supabase`
   - **Authorized redirect URIs** — add this exact URI
     (replace `<ref>` with the pookie project's reference,
     `fspvcuaupkdsekpwmnep`):
     ```
     https://fspvcuaupkdsekpwmnep.supabase.co/auth/v1/callback
     ```
   - Create. Copy the **Client ID** and **Client secret**.

## Part 2 — Supabase dashboard (enable the provider)

1. Open the **pookie** project in the
   [Supabase dashboard](https://supabase.com/dashboard/project/fspvcuaupkdsekpwmnep).
2. **Authentication → Providers → Google** → toggle **Enable**.
3. Paste the **Client ID** and **Client secret** from Part 1. Save.
4. **Authentication → URL Configuration**
   - Site URL: `https://pookie-staging.pages.dev`
   - Add to **Redirect URLs** (one per line):
     ```
     https://pookie-staging.pages.dev/auth/callback
     https://pookie-staging.pages.dev/**
     ```
   - Save.

## Part 3 — Verify

1. Visit `https://pookie-staging.pages.dev/login`.
2. Click **Continue with Google**.
3. Pick a test-user Google account → consent → you should land back in
   the app, signed in.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Button clicks but nothing happens | Popup blocked | Allow popups, or the code falls back to full redirect |
| `redirect_uri_mismatch` from Google | Redirect URI not registered | Re-check Part 1 step 4 — must be the `/auth/v1/callback` URL exactly |
| Back on `/login?error=auth` | Supabase rejected the callback | Check Supabase **Authentication → Logs**; usually a Site URL / Redirect URL mismatch |
| "Access blocked" for non-test users | OAuth consent screen still in testing | Add them as test users, or publish the consent screen |

## Notes

- Google sign-in and email magic link coexist — users pick either on the
  login page. Both land on `/auth/callback`, which exchanges the code for
  a session and hands off to `/` for tenant resolution.
- The demo entry link is intentionally gated (`?demo=1` on demo deploys
  only) and is NOT part of the login page by default.
