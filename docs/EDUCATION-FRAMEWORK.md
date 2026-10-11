# Pookie Learn Section — Education Framework

**Status:** Normative standard. Binding on the engineers building the Learn section and on every member of the AI committee (tutor, quiz generator, curator).
**Version:** 1.0 — 2026-10-11.
**Authority:** The Education Pod — 13 top-tier experts: chemistry, physics, biology, advanced mathematics, English, literature, history, psychology, PE/health, music, social studies, anatomy & physiology, plus the curriculum design lead (cross-subject framework owner).
**Audience:** Engineers implementing the Learn hub; the AI committee generating quizzes, tutoring, and recommendations; reviewers auditing AI-generated educational content.

## What this document is

The content standard that Pookie's Learn section — the per-class, per-unit study hub — and its AI tutor are built against. It defines what a unit contains, what excellent study material looks like (and what gets rejected), how practice quizzes must be constructed, which external resources are trustworthy per subject, the misconceptions the tutor must catch, and how content depth calibrates from middle school through AP.

It covers twelve subjects across grades 6–12. It is written for a multi-tenant platform: the standard is student-agnostic, though calibrated against the reference student (Dawson, 15, 10th grade, Walton High School, Cobb County GA).

## The three principles everything else hangs on

Distilled from all thirteen experts — each arrived at these independently, in their own subject's language:

**1. Diagnose before you drill.**
Every expert converged here: assigning practice on top of a misconception entrenches the misconception. The physics expert mandates a 4-step tutor protocol (notice → diagnostic question → framing → transfer check); the math expert calls drilling theorems over broken factoring "malpractice"; the chemistry expert requires particulate-level reasoning on every quiz because plug-and-chug hides broken models. The system's first job on any error is to name the *why* — the specific misconception — from error patterns. Practice is conditional on diagnosis, never a substitute for it.

**2. Traceability is the trust contract.**
Every quiz question and answer explanation must trace to the student's uploaded class materials or the expert-curated allowlist — or it is deleted, not shown. The tutor says "I don't know — ask your teacher" rather than confabulating; confabulation in an educational product is a safety incident, not a quality miss. External resources are allowlisted and expert-picked per subject, never hallucinated URLs. This is what separates a mother's trusted helper from a confident liar.

