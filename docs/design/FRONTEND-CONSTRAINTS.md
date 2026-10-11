# Frontend Constraints — the buildability map for Pookie navigation + visual concepts
**Owner:** Frontend Architect · **Date:** 2026-10-11 · **Status:** WAVE 1 DELIVERABLE
**Audience:** all design specialists (Wave 1–4) and the build team
**Stack reality:** Next.js `~16.3.8` + React 19.3 + Tailwind v4, deployed via `@opennextjs/cloudflare` (full Next.js runtime on Cloudflare Pages — **not** static export, per ADR-004). Primary data plane is **client → Supabase direct** under RLS (ADR-001/002/003); API routes exist only for privileged ops. Capacitor mobile ships in **remote-URL mode** — the WebView loads `https://pookie.pages.dev`, so every navigation decision also ships to the phone.

**How to read this doc:** every concept is scored against what the App Router gives us *for free* vs. what we must hand-build. The App Router is a layout-and-routing engine, not an animation engine — the designs that win are the ones that let the router do routing and let CSS do motion. Sparring-partner rule in force: **enable ambition, kill fantasy.**

---

## 1. Navigation patterns — cost/benefit

Legend: **Cost L** = App Router native, days of work. **Cost M** = hand-built component + state, 1–2 weeks. **Cost H** = fights the router, fragile, weeks+ of maintenance.

### 1.1 Bottom tab bar — **Cost L · RECOMMENDED as primary mobile nav**
- **Build:** trivially cheap. A persistent `app/(tabs)/layout.tsx` wraps tab routes; the tab bar never remounts on tab switches because the layout persists. Active state = `usePathname()` from `next/navigation`. No animation library needed — CSS transform for the indicator pill.
- **Mobile:** native-feeling, thumb-zone correct, survives iOS Safari quirks if you use `100dvh` and `env(safe-area-inset-bottom)` (never `100vh`, never fixed pixel padding for the home indicator). **Desktop:** convert to a left rail in the same layout via responsive CSS (`md:` classes) — same routes, zero re-implementation.
- **Animation:** free. Indicator slide (transform), badge count pop (scale), haptic-free press states. All GPU-composited.
- **Fit for 23 modules:** a tab bar holds **4–5 destinations max**. It is the *primary* layer, not the module index. The other 18–19 modules live one tap away (see §1.4 hub / §1.5 palette). Design accordingly: tabs = Home, Learn/Plan (or whatever Wave-1 research groups), Pookie (center, elevated), Track, Menu — never 23 tabs.
- **Router fit:** perfect. Persistent layout = the App Router's home turf. Prefetching of tab routes is free via `<Link prefetch>`.

### 1.2 Top tabs (segmented control / scrollable tab strip) — **Cost L · RECOMMENDED as secondary nav**
- **Build:** cheap — either route segments (`/learn/[unit]`) or in-page state. Route-based top tabs get shareable URLs and back-button support for free; state-based tabs are cheaper but lose deep-linking.
- **Behavior:** scrollable horizontal strip on mobile, fixed segmented control on desktop. Indicator animation = CSS transform on an absolutely-positioned pill (measure with refs, no library).
- **Fit for 23 modules:** excellent *inside* a module — e.g. per-class unit tabs, health sub-sections, college timeline phases. Terrible *across* modules (you cannot top-tab 23 things).
- **Rule of thumb:** bottom tabs = *where am I*, top tabs = *what view of here*. Never nest more than two tab levels.

### 1.3 Hamburger / drawer — **Cost M · USE SPARINGLY (desktop + overflow only)**
- **Build:** moderate. Slide-in panel = CSS transform + focus trap + body scroll-lock + Escape handling + backdrop. All hand-rolled or via a headless primitive. None of that is App Router work — it's accessibility work, and it's where the bugs live (focus escaping, scroll leaking behind the overlay on iOS).
- **Mobile:** works, but **hides navigation = kills the habit loop**. The founder wants "healthy addiction" — a daily ritual the user *sees*. Out of sight is out of ritual. Drawer-only primary nav is an anti-recommendation on mobile (see §4).
- **Desktop:** fine and expected (sidebar/drawer with 23 module links grouped by worry-cluster). On desktop, screen space makes a persistent rail cheap and discoverable.
- **Fit for 23 modules:** acceptable as the *overflow* layer — the full module index behind "Menu"/"More". Not as primary nav.

