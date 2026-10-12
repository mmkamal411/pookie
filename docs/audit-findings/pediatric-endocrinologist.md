# Expert Review — Pediatric Endocrinology
**Reviewer role:** Pediatric endocrinologist (adolescent growth, puberty, menstrual health, weight/BMI)
**Date:** 2026-10-12
**Scope:** `USER-FIRST-ACCESS-MODEL-SPEC.md` + `FEATURE-LIST-FOR-PANEL.md` (all 8 categories), Georgia as starting jurisdiction

**Clinical standards cited:** AAP *Bright Futures* 4th ed. (confidential adolescent care from ~11–12, private interview time); SAHM Position Paper on Confidential Health Care for Adolescents (2016); ACOG Committee Opinion No. 651 — *Menstruation in Girls and Adolescents* (menses as a vital sign; evaluate primary amenorrhea if no menses by age 15 or >3 years post-thelarche); Endocrine Society CPGs (precocious puberty: development <8 y girls / <9 y boys; delayed puberty workup: no development by 13 girls / 14 boys); CDC/WHO growth-chart interpretation guidance; AAP Clinical Report *Identification and Management of Eating Disorders in Children and Adolescents* (2021 — discourage weight-focused framing; never present BMI as a personal verdict).

---

## PART A — ACCESS-MODEL SPEC: SECTION VERDICTS

### §3 Child access authority matrix
**⚠️ Needs change.** The matrix is binary per person (grant = see everything). There is no category scoping, yet the consent language in §4 promises a "what's-visible list." A single grant covering grades *and* menstrual logs is clinically unacceptable: parental authority over school records does not extend to a teen's reproductive data. SAHM and AAP both hold that adolescents are entitled to confidential management of reproductive health information. The matrix must be category-aware (see Change 4).

### §4 Age tiers — 13–15 consent language
**🛑 Blocked as written.** Quote: *"I understand Mom/Dad can see [grades, check-ins, health]" checkbox.* "Health" as a single coarse blob is the spec's central clinical failure. It folds sleep data, growth charts, puberty milestones, weight, and menstrual tracking into one word the teen cannot meaningfully consent to. A 13-year-old consenting to share "health" almost certainly means "my sleep and steps," not "my period log." Replace with decomposed consent (Change 1).

### §4 Age tiers — 13–15 cooling-off on parent revoke
**🛑 Blocked as applied to sensitive health.** A 7-day cooling-off with both parents *notified* creates a forced-visibility window over exactly the data class most at risk of misuse (cycle data usable for pregnancy surveillance; puberty data usable for shaming/coercion). The safety logic of cooling-off (prevent impulsive grade-hiding) inverts for reproductive data: delay *increases* harm. Revocation of Body & development visibility must be instant at every teen age (Change 4).

### §4 Age tiers — 18+ continuity default
**🛑 Blocked for one category.** *"Parents who had access keep access by default"* applied to menstrual/puberty/weight history means a parent retains a young adult's full reproductive history unless the new adult affirmatively revokes it. Clinically and ethically fraught; FERPA transfer at 18 reflects the principle that the adult owns this information. Continuity default is fine for grades and general wellness; Body & development requires a fresh explicit grant (Change 3). Also note *"Historical data: parent keeps what they already saw"* — for cycle logs this means a permanent parent-held menstrual history of an adult child. Recommend sealing cycle *detail* at 18 (summary counts only).

### §4 Age tiers — under 13 stewardship
**⚠️ Needs change.** Parent-managed tracking of growth and (for early developers) puberty/menarche data is legitimate pediatric practice — but the spec has no "seals at 13" rule. Parent-entered puberty/menstrual data must auto-transfer to the teen's private vault when the child links at 13+, with parent visibility requiring a new explicit teen grant. Without this, a parent who tracked a 10-year-old's early periods keeps cycle visibility into the teen's adolescence by inertia.

