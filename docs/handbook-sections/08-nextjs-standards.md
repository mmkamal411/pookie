# 08 — Next.js 16 App Router Implementation Standards

**Owner:** UI Full-Stack (Engineering Pod) — spec → review → fix → sign-off.
**Applies to:** `~/workspace/pookie-app` (Next.js 16.4, React 19.3, Tailwind v4, `--src-dir`).
**Normative language:** MUST / MUST NOT = blocking; SHOULD = strong default, deviate only with a
written reason in the PR.

Companion findings: `docs/audit-findings/ui-fullstack.md` (migration 001 review),
`docs/audit-findings/ui-fullstack-mobile.md` (mobile scaffold audit).

---

## 8.0 Purpose and non-goals

This section defines how the Pookie web app is built: routing, tenancy enforcement in the App
Router, the Supabase client pattern, component boundaries, mutations, caching, styling, and
deployment. It does **not** define the data model (schema pod), the visual design system (design
pod), or backend worker contracts (workers pod) — it defines how the frontend *uses* them.

Standing context this section encodes:

- Multi-tenant SaaS, email-keyed tenancy; `child_access` is the single source of truth; RLS on all
  tenant tables; `service_role` bypasses RLS (PLAN §3.7, §4.1–§4.2).
- Slug-routed child context from day one: `/c/[childSlug]/...`. Login: OTP → resolve tenants →
  switcher or straight in.
- **Production lesson (binding):** the Supabase client MUST be a singleton. Creating a new client
  per `createClient()` call breaks OTP auth — login "goes nowhere" after the code is accepted.
- Zero-risk tolerance. Staging first; production only on the founder's explicit go-ahead.

---

## 8.1 The Supabase client pattern — singleton in the browser, per-request on the server

### Why the singleton matters (the production lesson, stated precisely)

Supabase browser auth state lives in the client instance's storage adapter and its internal
`auth` event emitter. If module A calls `createClient()` and module B calls `createClient()`
again, the OTP/magic-link verification lands in A's session while the auth gate subscribes to
B — the user is authenticated in one instance and anonymous in the other. Symptom: code accepted,
login "goes nowhere", no errors. **This is not a style preference; it is a correctness rule.**

### The rule, split by environment

| Environment | Rule |
|---|---|
| **Browser** | Exactly **one** client instance for the app lifetime, exported from a single module (`src/lib/supabase/client.ts`). Every Client Component imports it from there. No component, hook, or util may call `createClient()` directly. |
| **Server (RSC, Server Actions, Route Handlers)** | Exactly **one client per request**, built from that request's cookies (`src/lib/supabase/server.ts`). Wrap creation in React `cache()` so all code in one request shares the instance. Never create one client per query. Never hoist a server client to module scope (cookies would leak across requests). |

```ts
// src/lib/supabase/client.ts — BROWSER singleton
"use client"; // not needed; this module is imported by client code only
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
```

```ts
// src/lib/supabase/server.ts — per-REQUEST client (RLS-enforcing)
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const getSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a Server Component: read-only context, ignore */
          }
        },
      },
    },
  );
});
```

Additional MUSTs:

- The **anon key** is the only key the browser and request-scoped server clients may hold. It is
  public by design; RLS is the enforcement layer.
- `service_role` key: **server-only** (`import "server-only"`), read from a non-`NEXT_PUBLIC_`
  env var, used only in explicitly marked modules (e.g. `src/lib/supabase/admin.ts`). Every
  `service_role` code path MUST assert `child_id` explicitly — RLS does not apply, so the
  explicit-child_id invariant (PLAN §4.2) is the only guard. Grep-able marker comment required:
  `// SERVICE_ROLE: asserts child_id explicitly — see §8.6`.
