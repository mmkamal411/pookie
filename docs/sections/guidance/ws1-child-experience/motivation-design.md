# Motivation Design — Encouragement Without Nagging

**Workstream 1: Child Experience · Manager sign-off: Child & Adolescent Psychologist**
**Status: SIGNED OFF · Date: 2026-10-11**

> How the app moves a child to act — without becoming the nagging voice the child tunes
> out. Grounded in self-determination theory (autonomy, competence, relatedness) and the
> growth-mindset literature. This is the psychological companion to the proactive engine's
> anti-nag rules (vision §3.1): the engine sets the *limits*, this document sets the
> *language and logic* inside those limits.

---

## 1. The core model: SDT in product terms

Every motivational surface in Pookie must serve at least one of the three psychological
needs. If it serves none, it ships as noise and trains the child to ignore us.

- **Autonomy — "I chose this."** The child picks the order, the time, the size of the
  step. The app *offers* structure; it never *imposes* it. A Path-to-90 plan the teen
  helped sequence beats a "better" plan handed down — compliance without ownership
  evaporates by Thursday.
- **Competence — "I can do this."** Every task is sized so the child can win today.
  "Fix Geometry" is not a task; "do these 3 study-guide problems before dinner" is.
  Wins compound into self-efficacy; self-efficacy is what actually moves grades.
- **Relatedness — "Someone's on my team."** Pookie notices effort, remembers context
  ("last Tuesday's comeback"), and never talks about the child like a case file. The
  parent is framed as allied (§4e of voice-tone-standards.md). The child is never alone
  with the mountain.

**The anti-pattern we are designing against:** the app as *surrogate parent* — the voice
that says "did you do your homework?" in push-notification form. A mother who pings about
everything gets tuned out (vision §3). Our nudges must feel like they come from a coach
who respects the player, not a warden checking compliance.

---

## 2. Encouragement without nagging — the operating rules

1. **Every nudge is an invitation with a named, finishable next step.** "Geometry study
   guide — 20 minutes tonight?" beats "Don't forget Geometry." The child should be able
   to say *yes* to the nudge in under five seconds and *finish* it in under thirty minutes.
