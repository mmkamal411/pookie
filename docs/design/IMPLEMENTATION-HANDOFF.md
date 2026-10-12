# IMPLEMENTATION-HANDOFF.md — Build Order for the Pookie Milestone 1 Launch
**Author:** Project Manager, design team · **Date:** 2026-10-11 · **Status:** HANDOFF — engineering builds from this
**Reporting to:** the Design Coordinator. **Consumers:** the Shell team, Team A (School pod), Team B (Life pod), DevOps.

---

## 0. Authority hierarchy (what wins when docs disagree)

1. **This document** — the sequenced build order. If a spec and this doc conflict on sequencing, this doc wins.
2. `IA-FINAL-V2-LIFEAPP.md` — the shipped truth (structure, routes, grove map, the 25 gate notes, the "Groves vs Menu" DECISION BOX).
3. `UI-SHELL-HOME.md` (shell chrome), `UI-V1-MODULES.md` (the 7 V1 screens), `UI-PLACEHOLDERS.md` (the 13-screen placeholder catalog), `MOTION-SPEC.md` (motion language), `VISUAL-DIRECTIVE-NEON.md` (the gate filter), `DESIGN-SYSTEM.md`.
4. `PRODUCT-SCOPE.md` — wave order for the placeholder→real swaps.
5. `FRONTEND-CONSTRAINTS.md` — buildability: no new deps, the animation budget, edge/runtime rules.

**Canonical counts (locked by QA §8, regression-test everything against these):** 31 modules · 6 groves · 5 tabs · **30 tiles + the W9 explainer row** · 38 real routes. No document may introduce a new count without a gate review.

---

## 1. The 38-route table (the complete URL map)

Every "screen" is a real route. No `useState` screen-switchers anywhere (FRONTEND-CONSTRAINTS buildability checklist item 1). Prefetch stays ON for tab-bar + Garden links, OFF for the Groves overflow index (per §3.2, the 100k req/day meter).

### 1.1 Tab shells (5 routes — Shell team, Phase 0)

| Route | Tab | Owner | Notes |
|---|---|---|---|
| `/` | Garden | Shell | The ritual home (§1.1 below) |
| `/today` | Today | Shell + W9 engine | 4 bands; W9 is the engine, the tab is its face |
| `/pookie` | Pookie | Shell | The AI clearing; Pookie/Muse light toggle |
| `/grow` | Grow | Shell | Retrospective surface; childless user is full from day one |
| `/groves` | Groves | Shell | Module index; pinned search row at top; `NAV.FIFTH_LABEL` token for the name |

Desktop: same five as a left IconRail (same routes, `md:` classes, zero re-implementation).

### 1.2 Module tiles → routes (33 routes — 30 tiles; the placeholder catalog maps 1:1)

**🌿 School Days** (child-visible only; routes still exist, gated by child profile)

| W | Module | Route | State at Phase 1 | Building to real in… |
|---|---|---|---|---|
| W1 | School | `/school` + `/school/:classId` + `/school/calendar` | Real-ish (built, not live) | Phase 2 (Team A) |
| W16 | School Calendar | `/school/calendar` (inside School — never a sibling tab) | Placeholder (in progress) | Phase 2 (Team A) |
| W5 | College & Future | `/college` | Placeholder (in progress) | V2, Wave 2 order (Team A) |
| W4 | Activities | `/activities` | Placeholder | V2 (Team B/A) |
| W18 | Summer | `/summer` | Placeholder | V3 / seasonal |

**💚 Body & Heart** (always visible)

| W | Module | Route | State at Phase 1 | Building to real in… |
|---|---|---|---|---|
| W2 | Health | `/health` | Placeholder → lite (V1.6) | Phase 2 (Team B) |
| W8 | Wellbeing | `/wellbeing` | Placeholder (V1.7 = one field on W1 check-in) | V2 full (Team B) |
| W13 | Meals | `/meals` | Placeholder | V2 |
| W22 | Activity | `/activity` | Placeholder (in progress) | V2 (Team B) |
| W23 | Nutrition | `/nutrition` | Placeholder (in progress) | V2 (after W13 — ships last of the three) |

**🏡 Home & Family** (always visible; parenting extensions appear only with a child)

