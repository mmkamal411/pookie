# Expert Panel Review — High-School Math Teacher Lens

**Reviewer role:** expert high-school math teacher (panel: education pod).
**Scope:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (access model) + `FEATURE-LIST-FOR-PANEL.md` (all 8 categories, 31 modules).
**Date:** 2026-10-12. **Jurisdiction:** Georgia.
**Facts verified 2026-10-12 via web:** GSFC HOPE GPA rules (core-only, local weights stripped, +0.5 AP/IB/degree-dual capped at 4.0, no rounding up, 4-credit rigor for 2017+ grads; Zell Miller = 3.7 GSFC GPA + 1200 single-sitting SAT / 26 ACT or val/sal); digital SAT math = 44 Qs, 2×35-min modules of 22, adaptive Module 2, Desmos built in throughout, 200–800, no wrong-answer penalty.

**Guiding principles applied:**
1. Wrong math instruction is high-harm — a confidently wrong procedure compounds.
2. Every number shown must be deterministic, input-cited, and honest about uncertainty.
3. Metacognition beats surveillance — the app should train the teen's judgment, not replace it.
4. Defaults are pedagogy — what the app shows by default teaches families how to relate to grades.

---

## PART A — Access model verdicts (per spec section)

### §1 Product principles — ✅ clear
Child-as-access-authority with server-side enforcement is the right call. Principle 5 ("client never derives roles") is load-bearing for every math feature below — forecasts, nudges, and teacher threads must all read the same server-side access state.

### §2 Signup & onboarding — ⚠️ needs change
The flow is sound, but **grade-sharing defaults are set here and the spec is silent on them**. Defaults teach families the relationship model. If School-module sharing defaults to hidden, you train secrecy; if it defaults to shared-with-teen-controls, you train negotiated awareness — which is the pedagogically superior equilibrium (teen-owned goals + parent awareness beats both secrecy and surveillance).
**Required addition:** at child-link time, School module defaults to **shared with connected parents**, with the teen shown the toggle immediately ("You can change this anytime in Sharing"). Opt-out, not opt-in.

### §3 Authority matrix — ✅ clear (mechanism), ⚠️ needs change (one disclosure gap)
The matrix itself is correct and `granted_by` enforcement is the right mechanism. **Gap:** nothing in the matrix or its UI tells the family the **school-records reality**: revoking in-app grade visibility does **not** revoke a parent's FERPA right to request education records directly from the school while the child is under 18. Without this disclosure the Sharing screen makes a promise the app cannot keep, and the first parent who learns it from the school — not the app — loses trust in the whole product.
**Required:** verbatim disclosure on the Sharing screen (see Part C, change 1).

### §4 Age tiers — ⚠️ needs change
- **13–15 cooling-off: ✅ clear.** The scheduled, cancellable, both-parents-notified design is exactly right. The confirmation copy ("Your grades will stop updating") is honest.
- **16–17 instant revoke: ✅ clear.**
- **18+ continuity: ✅ clear**, with one math-data addition: when a revoked parent had connected school credentials, historical forecasts freeze but remain viewable; the young adult gets the guided re-connect (already specified — extend the same handoff to the 13–17 "go independent" flow, which currently lacks it).
- **Missing: teacher-thread consistency rule.** The highest-friction scenario in this spec: teen hides Geometry grades from Mom; Mom opens the Geometry teacher thread and reads "Dawson's Unit 3 test was a 55." The control is now illusory, the teen feels betrayed by the app, and the teacher is caught in the middle of a family access dispute they never consented to mediate. **Required invariant:** teacher/counselor thread visibility follows the child's sharing setting for the School module — one rule, no split-brain. If the class is hidden, its threads are hidden. (See Part C, change 2.)

### §5 Linking methods — ✅ clear
Email hardening, link codes, claim dedupe: all sound. No math-domain objection.

### §6 "Go independent" — ✅ clear, ⚠️ one addition
Graduation framing is correct. **Add:** the data-source handoff specified for 18+ (guide the teen to connect their own school credentials) must also apply here — otherwise the newly independent teen's grade tracking silently goes dark and path-to-90 freezes on stale data without anyone noticing.

