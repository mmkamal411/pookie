# Pookie Learn Section — Cross-Subject Framework

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
