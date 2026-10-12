# Expert Review — Internal Medicine (Adult Primary Care)
**Reviewer lens:** Expert 14 of 19 · pediatric-to-adult health-data transition
**Spec under review:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12)
**Date:** 2026-10-12

---

## Summary position

**For a health carve-out at 18: YES — strongly.** The spec's "continuity by default" (§4) is clinically wrong for health data. In medicine, the 18th birthday is a hard privacy boundary, not a soft one: at 18 a patient must affirmatively authorize *every* disclosure to a parent, and providers treat silence as "no." Pookie defaulting parents to continued health visibility inverts that standard. The carve-out is not cosmetic — it prevents real clinical harm (care avoidance, inaccurate medication/allergy lists, false assumptions of medical authority) and it aligns the product with how the healthcare system the app must interoperate with actually works.

---

## 1. Verdicts per relevant spec section

### §4 — 18+ Ownership with continuity — ❌ FAIL for health data (pass for grades/admin)

The locked line — "Parents who had access keep access by default. No birthday disruption. Skipping = continuity" — is fine for grades, check-ins, and school records. For health data it creates three clinical problems:

1. **It inverts the medical consent default.** Every US health system flips to "parent sees nothing without the adult patient's written authorization" at 18. A product that flips to "parent sees everything unless the young adult acts" teaches the exact opposite mental model of the system the user must now navigate. When the young adult walks into an adult PCP's office, the receptionist will hand *them* a HIPAA authorization form — and Pookie will have told them their parents were already seeing their health info "by default." That contradiction will erode trust in the app the moment real care begins.
2. **It risks care avoidance.** This is the well-documented clinical effect: adolescents and young adults withhold sensitive health information (sexual health, contraception, STIs, mental health, substance use, psychiatric medications, eating disorders) when they are not confident of confidentiality. Default-ON parental visibility at 18 means the young adult either stops entering honest data into Pookie's health modules or — worse — enters it unaware a parent can see it. The second failure mode is a safety event, not a UX nit.
3. **The app is not a covered entity, but the principle still bites.** Correct, HIPAA does not legally bind Pookie. But two things do: (a) user expectation — families *will* treat Pookie health sharing as equivalent to medical access; (b) downstream effects — health data exported or read from Pookie will be acted on as if authoritative. And the spec's own FERPA note ("rights transfer to the student at 18; student-in-control model is compliant") shows the spec already accepts that 18 transfers control for education records. Health deserves at least the same treatment — clinically, stricter.

### §4 — "parent keeps what they already saw" (historical data) — ⚠️ PASS with conditions

Legitimate: data entered while the child was a minor, under valid parental stewardship, is a valid part of the health history. Revoking future access while retaining history is the right split. Condition: at 18 the young adult must be able to **review, correct, and seal** parent-entered entries (see spec change 2). Parent-entered vaccination dates, conditions, and allergy lists are notoriously inaccurate — an unreviewed, parent-authored allergy/medication list carried into adult care is a patient-safety hazard (wrong allergy → wrong antibiotic; omitted med → interaction).

### §3 — Access authority matrix — ⚠️ PASS, but incomplete for health

The child-as-authority rule is clinically sound. Missing: **sensitive health categories need their own row.** In most states, minors 13+ already hold independent consent rights for specific care (contraception, STI testing/treatment, mental-health counseling, substance-use treatment — with 42 CFR Part 2 imposing especially strict rules on SUD records). That means for some health data, parents may never have had a right of access *before* 18. Carrying that data forward under "continuity by default" doesn't just continue access — it may grant access that never legally existed. The matrix needs a health-category carve-out, not just an age-tier rule.

### §4 13–15 — "I understand Mom/Dad can see [grades, check-ins, health]" — ⚠️ PASS with conditions

"Health" as one undifferentiated checkbox is insufficient. The consent must enumerate: general health (vaccinations, conditions, allergies) vs. sensitive health (mental health, sexual/reproductive health, substance use). A teen consenting to "health" visibility may be picturing their vaccination record, not their therapy notes.

### §6 — "Go independent" (13–17) — ⚠️ PASS with conditions

