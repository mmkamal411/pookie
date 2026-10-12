# Prism E5 — Navigation Map (docs/PRISM-NAVMAP.md)

**Author:** Prism E5 (Frontend Architect — navigation flow) · **Date:** 2026-10-12
**Scope:** all 60 `page.tsx` routes · **Branch:** `staging-build`
**Status:** reflects the tree AFTER the E5 fix batch (commits `ae91067`…`545aecc`).

Design language: cool hi-tech, well-lit, Title Case, subtle neon. Bottom toolbar =
spaceship console (persists across pages). Pages = popup modules. Cosmic background
shifts on every navigation (course-change feel).

---

## 1. The console (toolbar) — 5-tab IA

`CommandDeck` (root layout, mounted once, never unmounts) switches on route:

| Route scope | Console | Tabs / controls |
|---|---|---|
| `/c/[childSlug]/*` | `ChildToolbar` | Home · Today · Pookie (orb) · Progress · More (popup) + telemetry strip + header gear (ShipSettingsControl) + child switcher |
| `/select-child`, `/me`, `/household/*`, `/village/*`, `/family/*` | `StandbyConsole` | Orb + contextual label + telemetry. **No tabs by design** ("no dead switches") — this is what stranded the account-level pages (fixed with in-page nav, §4) |
| `/login`, `/onboarding`, `/add-child`, `/verify-invite`, `/family/invite/accept`, `/account-deleted` | hidden | Clean entry, no dead controls |

**Current-page indication** (E2 asked for settings coverage; E5 extended it):
- Tabs use `data-active` + `aria-current="page"` → three-part neon: glyph
  `drop-shadow(0 0 9px)`, label `text-shadow: 0 0 12px`, and the "lit slot"
  (glowing pill that widens). E3's `.neon-current` class does **not** exist in
  the tree — `data-active` is the canonical mechanism.
- **More tab now glows on module pages** (`/health`, `/travel/*`, `/support/*`,
  `/marketplace`, `/safety/screen-time`, …). Tabs with their own glow
  (Home/Today/Pookie/Progress) keep precedence — no double-glow.
- **Settings dial (header gear) glows on `/settings/*`** — the toolbar has no
  Settings tab, so the dial carries the active state itself (same
  `[data-active]` neon treatment). Sector readout shows "Ship Systems".

**Page transitions:** `PageGlide` wraps the tenant layout, household layout,
`/me`, `/select-child`, and (new, E5) the family + village layouts — outgoing
view held 250ms as a fading echo while the new view glides in beneath
(fade + rise, 350ms). `prefers-reduced-motion` → instant swap (matchMedia guard
+ global CSS kill-switch). **CosmicSceneDirector** crossfades the cosmic scene
on every navigation AND on a 75s timer (opacity-only, GPU-cheap; reduced-motion
→ single static scene). Auth/entry pages intentionally have no transition
(deck hidden by design there).

---

## 2. The More menu — module registry

`MorePopup` reads `src/lib/modules.ts` (`GROVES`, 7 groves, **31 modules**).
Live modules link via the shared helper **`resolveModuleHref(childSlug, route)`**:

> routes under `/household/` are absolute (account-level namespace); every
> other route resolves under `/c/[childSlug]`.

Used by: More popup (module rows + recent row), travel hub, minimized-dock
restore, toolbar More-active computation. One rule, one place.

---

## 3. Route graph — tap depth from Home (`/c/[childSlug]`)

Depth = taps via visible UI (toolbar → tab/popup counts as the tap that opens it).

### Tenant scope (`ChildToolbar` present)

