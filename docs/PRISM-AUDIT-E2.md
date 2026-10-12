# Squad Prism — E2 Audit: Surfaces B (routes n–z) + Toolbar + Orb
**Auditor:** Prism E2 (UX Researcher, surfaces B)
**Date:** 2026-10-12 ~12:00 EDT
**Scope:** pages 31–60 of 60 (second half alphabetically), the bottom toolbar (`ChildToolbar` / `StandbyConsole` / `CommandDeck`), and the orb (`PookieOrb` / `ReactiveOrb` / `SoulOrb`).
**Method:** source audit — page wrappers + rendered components; nav links, back buttons, CTA clarity, empty states, collapsed-by-default patterns, hover/focus/glow CSS. No live browser available to this subagent; visual behavior verified against `globals.css` class definitions only.

**Score legend (1–5):**
- **Intuitive** — first-timer comprehension, CTA clarity, guiding empty states, collapsed-by-default info.
- **Neon** — subtle glow on hover/focus/active, glowing current-page indicators, soft dividers, nothing harsh/gaudy.
- **Flow** — reachable ≤3 taps from Home, sensible back behavior, no dead ends.

---

## Page audits

## `/c/[childSlug]/support/tickets/new`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- "← Tickets" back link; labeled fields with inline validation copy ("Give it a subject so we know what it's about."); "?" helper sheet explains what support can/can't see; offline draft auto-saves to localStorage; teen-privacy banner up front. CTA "Open ticket" → routes to the new thread.
- Neon: standard `Button`/`Card` primitives; inputs get `focus:border-nova-300/60`. The "?" helper button has a border but no hover glow — minor.
- Flow: 2 taps from Home (More → Support → New ticket, or direct via tickets list). Submit lands on the thread page. ✅

## `/c/[childSlug]/today`
- **Intuitive:** 5 · **Neon:** 5 · **Flow:** 5
- Exemplary. Check-in nudge card with aurum glow when not logged, deep-linking to `school#checkin`; "On the radar today" links to per-class pages; "Tonight's flight priorities" numbered; empty states are guiding, never dead ("Nothing on the radar — clear skies ahead. 🌤️"); forward link "Open the school console →".
- Neon: `card-living` everywhere (hover lift + glow), check-in card carries an inline aurum `box-shadow`.
- Flow: toolbar tab. No dead ends. ✅

## `/c/[childSlug]/travel/events`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- `TravelPageShell`: "← Back" to the travel hub, sigil + title + subtitle ("What's happening near you — vetted, age-tagged."); neon age chips (cyan/teal/amber/red), audience segmented control, EmptyState/Initializing/Error-with-retry all wired.
- Neon: chips carry per-tone `border-*/bg-*/text-*` glows; cards `card-living`. The "← Back" link is plain `text-nova-300` with hover color only — no glow/underline on hover (P2, shared across all shell pages).
- Flow: More → Travel grove → Events; back link to hub. ✅

## `/c/[childSlug]/travel/flights`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 5
- Plan-only concept could confuse a teen, but the subtitle ("Plan the trip — a grown-up books it.") and the "Share this trip idea with a parent" CTA make the contract explicit. Error card with retry; ZIP gate with D7 honesty line.
- Neon: standard `Button`/`Card`; nothing harsh.
- Flow: same shell pattern. ✅

## `/c/[childSlug]/travel/fuel`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- All four data states covered (loading / live / initializing / config-needed / error-with-retry). ZIP honesty line present. CTA "Look up" disabled until valid ZIP — honest gating.
- Neon: `Card` + `Button` primitives; no harsh colors.
- Flow: same shell pattern. ✅

## `/c/[childSlug]/travel` (hub)
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 4
- 7 module cards each carry a LIVE data state (checking / live line / needs-location / needs-setup / unavailable) — the hub tells you what's behind each door. ZIP gate with honesty line; teen age-gating note; growth-framed empty state.
- Neon: cards lift on hover (`hover:-translate-y-0.5` + `card-living` glow).
- Flow: reachable More → Travel. **Issue (P2):** the hub does NOT use `TravelPageShell`, so there's no in-page "← Back" — return relies on toolbar Home/Progress tabs. Fine on tenant scope, but inconsistent with the 7 module pages that all have back links.

