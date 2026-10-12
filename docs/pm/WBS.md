# Pookie Work Breakdown Structure (WBS)

**Version 1.0 — 2026-10-12 · Work-package level · PMBOK §5**

Numbering: `X.Y` = work package. All panel recommendations accepted (Mehedi 2026-10-12) — every 🛑/⚠️ item below maps to a checklist reference.

---

## 1.0 Foundation — data, auth, profiles

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 1.1 | Verify `schema_migrations`; apply 014 (`safe_auth_uid` fix) if 006–008 unapplied | BUILD-LOG M1 | **External dependency:** Mehedi's dashboard access. Never re-run applied files |
| 1.2 | Apply migrations 015 (`child_account_management`) + 016 (`invite_preview`) | Spec §8 | In tree, unapplied |
| 1.3 | Write + apply 017 (`profiles`: user_id PK, display_name, onboarding_completed, RLS self-only) | Spec §8 | |
| 1.4 | Write + apply 018 (`child_access.granted_by` + `status`; backfill `granted_by='parent'`; revoke RPCs enforce matrix) | Spec §3, §8; 1.3.1 | |
| 1.5 | Write + apply 019 (`link_codes`: code_hash, 15-min TTL, single use, brute-force lockout) | Spec §5; 1.2.2 | |
| 1.6 | Write + apply 020 (`access_requests`: pending/approved/denied/blocked, 30-day re-request lockout) | Spec §8; 1.3.4 | |
| 1.7 | Write + apply 021 (`access_events` append-only audit: grant/revoke/request/block/safe-exit, timestamps, reason codes, device/IP hash) | 1.3.6, G1 | Teen-visible; never shown to revoked parent |
| 1.8 | Under-13 technical guarantee: server-side ban on under-13 login/session/link-code/invite/typable fields/persistent identifiers | 1.1.4 | Not policy — code |
| 1.9 | `legal_status` field (emancipated minors → adult track, O.C.G.A. §§ 15-11-720–727) | 1.1.4, G11 | |
| 1.10 | DOB gate for direct teen self-signup | G12 | Teen protections can't attach without age |
| 1.11 | Credentials vault encryption before any real credentials stored (GIPA) | Cat 7 | Rotation + cryptographic erasure |

