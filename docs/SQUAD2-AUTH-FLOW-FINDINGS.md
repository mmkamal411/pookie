# Squad 2 — Auth Flow Trace: `/c/dawson-kamal` crash (2336440848@E1180)

**Date:** 2026-10-12 ~07:25 EDT
**Squad:** 2 (Auth Flow Trace)
**Status:** Root cause identified. No code modified (investigation only).

---

## 1. Executive summary

The crash is **not** an auth problem, a bad account state, or a database problem.
OAuth succeeds. The session is valid. Memberships resolve correctly.

**Root cause:** `src/app/c/[childSlug]/layout.tsx` line 36 calls
`await setActiveChild(membership.child_id)` during Server Component render.
`setActiveChild` writes a cookie via `next/headers` `cookies().set()`, which
**throws** `"Cookies can only be modified in a Server Action or Route Handler"`
when executed in a Server Component render context. The throw happens in the
layout — before the page ever runs — and is caught by the root
`global-error.tsx` boundary, producing the exact UI the browser test observed.

The team's own code documents this hazard twice:
- `src/app/page.tsx:103` — *"do NOT call setActiveChild() here —
  cookies().set() throws in a Server Component … which 500s the front door
  for every single-child user."*
- The pre-refactor layout comment — *"cookies().set() throws in Server
  Components on the edge."*

