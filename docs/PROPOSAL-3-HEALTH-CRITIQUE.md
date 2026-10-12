# Proposal 3 — Parent Identity Verification, Tiered: Pediatrician Review

**Reviewer role:** pediatrician (adolescent health privacy) · **2026-10-12**
**Proposal reviewed:** v1 = self-attestation + email verification; v2 (phased, not launch-blocking) = school emergency-contact match OR Stripe Identity gov-ID.
**Cross-refs:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked), `ACCESS-MODEL-REVIEW-CHECKLIST.md` (G3/G5/G9, §§1.2b, 1.3.3, 1.6.2), `EXPERT-SOLUTIONS.md` (sol-health §1: H0–H3 taxonomy; sol-access §9: court orders).

**North star:** patient confidentiality and teen safety. Health-data access is not grades access — a wrong disclosure can cause family violence, coerced care decisions, or a teen avoiding care entirely.

---

## 1. CRITIQUE — where self-attestation is medically/ethically insufficient

### 1.1 What self-attestation actually proves
Email ownership + a checkbox proves "someone controls this inbox" and "someone clicked a box." It proves **nothing** about legal parenthood, guardianship, or custody. Family emails are routinely shared, forwarded, or compromised; in blended/high-conflict households the person holding the inbox is not always the custodial parent. Critically, the onboarding "add child" flow (Spec §2) makes the creator a parent with **name + birthdate only** — birthdates are not secret. A legal stranger with a teen's name and DOB can claim "parent" in the data model today. Linking a 13+ teen still requires the teen's own verification, but the imposter already holds the parent role and its pending privileges.

### 1.2 Self-attestation is insufficient for ANY teen health-data access beyond H1
- **H1 (steps, sleep, activity):** acceptable at IAL1. Low sensitivity, low harm on mis-disclosure.
- **H2 (weight, medications, menstrual data, mood patterns):** NOT acceptable at self-attestation. Wrong-parent disclosure of a teen's weight trajectory or psychotropic medication list is a realistic trigger for shaming, coerced dieting, or medication interference. These are also the fields where **data integrity** matters clinically: parent-entered medications/allergies feed W28 allergen hard-blocks and the W19 break-glass card. An imposter or misattributed entry here is a *patient-safety* defect, not just a privacy defect.
- **H3 (STI/contraception/SUD/mental health/pregnancy):** identity is the perimeter. sol-health already sets H3 as teen-only with no override path — no grants, no aggregates, no break-glass. That design is correct, but its promise is only as strong as parent authentication. With self-attestation, the "no override" wall has a screen door: anyone who can pose as a parent reaches the exact data the teen's own clinician is legally required to withhold.

### 1.3 The Georgia minor-consent interaction (the sharpest edge)
Georgia law permits minors to consent to certain confidential care (STI treatment — O.C.G.A. § 31-17-7; voluntary substance-abuse treatment — O.C.G.A. § 37-7-8; outpatient mental-health consent at 16+; exact statutory text to be confirmed by licensed counsel per §5 gates). The clinical reality: a 16-year-old can be treated for chlamydia and the provider *must not* tell the parent. If Pookie ingests that encounter (teen-entered medication, health-app connection, provider document, or even a school-nurse note pulled via parent credentials), the data exists in the app. Under weak parent identity proofing, the parent the clinic lawfully excluded can see the same information in Pookie. That is not a theoretical edge — in high-conflict divorce (where the G9 custody-order mechanism is also still unbuilt), the non-custodial parent or a new partner is the foreseeable actor. **An imposter or overreaching "parent" accessing confidential teen health data is the predictable failure of self-attestation, and it undermines the very care Georgia law protects.**

