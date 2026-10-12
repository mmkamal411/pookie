# Pookie Access Model & Feature Review — Revised Checklist

**18-expert panel · 2026-10-12 · Starting jurisdiction: Georgia, USA**
**Specs reviewed:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12) + `FEATURE-LIST-FOR-PANEL.md` (8 categories, 31 modules)

**Panel:** 5 attorneys (COPPA, FERPA, Georgia privacy, teen privacy/AADC, liability/ToS) · 4 child-development (psychologist, guidance counselor, child-welfare specialist, pediatrician) · 3 teachers (math, science, history) · 3 health (health coach, endocrinologist, internal medicine) · 3 civic/local (mayor, travel agent, city guide).

**How to read this:** ✅ clear · ⚠️ needs change (ship only with the fix) · 🛑 blocked (do not ship as designed). Every item names the owning expert domain. Gaps are numbered G1–Gn with severity. Reassessment items are numbered R1–Rn. Section 5 is the Georgia compliance summary with explicit human-counsel sign-off gates.

**Headline:** The panel's verdict is consistent — the child-as-access-authority model is sound and in several respects ahead of where the law is going. But the spec is strong on *data access* and thin everywhere data meets the real world: safety, health granularity, school-reality disclosure, AI content guardrails, and physical-world modules. Nothing in the model needs to die; several features need to be redesigned before they touch a real family.

---

## 1. ACCESS-MODEL PROCESS CHECKLIST