## 2.0 Access Model — linking, authority, age tiers, safety

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 2.1 | Email invite flow (hardened): 7-day token, matching-login verify, per-domain unbundled consent screen (≤8th-grade reading), 90-day no-re-prompt after decline | 1.2.1 | Health subcategories enumerated; check-in text + mood named explicitly |
| 2.2 | Link-code flow: generate/redeem, anti-coercion private confirmation, same-device flag in audit | 1.2.2 | "Did you choose this or were you told to?" |
| 2.3 | Claim dedupe: fires only after email verification; manual-review threshold; never auto-merge health records | 1.2.3 | Enumeration-risk safe |
| 2.4 | Grant/revoke RPCs: `granted_by` enforcement, teen-may-revoke-any-grant, parents-revoke-own-only, court-order row (human review, not self-serve), custody-order carve-out | 1.3.2 | |
| 2.5 | **Visibility scopes**: per-person × per-scope (Performance / Communications / Reflection / Wellness + travel/location toggle). Defaults: Performance+Communications visible, Reflection+Wellness teen-private. All briefings/digests/nudges/API filtered server-side | 1.3.3 | Replaces all-or-nothing |
| 2.6 | **Data-provenance rule**: school-of-record data inherits school audience (FERPA honesty); app-generated data is child-authority; safety-critical school comms **never revocable** (separate API channel, non-toggleable Sharing row) | 1.2b | GA Parents' Bill of Rights § 20-2-786 |
| 2.7 | **Cooling-off redesign (13–15)**: teen chooses notify-now vs notify-at-effect (default at-effect, revoked parent only); **safe-exit path** ("telling my parents could put me at risk" → immediate cutoff + suppressed notification + crisis resources); no parent-visible "revoking" banner; no new parent-visible syncs during window | 1.4.1 · RISK-002 | DV-advocate review of all copy before launch |
| 2.8 | **Trusted-adult designation**: required step before any revoke/go-independent executes; crisis alerts route here | 1.5.3, G1 · RISK-001 | Resolves tripwire contradiction |
| 2.9 | Go-independent flow: split celebration (gaining) from neutral rupture (removing); safe exits visually boring; data-source handoff for 13–17 (revoked parent's credentials stop syncing) | 1.5.1, 1.5.2 | |
| 2.10 | 18+ transition: continuity for grades (pause-and-ask on parent-credential pulls; postsecondary-enrollment prong); **health = affirmative opt-in, skip = private**; review-correct-seal of parent-entered data; transition-summary export; emergency-contact re-designation; quiet-exit option | 1.6 · RISK-003 | |
| 2.11 | Block list: 30-day household re-invite ban; block ≠ revoke of safety comms; court-order override path | 1.3.5 | |
| 2.12 | Sharing screen: per-person × per-scope toggles, what's-visible list, firewall line, trusted-adult line, approve/deny/block | 1.3.3–1.3.5 | |

## 3.0 Onboarding & Menu — first-run UX and navigation

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 3.1 | `/onboarding`: 3-step skippable flow (name → optional add-children → dashboard); guardian attestation checkbox; school-transparency disclosure at add-children | Spec §2; 1.1.2 | |
| 3.2 | **Popup menu**: bottom-sheet, 6 collapsed categories (Health · Home · School · Safety · Travel · Marketplace), 28 modules; search field; recent row | Mehedi 2026-10-12 | Replaces More-tab page |
| 3.3 | "Just me" personal dashboard (no children): mail, tasks, health, shopping — never parenting upsells | Spec §7; 1.1.3 | |
| 3.4 | Child switcher + per-child data purge on switch | Cat 1 | Teen privacy |
| 3.5 | Age-gating in menu: expert-driven visibility (e.g., Credit hidden <18; Rental Cars hidden for teen accounts) | Panel menu note | Per panel: hide, don't footnote |

## 4.0 Health — tiers, privacy, gated modules

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 4.1 | **H0–H3 taxonomy build** (H0 prohibited <18 / H1 shareable wellness / H2 teen-private / H3 legally sensitive) | G3 · RISK-005 | **Gate:** W2 holds no real teen data until done |
| 4.2 | W2 Health: consumer-device data descriptive-only, provenance-labeled, never diagnostic (FDA wellness boundary) | Cat 4 | |
| 4.3 | W8 Wellbeing: crisis-escalation ladder (bad day → pattern → crisis → ED signals); 988 integration; never parent-visible incl. aggregates; no indefinite retention | Cat 4; G2 | Launch-blocking |
| 4.4 | W23 Nutrition: **no calorie/weight-loss features <18**; weight-neutral framing; NEDA resources; clinician gate | Cat 4 | Blocked as designed until fixed |
| 4.5 | W22 Activity: no streaks <18, no calorie-burn display, rest-day normalization, no teen leaderboards | Cat 4 | |
| 4.6 | W13 Meals: no calorie budgeting/moralizing language <18 | Cat 4 | |
| 4.7 | GA Form 3231 immunization management; college reqs; HPV catch-up | G22 | |
| 4.8 | 18+ health re-consent flow + transition-summary export (see 2.10) | 1.6.2 | |

## 5.0 School — provenance, inbox, check-ins, verification

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 5.1 | Data-provenance rule implementation (see 2.6) across all school surfaces | 1.2b | |
| 5.2 | Teacher inbox: **segregate counselor mail** (ASCA B.2 — counselor confidentiality is not a parent CC); provenance labels; safety-critical tagging; redact non-linked students from CC'd emails (FERPA-in-practice) | Cat 5 | Blocked as merged |
| 5.3 | **Check-in redesign**: teen-facing **calibration** only ("your estimates are getting sharper"); never parent-visible; never accusatory; teen-deletable; rolling auto-purge | Cat 3; 1.2b.2 | Blocked as lie detector |
| 5.4 | Path-to-90: deterministic versioned forecast engine (unit-tested, input-cited); parent viewers read-only on teen checkboxes | Cat 5; G18 | |
| 5.5 | AI practice quizzes: fail-closed verification pipeline (machine-verified keys, misconception-aware distractors, persistent AI labels, per-class opt-in, measured pilot) — until then, source-text flashcards only | Cat 5 | Blocked as designed |
| 5.6 | Peer tips: rename ("Study Sparks"), provenance labels, contested-topic human review, 5%/wk QA sampling, study-skills-only fencing | Cat 5 | Blocked as designed |
| 5.7 | Unit auto-alignment: confidence-scored; below-threshold → human queue; never auto-align high-stakes content | Cat 5 | |
| 5.8 | SAT prep: Digital-SAT blueprint + Desmos fluency; verified formula bank; no fake score predictions | Cat 5 | |
| 5.9 | Curated formula/definition bank (single grounding source for quizzes, tips, tutor, SAT) | G19 | |
| 5.10 | W5 College: GSFC methodology exactly (date-stamped, "verify at GAfutures.org"); chance-me = ranges + model card; essay feedback-only (no ghostwriting); counselor handoff prompts | Cat 4 | |
| 5.11 | 504/IEP accommodation tracking (plan storage, delivery tracking, review dates) | G20 | #1 parent-counselor friction point |
| 5.12 | GA 4-year graduation audit (23 credits) | G21 | |
| 5.13 | Sync workers: portal ToS/CFAA posture review; credential consent at vault-add; generalize zero-guard to ingest anomaly detection | Cat 5 | |

## 6.0 AI & Safety — guardrails, crisis routing, trusted adult

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 6.1 | **Crisis protocol**: 988/Crisis Text Line surfacing; teen-controlled "tell a trusted adult"; documented self-harm protocol for AI (SB 1119 shape); "private spaces are not safety-monitored" copy | G2 · RISK-001 | Launch-blocking for Wellbeing + AI chat |
| 6.2 | **Muse 18+ gate**: rename ("direct mode"); identical safety rules across modes; system-level minor-safety policy | Cat 2 | Blocked for under-18 as "unfiltered" |
| 6.3 | Pookie AI chat: never presents as therapist; science answers grounded in class materials + persistent AI label + home-experiment refusal; math verified before display; no-training-on-inputs vendor term + disclosure | Cat 2 | |
| 6.4 | Proactive nudges: teen opt-in, frequency-capped, daytime only; scope-filtered; no health-content push (lock-screen leakage) | Cat 2 | |
| 6.5 | Teacher discussion threads: parent-authored + AI proofreading/tone-check only (no ghostwriting); "3 questions to ask" prompts OK | Cat 2 | Blocked as ghostwritten |
| 6.6 | Mandatory-reporter program design: designation decision, training plan, DFCS escalation path (1-855-422-4453); re-run analysis at first human/AI read of check-in content | G7 | Counsel sign-off gate |
| 6.7 | AI disclosure policy for abuse disclosures ("never 'just between us'", crisis-line handoff, teen-readable) | G10 | |
| 6.8 | W26 Weather: NWS/NOAA-sourced only; "not an emergency-alert system" disclaimer; coarse location default <18 | Cat 4 | |
| 6.9 | W19 Emergency: storage-only + "call 911 first"; Cobb/GA resources preloaded; break-glass medical info independent of parental access; lock-screen/QR reachability | Cat 4; G25 | |
| 6.10 | W29 Trails: no solo-hike recs <16; group-size/supervision guidance; dusk check (90-min sunset warning); "share my plan" | Cat 4 | Blocked as specified |
| 6.11 | W27 Events: published curation policy (ticketed/municipal/school/nonprofit/verified hosts only); per-event age tags; 18+/21+ filtered for <18; audience modes | Cat 4 | Blocked as specified |
| 6.12 | W30 Flights / W31 Rental Cars: 18+ purchaser-of-record invariant (server-side); minor-traveler rules engine; custody travel-restriction profile; rental cars hidden from teen accounts | Cat 4; G13 | Blocked for teen self-booking |
| 6.13 | W6 Driving School: encode **Georgia DDS rules** (learner's 15, Joshua's Law 30-hr, provisional Class D 16 restrictions, full Class C 18); digital Joshua's Law driving log | Cat 4 | Blocked as vaguely specified |
| 6.14 | W28 Restaurants: verified live listings; GA DPH inspection scores; allergen hard-blocks (never inferred); 21+/bar-primary excluded <18 | Cat 4 | |
| 6.15 | "Share my plans" teen outing-sharing (voluntary, teen-controlled, check-in timers, overdue nudges to teen-chosen contact) | G23 | |
| 6.16 | W14 Co-parenting: parallel-parenting mode (separate surfaces, immutable uneditable log, no child-as-courier); custody-order awareness | Cat 4 | Blocked for high-conflict |

## 7.0 Compliance Package — docs, policy, counsel gates

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 7.1 | **COPPA package**: written retention policy (per-source schedule), written infosec program, vendor assurances (Supabase, Cloudflare, AI/OCR); ban indefinite retention (312.10) | G6 · RISK-004 | Enforceable now — launch gate |
| 7.2 | Retention schedule implementation: check-ins teen-deletable + rolling purge; school emails school-year+1; raw financial images ≤30d; backups purged ≤30d after source deletion | Cat 7 | |
| 7.3 | ToS + arbitration + class waiver (11th Cir. post-*Concepcion*; parent/guardian contracting party for 13–17) | §5 gate 1 | **Counsel sign-off** |
| 7.4 | Breach runbook: GIPA scoping (§ 10-1-912), FBPA hook, notification procedures | §5 | |
| 7.5 | Law-enforcement / subpoena response policy | §5 gate 6 | **Counsel sign-off** |
| 7.6 | Court-order ingestion workflow (who verifies, what overrides) | G9; §5 gate 8 | Human review, not self-serve |
| 7.7 | § 20-2-667 operator-status legal theory memo (parent-credential-fed, no school contract) + guardrails doc | §5 | |
| 7.8 | FTC Health Breach Notification Rule applicability determination | §5 gate 10 | Before health modules hold real data |
| 7.9 | TAKE IT DOWN Act 48-hour removal path for W1 uploads | §5 | |
| 7.10 | Privacy policy overhaul (COPPA 2025 Rule; "never label signup as consent") | 1.1.4 | |
| 7.11 | W24 Credit re-scope: minor security-freeze management (O.C.G.A. §§ 10-1-914/914.1) + credit-hygiene coaching via licensed partner | Cat 4 | FCRA counsel sign-off |

## 8.0 QA & Release — verification and cutover

| ID | Work package | Checklist ref | Notes |
|---|---|---|---|
| 8.1 | Smoke-test gate on every deploy (`smoke-test-staging.py` via `deploy-staging.py`) — already wired; extend with access-model routes | AGENTS.md lesson | |
| 8.2 | E2E: signup → onboarding → child add → verify → grant/revoke → cooling-off → safe-exit → independence → 18+ transition (all age tiers) | QUALITY-PLAN | |
| 8.3 | Mehedi's full test protocol per phase (functional, non-functional, daily-update audit, production optimization, housekeeping, security) | QUALITY-PLAN | |
| 8.4 | Advanced: red-team + pen-test (auth-bypass, IDOR on child_access, scope leakage), SAST/DAST, fuzz, property-based (grant/revoke invariants), chaos (kill Supabase mid-sync), load | QUALITY-PLAN | |
| 8.5 | Sibling/household leakage analysis: per-child access boundaries verified end-to-end (G26) | G26 | |
| 8.6 | Staging verification by Mehedi (trust rule: personally loaded URL) | Charter §9 | |
| 8.7 | Production cutover (explicit go-ahead only): branch strategy, env parity, signup toggle OFF | Charter §9 | |
| 8.8 | BUILD-SPECIFICATION.md (FR/NFR) acceptance: requirements engineer sign-off that all WBS packages trace to requirements | — | Parallel workstream |

---

## WBS dictionary notes

- **Acceptance rule:** a work package is done only when its checklist mark flips to ✅ (re-verified by the owning expert domain or QA) — not when code is written.
- **🛑 items are launch gates:** the associated feature does not touch a real family until its fix is built and verified.
- **Traceability:** every package cites its checklist section. The requirements engineer maps FR/NFR → WBS in BUILD-SPECIFICATION.md.
