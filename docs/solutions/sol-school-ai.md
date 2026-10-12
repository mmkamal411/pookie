# School + AI Solutions — Concrete Buildable Designs

**Author:** school-systems & AI solution designer (subagent) · 2026-10-12
**Source requirements:** panel checklist `ACCESS-MODEL-REVIEW-CHECKLIST.md` §§1–5; build spec `BUILD-SPECIFICATION.md` FR-SCHOOL-001→017
**Status:** Design only. No code, no deploys. Every 🛑 is a redesign, not a workaround.
**Companion owners:** safety designer (crisis protocols, event router), UX designer (screen copy), health designer (W2/W8/W23, "power-up" definition)

**Cross-cutting rules every section below obeys:**
1. **Provenance split (FR-SCHOOL-001):** school-of-record data (grades, attendance, official school comms) inherits the school's audience — Pookie never promises a parent can't get it from the school. App-generated data (check-ins, mood, AI chats, practice content, forecasts the teen configures) is child-authority, governed by per-person × per-scope grants (Performance / Communications / Reflection / Wellness).
2. **Server-side enforcement only.** RLS + API-scope checks; the client never decides visibility.
3. **Safety carve-out** (§1.2b.3): safety-critical school comms (permission slips, lab/field-trip notices, incident reports, emergency notifications) are never revocable and live on a separate channel `revokeAccess` cannot touch.

---

## 1. Path-to-90 Forecast Engine (G18 · FR-SCHOOL-007)

**Goal:** a deterministic, versioned, unit-tested, input-cited grade-forecast engine. The LLM never computes grades. The engine is a pure function; the UI cites every input.

### 1.1 Inputs (each cited to the user with source + timestamp)