| W | Module | Route | State at Phase 1 | Building to real in… |
|---|---|---|---|---|
| W21 | Mail | `/mail` | Real-ish (built, not live) | Phase 2 (Team B) |
| W20 | Shopping List | `/shopping` | Real-ish (built, not live) | Phase 2 (Team B) |
| W11 | Spending | `/money/spend` (top-tab view inside `/money`) | Placeholder | V2 |
| W7 | Money & Documents | `/money` | Placeholder | V2 |
| W24 | Credit | `/money/credit` (top-tab view inside `/money`) | Placeholder | See Phase 4 order (§5.4) |
| W14 | Co-parenting | `/co-parenting` | Placeholder (child-visible only) | V3 |
| W12 | Babysitters | `/childcare` | Placeholder (child-visible only) | V3 |
| W10 | Fairness | `/fairness` | Placeholder (parent-only, 2+ children) | V3 |

**🛡️ Safe & Sound** (child-visible only)

| W | Module | Route | State at Phase 1 | Building to real in… |
|---|---|---|---|---|
| W3 | Safety | `/safety` | Placeholder | V2 (phone tier) |
| W19 | Emergency | `/emergency` | Placeholder (documented no-seed exception, P-N5) | V3 |

**🌱 Growing Up** (child-visible only)

| W | Module | Route | State at Phase 1 | Building to real in… |
|---|---|---|---|---|
| W6 | Driving & Life Skills | `/driving` | Placeholder | V2-first |
| W15 | Screen Time | `/screen-time` | Placeholder | V3 (per-OS honesty) |
| W17 | Friends | `/friends` | Placeholder | V2 last |

**🌍 Out & About** (always visible)

| W | Module | Route | State at Phase 1 | Building to real in… |
|---|---|---|---|---|
| W25 | Fuel & Charging | `/fuel` | Placeholder | Phase 4 order (§5.4) |
| W26 | Weather | `/weather` + **Garden-dawn line live from Phase 2** | Placeholder tile; **ritual surface ships early** | Dawn line in Phase 2; destination in Phase 4 |
| W27 | Events | `/events` | Placeholder | Phase 4 order |
| W28 | Restaurants | `/restaurants` | Placeholder | Phase 4 order |
| W29 | Trails & Parks | `/trails` | Placeholder | Phase 4 order |
| W30 | Flights | `/flights` | Placeholder | **Last** (money-movement constraint) |
| W31 | Rental Cars | `/cars` | Placeholder | **Last** (money-movement constraint) |