| Route | Depth | Reached via | Back affordance |
|---|---|---|---|
| `/c/[s]` (Home) | 0 | Toolbar · Home | — |
| `/c/[s]/today` | 1 | Toolbar · Today | — |
| `/c/[s]/pookie` | 1 | Toolbar · Pookie (orb) | — |
| `/c/[s]/school` | 1 | Toolbar · Progress | — |
| `/c/[s]/school/[classSlug]` | 2 | School → class card | "← All Classes" ✓ |
| `/c/[s]/school/health` | 2 | School → sync-health strip | "← School Overview" ✓ |
| `/c/[s]/school/minutiae` | 2 | School → "School Minutiae" card (E5 added; was deep-link-only) | "← School Overview" ✓ (E5 added) |
| `/c/[s]/health` | 2 | More → Health | HealthModuleNav strip (E5) |
| `/c/[s]/health/wellbeing` | 2 | More → Wellbeing (or hub strip) | HealthModuleNav strip (E5) |
| `/c/[s]/health/meals` | 2 | More → Meals (or hub strip) | HealthModuleNav strip (E5) |
| `/c/[s]/health/activity` | 2 | More → Activity (or hub strip) | HealthModuleNav strip (E5) |
| `/c/[s]/health/nutrition` | 2 | More → Nutrition (or hub strip) | HealthModuleNav strip (E5) |
| `/c/[s]/health/review-18` | — | Login interstitial at 18+ (Platform Team 2); deep-link otherwise | Terminal CTAs ✓; parent view "← Back to Health" (E5 added) |
| `/c/[s]/safety/screen-time` | 2 | More → Screen Time | Toolbar (More glows) |
| `/c/[s]/travel` | 2 | More → Travel | Toolbar (More glows); hub has no "← Back" (E2 P2, minor) |
| `/c/[s]/travel/events` | 3 | More → Travel → Events | TravelPageShell "← Back" → hub ✓ |
| `/c/[s]/travel/flights` | 3 | More → Travel → Flights | shell "← Back" ✓ |
| `/c/[s]/travel/fuel` | 3 | More → Travel → Fuel | shell "← Back" ✓ |
| `/c/[s]/travel/rentals` | 3 | More → Travel → Rentals (adult only) | shell "← Back" ✓ |
| `/c/[s]/travel/restaurants` | 3 | More → Travel → Restaurants | shell "← Back" ✓ |
| `/c/[s]/travel/trails` | 3 | More → Travel → Trails | shell "← Back" ✓ |
| `/c/[s]/travel/weather` | 3 | More → Travel → Weather | shell "← Back" ✓ |
| `/c/[s]/marketplace` | 2 | More → Marketplace | Toolbar (More glows) |
| `/c/[s]/coparenting` | 2 | More → Co-parenting | Toolbar (More glows) |
| `/c/[s]/credit` | 2 | More → Credit (18+) | Toolbar (More glows) |
| `/c/[s]/support` | 2 | More → Support | Toolbar (More glows) |
| `/c/[s]/support/faq` | 3 | More → Support → Help Center | "← Support" via hub; footer cross-links ✓ |
| `/c/[s]/support/faq/[slug]` | 4 | … → FAQ → article | "← Help Center" ✓ + related articles |
| `/c/[s]/support/chat` | 3 | More → Support → AI Chat | "← Support" ✓ |
| `/c/[s]/support/tickets` | 3 | More → Support → Tickets | "← Support" ✓ |
| `/c/[s]/support/tickets/new` | 4 | … → Tickets → New | "← Tickets" ✓ |
| `/c/[s]/support/tickets/[id]` | 4 | … → Tickets → thread | "← Tickets" ✓ |
| `/c/[s]/settings` | 1 | Header gear (ShipSettingsControl) | SettingsTabs (lateral); gear glows while inside |
| `/c/[s]/settings/family` | 2 | Settings → Family tab | SettingsTabs ✓ |
| `/c/[s]/settings/sharing` | 2 | Settings → Sharing tab | SettingsTabs ✓ |
| `/c/[s]/settings/sync` | 2 | Settings → Sync tab | SettingsTabs ✓ |
| `/c/[s]/settings/health` (Workers) | 2 | Settings → Workers tab | SettingsTabs ✓ |
| `/c/[s]/settings/credentials` | 2 | Settings → School Logins tab | SettingsTabs ✓ |

### Account scope (`StandbyConsole` — no tabs)

| Route | Depth / entry | Back affordance (E5) |
|---|---|---|
| `/household/mail` | 2 via More → Mail; also `/me` grid | HouseholdNav: "← Home" + lateral chips ✓ |
| `/household/shopping` | 2 via More → Shopping List; `/me` | HouseholdNav ✓ |
| `/household/spending` | 2 via More → Spending; `/me` | HouseholdNav ✓ |
| `/household/vault` | 2 via More → Money & Documents; `/me` | HouseholdNav ✓ |
| `/household/weather` | 2 via More → Travel → Weather module; `/me` | HouseholdNav ✓ |
| `/household/insurance` | 2 via More → Safety (E5: was seedling, unlinked) | HouseholdNav ✓ |
| `/household/babysitters` | `/me` grid (E5); no More entry | HouseholdNav ✓ |
| `/village` (mentor roster) | Mentor email entry (deep link) | "← Back to Ship" ✓ (E5) |
| `/village/[childId]` | Roster → card | "← Who You're Helping" → roster ✓ (E5) |
| `/family/claims` | Deep link (no in-app entry — flagged §5) | "← Back to Ship" ✓ (E5) |
| `/family/invite` | Deep link (no in-app entry — flagged §5) | "← Back to Ship" ✓ (E5) |
| `/family/invite/accept` | External (email/QR deep link) | Invalid state: "Go to my Pookie" ✓ (E5); accepted: "Go to my Pookie" ✓ |
| `/me` (just-me home) | Root router (zero memberships) | Household grid (7 links) + "Add a child" + sign-out |
| `/select-child` | Root router (multi-child parent) | Child cards → tenant home |

