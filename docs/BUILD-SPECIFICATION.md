# Pookie Build Specification

**Version:** 1.0 · **Date:** 2026-10-12 · **Status:** Requirements locked
**Authority:** Mehedi Kamal — all 18-expert panel recommendations (2026-10-12) ACCEPTED.
Every ⚠️ and 🛑 from the panel review becomes a requirement below.

**Reference documents:**
- `docs/ACCESS-MODEL-REVIEW-CHECKLIST.md` — panel review (gaps G1–G28, reassessments R1–R12, GA compliance)
- `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` — locked access model (spec §N)
- `docs/FEATURE-LIST-FOR-PANEL.md` — 8 feature categories
- `src/lib/modules.ts` — 6-category menu, 28 modules (W10, W17 removed)

**How to read:** FR = functional requirement, NFR = non-functional. Traceability in §3 maps every
requirement to its panel/spec source. §4 records explicit removals.

---

## 1. FUNCTIONAL REQUIREMENTS

### FR-AUTH — Signup, onboarding, session

| ID | Requirement | Source |
|---|---|---|
| FR-AUTH-001 | Adult signup via Google OAuth or email magic link with no invite gate on the user's own account. Signing in always yields a working personal Pookie. | 1.1.1 ✅ |
| FR-AUTH-002 | 30-second onboarding: display name → optional "add children" → dashboard. Skippable at every step. `profiles.onboarding_completed` gates the first-login redirect to `/onboarding`. | 1.1.2 ⚠️ |
| FR-AUTH-003 | Child creation requires a guardian attestation checkbox ("I am the parent/legal guardian of this child"). | 1.1.2 ⚠️ |
| FR-AUTH-004 | DOB gate for direct teen self-signup: the system must capture date of birth before teen protections can attach. No teen onboarding path without it. | 1.1.2 ⚠️, G12 |
| FR-AUTH-005 | One-line school-transparency disclosure at the "add children" step: schools share education records with custodial parents regardless of in-app settings. | 1.1.2 ⚠️ |
| FR-AUTH-006 | "Just me" mode: users with no children get a personal life dashboard. Never show parenting upsells to childless users. | 1.1.3 ✅ |
| FR-AUTH-007 | Session management via Supabase Auth with middleware refresh on every request. | existing |
| FR-AUTH-008 | 5-tab navigation (Home · Today · Pookie · Progress · More), child switcher with active-child persistence. Switching children purges the prior child's data from client state. | Cat 1 ✅ |
| FR-AUTH-009 | `/verify-invite` public landing: zero child PII rendered pre-authentication; unguessable single-use tokens; no enumeration oracle (no "this token is invalid because…" differentiation). | Cat 1 ⚠️ |

### FR-ACCESS — Linking, grant/revoke, requests, block list, audit

| ID | Requirement | Source |
|---|---|---|
| FR-ACCESS-001 | Email invite: 7-day expiring token → child clicks → must sign in with the **matching email** → consent screen. Consent screen unbundles per-domain (school / health / location / social), all unchecked by default, ≤8th-grade reading level, health subcategories enumerated (never one "health" checkbox), check-in text + mood named explicitly, school-transparency disclosure included. No re-prompt for 90 days after a decline. | 1.2.1 ⚠️ |
| FR-ACCESS-002 | 6-digit link codes: 15-minute TTL, single use, brute-force lockout after N failed attempts, anti-coercion private confirmation ("Did you choose this, or were you told to?"), same-device redemption flagged in the audit log. | 1.2.2 ⚠️ |
| FR-ACCESS-003 | Claim dedupe fires **only after** successful email verification (never as a standalone lookup — enumeration risk). Near-misses go to manual review. Never auto-merge health records. | 1.2.3 ⚠️ |
| FR-ACCESS-004 | Child-as-access-authority: a grant made by the child cannot be vetoed or revoked by any parent. `child_access.granted_by` ∈ `'child' \| 'parent' \| 'system'` enforced server-side on every revoke path. | 1.3.1 ✅, spec §3 |
| FR-ACCESS-005 | Revoke rules: a teen may revoke **any** grant on their own record (fixes grandparent deadlock); parents may revoke only grants they themselves made; court orders supersede via human review only (never self-serve); custody-order carve-out adjusts the matrix per verified order. | 1.3.2 ⚠️ |
| FR-ACCESS-006 | Visibility scopes replace per-person all-or-nothing: per-person × per-scope across **Performance / Communications / Reflection / Wellness**, plus health sub-tiers H0–H3 (FR-HEALTH-001) and a separate travel/location toggle. Defaults at link time: Performance + Communications visible, Reflection + Wellness teen-private. **All** briefings, digests, nudges, and API responses are filtered server-side by scope. | 1.3.3 ⚠️ NEW |
| FR-ACCESS-007 | Access-request flow (non-parent adult → teen approves): fact-only notification to the other parent; under-16 non-parent grants require parent co-approval; 30-day re-request lockout after a revoke. | 1.3.4 ⚠️ |
| FR-ACCESS-008 | Block list: a blocked adult's household may not re-invite for 30 days; block never revokes safety-critical school comms; court-order override path exists (human review). | 1.3.5 ⚠️ |
| FR-ACCESS-009 | Append-only `access_events` audit table (migration 021): every grant / revoke / request / block / safe-exit with timestamp, `granted_by`, reason code, device/IP hash. Teen-visible; never shown to a revoked parent. | 1.3.6 ⚠️ NEW |
| FR-ACCESS-010 | `cannot_invite_self` guard; no user can self-grant a `parent` role — all roles assigned by server functions only. | spec §3 |

### FR-AGE — Age tiers