Secondary interaction: §1.2b.1 (school-of-record data inherits the school's audience) must NOT pull H3-classified content into parent visibility. A school-nurse visit note mentioning contraception, once classified H3, must override school-of-record inheritance — same principle as the counselor-mail segregation the panel already required (§2 W1 teacher inbox).

### 1.4 When weak proofing becomes a patient-safety problem (not just confidentiality)
1. **Clinical misattribution:** parent-entered meds/allergies from an unverified account propagate to allergen blocks (W28) and emergency break-glass (W19). Wrong data here harms the teen in a real clinical encounter.
2. **Consent-state manipulation:** an imposter parent could approve/revoke health-app connections, block the teen's safe-exit, or trigger notifications that out the teen (cf. G4).
3. **Care avoidance:** if teens believe parents can see H3-adjacent data, they stop logging honestly or stop using the app — the check-in truthfulness the whole safety model depends on (G1/G2) collapses. Confidentiality assurance is a clinical input.

### 1.5 Verdict on the proposal as written
The v1/v2 phasing is directionally right, but **the bar placement is wrong**: v1 must not expose H2 to self-attested parents at all, and H3 must be unreachable by identity alone. "v2 before health/school data at scale" understates the risk — the risk attaches the moment any H2/H3-adjacent field exists in the database, because classification is imperfect at ingestion.

---

## 2. REVISED SOLUTION — tiered identity assurance mapped to health tiers

### 2.1 Identity assurance levels (NIST 800-63 language)
| Level | Proofing | What it unlocks |
|---|---|---|
| **IAL1** (self-attested) | Email-verified account + guardian attestation checkbox at child creation (already in 1.1.2) | H1 only within the Wellness scope; Performance/Communications per current link defaults; emergency-contact info entry; immunization records (school-required, parent is source of truth <18); break-glass card *writes* (reads stay break-glass-only, audited) |
| **IAL2** (verified) | Gov ID via Stripe Identity **OR** match against school emergency-contact record (name + phone, server-side match, never displayed) — *counsel must clear the portal-ToS/CFAA question (§5) before the school path is used for proofing* | H2 visibility per teen's Wellness-scope grant; parent-side medication/allergy entry; approval of health-app connections for <18; `health_safety_overrides` INSERT (011) — the audited, teen-notified ≤30d override path stays, but only verified parents may invoke it |
| **H3** | — | **No identity level reaches H3.** Teen-only, no grants, no aggregates, no break-glass, no exceptions (sol-health §1 stands). Verification gates H2; it never gates H3. |

Design principles:
- **Verification is per-parent, independently.** Both parents verify separately. Verification status is visible to the *teen* (transparency) but never to the other parent (G4/G9 safety).
- **Just-in-time step-up, not upfront friction.** Signup/onboarding never asks for ID. The moment a parent attempts H2 access, health-data entry, or health-connection approval → interstitial "verify your identity to see health details" → Stripe Identity → resume. Conversion is preserved; sensitive access is gated.
- **No retroactive exposure.** Existing IAL1 parents stay IAL1; H2 surfaces show "verify to unlock" — nothing they couldn't see before becomes visible.
- **18+ cutover resets everything.** IAL2 does not survive the birthday. Midnight cutover → all parent health visibility private; affirmative opt-in re-consent (G5, skip = private). Verification is about *who you are*, re-consent is about *what you're allowed to see* — both are required.
- **Court orders suspend IAL2.** A verified `court_order_restriction` (sol-access §9) suppresses even IAL2 H2 visibility for the restricted parent.

### 2.2 v1 (launch) — what ships
1. IAL1 for all parents; H2/H3 parent-visible surfaces do not exist in v1 (no grant UI built that can't be gated). Health modules ship as H1-only seedlings per R9.
2. Parent health-data entry in v1: emergency contact + immunizations (IAL1); medications/allergies = teen-entered only, labeled "not verified by parent" (feeds W28 with that provenance label).
3. `health_safety_overrides` INSERT requires IAL2 → in v1 the override path is dormant; document as such (no silent backdoor).
4. H3 classification active at ingestion from day one (see §2.4) — the no-override promise must hold before any real teen data lands (G3).
5. Break-glass medical card **excludes H3** by construction (a listed STI medication outs the condition to EMTs/family). Card composition is teen-controlled with provider-directed defaults.

### 2.3 v2 (before health data at scale) — what gets built
1. Stripe Identity integration (`requestIdentityStepUp` RPC → redirect → webhook → `profiles.identity_assurance='ial2'`, `ial2_method`, `ial2_verified_at`).
2. School emergency-contact match as alternate IAL2 path — **only after counsel clears** the portal-ToS question.
3. H2 surfaces unlock behind IAL2 + teen's Wellness-scope grant.
4. Parent-side med/allergy entry + teen "confirm" flow; confirmed entries lose the "unverified" label.
5. `health_safety_overrides` INSERT enabled for IAL2 parents (audited, teen-notified ≤30d, H2 only — never H3).
6. Provider-directed confidentiality flag + ingestion classifier (§2.4).

### 2.4 The missing piece the proposal doesn't name: classification + provider flag
Q4's answer: the *access model* handles the verified-parent-shouldn't-see case (H3 = teen-only regardless of verification), but only if classification works. Required additions:
- **Ingestion classifier:** every health datum gets a tier at write time — structured fields (medication lists, encounter types) map deterministically; free text (provider documents, teen check-ins mentioning H3 topics) goes through a conservative classifier that **fails into H3** (unknown → most restrictive, mirroring the "unknown DOB fails into teen tier" rule from 011).
- **`confidential_by_law` flag** (source: `'provider' | 'statute' | 'teen'`), distinct from teen-preference privacy. The teen cannot accidentally share H3 (no-grant rule), and a provider flag survives any teen/parent UI action.
- **Parent-entry refusal:** parent-entered assertions about H3-classified topics (e.g., a parent logging "pregnancy" about the teen) are refused at entry — `h3_parent_refusal` error code, mirroring the `h0_minor_refusal` pattern. Parents cannot create H3 records about their teen; H3 originates from the teen, their provider, or statute.
- **Disclosure accounting:** an append-only table recording any H3 movement. By design it should stay empty — its existence proves the negative during audits.
- **H3 ≠ mandatory-reporting shield:** the confidentiality flag controls *parent visibility only*. Suspected abuse/neglect still follows the G7 mandatory-reporter pathway. Document this distinction in teen-readable copy so H3 is never misread as "nobody will ever know."
- **42 CFR Part 2:** if SUD-related content is ever stored, it lives under Part 2's stricter consent regime — commit now to never co-mingle SUD data under general consent (§5 watch item).

### 2.5 What changes in the existing spec
- §1.1.2: guardian attestation checkbox = IAL1 definition; add step-up prompt copy contract.
- §1.3.3: visibility scopes gain the identity dimension — Wellness scope is per-person × per-tier × IAL.
- Migration 023 (`health_tier_visible()`): H2 arm requires viewer IAL2 when viewer holds a parent-role grant.
- Migration 021 (`access_events`): log viewer IAL on every H2 read.
- 011 `health_safety_overrides`: INSERT policy adds IAL2 requirement.

---

## 3. OPEN QUESTIONS FOR MEHEDI
1. **Friction tolerance:** ~30–60 seconds of Stripe Identity before a parent sees teen H2 health data. The pediatrician position is that this is required, not optional — but it's your conversion trade-off to own. (Mitigation: just-in-time step-up means most parents never see it until they need H2.)
2. **School-record-as-ID:** using portal credentials to match emergency-contact records for identity proofing may exceed the authorized purpose of those credentials (portal ToS/CFAA posture, §5). Is Stripe Identity alone an acceptable v2, with the school path deferred to counsel review?
3. **Who pays:** Stripe Identity is per-verification priced. Business decision — absorb, or gate IAL2 behind a paid tier? (Pediatrician note: putting teen health privacy behind a paywall creates a two-tier safety model; recommend absorbing.)
4. **Break-glass scope:** should EMTs ever see H3-adjacent medication names? Recommendation: no — teen-composed emergency card, provider-directed defaults, H3 excluded. Confirm.
5. **Child-profile creation:** anyone with name + DOB can create the "parent" record today. Should creating a 13+ child's profile require IAL1 attestation *plus* a second factor (e.g., school-record match or the teen's link-code redemption before any parent privilege activates)? The link code already gates data flow, but the parent *role* is claimed earlier.
6. **Under-13 + IAL2:** for parent-managed under-13 profiles, is IAL2 required before the steward enters medications/allergies? (Pediatrician: yes — same misattribution risk, and COPPA 2025 raises the stakes on children's health data.)

---

## 4. IMPLEMENTATION NOTES
- **Schema:** `profiles.identity_assurance` enum `('ial1','ial2')` DEFAULT 'ial1'; `ial2_method` text NULL (`'stripe_identity' | 'school_contact'`); `ial2_verified_at` timestamptz NULL. Backfill: all existing → 'ial1'. Server-side only; never client-derived (Spec §1 principle 5).
- **RPCs:** `requestIdentityStepUp()` → returns Stripe Identity session URL; webhook handler `identityVerificationWebhook()` validates signature, sets ial2 fields, writes `access_events` row. `health_tier_visible()` extended with IAL2 check on the H2 arm (parent-role viewers). `revokeAccess`/`grantAccess` consult `court_order_restriction` before IAL2 visibility.
- **RLS test matrix additions:** IAL1 parent JWT × H2 row → deny; IAL2 parent JWT × H2 row with teen grant → allow; IAL2 parent × H3 row → deny; IAL2 parent × H2 row with court-order flag → deny; teen JWT × own H3 → allow.
- **UX copy contracts:** step-up interstitial (≤8th-grade reading, no shame framing); "not verified by parent" provenance label on teen-entered meds/allergies; H3 explanation on the teen Sharing screen ("Some health info — like care you got confidentially — is only ever visible to you. Not even a verified parent can see it, and you can't share it by accident.").
- **No silent backdoors:** grep gate — no service_role bypass of `health_tier_visible()` outside the break-glass read path; break-glass reads are audit-logged and teen-notified.
- **Notification hygiene:** verification prompts, H2 unlocks, and override notices must never leak health content into push/email bodies (lock-screen leakage, cf. §2 Pookie AI nudges).
- **Retention:** IAL2 verification artifacts (ID images) — Stripe holds them, we store only `ial2_method` + timestamp + verification reference. Never persist gov-ID images in Supabase.
- **Sequencing with G3:** migration 023 (tiers) must land before any IAL2-gated H2 surface; the IAL2 column can ship earlier as dormant.
- **Counsel gates (do not self-clear):** GA minor-consent statutory text; school-record-as-ID authorized purpose; 42 CFR Part 2 posture; FTC Health Breach Notification Rule determination (§5 gate 10) before health modules hold real data.
