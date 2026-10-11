# UI-V1-MODULES — V1 Module Screens (Wave-3, UI Designer 2)

**Author:** UI Designer 2 · **Date:** 2026-10-11 · **Status:** Gate screens for milestone review
**Inputs:** IA-FINAL-V2-LIFEAPP.md · GATE-REVIEW-1.md (25 notes) · VISUAL-DIRECTIVE-NEON.md · DESIGN-SYSTEM.md · SIMPLICITY-STUDY.md · PRODUCT-SCOPE.md · GUIDANCE-FRAMEWORK.md (copy law)
**Scope:** the REAL functional screens for the V1 modules — `/school`, `/school/:classId`, the W9 morning briefing surface, `/mail`, `/shopping`, `/health` (W2-lite + W8 mood pulse), `/school/calendar` (W16 inside School), the W24 seedling at `/money/credit`, and one fully designed interconnection moment (7:12 AM, W21 → W24 → W11).
**Scope boundaries:** Shell chrome, Garden hub layout, the Today tab bands' shell, Day-0, and the SOS panic path belong to UI Designer 1 (UI-SHELL-HOME.md) — this spec defines the W9 briefing's *content contract* (what the engine produces and how it reads), and references Designer's shell pieces by name. Placeholder screens for W6/W12/W19/W5/W3/W18 belong to UI Designer 3 (UI-PLACEHOLDERS.md) — this spec covers only the W24 seedling, which lives at `/money/credit` under the Money destination's three-view rule.

---

## 0. How to read these screens

**The wireframe convention.** ASCII boxes are mobile-first at ~375px. Text inside boxes is real proposed copy, not lorem ipsum. `✦` marks the attention eyebrow (sunlight tint). `···` marks the divider line between numeric and letter grades (the standing rule: numeric + letter, side by side, separated by a 1px `bg-leaf-400/20` line, visible on open). Glow notes name the exact band color and whether the glow *animates* (budgeted) or is static.

**Copy voice.** Warm, plain-spoken, the founder's register: short sentences, specific numbers, questions over verdicts. No em dashes in user-facing copy. No exclamation marks on attention surfaces. No identity verdicts, no diagnostic verbs, no peer comparison, no fatalism, no false reassurance (Guidance Framework never-say list, enforced as copy law).

**Color law (shame-free, in color form).** Grade bands are leaf / sunlight / gold / ember only. Rose is reserved for genuine safety. A grade is NEVER red. The 69 in Geometry renders in warm ember as a rally, never as an alarm.

**The Glance / Engage / Master ladder.** Every screen is mapped through the Simplicity Study's ladder: **Glance** (3 seconds — one number, one feeling), **Engage** (one tap — the ranked top-3 actions, inline completions), **Master** (the full module — reachable, never advertised). Each level is complete on its own.

**Two personas.** The parent: Mehedi, with Dawson (15, Walton HS). The childless user: Maya, 29, whose app holds 17 modules across 3 groves. Both share one ritual shape; content differs by life.

---

## 1. W1 School — the grades dashboard (`/school`)

**Job-to-be-done:** Tell me if my kid is keeping up in school, and exactly what to do about it. (PRODUCT-SCOPE V1.1)

### 1.1 Route, header, and glance

Route: `/school` (flat, P-N2). ModuleHeader anatomy per DESIGN-SYSTEM §3.4:

```
┌─────────────────────────────────────┐
│ [🎒 sigil]  School          [chip]  │
│             Grades, assignments,    │
│             and the path to 90 —    │
│             watched daily.    [↻]   │
├─────────────────────────────────────┤
│ ✦ NEEDS A LOOK — Geometry slipped   │
│   4 points this week. The two       │
│   missing assignments look like     │
│   the cause.          [View plan →] │
└─────────────────────────────────────┘
```

- **Sigil:** Lucide `backpack`, leaf-glow tile. **Subtitle:** "Grades, assignments, and the path to 90 — watched daily."
- **FreshnessChip:** "Updated 20m ago" (leaf) / "Updated 3h ago" (sunlight) / "2d ago — tap for fresh" (gold, tap triggers sync). Every number's age is one tap away (Freshness pattern).
- **AttentionStrip:** renders only if this module has queue items (one, max, on the module page — the queue lives in Today, not here). The Geometry strip above is an AttentionCard, sunlight border + `shadow-sun-warm`, exactly one CTA.

### 1.2 The mission hero

```
┌─────────────────────────────────────┐
│  Dawson's path to 90                │
│                                     │
│     ╭─────╮                         │
│    │  4/6  │  GrowthRing, 88px hero │
│     ╰─────╯                         │
│  4 of 6 classes on the mission      │
│                                     │
│  The spotlight: Geometry needs      │
│  tending — 21 points from the 90    │
│  goal. The plan is ready.           │
│              [Open the plan →]       │
└─────────────────────────────────────┘
```

- The hero leads with the **mission**, not a GPA. "4 of 6 classes on the mission" is progress dopamine (Strengths first — four thriving, not two struggling).
- The GrowthRing fills in band-gradient toward 90 with `aria-label="School: 4 of 6 classes at the 90 goal"`. Static glow (budgeted elsewhere).
- The spotlight line names the one class that needs tending and points to its plan. One CTA. (Spotlight pattern, A-N13 — one focal moment.)

### 1.3 The class list — MissionCards, gap-first

Each class is a LivingCard MissionCard, a `<Link>` to `/school/:classId`. Ordering: needs-tending first (high-leverage), then the rest alphabetical. Each card: name + teacher/period left · numeric `···` letter right · progress bar toward 90 in band color · footer: gap copy left, delta copy right.

```
┌─────────────────────────────────────┐
│ Geometry · Ms. Thomason · 6th       │
│                         69 ··· F    │
│ ▓▓▓▓▓▓▓░░░░░░░░░░░  (ember fill)   │
│ 21 to the mission        ↓ 4 this  │
│                          week       │
├─────────────────────────────────────┤
│ American Gov · Ms. Burwell · 5th    │
│                         79 ··· C    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  (gold fill)    │
│ 11 to the mission        → steady   │
├─────────────────────────────────────┤
│ Env Science · Mr. Armocida          │
│                         79 ··· C    │
│ 11 to the mission        → steady   │
├─────────────────────────────────────┤
│ AP CS Principles · Mr. Hubbard      │
│                         80 ··· B    │
│ 10 to the mission        ↑ 2 this   │
│                          week       │
├─────────────────────────────────────┤
│ Lit & Comp II · Ms. Nickell · 7th   │
│                         84 ··· B    │
│ 6 to the mission         ↑ 1 this   │
│                          week       │
├─────────────────────────────────────┤
│ H Chinese III · Ms. Cook            │
│                         97 ··· A    │
│ On the mission           → holding  │
│                          strong     │
└─────────────────────────────────────┘
```

