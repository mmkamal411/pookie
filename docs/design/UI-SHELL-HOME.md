# UI-SHELL-HOME — Pookie App Shell + Garden Home: Shipped Screen Specs

**Author:** UI Designer 1 (Shell + Home) · **Date:** 2026-10-11 · **Status:** DESIGN SPEC — shipped-screen detail for engineering handoff
**Scope:** the app shell (chrome, navigation, SOS), the Garden home tab (parent + childless, three day-states), the Today tab, Day-0 life intake, and the first-child transition ritual.
**Inputs:** IA-FINAL-V2-LIFEAPP.md (shipped IA) · GATE-REVIEW-1.md (25 mandatory notes) · VISUAL-DIRECTIVE-NEON.md (neon directive) · DESIGN-SYSTEM.md (tokens + components) · SIMPLICITY-STUDY.md (disclosure ladder) · UX-HABIT-DESIGN.md (rituals + blooming-never-decay).

**Governing rule for every screen below:** *"Does this feel like a calm, glowing garden that shows me my day — or a tech product showing off?"* If the latter: KILL.

---

## 0. Design constants (used by every screen — don't re-decide downstream)

### 0.1 The screen contract
- **Mobile-first, single column, `px-4` page padding, content breathes.** Nothing sharper than 12px radius. `bg-canopy-950` + the non-interactive garden backdrop (3–5 fireflies + one soft halo radial top-center at 6% opacity).
- **One focal moment per screen** (anti-overwhelm rule #3). Neon (subtle borders + firefly sparks) marks **priority only** — Today's Three, the one winnable CTA, the SOS row — never decoration.
- **Disclosure ladder per screen:** Glance (hero line + one feeling) → Engage (cards with one-tap actions) → Master (tap through to the module). Glance must be complete: never a number without a one-tap explanation.
- **Copy law:** short sentences, specific numbers, questions over verdicts, mission framing (gap-to-90), shame-free always. Rose is safety-only. No exclamation marks except the gentle ✓/🌱 celebratory set.
- **Numbers always `tabular-nums`. No serif anywhere.**

### 0.2 Glow budget (A-N14 — counted, not hoped for)
Mobile animation budget: **≤3 animating glows per screen**, and **one interactive orb per screen**, max:
1. The **Pookie orb** — counts as the interactive orb wherever it renders. Per the one-orb decision (§0.4), it is exactly ONE of: the Garden hero orb, the center-tab orb, or the FAB — never two on one screen.
2. **Neon borders/sparks on priority cards only** — these are *static* glows (box-shadow), not animation; they don't count against the budget.
3. Firefly backdrop particles: ambient, `aria-hidden`, count as ONE budget item total.
4. The sync dot pulse counts as the second animation when aging/stale; when fresh it's a static glow (no count).

Every screen below names its glow count explicitly.

### 0.3 The tab bar contract (5, forever)
Bottom nav, exactly five: **Garden** (home icon) · **Today** (sun icon) · **Pookie** (center orb, halo glow, slightly larger) · **Grow** (sprout icon) · **Groves** (grid icon). Desktop: same five as a left IconRail.
- Active: `leaf-400` icon + sunlit label + soft glow. Inactive: `bark-500`.
- **Swappable label (gate-enacted, founder may reverse):** the 5th tab's label is a single design-token string `NAV.FIFTH_LABEL`, shipped as `"Groves"` (grid icon). Flipping to `"Menu"` changes one token; icon and route (`/groves`) stay identical. No copy anywhere in the app hard-codes the word "Groves" for navigation — every reference goes through the token.
- **No badge counts on tabs. Ever.** Attention lives in the queue, not on chrome.

### 0.4 Pookie orb presence rules (A-N14 — DECIDED, one interactive orb per screen)

**The decision (Design Coordinator, resolving the §0.4 / §8-Q1 / V1-§10.2 conflict):** the center tab is always visible on tab screens, so a FAB there would be a second interactive orb — an A-N14 violation. The FAB renders **only where the tab bar is not visible.** One rule, written once:

- **On Garden (`/`)**: the hero orb is the interactive orb (tap → `/pookie`; long-press → SOS confirm). The center-tab orb renders **static** (still glowing, not breathing — one breathing orb per screen).
- **On the other tab screens** (Today, Grow, Groves): the center-tab orb breathes gently and **is** the interactive orb (tap → `/pookie`; long-press → SOS confirm). **No FAB on tab screens** — this resolves §8-Q1: the coordinator prefers no FAB here, and A-N14 requires it.
- **On non-tab screens** (module destinations, intercepting-route sheets, Day-0 intake — anywhere the tab bar isn't visible): a **FAB at z-55** carries ambient presence (tap → `/pookie`; long-press → SOS confirm, taught in onboarding; the visible SOS row §3.3 is the guaranteed door — the panic path never depends on the FAB).
- **Desktop:** the IconRail's orb is the interactive orb; the FAB never renders.
- Garden never shows the FAB — its hero orb is the one.

---

### 0.5 Morning-mist light theme (kill criterion #9 — designed, not derived)

The divine-light garden in daylight: **"sunlight through leaves."** Pale warm-green paper, soft leaf shadows, fireflies become drifting light-motes. The neon-firefly law holds in daylight — subtle colored rims + tiny sparks on priority cards only, never floodlight. Restful: nothing inverts harshly; borders are tints, never hard lines; ink is deep green, never pure black. The theme is user-chosen or follows the OS; the Garden's dawn/dusk follows the hour independently.

**Token mapping (dark → light):**

| Dark token | Light value | Role in light |
|---|---|---|
| `canopy-950` `#060f0a` (page bg) | `#f3f7f2` "morning mist" | App page background |
| `canopy-900` `#0a1a10` (raised surfaces, banners, tab bar, sheets) | `#ffffff` | Raised surfaces — depth comes from soft leaf shadow, not dark chrome |
| `canopy-800` `#10241a` (card base, inputs, tracks) | `#ffffff` cards on mist; `#eef4ee` inputs/tracks | Card base — LivingCards get a soft leaf-tinted shadow instead of the dark gradient |
| `canopy-700` `#173322` (hover) | `#e4ede4` | Hover-raised |
| `dew-100` `#ecfdf5` (headings on dark) | `#0d1f14` "deep canopy ink" | Primary text — never pure black |
| `bark-100` `#e8f5ee` (body on dark) | `#22402f` | Body text (4.5:1 on mist) |
| `bark-300` `#b8d4c2` (secondary) | `#55705f` | Secondary text, metadata |
| `bark-500` `#7d9b88` (placeholder) | `#8ba395` | Placeholder, disabled |
| `leaf-300/400` (interactive) | `leaf-600` `#16a34a` text/links; `leaf-500` fills | Primary interactive — deepened one step for contrast on light |
| `sunlight-300` (attention eyebrow `✦ NEEDS A LOOK`) | `#a16207` "sunlit amber" | Attention eyebrows — readable on white, still warm |
| `gold-300/400` (tending band) | `#b45309` | "Needs tending" band text/fills |
| `ember-300/400` (rally band) | `#c2410c` | "Rally" band — the 69 renders warm and rallying, never harsh |
| `rose-300/400` (safety only) | `rose-500` `#f43f5e` | SOS stays safety-only; reads on light unchanged |
| `halo-100` (orb core) | `halo-100` stays | The orb in daylight is a sun, not a lamp: soft gold halo radial at 12% opacity |
| Fireflies (ambient) | "light-motes": soft leaf/gold dots at 25–40% opacity | Same motion, same budget, `aria-hidden` — pollen in sunlight |
| Attention-card glow `shadow-sun-warm` | softened to 40% opacity on white | Priority cards keep their warm rim; the glow whispers in daylight |
| Sheet scrim `bg-canopy-950/70` | `bg-[#0d1f14]/40` + blur | The scrim is softer in daylight |

**Light-theme laws:**
- **The night is always dark — rest is a color.** The 10 PM transition cross-fades to the dark night palette (§1.5) regardless of theme setting. An 11 PM light-mode Garden would be a nightlight, not a night.
- **No floodlight in daylight.** Neon borders stay at ≤30% alpha; sparkles ≤6 dots; the dapple drift on hero art keeps its ≤40% opacity cap.
- **Contrast floor:** body text ≥4.5:1 on mist (the mapping above is the floor, not a suggestion).
- **Grade colors stay shame-free:** bands keep their hues (leaf/gold/ember deepened for light), rose stays safety-only, and a grade is never red in either theme.

---

## 1. Garden tab (home) — the day, tended

Route: `/`. Sheets use intercepting routes over it (e.g. `/today/approve/abc`), back closes them. Pull-down-to-search is the Wave-3 thumb-rescue hatch (A-N7); the pinned search row lives in Groves.

### 1.1 Composition order (both lives — sacred order, never reordered)

1. **AppHeader** (§3.1 / §3.2)
2. **GreetingHero** — the one-line day state
3. **The Garden scene** — the living visual (spotlight-plant for parents, one plant for childless)
4. **AttentionQueue — Today's Three** (A-N1: exactly 3, day-ordered)
5. **Grove rails** — live modules first with real state, then one collapsed *"N more taking root 🌱"* expander per grove (A-N4/P-N1)
6. **TodayStrip** — today's items, horizontal
7. **Water the Garden — the pinned end-cap** (A-N5: the ritual close survives the scroll)

This order is the ritual. If cards are handled/dismissed, the end-cap pins to the visible end — the user can never scroll past their calm ending.

---

### 1.2 Parent Garden — MORNING state (the full morning ritual)

*Scenario: Mehedi, 5:50 AM, Garden in dawn light (soft green-gold dapple from top-left).*

```
┌─────────────────────────────────────────┐
│ [👤 Dawson ▾] [Parent]     [●] [⌕]      │  ← AppHeader (parent)
├─────────────────────────────────────────┤
│                                         │
│      ☀️ Good morning, Mehedi            │  ← GreetingHero (display 34)
│      Tuesday, October 13                │
│      2 things could use a look —        │
│      the kids' mornings are mapped.     │
│                                         │
│         ·    ✦    ·                     │
│      🌱  (Dawson's oak, full)  🌿      │  ← Garden scene (spotlight)
│    ·  fireflies  ·    ·    ·            │
│      🌿 (Ella's fern, resting small)     │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │  ← AttentionCard 1 (sunlight
│  │ Approve the Thomason reply        │  │     border, static glow)
│  │ Ms. Thomason offered the study-   │  │
│  │ guide redo. One tap sends it.     │  │
│  │ [Send the reply]      Not now     │  │  ← one winnable CTA
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │  ← AttentionCard 2
│  │ Picture day Thursday              │  │
│  │ Lay out the good shirt tonight —  │  │
│  │ reminder set for 8 PM.            │  │
│  │ [Got it]              Not now     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │  ← AttentionCard 3
│  │ Electric bill — $142.18           │  │
│  │ Due Friday. Approving now keeps   │  │
│  │ it off your mind all week.        │  │
│  │ [Approve payment]     Not now     │  │
│  └──────────────────────────────────┘  │
│  See the rest →                         │  ← overflow: NO count (A-N11)
│                                         │
│  🌿 SCHOOL DAYS                         │  ← Grove rails
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Geom │ │ Chin│ │ ... │ │ ... │ →     │  live tiles w/ real state
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│  ▸ 2 more taking root 🌱               │  ← ONE collapsed expander
│                                         │
│  🏡 HOME & FAMILY                       │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │ Mail│ │ List│ │ ... │ →             │
│  └─────┘ └─────┘ └─────┘               │
│  ▸ 1 more taking root 🌱               │
│                                         │
│  TODAY                                  │  ← TodayStrip
│  ○──○──○──○──○──○──→                    │
│  6PM   8PM   Thu   Fri                  │
│  geom  shirt picture bill               │
│  study plan  out   day   due            │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💧 Water the garden               │  │  ← pinned end-cap (A-N5)
│  │ The day is handled.               │  │
│  └──────────────────────────────────┘  │
│                                         │
│  [Garden][Today][ ✦ ][Grow][Groves]    │  ← 5-tab bar
└─────────────────────────────────────────┘
```

**GreetingHero spec.** `text-display` ("Good morning, Mehedi ☀️"), then date `text-small text-bark-300`, then the day-state line `text-body text-dew-100` — one of:
- Morning w/ items: *"2 things could use a look — the kids' mornings are mapped."*
- Quiet morning: *"All quiet. Nothing needs you today."* — full stop, celebrated, never apologized for. (The trust dividend: no-news-is-good-news.)
- Bloom moment (overnight win): *"While you slept, Geometry grew +2.5 — the study guide went in."* — the dawn bloom reveal, shown above the queue as a thin halo-tinted banner, one tap to see the causality chain ("You did this").

**The Garden scene (parent — A-N13 spotlight pattern).** A single focal composition, never "one plant per child, equal size":
- The child with the most day-attention renders **full**: a grown plant (species chosen at onboarding — oak, cherry blossom, fern), 120–160px, with a **leaf glow** on the tending side and any overnight blossom unfurling in gold. Dawn: blossom reveal plays once (`bloom` 600ms, `--ease-bloom`), then stills.
- Other children's plants render **resting smaller** (64–80px, moonlit-dormant treatment even at dawn — soft silver-green, no glow), labeled by first name under each. **Never ranked, never compared** — different plants, different soils; no "who's blooming more."
- **Household scope** (switcher on "Household"): the shared beds render — a wide soil bed with the household's shared things as sprouts (mail envelope seedling, meal-plan sprout, shopping-list sprig), and each family plant at equal small size. No single focal plant; the focal moment is the *bed itself* with its day-state line: *"The house: 2 shared things for today."*
- **Tap a plant → `/child/:id`** (A-N2: the child's grove view — a real route). Tap the moonlit small plant → the child's garden with their headline item.
- **Blooming, never decay** (UX-HABIT): an untended plant never wilts — it rests under moonlight ("Resting. It'll be here when you are."). Grade drops never touch the garden. The garden is the safe room.

**Glow count (morning):** firefly backdrop (1) + orb breathing (1) + sunlight card borders *static* (0) + sync dot fresh-static (0) = **2 animating** ✓.

**AttentionQueue — Today's Three (A-N1).** Exactly 3 `AttentionCard`s, **day-ordered** (LIFE-FLOW §6.3): the morning item → the tonight item → the tomorrow item. A user must be able to *narrate their day from the queue order.* Each card: situation + cause + **ONE winnable CTA** + "Not now" (snoozes 24h, logged; swipe card = same action, visible link is the fallback). **"Not now" is a 44px-minimum target on every card, no exceptions** — it is the most-tapped control on the most-tapped cards, and a small text link would fail the shaking-hand test. Ordering rule: safety (rose, rare) → time-critical (<48h) → high-leverage (missing/zeros first) → gentle.
- **Sub-3 queue — the quiet-fill rule (named):** if the engine yields only 1–2 items, the available cards render under the `TODAY'S THREE` header followed by one quiet line — *"The rest of today is clear — go enjoy your coffee."* Never pad with filler cards; never rename the header. (Blesses V1 §3.3's 1-card + quiet line.)
- Overflow: **"See the rest →"** links to `/today` — **no raw count** (A-N11; "See all (12)" at 11 PM is a badge arms race).
- Hub queue and Today's Now band are **one W9 engine, two lenses** (A-N16): snooze/dismiss in either place reflects in both, in the same frame.

**Grove rails.** Per grove: a horizontal rail of **live tiles first**, each showing real state in plain words (*"Mail: 1 bill waiting ✓"*, *"Meals: Wednesday's dish is staged"*) — tile: 120×120 LivingCard, sigil + name + one-line state, tap → module. **Tile-name truncation rule (named):** the name line clamps to 2 lines (`text-small`, `line-clamp-2`); the state line is always visible, never pushed out — *"Driving & Life Skills"* wraps to two lines, never three. Then exactly **one** collapsed expander: *"▸ 2 more taking root 🌱"* → expands in place to the seedling tiles with their promise hero + seed-it-now action (A-N4/P-N1). Grove section labels: plain words ("School Days"), never module codes.

**TodayStrip.** One horizontal strip of today's timed items across the day's logic: geometry study 6 PM → shirt-out 8 PM → picture day Thursday → bill due Friday. Small dot markers with time labels, `text-small`, horizontal scroll, no calendar grid. Tap → the item's module.

**The pinned end-cap (A-N5).** Once the day's cards are handled or dismissed — or if there were none — a full-width LivingCard pins at the hub's end:
- Untapped state: **"💧 Water the garden"** as a primary `btn-dapple` inside a calm card: *"The day is handled."*
- Tap → the plants shimmer (`bloom` once, firefly burst 6 dots, 900ms), the day stamps on the garden calendar, and the card settles into the **signature sentence** (text-body, dew-100, centered):
  - Parent: *"All quiet. 2 things handled, 1 for later. The family's okay. I'll keep watch."*
  - Childless: *"All quiet. 1 thing handled. Your day's okay. I'll keep watch."*
  - Quiet day: *"All quiet. Nothing needed you today. Your day's okay. I'll keep watch."*
- If a session can't end calmly (an error, a stuck queue), **that's a bug, not content** — the end-cap renders regardless; its failure state is a Sentry ticket, not copy.

**Motion notes (morning).** Cards enter with `animate-bloom` staggered 70ms. Tapping a card's CTA → the intercepting sheet rises over Garden; confirming → card plays bloom-and-leave (scale 0.98→1, 600ms), 6-dot firefly burst, item fades with strikethrough, toast: *"Done — one less thing on your mind ✓"* (DESIGN-SYSTEM §2.12). Queue re-orders with `animate-rise`. **No confetti. No point scores.** `prefers-reduced-motion`: movement stops, glows remain.

---

### 1.3 Parent Garden — QUIET-DAY state (the trust dividend)

*Scenario: Mehedi, 9:40 AM Tuesday. Nothing needs him. This is the highest-trust state in the product — it must feel like a feature, not an empty page.*

```
┌─────────────────────────────────────────┐
│ [👤 Dawson ▾] [Parent]     [●] [⌕]      │
├─────────────────────────────────────────┤
│      ☀️ Good morning, Mehedi            │
│      Tuesday, October 13                │
│      All quiet. Nothing needs you      │
│      today. ✓                           │
│                                         │
│         ·    ✦    ·                     │
│      🌳  (Dawson's oak, calm)  🌿      │  ← plants full, sunlit, at rest
│    ·  fireflies  ·    ·    ·            │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 🌱 A quiet night — everything     │  │  ← micro-delight (A-N11):
│  │ held. The bill you approved       │  │     yesterday's causality chain
│  │ Tuesday? Paid this morning ✓      │  │     resurfaced
│  └──────────────────────────────────┘  │
│                                         │
│  🌿 SCHOOL DAYS                         │  ← rails render normally
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │ ... live tiles w/ calm states ...  │ │
│  └─────┘ └─────┘ └─────┘               │
│  ▸ 2 more taking root 🌱               │
│                                         │
│  TODAY                                  │
│  ○──○──○──→                             │  ← few items, or "Nothing
│  (dentist Thu)                          │     scheduled today."
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💧 Water the garden               │  │  ← end-cap still pins
│  └──────────────────────────────────┘  │
│                                         │
│  [Garden][Today][ ✦ ][Grow][Groves]    │
└─────────────────────────────────────────┘
```

**What changes from morning:** the day-state line becomes the celebration: *"All quiet. Nothing needs you today ✓"* (never "0 items" — counts are an anxiety engine). Today's Three is **absent, not empty** — no "No cards" placeholder. In its place: **the micro-delight row** (A-N11 watch item, now a guaranteed contract — quiet days are short, never empty):
- Option A (default): **yesterday's causality chain resurfaced** — *"That bill you approved Tuesday? Paid this morning ✓"* — a `dew`-tinted LivingCard, tap → the ledger entry. Proof the engine worked while he wasn't looking.
- Option B (rotate, ≤1/session): a season shift in the garden light (autumn dapple for 5 seconds on open), a growth-ring glint on a child's plant ("October's ring is set"), or a gentle forward glance (*"Picture day Thursday — nothing to prep yet."*).
- Copy above the card: *"The engine is watching — grades, health, deadlines, the mail. Go enjoy your coffee."* (kept from IA — the trust dividend, verbatim.)

**Silence is designed.** The rails still show live states (calm ones: *"Mail: all filed ✓"*), but nothing glows sunlight. The garden is the safe room; quiet days leave the parent *calmer than they started*, which is why they come back tomorrow.

---

### 1.4 Parent Garden — EVENING state (9 PM closeout)

*Scenario: Mehedi, 9:05 PM. Dusk light — amber-green fade, warm but dimming. The day's queue is done; the closeout is the surface. This is the hub state V1 §3.5's closeout lives on — the shell composes it here so engineering never invents it.*

```
┌─────────────────────────────────────────┐
│ [👤 Dawson ▾] [Parent]     [●] [⌕]      │  ← header, unchanged
├─────────────────────────────────────────┤
│                                         │
│      🌙 Good evening, Mehedi            │  ← evening hero
│      Tonight's closeout —               │
│      3 things from today.               │
│                                         │
│         ·    ✦    ·                     │
│      🌳  (oak, settling)   🌿          │  ← dusk garden: plants at rest,
│    ·  fireflies (warm, slow)  ·        │     warm dusk wash, no blooms
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ ✓ Geometry study plan — done      │  │  ← closeout checklist (V1 §3.5):
│  │ ✓ Georgia Power — planned Friday  │  │     the day's completions struck
│  │ ○ Dentist call — the draft is     │  │     through; the one open loop
│  │   ready when you are. [Review →]  │  │     calm, never guilty
│  └──────────────────────────────────┘  │
│                                         │
│  The garden grew today 🌱               │  ← the day's growth, one line
│                                         │
│  (No queue. No rails at 9 PM.)          │  ← chrome recedes for the closeout
│                                         │
│  TOMORROW                               │  ← tomorrow preview, one line
│  Dentist 8 AM — nothing to prep ✓      │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💧 Water the garden               │  │  ← end-cap: the evening signature
│  └──────────────────────────────────┘  │
│                                         │
│  [Garden][Today][ ✦ ][Grow][Groves]    │
└─────────────────────────────────────────┘
```

**Evening rules:**
- **The closeout replaces the queue.** The day's completions render struck through (their bloom-and-leave already played during the day); at most one open loop renders, phrased calm — *"the draft is ready when you are,"* never "still waiting." (V1 §3.5's checklist lives on this hub state.)
- **No tables of numbers after 9 PM** (PRODUCT-SCOPE §7). The closeout is three lines and a garden that visibly grew: *"The garden grew today 🌱"* — the one growth line under the checklist.
- **Rails hidden at 9 PM** — the day is done; the closeout is the surface. The TodayStrip becomes the tomorrow preview: one line (*"Dentist 8 AM — nothing to prep ✓"*), never a list.
- **Hero:** *"Good evening, {name} 🌙"* + *"Tonight's closeout — N things from today."* / *"Nothing carried over. The day is closed."*
- **Water tap → the evening signature:** *"Sleep easy. The family's okay. I'll keep watch."* The 10 PM transition (§1.5) cross-fades this into the night state; the water tap and the quiet SOS row persist across the transition.
- **Glow count (evening):** fireflies warm + slow (1) + orb breathing slow (1) = **2**, dusk palette, nothing pulsing faster than 4s.

---

### 1.5 Parent Garden — 11 PM state (restful, one thumb, half attention)

*Scenario: Mehedi, 10:58 PM, lights low. The app must be restful — if it stimulates, it fails.*

```
┌─────────────────────────────────────────┐
│ [👤 Dawson ▾] [Parent]     [◐] [⌕]      │  ← SyncDot dimmed
├─────────────────────────────────────────┤
│                                         │
│      🌙 The garden is resting           │
│      1 thing for tomorrow.              │
│                                         │
│         ·         ·                     │
│      🌙 (oak in moonlit rest)  🌙      │  ← dusk scene: silver-blue
│    ·  fireflies (slower, fewer)  ·     │     fireflies, still water
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Dentist 8 AM tomorrow             │  │  ← the ONE tomorrow line
│  │ Nothing to prep. ✓                │  │     noticed, and released
│  └──────────────────────────────────┘  │
│                                         │
│  (No queue. No rails glow. No strip.)   │  ← chrome recedes at night
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💧 Water the garden → "Sleep      │  │
│  │ easy. The family's okay.          │  │
│  │ I'll keep watch."                 │  │
│  └──────────────────────────────────┘  │
│                                         │
│  🛟 Emergency — get help fast →         │  ← quiet SOS row, ALWAYS visible
│                                         │    (A-N6 kill-list #6): the ≤2-tap
│                                         │    promise never depends on memory
│  🌙 Quiet hours — nudges rest until     │  ← QuietHoursBanner (dismissible)
│  6:00 AM.                               │
│                                         │
│  [Garden][Today][ ✦ ][Grow][Groves]    │
└─────────────────────────────────────────┘
```

**Night rules (VISUAL-DIRECTIVE: restful, not stimulating):**
- **Dusk light treatment:** the garden scene shifts to moonlit rest — silver-blue palette, fireflies slower and fewer, a still-water shimmer. Every plant is beautiful; none demand anything. No sunlight glows after 10 PM; the warmest thing on screen is the water-drop card.
- **Hero shrinks:** the greeting hero becomes two short lines: *"🌙 The garden is resting"* + *"[N] thing[s] for tomorrow."* / *"Nothing for tomorrow."* No date line at night — the day is done.
- **The queue is gone.** Not collapsed — gone. Tonight's cards already resolved or re-queued to dawn. What renders instead: **the single tomorrow line** (max 1): *"Dentist 8 AM tomorrow — nothing to prep ✓"* — noticed, and released. If there are 2+, the line reads *"2 things for tomorrow — they'll be here at dawn."* with a tap → Today → Coming Up. Never a list at 11 PM.
- **Rails, TodayStrip: hidden at night.** The full grove rails return at dawn. At night the hub is: hero → dusk garden → one tomorrow line → water tap → quiet SOS row → tab bar. The interface apologizes for existing; rest owns the pixels.
- **SOS stays visible — always (A-N6 kill-list #6, the panic-path mandate).** The quiet calm row (`🛟 Emergency — get help fast →`) renders below the water tap, above the QuietHoursBanner, at every hour including 11 PM. The ≤2-tap promise is never gesture-dependent: a panicking, exhausted parent must not have to remember the long-press. The row is calm (`bark-100` text, soft rose-tinted left border, 56px) — quiet readiness, not alarm.
- **QuietHoursBanner** (DESIGN-SYSTEM §2.9) may render — `border-halo-300/20`, *"🌙 Quiet hours — approvals and nudges rest until 6:00 AM."* — dismissible per night, never blocking. Safety tripwires still bypass quiet hours (stated in the Safety grove, not here).
- **Water tap at night → the evening signature:** *"Sleep easy. The family's okay. I'll keep watch."* (UX-HABIT's gratitude close: preceded by one effort-specific line when there's a win — *"You caught the missing assignment Tuesday. That's not luck — that's you."*)
- **Glow count (night):** fireflies (1) + orb breathing slow (1) = **2**, both at reduced opacity. Nothing pulses faster than 4s.

---

### 1.6 Childless Garden — the complete life app (Maya's day)

*Maya, 29, Austin. No children, never a locked door. Her grove map is **3 groves, 17 modules (16 tiles + the quiet W9 explainer row)** — her whole app. The header is the lightest chrome in the product.*

```
┌─────────────────────────────────────────┐
│  Maya 🌱                  [●] [⌕]      │  ← clean header (A-N12):
├─────────────────────────────────────────┤  no switcher, no role badge
│                                         │
│      ☀️ Good morning, Maya              │
│      Tuesday, October 13                │
│      Sunny, 75° — no jacket needed.     │  ← W26 dawn line: the day's first
│      All quiet — one thing could        │     sentence, under the hero
│      use a look.                        │
│                                         │
│         ·    ✦    ·                     │
│         🌸  (HER plant, full)          │  ← ONE plant — hers
│      ·  fireflies  ·    ·    ·         │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │
│  │ Electric bill — $142.18           │  │
│  │ Due Friday. One tap approves it.  │  │
│  │ [Approve payment]     Not now     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │
│  │ Chicken stir-fry tonight, 25 min  │  │
│  │ Ingredients are in. Recipe's      │  │
│  │ waiting in Meals.                 │  │
│  │ [See tonight's plan]  Not now     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │
│  │ Chase at 31% — pay $400 by Friday │  │  ← credit coach card
│  │ to stay under 30.                 │  │
│  │ [Plan the payment]    Not now     │  │
│  └──────────────────────────────────┘  │
│  See the rest →                         │
│                                         │
│  💚 BODY & HEART                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Health│Meals │Move  │Food  │ →      │  ← live, real state
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                         │
│  🏡 HOME & FAMILY                       │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ Mail│ List │Spend │Money │ →       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│  ▸ Credit — taking root 🌱             │  ← the ONE seedling expander
│                                         │
│  🌍 OUT & ABOUT                         │
│  ▸ 7 more taking root 🌱               │  ← fuel, weather, events,
│                                         │     restaurants, trails, flights,
│                                         │     cars — all seedlings for now
│  TODAY                                  │
│  ○──○──○──○──→                          │
│  8AM   12PM  6PM   Fri                  │
│  dent  lunch dinner bill                │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💧 Water the garden               │  │
│  └──────────────────────────────────┘  │
│                                         │
│  [Garden][Today][ ✦ ][Grow][Groves]    │
└─────────────────────────────────────────┘
```

**What differs from the parent Garden — and what doesn't:**
- **Header:** her name + a sprout glyph ("Maya 🌱") left; SyncDot + ⌕ right. No ChildSwitcher (no children to switch between), no RoleBadge (there's one person in her app). This is the lightest chrome in the product — the 360px audit passes by construction (A-N12).
- **Her plant — ONE.** Species she chose at intake (cherry blossom, fern, oak). Its "weather" is her life's state: a bill handled is morning rain (a shimmer pass); a streak is new growth (a leaf unfurls); a quiet week is sunlit rest. Tap → her `/grow` week view (her growth story — not a child page).
- **Today's Three — hers alone, day-ordered:** the bill approval (money, today) → tonight's dinner (home, tonight) → the credit coach (money strategy, this week). **The high-leverage band for her is bills-and-deadlines-first** — there are no zeros to drag categories, and the engine knows it.
- **Rails:** 3 groves, plain verbs. Body & Heart: Health · Meals · Activity · Nutrition (live: *"Meals: Wednesday's dish is staged"*, *"Activity: 7,400 steps yesterday"*). Home & Family: Mail · Shopping List · Spending · Money & Documents (live: *"Mail: 1 bill waiting ✓"*) + the **Credit seedling** — the single collapsed expander: *"▸ Credit — taking root 🌱"* → promise hero + the seed-it-now action (*"Connect your cards"*). When Credit graduates, the rail tile goes live with a freshness chip and the coach starts emitting Today cards (P-N7 payoff: *"Your connected cards are here — the coach has 3 months of history already."*). 🌍 Out & About: fuel, weather, events, restaurants, trails, flights, rental cars — all taking-root seedlings for now, so the rail is the one collapsed expander: *"▸ 7 more taking root 🌱"* — except the W26 dawn line, which is already live under her hero (the ritual-surface MVP rides on W9). Three groves is not a smaller app — it's her whole app: 16 tiles + the W9 explainer row = 17 modules.
- **Absence, not adaptation:** no parenting grove exists in her app — not greyed, not teased, not in Groves. She never sees the word "child" in navigation. Five tabs are all her tabs.
- **End-cap signature:** *"All quiet. 1 thing handled. Your day's okay. I'll keep watch."*
- **Her 11 PM:** same night rules as §1.5 — dusk garden, one tomorrow line (*"Dentist 8 AM tomorrow — nothing to prep ✓"*), water tap → *"Sleep easy. Your day's okay. I'll keep watch."* The quiet SOS row renders for her too (SOS is for her, not a child).

**Grow for Maya (hers, full — contract):** health rings (sleep, steps, streaks), money patterns (*"3 months of on-time bills"*), the week's wins bouquet, season recaps (*"Fall 2026: 41 workouts, every bill on time, 1 trip funded"*). **She must never see an empty parenting trophy case.** Rings are hers: Seed → Sprout → Sapling → Grove → Canopy ("3-day streak — Sapling 🌱"; broken streak: *"The sapling is still here — water it today 🌱"*). **Grow on Day-0 (kill-list #11):** her first Grow is composed, not empty — *"Your story starts here."* Three seedling rings (health, money, wins), each with its seed-it-now action (*"Connect HealthKit — your first ring starts tonight"*); the week's bouquet holds one honest line: *"Your first win will bloom here."* Absence, never apology — and never a parenting ring waiting for a child.

---

## 2. Today tab — "What needs you today"

Route: `/today`. W9's face — four attention bands, smart-ranked inside each band. Predictability beats clever at 11 PM. **This is Pookie's tweet-deck:** every item is the same AttentionCard grammar (situation + cause + ONE winnable CTA + "Not now"), and **if a card needs a "read more," it's two cards.**

```
┌─────────────────────────────────────────┐
│  ← back? NO — Today is a tab.           │  ← it's a destination
│  What needs you today                   │  ← h1 (28)
│  Tuesday, October 13                    │
├─────────────────────────────────────────┤
│                                         │
│  NOW                                    │  ← band eyebrow (caption)
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │  safety (rose, rare)
│  │ …                                 │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ✦ NEEDS A LOOK                    │  │  time-critical <48h
│  │ Geometry: Unit 4 test Thursday    │  │
│  │ The study plan is ready — 40 min  │  │
│  │ tonight keeps it on track.        │  │
│  │ [See the plan]        Not now     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ high-leverage: 2 missing CW in    │  │  zeros first
│  │ Geometry dragging the grade.      │  │
│  │ [Knock out the first] Not now     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ gentle: Milk due tomorrow —       │  │  suggestions
│  │ add it now?  [Add milk] Not now   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  THIS WEEK                              │  ← the tending surface
│  ┌──────────────────────────────────┐  │
│  │ Meal week: 5 of 7 nights staged   │  │  week-build lives here
│  │ [Review the week]                 │  │  all week
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Grocery burn: $186 of ~$220       │  │  weekly spend mirror
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Sleep: 3 short nights — the lever │  │  health pattern
│  │ might be bedtime, not willpower.  │  │
│  └──────────────────────────────────┘  │
│                                         │
│  COMING UP                              │  ← the horizon: countdowns
│  · Bill due Friday — 3 days             │  not calendars
│  · Passport renewal — 9 months          │
│  · Tax quarter closes — 6 untagged      │
│     transactions                        │
│  · Summer grove wakes in February 🌱    │  ← countdown, never cold push
│                                         │
│  IF NEEDED                              │  ← event-driven, dormant
│  · SOS history                          │
│  · The vault                            │
│  · 🛟 Emergency — get help fast →      │  ← SOS visible calm backup
│                                         │
│  [Garden][Today][ ✦ ][Grow][Groves]    │
└─────────────────────────────────────────┘
```

### 2.1 The four bands — spec

**NOW — the full AttentionQueue** (the hub's Today's Three is this band's first three; one W9 engine, two lenses — A-N16). Smart-ranked inside the band: safety (rose, rare) → time-critical (<48h deadline) → high-leverage (missing/zeros first; for childless: bills and deadlines) → gentle (suggestions). Unlimited count here (this is the overflow's home), but **never more than 5 action choices visible without a scroll cue** — below 6, a quiet *"Keep scrolling — 3 more below"* divider (anti-overwhelm #1). Every card: situation + cause + ONE winnable CTA + "Not now."

**THIS WEEK — the tending surface.** The Sunday "week build" surface lives here all week: the meal week proposal + its list status, the weekly spend mirror, the school-week preview (parents), the week's health pattern, the screen-time report. Cards here are **state + one tap to the builder**, not alarms. This band is also where the week-build's 20-minute command center happens (LIFE-FLOW moment 10).

**COMING UP — the horizon.** Countdowns, not calendars: bill due Friday, passport renewal, permit eligibility, college deadlines (30/14/7/2), seasonal wakes (*"The Summer grove wakes in February 🌱"* — countdown with the consent-gated *"remind me in February"* opt-in; never a cold push — P-N3). Each row: plain-text countdown + one tap to its module. No dates-as-deadlines styling; countdowns escalate gently.

**IF NEEDED — event-driven and dormant.** SOS history, the vault, co-parent handoffs, birthdays, the fairness gut-check (parent-only, curious copy — *"spend on Dawson is 3× Ella's this quarter — want a look at the breakdown?"* — A-N10). **Visible, calm, never nagging.** And: the **SOS visible calm backup row** lives here too (§3.3) — one quiet row, not a red button.

**Honest silence (all bands):** empty bands say so warmly — *"Nothing here. The engine is watching — go enjoy your coffee."* Suppressed states are honest — *"2 updates resting until tomorrow — exam-week mode."* **No band ever renders an empty-state illustration of failure.**

### 2.2 Band rules
- Bands are **day-ordered, never module-ordered** — the bands are the day's bands. Module names appear only as card sources ("Geometry" as a class name, "Mail" as a life area — never "W21").
- Safety band items (rose) appear here and ONLY here outside the SOS row — the hub may show at most one safety item, and it jumps the queue order.
- Cards resolve with the same completion pattern as the hub (bloom-and-leave + toast + 14-day trigger suppression).
- **Night behavior:** after 10 PM, Now collapses to the tomorrow preview (mirrors the Garden night rules — no lists at 11 PM).

---

## 3. App chrome — header, tabs, SOS

### 3.1 AppHeader — parent version (A-N12: the 360px audit, proven)

**Full width (≥400px):**
```
[👤 Dawson ▾] [Parent]        [● Sync] [⌕]
```
- **ChildSwitcher** (left, min 44px tap): avatar = child's initial in a `leaf`-ringed circle (active child gets the halo glow) + first name + chevron. Tap → bottom sheet: each child row (avatar, name, one-line status: *"All quiet 🌿"* / *"2 things need a look ✦"*), then **"＋ Add child"** (the ritual entry — §5), then **"Household"** scope (family-level view).
- **RoleBadge** — a quiet pill: `Parent` (or the child's name when viewing a teen's treehouse view). **Child view NEVER shows parent worry-list copy.**
- **SyncDot** (right): leaf-400 pulsing = fresh (<15 min) · sunlight-400 = aging (15–60 min) · gold-400 = stale (>60 min). Tap → freshness popover with per-source timestamps + SYNC NOW. **No numeric badges, no red dots** — the only header indicator is the SyncDot.
- **⌕ CommandBar trigger** (right): tap → command bar (fuzzy search: Actions → Modules → Children; "Sync now", "Log check-in", "Approve teacher draft", "Add expense"). Thumb-rescue: the pinned search row in Groves + pull-down-to-search on Garden (A-N7) — the header ⌕ is the *third* door, not the only one.

**360px audit (A-N12) — the collapse rule:** at ≤360px the switcher + role collapse into ONE element: `[👤 ▾]` — the avatar carries the chevron; the RoleBadge hides (the sheet still shows role context). SyncDot + ⌕ keep their 44px targets. Proven layout at 360: `avatar-chevron (44) + sync (44) + search (44) + 16px gutters = 164px` — the remaining ~196px stays breathing room. No crowding, no wrapping. The header is calm — four chrome elements max, three at 360.

### 3.2 AppHeader — childless version

```
Maya 🌱                        [● Sync] [⌕]
```
Her name + sprout glyph, `text-h3`, left. SyncDot + ⌕ right. **No switcher, no role badge, no parenting affordance.** The lightest chrome in the product — her app has one person in it.

### 3.3 SOS — the panic path (A-N6: the heaviest finding, answered)

SOS is globally reachable by **three paths** — a taught gesture, a visible calm backup, and the Garden orb. No single path depends on fine motor control.

**Path 1 — the visible calm backup (≤2 taps, no fine-motor dependence):**
1. A quiet row, pinned in **Today → If Needed**, in the **Safety grove / Groves tile**, and in the **night Garden** (§1.5 — the ≤2-tap promise is never gesture-dependent): `🛟 Emergency — get help fast →` — 56px row, `bark-100` text, a soft rose-tinted left border (`rose-400/40`), calm LivingCard, **not a red button**. For the childless user it reads the same — *"Emergency — get help fast"* (SOS is for her, not a child).
2. Tap → the **Emergency sheet** (full-screen on mobile, `rounded-t-3xl`, `bg-canopy-900`): three huge targets (min 64px):
   - **"Call 911"** — rose-400 fill, white text, 72px tall. Tap → native dialer (the second tap is the OS confirm — ≤2 taps total).
   - **"Text my trusted contact"** — `btn-rooted`, 64px. Tap → pre-filled message sheet.
   - **"I'm okay — stand down"** — ghost, dismisses with a log entry.
   - Below: the calm line *"Breathe. Help is one tap away. Pookie stays with you."* — panic language banned (panicked people decide worse).
3. That's it. **Row → sheet → call = 2 taps.** No PIN, no long-press, no "are you sure" on the 911 button.

**Path 2 — the taught gesture (accelerator, never the only door):** long-press the Pookie orb (FAB on non-Garden screens, hero orb on Garden) → **SOS confirm sheet** (haptic + "Get help?" with the same three buttons). **Taught in onboarding** (Day-0, §4) with a practice long-press — "try it now, nothing will happen." Gesture ships with the visible fallback (Path 1) — gestures accelerate, never gate (anti-overwhelm #7).

**Path 3 — the Garden orb:** the in-scene orb honors the same long-press (A-N6c) — one gesture everywhere.

**What SOS is NOT:** not an anxiety dashboard, not a red banner, not a tab. A permanent Safety tab was explicitly rejected (anxiety 360 days a year). The SOS row is visible and calm — quiet readiness, not alarm.

**Wave-3 panic test (A-N6e):** the gate requires a shaking-hand test — 64px+ targets, no fine-motor dependence, one-thumb reachable. Recorded as a Milestone-1 acceptance criterion.

### 3.4 TopBannerSlot (stack order: Demo → Staleness → Quiet-hours)
Banners sit above the header, `bg-canopy-900/95`, dismissible where stated. Never red for non-safety: staleness is a fact, not a failure (*"Last updated 2h ago — the garden may have grown since."* + Sync now). Demo: sunlight tint. Quiet-hours (10 PM–6 AM): halo tint, *"🌙 Quiet hours — approvals and nudges rest until 6:00 AM."*

### 3.5 Desktop IconRail
The same five destinations as a left rail (icons + labels, 72px wide), Pookie orb centered in the rail's flow. FAB never appears on desktop (the rail's orb is the interactive orb). Header gains the full ChildSwitcher without the 360px collapse.

---

## 4. Day-0 first-run — life intake → first bloom within 48h

*The founder's bar includes the first open. Day-0 is a life intake, not an onboarding obstacle course — and the garden must do something real within 48 hours, or it teaches that Pookie does nothing.*

### 4.1 The intake — one screen, plain language (A-N9)

Route: `/welcome`. Skippable in full ("Skip — I'll explore" → seedling Garden, intake revisits anytime from Groves → *"What should Pookie watch over?"*).

```
┌─────────────────────────────────────────┐
│                                         │
│         ✦  (Pookie orb, breathing)      │
│                                         │
│   What should Pookie watch over?        │  ← h1
│   Pick what matters. Skip the rest —    │
│   it'll wait for you in Groves.         │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ ✉️  Mail                          │  │  ← LivingCard rows,
│  │ Snap today's pile — bills become  │  │     64px, tap toggles
│  │ reminders on their own.           │  │     leaf ring when ON
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 💳  Money & credit                │  │
│  │ Connect cards — the coach keeps   │  │
│  │ utilization under 30 for you.     │  │
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🍲  Meals                         │  │
│  │ Any pattern? (vegetarian, halal…  │  │
│  │ — Pookie plans around it.)        │  │
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ ❤️  Health                        │  │
│  │ Connect HealthKit — sleep, steps, │  │
│  │ trends, never judgments.          │  │
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🚗  Getting around                │  │
│  │ What do you drive? Home airport?  │  │
│  │ Loyalty programs? — Pookie finds  │  │
│  │ the cheapest way to keep moving.  │  │
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🍽️  Going out                     │  │
│  │ Your taste profile, your          │  │
│  │ interests, how far you'll drive — │  │
│  │ for dinners and weekends.         │  │
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🌤️  The sky                       │  │
│  │ The places your day happens —     │  │
│  │ home, the office, the park. The   │  │
│  │ dawn line reads their sky.        │  │
│  │                    [  ON  ]       │  │
│  └──────────────────────────────────┘  │
│                                         │
│  [  Begin — tend my day  ]              │  ← btn-dapple, full width
│                                         │
│  Your data stays yours. Pookie never    │  ← trust line, caption
│  shares it, never sells it.             │
└─────────────────────────────────────────┘
```

**Intake rules:**
- **Seven tiles, plain verbs, one line each.** No module codes, no jargon, no "W21." Each tile: Lucide sigil + name + the *outcome*, not the feature ("bills become reminders on their own"). The extended tiles (getting around, going out, the sky) seed W25–W31's rituals — vehicles, home airport, loyalty, taste profile, interests, drive radius, places.
- **Everything is skippable.** Skipped modules stay quiet — never greyed tiles, never "you haven't set up…" copy (banned). The seedling garden doesn't judge.
- **One screen.** No wizard, no progress dots, no "Step 2 of 5." The founder's 5-second rule applies to onboarding too.
- **The SOS gesture is taught here** (A-N6a): after "Begin," one calm card: *"One thing to know: press and hold my light anywhere, and I'll get you help fast. Try it now — nothing will happen."* Practice long-press → gentle confirm → *"That's it. I'll always be here."* Then it never asks again.
- **Household question comes LAST and quietly:** *"Is there a child Pookie should watch over?"* — **No / Not now / Yes → the add-child ritual (§5).** For the childless user who taps "Not now," the app is complete as-is — she never sees the question again unless she opens it herself.

### 4.2 The seedling garden (Day-0 → first bloom)

After intake, Garden renders the **seedling bed**:
- GreetingHero: *"Welcome, Maya 🌱"* + *"Your garden is planted. Let's get the first bloom."*
- The garden scene: a soil bed with small seedlings — one per enabled intake area (a mail seedling, a money sprout, a meal sprig, a health shoot — plus, if enabled, a road seedling for getting around, a going-out sprig, a sky shoot). Each seedling carries its **seed-it-now action** (P-N4 — the seed section is required):
  - Mail: *"Snap your first envelope →"* (camera)
  - Money: *"Connect your cards →"*
  - Meals: *"Tell Pookie tonight's dinner →"*
  - Health: *"Connect HealthKit →"*
  - Getting around: *"What do you drive? →"*
  - Going out: *"Your taste profile →"*
  - The sky: *"Where does your day happen? →"* — this seed feeds the dawn line immediately (W26's ritual MVP).
- Today's Three: **absent** (nothing to rank yet — absence, not an empty state). The TodayStrip shows *"Your first reminders will land here."* — one line, hopeful.
- **The first-bloom contract (≤48h, engineered):** the FIRST real input blooms visibly —
  - First bill snapped + classified → the mail seedling unfurls a leaf + the day-state line: *"First bloom — the electric bill is watched now 🌱"* + a Today card appears ("Electric bill — $142.18, due Friday").
  - First action completed (any winnable CTA) → firefly burst + *"You did that."*
  - First streak watered (health connect + first night of sleep) → the health shoot grows.
- **If 48h pass with no input:** no guilt, no "your plant needs you" (banned). The garden rests under moonlight: *"Resting. It'll be here when you are."* The seedlings stay seedlings. The app waits — patiently, visibly, without a single nudge about the user's absence.

### 4.3 Parent Day-0 (adds the ritual — §5)
A parent's Day-0 runs the same intake, then the add-child ritual (§5) when they say yes. Their seedling bed gains the child's seedling beside theirs. The privacy contract is stated once, plainly, at the seedling: *"Their private spaces stay theirs — you'll see the trends."*

---

## 5. The first-child transition — the add-child ritual

*The highest-stakes IA moment: a life event, not a settings change. The life app she knew stays intact; the day gets bigger. No re-onboarding, no mode switch, no congratulating itself.*

### 5.1 Reachable, human paths (never a growth-hack banner)
- The greeting hero on a life-change moment: *"Life changed? There's room in the garden 🌱"* — one quiet line, dismissible, never a push.
- Groves → a quiet footer row: *"Life changed? Add a child"* (always there, never promoted).
- The ChildSwitcher's *"＋ Add child"* row (for the 2nd+ child — same ritual).

### 5.2 The ritual — one screen

```
┌─────────────────────────────────────────┐
│  ← back                                 │
│                                         │
│   Someone new in the garden 🌱          │  ← h1
│   Pookie will watch over their school   │
│   days, keep their private spaces       │
│   private, and fold their mornings      │
│   into your day.                        │
│                                         │
│   Their first name                       │
│   ┌──────────────────────────────────┐  │
│   │ Dawson                           │  │  ← input-rooted, 56px
│   └──────────────────────────────────┘  │
│                                         │
│   How old are they?                      │
│   ┌──────────────────────────────────┐  │
│   │ 15                               │  │
│   └──────────────────────────────────┘  │
│   (This sets their privacy — under 13,  │
│   you see all; 13–17, details stay      │
│   with them and you see the trends.)    │  ← contract, stated once
│                                         │
│   Their school (optional)                │
│   ┌──────────────────────────────────┐  │
│   │ Walton High School               │  │
│   └──────────────────────────────────┘  │
│                                         │
│   [  Plant their seedling  ]            │  ← btn-dapple
│                                         │
│   Nothing changes about your day        │  ← the promise
│   except it gets a little bigger.       │
└─────────────────────────────────────────┘
```

**Ritual rules:**
- **Three fields. One screen.** Name, age, school (optional). Age drives the privacy tier + which modules may wake (W5 stays dormant for the 9-year-old; W8 teen-private at 13+). No "parent mode" toggle, no tutorial replay.
- **The promise is explicit:** *"Pookie will watch over their school days, keep their private spaces private, and fold their mornings into your day."* Plain language about what adding a child *does* — the only consent copy in the flow.
- **Confirm → the garden grows (the moment):** the Garden scene plays the companion-planting animation once — her plant stays exactly where it was; a seedling rises beside it (`bloom` 900ms, `--ease-bloom`), unfurls one leaf, and the day-state line updates: *"The garden grew — Dawson's mornings are mapped now 🌱."* **One focal moment, always** (A-N13) — the new seedling is the focal plant until the day's attention says otherwise.
- **What does NOT happen:** no confetti, no "Parent mode unlocked!" badge, no grove-map reorganization of her existing modules (Mail stays where it was; Money stays where it was), no tutorial replay.

### 5.3 What changes after the ritual (the day gets bigger)
1. **Header gains the ChildSwitcher** — avatar + name ▾, with "Household" scope below. At 360px the collapse rule (§3.1) applies from this moment.
2. **Three groves take root in Groves** — 🌿 School Days, 🛡️ Safe & Sound, 🌱 Growing Up — as **taking-root seedlings first** (PLACEHOLDER-STANDARD: promise hero + honest "how it will know" + one seed-it-now action each: *"Plant the first seed — connect the school portal,"* *"Add an emergency contact"*). Home & Family gains its parenting extensions (Co-parenting, Babysitters, Fairness). Body & Heart gains Wellbeing (teen-private, 🔒).
3. **Garden rails gain the collapsed expanders** — *"▸ N more taking root 🌱"* per new grove (A-N4/P-N1). Her existing rails don't move.
4. **The morning briefing gains the kids' layer** — same ritual shape, new content: *"2 things could use a look — the kids' mornings are mapped."* Day-ordering still rules: her bill approval may outrank the shirt-laying if the day says so. **The day is still her day — it just has more people in it.**
5. **The treehouse is offered, never forced** — the teen's own view invitation (magic-link, their Gmail): *"Dawson can have their own garden — their outcomes, their plant. Want to invite them?"* One card, one tap, dismissible forever. The parent never sees the raw stream; the mirror is aggregate-only.

---

## 6. Gate-note compliance map (every mandatory note, where it lives in these screens)

| Note | Where it's satisfied |
|---|---|
| A-N1 — Today's Three = exactly 3 | §1.2: AttentionQueue is exactly 3, day-ordered; §2: the rest lives in Today → Now |
| A-N2 — `/child/:id` routed | §1.2: plant-tap → `/child/:id` (real route); listed in IA routes |
| A-N3 — `/money/spend` real sub-route | Shell contract: no hash routes anywhere; Money destination = `/money`, `/money/spend`, `/money/credit` (views, not hashes) |
| A-N4/P-N1 — taking-root on hub rails | §1.2/§1.6: exactly ONE collapsed *"N more taking root 🌱"* expander per grove rail |
| A-N5 — ritual close on a scroll hub | §1.2: the Water-the-Garden **pinned end-cap**; can't-end-calmly = bug |
| A-N6 — SOS reachability proof | §3.3: 3 paths (visible calm row ≤2 taps + taught long-press + Garden orb); 64px targets; Wave-3 panic test as acceptance criterion |
| A-N7 — thumb-zone search | §3.1: pinned search row in Groves + header ⌕ + pull-down-to-search on Garden (Wave-3) |
| A-N8 — W9 counting language | §1.6/§2: Groves = every module as a tile (all modules minus W9 — **30 tiles for the 31-module map**, 6 groves) + the quiet W9 explainer row; W9 is never a tile; the Today tab is the engine's face |
| A-N9 — Day-0 specified | §4: life intake + seedling garden + first-bloom-within-48h contract, childless and parent |
| A-N10 — W10 curious copy | §2.1: *"spend on Dawson is 3× Ella's this quarter — want a look at the breakdown?"* |
| A-N11 — drop the count + micro-delight | §1.2: "See the rest" (no count); §1.3: guaranteed micro-delight on quiet days |
| A-N12 — 360px header audit | §3.1: collapse rule proven at 360 (164px chrome, rest breathing room); §3.2: childless header minimal by construction |
| A-N13 — 3-child garden + Household hub | §1.2: spotlight-plant pattern + Household-scope bed composition |
| A-N14 — orb/glow budget | §0.2: ≤3 animating glows, one interactive orb/screen, every screen counts its glows |
| A-N15 — Groves (swappable) | §0.3: 5th tab ships "Groves"; label is a single token, swappable to "Menu" |
| A-N16 — one queue, two lenses | §1.2: hub queue ↔ Today Now = one W9 engine; snooze/dismiss reflects in both |
| A-N17 — walkthrough w/ water tap + exit | §1.2–§1.5 + IA §6/§7: every day-state (morning, quiet, evening, night) narrates the water tap and signature exit |
| P-N2 — flat routes | All routes flat (`/driving`, `/school`, …); Money views nest (`/money/spend`) as sanctioned views |
| P-N3 — no cold seasonal invites | §2.1: Summer wakes as a countdown + consent-gated *"remind me in February"* opt-in |
| P-N4 — seed section required | §1.2/§4.2: every seedling carries its seed-it-now action |
| P-N5 — W19 quiet CTA | W19 keeps the reverent consent-gated interest CTA (no seasonal-reminder variant) |
| P-N6 — seed-first ordering | §4.2: seedling tiles lead with the seed-it-now action |
| P-N7 — graduation payoff | §1.6: *"Your connected cards are here — the coach has 3 months of history already."* |
| P-N8 — waves name waves, not dates | Standing rule, honored in all seedling copy |

---

## 7. Motion & state summary (for the motion pass)

| Moment | Motion | Duration/easing | Reduced-motion |
|---|---|---|---|
| Card entrance (queue, rails) | `animate-bloom` + 70ms stagger, **capped at 8 items** (`--stagger-cap`: past 8, the container animates once — a 20-tile Garden never cascades for 1.4s) | 600ms, `--ease-bloom` | static, staggered opacity only |
| CTA confirm (sheet) | sheet `animate-rise`; card bloom-and-leave + 6-dot firefly burst | 600ms / 900ms | fade only |
| Bloom reveal (dawn) | blossom unfurl, once per session | 600ms, `--ease-bloom` | static blossom |
| Water tap | shimmer pass + day stamp | 900ms | instant stamp |
| Plant tap → `/child/:id` | route transition (native) | — | — |
| Add-child companion planting | seedling rise + leaf unfurl, once | 900ms, `--ease-bloom` | static seedling |
| SOS sheet | **no rise, no bloom, no stagger** — sheet `opacity(0→1)` at `--duration-instant` (**120ms flat/instant**, per MOTION-SPEC §5 — the panic path is instant; accepts input from frame one) | 120ms, no easing | instant |
| Night transition (10 PM) | garden cross-fade to dusk palette | 900ms, `--duration-slow` | instant |
| Skeleton loads | shimmer matching card shape | `dapple` 2.2s | static skeleton |

**Loading = skeleton or `breathe` pulse. No spinners. No confetti. Nothing loops faster than 4s except hover-only `dapple`.**

---

## 8. Open questions for the Design Coordinator (not blockers)

1. **FAB on Today/Grow/Groves mobile — DECIDED (A-N14 kill-list #5).** No FAB on tab screens: the center-tab orb breathes and is the one interactive orb (tap → `/pookie`, long-press → SOS). The FAB renders only where the tab bar isn't visible (module destinations, sheets, Day-0). The rule is written once in §0.4 and referenced everywhere; §3.3's visible calm row stays the guaranteed panic door.
2. **Pull-down-to-search on Garden** (A-N7's Wave-3 proof) — specced as the hatch; implementation may defer to the first polish pass since the pinned Groves search row + header ⌕ already give two doors.
3. **Grow tab and childless-teen treehouse** — out of this designer's scope (Grow designer + treehouse spec own them); the contracts they must honor are stated in §1.6.

---

*End of UI-SHELL-HOME.md — the shipped shell and home, specified to the gate. Wave-3 builds against this + the 25 notes in §6.*
