# IA-FINAL-V2-LIFEAPP — Pookie's Shipped Information Architecture, Life-App Reframe
**Author:** IA Reframe Specialist · **Date:** 2026-10-11 · **Status:** FINAL — this is the shipped truth
**Supersedes:** IA-FINAL.md's *framing* (the parenting-first lens). **Keeps:** IA-FINAL.md's *structure* — 5 tabs, the route discipline, the grove map, all 25 gate notes from GATE-REVIEW-1.md (each preserved in §5).
**Amendments:** 2026-10-11 — W25–W31 folded (24→31 modules); §1.4–§1.6 added (fuel, weather + the ritual-surface pattern, the 6th grove by gate review); childless app 10→17; trip-assembly moment added (§4.11); all 25 gate notes intact.
**Inputs:** LIFE-FLOW.md · IA-FINAL.md · GATE-REVIEW-1.md · VISUAL-DIRECTIVE-NEON.md

---

## 0. The reframe, in one paragraph

Pookie is a **life app for the average American**, not a parenting app with life features bolted on. The **day** is the organizing principle: the user wakes up, opens Pookie like weather, and handles their life in 60 seconds. Children are part of the day for some users; for others, the day is theirs alone. The shipped structure — **five tabs, a grove map, the engine as a surface, never a tab** — survives the reframe intact, because it was always a *day* architecture wearing parenting copy. What changes is what each tab *means*, what the childless user *sees* (a complete 17-module life app), how the 14 parenting modules *surface* (on the day's logic, never as a browsable index), and the moment a household grows (the day gets bigger, not the app gets scarier). **The one-sentence test, applied to every decision below: *the user lives in the day; the modules live in the app.***

## 0.1 What changed vs. IA-FINAL.md — and what didn't

| Kept (structure) | Reframed (meaning) |
|---|---|
| Exactly 5 tabs, bottom nav, center Pookie orb | Each tab now has a **life-meaning** (§1), not a parent-meaning |
| Route discipline: every screen a real route | A-N2/A-N3 holes closed: `/child/:id` added, `/money/spend` a real sub-route |
| The grove map as the module index (tabs never change) | Groves are **life-grouped, plain verbs**; only-yours groves render (absence, not adaptation) |
| Today bands: Now / This Week / Coming Up / If Needed | Bands are now the *day's* bands — day-ordered, never module-ordered |
| W9 as a surface (Today + Garden queue + push), never a tile | W9 stays invisible as a named feature; its face is timing itself |
| All 25 gate notes | Preserved verbatim in §6 — every one kept, or evolved with its evolution named |
| The visual system + visual filter | VISUAL-DIRECTIVE-NEON.md is the gate filter for everything below |

---

## 1. The five destinations, reframed for the day

The bottom tab bar is exactly five: **Garden · Today · Pookie · Grow · Groves**. (Menu → **Groves** per A-N15 — the gate's default is enacted here: "Menu" is a hamburger word; the product's wayfinding is garden paths.) The center tab remains the Pookie orb (✦). Desktop: the same five as a left IconRail.

**What each tab means in life-app terms:**

### ① Garden — `/` — *"Your day, tended."* (home, the ritual)

Garden is where the **user lives**. The day lands here: the greeting hero, the morning ritual, the day's three winnable cards, the living garden scene, today's strip. Day language only ("This morning," "Tonight," "Tomorrow") — module names never appear on the hub.

**Composition (top to bottom):**
1. **GreetingHero** — *"Good morning, Maya ☀️"* + date + one-line day state: *"All quiet — one thing could use a look."* (Quiet morning: *"All quiet. Nothing needs you today."* — celebrated, never apologized for.)
2. **The Garden itself** — for the childless user: **one plant — hers.** Her life rendered as a single thriving garden: mail handled, meals planned, health on track are its weather, not its features. For parents: the spotlight-plant pattern (A-N13 — the child with the most attention renders full; others rest smaller; one focal moment, always). Household scope: the shared garden — family plants smaller, the household's shared things (mail, meals, list) as the beds they share.
3. **AttentionQueue — Today's Three (A-N1).** Exactly **3** cards, **day-ordered** (LIFE-FLOW §6.3): the bill approval (money, today) → the shirt laid out tonight (school, tonight) → the pickup coverage (calendar, tomorrow). A user must be able to *narrate their day from the queue order*. Each card: situation + cause + **ONE winnable CTA** + "Not now" (snoozes 24h, logged). Overflow: **"See the rest"** → `/today` (A-N11 — no raw count, no badge arms race). Hub queue and Today's Now band are **one W9 engine, two lenses** (A-N16): snooze/dismiss in one place reflects in the other.
4. **Grove rails** — the groves as horizontal living-card rails: **live modules first with real state** (*"Mail: 1 bill waiting ✓"*, *"Meals: Wednesday's dish is staged"*), then **one collapsed *"N more taking root 🌱"* expander per grove** (A-N4/P-N1 — the gate's resolution). The rails are not the index; the index lives in Groves.
5. **TodayStrip** — today's calendar items across the day's logic: dentist tomorrow, bill reminder Friday, picture day Thursday. One horizontal strip, not a calendar grid.
6. **The ritual close — pinned end-cap (A-N5).** The signature exit is no longer a section you might scroll past: once the day's cards are handled or dismissed (or there were none), the **Water the Garden end-cap** pins at the hub's end: *"💧 Water the garden."* One tap → the day stamps on the garden calendar → the signature sentence: *"All quiet. 2 things handled, 1 for later. The family's okay"* — or for the childless user, *"All quiet. 1 thing handled. Your day's okay. I'll keep watch."* If a session can't end calmly, that's a bug, not content (UX-B's rule stands, now with a mechanism).

**Route discipline:** cards are `<Link>`s; sheets use intercepting routes (`/today/approve/abc` renders as a sheet over the hub, back closes it). The hub is a page with links, never the router.

### ② Today — `/today` — *"What needs you today."* (the attention engine's face)

W9 lives here — not as a named feature, not as a tab called "Briefing" (jargon), but as **four attention bands, smart-ranked inside each band.** Predictable beats clever at 11 PM.

- **Now** — the full AttentionQueue: safety (rose, rare) → time-critical (<48h) → high-leverage (missing/zeros first — for the childless user this is bills and deadlines, not homework) → gentle (suggestions). Each card: situation + cause + ONE winnable CTA + "Not now."
- **This Week** — the tending surface: meal week, weekly spend mirror, school-week preview (parents), the week's health pattern, screen-time report. The Sunday "week build" surface lives here all week.
- **Coming Up** — the horizon: countdowns, not calendars. Bill due Friday, passport renewal, permit eligibility, college deadlines (30/14/7/2), seasonal wakes (*"The Summer grove wakes in February 🌱"* — a countdown, never a cold push per P-N3).
- **If Needed** — event-driven and dormant: SOS history, the vault, co-parent handoffs, birthdays, the fairness gut-check. Visible, calm, never nagging.

**Honest silence:** empty bands say so warmly — *"Nothing here. The engine is watching — go enjoy your coffee."* Suppressed states are honest: *"2 updates resting until tomorrow — exam-week mode."* For the childless user these bands are simply hers: Now is her day's queue, This Week is her week build, Coming Up is her horizon.

### ③ Pookie — `/pookie` — *"The voice."* (the AI clearing)

Not a chat window — **a clearing**: Pookie's orb, warm light, conversation that feels like talking to a presence. The Pookie/Muse toggle is a change of *light* (warmer vs. clearer), never a settings switch. It serves both lives identically: Maya asks *"what's for dinner given my week?"*; the dad asks *"draft the teacher email."* Suggestions bloom into actions (approval sheets, plan views). **One interactive orb per screen, always (A-N14, the decided rule — UI-SHELL-HOME §0.4):** on tab screens the center-tab orb breathes and is the one (tap → `/pookie`, long-press → SOS confirm); on non-tab screens a FAB at z-55 carries ambient presence with the same gestures. No FAB on tab screens — the center orb is already there.

### ④ Grow — `/grow` — *"How far you've come."* (the memory)

The retrospective pride surface — GitHub-graph meets harvest. **For the childless user, Grow is hers, and it is full:** her health trends (W22 — sleep, steps, streaks), her money patterns (W11 — *"3 months of on-time bills"*), her week's wins bouquet, season recaps (*"Fall 2026: 41 workouts, every bill on time, 1 trip funded"*). **The childless user must never see an empty parenting trophy case.** Grow's content contract: it is built from *her* data from day one; rings are per-person (SproutMeters: Seed → Sprout → Sapling → Grove → Canopy); copy discipline holds ("3-day streak — Sapling 🌱"; broken streak: *"The sapling is still here — water it today 🌱"*).

**For parents**, Grow adds the family layer: per-child GrowthRings + DeltaLines with cause-first captions, season recaps (*"Fall 2026: 14 blossoms, 3 comebacks, 1 mission complete"*), and the W10 Fairness reflection for 2+ children (parent-only, a lens beside growth — never a leaderboard). The W10 nudge copy is curious, never interrogative (A-N10): *"spend on Dawson is 3× Ella's this quarter — want a look at the breakdown?"*

### ⑤ Groves — `/groves` — *"Where everything lives."* (the module index)

The complete module index — grouped into **6 life groves, plain verbs, module names as plain jobs** (*"Mail," "Shopping List," "Meals"* — never "W21"). Each tile: sigil (Lucide, grove-tinted glow), one-line *"what I watch over"* subtitle, freshness chip, and state: **live-with-data**, **taking-root** (the seedling — invitation + one real seed-it-now action), or **resting** (seasonal dormant — a countdown, never a dead tile). A pinned **search row sits at the top of Groves** (A-N7 — the thumb-zone rescue hatch; header ⌕ stays for desktop/short thumbs).

**W9 counting, stated plainly (A-N8):** Groves shows the 30 module tiles + **one quiet explainer row** (*"How Pookie picks your moments — the timing behind the day"* → `/today`); the Today tab is the engine's face. W9 is never a tile, because W9 is not a destination.

**The grove map, life-grouped:**

| Grove | Modules (plain names) | Who sees it |
|---|---|---|
| 💚 **Body & Heart** — *the body you live in* | Health (W2) · Wellbeing (W8 🔒) · Meals (W13) · Activity (W22) · Nutrition (W23) | Always. W8 appears only with a child (teen-private). |
| 🏡 **Home & Family** — *what lands at your door and on your table* | Mail (W21) · Shopping List (W20) · Spending (W11) · Money & Documents (W7) · **Credit (W24)** · Co-parenting (W14) · Babysitters (W12) · Fairness (W10, parent-only) | Always. W24 is a LIFE module — the childless user's financial command center. Parenting extensions appear only with a child. |
| 🌿 **School Days** — *the school years, handled* | School (W1) · School Calendar (W16, inside School) · College & Future (W5) · Activities (W4) · Summer (W18) | Only when a child profile exists. |
| 🛡️ **Safe & Sound** — *the insurance drawer* | Safety (W3) · Emergency (W19) | Only when a child profile exists. (W19 moved here from Home & Family — the vault belongs with safety, not with mail.) |
| 🌱 **Growing Up** — *their world, becoming* | Driving & Life Skills (W6) · Screen Time (W15) · Friends (W17 🔒) | Only when a child profile exists. |
| 🌍 **Out & About** — *the world beyond the door* | Fuel & Charging (W25) · Weather (W26) · Events (W27) · Restaurants (W28) · Trails & Parks (W29) · Flights (W30) · Rental Cars (W31) | Always — all seven are LIFE modules (see §1.4–§1.6). |

**Groves is also the overflow contract:** no new tab is ever added for a new module. New modules → join a grove (see the extensibility rule, §1.6 — groves don't multiply without a gate review). Standing rule.

**Routes (every screen a real route):** `/` · `/today` · `/pookie` · `/grow` · `/groves` · `/child/:id` (A-N2 — the child's grove view) · `/school` · `/school/:classId` · `/school/calendar` (W16 lives inside School — never a sibling tab) · `/college` · `/summer` · `/activities` · `/health` · `/wellbeing` · `/meals` · `/activity` · `/nutrition` · `/safety` · `/driving` · `/money` · `/money/spend` (A-N3) · **`/money/credit` (W24 — see §1.3)** · `/screen-time` · `/shopping` · `/mail` · `/emergency` · `/co-parenting` · `/childcare` · `/friends` · `/fairness` · `/fuel` (W25) · `/weather` (W26) · `/events` (W27) · `/restaurants` (W28) · `/trails` (W29) · `/flights` (W30) · `/cars` (W31).

---

## DECISION BOX — "Groves" vs "Menu" (founder's call — OPEN)

**The gate's default stands:** the 5th tab ships as **"Groves"** (A-N15 — enacted; the `NAV.FIFTH_LABEL` token makes the label a one-token flip, icon and route `/groves` unchanged). The IA and shell are written against "Groves" and nothing hard-codes the word for navigation.

**Design QA's finding (2026-10-11):** the 5-second test **FAILED "Groves"** — a Facebook-fluent adult has no mental model for "groves" as "where everything lives." The grid icon helps; the word doesn't. QA recommends user-testing **"Groves" vs "Menu"** with real adults before Milestone 1, and keeping the swap one token flip.

**The founder's call:** the design team does NOT rename this unilaterally — the tab label is a founder-level product-language decision. Default remains "Groves" per the gate; if the founder prefers "Menu" (or the user test says so), engineering flips `NAV.FIFTH_LABEL` and no screen spec changes. This box closes when the founder rules.

---

### 1.3 The 24th module: W24 Credit Monitoring (and the money-destination rule, exercised)

W24 — **Credit** ("Is my credit actually excellent? Am I leaving money on the table?") — is the first module to arrive under the reframe, and it arrives the way the standing rule demands: **it joins a grove, not a tab.** The money split-brain fix (IA-FINAL's collision rule) generalizes: the **Money destination** is one destination with **three views**, switched by the sanctioned top tabs inside the module: **Money & Documents** (`/money`, W7 — the ledger, the source of truth) · **Spending** (`/money/spend`, W11 — the intelligence layer, patterns and mirrors) · **Credit** (`/money/credit`, W24 — the coach, the strategy layer).

**What W24 watches over (the plain-language tile):** *"Your credit, coached — scores from all three bureaus, every card organized (balances, APRs, utilization, due dates), bill payments tracked and reminded, plain-language transaction summaries, business expenses tagged and tax-deductibles kept all year. The north star is 'excellent' — a coach, not a score-watcher."* For the real-estate investor: cards, properties, and deductibles in one honest view. For the average American: *is my credit actually excellent, and am I leaving money on the table?*

**W24 is a LIFE module** — it belongs in the childless app (§2) as a taking-root seedling today (the seed-it-now action: *"Connect your cards"* — one real starting action per PLACEHOLDER-STANDARD, with the honest data note: bureau scores come from paid reseller pulls, card data via Plaid read-only; nothing pretends a free API exists). **The wires (kept, from the vision doc):** W21's mail intelligence feeds it (a photographed bill becomes a tracked payment with a due date) · W11 shares the transaction layer (one honest ledger, two lenses — spending patterns vs. credit impact) · W7's banking ledger is the source of truth for balances; W24 is the interpretation layer that turns balances into credit strategy. Day-surfacing (the coach at work): *"Utilization hit 31% — pay $400 by Friday"*; *"Chase payment due in 3 days — $1,200 minimum, $2,400 to stay under 30%"*; *"Hard inquiry ages off next month — expect a small bump"*; *"Tax quarter ends in 2 weeks — 14 untagged business transactions."*

**Anti-collision rules (kept, verbatim from IA-FINAL):** three healths → one `/health` destination, W22/W23 adjacent tiles labeled by job; the food triangle → W13 → W20 is one flow (plan → list), W23 reads the plan as baseline; three schools → W16 inside `/school`, W5 labeled by outcome.

### 1.4 W25 — Fuel & Charging Finder (the mobility module)

W25 — **Fuel** ("Where's the cheapest gas near me? Where do I charge?") — route `/fuel`, placed in 🌍 Out & About (see §1.6 for the grove decision; Home & Family's subtitle is *what lands at your door* — fuel is the precondition of *leaving* it, and it clusters with flights, rental cars, events, and trails under the day's going-out question).

**What it watches over (the plain-language tile):** *"The cheapest way to keep moving — closest + cheapest gas and EV chargers, live prices that say how fresh they are, detour math that tells you if the savings are worth the drive. Tesla drivers get Supercharger-first answers."*

**The wires (kept, from the vision doc):** W30/W31 trip handoffs — fuel stops pre-computed on the route before the trip, not discovered at a quarter tank · the Tesla integration's low-fuel / low-battery alerts fire with the nearest options attached, not just a warning ("your Tesla is at 22% — 3 Superchargers within 10 min, the fastest has 2 stalls open") · W11 keeps the household fuel budget ("$187 on gas this month, down $23 — the Costco habit is working") · W26 feeds drive-time estimates so the detour math knows about the storm. Day-surfacing: *"gas near home jumped $0.30 overnight — fill up at Costco today"*; *"you're driving to Dawson's game Thursday — the Costco on the route is $0.23 cheaper than near home."*

**Honest data lines (kept):** gas prices from live/crowdsourced feeds, **always timestamped** ("updated 12 min ago") — a price without a timestamp is a lie, and the UI says so or shows nothing · EV charger real-time availability varies by network — show what's known, mark what's estimated · detour math shows its work ("saves $4.20, costs 6 minutes — worth it").

**W25 is a LIFE module** — it belongs in the childless app (§2) as a taking-root seedling. **The seed-it-now action:** *"What do you drive?"* — fuel type + home base. Tesla → Supercharger-first ranking with preconditioning reminders; gas → price-first ranking; mixed household → both, clearly labeled. The vehicle profile drives the ranking logic, not a toggle the user has to remember.

### 1.5 W26 — Hyperlocal Weather (the first ritual surface — the dual-nature pattern)

W26 — **Weather** ("What's the weather doing today? Do the kids need jackets?") — route `/weather`, placed in 🌍 Out & About. **Decision: BOTH — ritual surface from day one AND grove tile.** Against the "user lives in the day" test: weather is not something the user *goes to*; it is something the day *opens with*. The ritual is the primary surface; the tile exists for the follow-up question ("Saturday's full forecast for the away field").

W26 is the first module that is both a ritual surface and a destination, so it sets the **ritual-surface pattern** for every module that follows:

1. **The ritual moment is the primary surface.** The Garden-dawn verdict line (*"Sunny, 75° — no jacket needed"*) rides under the greeting hero — it is the day's first sentence, not a widget. Severe NWS alerts interrupt as safety events (a tornado warning at 2 AM is safety, not a notification). W9 treats weather as a **first-class input**: it reshuffles priorities when the forecast changes (outdoor practice moved inside → the evening plan adjusts) — per the vision doc's "reshuffles priorities" wiring.
2. **The tile is the "tell me more."** The destination answers the follow-up: hourly for 48h, daily for 10, multi-location (home, school, the office, the away-game field), alert history. The tile **never duplicates the ritual's one-line verdict** — it continues the conversation.
3. **A ritual surface can go live in the ritual before the destination is built.** The Garden dawn line IS the module's MVP — it rides on W9, which already exists. The seedling tile carries the rest of the promise (PLACEHOLDER-STANDARD anatomy).
4. **The garden's light follows the sky.** The Garden scene's dawn/dusk lighting already follows the hour — now it follows the weather too (grey-sky mornings render, golden afternoons render). The ritual's setting becomes the forecast's echo.

**What it watches over (the plain-language tile):** *"The sky, translated — hyperlocal forecast for the places your day actually happens, severe alerts that interrupt like they should, and every forecast ending in what it means: jackets, umbrellas, or go."*

**The wires (kept, from the vision doc):** W9 proactive engine (first-class input — see pattern rule 1) · W29 conditions synthesis ("rained yesterday — the riverside trail will be muddy, try the ridge instead") · W30 trip assembly (destination weather on the trip card) · W25 drive-time estimates · W27 weekend planning ("free concert in the park Saturday and the weather's perfect") · W16 school-calendar cross-check ("Saturday's game: 70% storms — check the league's rain policy") · W4 activities (the evening plan adjusts when practice moves inside). Day-surfacing: *"temperature drops 20° by pickup time — jackets"*; *"perfect weather window Thursday 4–6 PM — that's your outdoor slot."*

**Honest data lines (kept):** NWS alerts are free and authoritative — delivered verbatim, **never paraphrased by AI** · hyperlocal doesn't mean false precision ("mid-70s, very likely dry" beats "73° and 0%") · when models disagree, say so ("two models show the front arriving at 4, one says 7 — plan for 4").

**W26 is a LIFE module and a DAILY-RITUAL surface** — it belongs in the childless app (§2) as the Garden-dawn line from day one, with the destination tile taking root beside it. **The seed-it-now action:** *"Where does your day happen?"* — home, school, the fields, the office. This seed feeds the ritual immediately: the dawn line knows which sky to read.

### 1.6 The 6th grove — 🌍 Out & About — and the extensibility rule (gate review)

**The decision:** (a) — a new 6th grove — not scattering. Against the "user lives in the day" test: the day's going-out question is one mental cluster — *"what's happening this weekend, where should we eat tonight, where can we go outside Saturday, how do we get to Chicago, and do we have the fuel to get there?"* Scattering seven modules across three existing groves would force grove-hunting to plan a single Saturday. Groves are "life-grouped, plain verbs" — 🌍 **Out & About** — *the world beyond the door* — is the life-group the other five never covered. (b) fails the day test: fuel is not "what lands at your door," events are not "the body you live in," and flights fit nowhere.

**5-tab stability is untouched.** Tabs never change — that is the rule this document keeps. Groves are the index, and the standing rule says *new modules join groves*. This amendment is the first time a grove **multiplied**, which is exactly why it happens here, in a gate review, stated explicitly — not silently in a tile shuffle.

**The extensibility rule, stated plainly:** *new modules join groves; groves don't multiply without a gate review.* 24→31 modules arrived and five tabs held. They hold at 50. When the next cluster arrives that doesn't fit six groves, the Design Coordinator runs this same review — the grove map grows deliberately or not at all.

**Who lives here (all LIFE modules — all in the childless app, §2):**

- **Fuel & Charging (W25)** — §1.4.
- **Weather (W26)** — §1.5. The ritual surface.
- **Events (W27)** — *"What's happening near us this weekend?"* Route `/events`. AI-curated from Ticketmaster/Eventbrite/venue calendars/city boards (feasibility: aggregation is solved; curation + family-fit is the product), filtered by the household — ages, interests, budget comfort, how far they'll drive. **Date-night mode** — same engine, different filter ("kid-free Friday? here's what's on"). Wired into the **Coming Up band** ("Saturday looks open and the weather's perfect — 3 things happening near you"), cross-checked against the school calendar (no suggesting the festival during the SAT), weather-paired (W26). Ticket purchase stays external — links out, the money-transmitter boundary never approached. Seed: *"what does your family love, and how far will you drive?"* — interests, budget comfort, date-night opt-in.
- **Restaurants (W28)** — *"Where should we eat tonight?"* Route `/restaurants`. Craving/budget/dietary/kid-friendliness, **taste-learned not stars** (4.8 stars means nothing if the family hates sushi). The wires: W23 feeds it ("you're short on protein — these 3 spots have great grilled options") · W13 hands off ("no meal planned tonight — want to eat out?") · the receipt flows back into W11 · reservations via Resy/OpenTable deep links (no booking infrastructure to build). The Friday-night decision becomes 30 seconds instead of a negotiation. Seed: *"your taste profile"* — cuisines loved, dietary needs (allergies, halal, vegetarian — filtered before results, never as an afterthought), the "we always end up here" patterns.
- **Trails & Parks (W29)** — *"Where can we go outside today?"* Route `/trails`. Trails/parks/playgrounds with difficulty, distance, kid-friendliness, and **current conditions** — the flagship W26 wire ("rained yesterday — the riverside trail will be muddy, try the ridge instead"), seasonal awareness (fall colors peaking), go-now-vs-Sunday judgment. Wired into W22 ("Dawson's at 2,100 steps — the 3-mile loop would close it out") and W4 (no practice Saturday — trail window's open); the weekend plan assembles itself (trail + weather + drive time + what to pack, one card). Data: AllTrails/Trailforks + Google Places + NPS; parks and playgrounds first, backcountry as the data layer matures. Seed: *"home location"* — the map needs a center before it can rank.
- **Flights (W30)** — *"I need to fly to Chicago next month — what's the best deal?"* Route `/flights`. AI flight search with **fare prediction** (book-now-vs-wait with odds — "78% chance this drops $40+ in the next week"), family-trip coordination (seat-together guarantees, basic-economy trap flags, baggage math: "2 checked bags × $35 × 4 legs = $280 — the fare with bags included is actually cheaper"), nearby-airport math. Feasibility: Duffel/Amadeus — booking is mature; fare prediction is honest heuristics, never fake certainty. Seed: *"your home airport + a trip you're dreaming of"* — the airport powers fare-drop alerts; the named trip powers the prediction watch.
- **Rental Cars (W31)** — *"I need a car when I land — what's the best rate?"* Route `/cars`. **Total-cost ranking** (base + taxes + fees — not the "$29/day*" that becomes $89 at checkout), loyalty optimization (Hertz Gold, National Emerald — or whether signing up is worth it), the **insurance double-pay trap** flag ("your Amex already covers CDW — decline the $28/day"), fuel-policy math, vehicle-fit for the family. Wired into W30's handoff ("landing at O'Hare 2:15 PM — 4 counters in Terminal 2, best total-cost rate for a midsize SUV") and the trip card (flights + car + weather + events = one plan). Seed: *"loyalty programs"* — memberships, and what coverage the family already carries.

**Design constraint — real money movement (founder's attention, W30/W31):** both modules book real travel, so the IA and placeholder treatment carry a hard constraint set:
- **PCI scope:** card data never touches Pookie servers — tokenized booking flows through the booking provider (Duffel/CarTrawler). Pookie is the travel agent, not the bank — the not-a-money-transmitter boundary holds.
- **Totals honesty:** "from $X" pricing is banned — the actual bookable total for the selected travelers, shown before the decision.
- **Plain-language terms:** cancellation/change policies summarized in plain language at the decision point — never linked PDFs, never discovered at the gate.
- **No dark patterns in fare display:** no countdown timers, no fake scarcity badges, no pre-checked upsells, no basic-economy traps (restrictions spelled out before booking). Fare prediction shows its odds honestly — never fake certainty.
- **The ledger sees everything:** every booking's receipt flows to W11.

The trip assembly (W30 + W31 + W26 + W27) is a new interconnection moment — §4.11.

## 2. The 17-module childless app — complete, never a lesser tier

The childless user — Maya, 29, Austin — opens Pookie and sees a life app. **Absence, not adaptation:** the 14 parenting modules are fully invisible (not greyed, not teaser seedlings). The "taking-root seedling" pattern is reserved for UNBUILT modules, never for not-yours ones. What she sees is ten modules that cover the eight non-parenting daily struggles from LIFE-FLOW §1.

### 2.1 Exactly what she sees

**Her grove map (3 groves, 16 tiles):**

| Grove | Tiles |
|---|---|
| 💚 Body & Heart | Health (W2, live) · Meals (W13, live) · Activity (W22, live) · Nutrition (W23, live) |
| 🏡 Home & Family | Mail (W21, live) · Shopping List (W20, live) · Spending (W11, live) · Money & Documents (W7, live) · **Credit (W24, taking root — *"Connect your cards"*)** |
| 🌍 Out & About | **Fuel & Charging (W25, taking root — *"What do you drive?"*) · Weather (W26, taking root + the Garden-dawn line live from day one) · Events (W27, taking root) · Restaurants (W28, taking root — *"Your taste profile"*) · Trails & Parks (W29, taking root — *"Home location"*) · Flights (W30, taking root) · Rental Cars (W31, taking root)** |

Plus the quiet W9 explainer row — 16 tiles + W9-as-timing = 17 modules. Three groves is not a smaller app — it's *her whole app*: **mail, money, meals, list, health** (LIFE-FLOW's words for what she calls it — "it runs my life") — plus credit, plus the world outside the door. When a seedling graduates, her grove map gains a freshness chip and her Today bands start emitting that module's cards. Nothing else moves.

**Per tab, for her:**

- **Garden** — the greeting hero names her day, never her lack of children. Her garden: **one plant — hers** — its weather is her life's state (a bill handled is morning rain; a streak is new growth). The three day-ordered cards are hers alone: the electric-bill approval, the dinner plan that's staged, the dentist tomorrow. The water-tap close: *"All quiet. 1 thing handled. Your day's okay. I'll keep watch."*
- **Today** — Now / This Week / Coming Up / If Needed, all hers. Now: the bill approval (money, today) → the dinner fold (home, tonight) → the utilization nudge (*"Chase at 31% — pay $400 by Friday"*, money strategy, this week). This Week: the meal week, the grocery burn mirror, the health pattern. Coming Up: passport renewal in 9 months, the bill Friday, tax quarter close (untagged business transactions — if she's a freelancer). If Needed: the vault status, SOS history. The high-leverage band for her is bills-and-deadlines-first; there are no zeros to drag categories, and the engine knows it.
- **Pookie** — the same clearing. She asks *"what's for dinner given my week?"* or *"is my credit actually excellent?"* and the coach answers with her numbers, concrete and quantified.
- **Grow** — **hers, and full:** health rings (sleep, steps, streaks), money patterns (*"3 months of on-time bills"*), the week's wins bouquet, season recaps. Never a parenting trophy case. When W24 is live, Grow adds the credit arc: *"Utilization under 30% for 12 weeks — the excellent playbook is working."*
- **Groves** — the three groves above, plain verbs, thumb-zone search row pinned at top. No parenting affordance exists anywhere in her app: no grove rail, no badge, no menu hint, no Grow ring waiting for a child.

**The header, for her (A-N12):** no ChildSwitcher — there are no children to switch between. The header carries only identity ("Maya"), the sync dot, and ⌕. It is the lightest chrome in the product, as it should be: her app has one person in it.

**Day-0 for the childless user (A-N9):** her first open is a **life intake, not an onboarding obstacle course.** One screen, plain language: *"What should Pookie watch over?"* — mail (snap a photo of today's pile), money (connect cards / the credit seed), meals (any dietary pattern?), health (connect HealthKit/Health Connect), getting around (what she drives, her home airport, loyalty programs), going out (her taste profile, her interests, how far she'll drive), the sky (the places her day happens — home, the office, the park). She skips anything; skipped modules simply stay quiet, and the intake is revisit-at-any-time from Groves. Her garden starts as a seedling bed — **the first bloom within 48h** (the first bill classified, the first streak watered), because the founder's bar includes the first open and a garden that does nothing for two days teaches that Pookie does nothing.

**Why it feels complete:** she never sees a locked door, only a life. Three groves are *all* of her groves. Five tabs are *all* of her tabs. The app never says "add a child" — adding a child is a life event she'll reach through a human path (§3.3), not a growth hack.

### 2.2 The anti-collision rules, money edition

The money triangle now has three jobs, one destination, three views — **the split-brain fix, extended:** `/money` (W7 — mechanics: the ledger, the vault, documents) · `/money/spend` (W11 — intelligence: patterns, the weekly mirror, the ledger's meaning) · `/money/credit` (W24 — strategy: the coach that turns balances into the excellent-score playbook). Top tabs switch views inside the module (the sanctioned secondary nav). W21 → W11 stays the visible loop (bill → paid → ledger closes visibly); W21 → W24 and W24 ↔ W11 ride underneath it — the user never navigates the wires, only the moments (§4).

---

## 3. Parenting surface rules — the day opens the modules, never the index

**The law:** when a child profile exists, the 14 parenting modules — W1, W16, W5, W4, W18, W8, W17, W3, W19, W6, W15, W4-side deadlines, W10, W12, W14 — surface **on the day's logic**, never as a browsable index the parent must learn. A parent should be able to run their family's life for a week without ever opening Groves. The Groves map keeps their tiles (the inventory rule — groves absorb; the standing rule), but Groves is where modules *live*, not where the day *happens*.

### 3.1 The five day-logic surfaces

1. **The morning briefing (Garden).** Grade deltas overnight (W1), the kids' mornings mapped — field trip today (slip signed ✓), picture day Thursday (shirt tonight) — plus the money/life layer below it. The briefing groups **by child first, urgency second** (*"Dawson's tree · Ella's tree · the house"*), never by module.
2. **Lead-time nudges (push + Today).** The W16 extractor does the prep-window math per item type: spirit week = 3 days out, permission slip = night before, tryout = 6 weeks → suggestion, 2 weeks → nudge, 3 days → alert. The parent sees it when it's actionable, not when it was sent.
3. **Deadline ladders (Coming Up).** College deadlines 30/14/7/2 (W5), permit eligibility countdowns (W6), summer's February wake (W18), annual guardianship review (W19). Countdowns, not calendars; the ladder escalates, the parent never chases.
4. **Handoff windows and gap moments (event-driven).** Co-parenting notes pre-open 2 hours before pickup (W14); early-release Wednesday → coverage suggestion (W12); bedtime → one gentle screen-time nudge (W15). The module lives at the transition, never as a directory to browse.
5. **The weekly mirrors (Grow + digest).** W8 patterns aggregate-only to the parent, weekly; W10 fairness whispers parent-only, weekly (*"…want a look at the breakdown?"* — A-N10); W15's weekly report lands Sunday.

**The silence contract:** W18 sleeps 9 months a year. W3's daily surface is near-zero by design (felt as calm, never seen as features). W5 stays dormant for the 9-year-old entirely. W10 never fires for the single-child family. Silence is designed, and designed silence is what makes the surfacing trustworthy.

### 3.2 The privacy architecture (kept, life-framed)

Per-child, per-module privacy contracts are **stated at the surface where they bite, once, in plain language** — *"Ella's mood detail stays with Ella — you see the trend."* Age tiers hold (under-13 parent-sees-all vs. 13–17 child-confidential). The teen's treehouse view (their garden, their plant, their outcomes; parent-tending invisible) is the same 5-tab shell, filtered by the contracts — **the child's own day has the same shape as the parent's day** (§7). Safety keeps the same-map contract (teen sees what parent sees; pause-with-notice for 16+); **SOS stays globally reachable** (A-N6: taught gesture + visible calm backup row in the Safety grove, Groves, **and the night Garden** — the ≤2-tap promise is never gesture-dependent, even at 11 PM + same long-press on the Garden orb + ≤2-tap panic path, no fine-motor dependence — Wave-3 panic-tests it).

### 3.3 The transition moment: the day a first child profile is added

This is the highest-stakes IA moment in the reframe — a life event, not a settings change. The rule: **the life app she knew stays intact; the day gets bigger.**

**The sequence (no re-onboarding, no mode switch):**

1. **The add-child ritual.** Reached through a human path — the greeting hero on a life-change moment, or Groves' quiet *"Life changed? Add a child"* — never a growth-hack banner. One screen: the child's name, age (drives the privacy tier + which modules may wake), school. Plain language about what adding a child *does*: *"Pookie will watch over their school days, keep their private spaces private, and fold their mornings into your day."*
2. **The garden grows.** Her single plant gains a companion planting — **the spotlight-plant pattern (A-N13)**: one focal moment, always; the child's plant renders where the day's attention is. The header gains the **ChildSwitcher** (avatar + name ▾; "Household" scope below the children) — and the header-density audit (A-N12) applies: at 360px the switcher + role collapse into one element.
3. **Three groves take root in Groves.** 🌿 School Days, 🛡️ Safe & Sound, 🌱 Growing Up appear — **as taking-root seedlings first** (PLACEHOLDER-STANDARD: promise hero + honest "how it will know" + one seed-it-now action each: *"Plant the first seed — connect the school portal"*, *"Add an emergency contact"*). Home & Family gains its parenting extensions (Co-parenting, Babysitters, Fairness). Body & Heart gains Wellbeing (teen-private). The grove rails on Garden show the collapsed *"N more taking root 🌱"* expanders (A-N4/P-N1).
4. **The morning briefing gains the kids' layer.** Same ritual shape (§7), new content: *"2 things could use a look — the kids' mornings are mapped."* The day-ordering still rules: her bill approval may outrank the shirt-laying if the day says so. The day is still *her* day — it just has more people in it.
5. **The treehouse is offered, never forced.** The teen gets their own view invitation (magic-link, their Gmail) — their garden, their outcomes, the privacy contract stated once. The parent never sees the raw stream; the mirror is aggregate-only.

**What does NOT happen:** no "parent mode" toggle, no tutorial replay, no grove map reorganization of her existing modules (Mail stays where it was; Money stays where it was), no badges celebrating the unlock. The app doesn't congratulate itself — it just gets bigger, the way a garden does.

---

## 4. Interconnection as navigation — the 11 day moments, navigated

**The rule:** interconnections are event-driven and time-stamped, never dashboard widgets. The user never opens Pookie to "check the W13↔W20 integration." They open Pookie at 5:30 PM and the dinner plan already knows the shopping list. **The flows are invisible; only the moments are visible.** What follows is each of LIFE-FLOW §4's moments rendered as a navigation spec: where the user is, what appears, where one tap goes.

1. **7:12 AM — Mail → tracked payment → ledger.** The evening's mail scan flagged the electric bill ($142.18, due Friday). Morning briefing, one card: *"Approve payment?"* One tap → the **approval sheet** (intercepting route, back closes it): W21 marks it planned, **W24 logs it as a tracked payment** (due date set, utilization impact noted — *"no utilization change"*), W11 logs the spend, the Friday reminder cancels itself. The user never visited three modules; they answered one question.
2. **7:40 AM — School email → lead-time task.** Tuesday's teacher email said picture day is Thursday. The W16 extractor built the Wednesday-night prep task (*"lay out the good shirt"*) and the Thursday-morning card. The parent sees it in **Today's Three** when it's actionable. Tap → the minutiae line inside `/school/calendar`; the day's logic did the navigating.
3. **12:20 PM — What-if → day rebalance.** The burrito bowl is 640 cal and 45% of the day's sodium. W23 adjusts tonight's W13 plan silently; the evening closeout reflects it. Navigation: none — **the moment is the what-if card itself**, answered in 10 seconds on Today or in Pookie chat. No lecture; the numbers just move.
4. **3:05 PM — Calendar gap → coverage.** Early-release Wednesday (W16) + work conflict (shared calendar) → one gentle card: *"Need coverage 12–3? Priya (sitter) is free — she's rebooked 3 times."* Tap → the W12 request flow (a sheet, not a directory). The booking lands in the W11 ledger. The parent never browsed "Babysitters."
5. **4:47 PM — Store proximity → list claim.** Dad drives past Kroger; three W20 items unclaimed. Gentle: *"3 items unclaimed — you're 2 minutes from Kroger."* Tap → the **shopping list with the three items pre-highlighted**, claim-in-place. Mom sees it live; the second grocery run dies. Location context is consumed, never shown as a feature.
6. **5:30 PM — Cycle memory → preemptive list.** Milk is on a 9-day cycle (learned from W20/W11 receipt history). Day 8: *"Milk due tomorrow — add it now?"* One tap on the **evening card**; the list updates; the crisis never forms. The pattern memory is invisible; the moment is one sentence.
7. **6:15 PM — Meal plan → list → nutrition closeout.** Sunday's W13 plan dropped its grocery list into W20 (tagged "meal plan"). Wednesday's dinner matched the plan; W23 scores reality against it (*"lunch matched, dinner drifted — protein still on target"*); Thursday's plan adjusts. Navigation: the **meal card on Today** carries the whole loop — plan, list status, nutrition score — in one place. The wires never surface.
8. **8:40 PM — Sleep debt → mood correlation.** Three nights under 6 hours (W22) coincide with "rough" check-ins (W8). The parent digest: *"Sleep's been short this week — the lever might be bedtime, not willpower."* The teen sees only the supportive opener. Tap → the **aggregate trend**, never the raw stream. The privacy contract is the navigation: what you can reach is what you're allowed to see.
9. **9:45 PM — Tomorrow preview → conflict catch.** The nightly check on Garden (dusk light): picture day Thursday (W16), the 4 PM pickup conflict — flagged *last week*, already resolved (Dad covers). The geometry study plan staged for 6 PM (W1). The dentist call still pending approval (draft waiting since Monday, inside the 6 AM–10 PM send window). One screen, three lines, each tappable into its module — **the preview is the navigation.**
10. **Sunday 8:00 PM — The week build.** The one weekly ritual, in **Today → This Week**: W13 proposes the meal week (tournament Saturday → carb-loading Friday), W20 builds the list from it, W11 shows last week's grocery burn, **W24 shows the credit pulse** (*"Utilization 28% — under 30 for the 12th straight week 🌱"*), W16 previews the school week, W15's weekly report lands, the fairness mirror whispers (W10). Twenty minutes; the whole week is staged. **This is the week's command center — and it is a band, not a module.**

11. **The trip assembly (W30 + W31 + W26 + W27).** *"Dawson and I need to be in Chicago the second weekend of March."* Told once, in Pookie or on Today, Pookie assembles **one trip card** in Coming Up: W30's short list with the fare-prediction call ("78% chance this drops $40+ in the next week — set the alert or book the $212 now"), seat-together guarantees and baggage math already done, W31's handoff ("landing at O'Hare 2:15 PM — 4 counters in Terminal 2, best total-cost rate for a midsize SUV"), W26's destination weather, W27's events that weekend ("free concert Saturday — weather's clear"). Booking happens inside the flow: actual bookable totals, plain-language cancellation terms, no countdown timers, no fake scarcity — the money-movement constraint (§1.6) is the UX. One card, one tap, one plan; the receipts land in W11 and the trip lives on the trip card until wheels-up.

**The navigation principle, stated once:** every cross-module flow resolves to **one card, one sheet, one tap**. The user navigates *moments* (the bill, the shirt, the pickup, the utilization nudge). The modules are the engine room; the day is the bridge. If a flow ever requires the user to open two modules to complete one thought, the wiring failed — file it as a bug, not a feature request.

---

## 5. The 25 gate notes — kept, or evolved and how

Every mandatory fix from GATE-REVIEW-1.md, preserved. "Kept" = applied as written. "Evolved" = the reframe changed its expression; the evolution is named.

| # | Note | Verdict |
|---|---|---|
| A-N1 | Hub queue: 3, not 5 ("Today's Three") | **Kept.** §1: AttentionQueue is exactly 3, day-ordered. The ritual's name is never a lie. |
| A-N2 | Add `/child/:id` to the route table | **Kept.** §1 routes; the plant-tap has a real destination. |
| A-N3 | `/money#spend` → `/money/spend` | **Kept — and generalized:** `/money/spend` (W11) and `/money/credit` (W24) are both real sub-routes. No hash routes anywhere. |
| A-N4 | Taking-root on hub rails: one collapsed expander per grove | **Kept.** §1 Garden rails; the full vision stays visible without rebuilding the card grid. |
| A-N5 | Ritual close on a scroll hub (signature exit must survive) | **Kept, with the mechanism named:** the Water-the-Garden **pinned end-cap** (§1, §7) — rendered once cards are handled/dismissed; "can't end calmly = bug" now has a surface. |
| A-N6 | SOS reachability proof (heaviest) | **Kept.** §3.2: taught gesture + visible calm backup rows (Safety grove + Groves) + same long-press on the Garden orb + ≤2-tap panic path + Wave-3 panic test. For the childless user the backup row reads *"Emergency — get help fast"* (SOS is for her, not a child). |
| A-N7 | Thumb-zone search entry | **Kept.** Pinned search row at the top of Groves + header ⌕; pull-down-to-search on Garden as the Wave-3 proof item. |
| A-N8 | W9 counting language ("23 tiles vs not a tile") | **Evolved — count updated:** Groves shows **30 tiles** (31 modules minus W9) + the W9 explainer row. The plain-language rule stands; only the number moved. |
| A-N9 | Day-0 Garden (first-run unspecified) | **Kept, split by life:** childless Day-0 = the life intake (§2.1, seedling garden, first bloom within 48h); parent Day-0 adds the add-child ritual (§3.3). The founder's bar (the first open) is specified for both. |
| A-N10 | W10 "intentional?" rewrite | **Kept.** *"spend on Dawson is 3× Ella's this quarter — want a look at the breakdown?"* — curious, never interrogative. |
| A-N11 | Drop "See all ({n})" count | **Kept.** "See the rest" (§1). The boring-Tuesday watch item rides with the ritual spec: one micro-delight guaranteed on empty days (§7). |
| A-N12 | 360px header-density audit | **Kept.** Childless header is minimal by construction (no switcher); parent header collapses switcher + role into one element at 360px (Wave-3 proof). |
| A-N13 | 3-child garden (spotlight plant) + Household-scope hub | **Kept.** Spotlight pattern + Household-scope hub specified (§1 Garden composition). |
| A-N14 | Count all orbs in the glow budget; one interactive orb/screen | **Kept.** Hub orb + center-tab orb + FAB counted against ≤3; FAB tap → `/pookie`, long-press → SOS confirm; gesture taught in onboarding. |
| A-N15 | "Menu" → "Groves" | **Evolved — enacted with the founder's call left open:** the tab ships **Groves** via the `NAV.FIFTH_LABEL` token; QA's 5-second test failed the word, so the **DECISION BOX (§1)** keeps the swap a one-token flip pending the founder's ruling before Milestone 1. "Menu" is a hamburger word; garden paths won — unless the founder says otherwise. |
| A-N16 | "One queue, two lenses" stated explicitly | **Kept.** §1: hub AttentionQueue and Today's Now band are one W9 engine, two lenses — snooze/dismiss reflects in both. |
| A-N17 | Repair the walkthrough (band slip + missing exit) | **Kept, night rules aligned (kill-list #8):** §7 narrates both rituals with the water tap and signature exit; at 11 PM the queue is gone (shell §1.5's rule — "not collapsed, gone"), replaced by the single tomorrow line, the water tap, and the always-visible quiet SOS row. No band slips. |
| P-N1 | Hub-rail placeholder harmonization (mirror of A-N4) | **Kept.** Rails carry only the collapsed expander; seedlings live in Groves. |
| P-N2 | Flat routes (`/driving` not `/grove/driving`) | **Kept.** §1 routes are flat; W24's home is `/money/credit` (a view, per the money rule — the flat-route principle holds for destinations; views nest). |
| P-N3 | NO cold seasonal invitations (W18) | **Kept.** §3.1: the Summer grove wakes as a countdown with the consent-gated *"remind me in February"* opt-in — never a cold push. |
| P-N4 | Seed section required unless documented omission | **Kept.** Every seedling in Groves carries its seed-it-now action (W24: *"Connect your cards"*); W19's deliberate omission remains the documented exception. |
| P-N5 | W19 keeps its quiet interest CTA | **Kept.** Reverent copy, consent-gated; only the seasonal-reminder variant is dropped. |
| P-N6 | Seed-first ordering when the seed is the core ritual | **Kept.** (W6 drive log above capabilities; W24's card-connect above the explainer.) |
| P-N7 | Graduation payoff (seeded data carried over) | **Kept.** When W24 graduates: *"Your connected cards are here — the coach has 3 months of history already."* The seed visibly becomes the module. |
| P-N8 | "Dated update" names the wave, never a date | **Kept.** Waves are intentions; dates are promises. |

**The scale story, updated:** 5 tabs on day one, 5 tabs at 24 modules live, 5 tabs at 31. W24 was the first proof of the rule; W25–W31 are the second: seven modules arrived and **no tab changed** — they joined groves, and the grove map itself grew by exactly one (🌍 Out & About, by this gate review — §1.6). **The extensibility rule:** *new modules join groves; groves don't multiply without a gate review.* 31 modules, 5 tabs, 6 groves — and the day still fits in 60 seconds.

---

## 6. The morning ritual — both users, one shape

**"Open Pookie, see your day, handle your life."** One screen, one scroll, 60 seconds. Same gesture for everyone; the *contents* differ by life, not by settings page. Every card is winnable (one ask, one tap); silence is the default and celebrated; the modules are the engine room — nothing on the morning screen says "W21" or "Mail module."

### Maya's 60 seconds (childless, 6:15 AM)

1. **The line (3 sec):** *"Good morning, Maya. All quiet — one thing could use a look."* (Quiet mornings: *"All quiet. Nothing needs you today."*) **The sky line** — the Garden-dawn weather verdict (W26, §1.5) rides under the hero as the day's first sentence: *"Sunny, 75° — no jacket needed."* It is not a widget; it is the ritual's weather.
2. **The one thing (20 sec):** the electric-bill approval card — amount, due date, one-tap approve → the approval sheet (W21 marks planned, **W24 logs the tracked payment**, W11 logs the spend). Below the fold: *"Chicken stir-fry tonight, 25 min — ingredients are in."*
3. **The day strip (15 sec):** dentist 8 AM tomorrow; bill reminder Friday; **credit pulse**: *"Chase at 31% — pay $400 by Friday to stay under 30."*; **the fuel line**: *"Gas near home jumped $0.30 — the Costco on your route is $2.89."* Scannable, not a calendar grid.
4. **The close — the pinned end-cap (20 sec):** the day's closeout (protein ✓, 7,400 steps, bill approved) → **"💧 Water the garden."** → *"All quiet. 1 thing handled. Your day's okay. I'll keep watch."* She closes the app calmer than she opened it. Done — one screen, one optional tap, zero module names learned.

### The dad's 60 seconds (parent, 5:50 AM)

1. **The line (3 sec):** *"Good morning. 2 things could use a look — the kids' mornings are mapped."*
2. **The kids' mornings (20 sec):** Dawson's field trip (slip signed ✓), Ella's picture day Thursday (shirt tonight) — each a line, not a module. Tapping one *would* open `/school/calendar`; he doesn't need to.
3. **The money/life layer (20 sec):** the power bill approved yesterday (W21→W24→W11, done); the EVOffer return label still missing (reminder set); dinner's plan staged; **the credit coach line**: *"Utilization 28% — the excellent playbook is working."*; **the sky line**: *"Cartersville gets rain at 2 — away-game field. Bring the canopy."*
4. **The day strip (15 sec):** geometry study plan at 6 PM (W1), dentist call pending his approval (draft waiting, inside the send window), pickup covered.
5. **The close (15 sec):** the water tap → *"All quiet. 2 things handled, 1 for later. The family's okay. I'll keep watch."*

**The ritual contract (both users, kept from LIFE-FLOW §5 + A-N5/A-N11):**
- **One screen, one scroll, 60 seconds.** If it takes longer, the ritual dies.
- **Silence is the default.** "All quiet" is valid and celebrated — the app is proud of having nothing to say.
- **The close is pinned, not hoped for.** The Water-the-Garden end-cap renders once the day's cards are handled or dismissed (or there were none). A session that can't end calmly is a bug.
- **One micro-delight on empty days** (A-N11's watch item, now specified): a season shift in the garden light, a growth-ring glint, yesterday's causality chain resurfaced (*"That bill you approved Tuesday? Paid this morning ✓"*). Quiet days are short — never empty.
- **Childless and parent rituals are the same shape.** Content differs, structure doesn't. There is no "parent mode" and no "single mode." There is a life, and the life has or doesn't have children.

---

## 7. The 11 PM test — both lives (A-N17, repaired)

*Maya, 11 PM, tired, one thumb, half attention. She opens Pookie — not from a notification, from habit.*

She lands on **Garden**. Dusk light. Her plant, full and calm. The hero line: *"The garden is resting — 1 thing for tomorrow."* She exhales — nothing is on fire.

One thumb-scroll: **the single tomorrow line** — *"Dentist 8 AM tomorrow — nothing to prep ✓"* — noticed, and released. The queue is gone at night — not collapsed, gone (the shell's night rule, UI-SHELL-HOME §1.5: no lists at 11 PM). She taps the water drop. *"Sleep easy. Your day's okay. I'll keep watch."* Below it rests the quiet SOS row — *Emergency, one tap away* — the ≤2-tap promise needs no remembered gesture, even at 11 PM.

She taps **Today → Coming Up**: *"Chase at 31% — $400 by Friday keeps you under 30"* sits in the countdown list as a this-week nudge — noticed, and released, not tonight. The bill Friday, the passport in 9 months, the tax-quarter close with 6 untagged transactions — all countdowns, none demanding. She taps **Grow**: the week's bouquet — 4 wins, the sleep ring advanced, *"Utilization under 30% for 12 weeks."*

Sixty seconds. She didn't browse 31 modules. She didn't see a dashboard. She saw a garden, handled nothing (nothing needed handling), and closed the app calmer than she opened it. **For the parent, the same walkthrough runs with the kids' mornings mapped and the family's okay — same shape, same calm.** That is the product.

---

## 8. Visual filter — the gate question for everything above

VISUAL-DIRECTIVE-NEON.md governs every surface specified here: **subtle neon borders + sparks on the priority cards only** (the firefly, never the floodlight); restful at 11 PM; Facebook-and-email fluency (5-second rule); visual hierarchy serves *"what do I need to handle today"* — never *"look at all our features."* Both themes are designed, not derived (UI-SHELL-HOME §0.5: the morning-mist light theme is a real spec; the 11 PM night is always dark). The filter for every Wave-3 review: **does this feel like a calm, glowing garden that shows me my day — or a tech product showing off?** If the latter: KILL.

---

*End of IA-FINAL-V2-LIFEAPP.md — the shipped truth. Wave-3 UI designers build the gate screens against this document + the 25 notes in §5.*