**Plus:** `/child/:id` (the child's grove view, A-N2 — the plant-tap destination). **W9 (proactive engine)** has no tile and no route — its face is `/today` + the Garden queue + the W9 explainer row in Groves ("How Pookie picks your moments").

**Route count check:** 5 tabs + `/child/:id` + 33 module routes = 38. All live by end of Phase 1.

---

## 2. PHASE 0 — Design tokens + AppShell + 5-tab nav + Garden/Today chrome

**Owner:** Shell team. **Precedes everything.** Nothing in Phases 1–4 may ship before the token layer lands — all screens are token consumers, never token definers.

### 2.1 Design tokens (`tokens.css` layer)

1. The divine-light token system: glow color tokens, `--glow-*` custom properties, sigil tints per grove.
2. **Morning-mist light theme** (shell §0.5 — designed, not derived): every dark token → its light equivalent (`#f3f7f2` page, `#ffffff` surfaces, deep-canopy ink, deepened band hues). The neon-firefly law holds in light; restful, never washed.
3. **The night is always dark** — "rest is a color." Light/dark follows the day's clock, not just a user toggle.
4. The `prefers-reduced-motion` kill-switch in the same file (non-negotiable; every ambient animation gets one).
5. Safe-area utilities (`100dvh`, `env(safe-area-inset-bottom)` — never `100vh`, never fixed pixel padding for the home indicator).
6. `NAV.FIFTH_LABEL` token — the one-token flip between "Groves" and "Menu" (no screen spec changes; closes at the Milestone 1 gate, see §7.4).

### 2.2 AppShell (`app/(tabs)/layout.tsx`)

- Bottom tab bar, exactly 5: Garden · Today · Pookie (center orb ✦) · Grow · Groves. Active state from `usePathname()`. CSS-transform indicator pill. Desktop: left IconRail, same routes.
- **Persistent layout** — the tab bar never remounts on tab switches; prefetch free via `<Link>`.
- Header per A-N12: childless = identity + sync dot + ⌕ only (the lightest chrome in the product); parent = ChildSwitcher (avatar + name ▾) with the **360px collapse** (switcher + role merge into one element).
- **One interactive orb per screen (A-N14, decided):** Garden → hero orb; other tab screens → the breathing center-tab orb, **no FAB**; non-tab screens → FAB at z-55 (tap → `/pookie`, long-press → SOS confirm).
- SOS calm backup row: `🛟 Emergency — get help fast →` renders **below the water tap, above the QuietHoursBanner, at every hour including 11 PM**. The ≤2-tap promise is never gesture-dependent.

### 2.3 Garden (`/`) — the ritual home

Per shell §1.1–§1.6: GreetingHero → the garden scene (spotlight-plant pattern for parents, one plant for the childless user; **light follows the weather** per IA §1.5) → AttentionQueue "Today's Three" (exactly 3, day-ordered, each: situation + cause + ONE winnable CTA + "Not now" at 44px minimum) → Grove rails (live modules first with real state, then ONE collapsed *"N more taking root 🌱"* expander per grove) → TodayStrip → pinned **Water the Garden end-cap** (the signature exit — "if a session can't end calmly, that's a bug, not content").

- **Sub-3 queue:** the quiet-fill rule — 1–2 items under the `TODAY'S THREE` header + the quiet line ("The rest of today is clear — go enjoy your coffee.").
- **Day states:** morning (dawn bloom), evening 9 PM closeout (§2.4), night 11 PM (queue gone, one tomorrow line, water tap, SOS row).
- **W26 dawn line** rides under the GreetingHero — this is W26's ritual MVP, live in Phase 2 before the destination is built.

### 2.4 Today (`/today`) — the four bands

Now / This Week / Coming Up / If Needed (smart-ranked inside each band). Hub queue and Now are **one W9 engine, two lenses** — snooze/dismiss reflects in both (A-N16). "See the rest" for overflow — no raw counts. Empty bands speak warmly; suppressed states are honest ("2 updates resting until tomorrow — exam-week mode.").

### 2.5 Pookie (`/pookie`), Grow (`/grow`), Groves (`/groves`)

- **Pookie:** the clearing — orb, warm light, conversation; Pookie/Muse toggle as a change of *light*, never a settings switch; suggestions bloom into actions (approval sheets, plan views).
- **Grow:** GitHub-graph-meets-harvest; the childless user is FULL from day one (health rings, money patterns, wins bouquet, season recaps — never an empty parenting trophy case); Day-0 Grow = "Your story starts here" with three seedling rings.
- **Groves:** the 6-grove index, 30 tiles + W9 explainer row, each tile = sigil (Lucide, grove-tinted glow) + one-line "what I watch over" + freshness chip + state (live-with-data / taking-root / resting); **pinned search row at the top** (thumb-zone rescue hatch); Groves renders only-yours groves (absence, not adaptation).

**Phase 0 exit criteria:** tokens file complete (light + dark + reduced-motion + safe-area); 5-tab nav persistent across tab switches; Garden composition complete with all three day states (morning / 9 PM closeout / 11 PM night); Today bands; Pookie/Grow/Groves shells; orb/FAB rule enforced; SOS row visible at 11 PM; all touch targets ≥44px; `loading.tsx` ("growing…") and `error.tsx` per segment.

---

## 3. PHASE 1 — All 38 routes live: real where built, seedling placeholders where not

**Owner:** Shell team (placeholder catalog framework); module teams consulted on seed tables. **Blocked on:** Phase 0 tokens/shell; migration 014 (below).

### 3.1 The placeholder catalog maps 1:1 to routes

Every tile in §1.2 marked "Placeholder" gets a real route rendering the `UI-PLACEHOLDERS.md` spec — the 13-screen catalog (W6/W12/W19/W5/W3/W18 + W25–W31), the W24 credit placeholder (`UI-V1-MODULES.md` §V1.8), and the PLACEHOLDER-STANDARD anatomy for the remainder (W4/W7/W8/W10/W11/W13/W14/W15/W17/W22/W23 — the standard applies to any module not yet built).

**Anatomy (all required):** promise hero (≤60 words, one concrete vignette) → 3 capabilities with honest "how it will know" lines → **seed-it-now** (one real starting action — the form writes REAL rows) → while-you-wait cross-links (navigate to live modules) → arrival wave (honest, never dated) → the interest CTA ("Tell me when this grove opens" — registers a real row).

**Non-negotiables:** no dead CTAs · no fake data or fake UI · no "coming soon" (the taking-root 🌱 StatusPill is sunlight-tinted, never dimmed, never locks) · no progress bars · P-N6 seed-first ordering where the seed is the core ritual (W6 drive log above capabilities; W24 "Connect your cards" above the explainer) · W19 keeps its documented no-seed exception (P-N4/P-N5).

### 3.2 Seed infrastructure (migration 014 — owned by the Shell team)

`014_placeholder_interest.sql`:

```sql
-- placeholder_interest: the consent-gated launch-contact table
-- placeholder_interest(tenant_id, child_id NULLABLE, module, created_at)
```

- The interest CTA registers `placeholder_interest(tenant_id, module, created_at)` (child_id when the seed is child-scoped, e.g. W6). Launch notifications fire ONLY to registered parents — no cold pushes (UX-HABIT-DESIGN §4.3 #5).
- **Seed forms write the module's REAL tables**, not a scratch table. Each module's seed (W25 vehicle profile, W26 places, W27 interests + drive radius, W28 taste profile, W29 home location, W30 home airport + watched trip, W31 loyalty + coverage, W24 card-connect intent, W6 drive-log seed, W19 SOS emergency contacts) is owned by the team that will build that module — the Shell team builds the shared seed-form component and the StatusPill, the module teams define the schema and validation.
- Module seed tables land in each module's own migration when the module is built (Phase 4); the placeholder's seed form is written against the FINAL schema, so no data migration happens at graduation.

### 3.3 Tile-state discipline (how "live" becomes "live")

A tile is **live-with-data** only when the module's real V1/V2 screen is deployed behind its route AND its freshness chip reports real freshness. Until then it is **taking-root**. The swap is a single flag per module (`module_state: live | taking-root | resting`) — never two tiles rendered side by side, never a placeholder and a real screen on the same route. The Groves map reads the flag; the Garden rails read the flag. **One flag, three readers, zero drift.**

**Phase 1 exit criteria:** all 38 routes return real pages (no 404s, no blank stubs); every placeholder passes the PLACEHOLDER-STANDARD §6 build checklist (every CTA does something real — interest registers, seed writes, cross-links navigate); `placeholder_interest` migration applied with RLS; tile-state flags exist for all 30 tiles.

---

## 4. PHASE 2 — V1 module functionality wired to real data

**Blocked on:** migrations 006–013 applied (§6.1); Phase 0/1. **The founder's gate lives here.**

### 4.1 The V1 seven (PRODUCT-SCOPE §2) — "Morning Mission Control"

| V1 | Module | Owner | What "wired" means |
|---|---|---|---|
| V1.1 | W1 School core | Team A | Real grades from the laptop sync pipeline → grade deltas overnight → Path-to-90 per class → teacher comms drafts → **W8-pulse field on the daily check-in** (V1.7 rides here) |
| V1.2 | W9 Proactive engine | Shell team (engine) + Team A/B (feeders) | **THE actual product.** Attention items emitted by every V1 module through the shared feeder contract (§4.2); ranking: safety → time-critical (<48h) → high-leverage (missing/zeros first) → gentle; the morning briefing + evening closeout |
| V1.3 | W16 School minutiae | Team A | Extractor off the W1 school-email pipeline — zero new data sources; lead-time prep math (spirit week = 3 days, slip = night before); feeds the briefing |
| V1.4 | W21 Mail | Team B | Snap → classified → approval sheet ("Approve payment?" — W24 logs the tracked payment, W11 logs the spend, the reminder cancels itself) |
| V1.5 | W20 Shopping list | Team B | Shared list, tagged by who, claim-in-place; feeds the evening closeout |
| V1.6 | W2 Health, lite | Team B | Profile + meds/reminders + immunizations + visit-agenda builder (seeded from Dawson's baseline); quiet by design — no cards when healthy, no health scores |
| V1.7 | W8 Mood pulse | Team A | One field on the W1 daily check-in (mood/energy/stress); aggregate-only to the parent; privacy contract stated at the surface |

**Built-but-not-live (W1, W20, W21):** go live in Phase 2 behind their tile flags. "Not live" means the routes render but the data path isn't connected — wiring them is Team A/B's first Phase 2 work, before any new functionality.

### 4.2 The W9 feeder contract (the single most important interface in the build)

Every module emits attention items through ONE contract — this is what makes "one queue, two lenses" true and what keeps new modules from rebuilding the engine:

```
attention_item(module, tenant_id, child_id?, situation, cause, one_cta {label, route/action}, band_hint, rank_hint, dedupe_key, expires_at)
```

- **W9 owns ranking, banding, snooze, and dismissal.** Modules own the situation + the one winnable CTA. No module may write directly to the Garden queue or a Today band.
- **Dedupe:** `dedupe_key` per module+event — the W21 approval sheet and the W24 payment log for the same bill are one item, not two (the 7:12 AM moment in IA §4 proves the one-question/two-tap bar).
- **Seeds feed W9 first:** the W26 dawn line (§1.5 ritual-surface pattern) is a W9 input, not a weather-app feature. When the forecast changes, W9 reshuffles priorities (practice moved inside → evening plan adjusts) — this is the proof the engine is alive.

### 4.3 Ritual surfaces before destinations

W26's Garden-dawn line ("Sunny, 75° — no jacket needed.") goes live in Phase 2 riding on existing W9 — **the tile `/weather` can stay taking-root.** This is the ritual-surface pattern (§1.5 of the IA): the ritual moment is the primary surface, the tile is the "tell me more." Future ritual-surfaces copy this ordering.

**Phase 2 exit criteria (this IS the Milestone 1 gate — see §7):** the founder opens Pookie on a random Tuesday morning, in staging, and says "Pookie runs my family's life" without prompting. Every V1 module feeds the briefing or the closeout — no dead ends, no dashboards of numbers.

---

## 5. PHASE 3 — Motion pass per MOTION-SPEC

**Owner:** Shell team, with a motion review checklist per screen. **Blocked on:** Phase 2 (motion polishes real flows, never placeholder chrome — a beautiful placeholder that blocks a real screen is a regression).

1. **The 4 habit-loop choreographies, exact:** dawn bloom reveal (2.4s, once/day, only with overnight change) · completion bloom + firefly burst (1.1s — the 500th-time reward circuit) · Water the Garden exit (2.0s, spends the full 3-glow ceiling on purpose) · first-bloom ≤48h (1.6s).
2. **Budget enforced per screen** (the §4 ledger): Garden morning 2 glows / Water exit 3 / SOS 0; the 9-item never-animate list (body copy, numbers, nav, alerts, destructive actions, empty states, W19, backdrop-blur, box-shadow/filter); ≤8 staggered items; glow budget mobile ≤3 / desktop ≤6.
3. **SOS exception:** the panic path is instant — 120ms flat, no rise/bloom/stagger, accepts input from frame one. Shell §7's timing matches MOTION-SPEC §5 (QA §8 #16 verified).
4. **Transitions:** motion lives INSIDE routes, never between them — no custom page-transition choreography (FRONTEND-CONSTRAINTS §A5, banned for V1). Tab switch = content settle + rise, indicator pill slides 220ms; sheets = scrim fade + 48px bloom-up; one restrained view-transition hero (child avatar, hub → `/child/:id`) only.
5. **Reduced-motion first-class:** ambient stopped at rest frames, entrances become 200ms fades, bursts skipped, dawn reveal skipped — glows remain, state changes always survive.
6. **The 11 PM test of motion:** moonlit state — 8s breath, 20s drift, nothing pulses faster than 4s, night Garden has no staggers. Ambient-life registry honored (orb breathe 5s / fireflies 12s drift / dapple OR sigil-breathe, never both).

**Phase 3 exit criteria:** the 10-point motion review checklist passes on every V1 screen; the glow-budget ledger is green on mobile (real-device test, not emulator); reduced-motion path verified on every animated component.

---

## 6. PHASE 4 — Placeholder→real swap, module by module (PRODUCT-SCOPE wave order)

**Blocked on:** the module's feeder contract (it must emit attention items from day one) and its seed tables (its placeholder's seeds already wrote against this schema — no migration at graduation).

### 6.1 V2 order (sequenced by daily-ritual leverage)

1. **W6 Driving** (V2-first — Dawson is permit-eligible NOW) — Team A
2. **W5 College** (in progress — guidance engine + essay workspace + deadline tracker) — Team A
3. **W22 Activity** (in progress — HealthKit/Health Connect; manual entry first) — Team B
4. **W13 Meals** — Team B; needs W2 rollups; the deterministic allergy gate is code, not LLM
5. **W23 Nutrition** (in progress — ships LAST of the three: W13 meal data + W22 exercise + W20 list) — Team B
6. **W8 Wellbeing, full** — trend detection over the V1 pulse + W22 sleep data; the crisis tripwire is disclosed, logged, minimum-necessary — Team B
7. **W3 Safety, phone tier** — geofencing + SOS via the trust contract; SOS handoff packet draws on W2 medical flags — Team A
8. **W7 Banking ledger + documents** (zero compliance: virtual ledger, passport/ID expiry) — Team B
9. **W11 Spend intelligence** — needs W7's ledger + W4/W21 spend events; the W21→W11 loop stays visible — Team B
10. **W4 Activities** — tryout radar, prep timelines; W9's T8 trigger comes alive here — Team A
11. **W17 Social life** — child-private by default; the privacy contract is the feature — Team B

### 6.2 V3 (partnership- or procurement-gated)

W14 co-parenting · W18 summer (ships when the calendar says so — February, consent-gated) · W19 guardianship · W15 screen time (per-OS honesty) · W3 hardware (procurement: ODM firmware-to-us-only, lab traffic verification) · W12 babysitters · W10 fairness (UI surface on native multi-tenancy) · W7 banking partnerships (Plaid read-only; movement-capable gated on compliance).

### 6.3 PRODUCT-SCOPE hard NOs — engineering must enforce these in code, not just copy

- No scraped retailer prices presented as live (W20). · No calorie targets/weight-loss for under-18 (W13/W23) — nourishment framing only. · No location-as-punishment tooling (W3). · No message scanning/substance surveillance (W2/W15/W17). · No diagnostic verbs anywhere (UI lint on copy + prompts). · No auto-pay/dispute/file/move (W21/W7) — the AI drafts, the parent acts. · Not a money transmitter, ever. · No secret tripwires (W8/W22) — disclosed, logged, minimum-necessary. · No fake APIs (Common App push, College Board/ACT pull, Find My, Quest/Labcorp, live prices). · Pattern store stays dark until k≥20 distinct children — expert-authored patterns only.

### 6.4 Graduation order for W24–W31 (the Out & About grove + Credit — not in PRODUCT-SCOPE waves)

Proposed by the PM; the founder confirms or reorders before Phase 4 begins:

1. **W26 Weather** — the destination tile graduates after the dawn line is proven (cheapest graduation: the ritual is already live).
2. **W25 Fuel / W29 Trails / W28 Restaurants / W27 Events** — data-feed modules; honest data lines already spec'd (prices timestamped or not shown; charger availability marked known vs estimated).
3. **W24 Credit** — partnership-gated (Plaid read-only for cards; bureau scores via paid reseller pulls — the placeholder's honest data line stands until the wires exist).
4. **W30 Flights / W31 Rental Cars — LAST.** The money-movement constraint (IA §1.6) is a founder-level requirement and gates graduation: PCI scope (card data never touches Pookie servers — tokenized provider flows), "from $X" pricing banned (actual bookable totals), plain-language cancellation/change terms at the decision point, no dark patterns (no countdown timers, fake scarcity, pre-checked upsells), receipts flow to W11.

**Swap mechanics (every graduation, no exceptions):** tile flag `taking-root → live` flips in ONE deploy with the module's real screen; the module's seed data is already in the final schema (no migration); interest registrants from `placeholder_interest` get the consent-gated launch note; the Groves freshness chip reports real freshness; the Garden rail moves the tile from the collapsed expander to the live row. **If a graduation can't flip the flag in one deploy, it isn't ready.**

---

## 7. Dependency map — what blocks what

```
Design tokens (Phase 0) ──► EVERYTHING (every screen is a token consumer)
        │
Migrations 006–013 (APPLY — files exist, DB doesn't) ──► module data reads
        │                        ├──► W1/W20/W21 go-live (built-but-not-live)
        │                        └──► V1 module wiring (Phase 2)
        │
014 placeholder_interest (Shell team, Phase 1) ──► placeholder catalog interest CTAs
        │
Placeholder seed tables (module-defined schema, placeholder writes against FINAL schema)
        │                        └──► graduation = flip tile flag, NO data migration
        │
W9 feeder contract (§4.2) ──► every module's attention items ──► briefing/closeout
        │
W9 engine ──► Garden queue + Today Now (one queue, two lenses)
        │
MOTION-SPEC (§5, Phase 3) ──► real flows only (never placeholder chrome)
        │
tile flag (taking-root → live) ──► Groves tiles, Garden rails, freshness chips
```

### 7.1 The migration backlog (DevOps — blocking)

006–013 exist as files in `supabase/migrations/`, **not yet applied**: 006 (W1 school core), 007 (W20 shopping), 008 (W21 mail), 009 (W5 college prep), 010 (W16 minutiae). (Verify the remaining files in the set — the full 006–013 range must be applied in order before Phase 2 starts.) W1/W20/W21 cannot go live until their tables exist.

### 7.2 What does NOT block

- **The unstyled-deploy issue** does not block engineering — it blocks the *review*. The gate review happens on a styled staging build; the CSS deploy fix runs on a separate track.
- **W30/W31 money-movement work** does not block anything in Phases 0–3 — those tiles stay taking-root until Phase 4.
- **New module ideas** do not block anything — they enter the queue under the extensibility rule (R1) and join a grove at graduation, never a tab.

---

## 8. Team assignment — the two engineering teams + the Shell team

| Team | Composition | Owns | Does NOT own |
|---|---|---|---|
| **Shell team** (new, from the 3-agent build team + design liaison) | Senior Full-Stack + design liaison | Tokens, AppShell, 5-tab nav, Garden/Today/Pookie/Grow/Groves chrome, W9 engine + feeder contract, placeholder catalog framework, migration 014 (`placeholder_interest`), seed-form components, the W26 dawn line, Phase 3 motion pass, Orb/FAB/SOS | Any module's business logic or data schema |
| **Team A — School pod** | Senior Backend + Full-Stack | W1, W16, W5, W6, W3, W4, W10 (school-side modules); W1's check-in + W8-pulse field; migrations 006/009/010 | Life-pod modules |
| **Team B — Life pod** | Senior Backend + Full-Stack | W2, W8, W13, W22, W23, W20, W21, W7, W11, W24, W25–W31 (life-side modules); migrations 007/008 | School-pod modules |
| **DevOps** | DevOps Manager | Apply migrations 006–013 in order (before Phase 2), 014 when Shell team delivers it; staging deploy health (the unstyled-deploy fix on its own track); Capacitor remote-URL mobile parity | Feature code |

**W9 ownership rationale:** the engine and the Today tab are one surface, so one team owns both — the Shell team. Team A/B own their modules' **feeder emission** (the contract in §4.2) and their modules' data tables. If a briefing card is wrong, the feeder owner debugs the situation + CTA; if the ranking is wrong, the Shell team debugs the engine. No shared ownership of the queue.

**Placeholder seed table ownership:** each module's seed schema is defined by the module's owning team (Team A for W5/W6 school seeds, Team B for W25–W31/W24 life seeds, Shell team for none — but Shell owns the shared seed-form component, the StatusPill, and the interest CTA). **The placeholder writes against the FINAL schema** — so when the module team builds the real migration later, they must not change the seed-table schema the placeholder shipped against. Schema review at placeholder time, not at graduation time.

**Handoff discipline:** phases are sequential at the *flag* level (a phase's exit criteria gate the next phase's flag flips), but teams work in parallel inside a phase. The Shell team is the bottleneck resource — Phase 0 and Phase 1 are shell-bound; Team A/B de-risk Phase 2 by wiring W1/W20/W21 data paths (behind `taking-root` flags) while the shell lands.

---

## 9. Milestone 1 gate checklist — the founder's break-it-or-make-it review

**The gate condition, in the founder's own words (PRODUCT-SCOPE §2):** open Pookie on a random Tuesday morning and say, without prompting, *"Pookie runs my family's life."* The review runs on **staging, styled build**, in both personas (the dad: Dawson + Ella; Maya: childless). Each item below is PASS/FAIL — one FAIL is a failed gate.

### 9.1 The canonical truths (regression tests against the QA kill list)

- [ ] **Counts:** 31 modules · 6 groves · 5 tabs · 30 tiles + the W9 explainer row — everywhere (QA §8 #1 regression).
- [ ] **Personas:** Maya is ONLY the childless persona (29, Austin); the dad's second child is **Ella**; the sitter is **Priya** (QA §8 #4 regression).
- [ ] **Orb rule:** one interactive orb per screen — Garden hero orb; tab screens: center-tab orb, no FAB; non-tab screens: FAB at z-55 (QA §8 #5 / A-N14).
- [ ] **Light theme exists** (morning-mist, designed not derived); **the night is always dark** (QA §8 #14).
- [ ] **All 38 routes live.** Deep links and Groves tiles navigate; zero 404s, zero blank stubs.
- [ ] **Every placeholder CTA does something real** — interest registers a `placeholder_interest` row; seeds write real tables; cross-links navigate (QA §8 #1/P-N4).

### 9.2 The ritual tests

- [ ] **The 5-second test:** a Facebook-fluent adult opens Garden and can say what the app does and where everything lives — in five seconds (QA's 5-second test, per-screen).
- [ ] **The 11pm test:** queue gone (not collapsed — gone); one tomorrow line; water tap; the quiet SOS row below the tap, above QuietHoursBanner; nothing pulses faster than 4s; night Garden has no staggers (shell §1.5, IA §3.2, MOTION-SPEC).
- [ ] **The morning test:** dawn bloom reveal plays once (only with overnight change); the W26 dawn line sits under the GreetingHero; the briefing is one screen.
- [ ] **The calm-exit test:** every session can end on the water tap with the signature sentence — "can't end calmly = bug" (UX-B's rule).
- [ ] **The childless test:** Maya's app shows 17 modules (16 tiles + W9 timing), three groves, one plant, Day-0 intake with 7 tiles, Day-0 Grow ("Your story starts here") — and **zero parenting affordances** anywhere.
- [ ] **The transition test:** the add-child ritual grows the garden (spotlight plant), gains the ChildSwitcher, three groves take root as seedlings — with **no re-onboarding, no mode switch, no grove-map reorganization** of her existing modules.

### 9.3 The interaction tests

- [ ] **SOS panic path:** ≤2 taps from anywhere, gesture-independent; sheet appears in 120ms flat, no animation, accepts input from frame one (shaking-hand gate).
- [ ] **One queue, two lenses:** snooze/dismiss in the Garden queue reflects in Today's Now band and vice versa (A-N16).
- [ ] **7:12 AM moment:** mail scan → one briefing card → approval sheet → two taps → W21/W24/W11 close visibly. One question answered, zero module visits.
- [ ] **"Not now" is 44px minimum** on every card, no exceptions (QA §8 #9).
- [ ] **Tile names:** 2-line clamp, state line always visible (QA §8 #10).
- [ ] **Failed states:** OCR total failure (calm manual card, never rose) · `/school` portal disconnected ("Still gathering — your garden is safe") · sub-3 queue renders under `TODAY'S THREE` with the quiet line (QA §8 #11/#12).

### 9.4 The founder decisions (must close before the gate verdict)

- [ ] **"Groves" vs "Menu":** QA's 5-second test FAILED "Groves." The tab ships under the `NAV.FIFTH_LABEL` token — the founder rules (keep "Groves," or flip to "Menu"), and engineering applies the one-token change. **No gate verdict without this ruling.**
- [ ] **Phase 4 graduation order for W24–W31** confirmed or reordered (§6.4).

---

## 10. Risk register — top 5

**R1. The module count keeps growing (24 → 31 happened mid-design).**
*Impact:* every growth event re-renders groves, rails, the intake, and the counts QA regression-tests. *Mitigation:* the **extensibility rule is law** — new modules join groves, groves don't multiply without a gate review, tabs never change. The tile-state flag system (§3.3) makes additions additive: a new module ships as `taking-root` in one grove, touching nothing else. *Owner:* Design Coordinator (gate reviews); PM (count audits at every graduation).

**R2. Placeholder→real swap coordination — two surfaces, one route, one deploy.**
*Impact:* the classic failure is a placeholder and a real screen racing on the same route, or Groves saying "live" while the Garden rail says "taking root." *Mitigation:* **one flag, three readers** (§3.3) — the swap is a single `module_state` flip in ONE deploy; the module isn't ready until it can flip in one deploy. Graduation checklist (§6.4) runs before every flip. *Owner:* the module's owning team; DevOps verifies the flag read in staging.

**R3. The unstyled-deploy issue blocks the actual gate review.**
*Impact:* the styled build is not yet verified live on staging — the founder judges *design*, and an unstyled build fails Milestone 1 regardless of what's built. *Mitigation:* the CSS deploy fix runs as a **separate DevOps track with its own owner and its own acceptance test** (styled staging build verified before the gate is scheduled). The gate does not convene until that test passes. Engineering phases proceed in parallel — the unstyled issue blocks only the review, never the build. *Owner:* DevOps Manager.

**R4. W9 is the product and it is unbuilt — the highest-risk dependency.**
*Impact:* every V1 module is decoration without the engine; the briefing is the composition layer where all integration bugs concentrate (band slips, double-counted items, ranking failures). *Mitigation:* the **feeder contract** (§4.2) decouples modules from the engine — Team A/B can build and test feeders against a stub engine while the Shell team builds ranking/banding/snooze. The 7:12 AM storyboard (UI-V1-MODULES) is the integration acceptance test: one question, two taps, three modules closing visibly. A-N17 (band slip) and A-N16 (two lenses) are explicit regression items in §9. *Owner:* Shell team (engine); Team A/B (feeders).

**R5. Seed-data drift — placeholders write against schemas their future migrations might change.**
*Impact:* a module graduates and its seed data doesn't fit the "final" schema — silent data loss or a forced migration on launch day. *Mitigation:* **placeholders write against the FINAL schema** (§3.2); schema review happens at placeholder time, and the module team's later migration must not alter shipped seed-table shapes. Seeds are module-owned tables, so no cross-module blast radius. *Owner:* module-owning teams; PM audits at graduation.

---

## 11. What happens after this document

1. DevOps applies migrations 006–013 (ordered), unblocks Team A/B data wiring.
2. Shell team delivers migration 014 + Phase 0 tokens/shell.
3. Phase 1: all 38 routes live; the placeholder catalog ships; tile flags exist.
4. Phase 2: the V1 seven wire up; the W26 dawn line goes live; the founder's gate convenes on a styled staging build.
5. Phase 3: motion pass; Phase 4: graduations in wave order.

**This document is the build order.** Design questions go to the Design Coordinator; sequencing conflicts resolve here; new modules enter under the extensibility rule (R1) or not at all.