**Copy audit, card by card** (band lead copy from DESIGN-SYSTEM §1.2):
- Geometry (ember/rally): *"21 points from the 90 goal. The plan below is the way back — one winnable step at a time."* Footer: "21 to the mission · ↓ 4 this week." The number is present and honest; the **lead** is the gap and the plan. Never "failing," never "dropped to 69."
- Gov / EnvSci (gold/tending): *"11 points from the 90 goal — tending now pays off."*
- APCSP / Lit (sunlight/growing): *"10 points from the 90 goal — almost there."*
- Chinese (leaf/on mission): *"Holding strong at the 90 goal — keep growing."*
- H prefix stripped display-only (standing rule). Periods shown are the real ParentVUE tags (Gov 5th, Geometry 6th, Lit&Comp 7th).

**Motion:** cards enter with `animate-bloom`, stagger 70ms. No card glows on its own — neon lives on the attention strip and the hero ring only (firefly, not floodlight).

### 1.4 Glance / Engage / Master

| Level | What the parent sees | Surface |
|---|---|---|
| **Glance** | "4 of 6 on the mission — Geometry needs tending" | Garden rail card / AttentionCard |
| **Engage** | This dashboard: hero + 6 gap-first class cards + one attention strip | `/school` |
| **Master** | Grade forecaster ("what-if" simulator), per-assignment feedback, category weights, full teacher comms threads, term-long DeltaLine, Learn-section unit hub | Tap the hero ring → `/school/forecast`; cards → `/school/:classId` |

**Gate notes served:** A-N8 (W9 is the engine, never a tile — School is the tile, the queue is the engine's face) · shame-free color law · the 5-choice ceiling (6 class cards + 1 strip is the module index, not a choice set; each card is one tap, one door).

### 1.5 Failed states — the portal not connected (kill-list #11)

When the school portal isn't connected, `/school` does not render an empty dashboard or a scolding. It renders the direction's line — *"Still gathering — your garden is safe"* — as a calm seed card in place of the hero:

- **Hero:** *"School is still gathering."* + the seed-it-now action: *"Connect the school portal →"* (the real connection flow; on connect, the hero blooms into the mission hero and the first sync feeds Today's Three within the hour — P-N7's graduation payoff).
- **Class list:** absent, not empty — no greyed cards, no "No data."
- **AttentionStrip:** silent — the module has no queue items because it has no data yet; silence is honest here.
- **FreshnessChip:** "Not connected" (neutral, `bark` tint — never gold or rose; not-connected is a state, not staleness).

---

## 2. W1 School — the class detail page (`/school/geom`)

**The standing rule, honored:** the hero leads with the gap to 90 (mission framing), not the raw grade (judgment). Numeric + letter side by side, separated by a line, visible on open. Top-3 ranked actionable next steps, not a data dump. Daily check-in + handout uploads live **below** the hero, so "what do I do next" stays first. Shame-free language, per-action checkboxes that persist to Supabase for cross-device sync.

### 2.1 The hero — gap first, plan visible

```
┌─────────────────────────────────────┐
│ ← Geometry              [···] [↻]   │
│   Ms. Thomason · 6th period         │
├─────────────────────────────────────┤
│                                     │
│        69  ···  F                   │
│                                     │
│   21 points from the 90 goal.       │
│   The plan below is the way back —  │
│   one winnable step at a time.      │
│                                     │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░  (ember)       │
│                                     │
│  ↓ 4 this week — the two missing    │
│  assignments look like the cause.   │
│                                     │
├─────────────────────────────────────┤
│  ☐ The Unit 3 test retake window    │
│    closes Friday. Ask Ms. Thomason  │
│    about a retake.                  │
│    Why this first: one test can     │
│    move the grade ~8 points.        │
│                                     │
│  ☐ Two missing classwork (1CW1,     │
│    2CW8) are dragging the grade.    │
│    Turn in the first one tonight.   │
│    Why this next: zeros drag their  │
│    whole category.                  │
│                                     │
│  ☐ Unit 4 test Thursday — 25 min    │
│    study plan staged for tonight.   │
│    [Start the plan →]               │
│                                     │
├─────────────────────────────────────┤
│  Tonight's check-in                 │
│  How did Geometry go today?         │
│  [ ... write a line ... ]           │
│  📎 Files & screenshots [Upload]    │
│                                     │
│  Ms. Thomason · thread              │
│  "Reply sent Oct 9 — asking about   │
│  moving Dawson out of Geometry,     │
│  CC'd Ms. Dunham." [Read thread]    │
│  [Draft a note with Pookie →]       │
└─────────────────────────────────────┘
```

**Anatomy notes:**

1. **The number is honest, the lead is the mission.** "69 ··· F" renders in `text-ember-300` — warm, rallying, never red. The lead sentence is the band lead copy. A parent who chose this depth gets the truth; a parent who didn't stays at the gap-first glance.
2. **Top-3 ranked actions, each with a cause.** "Why this first" is the cause line — every ranking shows its cause (anti-overwhelm rule 6). Ordered by (category weight × attainable points): retake window first (time-critical), missing/zero assignments second (zeros drag categories), the study plan third (upcoming test).
3. **Checkboxes persist to Supabase** and the hero number moves in the same frame (the cause→effect loop the habit loop needs). Browser-localStorage is not the store — cross-device sync is the standing rule.
4. **Check-in + uploads sit below the hero**, never above it. The class-page inputs must be captured AND used: check-in text feeds Path-to-90 recommendations (retention indefinite); checkboxes feed guidance; uploads go to the private class-files bucket.
5. **Teacher thread:** the latest state in one line ("Reply sent Oct 9 — asking about moving Dawson out of Geometry, CC'd Ms. Dunham"), then the full thread one tap down, then "Draft a note with Pookie →" which opens the ApprovalSheet: the EXACT draft text in a dew-tinted quote block, Approve / Edit / Decline, and the 6 AM–10 PM send-window rule ("Scheduled for 6:00 AM" chip outside the window). Nothing sends without Mehedi approving the exact words.
6. **Motion:** hero ring draws on entry (`--duration-bloom`, `--ease-bloom`). Tapping a checkbox: `animate-bloom` scale 0.98→1 + a 6-dot firefly burst (900ms) + the row fades with strikethrough + toast "Done — one less thing on your mind ✓" + the hero ring advances in the same frame (Completion pattern).

### 2.2 The rest of the page (Master depth, one scroll)

Below the fold: the 7-day DeltaLine (sparkline, ember, captioned "↓ 4 this week — the two missing assignments look like the cause"), the full assignment table with per-assignment feedback and real category weights (weights feed the forecaster), the grade forecaster ("turn in 2 missing CW + score 85 on the Unit 4 test → 78 by Friday"), the Learn-section unit hub (unit-tagged uploads, AI-generated practice quizzes from unit material, Khan/YouTube links Dawson saved), and the full teacher + counselor thread with drafts.

**Glance / Engage / Master:**

| Level | What the parent sees | Surface |
|---|---|---|
| **Glance** | "Geometry — 21 to the mission" (ember branch glow, no number screaming) | Garden rail / AttentionCard |
| **Engage** | This page's hero: number + letter + gap copy + top-3 checkboxes + check-in/uploads below | `/school/geom` |
| **Master** | Forecaster, assignment table, category weights, full comms threads, unit hub, AI practice quizzes | Scroll / "see everything" |

**Desktop (≥lg):** the hero becomes a two-column card (ring + gap copy left, top-3 actions right); the assignment table gains its full columns. Same copy, wider canvas — never a different app.

**Gate notes served:** shame-free law (copy audit clean — no "failing," the Unit 3 test at 55 is "one event, not a trend" in the thread view) · A-N12 (header stays at back-title-actions, no chrome crowding) · the standing class-page rules verbatim.

---

## 3. W9 — the morning briefing (the product's heart)

**What W9 is:** the proactive engine's face. Not a tile, not a tab called "Briefing" (jargon), not a destination. W9 is **timing itself**: one ordered attention queue, two lenses (the Garden hub's Today's Three + the Today tab's Now band), snooze and dismiss reflected in both (A-N16). The briefing is the day's composition; the modules are the engine room.

