# IA-FINAL.md — Pookie's Shipped Information Architecture
**Author:** Information Architect · **Date:** 2026-10-11 · **Status:** FINAL — this is what ships (founder reacts and refines from here)
**Supersedes:** the planned A/B concepts (founder pivot 2026-10-11: no options, one final structure).
**Inputs:** PRODUCT-SCOPE.md · UX-MENTAL-MODELS.md · UX-HABIT-DESIGN.md · DESIGN-DIRECTION.md · FRONTEND-CONSTRAINTS.md · DESIGN-SYSTEM.md.

---

## 0. The decision, in one paragraph

Pookie ships **one home that is a garden, four companion destinations, and a grove map that holds all 23 modules from day one.** The bottom tab bar is exactly five: **Garden · Today · Pookie · Grow · Menu**. The **Garden** tab is the home screen (the living garden, the morning ritual, the attention queue). **Today** is the cadence engine — Now / This Week / Coming Up / If Needed — where W9's proactive engine lives as a surface instead of a tab. **Pookie** is the AI clearing (Pookie/Muse toggle). **Grow** is the progress artifact (rings, roots, season recaps). **Menu** is the full grove map: all 23 modules, grouped into 5 groves, live modules glowing, unbuilt ones rendered as *taking-root seedlings* — the full vision, beautifully, with zero "coming soon" scaffolding. Nothing else is a tab, ever. New modules join a grove; they never become tabs.

**Why this won:** UX Researcher A proved cadence is the parent's mental model ("what needs my attention right now") and that 23 modules ≠ 23 destinations. UX Researcher B proved the garden is the habit machine (blooming-never-decay, Garden Dawn/Sunset rituals). The Design System specified the 5-tab shell and the 5-grove map. This IA is the only arrangement that lets all three be true at once: the ritual lives in Garden, attention lives in Today, everything lives in Menu. The losing alternatives — a pure cadence feed with no garden home, a garden that *is* the router, a 7-tab control room — died on habit (drawer/tab-overload kills the ritual), buildability (custom transitions, animated orb-everywhere), and the kill-criteria (control-room density).

---

## 1. The shipped structure

```
┌─────────────────────────────────────────────────────────────┐
│  AppHeader (persistent)                                     │
│  [ChildSwitcher: avatar+name ▾] [Role: Parent]  [SyncDot] [⌕]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┤
│  │ ① GARDEN /   │ ② TODAY /    │ ③ POOKIE /   │ ④ GROW /     │ ⑤ MENU /
│  │ Home         │ Attention    │ AI clearing  │ Progress     │ Grove map
│  │ (the ritual) │ (cadence)    │ (orb, chat)  │ (artifact)   │ (all 23)
│  └──────────────┴──────────────┴──────────────┴──────────────┘
│                                                             │
│  Garden Hub: GreetingHero → AttentionQueue (≤5) →            │
│              GroveSections (5 rails) → TodayStrip           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BottomNav:  Garden · Today · Pookie(✦ center orb) · Grow · Menu │
└─────────────────────────────────────────────────────────────┘

        MENU (the grove map — all 23, one level)
        ┌──────────────────────────────────────────────────┐
        │ 🌿 School Grove    W1 · W16 · W5 · W18 · W4        │
        │ 🌸 Body & Heart    W2 · W8🔒 · W13 · W22 · W23🔒   │
        │ 🛡️ Safety         W3                               │
        │ 🌱 Growing Up      W6 · W7 · W15                   │
        │ 🏡 Home & Family   W20 · W21 · W11 · W19 · W14 ·   │
        │                   W12 · W17🔒 · W10               │
        │ ── W9 = Today tab (the engine's face, not a tile) │
        └──────────────────────────────────────────────────┘
```

**Route skeleton** (every screen is a real route — no `useState` screen-switchers, per FRONTEND-CONSTRAINTS §1.8):