The graduation framing is good. Missing the health dimension: when a 16–17-year-old goes independent, the app should trigger the same health-data review/seal flow proposed for 18 (spec change 2), plus designate emergency contacts (spec change 4). Independence without an emergency-info plan is a safety gap.

### §9 — API surface — ⚠️ PASS with conditions

`graduateAt18(childId)` needs health-specific behavior: it cannot be a single "prompt, not suspension" call for all categories. Recommend splitting into category-scoped consent: `graduateAt18Health(childId)` with distinct semantics (pause-and-prompt, not continuity). Also needs `confirmHealthRecord(childId)` (review/correct/seal) and `setEmergencyContacts(childId)`.

### §10 — UI screens — ⚠️ PASS with conditions

The 18th-birthday prompt (screen 5) must not be a single keep/change toggle. Health needs its own explicit decision surface — a young adult tapping "Keep as is" in a hurry must not accidentally re-authorize parental access to health data they haven't thought about.

### §11 — Risks & mitigations — ❌ FAIL (incomplete)

Risk table covers consent, COPPA, blended families, harassment, duplicates, escalation, 18-transition disputes, non-parent UX. **No row addresses health-data sensitivity, false medical-authority assumptions, emergency access after revocation, or inaccurate parent-entered clinical data.** These are the highest-severity risks in the health domain and they're absent.

---

## 2. Concrete spec changes (quote → replacement)

### Change A — §4, 18+ section: carve health out of "continuity by default"

**Quote:**
> ### 18+ — Ownership with continuity (locked 2026-10-12)
> - **Parents who had access keep access by default.** No birthday disruption.
> - First login after 18th birthday shows one prompt: "You're an adult now — your Pookie is fully yours. [Mom ✓] [Dad ✓] can see your info. Keep as is, or change it anytime." [Keep as is] / [Review sharing].
> - Skipping = continuity.

**Replacement:**
> ### 18+ — Ownership with continuity (locked 2026-10-12)
> - **Parents who had access keep access by default — except health data.** Grades, check-ins, and school records continue uninterrupted ("no birthday disruption"). **Health data is carved out:** on the first login after the 18th birthday, parental access to *new* health entries is **paused until the young adult explicitly re-consents**, per category (see Health transition, §4a). Historical health data remains visible to parents for a **30-day grace period**, then restricts automatically unless re-consented.
> - First login after 18th birthday shows a two-part prompt: (1) general: "You're an adult now — your Pookie is fully yours. [Mom ✓] [Dad ✓] can see your info. Keep as is, or change it anytime." [Keep as is] / [Review sharing]; (2) health (separate screen, cannot be skipped without an explicit choice): "Your health info is private by default now — just like at a doctor's office. Who should see new health entries?" [Just me] / [Mom too] / [Dad too] / [Review each category].
> - The health decision is never inherited from the general "Keep as is." Skipping the *general* prompt = continuity for non-health data; the *health* prompt requires an explicit tap.
> - **Pookie sharing is not medical authority.** The health screen carries a plain-language line: "Seeing health info in Pookie doesn't make someone your medical decision-maker. If you want a parent to help with medical decisions, set up a healthcare proxy — we'll walk you through it." (§4a)

### Change B — §4: new subsection "4a. Health transition at 18"

**Quote:** *(new section — no existing text to replace; insert after the 18+ bullet list)*

**Replacement (insert as §4a):**
> ### 4a. Health transition at 18 (new)
> - **Health record review.** Before or at the 18th-birthday prompt, the young adult gets a "Review your health record" flow: every parent-entered entry (conditions, allergies, medications, vaccinations, surgeries) is shown with a provenance badge ("entered by Mom, 2024 — unconfirmed") and three actions per entry: **Confirm** (it becomes adult-verified), **Correct** (edit with audit trail; original preserved in history), **Remove** (soft-delete; retained in audit log, hidden from views). Entries never confirmed remain badged "unconfirmed — review before relying on." The flow is completable in stages, not one sitting.
> - **Health summary export.** One-tap export of the confirmed record (conditions, medications with dosages, allergies, immunizations, surgeries, screenings) as PDF + FHIR-friendly JSON, designed to hand to a new adult provider.
> - **Find an adult provider.** Prompt to establish adult primary care: "Pediatric care usually ends at 18–21. Want help finding an adult primary-care doctor and transferring your records?" (informational nudge + export handoff; not a provider directory v1).
> - **Medication list handoff.** Medications get special treatment: the review flow flags the medication list as "verify with your doctor or pharmacist" — parent-entered meds/doses are the highest-risk inaccurate data.
> - **Healthcare proxy, not default access.** Replace assumed parental medical authority with the real mechanism: an in-app explainer + checklist for designating a healthcare proxy / signing a HIPAA authorization at their provider. This is the correct legal channel for "Mom still helps at doctor visits."

