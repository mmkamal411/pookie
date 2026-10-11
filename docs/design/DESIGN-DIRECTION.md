# Pookie — Design Direction Brief
**The single source of truth every designer on this team works from.**
Written by the Design Lead · 2026-10-11 · Final design authority before founder review.

> "If the app does not look good and intuitive, it is not useful." — Founder directive
> True goal: the parent FEELS life is under control — *mission control that feels like a garden.*

---

## 0. The one-paragraph creed

Pookie is an angel made of light, and the app is the garden she watches over. Every screen answers one question: **"Is my child okay, and what is growing?"** The parent arrives worried and leaves calm — worried when they open, calmer when they close, a little addicted to the feeling of things getting better. We never show a dashboard. We show a *living thing* — sunlight, leaves, roots, seasons — where the parent's care visibly causes growth. Technology serves nature's metaphor, never the reverse. If a design feels like software, it has failed.

---

## 1. Design principles (7)

Each principle is a contract. The "we always" is the floor; the "we never" is the betrayal. Any design violating a "never" is KILL-worthy.

### 1. Garden first, data second
- **We always** frame every number as a living state: a grade is a plant's health, a streak is roots deepening, a missed habit is a drooping leaf. Context is the garden; data feeds it.
- **We never** show a bare metric without its story: no red "69.5" without "3 missing assignments are the cause — here's the order to finish them." A naked number is shame; a number with a path is hope.

### 2. Mission, never judgment
- **We always** lead with the gap and the mission ("Geometry is 21 points from thriving — mission: the Unit 2 study guide"), use shame-free copy ("needs water" not "failing"), and present the next three actions as an invitation, never an indictment.
- **We never** label a child, a parent, or a state with judgmental language — no "at-risk," "lazy," "behind," "failing," no red alarm styling for a human's effort. Red is for the *task's* urgency, never the *child's* worth.

### 3. Divine light, never harsh neon
- **We always** use soft, diffused glows — sunlight through leaves, candle-in-fog, halo around what matters. Greens everywhere; sunlight-gold for warmth; halo-white for the sacred (Pookie herself, milestones, protection).
- **We never** use hard neon, strobing, flat-outlined "cyberpunk" UI, or pure-white blasting backgrounds. If a glow hurts to look at, it's not Pookie. If it could belong in a sci-fi HUD, kill it.

### 4. Nurtured calm, not control-room anxiety
- **We always** make the parent feel *held*: whitespace like clearing-in-a-forest, one focal moment per screen, Pookie's presence as a quiet guardian (the orb, a wisp of light, a gentle line of guidance). The loudest thing on screen should be calm itself.
- **We never** build a control room: no dense grids of widgets, no seven-tab toolbar cramming every module at once, no competing badges, banners, and counters screaming for attention. Density is the old world; calm is the product.

### 5. Growth you can see — every action leaves a trace
- **We always** make effort *visible*: checking in makes something bloom, finishing an assignment adds a leaf, a week of sleep-logging deepens roots. The feedback loop is immediate, delightful, and cumulative — progress dopamine is designed, not accidental.
- **We never** let effort vanish into a checkbox. A completed action that produces no visible response in the garden is a broken promise to the child doing the work.

### 6. The app notices before you do — gently
- **We always** surface what matters at the right level: the child's nudge is kind and actionable, the parent's alert is calm and complete (cause + next step + why now). The quiet parent who opens at 10 PM should feel *caught up*, not ambushed.
- **We never** nag. No notification storms, no re-firing on the same cause, no urgency theater ("URGENT!!!" for a homework reminder), no guilt-trips ("You've been ignoring Dawson's grades"). A mother who pings about everything gets tuned out — and so do we.

### 7. The child is a person, not a project
- **We always** honor the trust contracts: the child sees the same map the parent sees, raw mood/health detail stays the child's, the teen's private spaces are visibly private (the UI itself communicates "this is yours"). Protection is visible: "Pookie is watching over this."
- **We never** build surveillance features disguised as care: no interrogation flows, no secret tripwires, no cross-child comparisons ("your sibling got more"), no AI behavior reports about the teen. Care is legible; surveillance is betrayal.

