# Squad 3 — Defensive Fixes: Implementation Plan
**"Bad account state" auto-detection & recovery for `/c/[childSlug]` routes**

- **Status:** DESIGN ONLY — no code written, nothing deployed.
- **Author:** Squad 3 (Defensive Fixes), 2026-10-12
- **Scope:** `src/app/c/[childSlug]/` segment (layout + all tab pages), `src/lib/tenant/actions.ts`, `src/server/services/school.ts`, `src/components/overview/overview-dashboard.tsx`, error boundaries.
- **Standing rules honored:** NO BLANK PAGES — EVER (every failure gets a useful UI + recovery path); TEST BEFORE YOU CLAIM (each fix ships with a browser-verified acceptance test); code cleanliness (no dead code; if we touch a file we clean it).

---

## A. Current failure anatomy (what we found)

The `/c/[childSlug]` segment has **exactly one** error boundary: `src/app/global-error.tsx` at the app root. There is **no** per-segment `error.tsx` anywhere under `src/app/`. So *any* throw inside the child segment renders the global page:

> "Something didn't grow right — Pookie hit a problem loading this page. It might be temporary — or your account might be in a bad state." (Reference: `<digest>`)

…with only two options: "Try again" (re-renders the same crash) and "Start over with a fresh account" (nuclear). **Nothing is auto-detected, nothing auto-recovers.**

The per-request crash chain (every `/c/[childSlug]/*` hit):

1. `layout.tsx` → `supabase.auth.getUser()` → `redirect("/login")` if no user (OK).
2. `layout.tsx` → `getMemberships()` — **call #1**. Throws propagate.
3. `layout.tsx` → `setActiveChild(child_id)` → calls `getMemberships()` — **call #2** — and **throws `Error("not_a_member_of_child")`** if the membership lookup misses.
4. `page.tsx` → `getMemberships()` — **call #3** — then `notFound()` if slug not found (OK), then `getSchoolOverview(child_id)` which **throws `ApiError`** on any DB error from `classes`, `grades`, or the `due_next` view.
5. `OverviewDashboard` does `[...overview.classes].sort()` and `overview.due_next.filter(...)` — a null/malformed `overview` crashes **client-side** into the same boundary.

Throw sites that reach the global boundary today:

| # | Throw site | File | Trigger |
|---|-----------|------|---------|
| T1 | `getMemberships()` throws | `src/lib/tenant/actions.ts:20` | `createClient()` misconfig, `auth.getUser()` network throw, `child` undefined in `.map()` (`child.id` → TypeError), `cookies()`/`headers()` throw |
| T2 | `setActiveChild()` throws `not_a_member_of_child` | `src/lib/tenant/actions.ts:71` | layout runs it after its own lookup; any drift between the two `getMemberships()` calls (or a throw→[] mismatch) lands here |
| T3 | `getSchoolOverview()` throws `ApiError` | `src/server/services/school.ts:214` | `classes`/`grades` query error, `due_next` **view missing** or RLS-denied, `hasCheckinToday`→`getChildTimezone` throw |
| T4 | `OverviewDashboard` null-deref | `src/components/overview/overview-dashboard.tsx:32,38` | `overview` null or `.classes`/`.due_next` missing → `[...null]` / `.filter` of undefined |
| T5 | NULL child fields | `src/lib/tenant/actions.ts` `.map()` | `first_name` NULL in DB (type claims non-null) flows into UI; `slug` NULL breaks `memberships.find(m => m.child.slug === childSlug)` silently → `notFound()` (arguably correct, but see F4) |

Also: **3× `getMemberships()` calls per request** (layout, setActiveChild, page) triples the transient-failure surface and DB load for zero benefit.

---

## B. Fix plan (file-by-file)

### F1 — `getMemberships()` must never throw (scenario: what if it throws instead of returning []?)

