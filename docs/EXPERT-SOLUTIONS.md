# Pookie Expert-Panel Solutions — Concrete Build Designs

**Solution-architecture synthesis · 2026-10-12 · Mehedi-locked scope**
**Input:** `ACCESS-MODEL-REVIEW-CHECKLIST.md` (18-expert panel: 28 gaps, 12 reassessments, ✅/⚠️/🛑 marks) · `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked) · `FEATURE-LIST-FOR-PANEL.md`
**Detailed designs:** `docs/solutions/sol-safety.md` · `sol-health.md` · `sol-access.md` · `sol-school-ai.md` · `sol-legal.md` · `sol-ux.md` · `sol-support.md`
**Status:** DESIGN ONLY — no code, no deploys. Legal sections are NOT legal advice; every gate requires licensed attorney.

**How to read:** For each panel gap (G1–G28), reassessment (R1–R12), and ⚠️/🛑 item: the panel's recommendation → the concrete solution. File pointers (e.g. `sol-safety §3`) lead to full schemas, RPC signatures, and copy. Migration numbers below are the CONSOLIDATED sequence (designers' draft numbers collided; §G is canonical).

**Amendments to the locked spec required before build (Mehedi decision needed):**
- **A1.** Spec §4/§6 cooling-off: panel 🛑 replaces "notify both parents immediately" with teen-chosen notify-now/at-effect (default at-effect, only revoked parent) + safe-exit path. ([C1](#f-conflict-register))
- **A2.** Spec §4 18+ continuity: panel 🛑 splits it — school/grades data continues, HEALTH resets to private pending affirmative opt-in re-consent. ([C2](#f-conflict-register))
- **A3.** W10 Fairness and W17 Friends REMOVED by Mehedi 2026-10-12 — panel items on them are closed by removal (noted per item).
- **A4.** Menu is now 7 categories (Health, Home, School, Safety, Travel, Marketplace, **Support**); 28 modules + S1/S2/S3.

---

## A. Gap solutions (G1–G28)

### G1 — Crisis tripwire vs revoke contradiction (CRITICAL)
**Panel:** Trusted-adult designation REQUIRED before any revoke/go-independent executes; crisis alerts route to trusted adult; teen checks "I understand no adult will be alerted" if they decline.
**Solution (`sol-safety §1`):** New `trusted_adults` table (mig 024): teen-nominated, role-tagged (`crisis_alert`/`revoke_guardian`/`outing_contact`), contact encrypted at rest, verification via 6-digit link-code (15-min, 5-attempt lockout) / parent-vouched / same-room with anti-coercion check. RLS: teen-only visibility (even a parent who IS a trusted adult sees only their own row). Crisis routing tiers: T1 imminent-risk → trusted adult SMS immediate + 988 card + DFCS-evaluation hook; T2 ideation → trusted adult SMS within 5 min; T3 patterns → teen-side nudge only, never leaves the account. Alerts are presence-only ("may be in crisis") — never mood text/chat excerpts. `rpc_revoke_grant` REFUSES to execute for 13–17 revoke/go-independent unless ≥1 verified `revoke_guardian` adult exists OR a valid informed-decline event exists. Decline path: explicit checkbox "I understand no adult will be alerted," recorded as audit event, revoke may proceed. Retires the Guidance Framework's parent-tripwire language.

### G2 — No crisis/safety protocol (CRITICAL, launch-blocking for Wellbeing)
**Panel:** Build now: 988/CTL surfacing, teen-controlled "tell a trusted adult," documented self-harm AI protocol, explicit "private spaces are not safety-monitored" copy.
**Solution (`sol-safety §2`):** Single escalation ladder L0–L4 (+ ED-adjacent) across mood pulse, check-ins, AI chat. L1/L2 entirely teen-side (never parent-visible, incl. aggregates). L3/L4 route to trusted adult per G1. 988/CTL surfacing rules: persistent crisis card (L3/L4), inline resource block in AI chat, check-in footer, always-available Settings → Safety. AI self-harm protocol (CA SB 1119 shape): server-side safety middleware (never prompt-only), T2 → empathy + resources + offer; T1 → + 911 nudge + grounding + transparent alert notice; never "just between us" (G10), never therapist role-play, never auto-parent-notify absent imminent risk. Mandatory "private spaces are not safety-monitored" copy at first use of Wellbeing/check-ins/AI chat.

### G3 — "Teen health privacy tiers" don't exist (CRITICAL)
**Panel:** Define and build H0/H1/H2/H3 before W2 holds real teen data.
**Solution (`sol-health §1`):** Normative taxonomy — **H0** prohibited for minors (refused at UI + API with `h0_minor_refusal`; e.g. genetic tests, fertility planning); **H1** shareable wellness (steps, sleep, immunizations — family-visible per Wellness scope); **H2** teen-private (weight, meds, menstrual data, mood journals — teen-only 13+, parent path only via explicit teen grant or ≤30d teen-notified safety override); **H3** legally sensitive (STI/contraception/SUD/mental-health/pregnancy — teen-only, NO override path: no grants, no aggregates, no break-glass, no exceptions). Enforced via `health_tier` enum + `health_tier_visible()` RLS predicate (mig 023). W2 unblock checklist: 023 applied + RLS test matrix green.

### G4 — 7-day cooling-off notification endangers abuse-exit (CRITICAL)
**Panel:** Teen chooses notify-now vs notify-at-effect (default at effect, only revoked parent); safe-exit path; parent UI unchanged during pending; no new parent-visible syncs in window; DV-advocate review.
**Solution (`sol-safety §3`):** Full 6-step flow (see [Flow F1](#f1-cooling-off--safe-exit-13–15-revoke)). Non-negotiables: default notify-at-effect to revoked parent ONLY; safe-exit checkbox ("Telling my parents about this could put me at risk") → immediate cutoff + suppressed notification + crisis resources; parent UI literally unchanged during pending (frozen timestamps read as normal staleness); `parent_sync_frozen_until` flag stops new parent-visible syncs; safe exits visually boring; `pending_revokes` table (mig 026); cron `revoke-effect-runner`; DV-advocate review gate before launch.

### G5 — 18+ health continuity inverts consent (CRITICAL)
**Panel:** Affirmative opt-in re-consent for health; skip = private.
**Solution (`sol-health §2`):** Midnight cutover job on 18th birthday: all parent health visibility → private immediately. First login ≥18 shows the health review screen: per-tier toggles defaulting OFF (H2/H3), review–correct–seal of parent-entered data, transition-summary export, emergency-contact re-designation decoupled from access grants. RPCs: `rpc_health_reconsent_submit/_skip/_review_queue`, `rpc_export_transition_summary` (mig 031).

### G6 — No COPPA 2025 package (CRITICAL, enforceable now)
**Panel:** Publish per-source retention schedule; written infosec program; vendor assurances; ban indefinite retention.
**Solution (`sol-legal §1`):** Three outlines: (a) retention-policy structure — per-source rows (source, data class, period, deletion method, backup handling ≤30d); (b) infosec program — administrative/technical/physical safeguard sections; (c) vendor assessment template (Supabase, Cloudflare, OCR/AI: data-processing terms, no-training-on-inputs, breach-notification SLA). Hard rule encoded: 312.10 bans indefinite retention for under-13 — the policy has no "indefinite" value. Attorney gate before any real-data persistence.

### G7 — Mandatory-reporter gray zone
**Panel:** Designate compliance owner; DFCS path 1-855-422-4453; re-run at first human/AI read of check-ins.
**Solution (`sol-legal §3`):** Program outline: designation decision framework (founder-level business call — attaching the duty changes staffing/ops), training structure, escalation SLA, documentation, re-run trigger. Until designated: NO human reads check-in content; AI reads are safety-middleware-only (no content retention for review).

### G8 — Peer tips cross-family identifiable (HIGH)
**Panel:** Provable de-identification/aggregation or per-family consent.
**Solution (`sol-school-ai §3`):** "Study Sparks" redesign: k≥5 aggregation de-identification with provability audit, study-skills-only fencing (fail-closed topic classifier), provenance labels on every tip, contested-topic human review queue, 5%/week sampling QA, 4-week expiry kept. "Peer" label retired (fabricated social proof).

### G9 — No custody-order mechanism (HIGH)
**Panel:** `court_order_restriction` flag + human-review upload queue; matrix adjusted per verified order; teen told plainly why.
**Solution (`sol-access §9`):** Flag schema (mig 030); upload → `pending_review` → `verified`/`rejected` → `expired`; `auto_enforce=false` until counsel signs off (R4); `revoke_access`/`grant_access` consult the flag; teen-facing plain-language explanation copy contract. Human admin applies; self-serve can never enter/leave `suspended_court` status.

### G10 — AI disclosure policy for abuse disclosures (HIGH)
**Panel:** Written policy: what AI says/doesn't promise, crisis-line handoff, teen-readable.
**Solution (`sol-school-ai §16`):** Policy structure + in-chat disclosure copy: "Pookie will listen and help you find support… won't promise to keep it secret — and won't tell your parents automatically. If you're in immediate danger, Pookie will try to get help to you fast." Never "just between us."

### G11 — Missing emancipated-minor handling (HIGH)
**Panel:** `legal_status` field; emancipated → adult track at any age.
**Solution (`sol-access §10`):** Enum `minor / emancipated / adult` on profiles/children; every age-tier check consults it (emancipated short-circuits to adult track); GA §§ 15-11-720–727 standards referenced for the attorney to confirm.

### G12 — No DOB gate for direct teen self-signup (HIGH)
**Panel:** Teen protections can't attach without age; add before teen onboarding.
**Solution (`sol-access §10`):** DOB collected at signup before any teen path; unknown DOB fails closed into the most restrictive band (treated as 13–15 for tier purposes until verified).

### G13 — Purchasing/contracting authority unaddressed (HIGH)
**Panel:** New carve-out: visibility ≠ transactional authority; 18+ purchaser-of-record invariant.
**Solution (`sol-access §12`):** Principle documented + enforced: booking RPCs (`create_booking`, `rental_car_book`) hard-require purchaser age ≥18 server-side; minor-traveler rules engine (UM bands/fees per airline, passport/TSA checks) as a rules table; itinerary = dedicated Sharing toggle; teen travel-purchase alerts to parents; W31 hidden from teen accounts (menu + API gating, not footnotes); custody travel-restriction profile tied to G9 flag.

### G14 — Location-data policy for 13–17 missing (HIGH)
**Panel:** Retention, precision (coarse default), no retained history <18, disclosed at Explorer Setup.
**Solution:** Coarse (ZIP/city) default <18; precise only per outing plan, scoped, not retained; no location history retained <18, period; travel/location is its own visibility toggle (access scopes); disclosed in Explorer Setup (safety §5) and FAQ.

### G15 — No trusted-adult infrastructure (HIGH)
**Panel:** Persistent teen-nominated list, teen-controlled visibility, product home for safety prompts.
**Solution (`sol-safety §1, §4`):** The `trusted_adults` table IS the infrastructure (shared with G1 — one role-tagged list, not parallel systems). Cap 5 active; yearly re-verification nudge; Settings → Safety is the management home; surfaces: revoke flows, crisis routing, "share my plan," Wellbeing action, W19 break-glass card, 18+ emergency-contact re-designation.

### G16 — W14/W10 surveillance creep (HIGH)
**Panel:** Parallel-parenting mode; fairness as private parent reflection only.
**Solution:** W14 Co-parenting → parallel-parenting mode design (separate surfaces, no shared messaging to screenshot, immutable uneditable log, no child-as-courier, custody-order awareness) — full design deferred to the co-parenting workstream; flagged as launch read-only/logistics-only until family-law practitioner review. W10 Fairness: **REMOVED by Mehedi** — closed.

### G17 — Indefinite check-in retention (HIGH)
**Panel:** Teen-deletable + rolling auto-purge; never indefinite for minor-generated content.
**Solution (`sol-school-ai §6`):** Teen-deletable; 90-day rolling default auto-purge (open question: 90 vs 30 for under-16 — Mehedi decision); nightly purge job; never indefinite.

### G18 — Deterministic grade-forecast engine unspecified (MEDIUM)
**Panel:** Versioned, unit-tested, input-cited engine.
**Solution (`sol-school-ai §1`):** Pure deterministic function; every input cited to the user with source + timestamp; versioned (model card per version); parent viewers read-only on teen's checkboxes (RLS); unit-test suite required.

### G19 — Curated formula/definition bank missing (MEDIUM)
**Panel:** Single grounding source for quizzes, tips, tutor math, SAT formulas.
**Solution (`sol-school-ai §8`):** `formula_bank` table: statement, subject, verification status, two-expert sign-off, version; THE grounding source for quiz generation, Study Sparks, tutor math, SAT prep. Open question: build vs buy the verifier.

### G20 — 504/IEP accommodation tracking absent (MEDIUM)
**Panel:** #1 parent-counselor friction point in GA schools.
**Solution (`sol-school-ai §11`):** Store plan (document ref), track delivery per accommodation, log review dates, counselor-handoff prompts.

### G21 — Four-year graduation audit, GA 23 credits (MEDIUM)
**Panel:** More urgent than simulator polish.
**Solution (`sol-school-ai §11`):** Audit logic against GA 23-credit requirements; course-history mapping; "what's missing" plain-language output.

### G22 — Immunization management, GA Form 3231 (MEDIUM)
**Panel:** College reqs, HPV catch-up, transfer for college.
**Solution (`sol-health §9`):** `immunizations` table (CVX codes, 3231 tracking), `college_immunization_reqs`, reminder scheduling; tiered H1 (parents need it for school forms <18).

### G23 — "Share my plan" teen outing-sharing (MEDIUM)
**Panel:** Voluntary, teen-controlled, check-in timers, overdue nudges to teen-chosen contact.
**Solution (`sol-safety §5.4`):** First-class step in Out & About: teen composes plan (destination, companions, times, transport), picks recipient (default outing_contact trusted adult), sets check-in timer; miss → nudge teen → +15min → notify recipient with plan card; overdue nudges NEVER auto-to-parents; offline-cached plan card; `outing_plans` table (mig 039); teen-deletable; no location history <18.

### G24 — Voter pre-registration, GA 17.5 (MEDIUM)
**Panel:** Belongs in Growing Up independence checklist.
**Solution:** Note: Growing Up grove dissolved in the 7-category menu (Driving School → Marketplace, Screen Time → Safety). Voter pre-registration belongs in the independence checklist surface (go-independent flow / 18+ transition). Flagged for the independence workstream; informational content only, no data collection.

### G25 — W19 is storage, not a plan (MEDIUM)
**Panel:** Lock-screen/QR reachability, action-plan templates, break-glass category.
**Solution (`sol-safety §6`):** Break-glass medical QR (24h, single-viewer, audit-logged, works regardless of parent access); lock-screen wallet card (teen controls fields); teen-fillable action-plan templates (allergy, asthma, seizure — informational scaffolding, no diagnostic language); lab emergency quick-card per science class.

### G26 — No sibling/household leakage analysis (MEDIUM)
**Panel:** Per-child access boundaries verified end-to-end.
**Solution (`sol-access §11`):** Invariant list (every query filters by child_id; revoke on child 1 never affects child 2 surfaces; digests/search/household views child-scoped); QA test-plan outline for the test team to execute.

### G27 — "Power-up" daily pull undefined (MEDIUM)
**Panel:** Define or cut.
**Solution (`sol-health §11`):** **CUT.** Supplement-adjacent health-claim liability; the need is already served by the Morning Ritual. Removed from scope.

### G28 — School-issued account privacy (MEDIUM)
**Panel:** Don't imply privacy the school doesn't grant (Cobb Office 365 is monitored).
**Solution (`sol-school-ai §17`):** Firewall disclosure copy contract — shown wherever school-synced comms appear: plain language that school-provided accounts are school-visible.

---

## B. Reassessment positions (R1–R12)

| # | Reassessment | Panel position → Solution stance |
|---|---|---|
| R1 | 13–15 cooling-off: keep/modify/kill | 6-month live-data review (revoke counts, safe-exit clustering, cancellation rate, retaliation reports). **Design anticipates the flip:** if safe-exit usage clusters, default becomes instant-with-delayed-notification. (`sol-safety App. C`) |
| R2 | 16 as instant-revoke cliff | No developmental basis for the cliff — acknowledged in-spec; safety properties don't depend on it. Measure outcomes by age band. |
| R3 | 18+ continuity default for grades | Kept for school/grades (FERPA-compliant for stored data); **health split off** to opt-in per G5. Counsel sign-off on consent design before build. |
| R4 | "Child decides" vs court orders | Ingest now, `auto_enforce=false` until counsel signs off. First court order received triggers the workflow. |
| R5 | W14 Co-parenting scope | Launch read-only/logistics-only; expand only after family-law practitioner review. Parallel-parenting mode is the target design. |
| R6 | Peer tips: kill vs fix | Fix path designed ("Study Sparks"); reassess only after provenance labels + QA sampling + study-skills fencing exist. |
| R7 | Muse "unfiltered" for adults | 18+ gate + rename "direct mode"; IDENTICAL safety rules across modes; reassess branding before marketing. |
| R8 | AI quizzes: build vs buy vs cut | Build the fail-closed pipeline; pilot in 1–2 classes with zero-wrong-keys bar; never A/B test ungrounded quizzes on students. |
| R9 | Health data in day-one shell | **Gate health modules behind tier + protocol completion.** W2/W8/W23 ship as seedlings until H0–H3 + crisis protocol + counsel gates clear. |
| R10 | Geographic expansion beyond GA | Any non-GA launch triggers a state-law review workstream (WA MHMDA, TX SCOPE, CA AB 2246/SB 1119, IL BIPA, AL 2027). Per-state minor-consent text. |
| R11 | District/school partnership | Flagged: inverts the access model (school becomes data authority with FERPA duties). Full re-review before any partnership conversation. |
| R12 | Mandatory-reporter designation | Re-run analysis the moment any human (or non-safety AI read) touches check-in content. Founder-level business decision. |

---

## C. Checklist-item solutions (⚠️/🛑)

### Access-model processes
| Item | Mark | Solution |
|---|---|---|
| 1.1.2 Onboarding | ⚠️ | Guardian attestation checkbox + DOB gate + school-transparency disclosure at "add children" (`sol-legal §2`, `sol-ux §5`, `sol-access §10`) |
| 1.1.4 Under-13 stewardship | ⚠️ | Server-side technical bans (auth hooks, RLS, API middleware, UI gates) — not policy (`sol-legal §2`); `legal_status` field |
| 1.2.1 Email invite + consent | ⚠️ | Per-domain unbundled checkboxes (unchecked default, ≤8th-grade), health subcategories enumerated, 90-day no-reprompt after decline (`sol-ux §1`) |
| 1.2.2 Link codes | ⚠️ | bcrypt-hashed codes, brute-force lockout, two-phase anti-coercion ("Did you choose this or were you told to?"), same-device audit flag (`sol-access §5`, `sol-ux §8`) |
| 1.2.3 Claim dedupe | ⚠️ | Post-verification-only trigger; fuzzy name+birthdate with weights/thresholds; manual-review queue for near-misses; never auto-merge health (`sol-access §6`) |
| 1.2b.1/.2 Provenance | ⚠️/✅ | `provenance` column (`school_record`/`app_generated`/`safety_comms`); enforcement points in read paths (`sol-access §4`) |
| 1.2b.3 Safety comms | ⚠️ | Separate non-revocable channel; non-toggleable Sharing row; `revoke_access` never touches it (`sol-access §4`) |
| 1.3.2 Revoke matrix | ⚠️ | Teen revokes any grant (grandparent-deadlock fix); parents revoke own grants only; court-order row via human review (`sol-access §1`) |
| 1.3.3 Visibility scopes | ⚠️ | `access_scopes` per-person × per-scope (Performance/Communications/Reflection/Wellness + H-tiers + location toggle); `resolve_visible_scopes()` single choke point; defaults Performance+Communications ON, Reflection+Wellness teen-private (`sol-access §2`) |
| 1.3.4 Access requests | ⚠️ | Fact-only other-parent notice; under-16 non-parent grants need parent co-approval (creation-only; resulting grant is child-authority); 30-day re-request lockout (`sol-access §7`) |
| 1.3.5 Block list | ⚠️ | Household-aware 30-day re-invite ban; block ≠ safety-comms revoke; court-order override path (`sol-access §8`) |
| 1.3.6 Audit trail | ⚠️ | Append-only `access_events` (mig 021); teen-visible; never shown to revoked parent (`sol-access §3`) |
| 1.4.1 Cooling-off | 🛑 | Redesigned — see [F1](#f1-cooling-off--safe-exit-13–15-revoke) |
| 1.4.2 Confirmation copy | ⚠️ | Per-scope consequences + school-transparency + alternatives (narrow/pause/talk) (`sol-ux §6`) |
| 1.5.1 Graduation framing | ⚠️ | Split: gaining independence = Nebula-Celebrate; removing parent = Nebula-Boring neutral (`sol-ux §3`) |
| 1.5.2 Data-source handoff | ⚠️ | Applies to 13–17 too; revoked parent's credentials never keep syncing; guided reconnect (`sol-safety §3`, `sol-access §1`) |
| 1.5.3 Trusted adult | ⚠️ | Required gate — see [F2](#f2-trusted-adult-designation) |
| 1.5.4 Out & About gate | 🛑 | Explorer Setup (trusted-adult + 3-min Safety Basics + family-aware defaults <16) (`sol-safety §5`) |
| 1.6.1 18+ FERPA | ⚠️ | Transfer at 18 OR postsecondary enrollment (whichever first); credential pulls pause until re-auth; unavoidable decision (`sol-legal §7`) |
| 1.6.2 18+ health | 🛑 | Affirmative opt-in; skip = private — see [F5](#f5-18-health-re-consent) |
| 1.6.3 Historical health | ⚠️ | 30-day grace → auto-restrict; "hide past too"; ≤30-day deletion (`sol-health §3`) |
| 1.6.4 Quiet exit | ⚠️ | "Make private quietly": immediate revoke, delayed neutral notification, boring UI (`sol-ux §4`) |

### Features by category (condensed — full designs in files)
| Feature | Mark | Solution |
|---|---|---|
| Muse toggle | 🛑 | 18+ server-side gate; rename "direct mode"; identical safety layer (`sol-school-ai §13`) |
| Teacher threads (AI-ghostwritten) | 🛑 | Parent-authored + AI proofreading/tone-check only (`sol-school-ai §15`) |
| Check-in cross-check | 🛑 | Teen-facing calibration only; parent-blocked at query layer (`sol-school-ai §5`) |
| AI quizzes | 🛑 | Fail-closed pipeline; flashcards-only until then (`sol-school-ai §2`) |
| Peer tips | 🛑 | "Study Sparks" + k≥5 de-identification + QA gates (`sol-school-ai §3`) |
| W23 Nutrition <18 | 🛑 | Age-gated; weight-neutral; NEDA; clinician gate (`sol-health §6`) |
| W24 Credit | 🛑 | Re-scope to minor security-freeze management (O.C.G.A. §§ 10-1-914/914.1) + licensed-partner coaching (`sol-legal §11`) |
| W14 Co-parenting | 🛑 | Parallel-parenting mode; launch read-only/logistics-only |
| W10 Fairness | 🛑 | **REMOVED by Mehedi** — closed |
| W27 Events | 🛑 | Published curation policy; host_type CHECK constraint; age filtering server-side (`sol-safety §9`) |
| W29 Trails | 🛑 | No solo <16; official sources; dusk guard (`sol-safety §8`) |
| W30/W31 teen booking | 🛑 | 18+ purchaser invariant; W31 hidden from teens (`sol-access §12`) |
| W6 Driving | 🛑 | GA DDS rules encoded (learner's 15, Joshua's Law 30-hr, Class D 16 restrictions, Class C 18) + digital driving log — now in Marketplace as Driving School |
| W2 Health | 🛑 | Blocked until H0–H3 live (`sol-health §4`) |
| W17 Friends | ⚠️ | **REMOVED by Mehedi** — closed |
| Teacher inbox merge | 🛑 | Counselor mail segregated (separate tables, ASCA B.2) (`sol-school-ai §4`) |
| Retention "indefinite/TBD" | 🛑 | Per-source written schedule; teen-deletable; purge jobs (`sol-legal §6`) |
| W8 Wellbeing | ⚠️ | Teen-only RLS; L1–L4 ladder; launch-blocked until crisis protocol live (`sol-health §5`, `sol-safety §2`) |
| W22 Activity | ⚠️ | No streaks/calorie-burn/leaderboards <18 (`sol-health §7`) |
| W15 Screen Time | ⚠️ | Co-set (teen proposes, parent approves) + appeal; never covert (`sol-safety §7`) |
| W5 College | ⚠️ | GSFC exact; chance-me ranges + model card; essay feedback-only (`sol-school-ai §10`) |
| W19 Emergency | ⚠️ | Storage-only + 911-first banner; break-glass QR; preloaded GA resources (`sol-safety §6`) |
| W26 Weather | ⚠️ | NWS-only; AI translates with link+timestamp; not-an-alert-system disclaimer (`sol-safety §10`) |
| W28 Restaurants | ⚠️ | Verified listings; DPH scores; allergen hard-blocks; 21+ excluded <18 (`sol-health §10`, `sol-ux §14`) |
| Nudges | ⚠️ | Teen opt-in; frequency-capped; scope-filtered; no health push (`sol-school-ai §14`) |
| /verify-invite | ⚠️ | Zero child PI pre-auth; unguessable single-use tokens; no enumeration (`sol-legal §9`) |
| Credentials vault | ⚠️ | Encrypt before any real credentials; GIPA-grade; rotation + cryptographic erasure (`sol-legal §10`) |
| API platform | ⚠️ | Every route enforces matrix + scopes server-side; scoped tokens; audit logging (`sol-access` App. C) |

---

## D. Key multi-step flows

### F1. Cooling-off + safe-exit (13–15 revoke)
1. Teen: Sharing → person row → **"Remove access"** (not "Revoke").
2. **Scope & consequences screen** — per-scope what parent loses; alternatives (narrow to Performance only / 30-day pause / talk-it-through prompts); school-transparency line: "This only changes Pookie. Your school still shares grades and official messages with your parents."
3. **Trusted-adult gate** — nominate + verify (or informed decline with checkbox "I understand no adult will be alerted"). Back allowed; nothing changed yet.
4. **Notification choice** — "When should [Parent] find out?" ○ When it takes effect (recommended, default) ○ Tell them now. "Only [Parent] is told."
5. **Safety screen** — ☐ "Telling my parents about this could put me at risk." If checked → **safe-exit**: immediate cutoff, suppressed notification, crisis resources shown. If unchecked → Step 6.
6. **Confirm (pending)** — "Takes effect [date]. Until then, nothing they see changes. Cancel anytime." `rpc_initiate_revoke` → `pending_revokes` row → `parent_sync_frozen_until` set → `access_events(revoke.initiated)`. Parent UI: literally unchanged.
7. **At effect** (cron `revoke-effect-runner`): grant deactivated, grantee API tokens revoked, notification per Step-4 choice, `access_events(revoke.effected)`. Revoked parent sees neutral "no longer shared" + (if at-effect) one neutral notification. 30-day re-request lockout.
8. **Cancel anytime** (teen): row voided, freeze lifted, no parent notification. Safe-exit undo: re-grant triggers gentle "are you sure?" anti-coercion confirm.
(`sol-safety §3`; UX `sol-ux §6, §7, §10`; RPCs `sol-access App. C`)

### F2. Trusted-adult designation
1. Trigger: revoke/go-independent/quiet-exit/18+ flows, or first crisis-surface use (informational).
2. Screen A: "You need one adult Pookie can reach in a real emergency. They do NOT get to see your Pookie — only a safety alert." [Choose an adult] / [I don't want to name one].
3. Screen B: nominate (name, relationship chips, phone/email, optional note) → send 6-digit verification code (15-min, 5-attempt lockout).
4. Screen C: pending ("We texted [name]…"); 48h unverified → nudge → swap or continue-with-acknowledgment.
5. Verification methods: SMS/email link-code (default) / parent-vouched (already-granted parent or school emergency contact) / same-room (adult confirms freely + audit flag).
6. Decline: equal-weight buttons, checkbox ack "I understand no adult will be alerted," recorded as audit event (teen-visible only). Crisis routing = in-app resources only.
(`sol-safety §1`)

### F3. Go independent (13–17) — graduation vs rupture
- **Gaining independence** (`/independence/celebrate`): Nebula-Celebrate — confetti, "your own Pookie," personal-assistant onboarding. Celebration ONLY here.
- **Removing a parent** (`/sharing/remove/{person}`): Nebula-Boring — calm, neutral, respectful; no confetti; safe exits maximally plain (an abuser's glance sees "account settings").
- Data-source handoff: revoked parent's school credentials stop syncing immediately; guided teen reconnect flow (13–17, not just 18+).
(`sol-ux §3`; `sol-safety §3`; `sol-access §1`)

### F4. Link-code redeem + anti-coercion
1. Teen enters 6-digit code (brute-force lockout after 5 attempts, cooldown).
2. **Anti-coercion check** (private screen): "Did you choose this, or were you told to?" [I chose this] / [I was told to].
3. "I chose this" → verify + link → consent screen (per-domain unbundled).
4. "I was told to" → NO link created → safe resources shown → optional trusted-adult ping → audit event (teen-visible only).
5. Same-device redemption flagged in audit log.
(`sol-access §5`; `sol-ux §8`)

### F5. 18+ health re-consent
1. Midnight cutover job on 18th birthday: ALL parent health visibility → private (no grace for health).
2. First login ≥18: health review screen — per-tier toggles (H1/H2/H3) defaulting OFF; "review–correct–seal" of parent-entered data; transition-summary export offered; emergency-contact re-designation (decoupled from grants).
3. Skip = stays private. Every toggle is affirmative opt-in.
4. Historical: 30-day grace already elapsed design → auto-restrict; "hide past too" available; deletion ≤30 days.
(`sol-health §2–§3`; RPCs `rpc_health_reconsent_submit/_skip`, `rpc_export_transition_summary`)

### F6. Claim dedupe ("Is this you?")
1. Fires ONLY after successful email verification (never standalone — enumeration defense).
2. Fuzzy match on name + birthdate (weighted fields, threshold).
3. Match → "Is this you? Link your login to your existing profile" vs "This isn't me — create new."
4. Near-miss → manual-review queue (human, SLA).
5. Merge rules: school/identity data merges with teen approval; health records NEVER auto-merge.
(`sol-access §6`)

### F7. 18th-birthday prompt (non-health)
1. First login after 18th birthday (or postsecondary enrollment, whichever first): unavoidable full-screen decision — "You're an adult now — your Pookie is fully yours. [Mom ✓] [Dad ✓] can see your info." [Keep as is] / [Review sharing]. Not a dismissible banner.
2. School/grades continuity default ON (counsel-gated); health handled by F5.
3. "Make private quietly" option: immediate revoke, delayed neutral notification ("Some things you used to see are no longer shared" — leaks zero motive), boring UI.
4. Persistent quiet line in Settings → Sharing: "You're 18+ — you're in control here."
(`sol-ux §4`; `sol-legal §7`)

---

## E. Support category (S1/S2/S3) solutions

**Modules:** S1 Help Center & FAQ · S2 AI Support Chat · S3 Support Tickets (+ agent backend). (`sol-support.md`, full)

- **S1 FAQ:** 9-section topic tree (7 menu categories + Account & Privacy + Legal & Your Rights), ~90-article launch floor covering ALL 28 modules + access model + retention + deletion. Every legally-relevant item gets a collapsed "Why does Pookie do it this way? (Legal)" accordion: plain-language (FK ≤8.0), cites the specific law, badges "Required by law" / "Our choice" / "Both" — never "for legal reasons" without saying which. Attorney-owned editorial workflow, 6-month re-reviews, law-change watchlist. 4 fully-written example Q&As in the file (COPPA, FERPA, our-choice grades, duty-of-care).
- **S2 AI chat:** pookie-tutor worker, support-scoped prompt; escalation triggers (low confidence, "talk to a human," 3 failed attempts, account-deletion/data-export requests); transcript-preserving handoff to S3 (user never retypes); wait-time estimate + ticket number issued immediately. **Crisis rule (unmissable):** crisis language FREEZES the support flow — inline 988/CTL/911 card + trusted-adult routing per safety §2; never enters ticket queue or SLA timers.
- **S3 tickets + agent RBAC:** least-privilege `support_agent` role — sees ticket metadata, contact info, relevant module context ONLY; NEVER health/school/check-in/mood by default. Break-glass: scoped 24h TTL grant with IN-APP user approval (for 13+: the TEEN approves, not the parent — child is access authority); every view audit-logged; user sees "who from support viewed your data" in Settings. Health/wellbeing/mood/check-in scopes are NEVER grantable (RPC allowlist). Internal notes visually separated; assignment rules prevent self-assignment bypass.
- **Legal:** support-data retention schedule; under-13 support via parent counterparty only; GIPA redaction rules (never log credentials/card numbers/health in tickets); AI disclosure (persistent "this is AI" label); vendor DPA must bar training on inputs. NOT legal advice — attorney gates repeated.
- **Data model (mig 044–046):** `tickets`, `ticket_messages` (internal flag), `support_agents`, `support_grants` (24h TTL), `faq_articles` (+versions, GIN/trgm/pgvector search), `faq_feedback`. SLA: P1 4h / P2 24h / P3 72h with breach escalation; "resolved" requires user confirm before "closed" (auto-close timer if silent).

---

## F. Conflict register (consolidated)

| # | Conflict | Resolution | Owner |
|---|---|---|---|
| C1 | Locked spec: notify BOTH parents immediately on 13–15 revoke vs panel 🛑 | **Panel wins:** notify-now/at-effect (default at-effect, revoked parent only) + safe-exit. **Mehedi must amend spec §4/§6.** | Mehedi decision |
| C2 | Locked spec: 18+ continuity-by-default vs panel 🛑 on health | **Split:** school/grades continue (counsel-gated); health resets to private pending opt-in. **Mehedi must amend spec §4.** | Mehedi decision |
| C3 | Under-16 non-parent grants need parent co-approval vs "no parent veto" | Co-approval gates CREATION only; resulting grant is `granted_by='child'`, parent-untouchable. Spec §3 footnote. | Access |
| C4 | Teen expects block="gone" vs block ≠ safety-comms revoke | Pre-confirm disclosure + standing audit entry. One line of UX copy. | UX |
| C5 | R4: ingest court orders now vs no auto-enforce until counsel | `auto_enforce=false`; manual admin application. | Attorney gate §5 #8 |
| C6 | "Unfiltered" branding vs scope-filtered nudges | Filtering follows scopes regardless of AI mode; unfiltered stays 18+-gated. | School-AI |
| C7 | H0–H3 undefined vs access-layer references | Access defines enforcement contract; health owns taxonomy; W2/W8/W23 gated. | Health |
| C8 | Consent screen unbundling vs scope model | Scope model is the data contract the consent screen renders. | UX × Access |
| C9 | Crisis routing vs teen privacy (core tension) | Teen-chosen trusted adult; presence-only alerts; T3 never leaves account; honest "not safety-monitored" copy. | Safety |
| C10 | Safe-exit bypasses 7-day cooling-off | Correct hierarchy: safety > developmental friction. R1 measures clustering. | Safety |
| C11 | 011 `health_safety_overrides` vs H3-absolute | Amended: overrides H2-only, ≤30d expiry, teen-notified, teen-revocable at 16–17. | Health |
| C12 | 012 calorie aggregates vs <18 ED block | Parents get engagement-only aggregates <18, server-side refusal of calorie/macro. | Health |
| C13 | Support break-glass counterparty (parent ticket about teen's grades) | Approval goes to the TEEN (13+), not the parent — child is access authority. Surprising to parents; disclosed in ticket UI. | Support × Access |
| C14 | Retention vs litigation hold | Holds suspend only in-scope purges, time-bounded; never become indefinite retention (312.10). | Legal |
| C15 | Counselor mail: school-of-record inheritance vs ASCA B.2 | Counselor bodies structurally parent-unreadable (separate table, teen-granted scope); never promise the school won't disclose. Consent-screen line needs counsel sign-off. | School-AI |
| C16 | Transparency vs safe-exit boring | Transparency viewer suppressed during exits; honest timestamps kept, explanatory copy banned. DV-advocate sign-off. | UX × Safety |
| C17 | Health crisis metadata vs H3-absolute | Health emits EVENT METADATA ONLY (type/timestamp/severity) to safety pipeline; records never leave; safety responses can't widen access. | Health × Safety |

---

## G. Consolidated migration map (canonical — resolves designer collisions)

Apply in order. 015/016 exist; 017–020 as previously planned (profiles, access authority, link codes, access requests).

| Mig | Contents | Source |
|---|---|---|
| 021 | `access_events` append-only audit trail | access §3 |
| 022 | Visibility scopes: `access_scopes`, `resolve_visible_scopes()` choke point | access §2 |
| 023 | Health tiers: `health_tier` enum, tier columns, `health_tier_visible()`, `health_consent_grants`, `allergy_list`; amend unapplied 011/012 | health §1 |
| 024 | `trusted_adults` (role-tagged, encrypted contact, teen-only RLS) | safety §1/§4 |
| 025 | Link-code hardening amendments (019 base): bcrypt, lockout, anti-coercion | access §5 |
| 026 | `pending_revokes` + `parent_sync_frozen_until`; revoke cron | safety §3 |
| 027 | Provenance tagging (`provenance` col) + safety-comms channel | access §4 |
| 028 | Claim-dedupe support tables + match config | access §6 |
| 029 | Block list tables + household logic | access §8 |
| 030 | Court-order queue + `court_order_restriction` flag | access §9 |
| 031 | `access_requests` amendments (020 base): co-approval, lockout | access §7 |
| 032 | 18+ health re-consent: status, cutover job, corrections, export | health §2 |
| 033 | Health grace/deletion: `health_grace`, tombstones, purge jobs | health §3 |
| 034 | Wellbeing: `wellbeing_entries` (teen-only RLS), `wellbeing_events` (metadata) | health §5 |
| 035 | Immunizations: CVX, 3231 tracking, college reqs | health §9 |
| 036 | Nutrition age-gate amendments (012) + `meal_checkins` + `clinician_gates` | health §6 |
| 037 | SUD separation: `sud_records` (separate key), disclosure consents | health §8 |
| 038 | Crisis tables: `crisis_rulesets`, `crisis_events`, `crisis_alerts` | safety §2 |
| 039 | `outing_plans` + check-in timers | safety §5 |
| 040 | `emergency_resources` seed + `emergency_medical` + break-glass audit | safety §6 |
| 041 | `trails` + `trail_safety_guidance` | safety §8 |
| 042 | `events` + `event_reports` (+ CHECK constraints) | safety §9 |
| 043 | Travel invariants: purchaser rules, minor-traveler engine, custody profile | access §12 |
| 044 | Support: `tickets`, `ticket_messages`, `support_agents` | support §D |
| 045 | Support: `faq_articles` (+versions), `faq_feedback`, search indexes | support §D |
| 046 | Support: `support_grants` (24h TTL) + scope allowlist | support §D |

---

## H. Solutions → requirements map

For the requirements engineer (`BUILD-SPECIFICATION.md`). FR domains per the requirements brief:

| Solution area | FR domains | Key requirement anchors |
|---|---|---|
| Trusted adult + crisis protocol (safety §1–§2) | FR-SAFETY, FR-AGE | G1/G2 closed; Wellbeing launch-blocked until live |
| Cooling-off + safe-exit (safety §3) | FR-SAFETY, FR-ACCESS, FR-AGE | 1.4.1 🛑 → redesigned; DV-advocate gate |
| Explorer Setup + Out & About gates (safety §5) | FR-SAFETY, FR-MODULES | 1.5.4 🛑 → gated; R2 measurement |
| Emergency module (safety §6) | FR-MODULES (Safety) | Break-glass; 911-first; GA resource seed |
| Trails/Events/Weather (safety §8–§10) | FR-MODULES (Travel) | W27/W29 🛑 → gated; NWS-only |
| Screen Time (safety §7) | FR-MODULES (Safety) | Co-set; never covert; no <13 agents |
| H0–H3 taxonomy (health §1) | FR-HEALTH | G3 closed; W2/W8/W23 gated on it |
| 18+ health re-consent (health §2–§3) | FR-HEALTH, FR-AGE | 1.6.2 🛑 → opt-in; skip = private |
| Nutrition/activity/meals age-gates (health §6–§7) | FR-HEALTH, FR-MODULES | W23 🛑 → gated; weight-neutral |
| Immunizations, allergies, SUD (health §8–§10) | FR-HEALTH | 3231; hard-blocks; Part 2 separation |
| granted_by + revoke matrix (access §1) | FR-ACCESS | Grandparent-deadlock fix; court-order row |
| Visibility scopes (access §2) | FR-ACCESS | Per-person × per-scope; server-side choke point |
| Audit trail (access §3) | FR-ACCESS | Append-only; teen-visible; revoked-parent blind |
| Provenance + safety channel (access §4) | FR-ACCESS, FR-SCHOOL | School-record vs app-generated; non-revocable safety |
| Link codes + dedupe + requests + block (access §5–§8) | FR-ACCESS, FR-AUTH | Anti-coercion; enumeration defense; 30-day lockouts |
| Court orders + legal_status + DOB (access §9–§10) | FR-ACCESS, FR-AUTH | Human review; emancipated track; fail-closed DOB |
| Sibling leakage + travel invariants (access §11–§12) | FR-ACCESS, FR-TRAVEL | Test plan; 18+ purchaser invariant |
| Forecast engine, quizzes, Study Sparks (school-ai §1–§3) | FR-SCHOOL | G18/G8; fail-closed; flashcards-until-verified |
| Inbox segregation, calibration, retention (school-ai §4–§7) | FR-SCHOOL | Counselor split; parent-blocked queries; purge |
| SAT, 504/IEP, grad audit (school-ai §8, §11) | FR-SCHOOL | Formula bank; 23-credit audit |
| AI governance, Muse gate, nudges (school-ai §12–§14) | FR-AI | 18+ gate; identical safety layer; scope-filtered |
| Teacher threads, disclosure, firewall (school-ai §15–§17) | FR-AI, FR-SCHOOL | Parent-authored; G10 copy; G28 |
| COPPA package, under-13 bans (legal §1–§2) | NFR-PRIVACY | Retention/infosec/vendor; technical guarantees |
| Mandatory reporter, ToS, LE policy (legal §3–§5) | NFR-COMPLIANCE | Founder decision; counsel-drafted |
| Retention/hold, FERPA 18+, court ingestion (legal §6–§8) | NFR-PRIVACY, NFR-COMPLIANCE | Per-source schedule; postsecondary prong |
| Vault, W24, financial docs, Part 2, TTD (legal §10–§14) | NFR-SEC, NFR-COMPLIANCE | Encrypt-first; freeze pivot; 48h removal |
| Consent/sharing/independence UX (ux §1–§7) | FR-ACCESS, FR-AUTH | Unbundled consent; boring-safe-exits |
| Menu age-gating, crisis UI (ux §9–§15) | FR-MENU, FR-SAFETY | Gating table; 988 placement |
| Support S1/S2/S3 (support) | FR-MODULES (Support) | RBAC; crisis freeze; FAQ legal accordions |

---

## I. Open decisions for Mehedi + launch gates

**Decisions needed:**
1. **Amend locked spec §4/§6** (C1/C2): cooling-off notification redesign + 18+ health opt-in split. Panel 🛑 requires it; spec currently says otherwise.
2. **Check-in retention default for under-16:** 90-day vs 30-day rolling purge (school-ai).
3. **Horoscope:** quarantine as opt-in entertainment vs outright drop (school-ai).
4. **Formula-bank verifier:** build vs buy (school-ai).
5. **Portal ToS/CFAA memo:** timing for engaging counsel (school-ai).
6. **"Power-up":** health designer recommends CUT — confirm.
7. **Voter pre-registration (G24):** confirm placement in independence checklist.

**Launch gates (blocking):**
- DV-advocate review: all revoke/notify/safe-exit/crisis strings (safety App. C).
- Licensed attorney sign-offs per checklist §5 (10 gates; legal §15) — ToS first, then COPPA/retention, FERPA consent before 18+ build, mandatory-reporter before human reads check-ins, Health Breach Rule determination before health holds real data.
- Wellbeing (W8) blocked until crisis protocol (§G1/G2 solutions) live.
- Health modules stay seedlings until H0–H3 + re-consent + counsel gates clear (R9).
- R1 6-month review instrumented from day one (revoke counts, safe-exit clustering, notification uptake, retaliation reports).

---

*Synthesis by solution architect · 2026-10-12. Detailed designs: `docs/solutions/sol-*.md` (7 files). Design only — no code, no deploys. Nothing here is legal advice.*