---

## 2. Emotional tone — how the parent should FEEL, screen by screen

| Screen / moment | The feeling |
|---|---|
| **First open (home)** | *Relief.* "Everything is in one place, and nothing is on fire." The garden is alive, the light is soft, one or two things need attention — the rest is growing. She exhales. |
| **Morning glance** | *Oriented.* "I know what today holds." Today's missions, the one thing that matters most, nothing buried. Thirty seconds, done. |
| **Child's class page** | *Hopeful, not panicked.* The gap is framed as a mission with a path; the number sits beside its story; three ranked next steps. "We can do this" replaces "oh no." |
| **Proactive nudge/alert** | *Watched-over.* "Pookie noticed before I did." The alert arrives with its solution already drafted — the parent approves, doesn't research. She feels like she has a second set of eyes, not a second job. |
| **Health view** | *Reassured vigilance.* Trends, not alarms; baselines, not averages; "worth mentioning at the checkup," never a diagnosis. The numbers feel like a nurse's gentle hand, not a hospital chart. |
| **Weekly digest** | *Pride.* "Look how far we grew." Wins first, missions next, effort visible everywhere. The garden literally looks greener than last week — because it is. |
| **Teen's own view** | *Owned, never judged.* "This is mine, and it's on my side." Their space feels like a treehouse — same garden, their branch. Private things are visibly private. |
| **Something goes wrong (sync failure, missing data)** | *Held, not broken.* Honest, calm, no error-red panic: "Still gathering — your garden is safe." The app degrades like weather passing, not like a system failing. |
| **Empty states** | *Invitation, not emptiness.* "Plant your first seed" beats "No data." Every blank screen is the start of a ritual. |

---

## 3. Motion & animation philosophy

**The rule:** *Living things move; interfaces transition.* Motion must feel organic — grown, breathed, swayed — never mechanical.

### What moves (ambient life)
- **The garden breathes:** slow, barely-perceptible scale/glow cycles on the Pookie orb and garden centerpieces (the existing `breathe` 5s token is the canonical rhythm). This never stops and never demands attention — like leaves moving at the edge of vision.
- **Light dapples:** slow drifting light gradients across hero surfaces (`dapple` 9s), suggesting sun through canopy. Sublime, not sparkly-once.
- **Sparkles ascend:** tiny light motes rise from completed actions and milestone moments (`ascend` 8s), like fireflies or dust in a sunbeam — the visual signature of "growth you caused." Reserved for *consequence*, not decoration.

### What moves (interaction)
- **Bloom on entry:** new content blooms in — a gentle rise-and-unfurl (`bloom` 0.6s, `rise` 0.5s), staggered per card so the screen *grows* like shoots after rain. Nothing slides in from off-screen like a presentation deck.
- **Completion blooms:** finishing a check-in, an assignment, a habit — the action visibly transforms: leaf unfurls, petal added, glow intensifies. The reward animation IS the product's dopamine loop. It must feel good every single time — especially the 500th time.
- **Guided reveals:** expanding a class card, opening a mission detail — the expansion grows downward from the tap point like a plant responding to touch. Content unfolds; it doesn't pop.

### What never moves
- **Body copy, numbers, labels:** text does not bounce, wobble, typewriter-in, or count-up aggressively. (A grade counting up *once* on first sight of a milestone is allowed; habitual number-ticker animations are banned.)
- **Navigation and chrome:** tabs, headers, buttons stay still. Stability in the frame lets life happen inside it.
- **Alerts:** urgent things do not flash, pulse red, or shake. Urgency is conveyed by *presence and copy*, never by agitation. A flashing app is an anxious app, and we are the opposite of anxious.
- **No autoplay loops that compete:** one ambient motion per viewport. If the orb breathes, the background doesn't sway. Calm is curated; competing motion is noise.