### 1.4 Garden-hub home — **Cost L–M · RECOMMENDED as the home screen**
- **Build:** the home screen itself is just a page — cheap. Cost rises only if the hub tries to *be* the router (custom card-opening animations, hub-as-modal-stack). Keep it a page: cards are `<Link>`s, deep routes are real URLs, the back button works, every module is shareable/deep-linkable.
- **Mobile:** ideal. A beautiful, glanceable ritual surface — streaks, today's plan, garden growth state. This is where "mission control that feels like a garden" lives.
- **Animation:** card press states (scale 0.97, cheap), entrance stagger (opacity + translateY, cheap — but cap at ~8 staggered items, see §2), garden growth transitions (transform/opacity on SVG layers, cheap). Anything involving per-card blur or filter animation = expensive, see §2.
- **Fit for 23 modules:** the hub shows the *top 5–8* things that matter today, not 23 modules. The full 23 live in the overflow index (drawer/Menu tab). A hub that lists 23 cards is a settings page, not a ritual.

### 1.5 Command-K palette — **Cost M · NICE-TO-HAVE, deprioritize for v1**
- **Build:** moderate. Global key listener (Cmd/Ctrl+K), fuzzy filter over a static module/action index, focus trap, portal rendering, result list virtualization if long. No App Router conflict — it's an overlay, not navigation chrome.
- **Mobile (founder is on phone):** **Cmd+K doesn't exist on a phone.** The palette needs a visible entry point (search icon in the header/tab bar) that opens the same overlay. That's fine, but it means you're building a *search UI*, and search UI only earns its keep with great ranking — over 23 modules + actions, a plain filter list is enough for v1.
- **Fit for 23 modules:** good as a power-user shortcut, irrelevant to the daily ritual. **Recommendation:** build the *search overlay UI* once, skip the keyboard-shortcut ceremony for v1, wire Cmd+K later. Do not let the palette become the excuse for a weak information architecture.

### 1.6 Card-grid home (all-modules grid) — **Cost L · FINE, but not as the home**
- **Build:** cheap — CSS grid of links.
- **Fit for 23 modules:** this is the "app drawer" pattern. It works as the **overflow index** (the "Menu" tab or a "Browse all" screen), grouped by the worry-clusters from Wave-1 research. It fails as the *home* because it shows everything with equal weight — no ritual, no prioritization, no dopamine. Home = hub (§1.4); grid = index.

### 1.7 What the App Router gives us for free (design *with* these)
- **Persistent layouts:** `layout.tsx` at any segment never remounts when navigating within it. Tab bars, headers, the Pookie orb — all free persistence. *Design persistent chrome; don't rebuild it per page.*
- **Route groups** (`(tabs)`, `(onboarding)`): different layouts, same URLs. Use for auth-gated vs public shells, tabbed vs full-screen flows (e.g. Pookie chat full-screen without the tab bar).
- **Parallel routes** (`@slot`): genuinely independent UI regions on one URL — e.g. a dashboard where the garden visualization and the task list load/error independently. **Caution:** parallel routes + deep-linking + mobile back-button = confusing. Use for desktop dashboard composition; keep mobile flows linear.
- **`loading.tsx` / `error.tsx`:** per-segment skeletons and error boundaries, free. Design skeleton states as first-class screens (the garden should have a "growing…" skeleton, not a spinner).
- **Intercepting routes** (`(.)photo`): modal-over-current-page with a real URL — the *correct* way to do "tap card → detail sheet" while keeping the hub underneath. **This is the sanctioned pattern for sheets/modals over content.** It preserves back-button semantics (back closes the sheet). Prefer it over hand-rolled modal state for anything deep-linkable.
- **`<Link prefetch>`:** Next prefetches in-viewport links automatically. Tab-bar and hub links feel instant for free — *don't* build a custom prefetch layer.

### 1.8 What fights the App Router (expensive — avoid)
- **Custom page-transition orchestrators** that hijack the router (manual history manipulation, transition wrappers around every navigation): they break prefetch, break back-swipe on iOS, and break intercepting routes. **Banned for v1.**
- **Cross-route shared-element transitions** (card on hub morphs into the detail page): see §4.2 — the tech exists but is fragile with real data. Restrained use only.
- **State-based "screens" instead of routes** (a `useState` screen-switcher for 23 modules): you lose URLs, back button, deep links, prefetch, and per-screen error boundaries. Every "screen" must be a route. No exceptions.