| Route | Destination |
|---|---|
| `/` | Garden Hub (home) |
| `/today` | Today — attention queue + today's plan |
| `/pookie` | Pookie clearing (chat) |
| `/grow` | Grow — progress artifact |
| `/menu` | Grove map (all 23) |
| `/school` | W1 School core (grades, check-in, path-to-90, teacher comms) |
| `/school/:classId` | Class page (branch: gap-to-90 hero, top-3 actions, check-in + uploads below) |
| `/school/calendar` | W16 minutiae feed (picture day, slips, spirit week — inside School, never a sibling tab) |
| `/college` | W5 College & Future (trajectory, deadlines, essay workspace) |
| `/summer` | W18 Summer planning |
| `/activities` | W4 Extracurriculars (tryouts, lessons, tutors) |
| `/health` | W2 Health (profile, meds, immunizations, visit-agenda builder) |
| `/wellbeing` | W8 Emotional wellbeing (child-private 🔒) |
| `/meals` | W13 Meal planning |
| `/activity` | W22 Exercise tracker (the data layer — parent glances) |
| `/nutrition` | W23 Nutrition (child's what-if tool 🔒 for teen use; parent sees patterns) |
| `/safety` | W3 Safety (geofence, SOS, trust contract) |
| `/driving` | W6 Driving & life skills |
| `/money` | W7 Banking & documents + W11 Spend intelligence (one Money destination — the split-brain fix) |
| `/screen-time` | W15 Digital wellbeing |
| `/shopping` | W20 Shopping list (family-scoped) |
| `/mail` | W21 Mail intelligence |
| `/emergency` | W19 Guardianship vault |
| `/co-parenting` | W14 Co-parenting |
| `/childcare` | W12 Childcare |
| `/friends` | W17 Social life (child-private 🔒) |
| `/fairness` | W10 Fairness (parent-only family dashboard) |

**The anti-collision rules, enforced in the routes above** (UX-A's three dangerous triples):
- *Three healths* → **one `/health` destination**; W22 and W23 are adjacent tiles inside Body & Heart, labeled by job ("Activity — the numbers", "Nutrition — the what-if tool"), never three sibling tabs.
- *Food triangle* → W13 `/meals` wires straight into W20 `/shopping` (one flow: plan → list); W23 reads the meal plan as baseline. The seams are one tap, the destinations stay one per job.
- *Three schools* → W16 lives **inside** `/school` as the minutiae feed; W5 is `/college`, labeled by outcome ("College & Future"), never by institution.

---

## 2. The five destinations, specified

### ① Garden — `/` (the home tab, the ritual surface)

Top-to-bottom composition (single thumb, one screen, no dashboard grids):

1. **GreetingHero** — "Good morning, Mehedi ☀️" + date + one-line garden state: *"The garden is thriving — 2 things could use a look."* (Quiet morning: *"All quiet. Nothing needs you today."*)
2. **The Garden itself** — one plant per child (Dawson's tree first), Pookie's orb breathing above them, soft dawn/dusk light following the user's hour. One focal moment, not a scene to decode. Tapping a child's plant → that child's grove (`/child/:id`, the child view).
3. **AttentionQueue** — max 5 AttentionCards (✦ NEEDS A LOOK, sunlight glow, one winnable CTA each) + "See all ({n})" → `/today`. This is the only place attention competes for space. Max 5 on the hub; the rest waits in Today. No badges, no counts screaming on the chrome.
4. **GroveSections** — the 5 groves as horizontal living-card rails. Live modules render with real state (School: "Geometry — 21 to the mission"; Shopping: "4 items, 1 claimed"). Taking-root modules render as seedlings with their invitation (see §9).
5. **TodayStrip** — today's calendar items across modules (test Thursday, slip due Friday, bill reminder) — one horizontal strip, not a calendar grid.

**Route discipline:** cards are `<Link>`s; sheets use intercepting routes (`/today/approve/abc` renders as a sheet over the hub, back closes it). The hub never becomes the router — it is a page with links.

### ② Today — `/today` (the attention engine's face)

W9 lives here — not as a tab called "Briefing" (jargon, per UX-A P4), but as **four attention bands** — the cadence architecture made visible. This closes UX-A's open question #1 (bands vs. single feed): **bands, with smart ranking inside each band.** Predictable beats clever at 11 PM.

- **Now** — the AttentionQueue, full-length: safety (rose, rare) → time-critical (<48h) → high-leverage (missing/zeros first) → gentle (suggestions). Each card: situation + cause + ONE winnable CTA + "Not now" (snoozes 24h, logged). Grouped **by child** when 2+ children: *"Dawson: 2 items · Maya: 1 item."*
- **This Week** — the planning surface: W13 meal-week, W11 weekly spend, W16 week preview, W4 practice schedule, W8 trend aggregate, W15 weekly report. The "tending the garden" Sunday surface lives here all week.
- **Coming Up** — the horizon: countdowns, not calendars. College deadlines (30/14/7/2), permit eligibility, passport renewal, immunization windows, summer planning season. Dormant seasonal modules surface their next wake here ("Summer grove wakes in February 🌱" — a countdown, not a dead tile).
- **If Needed** — event-driven and dormant: SOS history, vault status, co-parent handoffs, birthdays, fairness gut-check. Visible, calm, never nagging.

**Honest silence:** when a band is empty it says so warmly — *"Nothing here. The engine is watching — go enjoy your coffee."* — and suppressed-state honesty per UX-A P10: *"2 updates resting until tomorrow — exam-week mode."*

### ③ Pookie — `/pookie` (the clearing)

Not a chat window — **a clearing**: Pookie's orb, warm light, conversation that feels like talking to a presence. The Pookie/Muse toggle is a change of *light* (warmer vs. clearer), not a settings switch. Suggestions bloom into actions (approval sheets, plan views). The orb is a FAB at z-55 on other screens for ambient presence only — never an omnipresent animated orb (FRONTEND-CONSTRAINTS A1).

### ④ Grow — `/grow` (the progress artifact)

The retrospective pride surface — GitHub-graph meets harvest:
- **This week's growth:** completed items, rings advanced, streaks watered, wins bouquet. Strengths first, always.
- **Per-child GrowthRings + SproutMeters** (Seed → Sprout → Sapling → Grove → Canopy) + DeltaLines with cause-first captions.
- **Season Recap** at semester boundaries ("Fall 2026: 14 blossoms, 3 comebacks, 1 mission complete").
- **W10 Fairness** is reachable here too for multi-child families ("am I being fair?" reflection sits beside growth — parent-only, never a leaderboard).
- Copy discipline: "3-day streak — Sapling 🌱", never streak-loss language. Broken streak: *"The sapling is still here — water it today 🌱."*

### ⑤ Menu — `/menu` (the grove map, the full 23)

The complete module index — **every one of the 23 modules visible from day one**, grouped in the 5 groves (§1.2 of DESIGN-SYSTEM, adopted verbatim — it matches UX-A's domain grouping A closely enough that inventing a sixth taxonomy would be ego, not improvement). Each tile: sigil (Lucide, grove-tinted glow), module name in plain parent verbs ("Mail", "Shopping List", "Meals" — never "W11"), one-line *"what I watch over"* subtitle, freshness chip, and state: live-with-data, taking-root (seedling), or resting (seasonal dormant).

**Menu is also the overflow contract:** no new tab is ever added for a new module. 24th module → joins a grove. This is a standing rule.

---

## 3. All 23 modules placed (no orphans)

| Module | Parent name | Grove | Primary home | Day-one state |
|---|---|---|---|---|
| W1 School core | School | 🌿 School | `/school` | **Live** — grades, check-in, path-to-90, teacher comms |
| W16 Minutiae | School Calendar | 🌿 School | `/school/calendar` (inside School) | **Live** — extracted from school-email pipeline |
| W5 College prep | College & Future | 🌿 School | `/college` | **Live** — guidance engine, deadlines, essay workspace |
| W18 Summer | Summer | 🌿 School | `/summer` | Taking root — wakes with countdown in Coming Up |
| W4 Extracurriculars | Activities | 🌿 School | `/activities` | Taking root — tryout radar, tutor directory |
| W2 Health | Health | 🌸 Body & Heart | `/health` | **Live (lite)** — profile, meds, immunizations, visit agenda |
| W8 Wellbeing | Wellbeing | 🌸 Body & Heart 🔒 | `/wellbeing` | **Live (pulse)** — 10-sec mood/energy/stress on the check-in |
| W13 Meals | Meals | 🌸 Body & Heart | `/meals` | Taking root — wires into `/shopping` at seed |
| W22 Exercise | Activity | 🌸 Body & Heart | `/activity` | **Live** — steps/sleep glance (the data layer) |
| W23 Nutrition | Nutrition | 🌸 Body & Heart 🔒 | `/nutrition` | **Live** — child's what-if tool; parent sees patterns |
| W3 Safety | Safety | 🛡️ Safety | `/safety` | Taking root — phone-tier geofence + SOS (V2) |
| W6 Driving | Driving & Life Skills | 🌱 Growing Up | `/driving` | Taking root — permit-prep content in progress |
| W7 Banking | Money & Documents | 🌱 Growing Up | `/money` | Taking root — virtual ledger + doc expiry |
| W15 Screen time | Screen Time | 🌱 Growing Up | `/screen-time` | Taking root — Android real, iOS honest |
| W20 Shopping | Shopping List | 🏡 Home & Family | `/shopping` | **Live** — family-scoped, tagged by who |
| W21 Mail | Mail | 🏡 Home & Family | `/mail` | **Live** — snap → classify → action + reminder |
| W11 Spend | Spending | 🏡 Home & Family | `/money#spend` (view inside Money) | Taking root — intelligence layer on the ledger |
| W19 Guardianship | Emergency | 🏡 Home & Family | `/emergency` | Taking root — vault + annual review nudge |
| W14 Co-parenting | Co-parenting | 🏡 Home & Family | `/co-parenting` | Taking root — share-link-first design |
| W12 Childcare | Babysitters | 🏡 Home & Family | `/childcare` | Taking root — curated directory pattern |
| W17 Friends | Friends | 🏡 Home & Family 🔒 | `/friends` | Taking root — child-private by default |
| W10 Fairness | Fairness | 🏡 Home & Family (parent-only) | `/fairness` (+ Grow) | Taking root — lens across children, never a leaderboard |
| W9 Engine | (not a destination) | — | **`/today` + Garden AttentionQueue + push** | **Live** — the briefing, the queue, the notifications |

**Cross-cutting placements (the non-obvious calls):**
- **W9 is not a tile anywhere.** It is the Today tab, the Garden's AttentionQueue, and the notification layer. Putting a 24th "Briefing" tile in the grove map would resurrect the exact mistake UX-A flagged ("W9 is not a card").
- **W11 lives inside `/money` as a view**, not a sibling destination — the money split-brain fix (UX-A P8). The Money destination has two views: "Money & Documents" (W7 mechanics) and "Spending" (W11 intelligence). Top tabs inside the module (§1.2 of FRONTEND-CONSTRAINTS — top tabs are the sanctioned secondary nav).
- **W10 lives in Home & Family as a parent-only tile and surfaces in Grow** — it's a lens, not a module; with one child it rests quietly, with 2–3 it becomes the family dashboard.
- **W16 is never a top-level destination** — `/school/calendar`, a feed inside School. "School" and "School Calendar" as sibling tabs is the failure mode UX-A named; this IA kills it.

---

## 4. The morning ritual — tap by tap (Garden Dawn)

The 60-second loop from UX-HABIT-DESIGN, now pinned to the shipped chrome. The parent opens the app (7:00 AM push: *"🌅 Good morning. The garden grew overnight — come see."*). They land on **Garden** (tab 1, always the default).

**Tap 1 — The Bloom Reveal (0–10s).** The garden renders at dawn light. If anything grew overnight: one bloom animation per child, max, with its growth story — *"🌸 Geometry grew +2.5 overnight — Dawson turned in the missing study guide."* If nothing changed: *"A quiet night. Everything held."* No tap required — this is the reward for opening.

**Tap 2 — Today's Three (10–30s).** Scroll one thumb-length to the AttentionQueue. Exactly three prioritized, one-tap actions. Tapping one opens an **ApprovalSheet / action sheet** (intercepting route — back closes it, the garden stays underneath). Approve the Thomason reply → leaf unfurls on Dawson's plant *in the same animation* → toast *"Sent ✓ — Ms. Thomason usually replies within a day."* Skip is one tap: "Not today" — zero guilt copy, the item re-queues silently.

**Tap 3 — Quiet Wins (30–45s).** Acknowledge with a heart-tap if moved to — *"Dawson turned in the missing assignment 🎉"* — sparkles ascend. Optional; offered, never required.

**Tap 4 — Water the Garden (45–60s).** One tap: *"💧 Water the garden."* Plants shimmer, the day stamps on the garden calendar, the signature exit: **"All quiet. 2 things handled, 1 for later. The family's okay."** *Calmer than they started.* A "walk the garden" link opens the full app for parents with five more minutes.

**The Quiet Morning fallback:** if literally nothing needs attention, Today's Three and Quiet Wins collapse into one calm card: *"Nothing needs you today. The engine is watching 23 things — grades, health, deadlines, the mail. Go enjoy your coffee."* The bloom check and the water tap still happen. A quiet morning is a *good* morning — the trust dividend that makes the ritual daily.

**Evening — Sunset Review (8:30 PM push: "🌙 The day's done. Here's how it landed.")**: lands on Garden at dusk light. (1) What changed today — 3–5 warm outcome lines. (2) Open loops, closed — everything touched today shows its resolved state; anything still open is pre-seeded for tomorrow (*"the refill reminder will fire at 8 AM — you don't have to remember"*). (3) Tomorrow's three, previewed. (4) The gratitude close — *"You caught the missing assignment Tuesday, sent the email Wednesday, and Geometry moved 8 points. That's not luck — that's you. Sleep easy. The family's okay. I'll keep watch."*

**Ritual rule:** the session always ends at the signature exit. If a session can't end calmly (open loops leaked), that's a bug, not content.

---

## 5. "What needs my attention NOW" — the attention system

**The single ordered queue** (DESIGN-SYSTEM §3.1, adopted as the law):

1. **Safety (rose, rare)** — SOS, crisis tripwire, credential failure, legal deadline <72h. Only safety may use rose. Pushes bypass quiet hours.
2. **Time-critical (<48h)** — test in a weak class, slip due tomorrow, bill due Friday.
3. **High-leverage** — missing/zero assignments first ("a zero drags its whole category"), then the ranked path.
4. **Gentle** — suggestions ("Summer grove wakes in February").

**Caps (hard, from the vision doc):** max 5 visible on the Garden hub (+ "See all"); max 3 child nudges/day; max 1 parent alert/day/child; no re-fire on the same cause within 7 days; completing an action suppresses its trigger 14 days; exam-week mode halves volume; quiet hours 10 PM–6 AM hold everything except safety tripwires.

**Every attention item carries exactly one winnable CTA** + cause-first copy:
- ✅ *"Geometry slipped 4 points this week — the two missing assignments look like the cause. Want to knock out the first one tonight?"*
- ❌ Never a causeless grade drop, never "URGENT!!!", never a notification that ends in anxiety without an action.

**Urgency is conveyed by presence and copy, never agitation** (DESIGN-DIRECTION §3): no flashing, no pulsing red, no shaking. Rose is reserved; everything else is sunlight/gold/ember per the grade bands.

**Notification types that earn the morning open** (from UX-B §4.2): The Win, The Heads-Up, The Approval, The Quiet Confirmation, The Milestone. The anti-list stands: no guilt, no child raw stream, no nudges-about-nudges, no marketing, no comparisons, no vague worry.

---

## 6. Multi-child — the switcher and the scope contract

**The ChildSwitcher is load-bearing and omnipresent** (AppHeader, per DESIGN-SYSTEM §2.2): avatar + name + chevron → bottom sheet listing children, each row with a one-line status (*"All quiet 🌿" / "2 things need a look ✦"*), then "+ Add child", then "Household" (the family-level scope: W10, W11 family ledger, W14, W19, W20).

**Rules:**
- Every child-scoped surface carries a persistent child indicator; tapping it switches the whole app's context, not just the page. Failure mode ("checking grades, seeing the wrong child's grades") is trust-destroying — the switcher is the highest-tested component in the shell.
- **Family-scoped modules don't switch:** W20 Shopping (family list, items tagged "milk — Dawson"), W21 Mail (household bills), W11 family ledger, W14 calendar, W19 vault. Tags are legible at a glance on mixed surfaces.
- **The briefing scales by child, not by module:** Today → Now groups by child first, urgency second. 3 kids × 23 modules = 3 clusters, not 69 items. *"Nothing needs you for Maya today ✓"* is itself dopamine.
- **Per-child cadence:** the Daily pulse for Dawson shows W1+W6; for a 7-year-old it shows W16+W12. Same ritual shape, adaptive contents.
- **Per-child privacy contracts are stated at the surface where they bite**, in plain language, once: *"Maya's mood detail stays with Maya — you see the trend."* Never settings-archaeology. Age tiers (under-13 parent-sees-all vs 13–17 child-confidential) are per-child, per-module.
- **Never cross-child comparisons, anywhere** — different plants, different soils. The teen's plant reflects *their* outcomes; parent-tending leaves are invisible to the child (the worry list stays hidden).
- **W10 Fairness (2+ children):** parent-only family dashboard in Home & Family + reachable from Grow. Per-child activity/spend cards, conflict detection (*"two practices overlap Thursday — one driver"*), fairness nudges (*"spend on Dawson is 3× Maya's this quarter — intentional?"*). Children never see it.

---

## 7. The child's own view

The teen gets the same 5-tab shell, filtered by the trust contracts:
- **Their garden:** their plant, their blooms from *their* outcomes, their missions. Same garden, their branch — the treehouse.
- **Parent-tending actions are invisible** (no "your dad approved an email about you"); the worry list never leaks — notification lock-screen text audited per surface.
- **Private spaces are visibly private:** 🔒 + dew tint + *"[Name]'s space — details stay with them."* (W8, W17, W23 teen use, sensitive health).
- **Shared surfaces are marked shared:** *"Dawson can see this too"* on the safety map and alerts both sides see.
- **The teen's daily tools** (W23 what-if simulator, check-in pulse, social calendar) are first-class in *their* Garden/Today — the parent's Today shows patterns only.
- RoleBadge in the header shows whose view this is; a parent previewing the teen view sees the exact same pixels the teen sees (no "parent preview" chrome that could leak).

---

## 8. Search — the rescue hatch

Global search (⌕ in the header, CommandBar overlay per DESIGN-SYSTEM §2.3) is a **primary nav element**, not a power-user extra (UX-A open question #3: yes). Fuzzy across modules, children, actions: *"picture day"*, *"passport"*, *"approve teacher draft"*, *"sync now"*. Results grouped: Actions → Modules → Children. 44px rows, keyboard-first on desktop, thumb-first on mobile. It rescues every buried module — which is why the IA can afford to keep 18 modules one level down.

---

## 9. Empty states & "taking root" — the full-vision day-one rule

**Founder directive:** the complete 23-module app ships now; the user sees the full vision beautifully from day one; no "coming soon" scaffolding. Reconciled with the honesty rules (never pretend a nonexistent integration exists; nothing may be a dead end):

- **Taking-root modules get Seedling vision surfaces**, not dead tiles. Each shows: the grove sigil, the *"what I watch over"* one-liner, the first seedling invitation with ONE real action that starts the ritual (W19: *"Plant the first seed — add an emergency contact"*; W18 in November: *"The Summer grove is still a seed — it wakes in February. Want a reminder?"*). Every blank screen is the start of a ritual (SeedlingEmpty pattern).
- **Seasonal dormancy is designed, not empty:** W18 Summer in November collapses to a countdown in Coming Up; it never nags, never shows a blank list (UX-A P7 — the empty-state cliff).
- **Dead-end ban:** no module ingests data it can't act on yet. If W15 can't read iOS Screen Time honestly, it says so in plain words and offers the manual fallback — *"iOS doesn't share this with apps. Here's the weekly check-in instead."* Per-OS honesty is the feature.
- **Copy law:** "taking root 🌱", "wakes in February", "plant the first seed" — never "coming soon", never "not available", never a grayed-out tile that reads as broken. A seed is a promise; "coming soon" is a shrug.

---

## 10. Safety — the global exception

Safety is event-driven and must interrupt — it cannot wait behind a grove tile:
- **SOS is globally reachable:** a persistent, calm entry — long-press the Pookie orb (FAB) anywhere → SOS confirm. In-app SOS is one tap to the OS confirm dialog (honest 911 note, per the vision doc). SOS surfaces the child's medical flags from W2/W19 automatically.
- **Geofence alerts and the safety tripwire bypass quiet hours**, with factual, non-panic copy (panicked parents decide worse).
- **The trust contract is legible in the layout:** the teen sees the same map and zone feed the parent sees; every zone alert about a teen is visible to that teen; pause-with-notice for 16+. Safety context, never punishment — no breadcrumb trails, no "last seen" headlines, no retroactive playback, by design principle.
- **W3's grove tile** (`/safety`, 🛡️ Safety grove) holds zones, the trust contract, and SOS history — browsed rarely, as it should be.

---

## 11. How it absorbs all 23 on day one — the scale story

1. **Tabs never change.** 5 tabs on day one, 5 tabs at 23 modules live, 5 tabs at 30. The tab bar is the contract; the grove map is the inventory.
2. **Groves are the shock absorbers.** A module graduates from taking-root to live *inside its grove tile* — the Menu tile gains its freshness chip and real state, the Garden rail card starts rendering live data, the module starts feeding the Today bands. No navigation surgery per launch.
3. **The Today bands are the composition layer.** A new live module doesn't need a home-screen redesign — it just starts emitting attention items into Now / This Week / Coming Up, ranked by the same engine. This is why W9-as-a-surface scales and W9-as-a-tab wouldn't.
4. **Adjacency is wired, not hoped for:** W13 → W20 (plan → list, one flow), W21 → W11 (bill → paid → ledger, the loop closes visibly), W22 → W2 (data → interpretation, *"steps down 40% since grounding — expected, not alarming"*), W12 → W16 (early-release → coverage suggestion), W4 → W5 (extracurricular depth → college narrative). Each wire is a one-tap seam between grove tiles.
5. **The garden stays truthful at every scale.** Metaphor is state-driven, never decorative: a class at 69 renders as a branch that *needs tending* in ember — softly, truthfully. The garden at its worst still looks like a garden that needs tending, never a wasteland.

---

## 12. Decisions & disagreements — closing the Wave-1 open questions

| Open question | Decision | Why |
|---|---|---|
| UX-A Q1: bands vs. single smart feed | **Bands** (Now / This Week / Coming Up / If Needed), smart-ranked within each | Predictable beats clever at 11 PM; bands teach the parent the cadence model, which *is* the product's mental model |
| UX-A Q2: 5 or 6 destinations | **5**, exactly as the Design System specifies | 6 would be one slot for Safety — but Safety is event-driven; a permanent Safety tab would be an anxiety dashboard 360 days a year. SOS gets the global gesture instead |
| UX-A Q3: search as primary nav | **Yes** — ⌕ in the header, CommandBar overlay | Rescues buried modules; lets the IA keep 18 modules one level down without guilt |
| UX-A Q4: child switcher pattern | **Omnipresent header switcher + briefing grouped by child** (not segmented control) | Segmented controls don't survive 3+ children; the sheet scales, the header indicator is always visible |
| UX-A Q5 + UX-B Q1: where does the garden live | **Garden IS the home tab; Grow holds the retrospective artifact** | One garden, two time-directions: Garden = now/today (the ritual), Grow = the compounding past (the legacy). A third "garden view" would split the metaphor |
| UX-B Q2: multi-child ritual scaling | **Engine picks top family-wide moments; other children's blooms wait in the garden** | 60 seconds is the contract; no FOMO copy for unshown blooms |
| UX-B Q3: teen's view of the garden | **Yes — their own plant, their outcomes, parent-tending invisible** | Ownership without surveillance; the treehouse rule |
| UX-A finding: cadence primary, domain secondary | **Adopted with a twist:** cadence organizes the *ritual surfaces* (Garden queue, Today bands); domain organizes the *index* (Menu groves) | Both findings honored; neither asked to do the other's job |
| DESIGN-SYSTEM Q1: confirm 5-tab + grove map vs. card sort | **Confirmed**, with W16-inside-School and W11-inside-Money enforced (the card sort's collision warnings) | The grove map matches domain grouping A within one module's difference; inventing a parallel taxonomy would be churn |
| PRODUCT-SCOPE: V1 = 7 live modules | **Kept for engineering; overridden for presentation** | The gate still governs what gets *built*; the founder's directive governs what gets *seen*. Taking-root surfaces are the bridge — full vision, honest state |

**Explicit disagreement with one Design System implication:** the spec's GroveSections rail on the Garden hub risks becoming a 23-tile scroll if every grove shows every module. **Decision: rails show live modules first (with real state), then taking-root seedlings collapsed to a single "5 more taking root 🌱" expander per grove.** The full inventory lives in Menu. The hub is the ritual, not the index — showing all 23 on the home screen would rebuild the card-grid the constraints doc rejected (§1.6).

---

## 13. Buildability checklist (FRONTEND-CONSTRAINTS §6 — pass/fail)

1. [x] **Every screen a real route.** Route table in §1; sheets via intercepting routes; no `useState` screen-switchers.
2. [x] **Tab bar ≤ 5.** Exactly 5. The other 18 modules: Garden rails (live ones), Today bands, Menu groves, search.
3. [x] **Motion = transform/opacity.** Bloom/rise/ascend/breathe/dapple — all transform/opacity keyframes; glow animation via opacity layers, never blur-radius.
4. [x] **Glow budget.** Garden hub: orb breathing halo (1) + ≤2 attention-card glows + 1 dawn-light drift = within the ≤3 mobile budget. Backdrop-blur: bottom nav + sheet scrim only. Never in lists.
5. [x] **`prefers-reduced-motion`.** Global kill-switch per the design system; ambient stops, glows remain, transitions become fades.
6. [x] **No custom page transitions; ≤1 view-transition hero.** The one sanctioned hero: child plant Garden → child grove. Everything else: native routing, motion inside screens.
7. [x] **Thin Server Components.** Attention ranking client-side from cached Supabase reads (PostgREST + RLS direct); no per-navigation server aggregation; countdowns client-side only (workerd has no timer semantics).
8. [x] **Prefetch discipline.** On for tab bar + Garden hub links; `prefetch={false}` on the Menu's 23 tiles (100k req/day meter).
9. [x] **Skeletons + errors per segment.** Garden has a "growing…" skeleton (mist over the beds, per the visual grammar); `loading.tsx`/`error.tsx` per route segment.
10. [x] **Touch.** 44px targets; bottom tab bar in the thumb zone; `100dvh` + safe-area insets; no hover-dependent interactions.

**Desktop:** the same 5 destinations as a left IconRail (responsive CSS in the same `(tabs)` layout — zero re-implementation). Menu's grove map gets the full two-pane treatment; the Garden hub stays single-column (`max-w-2xl`) — a garden doesn't become a dashboard on a bigger screen.

---

## 14. Kill-criteria audit (DESIGN-DIRECTION §5)

| Anti-pattern | Verdict |
|---|---|
| 1. Control-room dashboard | **Pass.** One focal moment per screen; groves are rails, not grids; no KPI tiles. The old 7-tab Dawson toolbar is explicitly not resurrected. |
| 2. Judgment styling | **Pass.** Grade bands leaf/sunlight/gold/ember; rose reserved for safety; mission framing on every number. |
| 3. Harsh neon / cyberpunk | **Pass.** Divine-light only: soft diffused glows, sunlight-gold, halo-white. |
| 4. Tech-dashboard metaphors | **Pass.** No gauges, dials, "system status" language. Freshness chips are honest timestamps, not uptime monitors. |
| 5. Nag UX | **Pass.** Caps, anti-re-fire, quiet hours, "Not now" snooze, suppressed-state honesty. |
| 6. Surveillance signifiers | **Pass.** Same-map contract, visible privacy boundaries, no trails, no read receipts. |
| 7. Dead interactions | **Pass.** Every completion fires the Completion pattern (bloom + fireflies + toast + ring advance) in the same frame. |
| 8. Generic SaaS chrome | **Pass.** The clearing, the grove, the seedling — no Intercom bubbles, no CRM tables. |
| 9. Contrast failures | **Pass.** Per the design system's contrast table; both themes designed. |
| 10. Motion that agitates | **Pass.** Urgency by presence and copy; alerts never flash/pulse/shake. |

---

## 15. The 11 PM test — the walkthrough

*Mehedi, 11 PM, tired, one thumb, half attention. He opens Pookie — not from a notification, from habit.*

He lands on **Garden**. Dusk light. Dawson's tree, full canopy with one branch glowing soft gold — Geometry, needing tending, ember-warm but not alarming. The hero line: *"The garden is resting — 1 thing for tomorrow."* He exhales — nothing is on fire.

One thumb-scroll: the AttentionQueue shows two cards. *"Unit 4 test Thursday — Geometry is the weak class. The study plan is ready; nothing needed from you tonight."* He reads the closer — *nothing needed tonight* — and feels the specific Pookie feeling: *noticed, and released.*

He taps **Today** → **If Needed** → glances at the week ahead: picture day Thursday (W16 already extracted it from the school email; *"lay out the good shirt Wednesday night"*). He taps **Grow**: the week's bouquet — 3 wins, the Geometry ring advanced 2.5 points, *"The comeback is working."* He taps the water drop. *"Sleep easy. The family's okay. I'll keep watch."*

Sixty seconds. He didn't browse 23 modules. He didn't see a dashboard. He saw a garden, handled nothing (nothing needed handling), and closed the app calmer than he opened it. **That is the product.**

---

*End of IA-FINAL.md. Next: Wave-3 UI designers render Garden, Today, and Menu as the Milestone-1 gate screens.*