### Motion discipline
- Every animation serves feeling: *breathing = alive, blooming = arrival, ascending sparkles = your doing.* If a designer can't name the feeling, the motion doesn't ship.
- Respect `prefers-reduced-motion`: ambient motion goes still; transitions become fades. Calm must be accessible calm.
- Mobile-first: all ambient animation must be GPU-cheap (transform/opacity only) and pause off-screen. A garden that drains the battery is a dead garden.

---

## 4. The garden metaphor — visual grammar

This is the shared vocabulary. Every designer uses the same grammar so the metaphor compounds instead of decorates.

| Element | Meaning | Visual grammar |
|---|---|---|
| **Pookie (the orb)** | The guardian angel, divine light | A luminous orb — warm white-gold core, soft green halo. Breathes slowly. Never speaks harshly; her guidance appears as gentle light-accented cards ("Pookie noticed…"). She is never a chatbot avatar with a face — she is *light itself*. |
| **The home garden** | The family's overall state | The home screen IS a garden scene: each child is a tree/plant cluster; each module is a bed or grove. Health of the garden = health of the family. No two visits look identical — seasons, growth, light shift with real state. |
| **A child** | A young tree | Grows over time. Fuller canopy = thriving. Drooping leaves = needs attention (always paired with the mission that fixes it). Each child has a distinct silhouette/color accent within the green family — never compared side by side. |
| **A class / subject** | A branch or plant in the grove | Grades map to vitality: ≥90 full bloom, 80s lush, 70s needs water, below needs care. A missing assignment = a dry patch with a droplet icon inviting action, never a red X. |
| **An assignment / task** | A seed or bud | Planted when assigned, blooms when done. Overdue seeds glow softly gold (invitation) not red (alarm). Completed seeds become petals/flowers in the weekly bouquet. |
| **A streak / habit** | Roots | The deeper the streak, the richer the root visualization. Roots are shown on progress screens — "7 days of check-ins — roots deepening." |
| **A completed week** | A bouquet / harvest | The weekly digest renders as gathered flowers — each bloom is a win. "This week's harvest" is the pride moment. |
| **Time** | Seasons and daylight | Morning = soft dawn light on the garden; evening = warm dusk glow; exam week = a gentle autumn tint (serious, not scary). The app's light follows the user's day — always calm, always natural. |
| **Growth you caused** | Sparkles + new growth | The signature moment: you act → sparkles ascend → a leaf unfurls / petal added / root deepens. This is the dopamine loop. It must be *immediate* (action → visible bloom in the same interaction) and *cumulative* (the garden is visibly different after a week of care). |
| **The unseen / pending** | Mist and buds | Data still syncing = soft mist over that bed ("gathering sunlight"), never a spinner of anxiety. Upcoming = closed buds with countdowns ("blooms in 3 days — the Unit 4 test"). |
| **Protection / safety** | A halo or canopy arc | SOS, geofence safe-zones, privacy boundaries render as arcs of protective light over the child. "Watched over with love" made visible — never a radar, never a fence with barbed wire. |
| **The parent's worry** | Clouds passing | Concerns exist (a slipping grade casts a soft shadow) but shadows *move* — they are weather, not climate. The design language must always imply: this will pass, and here is the path. |

**Grammar rules:**
- Metaphor is *state-driven*, never decorative: a blooming class at 69% is a lie the founder will see through instantly. The garden must always tell the truth — softly, but truthfully.
- One metaphor per screen: the home screen is the garden; drill-ins are groves and branches. Don't stack tree + roots + bouquet + weather on one card.
- The metaphor must survive bad news: the garden at its worst still looks like a garden that needs tending, never a wasteland. Despair is not in the vocabulary.

---

## 5. Anti-patterns — what betrays the language

These are KILL criteria. If a concept exhibits any of these, it does not proceed to founder review.