### §6 "Go independent" · §5 linking · §7 "just me"
**✅ Clear** from my domain (13–17 graduation framing, link codes, block list are all compatible with adolescent health privacy). Note: the teen's *own* Pookie from "go independent" is the natural home of the private health vault (§B, improvement 1).

### §8 Migrations · §9 API surface
**⚠️ Needs change.** `child_access` is per (child, adult). There is no column or table representing *what* the adult may see. Add category scoping (Change 5). API list has no health endpoints yet — when they arrive they must enforce scope server-side; the §1 principle "the client never derives roles" must extend to "the client never derives health scope."

### §10 UI screens — Sharing screen
**⚠️ Needs change.** "Per-person toggles, what's-visible list" is the right skeleton, but the spec never defines granularity. The screen must show two health rows — *General wellness* and *Body & development* — with the latter defaulting to teen-only and revocable instantly.

### §11 Risks & mitigations
**⚠️ Needs change.** None of the 8 risks covers reproductive-data misuse, forced-exposure windows, or HealthKit cycle-data misclassification. Add rows (Change 6).

### Alignment with the Guidance framework's puberty rules
The framework (`age-tiers-in-practice.md`) already treats puberty content as sensitive (13–15: parent gets a *topic-area digest note*, never verbatim transcript). The access model should mirror that tiering for *data*: topic-level awareness for parents where appropriate, raw logs teen-private. Current spec contradicts its own framework by making raw "health" shareable.

---

## PART B — CONCRETE SPEC CHANGES (quote + replacement)

**Change 1 — §4, 13–15 informed consent (decompose "health").**
> Quote: "Informed consent on first link: explicit "I understand Mom/Dad can see [grades, check-ins, health]" checkbox in the teen's own session — not a passive click."
> Replacement: "Informed consent on first link: an explicit, itemized checkbox list in the teen's own session — not a passive click. Health is decomposed: ☐ Grades ☐ Check-ins ☐ General wellness (sleep, activity) — and separately, ☐ Body & development (growth charts, puberty milestones, menstrual tracking, weight), which is **unchecked by default** and requires its own affirmative opt-in. The screen states in plain words what each category contains."

**Change 2 — §4, new subsection "Sensitive health categories" (insert after the 13–15 tier).**
> New text: "### Sensitive health categories. All health data is classified server-side as **General wellness** (sleep, steps, activity, mood aggregates) or **Body & development** (height/weight/growth charts, BMI, puberty milestones, menstrual cycle data, body-composition metrics). Body & development data is **teen-private by default from age 13** regardless of who entered it. It becomes parent-visible only by an explicit, separately revocable teen grant. Revocation of a Body & development grant is **instant at all teen ages** — the 7-day cooling-off does not apply. Parent-entered Body & development data for a pre-13 child **seals to the teen's private vault** when the child links their own login at 13+; the parent's prior visibility does not carry over."

**Change 3 — §4, 18+ continuity carve-out.**
> Quote: "Parents who had access keep access by default. No birthday disruption."
> Replacement: "Parents who had access keep access by default — **except Body & development data** (growth charts, puberty milestones, menstrual tracking, weight history), which requires a fresh explicit grant from the adult child. The 18th-birthday prompt lists this category separately with its own checkbox, **defaulting to off**, and states what it contains. Historical detail: on revoke or on the 18th birthday without a fresh grant, parents retain only summary counts (e.g., 'tracked 2024–2026'), not cycle-by-cycle logs. No birthday disruption applies to grades and general wellness."

**Change 4 — §3 matrix, add row.**
> New row: "| Revoke access to Body & development data | ✅ instant, any age, no cooling-off | ❌ | ❌ |" — plus a scoping rule: "Grants carry a scope: `general` (grades, check-ins, general wellness) or `body_development`. A parent holding a `general` grant sees no Body & development data. Scope is stored per row and enforced in every revoke/grant RPC."