### 1.1 Onboarding & signup
| # | Process | Mark | Notes / required change |
|---|---|---|---|
| 1.1.1 | Adult signup (Google/magic link), no invite gate on own account | ✅ | Clear (all legal) |
| 1.1.2 | 30-sec onboarding: name → optional "add children" → dashboard | ⚠️ | Add: guardian attestation checkbox at child creation ("I am the parent/legal guardian"); DOB gate for **direct teen self-signup** (currently missing — teen protections can't attach without it); one-line school-transparency disclosure at "add children" step (counselor, history) |
| 1.1.3 | "Just me" mode (no children) | ✅ | Clear; never upsell (psychologist) |
| 1.1.4 | Under-13 parent-managed profile, no child login | ⚠️ | Theory correct per FTC FAQ A.8 (parent-provided data ≠ "from the child") — but must be a **technical guarantee, not policy**: server-side ban on under-13 login/session/link-code/invite/typable fields/persistent identifiers (COPPA). Add `legal_status` field for emancipated minors (GA privacy). Never label signup as "consent." |

### 1.2 Child linking
| # | Process | Mark | Notes / required change |
|---|---|---|---|
| 1.2.1 | Email invite → 7-day token → matching-login verify → consent screen | ⚠️ | Consent screen must: unbundle per-domain (school/health/location/social, unchecked by default, ≤8th-grade reading), enumerate health subcategories (never one "health" checkbox), name check-in text + mood explicitly, carry the school-transparency disclosure. No re-prompt for 90 days after decline (teen privacy) |
| 1.2.2 | 6-digit link codes (15-min, single use) | ⚠️ | Add brute-force lockout; anti-coercion private confirmation ("Did you choose this or were you told to?"); flag same-device redemption in audit log (welfare) |
| 1.2.3 | Claim dedupe (fuzzy name+birthdate) | ⚠️ | Fire only **after** successful email verification, never as standalone lookup (enumeration risk); manual-review threshold for near-misses (history); must not auto-merge health records (pediatrician) |

### 1.2b Data-provenance rule (NEW — required addition)
| # | Process | Mark | Notes |
|---|---|---|---|
| 1.2b.1 | **School-of-record data** (grades, attendance, official school comms) inherits the school's audience | ⚠️ | New spec principle (history, science, counselor, math): under FERPA, a custodial parent of a minor can obtain these from the school regardless of in-app settings. Pookie never promises otherwise. |
| 1.2b.2 | **App-generated data** (check-ins, reflections, mood, AI chats, practice content) is child-authority | ✅ | Governed by visibility scopes below |
| 1.2b.3 | **Safety-critical school comms** (permission slips, lab/field-trip notices, incident reports, emergency notifications) are **never revocable** | ⚠️ | New carve-out (science, GA Parents' Bill of Rights O.C.G.A. § 20-2-786): non-toggleable row on Sharing screen; `revokeAccess` never touches this scope; separate safety channel in API |

### 1.3 Grant / revoke authority
| # | Process | Mark | Notes / required change |
|---|---|---|---|
| 1.3.1 | Child grants access; no parent can veto/revoke a child-made grant | ✅ | Sound (all); keep server-side `granted_by` enforcement |
| 1.3.2 | Revoke rules (only granter or child revokes) | ⚠️ | Clarify the ambiguous matrix row: teen may revoke **any** grant on own record (fixes grandparent deadlock); parents revoke only own grants; add court-order row (verified orders supersede via human review, not self-serve); add custody-order carve-out (mayor, counselor, welfare) |
| 1.3.3 | **Visibility scopes** (NEW — required addition) | ⚠️ | Replace per-person all-or-nothing with per-person × per-scope: **Performance / Communications / Reflection / Wellness** (+ health sub-tiers H0–H3, travel/location as its own toggle). Defaults at link: Performance+Communications visible, Reflection+Wellness teen-private. All briefings/digests/nudges/API filtered server-side (history, health coach, endocrinologist, travel) |
| 1.3.4 | Access-request flow (non-parent adult → teen approves) | ⚠️ | Fact-only notification to other parent; under-16 non-parent grants need parent co-approval (psychologist); 30-day re-request lockout after revoke (welfare) |
| 1.3.5 | Block list (teen blocks adult) | ⚠️ | Blocked adult's household may not re-invite for 30 days (welfare); block ≠ revoke of safety comms; needs court-order override path (counselor) |
| 1.3.6 | Audit trail | ⚠️ | NEW required: append-only `access_events` (migration 021) — grant/revoke/request/block/safe-exit with timestamps, `granted_by`, reason codes, device/IP hash. Teen-visible; never shown to revoked parent (welfare, counselor, FERPA) |

### 1.4 Cooling-off (13–15 revoke)
| # | Process | Mark | Notes / required change |
|---|---|---|---|
| 1.4.1 | 7-day cooling-off, cancellable, parents notified | 🛑 | **Blocked as designed.** Three independent expert domains flag it: (a) immediate dual-parent notification endangers teens in coercive households (welfare, counselor, psychologist — "the single most dangerous element in the spec"); (b) friction on a privacy-protective choice is dark-pattern-adjacent (teen privacy); (c) it delays a safety decision while surveillance continues. **Required redesign:** teen chooses notify-now vs notify-at-effect (default: at effect, only the revoked parent, never both); **safe-exit path**: "telling my parents could put me at risk" → immediate cutoff + suppressed notification + crisis resources; during pending state, parent UI shows access as unchanged (no "revoking in 6 days" banner); no new parent-visible syncs during the window |
| 1.4.2 | Confirmation copy | ⚠️ | Per-scope consequences + school-transparency line ("Pookie-only; the school still shares with your parents") + alternatives (narrow scope, 30-day pause, talk-it-through) (psychologist, counselor, history) |

### 1.5 Go independent (13–17)
| # | Process | Mark | Notes / required change |
|---|---|---|---|
| 1.5.1 | Graduation framing (confetti, own Pookie) | ⚠️ | Split the two events: **gaining** independence = celebration; **removing** a parent = calm, neutral, respectful (no confetti on rupture — psychologist, welfare). Never show celebration UI where an abuser might see it (safe exits are visually boring by design) |
| 1.5.2 | Data-source handoff (reconnect school creds) | ⚠️ | Must also apply to 13–17 independence, not just 18+ (math, counselor); revoked parent's credentials must never keep syncing the teen's data (welfare) |
| 1.5.3 | Trusted-adult designation | ⚠️ | NEW required step before revoke/go-independent executes: teen names a trusted adult for safety alerts (counselor — resolves the crisis-tripwire contradiction, see G1) |
| 1.5.4 | Safety gate for Out & About modules | 🛑 | **Blocked as specified** (mayor): independent 13–15 + AI-planned outings + no adult in loop = highest community-safety liability. Required: trusted-adult contact + 3-min Safety Basics + family-aware defaults until 16 |

### 1.6 18+ transition
| # | Process | Mark | Notes / required change |
|---|---|---|---|
| 1.6.1 | Continuity by default for **school/grades data** | ⚠️ | Compliant with changes (FERPA): rights transfer at 18 **or postsecondary enrollment, whichever first** (spec omits the postsecondary prong); ongoing parent-credential pulls **must pause** until adult-student re-auth (FERPA, liability, counselor all flag); add unavoidable keep/review decision (not dismissible banner); emancipated minors get adult track at any age (GA privacy) |
| 1.6.2 | Continuity by default for **health data** | 🛑 | **Blocked.** Internal medicine + endocrinologist + pediatrician + health coach converge: health needs **affirmative opt-in re-consent, skip = private**. Body & development requires fresh explicit grant (default off). Add review–correct–seal of parent-entered data, transition-summary export, emergency-contact re-designation decoupled from access grants |
| 1.6.3 | Historical data (parent keeps what they saw) | ⚠️ | Add: 30-day grace then auto-restrict for health (internal medicine); teen can request "hide past too" (FERPA); deletion honored within 30 days |
| 1.6.4 | Quiet exit option at 18 | ⚠️ | Add "make private quietly" — immediate revoke, delayed neutral notification, no celebration UI (welfare) |

---

## 2. FEATURE CHECKLIST BY CATEGORY

### Category 1 — Core Platform
| Feature | Mark | Notes |
|---|---|---|
| Google OAuth + magic link, session mgmt | ✅ | Clear |
| Onboarding (planned) | ⚠️ | Per §1.1.2 changes |
| 5-tab nav (plain English), child switcher | ✅ | Per-child data purge on switch (teen privacy) |
| Nebula theme | ✅ | — |
| `/verify-invite` public landing | ⚠️ | Zero child PI pre-auth; unguessable single-use tokens; no enumeration (GA privacy, welfare, COPPA) |

### Category 2 — Pookie AI Assistant
| Feature | Mark | Notes |
|---|---|---|
| Pookie AI chat (warm tutor) | ⚠️ | Needs: documented self-harm/crisis protocol (988 surfacing, no auto-parent-notification absent imminent risk — CA SB 1119 shape by July 2027); never presents as therapist; science answers grounded in class materials with persistent AI label + home-experiment refusal (science); math answers verified before display (math); no-training-on-inputs vendor term + disclosure (FERPA, GA privacy) |
| **Muse toggle ("direct, unfiltered")** | 🛑 | **Blocked for under-18 as designed** (liability, teen privacy, psychologist, science, history, health coach, internal medicine converge). "Unfiltered" is a litigation exhibit (Character.AI cases). Required: 18+ gate; rename ("direct mode"); identical safety rules across modes; system-level minor-safety policy |
| Proactive nudges | ⚠️ | Teen opt-in, frequency-capped, daytime only; content scope-filtered (never Reflection/Wellness-derived nudges to parents); no health-content push (lock-screen leakage) |
| Weekly teacher discussion threads (Muse drafts, parent approves) | 🛑 | **Blocked as designed** (counselor): AI-ghostwritten correspondence misrepresents the parent's voice, can trigger unintended mandatory-reporter consequences, incoherent under split access. Replace: parent-authored + AI proofreading/tone-check only; "3 questions to ask" prompts fine |
| Instant-respond routing, graceful fallback | ✅ | — |

### Category 3 — Today (daily ritual)
| Feature | Mark | Notes |
|---|---|---|
| Morning ritual, tonight's plan | ✅ | Add "how this was chosen" disclosure (TX SCOPE alignment); travel-day awareness |
| **Check-in cross-check** (self-report vs synced data) | 🛑 | **Blocked as parent-facing lie detector** (welfare, psychologist, counselor converge). Redesign: teen-facing **calibration** only ("your estimates are getting sharper" — metacognition, Locke & Latham); never shown to parents; never accusatory. Honesty punished by cross-checks stops, and the crisis protocol depends on truthful check-ins |

### Category 4 — 31 life modules

**Body & Heart**
| Module | Mark | Notes |
|---|---|---|
| W2 Health (vitals, trends) | 🛑 | **Blocked until health tiers exist** (pediatrician, health coach). "Teen health privacy tiers" are referenced but undefined — build H0 (prohibited <18) / H1 (shareable wellness) / H2 (teen-private) / H3 (legally sensitive) taxonomy first. Consumer-device data: descriptive only, provenance-labeled, never diagnostic (internal medicine; FDA wellness boundary) |
| W8 Wellbeing (mood pulse, teenPrivate) | ⚠️ | teenPrivate correct, but: crisis-escalation ladder required (bad day → pattern → crisis triggers → ED signals); never parent-visible incl. aggregates; no indefinite retention; 988 integration |
| W13 Meals | ✅ | No calorie budgeting/moralizing language for <18 |
| W22 Activity | ⚠️ | No streaks for <18, no calorie-burn display, rest-day normalization, no teen leaderboards |
| W23 Nutrition (food logging) | 🛑 | **Blocked as designed for <18** (health coach, pediatrician, endocrinologist, internal medicine converge): food/protein logging = documented ED risk vector. Required: no calorie/weight-loss features <18, weight-neutral framing, NEDA resources, clinician gate |

**Home & Family**
| W21 Mail (photo intake) | ⚠️ | GIPA exposure (account numbers): extract-then-mask (last-4 only), auto-delete raw images ≤30 days, on-device redaction guidance |
| W20 Shopping List | ✅ | — |
| W11 Spending | ⚠️ | Mask to last-4; FTC Disposal Rule on disposal; teen's own purchase detail = teenPrivate |
| W7 Money & Documents (vault) | ⚠️ | Same as W21 for the vault; never persist full card numbers |
| **W24 Credit (3-bureau monitoring)** | 🛑 | **Blocked as designed** (liability, GA privacy converge): no FCRA permissible purpose; bureaus won't furnish. Re-scope to **minor security-freeze management** (O.C.G.A. §§ 10-1-914/914.1 — lawful, GA-native) + credit-hygiene coaching via licensed partner |
| W14 Co-parenting | 🛑 | **Blocked for high-conflict as designed** (welfare, counselor, mayor converge). Required: parallel-parenting mode (separate surfaces, no shared messaging to screenshot); immutable uneditable log; no child-as-courier; custody-order awareness + travel-restriction profile; coaching/pattern detection (neutral teen-facing flag) |
| W12 Babysitters | ⚠️ | Directory only; label "parent-vetted, not background-checked by Pookie" (mayor) — or integrate real checks (FCRA counsel first) |
| W10 Fairness lens | 🛑 | **Blocked as parent-facing scoreboard** (welfare, psychologist, math converge): sibling-comparison fuel, triangulating in divorce. Redesign: private parent reflection, no per-child scores shown to children, no exportable reports, compare resources not rank children |

**School Days**
| W1 School (live) | ⚠️ | See Category 5 |
| W16 School Calendar | ✅ | — |
| W5 College & Future | ⚠️ | GSFC methodology exactly (HOPE 3.0 core + rigor; Zell 3.7 + 1200/26; date-stamped, "verify at GAfutures.org"); chance-me = ranges + model card, never point estimates; essay feedback-only (no ghostwriting — academic integrity); counselor handoff prompts; anesthesiologist pathway as branching example |
| W4 Activities | ⚠️ | Teen-consented location; GHSA eligibility monitoring |
| W18 Summer | ⚠️ | Camp vetting; crisis routing year-round; rising-9th transition content |

**Safe & Sound**
| W3 Safety (insurance) | ✅ | Never interpret coverage (liability) |
| W19 Emergency | ⚠️ | Storage-only; "not an emergency response service — call 911 first"; preload Cobb/GA resources (911, poison control, 988, GA Crisis & Access Line); break-glass medical info independent of parental access (internal medicine); lab emergency quick-card (science) |

**Growing Up**
| W6 Driving & Life Skills | 🛑 | **Blocked as vaguely specified** (mayor, travel): must encode **Georgia DDS rules** (learner's 15, Joshua's Law 30-hr, provisional Class D 16 with midnight–5AM + passenger restrictions, full Class C 18). Add digital driving-log for Joshua's Law hours. Per-state from day one |
| W15 Screen Time ("limits that stick") | ⚠️ | 13+: co-set (teen proposes, parent approves), teen appeal path; always transparent (never covert — "spyware" characterization risk); device-level agents 🛑 for under-13 (COPPA) |
| W17 Friends (teenPrivate) | ⚠️ | Keep teenPrivate absolute + teen-entered journaling only (no parent-entered surveillance, no location tracking of friends); no teen-to-teen messaging or it reclassifies under social-media laws |

**Out & About**
| W25 Fuel & Charging | ✅ | Teen routing inherits family-aware default (mayor) |
| W26 Weather (hyperlocal severe alerts) | ⚠️ | **NWS/NOAA-sourced only**, never LLM-generated; AI may translate but must link official alert + timestamp; explicit "not an emergency-alert system" disclaimer (mayor). Coarse location default for <18 (teen privacy) |
| **W27 Events (AI-curated)** | 🛑 | **Blocked as specified** (mayor, city guide converge): no vetting standard = unmoderated meetup board for minors. Required: published curation policy (ticketed public venues / municipal / school / nonprofit / verified hosts only; never private-residence or "DM for address"); per-event age tags (all-ages/13+/18+/21+); 18+/21+ filtered by default for <18; audience modes (Family/Teen/Grown-up); municipal seed sources (Cobb Parks & Rec, Marietta calendars) |
| W28 Restaurants | ⚠️ | Verified live listings (no hallucinated restaurants); GA DPH inspection scores; allergen hard-blocks from health allergy list (never inferred, never "allergy-safe" claims); 21+/bar-primary excluded for <18; no weight-loss dietary framing for <18; teen night-safety bias |
| **W29 Trails & Parks** | 🛑 | **Blocked for solo under-16 as specified** (mayor, city guide): no solo-hike recommendations <16; difficulty must carry group-size/supervision guidance; official sources only (NWS + park authority; dusk closure awareness — parks close at dusk); dusk/darkness check (90-min sunset warning); "share my plan" as first-class step |
| W30 Flights | 🛑 | **Blocked for teen self-booking** (travel, liability): purchaser-of-record must be 18+ (server-side invariant); minor-traveler rules engine (UM bands/fees per airline, phone-booking routing, passport/TSA checks); itinerary = dedicated Sharing toggle; teen travel-purchase alerts to parents (DOT-documented risk); custody travel-restriction profile |
| W31 Rental Cars | 🛑 | **Blocked for teen initiation** (travel, city guide, mayor): hard-gate on company minimum age × state × full license; under-21 → planning mode only; **hidden from teen accounts**, not footnoted; under-25 surcharges in ranked totals |

### Category 5 — School Intelligence (W1 detail)
| Feature | Mark | Notes |
|---|---|---|
| 13 sources, named owners; per-class pages (gap-to-90 hero) | ✅ | Exemplary framing (counselor, history, math) |
| Path-to-90 checkboxes → Supabase | ⚠️ | Parent viewers read-only on teen's checkboxes; deterministic versioned forecast engine required (math) — implied everywhere, specified nowhere |
| **AI practice quizzes from uploaded material** | 🛑 | **Blocked as designed** (math, science converge): fail-closed verification pipeline required (machine-verified answer keys, misconception-aware distractors, persistent AI labels, per-class opt-in, pilot measured before scale). Until then: source-text flashcards only |
| Unit auto-alignment | ⚠️ | Confidence-scored; below-threshold → human queue (Dawson owns tagging); never auto-align high-stakes content on a guess |
| **Peer tips pipeline (600/wk)** | 🛑 | **Blocked as designed** (FERPA, history, science, math converge): cross-family identifiable tips = consent failure; "peer" label on AI content = fabricated social proof; unverified science content at scale = misinformation pipeline. Path to ✅: rename ("Study Sparks"), provenance labels, contested-topic human review, 5%/wk sampling QA, study-skills-only fencing, 4-wk expiry kept |
| SAT prep | ⚠️ | Digital-SAT blueprint (44 Qs, adaptive, Desmos built in) + Desmos fluency training; verified formula bank; no fake score predictions |
| Teacher inbox (multi-source merge) | ⚠️ | **Segregate counselor mail** (counselor: ASCA B.2 — counselor confidentiality is not a parent CC line; 🛑 as merged); provenance labels; teacher-thread visibility follows School-module setting (no split-brain — math); safety-critical messages tagged (science) |
| Daily check-ins + handout uploads | ⚠️ | Teen-deletable, rolling auto-purge option (no indefinite retention); lab-safety pulse for science classes |
| Sync workers (StudentVUE via Playwright) | ⚠️ | Counsel review of portal ToS/CFAA posture; credential consent documented at vault-add; generalize zero-guard to ingest anomaly detection |
| ParentVUE/CTLS/teacher Gmail pulls | ⚠️ | Redact non-linked students from CC'd teacher emails before parent-visible surfaces (FERPA-in-practice — counselor); parent's own Gmail fine |
| Daily pulls (news, horoscope, etc.) | ⚠️ | News: reputable allowlist, contested-topic balance; horoscope: drop or quarantine as opt-in entertainment (science); define or cut "power-up" |

### Category 6 — Family & Access Management
Covered in §1 above. Per-feature: email invite ✅ · link codes ⚠️ · child authority ✅ (with scopes) · age tiers ⚠️/🛑 per §1.4–1.6 · Sharing screen ⚠️ (per-person × per-scope + firewall line + trusted-adult line) · access requests ⚠️ · block list ⚠️ · go independent ⚠️/🛑 per §1.5 · 18th-birthday prompt 🛑 as designed (see §1.6) · `graduate_child_access` RPC ⚠️ (preserve blocked-adult list, revoke API tokens) · claim dedupe ⚠️

### Category 7 — Settings & Data Management
| Feature | Mark | Notes |
|---|---|---|
| Profile / Sync console / Health connections / Credentials / Family | ⚠️ | Credentials vault: **encrypt before any real credentials stored** (GIPA — name+password = personal info; breach = § 10-1-912 event); never log plaintext; rotation + cryptographic erasure; at 18, parent-connected school credentials transfer ownership (mandatory handoff) |
| Notification preferences | ⚠️ | Scope-filtered; teen quiet-mode (pause parent notifications without revoking — de-escalation step) |
| **Data retention ("check-ins indefinite, emails TBD")** | 🛑 | **Blocked as indefinite** (COPPA 2025, teen privacy, welfare, counselor converge): publish per-source written schedule now — check-ins: teen-deletable + rolling purge option; school emails: school-year + 1; raw financial images ≤30 days; backups purged ≤30 days after source deletion; 312.10 bans indefinite retention for under-13 data, period |

### Category 8 — API Platform
| Feature | Mark | Notes |
|---|---|---|
| `/api/v1/*` routes | ⚠️ | Every route enforces §3 matrix + scopes server-side; per-grantee scoped tokens; step-up auth for token creation; audit logging (GA privacy: supports breach scoping); **no unauthenticated/broadly-scoped API before enforcement proven in staging** |
| teacher-messages (+approve/send) | 🛑 | No send path until parent-authorship rules ship (counselor); approve/send requires explicit write scope |
| Notifications API (planned) | ⚠️ | Scope-aware by design; batch, not real-time grade alarms |

---

## 3. GAPS REGISTER

| # | Gap | Sev | Domain | Proposed fix |
|---|---|---|---|---|
| G1 | **Crisis tripwire vs revoke contradiction** — GUIDANCE-FRAMEWORK Part 7 promises crisis-language → parent alert; access spec promises revoked parents lose all future access. Both can't be true. | Critical | Counselor, welfare, psychologist, liability | Trusted-adult designation **required** before any revoke/go-independent executes; crisis alerts route to trusted adult; teen checks "I understand no adult will be alerted" if they decline. Resolve before any teen onboarding |
| G2 | **No crisis/safety protocol** for mood pulse + check-ins + AI chat disclosures | Critical | Psychologist, counselor, liability, health coach | Build now: 988/Crisis Text Line surfacing, teen-controlled "tell a trusted adult," documented self-harm protocol for AI (SB 1119 shape), explicit "private spaces are not safety-monitored" copy. Launch-blocking for Wellbeing |
| G3 | **"Teen health privacy tiers" don't exist** despite being referenced in W2 + Engineering Handbook | Critical | Pediatrician, health coach | Define and build H0/H1/H2/H3 taxonomy (see §2 W2) before W2 holds real teen data |
| G4 | **7-day cooling-off notification endangers abuse-exit** | Critical | Welfare, counselor, psychologist | Safe-exit path per §1.4.1; DV-advocate review of all revoke/notify copy before launch |
| G5 | **18+ health continuity default** inverts informed consent | Critical | Internal medicine, endocrinologist, pediatrician, liability | Affirmative opt-in re-consent for health; skip = private (see §1.6.2) |
| G6 | **No written retention policy / infosec program / vendor assurances** (COPPA 2025, enforceable now) | Critical | COPPA, teen privacy, GA privacy | Publish per-source schedule; written infosec program; written vendor assurances (Supabase, Cloudflare, OCR/AI); ban indefinite retention |
| G7 | **Mandatory-reporter gray zone** — O.C.G.A. § 19-7-5 "child service organization personnel" may cover staff once anyone reads check-ins | High | Liability | Designate compliance owner now; DFCS escalation path (1-855-422-4453); re-run analysis at first human/AI read of check-in content |
| G8 | **Peer tips cross-family identifiable sourcing** | High | FERPA | Provable de-identification/aggregation, curriculum-only sourcing, or per-family consent before ship |
| G9 | **No custody-order mechanism** | High | Welfare, counselor, mayor, GA privacy | `court_order_restriction` flag + human-review upload queue; matrix adjusted per verified order; teen told plainly why |
| G10 | **AI disclosure policy for abuse disclosures to Pookie/Muse** | High | Welfare, liability | Written policy: what AI says/doesn't promise ("never 'just between us'"), crisis-line handoff, teen-readable language |
| G11 | **Missing emancipated-minor handling** | High | GA privacy | `legal_status` field; emancipated → adult track at any age |
| G12 | **No DOB gate for direct teen self-signup** | High | Teen privacy | Teen protections can't attach without age; add before teen onboarding |
| G13 | **Purchasing/contracting authority unaddressed** (travel) | High | Travel | New §3.5 carve-out: visibility ≠ transactional authority; 18+ purchaser-of-record invariant |
| G14 | **Location-data policy for 13–17 missing** | High | City guide, teen privacy | Retention, precision (coarse default), no retained history <18, disclosed at Explorer Setup |
| G15 | **No trusted-adult / safe-contact infrastructure** | High | Welfare, counselor, mayor | Persistent teen-nominated list with teen-controlled visibility; product home for safety prompts |
| G16 | **W14/W10 surveillance creep** (co-parenting as weapon, fairness as scoreboard) | High | Welfare, psychologist | Parallel-parenting mode; fairness as private parent reflection only |
| G17 | **Indefinite check-in retention** | High | Welfare, counselor, COPPA | Teen-deletable + rolling auto-purge; never indefinite for minor-generated content |
| G18 | **Deterministic grade-forecast engine unspecified** | Medium | Math | Versioned, unit-tested, input-cited engine; the highest-value math artifact, implied everywhere |
| G19 | **Curated formula/definition bank missing** | Medium | Math, science | Single grounding source for quizzes, tips, tutor math, SAT formulas |
| G20 | **504/IEP accommodation tracking absent** | Medium | Counselor | #1 parent-counselor friction point in GA schools; store plan, track delivery, log review dates |
| G21 | **Four-year graduation audit (GA 23 credits)** | Medium | Counselor | More urgent than simulator polish; counselors do this manually every spring |
| G22 | **Immunization management (GA Form 3231)** | Medium | Pediatrician, internal medicine | College reqs, HPV catch-up, transfer for college |
| G23 | **"Share my plans" teen outing-sharing** | Medium | City guide, mayor | Voluntary, teen-controlled, check-in timers, overdue nudges to teen-chosen contact |
| G24 | **Voter pre-registration (GA: 17.5)** | Medium | Mayor | Belongs in Growing Up independence checklist |
| G25 | **W19 emergency module is storage, not a plan** | Medium | Internal medicine | Lock-screen/QR reachability, action-plan templates, break-glass category |
| G26 | **No sibling/household leakage analysis** | Medium | Welfare | Per-child access boundaries verified end-to-end (revoke Parent A on child 1 must not leak via shared surfaces) |
| G27 | **"Power-up" daily pull undefined** | Medium | Health coach | Define or cut; if supplement-related, needs health-claim review |
| G28 | **School-issued account privacy** (Cobb Office 365 monitored by school) | Medium | History | Extend firewall concept: don't imply privacy the school doesn't grant |

---

## 4. REASSESSMENT LIST

| # | Decision to revisit | For | Against | Trigger |
|---|---|---|---|---|
| R1 | 13–15 cooling-off: keep, modify, or kill | Developmental rationale (hot/cold cognition); prevents impulsive rupture | Notification endangers abuse-exit; friction on privacy choice; may deter the population it protects | 6-month live-data review: revoke counts, delayed-notification uptake, cancellation rate, retaliation reports. If safe-exit usage clusters here, flip default to instant-with-delayed-notification |
| R2 | 16 as the instant-revoke cliff | Legal/UX simplicity | No developmental justification for the cliff at 16 (psychologist) — mid-late adolescence remains peak impulsivity window | Acknowledge tension explicitly in spec; measure outcomes by age band |
| R3 | 18+ continuity default for grades | Avoids birthday disruption; FERPA-compliant for stored data | Liability: default-ON disclosure post-transfer without affirmative consent; counselor: pause-and-ask is cleaner | Human counsel sign-off on the consent design before build |
| R4 | "Child decides" absolute vs court orders | Principle integrity; teen agency | Courts can order access; facilitating violation creates liability; GAL needs a path | First court order received — build ingestion path now, don't auto-enforce until counsel signs off |
| R5 | W14 Co-parenting scope | High user value in low-conflict divorces | Becomes a weapon in high-conflict cases | Launch read-only/logistics-only; expand only after family-law practitioner review |
| R6 | Peer tips: kill vs fix | 600/wk volume has real engagement value | Deceptive labeling + misinformation at scale | Reassess only after provenance labels + human QA sampling + study-skills fencing exist |
| R7 | Muse "unfiltered" for adults | Product differentiation | "Unfiltered" is a litigation exhibit; branding risk persists even 18+ | Reassess branding before any marketing; keep safety rails mode-independent regardless |
| R8 | AI quizzes: build vs buy vs cut | Highest-leverage study feature if verified | Verification pipeline is expensive; wrong math is high-harm | Reassess after pilot in 1–2 classes measuring misconception rate; never A/B test ungrounded quizzes on students |
| R9 | Health data in the 31-module day-one shell | Vision completeness | W2/W8/W23 without tiers/protocols is the highest clinical-risk surface | Gate health modules behind tier + protocol completion; don't ship in the undifferentiated shell |
| R10 | Geographic expansion beyond Georgia | Growth | WA (MHMDA), TX (SCOPE), CA (AB 2246/SB 1119), IL (BIPA), AL (2027 law) each need a state workstream | Any non-GA launch triggers a state-law review; per-state minor-consent text |
| R11 | District/school partnership | Distribution, data quality | Inverts the access model (school becomes data authority with FERPA duties); "child is access authority" stops being describable | Flag now; full re-review before any partnership conversation |
| R12 | Mandatory-reporter designation | Legal clarity, teen safety | Attaching the duty changes staffing/ops | First human/AI read of check-in content — re-run analysis immediately |

---

## 5. GEORGIA COMPLIANCE SUMMARY

### ✅ Clear under Georgia law today
- **Child-as-access-authority inside a private app:** no GA statute requires parental veto over a private company's data feed; contract-based access control is lawful (GA privacy, FERPA attorneys).
- **18+ continuity for non-health data:** aligns with O.C.G.A. § 39-1-1(a) (majority at 18); FERPA transfer at 18/postsecondary honored via re-auth design.
- **Under-13 parent-managed model:** viable under FTC FAQ A.8 (parent-provided data); consistent with a 12+ app-store rating if the under-13 ban is technical.
- **No comprehensive GA consumer privacy law** to comply with (SB 111 gutted 2026) — but privacy-policy promises are enforceable via the Fair Business Practices Act (O.C.G.A. § 10-1-393(a)): **whatever we promise, the AG can hold us to.**
- **No GA vendor/processor statute** — obligations are contractual + federal.

### ⚠️ Needs legal review before build (not blocking design)
- **GIPA breach-notification scoping** (O.C.G.A. § 10-1-912): confirm exactly which holdings are "personal information" (vault + financial docs yes; grades/check-ins no); draft the breach runbook; confirm FBPA enforcement hook for Article 34.
- **§ 20-2-667 operator-status boundary:** document the legal theory (parent-credential-fed, no school contract) + guardrails (no student ads/data sale, 45-day deletion on school request).
- **Playwright portal automation:** district ToS + CFAA posture (post-*hiQ*) + credential-handling obligations.
- **W24 re-scope:** FCRA counsel sign-off on the freeze-management pivot.
- **Safety carve-out vs O.C.G.A. § 20-2-786** (Parents' Bill of Rights): confirm the never-revocable safety-comms design satisfies "timely safety information."
- **Sex-ed opt-out currency:** recheck O.C.G.A. § 20-2-143(d) (2024 bills sought opt-in; verify current text before building opt-out logic).
- **Emancipated-minor standards** (O.C.G.A. §§ 15-11-720–727) for the `legal_status` field.
- **42 CFR Part 2** interplay if any SUD-related content is stored (stricter than HIPAA — commit to never co-mingle under general consent).
- **TAKE IT DOWN Act** (May 2026): 48-hour removal path for W1 uploads.
- **W26/W29 disclaimer sufficiency** under GA law for AI-translated weather/trail guidance.

### 🛑 Needs a real attorney's sign-off (do not ship on panel analysis alone)
1. **ToS + arbitration + class waiver** (11th Cir. post-*Concepcion* requirements; parent/guardian must be contracting party for 13–17 — minor voidability).
2. **Mandatory-reporter program:** designation, training, DFCS escalation — before any human reads check-in content.
3. **18+ FERPA consent design** for education records (continuity vs pause-and-ask).
4. **Cooling-off notification/retaliation matrix** with DV-advocate review of all user-facing strings.
5. **Data retention + litigation-hold procedure.**
6. **Law-enforcement / subpoena response policy.**
7. **COPPA compliance package:** written retention policy, infosec program, vendor assurances, policy overhaul (2025 Rule, enforceable now).
8. **Court-order ingestion workflow** (who verifies, what overrides).
9. **Multi-state expansion** (WA MHMDA, TX SCOPE, CA AB 2246/SB 1119, IL BIPA, AL 2027 law).
10. **FTC Health Breach Notification Rule** applicability determination before health modules hold real data.

### Regulatory horizon (watch items)
| Date | Event |
|---|---|
| 2027-01-01 | CA AB 2246 effective (dark-pattern ban, high-privacy defaults, geolocation limits <18) |
| 2027-05-06 | Utah App Store Accountability Act bulk provisions (private right of action) |
| 2027-07-01 | CA SB 1119 operative (AI self-harm protocols, audits from 2029, private right of action); Louisiana app-store law |
| 2027 (session) | Georgia expected to reintroduce comprehensive privacy bill — watch |
| 2027 | Alabama comprehensive law effective — attaches if any user/child resides there |

---

*Panel synthesis by coordinator · 2026-10-12. This document is issue-spotting analysis, not legal advice. Every 🛑 item needs its stated fix before the associated feature touches a real family. Every §5 sign-off gate needs a licensed attorney, not a panel memo.*
