# Squad 3 — School Track 🌿 · Product Backlog

**Owner:** Product Manager (PMP) · **Branch:** `staging-build` · **Created:** 2026-10-12
**Source requirements:** `docs/BUILD-SPECIFICATION.md` (FR-SCHOOL-001–019, FR-AI-001–005, FR-AUTH-011) · `docs/solutions/sol-school-ai.md` · `docs/PANEL-ROUND2-SOLUTIONS.md` (Proposal 5) · `docs/pm/WBS.md` (5.0, 6.0) · `docs/MD-DECISIONS.md` · `docs/pm/RISK-REGISTER.md`
**Companion design doc:** `docs/squad3/UX-SPECS.md` (⚠️ §3 second-parent section was written for the superseded invite-only D5 — UX designer to re-scope per D5 REVISED; flagged in Decision log)

**Governing directives (apply to every work package below):**
1. **D5 REVISED — OPEN SIGNUP** (MD-DECISIONS.md, Mehedi override 2026-10-12, supersedes earlier invite-only D5): the corroborated claim fallback is BACK in v1 scope. Invite-from-inside stays as the optional fast path. Reversal noted `v2 → v1` on affected packages so the team doesn't get whiplash.
2. **NO PLACEHOLDERS** (Managing Director directive, Mehedi 2026-10-12): every work package ships as a FULL working implementation — real tables, real API endpoints, real UI wired to real data, real RLS policies. No mock data, no "coming soon" screens, no stubbed functions, no TODO comments in shipped code. If an integration point's upstream interface isn't built yet, build against the spec'd interface in BUILD-SPECIFICATION.md, mark the integration point in code comments AND in this backlog, and verify end-to-end against real data. Code cleanliness: no dead code, no console.logs, clean every file touched. (Supersedes the "seedling placeholder" launch approach for Squad 3 surfaces.)
3. **🛑 items are launch gates** (WBS dictionary): a blocked feature does not ship "temporarily" — the panel was explicit and Mehedi accepted all recommendations.
4. **No deploy** until the Managing Director says so. Progress posts to `docs/BUILD-LOG.md` newest-first.

---

## A. Work packages (dependency order)

Order follows the delivery sequence: provenance + migrations → inbox → check-in → sparks/quizzes → Path-to-90 → college → activities/summer/calendar → second-parent → AI gates. TAKE-IT-DOWN sits with foundation (upload path); sync workers sit with foundation (everything consumes them).

### Foundation: provenance, migrations, sync, compliance path

**WP-S3-01 — Migration block 030–039: school rebuild schema**
- FR: SCHOOL-001, 002, 003, 004, 005, 007, 012, 013, 018 · AUTH-011 (flag column)
- Owner: Senior Backend
- Acceptance: all tables named in WPs below exist with PK/FK/RLS; `psql` syntax-check passes; every table has an RLS deny-by-default policy; apply-order file lists 030–039 after Platform 018–023 with no number collisions; no orphan FKs.
- Dependencies: Platform Team 1 migrations 015–021 patterns (granted_by, link_codes, access_requests, access_events); migration-block deconfliction (Decision D-S3-01; MD escalation for the Squad1/Squad4/Platform collision).
- Integration note: files only — sandbox cannot run DDL. Single apply-and-verify session per SCHEDULE.md.

**WP-S3-02 — Sync workers: credential consent + ingest anomaly detection**
- FR: WBS 5.13 (sol-school-ai §9)
- Owner: Senior Backend
- Acceptance: `credential_consents` captured in vault-add flow with ≤8th-grade purpose text; scope-change ⇒ re-consent; revocation ⇒ cryptographic erasure; zero-guard generalized to rule engine (value bounds, delta spike, zero burst, weight sanity, stale sync, schema drift, impossible completion) with real `ingest_quarantine` queue UI; manual CSV import works end-to-end as a first-class fallback (real, not a stub).
- Dependencies: vault encryption (Platform 1.11); counsel ToS/CFAA posture memo per portal — **external gate** (Fractional Compliance + MD). If ToS forbids automation, worker stays OFF and manual path is the product.
- Integration note: 403-on-automation = hard stop with user-facing explanation.

**WP-S3-03 — Provenance rule enforcement + FERPA honesty + G28 disclosure**
- FR: SCHOOL-001, 015, 016
- Owner: Senior Backend + Senior Frontend + UX Designer
- Acceptance: provenance labels (source system, fetched_at, linked student) on every grades/attendance/comms surface; school-issued-account disclosure ("School-monitored account") on consent screen, Sharing firewall, vault-add, and every school-mail render — shown BEFORE credential connect, never "secure/private" language about school accounts; CC'd-teacher-email redaction pipeline server-side (roster-matched, fail-closed: misses ⇒ redact) with originals preserved and `redacted_body_parent` as derived render only.
- Dependencies: WP-S3-01, WP-S3-04 (inbox tables).

**WP-S3-31 — TAKE IT DOWN Act 48-hour removal path for W1 uploads**
- FR: SCHOOL-014
- Owner: Senior Backend
- Acceptance: deletion request flow with 48h SLA timer, user-visible confirmation, append-only audit record, propagation to backups ≤30 days; SLA breach alerts.
- Dependencies: W1 upload storage model; **external:** Fractional Compliance sign-off (WBS 7.9).

