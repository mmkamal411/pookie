# Expert Review — Adolescent Medicine (Teen Health Confidentiality)

**Reviewer lens:** pediatric/adolescent-medicine specialist — teen health-data confidentiality, Georgia minor-consent law
**Specs under review:** `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12) + `docs/FEATURE-LIST-FOR-PANEL.md`
**Starting jurisdiction:** Georgia
**Date:** 2026-10-12

**Relationship to the internal-medicine review (Expert 14, same date):** I have read it and **endorse its core holding** — the 18+ "continuity by default" must be carved out for health data (pause-and-prompt, never continuity). This review does not re-litigate the 18+ handoff; it covers what Expert 14 did not: **ages 13–17**, where Georgia minor-consent law already gives teens independent confidentiality rights the spec currently ignores, and the **full feature list** from a teen-health perspective.

**Headline position:** The access model is clinically progressive — child-as-access-authority at 13+ aligns with AAP/SAHM confidentiality guidance. But the spec treats "health" as one undifferentiated category, and that single design choice creates the highest-severity legal and clinical risk in the 13–17 range: Georgia law gives minors independent consent rights over STI, substance-use, contraceptive, and pregnancy care, and federal privacy law (HIPAA Privacy Rule, 45 CFR 164.502(g)(3)) makes the *minor* — not the parent — the controlling individual for that information. A coarse "health" toggle that a teen flips thinking "vaccination record" while it actually exposes therapy notes, cycle tracking, or SUD counseling is a confidentiality breach waiting to happen. Fix = the tiered model below, enforced server-side.

---

## PART A — Access-model review

### A1. Georgia minor-consent law: what the spec must reflect (verified 2026-10-12)

In Georgia, minors can consent to the following **without any parental permission or notification**, and the resulting records carry independent confidentiality:

| Care category | Georgia authority | Parental notification |
|---|---|---|
| STI testing and treatment, **including HIV**, any age | O.C.G.A. § 31-17-7 | Physician *may* but is **not required** to inform parents |
| Drug/alcohol abuse counseling and outpatient treatment | Georgia DPH/GCAPP guidance; GA case-law/attorney analysis lists "drug abuse: minors may consent to treatment" as a consent exception | Not required |
| Contraceptives and family planning (incl. emergency contraception) at Title X / DPH clinics | Federal Title X confidentiality mandate; GA DPH clinic practice | Prohibited at Title X clinics |
| Pregnancy and prenatal care | GA law: any female minor may consent to pregnancy-related care regardless of age | Not required |
| Abortion | Minor may consent, but **24-hour parental notification required** (GA Parental Notification Act; judicial bypass available) | **Required** (with bypass) |
| **Mental health treatment** | **General rule: PARENTAL CONSENT REQUIRED.** Minors are not competent to consent to mental-health treatment in GA (O.C.G.A. § 19-7-2 age of majority; GA attorney analysis). **There is NO 16+ mental-health consent exception in Georgia** — the task's premise is incorrect for this state. Teen therapy confidentiality rests on professional ethics and therapist-negotiated privacy agreements, not statute. | Per therapist's clinical judgment / negotiated agreement |
| Emergency care | Implied consent; EMTALA | As clinically appropriate |

**Federal overlay (why this binds product design even though Pookie isn't a covered entity):**
- **HIPAA Privacy Rule, 45 CFR 164.502(g)(3):** when state law permits a minor to consent to care, the minor — not the parent — is the individual with respect to that PHI, and the parent is **not** the personal representative for it. Providers must not disclose it to parents without the minor's authorization. If Pookie ingests, displays, or forwards such records (EHR syncs, lab integrations, scanned visit summaries), mirroring this rule isn't optional polish — it's the standard every provider feeding the app operates under, and violating it breaks the chain of trust those providers require.
- **42 CFR Part 2:** substance-use-disorder records from federally assisted programs carry consent and **re-disclosure prohibitions stricter than HIPAA**. If Pookie ever holds SUD treatment records, Part 2 obligations attach to the record holder.
- **21st Century Cures Act / ONC information blocking:** ONC's privacy exception expressly permits providers to withhold minor-consented EHI from parental portal access. The industry is moving *toward* segmentation; a product that flattens it moves the wrong way.
- **FTC Health Breach Notification Rule (16 CFR Part 318; 2024 final rule):** health-app vendors holding identifiable health data as PHR vendors must notify on unauthorized disclosure. Pookie's health modules (W2, W8, W22, W23) put it squarely in scope once they hold teen data. Showing a teen's protected health data to a parent whose access was revoked — or was never valid — is an *unauthorized disclosure* under this rule, not just a bug. (Precedents: GoodRx, BetterHelp, Flo, Premom enforcement.)
- **Clinical standard:** AAP policy "Confidentiality Protections for Adolescents and Young Adults in the Health Care Setting" (Pediatrics 2016, reaffirmed), SAHM confidentiality position paper, Bright Futures (private time with adolescents at every visit). The spec's child-as-authority model is *more* aligned with these than most commercial products. Keep that; fix the granularity.

### A2. Verdicts per spec section

**§1 Product principles — ✅ PASS.** Child-as-access-authority and server-side enforcement are exactly what adolescent confidentiality requires. Principle 2 ("a grant made by the child cannot be vetoed") correctly mirrors the HIPAA minor rule's direction of control.

**§2 Signup & onboarding — ⚠️ PASS WITH CHANGES.** The "add children" flow is where health-data stewardship begins and the spec says nothing about it. For under-13 profiles the parent must see a stewardship disclosure ("you are entering health data *for* your child; at 13 they gain control over sensitive categories"). For 13+ the onboarding must introduce the tier model *before* any health data is entered — a teen's first health entry should already be taggable confidential.

**§3 Access authority matrix — ⚠️ PASS, INCOMPLETE.** Missing the sensitive-health row (see Change 3). Also: the matrix assumes all grants are equivalent; for Tier-2 health data the "grant" semantics must be per-category, explicit, and revocable instantly at every age tier.

**§4 Under-13 stewardship — ✅ PASS.** Parent-managed, no child login. Correct for COPPA. Note: health data entered here becomes the teen's record at 13 — design the 13th-birthday transition to surface the tier model (see feature improvements).

**§4 13–15 shared agency — ⚠️ PASS WITH CHANGES (highest-severity section).** Three problems:
1. The consent checkbox `"I understand Mom/Dad can see [grades, check-ins, health]"` treats health as one category. A 14-year-old consenting to "health" is picturing vaccinations; the toggle as built would also expose mental-health, sexual-health, and substance-use data — categories Georgia law lets them keep private. **This is the spec's single most dangerous line for 13–15.**
2. The **7-day cooling-off on parent-revoke must not apply to Tier-2 health data.** Delaying revocation while notifying both parents keeps legally-protected data visible for a week after the teen withdrew consent. Revocation of protected-category access must be instant at every age tier; cooling-off can apply to grades/check-ins/general health only.
3. **Auto-notifying "both parents immediately" on revoke is a safety risk in abusive households.** A teen revoking access because a parent is unsafe should not trigger an instant notification naming the action. The revoke flow needs a brief safety screen ("Are you safe? Here's who you can contact") and should never transmit the teen's location or device details in the notification.

**§4 16–17 full agency — ✅ PASS** for the general model; Tier-2 instant-revoke and confidential-entry tagging apply here identically.

**§4 18+ — ✅ ENDORSE Expert 14's carve-out.** Continuity-by-default is fine for grades/school records; health requires pause-and-prompt. I add one adolescent-medicine note: the transition should *begin at 16–17* (transition-readiness nudges, TRAQ-style readiness), not land as a single birthday prompt — this mirrors the Got Transition Six Core Elements (transition planning starts at 14–16).

**§5 Child linking — ⚠️ PASS WITH CHANGES.** Claim dedupe via fuzzy name+birthdate match must not auto-merge health records: merging a parent-managed profile containing health history into a teen-verified login needs the teen's explicit confirmation per health category, or a parent could view Tier-2 entries created under the teen's login via a merged view.

**§6 "Go independent" — ⚠️ PASS WITH CONDITIONS.** Endorse Expert 14's condition (trigger health review/seal + emergency contacts). Add: independence at 16–17 must include the confidential-care explainer (their Title X / STI / SUD rights in Georgia), since newly-independent teens are the highest-risk group for care avoidance.

**§7 "Just me" mode — ✅ PASS.** No concerns; note that a "just me" adult's health modules are Tier-0/1 only by default with no parental dimension — simpler.

**§8 Migrations — ⚠️ INCOMPLETE.** The access tables (017–020) have no health-data taxonomy. Required additions: `health_data_category` (tier 0/1/2) on health records; per-category consent rows (not one `health` boolean); `health_record_versions` audit trail for confirm/correct flows (Expert 14's Gap 5); `confidential_entry` flag defaulting per tier. Without these, engineers will implement the coarse toggle the spec implies.

**§9 API surface — ⚠️ PASS WITH CHANGES** (see Change 6): needs tier-scoped health endpoints; `revokeAccess` must branch on data category (instant for Tier-2).

**§10 UI screens — ⚠️ PASS WITH CHANGES** (see Change 7): the Sharing screen's "what's-visible list" must enumerate health sub-categories; the 18th-birthday prompt needs the separate health decision surface (Expert 14, Change A).

**§11 Risks & mitigations — ❌ INCOMPLETE.** No row covers: Tier-2 exposure under blanket health consent; cooling-off delay applied to protected data; EOB/insurance disclosure defeating app-level confidentiality; safety risk of instant dual-parent revoke notifications; eating-disorder risk from nutrition logging (W23); health-content push-notification leakage. See Change 5.

### A3. The teen health privacy tiers (proposed — currently defined nowhere)

I verified: "teen health privacy tiers" are referenced by W2 and the Engineering Handbook as "per the Guidance framework," but **no tier definitions exist in any doc** (GUIDANCE-FRAMEWORK.md contains only the "child privacy contract" concept). The following is my clinical recommendation for insertion as a spec appendix:

- **Tier 0 — General wellness.** Steps, sleep, activity, vitals, weight/height/growth, general health goals. Shareable under a parent's general health grant. Default: visible if parent has health access.
- **Tier 1 — Clinical record.** Diagnoses, medications, allergies, immunizations, visit summaries, lab results, parent-entered history. Teen-controlled from 13: parent sees only with the teen's (or, under 13, steward's) grant. Dual-stewardship rules apply to parent-entered history (A6).
- **Tier 2 — Legally protected / sensitive.** Sexual/reproductive health (incl. cycle tracking, contraception, STI testing/treatment), substance-use counseling/treatment records, mental-health therapy notes and mood-journal content flagged sensitive, eating-disorder-related entries. **Never parent-visible without the teen's explicit per-category opt-in, at any age tier including 18+ continuity.** Invisible by default; revocation instant; excluded from all parent-facing summaries, digests, AI summaries, and exports unless the teen explicitly includes them.
- **Safety tripwire (overrides all tiers, consistent with the Guidance framework):** imminent risk of self-harm, harm to others, or abuse → confidentiality yields to safety: crisis resources surfaced, trusted-adult involvement encouraged, mandatory-reporting-aware design. (Note: as a non-clinical app operator Pookie is not a GA mandated reporter under O.C.G.A. § 19-7-5 and has no Tarasoff-style duty — consistent with the existing duty-of-care legal review — but the tripwire design should mirror clinical norms: 988, Crisis Text Line 741741, GA Crisis & Access Line 1-800-715-4225.)

Mapping rule: **every health datum in every module gets a tier tag at creation** (chat logs, mood pulses, nutrition entries, check-ins with health content, mail-intake EOBs, synced device data). The Sharing screen exposes three toggles, not one.

### A4. Concrete spec changes (quote → replacement)

**Change 1 — §4 (13–15), the consent checkbox.**

Quote:
> - Informed consent on first link: explicit "I understand Mom/Dad can see [grades, check-ins, health]" checkbox in the teen's own session — not a passive click.

Replacement:
> - Informed consent on first link: explicit per-category checkboxes in the teen's own session — not a passive click — listing separately: grades, check-ins, **general health (Tier 0 wellness + Tier 1 clinical: vaccinations, conditions, allergies, medications)**, and **protected health (Tier 2: mental health, sexual/reproductive health, substance use)**. Protected health defaults to teen-only and is never included in a general "health" grant; parental visibility requires a separate explicit opt-in per sub-category. The teen is told in plain language: "In Georgia, you have the legal right to keep some health information private — including STI testing/treatment, drug/alcohol counseling, and birth control from certain clinics — even from parents. Pookie protects that choice."

**Change 2 — §4 (13–15), cooling-off: carve out Tier-2 revocation. New §4c.**

Quote:
> - May grant/revoke freely, **except** revoking a parent triggers a **7-day cooling-off**: scheduled, cancellable anytime, both parents notified immediately (told, not asked).
> - Confirmation lists consequences: "Your grades will stop updating. Mom and Dad will be notified today."

Replacement:
> - May grant/revoke freely, **except** revoking a parent's access to grades, check-ins, and Tier 0/1 health triggers a **7-day cooling-off**: scheduled, cancellable anytime, both parents notified immediately (told, not asked).
> - **Revoking access to Tier-2 protected health is instant at every age tier — no cooling-off, no delay.** A teen withdrawing consent for protected-category visibility must not wait a week while that data remains exposed.
> - Confirmation lists consequences per category: "Your grades will stop updating in 7 days. Mom and Dad will be notified today. Your private health info is hidden immediately."
> - Before any parent-revoke completes, a brief safety screen: "Are you safe right now? Revoking will notify Mom and Dad today." with crisis resources (988; Crisis Text Line 741741; GA Crisis & Access Line 1-800-715-4225). Revoke notifications never include the teen's location or device details.

**Change 3 — §3 matrix: add the sensitive-health row.**

Quote: *(append to the authority matrix)*

Replacement — append row:
> | Grant/revoke visibility of Tier-2 protected health (mental, sexual/reproductive, substance-use) | ✅ exclusive authority at 13+; parental visibility requires teen's explicit per-category opt-in | ❌ never | ❌ never |

**Change 4 — new §4c: Protected health categories (all ages).**

Quote: *(new section; insert after §4 age tiers)*

Replacement (insert as §4c):
> ### 4c. Protected health categories — Tier-2 segmentation (new)
> - Health data is classified at creation into Tier 0 (general wellness), Tier 1 (clinical record), Tier 2 (protected: sexual/reproductive, substance-use, mental-health-therapy content). Classification is server-side and immutable by clients.
> - Tier-2 data is invisible to parents by default at every age tier, including under-13 stewardship to the extent the data originates from the teen (e.g., a 12-year-old's data aging into teen control at 13 is re-classified and sealed).
> - Teens may tag any individual health entry "just me" (confidential-entry flag), even while parents hold general health access — reflecting state minor-consent law and removing the incentive to keep a second secret record outside the app.
> - Tier-2 data is excluded from parent-facing digests, AI summaries, exports, and the "what's-visible" preview unless the teen explicitly includes it. Pookie AI (both Pookie and Muse modes) treats Tier-2 disclosures as confidential by default and never routes them into parent-visible content.
> - Pookie does not promise absolute confidentiality it cannot keep: the app discloses plainly that insurance explanations of benefits (EOBs), provider practices, and the law (e.g., Georgia's abortion parental-notification requirement, mandatory abuse reporting) can disclose independently of the app.

**Change 5 — §11 risks: append health-confidentiality rows.**

Quote: *(append to the risks table)*

Replacement (append rows):
> | 9 | Blanket "health" consent exposes Tier-2 data the teen has a legal right to keep private (STI, SUD, contraception) | Tiered consent (Change 1, §4c); per-category opt-ins; server-side tier enforcement |
> | 10 | 7-day cooling-off keeps protected health visible after consent withdrawn | Tier-2 revocation instant at all ages (Change 2) |
> | 11 | Dual-parent instant revoke notification endangers teens in abusive households | Safety screen + resource links before revoke; notifications carry no location/device data |
> | 12 | EOBs/insurance mail photographed into W21 Mail (or synced) defeat app-level confidentiality | Health-mail detection → teen-private routing; EOB-privacy explainer at 16+ |
> | 13 | Health push nudges leak content to lock screens / shared devices | Content-neutral nudges only; no Tier-1/2 content in notifications, ever |
> | 14 | Nutrition logging (W23) without safeguards risks eating-disorder harm in adolescents | No calorie/weight-loss features under 18; weight-neutral framing; SCOFF screen + NEDA resources |

**Change 6 — §9 API: tier-scoped health endpoints.**

Quote:
> - `revokeAccess(childId, adultUserId)` → enforces matrix; 13–15 parent-revoke schedules cooling-off

Replacement:
> - `revokeAccess(childId, adultUserId)` → enforces matrix; 13–15 parent-revoke schedules cooling-off **for non-health categories**; Tier-2 health revocation executes immediately at all ages.
> - `grantHealthAccess(childId, adultUserId, tier)` / `revokeHealthAccess(childId, adultUserId, tier)` → per-tier consent, teen authority only for Tier-2.
> - `tagHealthEntry(entryId, confidential=true)` → teen-only confidential-entry flag.
> - `confirmHealthRecord(childId)` → adult review/confirm/correct flow (pairs with Expert 14's §4a).

**Change 7 — §10 UI: Sharing screen health section.**

Quote:
> 3. Child Sharing screen — "Who can see my stuff?", per-person toggles, what's-visible list, approve/deny access requests, block adult

Replacement:
> 3. Child Sharing screen — "Who can see my stuff?", per-person toggles, what's-visible list **with health shown as three separate toggles (General wellness / Health record / Private health — the last defaulting to "only you" with a plain-language note on Georgia confidentiality rights)**, approve/deny access requests, block adult.

### A5. Answers to the five focus questions

1. **Legally-protected teen data:** handle via Tier-2 segmentation — invisible by default, per-category teen opt-in, instant revocation, excluded from all parent-facing surfaces. This mirrors the HIPAA minor rule (45 CFR 164.502(g)(3)) and EHR "confidential encounter" practice. Caveat the app must state: Georgia physicians *may* (not must) inform parents of STI care, insurers send EOBs, and abortion requires parental notification — the app protects what it controls and warns about what it doesn't.
2. **Is "health" too coarse?** Yes — dangerously so. Replace with the three-tier consent (Changes 1, 7).
3. **Who owns parent-entered history when the teen revokes?** Dual stewardship: the *clinical core* (immunizations, allergies, chronic conditions, medications, surgeries) is a continuity-of-care record — the teen can confirm/correct it (Expert 14's provenance flow) but not erase medically necessary history; the teen *does* control its visibility (16+: restrict parent's future view; 18+: full control per Expert 14's carve-out). The parent retains what they lawfully saw while personal representative (spec's existing rule — correct). **Tier-2 data the teen self-consented to never belonged to the parent and is never in the parent's history.**
4. **18+ handoff:** endorse Expert 14 (pause-and-prompt for health, record review, export, proxy explainer, emergency contacts). Add: start transition at 16–17; add insurance-aging explainer (dependent coverage typically to 26, but EOBs go to the policyholder); prompt adult-PCP establishment; immunization-record transfer for college/work.
5. **HIPAA-adjacent:** not a covered entity, but (a) FTC HBNR likely applies as PHR vendor — build the breach-notification plan now; (b) mirror 45 CFR 164.502(g)(3) minor provisions as design law; (c) handle SUD data with 42 CFR Part 2-grade protections; (d) FTC Act §5 bars deceptive privacy promises — every confidentiality claim in UI must be literally true under the tier model; (e) audit-log all health-data access.

### A6. Feature improvements (access-model-adjacent)

1. **13th-birthday transition flow.** When a steward-managed child turns 13: prompt the new teen (not the parent) with the tier explainer + Sharing screen. Health data entered under stewardship is re-classified; Tier-2-eligible content is sealed to teen-only by default.
2. **Confidential-care mode explainer (13–17).** In-app, Georgia-specific: "You can get STI testing, drug/alcohol counseling, and birth control confidentially. Here's how to ask a clinic for private time." AAP-aligned; reduces care avoidance.
3. **Annual re-consent nudge for health sharing (all ages).** Consent given at 13 may not reflect the 16-year-old's wishes. Quiet yearly prompt.
4. **Provider-handoff packet** (endorse Expert 14) + **"verify with your clinician" provenance chain**.
5. **Guardianship exception path.** For 18+ with intellectual/developmental disability under guardianship, the uniform child-authority model needs a legal-override lane — flag for counsel, note here because abrupt cutoffs harm this population most.

### A7. Gaps

1. No health-data taxonomy anywhere in the spec or migrations (see §8 verdict).
2. No 13th-birthday transition for steward-managed health data.
3. No custody/court-order lane (medical-decision-making orders can legally override the child-grant model).
4. No policy for parent-entered *family* health history (parent's own conditions in the child's record) at 18+.
5. No audit-trail requirement for health records (Expert 14's Gap 5 — endorsed).
6. No EOB/insurance disclosure handling.
7. No statement on secondary use: health data must never train models or feed advertising without explicit opt-in (FTC §5 / HBNR risk).

### A8. Reassessment flags

- 🔁 **Legal counsel sign-off** on all Georgia citations in A1 (statutes summarized from 2026-10-12 research; counsel to confirm Title 37 section for SUD minor consent and current abortion-notification case law).
- 🔁 **FTC HBNR applicability determination** once W2/W8/W22/W23 hold real data — breach-notification plan, privacy-policy health-data section.
- 🔁 **State expansion:** minor-consent law varies materially (e.g., California allows 12+ mental-health consent; New York, Texas differ). The tier model travels; the plain-language rights text must be per-state.
- 🔁 **EHR/FHIR integration:** triggers full HIPAA analysis; the "not a covered entity" assumption may fall.
- 🔁 **When AI health features launch:** re-review diagnosis guardrails and Tier-2 handling in LLM context.
- 🔁 **Annual:** re-validate the Tier-2 category list against evolving state statutes.

---

## PART B — Full feature-list review (domain: adolescent medicine / teen health confidentiality)

Legend: ✅ clear · ⚠️ needs change · 🛑 blocked as designed. Marks are *from my domain only*; features outside it are marked ✅ with "no domain concerns" where applicable.

### 1. CORE PLATFORM
| Feature | Mark | Notes |
|---|---|---|
| Google OAuth + magic link | ✅ | No domain concerns. |
| Session management | ✅ | No domain concerns. |
| Onboarding (add children) | ⚠️ | Must include health-stewardship disclosure (<13) and tier-model intro (13+); age gate drives health-module defaults (A2 §2). |
| 5-tab navigation | ✅ | No domain concerns. |
| Child switcher | ⚠️ | Session hygiene: switching active child must fully swap health-data scope; no cross-child leakage in caches, widgets, or notifications; audit which child context a health view occurred under. |
| Nebula theme | ✅ | No domain concerns. |
| /verify-invite public landing | ✅ | Ensure no health-data preview renders pre-authentication. |

### 2. POOKIE AI ASSISTANT
| Feature | Mark | Notes |
|---|---|---|
| Pookie chat (warm tutor) | ⚠️ | Teen health disclosures (symptoms, mood, sexual health, substance use) are Tier-1/2 data: tag confidential by default, never parent-visible, excluded from parent-facing summaries. Keep the never-diagnose guardrail (already in Guidance framework — affirmed). Crisis-resource injection on self-harm/abuse disclosures: 988, Crisis Text Line 741741, GA Crisis & Access Line 1-800-715-4225. |
| Muse toggle (direct, unfiltered) | 🛑 | **"Unfiltered" must not apply to health.** Medical guardrails (no diagnosis, crisis escalation, Tier-2 confidentiality tagging) must persist in Muse mode. Unfiltered medical advice to minors is a clinical-safety and FTC §5 risk. Block health topics from unfiltered handling or keep guardrails on. |
| pookie-tutor worker (Llama 3.3 70B) | ⚠️ | LLM processing of teen health disclosures: data minimization, no training on user health data, defined retention, no downstream disclosure. Treat as sensitive even absent HIPAA. |
| Instant-respond routing | ✅ | Provided health queries route with the guardrails above. |
| Teacher discussion threads (Muse drafts) | ⚠️ | Drafts about a teen must never include Tier-1/2 health information; health stays out of teacher comms unless the teen explicitly consents. |
| Proactive nudges | 🛑 | As designed, health nudges ("mood low this week", med reminders with drug names) leak via lock screens and shared devices. **Nudges must be content-neutral** ("Pookie: time for your check-in"); never include Tier-1/2 content; teen-configurable; default off for Tier-2-adjacent nudges. |

### 3. TODAY
| Feature | Mark | Notes |
|---|---|---|
| Morning ritual | ⚠️ | Attention items must respect tier visibility — a parent's "Today" view must never surface the teen's Tier-2 items; teen's own view may. |
| Tonight's plan | ✅ | No domain concerns. |
| Check-in cross-check | ⚠️ | Health-adjacent check-ins (sleep, mood, "how I feel") must not be cross-checked against parent/device data *for the parent's view* — parent-facing discrepancy flags ("he said 8h, watch says 5h") are surveillance and destroy the curious-non-accusatory frame. Keep cross-check teen-facing or aggregate-only. |

### 4. THE 31 MODULES
| ID | Module | Mark | Notes |
|---|---|---|---|
| W2 | Health | 🛑 | **Blocked as specified:** tiers undefined (defined in A3 — implement), single coarse sharing model, no confidential-entry tagging. Vitals/trends/glanceables are ✅ once tiered (Tier-0 default). |
| W8 | Wellbeing (mood pulse) | ⚠️ | teenPrivate default is ✅ correct. Needs: crisis escalation on self-harm language; **never parent-visible, including aggregates** (mood aggregates can out a teen); tiered retention — mood/mental-health content must not be "indefinite" (see §7 retention). |
| W13 | Meals | ✅ | Meal planning is fine; keep weight-neutral language; do not link to W23 calorie features for <18. |
| W22 | Activity | ⚠️ | Tier-0 sharing to parents acceptable, but: no teen leaderboards/comparisons without opt-in; no weight-loss framing; streaks can fuel compulsive exercise — normalize rest days; watch for overtraining signals. |
| W23 | Nutrition | 🛑 | **Needs change as designed.** Food/protein logging + restaurant taste-profile for adolescents without eating-disorder safeguards is clinically unsafe (AAP clinical report on eating disorders, Pediatrics 2021: dieting and weight-focused tracking are risk factors). Required: **no calorie counting or weight-loss goals for <18**; weight-neutral, behavior-focused framing; SCOFF-based screen with opt-out and NEDA resources; clinician or parent gate for any deficit-oriented tracking; decouple from W28 taste-profile for teens. |
| W21 | Mail | ⚠️ | **EOB leakage:** explanation-of-benefits mail for confidential care (e.g., STI testing) photographed into the app could surface to parents. Need health-mail detection → teen-private routing + redaction prompts. |
| W20 | Shopping List | ✅ | No domain concerns. |
| W11 | Spending | ✅ | No domain concerns. |
| W7 | Money & Documents | ✅ | No domain concerns. |
| W24 | Credit | ✅ | No domain concerns. |
| W14 | Co-parenting | ⚠️ | Child-revocation model vs **court orders**: custody/medical-decision orders can legally require both parents' access and override the grant model — needs a "court order on file" lane (legal review). Also: absent a court restriction, non-custodial parents generally retain health-information access rights — don't promise the child model overrides that. |
| W12 | Babysitters | ✅ | No domain concerns. |
| W10 | Fairness | ✅ | No domain concerns. |
| W1 | School | ⚠️ | School health records (nurse visits, immunizations, 504/IEP health accommodations via portals) are **FERPA education records**, not HIPAA — parent access until 18, then student (consistent with spec's FERPA note). Teacher-inbox health disclosures and health content in daily check-ins must be tier-tagged; doctor's-note uploads for absences = Tier-1. |
| W16 | School Calendar | ✅ | No domain concerns. |
| W5 | College & Future | ✅ | No domain concerns. |
| W4 | Activities (sports) | ⚠️ | Add: preparticipation physical (PPE) reminders; **concussion protocol** — Georgia's Return to Play Act of 2013 requires immediate removal and medical clearance; recommend baseline/symptom tracking + return-to-play checklist; overtraining/injury prompts. |
| W18 | Summer (camps) | ⚠️ | Camp health forms, GA immunization requirements (Form 3231), medication-administration forms, allergy action plans for camp settings. |
| W3 | Safety | ✅ | No domain concerns. |
| W19 | Emergency | ⚠️ | Endorse Expert 14's §4b: emergency info (allergies, conditions, meds, insurance, designated contacts) as a **break-glass category independent of parental access**; teen designates contacts; offline ICE card/QR. Hidden Tier-2 data must still surface allergies/meds to EMS via break-glass. |
| W6 | Driving | ⚠️ | Medical fitness-to-drive: prompt (teen-controlled) about conditions affecting driving — seizures, syncope, uncontrolled diabetes, vision — with GA DDS medical-review information; "talk to your doctor" prompts, never app adjudication. |
| W15 | Screen Time | ⚠️ | Align with legal review (no deceptive "limits that stick" claims); from my domain: sleep-hygiene framing is good; avoid pathologizing normal use. |
| W17 | Friends | ✅ | teenPrivate is appropriate. |
| W25–W29, W31 | Fuel/Charging, Weather, Events, Restaurants, Trails, Rental Cars | ✅ | No domain concerns. (W28's wiring to W23 nutrition inherits W23's 🛑 for teen users.) |
| W30 | Flights | ✅ | Minor-traveler rules noted; not a health-domain issue (airline unaccompanied-minor policies vary). |

### 5. SCHOOL INTELLIGENCE (W1 detail)
- ⚠️ Per W1 row above, plus: **"check-ins indefinite" retention is unsafe for health-adjacent content** — mood disclosures, mental-health mentions, and health notes in check-ins need tiered retention (see §7). Teacher-inbox merge must tier-tag health content on ingest. AI practice quizzes: ✅ no concerns. Peer tips: ✅ no concerns (ensure tips never contain health advice beyond general wellness — no medical content in peer tips).

### 6. FAMILY & ACCESS MANAGEMENT
- Overall ✅ with Part A changes. Specifics: block list ✅ (teen safety); link codes ✅; claim dedupe ⚠️ (fuzzy name+birthdate merge must not auto-merge health records — teen confirms per health category before any health data becomes visible in merged view); access-request flow ✅ (requester never sees health pending approval).

### 7. SETTINGS & DATA
| Feature | Mark | Notes |
|---|---|---|
| Health connections | ⚠️ | **Per-tier OAuth scopes:** teen connects their own device; parent's device data must never comingle into the teen's record. Menstrual/sexual-health data (e.g., cycle tracking via HealthKit) is Tier-2 — never parent-visible, not inferable from shared dashboards. Revocation must propagate to connected sources. Granular toggles: share steps/sleep but not cycle/heart-rate-variability-derived fertility signals. |
| Sync console | ✅ | No domain concerns. |
| Credentials vault | ✅ | No domain concerns. |
| Notification preferences | ⚠️ | Must include health-nudge content controls (content-neutral default; see §2 nudges). |
| Data retention policies | ⚠️ | **"Check-ins indefinite, emails TBD" is incompatible with teen health confidentiality.** Require tiered retention: Tier-2 teen-deletable at any time, default shorter retention; Tier-1 defined policy; no indefinite retention of mood/mental-health content. |

### 8. API PLATFORM
- ⚠️ **All** `/api/v1/children/[childId]/*` endpoints must enforce tier-level authorization server-side (the spec's principle 5 — extend to tiers, not just roles). No bulk export endpoint may include Tier-2 data without explicit teen consent per export. Audit-log every health-data read. Rate-limit health endpoints. (No health-specific endpoints are listed yet — when added, they inherit this.)

### Missing features (gaps the list doesn't cover)
1. **Immunization tracking** — GA Form 3231 school requirements; reminder/recall; GRITS-aware record keeping.
2. **Growth charting** (CDC/WHO percentiles) — parent-entered, clinician-interpreted (never app-diagnosed).
3. **Bright Futures periodicity reminders** — well visits, dental, vision, depression screening (PHQ-9A from age 12), STI screening prompts at recommended ages.
4. **Sports physicals (PPE)** and concussion return-to-play (W4 addition).
5. **Allergy/asthma action plans** (W19 addition) — including EpiPen/inhaler technique refreshers.
6. **Medication management + adherence** for teens (schedules, refill prompts — content-neutral notifications).
7. **Menstrual/reproductive health tracking** — Tier-2 private by design, with confidential-care clinic linkage.
8. **Confidential visit prep for teens** — "how to ask your doctor for private time," Georgia rights explainer (A6.2).
9. **Crisis resources hub** — 988, Crisis Text Line 741741, GA Crisis & Access Line 1-800-715-4225, embedded in W8, AI chat, and the revoke safety screen.
10. **EOB-privacy explainer** at 16+ (insurance reality check).
11. **Transition-readiness assessment (TRAQ-style)** starting at 16, feeding the 18+ handoff.
12. **Vaccine education** incl. HPV series completion tracking.

### Features that shouldn't exist as designed
1. **Coarse "health" sharing toggle** (Sharing screen) — replace with three-tier toggles (Change 7).
2. **W23 calorie/protein/weight-loss logging for <18** — redesign with ED safeguards or gate behind clinician (Part B table).
3. **Muse "unfiltered" mode applied to health content** — guardrails must persist (Part B §2).
4. **Health-content push notifications** (specific content) — content-neutral only.
5. **Indefinite retention of mood/mental-health check-ins** — tiered retention required.
6. **7-day cooling-off applied to Tier-2 revocation** — instant at all ages (Change 2).
7. **Parent-visible AI chat summaries containing health disclosures** — Tier-2 exclusion required.

---

## Bottom line for the parent orchestrator

**The access model is directionally right and clinically defensible — but "health" as a single category is a confidentiality breach waiting to happen for 13–17-year-olds.** Georgia law already gives these teens independent privacy rights over STI, substance-use, contraceptive, and pregnancy care, and federal law makes the teen (not the parent) the controlling individual for that information. The fix is contained and builds on Expert 14's 18+ carve-out: **(1)** adopt the Tier 0/1/2 taxonomy (A3 — currently defined nowhere); **(2)** split the Sharing-screen health toggle into three tier toggles with Tier-2 defaulting to teen-only (Changes 1, 7); **(3)** make Tier-2 revocation instant at every age, exempt from cooling-off (Change 2); **(4)** add the safety screen before parent-revoke notifications (Change 2); **(5)** tier-scope the API and migrations (Changes 6, §8). On the feature list: **W2 is blocked until the tiers exist; W23 nutrition logging for teens is blocked until eating-disorder safeguards are designed; Muse "unfiltered" must never apply to health content;** everything else is clear or needs the noted changes. Get legal counsel to sign off on the Georgia citations (A1/A8) and run the FTC breach-notification analysis before health modules hold real data.

*Reviewer note: I am an AI specialist reviewer, not a licensed attorney or the user's physician. Georgia citations were verified against primary-guidance sources on 2026-10-12; legal counsel should confirm before build.*