---

## 2. Animation budget — the divine-light performance contract

The design language demands glow: soft neon, sunlight-through-leaves, divine light. Glow is *paint work* on the GPU — beautiful and cheap when static, lethal when animated carelessly. This section is the budget the visual designers must design inside.

### 2.1 Cheap (unlimited-ish, GPU-composited — prefer always)
- `transform` (translate / scale / rotate) and `opacity` — the only two properties that never trigger layout or paint. **All motion must be expressible in these two.**
- Static glows: `box-shadow` with a soft blur on *non-animated* elements is fine — it's painted once and cached as a texture.
- SVG layer cross-fades for garden states (opacity on stacked SVG groups).
- CSS keyframe loops on transform/opacity (gentle float, pulse via opacity).
- Staggered entrances: opacity + translateY, **cap at ~8 simultaneously-staggering items**; beyond that, animate the container once.
- `prefers-reduced-motion`: **mandatory** — every ambient animation gets a `@media (prefers-reduced-motion: reduce)` kill-switch. Non-negotiable for a family app (vestibular disorders, and the 12+ rating).

### 2.2 Moderate (budgeted — fine in isolation, never in lists)
- **FLIP animations** (card → detail morph, list reorder): hand-rolled FLIP with `requestAnimationFrame` or a small library. Cost is one-time per interaction, not per frame. OK for the hero card→detail transition, not for scrolling lists.
- **Layout animations** (height auto-expands, accordions): animating `height`/`grid-template-rows` triggers layout. Use the `grid-template-rows: 0fr → 1fr` trick (compositor-friendly-ish) and keep them user-triggered, one at a time.
- **Small-count animated glows:** a glow whose *opacity or position* animates (not its blur radius) — e.g. a breathing halo behind the Pookie orb. Budget: **≤ 3 simultaneously animating glows per viewport on mobile, ≤ 6 on desktop.**
- **Next.js View Transitions** (SPA-mode `document.startViewTransition` wrapper): supported experimentally; fine for *one* hero element morph per navigation. Fragile with heavy DOM and scroll restoration — use sparingly, test on real iPhones.

### 2.3 Expensive on mobile (banned in lists, rationed everywhere)
- **`backdrop-filter: blur()`** — forces the GPU to re-sample everything behind the element *every frame it or anything behind it moves*. In a scrolling list, each blurred card multiplies paint cost. **Rule: backdrop-blur is allowed on at most 2 fixed-position overlays (nav bar, sheet scrim) — never on cards in a scrollable list, never on list items, never animated.**
- **Animating `box-shadow` blur radius or `filter: drop-shadow()`** — these are paint-per-frame. Animate a *separate glow layer's opacity* instead: two stacked divs, one with the static shadow, animate only `opacity`/`transform` of the glow div. Same visual, 10× cheaper.
- **Many simultaneous animations:** each animating layer is a GPU texture. Past ~10 concurrent transform/opacity animations on a mid-range phone, frames drop. The garden home must choreograph: ambient loop (2–3 elements) + entrance stagger (≤8) + user-triggered (1) — never all at once.
- **Blur-heavy "divine light" washes across full-screen backgrounds:** a full-viewport animated gradient/glow = a full-screen repaint every frame. Do it with a *static* gradient + one slowly drifting radial highlight at low opacity (transform-only movement), or bake it into a lightweight canvas at reduced resolution. Never CSS-filter animation on a full-screen layer.
- **Lottie / heavy JSON animation:** each instance is a script-driven repaint. One hero Lottie is a statement; five is a slideshow on a hot phone. Prefer CSS/SVG for ambient life; reserve Lottie (if ever) for single celebration moments.

### 2.4 The concrete glow/animation budget (print this)
| Resource | Mobile budget | Desktop budget |
|---|---|---|
| Simultaneously *animating* glows (opacity/transform only) | ≤ 3 | ≤ 6 |
| `backdrop-blur` instances on screen | ≤ 2, fixed overlays only | ≤ 3 |
| Staggered entrance items | ≤ 8 | ≤ 12 |
| Concurrent transform/opacity animations | ≤ 10 | ≤ 20 |
| Full-screen animated background layers | 1 (transform-only drift, ≤ 40% opacity) | 2 |
| Animated `box-shadow`/`filter` | 0 — always fake with opacity layers | 0 |