### Inbox: counselor segregation, safety tagging

**WP-S3-04 — Teacher inbox: counselor segregation**
- FR: SCHOOL-002
- Owner: Senior Backend
- Acceptance: `counselor_messages` as a SEPARATE table with NO parent-readable body column; RLS; parent with School scope sees counselor threads as metadata-only (participants, last-updated, safety tag); body requires teen-granted `counselor_communications` scope (teen-grantable only, default teen-private); thread visibility follows the single School-module scope (no split-brain); ASCA B.2 standing line on every counselor thread. **CI test: parent JWT cannot SELECT counselor body — asserted, not assumed.**
- Dependencies: WP-S3-01; Platform visibility scopes (WBS 2.5).

**WP-S3-05 — Safety-critical message tagging**
- FR: SCHOOL-002
- Owner: Senior Backend
- Acceptance: deterministic keyword rules + LLM classifier, either firing ⇒ `safety_critical=true`; tagged messages bypass all revocation, route to the safety channel, surface to every linked parent + teen's trusted adult; tagging decisions logged and teen-visible.
- Dependencies: WP-S3-04.
- Integration note: emits to Squad 1's `safety_events` / crisis-router contract (`docs/squad1/api-contracts.md`); build against that spec, flag the seam.

### Check-in redesign (never-ship list: parent cross-check)

**WP-S3-06 — Check-in rebuild: teen-facing calibration only**
- FR: SCHOOL-003
- Owner: Senior Backend + Senior Frontend
- Acceptance: `calibration_scores` + `checkin_estimates` tables with teen-only RLS; calibration algorithm (rolling last-10 error, "getting sharper/steady/still calibrating" framing, no score until ≥5 paired estimates); in-product guarantee ("Only you see this. It never appears in anything your parents see."); parent-visible serializer has explicit table/column blocklist; **CI test: parent-scoped JWT gets 403/empty on every calibration endpoint**; nightly audit job samples parent payloads for blocklisted fields. The old cross-check is on the never-ship list — verify no code path compares teen check-ins against parent-visible data.
- Dependencies: WP-S3-01.

**WP-S3-07 — Check-in retention + purge**
- FR: SCHOOL-003 (G17)
- Owner: Senior Backend
- Acceptance: per-teen `checkin_retention` (rolling_90d default; rolling_365d; manual_delete_only with yearly keep-or-purge nudge); teen-deletable single check-ins effective immediately; nightly purge job with tested SQL; backup propagation ≤30 days; retention schedule published in Settings → Data.
- Dependencies: WP-S3-06. **External:** Fractional Compliance retention-schedule sign-off.

**WP-S3-08 — Lab-safety pulse**
- FR: SCHOOL-019
- Owner: Senior Frontend + Senior Backend
- Acceptance: day-of-lab one-question inside morning check-in ("Did you read the safety card? Anything you're unsure about?"); anonymous free-text box is Reflection-scoped (never parent-visible); "send my question to my teacher" routes only on explicit teen tap; W19 lab-emergency quick-card linked directly under the pulse.
- Dependencies: WP-S3-06, WP-S3-23 (lab-day flags).
- Integration note: W19 quick-card per Squad 1's contract; build against spec, flag the seam.

### Study Sparks + quiz pipeline + alignment + formula bank

**WP-S3-09 — Study Sparks pipeline (renamed peer tips)**
- FR: SCHOOL-004
- Owner: Senior Backend + UX Designer
- Acceptance: generation from curriculum docs + pre-approved technique library ONLY (never student work/grades/behavior); two-stage study-skills fence (deterministic denylist + LLM classifier, fail-closed, blocked candidates logged with reason codes); provenance label schema on every spark (origin, source_refs, deident_method, ai_label, expiry); contested-topic human review queue (72h SLA, subject-teacher reviewers); **5%/week sampling QA with >5% weekly error ⇒ pipeline pause + root cause**; 28-day TTL hard-delete (nightly job); quarterly de-identification audit (no spark with cohort<5 on ai-synthesis origin, no student-authored sources) — if unprovable, per-family consent before ship. No spark renders without a resolvable AI label.
- Dependencies: WP-S3-01.
- NO PLACEHOLDERS note: the QA queue, purge job, and audit are real working surfaces, not docs.

**WP-S3-10 — Source-text flashcards (FULL feature) + fail-closed AI quiz pipeline (FULL, config-gated)**
- FR: SCHOOL-005
- Owner: Senior Backend + education panel (subject teachers)
- Acceptance: **Phase A — flashcards:** verbatim Q/A spans from unit-tagged uploaded materials, real table/UI/RLS/opt-in — a complete feature, NOT a stub for AI quizzes. **Phase B — AI quiz pipeline:** source select → span extraction → item generation → machine verification (math: deterministic re-derivation, |verifier−key|<ε; factual: verbatim-containment in cited span; formula_id must exist in bank) → misconception-taxonomy tag on every distractor (untagged ⇒ rejected) → quarantine states (only `published` renders) → persistent AI label as a COLUMN → per-class teen-owned opt-in (default OFF) → second-model cross-check (disagreement ⇒ human review) → **measured pilot:** 1–2 classes, ≥4 weeks, ≥200 items, ZERO verified-wrong keys shown, ≥80% distractor precision, calibration reported (never a predicted grade); kill switch pauses pipeline on any wrong key. Under-13: technical ban on AI quizzes.
- Dependencies: WP-S3-11 (alignment feeds source selection), WP-S3-12 (formula bank).
- NO PLACEHOLDERS note: the pipeline is fully built code gated by a config flag + pilot sign-off (a safety gate, not a stub). Until the pilot passes, students see Phase A flashcards only.