## `/c/[childSlug]/travel/rentals`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 5
- Adult-only: teens get `notFound()` — hidden entirely per spec (no lock tile, no hunting path). Correct.
- Subtitle "The real total cost — no $29/day traps." sets expectations well.
- Flow: hidden for teens, reachable for adults. ✅

## `/c/[childSlug]/travel/restaurants`
- **Intuitive:** 5 · **Neon:** 5 · **Flow:** 5
- "Dining Destinations": time-aware hero, 13 cuisine sigils as glowing medallions, neon distance pills, cyan journey line on hover, staggered rise-in. Clear CTA flow (sigil → cards → detail).
- Neon: per-sigil glow colors, hover scale + distance-pill glow. Subtle, not gaudy.

## `/c/[childSlug]/travel/trails`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- "Expeditions": banner art per NPS designation, sunset telemetry pill, safety briefing as holo-panel, under-16 "bring 2+ people" glowing badge. Input has focus border glow.
- Neon: consistent with shell; nothing harsh.

## `/c/[childSlug]/travel/weather`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- Live NWS panel; ZIP gate; loading/error/empty all handled in the shared shell contract.
- Neon: standard. ✅

## `/family/claims`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- Excellent copy: "Approving connects them right away; rejecting is final for 30 days. No one is ever connected automatically." Empty state "Nothing waiting" with growth framing. Escalation pill past 14 days. Approve/Reject CTAs present per claim.
- Neon: `card-living` cards; escalation pill is soft aurum.
- **Flow (P1):** no in-page back link to wherever the user came from (settings/family). `StandbyConsole` shows at the bottom but carries NO nav tabs, so return = browser back only.

## `/family/invite/accept`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 4
- Public page, correct PII posture (inviter name only pre-auth). States handled: invalid → "isn't available" with recovery guidance; accepted → "You're linked ✓" + "Go to my Pookie" CTA; mismatch flows. Deck hidden by design (clean entry).
- **Flow (P2):** the invalid/expired state has no CTA (no "sign in" or "go home" button) — a signed-in user hitting a dead link just stares at it.

## `/family/invite`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- Clear explainer (single-use, 7-day expiry), child picker for multi-child, QR in white card (legitimate — QR needs white), copy-link CTA, honest empty state ("No eligible children right now.").
- **Flow (P1):** no back link to settings/family; StandbyConsole has no nav. Browser-back-only return.

## `/household/babysitters`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- Multi-step wizard with internal Back buttons at every step ("Close — I'll check back"); parent-vetted disclaimers prominent; time-boxed grant framing clear.
- **Flow (P1):** internal back only navigates wizard steps — no path back to the app shell. StandbyConsole is tab-less.

## `/household/insurance`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- `PageHeader` (eyebrow + icon + title + subtitle); "Add policy" CTA with nova glow shadow; renewal countdown pills; cross-link to `/household/vault` for documents. Inline Edit / Remind In Bills / Remove with hover states.
- **Flow (P1):** no back-to-app navigation.

## `/household/mail`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 3
- Matches the Dawson dashboard pattern Mehedi loves: "📬 Action needed" open by default, "🗂️ Filed" collapsed; empty states guide ("Snap a bill, a notice, anything with a due date"); "Scan your first piece" CTA uses `btn-dapple`. Internal capture flow has back at every screen.
- **Flow (P1):** same missing back-to-app as all household pages.

## `/household/shopping`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- `ShoppingBoard` + `LinkedShipsPanel` ("Link Ships" share-by-email + "Linked to You" manifests). Category structure clear.
- **Polish (P2):** h1 "Family shopping list" is NOT Title Case — should be "Family Shopping List" per the design language.
- **Flow (P1):** no back-to-app.

## `/household/spending`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- `PageHeader` with teen-aware titles ("Your spending" vs "Household spending"); month pager with hover borders; "Why totals, not line items?" BottomSheet explains the privacy model.
- **Flow (P1):** no back-to-app.

## `/household/vault`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 3
- Capture wizard with internal "Back to vault" at every step; type picker; orb used in header area.
- **Flow (P1):** no back-to-app.

