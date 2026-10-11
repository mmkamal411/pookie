# UX Habit Design — Healthy Addiction for Pookie
**Author:** UX Researcher B (Habit & Emotional Design) · **Date:** 2026-10-11
**Status:** Design spec — read alongside UX-MENTAL-MODELS.md (Researcher A), DESIGN-DIRECTION.md, DESIGN-SYSTEM.md
**Founder directive:** "Users need to be addicted to using this app." — designed as HEALTHY addiction only: pride and progress, never guilt or fear. Shame-free is a hard constraint from GUIDANCE-FRAMEWORK.md (shame-free language, celebration rules, encouragement-without-nagging).

---

## 0. The thesis, in one paragraph

A parent's attention is the scarcest resource in the product. The habit we are building is not "learn daily" (Duolingo) or "move daily" (Apple Watch) — it is **"check that your family is okay, and feel like you're winning at keeping them that way."** The trigger is worry; the action is a 60-second ritual; the reward is *evidence of progress the parent caused*; the investment is the garden that grows from that progress. The feeling we're engineering: *"I can't not check Pookie — it's how I know my family's okay."*

---

## 1. Reference teardowns — 4 habit machines, loop by loop

Each teardown uses the trigger → action → reward → investment frame. "Transfers" = adopt (adapted). "Doesn't transfer" = reject, with reasons. The core discriminator: **a parent is not a language learner.** The learner's reward is *their own* skill; the parent's reward is *someone else's* thriving caused by their care. That changes everything.

### 1.1 Duolingo — the streak machine