- **Scenario:** Any transient/permanent failure inside `getMemberships()` (network blip on `auth.getUser()`, PostgREST 500, malformed join row).
- **Current:** Throw propagates → global "bad state" page.
- **Desired:** Return `[]` on *unexpected* throws (DB `error` already returns `[]`); callers treat `[]` as "no children" → onboarding redirect (F4). Log the throw server-side with a structured error ID so RCA is possible.
- **Exact change** — `src/lib/tenant/actions.ts`, wrap the body of `getMemberships()`:
  ```ts
  export async function getMemberships(): Promise<TenantMembership[]> {
    try {
      // ... existing body unchanged ...
    } catch (err) {
      // Never crash the segment on a membership lookup failure.
      // Structured log for RCA (route, op, error, timestamp, traceable ID).
      logServerError({ route: "tenant/getMemberships", op: "select child_access", err });
      return [];
    }
  }
  ```
  Plus harden the `.map()`: skip rows where `child` is nullish instead of dereferencing:
  ```ts
  const child = Array.isArray(row.children) ? row.children[0] : row.children;
  if (!child?.id || !child?.slug) continue; // orphaned access row — skip, don't crash
  ```
  (Use a `for` loop / `flatMap` instead of `.map` to allow skipping.)
- **Acceptance:** Unit-test `getMemberships()` with a throwing Supabase mock → returns `[]`, and with an orphaned `child_access` row (child null) → row skipped, no throw.

### F2 — Dedupe membership resolution to ONE call per request (reduces transient-failure surface 3×)

- **Scenario:** Transient DB error strikes one of the three identical `getMemberships()` calls but not the others → inconsistent behavior (layout OK, page crashes, or vice versa).
- **Current:** layout calls it, `setActiveChild()` calls it again, page calls it a third time.
- **Desired:** Exactly one membership fetch per request, shared via React `cache()`.
- **Exact change** — `src/lib/tenant/actions.ts`:
  ```ts
  import { cache } from "react";
  const getMembershipsCached = cache(getMembershipsUncached); // rename current body
  export async function getMemberships(): Promise<TenantMembership[]> {
    return getMembershipsCached();
  }
  ```
  And change `setActiveChild(childId)` to **accept the already-resolved memberships** instead of re-fetching:
  ```ts
  export async function setActiveChild(childId: string, memberships: TenantMembership[]): Promise<void> {
    const match = memberships.find((m) => m.child_id === childId);
    if (!match) {
      logServerError({ route: "tenant/setActiveChild", op: "membership lookup", detail: "not_a_member_of_child" });
      notFound(); // not a throw — renders the 404 page, not the error boundary
    }
    // ... set cookie ...
  }
  ```
  Update `layout.tsx` to pass its `memberships` through. This also fixes T2 (throw → `notFound()`).
- **Acceptance:** Instrumented request shows 1× `child_access` query; slug-mismatch renders 404 page, never the global error page.

### F3 — `getSchoolOverview()` degrades to partial data instead of throwing (scenario: what if it throws?)

- **Scenario:** `classes`/`grades` query fails, or the `due_next` **view is missing** (the exact class of bug that caused the 2026-10-12 staging outage — code ahead of migration), or RLS denies one table.
- **Current:** `throw new ApiError(...)` → whole dashboard crashes → "bad state" page.
- **Desired:** Dashboard shell renders with the data that *did* load; failed sections show an inline "couldn't load, retry" card. The page never crashes because one query failed.
- **Exact change** — `src/server/services/school.ts`, `getSchoolOverview()`:
  - Change return type to `{ overview: SchoolOverview; errors: string[] }` (or add an `errors` field onto the overview object).
  - Wrap each query block (`classes`, `grades`, `grade_snapshots`, `due_next`, `hasCheckinToday`) in its own try/catch; on failure, log structured error and fall back to `[]` / `false` for that block, pushing a code like `"classes_unavailable"` into `errors`.
  - Keep `ApiError` throws for the *API route* callers if they need them — but the page path must not throw. (If API routes share this function, add an opts param `{ strict: boolean }`; pages call with `strict: false`.)