**Regression source:** commit `35344d7` (2026-10-12 06:08, "refactor(demo):
remove all demo mode code"). The diff unconditionally enabled the
`setActiveChild` call in the layout for all users (previously it was skipped
for demo sessions, with the edge-throw explicitly acknowledged in a comment).

---

## 2. Step-by-step trace: click → crash

| # | Step | File | What happens | Outcome |
|---|------|------|--------------|---------|
| 1 | User clicks "Continue with Google" | `src/app/login/page.tsx` → `signInWithGoogle()` | `supabase.auth.signInWithOAuth({provider:"google"})` → browser leaves for Google | OK |
| 2 | Google redirects back | `src/app/auth/callback/route.ts` `GET` | `code` present → `exchangeCodeForSession(code)` → session cookies captured in `pendingCookies` and explicitly set on the redirect response (edge-safe pattern, cf. AGENTS.md Cloudflare Workers cookie rule) → `302` to `?next=` (default `/`) | **OK — session established** |
| 3 | `/` root router | `src/app/page.tsx` `Home()` | `getUser()` → user exists. Deletion check bypassed (diagnostic). No `?invite=`. `profiles.onboarding_completed` → true (or table-missing fallback). `getMemberships()` → 1 membership (dawson-kamal). `getActiveChildId()` → null (cookie never successfully written). Single-membership branch → `redirect("/c/dawson-kamal")` | **OK — 307 to child route** |
| 4 | Child layout (tenant firewall) | `src/app/c/[childSlug]/layout.tsx` | `getUser()` → user exists (no redirect). `getMemberships()` → membership found for slug `dawson-kamal` (no `notFound()`). **`await setActiveChild(membership.child_id)` → `cookies().set()` → THROWS** | **CRASH — render aborted** |
| 5 | Error boundary | `src/app/global-error.tsx` (no route-level `error.tsx` exists under `c/[childSlug]/`, so the root boundary catches it) | Renders "Something didn't grow right… Reference: 2336440848@E1180" with Try again / Start over | **Observed UI — exact text match** |
| 6 | "Try again" | `reset()` re-renders | Same deterministic throw → same digest | Matches browser report (identical reference across reloads) |

**The page component (`page.tsx` → `getSchoolOverview`) never executes.** The
layout renders before the page in the App Router, and the layout throws first.

---

## 3. "What if" analysis

Each scenario: (a) would it produce THIS error boundary? (b) how to detect it?
(c) the fix.

### W1. OAuth callback creates a session but no `public.users` row exists
- (a) **No.** The callback only exchanges the code for a session; it never
  touches app tables. A missing user row would surface later (empty
  memberships → `notFound()` → 404, not the boundary).
- (b) `auth.users` has the row (login works); check `public.users` /
  `profiles` for a matching `user_id`.
- (c) Ensure the user-provisioning trigger/backfill creates `public.users` +
  `profiles` on first OAuth sign-in (verify trigger exists and is enabled).

### W2. Session valid but `getMemberships()` returns `[]`
- (a) **No.** Layout: `membership` is `undefined` → `notFound()` → clean 404
  page ("This page could not be found"), not the error boundary. The browser
  saw the boundary, so memberships were found — this scenario is ruled out.
- (b) Query `child_access` for the user's `user_id`; empty result = this case.
- (c) N/A for this incident; the 404 path is already the correct behavior.

### W3. Redirect targets `/c/dawson-kamal` but the membership slug differs
- (a) **No.** Same as W2: `find()` misses → `notFound()` → 404. Ruled out.
- (b) Compare `children.slug` values for the user's `child_access` rows
  against the URL slug.
- (c) Slug-rename flows must update `child_access`-visible slugs atomically;
  consider redirecting stale slugs instead of 404ing.

### W4. Race: user row created but `child_access` row not yet committed
- (a) **No.** Transient empty memberships → 404 (W2), not the boundary.
  Would self-heal on retry.
- (b) Intermittent 404s for the same user/slug that resolve without changes.
- (c) Make child provisioning transactional (single RPC creating
  `children` + `child_access` rows together); the layout's `notFound()`
  already handles the transient case gracefully.

### W5. Middleware throws before render
- (a) **No.** There is no `src/middleware.ts` in the repo (verified).
- (b) N/A.
- (c) N/A.

### W6. `getSchoolOverview()` throws (missing `classes`/`grades`/`grade_snapshots` tables or bad data)
- (a) **No — masked.** It throws `ApiError` on `classErr`/`gradeErr`, which
  *would* hit the boundary, but the layout throws first, so this code never
  runs for this incident. It remains a live secondary suspect for the NEXT
  bug once the layout is fixed.
- (b) After fixing the layout, watch for a *different* digest on the same
  route; `mapDbError` logs carry the DB error code (e.g. `42P01` =
  missing table).
- (c) Verify migrations 001–002 applied cleanly on the live DB; add a
  startup/health check that asserts core tables exist.

### W7. `setActiveChild()` throws in the layout ⭐ **CONFIRMED**
- (a) **Yes — this is the incident.** Deterministic throw during layout
  render → root `global-error.tsx` → digest `2336440848@E1180`, identical on
  every load and on "Try again". Only authenticated child routes are
  affected (`/` and `/login` never call it in render).
- (b) The digest is stable across reloads (same error → same digest hash).
  Server logs will show `Error: Cookies can only be modified in a Server
  Action or Route Handler` originating from `tenant/actions.ts:77`
  (`store.set`) called via `c/[childSlug]/layout.tsx:36`.
- (c) See §4.

### W8. `TenantProvider` / `ChildSwitcher` / `ChildToolbar` / `PookiePinball` throw
- (a) **No.** They render after the `setActiveChild` call; execution never
  reaches them.
- (b) N/A for this incident.
- (c) N/A.

---

## 4. Fix options (ranked)

**Option A — Remove the call from the layout (recommended, minimal).**
Delete `await setActiveChild(membership.child_id);` (layout.tsx:36) and the
now-unused import. Rationale:
- The layout already resolves the tenant from the URL slug and passes
  `activeChildId={membership.child_id}` directly to `TenantProvider` — the
  cookie is redundant for rendering.
- The cookie's only consumer is `getActiveChildId()` in `/` (root router),
  used as a redirect shortcut. When absent, `/` falls back to the
  single-membership branch → same `/c/dawson-kamal` destination for Mehedi.
- Zero behavior loss; removes the entire bug class from this path.

**Option B — Wrap in try/catch (defensive).**
Precedent already in-repo: `consumeInvite` (actions.ts:111-116) wraps its
`setActiveChild` call with *"A stale cookie write must never 500 the front
door."* Same treatment in the layout would convert the crash into a silent
no-op. Less clean than A (keeps a known-throwing call), but a one-line
hardening if the cookie write is ever deemed necessary here.

**Option C — Move the write to middleware (architectural).**
Middleware runs before render and may set cookies on the response. There is
currently no middleware; adding one just for this is heavier than the value.

**Do NOT "fix" by making `setActiveChild` swallow the error internally.**
Callers like the `child-switcher` client component and the `select-child`
form action rely on the write succeeding; silent failure there would cause
confusing tenant-switching bugs. Keep the throw for legitimate contexts,
remove the illegitimate call site.

---

## 5. Sibling-instance audit (same bug class)

All `cookies().set/delete` call sites in `src/`:

| Call site | Context | Verdict |
|-----------|---------|---------|
| `tenant/actions.ts:77` (`setActiveChild`) | Called from layout render (broken), form action (fine), client component via RPC (fine), `consumeInvite` try/catch (fine) | **Fix the layout call site** |
| `tenant/actions.ts:89` (`clearActiveChild`) | No callers outside actions.ts | Dead code today; audit before wiring to sign-out UI |
| `auth/callback/route.ts` | Route Handler, explicit cookie capture | Correct (edge-safe pattern) |
| `page.tsx:103` comment | Documents the hazard | Keep as a warning |

**No other Server Component calls a cookie-writing action during render.**
`select-child/page.tsx:20` calls it inside a `"use server"` form action —
legitimate.

---

## 6. Hardening: auto-circumventing future "what ifs"

1. **Lint rule (highest value):** add an ESLint/custom check —
   `no-cookie-write-in-render`: flag any import of `setActiveChild` /
   `clearActiveChild` (or raw `cookies().set/delete`) in files under
   `src/app/**/page.tsx` / `layout.tsx` unless inside a `"use server"`
   function. The two in-code comments (`page.tsx:103`, old layout comment)
   prove tribal knowledge doesn't survive refactors — automate it.
2. **Try/catch convention:** any cookie write reachable from a render path
   must follow the `consumeInvite` pattern — never let a non-critical write
   500 a page.
3. **Route-level `error.tsx`:** add `src/app/c/[childSlug]/error.tsx` so
   future tenant failures show a scoped recovery UI ("back to child select")
   instead of the global "start over" boundary. (Does not fix this bug —
   the layout throw would still fire — but improves the next one's UX.)
4. **Smoke test gap:** the staging smoke test only exercises unauthenticated
   routes. Add an authenticated probe (the synthetic `smoke-test@pookie.invalid`
   user exists for this) that hits `/c/<slug>` and fails the deploy on an
   error boundary — this exact regression would have been caught pre-deploy.
5. **Kill the redundancy:** the active-child cookie is write-fragile and
   read-optional. Long-term, resolve the tenant purely from the URL slug
   (already done in layout/page) and drop the cookie entirely.

---

## 7. Out of scope but adjacent

- The `/` 500 for authenticated users (missing `deletion_requested_at` /
  `permanent_delete_after` columns, commit `38a70b1` ahead of migration 063)
  is a **separate** incident, currently masked by the diagnostic bypass
  (`ed725dd`). Fixing the layout will reveal it again on the authenticated
  `/` path — both must be fixed before Mehedi can use the app.
- `clearActiveChild` is dead code; wire it into sign-out or remove it per
  the code-cleanliness rule.

---

## Evidence index

- `src/app/auth/callback/route.ts` — OAuth exchange, edge-safe cookie handling
- `src/app/page.tsx` — root router; line 103 documents the exact throw
- `src/app/c/[childSlug]/layout.tsx` — line 36, the throwing call
- `src/app/c/[childSlug]/page.tsx` — never reached; secondary suspect W6
- `src/lib/tenant/actions.ts` — `"use server"`; `:77` `store.set`, `:89` `store.delete`
- `src/app/global-error.tsx` — verbatim match for observed error UI
- `git show 35344d7 -- src/app/c/[childSlug]/layout.tsx` — regression diff
- Prior art: commit `bd0def9` ("cookies().set() throws in Server Components on edge"),
  AGENTS.md Cloudflare Workers cookie rule

---

## 8. Post-wipe verification checklist (Mehedi-directed fresh retry)

After wiping all records for `mehedikamal@gmail.com` and re-running the flow,
the CORRECT sequence and how to verify each step. (Derived from
`supabase/migrations/001_tenancy_core.sql`,
`052_provision_onboarding_child.sql`, `src/lib/onboarding/actions.ts`.)

> ⚠️ **Prerequisite:** the §4 layout fix must be deployed first. Without it,
> step 5 crashes deterministically even with perfect data (W7).

### Step 1 — Google sign-in
**Expected DB state:**
- `auth.users`: one row, `email = 'mehedikamal@gmail.com'`.
- `public.users`: one row, `id` = the auth user's id (created by the
  `on_auth_user_created` trigger → `handle_new_auth_user()`; `ON CONFLICT
  (id) DO NOTHING`, so re-sign-in is idempotent).

**Verify:**
```sql
select id, email from auth.users where email = 'mehedikamal@gmail.com';
select id from public.users where id = '<auth-user-id>';
```
Both return exactly one row, ids match.
**UI:** `/` → 307 to `/onboarding` (fresh user, `profiles.onboarding_completed`
is not true). `/login` must NOT re-render after OAuth.

### Step 2 — Onboarding: enter name ("Mehedi")
**Expected DB state** (`completeOnboarding`, `src/lib/onboarding/actions.ts:42`):
- `public.profiles`: one row, `user_id` = auth id, `display_name = 'Mehedi'`,
  `onboarding_completed = true` (upsert on `user_id` conflict).

**Verify:**
```sql
select user_id, display_name, onboarding_completed from public.profiles
where user_id = '<auth-user-id>';
```
One row, `display_name='Mehedi'`, `onboarding_completed=true`.
**UI:** wizard advances past step 1; "Skip for now" also completes onboarding
("just me" mode — no child row created).

### Step 3 — Onboarding: add child (Dawson Kamal, birthdate)
**Expected DB state** (`provision_onboarding_child` RPC, migration 052):
- `public.children`: one row —
  `parent_user_id` = auth id,
  `first_name='Dawson'`, `last_name='Kamal'`,
  `slug='dawson-kamal'` (lowercased `first-last`, non-alphanumerics → `-`;
  on collision appends `-xxxxxx`),
  `date_of_birth` = entered date.
- `public.child_access`: one row —
  `child_id` = new child id, `user_id` = auth id,
  `role='parent'`, `granted_by='parent'`, `granted_by_user_id` = auth id.
- The RPC also calls `public.ensure_user()` (login-time backstop for the
  `public.users` row) and writes an `audit_event('child.created')`.

**Verify:**
```sql
select id, slug, first_name, last_name, date_of_birth, parent_user_id
from public.children where parent_user_id = '<auth-user-id>';
select child_id, user_id, role, granted_by from public.child_access
where user_id = '<auth-user-id>';
```
Exactly one row each; `slug='dawson-kamal'`; `role='parent'`;
`child_access.child_id` = `children.id`.
**UI:** wizard shows the child added (age tier computed client-side from
birthdate: under13 / teen / adult); step completes without `create_failed`.

### Step 4 — Root router redirect
**Expected:** `/` → `getUser()` ok → onboarding gate passes
(`onboarding_completed=true`) → `getMemberships()` returns 1 membership →
`getActiveChildId()` null → single-membership branch →
**307 to `/c/dawson-kamal`**.

**Verify in browser:** address bar ends at
`https://pookie-staging.pages.dev/c/dawson-kamal` (no intermediate error).

### Step 5 — Child dashboard renders
**Expected `getMemberships()` return** (the exact shape the layout/page consume):
```json
[{
  "child_id": "<uuid>",
  "role": "parent",
  "child": {
    "id": "<uuid>",
    "slug": "dawson-kamal",
    "first_name": "Dawson",
    "nickname": null,
    "avatar_url": null,
    "school_name": null,
    "grade_level": null
  }
}]
```
Layout: membership found → (after §4 fix) no throw → `TenantProvider`
receives `activeChildId`. Page: `getSchoolOverview(child_id)` runs —
with no classes/grades yet it must return **empty collections, not throw**
(W6 — verify `classes`, `grades`, `grade_snapshots` tables exist from
migrations 001–002; empty tables are fine, missing tables are not).

**Verify:**
- UI: dashboard shell renders (header, child switcher, bottom toolbar) —
  **no** "Something didn't grow right" boundary.
- DB sanity: `select count(*) from public.classes where child_id='<child-id>'`
  may be 0 — that's fine. The query must *succeed*, not 42P01.

### Step 6 — Sign out and back in (session durability)
**Expected:** sign-out clears the session; sign-in again → `/` → straight to
`/c/dawson-kamal` (membership still 1, slug unchanged). No duplicate
`public.users` / `profiles` / `children` rows (all writes are idempotent:
trigger `ON CONFLICT DO NOTHING`, profile upsert on `user_id`, slug
uniqueness loop).

**Verify:** row counts in `public.users`, `public.profiles`,
`public.children`, `public.child_access` are unchanged after the second
login (1, 1, 1, 1).

### Wipe completeness check (before the retry)
```sql
-- expect zero rows for the old user id in ALL of these:
select 'child_access', count(*) from public.child_access where user_id='<old-uuid>'
union all select 'children', count(*) from public.children where parent_user_id='<old-uuid>'
union all select 'profiles', count(*) from public.profiles where user_id='<old-uuid>'
union all select 'users', count(*) from public.users where id='<old-uuid>';
-- auth.users row for the email should also be gone (or the wipe must cover it):
select count(*) from auth.users where email='mehedikamal@gmail.com';
```
Any non-zero count = stale data that will collide with the fresh run
(slug `dawson-kamal` uniqueness loop would silently mint `dawson-kamal-xxxxxx`,
breaking the expected URL — W3-adjacent).