## `/household/weather`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 3
- Cosmic hero with CSS-animated condition art + condition-matched ambient glow; NWS alerts with severity tones; graceful standby with retry — never blank; ZIP setter; permanent emergency disclaimer. Honest "Live · NWS" vs "Standby" labeling.
- **Flow (P1):** no back-to-app.

## `/login`
- **Intuitive:** 5 · **Neon:** 5 · **Flow:** 5
- Exemplary. The whole page is the orb: tap → revelation burst → clearance (Google / email boarding pass) → transmitted → resend. Sci-fi copy is elevated and consistent ("Verify your identity, Captain", "Boarding pass transmitted"). Error copy maps rate-limits/auth failures to plain language. Session check sails logged-in users past with no strand. `?token=`/`?next=`/`?fresh=` all honored.
- Neon: `holo-panel` buttons with `hover:brightness-125`, `greeting-glow` on the greeting, tap-hint ring on the orb.
- Flow: entry page; deck hidden by design. ✅

## `/me`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 4
- The "just me" home: "Your Pookie is all yours — your household, watched over." Household link grid (Mail/Shopping/Spending/Vault) with title + sub per card; dashed "+ Add a child" CTA; sign-out. Fixes the old `no-invite` dead end.
- **Polish (P2):** grid links are `neon-pipe` but hover only darkens bg (`hover:bg-nebula-900`) — no glow lift, unlike `card-living` elsewhere.
- Flow: StandbyConsole label "Your Pookie, watching over home" (no tabs — appropriate, account-level). ✅

## `/offline`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- Calm "Signal Lost" page: breathing mini-orb, "The ship drifted out of range", reassurance copy ("Your place is held"), "Try Again" CTA with `shadow-glow-sm` + `active:scale-95`. Cached by SW; never a blank page.
- Flow: `/` retry; nothing to strand. ✅

## `/onboarding/connect`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 5
- Claim flow: states for found/not-found/rejected/claimed; "Back" buttons at every step; "Continue to my Pookie" CTA on success. Functional, no dead "ask Parent A" path.

## `/onboarding`
- **Intuitive:** 4 · **Neon:** 4 · **Flow:** 5
- 30-second wizard (name → children → done), skippable at every step ("Skip for now" completes server-side). Guards: no session → login with return; completed → root router. Deck hidden by design.

## `/` (root router)
- Infrastructure, not a UI surface — resolves session → tenant → redirect. Handles invite consume, deletion grace, DOB gate, no-invite → `/me` (was a dead end, now fixed). Not scored.

## `/select-child`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- "Who's on this mission?" — child cards with initial medallion (nova glow), nickname + grade/school, staggered bloom-in. Server action selects + redirects. Only renders for multi-child parents.
- Flow: entry router page; deck shows standby. ✅

## `/verify-invite`
- **Intuitive:** 5 · **Neon:** 4 · **Flow:** 5
- Full state machine: invalid (guidance to ask parent for a fresh invite), signin (preserves return URL), mismatch (tells which email to use), ready (AcceptInviteButton). PII-safe pre-auth. `card-living` + PookieOrb. Deck hidden by design.
- Flow: accept → root router → tenant. ✅

## `/village/[childId]` (mentor overview)
- **Intuitive:** 4 · **Neon:** 3 · **Flow:** 2
- "Helping {name} win" — attention-first assignment list, class cards, kudos composer. Scope-honest (no health/check-ins/messaging). Empty/loading/error states present.
- Neon: `card-living` on sections; status text colors soft (red-300/amber-300); otherwise plain — fewer glow affordances than tenant pages.
- **Flow (P1): NO back link to the `/village` roster, and StandbyConsole has no tabs.** A mentor who taps into a child has no visible path back to the roster except browser back. This is the weakest back-behavior in the set.

## `/village` (mentor roster)
- **Intuitive:** 4 · **Neon:** 3 · **Flow:** 3
- "Who you're helping win" — roster cards link to `/village/{childId}`; relationship labels; honest empty state ("No crew invitations yet…").
- **Flow (P1):** no back-to-app; StandbyConsole tab-less.

---

## Component audits