**WP-S3-11 — Unit auto-alignment**
- FR: SCHOOL-006
- Owner: Senior Backend + Senior Frontend
- Acceptance: confidence model (syllabus overlap .35 / teacher mapping .30 / chapter match .15 / prior corrections .10 / date plausibility .10); ≥0.85 auto-align (logged with evidence), 0.60–0.84 suggest-to-student ("Looks like Unit 3: Energy — confirm?"), <0.60 human queue with no alignment shown; **assessments/graded work/forecast inputs NEVER auto-aligned below 0.85**; student-owned tagging UI; corrections re-weight the model quarterly; provenance (`aligned_by`, confidence, evidence) logged.
- Dependencies: WP-S3-01.

**WP-S3-12 — Verified formula/definition bank**
- FR: SCHOOL-018
- Owner: Senior Backend + education panel (math/science teachers)
- Acceptance: `formula_bank` table (id, subject, latex, plain_statement, source_citation, version, verified_by/at, machine_check); nomination → numeric spot-check → **two subject-expert sign-offs** (real sign-off records; no single-reviewer formula ships — Decision D-S3-07) → versioned immutable API; quiz verifier rejects items citing unknown formula_ids; tutor math answers must cite or be refused; bank versions the single grounding source for quizzes, sparks math, tutor, SAT.
- Dependencies: WP-S3-01. (WP-S3-10 consumes this.)

### Path-to-90 deterministic engine

**WP-S3-13 — Path-to-90 forecast engine**
- FR: SCHOOL-007
- Owner: Senior Backend + Senior Frontend
- Acceptance: pure deterministic function, `forecast.v1.0` versioning (MAJOR=algorithm, MINOR=fix); per-category earned/possible + weights (weights must sum 1.0±0.001 or engine REFUSES); required-avg-on-remaining math, what-if table (70/80/90/100), top-3 levers ranked by marginal-impact×feasibility, reachability enum; every input cited (source + timestamp); `inputs_hash` invalidation + stale/superseded states; `path_to_90_actions` teen-owned CRUD with parent SELECT-only RLS (**CI enforcement test: parent JWT cannot INSERT/UPDATE/DELETE**); client-side what-if simulator never writes; unit-test gate in CI (golden fixtures exact to 0.01 + property tests: monotonicity, weight-sum invariant, idempotence); version bump requires math-expert fixture review.
- Dependencies: WP-S3-01, WP-S3-02 (grade data).

### SAT + daily pulls

**WP-S3-14 — SAT prep**
- FR: SCHOOL-008
- Owner: Senior Frontend + Senior Backend
- Acceptance: Digital-SAT blueprint (44 questions, adaptive 2-module routing with disclosed logic); embedded Desmos in every Math module + Desmos fluency track (graph/solve-via-intersection/table/sliders) gating timed practice; formulas sourced from WP-S3-12 bank; practice reports show raw accuracy by skill area + calibration — **no fake score predictions, ever**.
- Dependencies: WP-S3-12.

**WP-S3-15 — Daily pulls: news allowlist, horoscope quarantine, power-up cut**
- FR: SCHOOL-017
- Owner: Senior Backend + Senior Frontend
- Acceptance: `news_sources` allowlist (Tier-1 wire may render summaries; Tier-2 with source label; annual re-review + changelog); contested topics render only from Tier-1 wire or are skipped; horoscope = opt-in Entertainment section, default OFF, never in morning ritual or adjacent to grades, "Entertainment only — not guidance" label, **90-day engagement revisit ⇒ cut if ~zero** (Decision D-S3-03); power-up = CUT from scope (no placeholder).
- Dependencies: WP-S3-01.

### W5 College & Future

**WP-S3-16 — 50-college simulator**
- FR: SCHOOL-009
- Owner: Senior Backend + Senior Frontend
- Acceptance: 50 colleges (GA in-state + regional Southeast + national pre-med) seeded with **REAL public data** (IPEDS + published Common Data Set ranges, years covered — no mock rows); admissions bands (ranges, never point estimates); in-product model card (model/version, training data, features, limitations, calibration note, last-updated); long-pathway examples (e.g. anesthesiologist); version-stamped with documented refresh process.
- Dependencies: WP-S3-01, WP-S3-02 (grade data).
- NO PLACEHOLDERS note: real seeded dataset, not sample rows.

**WP-S3-17 — GSFC-exact HOPE / Zell Miller**
- FR: SCHOOL-009
- Owner: Senior Backend
- Acceptance: `scholarship_methodologies` versioned rows (gsfc-2026.1; HOPE 3.0 core + rigor; Zell 3.7 + 1200 SAT/26 ACT); rigor rules encoded exactly per GSFC; core-GPA calculator shows its work (course-by-course inclusion flags); every surface shows methodology version + verification date + standing line **"Verify at GAfutures.org"**; August re-verification job bumps version and re-stamps old calculations.
- Dependencies: WP-S3-01. (External data: GAfutures.org — public methodology, PM owns re-verify cadence.)