### 3.1 The engine contract (what UI renders, in one place)

- **Build:** the queue assembles overnight (~4 AM local), re-ranks on fresh syncs, and re-ranks again at dusk for the evening closeout.
- **Order, always:** safety (rose, rare) → time-critical (<48h) → high-leverage (missing/zeros first — "a zero drags its whole category") → gentle (suggestions). Predictable beats clever at 11 PM.
- **Card grammar (AttentionCard, fixed):** eyebrow (`✦ NEEDS A LOOK`, sunlight, caption) → one situation line → one cause line → ONE winnable CTA → "Not now" (snoozes 24h, logged as the parent's choice, never silently deleted). **"Not now" is a 44px-minimum target on every card, no exceptions** (the most-tapped control on the most-tapped cards). If a card needs a "read more," it's two cards.
- **Limits:** exactly 3 on the Garden hub (A-N1 — the ritual's name is never a lie), the rest waits in Today with "See the rest" (A-N11 — no raw count). Max 1 parent alert/day/child, max 3 child nudges/day. Quiet hours 10 PM–6 AM: pushes held, approvals scheduled for 6:00 AM.
- **Honest silence:** empty Now band: *"Nothing here. The engine is watching — go enjoy your coffee."* Suppressed states are honest: *"2 updates resting until tomorrow — exam-week mode."*
- **Learning:** snoozed items, completed actions, and time-of-day patterns tune the queue. No preference questionnaires. Every ranking shows its cause — the algorithm serves, never mystifies.

### 3.2 The briefing, rendered — Mehedi's morning (parent, 6:50 AM)

This is the W9 content inside Designer's Garden shell (GreetingHero → AttentionQueue → GroveSections → TodayStrip → pinned Water-the-Garden end-cap). The briefing copy for a real Sunday morning:

```
┌─────────────────────────────────────┐
│  Good morning, Mehedi ☀️            │
│  Sunday, October 11                 │
│                                     │
│  Two things could use a look —      │
│  Dawson's morning is mapped.        │
├─────────────────────────────────────┤
│  TODAY'S THREE                      │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✦ NEEDS A LOOK                  │ │
│ │ Unit 4 Geometry test Thursday.  │ │
│ │ The 25-minute study plan is     │ │
│ │ staged for tonight at 6.        │ │
│ │        [Review the plan →]       │ │
│ │        Not now                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✦ NEEDS A LOOK                  │ │
│ │ Georgia Power bill: $142.18,    │ │
│ │ due Friday. You snapped it last │ │
│ │ night — want it handled?        │ │
│ │        [Approve payment →]       │ │
│ │        Not now                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✦ NEEDS A LOOK                  │ │
│ │ Picture day is Thursday — the   │ │
│ │ good shirt gets laid out        │ │
│ │ Wednesday night.                │ │
│ │        [Add to tonight's list]  │ │
│ │        Not now                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│  See the rest →                     │
├─────────────────────────────────────┤
│  TODAY'S STRIP                      │
│  8:00a Dentist call — the draft is   │
│         ready when you are          │
│  6:00p Geometry study plan          │
│  Fri   Georgia Power due            │
├─────────────────────────────────────┤
│  💧 Water the garden                │
│  All quiet. 2 things handled, 1     │
│  for later. The family's okay.      │
│  I'll keep watch.                   │
└─────────────────────────────────────┘
```

**Why this composition works:**
- **Day-ordered, narratable:** Mehedi can narrate his day from the queue order (morning → money → tonight → the strip). (LIFE-FLOW §6.3, A-N1.)
- **The bill card is the interconnection moment (§9):** "You snapped it last night" names the cause; one tap opens the approval sheet; three modules update; he never visits a module.
- **The picture-day card is W16's lead-time math surfaced at the actionable moment** — Wednesday night's prep, suggested Sunday, actionable when the day says so. Tap → the minutiae line inside `/school/calendar`.
- **The strip is a countdown line, not a calendar grid.** Three items, scannable in 5 seconds.
- **The close is pinned, not hoped for (A-N5):** once the day's cards are handled or dismissed (or there were none), the Water-the-Garden end-cap renders. One tap → the day stamps on the garden calendar → the signature sentence. A session that can't end calmly is a bug.

### 3.3 The briefing, rendered — Maya's morning (childless, 6:15 AM)

```
┌─────────────────────────────────────┐
│  Good morning, Maya ☀️              │
│  Sunday, October 11                 │
│                                     │
│  All quiet — one thing could use    │
│  a look.                            │
├─────────────────────────────────────┤
│  TODAY'S THREE                      │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✦ NEEDS A LOOK                  │ │
│ │ Electric bill: $142.18, due     │ │
│ │ Friday. One tap and it's         │ │
│ │ handled.                        │ │
│ │        [Approve payment →]       │ │
│ │        Not now                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│  Chicken stir-fry tonight, 25 min   │
│  — the ingredients are in.          │
│                                     │
│  See the rest →                     │
├─────────────────────────────────────┤
│  TODAY'S STRIP                      │
│  Mon 8:00a Dentist                  │
│  Fri     Bill reminder              │
│  Fri     Chase at 31% — $400 keeps  │
│          you under 30               │
├─────────────────────────────────────┤
│  💧 Water the garden                │
│  All quiet. 1 thing handled. Your   │
│  day's okay. I'll keep watch.       │
└─────────────────────────────────────┘
```

- Her garden is **one plant — hers** (IA §2.1). No ChildSwitcher in her header (A-N12, by construction). No parenting affordance anywhere.
- The quiet line under the card ("Chicken stir-fry tonight…") is the meal layer folding into the day — no module name learned.
- The credit coach line rides the strip as a countdown, not a demand: noticed and released.

### 3.4 The quiet morning (the trust dividend)

When there is genuinely nothing:

```
┌─────────────────────────────────────┐
│  Good morning, Maya ☀️              │
│                                     │
│  All quiet. Nothing needs you       │
│  today.                             │
│                                     │
│  The engine is watching 10 things   │
│  — bills, health, the mail, your    │
│  list. Go enjoy your coffee.        │
│                                     │
│  🌱 Yesterday: the Georgia Power    │
│  bill you approved Tuesday? Paid    │
│  this morning ✓                     │
├─────────────────────────────────────┤
│  💧 Water the garden                │
│  All quiet. 1 thing handled. Your   │
│  day's okay. I'll keep watch.       │
└─────────────────────────────────────┘
```

- **"All quiet" is celebrated, never apologized for.** The micro-delight (A-N11's watch item, specified): yesterday's causality chain resurfaced — *"the bill you approved Tuesday? Paid this morning ✓."* Quiet days are short, never empty.
- The count ("watching 10 things") is honest scale, not a badge arms race — it says what the engine covers, not what demands the user.

### 3.5 The evening closeout (9:00 PM — the completion loop)

Same engine, dusk lens. The closeout is a checklist, not a dashboard:

```
┌─────────────────────────────────────┐
│  Good evening, Mehedi 🌙            │
│                                     │
│  Tonight's closeout — 3 things      │
│  from today.                        │
│                                     │
│  ✓ Geometry study plan — done       │
│  ✓ Georgia Power — planned Friday   │
│  ○ Dentist call — the draft is       │
│    ready when you are. Inside the   │
│    send window until 10 PM.         │
│    [Review →]                       │
│                                     │
│  The garden grew today 🌱           │
│  Geometry's plan is in motion.      │
│                                     │
│  💧 Water the garden                │
│  Sleep easy. The family's okay.     │
│  I'll keep watch.                   │
└─────────────────────────────────────┘
```

- Completion rows play the Completion pattern: bloom + firefly burst + fade with strikethrough + toast. The ring advances in the same frame when the item feeds one.
- **No tables of numbers after 9 PM** (PRODUCT-SCOPE §7). The closeout is three lines and a garden that visibly grew.

### 3.6 Glance / Engage / Master

| Level | What the user sees | Surface |
|---|---|---|
| **Glance** | The greeting line: "Two things could use a look" / "All quiet" | Garden hero, push notification |
| **Engage** | Today's Three + the strip + the water tap — the whole ritual, 60 seconds | Garden hub |
| **Master** | The full Now band, This Week / Coming Up / If Needed bands, the week's mirrors, suppressed-state honesty | `/today` |

**Gate notes served:** A-N1 (exactly 3) · A-N5 (pinned end-cap close) · A-N11 ("See the rest," micro-delight on empty days) · A-N16 (one queue, two lenses) · A-N17 (the close is narrated in the ritual, not skipped) · A-N8 (W9 never a tile — "How Pookie picks your moments" is a quiet explainer row in Groves, the Today tab is its face).

---

## 4. W21 Mail — snap → OCR → action cards (`/mail`)

**Job-to-be-done:** Did that bill get paid? Was there something important in today's mail? (PRODUCT-SCOPE V1.4)

### 4.1 The module page

```
┌─────────────────────────────────────┐
│ [✉️ sigil]  Mail            [chip]  │
│             Every envelope,         │
│             watched. Bills never    │
│             surprise you.     [↻]   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  📷  Snap the mail              │ │
│ │  One photo of today's pile.     │ │
│ │  Pookie reads it and files      │ │
│ │  the rest.                      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  NEEDS A LOOK — 2                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [photo] Georgia Power           │ │
│ │  $142.18 · due Fri Oct 16       │ │
│ │  Bill · from last night's snap  │ │
│ │  [Remind me Thu]  [Mark paid ✓] │ │
│ │  Not now                        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [photo] Walton HS — Picture Day  │ │
│ │  Thu Oct 15 · bring the form    │ │
│ │  School flyer · filed to the    │ │
│ │  school calendar ✓              │ │
│ │  [Add shirt to tonight's list]  │ │
│ │  Not now                        │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  HANDLED                            │
│  ✓ Water bill — paid Oct 8         │
│  ✓ Amex — autopay confirmed        │
│                                     │
│  Filed away quietly — 6             │
│  Junk and catalogs, classified      │
│  and filed. Nothing needed you.     │
└─────────────────────────────────────┘
```

**Anatomy notes:**

1. **The snap card is the module's front door.** One big, obvious camera action — Facebook-and-email fluency (5-second rule: a grandmother knows what "Snap the mail" does). Snap → OCR processing state: the card breathes (`.breathe` pulse, no spinner) with *"Reading your mail…"* → the classified action card blooms in.
2. **Action card anatomy:** photo thumbnail → sender → the two numbers that matter (amount, due date, tabular-nums) → classification chip ("Bill," "School flyer," "Dispute") → ONE primary action + one secondary + "Not now." The bill offers "Remind me Thu" (sets the Thursday nudge, retires the Friday panic) and "Mark paid ✓." Tapping "Mark paid" closes the loop visibly — the W11 ledger updates in the same frame, the card blooms-and-leaves, the toast reads "Paid — logged and filed ✓."
3. **The picture-day flyer is the W16 wire, visible as a moment:** the flyer was classified, filed to the school calendar, and the card offers the one human action left (the shirt). The user never opened a "W21→W16 integration screen."
4. **Junk never surfaces as cards.** Six pieces classified and filed appear as one quiet line — "Filed away quietly." This is contextual surfacing at its purest: the feature works hardest when the parent sees nothing.
5. **"Handled" is the completion ledger** — the week's wins, glanceable. Feeds the evening closeout and Grow's wins bouquet.

### 4.2 States

- **Pending OCR:** breathing card, *"Reading your mail…"* — never a spinner, never a dead photo.
- **Low-confidence OCR:** the card shows the photo larger with the read fields as editable chips: *"I read $142.18 — is that right?"* [Yes] [Fix it]. Honest about uncertainty.
- **OCR total failure (kill-list #11):** the photo is unreadable, or it isn't mail at all. The card does not breathe forever — after the read fails it settles into a calm manual card: the photo thumbnail + *"I couldn't read this one."* → two honest doors: **"It's mail — I'll type the amount"** (amount + sender fields, writes a manual action card) and **"Not mail — file it away"** (files to the quiet ledger). The card never errors in rose; unreadable is a fact, not a failure.
- **Reminder set:** chip flips to "Reminder Thu ✓" — the card leaves the queue and waits for Thursday.
- **Disputed (Master depth):** the dispute tracker — charge, merchant messages, reference number, expected resolution, next nudge. (The EVOffer pattern lives here: filed date, Amex ref, return-label status, the timeline to Oct 26.)

### 4.3 Glance / Engage / Master

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | "2 pieces of mail need a look" — or silence | Today band item |
| **Engage** | The action cards: photo, the two numbers, one action | `/mail` |
| **Master** | Archive search ("find the March water bill"), dispute tracker with document trail, tax-season export, per-sender reminder rules, OCR confidence view | "See everything" |

**Motion:** snap → processing (breathe) → card `animate-bloom` in with stagger. Mark paid → completion burst + the handled row fades up.

**Gate notes served:** shame-free by construction (bills are facts, never verdicts) · A-N11 (no counts screaming — "Filed away quietly — 6" is a calm ledger line, not a badge) · the hard NO honored: nothing is paid, disputed, or filed without explicit approval of the exact action.

---

## 5. W20 Shopping — the shared list (`/shopping`)

**Job-to-be-done:** Are we out of milk? Who's getting it? Did we overpay? (PRODUCT-SCOPE V1.5)

### 5.1 The list

```
┌─────────────────────────────────────┐
│ [🛒 sigil]  Shopping list   [chip]  │
│             The family list — who   │
│             added what, what's      │
│             claimed.          [↻]   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ＋ Add an item…                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  KROGER                             │
│  ☐ Milk — Dawson                    │
│  ☐ Eggs — Mehedi                    │
│  ☑ Bread — Ella · claimed ✓        │
│                                     │
│  FROM FRIDAY'S MEAL PLAN            │
│  ☐ Chicken thighs                   │
│  ☐ Stir-fry veggies                 │
│        [Add all 6 to the list]      │
│                                     │
│  CYCLE MEMORY                       │
│  Milk runs out every 9 days — it's  │
│  day 8. Add it now?  [Add milk]     │
│                                     │
│  CLAIMED THIS WEEK — 4              │
│  ✓ Milk — claimed by Ella, Sat      │
└─────────────────────────────────────┘
```

**Anatomy notes:**

1. **Who-added tags do the job of the child switcher.** "Milk — Dawson" tags the *content*, exactly like Instagram tags content rather than switching accounts (SIMPLICITY §2.3). Family-scoped, no switcher needed. Claimed state flips the tag: "claimed by Ella ✓" with the day.
2. **The quick-add bar is always at the top** (thumb zone). Type "eggs" → it appears instantly, tagged "Mehedi." Claim-in-place: tap the checkbox → the item claims to you, the family sees it live — the second grocery run dies.
3. **The meal-plan batch** (W13 → W20 wire) lands as a grouped batch with one tap to accept all — "Add all 6 to the list." The loop closes visibly; the wires never surface as a feature.
4. **Cycle memory is one sentence, not a feature.** "Milk runs out every 9 days — it's day 8. Add it now?" The 9-day pattern was learned from receipt history; the user sees only the moment. One tap, the list updates, the crisis never forms.
5. **Grouping:** by store (AI-suggested from history), then by aisle within the store at Master depth. The store-proximity moment (4:47 PM — "3 items unclaimed, you're 2 minutes from Kroger") pre-highlights the three items in place.

### 5.2 States

- **Empty list:** SeedlingEmpty — *"The list is clear. When something runs out, it'll grow here."* + quick-add CTA. Never "No data."
- **All claimed:** the completion closeout — *"Everything's claimed. Nice teamwork."* + the week's claimed ledger below.
- **Master:** price intelligence ("Kroger $3.49 vs Publix $4.19 — Kroger wins 8 of last 10 trips," user-reported + receipt-learned only, never scraped live prices), staples auto-suggest, household spend rollup feeding W11.

### 5.3 Glance / Engage / Master

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | "Shopping — 4 items, 1 claimed" | Garden rail card |
| **Engage** | The list: quick-add, who-added tags, claim-in-place, meal-plan batch, cycle memory | `/shopping` |
| **Master** | Price history, staples engine, store rules, spend rollup | "See everything" |

**Motion:** add → item `animate-bloom` in at the top of its store group. Claim → completion burst + strikethrough fade. No confetti, no point scores — tending a garden, not clearing tickets.

**Gate notes served:** A-N13 (no switcher needed — tags) · hard NO honored (no scraped live prices; receipt learning only).

---

## 6. W2 health-lite + W8 mood pulse — the gentle glanceables (`/health`)

**Job-to-be-done:** Keep my kid's health from falling through the cracks — meds, shots, checkups, the doctor's agenda. Is my kid okay today — in 10 seconds, without a lecture. (PRODUCT-SCOPE V1.6, V1.7)

**The governing law:** Health is quiet by design. A healthy child generates no cards. There are no health *scores*, no rings to close, no grades for bodies. Glance is honest silence — which is itself a simplicity feature: the app proves it's watching by saying nothing.

### 6.1 The module page

```
┌─────────────────────────────────────┐
│ [💚 sigil]  Health          [chip]  │
│             The body, gently        │
│             tracked — trends, never │
│             judgments.        [↻]   │
├─────────────────────────────────────┤
│  DAWSON'S SNAPSHOT                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💊 Medications                  │ │
│ │  Albuterol — refills Thu        │ │
│ │  [Set a refill reminder]        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🩺 Next visit                   │ │
│ │  Comprehensive visit — Tue      │ │
│ │  3 questions ready for the      │ │
│ │  doctor.        [Build agenda →] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💉 Shots                        │ │
│ │  Up to date ✓                   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  THIS WEEK'S PULSE                  │
│  Mostly steady 🌱                   │
│  Dawson's mood detail stays with    │
│  Dawson — you see the trend.        │
│  [How the pulse works]              │
└─────────────────────────────────────┘
```

**Anatomy notes:**

1. **The snapshot is the glanceable:** three cards, each one fact + one action. Medications carry refill states ("Albuterol — refills Thu" → time-critical band emits the refill card when Thursday nears). Shots are a single calm line: "Up to date ✓." Nothing to fix renders as nothing to fix.
2. **The visit-agenda builder** is the module's signature action: tap-to-add questions ("Ask about the braces plan," "Glasses prescription update," "The hormone labs — what comes next"), one-tap share to the visit. Seeded from Dawson's real baseline (braces/orthodontist plan, glasses prescription, pending comprehensive workup). The "what changed since last visit" diff is Master depth.
3. **The mood pulse (W8, folded into the check-in):** one extra field on the daily check-in — mood/energy/stress, 10 seconds. The parent sees the aggregate only: "Mostly steady 🌱." The privacy contract is stated at the surface, once, in plain language: *"Dawson's mood detail stays with Dawson — you see the trend."* The teen's raw stream never renders for the parent. The disclosed crisis tripwire lives at Master depth, stated in onboarding — no secret tripwires, ever.
4. **Copy law, health edition:** "under your protein target" never "you failed protein" (V2); no diagnostic verbs; no body/weight language to the child; trends and nudges only, "talk to your doctor" rails. Steps down 40% since grounding renders as "expected, not alarming" — interpreted, never dumped.
5. **Maya's version:** her own snapshot — her meds, her next physical, her sleep/steps pattern from HealthKit. Same three-card shape, her data. Grow carries her health rings from day one (never an empty trophy case).

### 6.2 Glance / Engage / Master

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | Silence — or "Refill reminder — albuterol runs out Thursday" | Today band (time-critical only) |
| **Engage** | The snapshot: meds, next visit + agenda builder, shots; the week's pulse trend | `/health` |
| **Master** | Full longitudinal record, per-metric privacy controls, visit-summary export, the W22/W23 data layers with raw charts | "See everything" |

**Gate notes served:** the privacy contract stated at the surface (A-N6-adjacent trust) · shame-free copy law, health edition · silence as a designed state (anti-overwhelm rule 5).

---

## 7. W16 minutiae — inside `/school` (`/school/calendar`)

**Job-to-be-done:** Never let me miss picture day, the permission slip, or spirit week again. (PRODUCT-SCOPE V1.3) **Placement law:** W16 lives inside School — never a sibling tab, never a grove of its own (anti-collision rule).

### 7.1 The calendar, as a parent reads it

Route: `/school/calendar`. Reached from the School header ("Calendar" link), from the picture-day card in the briefing, from the W16 rail on Garden. The school email pipeline feeds it — zero new data sources.

```
┌─────────────────────────────────────┐
│ ← School calendar         [chip]    │
│   The school days that matter —     │
│   picture days, slips, spirit       │
│   weeks. Never a surprise.    [↻]   │
├─────────────────────────────────────┤
│  THIS WEEK                          │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ THU 15  Picture day             │ │
│ │  Dawson · the good shirt gets   │ │
│ │  laid out Wed night             │ │
│ │  [Add to tonight's list]        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ THU 15  Unit 4 Geometry test    │ │
│ │  Dawson · study plan staged     │ │
│ │  [Review the plan →]            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ WED 14  Early release · 12:30   │ │
│ │  Dawson · coverage needed 12–3   │ │
│ │  [Handled ✓]  Not now           │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  COMING UP                          │
│  Oct 20  Unit 4 Gov test — study    │
│          plan starts Oct 16         │
│  Oct 28  Spirit week — costume      │
│          prep starts Oct 25         │
└─────────────────────────────────────┘
```

**Anatomy notes:**

1. **Grouped by the day's logic** (This week / Coming up), not by module. Each item: date chip, title, child tag, the **lead-time prep** in plain words ("the good shirt gets laid out Wed night"), state (signed ✓ / reminder set / handled), one action.
2. **The lead-time engine is invisible; the prep is the surface.** Spirit week = 3 days out, permission slip = night before, tryout = 6 weeks → suggestion, 2 weeks → nudge, 3 days → alert. The parent sees "costume prep starts Oct 25" when it's actionable — never when the email arrived.
3. **The early-release item** is the handoff-window moment (3:05 PM): coverage needed 12–3, "Handled ✓" once covered. The sitter directory (W12) is V3 — this screen claims no directory; it records the handoff and points to Today if the parent wants the request flow.
4. **Tapping an item** opens a detail sheet: the source (school email Oct 6 / mail snap Oct 10), the prep task, the reminder state. The day's logic did the navigating — the parent never browsed for it.

### 7.2 Glance / Engage / Master

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | "Picture day Thursday — shirt Wednesday night" | Today band / briefing card |
| **Engage** | This week + coming up, each with its prep line and one action | `/school/calendar` |
| **Master** | Full term calendar, per-item source trail, reminder rules per item type | "See everything" |

**Gate notes served:** anti-collision (W16 inside School, labeled by job) · P-N2 (flat route) · silence contract (nothing this week renders as "Nothing on the school calendar — enjoy the week").

---

## 8. W24 credit — the taking-root seedling (`/money/credit`)

**Status:** taking-root seedling in the 🏡 Home & Family grove. Per the placeholder standard: promise hero with a concrete vignette, the honest "how it will know" data line, cross-links (no dead ends), wave named never dated — and the seed section is **required** (P-N4) and **seed-first** (P-N6), because for W24 the seed IS the core ritual: connecting cards is the module's first act.

### 8.1 The seedling screen

```
┌─────────────────────────────────────┐
│ [💳 sigil]  Credit          🌱      │
│             Taking root             │
│             Your credit, coached —  │
│             toward excellent.       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  CONNECT YOUR CARDS             │ │
│ │                                 │ │
│ │  One step. The coach starts     │ │
│ │  the day your cards connect —   │ │
│ │  balances, APRs, utilization,   │ │
│ │  due dates, all in one honest   │ │
│ │  view.                          │ │
│ │                                 │ │
│ │  [Connect your cards →]         │ │
│ │                                 │ │
│ │  Read-only, always. Nothing     │ │
│ │  moves without you.             │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  WHAT THE COACH WILL DO             │
│                                     │
│  "Chase at 31% — pay $400 by       │
│  Friday to stay under 30."          │
│                                     │
│  "Utilization under 30% for 12      │
│  weeks — the excellent playbook     │
│  is working."                       │
│                                     │
│  "Tax quarter ends in 2 weeks —     │
│  14 untagged business               │
│  transactions."                     │
├─────────────────────────────────────┤
│  HOW IT WILL KNOW                   │
│  Scores come from the bureaus'      │
│  paid pulls. Card balances and      │
│  due dates come from a read-only    │
│  bank connection. There is no free  │
│  credit-score API — this page       │
│  won't pretend one exists.          │
├─────────────────────────────────────┤
│  THE MONEY FAMILY                   │
│  [Money & documents →]  (/money)    │
│  [Spending patterns →]              │
│      (/money/spend)                 │
│  [Bills you snap feed the coach]    │
│      (/mail)                        │
├─────────────────────────────────────┤
│  🌱 Taking root — in the next       │
│  wave. Your connected cards will    │
│  be here on day one, with their     │
│  history already growing.           │
└─────────────────────────────────────┘
```

**Anatomy notes:**

1. **Seed-first, per P-N6.** "Connect your cards" is the first thing on the screen — not a capability list. It is one real starting action that writes real rows the future module reads (P-N4). The graduation payoff is stated (P-N7): *"Your connected cards will be here on day one, with their history already growing."*
2. **The promise hero is vignettes, not adjectives.** Three concrete coach lines the user can picture in their own life — the 31% utilization nudge, the 12-week streak, the tax-quarter untagged transactions. "I cannot wait," never "not done yet."
3. **The honest data line** names what doesn't exist: *"There is no free credit-score API — this page won't pretend one exists."* Bureau scores = paid reseller pulls; card data = Plaid read-only. Pretending otherwise would be the fastest way to lose the founder's trust.
4. **No dead ends:** the Money family cross-links (`/money`, `/money/spend`, `/mail`) — the W21 wire is named ("Bills you snap feed the coach"). The Planting pill (`🌱 Taking root`) is the single honest signal — never dimmed, never locked, never "coming soon."
5. **Wave, never a date** (P-N8): "in the next wave." Waves are intentions; dates are promises.

**Glance / Engage / Master (as a seedling):**

| Level | What the user sees | Surface |
|---|---|---|
| **Glance** | "Credit — 🌱 Taking root" | Groves tile + the collapsed hub-rail expander |
| **Engage** | This screen: connect cards, the coach vignettes, the honest data line | `/money/credit` |
| **Master** | Graduates into the full module: three-bureau scores, utilization coach, bill tracking, tax deductibles | Next wave |

**Gate notes served:** P-N2 (flat route, a Money-destination view per the money rule) · P-N4 (seed required) · P-N6 (seed-first) · P-N7 (graduation payoff) · P-N8 (wave, not date) · A-N4/P-N1 (hub rails carry only the collapsed "N more taking root 🌱" expander — the seedling itself lives in Groves) · A-N8 (W9 counting: 30 tiles + the explainer row).

---

## 9. The interconnection moment, fully designed — 7:12 AM: mail → bill → tracked payment → spend logged (W21 → W24 → W11)

**The rule:** interconnections are event-driven and time-stamped, never dashboard widgets. The user never opens Pookie to "check the W21→W24 integration." They answer one question at 7:12 AM; the modules are the engine room. (IA §4.)

### 9.1 Saturday 9:14 PM — the snap (W21)

Mehedi is at the kitchen counter with today's mail pile. He opens `/mail`, taps the big **"Snap the mail"** card, photographs the Georgia Power envelope. The card breathes — *"Reading your mail…"* — then blooms into the classified action card:

```
┌─────────────────────────────────────┐
│ [photo] Georgia Power               │
│  $142.18 · due Fri Oct 16          │
│  Bill · from tonight's snap        │
│  [Remind me Thu]  [Mark paid ✓]    │
│  Not now                           │
└─────────────────────────────────────┘
```

He taps **"Remind me Thu."** The chip flips to "Reminder Thu ✓." The card leaves the queue. He closes the app. (Total: 20 seconds.)

**What the engine records:** sender = Georgia Power, amount = 142.18, due = Oct 16, classification = bill/utility, reminder = Oct 15 AM. W24 logs a *pending tracked payment* (due date set, utilization impact pre-computed: *"no utilization change — it's a utility, not revolving credit"*). W11 stages a *pending spend* of $142.18 against the October utilities budget.

### 9.2 Sunday 7:12 AM — the briefing card (W9)

The morning briefing assembles. The bill is time-critical (<48h is Thursday; the reminder was set for Thursday, but the engine promotes it: Sunday morning is when Mehedi handles money). The card:

```
┌─────────────────────────────────────┐
│ ✦ NEEDS A LOOK                      │
│ Georgia Power bill: $142.18, due    │
│ Friday. You snapped it last night   │
│ — want it handled?                  │
│        [Approve payment →]          │
│        Not now                       │
└─────────────────────────────────────┘
```

**Copy audit:** situation ("$142.18, due Friday") + cause ("You snapped it last night") + ONE winnable CTA. No jargon, no module names, no "W21."

### 9.3 The approval sheet (one tap — the moment)

Tap → intercepting route `/today/approve/georgia-power-1016` renders as a sheet over the Garden hub (back closes it). The sheet shows the **exact action** to approve — the hard NO honored: nothing moves without explicit approval of the exact words:

```
┌─────────────────────────────────────┐
│  ═════════ (drag handle)            │
│                                     │
│  Approve this payment               │
│                                     │
│  Georgia Power · $142.18            │
│  Due Friday, Oct 16                 │
│  From: Chase checking ••4821       │
│                                     │
│  What happens next:                 │
│  · Mail marks it planned ✓          │
│  · Credit logs a tracked payment    │
│    (due date set — no utilization   │
│    change, it's a utility)          │
│  · Spending logs $142.18 to         │
│    October utilities                │
│  · The Friday reminder retires      │
│                                     │
│  [Approve — plan for Friday]        │
│  [Not now]                          │
└─────────────────────────────────────┘
```

**Anatomy notes:**
- The "What happens next" list is the wiring made legible — four lines, plain verbs, no module names. The user sees the *consequence*, not the architecture.
- "Plan for Friday," not "Pay now" — the approval schedules; the money moves when Mehedi says so. Auto-anything financial is a hard NO.
- **Motion:** sheet `animate-rise` over a `bg-canopy-950/70 backdrop-blur-sm` scrim. Approve → the sheet closes, the briefing card plays the Completion pattern (bloom + 6-dot firefly burst + fade), the queue re-orders with `animate-rise`, and the toast reads: *"Handled — tracked, planned for Friday, and logged ✓."*

### 9.4 Thursday — the reminder fires (W21, on schedule)

Thursday morning, one card: *"Georgia Power — $142.18 due tomorrow. Planned from Chase checking ••4821."* CTA: **[Mark paid ✓]**. He pays (in his bank app, or however he pays — Pookie never moves money), taps "Mark paid." The loop closes visibly in one frame:

- W21: the bill card blooms-and-leaves → "Handled: Georgia Power — paid Oct 15 ✓" in the Handled ledger.
- W24: the tracked payment resolves — *"Paid on time. 3 months of on-time bills 🌱"* (the credit pulse, feeding Grow).
- W11: the pending spend becomes actual — October utilities now shows $142.18 of budget used.
- The Friday reminder cancels itself. Nothing dangles.

### 9.5 The storyboard's moral

The user answered **one question** ("want it handled?") and tapped **twice** (approve, mark paid). Three modules updated — mail, credit, spending — and he never visited any of them. The flows are invisible; only the moments are visible. If this flow ever required opening two modules to complete one thought, the wiring failed — file it as a bug, not a feature request. (IA §4.)

**The Maya variant:** identical shape, her bill, her cards. The engine doesn't know or care that she has no children — the moment is hers alone.

---

## 10. Cross-screen continuity contract

Every V1 screen above obeys these, so the seven screens feel like one app:

1. **Freshness is a design feature.** Every data surface shows its age within one tap (FreshnessChip in every ModuleHeader; SyncDot in the AppHeader with per-source timestamps + SYNC NOW). Staleness is a fact, never a scolding: *"Last updated 3h ago — the garden may have grown since."* + Sync now.
2. **One interactive orb per screen (A-N14 — the decided rule, UI-SHELL-HOME §0.4).** On tab screens the center-tab orb is the one interactive orb — **no FAB** (that was the §0.4/§8-Q1 conflict, now resolved). On these module screens — non-tab destinations where the tab bar isn't visible — the Pookie orb FAB (z-55) carries ambient presence: tap → `/pookie`, long-press → SOS confirm. The gesture is taught in onboarding; the guaranteed panic door is the visible calm SOS row (§3.3 shell), never the FAB. No screen invents a second orb.
3. **The glow budget.** Neon lives on priority cards only — the attention eyebrow, the hero ring, the CTA under the user's thumb. Firefly, not floodlight: ≤3 animating glows per screen, everything else static. At 11 PM every screen above must read as a calm garden, not a tech product showing off (the visual filter).
4. **The 11 PM test.** One focal moment per screen. No tables of numbers after 9 PM. "All quiet" is a valid and celebrated state on every surface. If a session can't end calmly, that's a bug.
5. **The 5-second rule.** A grandmother knows what "Snap the mail" does, what "Approve payment" does, what "Water the garden" does. No jargon anywhere — module names never appear on user surfaces (W9 is timing, not a tile).
6. **Completion is the addiction.** Every V1 module has something to *finish*: knock out the assignment, mark the bill paid, claim the list item, log the check-in, water the garden. Finished things bloom, burst into fireflies, and feed the garden. Unfinished things are gentle nudges, never alarms.
7. **Shame-free, everywhere.** Gap-to-90 framing, never judgment. Questions over verdicts. Strengths first. Rose is safety-only; a grade is never red; a bill is a fact, never a verdict; a body is never scored.

### Gate-note satisfaction index

| Note | Where it's satisfied in this spec |
|---|---|
| A-N1 (Today's Three = 3) | §3.1–3.2: exactly 3 on the hub; "See the rest" carries the overflow |
| A-N5 (ritual close mechanism) | §3.2–3.5: the pinned Water-the-Garden end-cap, both personas, morning + evening |
| A-N8 (W9 counting language) | §3.6 + §8: W9 never a tile; 30 tiles + the quiet explainer row |
| A-N10 (W10 nudge rewrite) | Not a V1 surface; the curious-not-interrogative law is cited as the copy standard in §10.7 |
| A-N11 (no raw counts; empty-day delight) | §3.2 "See the rest"; §3.4 the causality-chain micro-delight; §4.1 "Filed away quietly" |
| A-N13 (spotlight, one focal moment) | §1.2 the mission hero spotlight; §10.4 one focal moment per screen |
| A-N14 (one orb per screen) | §10.2 |
| A-N16 (one queue, two lenses) | §3.1: snooze/dismiss reflected in both lenses |
| A-N17 (walkthrough includes the close) | §3.2–3.5 narrate the water tap and signature exit for both personas |
| P-N2 (flat routes) | `/school`, `/school/:classId`, `/school/calendar`, `/money/credit` throughout |
| P-N4 (seed required) | §8.1: "Connect your cards" writes real rows |
| P-N6 (seed-first) | §8.1: the connect card is the first thing on the screen |
| P-N7 (graduation payoff) | §8.1: "Your connected cards will be here on day one, with their history already growing" |
| P-N8 (waves, never dates) | §8.1: "in the next wave" |
| A-N4/P-N1 (hub-rail seedling rule) | §8: seedlings live in Groves; hub rails carry only the collapsed expander |

### Open questions for the Design Lead gate

1. The Geometry 69 renders its letter (F) honestly at Engage depth per the numeric+letter standing rule — confirm the lead-with-gap framing sufficiently carries the shame-free law, or whether the letter should soften to the band word ("Rally") at a glance.
2. The Thursday "Mark paid" card assumes the user pays in their bank app and confirms in Pookie — confirm this is the intended V1 money-movement posture (Plaid read-only, zero movement) versus a deeper bill-pay integration in a later wave.
3. W8's mood pulse aggregates ("Mostly steady 🌱") — confirm the aggregation window (7-day) and the parent-facing vocabulary set before engineering builds the rollup.

---

---

## 11. Morning-mist light theme — per-screen notes (kill criterion #9)

The full token mapping is the law (UI-SHELL-HOME §0.5 — every dark token → its light equivalent, the neon-firefly law kept, restful). What follows is how these seven screens + the seedling + the 7:12 AM moment render in morning-mist daylight. The theme is user-chosen or OS-driven; the Garden's dawn/dusk follows the hour, not the theme.

**Global light rules for these screens:**
- Cards go white on `#f3f7f2` mist; depth from a soft leaf-tinted shadow, never a dark gradient. Ink is `#0d1f14` / `#22402f` — never pure black.
- `✦ NEEDS A LOOK` eyebrows render in sunlit amber `#a16207`; attention-card rims soften to 40%-alpha warm; glow whispers in daylight.
- **The night is always dark.** The 9 PM closeout (§3.5) may keep a warm dusk-amber wash at low opacity over mist (evening is warm, not dark) — but the 11 PM Garden is the dark night palette in both themes. Rest is a color.
- Sheets (approval, Emergency, module detail) render white with the same scrim rule (`bg-[#0d1f14]/40`).

**Per screen:**
- **`/school` (§1):** class cards white; progress-bar tracks `#eef4ee`; band fills deepen one step (leaf-600, sunlight→`#b45309`, gold→`#b45309`, ember→`#c2410c`) — the 69 stays warm and rallying. The hero ring's band gradient uses the same deepened hues.
- **`/school/:classId` (§2):** hero number + letter in deepened band color; checkboxes `leaf-600`; the check-in input white with `#eef4ee` fill; teacher-thread quote block keeps its dew tint softened.
- **W9 briefing (§3):** attention cards white with the softened warm rim; "Not now" ghost text `#55705f` at its 44px target; the water-tap end-cap keeps its dapple sweep (label stays `text-canopy-950` on the leaf→sunlight gradient — the button is the one place the dark ink is intentional). The 9 PM closeout in light theme: mist page, warm amber wash on the garden scene, struck-through completions in `#55705f`.
- **`/mail` (§4):** the snap card is white with a soft leaf rim (the neon points at the one real action); photo thumbnails unchanged; OCR-failure manual card white, calm — never rose.
- **`/shopping` (§5):** white list surface; who-added tags keep band tints at readable depth; the cycle-memory line in `#55705f`.
- **`/health` (§6):** the pulse card white — *"Mostly steady 🌱"* reads the same; meds/visit/shots cards white with leaf rims on the one action each.
- **`/school/calendar` (§7):** date chips in soft leaf tint (`#e4ede4` bg, `#0d1f14` text); lead-time prep lines in body ink.
- **`/money/credit` seedling (§8):** the halo tint softens to low-opacity gold on white; the "CONNECT YOUR CARDS" card keeps the leaf rim as its one neon moment; the honest data line (`bark` secondary) stays plain-spoken.
- **7:12 AM moment (§9):** the approval sheet is white; the "What happens next" consequence list in body ink; the CTA keeps the dapple sweep. The toast stays `bg-canopy-800`→ in light theme, `#0d1f14` with dew text — the toast is a night-colored pebble on a morning path, and that's fine.

*End of UI-V1-MODULES.md — the seven V1 screens, the W24 seedling, and the 7:12 AM moment. Engineering builds to this spec; the founder judges it by the 10 PM exhale.*