1. **The control-room dashboard.** Dense widget grids, stat tiles, KPI cards, competing charts. The app is not Bloomberg for children. *Explicit example — the old Dawson's Dashboard toolbar (Academics | Learn | Plan | Pookie | Track | Grow | Menu): seven equal-weight tabs cramming every module into one bar. This is exactly what NOT to copy. Navigation must be garden-path wayfinding — a few luminous paths, not a filing cabinet. Modules are groves you walk to, not tabs you manage.*
2. **Judgment styling.** Red numbers for effort, "AT RISK" badges, warning triangles on a child's name, leaderboard-style comparisons, shame-colored anything attached to a human.
3. **Harsh neon / cyberpunk.** Hard-edged glows, pure saturated neon on black, scanlines, terminal aesthetics, "hacker" signifiers. Pookie is sunlight and candlelight, not a server room.
4. **Tech-dashboard metaphors.** Gears, dials, gauges, progress bars as the primary visual, "system status" language, server-style uptime thinking applied to children.
5. **Nag UX.** Badge-count arms races, streak-threat copy ("Don't break your streak!"), guilt notifications, re-firing alerts, urgency inflation.
6. **Surveillance signifiers.** Maps with breadcrumb trails, "last seen" timestamps as headlines, read receipts on the teen, anything that reads as monitoring rather than watching-over. The teen must feel *guarded*, never *watched*.
7. **Dead interactions.** Buttons that complete with no response, checkboxes that vanish effort, forms that submit into silence. Every action must leave a visible trace in the garden.
8. **Generic SaaS chrome.** Intercom-style chat bubbles as the primary AI surface, cookie-cutter settings pages, enterprise table views for family data. If it could be a CRM, it's wrong.
9. **Light-mode afterthought / contrast failures.** No light-on-white, no washed-out mint text on pale backgrounds. Both themes (deep forest dark + morning-mist light) must be designed, not derived.
10. **Motion that agitates.** Flashing, shaking, bouncing alerts, spinning loaders as the main feedback, competing ambient loops. Motion is breath and bloom, never alarm.

---

## 6. Screen-level direction (the key surfaces)

- **Home (the garden):** one screen, one feeling — relief. The garden scene with per-child trees, today's 1–3 missions glowing softly, Pookie's orb present. No scrolling past the fold to understand the day. Mobile-first: the whole day in one thumb's reach.
- **Child view (the tree):** the child's grove — classes as branches, health as roots, social as blossoms. Mission-first ordering: what needs tending floats to the light. The 90-gap leads; the raw grade follows.
- **Class page (the branch):** per the founder's class-page rules — gap-to-90 as mission framing, numeric + letter side by side, color-coded sections, top-3 ranked actions with checkboxes, daily check-in + uploads below the hero. The branch shows exactly what's wilting and the water is right there.
- **Pookie chat:** not a chat window — a clearing. Pookie's light, conversation that feels like talking to a warm presence, suggestions that bloom into actions. The Muse toggle lives here as a change of *light* (warmer vs. clearer), not a settings switch.
- **Weekly digest (the harvest):** the pride screen. Bouquet of wins, missions for next week, the garden visibly greener. This is the retention engine — design it like a gift, not a report.
- **Alerts/nudges:** arrive as Pookie's gentle notes — cause, path, and one-tap action. Never a push notification that reads like a bill collector.

---

## 7. Review gate — how the Design Lead judges work

Every wave (IA concepts, visual designs, system spec) gets one of three verdicts:

- **APPROVED** — meets the bar, proceed.
- **APPROVED WITH NOTES** — proceeds, but the notes are mandatory fixes, not suggestions.
- **KILL** — does not meet the bar. Kill early, kill kindly, kill completely. The founder will notice mediocrity; the gate exists so he never has to.

**The bar, in one test:** *Show it to a tired parent at 10 PM. Do they exhale?* If yes — the garden is working. If they squint, scroll anxiously, or feel judged — kill it.

---

## 8. Living document

This brief evolves with founder feedback. Changes are logged in BUILD-LOG.md. The design language rules (green, subtle neon, nature + love, divine light) are standing founder directives — they do not change without his explicit word. Everything else in this brief is the Design Lead's interpretation, and the founder overrules it any time he speaks.