**The golden rule:** if the designer can see it move, it must be moving via `transform` or `opacity` and nothing else. If a comp needs a moving blur, the comp needs a redesign.

---

## 3. Cloudflare edge constraints — what the runtime means for navigation design

The app runs on Cloudflare's edge via `@opennextjs/cloudflare` — real Next.js SSR/RSC streaming, but inside `workerd`, not Node. Design implications:

### 3.1 Edge SSR must stay light
- **Server Components should be thin composition shells**, not compute layers. Grade math, path-to-90 forecasts, tip ranking — that computation belongs in Supabase (views/RPCs) or the client, not in per-request server code. A Server Component that does heavy aggregation on every navigation = latency on every tab switch + worker CPU burn.
- **The primary read path is client → Supabase direct** (ADR-001/002). Navigation between tabs/modules should feel instant because data comes from PostgREST + RLS with the user's JWT — no worker round-trip for reads. Designs that assume "the server prepares my dashboard payload" are designing for an architecture we rejected.
- **No durable timers in server code.** The team already learned workerd has no real `setTimeout` semantics — anything resembling "server-side polling / scheduled refresh / countdown state in an API route" will silently misbehave. Countdowns, streak timers, "sync in 5s" UX = **client-side state only**. (Real scheduling lives in cron triggers / workers, never in the request path.)

