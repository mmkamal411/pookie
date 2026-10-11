# 02 — Frontend Component Patterns

**Owner:** Senior Frontend Developer (Frontend component patterns)
**Status:** draft for pod review
**Applies to:** the Pookie greenfield app — Next.js 16 + TypeScript + Tailwind,
Supabase (`pookie` project), Cloudflare Pages.
**Normative companion:** `docs/audit-findings/frontend-dev.md` (findings F1–F13).
Where this handbook and the migration disagree about authority, **the database
wins**: `child_access` is the single source of truth, RLS is the enforcement
point, and the frontend is a well-behaved client of both.

---

## 1. The one rule that governs everything

> **The frontend never decides who may see what. It only decides what to render
> once the server has decided.**

Every pattern below is an instance of this. `active_child_id` is a *hint* the
client keeps for convenience; the *authority* is `child_access` read through
RLS. Any component, hook, or route that treats client state as proof of access
is a bug, even if RLS would have stopped the data — because the UI would have
already promised something untrue (wrong child's name in the header, a switcher
for a child-role user, cached rows after revocation).

---

## 2. Tenant-context plumbing: how `active_child_id` flows

### 2.1 Source of truth and session cache

```
auth.uid()  →  child_access (via RLS)  →  access set: [{child_id, role}, …]
                                                    ↓ (client keeps a copy)
                                          TenantProvider state
                                           + localStorage hint
```

- **Resolution** happens once per session start (and again on window focus, on
  consume/revoke events — see §6): `supabase.from('child_access').select('child_id, role')`.
  This is a cheap, RLS-protected query. Do not cache it aggressively; it is the
  cheapest revalidation we have.
- **The hint:** `localStorage['pookie:active_child:<authUserId>']`. Namespaced
  per auth user — never a global key (shared family devices). The app may
  *propose* this value at boot, but must intersect it with the freshly resolved
  access set before rendering anything tenant-scoped. Mismatch → discard the
  hint, re-route (switcher / straight-in / pending-invite per §4).
- **In-memory:** a `TenantProvider` (React context) holds `{ accessRows,
  activeChildId, activeRole, setActiveChild }`. All tenant-scoped data hooks read
  the child id from this context — never from props drilled five levels, never
  from `useSearchParams`, never from localStorage directly.

### 2.2 Setting a new tenant (the switcher)

`setActiveChild(childId)` must:

1. Assert `childId ∈ accessRows` **client-side** (fail fast, friendly error).
2. Persist the namespaced localStorage hint.
3. **Purge the previous tenant's cache** — `queryClient.clear()` (or
   `removeQueries` keyed by the old child id), reset Zustand/in-memory stores,
   abort in-flight tenant queries. There is no "keep the old dashboard warm in
   the background": cross-tenant caches are forbidden (see §8).
4. Navigate to the new dashboard. Server-side, RLS re-enforces membership on
   every query regardless — step 1 is UX, RLS is the guarantee.

### 2.3 Server re-validation

- Server Components, Route Handlers, and Server Actions **never accept a
  `child_id` from the client as authority**. They derive the caller via
  `supabase.auth.getUser()` and filter by the access set (or rely on RLS on the
  anon/authenticated client — same thing, enforced in Postgres).
- Service-role paths (sync workers, admin jobs) **bypass RLS** and must therefore
  carry an explicit `child_id` parameter and **assert membership in application
  code** before touching data. A service-role call without an asserted `child_id`
  is a defect by definition.

### 2.4 What goes in the URL

- Prefer **no `child_id` in URLs**: the tenant lives in session context, so
  `/dashboard`, `/classes/geometry`, `/track` are all implicitly "for the active
  child". This removes an entire class of spoofing/validation bugs.
- Where a child must be addressable (invite accept links, share links), use
  opaque tokens or the canonical `slug` — and **validate membership server-side
  before rendering**. A URL is user input; treat it as hostile.

---

## 3. Component patterns

### 3.1 Page anatomy (every route)

```
app/<route>/page.tsx            — Server Component: auth + tenant resolution,
                                   redirects; renders <RouteShell>
components/<domain>/<X>View.tsx — client boundary: TenantProvider consumer,
                                   data hooks, composition only
components/<domain>/sections/*  — presentational sections; props in, UI out;
                                   no direct Supabase calls
```

- Pages stay thin: resolve session → resolve tenant → redirect-or-render.
- Data fetching lives in hooks (`hooks/useGrades.ts`, …), keyed by
  `['tenant', activeChildId, ...]`. Hooks are the *only* place that call
  Supabase from client components.
- Presentational sections take plain props and are unit-testable without a
  Supabase mock. They never import the Supabase client.
- **Hooks above all early returns** (React #310 — a standing rule from the old
  stack that carries over). Every tenant hook handles `activeChildId == null`
  by returning `{ data: null, status: 'no-tenant' }`, never by throwing.

### 3.2 Error boundaries and null-safety

- Each page gets a per-section error boundary; one failing widget (grades,
  inbox, health) must not take down the dashboard. This is a standing pattern.