- **Exact change** — `src/components/overview/overview-dashboard.tsx`:
  - Accept the new `errors` prop; render a dismissible warning banner ("Some school data couldn't load — [Retry]") when non-empty.
  - Null-guard the top: `const classes = [...(overview?.classes ?? [])]`, `const dueNext = overview?.due_next ?? []`, `overview?.checkin_today ?? false`.
- **Acceptance:** Drop the `due_next` view (or revoke select) in a staging DB → `/c/<slug>/` still renders the dashboard shell with a warning banner and Retry button; restoring the view clears it on next load.

### F4 — Zero memberships → onboarding redirect, never a crash (scenario: what if the user has no memberships?)

- **Scenario:** Fresh user, all children soft-deleted, or F1 returned `[]` after a transient failure.
- **Current:** `layout.tsx` → `memberships.find(...)` → `undefined` → `notFound()` → 404 page (confusing for a signed-in user with no children); `page.tsx` same.
- **Desired:** Signed-in user with zero *visible* memberships is routed to onboarding (`/onboarding` or `/select-child` with an empty-state "add your first child" CTA) — a recovery path, not a dead end.
- **Exact change** — `src/app/c/[childSlug]/layout.tsx`:
  ```ts
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding"); // or "/select-child?empty=1"
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();
  ```
  Apply the same guard at the top of each tab page (`page.tsx`, `today/page.tsx`, `school/page.tsx`, `settings/page.tsx`, etc.) — or better, centralize: since layout already guarantees non-empty memberships, pages can rely on it; add the guard in layout only and document the invariant. (Prefer the single layout guard — fewer branches to rot.)
- **Acceptance:** Sign in with a fresh account (no children) → lands on onboarding, never 404/500. Delete the only child → next `/c/<slug>` visit redirects to onboarding.

### F5 — Retry-once on transient DB errors, then a real retry button (scenario: transient failure)