**The loops:**
- **Daily streak (fire icon):** Trigger = push notification at personalized time ("Time to practice!"). Action = one 3-minute lesson. Reward = XP fanfare + streak count increments + confetti animation. Investment = the streak number itself (sunk-cost endowment grows daily) + leagues + friend streaks.
- **Streak-saver notification (the growth team's first big win):** late-evening push *only* to users with a streak at risk ("You're about to lose your 47-day streak!"). Dramatically cuts next-day drop-off; users past ~10 days rarely leave.
- **XP + progress bar (endowed progress / goal-gradient):** mid-lesson progress bar makes quitting mid-way feel wasteful; XP bar makes the next level feel one session away.
- **Leagues (social competition):** weekly opt-out leaderboard — +17% learning time, but also the app's anxiety machine.
- **Streak freeze (monetized loss-aversion):** buy a pass to skip a day without losing the streak — the product literally monetizes fear of loss.
- **Variable rewards:** chests, gems, surprise boosts.

**The dark side (documented):** Duolingo scored highest for dark patterns among education apps in a 2024 IEEE study; the guilt-mascot ("Duo is crying because you skipped") is emotional manipulation; streak anxiety is real — users report the number matters more than the learning.

| Transfers to Pookie | Rejected for Pookie (with reason) |
|---|---|
| Evening "at-risk" nudge — but reframed as warm invitation, never loss-fear: "Your garden's evening check-in is waiting 🌙" not "you're about to lose everything" | **Streak-loss fear** — REJECTED. Parenting is already guilt-saturated. A parent who misses a day must feel *fine*, not punished. Our streak counts *visits*, never penalizes absence |
| Endowed progress (mid-action progress bar — goal gradient) on multi-step actions like approving a teacher-email chain | **Guilt mascot / emotional blackmail** — REJECTED. No "Pookie is sad you didn't visit." Pookie is an angel; angels don't guilt-trip |
| Named, finishable daily quest ("3 things for today") sized to one session | **Leagues / leaderboards** — REJECTED absolutely. Never rank children against each other, friends, or anyone. Guidance framework bans peer comparison; multi-child equity (W10) forbids it |
| Variable delight (surprise "blooms" from overnight syncs) | **Streak freeze as monetized loss-aversion** — REJECTED. Grace is free here (see §3: "resting, not wilting") |

### 1.2 Apple Watch — the ambient ring machine

**The loops:**
- **Rings on the watch face (ambient, glanceable progress):** Move / Exercise / Stand rings fill through the day. Trigger = hourly stand reminders + progress nudges ("you're 50 cal from closing Move"). Action = movement. Reward = ring-close sparkler animation + "Perfect Week" awards + longest-streak badges. Investment = awards collection, move-streak, goal tuning, sharing/competitions with friends.
- **Near-miss nudges:** the single highest-converting notification in the system — "almost there" converts better than any celebration.
- **The watchOS 11 correction:** after a decade of rigidity, Apple added ring *pausing* (sick/injury/vacation) and per-day-of-week goals. Lesson: rigidity broke trust; compassionate flexibility restored it.

| Transfers to Pookie | Rejected for Pookie (with reason) |
|---|---|
| **At-a-glance ambient progress** — the garden IS the watch face: one glance says "family okay" | Rigid daily perfectionism — REJECTED. A family is not a fitness plan; bad weeks happen |
| **Near-miss nudges** — "1 task left to clear today's board" / "Geometry is 3 points from 80" | Competition with friends — REJECTED. Family data is private, never social |
| **Graceful pause** — watchOS 11's lesson codified: life happens, and the product must say so explicitly | Self-worth tied to rings — REJECTED. A quiet day must feel like *peace*, not failure |

### 1.3 Finch — the emotional-investment machine

**The loops:**
- **Virtual birb:** Trigger = gentle daily reminders. Action = tiny self-care tasks + reflection. Reward = bird gains energy → goes on an adventure → returns ~6 hours later with a discovery → bird grows, unlocks accessories. Investment = naming, dressing, furnishing the bird's house, micropets — deep emotional ownership ("my birb").
- **The psychology:** caring for the bird externalizes self-care; the "adventure" is *delayed variable reward* done kindly; the whole loop runs on warmth, never pressure.
- **Habit transfer design:** the app is explicitly "training wheels" — real habits are the goal, the app is the scaffold.

| Transfers to Pookie | Rejected for Pookie (with reason) |
|---|---|
| **Emotional ownership of a living thing that grows from your care** — the garden is Finch's loop, evolved: your tending → visible life | Purely self-care framing — Pookie's care is *outward* (toward the family); the emotional payoff is pride in others, not self-soothing |
| **Delayed surprise** (bird returns with a discovery) → morning "bloom reveals" from overnight syncs | Linear pet growth — our garden is multi-plant (per child), multi-season, tied to *real-world* outcomes, not app taps |
| **Warmth-only motivation** — no loss, no decay, no guilt; the bird is never sad at you | — |

### 1.4 GitHub contribution graph — the compounding-artifact machine

**The loops:**
- **Green squares:** Trigger = professional habit (push code). Action = commits. Reward = darker squares, hover tooltips, streak counters (removed in 2016 — they caused stress; the graph stayed). Investment = public profile identity: "I'm someone who builds."
- **The psychology:** no notifications, no mascot, no pressure. The graph turns the *past* into a compounding story. You return to *admire* the accumulation, not to avoid punishment. The streak-removal in 2016 is the lesson: GitHub learned streaks broke people and kept the ambient artifact.

| Transfers to Pookie | Rejected for Pookie (with reason) |
|---|---|
| **The compounding artifact** — a "garden calendar" / growth-rings view that turns months of parenting into a visible legacy | Public accountability — REJECTED. Family data is private; the garden is for the parent's eyes only |
| **Ambient, retrospective, zero-pressure** — the past-as-story, not the future-as-debt | Commit-as-unit — a parent's "units" are messy real-world outcomes (a signed permission slip, a turned-in assignment), not atomic commits. Our artifact must celebrate *outcomes*, not activity counts |
| — | Streak counters as identity — REJECTED. "I'm a 500-day parent" is pressure, not pride |

### 1.5 Why a parent is not a learner — the five parent-specific truths

1. **Second-order rewards.** The dopamine must come from *someone else's* win that the parent caused ("I sent that email → the teacher replied → the grade moved"). Design the causality chain, not the raw number.
2. **Worry is the trigger; evidence is the reward.** Parents open from anxiety. The ritual must convert "I wonder if everything's okay" into "here's proof it's okay." Every session must end calmer than it started.
3. **60 seconds, twice a day.** Attention is the scarcest input. Every action must be one-tap and finishable. If it takes longer than a minute, it isn't the ritual — it's a task for later.
4. **Guilt is already everywhere in parenting.** The app must be a guilt-free zone or it gets deleted. Duolingo's playbook (loss-aversion, guilt mascot) is *poison* here. Our addiction vector is pride, warmth, and relief.
5. **Quiet days must be the best days.** Most days, nothing dramatic happens. The product must make "nothing happened" feel like a *win* ("all 12 eyes watching, nothing needs you — that's the good stuff"), not an empty session.

---

## 2. The daily ritual — the 60-second morning + the evening close

### 2.1 Design principles for both sessions

- **Fixed time anchors:** morning session fires with the parent's day (default 7:00 AM, user-set); evening close at 8:30 PM. Consistency builds the cue.
- **Exactly 4 screens.** No scrolling feeds, no dashboards-of-everything. A beginning, a middle, an end — every visit ends with "I handled something."
- **One headline per child, max.** Never a wall of data. The engine picks the single most meaningful thing per child; the rest waits in the garden.
- **The session always ends with a calm sentence.** "The family's okay." is the product's signature exit.

### 2.2 Morning session — "The Garden Dawn" (60 seconds)

*Trigger:* 7:00 AM push — warm, never urgent: "🌅 Good morning. The garden grew overnight — come see." (Unless a safety/urgent item exists — then the push names it plainly, per the notification philosophy §4.)

**Screen 1 — The Bloom Reveal (0–10s): "While you slept…"**
The garden at dawn, soft green-and-gold light (divine-light language per design direction). One bloom animation per child with a *growth story*: "🌸 Geometry grew +2.5 overnight — Dawson turned in the missing study guide." If nothing changed: the garden glows quietly — "A quiet night. Everything held." The parent sees immediately: my care → growth. This is Finch's adventure-return + Duolingo's reward fanfare, done shame-free.

**Screen 2 — Today's Three (10–30s): "Three things. That's the whole day."**
Exactly three prioritized, one-tap actions (engine-ranked by leverage × urgency, max one per child; guidance WS1 rule: one nudge, one cause, one action). Each is a named, finishable step:
- "✅ Approve the Thomason reply — one tap sends it" (teacher comms approval)
- "📝 Sign the field-trip slip — photo-ready" (school minutiae)
- "💊 Refill check: inhaler at 12 puffs" (health)
Tapping one opens a bottom-sheet with the full context; confirming grows a leaf on that child's plant *immediately* — the reward is instant and visible. Skipping is always one tap: "not today" — zero guilt copy, the item simply re-queues. Duolingo's endowed progress lives here: a thin progress shimmer under each action ("2 of 3 handled today").

**Screen 3 — Quiet Wins (30–45s): "Look what happened."**
Overnight positive events, each acknowledgeable with a single heart-tap (the investment loop — acknowledgment is the parent's emotional signature on the day):
- "Dawson turned in the missing assignment 🎉"
- "Maya's check-in streak: 5 days"
- "Electric bill captured from your photo — reminder set for the 28th"
Acknowledging isn't required; it's offered. Each tap releases a small sparkle over the garden (Apple Watch ring-close energy). This screen exists because *wins go unnoticed in real life* — the app makes them visible, and visibility is the dopamine.

**Screen 4 — Water the Garden (45–60s): "You're here. That's the ritual."**
One tap: "💧 Water the garden." The plants shimmer; the day is stamped on the garden calendar; the session closes with the signature line: **"All quiet. 2 things handled, 1 for later. The family's okay."** (Numbers adapt.) This is GitHub's commit moment — the parent's daily contribution to the family artifact. If the parent has 5 more minutes, a "walk the garden" option opens the full app. Otherwise: done. Calmer than they started.

*Fallback — the Quiet Morning:* if literally nothing needs attention, screens 2–3 collapse into one: "Nothing needs you today. The engine is watching 23 things — grades, health, deadlines, the mail. Go enjoy your coffee." The parent still gets their bloom check and their water tap. A quiet morning is a *good* morning — the trust dividend.

### 2.3 Evening session — "The Sunset Review" (45–60 seconds)

*Trigger:* 8:30 PM push — reflective, low-energy: "🌙 The day's done. Here's how it landed." (Quieter than morning — no urgency in the copy, ever.)

**Screen 1 — What changed today (0–15s): "Today in the family."**
A short, warm timeline — 3–5 items max, outcomes only: "Geometry quiz graded: 78 (+8 from the last one) — the comeback pattern is working." / "You approved the Dunham email — sent at 9:14 AM ✓" / "Dawson checked in: 'rough day, but okay.'" (Aggregates only for child-private data, per the privacy contract.) Bad news follows the bad-news protocol (cause → number → next action), never a raw red number.

**Screen 2 — Open loops, closed (15–35s): "Nothing left hanging."**
The completion loop that lets the parent sleep: every loop the parent touched today shows its resolved state ("permission slip signed ✓, reminder set ✓"), and anything still open gets its *tomorrow* pre-seeded ("the refill reminder will fire at 8 AM — you don't have to remember"). The explicit promise: **you can stop holding this in your head now.** This is the app's deepest psychological value — externalized maternal memory, handed back as peace.

**Screen 3 — Tomorrow's three, previewed (35–50s): "Tomorrow is already handled."**
The engine's draft of tomorrow's three actions, shown early so the parent's subconscious can relax: "Tomorrow: the Unit 4 test plan is ready if you want to glance." Nothing to do tonight — just previewed. (Duolingo's lesson here: tomorrow's session starts *today*, friction-free.)

**Screen 4 — The gratitude close (50–60s): "You did this."**
The garden at dusk. A single sentence from Pookie, specific and effort-focused (guidance celebration rules — never generic): "You caught the missing assignment Tuesday, sent the email Wednesday, and Geometry moved 8 points. That's not luck — that's you." Then the signature exit: **"Sleep easy. The family's okay. I'll keep watch."** The day is stamped; the garden calendar gains another day. The parent closes the app feeling like a good parent — because the app just showed them the evidence.

---

## 3. The garden — habit mechanics

### 3.1 What grows

**One plant per child** in a shared family garden. The plant is the child's living portrait of progress:
- **New leaves** grow from *parent tending actions* (approving a draft, clearing a task, signing a slip, acknowledging a win).
- **Blossoms** grow from *real-world outcomes* (grade up, assignment turned in, health task completed, milestone hit) — these are the outcomes the parent's tending caused.
- **Growth rings** (the tree-trunk metaphor, Apple Watch rings × GitHub graph): each month of active care adds a visible ring to the plant's base — the compounding artifact, the "this year in our family" legacy view.
- **Seasons** follow the school semester (Fall / Spring): each season ends with a **Season Recap** artifact — "Fall 2026: 14 blossoms, 3 comebacks, 1 mission complete (Geometry → 90)" — designed to be screenshotted and kept.

Species and colors differ per child (oak for one, cherry blossom for another — parent-chosen at onboarding). **Never ranked, never compared** — different plants, different soils, no "who's blooming more" (W10 equity rule, guidance peer-comparison ban).

### 3.2 What tending looks like

Tending is *only* the ritual actions — nothing extra is ever demanded:
- Morning: view blooms → handle the three → acknowledge wins → water (one tap).
- Evening: review the day → close loops → preview tomorrow.
- Anytime: the one-tap actions from notifications (approve, sign, confirm).

There is **no watering meter, no thirst mechanic, no "your plant needs you."** Tending is the ritual; the ritual is tending. Finch's lesson: the care loop must feel like love, never obligation.

### 3.3 How the parent SEES care turning into growth — the causality chain

This is the product's core dopamine circuit, and it must be *explicit*. Every blossom carries its story — tapping it reveals the chain:
> 🌸 **"Geometry blossom — Oct 11"**
> *You approved the Thomason email (Oct 8) → she offered the study-guide redo → Dawson turned it in (Oct 10) → grade moved 69.5 → 72 (+2.5)*
> "You did this."

The parent doesn't just see growth — they see **their fingerprints on it**. This is the second-order reward (§1.5, truth #1) made visible. The weekly digest and Season Recap are built from these chains; the recap is the parent's proudest artifact.

### 3.4 Blooming, never decay — the anti-guilt architecture

The hard rule, stated as engineering requirements:

1. **No wilting. No withering. No brown leaves. Ever.** A plant that isn't tended doesn't decay — it **rests under moonlight** (a soft, beautiful dormant state: fireflies, still water). Copy: "Resting. It'll be here when you are." Inactivity is *peace*, not failure.
2. **Absence is never punished.** Missed days leave no mark — the garden calendar simply shows fewer stamped days, with no red, no broken streaks, no "you lost…" copy. WatchOS-11's lesson codified: grace is free and unlimited.
3. **Streaks count visits, never demand them.** "You've visited 12 mornings this month" (pride) — never "3-day streak at risk!" (fear). There is no streak counter to break, because a broken parenting streak is a guilt weapon we refuse to build.
4. **Negative events never touch the garden.** A grade drop, a missed assignment, a bad check-in: the garden does not shrink, darken, or react. Problems live in the action lists with mission framing ("the gap to 90"); the garden is the *safe room* — it only ever reflects growth and rest.
5. **The copy-lint** (guidance Part 11, engineering dependency #1) must include garden-specific bans: *wilt, wither, dying, neglected, "your plant needs you," "X days since you visited," sad-Pookie imagery.*

### 3.5 Garden states — the full visual vocabulary

| State | Visual | Meaning | Copy |
|---|---|---|---|
| Dawn bloom | New blossom unfurling, gold-green light | Overnight growth from outcomes | "While you slept, Geometry grew." |
| Tending shimmer | Leaves brighten on tap | Parent handled an action | "Handled ✓" |
| Moonlit rest | Soft blue-silver, fireflies | No recent visits — peaceful, not punishing | "Resting. It'll be here when you are." |
| Growth ring | New ring etched at the plant base | A month of care completed | "October's ring is set." |
| Season turn | Petals fall gently, new buds | Semester boundary | "Fall closes. Look what you grew." |
| Comeback bloom | Rare golden blossom | A recovery milestone (e.g., +10 pts in a class) | "The comeback bloom — Geometry 69 → 80." |

---

## 4. Notification philosophy

### 4.1 The doctrine

- **Notifications are the product's heartbeat, not its megaphone.** Every notification must *earn* the morning open. The test: "Would a good mother want to know this right now?" If yes, send. If it's merely interesting, it waits for the digest.
- **Caps are hard constraints** (vision §3.1: max 1 parent alert/day/child; no re-fire on same cause within 7 days; exam-week mode halves volume). **Quiet hours 10 PM–6 AM** hold everything except safety tripwires.
- **Every notification is an invitation with a named, finishable step** (guidance WS1). No notification ends in anxiety without an action.
- **The parent never sees the child's raw nudge stream** — aggregates only. The child never discovers the parent's worry list.

### 4.2 The 5 notification types that earn the morning open

**1. The Win** — *a good thing happened; come feel proud.*
> 🎉 "Dawson turned in the missing study guide — Geometry +2.5. Tap to see the bloom."
Cause: child/worker-completed action. Reward: instant pride + garden bloom waiting. This is the #1 retention notification — it makes the parent feel like the team is winning.

**2. The Heads-Up** — *something timely needs your awareness, with the plan attached.*
> 📌 "Unit 4 test Thursday — Geometry is the weak class. The study plan is ready; nothing needed from you tonight."
Cause: proactive-engine trigger (test ≤7 days in weak class). Note the closer: "nothing needed from you tonight" — the notification *reduces* worry even as it informs. Cause + plan, never cause alone.

**3. The Approval** — *a 30-second action only you can do.*
> ✉️ "Ms. Thomason replied — the study-guide redo is on the table. Draft response ready: one tap to send."
Cause: teacher reply / draft ready. This is the parent's superpower moment: one tap, real-world consequence, leaf grows immediately. The approval tap is a designed "winning" moment (§5).

**4. The Quiet Confirmation** — *nothing happened, and that's the news.*
> 🌿 "Morning check: no grade changes, no missing work, bills on track. All 12 eyes watching — nothing needs you."
Cause: the morning digest on a quiet day. This is the anti-worry notification and the trust dividend: the parent learns that *no news from Pookie means good news*, which is exactly why they'll open it every morning. (Most days should be this.)

**5. The Milestone** — *a threshold crossed; pride, archived.*
> 🏵️ "Geometry hit 80 — up from 69.5 in three weeks. The comeback is real. Season recap updated."
Cause: milestone thresholds (class crosses 80/85/90, streak of check-ins, health goal met). Specific numbers, effort-focused, tied to the garden artifact. Designed to be screenshotted.

### 4.3 The anti-list — what NEVER notifies

1. **A grade drop with no cause and no action attached.** "Geometry down 4 points" alone is anxiety spam. It notifies only as: cause + path-to-90 step ("down 4 — the two missing assignments look like the cause; here's the order").
2. **Guilt or absence-shaming.** Never: "You haven't opened Pookie in 3 days," "Your garden misses you," "Duo-style" sadness. Banned by the copy-lint.
3. **The child's raw stream.** Mood text, tutor-chat content, nudge history — aggregates only, per the privacy contract. (Safety tripwire alerts are the single exception, and they bypass quiet hours by design.)
4. **Nudges about nudges.** Never remind the parent about an unacknowledged notification. One send, then it waits in the garden.
5. **Marketing, upsells, and engagement bait.** No "new feature!" pushes, no "you're in the top 10% of parents," no re-engagement drip campaigns.
6. **Comparisons.** Never "other families…," never sibling-vs-sibling, never "most 15-year-olds…"
7. **Repeat fires.** Same cause within 7 days = silence. Completing an action suppresses its trigger for 14 days.
8. **Anything 10 PM–6 AM** except the safety tripwire (crisis language → instant alert, factual language, no panic copy per guidance conflict #7).
9. **Vague worry.** "Something might need your attention" with no specifics is banned — it's the notification equivalent of "we need to talk." Name it or don't send it.
10. **False urgency.** If it can wait for the morning digest, it waits. Urgency inflation trains the parent to ignore everything.

---

## 5. The "winning" feeling — specific UI moments

Winning = the parent *feels* competent, in control, and proud. These are the exact moments engineered to produce it:

1. **The Approval Tap.** Bottom-sheet with the teacher-email draft → big green "Send" → the email sends → a leaf unfurls on the child's plant *in the same animation* → "Sent ✓ — Ms. Thomason usually replies within a day." One tap, real-world consequence, visible growth. The single most powerful loop in the app.

2. **The Bloom Reveal.** Opening the morning session to find a new blossom *with its causality chain* ("You did this" — §3.3). The parent sees their Tuesday email became Thursday's grade movement. This is the moment the product's thesis becomes felt.

3. **The Comeback Callout.** A rare golden bloom + full-screen moment when a recovery milestone hits: "Geometry 69.5 → 80. Three weeks ago this looked impossible. It wasn't — it was a plan." Specific, effort-focused, never generic (guidance celebration rules). The parent screenshots this.

4. **The Cleared Board.** End of the morning ritual when all three actions are handled: the three cards dissolve into sparkles, the garden glows, and the copy reads "That's everything. The board is clear." — the family-inbox-zero feeling. *Every visit ends with "I handled something."*

5. **The Quiet Morning.** "Nothing needs you today" — and the parent *believes* it, because Pookie has earned the trust. The win here is peace: the absence of worry, delivered as a feature. This is the moment the founder's line becomes true: "it's how I know my family's okay."

6. **The Kid Win, Surfaced.** "Dawson turned in the missing assignment 🎉" — the parent didn't do this one; the *system* worked. The team (parent + child + Pookie) is winning together. Relatedness dopamine.

7. **The Season Recap.** End-of-semester artifact: blossoms counted, comebacks named, growth rings set, the causality chains of the whole term in one beautiful scroll. "Fall 2026: 14 blossoms, 3 comebacks, 1 mission complete." The parent's proudest screen — the GitHub-graph lesson, made emotional.

8. **The "I Didn't Have to Remember" Moment.** The refill reminder fired on its own. The permission slip was pre-flagged the night before. The bill reminder arrived 7 days out. The parent realizes: *I stopped carrying this in my head, and nothing fell.* That realization — usually around week 3 — is when the habit locks in permanently. Design for it explicitly: the evening "open loops, closed" screen should occasionally name it: "You didn't have to remember the refill. That's the point."

---

## 6. Habit metrics — how we know it's working (healthy signals only)

We measure the habit without building the dark patterns. North star: **"calm sessions per week"** — sessions that end at the signature exit ("the family's okay") with the parent's self-reported calm intact.

| Signal | What it tells us | Healthy target |
|---|---|---|
| Morning ritual completion rate | The cue is working | Rising to a stable plateau, not 100% (100% = pressure) |
| "Quiet morning" satisfaction (one-tap "😌" on the calm screen) | Trust dividend is real | High — quiet days must feel good |
| Approval-tap latency (notification → send) | The superpower loop is frictionless | Minutes, not hours |
| Bloom-reveal opens (tap-through on Win notifications) | Pride loop is landing | High tap-through, low dismiss |
| Evening session "sleep easy" exits | The day actually closed | Steady; drop = open loops leaking |
| Return after a missed week (no guilt copy!) | Grace architecture works | Parents return without a shame spiral |
| Season recap shares/screenshots | Legacy artifact value | The ultimate pride signal |

**Anti-metrics (we explicitly do NOT optimize):** raw DAU at all costs, session length (longer ≠ better — a 60-second calm session beats a 10-minute anxious scroll), notification volume, streak length as identity.

---

## 7. Open questions for the Design Coordinator / Wave-2 IA

1. **Where does the garden live in navigation?** Recommendation: the garden IS the home screen (the watch-face principle) — not a tab. IA to confirm.
2. **Multi-child morning:** one bloom per child max — with 3+ children, does the ritual stay 60 seconds? Recommendation: the engine picks the top 2–3 family-wide moments; other children's blooms wait in the garden (no FOMO copy).
3. **The child's view of the garden:** does the teen see their own plant? Recommendation: yes — their plant reflects *their* outcomes (blooms from their actions), framed as their growth story; parent-tending leaves are invisible to the child (the worry list stays hidden).
4. **Sound + haptics:** bloom reveals and ring-sets deserve a signature sound. Motion designer (Wave 4) to own.
5. **First-week onboarding:** the garden starts as a seedling; the first bloom is engineered to arrive within 48 hours (e.g., first approved action → first leaf; first sync → first growth story). The habit needs its first reward fast — Duolingo's "first 10 days" lesson.

---

*Sources: Duolingo gamification research (github.com/market-theory/thetoofiesapp research doc; Octalysis analysis of Duolingo/Brawl Stars collab); Apple Watch rings psychology (watchOS 11 pause/flexibility coverage); Finch app habit design (Finch's birb/adventure/growth loop); GitHub contribution graph & 2016 streak-counter removal. All mechanics summarized, not quoted.*