- Loaders are null-safe: `data?.classes ?? []`, never `data.classes.map` on a
  possibly-null payload. RLS-denied or revoked-mid-session responses arrive as
  *empty*, not as errors — code accordingly (§6).

### 3.3 Theming and tone

- Clean-teal design tokens (`bg-ink-900`, `text-paper`, `text-paper-dim`; light
  `#eef7f8`, deep-teal; dark deep-sea; neon soft/diffused, never harsh).
- Class pages follow the standing psychology-first contract: lead with the gap
  to 90 (mission framing), numeric + letter grade side by side separated by a
  line, color-coded sections, no light-on-white contrast, top-3 ranked actions,
  shame-free language, per-action checkboxes.

### 3.4 Reusable primitives

- `TenantGate` — renders children only when `activeChildId` is resolved and in
  the access set; otherwise renders the tenant-resolution skeleton (never a
  flash of wrong-tenant content).
- `RoleGate({ allow: ['parent'] })` — hides parent-only UI (Family management,
  invites, per-child Data tab with export/delete). **Visibility only** — the DB
  policies are the enforcement; the gate just keeps the UI honest.
- `EmptyState`, `ErrorState`, `Skeleton` — shared, themed, copy-reviewed (§5).

---

## 4. Auth-gate patterns

### 4.1 The resolution cascade (single implementation, used everywhere)

After OTP sign-in (or session restore), run exactly one cascade:

```
1. getUser() → no session → /login
2. fetch child_access rows (user_id = auth.uid())
3. rows.length === 0:
     a. fetch invites WHERE email = own email AND status = 'pending'
        → found: render invite-accept screen → consume_invite(token)
                 → on ANY failure, re-run step 2 (finding F8), then (b)
        → none:  render pending-invite state (finding F3 — informational only,
                 no dead "Request access" button until the backend exists)
4. rows.length === 1:
     role child  → straight to that child's dashboard. No switcher. Ever.
     role parent → straight to that child's parent dashboard.
5. rows.length > 1 (parent by construction — DB forbids N rows for child-role):
     → child-switcher screen (cards: name, photo, school)
```

- Implement this cascade **once** (a `useTenantResolution` hook + a server-side
  equivalent for Server Components) and reuse it in every entry point. Forked
  copies of the cascade are how "sometimes the switcher flashes for a child"
  bugs are born.
- Derive role from the `child_access` rows only — never from `users.role`
  (finding F5: it reads `'parent'` for child invitees until consumption).

### 4.2 Route guards

