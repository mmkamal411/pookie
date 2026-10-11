# Mathematics — Content Standard

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
