# Panel Review — Internal Medicine / Transition Medicine
**Reviewer role:** Expert internal medicine physician (adult primary care)
**Date:** 2026-10-12
**Specs reviewed:** `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12) · `docs/FEATURE-LIST-FOR-PANEL.md`
**Jurisdiction:** Georgia (starting)

---

## 0. Frame: what my domain owns here

As an internist, I own: the **pediatric→adult care transition** (my daily work receiving 18–26-year-olds with no records, no PCP, and parents still calling for results), **confidentiality norms for health information**, **clinical safety of consumer health features** (vitals, emergency plans, nutrition, mood), and **what "adequate" looks like** for health-adjacent features (insurance, emergency, AI health advice).

Two precision notes before verdicts:

1. **HIPAA scope.** Pookie as described is a consumer app, not a HIPAA covered entity (no provider/health-plan/clearinghouse function). So "adult HIPAA rights" do not *legally* attach to Pookie itself. But that is not exonerating: the app will hold PHI-grade data (often exported from covered entities), user trust assumes HIPAA-equivalent handling, state law and the ONC Cures Act information-blocking ethos shape expectations, and any future EHR/FHIR integration could create business-associate obligations. My verdicts apply the *principle* HIPAA embodies — **the adult patient is the authority over their own health information** — as a clinical-ethical requirement, not just a legal one.
2. **Data-access authority ≠ medical consent authority.** Until 18, the legal guardian (not the child, not the app's grant matrix) authorizes medical *treatment* in Georgia. The spec's "child is the access authority" governs *app data visibility* and must never be presented as conferring or removing medical decision-making power.

**Headline verdict:** The access model is well-built for grades and household data. **Applied to health data, the 18+ "continuity by default" is clinically and ethically unsound and must not ship as designed** (🛑, §4). Health needs a different 18+ default: **affirmative opt-in re-consent**, plus a real transition-of-care track. Details below.

---

## 1. ACCESS MODEL — verdict per spec section

| § | Section | Verdict | One-line reason |
|---|---|---|---|
| 1 | Product principles | ⚠️ needs change | Missing health-confidentiality principle; principle 2 needs a medical-consent caveat |
| 2 | Signup & onboarding | ⚠️ needs change | No health-privacy notice; onboarding is the moment to set category expectations |
| 3 | Authority matrix | ⚠️ needs change | Grants are all-or-nothing; health needs category scoping + heightened bar for non-guardian adults |
| 4 | Age tiers — 13–15 / 16–17 | ⚠️ needs change | Treats health like grades; GA minor-consent carve-outs require teen-private categories pre-18 |
| 4 | Age tiers — 18+ continuity | 🛑 **blocked** | "Skipping = continuity" for health data violates adult informational self-determination; must be opt-in re-consent |
| 5 | Child linking | ✅ clear | Consent screen must enumerate health categories (minor change, covered in §4 fix) |
| 6 | "Go independent" | ⚠️ needs change | Graduation without a health handoff strands the teen clinically |
| 7 | "Just me" mode | ✅ clear | No clinical concern |
| 8 | Migrations 017–020 | ⚠️ needs change | No category-scoped access, no health-access audit log |
| 9 | API surface / RPCs | ⚠️ needs change | Grant/revoke/graduate RPCs need category scope; `graduateAt18` needs a health re-consent flow |
| 10 | UI screens | ⚠️ needs change | Sharing screen needs per-category health toggles; 18th-birthday prompt needs a health-specific screen |
| 11 | Risks & mitigations | ⚠️ needs change | Zero health-specific risks listed; add 5 rows (proposed below) |

### 1a. The 18+ question, answered directly

**Does "continuity by default" for health data conflict with adult patient rights?** Yes — in substance, and in ways that will cause real harm:

- **Clinical ethics (AMA Code 3.2.2 / adolescent-to-adult confidentiality):** at 18 the patient is the sole authority over disclosure of their health information. A design where *inaction* (skipping a prompt) perpetuates parental surveillance of an adult's health data inverts informed consent. Consent requires an affirmative act; "we told them once and they didn't object" is not consent — it is exactly the dark pattern regulators and ethicists condemn.
- **Georgia reality check:** at 18 the young adult signs their own HIPAA authorizations at every new practice, consents to their own treatment, and executes their own advance directive. Pookie silently carrying forward parental health-data access while every real-world door re-locks is incoherent and will confuse families at the worst moments (e.g., a parent seeing a young adult's STI test, mental-health med, or pregnancy-related entry they assumed was private).
- **Therapeutic alliance:** young adults who discover retroactive parental visibility into health data lose trust in the *app* and, by extension, in digital health tools generally. This is a patient-safety issue: it deters honest health tracking.
- **Pre-18 carve-outs compound it:** Georgia permits minors to consent to certain care themselves (e.g., STI treatment, O.C.G.A. § 31-17-7; federal 42 CFR Part 2 protects SUD records). If a 17-year-old's confidential entries flow to parents at 17 and then *continue by default* at 18, the app has built a pipeline that defeats statutory confidentiality.

**Should health have a different 18+ default than other categories?** Yes. Grades/homework continuity-by-default is a product judgment I leave to the education/legal panel. **Health must default to private at 18, with affirmative opt-in re-grant per category.** The prompt must not be skippable-into-sharing: skipping = private.

**Health summary export / new-provider prompts at 18:** Currently absent; clinically this is the single highest-value transition feature and its absence is a gap (see §4 Gaps). Minimum viable: one-tap **Transition Summary** (problem list, medications, allergies with reaction/severity, immunizations, last visits, insurance, emergency contacts) as PDF, generated at the 18th-birthday flow and re-generable anytime; plus a **new-provider checklist** (find adult PCP, request records transfer, sign new ROI/HIPAA forms at each new practice — releases do not transfer between practices — update pharmacy, verify insurance/dependent-to-26 status).

**Parent-entered historical data (vaccinations, conditions, allergies):** the young adult must get a **review–correct–seal** flow at 18: (a) *review* everything parents entered; (b) *correct* inaccuracies — clinically material, because a false penicillin-allergy label or a wrong "asthma" tag changes real prescribing and triage; (c) *seal* entries from parental view going forward (sealing ≠ deleting; the data remains for the patient's own care and export). This mirrors the HIPAA right to request amendment and the ONC patient-access ethos.

**Emergency info when parents are revoked:** revocation must never leave an empty emergency-contact slot. Design rule: **emergency contacts are a separate object from access grants.** When the last access-holding adult is revoked (or at 18+ health privatization), force a re-designation step: *"Mom can no longer see your health info. Who should we call in an emergency?"* The emergency card itself (allergies, meds, conditions, contacts) must be reachable **without app login** — a vault behind biometrics is invisible to EMS. Provide a lock-screen ICE card / QR code.

### 1b. Concrete spec changes (quote → replacement)

**Change 1 — §1, add a health principle (after principle 5):**
> QUOTE: "5. All access decisions are enforced server-side. The client never derives roles."
> REPLACE WITH: "5. All access decisions are enforced server-side. The client never derives roles.
> 6. **Health data follows clinical confidentiality norms, not household norms.** Data-access authority is distinct from medical consent authority (the legal guardian authorizes treatment until 18). Health-category access never continues by default at 18: it requires the adult's affirmative re-authorization. Some health entries a minor records may be legally confidential from parents even before 18 (minor-consent care); the app must support teen-private health categories at every tier."

**Change 2 — §4, 18+ subsection (the 🛑 fix):**
> QUOTE: "- **Parents who had access keep access by default.** No birthday disruption.
> - First login after 18th birthday shows one prompt: "You're an adult now — your Pookie is fully yours. [Mom ✓] [Dad ✓] can see your info. Keep as is, or change it anytime." [Keep as is] / [Review sharing].
> - Skipping = continuity. A quiet line persists in Settings → Sharing: "You're 18+ — you're in control here.""
> REPLACE WITH: "- **Non-health categories:** parents who had access keep access by default (continuity). First login after 18 shows the ownership prompt; skipping = continuity.
> - **Health category: no continuity. Health access defaults to private at 18.** First login after 18 shows a dedicated health screen: "Your health info is now private to you. [Mom] [Dad] previously saw: vaccinations, conditions, medications… [Keep sharing health with Mom] [Keep sharing health with Dad] — choose each, or [Make all health private]." **Skipping = private.** The choice is per-category (conditions / medications / immunizations / visits / mood), not all-or-nothing.
> - The same screen offers: [Review what Mom/Dad entered] (review–correct–seal flow), [Export my transition summary] (PDF), and the new-provider checklist (adult PCP, records transfer, new HIPAA releases, pharmacy, insurance).
> - Emergency contacts are re-designated independently of access grants; revoking the last access-holding adult triggers mandatory emergency-contact re-designation."

**Change 3 — §3, authority matrix (category scoping):**
> QUOTE: "| Grant access to a new adult | ✅ | ✅ | ❌ (may request) |"
> REPLACE WITH: same table, plus new rule beneath: "Grants are **category-scoped**: `health` · `school` · `general`. A grant defaults to the categories the granter selects; health-category grants to non-guardian adults additionally require (a) in-app notice to the legal guardian(s), and (b) teen re-confirmation after 24 hours. The matrix above applies per category; a teen may share grades with a coach while keeping health private."

**Change 4 — §4, 13–15 informed consent:**
> QUOTE: "Informed consent on first link: explicit "I understand Mom/Dad can see [grades, check-ins, health]" checkbox in the teen's own session — not a passive click."
> REPLACE WITH: "Informed consent on first link: per-category checklist in the teen's own session — "Mom/Dad can see: [x] grades [x] check-ins [ ] health details" — with plain-language disclosure that some health entries the teen records (e.g., care the teen consented to themselves under GA minor-consent law) stay teen-private by law and cannot be shared by toggling."

**Change 5 — §8, add migration:**
> QUOTE: "| `020_access_requests.sql` | `access_requests` (child_id, requester_id, status 'pending'/'approved'/'denied'/'blocked', reviewed_at). "Request access" flow for non-parent adults. |"
> REPLACE WITH: same row, plus: "| `021_health_access.sql` | `child_access.category` ('health','school','general') + backfill; `health_access_audit` (accessor_id, child_id, category, action, at) — append-only log of health-data views/grants/revokes, visible to the teen/adult child; `emergency_contacts` table decoupled from `child_access`. RLS: subjects read own rows; auditors read own subject's log. |"

**Change 6 — §9, graduate flow:**
> QUOTE: "- `graduateAt18(childId)` → fires on 18th birthday login; prompt, not suspension"
> REPLACE WITH: "- `graduateAt18(childId)` → fires on 18th birthday login; runs the 18+ ownership prompt (continuity for non-health) AND the health re-consent flow (health defaults private; per-category opt-in; review–correct–seal; transition-summary export; emergency-contact re-designation). Skipping any step = private for health.
> - `exportTransitionSummary(childId)` → generates the portable health summary PDF (problems, meds, allergies + reaction/severity, immunizations, last visits, insurance, emergency contacts).
> - `requestHealthAccess(childId, categories[])` → non-guardian health-access requests with guardian notice + 24h teen re-confirmation."

**Change 7 — §10, screens:**
> QUOTE: "3. Child Sharing screen — "Who can see my stuff?", per-person toggles, what's-visible list, approve/deny access requests, block adult" … "5. 18th-birthday prompt — one-time §4"
> REPLACE WITH: "3. Child Sharing screen — "Who can see my stuff?", **per-person × per-category toggles** (health sub-categories: conditions, medications, immunizations, visits, mood), what's-visible list with minor-consent carve-out disclosure, approve/deny access requests, block adult, **"who viewed my health info" audit view**. … 5. 18th-birthday flow — **two screens**: (a) ownership prompt (non-health continuity); (b) health re-consent + review–correct–seal + transition-summary export + emergency-contact re-designation (health defaults private; skip = private)."

**Change 8 — §11, add health risk rows:**

| # | Risk | Mitigation |
|---|---|---|
| 9 | 18+ health continuity-by-default defeats adult confidentiality | Health defaults private at 18; affirmative per-category opt-in; skip = private |
| 10 | Minor-consent care records (GA) exposed to parents via app | Teen-private health categories; carve-out disclosure in consent screens |
| 11 | AI assistant gives medical advice (esp. "unfiltered" Muse mode) | Medical safety layer in both modes: no diagnosis/prescribing, disclaimers, emergency escalation, crisis resources |
| 12 | Emergency plan unreachable (vault behind login; revoked parents = no contacts) | Emergency contacts decoupled from grants; lock-screen ICE card/QR; mandatory re-designation on revoke |
| 13 | Wearable vitals presented as clinical truth | Provenance labels, no interpretive/diagnostic claims, "consumer-grade" framing, FDA general-wellness boundaries |

---

## 2. FEATURE LIST — verdict per feature (clinical lens)

### 2.1 Core platform (§1)

| Feature | Verdict | Note |
|---|---|---|
| Google OAuth + magic link | ✅ clear | Ensure 18+ account continuity (no lockout during transition) |
| Session management (Supabase Auth) | ✅ clear | |
| Onboarding flow | ⚠️ needs change | Add age-appropriate health-privacy notice; set expectation that health is per-category and privatizes at 18 |
| 5-tab navigation | ✅ clear | |
| Child switcher + persistence | ⚠️ needs change | **Wrong-child data-entry risk**: require a persistent, unmissable active-child banner on any health-data entry screen |
| Nebula theme | ⚠️ needs change | Health-critical text (allergies, meds, emergency info) must meet WCAG AA contrast — "subtle neon" cannot apply to clinical content |
| `/verify-invite` public landing | ⚠️ needs change | Must never preview health data or child health status; generic landing only |

### 2.2 Pookie AI assistant (§2)

| Feature | Verdict | Note |
|---|---|---|
| Pookie AI chat (warm tutor) | ⚠️ needs change | Any health Q&A needs a medical safety layer: "not medical advice" framing, no diagnosis/dosing/interpretation of symptoms, emergency escalation ("call 911 / go to urgent care"), 988 for crisis |
| **Muse toggle (direct, unfiltered)** | 🛑 **blocked as designed for medical content** | "Unfiltered" must never apply to health questions. Both modes get the same medical safety layer; unfiltered persona may be blunt about homework, never about symptoms, meds, or mental health |
| Cloudflare Worker (Llama 3.3 70B) | ✅ clear | General LLM is fine *with* guardrails; never represent it as medical-grade |
| Instant-respond routing | ✅ clear | Route suspected health/crisis queries to the safety-layer path first |
| Teacher discussion threads | ✅ clear | Non-clinical |
| Proactive nudges | ⚠️ needs change | Health nudges (medication reminders, appointment nudges) require explicit opt-in and must never be presented as clinical monitoring; a silently-failing reminder system is a safety hazard — state reliability limits plainly |

### 2.3 Today (§3)

| Feature | Verdict | Note |
|---|---|---|
| Morning ritual / tonight's plan | ✅ clear | |
| Check-in cross-check (self-report vs synced data) | ⚠️ needs change | **Do not extend this pattern to health.** Cross-checking a teen's health self-report against wearable data as "verification" is clinically invalid (wearables ≠ ground truth) and destroys trust. Keep cross-check to school data only |

### 2.4 The 31 modules

**Grove: Body & Heart**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W2 | Health — vitals, trends, glanceables; health-app connections | ⚠️ needs change (major) | See deep-dive §3a. Consumer-device trends are **descriptive, not diagnostic**; as specified ("trends, glanceables") it will mislead without provenance labels, unit handling, gap/duplication handling, and a ban on interpretive claims. Teen privacy tiers must encode GA minor-consent carve-outs, not just "tiers" |
| W8 | Wellbeing — daily mood pulse (**teenPrivate**) | ⚠️ needs change | teenPrivate is right. **Missing crisis protocol** (see §3b): any low-mood/self-harm signal must surface 988 + Crisis Text Line immediately, offer one-tap "tell a trusted adult" *controlled by the teen*, and never auto-notify parents. Storing crisis signals with no response path is the worst design |
| W13 | Meals — meal planning | ✅ clear | As described ("planned not panicked") it's benign; keep it about planning, not restriction (see W23) |
| W22 | Activity — steps, workouts, streaks | ✅ clear | Minor: streaks can drive compulsive exercise in teens — prefer "recovery-aware" framing over pure streaks; no medical concern at the feature level |
| W23 | Nutrition — food logging (protein, balance) | ⚠️ needs change | **Eating-disorder risk in adolescents.** AAP/academy guidance: avoid numeric calorie goals for <18. Require: no calorie targets for minors, balance/regularity framing (not restriction), ED resources (NEDA helpline) in-module, and a "hide numbers" mode. As designed ("food logging — protein, balance") it is one toggle away from a diet app |

**Grove: Home & Family**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W21 | Mail — photo intake → action items/amounts/dates | ⚠️ needs change | Health correspondence (EOBs, lab letters, bills) is PHI-grade: encrypt at rest, auto-tag health mail into the health vault (not the general feed), redact in shared/household views |
| W20 | Shopping List | ✅ clear | |
| W11 | Spending — categorization, credit-limit tracking | ✅ clear | Opportunity: medical-bill tracking could link to W3; no concern as designed |
| W7 | Money & Documents — ledger + document vault | ⚠️ needs change | Vault will hold health documents (insurance cards, immunization records, advance directives). Two requirements: (1) PHI-grade handling + audit; (2) **a stored advance directive is not valid by storage alone** — GA requires proper execution (O.C.G.A. § 31-32-3: competent adult, two adult witnesses); label stored directives with execution-status checklist, never imply "uploading = done" |
| W24 | Credit | ✅ clear | Non-clinical |
| W14 | Co-parenting — two-household coordination | ⚠️ needs change | (1) The app must state plainly that **app access ≠ medical consent authority** — custody orders designate who consents to care; do not let the grant matrix imply otherwise. (2) Genuine clinical opportunity: a **shared medication-administration log** across households prevents double-dosing — currently missing (see Gaps) |
| W12 | Babysitters — trusted sitter directory | ⚠️ needs change | Add **scoped, time-limited emergency-info sharing** for sitters (allergies, action plans, pediatrician, consent-to-treat contact) — a name-and-number directory without the medical handoff is the actual use case |
| W10 | Fairness | ✅ clear | Non-clinical |

**Grove: School Days**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W1 | School (live) | ✅ clear | Two health-adjacent notes: (1) 504/IEP accommodation documents are health-related education records — treat as sensitive, not general uploads; (2) school medication-authorization forms and immunization compliance (GA Form 3231) have no home — gap |
| W16 | School Calendar | ✅ clear | |
| W5 | College & Future | ⚠️ needs change | **Missing college health transition**: immunization requirements (meningococcal, MMR/Tdap per college), health-insurance verification, transfer to campus health / adult PCP, prescription transfer, health forms. A "12-year anesthesiologist pathway" with no health-transition checklist is a clinical gap |
| W4 | Activities — sports/practice web | ⚠️ needs change | Scheduler is fine; missing **sports-safety layer**: preparticipation physicals (PPE) tracking, concussion protocol info, venue emergency action plans. GA heat-illness risk is real for fall sports |
| W18 | Summer — camps | ✅ clear | Minor: camp health forms/immunization deadlines fit naturally here — suggest as improvement, not a blocker |

**Grove: Safe & Sound**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W3 | Safety — insurance organization | ⚠️ needs change | Fine as organization; needs: (1) **currency verification** — an expired insurance card in a vault is worse than none (claim denials, front-desk delays); annual re-verify nudge; (2) health-insurance specifics: dependent coverage to 26 (ACA), pharmacy benefit card vs medical card, prior-auth notes; (3) emergency accessibility — insurance card must be reachable in ≤2 taps from the emergency card |
| W19 | Emergency — plan, numbers, document vault | ⚠️ needs change (major) | **Not clinically adequate as specified** — see deep-dive §3c. A vault + numbers list is storage, not a plan |

**Grove: Growing Up**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W6 | Driving & Life Skills | ✅ clear | Minor: note medical fitness-to-drive (e.g., seizure disorders) in GA licensing content if the module covers eligibility — one line, not a feature |
| W15 | Screen Time | ✅ clear | |
| W17 | Friends (**teenPrivate**) | ✅ clear | teenPrivate respected; non-clinical |

**Grove: Out & About**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W25 | Fuel & Charging | ✅ clear | |
| W26 | Weather — hyperlocal, decision translation | ✅ clear | "Decision translation" could include heat-illness/asthma-air-quality guidance — benign opportunity |
| W27 | Events | ✅ clear | |
| W28 | Restaurants — AI discovery, wired to nutrition | ⚠️ needs change | **Allergy vs preference must be distinct.** "Dietary" discovery that treats a peanut allergy like a low-carb preference is dangerous: require explicit allergy flagging, cross-contact warnings, and never present a restaurant as "allergy-safe" without verification. Wire the allergy list from W2 (when built), not the taste profile |
| W29 | Trails & Parks | ✅ clear | Minor: GA tick-borne illness (RMSF, ehrlichiosis) + heat — a one-line safety blurb is cheap |
| W30 | Flights | ✅ clear | Minor: unaccompanied-minor medical authorization forms belong in the minor-traveler rules content |
| W31 | Rental Cars | ✅ clear | Non-clinical |

### 2.5 School intelligence (§5, W1 detail)

Largely ✅ clear from my domain. Targeted notes:

| Feature | Verdict | Note |
|---|---|---|
| 13-source model, class pages, path-to-90, check-ins, quizzes, peer tips, SAT prep, sync workers | ✅ clear | Non-clinical |
| Teacher inbox (teacher + counselor + Outlook 365 + Synergy merge) | ⚠️ needs change | **School nurse communications will flow through this inbox** and may contain health info (medication authorizations, injury reports, 504 correspondence). Tag nurse/health-origin mail as health-sensitive with restricted visibility |
| Per-class file uploads / handouts | ✅ clear | If IEP/504 documents land here, they inherit the sensitivity note above |

### 2.6 Family & access management (§6)

| Feature | Verdict | Note |
|---|---|---|
| Email invite (7-day token, matching-login, consent) | ✅ clear | Consent screen carries the per-category health disclosure (Change 4) |
| 6-digit link codes | ✅ clear | |
| Child access authority (`granted_by` enforcement) | ⚠️ needs change | Directionally right for data; add Change 3 (category scoping, non-guardian health-grant safeguards) and the §1b medical-consent-authority disclaimer |
| Age tiers (<13 / 13–15 / 16–17) | ⚠️ needs change | Health carve-outs per Change 4 |
| Sharing screen ("Who can see my stuff?") | ⚠️ needs change | Per-category health toggles + audit view per Change 7 |
| Access request flow (non-parent adult) | ⚠️ needs change | For **health** categories: guardian notice + 24h teen re-confirmation (Change 3/6) |
| Block list | ✅ clear | |
| "Go independent" graduation | ⚠️ needs change | Add health handoff checklist (PCP, records, pharmacy, insurance, emergency contacts) — graduation without it is clinically incomplete |
| 18th-birthday prompt (continuity default) | 🛑 **blocked for health** | Change 2. Non-health continuity is outside my domain (defer to legal panel) |
| `graduate_child_access` RPC | ⚠️ needs change | Must execute per-category transitions (health seals at 18 pending re-consent) |
| Claim dedupe | ✅ clear | |

### 2.7 Settings & data management (§7)

| Feature | Verdict | Note |
|---|---|---|
| Settings → Profile | ✅ clear | |
| Sync console | ✅ clear | |
| Health connections | ⚠️ needs change | **Data-quality requirements** (§3a): source/device/timestamp provenance, unit normalization, duplicate suppression, gap display, disconnect + delete-data rights, "consumer-grade" labeling |
| Credentials vault | ✅ clear | (Future health-portal credentials inherit the same encryption standard) |
| Notification preferences | ⚠️ needs change | Distinguish **health-critical alerts** (med reminders — if ever built) from general nudges; health reminders need delivery-reliability disclosure and must respect quiet hours only with explicit user override |
| Data retention policies ("check-ins indefinite, emails TBD") | ⚠️ needs change | **Indefinite retention of teen mood/health check-ins is unsound.** Require retention limits (e.g., rolling 24 months default for wellness entries, user-deletable anytime), explicit policy per health category, and easy export-then-purge. Indefinite retention maximizes breach impact with zero clinical benefit in a consumer app |

### 2.8 API platform (§8)

| Feature | Verdict | Note |
|---|---|---|
| `GET /api/v1/me`, children school/college APIs, household/invites/tutor, notifications | ✅ clear | Standing requirement for any **future health endpoints**: OAuth-style category scopes, and **append-only audit logging of health-data access** (who viewed what, when) — the audit log is load-bearing for the 18+ transition's trust model |

---

## 3. Deep dives

### 3a. W2 Health — vitals/trends: clinically meaningful or misleading?

**Misleading, unless heavily constrained.** As an internist I counsel patients on wearable data weekly; the failure modes are well known:

1. **No provenance, no meaning.** A resting-HR "trend" that blends a chest strap, a watch, manual entries, and two phones' HealthKit merges is noise. Require: source device/app label, timestamp, and sample type on every datum; suppress or flag duplicates.
2. **Descriptive only — never interpretive.** "Resting HR 72 → 78 this month" is fine. "Your cardiovascular fitness is declining" is a **diagnostic claim** that (a) is usually wrong (illness, stress, caffeine, poor sleep, sensor error), (b) pushes the app out of FDA **general-wellness enforcement discretion** into regulated-device territory, and (c) generates anxiety-driven utilization. Ban interpretive/glanceable *judgments*; allow descriptive stats.
3. **Specific traps:** wrist-based BP estimates and cuff-less claims (not validated — never display as BP); SpO2 from wearables (not for clinical decisions); sleep-stage graphs (consumer staging ≠ polysomnography — label "estimated"); HRV (no clinical reference ranges — show raw trend only, no "readiness scores" presented medically).
4. **Units and populations:** unit normalization (lb/kg, mg/dL/mmol/L) with explicit display; pediatric vs adult reference framing (a 15-year-old's BMI needs a percentile, not an adult cutoff — never show an adult "obese" label on a teen's chart).
5. **Gaps are data.** Display missing-data gaps honestly; never interpolate silently.
6. **Teen privacy tiers** must be more than "tiers": encode the minor-consent carve-outs (Change 4) and default the most sensitive sub-categories (mood, reproductive, substance-use-adjacent entries) to teen-private.

With these constraints W2 is a ✅-shippable wellness module. Without them it is a **misinformation surface with the app's brand on it**.

### 3b. W8 Wellbeing — the crisis protocol the spec is missing

A daily mood pulse for teens *will* capture suicidal ideation disclosures — this is statistically certain at scale. The current spec (mood pulse, teenPrivate, no response path) is the dangerous combination: **soliciting distress signals the app is not prepared to answer.** Minimum standard:

1. On any low-mood or self-harm-indicating entry: immediately surface **988 (call/text), Crisis Text Line (741741)**, and a brief safety message — in-app, every time, no dismiss-without-view.
2. One-tap **"tell a trusted adult"** — teen chooses the adult, teen presses send. Never auto-notify parents (auto-notification deters future disclosure and can escalate unsafe home situations).
3. Never use mood data for the "check-in cross-check" pattern (§2.3), never feed it to parental nudges, never train peer-tip content on it.
4. Recommend co-design review with a child/adolescent psychiatrist before launch (reassessment flag).

### 3c. W19 Emergency — what "clinically adequate" actually requires

"Emergency plan, numbers, document vault" is **storage, not a plan**. An adequate consumer emergency module has five layers; the spec names one and a half:

1. **Reachable without login.** Lock-screen ICE card and/or QR code encoding: name, DOB, blood type (if known — never guess), allergies + reaction, current meds + doses, conditions (asthma, diabetes, epilepsy, adrenal insufficiency…), emergency contacts, advance-directive existence + location. EMS will never open Pookie.
2. **Condition-specific action plans**, not just documents: anaphylaxis (antihistamine/epi steps + when to call 911), asthma exacerbation, seizure, severe hypoglycemia, adrenal crisis. Templated, pediatrician-reviewable, printable for school/sitters.
3. **Correct numbers, location-aware:** 911 (US), **Poison Control 1-800-222-1222**, **988** crisis line — preloaded for Georgia, not user-remembered.
4. **Advance directives done right:** at 18+, offer the **Georgia Advance Directive for Health Care** with the execution checklist (competent adult + two adult witnesses, O.C.G.A. § 31-32-3); a PDF in a vault without valid execution is a false sense of security — label execution status explicitly.
5. **Revocation-safe contacts:** emergency contacts decoupled from access grants; mandatory re-designation when the last grant-holding adult is revoked or when health privatizes at 18 (Change 2).

### 3d. W3 Safety + W21/W7 — the insurance/document reality

Organizing policies is genuinely useful — my patients' #1 administrative failure is the expired insurance card. But: (a) **currency verification** (annual re-verify nudge; flag expired cards loudly), (b) pharmacy-benefit vs medical-benefit cards distinguished, (c) **dependent coverage to age 26** surfaced in the 18+ flow (young adults routinely believe they lose coverage at 18), (d) the insurance card reachable in ≤2 taps from the emergency card. Health mail (EOBs, lab letters) ingested by W21 must auto-route to the health vault with PHI-grade handling, not the household feed.

---

## 4. Gaps — features the list doesn't cover (clinical)

1. **Transition-of-care track (Got Transition-aligned).** The highest-value missing program: readiness assessments from ~14, a transition policy, and a transfer-of-care checklist at 18–21 (adult PCP selection, records transfer, insurance verification, pharmacy transfer, self-management skills). The spec's single birthday prompt is not transition care — it's a notification.
2. **Portable transition summary export** (problems, meds, allergies + reaction/severity, immunizations, growth, last visits, insurance, emergency contacts) — PDF now; FHIR-format later. This is what receiving internists actually need.
3. **Immunization record management** — GA Form 3231 (school), college requirements (meningococcal/MMR/Tdap), CDC catch-up through age 26 (HPV series completion). Parent-entered vaccine history needs the review–correct–seal flow at 18.
4. **Medication list + reconciliation**, including a **cross-household administration log** for co-parenting (double-dose prevention) — a real pediatric safety issue the W14 module is positioned to solve but doesn't.
5. **Allergy list with reaction/severity + anaphylaxis action plan**, wired to W19 and W28 (restaurant allergy flagging must source from this list, not the taste profile).
6. **Chronic-condition action plans** (asthma, diabetes, epilepsy, severe allergy) — templated, printable, shareable with school/sitters.
7. **Audit log of health-data access** ("who viewed my health info") — load-bearing for trust at every age tier, essential at 18+.
8. **Break-glass emergency access** — first-responder/school-nurse access to the critical summary via QR/lock-screen when the patient cannot consent, with automatic audit entries.
9. **College health transition checklist** (W5) — immunizations, insurance, campus health registration, prescription transfer, health forms, confidential-care orientation (students don't know campus clinics offer confidential care).
10. **Dental/vision care tracking** — the two most-forgotten preventive domains in transition-age youth.
11. **Sports physicals (PPE) + concussion baseline/protocols** (W4) — GA school sports require PPE; the activities web should track expiry.
12. **School health forms hub** (W1) — medication authorization forms, 504/IEP health accommodations, GA Form 3231 — currently homeless across inbox/uploads.
13. **Confidential-care orientation for teens** — plain-language explainer of what GA minor-consent law covers and how teen-private categories work. Without it, the privacy tiers are undiscoverable.

---

## 5. Features that shouldn't exist as designed

1. **18+ health continuity-by-default** (§4/§6) — 🛑. Redesign as affirmative opt-in re-consent (Change 2). This is the single must-fix.
2. **"Unfiltered" Muse mode applied to medical content** (§2) — 🛑. The medical safety layer must be mode-independent.
3. **Health check-in cross-check** (extending §3's pattern to wearables vs self-report) — do not build. Clinically invalid, trust-destroying.
4. **Vitals/trends as "glanceables" without provenance or disclaimers** (W2 as specified) — ⚠️ redesign, not removal: descriptive-only, labeled consumer-grade, no interpretive claims.
5. **All-or-nothing health sharing toggles** (§6/§10) — ⚠️ redesign: per-category toggles are the minimum for clinical acceptability.
6. **Food logging with numeric targets for minors** (W23 as it will drift) — ⚠️ redesign: no calorie goals <18, balance framing, ED resources, hide-numbers mode.
7. **Indefinite retention of teen mood/health check-ins** (§7) — ⚠️ redesign: rolling retention windows + user purge.
8. **Mood pulse with no crisis protocol** (W8 as specified) — ⚠️/🛑 redesign: cannot solicit distress signals without a response path; add §3b before launch.

---

## 6. Feature improvements (beyond the verdicts)

- **W2:** add manual-entry override with "entered by" attribution (parent-entered vitals are a known error source); growth-chart percentiles for <18; medication-aware annotations (e.g., "started albuterol" markers the user adds).
- **W19:** one-tap "ER packet" — generates a single-page PDF (meds, allergies, conditions, contacts, directive status) for the ED waiting room; auto-include Poison Control/988/911.
- **W3:** pre-visit insurance verification checklist ("card current? prior auth needed? in-network?") before scheduled appointments.
- **W8:** trend view *for the teen only* with supportive (never diagnostic) language; weekly reflection prompt instead of pure daily score.
- **W22/W23:** link activity and nutrition as "fuel and recovery" education, not calorie math.
- **W14:** the shared med-administration log (Gap 4) is the killer feature of this module from a safety standpoint — prioritize it over generic coordination.
- **W5:** partner the college simulator with the health-transition checklist (Gap 9) — "what campus health covers" per college.
- **W28:** allergy flags sourced from the W2 allergy list; "allergy-aware" (not "allergy-safe") labeling with cross-contact disclaimer.

---

## 7. Reassessment flags (re-review triggers)

1. **Legal panel confirmation** of the GA minor-consent statute list and which health categories are parent-excluded pre-18 — my Change 4 depends on their enumeration.
2. **FDA general-wellness boundary check** on final W2 copy/designs — confirm no diagnostic claims before staging sign-off.
3. **Child/adolescent psychiatry review** of the W8 crisis protocol and W23 ED safeguards before launch.
4. **Pediatrician review** of the transition-summary content model and emergency action-plan templates.
5. **Design review** of the 18th-birthday health re-consent screens — verify skip/still-private behavior and that per-category toggles are genuinely understandable to an 18-year-old.
6. **Infosec review** of PHI handling (encryption at rest, audit-log integrity, break-glass access controls) before any health module ships.
7. **Post-launch metric:** 18+ health re-consent rate and skip rate — if re-consent is low, investigate whether the flow is coercive or confusing; the default-private guarantee must hold regardless.
8. **Re-review at EHR/FHIR integration** — business-associate implications would change the HIPAA analysis in §0.

---

*End of internal-medicine / transition-medicine panel review.*