- Never put any key in a Client Component bundle except `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 8.2 Route architecture — slug-routed tenancy from day one

```
/                          marketing / landing (public; includes login entry)
/login                     OTP request + code entry (public)
/auth/callback             OTP/magic-link exchange (route handler)
/start                     post-login tenant resolution (private)
/c/[childSlug]/...         tenant shell — EVERYTHING tenant-scoped lives here
/c/[childSlug]/dashboard
/c/[childSlug]/academics
/c/[childSlug]/learn
/c/[childSlug]/plan
/c/[childSlug]/pookie
/c/[childSlug]/track
/c/[childSlug]/grow
/c/[childSlug]/settings
```

Rules:

- No tenant data is ever rendered outside `/c/[childSlug]`. The `/start` page renders only the
  switcher (or redirects); it fetches `child_access` rows + child display fields, nothing deeper.
- `childSlug` is the **display key only**. The authoritative tenant identifier inside the app is
  always `child_id` (uuid), resolved server-side per request (§8.4). Client code never invents,
  caches across sessions, or transmits `child_id` as authority — the server re-resolves it.
- Slugs are lowercase `^[a-z0-9-]{3,64}$` (audit MEDIUM-2). Writes validate; reads lowercase the
  URL segment before lookup.

---

## 8.3 Proxy — not middleware

Next.js 16 **deprecated `middleware.ts` and renamed it to `proxy.ts`** (per the bundled Next 16
API reference). This codebase MUST use `src/proxy.ts` (same level as `src/app`). Do not create
`middleware.ts` — it will rot under a deprecated convention.

Proxy's job is deliberately **small and cheap** (it runs at the edge, before render, with no DB
access by design):

1. If the request targets `/c/*`, `/start`, or other private routes and **no Supabase session
   cookie is present** → redirect to `/login?next=<path>`.
2. If the request targets `/login` or `/` and a session cookie **is** present → redirect to
   `/start` (tenant resolution decides the rest).
3. Nothing else. **Proxy MUST NOT resolve slugs to tenants, read `child_access`, or branch on
   user roles.** Those need the database; the `[childSlug]` layout owns them (§8.4). Proxy also
   must not import the server Supabase client or any DB helper — keep it dependency-light so it
   stays deployable at the CDN edge.

```ts
// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE_PREFIXES = ["/c/", "/start"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  const isPrivate = PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );

  if (isPrivate && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/") && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/start";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

Session-*presence* is a routing hint, not authentication: every protected read still goes through
the RLS-enforcing server client. A forged cookie buys nothing — RLS rejects it.

---

## 8.4 The `[childSlug]` layout — resolve, validate, reject spoofed slugs

This layout is the **tenant firewall**. Every page under `/c/[childSlug]` inherits its verdict.
It runs on **every request** (it reads cookies ⇒ dynamic; it MUST NOT be prerendered — see §8.8).

Resolution algorithm (server-side, in order):

1. `const { childSlug } = await params;` — **params is a Promise in Next 16; you MUST await it.**
   (In layouts, avoid awaiting at the very top level if it blocks the static shell — pass the
   promise down; here the whole layout is dynamic anyway, so awaiting is correct.)
2. Normalize: `slug = childSlug.toLowerCase()`; reject (→ `notFound()`) if it fails
   `^[a-z0-9-]{3,64}$`.
3. `const supabase = await getSupabaseServerClient();` then
   `const { data: user } = await supabase.auth.getUser();` — unauthenticated → `redirect("/login")`.
   (Use `getUser()`, not `getSession()` — `getUser()` revalidates the JWT with the Auth server;
   `getSession()` trusts the cookie.)
4. Resolve the tenant **through RLS**:
   ```ts
   const { data: child } = await supabase
     .from("children")
     .select("id, slug, first_name, nickname, status")
     .eq("slug", slug)
     .eq("status", "active")          // audit MEDIUM-3: archived slugs must not resolve
     .maybeSingle();
   if (!child) notFound();            // spoofed, foreign, or archived slug → 404, never a redirect guess
   ```
   Because `children_tenant_read` requires `id = ANY (current_child_ids())`, a slug belonging to
   another tenant returns **zero rows** — the spoof is rejected by the database, not by app logic.
5. Load the caller's `child_access` rows; branch the shell (audit MEDIUM-1 — **never branch on
   `users.role`**):
   - 0 rows → render the pending-invite/onboarding state (no tenant chrome, no tenant data).
   - role `'child'` → the resolved `child.id` MUST equal their single access row's `child_id`;
     otherwise `redirect()` to their canonical slug (prevents URL confusion, not a security
     boundary — RLS is the boundary).
   - role `'parent'` → render parent shell for this child.
6. Provide the verified context to the subtree via a server-side context module — **not** via
   client props that a component could tamper with:
   ```ts
   // resolved in the layout, consumed by Server Components below it
   <ChildProvider value={{ childId: child.id, slug: child.slug, role }}>
     {children}
   </ChildProvider>
   ```
   `ChildProvider` here is a Server Component context (or simply prop-drilling through server
   components). Client Components receive `childId` only as a **display/reference value**; any
   mutation re-resolves it server-side (§8.6).

What the layout MUST NOT do:

- MUST NOT call `generateStaticParams` with real slugs (would prerender one tenant's shell into
  a shared cache — cross-tenant leak vector). With `cacheComponents`, dynamic params stay dynamic.
- MUST NOT cache the membership verdict across requests (§8.8).
- MUST NOT trust `users.role` for anything rendering-related.

---

## 8.5 Server vs Client component rules

Default: **Server Component**. Reach for `"use client"` only when you need interactivity, browser
APIs, or client-side state. Concretely:

**Server Components do:** all data reads (via the §8.1 request client ⇒ RLS applies), tenant
resolution, metadata, and composition. They are the only place tenant queries happen.

**Client Components do:** event handlers, form state, animations, charts, editors, and anything
touching `window`/`navigator`/WebView bridges. They receive **already-authorized, minimal data**
as props — never raw query builders, never the server client.

Boundary rules (enforced in review):

1. `import "server-only"` at the top of every data-access module. If a Client Component
   transitively imports it, the build fails — that is the guardrail working.
2. Client Components never import `src/lib/supabase/server.ts`. They use the browser singleton
   (§8.1) only for auth-state subscriptions and realtime; **all tenant reads/writes go through
   Server Components or Server Actions**.
3. Props crossing the boundary must be serializable and **minimal** — pass the rows the UI needs,
   not the query. (Next.js data-security guidance: keep data access on the server.)
4. Hooks (`useState`, `useEffect`, …) always **above all early returns** — React #310. No
   exceptions; this is a review-blocking rule.
5. `next/root-params` (root-level dynamic params) does **not** apply here — `[childSlug]` is not
   a root segment — and it cannot be used in Server Actions or Route Handlers. Pass `childSlug`
   explicitly as a function argument where needed.

---

## 8.6 Server Action conventions — assert `child_id` server-side, never trust the client

Every Server Action that touches tenant data follows this exact shape:

```ts
"use server";
import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveChildContext } from "@/lib/tenant"; // slug → { childId, role } or throws

const Input = z.object({
  childSlug: z.string().regex(/^[a-z0-9-]{3,64}$/),
  // ...action-specific fields, validated
});

export async function updateStudyPlan(rawInput: unknown) {
  const input = Input.parse(rawInput);              // 1. validate shape
  const supabase = await getSupabaseServerClient();
  const { childId, role } = await resolveChildContext(supabase, input.childSlug);
  // 2. childId came from the ROUTE SLUG re-resolved against child_access — never from client state
  if (role !== "parent") throw new Error("forbidden"); // 3. authorize the operation
  const { error } = await supabase
    .from("study_plans")
    .update({ ... })
    .eq("child_id", childId)                         // 4. scope the write explicitly (defense in depth; RLS also applies)
    .eq("id", input.planId);
  if (error) throw error;
  // 5. audit consequential writes
  await supabase.rpc("audit_event", { p_child_id: childId, p_action: "study_plan.updated", ... });
  revalidatePath(`/c/${input.childSlug}/plan`);       // 6. revalidate the tenant-scoped path only
  return { ok: true };
}
```

Rules:

1. **Never accept `child_id` from the client.** Accept `childSlug` (from the route, which the
   layout already validated) and re-resolve it against `child_access` inside the action. A
   mismatched or spoofed slug fails closed at step 2.
2. **RLS is the floor, explicit scoping is the wall.** Always include `.eq("child_id", childId)`
   on writes even though RLS would reject cross-tenant writes — belt and suspenders, and it
   makes tenant scoping grep-able.
3. **Authorize the operation**, not just the tenant: check `role` from `child_access`
   (parent-only vs child-allowed) per action.
4. **Validate all input** with zod at the action boundary. Reject unknown fields (`.strict()`).
5. **Audit consequential mutations** via the `audit_event` RPC (migration 004) — grades-affecting
   writes, consent changes, credential rotations, invites, messages sent.
6. **Revalidate narrowly**: `revalidatePath`/`revalidateTag` scoped to the tenant path. Never
   `revalidatePath("/", "layout")`.
7. Actions return small serializable results `{ ok, ... }` — never full rows the client didn't
   already have access to.
8. `service_role` actions (rare: e.g. worker-adjacent admin jobs) MUST carry the
   `// SERVICE_ROLE` marker and assert `child_id` explicitly before any query (PLAN §4.2).
   Prefer RLS paths; service_role is the exception, not the tool.

---

## 8.7 Auth flow — OTP → resolve → switcher → tenant

1. `/login` — user enters email → `supabase.auth.signInWithOtp({ email })`. Rate-limit the button
   client-side; surface "check your email".
2. `/auth/callback` (Route Handler) — exchanges the `code` for a session, sets cookies, then
   redirects to `/start`. It MUST use the per-request server client (§8.1) so cookies land on the
   response. Edge-safe (fetch-based; no Node APIs).
3. `/start` — the tenant resolver (Server Component):
   - `getUser()` → unauthenticated ⇒ `/login`.
   - `SELECT child_id, role FROM child_access WHERE user_id = auth.uid()`:
     - **0 rows** → check for a pending invite for this email → if found, call `consume_invite`
       and re-query; else render the pending-invite state (PLAN §4.1). Never render tenant UI.
     - **1 row, role='child'** → `redirect(/c/<slug>)`. No switcher, ever.
     - **1 row, role='parent'** → `redirect(/c/<slug>)`.
     - **N rows, role='parent'** → render the switcher (cards: name, photo, school). The chosen
       card links to `/c/<slug>` — the layout re-validates on arrival.
4. `/c/[childSlug]/...` — layout firewall (§8.4) takes over.

Notes:

- The hCaptcha lesson from the legacy stack stands: **automated sign-in flows loop on hCaptcha —
  the user signs in manually**; the app never attempts programmatic OTP completion.
- Public signups stay OFF (Supabase Auth config); the invite allowlist is the only door.
- `active_child_id` as a UI hint may live in localStorage, but it is **never authoritative** —
  the server re-resolves from the slug on every request.

---

## 8.8 Caching rules under `cacheComponents: true`

`next.config.ts` sets `cacheComponents: true` (and `partialPrefetching`). Consequences the team
must internalize:

1. **Routes prerender by default.** Any component that reads the session/cookies (tenant layout,
   `/start`, all of `/c/*`) opts into dynamic rendering automatically — do not fight this, and
   do not try to force-static tenant routes.
2. **Session reads stream behind `<Suspense>`.** Per the Next 16 auth-with-cache-components
   guidance: the static shell (branding, skeleton) prerenders; the authenticated/tenant UI streams
   in. Design every tenant page as shell + Suspense holes.
3. **`'use cache'` may not read the session.** A cached function cannot call `cookies()` and
   cannot receive a session-derived value smuggled in as an argument. Therefore: **tenant data
   fetches are never `'use cache'`-cached by tenant implicitly** — if you cache derived data,
   the cache key must include the resolved `childId` explicitly AND the lifetime must be short,
   AND revocation-sensitive data (membership, consents) must stay uncached/dynamic.
4. **Membership is resolved per request, never cached across requests** (audit MEDIUM-4). A
   revoked parent must lose access on the next navigation, not after a cache TTL.
5. **`'use cache: private'`** (browser-only cache) is acceptable for non-authoritative UI hints
   (display name, avatar) — never for authorization decisions.
6. Prefetching (`<Link prefetch>`) of `/c/[slug]` pages is safe: prefetches execute with the
   requester's cookies and RLS still applies per request.

---

## 8.9 React 19 patterns in use

- **No `forwardRef`.** Ref is a normal prop in React 19: `function Input({ ref, ...props })`.
- **`use()` for promises** in Client Components (e.g. unwrapping a passed promise) instead of
  manual `useEffect`+state.
- **Forms:** `useActionState` + `useFormStatus` for Server-Action-backed forms (pending states,
  optimistic UI via `useOptimistic` where warranted). No ad-hoc `fetch` to hand-rolled endpoints
  when a Server Action will do.
- **Server functions as props:** a Client Component may receive a Server Action as a prop and call
  it — this is the standard interactive-mutation path (progressive enhancement preserved).
- **Error boundaries per section:** every major tenant section gets its own `error.tsx` so one
  failing widget (grades, sync console) doesn't take down the dashboard. Pair with per-section
  `loading.tsx` skeletons that match the Suspense design (§8.8).
- **No `useMemo`/`useCallback` cargo-culting.** React Compiler territory aside, memoize only with
  measured cause.

---

## 8.10 Tailwind v4 conventions

Tailwind v4 is CSS-first: theme tokens live in `globals.css` under `@theme`, not in a JS config.

```css
@import "tailwindcss";

@theme {
  /* semantic tokens — components never use raw hex */
  --color-ink-900: #0b3b3e;      /* deep teal (dark surfaces) */
  --color-paper: #eef7f8;        /* light surface */
  --color-paper-dim: #d7e9eb;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --spacing-safe-top: env(safe-area-inset-top);
  --spacing-safe-bottom: env(safe-area-inset-bottom);
}
```

Rules:

- **Semantic tokens only in components.** No arbitrary hex (`bg-[#383838]`) outside the theme
  definition. The legacy clean-teal palette carries over as named tokens.
- **Dark mode:** class-based (`dark:` variant) with a single source of truth for the theme toggle;
  do not rely on `prefers-color-scheme` alone (the scaffold's media-query approach is replaced).
- **Contrast:** no light-on-white / low-contrast pairs — a review gate, especially for the
  grade-gap "mission framing" headers.
- **Motion:** `motion-safe:` / `motion-reduce:` variants; respect `prefers-reduced-motion`.
- **Mobile:** `dvh` units, safe-area tokens, `active:` states paired with every `hover:`
  (audit `ui-fullstack-mobile.md`).

---

## 8.11 Cloudflare Pages deployment constraints — edge vs node runtime

The app deploys to Cloudflare Pages (`pookie.pages.dev`, staging `pookie-staging`). Next.js on
Pages runs on **Workers (V8 isolates)** — there is no Node.js server. This constrains the code:

1. **Default to edge-safe code everywhere.** Use Web APIs (`fetch`, `Request`/`Response`,
   `crypto.subtle`, `TextEncoder`) — never Node builtins (`fs`, `path`, `crypto` node module,
   `child_process`) in app code. If a dependency pulls Node builtins, it cannot ship in a route
   that runs on Pages.
2. **Declare runtime explicitly** on any route that needs it:
   `export const runtime = "edge";` — the default for new routes SHOULD be edge. `runtime =
   "nodejs"` is only meaningful with the `nodejs_compat` flag and SHOULD be avoided; if ever
   needed, it requires a written justification and DevOps sign-off.
3. **Supabase clients are edge-safe** (`@supabase/ssr` is fetch-based) — no constraint there.
4. **`next/image` optimization** on Pages is served by the platform adapter — verify remote image
   domains in `next.config.ts` `images.remotePatterns`; no custom loader hacks.
5. **No long-running work in routes/actions.** Syncs, ETL, and tutor inference belong to workers
   and laptop cron jobs, not to the request path. Route handlers have CPU/wall-clock limits —
   keep them to auth exchange, webhooks, and thin proxies.
6. **Env vars:** `NEXT_PUBLIC_*` are inlined at build time per environment (staging vs prod get
   separate builds). Secrets (`SUPABASE_SERVICE_ROLE_KEY`, worker tokens) are Pages environment
   variables / secrets — never `NEXT_PUBLIC_`, never in the repo.
7. **CSP:** new backend domains (worker hosts, Supabase URL) go into `connect-src` in the
   platform headers config and the live header is verified post-deploy (legacy lesson, still
   binding).
8. **Deploy hygiene (binding legacy lessons):** staging first, founder verifies, production only
   on explicit go-ahead; `?v=` asset bumps rewritten unconditionally with a single-version
   post-deploy check; favicon ICO rebuilt as RGBA and copied over `out/favicon.ico` after build.

---

## 8.12 Error, loading, and not-found conventions

- `not-found.tsx` at `/c/[childSlug]` level: "We couldn't find this child space." — identical
  copy for nonexistent, foreign, and archived slugs (never distinguish; distinguishing leaks
  tenant existence).
- `forbidden.tsx` (Next 16 convention): operation not permitted for this role.
- `error.tsx` per section (§8.9) with a retry affordance and an error report hook (audit-logged
  client error, no PII in the message).
- `loading.tsx` skeletons mirror the final layout to avoid CLS.

---

## 8.13 Mobile strategy — native apps via Capacitor (founder directive)

**Directive:** Pookie ships on the Apple App Store and Google Play as native mobile apps.

### Recommendation: Option A — Capacitor (native shells around the Next.js app)

**Justification, weighed against the alternatives:**

- **Option C (PWA) is honestly disqualified.** It cannot satisfy the directive: no App Store /
  Google Play presence without a wrapper (which would just be Capacitor/TWA with extra steps),
  no HealthKit / Health Connect access, no background GPS, and iOS Web Push remains second-class
  (home-screen-web-app only, user-hostile enrollment). PWA-grade web hygiene is still required —
  it improves the WebView too — but PWA is not the deliverable.
- **Option B (React Native / Expo) is the stronger *native* technology and the fallback**, but it
  means a second codebase: Expo Router instead of the App Router, no React Server Components, and
  every tenant-isolation rule in this document re-implemented and re-audited in a second client.
  For a zero-risk-tolerance, small-team build where the web app already encodes the security model
  (RLS + server-resolved `child_id` + Server Actions), duplicating the client doubles the
  isolation-audit surface for marginal UX gain. Defer unless WebView UX demonstrably fails.
- **Option A wins on:** one codebase (the Next.js app *is* the mobile app UI); the entire
  tenant-security model (§8.4–§8.8) applies unchanged because it all executes server-side;
  native API needs (push, HealthKit/Health Connect, GPS, camera, secure storage, biometrics) are
  covered by Capacitor plugins; and the team stays web-shaped.

### How the App Router survives inside a Capacitor WebView (the critical mechanics)

Server Components need a server — and they keep theirs. Capacitor is **not** asked to bundle the
Next.js app:

- The native shells load the app from a **remote URL** (`server.url`, e.g.
  `https://pookie.pages.dev`) — the Cloudflare Pages deployment. The WKWebView (iOS) / Android
  WebView is purely a rendering client: it receives RSC payloads, streams Suspense boundaries,
  and POSTs Server Actions back to the same origin. The full App Router model — Server Components,
  RLS-enforcing per-request clients, Server Actions, proxy redirects — works unchanged.
- **Static export (`output: "export"`) is FORBIDDEN for this architecture.** It would kill Server
  Components, SSR, and Server Actions — the entire security model. Capacitor MUST run in
  remote-URL mode. This is a binding constraint, not a preference.
- **Auth in the WebView:** Supabase session cookies are first-party to the loaded origin, so
  `httpOnly` cookies work normally. OTP magic links must open *inside* the WebView: configure
  universal links (iOS) / app links (Android) for the app domain so `/auth/callback` completes
  in-app and cookies land in the WebView's jar. Test the cold-start-from-email-link path on both
  platforms before TestFlight.
- **Gotchas:** (1) WKWebView has no shared cookie jar with Safari — users sign in separately
  in-app (expected). (2) Streaming/Suspense works — WKWebView is a modern engine. (3) `100vh`
  quirks and safe areas apply with extra force — see the mobile audit checklist (§8.13.4).
  (4) Offline = the honest degraded mode (§8.8/MEDIUM-4): no network, no server render; the
  native shell should show a branded offline screen, not a blank WebView.

### Bridge inventory — which device API serves which module

| Module need | iOS | Android | Notes |
|---|---|---|---|
| **Push notifications** (core "proactive mother" thesis: nudges, geofence alerts, school alerts) | `@capacitor/push-notifications` → APNs | same plugin → FCM | Server sends via APNs/FCM using per-device tokens. **Tenant rule:** token registration MUST bind `device_token ↔ (user_id, child_id)` server-side; push topics/channels are per-`child_id` (e.g. `tenant:<child_id>:alerts`). Never trust a client-claimed topic. (Security pod: token↔child binding review.) |
| **Health sync — Apple HealthKit** | community `capacitor-healthkit` plugin (read steps, sleep, HR, workouts) | — | Read-only; user grants per data type in-app. |
| **Health sync — Health Connect** | — | community Health Connect plugin (fragmented — verify maintenance before committing; fallback: thin in-house native bridge) | Same read-only posture; record provenance per tenant. |
| **Location — foreground** | `@capacitor/geolocation` | same | Arrival/departure checks while app is open. |
| **Location — background / geofence** | dedicated background-geolocation plugin (low-power significant-change + region monitoring first) | same | **App Store review risk:** always-on background location needs a defensible justification (family safety) and a visible user benefit; design geofence-first, continuous-tracking-never. Foreground-only v1 is acceptable. |
| **Secure storage** (refresh tokens, device secrets) | Keychain via secure-storage plugin | Keystore via same | Never `localStorage` for secrets. |
| **Camera** (physical-mail intake photo snap — existing product flow) | `@capacitor/camera` | same | Upload path unchanged: signed URLs to the tenant Storage prefix. |
| **Biometrics** (app lock) | community fingerprint/biometrics plugin (Face ID/Touch ID) | same (fingerprint/face) | Convenience lock only — never a substitute for the Supabase session. |
| **Haptics / share / filesystem** | `@capacitor/haptics`, `share`, `filesystem` | same | Polish and export flows. |

### How the Next.js codebase maps to the native shell

- `src/app/**` — unchanged. The same routes serve web and WebView; add a `?shell=native`
  (or user-agent) hint only for chrome differences (hide "install app" banners, adjust safe-area
  padding), never for security decisions.
- `src/lib/native/` (new) — the bridge layer: a typed wrapper around Capacitor plugins with
  **web fallbacks** (e.g. `getPushToken()` resolves `null` on web). Client Components call this
  layer, never `@capacitor/*` directly — one seam to mock in tests and to stub on web.
- Token/health/location writes from the device go through **Server Actions / route handlers**,
  which re-resolve `child_id` from the session + route slug (§8.6). The native bridge never
  asserts tenancy.
- Native shell projects (`ios/`, `android/`) are thin: plugin config, icons/splash, universal
  links, entitlements (HealthKit, background modes, push). They contain no product logic and no
  secrets. DevOps owns the signing/pipeline (parallel input).

### Mobile-web standards that ship with v1 (from the scaffold audit)

- `viewport` export (`device-width`, `initialScale: 1`, `viewportFit: "cover"`, `themeColor`).
- `dvh` app shell, safe-area tokens on all fixed chrome.
- `active:` + `focus-visible:` paired with every `hover:`; 44pt minimum touch targets.
- Form inputs ≥16px (iOS auto-zoom trap).
- Global offline indicator + per-screen degraded states.
- Client-JS budget per route (CI gate).

---

## 8.14 Sign-off checklist (component complete only when all are true)

- [ ] Browser singleton module + per-request server client module exist and are the only
      Supabase entry points; `server-only` guards data-access modules.
- [ ] `src/proxy.ts` exists (no `middleware.ts`); it does session-presence routing only.
- [ ] `/c/[childSlug]` layout implements the §8.4 firewall: per-request RLS resolution,
      `status='active'` filter, slug normalization, `notFound()` on miss, `child_access`-based
      shell branching (never `users.role`), 0-row pending state.
- [ ] No `generateStaticParams` with real slugs; no cross-request caching of membership.
- [ ] Server Actions follow the §8.6 shape (zod, re-resolve, authorize, scope, audit,
      narrow revalidation).
- [ ] Auth flow matches §8.7; signups OFF; hCaptcha lesson observed.
- [ ] `08` audit compensations all addressed or tracked.
- [ ] Mobile: Capacitor remote-URL decision recorded; `output: "export"` banned in config review;
      bridge inventory reviewed with Security (token↔child binding) and DevOps (signing/pipeline).

---

*End of §08. Signed: UI Full-Stack, Engineering Pod — 2026-10-11.*