2. **One nudge, one cause, one action.** Never bundle ("you have 3 missing assignments and
   a test Friday and you missed check-in"). Bundling converts a nudge into a lecture, and
   lectures produce avoidance, not action.
3. **The child always has a legitimate "not now."** Every nudge carries a defer option
   ("tonight," "tomorrow morning") — and deferring is *respected*, not punished with a
   re-fire in an hour. A deferral the app honors builds more trust than a completion it
   extracts. (The 7-day no-re-fire rule in vision §3.1 is the floor; honoring deferrals
   is the spirit.)
4. **Explain the *why* once, then stop explaining it.** "These two assignments are most
   of the gap — that's why they're first" is motivating. Repeating the rationale every
   nudge is nagging. State the cause, then let the plan speak.
5. **Never nudge during quiet hours, never nudge what the child can't control.**
   Portal credential failures, teacher grading delays, a parent's worry — none of these
   are the child's notification. (Vision §3.1: credential failures are parent-only.)
6. **Vary the voice.** Three nudges in a row with the same sentence shape become wallpaper.
   Rotate openers, rotate which need they serve (autonomy: "your call — which first?";
   competence: "3 problems, you've done harder"; relatedness: "let's get this one together").
7. **Silence is a feature.** Exam-week mode halves volume (vision §3.1). A day with zero
   nudges after a completed action is *reward*, not neglect — completing an action
   suppresses its trigger for 14 days. The app that knows when to shut up earns the right
   to be heard.

---

## 3. Handling failure — the worked example: Dawson's Geometry 55

*Reference case: Dawson, 15, Geometry Unit 3 test score 55, class at 69.5, goal 90+.
This is the canonical failure-handling flow. Every bad-grade interaction in the product
follows this shape.*

### The 4-move sequence

**Move 1 — Land with him, not on him (acknowledge the feeling).**
> "A 55 stings. It's allowed to sting for a minute."

One to two sentences, max. Name the emotion he's likely feeling so he doesn't have to
perform it or suppress it. Do NOT rush past this — "it's okay!" in the first breath reads
as dismissal (voice-tone-standards.md §4d).

**Move 2 — Separate the person from the result (protect identity).**
> "That score says one thing: the prep for Unit 3 didn't match the test. It says
> nothing about whether you can do Geometry."

Explicit, because the teen's silent question is "does this mean I'm stupid?" and silence
from us lets shame answer it. Note what we did NOT say: "you're still smart" (empty trait
praise — §4a). We said the *prep* failed, not the *person*.

**Move 3 — Convert to agency (the pivot).**
> "Here's what's actually useful about a 55: it tells us exactly where the prep broke.
> The study guide problems you skipped? Those were the test. That's fixable — and it's
> the same fix for every test from here on."

Failure becomes *data*. This is the growth-mindset move made concrete: not "failure is
good" (it isn't, and teens know it), but "failure is *informative*." The reframe must be
specific to be believed — generic "learn from your mistakes" is wallpaper.

**Move 4 — One next action, sized to win today (competence).**
> "Tonight: redo the 5 study-guide problems you skipped, with the answer key covered.
> 20 minutes. That's the whole assignment. Tomorrow we talk about what changed."

Not "study harder for the next test." Not the full Path-to-90. *One* finishable action,
tonight, with a time box. The child who completes it has evidence — tonight — that the
plan works. That evidence is worth more than any pep talk.

### What never happens in this flow
- No lecture about the grounding, the phone, or "if you'd studied." The past is not
  actionable; we don't bill the child for it.
- No comparison ("your Chinese grade shows you can do it") — cross-subject comparison
  still lands as "so why can't you," which is shame with a compliment taped to it.
- No Muse voice. A 15-year-old in a failure moment gets Pookie, always.
- No parent notification framed as a report on the child. The parent's digest carries
  the *plan* ("redoing the 5 skipped problems tonight — ask him to show you #3"),
  giving the parent a way to *join* rather than a reason to *confront*.

### The follow-up (24–48h later)
Pookie checks in once: "How'd the 5 problems go?" If done → specific praise (§4a:
"you went back to the exact spot it broke — that's the move") and the next step in the
plan. If not done → curiosity, not accusation: "Didn't happen? What's in the way —
time, or the problems themselves?" Then shrink the task further. **Shrinking the task is
never framed as lowering the bar** — it's framed as finding the right-sized step:
"Let's find the step that fits today."

---

## 4. Celebrating progress — what counts, how often, how

### What counts as worth celebrating
- **Effort strategies**, not outcomes: "redid the problems," "asked for help," "started
  without being asked." Outcome celebrations ("you got an A!") are allowed but secondary —
  the child can't fully control outcomes, and celebrating only outcomes teaches learned
  helplessness when outcomes dip.
- **Comebacks**, not just streaks: the child who returns after 3 silent days gets *more*
  celebration than the child on a 20-day streak. Returning is the bravest behavior in the
  product (voice-tone-standards.md §7).
- **Help-seeking**: every instance. "You asked — that's the skill that moves grades."
  We are manufacturing a help-seeking habit; reward each rep.
- **Process milestones in the Path-to-90**: each checked box is acknowledged; the plan's
  *completion* gets the real celebration.

### How often
- **In the moment, briefly, every time** a named effort happens: one specific sentence.
- **Weekly**: the digest names the week's real wins ("3 study sessions, study guide
  finished, asked Hubbard for help") — for the child *and* the parent, so the parent's
  picture of the week includes effort, not just numbers.
- **Milestone celebrations** (grade crosses a threshold, plan completes): bigger, warmer,
  and *shared* — "want me to tell your dad?" Let the child own the telling. Being the
  bearer of good news to a parent is itself a reward.

### Avoiding empty praise
The test: **could this praise sentence be copy-pasted to any child on any day?** If yes,
delete it. "Great job!" "Proud of you!" "Keep it up!" — all fail. Every praise must name
the action: "You did the 5 problems the *night* of the bad grade instead of avoiding
them — that's what pros do." Specificity is what makes praise believable, and believable
praise is what builds self-efficacy. Empty praise is worse than silence: it teaches the
child that our words don't mean anything, which bankrupts every future nudge.

---

## 5. Growth-mindset framing — the product-wide patterns

- **"Yet."** The most powerful word in the product. "You haven't cracked factoring *yet*."
  Build it into templates, not just chat: progress bars labeled "not yet" rather than
  "incomplete."
- **Strategy attribution, not effort attribution.** When something fails, the default
  explanation is *strategy*, not *effort* ("the prep didn't match the test," never "you
  didn't try hard enough"). Effort attribution backfires: the child who *did* try hard
  and failed hears "try harder" as "you are inadequate."
- **Normalize difficulty.** "Most people trip on this exact step" / "Unit 3 is the
  hardest unit in the course — you're in the deep water where everyone struggles."
  Struggle must feel *typical*, not *diagnostic*.
- **Future-self continuity** (13+): "the anesthesiologist version of you is built out of
  nights like tonight." Connect today's effort to the identity the child chose — not as
  pressure ("you'll never be a doctor at this rate" — banned, §6 of voice-tone) but as
  *authorship*: "you're writing that story right now."
- **Mistake autopsies, not mistake shame.** After any bad result: "what broke?" →
  "what do we change?" as a *routine*, almost boring. When post-mortems are routine,
  failure stops being an event and starts being a step.

---

## 6. Autonomy support — the child drives

- **Choice architecture, not commands.** "Study guide first or the 3 problems first —
  your call" beats "do the study guide." Both paths serve the plan; the child owns the
  route.
- **The plan is co-authored.** Path-to-90 checkboxes are presented as a draft the child
  edits, not a prescription: "Here's my suggested order — drag it into *your* order."
  (Per standing requirement: checkboxes persist to Supabase so the child's authorship
  survives across devices.)
- **Opt-in depth.** Pookie offers the next layer ("want the harder set?") rather than
  assigning it. A child who *chooses* the harder set has already decided they can do it.
- **Exit ramps are legitimate.** "Done for tonight — good call knowing when to stop" is
  a complete, praiseworthy end to a session. An app that never lets the child stop
  teaches the child to never start.

---

## 7. Relatedness — the alliance

- **Memory is care.** Pookie references the child's actual history: "last Tuesday you
  climbed from stuck to done on the same kind of problem." Generic encouragement is
  cheap; *remembered* encouragement is proof someone's paying attention.
- **The parent stays an ally in the narrative.** Wins are shareable with the parent at
  the child's direction (§4). The child never discovers surveillance; the parent never
  receives ammunition (voice-tone-standards.md §4e).
- **Pookie is honest about its limits.** "I can't do this one justice — this needs a
  human. Want me to help you ask Prof Ved / your teacher?" An AI that knows when to step
  aside is more trustworthy than one that bluffs. (This is also the T8 human-tutor
  escalation trigger in vision §3.1 — the product and the psychology agree.)

---

## 8. When the child disengages

Disengagement is *data*, not defiance. The response escalates in gentleness, not pressure.

**Stage 1 — Notice privately, assume benign cause (days 1–2).**
One light nudge, curiosity-framed: "Quiet couple days — everything alright?" No mention
of missed work. The most common causes are embarrassment after a bad grade, overwhelm,
or simply life — all of which pressure makes worse.

**Stage 2 — Shrink the ask (days 3–4).**
If silence continues, the next nudge offers the *smallest possible* re-entry: "60-second
check-in — just tap how the week's feeling?" or "One problem. Just one." The re-entry
task must be completable in under two minutes. The goal is contact, not productivity.

**Stage 3 — Change the channel (days 5–7).**
Pookie acknowledges the distance without guilt: "Haven't seen you in a bit — no stress.
I'm here when you want to pick it back up. The plan's saved, nothing's expired." Then
*stop nudging the child* and route to the parent per the tier handoff rules
(age-tiers-in-practice.md): the parent gets a gentle, non-alarming note ("He hasn't
opened Pookie in 5 days — might be worth a low-key check-in, not about school,
just him").

**What never happens:** streak-break shaming, escalating notification frequency,
"we miss you!!!" guilt copy, or telling the parent the child is "being difficult."
And critically — **when the child returns, there is zero mention of the absence as a
failing.** "Hey — good to see you. Where do you want to start?" The return is
celebrated (§4: comebacks over streaks). Punishing return guarantees there won't be
a second one.

---

## Resolved cross-manager conflict

**Conflict:** The Developmental Specialist's tier rules cap child nudges hard (max 3/day,
no re-fire within 7 days on the same cause, quiet hours) and require honoring deferrals —
arguing that for 13–15, autonomy protection *is* the motivation strategy, and that
frequent "encouragement" nudges risk becoming the nagging the product exists to avoid.
The Psychologist's initial draft leaned toward warmer, more frequent contact (daily
effort-noticing, streak-adjacent encouragement) to serve *relatedness*.

**Resolution (Senior Manager, Workstream 1):** The Specialist's caps stand as the hard
constraint — relatedness is served through *depth*, not *frequency*. One remembered,
specific, well-timed message ("you redid those 5 problems the night of the 55 — that's
the move") builds more relatedness than five generic check-ins, and it can't become
wallpaper. The Psychologist's warmth requirements are fully preserved *inside* the cap:
every allowed contact must be specific, named-action praise or a genuine invitation —
never filler. Both Managers sign off on this resolution.

**— Child & Adolescent Psychologist, Workstream 1 · 2026-10-11 · SIGNED OFF**