**WP-S3-18 — 504/IEP accommodation tracking**
- FR: SCHOOL-012
- Owner: Senior Backend + Senior Frontend
- Acceptance: `accommodation_plans` + `plan_accommodations` + `accommodation_delivery_log`; signed plan document in vault; per-accommodation delivery log; "delivery gaps" phrased neutrally for counselor conversation; 60/30/7-day review-date reminders to parent + teen; teen sees own plan in full (self-advocacy).
- Dependencies: WP-S3-01.

**WP-S3-19 — GA 23-credit graduation audit**
- FR: SCHOOL-013
- Owner: Senior Backend + Senior Frontend
- Acceptance: `graduation_requirements` versioned (ga-2026.1: ELA 4, Math 4, Science 4, Social Studies 3, Health/PE 1, CTAE/FineArts/WorldLang 3, Electives 4); deterministic bucket mapping; fuzzy matches ⇒ student confirm queue; earned/in-progress/remaining per bucket with on-pace/behind-pace flags; projected completion term; one-page counselor export; requirement changes re-run the audit with a diff.
- Dependencies: WP-S3-01.

**WP-S3-20 — Essay feedback-only + counselor handoff prompts**
- FR: SCHOOL-009
- Owner: Senior Backend + Senior Frontend
- Acceptance: feedback mode returns comments + highlighted spans anchored to student text (structure, clarity, grammar, evidence gaps, Socratic questions) — **never replacement prose**; "rewrite this for me" ⇒ refusal with integrity explanation + feedback-mode offer; counselor handoff prompts (student-authored questions) with one-tap copy + asked-when log.
- Dependencies: WP-S3-01. (Boundary aligned with FR-AI-004.)

### W4 Activities, W18 Summer, W16 Calendar

**WP-S3-21 — W4 Activities**
- FR: SCHOOL-010
- Owner: Senior Frontend + Senior Backend
- Acceptance: practice/game web; location features use **teen-consented COARSE location only** (D7 — city/ZIP max; no precise GPS anywhere in this surface); GHSA eligibility monitoring.
- Dependencies: WP-S3-23 (calendar).

**WP-S3-22 — W18 Summer**
- FR: SCHOOL-011
- Owner: Senior Frontend + Senior Backend
- Acceptance: camp tracking + vetting fields; crisis routing active year-round (not school-year only); rising-9th transition content.
- Dependencies: WP-S3-23.
- Integration note: crisis routing per Squad 1's contract (same seam as WP-S3-05).

**WP-S3-23 — W16 School Calendar**
- FR: SCHOOL-001 (school data)
- Owner: Senior Backend + Senior Frontend
- Acceptance: real calendar data model; CCSD calendar seeded; lab-day flags feed WP-S3-08 lab pulse; exam windows; feeds W4/W18.
- Dependencies: WP-S3-01.

### Second-parent onboarding (D5 REVISED: OPEN SIGNUP — claim path in v1)

**WP-S3-24 — Second-parent v1: invite-from-inside (fast path)**
- FR: AUTH-011
- Owner: Senior Backend + Senior Frontend + UX Designer
- Acceptance: Parent A generates 7-day single-use deep link/QR from Settings → Family (builds on Platform 016 `invite_preview` + 019 `link_codes`); redeem screen with per-domain unbundled consent (≤8th-grade reading); approval routing (<13 → Parent A sees verified attributes, not "identity confirmed"; 13+ → teen approves with anti-coercion check + 30-day lockout, fact-only notification to Parent A, no veto); cancel-invite invalidates token immediately; zero enumeration surface (no "find my child" lookup anywhere).
- Dependencies: WP-S3-01; Platform 015/016/019/020/021 (child_account_management, invite_preview, link_codes, access_requests, access_events) + grant/revoke RPCs.
- Integration note: if Platform invite infra isn't built yet, implement the claim path first and add invite redemption against the spec'd `link_codes` interface — invite is the fast path, claim is the required path.