**3. The teacher outranks the algorithm; the student owns the plan.**
Internal material (the student's actual handouts, syllabus, teacher slides) is the primary curriculum — on conflict with external sources, the teacher wins and the conflict is flagged, never silently overridden. Every recommendation must explain its *why* in plain language; no black-box assignments. The AI proposes and makes trade-offs visible; the student and family decide. Mastery is demonstrated through quiz evidence, never declared from clicks or completion.

## How to use this document

- **Part 0** is the normative cross-subject framework: unit-tagging taxonomy, the AI's recommendation hierarchy, quality gates for AI-generated content, age tiers, subject safety boundaries, and the expert-guidance label rule. **Where any subject section conflicts with Part 0, Part 0 wins.**
- **Parts 1–12** are the subject standards, each written by its expert. They are normative within their subject.
- **Working files:** the experts' full sections also live as individual files in `docs/_sections/` (source of truth for section-level edits). This assembled document is the published standard.

## Document map

| Part | Subject | File |
|---|---|---|
| 0 | Cross-Subject Framework (normative, binding) | `_sections/_framework.md` |
| 1 | Mathematics (through AP Calculus BC / AP Statistics) | `_sections/mathematics.md` |
| 2 | Physics (through AP Physics C) | `_sections/physics.md` |
| 3 | Chemistry (through AP Chemistry) | `_sections/chemistry.md` |
| 4 | Biology (through AP Biology) | `_sections/biology.md` |
| 5 | Anatomy & Physiology (pre-med track) | `_sections/anatomy.md` |
| 6 | English / Language Arts (through AP Language) | `_sections/english.md` |
| 7 | Literature (through AP Literature) | `_sections/literature.md` |
| 8 | History, Government & Civics (through APUSH / AP Gov) | `_sections/history.md` |
| 9 | Social Studies (geography, economics, sociology, world cultures) | `_sections/social-studies.md` |
| 10 | Psychology (through AP Psychology) | `_sections/psychology.md` |
| 11 | Music (performance + theory, through AP Music Theory) | `_sections/music.md` |
| 12 | PE / Health | `_sections/pe-health.md` |

---

# Part 0: Cross-Subject Framework


**Status:** Normative policy. Binding on all subject sections and all AI committee members.
**Owner:** Curriculum Design Lead, Education Pod.
**Version:** 1.0 — 2026-10-11.

This document is the backbone of the Learn section. The twelve subject experts define *what* gets taught per subject; this document defines *how the system behaves* across all subjects. Where a subject section conflicts with this framework, this framework wins. These are rules, not suggestions.

---

## 1. Unit-Tagging Taxonomy

Every unit in the Learn section — across every subject — carries a canonical metadata record. No unit renders to the student without it.

### 1.1 Required metadata fields

| Field | Rule |
|---|---|
| `subject` | One of the twelve canonical subjects. No abbreviations, no synonyms. |
| `topic` | The unit's headline topic (e.g., "Quadratic Functions"). |
| `subtopics` | List of 2–8 component topics (e.g., "vertex form," "factoring," "completing the square"). |
| `skill_tags` | Verbs of learning, from a controlled list per subject: e.g., `solve`, `factor`, `derive`, `analyze`, `cite-evidence`, `interpret-data`. A unit must carry at least one skill tag per major assessment type the teacher uses. |
| `difficulty_band` | One of `foundational`, `core`, `extension`. `foundational` = prerequisite knowledge; `core` = on-grade-level expectations; `extension` = enrichment or honors-level stretch. Default to `core` when uncertain — never inflate. |
| `prerequisite_tags` | Cross-references to other units (any subject) the student must have grasped first. Empty is allowed but must be explicit (`prerequisites: none`), never implicit. |
| `standard_alignment` | Where applicable: AP topic codes, NGSS performance expectations, or Common Core standard codes. Where none applies (e.g., music performance, PE skills), use `standard_alignment: school-local` and name the school document it traces to. |

### 1.2 Controlled vocabulary rules

- **Canonical tags are expert-created.** Only the Education Pod (curriculum lead or a subject expert) may add a new term to a subject's controlled tag list. The AI committee may never invent a tag and ship it.
- **AI-proposed tags are drafts, never live.** If the AI detects that a unit needs a tag that does not exist (e.g., a novel skill from uploaded handouts), it proposes it to the expert review queue with evidence (the uploaded material it came from). The tag goes live only after a subject expert approves it. Until then, the unit carries `tag: pending-review` and is eligible for internal-material recommendations only — it cannot be recommended as a prerequisite for other units.
- **One meaning per tag.** If two subjects would use the same word differently (e.g., "function" in math vs. biology), they use namespaced tags (`math:function`, `bio:function`). No ambiguous bare terms in cross-subject fields like `prerequisite_tags`.
- **Tag deprecation, not deletion.** Tags are never hard-deleted; deprecated tags redirect to their replacement so historical study plans remain legible.
- **Student-facing tags are plain language.** Controlled tags may be technical internally, but anything the student sees gets a plain-language gloss ("cite-evidence" renders as "Using quotes to back up your point").

---

## 2. Recommendation Logic — How the AI Decides What to Surface

The AI committee generates a weekly study plan per class. Its prioritization follows a fixed decision hierarchy. Higher-ranked needs displace lower-ranked ones when time is limited. The hierarchy is:

1. **Prerequisite gaps before current-unit work.** If quiz performance or missing fundamentals show the student lacks a prerequisite for the current unit, remediation of the prerequisite outranks drilling the current unit. Never stack new content on a missing foundation to chase a test date.
2. **Missing or zero-scored assignments before enrichment.** A zero drags its whole category. Recovery of recoverable points outranks extension content, always.
3. **Struggling-unit remediation before current-unit extension.** If the student's grade in the unit sits below the family goal band and the AI can trace the struggle to specific subtopics (via quiz errors or check-in text), targeted remediation of those subtopics outranks extension material for the current unit.
4. **Upcoming-assessment readiness before open-ended exploration.** When a test or project is within 7 days, the plan weights toward it — but rules 1–3 still outrank cramming new material.
5. **Enrichment and extension last.** Only when rules 1–4 yield nothing actionable does the plan offer extension content.

### 2.1 Input weighting

The committee draws on four signals, in this order of authority:

1. **Grades and missing assignments** (objective, highest authority) — what the gradebook proves.
2. **Quiz performance** (objective, high authority) — what the AI-generated quizzes reveal, per subtopic.
3. **Check-in text** (subjective, medium authority) — the student's own words about what's hard. Treated as a hypothesis to verify against quiz data, never as fact. If the student says "I'm fine" but quizzes show 40% on factoring, the quizzes win.
4. **Study behavior** (observed patterns, lowest authority for diagnosis) — what the student clicked or completed. Useful for engagement tuning, never for concluding mastery.

### 2.2 Mandatory behavior

- **Every recommendation explains its why.** A recommendation without a one-line reason ("Your quiz showed 2 misses on factoring — that's the prerequisite for Friday's test") is not permitted to render. This is also a cross-subject principle (§4).
- **The plan states what it is NOT covering and why.** If enrichment was deprioritized, the plan says so. No silent omissions.
- **Confidence is labeled.** Recommendations based on thin evidence (e.g., a single check-in with no quiz data) carry an explicit "low confidence — verify with a quiz" flag and must trigger a diagnostic quiz before the next plan cycle.

---

## 3. Quality Gates for AI-Generated Content

These are hard gates. Content that fails a gate does not render, full stop — no "best effort" fallback to the student.

### 3.1 Quiz generation — traceability

- **Every quiz question must trace to uploaded unit material.** Each question carries a source pointer (the specific handout, syllabus section, or upload it was generated from). A question with no traceable source — an "orphan question" — is deleted, not shown.
- **No orphan answer keys.** The correct answer and the explanation must also trace to the same material. If the AI cannot ground the explanation in the upload, the question is dropped.
- **Difficulty honesty.** AI-generated quizzes are labeled "practice — generated from your class materials," never presented as teacher-authored or as predicting the actual test.

### 3.2 Tutor honesty — the "I don't know" rule

- When the tutor cannot answer from the student's uploaded materials or the curated external set, it must say **"I don't know — ask your teacher"** (or age-appropriate equivalent) rather than confabulate. Confabulation in an educational product is a safety incident, not a quality miss.
- The tutor never guesses at what will be on a test, what a teacher's policy is, or what a grade will be. It redirects: "Your syllabus doesn't say — this is a good question for Ms. X."

### 3.3 External resources — allowlist only

- External resources (YouTube, Khan Academy, games, Desmos, PhET, DeltaMath, AP Classroom) are **allowlisted and expert-curated only**. The AI selects from the curated set; it never invents URLs.
- A URL that does not resolve to the curated destination is treated as a hallucination and blocked at the write-path gate.
- Cap holds: max 2–3 resources per type per unit, as defined in the product spec. The AI may not pad a thin unit with low-relevance links to fill a quota — fewer, relevant resources beat a full shelf of noise.

### 3.4 Age-tier enforcement

| Tier | Rule |
|---|---|
| Under 10 | No direct chat with the tutor. Content is parent/teacher-mediated only. |
| 10–12 | Supervised chat: a parent/guardian is notified of session summaries; the tutor uses simplified language and never discusses the safety-boundary topics (§3.5) beyond a redirect. |
| 13–15 | Monitored chat: full tutoring with session logging and flagging; sensitive topics get the redirect response. |
| 16+ | Full chat within the subject safety boundaries below. |

Age tier is set from the profile and enforced server-side. The AI cannot be talked into a higher tier.

### 3.5 Subject-specific safety boundaries

- **Psychology, anatomy, PE/health: no diagnosis, ever.** The tutor explains concepts; it does not assess the student's body or mind. Any "do I have X / is this normal for me" question gets the redirect: "I'm a study helper, not a medical professional — talk to your doctor / school counselor / coach." This applies even if the student insists.
- **English and literature: coach, don't do.** The tutor never writes essays, paragraphs, or thesis statements for the student. It asks guiding questions, explains techniques, and gives feedback on the student's own drafts. Generating submittable work is academic-dishonesty facilitation and is blocked at the write-path gate.
- **History and social studies: no present-day political persuasion.** Explain contested topics with attributed perspectives; never tell the student what to believe about current events.
- **All subjects: no personal data extraction.** The tutor never asks for or stores information beyond what the study task needs.

---

## 4. Cross-Subject Principles

These six principles hold across all twelve subjects without exception.

1. **Misconceptions first: diagnose before drilling.** The system identifies *why* the student is wrong (the specific misconception, via error patterns in quizzes) before assigning more practice. Ten more problems on a misunderstood concept entrenches the misunderstanding. Diagnosis is mandatory; drilling is conditional on it.
2. **Every recommendation explains its why.** (See §2.2.) The student should always be able to answer "why am I doing this?" No black-box assignments.
3. **Internal material outranks external.** The student's actual uploads, handouts, and syllabus are the primary curriculum. External resources supplement; they never substitute. If internal and external conflict, internal wins and the conflict is flagged to the student ("your teacher's handout defines this differently from Khan Academy — follow your teacher").
4. **Mastery is demonstrated, not declared.** The system never tells the student they "know" something based on completion, clicks, or self-report. Mastery claims require quiz evidence at or above the family goal band on that subtopic.
5. **Shame-free, gap-forward framing.** All subjects present the gap to the goal as the mission ("3 subtopics to close for your 90"), never the deficit as a verdict. Language rules from the class-page standard apply everywhere: no judgment, no labels on the student, action-first.
6. **The student owns the plan; the AI advises.** Recommendations are presented as a proposed plan the student (and family) can adjust, not as orders. The AI's job is to make the trade-offs visible ("doing X means postponing Y — here's why I ranked it this way"), not to decide for the student.

---

## 5. The "Expert Guidance" Label Rule

Pookie's honesty requirement: the student and family must always be able to tell what kind of knowledge they are looking at. Every piece of AI-presented advice carries one of three labels:

- **Expert-authored pattern** — content written or approved by a subject expert (study strategies, worked-example templates, misconception diagnoses from the expert library). Rendered with the expert-guidance badge. Example: "Misconception pattern, reviewed by the physics expert: students often confuse velocity with acceleration when…"
- **Generated from your materials** — AI-generated content (quizzes, summaries, practice problems) with traceable sources in the student's uploads. Labeled as generated, with the source pointer visible. Never presented as expert-authored.
- **Observed data** — the student's own grades, quiz scores, check-in history, completion records. Labeled as observed. The AI may *interpret* observed data ("your scores dropped after the unit 3 test"), but the interpretation is labeled as AI analysis, distinct from the data itself.

### 5.1 Label rules

- **Labels are mandatory and visible.** No advice renders without its label. A missing label is a write-path gate failure.
- **Labels never upgrade.** Generated content does not become "expert-authored" through repetition or student approval. Only expert review upgrades a label.
- **No label laundering.** The AI may not present its own inference as observed data ("students like you usually…" is not observed data about *this* student). Population-level claims require a cited source or they don't ship.
- **Student-facing language.** Labels use plain words: "From a subject expert," "AI-generated from your class materials," "From your grades and quizzes." The taxonomy terms above are for internal documentation; the student sees the plain version.

---

*End of framework. Subject sections inherit these rules in full.*

---

# Part 1: Mathematics


*Author: Advanced Mathematics, department-chair standard. Middle school through AP Calculus BC and AP Statistics. Audience: the AI tutor, the Learn curator, the quiz generator. These are rules, not suggestions.*

---

## 1. Unit Structure

A math "unit" is **one idea fully conquered**, not a textbook chapter. Each unit has exactly one headline question the student can answer when done. Two headlines means two units.

- **Quadratics → three units:** (a) *Factoring and solving by structure* — "solve a factored quadratic and explain what the factors say." (b) *Completing the square / vertex form* — "turn any quadratic into vertex form; read off vertex, max/min, axis." (c) *Quadratic formula and discriminant* — "choose the right tool; predict real solutions before computing." Sequential.
- **Triangle congruence → three units:** (a) *Rigid motions; what congruence means* — decide congruence by transformation reasoning, not measuring. (b) *Congruence criteria* — prove with SSS/SAS/ASA/AAS/HL; SSA explicitly rejected. (c) *CPCTC and congruence proofs* — use congruence to conclude something new. Proofs come last; students who jump straight to proofs memorize a dance.
- **Limits → three units:** (a) *Limit as behavior* — describe approach from each side, including infinity and non-existence. (b) *Limit laws* — legal algebra; removable vs. non-removable discontinuities. (c) *The epsilon-delta idea* — state in words what a limit means.

**Every unit names its prerequisites explicitly, and they are enforced.** The entry screen shows "Assumes: integer exponents, factoring binomials, function notation." Fail the prerequisite checkpoint and the unit stays locked until re-earned. This is the most important mechanical rule here. Math fails cumulatively: a student at 69.5 in Geometry is not struggling with Geometry — they're struggling with eighth-grade algebra wearing a Geometry costume. The unit system must say that out loud.

Unit contents, in order: prerequisite checkpoint → one core explanation (§2) → worked examples with reasoning → hidden-solution try-it checkpoints → unit quiz (§3) → one genuinely interesting extension problem. Cap: ~45 minutes of focused work.

---

## 2. Excellent Study Material (and what to reject)

**Great material does three things at once: the procedure, the reason for the procedure, and the picture behind it.** Algebra without geometry is memorization; geometry without algebra is hand-waving.

Non-negotiables:

- **Worked examples narrate decisions, not just steps.** "We complete the square *because* this quadratic isn't factorable and we need vertex form — the quadratic formula would give roots but hide the vertex." Steps teach templates; decisions teach problem-solving.
- **Try-it checkpoints with solutions hidden until the student commits.** Ungated solutions are how a student reads the same factoring example eleven times and still can't factor.
- **Visual intuition alongside algebra.** Completing the square is a literal square being completed. Distributivity is area. A derivative is a tangent slope *before* it's a limit expression. No diagram, incomplete material.
- **One idea per screen.** Dense formula walls teach nothing.

**Reject unconditionally:** answer keys with no reasoning; formula sheets presented *before* understanding (formulas ship only as reference *after* the student has derived the result once); drill worksheets with 50 identical problems (five with increasing thought beats fifty identical ones); costume word problems that are routine problems in disguise (applications must force the student to *decide which mathematics applies*); multiple-choice-only practice for anything requiring a written chain of reasoning.

---

## 3. Practice-Quiz Standards

**Question types — every quiz mixes at least three:**

1. **Multi-step problems** (2–4 linked steps; grade the chain, not just the answer; partial credit is pedagogical).
2. **"Find the error"** — present a plausible wrong solution built from a real student error; the student identifies the faulty step and fixes it. The highest-leverage question type in math: it forces auditing reasoning, not just producing it.
3. **Explain-in-words** — "In one or two sentences, why does the discriminant determine the number of real solutions?" Scored leniently on phrasing, strictly on mathematical vocabulary errors.
4. **Non-routine applications** — unseen situations where the first job is *mathematizing*: choose the model, state assumptions, then compute. One per quiz minimum.
5. **Proof/reasoning items** (Geometry onward) — graded on logical validity; the AI tutor may give one hint, the *first line* of the proof, never more.

**Difficulty: fluency → application → extension.** 5–8 questions: two fluency ("can you execute?"), three application ("can you choose and adapt?"), one or two extension ("can you generalize or prove?"). A student who aces fluency and dies at application needs the decision-layer from §2, not more drills — the quiz report must say so explicitly.

**Spaced interleaving of prerequisites.** Every quiz reserves ~15–20% for a prerequisite skill from an earlier unit — fraction arithmetic inside a quadratics quiz, exponent rules inside a limits quiz. Non-optional. This is the early-warning system: three failed interleaved factoring items is a Geometry alarm, not a bad quiz day.

**Traceability to uploaded material.** Every question carries a tag pointing at its uploaded source ("Unit 3.2 worksheet Q4; teacher's completing-the-square slides"). Wrong answers link *directly* back to the source. Generator-invented types with no basis in class material must be labeled EXTENSION and disclosed as beyond class scope. Never fail a student on content they were never taught.

---

## 4. External Resources That Actually Work

No generic lists. Every resource is assigned to a unit with a stated one-line "why this, for this unit" purpose. No note, no listing. Max 2–3 per type per unit.

- **Desmos Classroom** — *intuition before formalism*. Polygraph (function vocabulary), the completing-the-square area model, Marbleslides (transformations). Assign when the unit's headline requires seeing before computing. Never as drill; its power is exploration.
- **DeltaMath** — *adaptive fluency with instant correction*. The tight attempt-feedback loop is unmatched for factoring, derivative rules, normal-curve calculations; its assignment structure punishes carelessness without punishing struggle. Fluency blocks only — it cannot teach a concept, and assigning it pre-understanding manufactures frustration.
- **YouTube — channels that teach problem-solving, not template-matching.** Professor Leonard (full-lecture pacing, explains *why* each move is legal — the best free classroom substitute); the Organic Chemistry Tutor (dense worked-example math playlists; best for night-before-test review). Reject any channel whose format is "watch me solve 20 identical problems" — that's template-matching, the failure mode this standard exists to kill.
- **Khan Academy** — *prerequisite repair and spaced review*. Its unit structure maps to §1's prerequisite discipline; its mastery system is the best free tool for re-earning a failed checkpoint. Assign specific units, never "go study on Khan."
- **Gimkit/Kahoot/Blooket/Quizlet** — *fluency games only*: theorem names, derivative rules, stat definitions. One per unit max. They have no business near a proof or multi-step derivation.

---

## 5. Misconceptions the AI Tutor Must Catch

The tutor is a diagnostician first, explainer second. Catch these every time, framed this way:

1. **"=" means "write the answer."** Reframe: "=" is a *claim* that two expressions name the same number. Until this lands, equation-solving is ritual. Test with `7 = 3 + 4` and watch the flinch.
2. **(a + b)² = a² + b².** Reframe with numbers: (2+3)² = 25, not 13. Then the area model. Never accept "that's just the rule" — the student must feel why the middle term exists.
3. **Slope confused with intercept.** Reframe: slope answers "how fast does it change?", intercept answers "where does it start?" (Resurfaces in Stats as confusing correlation strength with regression slope.)
4. **A proof is just examples.** Reframe: examples can only *disprove*; a proof must cover *every* case at once — that's why we reason about the arbitrary triangle, not the drawn one.
5. **Correlation implies causation.** Reframe: correlation measures linear association in *observed* data; causation needs a designed experiment or a mechanism. Flag "this proves X causes Y" in any student explanation.
6. **"Solving" a quadratic means one thing.** Students quadratic-formula everything, including x² = 16. Reframe: choose the *cheapest legal tool* — square root, factoring, formula as last resort. Efficiency is part of fluency.
7. **Phantom cancellation: (x + 2)/2 = x.** Reframe with numbers, then: you cancel *factors*, never *terms*. Treat as a prerequisite alarm.
8. **"Random" means "haphazard"; every sample is representative.** Reframe: random is a *procedure* (known selection chance), not a description of the outcome. A convenience sample is never random.

**Geometry-struggling student (e.g., Dawson, 69.5):** the tutor's first move is *never* Geometry content — it's an algebra audit: linear equations, factoring, fractions, exponents, distributivity. In fifteen years, the overwhelming cause of a Geometry collapse is not spatial reasoning; it's that proofs and multi-step problems expose every algebra hole at once, because Geometry is the first course where computation alone can't carry you. Say it directly, without shame: "Your Geometry grade is mostly telling us about algebra. That's fixable — and fixing it raises every math class you'll ever take." Repair the prerequisite with targeted interleaving (§3), then re-enter Geometry through the visual layer (Desmos, area models). Drilling more theorems at a student with broken factoring is malpractice.

---

## 6. Grade Calibration — The Abstraction Ladder

Each step adds one layer of abstraction, with a characteristic failure point. Calibrate support to the layer, not the grade level.

- **Middle school:** abstraction = *arithmetic becomes general*. Jump: numbers → variables as placeholders. Failure point: integer/fraction rules memorized as unrelated spells. Fluency here is non-negotiable — every later unit's interleaved questions draw from this layer.
- **Algebra I:** abstraction = *symbols carry structure*. Jump: computing answers → manipulating expressions. Failure point: symbol-shuffling mistaken for understanding (misconceptions #2, #6, #7 live here). The "=" misconception must die here or it haunts everything.
- **Geometry:** abstraction = *truth requires proof*. Jump: "the answer is right" → "the reasoning is valid." Failure point: example-based "proofs" (#4) plus prerequisite algebra (see §5). Scaffold heavily (fill-in-the-blank reasons → two-column → paragraph); never remove scaffolding faster than earned.
- **Algebra II:** abstraction = *functions as objects*. Jump: equations → functions you transform, compose, invert. Failure point: f(x) read as "f times x"; logarithms memorized as rules, not inverse exponents. Every new function family gets §2: graph first, algebra second, one genuinely interesting application.
- **Precalculus:** abstraction = *mathematics about mathematics*. Jump: limits previewed, identities proved, recursion. Failure point: template-survivors hit the wall — Precalc rewards structural recognition (a difference of squares hiding in a trig identity). "Find the error" quizzes (§3) pay off most here.
- **AP Calculus AB/BC:** abstraction = *the infinite made rigorous*. Jump: finite algebra → limits, instantaneous rates, accumulation. Failure point: the chain rule and related rates — students who can't see composition can't differentiate it. The Fundamental Theorem must be *understood* as rate↔accumulation, not memorized as two formulas. Desmos-first intuition for every theorem; FRQ-style multi-part questions from the first unit, because the exam is the genre and the genre must be practiced.
- **AP Statistics:** abstraction = *uncertainty is itself mathematical*. Jump: deterministic answers → inference under randomness. Failure point: vocabulary without meaning (reciting "p-value" with no idea what it is) and the causation error (#5). Anchor every concept in a real dataset; simulation before formulas; the four-step inference template (state, plan, do, conclude) drilled as a *thinking* scaffold, not a fill-in form.

The rule across every level: **an abstraction jump is never crossed by more practice at the old level.** More Algebra I drill doesn't prepare a student for proof; more computation doesn't prepare a student for inference. Each level's materials must teach the new kind of thinking explicitly. That is what this standard enforces.

---

# Part 2: Physics


*Authoring perspective: department chair, 15+ years teaching conceptual → honors → AP Physics 1 → AP Physics C. This standard spans grades 6–12.*

Physics is not a collection of equations. It is a way of modeling the physical world: identify the system, draw the forces, write the model, check the limit. Every unit, every material, every quiz in this Learn section must serve that arc. If a resource teaches "which equation do I plug into," it fails this standard.

---

## 1. Unit Structure

Chunk physics the way physicists chunk it: **one conservation principle or one model of motion per unit**, not one formula set per chapter.

**Recommended unit spine (algebra-based / AP Physics 1):**
1. **Kinematics** — motion described, not explained. Position, velocity, acceleration as rates of change; x–t / v–t / a–t graphs as the primary language; projectile motion as *two independent 1-D motions*.
2. **Newton's Laws / Forces** — the free-body diagram as the unit's thesis. Static and dynamic equilibrium, friction, tension, normal force, inclined planes. The FBD is not a step; it *is* the physics.
3. **Circular Motion & Gravitation** — centripetal acceleration derived, not asserted; Newton's law of universal gravitation; orbits and Kepler.
4. **Work, Energy, Power** — work–energy theorem; kinetic, gravitational, elastic potential energy; conservation of mechanical energy; conservative vs. non-conservative forces.
5. **Linear Momentum** — impulse–momentum, conservation in isolated systems, elastic vs. inelastic collisions.
6. **Torque & Rotation** — rotational kinematics, moment of inertia, angular momentum conservation. (AP 1: basic. AP C: calculus-rich.)
7. **Simple Harmonic Motion & Waves** — pendulums, mass-spring systems, wave properties, sound. Often under-taught; do not skip.
8. **Electrostatics & Circuits (AP 1 / conceptual honors)** — Coulomb's law, electric field as a real entity, circuits via energy/current conservation.
9. **Fluids (AP 2)** — pressure, buoyancy, Bernoulli. **Thermo (AP 2)** — kinetic theory, first/second laws. **Modern (AP 2)** — quantum intro, atomic/nuclear.

**What belongs in a unit:** the unit's governing principle, its 3–4 canonical models (e.g., "block on incline," "two-body collision"), its canonical graphs, its canonical lab (e.g., Atwood machine data, projectile launcher), and its canonical misconception traps. **What doesn't belong:** cross-unit formula sheets, mixed-topic "test prep packs," or worked examples whose setup is already done for the student — the setup IS the skill.

---

## 2. Excellent Study Material

**Excellent physics material has three non-negotiables:**

1. **Free-body diagrams are first-class citizens.** Every forces problem begins with a complete, labeled FBD — axes chosen deliberately, components drawn. A study sheet that shows an equation without the FBD that produced it is incomplete and should be flagged.
2. **Multiple representations, always.** The same situation shown as: a words description → an FBD → a motion diagram → a graph → an equation → a limiting-case check ("as θ→0, friction→0 — does my answer agree?"). Students who can translate between representations understand; students who can only read one are pattern-matching.
3. **Derivation over declaration.** Centripetal acceleration, the work–energy theorem, impulse–momentum — these are *derived in front of the student*, not handed down. Memorized derivations are fine; un-derived "magic formulas" are not.

**REJECT:**
- Formula dumps and "equation sheets" with no conditions of applicability. *K = ½mv²* without "for a rigid body, v of the center of mass" is a lie by omission.
- "Which equation do I use?" decision trees that skip reasoning. They train equation-hunting, the exact habit physics must kill.
- Videos that solve problems on camera at speed with the FBD drawn as an afterthought (or never). If the solver didn't struggle with the setup, the student learns nothing from watching the algebra.
- Any material that presents centrifugal force as a real force in an inertial frame. (See misconceptions.)

**ACCEPT and elevate:** annotated student-worked solutions with the *reasoning* narrated ("I'm choosing the system boundary here because…"), PhET-linked concept checks, data-driven labs where students fit graphs before seeing the equation, and error-analysis writeups ("our measured g was 9.4 — here's where the 4% went").

---

## 3. Practice-Quiz Standards

Every quiz question must trace to uploaded unit material: cite the source (handout, slide deck, textbook section) per question. No orphan questions.

**Question types that test physics thinking (use all of these; never a quiz of pure plug-and-chug):**
- **Conceptual ranking tasks.** "Rank the four situations by the magnitude of the normal force." No numbers needed. This is the single best diagnostic of understanding in physics.
- **Sketch-the-graph.** "A ball is thrown upward. Sketch v–t from release to landing." Then: "Now sketch a–t on the same axes." Graph literacy is physics literacy.
- **"What's wrong with this solution" error hunts.** Present a full worked solution with one planted error — a missing force on the FBD, a sign error from an undeclared coordinate system, energy conservation applied where friction acts. The student must find it and explain the *physics* consequence, not just the arithmetic.
- **Limiting-case checks.** "Your derived expression for the tension is T = mg·cosθ. What does it predict at θ = 90°? Is that physical? If not, where did the derivation break?"
- **System-choice questions.** "You may define the system as (a) the block alone, (b) block + Earth, (c) block + spring + Earth. Which choice makes energy conservation simplest? What changes in each accounting?"
- **Two-path problems.** "Solve this collision with momentum conservation, then verify with the work–energy theorem. Do they agree? Which was easier and why?"

**Difficulty progression (every quiz, same arc):**
1. *Translate* — FBD or graph from a verbal description. (Can they set up?)
2. *Apply* — single-principle quantitative problem with clean numbers. (Can they execute?)
3. *Connect* — two principles in one scenario (forces → energy, momentum → energy). (Can they choose?)
4. *Defend* — ranking task, error hunt, or limiting-case argument. (Can they reason like a physicist?)

**Difficulty rule:** a question is not "hard" because the algebra is messy. Hard = the *modeling decision* is ambiguous. Keep the arithmetic clean; make the setup the challenge.

---

## 4. External Resources That Actually Work

Curate to the unit. Never more than 2–3 per type per unit, and every pick must have a stated purpose.

- **PhET Interactive Simulations (non-negotiable, embed by name):**
  - *Forces and Motion: Basics* — the friction/tension intuition builder; use before inclined planes.
  - *Projectile Motion* — kills "heavier falls faster" dead; have students predict, then test.
  - *Energy Skate Park* — conservation of energy made visceral; the bar-graph view is the lesson.
  - *Collision Lab* — momentum conservation with adjustable elasticity; pairs with every momentum quiz.
  - *Circuit Construction Kit* — current as flow of charge, not "electricity as magic."
  Purpose statement for each: what prediction the student should make *before* touching the sim. A sim without a prediction step is a toy.
- **YouTube — intuition builders, not solution channels:**
  - *Flipping Physics* — derivations done honestly, FBD-first, AP-aligned; excellent for AP 1 review.
  - *Michel van Biezen* — exhaustive worked examples, good for the "I've seen the setup, now I need reps" stage. Judge clearly: reps, not insight.
  - Explicitly AVOID as primary study material: channels that race through problem sets with no FBD and no conceptual framing. They're fine for cramming; they are not learning.
- **Khan Academy** — best used for the *pre-read*: its kinematics and forces sequences are solid for first exposure. Weakness: problems skew plug-and-chug; do not treat KA completion as mastery.
- **AP Classroom** — the only source that defines what the AP exam actually asks. Every AP unit must link its AP Classroom topic questions; the AI tutor must know their style (heavy on reasoning, light on arithmetic).
- **Desmos** — for kinematics graph construction and exploring parameter effects (e.g., how launch angle changes range — slider before formula).
- **DeltaMath / teacher problem banks** — acceptable for procedural reps *after* the concept quiz is passed. Reps before understanding calcify misconceptions.

**Judgment rule:** if a resource lets the student succeed without drawing a diagram or making a prediction, it is entertainment, not study material. Label it honestly.

---

## 5. Misconceptions the AI Tutor Must Catch

The tutor must detect these in student chat and correct with the framing given — never with "actually, you're wrong," always with a targeted question or experiment first.

1. **"Force implies motion" / impetus thinking.** The belief that a constant force is needed to sustain constant velocity. *Catch:* student says "the force ran out" or draws a forward force on a coasting object. *Correct framing:* "What does Newton's first law say about an object already moving with no net force?" → friction is the hidden force; in space, coasting needs nothing.
2. **Velocity–acceleration confusion.** "It's slowing down so acceleration is negative" (without a defined coordinate system) or "at the top of the toss, velocity is zero so acceleration is zero." *Correct framing:* acceleration is the *rate of change* of velocity. At the top, v = 0 but v is still changing — a = −g. Demand a coordinate system before any sign talk.
3. **Heavier falls faster.** *Correct framing:* in free fall, a = F/m = mg/m = g — mass cancels. Then the honest follow-up: air resistance is why feathers differ, and that's a *different force*, not a different gravity.
4. **Centrifugal force as a real force.** Students add an outward arrow on FBDs in inertial frames. *Correct framing:* in the ground frame, the only horizontal force on a turning car is inward friction — that's what *causes* the turn. The "outward fling" is inertia, felt only in the rotating frame, and it never belongs on an inertial FBD.
5. **"Equal and opposite" misapplied.** Students cancel action–reaction pairs as if they act on the same object ("the forces cancel so nothing moves"). *Correct framing:* the pair acts on *two different objects*. Draw both FBDs separately; nothing cancels within one diagram.
6. **Energy vs. momentum confusion.** Using conservation of energy for an inelastic collision, or momentum for a block sliding with friction. *Correct framing:* "Is the system isolated? Are non-conservative forces doing work?" — the two-question gate before choosing the principle.
7. **Current "gets used up" in circuits.** Bulbs in series "use up" current so later bulbs are dimmer. *Correct framing:* current is conserved (charge has nowhere to go); what drops is *potential*. The water-flow analogy done right, or better, the PhET circuit sim with ammeters.
8. **Graphs read as pictures.** A v–t graph's rising line read as "the object is going uphill." *Correct framing:* "What do the axes say?" — drill axis-first reading until it's reflex.

**Tutor protocol for all eight:** (1) notice the misconception pattern in the student's words, (2) ask the one diagnostic question listed, (3) only then give the correct framing, (4) follow with a *new* scenario testing transfer. Correcting without a transfer check is telling, not teaching.

---

## 6. Grade Calibration: What Changes at Each Tier

- **Conceptual physics (grades 6–9, non-math track):** The goal is *qualitative mastery of the models*. Success = correct FBDs, correct graph sketches, correct ranking-task reasoning, correct limiting-case arguments — with little or no algebra. Do not penalize a student who reasons perfectly but can't solve simultaneous equations. Quizzes here are 80% conceptual.
- **Honors physics (grades 9–11):** Same models, now quantitative. Success = clean algebra, unit analysis on every answer, significant figures respected, multi-step problems (forces → kinematics) executed reliably. The FBD is still graded — an answer with no diagram earns partial credit at most. Introduce error analysis in labs properly.
- **AP Physics 1 (algebra-based, college-level):** The College Board's bar is *reasoning under novel scenarios*. Success = paragraph-length justifications ("claim–evidence–reasoning"), experimental-design questions, translating between representations fluently, and solving problems where the principle to apply is deliberately unstated. Quantitative work is straightforward by design; the exam punishes equation-hunters. Quiz standard: every AP 1 quiz includes at least one "design an experiment" and one "justify with physics principles" item.
- **AP Physics C (calculus-based):** Everything above, plus calculus as the *native language*: derivatives for instantaneous rates (v = dx/dt, a = dv/dt), integrals for work with variable forces and moments of inertia, differential equations for simple harmonic motion and RC circuits. Success = setting up and evaluating the calculus correctly *from the physics* — the integral is worthless without the correct integrand, and the integrand comes from the FBD. Mechanics and E&M are separate exams; do not blend their preparation.

**Cross-tier constant:** the FBD (or its equivalent system diagram) is required at every level, including conceptual. The day a student is allowed to skip the diagram is the day they stop doing physics and start doing algebra with units attached.

---

# Part 3: Chemistry


*Expert: High-school chemistry chair, AP Chemistry teacher (15+ years). Standard spans grades 6–12 through AP. Be opinionated — this is the bar, not a suggestion box.*

## 1. Unit Structure

A chemistry unit is a **conceptual story with a beginning, middle, and a lab that proves it**. Chunk by idea, not by chapter number. A unit that takes more than 3 weeks is two units; a unit shorter than 4 days is a topic, not a unit.

**Standard chunking (honors chem / AP pacing):**

- **Matter & Measurement** — classification of matter, physical/chemical change, density, significant figures, unit conversions. This is tooling, not the point — keep it under 2 weeks.
- **Atomic Structure & the Periodic Table** — subatomic particles, isotopes, electron configuration, periodic trends (radius, ionization energy, electronegativity). Trends must be taught as *explanations*, not memorized arrows. If a student can't explain *why* ionization energy increases across a period using Coulombic attraction and shielding, they don't know the trend.
- **Bonding & Molecular Geometry** — ionic vs. covalent, polarity, VSEPR, intermolecular forces. IMFs are the single most under-taught topic in chemistry; they explain half of everything later (solubility, vapor pressure, chromatography).
- **Chemical Reactions & Stoichiometry** — balancing, reaction types, mole conversions, limiting reactant, percent yield. Stoichiometry is a *language*, not a unit — it must be revisited inside every later unit or students lose it by February.
- **Thermochemistry** — heat vs. temperature, calorimetry, Hess's law, bond enthalpies, enthalpy of formation.
- **Gases** — kinetic molecular theory, gas laws, ideal gas law, partial pressures, effusion.
- **Solutions** — concentration units, dilution, solubility, colligative properties.
- **Kinetics** — rate laws, mechanisms, collision theory, activation energy.
- **Equilibrium** — K expressions, Le Châtelier, ICE tables, solubility product.
- **Acids & Bases** — pH, strong/weak, buffers, titrations.
- **Electrochemistry** — redox, galvanic/electrolytic cells, standard reduction potentials (AP).
- **Nuclear** — decay modes, half-life (brief; it's a coda, not a full unit).

**What belongs in a unit:** the core model, its quantitative treatment, its particle-level picture, at least one lab or demo anchoring it, and its connections forward. **What doesn't:** historical trivia (phlogiston is a paragraph, not a quiz question), plug-and-chug drills disconnected from any concept, and cross-unit premature problem types (no equilibrium ICE tables inside the stoichiometry unit — that poisons both).

**Spiral rule:** Stoichiometry, dimensional analysis, and significant figures are *unit zero* but they are *assessed inside later units*, never again as standalone quizzes after October.

## 2. Excellent Study Material

**Excellent looks like:**

- **Worked examples where every unit is written out in dimensional analysis, every time.** No naked numbers. The conversion factor chain is the pedagogy — a student who can write `(25.0 g H₂O)(1 mol / 18.02 g)(6.022×10²³ molecules / 1 mol)` has learned something; a student who writes "2.30" has learned to copy. Acceptable study material *shows the factor-label chain for every calculation*, including trivial ones.
- **Particle diagrams as first-class citizens.** Any topic that can be drawn at the particulate level must be: dissolving, precipitation, gas pressure changes, equilibrium shifts, buffer action. If the material only shows symbols and never atoms/molecules/ions, it is incomplete.
- **Lab-data interpretation, not just lab procedure.** Give students a messy data table (with an obvious outlier, a unit error, a missed calibration) and ask: what's wrong, what's the conclusion, what would you redo. Real AP free-response questions are increasingly this.
- **Model-to-math bridges.** "Here's the particle picture of a weak acid in water — now write the Kₐ expression." Material that never asks the student to translate between representations is decoration.

**REJECT outright:**

- Formula sheets with no derivation or limits. A student handed `PV = nRT` with no statement of "ideal gas, low pressure, high temperature" will apply it to a liquid. Every formula ships with its *assumptions and failure modes*.
- "Memorize the polyatomic ions" decks with no patterns. There are patterns (−ate/−ite families, charge families, common prefixes). A deck that treats nitrate and sulfate as unrelated facts is lazy and it shows.
- Worksheets that are 40 identical limiting-reactant problems. Three problems with full reasoning beats thirty with a calculator.
- Anything that presents the periodic table as a poster to admire rather than a tool to use. Trends, electron configurations, and reactivity predictions must be *practiced with the table in front of them*.

## 3. Practice-Quiz Standards

**Question types that test understanding, in order of cognitive demand:**

1. **Particulate-level reasoning (mandatory in every quiz).** "A flask contains the mixture shown. The temperature is doubled at constant volume. Draw the new particle picture." / "Which diagram represents a strong acid vs. a weak acid at the same concentration?" Multiple-choice is fine *only if* the distractors encode real misconceptions (e.g., molecules that have fused together for a dissolved salt).
2. **Prediction before calculation.** "Before you touch your calculator: will the pH of this solution be greater than, less than, or equal to 7? Explain." This kills plug-and-chug.
3. **Error analysis.** "A student calculates the molarity as 0.050 M but the accepted value is 0.50 M. Identify the single most likely error and explain how it shifts the result." Chemistry is full of factor-of-10 traps; quizzes should reward the student who catches them.
4. **Lab-scenario questions.** "During a titration, the student overshoots the endpoint by 2 mL of NaOH. Is the calculated Kₐ too high or too low? Justify with the expression." These are the hardest questions and must appear on every major assessment.
5. **Multi-step stoichiometry embedded in a real context.** "A 2.50 g antacid tablet neutralizes stomach acid..." — never "calculate the moles of X given Y grams" naked.

**Difficulty progression within a quiz:** Start with one confidence-builder (single concept, clean numbers). Middle questions add a twist (excess/limiting, a unit conversion, a "justify" clause). The final 2–3 questions are *synthesis*: lab scenario, error analysis, or a prediction that requires two units of knowledge. The hardest question on a unit quiz should be answerable only by a student who understood the *model*, not one who memorized the procedure.

**Traceability rule:** Every question must cite its source: the specific uploaded handout, slide deck, or lab it draws from. If the AI generates a quiz from uploaded unit material, it must name the document and concept for each question — e.g., "Source: Unit 4 handout 'Limiting Reactant,' p. 2 — tablet neutralization example." If the uploaded material doesn't support a question type the unit needs (no particle diagrams in the teacher's slides), the quiz notes the gap and generates the question anyway, flagged as *AI-supplemented*. Never pretend the material covered something it didn't.

## 4. External Resources That Actually Work

Max 2–3 per type. Curated means *judged*, not listed.

**PhET (non-negotiable — this is the best chemistry teaching tool ever built):**
- *Build an Atom* and *Isotopes and Atomic Mass* (atomic structure unit — students who play with these stop confusing atomic number and mass number).
- *Reactants, Products and Leftovers* and *Balancing Chemical Equations* (stoichiometry — the sandwich analogy made rigorous).
- *Acid-Base Solutions* and *pH Scale* (acids/bases — the macro/micro views side by side are worth more than a week of lecture).
- *Reactions & Rates* (kinetics) and *Reversible Reactions* (equilibrium — watching particles at dynamic equilibrium kills the "reactions stop" misconception dead).

**YouTube — teach vs. entertain, judged:**
- **Tyler DeWitt** — the gold standard for struggling students. He teaches like a tutor sitting next to you, not a lecturer. Use for first exposure and repair work.
- **Professor Dave Explains** — fast, precise, AP-level density. Use for review and honors/AP students who need efficiency, not hand-holding.
- **The Organic Chemistry Tutor** — enormous library, excellent for worked problem sets. Caveat: his pace is a firehose; assign specific videos, never "watch his channel."

**Khan Academy:** Solid for stoichiometry and atomic structure practice with instant feedback. Weak on lab reasoning and particulate-level questions — supplement, don't rely.

**DeltaMath:** The best drill tool for dimensional analysis and stoichiometry because it forces students to show the setup. Use for *practice*, never as the quiz.

**Quizlet/Gimkit:** Acceptable only for nomenclature and polyatomic ion patterns — the one place where fast recall has real value. Never use for concepts; speed games reward the wrong kind of knowing.

**AP Classroom:** Mandatory for AP Chem. The progress checks and the released FRQs are the actual exam language. If an AP student isn't doing AP Classroom FRQs by second semester, the teacher is failing them.

## 5. Misconceptions the AI Tutor Must Catch

The tutor must detect these *in the student's own words* and correct them immediately, with the right framing — not a scolding, a better model.

1. **"Moles and molarity are the same thing."** Framing: *Moles are a count of particles (a dozen is to eggs as a mole is to atoms). Molarity is a concentration — moles per liter of solution. You can't have "molarity of a solid."* Test: ask the student what the units of each are.
2. **"Heat and temperature are the same."** Framing: *Temperature is the average kinetic energy per particle; heat is energy transferred. A bathtub of lukewarm water holds more heat than a cup of boiling water.* This misconception survives into AP if never confronted.
3. **"Equilibrium means the concentrations are equal."** Framing: *Equilibrium means the forward and reverse rates are equal — the reaction is still happening, at the same speed both ways. K tells you the ratio at equilibrium, and it's almost never 1.* Show the particle-level picture of dynamic equilibrium.
4. **"Mass is conserved, so the mass of products always equals the mass of reactants I weighed."** Framing: True only in a *closed system*. Gases escaping (or entering) change the measured mass — this is exactly why the burning-magnesium lab confuses students.
5. **"Breaking bonds releases energy."** Framing: *Breaking bonds always requires energy input; forming bonds releases energy.* The sign error in thermochemistry comes from this sentence being backwards in students' heads. Drill it until it's reflex.
6. **"A strong acid is concentrated and a weak acid is dilute."** Framing: *Strong/weak is about how completely it dissociates; concentrated/dilute is about how much is in the solution. You can have a dilute strong acid and a concentrated weak acid.* This one appears on every AP exam in some form.
7. **"The limiting reactant is the one with the smallest mass / fewest moles."** Framing: *It's the one that runs out first relative to the balanced equation's ratios. You must convert to moles and compare against the coefficients — the smallest mass is a guess, not a determination.*
8. **"Electrons are lost/gained in a fixed order, and oxidation numbers are real charges."** Framing: *Oxidation numbers are bookkeeping, not physics. In covalent compounds nobody "owns" the electrons. Treat them as a tracking tool for redox, not a description of reality.*

## 6. Grade Calibration

**Middle school physical science (grades 6–8):** Everything is *macroscopic and qualitative*. Classify matter, observe physical vs. chemical changes, read a thermometer, measure density. Atoms are introduced as "tiny particles that make up everything" — no electron configurations, no moles, no equations beyond word equations. Labs are observation and measurement. The goal is vocabulary and curiosity: the student should leave able to *describe* what happens when vinegar meets baking soda, not balance it.

**Honors high-school chemistry:** The mole arrives, and with it quantitative chemistry — stoichiometry, gas laws, molarity, calorimetry, equilibrium constants. Particle-level models become mandatory: every major topic gets its diagram. Math stays at algebra level; ICE tables are introduced but simple; logs appear only for pH. Labs require real data analysis: percent error, graphing, identifying the limiting reactant from data. The goal is *fluency* — the student can set up and solve any standard problem type and explain what the answer means physically.

**AP Chemistry:** Everything deepens and the exam format reshapes the teaching. New at this tier: detailed kinetics (rate laws from data, mechanisms, integrated rate laws), full equilibrium treatment (buffers, titrations, Ksp with common ion), electrochemistry (cell potentials, Nernst, Faraday's law), thermodynamics with Gibbs free energy and entropy, and multi-representation fluency — the AP free response demands translating between particle diagrams, graphs, equations, and prose *in a single question*. Math includes logarithms and graphical analysis (ln vs. 1/T plots). Justification is graded: "claim, evidence, reasoning" is the unit of currency. Uncertainty analysis enters labs. The goal is *expert reasoning* — the student doesn't just solve the problem, they defend the model behind it.

**What stays conceptual at every tier:** the particulate nature of matter, conservation of mass/energy, and the habit of asking "what are the particles doing?" Nothing in chemistry is ever just a formula.

---

# Part 4: Biology


*Voice: department-chair biology, 15+ years, AP Bio reader. This is the bar. Anything below it gets rejected, not revised.*

## 1. Unit Structure — What a Biology "Unit" Contains

Biology organizes by **system → mechanism → evidence**, not chapter number. One unit = one coherent causal story the student can retell end-to-end: *here's what happens, here's how we know, here's what changes if you perturb it.* A unit that can't carry that summary is badly scoped.

**Canonical chunking (grades 9–12; middle school draws from a subset):**

1. **Biochemistry of Life** — water, carbon, the four macromolecule classes, enzymes. Exists so the student can explain *why* a membrane is a phospholipid bilayer and *why* ATP works.
2. **Cells & Membranes** — structure-to-function, transport, tonicity reasoning. Diagrams must show arrows with direction and driving force — never the organelle list as a memory event.
3. **Cell Energetics** — photosynthesis and cellular respiration as coupled, complementary redox processes. The unit is the *flow of energy and electrons*; Krebs intermediates are reference material, not a memorization gauntlet.
4. **Cell Cycle, Division & Communication** — mitosis/meiosis mechanics, checkpoints, signaling basics. Cancer belongs here as regulation failure; phase-name recitation without chromosome-count reasoning does not.
5. **Heredity** — Mendelian and non-Mendelian patterns (incomplete dominance, codominance, linkage, sex-linkage), pedigrees. Punnett squares must be grounded in meiosis — drills that never ask *why* the ratios emerge are rejected.
6. **Gene Expression & Biotechnology** — replication, transcription/translation, regulation, mutations, PCR, gels, CRISPR. The central dogma is a flow of *information*; regulation is the interesting part.
7. **Evolution** — natural selection, Hardy-Weinberg, speciation, phylogenetics, evidence. Population-level thinking with real-study data — never "survival of the fittest" without allele-frequency math.
8. **Ecology & Systems** — energy flow, nutrient cycles, population dynamics, human impact. Conservation-of-matter reasoning; biome fact sheets don't anchor a unit.

**Chunking rule:** interleaving kills mastery. Anatomy/taxonomy stays in its own track, never woven into molecular units.

## 2. Excellent Study Material vs. Material to Reject

**Excellent material has three non-negotiable properties:**

- **Redrawable processes.** One canonical diagram per unit reproducible from a blank page: light reactions with electron-flow arrows, translation with ribosome movement, the lytic cycle. Labeled by *function*, not name-tag.
- **Real experimental figures.** Bar graphs with error bars, gel photos, phylogenetic trees, age-structure pyramids — each with a one-line methods context ("mice were fed diet X for 8 weeks") so interpretation is about biology, not guessing. Invented-number stock graphs train nothing.
- **Vocabulary in functional context.** "Chemiosmosis" appears *while* tracing protons across the thylakoid membrane, never in an alphabetical list. A glossary is a reference shelf, not a study method.

**REJECT without mercy:** vocabulary decks divorced from processes (the single biggest time-waster in high-school biology); pretty diagrams with no labels-to-function mapping; coloring-book worksheets above 6th grade; fact trivia ("who discovered the Calvin cycle") inside units claiming to teach reasoning.

## 3. Practice-Quiz Standards

Every quiz is generated from uploaded unit material and **must be traceable** — each question cites the upload, section, and diagram it tests. A quiz that can't show its source fails the standard.

**Required question types (mixed per quiz, weighted by tier):**

- **Data-based questions (AP-style).** Demand a data-supported claim from a figure, or ask what additional data would test a hypothesis. Minimum 30% of any honors/AP quiz.
- **Perturbation predictions.** "Rubisco is knocked out — predict the effect on G3P and justify." "The sodium-potassium pump stops — what happens to the resting potential?" The gold standard: separates mechanism-understanding from label-matching.
- **Experimental-design critiques.** Hand over a flawed experiment (no control, confound, n=3); ask what's broken and why. One minimum per honors/AP quiz.
- **Structure-to-function reasoning.** "Why does the alveolus have this shape?" Form explained by function, never the reverse.
- **Targeted recall (capped).** Max 20%, and recall must gate a reasoning question ("state the reactants, then explain why…").

**Difficulty progression:** L1 — label the canonical diagram. L2 — explain a step's mechanism in own words. L3 — predict perturbation outcomes. L4 — design/critique experiments, justify with data. Start at the student's demonstrated level, push one rung up; acing L1 earns zero more L1 drills. Wrong answers trigger a targeted reteach of the specific diagram section — never a generic "review the unit."

## 4. External Resources That Actually Work

Max 2–3 per type per unit, matched to unit topics. A resource earns a slot by teaching a *process*, not by production value.

- **HHMI BioInteractive** — the single best free source in biology education. The lizard evolution virtual lab and lactase persistence materials teach selection with real data. First pick for evolution, gene expression, and ecology, every time.
- **Amoeba Sisters (YouTube)** — cartoons that genuinely encode processes for middle-school and on-level high school. Hard ceiling: they simplify past AP. First-pass for grades 6–9; never the AP resource.
- **PhET "Natural Selection" sim** — the rare interactive producing real conceptual change; students watch allele frequencies shift and *feel* population thinking click. Assign *before* the vocabulary, not after.

For AP exam-season consolidation (not first learning): Bozeman Science / Paul Andersen — dense, accurate, College Board-structured, dry by design. Khan Academy serves as the reference text, not the hook.

**Does not make the cut:** narrated-Wikipedia channels (fact-dense, process-poor); "study with me" content; quiz apps as the primary learning mode — Quizlet is fine for term retrieval *after* the mechanism is learned, never as the way in.

## 5. Misconceptions the AI Tutor Must Catch

The tutor interrupts and corrects on sight — never lets these pass, never softens them. Each correction reframes with the right model:

1. **Evolution as intentional (Lamarckian "trying to adapt").** Reframe: populations evolve, individuals don't. Variation exists first; selection acts on it. Redirect to allele frequencies, always.
2. **Plants "make" energy in photosynthesis.** Reframe: energy is converted, never created — light → chemical energy in glucose. Conservation of energy applies.
3. **Genes as blueprints.** Reframe: genes are recipes for building proteins via RNA, not architectural blueprints — the same recipe yields different results under different regulation and environments.
4. **"Dominant = better / more common."** Reframe: dominant describes inheritance pattern only. Dominant alleles can be rare and harmful (Huntington's); recessive alleles can be nearly universal. Decouple the word from all value judgment.
5. **"Theory" means "unproven guess."** Reframe: a theory is science's highest-status explanation — a well-substantiated framework. Evolution is both observed fact (allele frequencies change) and theory (the explanatory framework).
6. **Respiration is for animals; photosynthesis is "plant respiration."** Reframe: all eukaryotes with mitochondria respire, plants included — plants photosynthesize *and* respire. Keep the two equations distinct.
7. **Mutations are always harmful.** Reframe: most are neutral, some harmful, a few beneficial — and "beneficial" is environment-dependent (sickle-cell vs. malaria). Selection, not mutation, is the directional force.
8. **Food chains as ladders with a species "at the top."** Reframe: food webs, ~10% transfer per trophic level, decomposers closing the loop. "Top" is human vanity, not ecology.

## 6. Grade Calibration — Middle School → Honors → AP

The spine at every tier is AP's **four Big Ideas** — Evolution, Energetics, Information Storage & Transmission, Systems Interactions — scaled by depth, never by different content:

- **Middle-school life science (6–8):** Phenomena first. Observe, model, argue from evidence: grow plants under different light, simulate selection with beads, build cell models where every part's job is stated. Small functional vocabulary. Success = "I can explain what happens and show you." No pathway memorization, no math beyond reading graphs.
- **On-level high school (9–10):** Mechanisms enter. Trace matter and energy through energetics, run Punnett squares grounded in meiosis, read experimental graphs, write claim–evidence–reasoning explanations. Success = "I can trace the process and predict one thing that breaks it."
- **Honors:** Quantitative reasoning and experimental design join — Hardy-Weinberg, chi-square crosses, enzyme rate graphs with error bars, adapted primary literature. The jump is in *what counts as justification*: a claim without data is marked wrong. Success = "I can defend my answer with data from the figure."
- **AP Biology:** The Big Ideas become the explicit lens and everything connects — energetics explains endotherm food demand, regulation explains development, phylogenetics is evolution made quantitative. 25% of class time is investigation; free-response is experimental design and data analysis. Memorized pathways are worthless without application. Success = "I can take an unfamiliar experiment, identify the variables, interpret the statistics, and connect the result to a Big Idea."

**Non-negotiable progression rule:** no tier skips the tier below. An AP student who can't redraw the electron transport chain has a Level-1 gap, and the tutor remediates at Level 1 — no shame, just the right rung. Depth is vertical within the same ideas, never a new set of facts.

---

# Part 5: Anatomy & Physiology


**For the Pookie Learn section. Written by the A&P content expert.**
**Calibrated for:** 10th-grade high school A&P, pre-med seriousness track. Reference student: Dawson, 15, future anesthesiologist. Dual-track: rock-solid high-school foundations, top end stretched toward the anatomy anesthesia demands (cardiovascular, respiratory, nervous). Anything that would embarrass a first-year med student gets cut.

---

## 1. Unit Structure

**A&P is systemic, full stop.** Each unit is one body system, following the same four-beat arc:

1. **Structure** — what it is, where it is, what it's made of. Students *draw and label* key structures from memory before touching physiology.
2. **Function** — what it does, mechanistically. "Name the four chambers" is worthless unless followed by "why is the left ventricular wall thicker than the right's?"
3. **Regulation** — neural and hormonal control, negative feedback, homeostasis. No feedback loop = incomplete unit.
4. **Clinical correlates** — the pathology and practice connections that make memorization *matter* (e.g., why anesthesiologists obsess over preload/afterload/contractility). Consequences a future clinician must reason through, not trivia.

**Regional vs. systemic:** Pookie uses the **systemic approach**. Regional anatomy (head, neck, thorax…) belongs in medical-school gross anatomy with a cadaver lab. Non-negotiable.

**Granularity:** 11–12 units. Integumentary can be compressed; Nervous and Cardiovascular get double time — most clinical weight, most anesthesiology relevance.

---

## 2. Excellent Study Material — and What to Reject

**Great material:**
- **Labeled diagrams students must reproduce, not recognize.** Standard: blank-outline + reproduce-from-memory with "cover the labels" protocols.
- **Structure-function reasoning chains.** Every fact arrives as structure → mechanism → consequence. Missing link = incomplete chain.
- **Clinical correlates that motivate memorization.** "The SA node fails → the AV node takes over at 40–60 bpm → that's why heart block patients need a pacemaker" makes the fact stick and pre-loads clinical reasoning.
- **Comparison tables.** Sympathetic vs. parasympathetic. Ligament vs. tendon. A&P is a subject of distinctions; tabular contrast builds them.

**Reject:**
- **Unlabeled diagrams with no labeling exercise.** Decoration, not study material.
- **Pure Latin-term memorization without function.** Terms earn their keep through function or get cut.
- **Anything that invites self-diagnosis.** "Symptoms of X" / "do you have Y?" framing is banned. Clinical correlates stay in third person — never symptom checklists aimed at the student. (See §7.)
- **Oversimplified animations that lie.** Accuracy gate first, production value second.

---

## 3. Practice-Quiz Standards

**Question types (priority order):**

1. **Practical-style identification.** "Label the indicated structure" from unlabeled diagrams — mirroring real A&P lab practicals. Highest-value question type. Every unit quiz opens with it.
2. **"Predict the dysfunction if X fails."** The crown jewel. ("SA node stops firing — what happens to heart rate and why?") Exactly how a future anesthesiologist thinks.
3. **Homeostatic scenario reasoning.** Stimulus → receptor → control center → effector → outcome. Full loops required.
4. **Applied recall.** The *floor*, never the ceiling.

**Difficulty progression:**

- **Level 1 — Identify and describe.** Labeling, definitions, one-step facts. Exit: 90%+ accuracy.
- **Level 2 — Explain mechanisms.** "Walk me through" the cardiac cycle, sliding filament theory, the nephron's sodium handling.
- **Level 3 — Predict and reason.** Dysfunction scenarios and homeostatic reasoning. Can't do Level 3 on cardiovascular and respiratory = not pre-med serious, regardless of Level 1 scores.

**Traceability:** every question traces to the uploaded unit material — structures appear in the student's handouts/slides, and expected-answer key terms are checkable against the source. The AI never invents structures. Conflicts between student material and standard anatomy get flagged to student and parent, not silently "fixed."

---

## 4. External Resources That Actually Work

Max 2–3 per type, matched to the unit. Only these clear the bar:

- **Kenhub (kenhub.com).** Best 3D/interactive anatomy at this level. Genuinely accurate labeling, system-by-system breakdowns, built-in quizzes. Use for: all structure units, especially muscular and nervous.
- **Visible Body — official YouTube content only.** Their paid 3D atlas is the gold standard; at this tier their official YouTube walkthroughs are the pick — narrated, correctly oriented, no oversimplification. Reject their marketing-tier "tour" videos.
- **Khan Academy A&P.** The physiology backbone. The cardio and renal walkthroughs are the most rigorous free explanations of mechanism at this level — derived, not asserted. Supplement, never replace, the textbook for structure.

**Excluded:** random "anatomy in 10 minutes" channels; unlabeled coloring-book apps; anything whose diagrams can't survive a check against the student's textbook.

---

## 5. Misconceptions the AI Tutor Must Catch

Intercepted *every time*, corrected with the mechanism, re-tested within the session.

1. **Left/right confusion in anatomical position.** The subject's left is the viewer's right. Drill until reflexive.
2. **"The heart oxygenates the blood."** No — the heart is a pump; the lungs oxygenate. Conflating the two collapses the cardiopulmonary logic the unit is built on.
3. **Ligaments vs. tendons.** Bone-to-bone vs. muscle-to-bone. Drill with ACL (ligament) vs. Achilles (tendon).
4. **"The brain runs out of space."** Intracranial volume is fixed — which is exactly why rising intracranial pressure is dangerous. Correct early.
5. **Arteries = oxygenated, veins = deoxygenated.** Pulmonary and umbilical vessels break this. Correct frame: "arteries carry blood *away from the heart*, veins carry it *toward* the heart — oxygenation is a separate fact."
6. **"Muscles push."** Muscles only pull; extension requires antagonists.
7. **Somatic vs. autonomic.** "Voluntary vs. involuntary" is only the entry heuristic. Push past it: sympathetic *and* parasympathetic divisions with opposing effects on the same organs.
8. **"Homeostasis means staying the same."** No — staying within a *range* via active correction. Demand the full feedback-loop diagram, not the word "balance."

---

## 6. Grade Calibration — High-School A&P vs. Pre-Med Seriousness

A **good high-school A&P unit** produces a student who can: label the system's key structures from memory, describe each structure's function, and trace one major feedback loop. That's the 90% line. Necessary, not sufficient for Dawson's trajectory.

A **pre-med-serious unit** adds three things:

1. **Dysfunction reasoning as the default mode.** The student predicts what breaks when normal fails (§3, Level 3). A unit that never asks "what if this fails" is a vocabulary course in a science costume.
2. **Quantitative literacy.** Cardiac output = stroke volume × heart rate; alveolar ventilation; GFR. Not plug-and-chug — the student interprets what a *changed number means physiologically*. Anesthesiology is applied numbers; the habit starts here.
3. **System integration.** Respiratory alkalosis touches renal compensation; hemorrhage touches cardiovascular *and* urinary *and* endocrine responses.

**Calibration rule:** every unit defaults to the high-school bar, with a labeled **"Pre-Med Stretch"** layer on top — Level 3 scenarios, quantitative problems, integrative cases — so the student always sees the next rung.

---

## 7. Safety Boundary — Non-Negotiable

The AI tutor **teaches anatomy. It never practices medicine.**

- **Never diagnoses.** No "that sounds like…", no differential lists, no "you might have…". Ever.
- **Never interprets personal symptoms.** A student describing chest pain, dizziness, a lump, or anything about their own body gets one response: *"I'm your anatomy tutor, not a doctor — I can't help with symptoms. Please tell a parent and see a doctor."* Then the session moves on. No follow-up questions about the symptom.
- **Never gives medical advice.** No dosage, no "you should take…", no "it's safe to…", no first-aid instructions beyond "call emergency services."
- **Clinical correlates stay in third person.** Mechanisms in hypothetical patients — never checklists the student applies to themselves.
- **Routing rule:** any health question — about the student, a family member, or "a friend" — routes to *"Ask a doctor or a parent."* One sentence, then back to anatomy.

This boundary is not a footnote. It is the condition under which an AI is allowed to teach a 15-year-old about the human body at all.

---

# Part 6: English / Language Arts


**Scope:** Grades 6–12 through AP Language and Composition. Reference student: Dawson, 15, 10th grade, Lit & Comp II (84.2), Walton High School, Cobb County GA.

**Non-negotiable premise:** English is a *skills* subject, not a *content* subject. A student can ace every comma worksheet and still splice in paragraph one. Every unit, quiz, and resource here is judged by one question: **does it make the student's actual writing better?**

---

## 1. Unit Structure

An English "unit" is a **skill arc**, not a text. Never organize around a novel; organize around what the student must be able to *do*. A 2–4 week unit contains:

- **Anchor skill (one):** *write a defensible thesis*, *embed and interpret evidence*, *concede and rebut a counterargument*. A unit claiming three things teaches none.
- **Mentor texts (2–4)** demonstrating the skill, annotated for *effect*, not labels. Bad: "This is a periodic sentence." Good: "The writer withholds the subject until the clause's final word — that delay is the whole point."
- **Grammar-in-context module:** only the conventions the anchor skill demands. Grammar arrives when the writing requires it — never standalone.
- **Vocabulary in use:** 8–12 words harvested from the unit's own mentor texts, each used by the student in a sentence in the unit's genre. No premade lists.
- **Production ladder:** the unit ends with real writing — a paragraph, a timed essay, a revision — plus feedback. No production, no completion.

**Sequencing** runs by cognitive load. Early: *claim → evidence → explanation*. Middle: *structure and coherence*. Late: *style and voice*. A 6th grader and an AP Lang student both argue; the AP student handles ambiguity and competing perspectives inside a single paragraph.

---

## 2. Excellent Study Material — and What Gets Rejected

**Great material:** annotated mentor sentences explaining the *effect* of a choice. Grammar through revision of real student sentences, never abstract rules ("The data shows that students who study they get better grades" — walk the repair, read it aloud, hear it). Scaffolded thesis-building showing theses *evolving*: weak version → diagnosis ("this is a fact, not a claim") → strengthened version. Before/after paragraphs — a B-level paragraph beside its A-level revision, changes narrated. The highest-value material type in composition instruction.

**REJECT outright:** isolated comma-rule worksheets with no writing application. Five-paragraph templates presented as the ceiling (a training wheel, outgrown by 9th grade). Vocabulary lists without usage. "Read and answer 10 multiple-choice questions" as the primary activity — reading serves writing here; every reading task must connect to a writing move.

---

## 3. Practice-Quiz Standards

Writing can't be auto-graded like math. Quizzes test *judgment about writing* and produce *coaching*, not essay scores.

**Question types (the only ones that belong):**

1. **Revise-this-paragraph.** The student highlights 2–3 problems in a flawed paragraph, picks the repair, then explains *why* it works in one sentence. The explanation is the real assessment.
2. **Identify-the-rhetorical-move.** The student names what a mentor-text sentence is doing *and the effect it creates*. Plausible distractors — the point is connecting move to effect.
3. **Thesis-strength ranking.** Four theses, one topic, ranked weakest to strongest with a one-line justification for the top pick.
4. **Timed writing prompts with rubrics.** Real prompts, timed, student writes. The AI does NOT grade it like a test — see below.

**Difficulty progression:** recognize the move in others' writing → choose between repairs or rank options → produce the move in a constrained task → timed full production. Never ask a student to produce what they haven't learned to recognize.

**Traceability:** every item links to the unit material it draws from — the specific mentor text, the specific grammar module. Items from uploads cite the upload ("from your handout: Thesis Workshop, Oct 2").

**AI feedback on writing:**

- **MUST:** diagnose like a teacher with a pen. Name the strongest sentence and why. Name the single highest-leverage fix. Ask one question the writer must answer in revision. Maximum three fixes, ranked.
- **MUST NOT:** rewrite the student's sentences — never a "here's how I'd write it" version, never silent corrections to paste over a draft. Never a holistic score ("8/10") without the diagnosis — scores without teaching are just judgment. Never vague praise — name the specific move ("your concession in paragraph two is doing real work — it makes the rebuttal land harder").

---

## 4. External Resources That Actually Work

Max 2–3 per type, matched to unit topics, picked for *how they teach*.

- **Khan Academy — Grammar, writing-focused units only.** One of the few grammar resources tying conventions to revision tasks. Use the "revise this passage" modules; skip the generic comprehension drills.
- **Purdue OWL.** The least flashy, most substantive free writing resource in existence. Link as *references inside units*, not standalone assignments. The "Paramedic Method" page alone beats most grammar apps.
- **YouTube: rhetoric-first channels, never summary channels.** Channels dissecting *how an argument is built* — speech close-readings, op-ed breakdowns — are gold for AP Lang analysis. Litmus test: if the channel's biggest video is "X explained in 10 minutes," it doesn't belong.
- **Quizlet — only student- or teacher-made sets drawn from unit vocabulary**, unit-tagged and usage-based. Premade 500-word SAT lists rejected.
- **Drill tools (DeltaMath-style):** valid only for the grammar-in-context layer, capped at 10–15% of unit time. The moment drill substitutes for writing, kill it.

No resource ships without a one-line curator's note: *why this one, for this unit, for this skill.*

---

## 5. Misconceptions the AI Tutor Must Catch

Name it, replace it with the real principle, no shaming.

1. **"Longer = better."** No — *denser* = better. "What does this sentence add that the last one didn't?"
2. **"Big words = smarter."** Uncontrolled inflated diction reads as insecurity. Precision impresses; thesaurus-abuse embarrasses.
3. **"I is forbidden."** False — and the ban breeds tortured passive voice. Controlled first person ("I argue") is often stronger. Don't narrate yourself; do own your claims.
4. **"Thesis = announcement: 'In this essay I will…'"** That's a table of contents. A thesis is a *contestable claim*: "Could someone smart disagree? No? Not a thesis yet."
5. **"Comma splices come from not knowing comma rules."** They come from *run-on thinking*. Fix the thinking (read aloud, find the breath, that's the period) and the punctuation follows.
6. **"Good writing happens in one draft."** The most damaging belief here. Every admired mentor text was revised. Normalize revision as the *actual work* — and praise it explicitly.
7. **"The five-paragraph essay is the format."** One scaffold among many. By 10th grade, arguments organize around *ideas*; paragraphs are as many as the ideas require.
8. **"Grammar and style are the same thing."** Grammar is the floor; style is everything above it. Push past "is it correct?" to "is it *alive*?"

---

## 6. Grade Calibration

**Middle school (6–8): the floor is correctness.** Paragraph structure, complete sentences, a claim that isn't a fact, evidence connected to the claim. Praise clarity above all. Highest-value activity: sentence-combining — it builds the syntactic muscle everything else stands on.

**9th/10th composition: correctness is assumed; the new bar is *argument*.** Thesis as contestable claim. Evidence *embedded and interpreted* — the quote never speaks for itself. One idea per paragraph; transitions showing logical relationships, not "firstly, secondly." Counterargument appears. Sentence variety is now taught, not hoped for; the five-paragraph template gets explicitly outgrown. (Dawson at 84.2 belongs here: solid on correctness, building toward controlled argument and evidence interpretation.)

**11th/12th and AP Language: sophistication.** Correctness is the price of admission — no longer praised. New expectations: *qualification* ("while X is true, Y complicates it"), *rhetorical awareness* (choices made for an audience, named and defended), *voice* (sounds like a person thinking), *synthesis* (sources in conversation, not stacked). AP rhetorical analysis requires explaining *how* choices create effects on an audience — device-labeling without effect analysis caps the score. Timed writing is a distinct, trainable skill; practice it as such.

**The through-line:** every level demands harder *thinking*, not longer sentences. The calibration question for any material at any level: does this ask the student to think harder than the last level did? If it only asks for more words, it's failing them.

---

# Part 7: Literature


*Written by a 15+ year ELA educator and department chair. Spans grades 6–12 through AP Literature. This is a standards document: it defines what excellence looks like in the Learn section's literature content, not how to code it.*

---

## 1. Unit structure

A literature unit is organized around **a text plus a critical lens**, never around a topic alone. The correct atomic unit is: *"To Kill a Mockingbird + analyzing how point of view shapes sympathy"* — not "fiction." Every unit has two load-bearing parts that must stay distinct:

**The text layer.** The actual work being read — the novel, play, poem cluster, or short-story sequence — with its reading schedule, key passages, and vocabulary-in-context. Pookie must always anchor the unit to the text the student's class is actually reading. When a unit has no assigned text (a "genre study" or "literary terms" unit), that is a red flag: terms without a text attached are vocabulary trivia. The fix is to attach at least one anchor text immediately.

**The skill layer.** The analytical move the unit teaches, sequenced across the reading: e.g., Unit A teaches *close reading of figurative language* through a poetry cluster; Unit B teaches *tracking a motif across chapters* through a novel; Unit C teaches *analyzing argument and rhetoric* through speeches and essays. Skills compound: by spring, a 10th grader should be doing all of the above simultaneously on a new text without prompting.

Opinionated rule: **plot coverage is never a unit goal.** If a "unit" is just chapters 1–10 of a book with quiz questions asking what happened, it is a reading log, not a unit. The standard unit has an *interpretive question* that the reading answers — stated on day one, argued in the final assessment.

---

## 2. Excellent study material

**What great material looks like:**

- **Guided close-reading passages with margin questions.** A 200–400 word passage from the actual text, with 3–5 scaffolded questions that force attention: *What is the narrator not saying here? What image repeats, and what changes about it?* Questions must be passage-specific, not copy-paste-able to any book.
- **Thesis workshops tied to the text being read.** Not "write a thesis about any topic." Give the student a weak, text-specific thesis (*"George and Lennie's friendship is important"*) and require the revision that adds an interpretive claim and a mechanism: *"Steinbeck uses George and Lennie's interdependence to argue that dignity requires witness."* The material should name the three thesis parts — claim, mechanism, significance — and never accept a restated prompt.
- **Motif trackers.** Structured logs where the student records each appearance of a motif (page, quote, context, what it meant *this time*), so interpretation emerges from accumulated evidence rather than a single lucky quote. This is the single highest-leverage study habit in grades 8–11 and it is almost never taught explicitly.
- **Context briefings done right.** Historical/authorial context in one tight page: what the student needs to understand the text's stakes, not a biography dump. Flag explicitly what context is *necessary* versus interesting.

**What to REJECT — non-negotiable:**

- **Plot summaries presented as understanding.** A summary of what happens is not evidence of thinking. Any material that lets the student substitute summary for analysis is poison.
- **Quote banks without analysis.** A list of "important quotes" teaches students that literature is a treasure hunt for phrases to memorize. Quotes must always travel with their analysis attached — what the passage reveals, how the language works, why it matters to the interpretation.
- **"Symbolism = the curtains are blue means sadness" reductionism.** One-to-one symbol decoding ("the green light = money") trains students to do the exact move that AP Lit penalizes. If a material teaches that every object *stands for* exactly one abstract noun, reject it.
- **Five-paragraph-template worksheets sold as essay help.** Templates produce identical essays. Structure instruction must teach *why* paragraphs exist (claim, evidence, warrant, analysis) so students can break the template on purpose.

---

## 3. Practice-quiz standards

**Question types (use all three; never only the first):**

1. **Passage-based analysis with cited evidence.** Present a real passage from the text (not a paraphrase) and ask what it reveals and *how the language does it*. Answers must quote and interpret — "lines 12–14 show X because the diction of Y…" not vibes.
2. **"Which thesis is most defensible and why."** Multiple defensible and indefensible options; the student picks and justifies. This is the highest-value multiple-choice format in literature because it trains the core AP Lit skill: evaluating claims against evidence.
3. **Timed FRQ-style prompts with AP rubrics.** Even in 9th and 10th grade, practice prompts should use the AP Literature rubric structure (thesis / evidence & commentary / sophistication), simplified by grade. Familiarity with the rubric is itself a skill.

**Difficulty arc — always three levels, in this order:**

- **Comprehension:** can you follow the text (who is speaking, what just happened, what the sentence means).
- **Analysis:** can you explain how the text produces its effects (devices → function, not devices for their own sake).
- **Evaluation:** can you weigh competing interpretations and defend one (which reading holds up best across the whole text).

A quiz that never leaves comprehension is a reading quiz. A quiz that skips comprehension and starts at analysis will misdiagnose struggling students. Never mix levels without labeling them.

**Traceability.** Every question must be traceable to material actually in the unit: the uploaded text, the uploaded handout, or the INTERNAL stream. If the quiz references a passage or term the student has never seen in their materials, it is a defect — flag it, don't ship it.

**The AI's role in essay feedback.** Socratic, always. The AI may: ask what the thesis claims beyond restating the prompt; demand the quote that best supports a claim and ask why *that* quote; point at a body paragraph and ask what the reader learns that wasn't in the topic sentence; ask what a reasonable skeptic would object to. The AI may NEVER: write a thesis for the student, rewrite a sentence "for clarity," supply analysis the student hasn't attempted, or give line-by-line edits. Feedback ends with a question the student must answer, not a correction the student must accept. A student who can write a clean essay only with the AI's sentences has learned typing, not thinking.

---

## 4. External resources that actually work

Max 2–3 per type, matched to the unit. Judgment over comprehensiveness:

- **Close-reading instruction:** *Re:lit* (National Humanities Center's close-reading series) and select *CrashCourse Literature* episodes — the episodes that model line-by-line reading, not the plot-recap ones. Most "literature explained" YouTube is summary with thumbnails; the bar is whether the video pauses on specific language and works through what it does.
- **Performance as interpretation:** stage and film adaptations treated as *interpretive arguments*, not as the story in easier form. Watch a scene, then ask: what choices did the director make, and what reading of the text do those choices commit to? This is especially potent for Shakespeare and drama units, where students treat the play as a book instead of a performance text.
- **Poetry audio archives:** the Poetry Foundation's audio and the *Favorite Poem Project* — hearing a poem read by a skilled reader teaches more about line, pause, and emphasis in five minutes than a worksheet on meter does. Poems are scores, not puzzles.

Explicitly not endorsed as study aids: plot-summary sites and "chapter explained" content when used as substitutes for reading. They have one legitimate use — catching up after an absence — and the app should say so out loud rather than letting them launder as understanding.

---

## 5. Misconceptions the AI tutor must catch

These are the classics. The tutor must intercept each with the correct framing, every time, without scolding:

1. **Theme as one word.** "The theme is courage." Wrong frame — that's a topic. The correction: a theme is a *sentence that makes a claim*: "The novel argues that courage without community becomes self-destruction." If it can't be argued with, it's not a theme.
2. **"The author uses symbolism" as analysis.** Naming the device is step zero. The correction: the question is never *whether* there's symbolism — it's *what the symbol does* in this scene, for this character, at this point in the arc. "Steinbeck uses the farm dream in Chapter 1 as refuge, but in Chapter 5 as accusation" is analysis. "He uses symbolism" is a label.
3. **Confusing narrator with author.** "Shakespeare believes women are…" when the speaker is Iago. The correction: a first-person narrator or a character is a constructed voice with motives, blind spots, and an agenda. Always ask *who* is saying it and *why we'd trust or distrust them* before attributing any view to the author.
4. **Summary-as-essay.** Paragraphs that retell the plot with "this shows" sprinkled in. The correction: every sentence after the evidence must answer *how* — how does this language, this image, this structural choice produce the meaning you claim? If a sentence works for any book, delete it.
5. **"This proves" overclaiming from one quote.** One passage *suggests*; a pattern *demonstrates*. The correction: a single quote is a data point, not a verdict. Push the student to find a second and third instance — or to qualify the claim honestly.
6. **Treating all interpretations as equal.** "It's just my opinion" used as a shield. The correction: interpretations are defensible or indefensible *on the evidence*. The best reading accounts for the most of the text with the fewest exceptions — and the tutor should say so plainly.
7. **Confusing tone with mood (and both with "vibe").** The correction: tone is the *author's or speaker's* attitude; mood is what the *reader* feels; and both must be anchored to specific language, not declared from atmosphere.
8. **Reading the ending backward as inevitable.** "Of course he fails — that's the tragedy." The correction: ask what the character could have done differently at a specific choice point, and what the text shows about why they didn't. Deterministic readings erase exactly what tragedy is about: choice under constraint.

---

## 6. Grade calibration

**Middle school (6–8): identifying devices → connecting devices to effects.** The bar: the student can name a device *and* say what it does in that passage. Metaphor, simile, imagery, personification — always attached to "so what?" A 7th grader who writes "the simile 'like a wall' makes the character feel trapped and shut out" is exactly on track. Resist the urge to push thesis-level abstraction early; the foundation is evidence-first habits: quote it, then say what it does.

**9th/10th: sustaining an interpretive argument across a passage set.** The bar: a defensible thesis with a mechanism, supported by multiple pieces of evidence, with analysis that explains *how* each piece supports the claim. This is Dawson's band — the jump from "I found three devices" to "here is what the text is doing, and here is my evidence" is the entire game of 10th grade, and most students arrive still writing device-hunts. Motif trackers (section 2) are the bridge: they turn the device-hunt instinct into pattern-thinking, which is what a thesis is built from.

**11th/12th + AP Lit: sustaining an interpretive argument across a whole text, under time pressure.** The bar: the AP Literature rubric's three rows — a defensible thesis, well-chosen evidence with commentary that actually advances the argument, and sophistication (complexity, style, or a reading that accounts for nuance rather than flattening it). AP students must also handle *unfamiliar* texts: the skill is transfer, not familiarity. Practice should regularly put a never-before-seen poem or prose passage in front of the student with a 40-minute clock. Sophistication cannot be templated — it comes from reading widely enough that patterns across texts become visible, which is why the EXTERNAL stream matters most at this level: criticism, performances, and audio archives are how a student sees that their text is in conversation with others.

**One calibration rule across all grades:** difficulty lives in the *thinking*, never in obscurity. A 6th-grade passage can demand real analysis; an AP prompt can use plain language. Never confuse "harder text" with "deeper question."

---

# Part 8: History, Government & Civics


*Expert: high-school history teacher, department-chair caliber. Spans grades 6–12 through AP (APUSH, AP Gov).*

History is a reasoning subject that uses the past as its laboratory — not a trivia subject. Written for a reference student in 10th-grade American Government (Dawson, 79.0); scales across grades via §6.

---

## 1. Unit Structure

A **unit** is a bounded argument about how the world changed — not a bucket of dates.

**US history units — chronological spine + thematic threads:**
- **The spine:** a clean event sequence students can *place*, not just recite.
- **2–3 thematic threads** (expansion of rights, economic transformation, federal power, migration), each traced start to finish with turning points named.
- **Key terms as concepts** — defined by *what they explain*, never by dictionary gloss.
- **Primary sources as first-class components** — 2–4 excerpts (100–300 words) per unit with sourcing questions: *who wrote this, for whom, to what purpose, what's conspicuously missing?* No primary sources = incomplete unit. Rejected in review.
- **Historiography note (honors/AP)** — one paragraph naming two ways historians disagree about the unit's main story.

**Government/civics units — institutions → processes → rights:**
- **Institutions first.** Gate question: "what can this body do that the others can't?"
- **Processes second.** Taught as *workflows with friction points* — the friction is where hard questions live (filibuster, conference committees, veto overrides).
- **Rights third.** Constitution and Bill of Rights applied to real scenarios ("can the school search my phone?") mapped to amendment, case, and precedent *reasoning*.
- **Foundational documents excerpted, not summarized** — Federalist 10/51, the Constitution's articles, key amendments. Summaries are commentary; excerpts are the unit.

---

## 2. Excellent Study Material (and What to Reject)

**Great material:**
- **Timeline reasoning, not timeline memorizing.** Every timeline asks "why did this turn *here*?" between two points.
- **Cause-and-effect chains.** Conditions → triggers → event → immediate → long-term consequences, built from a blank page. The highest-yield study activity in history.
- **Sourcing questions on every source.** Who wrote it? What had just happened? Intended audience? What does the author *want*? What's omitted — deliberately? Without these it's a reading passage, not a lesson.
- **Comparison frames.** Two events, two documents, two presidencies, side by side. Historical understanding *is* comparative.
- **The "so what" test.** Every section answers: why does this matter for what comes next? Can't answer? Cut it.

**REJECT outright:**
- **Date-memorization flashcard decks.** Rewarding "1492" without asking what 1492 set in motion teaches nothing.
- **Textbook-outline regurgitation.** Shorter paragraphs preserve the textbook's worst habit: *what happened* without asking students to *think*.
- **Single-narrative treatments of contested events.** Reconstruction, the New Deal, US foreign intervention — one settled story, no competing interpretation: disqualified. Teach the debate or don't teach the topic.
- **Presentism.** Judging historical actors good/evil by today's standards instead of by outcomes and context.
- **Vocabulary lists without application.** A definition the student can't use to explain an event is a dead term.

---

## 3. Practice-Quiz Standards

Quizzes generate from uploaded unit material. Every question must be **traceable** to the specific upload/page/section it tests. Untraceable questions don't ship.

**Mandatory mix:**
- **Stimulus-based MCQs (AP style)** — quote, map, chart, or cartoon with 2–3 questions *about the stimulus*, answerable only by reading it. ≥40% of any quiz.
- **Short-answer: causation, comparison, continuity-and-change.** The AP SAQ trio, scaled down — the best writing-muscle builders available.
- **DBQ-style document work (high end)** — ≥1 per unit: two conflicting documents; the student uses *both*, with sourcing analysis, to make a claim. This is where the 90s live.

**Difficulty progression (non-negotiable):** 1) **Foundational** — identify and explain. 2) **Analytical** — causation and comparison. 3) **Evaluative** — weigh evidence, source documents, argue. Always last, hardest, fewest points — always present. No evaluative question means the quiz teaches that history has no arguments.

**Rules:** Max 15 questions. Never pad beyond what the material supports. Distractors must be *plausible* (drawn from real misconceptions, §5), never jokes. Every miss gets a 2-sentence explanation — the explanation teaches, not the score.

---

## 4. External Resources That Actually Work

Earned picks, not a directory. Max 2–3 per type, matched to unit topics.

- **Heimler's History (YouTube).** Best APUSH/AP Gov review channel, full stop. Teaches *how to write the answer* — SAQ/LEQ/DBQ walkthroughs that function as a private AP tutor. Priority pick for AP units.
- **Khan Academy — US History & US Government.** Gov course: strong on institutions and processes. History course: solid through the early republic, thinner on the 20th century.
- **CrashCourse US History / Government (YouTube).** Narrative sweep for students who won't read the textbook. Speed compresses nuance — *overview first, detail later*, never the sole source on contested topics.
- **iCivics games.** Middle school–9th civics: *Do I Have a Right?*, *Win the White House*, *Executive Command* teach processes by *running* them. Playing a bill through committee beats reading three pages about it.
- **National Archives DocsTeach.** Primary sources paired with exactly the sourcing questions §2 demands. Prefer over generic "interactive timeline" sites — most are animated date lists.

**Reject:** "history in 5 minutes" channels that strip causation, essay mills, Wikipedia as a *cited* source (starting map, never destination).

---

## 5. Misconceptions the AI Tutor Must Catch

The tutor interrupts on sight — gently, with a question, never a lecture.

1. **"The Civil War was about states' rights."** States' rights was the *mechanism*; slavery was the *substance*. Every secession document says so — quote them. Ask: "states' rights to do *what*?"
2. **Confusing the Declaration with the Constitution.** The Declaration (1776) *justifies breaking away*; the Constitution (1787) *builds the government*. Eleven years apart, different jobs.
3. **History as inevitable.** "It had to happen this way." Reflex: "what would it have taken for this to go differently?" Contingency separates memorizing from understanding.
4. **Presentism.** "They were stupid/evil for not knowing what we know." Tutor's line: "Judge the decision by what *they* knew, then the outcome by what *we* know. Two different judgments."
5. **"The Electoral College means the popular vote doesn't matter."** The popular vote decides the outcome *within each state* (mostly winner-take-all); those outcomes choose the electors. It matters enormously — state by state. Then: why did the Framers design it this way?
6. **"The President can just make laws."** Executive orders direct the executive branch — not legislation, reversible by the next president, strike-downable by courts, overridable by Congress.
7. **"Amendments are easy — they just vote."** Article V is deliberately brutal: two-thirds of Congress *and* three-fourths of the states. Twenty-seven in 235+ years. The difficulty is the point.
8. **"Primary sources are automatically true."** A diary from 1860 is *evidence*, not truth. Every source has an author with interests. Reflex: "who benefits if people believe this?"

---

## 6. Grade Calibration

One standard, four gears. Content gets richer; the *thinking moves* stay constant.

- **Middle school (6–8): Narrative + evidence.** What happened, in what order, and *how do we know?* Sourcing stays simple (who wrote it, were they there?). Plant the seed: "not everyone at the time agreed."
- **9th–10th regular (Dawson's American Government): Causation + institutions.** Explain *why* events happened and *how* institutions actually work — not just name them. Gov: every institution as powers → processes → limits, mapped to real scenarios. A 79 becomes a 90 through *mechanism-level* understanding, not more facts.
- **Honors: Comparison + contending interpretations.** Compare across time and place; historians disagree. One historiography paragraph per unit. Short answers graded on argument quality, not length.
- **AP (APUSH/AP Gov): Argument with evidence.** Thesis-driven everything: stimulus MCQs, full SAQs, DBQ/LEQ practice. Document sourcing (HIPP) becomes reflex; writing under time pressure. The tutor shifts from "explain the content" to "attack the weak thesis."

**The through-line:** a 6th grader asks "what happened?"; a 10th grader asks "why, and how did the system produce it?"; an AP student argues "here's my claim, here's my evidence, here's what the other side says, and here's why they're wrong." Every unit, quiz, and tutor exchange should know which gear it's in — and push one gear up.

---

# Part 9: Social Studies


**Author:** Social Studies expert (geography, economics, sociology, world cultures; US history/government covered separately)
**Scope:** Everything in social studies that is NOT US history or US government. Geography, economics, world history, sociology, current events.
**Audience:** 10th grader (reference: Dawson, Walton HS) and the AI tutor serving him.

**Core conviction:** Social studies is the discipline of *not being fooled*. Maps lie, averages lie, headlines lie — not always maliciously, but always structurally. Every unit in every subject should leave the student more skeptical and more evidence-literate than it found them. If a unit produces a student who can recite definitions but can't spot a bad argument about a real place or a real economy, the unit failed.

---

## 1. Unit Structure

Every social studies unit, regardless of subject, follows an **inquiry spine**: a driving question the student could plausibly care about, evidence to wrestle with, and a judgment they must defend. No unit opens with vocabulary. Vocabulary arrives when the student needs the word to say something they already want to say.

- **Economics unit:** *Decisions → Models → Evidence → Application.* Start with a decision the student actually faces (rent vs. buy, minimum wage, why concert tickets surge). Introduce the model (supply/demand, incentives, tradeoffs) as a tool for *that* decision, not as a diagram to memorize. End with a current-events application the student must evaluate: "Using what you know about incentives, evaluate this city's new congestion tax." A student who can draw a perfect supply curve but can't predict who bears the burden of a tax has learned nothing.
- **Geography unit:** *Spatial patterns → Human-environment interaction → Scale.* Start with the map or dataset, not the chapter. "Here's a map of coffee exports and a map of global temperature. What do you notice?" Patterns first, explanation second. Every geography unit must explicitly teach **scale**: what a phenomenon looks like at the city, national, and global levels, and how the story changes when you zoom. Human-environment interaction is mandatory, not decorative — no unit about a region may skip who uses the land, who decides, and who benefits.
- **World history unit:** *Continuity and change, not one damn thing after another.* Units are organized around a theme (power, trade, belief systems, demography) across time, not a march of dates. Comparison is the engine: two societies facing the same pressure, different outcomes, why. Every unit names whose story is centered and whose is absent.
- **Sociology unit:** *Concept → Observation → Challenge.* Introduce a concept (socialization, stratification, deviance), send the student to observe it in their own world (their cafeteria, their feed), then challenge the concept with the observation. Sociology learned only from a textbook is sociology unlearned.
- **Current events unit:** *Claim → Source → Corroboration → Judgment.* Never "read this article." Always: "Three sources say three different things about this event. What do they agree on? Where do they diverge? What's your judgment, and what evidence would change it?" Current events without media-literacy scaffolding is just feed consumption with a grade.

Every unit, every subject, must contain at least one item that requires the student to hold two competing explanations in their head at once and pick the better-supported one. That is the whole discipline.

---

## 2. Excellent Study Material — and What to Reject

**Excellent material:**

- **Real data, real charts, real maps — with source labels.** A choropleth of GDP per capita is not a study aid; a choropleth of GDP per capita *next to* a cartogram of the same data, with the source and year stated, is. Students must see that the same dataset can tell different visual stories. If material cites a statistic, it cites the source. No exceptions.
- **Multiple perspectives on contested issues, attributed by name.** Not "some people think X and others think Y" — name them. Keynes vs. Hayek. Development economists vs. the IMF. Two historians on why the Roman Empire fell. Perspectives are attached to real people with real arguments, because anonymous perspectives teach students that opinions float in the void rather than belonging to interests.
- **Economics taught through decisions, not definitions.** The material poses a choice, forces a tradeoff, then names the concept. Opportunity cost is not "the next best alternative foregone" — it's "you chose the $12 concert ticket over the $12 you'd have spent on the game; what did you give up, and was it worth it?" Definitions follow the experience.
- **Primary sources scaled to 15-year-olds.** A 200-word excerpt of a traveler's diary, a graph from a census bureau, a single photograph with a good caption. One rich source beats ten summarized ones.

**REJECT outright:**

- **Single-textbook narratives.** Any material that presents one authoritative account of a contested event with no named alternative is propaganda training, not education. Flag it and replace it.
- **Map-labeling as the whole of geography.** Labeling countries is a party trick. Geography is *why is this here and not there*. If a geography unit's assessments are more than 20% recall of locations, it has failed.
- **Economics as vocabulary lists.** Glossary-first economics produces students who can define inflation and can't explain why their groceries cost more. Reject any material whose core loop is term → definition → quiz on the term.
- **Culture units that are food-and-festivals tours.** "Chinese culture: dumplings, Lunar New Year, Confucianism" is tourism, not sociology or world cultures. Culture units must engage values, family structure, work, religion, and change over time — the things that actually organize a society.
- **Timelines that imply inevitability.** "This happened, then this happened" with no mechanism. Every timeline item should be answerable to "why then, and why did it happen *this* way instead of another?"

---

## 3. Practice-Quiz Standards

Question types, in rough order of analytical demand:

1. **Data/graph interpretation.** Give a chart, map, or table (traceable to uploaded or linked material). "Based on this data, which claim is best supported?" Distractors are plausible claims the data does NOT support. This is the single most important question type in social studies. It should be ~30% of any quiz.
2. **Model application.** "A city imposes rent control. Using supply and demand, predict the likely effect on housing availability over five years." The student applies the model to a novel case. If the quiz item can be answered by pattern-matching a definition, rewrite it.
3. **Perspective-taking.** "A small business owner and a minimum-wage worker both comment on a proposed wage increase. Summarize each person's reasoning from their position." Tests empathy and structural understanding, not sympathy.
4. **Evaluate this policy / evaluate this claim.** "Evaluate this policy using economic reasoning" or "Evaluate this historian's argument about causation." Open or structured response; the rubric rewards use of evidence and acknowledgment of counterarguments, not the "right" conclusion.
5. **Source comparison.** Two short excerpts on the same event. "Where do they agree, where do they differ, and what might explain the difference?" Bias detection as a skill, not a vocabulary word.

**Difficulty progression:** Every quiz runs recall → comprehension → application → evaluation, in that order, with roughly 15/25/30/30 weighting. Early items establish facts the later items reason about — the facts are load-bearing, not decorative. The final 2–3 items must be *novel cases*: no quiz question may be answerable by repeating material verbatim. If the answer exists in the upload word-for-word, the question is defective.

**Traceability:** Every question carries metadata: the uploaded file (or named external resource), the section or page, and the specific concept tested. When a student misses an item, the tutor must be able to say "this comes from your Unit 3 handout, page 2, the section on price ceilings" — not "review chapter 3." Traceability is non-negotiable because it's what turns a wrong answer into a fixable gap instead of vague discouragement.

---

## 4. External Resources That Actually Work

Judgment, not a link farm. Each pick earns its place for a specific pedagogical reason. Cap stays at 2–3 per type; these are the ones worth those slots.

- **Khan Academy (economics and AP Gov-adjacent).** The micro/macro economics sequences are the rare video content that teaches *mechanisms* rather than narration — Sal draws the curves while explaining the human behavior behind them. Weakness: the quizzes test procedure, not judgment, so Khan is a concept-builder, not an assessment. Use for first exposure, never as the final word.
- **Our World in Data (ourworldindata.org).** The single best external resource for this discipline. Real datasets, transparent sources, interactive charts on everything from poverty to demography to trade. This is where data-literacy items come from. The tutor should point students here when they ask "is that actually true?" — teaching them to check claims against data is the entire point.
- **AP Classroom (for AP Human Geo / AP Econ / AP World, when enrolled).** The progress checks are the closest thing to the real exam's analytical demand, and the stimulus-based questions model exactly the data-interpretation skill this document demands. Use selectively: assign the stimulus sets, not the completion grind.
- **YouTube — curated, not searched.** Crash Course Economics (Wheezy Waiter's run) is sound on core models and openly flags its own simplifications, which is itself a lesson. Marginal Revolution University goes deeper and is the best free treatment of incentives and institutions. *Rule:* the tutor never sends a student to "search YouTube for X." It assigns a specific video, with a specific timestamped question to answer. Unassigned YouTube is a rabbit hole, not a resource.
- **Gimkit/Kahoot/Blooket:** useful for exactly one thing — fast recall of the factual substrate (country locations, term definitions, timeline anchors). They are warm-ups and reviews, never the main event. Any peer tip or study plan that treats a Kahoot session as "studying economics" gets corrected.
- **What to avoid:** any "economics explained in 10 minutes" channel that presents models as settled truth without naming assumptions; any geography content that's pure trivia; any current-events aggregator without transparent sourcing. If a resource can't say where its numbers came from, it doesn't enter the Learn section.

---

## 5. Misconceptions the AI Tutor Must Catch

The tutor corrects these proactively — in chat, in quiz feedback, in study plans. Each with the correct framing:

1. **"Maps are neutral truth."** Every map is an argument. Projections distort (Mercator inflates the Global North — show the true-size comparison). Choropleth color breaks are choices. What's centered, what's cropped, what's colored — all editorial decisions. Correct framing: *"What is this map choosing to emphasize, and what is it hiding?"*
2. **"The economy" as one thing.** There is no single economy — there are labor markets, asset markets, the informal economy, regional economies. "The economy is doing well" can be simultaneously true for stockholders and false for renters. Correct framing: *always ask "for whom?"* when an economic claim is made.
3. **Correlation vs. causation in social data.** "Countries with more phones are richer" — or richer countries buy more phones, or both reflect industrialization. The tutor must challenge every causal reading of a correlation with: "What's a third variable that could explain both?" This is the most-testable skill in the discipline and the most-violated.
4. **Ethnocentrism in world cultures.** Judging other societies by the student's own norms ("their family structure is weird") instead of analyzing how it functions in context. Correct framing: *describe the system's internal logic before evaluating it* — and when evaluating, name the standard being applied and whose it is.
5. **"Inflation means everything gets more expensive equally."** Inflation is an average; housing, healthcare, and education have outpaced it for decades while electronics got cheaper. The lived experience of inflation depends entirely on what you buy. Correct framing: *whose basket?*
6. **"Geography is where things are; history is when things happened."** Geography explains *why* the history happened there — rivers, resources, climate, and trade routes are causal forces, not backdrops. The tutor should constantly ask "how did the physical setting shape this outcome?"
7. **"Development = Westernization."** The assumption that every society is on a single track toward looking like the United States, just at different speeds. Correct framing: multiple modernities, different values, different endpoints — GDP per capita is one measure of one thing, not a civilization score.
8. **"If it's a statistic, it's objective."** Unemployment rates exclude discouraged workers. GDP counts oil spills as economic activity (cleanup spending). Poverty lines are political choices. Correct framing: *every indicator is a definition wearing a number's clothes — read the definition.*

---

## 6. Grade Calibration — How Analytical Demand Ramps

- **Middle school (foundations):** The job is *vocabulary with experience* and *curiosity with scaffolding*. Students should handle real maps, real (simple) charts, and real decisions ("you have $20 — budget it"). Misconceptions 1, 3, and 6 get introduced here in plain language. Assessment leans toward interpretation of single sources. No student should leave middle school social studies thinking geography is labeling.
- **High school electives (current level — Dawson, 10th):** The job is *models and multiple perspectives*. Economics units run the full decision → model → evidence → application spine. World cultures units require internal-logic description before evaluation. Current events work is source-comparison, not article summaries. Quizzes hit the full recall → evaluation progression with ~30% of items at the evaluation tier. Students should be able to say "this data supports X but not Y, and here's the perspective it's missing." This is the standard the Learn section holds for every non-AP class.
- **AP Human Geography / AP Economics / AP World History:** The job is *stimulus-based argumentation under constraint*. AP questions hand the student unfamiliar data and demand analysis in minutes — the Learn section's data-interpretation items (Section 3, type 1) are direct training for this. AP Econ adds formal model manipulation (shifts, multipliers, curves as arguments, not decorations). AP World adds the full comparison/continuity-and-change essay architecture — thesis, evidence, analysis, complexity. At this tier, the tutor's role shifts from teaching concepts to *sparring*: challenging the student's argument, demanding the counterargument, asking "what evidence would change your mind?" A student who can only answer when the material is familiar is not AP-ready.

**The through-line:** every tier teaches the same discipline — don't be fooled, show your evidence, name your perspective. The ramp is in the complexity of the evidence and the independence of the judgment, never in the volume of memorization.

---

# Part 10: Psychology


*Psychology expert, 13-expert panel. 15+ years, department chair caliber, AP Psychology-aware. The bar for every psych unit, resource, quiz, and tutor interaction in Learn.*

---

## 1. Unit Structure: The Five-Domain Spine

The **AP Psychology five domains** are the spine from intro elective through AP Psych. Units don't change across levels — depth does.

1. **Biological** — neurons, neurotransmitters, nervous/endocrine systems, brain structures, sensation, perception, sleep, drugs.
2. **Cognitive** — memory models, thinking and language, intelligence, learning (classical, operant, observational).
3. **Developmental** — lifespan development: Piaget, Kohlberg, Erikson, attachment, parenting styles.
4. **Social & Personality** — conformity, obedience, persuasion, group dynamics, prejudice; trait, psychodynamic, humanistic, social-cognitive theories.
5. **Mental & Physical Health** — stress and coping, disorders, therapies.

Every unit ships with four components: **vocabulary anchored to studies** (never a bare glossary); **2–5 classic studies** taught with methods critique; a **methods thread** — research-methods literacy woven into the unit's own content (a memory unit teaches Loftus *and* asks what makes the experiments strong evidence and where they're weak). Never a standalone unit — it's the water every unit swims in. And **application scenarios** — real-life vignettes requiring the vocabulary as a tool.

Unit tagging: one primary unit per upload; cross-unit links are *notes*, not second tags.

---

## 2. Excellent Study Material — and What to Reject

**Excellent material has three properties:**

1. **Classic studies with methods critique, always.** *What did they do? What did they find? Why believe it — and what are the limits?* Milgram without the ethics conversation is malpractice; Zimbardo without the 2018+ replication critiques is worse. The canon — Milgram, Asch, Zimbardo, Loftus, Bandura, Harlow, Pavlov, Skinner, Sperling, Ebbinghaus — each with its design, sample, and critics. Students must see psychology *arguing with its own past*.
2. **Vocabulary anchored to experiments.** Definitions arrive *inside* the study, not before it — a student who can define "proactive interference" but can't explain the Brown-Peterson task doesn't know it.
3. **Application scenarios.** Real-world vignettes per unit: a coach yelling at practice (negative reinforcement or punishment?), a friend who "can't study with music on" (selective attention).

**REJECT on sight:**

- **Pop-psych "fun facts."** "Your brain holds X terabytes!" — anti-material teaching students psychology is trivia. Citation or death.
- **Vocabulary divorced from studies.** Bare glossaries, matching worksheets. The #1 reason students "know all the words" and fail AP scenario questions.
- **Anything blurring into self-diagnosis.** Symptom checklists, "which disorder are you?" quizzes. They fail the safety boundary (§7) and they're bad pedagogy. Disorders are taught as clinical categories — never as a mirror.
- **Personality tests as content.** MBTI, Enneagram — entertainment, not psychology. Allowed once, in a misconceptions callout, labeled non-scientific.
- **"Learning styles" content.** No evidentiary support (Pashler et al., 2008). Flag on upload.

---

## 3. Practice-Quiz Standards

Quizzes are generated from uploaded material, and **traceability is non-negotiable**: every question maps to a specific uploaded source. Unsupported questions don't ship.

**Question types (priority order):**

1. **Scenario-application MCQs (AP-style).** Distractors built from *nearby* concepts to force real discrimination — never four throwaways plus the answer.
2. **Study-design critique.** "A researcher concludes X. Identify the flaw." Confounds, selection bias, no random assignment, correlation–causation confusion, demand characteristics. The highest-value question type in the subject.
3. **FRQ-style writing (AP).** Define, apply, evaluate — with a point-by-point rubric.
4. **Term-in-context.** Anchored to a study or scenario — never bare "what is X?".

**Difficulty progression:** L1 *Recognize* → L2 *Discriminate* → L3 *Evaluate* (critique a design) → L4 *Synthesize* (full multi-concept FRQ). A 15-question quiz runs roughly 5/5/3/2, touching the methods thread at least once.

---

## 4. External Resources That Actually Work

1. **CrashCourse Psychology (Hank Green, PBS Digital Studios).** Best video series in the subject at any level — fast but faithful, studies narrated with their methods. *Biological, Cognitive, Social & Personality.*
2. **Khan Academy AP Psychology.** Mirrors the AP CED more closely than anything else — denser, practice-rich; it converts "I watched a video" into "I can answer an AP question." Required at AP level. *Developmental, Mental & Physical Health, FRQ practice.*
3. **Noba Project (nobaproject.com).** Free, peer-reviewed, modular chapters by working psychologists — the open-source psych textbook. *Reading assignments and the citation trail.*

**Do not recommend:** "psychology facts" YouTube, personality-quiz-as-assessment sites, summary sites that strip methods from studies. If a resource can't name its studies, it isn't a psych resource.

---

## 5. Misconceptions the AI Tutor Must Catch

Non-negotiable. The tutor corrects with evidence, kindly but firmly — no both-sides.

1. **Correlation = causation.** Correlation is co-movement; causation requires ruling out third variables via experiments. Ready examples: ice cream and drowning (summer), shoe size and reading ability (age).
2. **"We only use 10% of our brains."** Neuroimaging shows broad activity in virtually all tasks; damage to almost any area causes deficits.
3. **Learning styles myth.** Modality matching doesn't improve learning (Pashler et al., 2008). Teach retrieval practice and spacing instead.
4. **Negative reinforcement = punishment.** Negative reinforcement *removes* something unpleasant to *increase* behavior. "Negative" means subtraction, not badness.
5. **"Freud is psychology."** One historical school, much of it unfalsifiable. Teach him for influence (the unconscious, talk therapy's origins), then move on to evidence.
6. **"Schizophrenia means split personality."** Schizophrenia is a psychotic disorder (delusions, hallucinations, disorganized thought) — not dissociative identity disorder. Refuse the conflation.
7. **"Psychology is just common sense."** Common sense is often wrong — bystander effect, fundamental attribution error, false memory. Authority comes from replicated experiments.
8. **"Therapists just give advice."** CBT and exposure therapy are tested in randomized trials like any medical intervention.

---

## 6. Grade Calibration: Intro Elective → AP Psych

Units stay the same; the bar moves.

- **Intro (literacy):** Defines terms *in context*, describes 1–2 classic studies per unit, applies concepts to everyday scenarios. Quiz emphasis: L1–L2.
- **Honors / pre-AP (application):** Discriminates related concepts, critiques simple designs, writes concept → study → application paragraphs. Quiz emphasis: L2–L3.
- **AP Psych (research fluency):** Reads a novel study and identifies design, variables, likely confound, and what the data actually support. Full timed FRQs against a rubric. The standard is the AP CED — nothing less.

Calibration rule: **a student who can't explain *why* a classic study is believable gets no credit for knowing its finding.** Findings without methods are trivia.

---

## 7. Safety Boundary: The Tutor Teaches Psychology, Never Practices It

- The tutor **teaches psychology as an academic subject** — never assesses, screens, or comments on the student's own mental health, not even informally.
- It **never interprets the student's personal experiences diagnostically.** "Do I have ADHD?" gets no symptom exploration — a brief, warm redirect to a parent, counselor, or clinician, and an offer to keep studying the *academic* material.
- **Abnormal psychology is taught at the research level** — clinical categories, prevalence, treatment research. Never "check yourself" framing; never symptom lists as self-assessment.
- **Self-harm, distress, or crisis signals route to the parent immediately** per platform safety rules. No counseling, no de-escalation beyond a brief supportive acknowledgment, nothing kept inside the chat. Any mention of self-harm, suicidal ideation, eating-disorder behavior, or acute distress: supportive one-line acknowledgment, encourage a trusted adult now, immediate parent notification. No exceptions.
- Violating materials (symptom checklists, self-diagnosis quizzes) are **rejected at ingestion** (§2). The boundary lives in the content pipeline, not just in conversation.

The tutor sharpens thinking about the science of behavior. The moment the conversation turns toward the student's own mind as a patient, it steps back and hands it to the adults — that isn't a limitation of the product, it's its integrity.

---

# Part 11: Music


*The chair's view: music is the one subject where the "textbook" is sound itself. I've watched students pass written theory tests and still not hear a dominant chord — every standard below exists to prevent that.*

---

## 1. Unit Structure

A music unit is a three-legged stool: **Theory** (what the concept is), **Listening** (what it sounds like), **Performance Application** (what the student does with it). Two legs is a draft, not a unit.

### Canonical unit shapes

- **Rhythm & Meter** — values and time signatures; beat vs. subdivision; counting in the current concert piece.
- **Melody & Scales** — major/minor, modes at the upper levels; ear recognition; intonation and warm-up technique.
- **Harmony & Chords** — triads, inversions, function (I–IV–V); chord quality and cadences; the student's harmonic role in the arrangement.
- **Form & Structure** — binary, ternary, sonata, 12-bar blues, verse-chorus; score analysis of repertoire; knowing where the student is *inside* the piece.
- **Timbre, Texture & Expression** — dynamics, articulation, orchestration; the student's expressive choices and section blend.
- **History / Cultural Context** (appreciation classes) — eras and styles *through* the student's own playing, never standalone trivia.

### Connecting theory to the student's instrument

The unit's performance application must reference the student's **actual repertoire** — the pieces rehearsing this quarter. Abstract examples are on-ramps only; the unit isn't complete until the concept is shown operating in the music on the stand tonight. "Here's how the I–IV–V you learned appears in measure 32 of your concert band piece" is the gold standard sentence this whole section is built around.

---

## 2. Excellent Study Material (and What to Reject)

### Excellent looks like this

- **Annotated scores**: fingerings, breath marks, phrase arcs on the *actual part* the student plays — not a generic clean score.
- **Listening guides with timestamps**: "0:41 — oboe entrance; 1:12 — meter shifts to 3/4; 2:05 — recapitulation, wrong key." A guide without timestamps is a suggestion, not a guide.
- **"Listen for" prompts before each listening**: the student hunts for something specific (a cadence, a hemiola, a modulation), not passively hearing.
- **Theory through real repertoire**: intervals from the melody the student plays; cadences from their concert pieces.
- **Rehearsal practice plans**: "Measures 24–40 at half tempo, metronome 72, then 84." Bars, tempos, goals.

### Reject outright

- **Theory divorced from sound.** A key-signature worksheet with no listening and no instrument is busywork. If the student can't *hear* what they're circling, it doesn't count.
- **Note-naming drills with no musical context.** Twenty minutes of flashcards teaches nothing about music. Note recognition matters only inside real notation, at real tempo.
- **"Appreciation" as trivia.** Composer birthdates, premiere cities — the fastest way to kill a student's relationship with music. Context belongs only insofar as it changes what the student *hears*.
- **Generic practice advice.** "Practice 30 minutes a day" without a plan is decoration. Every recommendation names the passage, the tempo, and the target.

---

## 3. Practice-Quiz Standards

### Question types, by level

- **Aural identification** (all levels): "major or minor triad?", "which cadence?", "what time signature?" Where audio renders, every listening quiz should. Non-negotiable.
- **Score analysis** (developing and up): "mark the cadence," "identify the form," "what chord is the brass playing in measure 8?"
- **"Notate what you hear"** (advanced only): 2–4 measure dictation. Cognitively expensive; use sparingly.
- **Error-detection in performances**: a recording with planted errors. The closest quiz format to actual musicianship — use generously.

### Difficulty progression

Middle school: recognition (hear it, name it). High school ensemble: analysis in context (hear it *in your piece*, explain its function). AP Music Theory: dictation, part-writing, structural analysis of unfamiliar excerpts. Difficulty rises **recognition → application → creation**, never by speeding the same recognition task.

### Traceability

Every generated quiz must cite the uploaded material it draws from: the handout, score page, or listening guide. "This question on cadences comes from your Unit 3 listening guide" — if the AI can't say that, the question doesn't ship. No orphan questions from the model's general knowledge.

### The AI's boundary: adjudication

Be explicit with students and parents: **the AI can quiz theory and listening; it cannot adjudicate a live performance.** It cannot say a student's tone is good, intonation is fixed, or embouchure is right. Any feature implying the AI "listens to you play and grades it" is dishonest. The tutor's role with performance is *planning* (what to practice, how, at what tempo) and *reflection* (guided self-assessment). The adjudicators are the teacher, the recording, and the student's own ear.

---

## 4. External Resources That Actually Work

- **musictheory.net (exercises)**: the rare interactive that teaches correctly — immediate, pitched, unforgiving about enharmonic spelling, free. Lessons as pre-reading, exercises as drill.
- **teoria.com**: harmonic analysis tutorials and ear training that scale into AP territory. Dated interface; sound pedagogy.
- **Curated masterclass/analysis video** (one per unit): score-follow analyses or conservatory masterclass series. Reject generic "music theory in 10 minutes" explainers — watch-time bait that simplifies past correctness.

Stated plainly: **Quizlet/Blooket-style note-naming decks are the candy of music education.** If a unit's external resources are all flashcards and no listening, the unit failed section 2. One gamified drill per unit max, tied to a real piece.

---

## 5. Misconceptions the AI Tutor Must Catch

The tutor corrects these the moment they appear — once, with the fix — and logs the pattern.

1. **"Louder = better tone."** Louder is louder. Good tone is air support and control at *every* dynamic. Fix: "Play it beautifully at piano."
2. **"Theory is a set of rules."** Theory describes what composers did, not what's allowed. Fix: "Theory is a grammar book written *after* the language existed."
3. **"Talent vs. practice."** "I'm just not musical." Musicianship is trained. Fix: point at the student's own progress — improvement is the counterargument.
4. **"Tempo = rhythm."** Tempo is beat speed; rhythm is the pattern of durations. Fix: clap the same rhythm at two tempos.
5. **"Reading = musicianship."** Notation is a map, not the territory. Fix: ear-first tasks beside every notation task.
6. **"The metronome makes me stiff."** It reveals instability; it doesn't cause it. Fix: subdivide — partner, not judge.
7. **"My part doesn't matter."** Inner voices disengage. Fix: "Hear the recording with your part removed — what collapses?"
8. **"Practice = playing through."** Top-to-bottom runs rehearse mistakes. Every session needs a target passage and tempo plan.

---

## 6. Grade Calibration

| Level | From → To | What good looks like |
|---|---|---|
| **Middle school ensemble** | Making sound → reading and ensemble basics | Reliable tone, reads standard notation, follows a conductor, counts in simple meters, plays in tune with the section. |
| **High school ensemble** | Reading → interpreting | Phrases musically, adjusts intonation by ear, knows their harmonic/structural role, prepares parts independently, practices with a plan. |
| **AP Music Theory** | Interpreting → analyzing | Sight-sings, takes melodic/harmonic dictation, analyzes form and harmony in unfamiliar scores, writes in four-part style knowingly bending voice-leading conventions. |

The through-line: **sound → symbol → structure → meaning.** A middle schooler who can't read but can match pitch and keep time is ahead of a student who names every note and hears nothing. Ask "can they hear it?" before "can they label it?" — at every level, including AP.

---

# Part 12: PE / Health


*Author: PE/Health pod expert (department chair, adolescent health specialization). Reference student: Dawson, 15, 10th grade. Bar: what a best-in-state health classroom delivers — not a fitness blog.*

Health is the only course whose exam questions a student will answer for the rest of their life. Every decision here must reflect that weight: this is the one academic space where wrong information causes physical harm.

---

## 1. Unit structure

A Pookie PE/health unit carries three mandatory components — **skill, knowledge, and behavior change**. A unit shipping with fewer than all three is incomplete by definition.

**Knowledge** — the science the student must own: cardiovascular and musculoskeletal responses to training, macronutrient function, energy balance, stress physiology, pharmacology basics of alcohol/nicotine/cannabis. Testable, sourced.

**Skill** — the demonstrable competency: designing a progressive training week, evaluating a Nutrition Facts label against real needs, correct movement patterns, basic first aid (bleeding control, sprain/heat-illness response, CPR/AED awareness), refusal and help-seeking scripts. A unit with no demonstrable skill is a pamphlet, not a class.

**Behavior change** — the unit must close the loop to the student's own life: a SMART goal, a one-week self-experiment with logged baseline and follow-up, or a decision journal. Content that never asks the student to *do something different this week* has no place here. This is the component every school health program drops, and it is the one that matters most.

Standard units: (a) Principles of Fitness & Training Design; (b) Nutrition Science & Label Literacy; (c) Cardiovascular & Muscular Fitness; (d) Mental Health Literacy & Stress Management; (e) Decision-Based Substance Education; (f) First Aid & Injury Care; (g) Sleep & Recovery Science; (h) Body Image & Media Literacy.

---

## 2. Excellent study material — and what to reject

**Great material** is evidence-based, teen-specific, and agency-giving. Nutrition content cites current dietary guidelines and peer-reviewed physiology — it explains *why* protein supports training adaptations or *how* fiber affects satiety, never just issuing food commandments. Fitness programming teaches principles — progressive overload, specificity, reversibility — so the student can evaluate any workout, not just follow one. Mental-health material names conditions plainly (anxiety, depression, disordered eating), teaches the difference between feelings and disorders, and always includes a help pathway: trusted adult, school counselor, 988. The tone respects a 15-year-old's intelligence. No condescension.

**Reject without appeal:** fad diets and detoxes; "no pain, no gain" absolutes; exercise framed as punishment for eating; fear-based substance education (scare tactics raise skepticism, not safety); anything that moralizes food or bodies. **Body-image content gets special handling:** every piece on weight, shape, or appearance is sensitivity-flagged — no before/after imagery, no BMI presented as a personal verdict, no implication that a body is a problem to fix. A Learn section that makes one student hate their body to motivate another has failed completely.

---

## 3. Practice-quiz standards

Health quizzes must test *judgment*, because health decisions are judgments:

- **Scenario decisions (40%)** — "Design a week's training for a beginner with 3 days and 45 minutes." "A nosebleed won't stop after 15 minutes — what do you do?" Correct answers require applying principles to a novel situation.
- **Label/data reading (25%)** — real Nutrition Facts labels, real workout logs, real heart-rate data. Extract the relevant number, make a call.
- **Myth-vs-evidence (25%)** — claims the student evaluates with reasoning, not just true/false. Always paired: the misconception *and* the mechanism that makes it wrong.
- **Vocabulary recall (10%)** — definitions are the floor, never the ceiling.

**Difficulty progression:** Level 1 = identify/define (one concept). Level 2 = apply to a personal scenario (two concepts combined). Level 3 = design/evaluate — critique a flawed workout plan, evaluate a nutrition claim in an ad, write a refusal plan for a realistic pressure scenario.

**Traceability rule:** every generated question must be answerable from the uploaded unit material or an approved external source, and the quiz cites its source. When the student misses, the tutor points to the exact page or section. If the AI cannot show its source, the question does not ship.

---

## 4. External resources that actually work

No generic lists, no fitness influencers, no supplement brands wearing educator costumes:

- **Khan Academy — Health & Medicine:** genuinely excellent physiology explainers — cardiovascular system, energy systems, the endocrine response to exercise. Matches the knowledge component of fitness units directly.
- **American Heart Association youth resources (heart.org):** evidence-based cardiovascular guidance with zero commercial agenda; rare institutional source that writes at a teen reading level without dumbing down.
- **NEDA (nationaleatingdisorders.org) education materials:** for body image and media-literacy units, the only third-party source that handles the topic with the care it demands. Educational content only — never forums.
- **TeensHealth / Nemours KidsHealth (kidshealth.org):** vetted adolescent health reference — nutrition, sleep, stress, substance basics. The standing first stop for "is this normal?"
- **Stanford Medicine sleep-science explainers (YouTube):** real sleep researchers explaining adolescent sleep cycles. Authority matters here because every teen has heard contradictory claims.

**Standing rejection list:** anything sponsored by or selling a supplement/fitness product, any "transformation" content, anecdote-as-evidence, and any mental-health content without a listed help resource.

---

## 5. Misconceptions the AI tutor must catch

The tutor corrects these the way a good teacher does — with the mechanism, not just the verdict:

1. **Spot reduction** — Crunches do not burn belly fat. Fat loss is systemic, governed by energy balance and genetics. Strength training builds muscle; nutrition and overall activity drive composition change.
2. **"Carbs are bad"** — Carbohydrates are the primary fuel for high-intensity exercise and brain function. Type, timing, and total intake matter; demonizing a macronutrient is ideology, not physiology.
3. **"More sweat = better workout"** — Sweat measures thermoregulation, not effort or fat loss. Track performance metrics (load, reps, pace, heart-rate zones), not the puddle.
4. **"Stretching prevents all injury"** — Static stretching before activity can *reduce* power output; injury prevention comes from progressive loading, specific warm-ups, and technique. Dynamic before, static after — each has a job.
5. **"Mental health = just think positive"** — Anxiety and depression are medical conditions, not attitude failures. Validate first, normalize help-seeking, point to the counselor or 988. The tutor never plays therapist.
6. **"Lifting stunts your growth"** — No evidence for this; supervised youth resistance training is safe and beneficial. The real risk is technique and load — bad programming and ego lifting injure at any age.
7. **"You can out-train a bad diet"** — Training adaptations require adequate nutrition; energy availability drives recovery. Food is fuel and building material, not the enemy of training.
8. **"Pain means progress"** — Soreness (DOMS) is not a progress signal, and sharp or joint pain is a stop signal. Progress is measured by performance trends over weeks; pain is information, and some of it says stop.

The tutor treats a misconception as a *teaching moment*, not a correction — it asks what led the student there before explaining the evidence.

---

## 6. Grade calibration

**Middle school** is habit formation: move daily, eat with awareness, sleep enough, know the names of body systems, practice basic refusal skills. The standard is *doing* — establish behaviors while motivation is concrete and adult-guided.

**High school (Dawson's level)** is systems thinking about one's own body. The student should explain *why* a training block works, *how* nutrition choices interact with performance and recovery, *what* stress does to their physiology and how to intervene, and *when* to seek help for themselves or a friend. The shift: from "the teacher told me to stretch" to "I can design, monitor, and adjust my own health behaviors — and evaluate claims made to me." Quizzes at this level must demand evaluation and design (Level 3, §3), not just recall. A 10th grader who can recite the food groups but cannot read a label or critique a fitness claim has been failed by the unit.

---

## 7. Health-module connection

The Learn section and the health module (wearables, health data) are siblings with a hard boundary between them.

**Where they connect — education illuminated by real data:** the Sleep unit offers to overlay the student's actual sleep data when teaching sleep cycles, so "deep sleep matters for recovery" becomes *your* deep sleep last Tuesday. Fitness units reference the student's own resting heart rate or activity trends when teaching training zones and progressive overload. Nutrition units use logged meals to practice label-reading and energy-balance math on real inputs. All connections are opt-in per unit and framed as learning tools: see the concept in your own data.

**The boundary — educate, never diagnose:** the Learn section teaches what healthy sleep *looks like*; it does not tell a student they have insomnia. It teaches warning signs of disordered eating; it does not screen or label the student. The moment content crosses from "here is how the body works" to "here is what is wrong with your body," it stops. If a student's data suggests a concern, Learn's only job is to route — to a parent, counselor, or clinician. A red-flag script belongs in the health module with professional oversight, never in a study quiz. This boundary is not a UX preference; it is a safety line, and every health unit is reviewed against it before release.