| Input | Source | Citation shown |
|---|---|---|
| Per-category earned / possible points | Latest gradebook sync | "Gradebook sync Oct 11, 3:05 AM (StudentVUE)" |
| Category weights (e.g., Tests 40%, Quizzes 25%…) | StudentVUE category config; fallback `grade-weights.json` | "Weights: from StudentVUE ✓ verified" or "Weights: fallback file (unverified) ⚠" |
| Known remaining assessments (name, category, due, max points) | `due_next` feed + teacher announcements | "Known remaining: 3 items from due_next" |
| Assumed remaining weight (if gradebook doesn't list future work) | Configurable default, teen-set | "Assumes 20% of grade still to come (your setting)" |
| Target | Fixed 90 (standing goal) | "Target: 90 (your goal)" |

Forecast output is **invalidated** when any cited input changes: the record stores `inputs_hash`; a sync that changes it marks prior forecasts `stale`.

### 1.2 Algorithm (pure, deterministic)

```
for each category c:
  avg_c   = earned_c / possible_c          (0..1; categories with 0 possible → excluded, flagged)
  w_c     = weight_c                       (must sum to 1.0 ± 0.001 or engine REFUSES → "weights invalid")

completed_points = Σ avg_c * w_c            over categories with graded work
remaining_weight = 1 - Σ w_c               over categories with graded work
                   (adjusted by known/assumed remaining assessments)

required_avg_on_remaining = (0.90 - completed_points) / remaining_weight

if remaining_weight <= 0:        → "grade is final" path
if required_avg_on_remaining > 1.0: → "mathematically out of reach via remaining work" path
                                    (then: makeup/extra-credit planner — never fabricate points)
else per remaining assessment a (max points p_a, category c):
  marginal_impact_a = (p_a / possible_remaining_in_c) * w_c   # exact points of final grade per point earned
  what_if_table[a] = grade_if(score = 70/80/90/100 on a)
```

The engine returns: `required_avg_on_remaining`, `what_if_table`, `top_3_levers` (ranked by marginal impact × feasibility), and `reachability` enum (`on-track | stretch | out-of-reach`).
Feasibility ranking uses only school-of-record facts (weight, points) — never LLM judgment.

### 1.3 Versioning

- Engine version `forecast.v<MAJOR>.<MINOR>` (e.g., `forecast.v1.3`). MAJOR = algorithm change; MINOR = bugfix/tuning.
- Every forecast row stores `engine_version`, `inputs_hash`, `computed_at`.
- Unit-test gate in CI: golden fixtures (exact inputs → exact outputs to 0.01) + property tests (monotonicity: higher future scores ⇒ higher forecast; weight-sum invariant; idempotence). A version bump requires fixture regeneration review by the math expert.
- When weights are corrected (real StudentVUE weights arrive), old forecasts are marked `superseded_by`.

### 1.4 Parent read-only rule on teen's checkboxes

- `path_to_90_actions` table: `id, student_id, class_id, action_text, done, done_at, created_by`.
- RLS: teen (owner) = full CRUD on own rows. Parent with Performance scope = SELECT only. Parent with no Performance scope = no rows.
- Enforcement test (CI): parent JWT cannot INSERT/UPDATE/DELETE — asserted, not assumed.
- The what-if simulator is **client-side and never writes**: parent can play with scenarios, but nothing persists except the teen's own checkbox state.

### 1.5 API shape

- `POST /api/v1/forecast/compute` `{ student_id, class_id, engine_version? }` → `{ forecast, citations[], engine_version, inputs_hash, stale }` (server recomputes deterministically; no stored-procedure LLM).
- `GET /api/v1/forecast/latest?student_id&class_id` → latest non-stale forecast + citations.
- `PATCH /api/v1/path-to-90-actions/:id` → teen-only (RLS 403 otherwise).

---

## 2. AI Practice Quizzes — Fail-Closed Verification Pipeline (FR-SCHOOL-005)

**Current state: BLOCKED. Until this pipeline exists and the pilot passes, the product ships source-text flashcards only** (verbatim Q/A spans from uploaded material, no AI generation, no distractors).

### 2.1 Pipeline stages (fail-closed: any stage failure ⇒ item never leaves staging)

1. **Source select** — uploaded unit materials for the class, unit-tagged (see §7). Source chunks carry `source_doc_id`, page/span refs.
2. **Span extraction** — verbatim candidate facts/formulas pulled from source (no paraphrase at this stage).
3. **Item generation** — LLM drafts question + correct answer + distractors, each citing `source_span_id`.
4. **Machine verification** ← the gate (see 2.2).
5. **Misconception-distractor audit** (see 2.3).
6. **Label + provenance attach** (see 2.4).
7. **Human spot-check queue** — 100% of pilot items, then 10%/week steady-state.
8. **Publish** — only to opted-in classes (see 2.5).

### 2.2 Machine verification of answer keys (how, concretely)

No LLM output is trusted on its own. Each item type has a **non-LLM verifier**:

- **Math / quantitative:** the generated answer must be re-derived by a deterministic solver. Design: parse the item's solution steps into a symbolic/numeric check (SymPy-class engine or numeric substitution); the verifier recomputes the final value independently. Pass = |verifier − key| < ε. Fail ⇒ item quarantined, never shown.
- **Factual / definitional:** the answer key must appear **verbatim** (or as a listed acceptable paraphrase pre-approved in the formula/definition bank, §8) in the cited source span. String-level containment check; fail ⇒ quarantine.
- **Formula use:** every formula referenced must exist in the verified formula bank (G19, §8) by `formula_id`; the verifier checks the ID exists and the version matches.
- **Cross-check:** a second, differently-prompted model attempts the question cold from the source span; disagreement ⇒ human review (not auto-pass).

Quarantine is a real state: `verification_status ∈ {pending, machine_pass, machine_fail, human_review, published, quarantined}` — only `published` renders to students.

### 2.3 Misconception-aware distractors

- Distractor taxonomy per subject (seeded by the education panel, e.g., math: sign-error, order-of-operations, formula-confusion, unit-error; science: teleological phrasing, correlation-causation).
- Each distractor must map to exactly one taxonomy entry (`misconception_tag`); a distractor with no tag is rejected.
- Pilot measures whether picking a distractor predicts the same error on the next real assessment (see 2.6) — that's what makes them "aware" rather than decorative.

### 2.4 AI-label persistence (data + UI)

- Data: `quiz_items.ai_generated = true`, `generated_by_model`, `verified_by ∈ {machine, human}`, `verified_at`, `engine_version`. The label is a **column, not a UI string** — it survives API responses, exports, and screenshots-of-record.
- UI contract: every rendered item carries a persistent badge — "AI-made · machine-checked Oct 12" (UX designer owns exact copy). The badge appears on the question card, the review screen, and any print/export. Removing the badge in any surface is a launch-blocking bug.
- Provenance chain: item → source_doc → uploader → class → unit. Tappable from the badge.

### 2.5 Opt-in model

- Per-class toggle `classes.ai_practice_opt_in` (default OFF). **Teen-owned toggle** (practice content is app-generated / child-authority). Parent with Communications scope sees toggle state; cannot flip it.
- Under-13: no AI quizzes at all (technical ban, per COPPA posture).
- Opt-in screen states the pipeline plainly: "Questions are AI-written, machine-checked, and labeled. Wrong answers are possible — tell us."

### 2.6 Pilot measurement plan (before scale)

- **Scope:** 1–2 classes, ≥4 weeks, ≥200 answered items.
- **Metrics:** (a) machine-verifier false-pass rate — target **0 verified-wrong keys shown to students** (fail-closed bar); (b) misconception-tag precision — ≥80% of flagged distractors confirmed by teacher review; (c) calibration — quiz-score vs next-assessment-score correlation reported, never a predicted grade; (d) teen helpfulness self-report.
- **Success bar:** zero wrong keys + precision bar met + no increase in student confusion reports ⇒ expand one class at a time. **Never A/B test ungrounded quizzes on students** (R8).
- **Kill switch:** any verified-wrong key reaching a student pauses the whole pipeline pending root-cause.

---

## 3. Peer Tips → "Study Sparks" Redesign (FR-SCHOOL-004 · G8 · R6)

**The rename is load-bearing:** "peer" on AI content is fabricated social proof. The product is **Study Sparks**: short, labeled, study-skill micro-content. No tip ever claims a human peer wrote it.

### 3.1 Content pipeline with QA gates

1. **Candidate generation** — from two allowed origins only: (a) curriculum documents (syllabi, unit outlines — never student work, never grades), (b) the study-skills technique library (pre-approved by the education panel).
2. **Study-skills fence** — classifier (§3.3). Fail ⇒ dropped, logged.
3. **Provenance attach** — label schema (§3.2).
4. **Contested-topic check** — (§3.4) → human queue if hit.
5. **Publish** with 4-week TTL (`expires_at = created_at + 28d`; nightly purge; expired rows hard-deleted, not soft).
6. **Weekly 5% sampling QA** — random 5% of live sparks reviewed by a subject teacher; results logged (`qa_reviews`); error-rate > 5% in a week ⇒ pipeline paused + root-cause before resume.

### 3.2 Provenance label schema

```json
{
  "spark_id": "uuid",
  "created_at": "ts", "expires_at": "ts",
  "origin": "ai-synthesis | curriculum-extraction",
  "source_refs": ["syllabus_doc_id…"],
  "deident_method": "aggregate-k5 | curriculum-only",
  "study_skill_tags": ["spaced-repetition", "retrieval-practice"],
  "review_status": "auto | human-approved | qa-sampled",
  "reviewed_by": "teacher_id | null",
  "ai_label": "Made by Pookie AI · checked {date}"
}
```

UI: the AI label renders on every spark card, tappable to this provenance. No spark renders without a resolvable label.

### 3.3 Study-skills-only fencing (topic classifier rules)

**Allowed (allowlist):** study techniques (spaced repetition, retrieval practice, interleaving, elaboration, dual coding), time/organization systems, exam-day logistics, note-taking methods, help-seeking scripts ("how to ask a teacher for…").

**Blocked (denylist, conservative default):** any curriculum *content* claim (facts, formulas, dates, definitions — those belong to the verified quiz/formula pipeline); health/medical/nutrition/body content; relationships/social advice; named schools, teachers, or students; current-events claims; anything the classifier scores < 0.8 "study-skill" confidence.

Two-stage classifier: (1) deterministic rules (entity/keyword denylist, formula-pattern detection); (2) LLM classifier with **fail-closed default** — uncertain ⇒ blocked. Blocked candidates are logged with reason codes for fence tuning.

### 3.4 Contested-topic human review queue

Topics flagged contested: evolution, climate, vaccines, historical interpretation, any current-events-adjacent content that slips the fence. Queue: `review_queue(item_id, topic_tag, enqueued_at, sla_due, reviewer_id, decision, decided_at)`. SLA 72h. Reviewers: subject teachers from the expert panel. Decisions: approve / edit-and-approve / reject (with reason). Rejected items retrain the fence (logged as negative examples).

### 3.5 De-identification standard (G8 — provable)

Technique: **aggregation floor + curriculum-only sourcing**, no per-family consent path needed if both hold:
- Sparks are generated from **curriculum documents or the pre-approved technique library only** — never from an individual family's grades, check-ins, uploads, or behavior.
- Any usage-pattern-derived spark requires a **k ≥ 5 family cohort** and carries `deident_method: "aggregate-k5"`; rare-attribute suppression (any slice < 5 families is dropped); no verbatim quotes from student-authored content ever.
- Provability: the pipeline logs `source_refs` + `cohort_size` per spark; a quarterly automated audit asserts no spark has `cohort_size < 5` with origin `ai-synthesis` and no spark cites student-authored sources. **If this can't be proven, the fallback is per-family consent before ship** (FR-SCHOOL-004 states the OR).

---

## 4. Teacher Inbox — Counselor Segregation (FR-SCHOOL-002 · FR-SCHOOL-016)

**ASCA B.2: counselor confidentiality is not a parent CC line.** The merged inbox is 🛑. Redesign as two stores with different visibility contracts.

### 4.1 Data model — separate tables, not flags

- `teacher_messages(id, student_id, thread_id, from, to, cc, subject, body, source ∈ {parentvue, ctls, gmail, manual}, fetched_at, safety_critical bool, redacted_body_parent)` 
- `counselor_messages(id, student_id, thread_id, from, subject, body, source, fetched_at, safety_critical bool)` — **no parent-readable body column at all**.
- Rationale for tables over flags: RLS is table-scoped (cleaner audit), the counselor store can have structurally different retention, and a flag is one buggy query away from a confidentiality breach.

### 4.2 Visibility rules per audience

| Audience | Teacher threads | Counselor threads |
|---|---|---|
| Teen (13+) | Full | Full |
| Parent, School-module scope granted | Full (redacted per §4.4) | **Metadata only** (thread exists, participants, last-updated, safety tag if set). Body requires teen grant of the `counselor_communications` scope |
| Parent, scope revoked | Nothing (follows School-module scope — **no split-brain**: one setting governs all teacher threads) | Nothing |
| Safety-critical tag set | Full + safety channel alert | Full + safety channel alert (never revocable, §1.2b.3 carve-out) |

- The `counselor_communications` scope is separate from the School-module Performance/Communications scopes, default teen-private, grantable by the teen only.
- **Thread visibility follows the School-module scope setting** — one toggle, one truth, enforced server-side. No per-thread parent overrides that could drift.

### 4.3 Provenance labels on every thread

Every thread header shows: source system (ParentVUE / CTLS / Gmail / manual), `fetched_at`, linked student, and for counselor threads a standing line: "Counselor conversations are confidential to the student (ASCA B.2)."

### 4.4 CC redaction — FERPA in practice (FR-SCHOOL-016)

Teacher emails frequently CC other students' parents or name other students. Before any parent-visible surface renders:
- Server-side transform matches names/emails in `to/cc/body` against the roster of **linked** students; non-linked student names → `[student name redacted]`, non-linked parent emails → `[redacted]`.
- The teen sees the unredacted thread (own education record). The original is preserved in the school-of-record store; `redacted_body_parent` is a derived render, not a second truth.
- Matching: exact + fuzzy on roster names; misses default to redact (fail-closed).

### 4.5 Safety-critical message tagging

Tagger: deterministic rules (keywords: injury, lockdown, emergency, 911, hospital, threat, weapon, "pick up immediately") + LLM classifier; **either** firing ⇒ `safety_critical = true`. Tagged messages: bypass all revocation, route to the safety channel, and surface to every linked parent + the teen's trusted adult. Tagging decisions are logged and teen-visible.

---

## 5. Check-in Cross-Check → Teen-Facing Calibration (FR-SCHOOL-003)

**The parent-facing lie detector is dead.** What ships is a metacognition tool the teen owns. Rationale the design protects: the crisis protocol depends on truthful check-ins, and honesty that gets punished stops.

### 5.1 Calibration algorithm

At check-in, the teen optionally estimates near-term outcomes ("I think I got ~80% on today's quiz"). When the synced actual arrives:

- Per-estimate error: `e_i = |estimate_i − actual_i|` (percentage points).
- **Calibration score** (rolling, last 10 estimates): `calibration = 1 − mean(e_i)/100`, shown as "within ±X pts on average."
- Framing bands (never grades, never accusations): "getting sharper 📈" (error shrinking), "steady", "still calibrating" — all phrased about the *skill of estimating*, never about honesty.
- Small-n guard: no score shown until ≥5 paired estimates ("need a few more to see your pattern").

### 5.2 Teen-only UI

- Lives on the teen's Today tab, inside their check-in history. Copy direction: "Your estimates are getting sharper — that's metacognition, and it predicts better studying." (UX designer owns final copy.)
- Explicit guarantee rendered in-product: **"Only you see this. It never appears in anything your parents see, and it never affects your access."**

### 5.3 Data-flow guarantee (which queries are parent-blocked)

- `calibration_scores` and `checkin_estimates` tables: RLS `SELECT` restricted to the owning teen. No parent role, no service path, no briefing query may reference them.
- Enforcement: (a) the parent-visible API serializer has an explicit **blocklist** of tables/columns (`calibration_scores.*`, `checkin_estimates.*`, `checkins.body` beyond scope); (b) CI test asserts a parent-scoped JWT receives 403/empty on every calibration endpoint; (c) the nightly access-audit job samples parent-visible payloads for blocklisted fields.
- Parent briefings/digests/nudges are generated from a **separate, allowlisted projection** — they cannot "accidentally" join calibration data.

---

## 6. Daily Check-ins — Data Rules (FR-SCHOOL-003 · G17)

### 6.1 Retention settings + purge job

- Per-teen setting `checkin_retention ∈ {rolling_90d (default), rolling_365d, manual_delete_only}` — set at onboarding, changeable anytime, teen-owned.
- **Never indefinite for minor-generated content** (G17, COPPA 2025 posture): even `manual_delete_only` shows a yearly nudge "you have 2 years of check-ins — keep or purge?".
- **Teen-deletable:** any single check-in deletable by the teen, effective immediately across app + API; parents cannot delete or restore the teen's check-ins.
- **Purge job:** nightly worker (`checkin-purge`): `DELETE FROM checkins WHERE student_id=? AND created_at < now() − retention_window`. Backups: source deletion propagates to backups ≤30 days (retention schedule §7 Category 7). Deletion requests honored ≤30 days, effective immediately in-app.
- Retention schedule is published in-product (Settings → Data), per the panel's demand for a written schedule now.

### 6.2 Lab-safety pulse (science classes)

- **What it asks** (one question, day-of-lab, inside the morning check-in): "Lab today in {class}. Did you read the safety card? Anything you're unsure about? (goggles, gloves, chemicals, heat)" + free-text "ask anonymously" box.
- **When:** triggered by `class_schedule` lab-day flags or teacher announcement keyword ("lab tomorrow"); morning of, before school.
- **Data rules:** answers are teen-visible; the free-text box is Reflection-scoped (never parent-visible); a "send my question to my teacher" button routes through the teacher-discussion flow (§15) with the teen's explicit tap — never auto-forwarded.
- Links the W19 lab-emergency quick-card (science panel requirement) directly under the pulse.

---

## 7. Unit Auto-Alignment (FR-SCHOOL-006)

### 7.1 Confidence model

Score 0..1 from weighted features:
- Syllabus/chapter keyword overlap with unit title (0.35)
- Teacher-provided unit mapping exists (0.30)
- Section/chapter number match (0.15)
- Prior student/teacher corrections agreeing (0.10)
- Date-window plausibility vs class schedule (0.10)

### 7.2 Thresholds + queue

| Score | Action |
|---|---|
| ≥ 0.85 | Auto-align; logged with score + evidence |
| 0.60–0.84 | Suggest to student ("Looks like Unit 3: Energy — confirm?"); student owns tagging |
| < 0.60 | Human queue — no alignment shown anywhere |

**High-stakes rule:** assessments, graded assignments, and anything feeding the forecast engine are **never auto-aligned below 0.85** — they go to the student queue instead. Never auto-align high-stakes content on a guess.

### 7.3 Queue + feedback loop

- Queue UI shows candidate units with evidence lines ("matched 'Unit 3: Energy' — syllabus p.4, ch. 7–9").
- Every student correction is stored as a labeled example and re-weights the model quarterly (human-in-the-loop learning, student-owned).
- Alignment decisions are provenance-logged (`aligned_by: auto|student|teacher`, `confidence`, `evidence`) so the quiz pipeline (§2) and tips pipeline (§3) only consume alignments above their own bars.

---

## 8. SAT Prep + Verified Formula Bank (FR-SCHOOL-008 · G19)

### 8.1 Digital-SAT blueprint

- Practice sets mirror the real test: **44 questions per full practice** (Reading & Writing + Math), **two adaptive modules** per section (Module 2 difficulty routes on Module 1 performance — routing logic deterministic and disclosed: "Module 2 got harder because Module 1 went well").
- **Desmos built in:** embedded Desmos graphing calculator in every Math module (same tool as test day) + a **Desmos fluency track** (skill checklist: graph an equation, solve via intersection, build a table, slider exploration) that must be completed before timed Math practice unlocks.
- **No fake score predictions.** Ever. Practice reports show raw accuracy by skill area and calibration ("your estimates vs actuals"), never a "predicted 1320."

### 8.2 Verified formula bank (G19) — the single grounding source

One bank grounds **quizzes (§2), Study Sparks math content (§3), tutor math answers (§12), and SAT formulas**. Schema:

```
formula_bank(
  id, subject, name, latex, plain_statement,
  source_citation,          -- textbook / College Board reference
  version,                  -- bank version, e.g. math.v4
  verified_by, verified_at, -- two-expert sign-off (who, when)
  machine_check             -- 'numeric-spotcheck-pass' | 'n/a' | details
)
```

- **Verification process:** (1) nominated from College Board / textbook sources; (2) numeric spot-check where applicable (e.g., quadratic formula tested against random coefficients by the deterministic solver); (3) **two subject-expert sign-offs** from the education panel (math/science teachers); (4) versioned release; changes require re-sign-off.
- **Who verifies:** named panel experts per subject (math: math teacher panel; science: science teacher panel). No formula ships on a single reviewer's sign-off.
- **API:** `GET /api/v1/formulas?subject=math&version=math.v4` → versioned, immutable set. Quiz generator must cite `formula_id`; the machine verifier (§2.2) rejects items citing unknown IDs. Tutor math answers (§12) must cite or be refused.
- **Consumer contract:** any AI math content not traceable to a bank ID is treated as unverified and blocked from student surfaces.

---

## 9. Sync Workers (Cat 5 ⚠️)

### 9.1 Portal ToS / CFAA posture — what counsel review covers

Written posture memo **before** any automated portal pull, covering:
1. **District ToS / acceptable-use:** StudentVUE/ParentVUE terms on automation, scraping, credential sharing; Cobb County AUP as applicable.
2. **CFAA posture post-*hiQ*:** access is via the user's own credentials with documented consent (not circumventing technical barriers); no ToS-violation-as-CFAA overreach, but state-law analogs checked.
3. **Credential handling:** vault encryption, no plaintext logging, rotation, cryptographic erasure on revoke (per standing Credentials-vault rule).
4. **Rate-limiting & politeness:** sync cadence that cannot resemble abuse; backoff on 429/403; 403-on-automation = hard stop, report to parent, fall back to manual.
5. **Data minimization:** pull only the fields the product uses; no credential reuse across students.
6. **Fallback:** if ToS prohibits automation → manual CSV import + teen/parent-assisted sync; the product must work without the worker.

Counsel sign-off is a launch gate for each portal, not a one-time memo.

### 9.2 Credential consent record (at vault-add)

```
credential_consents(
  id, user_id, student_id, credential_type,   -- 'studentvue' | 'parentvue' | 'gmail' | 'ctls'…
  purpose_text,        -- exact plain-language purpose shown at consent time
  consent_version, granted_at, granted_by,
  scope,               -- which modules consume this credential
  revoked_at
)
```

- Consent captured **in the vault-add flow** with explicit purpose text (≤8th-grade reading): "Pookie will use this login to pull grades and assignments nightly for the School module. You can revoke anytime; revoking deletes the stored login."
- Scope change ⇒ re-consent. Revocation ⇒ cryptographic erasure of the credential + `revoked_at` stamped; in-flight syncs cancelled.
- At 18 / go-independent: parent-connected school credentials **stop syncing until the adult student re-auths** (FERPA transfer; checklist §1.6.1).

### 9.3 Zero-guard generalized → ingest anomaly detection

The zero-grade guard becomes a rule engine over every ingest:

| Rule | Trigger | Action |
|---|---|---|
| Value bounds | grade ∉ [0, 105] | Quarantine record, flag |
| Delta spike | |Δ| > 30 pts vs last sync, same assignment | Hold from surfaces, require confirm |
| Zero burst | ≥3 new zeros in one sync | Quarantine + notify (school-of-record scope) |
| Weight sanity | category weights ∌ 1.0 ± 0.01 | Mark forecast stale, flag |
| Stale sync | no successful pull > 48h | Surface "data may be stale" badge everywhere grades render |
| Schema drift | unexpected columns / renamed fields | Pause worker, alert engineering, keep last-good snapshot live |
| Impossible completion | assignment marked graded before due date with no prior history | Flag for review |

Quarantine queue: `ingest_quarantine(record_ref, rule_fired, fired_at, resolved_by, resolution)` — human (parent/teen per scope) confirms or corrects; nothing quarantined reaches the forecast engine or parent surfaces.

---

## 10. W5 College & Future (FR-SCHOOL-009)

### 10.1 GSFC methodology — versioned data model, exact numbers

```
scholarship_methodologies(
  id, name,            -- 'HOPE Scholarship' | 'Zell Miller Scholarship'
  version,             -- 'gsfc-2026.1'
  effective_date, verified_at, verified_by,
  source_url,          -- 'https://www.gafutures.org'
  rules_json           -- { core_gpa_min, rigor_required, test_min:{sat, act}, … }
)
```

- **HOPE:** 3.0 core GPA + rigor requirements. **Zell Miller:** 3.7 core GPA + 1200 SAT / 26 ACT.
- Every W5 surface shows: methodology version + verification date + the standing line **"Verify at GAfutures.org"** — the app never presents itself as the authority.
- Rigor rules encoded exactly per GSFC (which courses count as "core"); core-GPA calculator shows its work (course-by-course inclusion flags).
- Methodology refresh: re-verified against GAfutures.org at least each August; version bump logged; old calculations keep their version stamp.

### 10.2 Chance-me = ranges + model card, never point estimates

- UI shows **admissions bands** (e.g., "historical admit range for this profile: 25–60%") with explicit uncertainty, never "72% chance."
- **Model card contents** (rendered in-product, tappable): model name/version; training data (public IPEDS + published Common Data Set ranges, years covered); features used (GPA band, test band, rigor count — no protected attributes); known limitations (doesn't see essays, recs, hooks, major-specific rates); calibration note ("bands are wide because admissions is noisy"); last-updated date.

### 10.3 Essay feedback-only (academic integrity)

- Allowed: comments anchored to the student's text (structure, clarity, grammar, "this paragraph's claim needs evidence"), Socratic questions.
- **Forbidden:** drafting sentences/paragraphs, rewriting passages, generating topic lists presented as the student's ideas. "Rewrite this for me" ⇒ refusal with integrity explanation + offer of feedback mode.
- Boundary enforcement: feedback mode returns **comments + highlighted spans**, never replacement prose. Attempts to elicit ghostwriting are refused in teen-readable language.

### 10.4 Counselor handoff prompts

At decision points the app generates "ask your counselor" prompts (student-authored content, §15 rules don't apply — these are the *student's* questions): e.g., "Ask Ms. Dunham: does my planned junior schedule meet Zell rigor?" — with one-tap copy and a log of what was asked when.

---

## 11. G20/G21 — 504/IEP Tracking + GA Graduation Audit (FR-SCHOOL-012 · FR-SCHOOL-013)

### 11.1 504/IEP data model

```
accommodation_plans(
  id, student_id, plan_type,        -- '504' | 'IEP'
  plan_year, document_ref,          -- pointer to the stored plan (vault)
  review_date, next_review_date,
  case_manager, school_year
)
plan_accommodations(
  id, plan_id, description,         -- e.g. "extended time 1.5x"
  setting,                          -- 'classroom' | 'testing' | 'both'
  responsible_party                 -- teacher / counselor / admin
)
accommodation_delivery_log(
  id, plan_id, accommodation_id, date,
  delivered bool, evidence, noted_by -- teen, parent, or teacher note
)
```

- **Store the plan:** the signed plan document lives in the vault; accommodations are structured rows, not PDF-only.
- **Track delivery:** per-accommodation delivery log (was extended time actually provided on the Unit 3 test?); gaps surfaced as "delivery gaps," phrased neutrally for counselor conversation, never as accusations.
- **Review dates:** `next_review_date` drives reminders at 60/30/7 days to parent + teen (school-of-record scope — safety-adjacent, never revocable as a reminder).
- Visibility: Performance/Communications scopes; the teen sees their own plan in full (self-advocacy is the point).

### 11.2 GA 23-credit graduation audit

```
graduation_requirements(
  version, state,           -- 'GA', 'ga-2026.1'
  total_credits,            -- 23
  subject_rules_json,       -- [{subject:'ELA', required:4}, {subject:'Math', required:4},
                            --  {subject:'Science', required:4}, {subject:'Social Studies', required:3},
                            --  {subject:'Health/PE', required:1},
                            --  {subject:'CTAE/FineArts/WorldLang', required:3},
                            --  {subject:'Electives', required:4}]
  effective_date, verified_by
)
course_completions(
  student_id, course_name, subject_area, credits_earned,
  grade, term, counts_toward  -- FK to subject_rules
)
```

- **Audit logic (deterministic):** map each completion to a subject bucket (fuzzy matches ⇒ student confirm queue, §7-style); compute earned / in-progress / remaining per bucket; flag shortfalls ("Science: 2.0/4.0 — on pace / behind pace"); project completion term from the 4-year plan.
- Every audit stamps `requirements_version`; requirement changes (state updates) re-run the audit and diff the result.
- **Counselor handoff:** one-page audit summary exportable for the spring counselor meeting — this replaces the manual spreadsheet counselors do today (the panel's actual ask).

---

## 12. Pookie AI Chat Governance

### 12.1 System-prompt architecture (layered, mode-independent safety)

1. **Identity layer:** "You are Pookie, an AI study companion. You are not a therapist, counselor, or medical professional. You are an AI — say so when asked, and your AI label is always visible."
2. **Safety layer (shared — see §13):** crisis protocol, mandatory-topic refusals, home-experiment rules, verification hooks. Identical in every mode; not overridable by user preference, prompt, or mode toggle.
3. **Domain layers:** tutor (math/science grounded in class materials + formula bank), school helper, general chat. Domain layers may set tone; they may not weaken layers 1–2.
4. **System-level minor-safety policy:** for under-18 accounts an additional policy block applies (no romantic/sexual content, no encouragement of risky behavior, eating-disorder-safe language, no location elicitation). This is **policy, not prompt** — enforced in the serving layer, not just the prompt text.

### 12.2 Verification hooks

- **Math answers:** every quantitative answer passes the deterministic verifier (§2.2/§8.2) **before display**. Fail ⇒ the chat says "I can't verify this — ask your teacher" rather than guessing. The hook is in the serving path, not the model.
- **Science answers:** grounded in the student's class materials or the formula/definition bank; ungrounded ⇒ "I don't have that in your materials" + offer to help find it. Persistent AI label on every answer (§2.4 pattern).
- **Home-experiment refusal rules:** no procedural instructions involving heat, flame, chemicals, sharps, electricity, or ingestion. Allowed: observation-only activities + "do this with your teacher" framing. Refusal copy is teen-readable and offers the safe alternative.

### 12.3 Event emission contracts (for the safety designer's router)

The chat layer **emits events; it does not decide responses to them**. The safety designer owns the router.

```
safety_events(
  id, student_id, occurred_at,
  type,       -- 'crisis_language' | 'abuse_disclosure' | 'mandatory_reporter_tripwire' |
              -- 'self_harm_plan' | 'eating_disorder_signal'
  severity,   -- 'watch' | 'urgent' | 'imminent'
  context_ref -- pointer to the (scoped) conversation excerpt
)
```

- **988 surfacing:** on `crisis_language`/`self_harm_plan`, the chat surfaces 988 + Crisis Text Line **in the conversation**, immediately, every time — regardless of mode.
- **No auto-parent-notification absent imminent risk.** `watch`/`urgent` ⇒ trusted-adult path per the safety designer's protocol (resolves G1: crisis alerts route to the teen-nominated trusted adult, never to a revoked parent). `imminent` ⇒ the router's emergency path.
- **Never presents as therapist:** enforced in the identity layer + a classifier that flags therapeutic framing ("I'm here for you unconditionally…") for rewrite.

### 12.4 No-training-on-inputs

- Vendor term: student inputs are **never used to train models** — contractual, with the vendor's attestation on file.
- Disclosure: in-product line in the Pookie tab — "Your chats aren't used to train AI." (UX designer owns placement; legal owns the vendor paperwork.)

---

## 13. Muse Toggle → "Direct Mode" (18+ gate)

**"Unfiltered" is dead as a word and as a promise** (Character.AI-shaped litigation risk). What ships is **Direct Mode**: same safety, blunter tone.

### 13.1 The 18+ gate (server-side)

- Gate input: verified DOB + `legal_status` (emancipated minors → adult track). Age computed server-side at request time.
- Under-18: the mode **does not exist in the UI** (not shown, not footnoted, not "ask your parent"). API returns 403 for under-18 mode requests regardless of client state.
- 18+: opt-in toggle, reversible, with a plain-language description: "Direct Mode is blunter. Safety rules don't change."

### 13.2 Shared safety architecture (identical across modes)

One safety layer serves both modes — same system-prompt safety block (§12.1 layer 2), same verification hooks (§12.2), same event emission (§12.3), same crisis protocol, same minor-safety policy (which additionally constrains nothing for adults but remains structurally present). **Mode is a tone preference; safety is a policy.** A test matrix in CI asserts identical safety behavior across modes for a battery of adversarial prompts (self-harm, disallowed content, homework-dump requests).

### 13.3 Branding guardrail (R7)

Never market "unfiltered" — not for adults either. The word is retired from copy, code comments, and docs.

---

## 14. Proactive Nudges

### 14.1 Nudge engine rules

- **Teen opt-in per category** (school, logistics, wellbeing-prompts). Default OFF for all; the teen enables what they want. Parents cannot opt a teen into nudges.
- **Frequency-capped:** ≤2/day, ≤5/week, per teen. Cap state is server-side.
- **Daytime only:** delivery window 8:00 AM–8:00 PM in the teen's timezone; never during configured school hours; never overnight. Queued nudges wait for the window.
- **Content scope-filtered:** nudge content may only draw from scopes the *recipient* holds. **Never Reflection/Wellness-derived nudges to parents** — a parent's nudge feed is generated from Performance/Communications data only.
- **No health-content push:** health-derived nudges don't exist as pushes, period (lock-screen leakage: a "drink water, your HRV…" banner on a shared screen is a disclosure).
- **Lock-screen hygiene:** push bodies are generic — "Pookie has a nudge for you" — detail only behind auth. No grades, no names, no health in the payload.

### 14.2 Kill switch + audit

Per-teen master kill switch (one tap, immediate). All nudges logged (`nudges_sent`) with scope-source tags; the weekly audit asserts no parent-directed nudge cited a Reflection/Wellness source.

---

## 15. Teacher Discussion Threads (parent-authored + AI proofreading)

**AI-ghostwritten parent emails are dead** (counselor 🛑: misrepresents the parent's voice, can trigger unintended mandatory-reporter consequences). The parent writes; the AI proofreads.

### 15.1 Composition flow with the proofreading boundary

1. Parent composes in their own words (blank draft — no AI-generated draft, no template-filled send).
2. "Check my draft" ⇒ AI returns **tracked-change suggestions only**: spelling/grammar, clarity, and tone notes ("this sentence may read as accusatory — consider stating the fact first").
3. **The AI may not:** add new claims or requests, change what is being asked, insert deadlines/ultimatums, draft new paragraphs, or "improve" by inventing context.
4. Parent accepts/rejects each suggestion individually; the sent email is byte-identical to what the parent approved. The approval record (diff accepted) is stored with the sent message.
5. "3 questions to ask" prompts are allowed — **prompts, not prose**: bullet questions the parent may use or ignore, never inserted into the draft.

### 15.2 Mandatory-reporter tripwire

If a draft discloses suspected child abuse/neglect, sexual misconduct, or a student's self-harm plan:
- **Send is blocked.** The UI explains why in plain language and routes to the safety flow: crisis resources (988, GA Crisis & Access Line, DFCS 1-855-422-4453), "talk to the school counselor directly," and a prompt to contact authorities — designed with the safety designer.
- The draft is **not** auto-forwarded anywhere; the event is emitted to `safety_events` (§12.3) for the router.
- Rationale shown to the parent: putting it in an email to a teacher creates a delayed, misdirected report — direct channels protect the child faster.

---

## 16. G10 — AI Disclosure Policy for Abuse Disclosures

### 16.1 Policy structure

1. **What the AI always says** (at conversation start for under-18s, and on topic detection): a short disclosure of limits — what Pookie is, that it's AI, that some things can't stay private.
2. **What the AI never promises:** "just between us," absolute confidentiality, "I won't tell anyone." These phrases are banned from outputs by classifier + prompt constraint.
3. **Crisis-line handoff script:** fixed, teen-readable, always offered — never conditioned on the teen "wanting" it.
4. **What happens next, honestly:** plain-language description of the trusted-adult / safety routing (no surprises later).
5. **Review:** policy text reviewed by the counselor + welfare experts; reading level ≤ 8th grade (checked, not assumed).

### 16.2 In-chat disclosure copy (contract — UX designer finalizes wording, meaning is fixed)

- Onboarding / first chat (under-18): *"I'm Pookie, an AI — not a person or a therapist. Most of what you tell me stays between us, but if you tell me someone's hurting you, or you're thinking about hurting yourself, I can't keep that private. I'll bring in help — always 988 (call/text) and the Crisis Text Line (text HOME to 741741) first, and a trusted adult you choose."*
- On abuse-disclosure detection: *"Thank you for telling me — that took guts. I need to be straight with you: I can't keep this just between us, because your safety matters more than secrecy. Here's what happens now: [router steps]. You deserve support from a real person: call/text 988 anytime."*
- Banned phrases (enforced): "just between us," "I promise I won't tell," "this stays here," any absolute confidentiality claim.

---

## 17. G28 — School-Issued Account Privacy (firewall disclosure)

**Don't imply privacy the school doesn't grant.** Cobb County Office 365 (and any school-issued account) is monitored by the school — Pookie's access model stops at the school's door.

### 17.1 Where the disclosure appears

- The "add children" step (school-transparency line, per §1.1.2).
- The Sharing screen firewall section.
- Anywhere a school-issued credential is connected (vault-add flow) and anywhere school email renders (inbox header).
- The consent screen's school section (unbundled, per §1.2.1).

### 17.2 Copy contract (meaning fixed; UX designer finalizes wording)

*"School accounts aren't private from your school. Your Cobb County email and files can be monitored by the district — Pookie can't change that. Anything in your school email follows your school's rules, not Pookie's privacy settings. Keep personal stuff in your personal accounts."*

Rules: appears **before** the credential is connected (not after); uses the district's name where known; never says "secure" or "private" about school accounts; repeated in compact form wherever school mail renders ("School-monitored account" tag on the inbox header).

---

## 18. Daily Pulls — News, Horoscope, Power-up (FR-SCHOOL-017)

### 18.1 News: reputable allowlist + contested-topic balance

- **Allowlist mechanism:** `news_sources(id, name, url, tier, added_at, added_by, review_due)` — seeded with wire services + established outlets (AP, Reuters, NPR, PBS, plus local: AJC for Georgia). Tier 1 (wire) may render verbatim summaries; Tier 2 (analysis) renders with source label. No opinion columnists, no aggregator blogs, no social-media sourcing.
- **Governance:** allowlist changes require editor review + logged reason; sources re-reviewed annually; a source that fails corrections standards is removed with a changelog entry.
- **Contested-topic balance:** a topic classifier flags contested topics (elections, legislation, active conflicts). Rule: contested topics render **only** from Tier-1 wire factual reporting, or are skipped for the day with "no wire coverage today." The product never synthesizes "both sides" itself and never editorializes.
- AI may translate/simplify language but must link the original + timestamp (same pattern as the W26 weather rule).

### 18.2 Horoscope: quarantine as opt-in entertainment — recommendation: QUARANTINE (not drop)

Reasoning: the science panel's objection is to horoscopes **masquerading as guidance** inside a school-intelligence ritual. The fix is framing, not necessarily deletion:
- Default OFF for all users; for under-18, available only via explicit opt-in under an "Entertainment" section — never in the morning ritual, never adjacent to grades or forecasts.
- Labeled on every render: "Entertainment only — not guidance." No personalization claims ("Mercury says you'll ace the test" is banned copy).
- If engagement is ~zero after 90 days, drop it entirely (revisit per R-list discipline).

### 18.3 "Power-up": recommendation — CUT unless the health designer defines it

- The feature is undefined, and "power-up" adjacent to a teen health surface reads as supplement/energy-product territory — a health-claim liability the panel flagged (G27).
- **Decision: cut from scope.** If the health designer later defines it as (e.g.) a hydration/stretch reminder, it re-enters as a W2/W8 feature under health-tier governance with health-claim review — not as a "daily pull."

---

## Appendix A — Cross-Domain Conflicts Flagged

| # | Conflict | Resolution proposed |
|---|---|---|
| C1 | **Counselor mail vs school-of-record inheritance (§4 vs FR-SCHOOL-001).** Counselor emails are technically school comms, yet ASCA B.2 demands confidentiality. | Resolve by treating counselor comms as a **separate audience class**: the school *could* disclose them, but Pookie *won't* surface bodies to parents without teen grant. Pookie never promises the school won't disclose — the consent screen says so. Counsel sign-off required on the exact line. |
| C2 | **Calibration honesty vs crisis truthfulness (§5).** Any whiff of "we check your answers" chills the check-ins the crisis protocol needs. | Resolved structurally: calibration is teen-only, parent-blocked at the query layer, with an in-product guarantee. If the safety designer finds any chilling effect in user research, calibration ships **estimates-only** (no actuals comparison) or not at all. |
| C3 | **Portal automation vs school-of-record expectations (§9 vs §1).** Parents expect complete grade data; ToS may forbid the automation that delivers it. | Resolved by the counsel memo gate + manual fallback as a first-class path. Never silently degrade: if automation is blocked, the UI says why and offers the manual path. |
| C4 | **G1 crisis-tripwire vs revoke.** Revoked parents must not receive crisis alerts; someone must. | Resolved via trusted-adult designation required before revoke executes (§12.3, §16). The safety designer owns the router; this doc owns the event contract. |
| C5 | **Nudge scope-filter vs parent anxiety (§14).** Parents will ask why they don't get wellbeing nudges. | Resolved by product honesty: the Sharing screen explains scope boundaries at grant time. No silent filtering — the parent sees "Wellness: teen-private" as a labeled state, not an absence. |
| C6 | **Proofreading boundary vs helpfulness (§15).** Parents will ask the AI to "just draft it." | Resolved by refusal with reason: ghostwritten school correspondence misrepresents the sender and can trigger real-world consequences. The "3 questions" prompts are the sanctioned help. |
| C7 | **Forecast determinism vs teen gaming (§1).** A teen could game what-ifs to argue "I'm fine." | Accepted: the engine shows its work and citations; gaming a transparent calculator is self-defeating, and parents see the same cited numbers. No hidden "effort scores." |

---

*End of solutions. Open questions for the parent agent: (1) confirm the 90-day default check-in retention vs a shorter 30-day default for under-16; (2) confirm horoscope quarantine vs outright drop; (3) whether the formula-bank verifier should be built in-house or bought; (4) counsel engagement timing for the §9 portal memo.*