### Bottom toolbar — `CommandDeck` + `ChildToolbar` + `StandbyConsole`
- **Intuitive:** 5 · **Neon:** 5 · **Flow:** 5
- The ship console: Home · Today · Pookie (the one orb, hovering) · Progress · More. Per-tab glow colors, live telemetry strip (PWR/SHD vitals, sector readout, ticking mission clock), safe-area padding, z-40 above content, never unmounts on route change, fixed position bug (layered-`fixed` vs unlayered CSS) already resolved.
- **Neon (exemplary):** `[data-active="true"]` drives a three-part glow — glyph `drop-shadow(0 0 9px)`, label `text-shadow: 0 0 12px`, and the "lit slot" indicator (glowing pill that widens). `aria-current="page"` set on active tabs. `:focus-visible` styles exist. The orb descends from the cosmos on every navigation (`orb-descend` keyed on pathname) — subtle, not bouncy.
- **StandbyConsole** (account-level pages): orb + label + telemetry, no tabs — correct call ("no dead switches"), but it creates the P1 gap: household/family/village pages have no in-page navigation back to the app.
- **Minor (P2):** no tab lights up for `/settings/*` routes (sector readout correctly shows "Ship Systems", but no active glow anywhere) — acceptable, noting for completeness.

### The orb — `PookieOrb` + `ReactiveOrb` + `SoulOrb`
- **Intuitive:** 5 · **Neon:** 5 · **Interaction:** 5
- Divine-orb identity per Mehedi: volumetric body (specular hotspot, limb shading), counter-rotating hypnotic depth veils, surface sheen sweep, inner motes, drifting gaze, 4s breathing rhythm. Six moods (idle/listening/thinking/excited/celebrating/revelation) via `data-mood`; `ReactiveOrb` listens to the global orb event bus with decay timers; chat header drives its own mood. Pointer-lean (150px reach, 7px max) + attention brightening via one shared rAF-throttled listener — GPU-cheap, off-screen orbs skipped. `prefers-reduced-motion` → still air. `role="img"` + `aria-label="Pookie, a divine orb of light"`.
- Nothing harsh: `screen` blend mode keeps it luminous on the dark cosmos; light-theme adaptation drops the blend. This is the emotional core of the app and it's in excellent shape.

---

## Ranked issue list

### P0 — broken flow
*None found.* No page strands the user irrecoverably — browser back always works, offline has "Try Again", all error states carry retry or guidance.

### P1 — confusing / weak flow
1. **No back-to-app path on 10 account-level pages.** `/household/*` (7), `/village`, `/village/[childId]`, `/family/claims`, `/family/invite` render no back link and get the tab-less `StandbyConsole`. Users depend on browser back. The More popup opened them; closing the loop in-app matters, especially on mobile/PWA where browser chrome is hidden. Suggested: a small "← Back to ship" link or making the StandbyConsole orb tap route home.
2. **`/village/[childId]` has no link back to the `/village` roster** — the weakest instance of #1; a mentor drilling in can't see the way back at all.
3. **`/family/invite/accept` invalid state has no CTA** — signed-in user with a dead link sees "This invite isn't available" with zero forward action (sign-in link, go-home, or request-fresh-invite).

### P2 — polish
1. **"Family shopping list" h1 is not Title Case** (`shopping-board.tsx:862`) — design language requires Title Case everywhere → "Family Shopping List".
2. **"← Back" links in `TravelPageShell` (7 pages) are plain text with hover-color only** — no underline/glow on hover, unlike every other interactive element.
3. **`/me` household grid links** use `neon-pipe` but hover only darkens bg — no glow lift like `card-living`.
4. **Travel hub** has no in-page back link (unlike its 7 module pages which all do) — inconsistent.
5. **Support ticket "?" helper button** has no hover feedback.
6. **Toolbar:** no active-glow state for `/settings/*` routes (sector readout says "Ship Systems" — fine, noted only).

### Strengths to preserve
- `card-living` + `btn-dapple` + `neon-pipe` primitives give the whole app a consistent subtle-neon language; nothing audited was harsh or gaudy.
- Empty-state discipline is excellent across the set: guiding copy + one real action everywhere (mail "Scan your first piece", claims "Nothing waiting", village roster, weather standby, travel "connecting" states).
- Collapsed-by-default is honored where it matters (mail Filed section; More popup groves).
- Login and verify-invite are best-in-class entry flows; today-view is the model for the daily ritual.
- Toolbar active-tab glow (glyph + label + lit slot) is the neon-interaction benchmark for the app.
