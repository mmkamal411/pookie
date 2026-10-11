# UX Mental Models — Card Sort & Navigation Analysis

**Role:** UX Researcher A (Parent Mental Models) · **Date:** 2026-10-11
**Status:** Research input for Wave 2 Information Architects (2–3 navigation concepts)
**Method:** Simulated card sort (no real-user access — grounded in the founder's documented behavior + general parent psychology). All 23 modules (W1–W23) from the AI-MOTHER-VISION doc were sorted three ways. Each grouping below was evaluated against one test: *would a tired parent find the thing they need at 11 PM without thinking?*

---

## 0. Key findings up front

1. **23 modules ≠ 23 destinations.** The most important research conclusion: sorting cards into 5–6 parent-shaped groups is mandatory. A parent who opens the app and sees 23 tiles will close the app.
2. **The proactive engine (W9) is not a card.** Every attempted sort puts W9 in its own category or scatters it across all of them. Correct conclusion: W9 is the *delivery layer*, not a destination — it should surface as the home feed / briefing, never as a tab.
3. **Sibling fairness (W10) is a lens, not a module.** It also resists sorting — it only makes sense as a view *across* other modules (spend per child, activities per child). Give it a home inside the family view, not its own tab.
4. **The founder's own words are the tiebreaker:** Mehedi "thinks in terms of what needs my attention right now." His daily behavior — grades check, 4 PM study briefing, bill tracking, mail photos — is *cadence-shaped*, not domain-shaped. **Cadence grouping (Grouping B) should be the primary information architecture**, with life-domain grouping (Grouping A) as the secondary browse path.
5. **Three dangerous triples** that will confuse parents if they become three separate tabs: (a) W2 health / W22 exercise tracker / W23 nutrition tracker — the "three healths"; (b) W13 meal planning / W23 nutrition / W20 shopping list — the "food triangle"; (c) W1 school core / W16 school minutiae / W5 college prep — the "three schools."

---

## 1. The cards: 23 modules in plain parent language

Plain-language names matter — "W11" means nothing at 11 PM. Suggested parent-facing card names used in this analysis:

| Code | Working name | Parent would call it |
|---|---|---|
| W1 | School core | "School" |
| W2 | Health | "Health" |
| W3 | Safety | "Safety" |
| W4 | Extracurriculars | "Activities" |
| W5 | College prep | "College" |
| W6 | Life skills / driving | "Driving & Life Skills" |
| W7 | Banking / documents | "Money & Documents" |
| W8 | Emotional wellbeing | "Wellbeing" |
| W9 | Proactive engine | "Briefing" (not a tab — see §0) |
| W10 | Sibling fairness | "Fairness" (lens, not a tab — see §0) |
| W11 | Spend intelligence | "Spending" |
| W12 | Childcare | "Babysitters" |
| W13 | Meal planning | "Meals" |
| W14 | Co-parenting | "Co-parenting" |
| W15 | Screen time | "Screen Time" |
| W16 | School calendar | "School Calendar" |
| W17 | Friendships | "Friends" |
| W18 | Summer planning | "Summer" |
| W19 | Emergency / guardianship | "Emergency" |
| W20 | Shopping list | "Shopping List" |
| W21 | Mail intelligence | "Mail" |
| W22 | Exercise tracker | "Activity" |
| W23 | Nutrition tracker | "Nutrition" |

---

## 2. Candidate groupings

### Grouping A — By life domain ("the mother's world")

Mirrors how a parent narrates their own life: *my child, my family, my house.*

- **Grow (the child's trajectory):** W1 School · W4 Activities · W5 College · W6 Driving & Life Skills · W18 Summer
- **Care (health & wellbeing):** W2 Health · W8 Wellbeing · W22 Activity · W15 Screen Time · W17 Friends · W13 Meals · W23 Nutrition
- **Protect (the safety net):** W3 Safety · W12 Babysitters · W14 Co-parenting · W19 Emergency
- **Home (household ops):** W7 Money & Documents · W11 Spending · W20 Shopping List · W21 Mail · W16 School Calendar
- **Cross-cutting (not destinations):** W9 Briefing (home feed) · W10 Fairness (family lens)

**Why a parent finds this natural:** it answers "which *part of my life* is this about?" A mother deciding where to look for the permission slip thinks "that's a home/school thing," not "that's W16." It matches how parents *talk* — "how are the kids," "how's the house," "is everyone healthy."

**Weakness:** it hides urgency. A geometry grade slipping to 69 and a dentist appointment both live in "Grow"/"Care" but need wildly different attention. At 11 PM, a tired parent doesn't want to browse domains — they want to know *what needs me now*. This is why domain is the **secondary** architecture, not the primary.

**Also note:** "Care" is overstuffed (7 modules, including two of the dangerous triples — W22 vs W23, and W13 vs W23). See §5 for how to avoid the collision inside this group.

---

### Grouping B — By cadence & attention (RECOMMENDED as primary)

Mirrors the founder's actual mental model: *"what needs my attention right now."* This is how Mehedi already operates — daily grades check, 4 PM briefing, mail photos when they arrive, bills on a rhythm. Attention is the scarcest resource; the IA should spend it, not demand it.

- **Daily pulse (open the app for this):** W9 Briefing · W1 School (grades, check-in, tonight's plan) · W20 Shopping List (add-as-you-think) · W21 Mail (snap when it arrives) · W22 Activity (glance: steps, sleep)
- **Weekly rhythm (the Sunday/Monday planning surface):** W13 Meals (plan the week) · W11 Spending (review the week) · W4 Activities (practice schedules) · W8 Wellbeing (mood trend, parent-safe aggregate) · W16 School Calendar (week preview — spirit day, slip deadlines) · W15 Screen Time (weekly report)
- **Seasonal & deadline-driven (the horizon):** W5 College (deadlines 30/14/7/2) · W18 Summer (plan in Feb–Apr) · W6 Driving & Life Skills (milestones: permit → license) · W7 Money & Documents (renewal timelines: passport, ID) · W2 Health (immunizations, checkup cadence, dental/ortho) · W12 Babysitters (book ahead for breaks)
- **Event-driven / on-demand (only when something happens):** W3 Safety (SOS, geofence alerts — must interrupt, never buried) · W19 Emergency (vault — hopefully never opened) · W14 Co-parenting (handoff days, expense events) · W17 Friends (birthdays, party RSVPs) · W10 Fairness (quarterly gut-check: "am I being fair?")
- **Child's own tools (kid-facing, parent sees patterns only):** W23 Nutrition (the what-if simulator — the *child* asks "what if I eat this?") · W8 check-in pulse · W17 social calendar

**Why a parent finds this natural:** it matches the only question a busy parent actually asks: *"do I need to do something about this today?"* Daily items earn home-screen real estate; weekly items get a planning ritual (the Sunday garden-tending moment); seasonal items get countdowns; event-driven items stay invisible until they fire. This is also the grouping that makes the "healthy addiction" daily ritual *designable* — see §3.

**Weakness:** some modules straddle cadences (W2 Health is daily medication *and* seasonal checkups; W7 Money is weekly spending *and* seasonal renewals). The answer: modules can surface in two cadence layers (e.g., medication adherence in Daily, immunizations in Seasonal) without being duplicated as destinations — cadence is a *view*, not a folder.

**Design implication for Wave 2 IA:** Grouping B suggests a home screen organized as **Now / This Week / Coming Up / If Needed** — four attention bands — rather than a grid of module icons. The domain groups (A) become the browse/search path underneath.

---

### Grouping C — By worry type (the vision doc's taxonomy, parent-facing)

Mirrors the emotional truth of the product thesis ("everything a mother would be worried about") — but with a critical constraint from the vision doc: **the worry list itself must never be visible to the child.** So this grouping is parent-app-only framing, and the labels must be pride/progress-forward per the shame-free directive.

- **"My child is okay" (reassurance):** W1 School · W2 Health · W8 Wellbeing · W15 Screen Time · W17 Friends · W22 Activity
- **"My child is safe" (protection):** W3 Safety · W19 Emergency · W12 Babysitters
- **"My child is growing" (trajectory):** W4 Activities · W5 College · W6 Driving & Life Skills · W18 Summer
- **"Our house is running" (operations):** W7 Money & Documents · W11 Spending · W20 Shopping List · W21 Mail · W16 School Calendar · W14 Co-parenting · W13 Meals
- **"Am I doing this right?" (the parent's own reflection):** W10 Fairness · W9 Briefing ("here's everything, handled")

**Why a parent finds this natural:** it names the feeling. At 2 AM a parent doesn't think "I should check module W3" — they think "is my kid safe?" Worry-shaped navigation is emotionally legible, and it gives the garden metaphor somewhere to live: the "is my child growing" space is where progress-dopamine blooms.

**Weaknesses (serious):**
1. Worry labels risk violating the shame-free directive if they leak into UI copy ("Is my child lonely?" as a tab title is a guilt bomb). Parent-facing only, carefully worded — or kept as internal taxonomy and never rendered.
2. Worry is *ambient*, not actionable — it doesn't tell the parent what to *do next*. A worry-shaped home screen risks becoming an anxiety dashboard, the exact opposite of "mission control that feels like a garden."
3. The child must never discover it (vision doc §1 is explicit). Any shared-surface design (family TV, the child's own tab) breaks the contract.

**Recommendation:** keep the worry taxonomy as the *internal* organizing principle (it already is, in the vision doc) and as the emotional-voice guide for copy. Do not make it the primary navigation. It can inform the empty states and the briefing tone ("here's everything, handled" — W9 answering "am I missing something?").

---

### Grouping comparison & recommendation

| | A: Life domain | B: Cadence/attention | C: Worry type |
|---|---|---|---|
| Matches founder's stated mental model | ◐ | ● | ◐ |
| 11 PM test (tired parent, one thumb) | ◐ | ● | ○ |
| Scales to 23 modules without tab overload | ● | ● | ● |
| Supports the daily-ritual habit loop | ○ | ● | ○ |
| Child-safe (no worry leakage) | ● | ● | ○ (parent-only) |
| Multi-child (see §6) | ● | ● | ◐ |

**Recommendation to Wave 2 IA: primary = B (cadence), secondary browse = A (domain), emotional voice = C (never rendered as nav).** W9 is the home feed; W10 is a family-view lens.

---

## 3. The daily ritual set — cadence map

Founder directive: "healthy addiction — daily ritual like checking the weather." The ritual must be completable in ~2 minutes, end on a dopamine note (progress, not problems), and work for a parent who opened the app half-asleep.

### Every day (the 2-minute ritual)

1. **W9 Briefing — the home feed itself.** "Here's everything, handled." 3–5 items max, ordered by actionability. The weather-check equivalent. *This is the ritual's container.*
2. **W1 School — the grade pulse + tonight's plan.** Mehedi checks grades daily; the 4 PM study-block briefing is his existing ritual. The app's job: make the check *shorter* than his current flow and end it with "tonight's plan is set."
3. **W21 Mail — the snap.** Mehedi already photographs physical mail. Ritual hook: "2 envelopes today → 1 bill ($142.18, due 28th), 1 junk (dismissed)." Photo → done → dopamine.
4. **W20 Shopping List — the capture.** "Out of milk" thoughts happen at random hours. One-tap add, tagged by who. The list that never requires remembering.
5. **W22 Activity — the glance.** Steps/sleep as ambient reassurance, not a task. ("Dawson slept 7.5h — fine." Done.)

*Borderline daily:* W23 Nutrition — but this is the **child's** daily tool (the what-if simulator), not the parent's. The parent's daily exposure is at most a pattern nudge ("protein's been low this week"). Don't put the parent's ritual inside the child's counter.

### Weekly (the Sunday/Monday planning ritual — "tending the garden")

- **W13 Meals** — plan the week, grocery list drops into W20 automatically. This is the highest-dopamine weekly loop: a full week of dinners decided in 5 minutes.
- **W11 Spending** — "here's what the money did this week" (tutoring $240 → grade 69→78 — *worth it*). Pride, not guilt.
- **W16 School Calendar** — week preview: spirit day Thursday, slip due Friday. The "did I miss picture day?" insurance.
- **W4 Activities** — practice/game schedule for the week, conflict check.
- **W8 Wellbeing** — mood trend (aggregate only), one gentle prompt if the pattern dips.
- **W15 Screen Time** — the weekly report, teen-friendly version shared.

### Seasonal / deadline-driven (the horizon — countdowns, not calendars)

- **W5 College** — 30/14/7/2-day deadline escalations. For a 15-year-old: the 9th→12th roadmap milestones.
- **W18 Summer** — planning season Feb–Apr; dormant the rest of the year. Must not nag in November.
- **W6 Driving & Life Skills** — milestones with countdowns (permit-eligible → licensed). Dawson's demo: the engine should have fired 60 days before eligibility.
- **W7 Documents** — 9-month passport kickoff, 6-month trip checks. Invisible until it matters.
- **W2 Health** — immunization rules (Georgia dataset), dental/ortho cadence, annual physical nudge.
- **W12 Babysitters** — early-release Wednesdays, school breaks, date nights.

### Event-driven / on-demand (invisible until it fires)

- **W3 Safety** — SOS bypasses quiet hours, always. Geofence alerts interrupt; the map itself is browsed rarely.
- **W19 Emergency** — the vault. Annual review nudge ("contacts still current?"). Hopefully opened never.
- **W14 Co-parenting** — handoff days (2-hour reminder + notes template), expense submissions.
- **W17 Friends** — birthdays (reminder + gift idea), party RSVPs.
- **W10 Fairness** — quarterly gut-check, parent-only. ("Spend on A is 3× B this quarter — intentional?")
- **W21 Mail** doubles here: the court-date / second-notice escalation path.
- **W1/W2/W4** doubles here: the proactive engine's alert tier (grade drop >5 pts, missed medication, tryout deadline 3 days out).

### Cadence map (one view)

| Cadence | Modules | Design home |
|---|---|---|
| Daily (~2 min) | W9 briefing · W1 school pulse · W21 mail snap · W20 list capture · W22 glance | Home feed |
| Weekly (~10 min) | W13 meals · W11 spend · W16 school week · W4 activities · W8 trend · W15 report | "This week" planning surface |
| Seasonal | W5 college · W18 summer · W6 driving · W7 docs · W2 immunizations · W12 breaks | Horizon / countdowns |
| Event-driven | W3 SOS · W19 vault · W14 handoffs · W17 birthdays · W10 fairness | Invisible until triggered |
| Child's own daily | W23 nutrition · W8 pulse · W17 social | Child's tab (parent sees patterns) |

**Ritual design rule for UX Researcher B:** the daily loop must *close*. Open → see what's handled → do the one thing → see progress → close feeling in control. An open loop ("3 more things you haven't done") at bedtime is an anxiety machine, not a garden.

---

## 4. Navigation pain points to avoid (the 11 PM test)

Test persona: Mehedi, 11 PM, tired, one thumb, half attention. Every item below is a predicted failure mode from the card sorts.

### P1 — The three dangerous triples (sound-alike modules)

1. **"Three healths": W2 Health vs W22 Activity vs W23 Nutrition.** A parent looking for "the doctor's phone number" should not have to guess which health tab holds it. *Avoid:* three health icons in the tab bar. *Direction:* one **Health** destination; W22 is its data layer ("the numbers"), W23 is the child's nutrition view wired in. W2 is the interpretation layer (conditions, meds, appointments, visit-agenda builder).
2. **"The food triangle": W13 Meals vs W23 Nutrition vs W20 Shopping List.** Meals plans the week, Nutrition scores the day, Shopping buys the food — but to a parent they're all "food stuff." *Avoid:* scattering them across distant tabs. *Direction:* keep the wiring visible — meal plan → grocery list is one flow; the nutrition tracker reads the meal plan as its baseline (the vision doc already specifies this). If they live apart, the seams must be one tap.
3. **"Three schools": W1 School vs W16 School Calendar vs W5 College.** *Avoid:* "School" and "School Calendar" as sibling tabs — the parent will open the wrong one forever. *Direction:* W16 is *inside* the School destination (the minutiae feed: picture day, slips, spirit week). W5 College is the trajectory view for 9th grade up — label it by outcome ("College & Future"), not by institution.

### P2 — Buried alerts (the engine must not be a tab)

W9's alerts die if they live behind a tab badge. A grade-drop alert, an SOS, a court-date escalation, and a medication refill are not the same urgency and must not share one badge count. *Direction:* urgency-tiered surfacing — interrupt (SOS, crisis language, safety tripwire) > push (alert tier) > feed (nudge tier) > digest (weekly). The home feed *is* the engine's face.

### P3 — Tab overload

23 modules, 5±2 tabs. Anything beyond ~6 primary destinations forces the parent to memorize an index — exactly the mental load the app promises to remove. *Direction:* 4–6 primary destinations max; everything else is one search or one feed-tap away. Modules are *capabilities*, not tabs.

### P4 — Jargon and codes

"W11," "proactive engine," "tenant," "Class S" — none of these survive contact with a tired parent. Even "spend intelligence" is product-speak. *Direction:* plain verbs. "Mail," "Shopping List," "Meals," "Safety." The 11 PM test: can the parent *say* where they're going? ("I'm checking the mail." ✓ / "I'm reviewing spend intelligence." ✗)

### P5 — The worry-list leak

Grouping C's labels ("Is my child lonely?") must never render where the child could see them — shared surfaces, the child's tab, screenshots, notifications on a family iPad. *Direction:* parent-app-only framing; child-facing copy is always mission/progress-forward. Audit every notification's lock-screen text.

### P6 — Surveillance feel (W15, W17, W3, W8)

Screen Time, Friends, Safety location, and Wellbeing share a failure mode: one wrong interaction and the teen experiences the app as spyware — and then stops telling it the truth (no check-ins, no honest mood pulses), which kills the data the whole product runs on. *Direction (from the vision doc's own contracts):* the teen sees the same map/alerts the parent sees (W3); Friends is child-private with pattern-only parent visibility (W17); mood raw text belongs to the child (W8); screen-time is nudges-over-blocks with the teen seeing the same dashboard (W15). The IA must make these contracts *legible in the layout* — e.g., a visible "Dawson can see this too" marker on shared surfaces.

### P7 — The empty-state cliff

Seasonal modules (W18 Summer in November, W5 College essays in 9th-grade fall) will often be legitimately empty. An empty tab that says "No summer plans yet" reads as parental failure. *Direction:* dormant modules collapse out of the way; when they wake, they wake with a *next step*, not a blank page. ("Summer planning opens in February — want a reminder?" not an empty list.)

### P8 — Money split-brain (W7 vs W11)

Banking/allowance (W7) and spend intelligence (W11) both answer "money." A parent hunting the tutoring-spend-vs-grade number shouldn't have to decide which money tab holds it. *Direction:* one **Money** destination; W7 is accounts/documents/allowance mechanics, W11 is the intelligence layer ("what it's doing") — presented as views within Money, or W11 as the digest that *points into* W7.

### P9 — Co-parenting as an afterthought (W14)

If co-parenting is buried five taps deep, the module fails its only user: the *other* parent, who has less patience than Mehedi and didn't choose this app. *Direction:* the one-parent-onboarded case (read-only share links) must be reachable in ≤2 taps from the relevant surface (calendar event → share; expense → share). Design for the skeptical second user.

### P10 — Notification fatigue (the anti-nag contract)

The vision doc's trigger taxonomy already has anti-nag rules (max 3 child nudges/day, max 1 parent alert/day/child, no re-fire within 7 days). The IA must honor them structurally: the feed shows *suppressed* state honestly ("2 more updates quiet until tomorrow — exam-week mode"), so silence reads as competence, not breakage.

---

## 5. Module adjacency notes (what must sit near what)

From the sorts, these pairs/groups kept landing together — the IA should preserve the adjacency:

- **W13 → W20:** meal plan generates the grocery list. One flow, not two tabs.
- **W23 ↔ W13 ↔ W20 ↔ W22:** the nutrition loop (plan → shop → log → activity). The wires are the feature.
- **W22 → W2:** activity data feeds health interpretation. "Steps down 40% since grounding — expected, not alarming" only works if the data layer and the interpretation layer are adjacent.
- **W1 → W16:** minutiae inside School, not beside it.
- **W21 → W11:** every bill/expense the mail module extracts lands in the spend ledger. "Electric bill $142.18" → paid → ledger. The loop must close visibly.
- **W4 → W5:** extracurricular depth feeds the college narrative. The "feeds the 9th-grade tryout goal" arc.
- **W8 ↔ W22 ↔ W15:** sleep debt ↔ mood ↔ 3 AM TikTok. Cross-module correlation is the product's edge over single-purpose apps — the IA needs a place where "here's the pattern across your data" lives (the briefing, W9).
- **W3 → W19:** SOS surfaces the child's medical flags from W2/W19. Emergency surfaces must be reachable *during* an emergency — not nested.
- **W6 → W7:** the good-student discount packet (GPA trend → insurance). Cross-module pride moment.
- **W12 → W16:** early-release Wednesday → "need coverage 12–3?" The calendar *proposes* the booking.

---

## 6. Multi-child implications — does the grouping hold with 2–3 kids?

Short answer: **Grouping B (cadence) holds; Grouping A (domain) holds; both need a child-scope layer the single-child sort didn't require.** The card sort was run single-child (Dawson's shape). Adding children introduces a new primary axis: *which child?*

### 6.1 The child switcher is load-bearing

With 2–3 kids, every child-scoped module (W1, W2, W4, W5, W6, W8, W12, W13, W15, W17, W18, W22, W23, W3) needs an omnipresent, one-tap child context. Failure mode: the parent checks "grades" and sees the wrong child's grades — a trust-destroying error. *Direction:* persistent child indicator on every child-scoped surface; the briefing (W9) groups items *by child* ("Dawson: 2 items · Maya: 1 item").

### 6.2 Family-scoped vs child-scoped is a first-class distinction

Not everything splits by child. Family-scoped: **W20 Shopping List** (groceries are a family affair — vision doc explicit), **W14 Co-parenting** (per-child events, but the calendar is shared), **W21 Mail** (household bills), **W11 Spending** (family ledger with per-child views), **W10 Fairness** (only meaningful across children), **W19 Emergency** (vault is per-child documents, but the plan is family). The IA must visually distinguish "this is about Dawson" from "this is about the family" — mixed surfaces (a shopping list with per-child tags, "milk — Dawson") need the tags legible at a glance.

### 6.3 W10 Fairness becomes real (and delicate)

Single-child, W10 is a parked module. With 2–3 kids it's the **family dashboard**: per-child activity/spend cards, conflict detection ("two practices overlap Thursday — one driver"), fairness nudges. Hard constraints from the vision doc: never cross-child comparisons visible to children ("your sibling got more"); never-blended data. *Direction:* parent-only surface; framed as the parent's own reflection ("am I being fair?"), never as a leaderboard.

### 6.4 The briefing scales by child, not by module

With 3 kids × 23 modules, a module-organized briefing is 69 potential items. A child-organized briefing is 3 clusters. *Direction:* W9 groups by child first, urgency second. "Nothing needs you for Maya today ✓" is itself dopamine — the garden is tended.

### 6.5 Per-child cadence differs

A 15-year-old's daily ritual (grades, driving log) and a 7-year-old's (babysitter handoff notes, picture day) are different dailies. The cadence map in §3 must be **per-child configurable**: the Daily pulse for Dawson shows W1+W6; for a younger child it shows W16+W12. The ritual is the same shape; the contents adapt.

### 6.6 Privacy multiplies

W8/W17/W22-per-metric privacy contracts are per-child *and* per-age-tier (under-13 parent-sees-all vs 13–17 child-confidential-by-default). With 2–3 kids at different ages, the parent sees different depths per child — the IA must make "why can't I see Maya's mood detail but I can see Dawson's?" legible without a settings archaeology dig. *Direction:* the privacy contract is stated at the surface where it bites, in plain language, once — not buried in settings.

---

## 7. Open questions for Wave 2 IA (handoff)

1. **Home feed composition:** Now / This Week / Coming Up / If Needed — four bands, or a single smart-ranked feed with band labels? (Researcher leans bands: predictable beats clever at 11 PM.)
2. **Destination count:** 5 or 6 primary destinations? Candidate set: Briefing (home) · School · Health · Family/Money · More. Where do Safety and Meals live at the top level?
3. **Search as navigation:** with 23 capabilities, is global search ("picture day," "passport") a primary nav element? (Researcher says yes — it rescues every buried module.)
4. **Child switcher pattern:** segmented control vs avatar stack vs briefing-grouped — needs prototyping with 3-child data.
5. **The garden metaphor's home:** which surface carries the progress-dopamine visualization — the briefing, a dedicated "garden" view, or ambient across destinations? (Flag for UX Researcher B's habit-loop work + Motion designer.)

---

*Researcher A sign-off: groupings, cadence map, pain points, and multi-child analysis above are the Wave 1 input. Wave 2 IA should treat §0 findings 1–5 as constraints, not suggestions.*