| ID | Requirement | Source |
|---|---|---|
| FR-AGE-001 | Under-13 stewardship is a **technical guarantee, not policy**: server-side ban on under-13 login, session creation, link-code issuance/redemption, invites, typable child fields, and persistent identifiers. `children.legal_status` field supports emancipated minors (O.C.G.A. §§ 15-11-720–727) routed to the adult track at any age. Never label signup as "consent." | 1.1.4 ⚠️, G11 |
| FR-AGE-002 | 13–15 revoke cooling-off — **redesigned per panel (original design BLOCKED):** teen chooses notify-now vs notify-at-effect (default: notify at effect, only the revoked parent, never both). **Safe-exit path:** "telling my parents could put me at risk" → immediate cutoff + suppressed notification + crisis resources. During a pending window the parent UI shows access as unchanged (no countdown banner) and no new parent-visible syncs occur. | 1.4.1 🛑, G4 |
| FR-AGE-003 | Revoke confirmation copy: per-scope consequences + school-transparency line ("Pookie-only; the school still shares with your parents") + alternatives offered (narrow a scope, 30-day pause, talk-it-through). | 1.4.2 ⚠️ |
| FR-AGE-004 | 16–17: instant revoke, fully reversible by the teen (one-tap re-grant, no guilt screens). | spec §4 |
| FR-AGE-005 | 18+ school/grades continuity: FERPA rights transfer at 18 **or postsecondary enrollment, whichever is first**; ongoing parent-credential pulls **pause** until the adult student re-authorizes; the keep/review decision is unavoidable (not a dismissible banner). | 1.6.1 ⚠️, R3 |
| FR-AGE-006 | 18+ health data: **affirmative opt-in re-consent required — skip = private.** Includes review–correct–seal of parent-entered data, transition-summary export, and emergency-contact re-designation decoupled from access grants. | 1.6.2 🛑, G5 |
| FR-AGE-007 | Historical data: parent keeps what they already saw; 30-day grace then auto-restrict for health data; teen may request "hide past too"; deletion honored within 30 days. | 1.6.3 ⚠️ |
| FR-AGE-008 | Quiet exit option at 18: "make private quietly" — immediate revoke, delayed neutral notification, no celebration UI. | 1.6.4 ⚠️ |

### FR-SAFETY — Trusted adult, crisis, safety carve-outs

| ID | Requirement | Source |
|---|---|---|
| FR-SAFETY-001 | Trusted-adult designation is **required** before any revoke or go-independent flow executes. Crisis alerts route to the trusted adult. If the teen declines to name one, they check "I understand no adult will be alerted." (Resolves the crisis-tripwire vs revoke contradiction.) | 1.5.3 ⚠️, G1 |
| FR-SAFETY-002 | Crisis/safety protocol for mood pulse, check-ins, and AI chat disclosures: 988 / Crisis Text Line surfacing, teen-controlled "tell a trusted adult," documented self-harm protocol for the AI (CA SB 1119 shape), explicit copy that "private spaces are not safety-monitored." Launch-blocking for Wellbeing (W8). | G2 |
| FR-SAFETY-003 | Safety-critical school comms (permission slips, lab/field-trip notices, incident reports, emergency notifications) are **never revocable**: non-toggleable row on the Sharing screen; `revokeAccess` never touches this scope; separate safety channel in the API. | 1.2b.3 ⚠️ |
| FR-SAFETY-004 | Safe-exit path UI is visually boring by design — never show celebration UI where an abuser might see it. | 1.4.1 🛑, 1.5.1 ⚠️ |
| FR-SAFETY-005 | Go-independent framing split: **gaining** independence = celebration (confetti, own Pookie); **removing** a parent = calm, neutral, respectful. | 1.5.1 ⚠️ |
| FR-SAFETY-006 | Data-source handoff applies to 13–17 independence (not just 18+): guide the teen to connect their own school credentials; a revoked parent's credentials must never keep syncing the teen's data. | 1.5.2 ⚠️ |
| FR-SAFETY-007 | Safety gate for Out & About modules for independent 13–15: trusted-adult contact + 3-minute Safety Basics + family-aware defaults until 16. **Blocked as specified without this.** | 1.5.4 🛑 |
| FR-SAFETY-008 | Emergency module (W19) is storage, not a response service: "call 911 first" copy; preload Cobb County / Georgia resources (911, poison control, 988, GA Crisis & Access Line); break-glass medical info reachable independent of parental access; lab emergency quick-card. | Cat 4 W19 ⚠️, G25 |
| FR-SAFETY-009 | Mandatory-reporter program hooks: designate a compliance owner now; DFCS escalation path (1-855-422-4453); re-run the O.C.G.A. § 19-7-5 analysis at the first human or AI read of check-in content. | G7 |
| FR-SAFETY-010 | Persistent teen-nominated trusted-adult / safe-contact list with teen-controlled visibility. | G15 |
| FR-SAFETY-011 | Court-order ingestion workflow: verified orders supersede via human review; `court_order_restriction` flag; the teen is told plainly why access changed. | G9, 1.3.2 |
| FR-SAFETY-012 | Custody-order carve-out in the revoke matrix; travel-restriction profile for custody orders. | G9, R4 |

### FR-HEALTH — Health privacy taxonomy and module guardrails

| ID | Requirement | Source |
|---|---|---|
| FR-HEALTH-001 | Build the **H0/H1/H2/H3 health privacy taxonomy before W2 holds real teen data** (currently referenced but undefined — **blocked** until built): H0 = prohibited for <18 · H1 = shareable wellness · H2 = teen-private · H3 = legally sensitive. Every health datum is classified at write time. | G3, Cat 4 W2 🛑 |
| FR-HEALTH-002 | Consumer-device health data is descriptive only, provenance-labeled, never diagnostic (FDA wellness boundary). | Cat 4 W2 🛑 |
| FR-HEALTH-003 | W8 Wellbeing (mood pulse, teenPrivate): crisis-escalation ladder (bad day → pattern → crisis triggers → ED signals); never parent-visible including aggregates; no indefinite retention; 988 integration. | Cat 4 W8 ⚠️ |
| FR-HEALTH-004 | W13 Meals: no calorie budgeting or moralizing language for <18. | Cat 4 ✅+constraint |
| FR-HEALTH-005 | W22 Activity: no streaks for <18, no calorie-burn display, rest-day normalization, no teen leaderboards. | Cat 4 W22 ⚠️ |
| FR-HEALTH-006 | W23 Nutrition: **no calorie or weight-loss features for <18**; weight-neutral framing only; NEDA resources surfaced; clinician gate before any expanded tracking. **Blocked as designed.** | Cat 4 W23 🛑 |
| FR-HEALTH-007 | Health consent is per-subcategory (enumerated, never one "health" checkbox) — see FR-ACCESS-001. | 1.2.1 ⚠️ |
| FR-HEALTH-008 | Georgia minor health-consent rules: minors can consent to certain care (STI, substance abuse, mental health at 16+); confidential teen health data in those categories is never parent-visible regardless of scope grants. | panel pediatrician |
| FR-HEALTH-009 | 42 CFR Part 2: never co-mingle substance-use-disorder content under a general consent; SUD data requires its own consent instrument. | §5 |
| FR-HEALTH-010 | Immunization management: GA Form 3231 tracking, college immunization requirements, HPV catch-up prompts, transfer-for-college export. | G22 |
| FR-HEALTH-011 | "Power-up" daily pull: define or cut. If supplement-related, requires health-claim review before ship. | G27 |