| Route | Guard |
|---|---|
| `/login`, `/auth/callback` | If session exists → run cascade (don't strand logged-in users on the login page) |
| `/switcher` | If all rows are `role='child'` → redirect to their dashboard (finding F10). If 1 row total → redirect per §4.1 step 4 (switcher with one card is a bug). |
| `/family/**`, `/children/**`, invite management | Parent-role rows required; child-role → 404-style redirect to dashboard (with `RoleGate` hiding the nav too). |
| `/pending-invite` | Reachable with 0 rows; renders **zero** tenant data, zero tenant nav, generic document title (finding: no data leakage before access is granted). |
| Everything else | `TenantGate`: no resolved `activeChildId` → skeleton, never partial render. |

### 4.3 OTP session handling

- Email-link OTP lands on `/auth/callback?token_hash=…&type=…`: exchange via
  `exchangeCodeForSession` (PKCE — required on Cloudflare Pages; the implicit
  flow is not reliable cross-domain), then `router.replace` to strip the token
  from the URL immediately. A token lingering in the address bar is shareable.
- Client-side resend rate limiting (e.g., 60s cooldown); expired/invalid codes
  get "request a new link" copy, never token internals.
- Render the CAPTCHA container if the new project's Auth settings enable it
  (carried-over standing rule from the old stack).
- Sign-out is a full teardown: `supabase.auth.signOut()` → clear all `pookie:*`
  storage → reset query caches → navigate to `/login`. There is no "soft" logout.

### 4.4 Invite acceptance UX

- Entry: link `?token=…` or the pending-invite screen's fetched pending invite.
- Before calling `consume_invite`, show the signed-in email verbatim and confirm
  it matches the invite's recipient ("This invite was sent to X — you're signed
  in as Y" → offer to sign out and switch). This pre-empts finding F6 dead-ends.
- After consumption (or on any consume error): **re-run the cascade** (F8).
- Never render raw `token` values anywhere; discard from state after the call.

---

## 5. Loading / error / empty states

| State | Pattern |
|---|---|
| Tenant resolving | Full-screen themed skeleton with neutral copy ("Getting your workspace ready…"). No tenant name, no child photo — the hint may be wrong. |
| Data loading (per section) | Section skeletons; dashboard renders sections independently so one slow query doesn't block the rest. |
| Empty (legitimately no data) | `EmptyState` with a next action ("No check-ins yet — add today's"), never a blank card. Distinguish *empty* from *denied* in code, even if the copy is similar. |
| RLS-denied / revoked mid-session | Treat as a tenant event, not a data error: re-run resolution; if the active child vanished from the access set → purge its cache → switcher or pending-invite (finding F9). Copy: "Your access changed — pick a workspace." Log the transition for audit. |
| Invite errors | One generic message for all consume failures (finding F7). Raw codes to console/telemetry only. |
| Network failure | `ErrorState` with retry; retry re-runs the hook, not a page reload. |
| Pending-invite (0 rows, no invite) | Informational only until the request-access backend exists (F3): identity shown, "no family workspace found for this email", human next step. No tenant nav, no prefetch of tenant queries, generic `<title>`. |

**Copy rules for auth-adjacent states:** never name a child the user can't
access, never confirm or deny the existence of other tenants ("not found" and
"no access" get the same screen), never expose token or error-code internals.

---

## 6. The child-switcher UX contract

1. **Who sees it:** sessions with ≥2 access rows. By DB construction these are
   all parent-role. **Child-role users never see it** — not as a screen, not as
   a nav item, not as an empty state. The `/switcher` route guard (§4.2) is the
   backstop; the cascade (§4.1) is the primary path.
2. **What it shows:** cards with child name, photo, school — data that comes
   from the already-RLS-filtered `children` query. Nothing else. No grades, no
   snippets, no badges with counts (those are separate queries and separate
   latency; the switcher must be instant).
3. **What switching does:** the `setActiveChild` sequence in §2.2 — client-side
   membership assert, hint persist, **full previous-tenant cache purge**,
   navigate. The outgoing tenant's data must be unrecoverable from the client
   afterwards (memory + storage).
4. **Single-child sessions never see it**, even transiently: the cascade routes
   1-row sessions straight to the dashboard. A flash of the switcher for a
   1-row user is a routing bug — fix the cascade, don't add a loading delay.
5. **Switcher is not a security boundary.** It is a convenience. If someone
   hand-crafts state to "select" a child outside their access set, step 1 of
   §2.2 rejects it client-side and RLS rejects it server-side. Both must hold.

---

## 7. What the frontend must NEVER do

1. **Never treat `active_child_id` (or anything in localStorage) as proof of
   access.** It is a hint. Membership is re-derived from `child_access` via RLS.
2. **Never cache data across tenants.** Query keys include the child id; tenant
   switch = cache purge. No "recently viewed child" preloads, no background
   refetch of the inactive tenant.
3. **Never put a raw `child_id` in a URL as the authority.** Tenant comes from
   session context; URLs stay child-agnostic. Addressable links use opaque
   tokens/slugs and are validated server-side.
4. **Never gate role UI on `users.role` or `children.parent_user_id`.**
   Role comes from `child_access` rows; `parent_user_id` is a billing anchor.
5. **Never render the switcher (or its nav entry) for child-role sessions.**
6. **Never render invite issuance/management for child-role sessions** — and
   never assume hiding it is sufficient (finding F1: the policy must also be
   tightened).
7. **Never fire tenant-scoped queries in the pending-invite / logged-out states.**
   RLS would return empty, but the *attempt* is the leak-shaped bug: prefetch
   lists, nav badges, and service workers must all be tenant-gated.
8. **Never persist cross-account state under a global key.** All persisted keys
   are namespaced `pookie:<scope>:<authUserId>`. Sign-in as a different email =
   full client reset.
9. **Never echo backend error codes, tokens, or invite internals in UI copy.**
   One generic message for auth failures; details to telemetry.
10. **Never let a service-role call run without an asserted `child_id`.**
    Service role bypasses RLS — the frontend/backend code that invokes it owns
    the membership check. "The worker needs it" is not an assertion.
11. **Never show placeholder seed data as real.** The `consume_invite` child
    shell (`'New'/'Child'`) is behind a mandatory profile-completion gate; no
    dashboard renders until it completes.
12. **Never keep showing cached rows after access is revoked.** Empty-set
    responses are tenant events: re-resolve, purge, re-route (§5).

---

## 8. Review checklist (sign-off gate for any frontend change touching auth/tenancy)

- [ ] Tenant resolution goes through the single cascade (§4.1) — no forks.
- [ ] Role derived from `child_access` rows only.
- [ ] `setActiveChild` asserts membership client-side AND purges prior tenant cache.
- [ ] No `child_id` in URLs as authority; no client-supplied `child_id` trusted by server code.
- [ ] Switcher unreachable/unrendered for child-role and 1-row sessions.
- [ ] Pending-invite state renders zero tenant data and fires zero tenant queries.
- [ ] Sign-out clears namespaced storage + in-memory caches.
- [ ] Auth error copy is generic; no tokens/codes in UI or logs.
- [ ] New family shell gated behind profile completion; no placeholder names rendered.
- [ ] Service-role invocations carry and assert an explicit `child_id`.

*End of section 02. Open items: F1–F3 + Director decisions 1–3 in
`docs/audit-findings/frontend-dev.md` must be resolved before invite UI is built.*