**Change 5 — §8 migrations, add 021.**
> New row: "| `021_health_scopes.sql` | `child_access.scope` ('general','body_development') NOT NULL DEFAULT 'general'; backfill existing rows as 'general'; RLS + RPC enforcement that `body_development`-classified rows are invisible to `general` holders; `seal_at_13` job transferring pre-13 parent-entered Body & development rows to teen-private on first teen login. |"

**Change 6 — §11 risks, add rows.**
> 9. "Reproductive-data coercion (cycle logs used for pregnancy surveillance or shaming)" → "Body & development category; teen-private default; instant revoke; no raw logs in parent digests." 10. "Forced 7-day visibility window on revoke" → "Cooling-off exemption for Body & development (Change 4)." 11. "HealthKit/Health Connect cycle data auto-imported as generic 'health'" → "Source classifier tags cycle/reproductive samples as Body & development at ingestion; never parent-visible without teen grant."

---

## PART C — FEATURE IMPROVEMENTS (domain-specific)

1. **Teen private health vault.** The teen's own Pookie (including post-"go independent") holds a private vault for Body & development data. The parent dashboard shows only a presence indicator ("tracking active") plus general-wellness aggregates — never cycle detail, never growth numbers.
2. **Growth charts done right.** Show *trend bands* (percentile channels), never raw BMI/z-score numbers to minors or as parent glanceables. A clinician-share "visit summary" export (PDF) for the pediatrician is the high-value feature — it routes interpretation to the professional. Flag growth-velocity deceleration (crossing ≥2 percentile lines) as a *routing* event ("worth mentioning at your next checkup"), never a diagnosis — consistent with the PE/Health module's educate-never-diagnose boundary.
3. **Cycle tracking designed for adolescents.** Period prediction for planning is legitimate; **fertility-window/conception-oriented features must not exist for minors.** No cycle data in parent digests, no shared family calendar entries, local-first storage option, one-tap full deletion by the teen.
4. **ED-aware wiring across W2/W22/W23.** Sudden logged-intake drops + weight-trend decline + compulsive exercise patterns (extreme streaks, no rest days) should feed the existing guidance-framework tripwire system: supportive, non-accusatory routing to parent/clinician — the same tier-2 escalation path as eating-disorder behavior disclosure in chat. Modules must not each invent their own thresholds.
5. **W23 nutrition guardrails for minors.** No calorie budgets or weight-loss goals for <18 without a clinician-guided plan flag; protein targets anchored to the RDA (0.85 g/kg/day for 14–18), not fitness-influencer targets; "dietary" in W28 means allergies/medical/preference — never weight-loss diets for teens.
6. **W22 rest-day normalization.** Streaks must not punish rest; cap streak framing for minors; surface RED-S (relative energy deficiency in sport) education when training volume is high and energy intake is low — growth and puberty are the first casualties of chronic energy deficit, which is squarely endocrine.
7. **Parent-entered data provenance.** Every Body & development row stores `entered_by`; rows entered by a parent before the child turned 13 display a "sealed at 13 — now private to [teen]" transition notice to both parties. No silent carryover.
8. **Pediatrician handoff, not parent handoff, for red flags.** Delayed puberty (no breast development by 13 / no testicular enlargement by 14), precocious signs (<8 girls / <9 boys), no menarche by 15 or >3 years post-thelarche, rapid weight change, hirsutism/virilization, galactorrhea → route to clinician with a one-tap "prepare visit summary," with the teen choosing whether the parent is looped in (13+). This is the endocrine analogue of the chat tripwire system and should reuse its plumbing.

---

## PART D — GAPS (not covered by spec or feature list)