### 3.2 Prefetching, route groups, and the 100k req/day meter
- `<Link>` prefetching issues real worker subrequests (RSC payloads). It's cheap and correct — but **don't prefetch the world**: keep prefetch on tab-bar + hub links (the 5–8 high-probability destinations), disable it (`prefetch={false}`) on the 23-module overflow index. The Pages Functions free tier is 100k requests/day with a standing alert at 50k — at family scale this is headroom, but a prefetch-happy design shouldn't be the thing that finds the ceiling.
- **Route groups are free at runtime** — `(tabs)`, `(auth)`, `(onboarding)` cost nothing in the worker; they're build-time organization. Use them aggressively to keep layouts persistent and auth shells separate.
- **Keep the JS bundle lean** — heavy client JS is *allowed* (it runs on the phone, not the edge), but every kilobyte is parse time on a mid-range phone and remote-URL WebView load time. Budget: **initial route JS ≤ 200 KB gz**; code-split per route group (the App Router does this automatically per segment — don't defeat it with a giant shared client component imported everywhere).

### 3.3 Realtime and "live" navigation states
- Supabase Realtime (websockets) works from the client — sync-status dots, new-grade badges, Pookie typing indicators are all client-subscription features. They don't touch the worker.
- **Design live states as progressive enhancement:** the UI must be fully correct on load without the socket (stale badge → live badge is an upgrade, not a fix). Sockets drop on mobile; the design can't depend on them.

### 3.4 What this means for the IA concepts (Wave 2)
- Persistent tab layout + hub home + overflow index = the edge-native shape. Each tab is a layout-persistent segment; navigation is client-side with RSC streaming only where Server Components exist.
- Avoid designs requiring server-computed per-navigation payloads (e.g. "the server re-ranks all 23 modules on every visit"). Rank client-side from cached data, or pre-compute in the DB.

---

## 4. Anti-recommendations — Figma-beautiful, production-dead

### A1. The omnipresent animated glow orb (persistent blurred orb + particles on every screen)
*Why it dies:* a fixed full-screen `backdrop-blur` + animated `filter: blur()` orb + particle canvas = continuous full-screen repaint on every scroll, on every screen. Mid-range phones thermal-throttle within minutes; the app feels "heavy" and drains battery — the opposite of a daily ritual. *Instead:* one static divine-light gradient per screen (painted once), a single small breathing halo behind the Pookie avatar only (opacity animation, §2.2 budget), particles only on celebration moments, killed after 3 seconds.

### A2. Cross-route shared-element morphs for all 23 module cards
*Why it dies:* the View Transitions API + 23 distinct card layouts + real async data = morphs that glitch, flash unstyled content, or misfire when the destination renders at a different size (which it always does with real grades). iOS back-swipe + view transitions = broken history states. *Instead:* allow the morph for **one** hero element (the child's avatar/garden) on **one** transition (hub → child profile), standard fade/slide everywhere else. Choreograph restraint, not magic.

### A3. Infinite-scroll card stacks with per-card backdrop-blur and parallax
*Why it dies:* each blurred card forces re-sampling of everything beneath it during scroll — 20 blurred cards = 20× paint cost per scroll frame. Parallax (scroll-linked transforms) is fine; blur is not. This is the #1 cause of "the app stutters" reports that no code fix can save because the design mandates the cost. *Instead:* solid soft-green card surfaces with static `box-shadow` depth; parallax limited to translateY on hero art only; blur reserved for the two fixed overlays (§2.4).

### A4. Drawer-as-primary-navigation hiding all 23 modules (mobile)
*Why it dies twice:* (1) **Habit death** — the founder's "healthy addiction" needs visible ritual triggers; a drawer hides the garden, the streak, the plan. Out of sight, out of mind, out of daily active use. (2) **Thumb ergonomics** — hamburger lives top-left, the farthest point from the right thumb; every navigation costs a reach. *Instead:* bottom tab bar (5 destinations max) + hub home + "Menu" overflow index. Drawer only on desktop, where it costs nothing.

### A5. A custom JS page-transition system (slide/fade choreography wrapping the Next router)
*Why it dies:* it duplicates what the App Router already does, then breaks what the router guarantees — prefetch hints, scroll restoration, intercepting-route sheets, iOS swipe-back, and parallel-route loading states all degrade or break. Every Next upgrade becomes a regression hunt. This is the classic "looks incredible in the prototype, rots in production" pattern. *Instead:* route natively, animate *within* screens (entrances, micro-interactions, sheets). Motion lives inside routes, never between them — with the single sanctioned exception of one restrained view-transition hero (§A2).

---

## 5. Recommended stack additions

**Default verdict: keep it lean. No new dependencies for v1.**

Rationale: the animation budget in §2 is fully expressible in CSS + Tailwind v4 (which has first-class keyframes, `motion-safe:`/`motion-reduce:` variants, and arbitrary properties). Every library added is bundle weight on a phone WebView and a maintenance surface. The designs that survive §2–§4 don't need a motion library.

**If Wave-4 (motion design) proves a need, the single sanctioned addition:**
- **`motion`** (the successor to framer-motion, tree-shakeable, React 19 compatible) — *only* for FLIP list reordering and drag-to-reorder interactions (e.g. reordering today's plan, garden customization). Cost: ~30–50 KB gz added to the routes that use it (code-split, never global). **Not** for page transitions, **not** for ambient loops (CSS does those cheaper), **not** imported in the root layout.
- Explicitly **not** recommended: GSAP (overkill weight for our budget; ScrollTrigger fights mobile scroll), Lottie (see §2.3 — one celebration moment max, and even then prefer CSS), any "page transition" library (banned by §A5), any custom router wrapper.

**Non-library additions worth doing (zero bundle cost):**
- A `tokens.css` layer for the divine-light system: glow color tokens, `--glow-*` custom properties, the `prefers-reduced-motion` kill-switch, safe-area utilities. Design-system owned, one file.
- An `usePrefersReducedMotion()` hook + a `<MotionSafe>` wrapper convention, so every animated component degrades by construction, not by review.

---

## 6. The buildability checklist (for Wave-2 IA concepts and Wave-3 screens)

Every navigation concept and key screen must answer these before it leaves design review:
1. [ ] Is every "screen" a real route (URL, back button, deep-link)? No `useState` screen-switchers.
2. [ ] Does the tab bar stay at ≤ 5 destinations? Where do the other modules live (hub top-N + overflow index)?
3. [ ] Does all motion reduce to `transform`/`opacity`? Point to the one property each animation uses.
4. [ ] Glow count check: ≤ 3 animating glows (mobile) / ≤ 6 (desktop); `backdrop-blur` only on fixed overlays, never in lists.
5. [ ] `prefers-reduced-motion` path designed, not just tolerated.
6. [ ] No custom page-transition choreography; at most one restrained view-transition hero.
7. [ ] Server Components are thin shells; no per-navigation server aggregation; no timers in server code.
8. [ ] Prefetch left on for tab/hub links, off for the overflow index.
9. [ ] Skeleton (`loading.tsx`) and error (`error.tsx`) states designed per segment — the garden has a "growing…" state.
10. [ ] Touch: 44px targets, thumb-zone placement, `100dvh` + safe-area insets, no hover-dependent interactions.

*Frontend Architect, signing off Wave 1. Ambition enabled; fantasy killed. The garden will be beautiful — and it will run at 60fps on Mehedi's phone.*