### §7 "Just me" mode — ✅ clear
No objection. (A childless adult's Pookie never touches grade math.)

### §8 Migrations — ✅ clear
`granted_by` NOT NULL with backfill, status enum, code-hash storage: sound.

### §9 API surface — ⚠️ needs change
Two server-side enforcements are implied but not stated:
1. Every `/api/v1/children/[childId]/school/*` route must enforce the §3 matrix (not just the RPCs named here).
2. `teacher-messages (+approve/send)` must enforce the **teacher-email send window** (6:00 AM–10:00 PM user-local; quiet-hour approvals held to 6:00 AM) **server-side** — a client-side hold is bypassable and the standing rule exists precisely because timing matters.

### §10 UI screens — ⚠️ needs change
Add to screen 3 (Sharing screen): the FERPA-reality disclosure (Part C, change 1) and the per-module toggle with the School-default-shared rule (§2 change). Add to screen 5: frozen-forecast notice for revoked parents.

### §11 Risks & mitigations — ⚠️ needs change (add row 9)
| # | Risk | Mitigation |
|---|---|---|
| 9 | Grade-visibility controls imply more than they deliver (FERPA school-direct rights persist to 18); teacher threads leak hidden grades | Verbatim disclosure on Sharing screen; teacher-thread visibility inherits the School-module setting — single invariant, no split-brain |

---

## PART B — Feature verdicts (all 8 categories)

### 1. CORE PLATFORM
| Feature | Verdict | Note |
|---|---|---|
| Google OAuth + magic link | ✅ clear | — |
| Session management | ✅ clear | — |
| Onboarding flow | ⚠️ needs change | Set School-sharing default (shared, teen-adjustable) at link time — §2 |
| 5-tab navigation | ✅ clear | — |
| Child switcher | ✅ clear | — |
| Nebula theme | ✅ clear | Outside domain |
| `/verify-invite` public landing | ✅ clear | — |

### 2. POOKIE AI ASSISTANT
| Feature | Verdict | Note |
|---|---|---|
| Pookie AI chat (warm tutor) + Muse toggle | ⚠️ needs change | **Math-accuracy gate required.** A warm, confident tutor that explains math wrong is high-harm. Require: math-question detection → quantitative claims verified (symbolic/numeric re-solve) before display, "verified" badge; formulas drawn only from the curated formula bank (Part E, gap 2), never free-generated. Pedagogy: homework mode = hints first, full solutions only after an attempt or on parent/teacher request — handing over solutions short-circuits learning. |
| Cloudflare Worker (Llama 3.3 70B) | ⚠️ needs change | Model is fine for chat; do not rely on a future model upgrade as the math-accuracy fix. The verification layer matters more than the model. |
| Instant-respond routing | ✅ clear | — |
| Weekly teacher discussion threads | ✅ clear | Drafts are parent-approved; add: drafts must never disclose app-derived tracking to teachers ("Pookie flagged…") — see Part D |
| Proactive nudges | ⚠️ needs change | Nudges containing grade math must use the same verified forecast engine (Part C, change 4) and must **never notify a parent about a grade the teen hid** — nudge routing reads the access matrix. Also: batch grade-change notices into briefings; real-time "grade dropped!" push alerts create surveillance dynamics and punish the teen for sync cadence |

### 3. TODAY
| Feature | Verdict | Note |
|---|---|---|
| Morning ritual view | ✅ clear | Urgency ordering should be explainable |
| "Tonight's plan" assembly | ⚠️ needs change | If it allocates minutes across assignments, the arithmetic must be shown and validated: sum of estimates ≤ available window; overcommit flagged, not silently scheduled |
| Check-in cross-check | ⚠️ needs change | Reframe as **calibration training** (metacognition), not lie detection — see Part C, change 5 |

### 4. THE 31 MODULES
**Grove: School Days — W1 School (the live module; detail in §5 below):** verdicts under "5. SCHOOL INTELLIGENCE".

| ID | Module | Verdict | Note |
|---|---|---|---|
| W16 | School Calendar | ✅ clear | — |
| W5 | College & Future | ⚠️ needs change | **HOPE/Zell Miller math must follow GSFC methodology exactly** (Part C, change 7). "Chance-me" percentages: show ranges + named inputs + model card — never a black-box point estimate. Net-price/aid figures labeled estimates with methodology. 12-yr pathway cost math fully itemized |
| W4 | Activities | ✅ clear | — |
| W18 | Summer | ✅ clear | — |

**Grove: Body & Heart** — W2 Health, W8 Wellbeing (teenPrivate), W13 Meals, W22 Activity, W23 Nutrition: ✅ clear (outside domain; teenPrivate respected).

**Grove: Home & Family:**
| ID | Module | Verdict | Note |
|---|---|---|---|
| W21 | Mail | ✅ clear | — |
| W20 | Shopping List | ✅ clear | — |
| W11 | Spending | ✅ clear | With invariant: category totals must reconcile to the statement total (sum-of-parts = whole — test it); categorization accuracy measured, not assumed |
| W7 | Money & Documents | ✅ clear | — |
| W24 | Credit | ⚠️ needs change | Score "coaching"/simulators must carry uncertainty — never a precise predicted score. Utilization math must be per-card AND aggregate (that's the FICO-relevant computation). "Tax deductibles" needs a not-tax-advice label |
| W14 | Co-parenting | ⚠️ needs change | Keep the coordination layer (pickups, logistics) separate from the child-records layer: both parents see logistics; child records follow the §3 access matrix. A child grant to Parent B that Parent A cannot revoke must hold here too |
| W12 | Babysitters | ✅ clear | — |
| W10 | Fairness | ⚠️ needs change | **Do not ship a single "fairness score" or rank children.** Any equity computation is a model with assumptions — show per-child needs-met views with visible inputs, never a leaderboard. Comparing siblings numerically does measurable harm |

**Grove: Safe & Sound** — W3 Safety, W19 Emergency: ✅ clear.

**Grove: Growing Up** — W6 Driving & Life Skills, W15 Screen Time, W17 Friends (teenPrivate): ✅ clear.

**Grove: Out & About:**
| ID | Module | Verdict | Note |
|---|---|---|---|
| W25 | Fuel & Charging | ✅ clear | Price arithmetic trivial; fine |
| W26 | Weather | ✅ clear | — |
| W27 | Events | ✅ clear | — |
| W28 | Restaurants | ✅ clear | — |
| W29 | Trails & Parks | ✅ clear | — |
| W30 | Flights | ⚠️ needs change | "AI fare prediction" + "price honesty": predictions must be intervals with stated assumptions ("buy now vs wait" as expected value), never a point price presented as fact |
| W31 | Rental Cars | ⚠️ needs change | Total-cost ranking must be reproducible from displayed line items (all fees in); ranking logic shown |

### 5. SCHOOL INTELLIGENCE (W1 detail)
| Feature | Verdict | Note |
|---|---|---|
| 13 data sources, named owners | ✅ clear | Good accountability design |
| Per-class pages, gap-to-90 hero | ✅ clear | Mission framing is pedagogically right; the math behind it is ⚠️ — see change 4 |
| Top-3 ranked actions, checkboxes | ✅ clear | Add "why this first" explainability (highest weight × lowest effort) — Part D |
| Collapsed-by-default cards | ✅ clear | — |
| Path-to-90 checkboxes → Supabase | ✅ clear | — |
| Daily check-in per class | ✅ clear | — |
| Handout uploads | ✅ clear | — |
| Teacher inbox (multi-source merge) | ⚠️ needs change | Merge/dedupe logic must not drop messages; visibility follows School-module setting (Part C, change 2); drafts never reveal app tracking (Part D) |
| **AI practice quizzes from uploaded unit material** | 🛑 **blocked as designed** | No verification layer is specified. LLM-generated math with LLM-generated explanations and LLM-graded answers will be wrong at a rate no teen can detect. **Path to ✅ in Part C, change 3** — fail-closed verification pipeline is non-negotiable |
| Unit auto-alignment | ⚠️ needs change | Confidence-scored; below-threshold items (esp. quizzes) go to the human tagging queue — Dawson owns unit tagging per standing rules; never auto-align high-stakes content on a guess. Tag accuracy must be measured (Part D) |
| Peer tips pipeline (600/wk, 4-wk expiry) | ⚠️ needs change | Volume + unverified procedural math = same harm class as quizzes at scale. Require: formula-bank grounding for procedural claims, confidence-scored unit tags, ranked top-N display (not a firehose), measured tag accuracy, dedupe — Part C, change 6 |
| SAT prep (words, formulas) | ⚠️ needs change | Digital-SAT structure (44 Qs, 2 adaptive modules, Desmos built in), verified formula bank, Desmos fluency training, honest scoring (no fake score prediction) — Part C, change 8 |
| Lunch/dinner, power-up, notes, news, horoscope | ✅ clear | Outside domain (horoscope: harmless entertainment) |
| Sync workers (StudentVUE via Playwright) | ⚠️ needs change | **Generalize the zero-guard into ingest anomaly detection:** flag period-over-period grade drops beyond threshold for review before they publish to forecasts — one bad 0 in a heavy category craters every downstream number. Forecasts recompute only from source-of-truth snapshots with the versioned engine |
| ParentVUE/CTLS/Gmail pulls | ✅ clear | — |

### 6. FAMILY & ACCESS MANAGEMENT
| Feature | Verdict | Note |
|---|---|---|
| Email invite → verify flow | ✅ clear | — |
| 6-digit link codes | ✅ clear | — |
| Child access authority (`granted_by`) | ✅ clear | Mechanism right; add FERPA disclosure (Part C, change 1) |
| Age tiers | ⚠️ needs change | Per Part A §4: sharing-screen disclosure + teacher-thread invariant + 13–17 handoff |
| Sharing screen (per-person toggles) | ⚠️ needs change | Toggles need the consistency invariant; School default = shared (Part A §2) |
| Access request flow | ✅ clear | — |
| Block list | ✅ clear | — |
| "Go independent" flow | ✅ clear | Add credential handoff (Part A §6) |
| 18th-birthday prompt | ✅ clear | Add frozen-forecast notice for revoked parents |
| `graduate_child_access` RPC | ✅ clear | — |
| Claim dedupe | ✅ clear | — |

### 7. SETTINGS & DATA MANAGEMENT
| Feature | Verdict | Note |
|---|---|---|
| Settings → Profile / Sync console / Health / Credentials / Family | ✅ clear | — |
| SYNC NOW + worker health | ✅ clear | — |
| Credentials vault | ✅ clear | Outside domain |
| Notification preferences | ✅ clear | Nudge routing must read the access matrix (Part B §2) |
| Data retention policies | ⚠️ needs change | "Emails TBD" — decide it. **Retain raw grade snapshots** (not just derived forecasts) so every trend and forecast is reproducible — retention policy should name grade snapshots explicitly |

### 8. API PLATFORM
| Feature | Verdict | Note |
|---|---|---|
| `GET /api/v1/me` | ✅ clear | — |
| `/api/v1/children/[childId]/school/*` | ⚠️ needs change | Must state §3 matrix enforcement on every route (Part A §9) |
| `/api/v1/children/[childId]/college/*` | ✅ clear | Deadlines/essays fine; essay feedback must not write the essay (academic-integrity note — feedback, not authorship) |
| `/api/v1/household/*`, `/invites/*`, `/tutor/*` | ✅ clear | Tutor routes inherit the math-verification gate |
| Notifications API (planned) | ⚠️ needs change | Planned batching, not real-time grade alarms (Part B §2) |

---

## PART C — Concrete spec changes (quote + replacement)

**Change 1 — Sharing-screen FERPA disclosure (access spec §4, new paragraph after the 18+ subsection).**
> Quote: "Historical data: parent keeps what they already saw; loses all future access from the revoke point."
> Replacement — append: "Historical data: parent keeps what they already saw; loses all future access from the revoke point. **School-records reality (shown verbatim on the Sharing screen):** 'Hiding something in Pookie only controls what Pookie shows. Until age 18, your parents keep their legal right to request your school records directly from the school (FERPA). Pookie can't change that — but what happens here stays a conversation between you and your family.'"

**Change 2 — Teacher-thread visibility invariant (access spec §4, new subsection; feature list §5 teacher inbox).**
> Quote: "Teacher inbox per class (teacher + counselor + Outlook 365 + Synergy mail merge)"
> Replacement: "Teacher inbox per class (teacher + counselor + Outlook 365 + Synergy mail merge). **Visibility invariant:** teacher/counselor threads about a child inherit that child's sharing setting for the School module — one rule, no split-brain. A hidden class hides its threads; a visible class shows them. Rationale: a parent reading 'Unit 3 test was a 55' in the inbox after the teen hid the 69 grade makes the control illusory and puts the teacher in the middle of a family access dispute."

**Change 3 — AI practice quiz verification gate (feature list §5).**
> Quote: "AI practice quizzes from uploaded unit material; unit auto-alignment"
> Replacement: "AI practice quizzes from uploaded unit material; unit auto-alignment. **Math verification gate (blocking):** every quantitative item ships only with a machine-verified answer key (independent symbolic/numeric re-solve; for algebra, symbolic equivalence, not string match); every explanation step is re-checked and the item is **withheld fail-closed** if any step fails verification; free-response grading uses normalized numeric tolerance or symbolic equivalence — never LLM partial-credit judgment; items carry unit tag + confidence, and below-threshold items enter the human tagging queue instead of shipping. Geometry-proof items are excluded until a verification method exists."

**Change 4 — Path-to-90 deterministic engine (feature list §5 / W1).**
> Quote: "path-to-90"
> Replacement: "path-to-90, computed by a **deterministic, versioned forecast function with unit tests over edge cases** (missing-vs-zero, dropped scores, extra credit beyond 100%, late penalties, unknown category weights → shown as ranges with 'weights not yet captured' state, division-by-zero on empty categories). Every figure cites its inputs ('assumes Tests = 50%'). Targets label their **grading period** (GP progress marker vs permanent semester grade; Cobb 14-day makeup rule surfaced). **Mathematically unreachable targets are stated plainly with dignity** ('a 90 isn't reachable this period even with perfect scores — here's what's in reach: 84, which protects your semester average') — never 'you need 130%'."

**Change 5 — Cross-check → calibration (feature list §3).**
> Quote: "Check-in cross-check (child's self-report vs synced data, curious non-accusatory tone)"
> Replacement: "Check-in **calibration**: the teen predicts their standing before seeing synced data; the app tracks prediction accuracy over time as a metacognition skill ('your estimates are getting sharper'). Curious, never accusatory — the goal is training judgment, not catching misreporting."

**Change 6 — Peer tips grounding (feature list §5).**
> Quote: "Peer tips pipeline: 600 fresh unit-tagged tips/week, 4-week expiry"
> Replacement: "Peer tips pipeline: 600 fresh unit-tagged tips/week, 4-week expiry. **Quality gates:** procedural/formula claims may only reference the curated formula bank (Part E, gap 2) — never free-generated procedures; every tip carries a unit tag with confidence score, below-threshold tags go to the human queue; tag accuracy and duplicate rate are measured weekly; display is ranked top-N by relevance to the current gap, never an unfiltered firehose."

**Change 7 — HOPE/Zell Miller methodology (feature list §4, W5).**
> Quote: "50-college simulator (GA in-state + Southeast + national pre-med), HOPE/Zell Miller"
> Replacement: "50-college simulator (GA in-state + Southeast + national pre-med), HOPE/Zell Miller computed **per published GSFC methodology** (core academic courses only; local weights stripped then +0.5 for AP/IB/degree-level dual enrollment capped at 4.0; no rounding up; 4-credit rigor requirement; Zell Miller = 3.7 GSFC GPA + 1200 single-sitting SAT / 26 ACT or valedictorian/salutatorian) — methodology versioned and shown beside every figure, with a link to the student's official GAfutures HOPE GPA as ground truth. 'Chance-me' figures are ranges with named inputs and a model card, never point estimates."

**Change 8 — SAT prep honesty (feature list §5).**
> Quote: "SAT prep (words, formulas), 3 scheduled blocks"
> Replacement: "SAT prep (words, formulas), 3 scheduled blocks. **Math prep follows the digital SAT blueprint** (44 questions, two 35-minute adaptive modules, Desmos built in throughout, 200–800, no wrong-answer penalty) and includes **Desmos fluency training** (the highest-ROI digital-SAT skill). All formulas come from the verified formula bank. Practice scores are labeled estimates with the adaptive-scoring caveat — the app never presents a predicted SAT score as a fact."

---

## PART D — Feature improvements (beyond the blocking changes)

1. **"Why this first" explainability.** Top-3 actions should each carry one line of reasoning ("Tests are 50% of your grade and the Unit 4 test is in 6 days — this moves the needle most"). Ranked advice without reasons trains compliance; with reasons it trains prioritization.
2. **Tonight's-plan budget check.** Sum estimated minutes vs. available window; surface overcommit explicitly ("this plan needs 3.5 hrs; you have 2 — drop or defer one item").
3. **Measure unit-tag accuracy.** Sample auto-aligned items weekly against human tags; publish the accuracy; hold the quiz/tip gates to a threshold (suggest ≥95% before tips skip the queue).
4. **Teacher-draft hygiene.** Muse's teacher-email drafts must never reveal app-derived tracking ("Pookie flagged…", "our sync shows…"). The teacher relationship is human; the app stays invisible in that channel.
5. **Spending reconciliation invariant.** Sum of categorized spending must equal the statement total; surface the uncategorized remainder honestly instead of forcing it into categories.
6. **W14 coordination/records split.** Build the co-parenting logistics surface so it never needs child-record access to function — a parent with revoked school access still sees pickup times.
7. **Essay feedback, not authorship.** College essay feedback must be critique-only; the app should refuse to draft essays (academic-integrity line, stated in-product).

## PART E — Gaps (missing features)

1. **Deterministic grade-forecast engine** — versioned, unit-tested, input-cited. Implied everywhere, specified nowhere. This is the highest-value math artifact in the product.
2. **Curated formula/definition bank** per class + unit (teacher-approved, versioned) — the single grounding source for quizzes, tips, tutor math, and SAT formulas.
3. **Desmos fluency training** for the digital SAT (built-in calculator = the test's defining feature; prep that ignores it is incomplete).
4. **Calibration metric** from the reframed check-in (Part C, change 5) — a genuine metacognitive skill the app could own.
5. **Ingest anomaly detection** — generalize the zero-guard: any period-over-period swing beyond threshold is quarantined for review before forecasts publish.
6. **Grading-period semantics in every forecast** — GP (progress marker) vs semester (permanent), Cobb 14-day makeup countdown surfaced where it changes the math.
7. **Math accessibility** — math notation rendered as MathML with screen-reader support; auto-generated math must not be image-only.
8. **State-rules engine** — HOPE math, grading scales, and FERPA-adjacent rules are Georgia-specific; isolate them now so expansion doesn't fork the codebase.
9. **Raw grade-snapshot retention** — named in the retention policy so trends and forecasts stay reproducible.
10. **Nudge-routing audit** — a checkable guarantee that no notification path can deliver a hidden grade to a parent (test the matrix against the notification graph).

## PART F — Reassessment flags (bring the math reviewer back when…)

1. The quiz verification pipeline (Part C, change 3) is built — re-review before it serves a teen.
2. The forecast engine (Part C, change 4) ships with its unit-test suite — re-review the edge cases.
3. The tutor LLM is swapped or upgraded — re-run math-accuracy verification; never accept "newer model" as the fix.
4. Expansion beyond Georgia — re-review W5, grading semantics, and the state-rules engine.
5. A new SIS adapter is added — category-weight semantics differ by system; re-review path-to-90 inputs.
6. Peer-tip tag accuracy falls below threshold or volume changes — re-review the quality gates.
7. Any feature proposes showing a family a predicted number (score, chance, fare, savings) — apply the uncertainty rule: intervals + assumptions, never point estimates.

---

**Bottom line:** the access model is philosophically right and mechanically sound — its gaps are disclosure and one consistency invariant, both fixable in a day. The math-education risk in this product is concentrated in exactly three places: **unverified AI math content** (quizzes/tips/tutor — 🛑 until the verification gate exists), **forecast honesty** (deterministic engine, cited inputs, dignified impossible-target handling), and **prediction humility** (HOPE, chance-me, fares, scores — intervals and methodology, never oracles). Get those three right and the 90%-goal machinery is genuinely good pedagogy: gap-framed, teen-owned, parent-aware.