### Change C — §11: add health risk rows

**Quote:** *(append to the risks table)*

**Replacement (append rows):**
> | 9 | Default parental health access at 18 contradicts medical privacy norms → care avoidance, false authority assumptions | Health carve-out: pause-and-prompt, never continuity (§4, §4a); "not medical authority" disclosure |
> | 10 | Inaccurate parent-entered clinical data (allergies, meds, vaccines) carried into adult care | Provenance badges + adult review/confirm/correct flow; med list flagged "verify with clinician" (§4a) |
> | 11 | Young adult revokes parents → no one reachable in a medical emergency | Emergency info is a separate category: user-designated emergency contacts + offline ICE card, independent of parental access (§4b) |
> | 12 | Sensitive-category data (mental/sexual/substance-use health) shared under blanket "health" consent, incl. data parents may never have had a right to see | Sensitive health sub-categories with independent consent toggles; pre-18 consent screen enumerates them separately |

### Change D — §4: new subsection "4b. Emergency info (all ages)"

**Quote:** *(new section)*

**Replacement (insert as §4b):**
> ### 4b. Emergency info — independent of parental access (new)
> - **Emergency info is its own data category**, not a subset of "health sharing": allergies, conditions, current medications, blood type (if known), insurance card, and user-designated emergency contacts.
> - **Revoking a parent never revokes emergency access.** The young adult designates who may see emergency info (default suggestion: the people they trust most — often still a parent — but it is *their* designation, made explicitly).
> - **Offline ICE card.** Emergency info is available on the young adult's device without login (lock-screen-adjacent in-app card) and as a printable wallet card / QR code. Rationale: the person rendering aid in an emergency is usually a stranger, not someone with Pookie access.
> - **At 18, the emergency-contact designation is part of the health prompt** (§4a): "If something happened to you, who should doctors call?" — with the explicit note that this is separate from who can browse health entries day-to-day.

### Change E — §3 matrix: sensitive-health row + §4 13–15 consent enumeration

**Quote (§3):** *(append row to the authority matrix)*
> | Sensitive health categories (mental, sexual/reproductive, substance-use) | visibility follows the teen's independent consent; parental access requires the teen's explicit per-category grant at 13+ | ⬜ new |

**Quote (§4, 13–15):**
> - Informed consent on first link: explicit "I understand Mom/Dad can see [grades, check-ins, health]" checkbox in the teen's own session — not a passive click.

**Replacement:**
> - Informed consent on first link: explicit checkboxes in the teen's own session — not a passive click — listing each category separately: grades, check-ins, **general health (vaccinations, conditions, allergies)**, and **sensitive health (mental health, sexual/reproductive health, substance use)**. Sensitive health defaults to teen-only; parental visibility requires a separate explicit opt-in per sub-category, and the teen is told in plain language that in many states they have independent privacy rights over this care.

---

## 3. Feature improvements (beyond spec edits)