### FR-SCHOOL — Provenance, inbox, check-ins, quizzes, tips

| ID | Requirement | Source |
|---|---|---|
| FR-SCHOOL-001 | Data-provenance rule: **school-of-record data** (grades, attendance, official school comms) inherits the school's audience — under FERPA a custodial parent of a minor can obtain it from the school regardless of in-app settings, and Pookie never promises otherwise. **App-generated data** (check-ins, reflections, mood, AI chats, practice content) is child-authority governed by visibility scopes. | 1.2b.1 ⚠️, 1.2b.2 ✅ |
| FR-SCHOOL-002 | Teacher inbox: **segregate counselor mail** (ASCA B.2 — counselor confidentiality is not a parent CC line; **blocked as merged**). Provenance labels on every message; teacher-thread visibility follows the School-module scope setting (no split-brain); safety-critical messages tagged. | Cat 5 🛑 |
| FR-SCHOOL-003 | Daily check-in **redesigned — never a parent-facing lie detector** (**blocked as designed**): teen-facing calibration only ("your estimates are getting sharper" — metacognition framing); never shown to parents; never accusatory; teen-deletable; rolling auto-purge option; no indefinite retention for minor-generated content. | Cat 3 🛑, G17 |
| FR-SCHOOL-004 | Peer tips pipeline **redesigned** (**blocked as designed**): rename to "Study Sparks" (no fabricated "peer" social proof); provenance labels; contested-topic human review; 5%/week sampling QA; study-skills-only fencing; 4-week expiry kept; provable de-identification/aggregation or per-family consent before ship. | Cat 5 🛑, G8, R6 |
| FR-SCHOOL-005 | AI practice quizzes: fail-closed verification pipeline required — machine-verified answer keys, misconception-aware distractors, persistent AI labels, per-class opt-in, measured pilot before scale. **Until then: source-text flashcards only.** | Cat 5 🛑, R8 |
| FR-SCHOOL-006 | Unit auto-alignment: confidence-scored; below-threshold items go to a human queue (student owns tagging); never auto-align high-stakes content on a guess. | Cat 5 ⚠️ |
| FR-SCHOOL-007 | Path-to-90: parent viewers are read-only on the teen's checkboxes. Deterministic, versioned, unit-tested, input-cited grade-forecast engine (the highest-value math artifact — implied everywhere, specified here). | Cat 5 ⚠️, G18 |
| FR-SCHOOL-008 | SAT prep: Digital-SAT blueprint (44 questions, adaptive, Desmos built in) + Desmos fluency training; verified formula bank; no fake score predictions. | Cat 5 ⚠️ |
| FR-SCHOOL-009 | W5 College & Future: GSFC methodology exactly (HOPE 3.0 core + rigor; Zell Miller 3.7 + 1200/26; date-stamped; "verify at GAfutures.org"); chance-me shows ranges + model card, never point estimates; essay feedback-only (no ghostwriting — academic integrity); counselor handoff prompts; long-pathway examples branch (e.g., anesthesiologist). | Cat 4 W5 ⚠️ |
| FR-SCHOOL-010 | W4 Activities: teen-consented location only; GHSA eligibility monitoring. | Cat 4 W4 ⚠️ |
| FR-SCHOOL-011 | W18 Summer: camp vetting; crisis routing year-round (not just school year); rising-9th transition content. | Cat 4 W18 ⚠️ |
| FR-SCHOOL-012 | 504/IEP accommodation tracking: store the plan, track delivery, log review dates. (#1 parent-counselor friction point in GA schools.) | G20 |
| FR-SCHOOL-013 | Four-year graduation audit against GA 23-credit requirements. | G21 |
| FR-SCHOOL-014 | TAKE IT DOWN Act compliance: 48-hour removal path for W1 uploads. | §5 |
| FR-SCHOOL-015 | School-issued account privacy: never imply privacy the school doesn't grant (Cobb Office 365 is school-monitored); extend the firewall concept. | G28 |
| FR-SCHOOL-016 | Redact non-linked students from CC'd teacher emails before any parent-visible surface renders them (FERPA-in-practice). | Cat 5 ⚠️ |
| FR-SCHOOL-017 | Daily pulls: news from a reputable allowlist with contested-topic balance; horoscope dropped or quarantined as opt-in entertainment; "power-up" defined or cut (see FR-HEALTH-011). | Cat 5 ⚠️ |
| FR-SCHOOL-018 | Single curated formula/definition bank as the grounding source for quizzes, tips, tutor math, and SAT formulas. | G19 |
| FR-SCHOOL-019 | Lab-safety pulse for science classes (part of check-in surface). | Cat 5 ⚠️ |

### FR-MODULES — 28 modules across 6 categories

Panel marks: ✅ clear · ⚠️ ship only with the fix · 🛑 do not ship as designed.
Categories per Mehedi 2026-10-12 (W10 Fairness and W17 Friends removed — see §4).

**Health** (5)

| ID | Module | Mark | Requirement |
|---|---|---|---|
| FR-MOD-W2 | Health (vitals, trends) | 🛑 | Blocked until FR-HEALTH-001 taxonomy exists; then FR-HEALTH-002 applies. |
| FR-MOD-W8 | Wellbeing (mood pulse, teenPrivate) | ⚠️ | FR-HEALTH-003. |
| FR-MOD-W13 | Meals | ✅ | With FR-HEALTH-004 constraint. |
| FR-MOD-W22 | Activity | ⚠️ | FR-HEALTH-005. |
| FR-MOD-W23 | Nutrition | 🛑 | FR-HEALTH-006. |

**Home** (6)

| ID | Module | Mark | Requirement |
|---|---|---|---|
| FR-MOD-W21 | Mail (photo intake) | ⚠️ | GIPA exposure: extract-then-mask (last-4 only), auto-delete raw images ≤30 days, on-device redaction guidance. |
| FR-MOD-W20 | Shopping List | ✅ | Live route `/household/shopping`. |
| FR-MOD-W11 | Spending | ⚠️ | Mask to last-4; FTC Disposal Rule on disposal; teen's own purchase detail is teen-private. |
| FR-MOD-W7 | Money & Documents (vault) | ⚠️ | Same masking as W21; never persist full card numbers (see NFR-SEC-006). |
| FR-MOD-W24 | Credit | 🛑 | **Blocked as 3-bureau monitoring** (no FCRA permissible purpose; bureaus won't furnish). Re-scope to **minor security-freeze management** (O.C.G.A. §§ 10-1-914/914.1 — lawful, GA-native) + credit-hygiene coaching via a licensed partner. FCRA counsel sign-off required. |
| FR-MOD-W14 | Co-parenting | 🛑 | **Blocked for high-conflict as designed.** Required: parallel-parenting mode (separate surfaces, no shared messaging to screenshot); immutable uneditable log; no child-as-courier; custody-order awareness + travel-restriction profile (FR-SAFETY-012); neutral teen-facing coaching/pattern flags. Launch read-only/logistics-only; expand only after family-law practitioner review (R5). |

**School** (5)

| ID | Module | Mark | Requirement |
|---|---|---|---|
| FR-MOD-W1 | School (live) | ⚠️ | FR-SCHOOL-001 through FR-SCHOOL-019. |
| FR-MOD-W16 | School Calendar | ✅ | Lives inside School. |
| FR-MOD-W5 | College & Future | ⚠️ | FR-SCHOOL-009. |
| FR-MOD-W4 | Activities | ⚠️ | FR-SCHOOL-010. |
| FR-MOD-W18 | Summer | ⚠️ | FR-SCHOOL-011. |

**Safety** (3)

| ID | Module | Mark | Requirement |
|---|---|---|---|
| FR-MOD-W3 | Safety (insurance) | ✅ | Never interpret coverage (liability). |
| FR-MOD-W19 | Emergency | ⚠️ | FR-SAFETY-008. |
| FR-MOD-W15 | Screen Time | ⚠️ | 13+: co-set (teen proposes, parent approves) with teen appeal path; always transparent — never covert ("spyware" characterization risk); device-level agents 🛑 for under-13 (COPPA). |

**Travel** (7)

| ID | Module | Mark | Requirement |
|---|---|---|---|
| FR-MOD-W25 | Fuel & Charging | ✅ | Teen routing inherits the family-aware default. |
| FR-MOD-W26 | Weather | ⚠️ | NWS/NOAA-sourced only, never LLM-generated; AI may translate but must link the official alert + timestamp; explicit "not an emergency-alert system" disclaimer; coarse location default for <18. |
| FR-MOD-W27 | Events | 🛑 | Published curation policy required (ticketed public venues / municipal / school / nonprofit / verified hosts only; never private-residence or "DM for address"); per-event age tags (all-ages/13+/18+/21+); 18+/21+ filtered by default for <18; audience modes (Family/Teen/Grown-up); municipal seed sources (Cobb Parks & Rec, Marietta calendars). |
| FR-MOD-W28 | Restaurants | ⚠️ | Verified live listings (no hallucinated restaurants); GA DPH inspection scores; allergen hard-blocks from the health allergy list (never inferred, never "allergy-safe" claims); 21+/bar-primary excluded for <18; no weight-loss dietary framing for <18; teen night-safety bias. |
| FR-MOD-W29 | Trails & Parks | 🛑 | No solo-hike recommendations for <16; difficulty carries group-size/supervision guidance; official sources only (NWS + park authority; dusk-closure awareness); 90-minute sunset warning; "share my plan" as a first-class step (G23). |
| FR-MOD-W30 | Flights | 🛑 | Purchaser-of-record must be 18+ (server-side invariant); minor-traveler rules engine (UM bands/fees per airline, phone-booking routing, passport/TSA checks); itinerary visibility = dedicated Sharing toggle; teen travel-purchase alerts to parents; custody travel-restriction profile. |
| FR-MOD-W31 | Rental Cars | 🛑 | Hard-gate on (company minimum age × state × full license); under-21 → planning mode only; **hidden from teen accounts**, not footnoted; under-25 surcharges included in ranked totals. |

**Marketplace** (2)

| ID | Module | Mark | Requirement |
|---|---|---|---|
| FR-MOD-W12 | Babysitters | ⚠️ | Directory only; labeled "parent-vetted, not background-checked by Pookie" — or integrate real checks (FCRA counsel first). |
| FR-MOD-W6 | Driving School | 🛑 | Must encode **Georgia DDS rules** (learner's permit at 15, Joshua's Law 30-hour requirement, provisional Class D at 16 with midnight–5AM + passenger restrictions, full Class C at 18); digital driving log for Joshua's Law hours; per-state rules from day one. |

**Cross-module**

| ID | Requirement | Source |
|---|---|---|
| FR-MOD-X01 | Sibling/household leakage analysis: per-child access boundaries verified end-to-end (revoking Parent A on child 1 must not leak via shared surfaces, digests, or the child switcher). | G26 |
| FR-MOD-X02 | Location-data policy for 13–17: retention limits, coarse precision default, no retained history for <18, disclosed at Explorer Setup. | G14 |
| FR-MOD-X03 | "Share my plans" teen outing-sharing: voluntary, teen-controlled, check-in timers, overdue nudges to the teen-chosen contact. | G23 |
| FR-MOD-X04 | Voter pre-registration (GA: 17.5) belongs in the Growing Up independence checklist surface. | G24 |

### FR-MENU — Popup navigation

| ID | Requirement | Source |
|---|---|---|
| FR-MENU-001 | "More" tab opens a popup bottom-sheet (not a page) with the 6 categories collapsed; tap to expand. Renders from `src/lib/modules.ts`. | Mehedi 2026-10-12 |
| FR-MENU-002 | Search field at top ("find a feature…") across module names and descriptions. | Mehedi 2026-10-12 |
| FR-MENU-003 | "Recent" row showing the user's recently used modules. | Mehedi 2026-10-12 |
| FR-MENU-004 | Age-gating in the menu itself: modules inappropriate for the viewer's age band are hidden (e.g., Credit/W24 hidden from <18; Rental Cars/W31 hidden from teen accounts per FR-MOD-W31). | panel |
| FR-MENU-005 | teenPrivate modules show a locked state to parents — visible that the module exists, never its contents, with no hunting path. | panel |

### FR-AI — Pookie / Muse guardrails

| ID | Requirement | Source |
|---|---|---|
| FR-AI-001 | Pookie AI chat (warm tutor): documented self-harm/crisis protocol (988 surfacing; no auto-parent-notification absent imminent risk); never presents as a therapist; science answers grounded in class materials with persistent AI label + home-experiment refusal; math answers verified before display; no-training-on-inputs vendor term + user disclosure. | Cat 2 ⚠️ |
| FR-AI-002 | Muse "direct, unfiltered" mode is **BLOCKED for under-18**. 18+ gate; rename to "direct mode"; identical safety rules across modes; system-level minor-safety policy. ("Unfiltered" is a litigation exhibit.) | Cat 2 🛑, R7 |
| FR-AI-003 | Proactive nudges: teen opt-in, frequency-capped, daytime only; content scope-filtered (never Reflection/Wellness-derived nudges to parents); no health-content push (lock-screen leakage). | Cat 2 ⚠️ |
| FR-AI-004 | Weekly teacher discussion threads: **no AI-ghostwritten teacher emails.** Parent-authored + AI proofreading/tone-check only. "3 questions to ask" prompts are fine. No send path until parent-authorship rules ship. | Cat 2 🛑 |
| FR-AI-005 | Written AI disclosure policy for abuse disclosures to Pookie/Muse: what the AI says and doesn't promise (never "just between us"), crisis-line handoff, teen-readable language. | G10 |

### FR-TRAVEL — Minor-traveler rules (consolidated)

Covered per-module in FR-MOD-W30/W31/W27/W29/W28 above, plus:

| ID | Requirement | Source |
|---|---|---|
| FR-TRAVEL-001 | Purchasing/contracting carve-out: visibility ≠ transactional authority. No purchase, booking, or contract flow is completable by a <18 account, enforced server-side. | G13 |

---

## 2. NON-FUNCTIONAL REQUIREMENTS

### NFR-PERF — Performance

| ID | Requirement | Source |
|---|---|---|
| NFR-PERF-001 | Routes respond <3s; cached reads <1s. The post-deploy smoke test asserts the <3s bound. | AGENTS.md lesson |
| NFR-PERF-002 | Every JS chunk referenced by served HTML returns 200 (smoke-test verified). | AGENTS.md lesson |

### NFR-SEC — Security

| ID | Requirement | Source |
|---|---|---|
| NFR-SEC-001 | Row-Level Security on every table; RLS policies verified per Mehedi's test protocol (auth-bypass attempts on tables and storage). | test protocol |
| NFR-SEC-002 | No secrets in the repo or client bundle (verified in CI). | test protocol |
| NFR-SEC-003 | XSS audit on all user-rendered surfaces. | test protocol |
| NFR-SEC-004 | Penetration testing per Mehedi's standing directive: red teaming, SAST/DAST, fuzz, property-based, chaos engineering, load testing. | test protocol 2026-10-06 |
| NFR-SEC-005 | Brute-force lockout on link-code redemption (FR-ACCESS-002). | 1.2.2 |
| NFR-SEC-006 | Credentials vault: encrypt before any real credentials are stored (GIPA — name+password = personal info; a breach is an O.C.G.A. § 10-1-912 event); never log plaintext; rotation + cryptographic erasure; at 18, parent-connected school credentials transfer ownership via mandatory handoff. | Cat 7 ⚠️ |
| NFR-SEC-007 | API: every route enforces the access matrix + visibility scopes server-side; per-grantee scoped tokens; step-up auth for token creation; audit logging (supports breach scoping); no unauthenticated or broadly-scoped API ships before enforcement is proven in staging. | Cat 8 ⚠️ |
| NFR-SEC-008 | `teacher-messages` send path: no send until parent-authorship rules ship (FR-AI-004); approve/send requires an explicit write scope. | Cat 8 🛑 |

### NFR-PRIVACY — Privacy

| ID | Requirement | Source |
|---|---|---|
| NFR-PRIVACY-001 | COPPA 2025 compliance package (enforceable now): **written retention policy** (no more "indefinite"/"TBD"), written infosec program, written vendor assurances (Supabase, Cloudflare, OCR/AI vendors). 312.10 bans indefinite retention of under-13 data — no exceptions. | G6 🛑 |
| NFR-PRIVACY-002 | Published per-source retention schedule: check-ins teen-deletable + rolling purge option; school emails school-year + 1; raw financial images ≤30 days; backups purged ≤30 days after source deletion. | Cat 7 🛑 |
| NFR-PRIVACY-003 | Data minimization: server-side ban on under-13 persistent identifiers (FR-AGE-001). | 1.1.4 |
| NFR-PRIVACY-004 | Per-scope server-side filtering on **all** briefings, digests, nudges, and API responses. | 1.3.3 |
| NFR-PRIVACY-005 | `/verify-invite`: zero child PII pre-auth; unguessable single-use tokens; no enumeration oracle. | Cat 1 ⚠️ |
| NFR-PRIVACY-006 | Claim dedupe fires only after successful email verification (enumeration risk). | 1.2.3 |
| NFR-PRIVACY-007 | No consent re-prompt for 90 days after a teen declines. | 1.2.1 |
| NFR-PRIVACY-008 | No training on user inputs: vendor contract term + user-facing disclosure. | Cat 2 ⚠️ |
| NFR-PRIVACY-009 | GIPA: extract-then-mask (last-4 only) for mail intake and the document vault; auto-delete raw images ≤30 days; on-device redaction guidance. | Cat 4 W21/W7 ⚠️ |

### NFR-A11Y — Accessibility

| ID | Requirement | Source |
|---|---|---|
| NFR-A11Y-001 | Labels, contrast, keyboard navigation, reduced-motion support on all surfaces (per Mehedi's test protocol). | test protocol |
| NFR-A11Y-002 | Consent screens at ≤8th-grade reading level. | 1.2.1 |

### NFR-RELIABILITY — Reliability

| ID | Requirement | Source |
|---|---|---|
| NFR-RELIABILITY-001 | **Cloudflare Workers cookie rule:** in Next.js route handlers that touch auth cookies, never rely on `next/headers` `cookies().set()` propagating to a freshly constructed `NextResponse`. Capture cookies from the SSR client's `setAll()` into a local array, read incoming cookies from `NextRequest`, and explicitly `response.cookies.set()` each on the redirect response. Reference: `src/app/auth/callback/route.ts`, commit 538f288. | AGENTS.md 2026-10-12 |
| NFR-RELIABILITY-002 | Post-deploy smoke test gate: every staging deploy runs `smoke-test-staging.py` (wired into `deploy-staging.py`) and must pass before "deployed" is claimed. | AGENTS.md 2026-10-12 |
| NFR-RELIABILITY-003 | Supabase client singleton: `src/lib/supabase/client.ts` must export a singleton; never create a client per call. | AGENTS.md 2026-10-07 |
| NFR-RELIABILITY-004 | Favicon ICO must be RGBA (Next.js 16 Turbopack fails on RGB); copy `public/favicon.ico` over `out/favicon.ico` after every build. | AGENTS.md 2026-10-09 |
| NFR-RELIABILITY-005 | Code cleanliness (Mehedi's standing rule): no dead code, no commented-out blocks, no unused imports, no console.logs, no dead files; clean up before every merge. | AGENTS.md |
| NFR-RELIABILITY-006 | Sync ingestion anomaly detection: generalize the zero-guard to full ingest anomaly detection on all sync workers. | Cat 5 ⚠️ |

### NFR-COMPLIANCE — Regulatory

| ID | Requirement | Source |
|---|---|---|
| NFR-COMPLIANCE-001 | GA Fair Business Practices Act (O.C.G.A. § 10-1-393(a)): privacy-policy promises are enforceable by the AG — whatever Pookie promises, it must honor. | §5 |
| NFR-COMPLIANCE-002 | FCRA: W24 re-scoped to minor security-freeze management (O.C.G.A. §§ 10-1-914/914.1) + licensed partner for coaching; counsel sign-off. | Cat 4 🛑 |
| NFR-COMPLIANCE-003 | GA Parents' Bill of Rights (O.C.G.A. § 20-2-786): the never-revocable safety-comms design (FR-SAFETY-003) must satisfy "timely safety information" — confirm with counsel. | §5 |
| NFR-COMPLIANCE-004 | FTC Health Breach Notification Rule: applicability determination **before** health modules hold real data. | §5 gate 10 |
| NFR-COMPLIANCE-005 | 42 CFR Part 2: never co-mingle SUD content under a general consent. | §5 |
| NFR-COMPLIANCE-006 | TAKE IT DOWN Act: 48-hour removal path for W1 uploads. | §5 |
| NFR-COMPLIANCE-007 | O.C.G.A. § 20-2-667 operator-status boundary documented (parent-credential-fed, no school contract; no student ads/data sale; 45-day deletion on school request). | §5 |
| NFR-COMPLIANCE-008 | Emancipated-minor standards (O.C.G.A. §§ 15-11-720–727) implemented via `children.legal_status`. | §5 |
| NFR-COMPLIANCE-009 | Sex-ed opt-out currency: recheck O.C.G.A. § 20-2-143(d) current text before building opt-out logic. | §5 |

### NFR-LEGAL-GATES — Real-attorney sign-off required (do not ship on panel analysis alone)

| ID | Gate | Source |
|---|---|---|
| NFR-LEGAL-001 | Terms of Service + arbitration + class waiver (11th Cir. post-*Concepcion*; parent/guardian must be the contracting party for 13–17 — minor voidability). | §5 gate 1 |
| NFR-LEGAL-002 | Mandatory-reporter program: designation, training, DFCS escalation — before any human reads check-in content. | §5 gate 2 |
| NFR-LEGAL-003 | 18+ FERPA consent design for education records (continuity vs pause-and-ask). | §5 gate 3 |
| NFR-LEGAL-004 | Cooling-off notification/retaliation matrix with DV-advocate review of all user-facing strings. | §5 gate 4 |
| NFR-LEGAL-005 | Data retention + litigation-hold procedure. | §5 gate 5 |
| NFR-LEGAL-006 | Law-enforcement / subpoena response policy. | §5 gate 6 |
| NFR-LEGAL-007 | COPPA compliance package (retention policy, infosec program, vendor assurances, policy overhaul — 2025 Rule). | §5 gate 7 |
| NFR-LEGAL-008 | Court-order ingestion workflow (who verifies, what overrides). | §5 gate 8 |
| NFR-LEGAL-009 | Multi-state expansion review (WA MHMDA, TX SCOPE, CA AB 2246/SB 1119, IL BIPA, AL 2027 law) before any non-GA launch. | §5 gate 9 |
| NFR-LEGAL-010 | FTC Health Breach Notification Rule applicability determination. | §5 gate 10 |

---

## 3. REQUIREMENTS TRACEABILITY

Every 🛑 from the panel traces to at least one FR/NFR below. Sources: panel gaps G1–G28,
reassessments R1–R12, checklist sections (§1–§5), spec sections (spec §N).

### 🛑-item traceability (blocked items → covering requirements)

| Panel 🛑 | Covered by |
|---|---|
| 1.4.1 cooling-off notification (most dangerous element) | FR-AGE-002, FR-SAFETY-004, NFR-LEGAL-004 |
| 1.5.4 Out & About safety gate | FR-SAFETY-007 |
| 1.6.2 18+ health continuity default | FR-AGE-006 |
| Muse "unfiltered" under-18 | FR-AI-002 |
| AI-ghostwritten teacher emails | FR-AI-004, NFR-SEC-008 |
| Check-in as parent lie detector | FR-SCHOOL-003 |
| W2 Health without tiers | FR-HEALTH-001, FR-HEALTH-002 |
| W23 Nutrition <18 | FR-HEALTH-006 |
| W24 Credit monitoring | FR-MOD-W24, NFR-COMPLIANCE-002 |
| W14 Co-parenting high-conflict | FR-MOD-W14 |
| W6 Driving (no GA DDS rules) | FR-MOD-W6 |
| W27 Events (no vetting) | FR-MOD-W27 |
| W29 Trails solo-minor | FR-MOD-W29 |
| W30 Flights teen self-booking | FR-MOD-W30 |
| W31 Rental Cars teen initiation | FR-MOD-W31 |
| AI practice quizzes unverified | FR-SCHOOL-005 |
| Peer tips cross-family identifiable | FR-SCHOOL-004 |
| Teacher inbox counselor-mail merge | FR-SCHOOL-002 |
| Retention "indefinite/TBD" | NFR-PRIVACY-001, NFR-PRIVACY-002 |
| G1 crisis tripwire vs revoke | FR-SAFETY-001 |
| G2 no crisis protocol | FR-SAFETY-002 |
| G3 health tiers undefined | FR-HEALTH-001 |
| G4 cooling-off endangers abuse-exit | FR-AGE-002 |
| G5 18+ health continuity | FR-AGE-006 |
| G6 no COPPA package | NFR-PRIVACY-001, NFR-LEGAL-007 |

### Full FR → source map

| FR | Gaps | Reassessment | Checklist § | Spec § |
|---|---|---|---|---|
| FR-AUTH-001..009 | G12 | — | 1.1, Cat 1 | §2 |
| FR-ACCESS-001 | — | — | 1.2.1 | §5 |
| FR-ACCESS-002 | — | — | 1.2.2 | §5 |
| FR-ACCESS-003 | — | — | 1.2.3 | §5 |
| FR-ACCESS-004 | — | R4 | 1.3.1 | §3 |
| FR-ACCESS-005 | G9 | R4 | 1.3.2 | §3 |
| FR-ACCESS-006 | — | — | 1.3.3 | NEW |
| FR-ACCESS-007 | — | — | 1.3.4 | §5 |
| FR-ACCESS-008 | — | — | 1.3.5 | §11 |
| FR-ACCESS-009 | — | — | 1.3.6 | NEW |
| FR-ACCESS-010 | — | — | — | §3 |
| FR-AGE-001 | G11 | — | 1.1.4 | §4 |
| FR-AGE-002 | G4 | R1, R2 | 1.4.1 | §4 (supersedes) |
| FR-AGE-003 | — | — | 1.4.2 | §4 |
| FR-AGE-004 | — | R2 | — | §4 |
| FR-AGE-005 | — | R3 | 1.6.1 | §4 (amends) |
| FR-AGE-006 | G5 | — | 1.6.2 | §4 (amends) |
| FR-AGE-007 | — | — | 1.6.3 | §4 |
| FR-AGE-008 | — | — | 1.6.4 | NEW |
| FR-SAFETY-001 | G1 | — | 1.5.3 | NEW |
| FR-SAFETY-002 | G2 | — | — | NEW |
| FR-SAFETY-003 | — | — | 1.2b.3 | NEW |
| FR-SAFETY-004 | G4 | — | 1.4.1, 1.5.1 | NEW |
| FR-SAFETY-005 | — | — | 1.5.1 | §6 (amends) |
| FR-SAFETY-006 | — | — | 1.5.2 | §6 |
| FR-SAFETY-007 | — | — | 1.5.4 | NEW |
| FR-SAFETY-008 | G25 | — | Cat 4 W19 | — |
| FR-SAFETY-009 | G7 | R12 | — | NEW |
| FR-SAFETY-010 | G15 | — | — | NEW |
| FR-SAFETY-011 | G9 | R4 | 1.3.2 | NEW |
| FR-SAFETY-012 | G9 | R4 | — | NEW |
| FR-HEALTH-001 | G3 | R9 | Cat 4 W2 | NEW |
| FR-HEALTH-002 | — | R9 | Cat 4 W2 | NEW |
| FR-HEALTH-003 | G2 | R9 | Cat 4 W8 | — |
| FR-HEALTH-004 | — | R9 | Cat 4 W13 | — |
| FR-HEALTH-005 | — | R9 | Cat 4 W22 | — |
| FR-HEALTH-006 | — | R9 | Cat 4 W23 | — |
| FR-HEALTH-007 | — | — | 1.2.1 | — |
| FR-HEALTH-008 | — | — | panel pediatrician | NEW |
| FR-HEALTH-009 | — | — | §5 | NEW |
| FR-HEALTH-010 | G22 | — | — | NEW |
| FR-HEALTH-011 | G27 | — | — | NEW |
| FR-SCHOOL-001 | — | — | 1.2b.1/1.2b.2 | NEW |
| FR-SCHOOL-002 | — | — | Cat 5 | NEW |
| FR-SCHOOL-003 | G17 | — | Cat 3 | §11 (supersedes) |
| FR-SCHOOL-004 | G8 | R6 | Cat 5 | — |
| FR-SCHOOL-005 | — | R8 | Cat 5 | — |
| FR-SCHOOL-006 | — | — | Cat 5 | — |
| FR-SCHOOL-007 | G18 | — | Cat 5 | — |
| FR-SCHOOL-008 | — | — | Cat 5 | — |
| FR-SCHOOL-009 | — | — | Cat 4 W5 | — |
| FR-SCHOOL-010 | — | — | Cat 4 W4 | — |
| FR-SCHOOL-011 | — | — | Cat 4 W18 | — |
| FR-SCHOOL-012 | G20 | — | — | NEW |
| FR-SCHOOL-013 | G21 | — | — | NEW |
| FR-SCHOOL-014 | — | — | §5 | NEW |
| FR-SCHOOL-015 | G28 | — | — | NEW |
| FR-SCHOOL-016 | — | — | Cat 5 | NEW |
| FR-SCHOOL-017 | G27 | — | Cat 5 | — |
| FR-SCHOOL-018 | G19 | — | — | NEW |
| FR-SCHOOL-019 | — | — | Cat 5 | NEW |
| FR-MOD-W2..W31 | G13, G14, G23, G24 | R5, R9, R10 | Cat 4 | — |
| FR-MOD-X01 | G26 | — | — | NEW |
| FR-MOD-X02 | G14 | — | — | NEW |
| FR-MOD-X03 | G23 | — | — | NEW |
| FR-MOD-X04 | G24 | — | — | NEW |
| FR-MENU-001..005 | — | — | — | Mehedi 2026-10-12 |
| FR-AI-001 | G2, G10 | — | Cat 2 | — |
| FR-AI-002 | — | R7 | Cat 2 | — |
| FR-AI-003 | — | — | Cat 2 | — |
| FR-AI-004 | — | — | Cat 2 | — |
| FR-AI-005 | G10 | — | — | NEW |
| FR-TRAVEL-001 | G13 | — | Cat 4 W30 | NEW |

### Full NFR → source map

| NFR | Source |
|---|---|
| NFR-PERF-001/002 | AGENTS.md post-deploy smoke test lesson |
| NFR-SEC-001..004 | Mehedi test protocol |
| NFR-SEC-005 | 1.2.2 |
| NFR-SEC-006 | Cat 7 |
| NFR-SEC-007/008 | Cat 8 |
| NFR-PRIVACY-001 | G6, Cat 7 🛑 |
| NFR-PRIVACY-002 | Cat 7 🛑 |
| NFR-PRIVACY-003 | 1.1.4 |
| NFR-PRIVACY-004 | 1.3.3 |
| NFR-PRIVACY-005 | Cat 1 |
| NFR-PRIVACY-006 | 1.2.3 |
| NFR-PRIVACY-007 | 1.2.1 |
| NFR-PRIVACY-008 | Cat 2 |
| NFR-PRIVACY-009 | Cat 4 W21/W7 |
| NFR-A11Y-001 | Mehedi test protocol |
| NFR-A11Y-002 | 1.2.1 |
| NFR-RELIABILITY-001 | AGENTS.md, commit 538f288 |
| NFR-RELIABILITY-002 | AGENTS.md, de9ed74 |
| NFR-RELIABILITY-003 | AGENTS.md 2026-10-07 |
| NFR-RELIABILITY-004 | AGENTS.md 2026-10-09 |
| NFR-RELIABILITY-005 | AGENTS.md code cleanliness rule |
| NFR-RELIABILITY-006 | Cat 5 |
| NFR-COMPLIANCE-001..009 | §5 Georgia compliance summary |
| NFR-LEGAL-001..010 | §5 sign-off gates |

### Reassessment coverage

| Item | Status in this spec |
|---|---|
| R1 cooling-off keep/modify/kill | Accepted panel redesign (FR-AGE-002); 6-month live-data review trigger recorded |
| R2 age-16 cliff | Tension acknowledged; outcomes measured by age band |
| R3 18+ grades continuity | Accepted with FERPA amendment (FR-AGE-005); counsel sign-off gated (NFR-LEGAL-003) |
| R4 child-decides vs court orders | Court-order workflow built (FR-SAFETY-011/012); no auto-enforce until counsel signs off |
| R5 co-parenting scope | Launch read-only/logistics-only (FR-MOD-W14) |
| R6 peer tips kill vs fix | Fix path specified (FR-SCHOOL-004) |
| R7 Muse unfiltered adults | Blocked <18 (FR-AI-002); branding reassessed pre-marketing |
| R8 AI quizzes build/buy/cut | Fail-closed pipeline + pilot (FR-SCHOOL-005) |
| R9 health modules in day-one shell | Gated behind tiers + protocols (FR-HEALTH-001, R9) |
| R10 geographic expansion | Per-state review trigger (NFR-LEGAL-009) |
| R11 district partnership | Flagged; full re-review before any conversation |
| R12 mandatory-reporter designation | Hooks built (FR-SAFETY-009); re-run at first content read |

---

## 4. OUT OF SCOPE / EXPLICITLY REMOVED

| Item | Decision | Rationale |
|---|---|---|
| **W10 Fairness** | Removed 2026-10-12 (Mehedi) | Panel blocked as parent-facing scoreboard: sibling-comparison fuel, triangulating in divorce (welfare, psychologist, math). Redesign as private parent reflection is deferred, not scheduled. |
| **W17 Friends** | Removed 2026-10-12 (Mehedi) | Unbuilt seedling (one-line concept, zero implementation). Panel required teen-entered journaling only + no messaging + absolute teenPrivate; cheapest to cut — nothing to unwind. |
| "Unfiltered" AI for <18 | Never ships | FR-AI-002. |
| 3-bureau credit monitoring | Never ships as designed | Re-scoped to freeze management (FR-MOD-W24). |
| Parent-facing check-in cross-check | Never ships as designed | Redesigned as teen calibration (FR-SCHOOL-003). |
| AI-ghostwritten teacher emails | Never ships | Parent-authored + AI proofread only (FR-AI-004). |
| Indefinite data retention | Banned | Written per-source schedule required (NFR-PRIVACY-001/002). |

---

## 5. BUILD ORDER (recommended)

1. **Legal gates first:** NFR-LEGAL-007 (COPPA package), NFR-LEGAL-001 (ToS) — unblock everything downstream.
2. **Data layer:** migrations 015–021 (invites, profiles, access authority, link codes, access requests, access_events); RLS on every table (NFR-SEC-001).
3. **Privacy taxonomy:** H0–H3 (FR-HEALTH-001) + retention schedule (NFR-PRIVACY-002).
4. **Access model:** onboarding (FR-AUTH-002), linking (FR-ACCESS-001/002/003), grant/revoke matrix (FR-ACCESS-004/005), scopes (FR-ACCESS-006), audit (FR-ACCESS-009).
5. **Safety spine:** trusted adult (FR-SAFETY-001), crisis protocol (FR-SAFETY-002), safe-exit (FR-SAFETY-004), safety carve-out (FR-SAFETY-003), cooling-off redesign (FR-AGE-002).
6. **Age tiers:** under-13 guarantees (FR-AGE-001), 18+ flows (FR-AGE-005/006/007/008).
7. **School rebuild:** provenance (FR-SCHOOL-001), inbox segregation (FR-SCHOOL-002), check-in redesign (FR-SCHOOL-003), forecast engine (FR-SCHOOL-007).
8. **AI guardrails:** FR-AI-001 through FR-AI-005.
9. **Menu:** FR-MENU-001 through FR-MENU-005 (popup bottom-sheet, 6 categories).
10. **Modules:** per FR-MODULES marks — 🛑 modules last, each with its stated fix.
11. **Travel:** FR-TRAVEL-001 + FR-MOD-W27/W29/W30/W31 with vetting/rules engines.
12. **Verification:** full Mehedi test protocol (functional, non-functional, red team, SAST/DAST, chaos, load) + post-deploy smoke gate (NFR-RELIABILITY-002).

---

*End of Build Specification v1.0. Panel synthesis: "This document is issue-spotting analysis, not legal advice."*
*Every NFR-LEGAL gate needs a licensed attorney before the associated work ships.*