**WP-S3-25 — Second-parent v1: corroborated claim path / OPEN SIGNUP [v2 → v1 per D5 REVISED]**
- FR: AUTH-011
- Owner: Senior Backend + Senior Frontend + UX Designer
- Acceptance: sign-up → "Connect to my family" → claim form (full legal name, child name/DOB, **creating-parent's signup email**, perjury-style attestation, custody attestation "any court orders limiting your contact/access?"); verified sign-in required before any claim; **uniform response regardless of match** ("if this child is in Pookie, we've notified the parent on record"); rate limits + CAPTCHA + probing-pattern logging + constant-time-ish responses — **no enumeration oracle** (CI probe test: match/no-match responses indistinguishable); **no auto-grant, ever**; routing: <13 → Parent A approves (sees verified attributes, NOT "identity confirmed"); 13+ → teen approves (verification badges, anti-coercion check, 30-day lockout) + fact-only notification to Parent A (no veto); Parent A unresponsive 14 days (reminders day 3/7/12) → human-review escalation queue with documentary proof — **EXTERNAL: Managing Director staffing** (launch of the escalation leg gated on this); rejection = one-time dismissible card (no reason, no appeal, 30-day lockout, support link); Parent B gets working "just me" Pookie immediately (no dead end); `court_order_restriction` flag: set ⇒ self-serve fully disabled ⇒ human review only; **custody posture STAY OUT — no adjudication logic**; all claim events → `access_events`.
- Dependencies: WP-S3-01; Platform 015/017/020/021 (profiles, child_account_management, access_requests, access_events).
- **External gates:** Fractional Compliance counsel sign-off on attestation language + custody-order workflow + denied-claim retention rule; DV-advocate copy review; **MD staffing of human review** (blocks the 14-day escalation leg; invite path + claim-to-approval path unaffected).
- Reversal note: this package was moved v1 → v2 under the earlier D5, then **restored v2 → v1** under D5 REVISED (OPEN SIGNUP). Team: build this now.

**WP-S3-26 — Second-parent v1: three-card first-run + "just me" immediacy**
- FR: AUTH-011
- Owner: Senior Frontend + UX Designer
- Acceptance: first-run cards "Just me" (default) / "Add my child" / "Connect to my family"; "Connect to my family" offers BOTH invite-redeem fast path (WP-S3-24) and corroborated claim path (WP-S3-25) — per D5 REVISED neither is the only path; waiting state = fully working app with one Family card ("Waiting… requested {date}" + cancel); no "no-invite" dead end.
- Dependencies: WP-S3-24, WP-S3-25.
- Note: `docs/squad3/UX-SPECS.md` §3 was written for the superseded invite-only D5 — UX designer to re-scope this section to open signup (flagged, not re-specced here).

### AI governance gates

**WP-S3-27 — Muse → "Direct Mode": 18+ gate**
- FR: AI-002
- Owner: Senior Backend + Senior Frontend
- Acceptance: server-side age check (verified DOB + legal_status) at request time; mode **does not exist in the UI** for under-18 (not shown, not footnoted); API returns 403 for under-18 mode requests regardless of client state; identical safety layer across modes — **CI adversarial test matrix asserts identical safety behavior** (self-harm, disallowed content, homework dumps); "unfiltered" retired from all copy, code comments, and docs.
- Dependencies: Platform DOB gate (1.10) + legal_status (1.9).

**WP-S3-28 — Proactive nudges: scope-filtering**
- FR: AI-003
- Owner: Senior Backend
- Acceptance: teen opt-in per category (default OFF; parents cannot opt a teen in); ≤2/day, ≤5/week server-side caps; delivery window 8 AM–8 PM teen timezone (never school hours/overnight; queued nudges wait); nudge content drawn ONLY from scopes the recipient holds — **never Reflection/Wellness-derived nudges to parents**; no health-content push (lock-screen leakage); push bodies generic ("Pookie has a nudge for you" — detail behind auth); per-teen master kill switch (one tap, immediate); `nudges_sent` audit log + weekly scope-source audit.
- Dependencies: WP-S3-01; Platform visibility scopes (WBS 2.5).

**WP-S3-29 — Teacher discussion threads: parent-authored + AI proofreading only**
- FR: AI-004 (NFR-SEC-008)
- Owner: Senior Backend + Senior Frontend
- Acceptance: blank-draft composition (no AI-generated draft, no template-filled send); "Check my draft" returns **tracked-change suggestions only** (spelling/grammar/clarity/tone notes) — AI may NOT add claims, change the ask, insert deadlines, or draft paragraphs; per-suggestion accept/reject; sent email byte-identical to parent-approved with approval record stored; "3 questions to ask" prompts allowed (prompts, not prose); mandatory-reporter tripwire: draft disclosing suspected abuse/neglect/misconduct/self-harm plan ⇒ **send BLOCKED**, plain-language explanation, routes to safety flow (988, GA Crisis & Access Line, DFCS 1-855-422-4453), draft NOT auto-forwarded, event emitted; **no send path until these authorship rules ship**.
- Dependencies: WP-S3-04 (inbox).
- Integration note: tripwire emits to Squad 1's `safety_events` contract.

**WP-S3-30 — AI chat governance: crisis routing + disclosure policy**
- FR: AI-001, AI-005
- Owner: Senior Backend + Senior Frontend + UX Designer
- Acceptance: layered system prompt (identity: "Pookie, an AI study companion — not a therapist"; safety layer mode-independent; domain layers cannot weaken it); math answers pass the deterministic verifier **before display** (fail ⇒ "I can't verify this — ask your teacher"); science answers grounded in class materials/formula bank with persistent AI label; home-experiment refusal rules (no heat/flame/chemicals/sharps/electricity/ingestion instructions); chat **emits events, never decides responses** — `safety_events` (crisis_language/abuse_disclosure/self_harm_plan/eating_disorder_signal × watch/urgent/imminent); 988 + Crisis Text Line surfaced in-conversation on every crisis hit; **no auto-parent-notification absent imminent risk** (watch/urgent ⇒ trusted-adult path per Squad 1 router; never to a revoked parent); G10 disclosure copy at first under-18 chat + on abuse-disclosure detection (≤8th-grade, counselor/welfare reviewed); banned phrases ("just between us", "I promise I won't tell", absolute confidentiality) enforced by classifier + prompt; no-training-on-inputs vendor term on file + in-product disclosure "Your chats aren't used to train AI."
- Dependencies: WP-S3-12 (formula bank for math/science grounding).
- Integration note: emits to Squad 1 crisis-router; the router owns responses. System-level minor-safety policy enforced in the serving layer (policy, not prompt).
- **External gates:** DV-advocate + counselor review of disclosure copy (launch gate).

---

## B. Sprint plan (3 sprints)

Squad 3 starts after Platform Team 1's access-model core lands (per TEAM-CHARTERS staffing order). Sprints are scope-boxed, not date-boxed — dates belong to `docs/pm/SCHEDULE.md`.

### Sprint 1 — Foundation & Trust
**Goal:** the data layer and the three parent-trust surfaces (inbox, check-in) are real, RLS-proven, and panel-compliant.
**Scope:** WP-S3-01, 02, 03, 04, 05, 06, 07, 08, 31.
**Exit criteria:**
- All Sprint-1 migrations written, syntax-checked, apply-order documented (030–039, no collisions).
- CI tests prove: parent JWT cannot SELECT counselor bodies; parent JWT gets 403/empty on calibration endpoints; old check-in cross-check code verified absent from tree.
- Nightly purge job SQL tested; 48h take-it-down SLA flow works end-to-end on real uploads.
- Safety-critical tagging emits to the Squad 1 `safety_events` contract (spec-built if router isn't live; seam flagged in code + §A).
- No console.logs, no dead code in touched files.

### Sprint 2 — Intelligence
**Goal:** the study engine is deterministic, labeled, and gated — sparks flow, quizzes are honest, forecasts are cited.
**Scope:** WP-S3-09, 10, 11, 12, 13, 14, 15.
**Exit criteria:**
- Forecast engine golden fixtures (exact to 0.01) + property tests pass in CI; version-bump process documented.
- Study-skills fence unit tests pass; QA sampling queue + 28-day purge + de-identification audit query all live.
- Flashcards (Phase A) live end-to-end on real unit-tagged uploads.
- AI quiz pipeline code complete but config-gated: pilot bars (0 wrong keys, ≥80% distractor precision, ≥200 items) defined as the launch gate — gate documented, not a stub.
- Formula bank API versioned with ≥1 two-expert-signed formula; SAT practice runs the full 44-question adaptive blueprint with Desmos.

### Sprint 3 — Future, Family & Gates
**Goal:** college/future is real-data, second-parent onboarding is open-signup end-to-end, AI gates hold.
**Scope:** WP-S3-16 → 30 (college, 504/IEP, 23-credit audit, essay rules, W4/W18/W16, second-parent v1 ×3, AI gates ×4).
**Exit criteria:**
- 50-college dataset seeded from real IPEDS/CDS ranges with version stamp + model card rendered.
- GSFC rows versioned with "Verify at GAfutures.org" on every surface.
- Second-parent E2E passes: invite redeem; claim → Parent A approval; claim → teen approval (13+); rejection ⇒ 30-day lockout enforced server-side; enumeration-oracle probe test passes (match/no-match indistinguishable); 14-day escalation queue built (launch of that leg gated on MD staffing — flagged, not silent).
- Muse 18+ gate: CI adversarial matrix passes; mode invisible to under-18 test accounts; "unfiltered" absent from tree.
- Nudge scope audit clean; crisis-emission contract tested against Squad 1 router.
- **P5 phase exit criteria checkable:** provenance enforced, counselor mail segregated, check-ins teen-only, quiz pipeline verified or flashcards-only.

---

## C. Risk watch — top 5

| # | Risk | Register ID | Prob/Impact | Mitigation (squad) |
|---|---|---|---|---|
| 1 | AI practice quizzes with unverified answers = misinformation at scale | **RISK-016** | 🟠/🟠 | WP-S3-10: fail-closed machine-verified pipeline or flashcards-only; pilot bars (0 wrong keys); kill switch. Nothing unverified reaches a student — this is a launch gate, not a tunable. |
| 2 | Peer-tips (Study Sparks) cross-family identifiable sourcing (FERPA consent failure) | **RISK-008** | 🟠/🟠 | WP-S3-09: curriculum-only sourcing + aggregate-k5 + quarterly provability audit; fallback = per-family consent before ship if unprovable. |
| 3 | Counselor-mail merge violates ASCA B.2 confidentiality | **RISK-017** | 🟠/🟠 | WP-S3-04: separate table (no parent body column), RLS, CI deny-test; teen-owned `counselor_communications` scope. |
| 4 | Check-in cross-check as parent lie detector destroys the honesty the crisis protocol depends on | **RISK-011** | 🟠/🟠 | WP-S3-06: calibration-only, parent-blocked at query layer, blocklisted-field audit; old cross-check on never-ship list (spec §never-ship). |
| 5 | External DB dependency stalls all migration work (no service_role in sandbox) | **RISK-006** | 🟠/🟠 | WP-S3-01: everything DB-independent first (migrations written + syntax-checked, UI against contracts); single apply-and-verify session per SCHEDULE.md. |

**Squad-raised risks (not yet in register — escalated to MD):**
- **RISK-S3-01 — Migration-number collision:** Squad 1 claims 022–029, Squad 4 claims 024+, Platform owns 018–023. Silent apply-order conflicts will break staging. Decision D-S3-01 takes 030–039 for Squad 3; the underlying collision needs an MD ruling.
- **RISK-S3-02 — Claim-path enumeration/custody weaponization (new v1 surface under D5 REVISED):** open signup widens the attack surface. Mitigations are in WP-S3-25 (uniform responses, rate limits, CAPTCHA, no auto-grant, `court_order_restriction` + STAY OUT posture, human-review leg). Residual risk accepted only with the external gates listed.
- **RISK-S3-03 — Counsel sync-worker memo timeline:** portal automation for each portal is gated on the Fractional Compliance ToS/CFAA memo (external, unbounded). Mitigation: manual CSV import is a first-class product path (WP-S3-02), so the squad is never blocked on the memo.
- **RISK-S3-04 — Formula-bank expert bandwidth:** two-expert sign-off per formula (Decision D-S3-07) depends on education-panel teacher availability. Mitigation: seed the highest-leverage formulas first (SAT + current units); bank grows incrementally.
- **RISK-S3-05 — Human-review staffing for claim escalation:** the 14-day escalation leg of WP-S3-25 cannot launch until the MD staffs reviewers. Flagged as MD-owned external dependency; invite path + claim-to-approval path ship regardless.

---

## D. Decision log

| ID | Decision | Rationale |
|---|---|---|
| D-S3-00 | **NO PLACEHOLDERS adopted for all Squad 3 WPs** (Mehedi directive 2026-10-12). Every WP ships complete per its acceptance criteria; the "seedling" approach is superseded for this squad. Cross-team gaps are built against BUILD-SPECIFICATION.md contracts with seams flagged in code + §A, verified end-to-end against real data. Code cleanliness enforced (no dead code, no console.logs). | Mehedi: "Every module ships as a FULL working implementation." |
| D-S3-01 | Squad 3 takes migration block **030–039**; escalate the Squad1(022–029)/Squad4(024+)/Platform(018–023) numbering collision to the Managing Director. | Avoid silent apply-order conflicts on staging. |
| D-S3-02 | **Apply D5 REVISED (OPEN SIGNUP):** WP-S3-25 corroborated claim path restored **v2 → v1**; invite-from-inside stays as optional fast path (WP-S3-24); "Connect to my family" card fully functional at launch. Reversal noted on the affected packages so the team doesn't get whiplash. **Follow-up flagged:** `docs/squad3/UX-SPECS.md` §3 was written for the superseded invite-only D5 — UX designer to re-scope to open signup. | MD-DECISIONS.md D5 (Mehedi override): invite-only recreates the "no-invite dead end" the user-first direction eliminated. Human-review staffing stays MD-owned external. |
| D-S3-03 | **Power-up: CUT** from W1 scope (no placeholder). **Horoscope: QUARANTINE** as opt-in entertainment (default OFF, never in morning ritual, "Entertainment only" label; 90-day engagement revisit ⇒ cut if ~zero). | sol-school-ai §18.3 (panel): undefined "power-up" adjacent to teen health = health-claim liability; quarantine answers the science panel's framing objection. |
| D-S3-04 | Flashcards-only is a **complete feature** (Phase A), not a stub; the AI quiz pipeline is fully built but **config-gated** until pilot bars pass. | FR-SCHOOL-005 + RISK-016: safety gate, not a placeholder. No verified-wrong key ever reaches a student. |
| D-S3-05 | D7 coarse-only location binds WP-S3-21 (W4 Activities): city/ZIP max, teen-consented; **no precise GPS anywhere in Squad 3 surfaces.** | MD decision D7 is an architectural constraint, not a policy. |
| D-S3-06 | Sync-worker portal automation is **gated on the counsel ToS/CFAA memo per portal** (external); manual CSV import is a first-class product path so the squad never blocks on counsel timelines. | sol-school-ai §9.1: never silently degrade; 403-on-automation = hard stop. |
| D-S3-07 | Formula bank: **two education-panel expert sign-offs** required; no single-reviewer formula ships. | sol-school-ai §8.2 verification process. |
| D-S3-08 | Check-in retention default **rolling_90d** (manual_delete_only carries a yearly keep-or-purge nudge). Claim-path 14-day escalation leg is **launch-gated on MD staffing** of human review. | sol-school-ai §6.1; D5 REVISED external dependency. |

---

## E. Open questions for the Managing Director

1. **RISK-S3-01:** rule on migration-number ranges across squads (Squad 1: 022–029 vs Squad 4: 024+ vs Platform: 018–023).
2. **sol-school-ai open Q1:** confirm 90-day default check-in retention vs a shorter 30-day default for under-16.
3. **sol-school-ai open Q3:** formula-bank verifier — build in-house or buy (affects WP-S3-10/12 resourcing).
4. **WP-S3-25 staffing:** timeline for human-review staffing (claim escalation leg) — needed before that leg launches.
5. **Counsel sequencing:** ToS/CFAA memo timing for the first portal (StudentVUE/ParentVUE) — WP-S3-02 builds the manual path regardless.

---

*PM notes: priority is owned here; execution is owned by the squad. Blockers → Managing Director via BUILD-LOG handoff. Acceptance rule (WBS dictionary): a work package is done only when its checklist/spec mark flips to ✅, re-verified by the owning expert domain or QA — not when code is written.*

---

## F. Tech-lead consolidation (2026-10-12) — implementation record

Two backend implementations grew in parallel (`school-track.ts`/`family-links.ts`
by the squad backend agent; migrations 026–033 + services by the tech lead).
Consolidated to **one truth per surface** (details in §F.1). Deviations from the
WP acceptance text above are flagged with rationale — functionality is
preserved; only the storage shape changed.

### F.1 Unification decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Counselor segregation via `teacher_messages.sender_type` flag + `body_withheld` (NOT a separate `counselor_messages` table) | The flag contract is wired end-to-end (routes + `teacher-thread.tsx` renders counselor sections from `sender_type`). **Deviation from WP-S3-04's "separate table" text:** the ASCA B.2 visibility contract (parents = metadata-only, body withheld on every parent-visible read path) is preserved; one inbox truth avoids a schema fork. The withhold is enforced in `listMessagesV2`/`listTeacherMessagesLegacy` — the only parent-visible readers. |
| 2 | Path-to-90 checkboxes live in `study_plans.plan[]` (NOT a separate `path_to_90_actions` table) | Wired frontend (`path-to-90.tsx` toggles via `PATCH plans/[planId] {items}`). **Parent read-only enforced at two layers:** service (`togglePlanItems` requires teen role) + DB trigger `study_plans_guard_teen_checkboxes` (045) rejecting parent-role UPDATEs of `plan`. |
| 3 | Second-parent claims/invites via `parent_claims`/`parent_invites` + SECURITY DEFINER RPCs (049); `family-links.ts` delegates to them | The draft `family_claims` matching ran under caller-JWT RLS (cannot work: children RLS restricts to own tenants, or would be an enumeration oracle if permissive). RPC design: silent server-side match, uniform responses, in-DB rate limits (5/hr, 20/day), 30-day lockouts, 14-day escalation, atomic single-use redeem, hashed invite codes. `family_claims`/`family_invites` tables NOT created (047 §4 documents the supersession). |
| 4 | Lab-safety pulse on `checkins.lab_read_safety_card` + `lab_anonymous_question` (047) — no separate table | Wired check-in contract; free-text box blocklisted from parent payloads (`PARENT_BLOCKED_FIELDS`). |
| 5 | `checkin_estimates` = 042 rich schema + `label` column (047 patch) | Calibration engine needs `child_id/kind/description/estimate_date/error_pct`; wired contract needs `label`. Both present. |
| 6 | `study_sparks.body` (not `spark_text`) + generated `ai_label` (043) | Wired `StudySpark` type; label as data. |
| 7 | `requireChildRole` single definition in `services/school.ts` (throws `CHILD_ROLE_REQUIRED`); `school-track.ts` re-exports | The duplicate threw the wrong code (`PARENT_ROLE_REQUIRED`). |
| 8 | `POST …/school/checkins` now requires the teen role | Route comment already promised "parents never POST here"; code now enforces it (FR-SCHOOL-003 teen ownership). |

### F.2 Migration map (final, as renumbered by the migration coordinator)

041 provenance (`teacher_messages.sender_type/source/safety_critical/fetched_at`, `authored_by`, provenance columns, `is_child_authority()`/`provenance_label()`)
042 check-in calibration (`checkin_estimates`, `calibration_scores`, `teen_privacy_settings`, `recompute_calibration()`, `purge_expired_checkins()`)
043 study sparks (`study_sparks` + qa/review queue + `purge_expired_sparks()`)
044 quiz pipeline (`flashcards`, `quiz_items` fail-closed + opt-in trigger, `formula_bank`)
045 forecast store (`forecasts`) + `study_plans_guard_teen_checkboxes` trigger
047 frontend-contract patch (`checkin_estimates.label`, `checkins.lab_*`; supersession notes for family_* tables)
049 second-parent claim (full RPC suite; requires Platform 018 `granted_by`/`status` first)
032 college/504/graduation (+ GSFC `gsfc-2026.1` + GA 23-credit `ga-2026.1` seeds)
033 AI governance (`safety_events` emitter → Squad 1 router; `user_verifications`; `direct_mode_eligible()`)

### F.3 New API contracts (additive unless noted)

`POST/GET …/school/forecast/compute|latest`, `…/calibration/estimates` (teen),
`…/checkin-settings` (teen), `…/counselor-messages`, `…/quiz-items`,
`…/flashcards`, `GET /api/v1/formulas`, `PATCH …/ai-practice-opt-in` (teen, under-13 refused),
`…/graduation-audit`, `…/accommodations`, `GET /api/v1/ai/direct-mode/eligibility`,
`POST /api/v1/ai/crisis-signal`.
Changed: `GET …/teacher-messages` (parent CC-redaction + `body_redacted`, counselor `body_withheld` — additive fields);
`POST …/teacher-messages` (stamps `authored_by`); `POST …/checkins` (teen-only).

### F.4 Verification

- `node --test` school-track suites: 24/24 pass (forecast golden fixtures + property tests; redaction; safety tagger; blocklist; spark fence; graduation audit; crisis detection)
- `npx tsc --noEmit`: 0 errors required before commit
- Migrations 032/033/041–050: pglast parse 17/17
- Blockers: Platform 018 must land before 049 applies (asserted at apply time by the migration itself).