1. **Transition-readiness timeline (16→18).** Don't compress the health handoff into a single 18th-birthday prompt. Start at 16–17 with lightweight nudges: "At 18 your health info becomes fully private — here's what to know," culminating in the §4a flow. Mirrors clinical transition-of-care guidelines (which start transition planning at 14–16, not on the birthday).
2. **Provider-handoff packet.** The §4a export should generate a clinician-ready one-page summary (problem list, med list with doses, allergies, immunization record, last screenings) — the artifact adult PCPs actually want at a new-patient visit.
3. **"Verify with your clinician" loop.** After the young adult confirms their med/allergy list, offer to mark it "clinician-verified" with a date — creating a provenance chain (parent-entered → adult-confirmed → clinician-verified) that any future provider can trust.
4. **Insurance/EOB privacy notice.** At 18, warn the young adult: if they're on a parent's insurance plan (common to age 26), explanation-of-benefits letters for their visits may still go to the policyholder. Pookie can't fix that, but a 30-second explainer prevents a nasty surprise — especially for sensitive care.
5. **Confidential-care mode (13–17).** Let teens tag individual health entries as "just me" even while parents have general health access — reflecting state minor-consent law and reducing the incentive to keep a second, secret record outside the app (fragmented records are worse than private ones).
6. **Annual re-consent nudge (18+).** Once a year, a quiet prompt: "Still want [Mom] seeing your health entries?" — because consent given at 18 on a birthday high may not reflect the 21-year-old's wishes, and the spec's "instantly reversible" only works if the user remembers the setting exists.

## 4. Gaps (things the spec doesn't address at all)

1. **No definition of "health data" scope.** The spec says "health" in two places (§4 teen consent, §7 "just me" dashboard) without scoping it. Mental-health chat logs with the Pookie AI? Symptom searches? Medication reminders? The carve-out needs a data-category taxonomy — otherwise engineers will implement "health = the Health module tab" and miss the sensitive data living in chat, journaling, and reminders.
2. **Deceased/incapacitated edge.** If the young adult is incapacitated, who sees health data? The spec's authority model assumes a competent actor. A healthcare-proxy designation (§4a) partially answers this, but the spec should state the app's behavior (e.g., emergency-info category remains available to designated contacts; full record does not auto-open).
3. **Parent-entered data about the parent's own health.** Family health history (e.g., "Dad has hypertension") is clinically valuable and parent-entered — but it's the *parent's* health data living in the *child's* record. At 18, does it stay? Who consents? Unaddressed.
4. **Multi-child / caregiver asymmetry.** A parent may retain health access to an 18-year-old with an intellectual/developmental disability where guardianship exists. The spec's uniform "child is the authority" model needs a guardianship exception path — flagged for legal, but the medical reviewer notes it because this population is exactly where abrupt default cutoffs cause harm.
5. **No audit-trail requirement for health.** Corrections to clinical data (Change B) need immutable history. The migrations (§8) define access tables but no health-record versioning. Recommend `health_record_versions` or equivalent in the schema plan.
6. **42 CFR Part 2 exposure.** If Pookie ever stores substance-use treatment records, federal law imposes consent requirements *stricter than HIPAA* — including a prohibition on re-disclosure without specific consent. The spec should commit now to never co-mingling SUD data under general health consent, or it will inherit a compliance obligation it didn't plan for.

## 5. Reassessment flags (revisit when…)

- 🔁 **When health modules are specified** (data taxonomy, chat-log retention, symptom tracking): re-run this review against the actual data model — the carve-out's boundaries depend on what "health data" turns out to include (Gap 1).
- 🔁 **Legal review of the 30-day historical grace period** (Change A): the clinical recommendation is a grace period to avoid care disruption; counsel should confirm no state law treats continued parental visibility of an adult's health data as a violation, and confirm the guardianship exception (Gap 4).
- 🔁 **When the healthcare-proxy feature is designed**: verify the explainer's legal accuracy state-by-state (proxy/advance-directive law varies); consider partnering with a legal-template provider rather than drafting in-house.
- 🔁 **If Pookie ever integrates with providers/EHRs (FHIR, patient portals)**: the "not a covered entity" assumption may change — full HIPAA analysis required at that point, and the carve-out becomes a legal requirement, not just a clinical recommendation.
- 🔁 **Annual:** re-validate the sensitive-category list against evolving state minor-consent statutes.

---

## Bottom line for the parent orchestrator

**Block the health portion of §4's "continuity by default" as currently written.** It is the single highest-severity clinical issue in this spec. The fix is contained: health gets pause-and-prompt at 18 (Change A), a record-review + export + proxy flow (§4a / Change B), emergency info as an independent category (§4b / Change D), sensitive-category consent granularity (Change E), and four new risk rows (Change C). Grades and school data can keep continuity — that split is the carve-out, and it mirrors exactly how the real healthcare and education systems already treat the 18th birthday differently.