1. **No menstrual-tracking feature is named, yet W2 ingests HealthKit/Health Connect — cycle data will arrive implicitly.** The privacy design must precede the ingestion, not follow it.
2. **No endocrine red-flag list anywhere in the health module design** (PE/Health §7 says red-flag scripts belong in the health module with professional oversight — the module spec doesn't have them yet).
3. **No deletion story for sensitive health data.** "Data retention policies (per-source; emails TBD)" — menstrual and puberty data need an explicit teen-controlled deletion right and a defined retention ceiling, not "TBD."
4. **No clinician role in the access model.** The authority matrix covers child/parent/other-adult. A pediatrician/endocrinologist with whom the teen shares a visit summary has no defined access path — worth designing (time-boxed, teen-granted, read-only).
5. **State-law variance unaddressed.** Georgia minor-consent law gives minors independent consent rights over certain reproductive-health care; the access model should not promise parents visibility the law may not support. Flag for legal review before any cycle feature ships.
6. **Emergency module (W19) vs. teen privacy.** A teen with an endocrine condition (e.g., type 1 diabetes, adrenal insufficiency) needs emergency info parent/paramedic-visible — carve emergency medical data out of the teen-private default explicitly, so safety doesn't collide with privacy.
7. **Co-parenting (W14) weaponization risk.** In high-conflict two-household cases, a parent could use shared-dashboard health data against the other parent or the teen. W14 must inherit the child's grant scopes; co-parent visibility into Body & development follows the teen's grant, never defaults.

---

## PART E — REASSESSMENT FLAGS (need Mehedi's explicit re-decision)

1. **"Locked" 18+ continuity default as applied to menstrual/puberty history** — recommend carve-out (Change 3). This is the single highest-risk line in the spec; "parent keeps what they already saw" should not produce a permanent parent-held menstrual history of an adult child.
2. **7-day cooling-off exemption for Body & development revocation** (Change 4) — the cooling-off rule is sound for grades; it is unsafe for reproductive data. Needs an explicit exception, not silent omission.
3. **"Seals at 13" for parent-entered puberty/menstrual data** (Change 2) — this reverses an intuitive parental expectation ("I entered it, it's mine"); Mehedi should confirm the principle that the teen's body data belongs to the teen from 13.
4. **Blocked features list (Part F) contains items a growth-stage startup might be tempted to build** (growth prediction, BMI glanceables). Confirm these stay out of the roadmap.

---

## PART F — FEATURE-BY-FEATURE MARKS (my domain)

**1. Core Platform:** Google OAuth/magic link ✅ · session middleware ✅ · onboarding ✅ · 5-tab nav ✅ · child switcher ✅ · Nebula theme ✅ · `/verify-invite` ✅. ⚠️ Onboarding "add children" should disclose the seals-at-13 rule when a birthdate <13 is entered, so parents aren't surprised later.

**2. Pookie AI Assistant:** Chat + Muse toggle ⚠️ — puberty Q&A follows the guidance framework (factual, brief, topic-digest to parent); ensure the *health module* honors the same boundary (raw logs ≠ digest notes), or the product contradicts itself. Teacher threads ✅ · proactive nudges ⚠️ — nudges must never surface Body & development content (no "log your period" push notifications visible on a shared lock screen; no weight nudges to minors).

**3. Today ritual:** Morning attention items ⚠️ — exclude all Body & development metrics from parent-visible and teen glanceable surfaces. Tonight's plan ✅ · check-in cross-check ✅ (non-accusatory tone is the clinically correct stance for weight/appetite disclosures too).

**4. Modules — Body & Heart:**
- **W2 Health: ⚠️ needs change.** Vitals/trends/glanceables are fine for general wellness; growth/puberty-adjacent metrics need the Body & development classification, no raw BMI to minors, no self-Tanner, cycle-data ingestion guardrails, red-flag routing (Part C.8). "Teen health privacy tiers per Guidance framework" is the right pointer — now implement it as data classification, not just chat policy.
- **W8 Wellbeing: ✅** (teenPrivate is exactly right; mood aggregates are the correct parent-visible unit).
- **W13 Meals: ✅** (planning, not restriction — the safe framing).
- **W22 Activity: ⚠️** — streaks need rest-day normalization and compulsive-exercise guardrails for minors; wire extreme patterns into the ED tripwire (Part C.4). Fitness-tracker connections must classify imported body metrics.
- **W23 Nutrition: ⚠️** — "protein, balance" is the right frame; add: no calorie budgets/weight-loss goals for <18 without clinician flag; RDA-anchored protein targets; intake-drop tripwire; W28 "dietary" ≠ teen dieting.
- **Home & Family grove (W21/W20/W11/W7/W24): ✅** all clear. **W14 Co-parenting: ⚠️** — must inherit child grant scopes; no default Body & development visibility across households (Part D.7). **W12/W10: ✅.**
- **School Days (W1/W16/W5/W4/W18): ✅** from my domain. Note: PE/health *class content* (Learn side) already carries correct guardrails (PE/Health §2, §7); keep the Learn-vs-health-module boundary intact.
- **Safe & Sound (W3/W19): ⚠️** — W19 emergency plan needs an explicit carve-out: emergency endocrine/medical info (diabetes, adrenal insufficiency) must be reachable by parents/paramedics even under teen-private defaults (Part D.6).
- **Growing Up (W6/W15/W17): ✅** (W17 teenPrivate correct).
- **Out & About (W25–W31): ✅** all clear.

**5. School Intelligence: ✅** — no endocrine concerns; the 13-source model and teacher-inbox merge don't touch Body & development data.

**6. Family & Access Management:** email invites ✅ · link codes ✅ · `granted_by` enforcement ✅ · age tiers ⚠️ (per Part A) · Sharing screen ⚠️ (needs the two health rows) · access requests ✅ · block list ✅ · go-independent ✅ · 18-prompt ⚠️ (needs Change 3) · `graduate_child_access` ⚠️ (must transition scopes, not just preserve access) · claim dedupe ✅.

**7. Settings & Data:** Health connections ⚠️ (classify HealthKit/Health Connect cycle & body samples at ingestion) · Sync console ✅ · Credentials vault ✅ · Notification prefs ⚠️ (sensitive-health notifications must be discreet/private) · **Data retention: ⚠️** — "TBD" is unacceptable for menstrual/puberty data; needs teen-controlled deletion + retention ceiling.

**8. API Platform:** No health endpoints yet — ✅ for now, ⚠️ as a design constraint: when `/api/v1/children/[childId]/health/*` arrives, every route must enforce `child_access.scope` server-side; document this requirement in the API spec now so it isn't retrofitted.

---

## PART G — FEATURES THAT SHOULD NOT EXIST (🛑 blocked, minors)

1. **Self-administered Tanner staging / puberty-stage self-quizzes.** Tanner staging is a clinical exam finding; self-assessment is unreliable, privacy-invasive, and clinically useless. Do not build.
2. **Raw BMI, BMI z-score, or percentile numbers shown to minors or as parent glanceables.** Trend bands + clinician routing only. (Reinforces PE/Health §2.)
3. **Weight-loss goals or calorie budgets for <18** without a clinician-guided plan flag.
4. **Fertility-window / conception-oriented cycle features for minors.** Period prediction for planning: fine. Ovulation-as-fertility: adult-only.
5. **Photo logging of breast/genital development.** Prohibit explicitly in the health-module spec — this is both a clinical and a child-safety (CSAM-adjacent) line.
6. **Adult-height prediction marketed as a goal or verdict** for minors. Midparental-height education with wide confidence bands is the most that is defensible; a single-number "predicted adult height" invites misuse.

---

**Bottom line:** the access model's child-as-authority architecture is the right foundation, and the guidance framework's conversation-privacy tiers are clinically sound. The gap is that *data* privacy doesn't match *conversation* privacy: "health" is one coarse word in the spec, and inside that word sit menstrual logs, puberty milestones, growth charts, and weight — the most sensitive data a family app will ever hold. Decompose the category, default it to teen-private, exempt it from cooling-off, carve it out of 18+ continuity, seal pre-13 parent entries at 13, and prohibit the six blocked features above. Everything else in the feature list is clear or needs only the guardrails noted.