- **Scenario:** Single PostgREST timeout / 502 / connection reset.
- **Current:** Immediate crash → "Try again" button re-runs the *entire* server render (works if transient, but the user gets the scary "bad state" copy first).
- **Desired:** Server retries the failed query once (with a short delay) before giving up; if it still fails, the UI shows a scoped retry control, not the global "bad state" page.
- **Exact change** — new `src/server/db/with-retry.ts`:
  ```ts
  export async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; delayMs?: number }): Promise<T>
  ```
  (default `retries: 1`, `delayMs: 250`; only retries on network/timeout/5xx-class errors — never on 4xx/auth/RLS denials, which are deterministic.)
  - Use it inside `getMemberships()` around the `child_access` query and inside `getSchoolOverview()` per query block (F3's try/catch calls `withRetry`).
- **Acceptance:** Simulate a one-time PostgREST 502 (flaky mock) → page loads with no user-visible error. Simulate persistent failure → inline warning + Retry button (F3), not the global boundary.

### F6 — NULL/missing child fields get fallbacks (scenario: what if the child record has NULLs?)

- **Scenario:** `first_name` NULL, `nickname` NULL, `slug` NULL/empty, `school_name`/`grade_level` NULL (all nullable in practice even where the TS type claims otherwise).
- **Current:** `child.first_name` null flows into UI (blank name); `slug` null breaks `find()` matching silently; `child.id` undefined throws TypeError in `.map()`.
- **Desired:** Sensible fallbacks everywhere; never crash on missing data.
- **Exact change** — `src/lib/tenant/actions.ts` `.map()` (+ F1's skip for missing `id`/`slug`):
  ```ts
  child: {
    id: child.id,
    slug: child.slug,
    first_name: child.first_name ?? "Your child",
    nickname: child.nickname ?? null,
    avatar_url: child.avatar_url ?? null,
    school_name: child.school_name ?? null,
    grade_level: child.grade_level ?? null,
  }
  ```
  And fix the `TenantChild` type in `src/lib/tenant/types.ts`: `first_name: string | null` (make the type honest — it already lies).
- Add a **data-health probe** (see F8): orphaned `child_access` rows (child deleted but access row remains) and children with NULL slug/first_name are reported in the probe output so they get fixed at the source, not just papered over.
- **Acceptance:** Child row with all-nullable fields NULL → dashboard renders with "Your child" fallback, no crash.

### F7 — Per-segment error boundary for `/c/[childSlug]` (stop the global "bad state" page)

- **Scenario:** Anything *still* throws despite F1–F6 (unknown unknowns).
- **Current:** Global `global-error.tsx` → "your account might be in a bad state" + nuclear "start over".
- **Desired:** A scoped `error.tsx` for the child segment: "We couldn't load [child]'s dashboard", with [Try again], [Back to home], and a support reference ID — **no mention of "bad state"**, no push toward account deletion. The global boundary stays as the last resort for truly global failures.
- **Exact change** — new file `src/app/c/[childSlug]/error.tsx` (client component):
  ```tsx
  "use client";
  export default function ChildSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    // Scoped recovery UI: Try again / Back to home (/) / reference ID.
    // Log digest client-side for support; do NOT suggest account deletion here.
  }
  ```
  Copy the Nebula styling from `global-error.tsx` for visual consistency, but different copy and different actions. Also consider `src/app/c/error.tsx` if a `/c` parent segment exists.
- **Acceptance:** Force a throw in a tab page (temporary test hook) → scoped boundary renders with child-aware copy and working Back-to-home; global "bad state" copy never appears for segment errors.

### F8 — "Bad account state" auto-detection probe + self-heal (the proactive piece Mehedi asked for)

- **Scenario:** The *class* of problems, not just instances — detect accounts/children in states that will crash pages, and either self-heal or surface a precise fix.
- **Current:** Nothing detects; users discover via crash.
- **Desired:** A scheduled + on-demand probe that finds and (where safe) repairs bad states.
- **Exact change:**
  1. New server module `src/server/ops/account-health.ts` exporting `probeAccountHealth(userId): Promise<HealthReport>` checking:
     - `users` row exists for the auth user; `profiles` row exists with valid `onboarding_completed`.
     - Every `child_access` row joins to an existing, non-soft-deleted `children` row (orphans flagged).
     - Every visible child has non-null `slug` + `first_name`.
     - `due_next` view exists and is selectable (the missing-view class of bug).
     - `deletion_requested_at`/`permanent_delete_after` columns exist on `children` (the missing-column class of bug from 2026-10-12).
  2. **Self-heal (safe, idempotent):** delete orphaned `child_access` rows whose child is hard-deleted; backfill NULL `nickname`→NULL (no-op), never invent data. Everything else is *report-only*.
  3. **On-demand:** a "Diagnose my account" button in `/c/[childSlug]/settings` → runs the probe for the signed-in user → shows a checklist UI (green/red per check) with one-tap fixes for the safe ones.
  4. **Scheduled:** weekly cron (reuse the existing cron tooling) runs the probe across users created in the last 7 days (the highest-risk cohort: fresh signups mid-migration) and logs red checks with structured IDs for the team. **Read-only except the orphan-cleanup**; never touches user data beyond that.
  5. **Login-time gate:** after OAuth callback, run a *light* version of the probe (checks 1–2 only); if the `users`/`profiles` rows are missing, create them idempotently right there instead of letting `/` crash downstream. (This directly addresses Mehedi's "what if the Google-auth-broken era left partial accounts" hypothesis.)
- **Acceptance:** Seed a test account with an orphaned `child_access` row + missing `profiles` row → probe flags both, self-heal removes the orphan, login-time gate recreates the profile; dashboard loads.

---

## C. New / changed files summary

| File | Change |
|------|--------|
| `src/lib/tenant/actions.ts` | F1 (try/catch + skip orphans), F2 (`cache()` + `setActiveChild` signature), F6 (fallbacks) |
| `src/lib/tenant/types.ts` | F6 (`first_name: string \| null`) |
| `src/app/c/[childSlug]/layout.tsx` | F2 (pass memberships to `setActiveChild`), F4 (zero-membership redirect) |
| `src/app/c/[childSlug]/page.tsx` | F3 (handle `{ overview, errors }`), F4 (document layout invariant) |
| `src/app/c/[childSlug]/today/page.tsx` | F3 (same overview handling) |
| `src/app/c/[childSlug]/school/page.tsx` | F3 (same overview handling) |
| `src/app/c/[childSlug]/settings/page.tsx` + other tabs | F4 invariant; settings gets F8 "Diagnose my account" button |
| `src/app/c/[childSlug]/error.tsx` | **NEW** — F7 scoped boundary |
| `src/server/services/school.ts` | F3 (per-query try/catch, `{ overview, errors }`, `strict` opt) |
| `src/server/db/with-retry.ts` | **NEW** — F5 retry helper |
| `src/server/ops/account-health.ts` | **NEW** — F8 probe + self-heal |
| `src/components/overview/overview-dashboard.tsx` | F3 (null-guards + warning banner) |
| `src/app/auth/callback/route.ts` | F8 (light probe / idempotent profile creation post-exchange) |

---

## D. Rollout order & verification (staging-first, per standing rules)

1. **F1 + F2 + F6** (tenant actions) — smallest blast radius, highest leverage. Unit tests with mocked Supabase (throw / orphan / null-field cases).
2. **F5** (withRetry) — unit tests: flaky-once → success; persistent-5xx → throws after 1 retry; 4xx → no retry.
3. **F3** (school service + dashboard) — staging DB fault injection: drop `due_next` view → dashboard shell + banner (browser-verified).
4. **F4** (onboarding redirect) — fresh test account, browser-verified sign-in → onboarding.
5. **F7** (segment error boundary) — temporary throw hook, browser-verified scoped UI.
6. **F8** (probe + self-heal) — seeded bad-state accounts, probe report verified; cron dry-run first (report-only), self-heal enabled after Mehedi's go-ahead.
7. Full `smoke-test-staging.py` green + **browser end-to-end** (sign in → dashboard → tabs) before any "it works" claim. **TEST BEFORE YOU CLAIM**: nothing is reported working until personally verified in the browser.

Each step: build → deploy to **canonical staging only** (`https://pookie-staging.pages.dev`; ignore the `staging-build.*` branch preview) → test → next. Production untouched without Mehedi's explicit go-ahead.

---

## E. Explicit non-goals / guardrails

- **Do not mask auth/RLS denials as empty data.** F1's catch-all returns `[]` only for *unexpected* throws; RLS `error` results already return `[]` by design today — keep that distinction in logs (log the error code) so a policy misconfiguration doesn't hide as "no children".
- **Do not auto-delete user data** beyond orphaned `child_access` rows (F8). Child/user/profile rows are never auto-deleted or auto-modified.
- **Do not change the global boundary's role.** `global-error.tsx` stays the last resort; F7 just stops segment errors from ever reaching it.
- **Do not "fix" by hiding errors from logs.** Every catch logs a structured error (route, operation, error, timestamp, traceable ID) per the NO BLANK PAGES rule — graceful UI *and* RCA-grade logs.
- **No new env vars, no new tables, no migrations** in this plan. F8's probe is read-only (+ orphan cleanup) against existing schema.

---

## F. Open questions for Mehedi / parent agent

1. F4 redirect target: `/onboarding` or `/select-child?empty=1`? (Recommend `/onboarding` — it's the designed first-run flow.)
2. F8 scheduled probe: weekly OK, or prefer daily for the first 2 weeks post-launch?
3. F8 self-heal scope: orphaned `child_access` cleanup approved in principle, or report-only until reviewed case-by-case?
4. Should the F7 segment boundary also cover `/select-child` and `/onboarding` (sibling segments), or child segment only for now?