### Entry / system routes

| Route | Notes |
|---|---|
| `/` | Root router — session → tenant → redirect. Not a UI surface. |
| `/login` | Entry; deck hidden by design. |
| `/onboarding`, `/onboarding/connect` | Entry wizards; back buttons at every step; deck hidden. |
| `/add-child` | Entry-guarded (zero memberships); "Back" → `/me`. |
| `/verify-invite` | External invite link; full state machine; deck hidden. |
| `/account-deleted` | Redirect-gated grace page; "Cancel deletion" → `/` + **Sign Out** button (E5). |
| `/offline` | SW fallback; "Try Again" → `/`. |

---

## 4. P0 flow breaks found & fixed (E5 batch)

1. **The entire More menu 404'd.** Squad 4 keyed absolute-vs-tenant off the
   leading slash, but every registry route carries one — More links rendered as
   bare `/health`, `/travel/fuel`, … (all 404). Fixed with `resolveModuleHref`
   (`/household/*` absolute, rest tenant-scoped), applied to the More popup
   (rows + recent), travel hub (W26 Weather card), and minimized-dock restore.
2. **W15 Screen Time route** was `"safety/screen-time"` (missing slash) →
   `/c/<slug>safety/screen-time`. Fixed to `"/safety/screen-time"` (now
   resolves correctly under the shared helper).
3. **`/household/insurance` unreachable** — W3 Safety was a seedling with no
   route while the Insurance hub shipped. Marked live (`/household/insurance`);
   31-module shell intact.
4. **10 account-level pages had no in-page back-to-app path** (E2 P1):
   all 7 `/household/*` got `HouseholdNav` ("← Home" + lateral chips);
   `/village`, `/family/claims`, `/family/invite` got "← Back to Ship";
   `/village/[childId]` got "← Who You're Helping" → roster.
5. **`/health/review-18` parent view was a visual dead end** (E1 P1) —
   added "← Back to Health".
6. **`/account-deleted`** told users to "just sign out" with no button (E1 P1) —
   added Sign Out (tenant `signOut` server action).
7. **Health hub had no links to its subpages** (E1 P1) — new `HealthModuleNav`
   strip (hub + wellbeing/meals/activity/nutrition), hidden on the review-18
   interstitial.
8. **`/family/invite/accept` invalid state had no CTA** (E2 P1) — added
   "Go to my Pookie".
9. **No toolbar active-glow on `/settings/*`** (E2 P2, parent-prioritized) —
   settings dial now glows; **More tab glows on all module pages**.
10. **`/school/minutiae` was deep-link-only** — added "School Minutiae" card on
    the school overview + "← School Overview" back link.

## 5. Known gaps / flags for other squads

- **`/family/invite` and `/family/claims` have no in-app inbound links.**
  Back-to-app links added, but the owning squad should wire entry points
  (e.g. from settings/family-view) or confirm deep-link-only is intended.
- **`/village/*` entry is mentor-email deep links** — by design, but confirm
  the invite email actually links `/village` (Squad Village).
- **`/household/babysitters` has no More-menu entry** (Marketplace grove points
  W12 at the tenant `/marketplace`). The standalone board is reachable from
  `/me` + HouseholdNav. Decide: merge into marketplace or keep separate.
- **SettingsTabs active-tab glow** needs a visual/browser check (E1 P1 #5) —
  source shows the logic; rendering unverified.
- **Travel hub has no "← Back"** (E2 P2) — inconsistent with its 7 module
  pages; toolbar is the only return.
- **Title Case + neon hover gaps** (E1/E2 P1/P2) belong to the E4 polish sweep,
  not navigation — not touched here.
- **E3's `.neon-current`** doesn't exist in the tree; `data-active` is the
  canonical active mechanism (documented §1).

## 6. Verification

- `npx tsc --noEmit` — clean (run post-batch; builds paused for Squad Harbor
  deploy window, so no `next build` in this session — CD verifies on deploy).
- Tap-depth audit: every primary page ≤ 3 taps from Home; leaf content
  (FAQ articles, ticket threads/new) at depth 4, standard for content depth.
- No dead ends remain: every page has ≥1 onward/back path; no fake CTAs.
- `prefers-reduced-motion` respected in PageGlide, CosmicSceneDirector, and
  the toolbar orb descent.
