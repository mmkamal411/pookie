# Expert Review — Adolescent Wellness (Health Coach)
**Reviewer lens:** adolescent wellness / health coaching — nutrition, activity, sleep, mental-wellbeing safeguards, eating-disorder prevention, health-data privacy for minors
**Specs reviewed:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12) + `FEATURE-LIST-FOR-PANEL.md`
**Also checked:** `GUIDANCE-FRAMEWORK.md` + `sections/guidance/*` (for the referenced "teen health privacy tiers")
**Date:** 2026-10-12 · **Starting jurisdiction:** Georgia

---

## 0. Headline findings

1. **The "teen health privacy tiers" referenced by W2 do not exist.** I searched `GUIDANCE-FRAMEWORK.md` and all guidance sections: they define *tutor-chat age tiers* (10–12 / 13–15 / 16+), not health *data-sharing* tiers. W2's note ("Teen health privacy tiers per Guidance framework") points at an undefined concept. This is the single biggest gap: the access model treats "health" as one coarse sharing category, and no document defines what sits inside it. Part 2 below proposes the taxonomy; Part 3 wires it into the spec.
2. **W23 (Nutrition) as designed is clinically unsafe for under-18s.** Food logging with protein/macro framing for adolescents is a documented eating-disorder risk vector (NEDA; AAP). It needs a redesign, not a tweak — see Change F and the W23 deep dive.
3. **W8 (Wellbeing) is marked `teenPrivate` but "concerning patterns — what happens?" is unanswered.** A teen-private mood journal with no defined crisis-escalation protocol is a liability and a clinical failure. The escalation ladder is defined in Part 5.
4. **The 13–15 cooling-off model (notify both parents immediately on any revoke) can out a teen's health privacy decisions.** Revoking parent access to sexual-health or mental-health data must not generate a notification that discloses *what* was revoked. Safety carve-out required — Change C.
5. **Muse "direct, unfiltered" toggle must never apply to health topics.** Unfiltered health advice to minors (diagnosis, diet, supplements, self-harm) is the highest-risk surface in the product. Blocked as designed — Change G.

**Professional standards cited:** AAP Bright Futures 4th ed.; SAHM Position Paper on Confidentiality in Adolescent Health Care; AAP Clinical Report on Confidentiality; APA Ethical Principles §4.02 (limits of confidentiality with minors); 42 CFR Part 2 (substance-use records); HIPAA Privacy Rule (personal representatives / state-law preemption); NEDA educator/parent guidance on dieting & food tracking as ED risk factors; ACSM Youth Physical Activity Guidelines; AAP Council on Communications and Media guidance; SAMHSA 988 crisis standards; CDC YRBS adolescent mental-health surveillance; FDA general-wellness vs. device guidance (wellness claims boundary).

> Scope note: I am a health/wellness reviewer, not counsel. Georgia statutory references below (minor consent for STI/substance-use/outpatient mental-health services) are flagged **for legal-pod confirmation** — the taxonomy is built to be consistent with a minor-consent model, but exact scope needs the legal review.

---

## PART 1 — Access-model spec: verdict per section (health/wellness lens)

| Spec section | Verdict | One-line reason |
|---|---|---|
| §1 Product principles | ⚠️ needs change | Principle 2 (child = access authority) is right, but "health" as a single category contradicts professional confidentiality standards — sensitive health subtypes need their own defaults |
| §2 Signup & onboarding | ⚠️ needs change | No health-data consent at onboarding; no rule for *who* connects a teen's HealthKit/health app (must be the teen, 13+) |
| §3 Access authority matrix | ⚠️ needs change | Matrix is per-child, not per-category. Health needs category-scoped grants (H1/H2/H3) — Change A |
| §4 <13 Stewardship (COPPA) | ✅ clear | Parent-managed health data for <13 is correct; keep health-app connections parent-authorized here |
| §4 13–15 Shared agency / cooling-off | 🛑 blocked as designed | 7-day cooling-off + immediate dual-parent notification is unsafe for health-data revocation (outing risk); crisis content needs instant confidential handling — Change C |
| §4 13–15 informed consent | ⚠️ needs change | Consent screen lists "health" coarsely — must enumerate H1/H2/H3 categories — Change B |
| §4 16–17 Full agency | ✅ clear | Instant revoke is developmentally appropriate; extend category scoping |
| §4 18+ Ownership & continuity | ⚠️ needs change | Continuity default is fine for grades, but H3 (mental health / sexual health / substance use) history should **not** carry forward by default — require explicit opt-in at the 18th-birthday prompt — Change D |
| §5 Child linking | ✅ clear | Consent screen must carry the health-category list (Change B applies here too) |
| §6 Go independent | ✅ clear | Add: health data-source handoff (reconnect health apps as the young adult) |
| §7 Just me | ✅ clear | Adult health modules (full nutrition logging, etc.) live here — correct placement |
| §8 Migrations | ⚠️ needs change | `child_access` needs a scope/category dimension — Change E |
| §9 API surface | ⚠️ needs change | `grantAccess`/`revokeAccess` need scope parameters — Change E |
| §10 UI screens | ⚠️ needs change | Sharing screen needs a health section with per-category toggles + crisis-disclosure notice — Change F |
| §11 Risks & mitigations | ⚠️ needs change | Missing all health-specific risks — Change H |

---

## PART 2 — Proposed health sharing taxonomy (replaces coarse "health")

The access model must stop treating "health" as one thing. Four tiers, enforced server-side at the category level:

### Tier H0 — Prohibited for under-18s (never collected, or never displayed)
Never shown to the teen, never used in nudges/streaks/scores for <18. (Definitive metric list in Part 6.) Parent display of H0 metrics is restricted to clinical-coordination contexts only — never as dashboard glanceables.

### Tier H1 — Shareable wellness (parent-visible by default; teen 13+ may restrict per category)
- Step counts / active minutes (aggregate only — **no** calorie-burn figures)
- Sleep duration and bedtime (not sleep-stage detail)
- Workout frequency and type (not duration extremes)
- Routine-appointment scheduling info (pediatrician, dental, ortho — *dates*, not visit content)
- Vaccination-due reminders
- Emergency medical info (allergies, conditions, medications) — visible to parents AND available break-glass in W19 Emergency

### Tier H2 — Teen-private by default at 13+ (explicit per-category opt-in grant required)
- Mood pulse entries and journal content (W8)
- Detailed food logs (W23)
- Sleep detail beyond duration/staging
- Menstrual / reproductive health data (always H2 for 13+, no exceptions)
- Medication lists and adherence detail
- Resting-HR / HRV trends (interpretation risk — teen-private with no-diagnosis guardrails)
- Health-topic AI chat transcripts

### Tier H3 — Legally sensitive (never parent-visible without teen consent; statutory protections apply)
- Mental-health counseling content
- Substance-use data (42 CFR Part 2 overlay — stricter than HIPAA; legal pod to confirm applicability)
- Sexual-health / STI / pregnancy-related data
- Self-harm / suicide disclosures → **crisis protocol** (Part 5), which is the *only* pathway that can override teen privacy, and only on imminent-risk grounds with upfront disclosure

**Defaults summary:** <13 → parent steward sees H1+H2 (H3 collection should not occur for <13; if disclosed, treat as H3). 13–15 → parent sees H1 by default; H2/H3 require teen opt-in per category. 16–17 → same, instant revoke. 18+ → teen (now adult) re-confirms; **H3 history does not carry forward without explicit opt-in** (Change D).

---

## PART 3 — Concrete spec changes (quote + replacement)

### Change A — §3: category-scoped grants for health

**Current:**
> Core rule: **only the granter or the child can revoke a grant.** Parent A can never revoke a grant made by the child to Parent B.

**Add below the matrix:**
> **Health categories are granted separately.** The coarse `health` category is replaced by H1 (shareable wellness), H2 (teen-private by default), and H3 (legally sensitive) per the Health Sharing Taxonomy. A parent may hold H1 access while the teen withholds H2/H3; `granted_by` and the revoke matrix apply independently per category. No API or UI may grant "all health" as a single scope to a viewer of a 13–17-year-old.

### Change B — §4: informed-consent screen must enumerate health categories

**Current:**
> Informed consent on first link: explicit "I understand Mom/Dad can see [grades, check-ins, health]" checkbox in the teen's own session — not a passive click.

**Replacement:**
> Informed consent on first link: explicit per-category checklist in the teen's own session — not a passive click. Health is never listed as one line; the screen enumerates: "Shareable wellness (steps, sleep times, appointment dates)"; "Private by default (mood journal, food logs, cycle data, health chats) — Mom/Dad see these only if you switch each one on"; "Never shared (mental-health, substance-use, sexual-health content)". A separate plain-language line states the crisis exception: "If you tell Pookie you might hurt yourself or someone might hurt you, Pookie will get help right away — including telling a parent or emergency services if you're in immediate danger."

### Change C — §4: safety carve-out for 13–15 health revocation (cooling-off does NOT apply)

**Current:**
> May grant/revoke freely, **except** revoking a parent triggers a **7-day cooling-off**: scheduled, cancellable anytime, both parents notified immediately (told, not asked).

**Add:**
> **Health-data revocation is exempt from cooling-off.** Revoking a parent's H2/H3 access is instant at every tier, with no 7-day delay. The parent notification for a health-category revoke is generic — "Your teen updated their sharing settings" — and never names the category revoked, so the notification itself cannot out the teen's health privacy decisions. (Grades/check-ins keep the standard cooling-off path.)

*Why:* A 13–15-year-old who revokes parent access to sexual-health or mental-health data and triggers an immediate "your child hid their health data from you" notification to both parents is placed at risk of confrontation or punishment for a privacy-protective act. SAHM confidentiality standards exist precisely because fear of disclosure deters care-seeking.

### Change D — §4: 18+ continuity must not carry H3 history by default

**Current:**
> **Parents who had access keep access by default.** No birthday disruption.

**Add:**
> **Exception: H3 (legally sensitive) history never carries forward by default.** At the 18th-birthday prompt, H3 categories appear as explicit opt-ins ("Keep sharing mental-health content with Mom? [No/Yes]"), defaulting to No. H1/H2 follow the standard continuity default. The prompt states: "Some health history is private by law — nothing sensitive carries over unless you choose it."

### Change E — §8/§9: scope dimension on grants

**Current (§8 table):** `018_access_authority.sql` — `child_access.granted_by` text NOT NULL DEFAULT 'system'; `child_access.status` …

**Add migration row:**
| `021_health_scopes.sql` | `child_access_scopes` (child_id, adult_user_id, category ∈ 'H1'/'H2'/'H3'/module scopes, granted_by, status, granted_at). Revoke/grant RPCs enforce the §3 matrix per scope. No "all health" scope exists for viewers of 13–17-year-olds. |

**Current (§9):** `grantAccess(childId, adultUserId)` → child or parent; sets `granted_by`

**Replacement:** `grantAccess(childId, adultUserId, scopes[])` → child or parent; sets `granted_by` per scope; rejects `scopes` containing any blanket-health scope for 13–17 viewers. `revokeAccess(childId, adultUserId, scopes[])` → per-scope enforcement; H2/H3 revokes are instant (Change C).

### Change F — §10: Sharing screen health section

**Current:** Child Sharing screen — "Who can see my stuff?", per-person toggles, what's-visible list, approve/deny access requests, block adult

**Add:**
> - A dedicated **Health** section with three labeled groups (Shareable wellness / Private by default / Never shared), per-category toggles, and one-line plain-language explanations ("Mood journal — only you, unless you switch it on").
> - A permanent crisis-disclosure notice: "If Pookie thinks you might be in danger, it will get help — even if that means telling someone. This is the only exception to your privacy settings."

### Change G — Pookie AI: health topics always through safety rails (applies to §2-adjacent assistant behavior; spec to codify)

**Add to spec (new subsection under §1 principles or §11):**
> The Muse "direct, unfiltered" toggle never applies to health topics. Any prompt classified as health-related (physical, mental, nutrition, sexual, substance-use) is routed through the health safety rails regardless of persona: no diagnostic language, no calorie/weight-loss prescribing for <18, medical-information disclaimer, crisis-trigger detection, and professional-escalation offers. The toggle changes tone, never safety.

### Change H — §11: add health risks

| # | Risk | Mitigation |
|---|---|---|
| 9 | Health-revoke notification outs the teen (parent infers *what* was hidden) | Change C: generic notification, instant H2/H3 revoke, no cooling-off |
| 10 | Teen discloses self-harm / abuse / ED behavior in W8/W22/W23 with no defined response | Crisis & concern escalation ladder (Part 5); deterministic triggers; upfront disclosure (Change B/F) |
| 11 | Nutrition/activity features induce or worsen disordered eating / compulsive exercise | H0 prohibited-metric list (Part 6); W23 redesign; W22 streak removal for <18 |
| 12 | H3 history carries to 18+ by continuity default, violating the spirit of minor-consent protections | Change D: H3 opt-in at 18, default No |
| 13 | Parent connects teen's HealthKit / health app without teen consent | Only the data subject authorizes health-app connections at 13+ (Settings → Health connections); parent authorization only for <13 |

---

## PART 4 — Feature verdicts (every feature, health/wellness lens)

Legend: ✅ clear · ⚠️ needs change · 🛑 blocked as designed

### 1. Core platform

| Feature | Verdict | Note |
|---|---|---|
| Google OAuth + magic link | ✅ | — |
| Session management (Supabase Auth) | ✅ | — |
| Onboarding flow | ⚠️ | Add health-data consent + "who connects health apps" rule (Risk 13); health categories in teen consent (Change B) |
| 5-tab navigation | ✅ | — |
| Child switcher | ⚠️ | Must be scope-aware: switching children must never leak H2/H3 across profiles; audit the switcher against per-scope RLS |
| Nebula theme | ✅ | — |
| `/verify-invite` public landing | ⚠️ | Must never preview any health data or health-module state without login |

### 2. Pookie AI assistant

| Feature | Verdict | Note |
|---|---|---|
| Pookie chat (warm tutor) | ⚠️ | Health prompts need medical-info quality bar + disclaimer + no-diagnosis rule (Guidance already says no-diagnostic language — extend explicitly to health Q&A) |
| Muse toggle (direct, unfiltered) | 🛑 | Blocked as designed for health topics — Change G. "Unfiltered" + adolescent health advice is the product's highest-risk combination |
| pookie-tutor Worker (Llama 3.3 70B) | ⚠️ | LLM health answers are unvalidated; require disclaimer, citation-to-professional escalation, and crisis-trigger layer *before* model output |
| Instant-respond routing | ✅ | Provided health classification routes to rails (Change G) |
| Weekly teacher discussion threads | ⚠️ | If a thread surfaces a student health concern, that content is H2/H3 — needs handling rules, not default parent-visible |
| Proactive nudges | 🛑 | Blocked as designed — see deep dive. Health nudges must be opt-in, never mention weight/calories/appearance/food restriction, never use streak pressure |

### 3. Today (daily ritual)

| Feature | Verdict | Note |
|---|---|---|
| Morning ritual view | ⚠️ | Parent's ritual view must only render H1 for the teen; H2/H3 never in glanceables |
| Tonight's plan | ✅ | — |
| Check-in cross-check | ⚠️ | Never cross-check eating/symptom/mood self-reports against synced data in ways that feel surveillant; curiosity framing is right, extend the rule: no "gotcha" on health self-reports |

### 4. The 31 modules

**Grove: Body & Heart**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W2 | Health | ⚠️ | Tiers referenced but **undefined** — adopt Part 2 taxonomy; define which "vitals"; teen self-authorizes health-app connections (see deep dive) |
| W8 | Wellbeing | ⚠️ | `teenPrivate` default is correct; escalation ladder missing — defined in deep dive |
| W13 | Meals | ⚠️ | Meal *planning* is fine; must not become calorie budgeting; no moralizing food language (deep dive) |
| W22 | Activity | ⚠️ | Streaks + compulsive-exercise risk — remove streak mechanic for <18; no calorie-burn display (deep dive) |
| W23 | Nutrition | 🛑 | Food logging + protein/macro framing unsafe for <18 as designed — redesign to pattern-based, no numbers (deep dive) |

**Grove: Home & Family**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W21 | Mail | ✅ | — |
| W20 | Shopping List | ✅ | — |
| W11 | Spending | ✅ | — |
| W7 | Money & Documents | ✅ | — |
| W24 | Credit | ✅ | — |
| W14 | Co-parenting | ⚠️ | Health data across households must respect per-parent per-category grants (Change A covers); medical-decision coordination needs explicit design |
| W12 | Babysitters | ✅ | — |
| W10 | Fairness | ⚠️ | Fairness lens must **never** compare health metrics across children (no "your sibling walked more") |

**Grove: School Days**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W1 | School | ✅ | (Health-adjacent: lunch/dinner pulls fine) |
| W16 | School Calendar | ✅ | — |
| W5 | College & Future | ✅ | — |
| W4 | Activities | ⚠️ | Sports/practice load + W22 data could reveal overtraining — use for supportive check-ins only, never performance ranking |
| W18 | Summer | ✅ | — |

**Grove: Safe & Sound**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W3 | Safety | ✅ | — |
| W19 | Emergency | ⚠️ | Add 988 + Crisis Text Line to emergency numbers; medical vault needs break-glass access design (allergies/meds/conditions available to first responders even when teen-private) |

**Grove: Growing Up**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W6 | Driving & Life Skills | ⚠️ | Include sleep/fatigue as a driving-safety topic (evidence-based); otherwise clear |
| W15 | Screen Time | ⚠️ | Frame as sleep/habit support, not punishment; align with AAP media guidance (family media plan, not surveillance) |
| W17 | Friends | ✅ | `teenPrivate` default correct |

**Grove: Out & About**

| ID | Module | Verdict | Note |
|---|---|---|---|
| W25 | Fuel & Charging | ✅ | — |
| W26 | Weather | ✅ | — |
| W27 | Events | ✅ | — |
| W28 | Restaurants | ⚠️ | "Dietary" AI discovery must exclude weight-loss framing for <18; taste profile wiring to W23 must not import diet logic into restaurant picks |
| W29 | Trails & Parks | ✅ | — |
| W30 | Flights | ✅ | (Note: unaccompanied-minor medical consent forms — future detail) |
| W31 | Rental Cars | ✅ | — |

### 5. School intelligence (W1 detail)

| Feature | Verdict | Note |
|---|---|---|
| 13 data sources / named owners | ✅ | — |
| Per-class pages, gap-to-90 hero | ✅ | Shame-free framing is protective; keep |
| Path-to-90 checkboxes (Supabase) | ✅ | — |
| Daily check-in per class + uploads | ⚠️ | Health-adjacent check-in content (mood, eating) inherits H2/H3 handling — tag check-in fields by sensitivity |
| Teacher inbox per class | ⚠️ | Health disclosures in teacher threads → H2/H3 rules (see §2 table) |
| AI practice quizzes | ✅ | — |
| Peer tips pipeline (600/wk) | ⚠️ | Content moderation required: no diet/weight-loss/study-drug tips; tips touching health need expert review |
| SAT prep blocks | ✅ | — |
| Lunch/dinner, power-up, notes, news, horoscope pulls | ⚠️ | "Power-up" is undefined — if it's a supplement/energy product, that's a health claim needing review; define or drop |
| Sync workers (StudentVUE) | ✅ | — |
| ParentVUE/CTLS/Gmail pulls | ✅ | — |

### 6. Family & access management

Covered in Part 1/Part 3. Summary: the *structure* (child authority, `granted_by`, cooling-off for grades) is sound; the *health gaps* are Changes A–F/H.

| Feature | Verdict |
|---|---|
| Email invite + link codes + claim dedupe | ✅ (with Change B consent content) |
| Child access authority / `granted_by` | ⚠️ (needs per-scope application — Change A/E) |
| Age tiers | 🛑 for health revocation path (Change C); ✅ otherwise |
| Sharing screen | ⚠️ (Change F) |
| Access requests / block list | ✅ |
| Go independent / 18th-birthday prompt | ⚠️ (Change D for H3) |
| `graduate_child_access` RPC | ⚠️ (must transition per-scope, not blanket) |

### 7. Settings & data management

| Feature | Verdict | Note |
|---|---|---|
| Settings → Profile / Sync console | ✅ | — |
| Health connections | ⚠️ | Teen (13+) self-authorization only; per-category scopes; data minimization (pull only needed metrics) — Risk 13 |
| Credentials vault | ✅ | — |
| Notification preferences | ⚠️ | Health notifications default off for parents on H2/H3; teen controls |
| Data retention (check-ins indefinite) | ⚠️ | Indefinite retention of mood/health-adjacent check-ins is inappropriate — teen-controlled retention with auto-expire options (e.g., 90-day default for W8 content, exportable) |

### 8. API platform

| Feature | Verdict | Note |
|---|---|---|
| `/api/v1/me`, children school/college, household, invites, tutor, notifications | ⚠️ | No health endpoints specified yet — when added, they must enforce per-scope (H1/H2/H3) authorization server-side; specify now rather than retrofitting |

---

## PART 5 — Deep dives

### W2 Health — vitals, trends, glanceables
**What's fine:** resting heart rate, HRV, sleep duration, step counts as *informational trends* for the teen; appointment/vaccination reminders; emergency medical info.
**Required guardrails:**
1. Adopt the Part 2 taxonomy — the feature note's "tiers" must point at a real definition (add to Guidance framework or access spec appendix).
2. **No diagnostic interpretation.** "Your HRV is low" must never become "you're overtrained/stressed/sick." Trends are shown with neutral language and a standing line: "Pookie isn't a medical device — talk to your doctor about anything that worries you."
3. **Teen authorizes their own health-app connection at 13+** (HealthKit/Health Connect skills exist — wire the OAuth/scope flow to the data subject, not the parent). Data minimization: request only the metrics the module displays.
4. **Glanceables are scope-aware.** A parent's morning-ritual glanceable renders H1 only. There is no "family health leaderboard."
5. Abnormal-value handling: out-of-range vitals trigger "consider talking to a clinician," never alarmist language, never a diagnosis, never a parent alert on H2 metrics (parent alerts only via the crisis pathway).

### W8 Wellbeing — the missing escalation ladder
`teenPrivate` is the right default. What must be specified — **the concerning-patterns protocol**:

1. **Bad day** (single low pulse): supportive Pookie response, coping options, no escalation, no record shared.
2. **Emerging pattern** (e.g., low mood ≥5 of last 7 days, or 2-week declining trend): Pookie gently names the pattern *to the teen only*, offers resources (counselor, trusted adult, 988 info), offers to help draft a message to a parent/counselor. Still teen-private. The teen is offered — never forced — a one-tap "share this with Mom/Dad" option.
3. **Crisis language** (self-harm, suicide, "want to die," abuse disclosure): deterministic phrase triggers (the Guidance framework's Tier-3 approach — extend the trigger list to W8 content) → immediate response: 988 (call/text) + Crisis Text Line (741741) presented first, safety-plan prompt, supportive non-judgmental engagement. **This is the sole override of teenPrivate**: if imminent risk is indicated, Pookie notifies a parent/emergency contact and/or emergency services — and the teen was told exactly this on the consent screen and Sharing screen (Changes B/F). This mirrors APA/SAMHSA standards: confidentiality with minors is never absolute, and its limits must be disclosed upfront.
4. **Eating-disorder signals** (restriction, purging, laxative/diet-pill mentions): supportive, non-shaming response + NEDA resources + encourage a trusted adult/clinician; parent loop only with teen consent unless medical danger is indicated.
5. **Never:** diagnostic labels ("you seem depressed"), mood *scores* shown to parents, mood data used in nudges or the Fairness module, or mood trends deployed as evidence in the check-in cross-check.

### W13 Meals — planning, not policing
Meal planning ("what's for dinner, planned not panicked") is genuinely protective — family meals are associated with better adolescent outcomes. Guardrails: no calorie budgets; no "healthy/unhealthy" or "good/bad food" language (use "everyday foods / sometimes foods" framing if categorization is needed at all); the teen's *individual intake* is H2; grocery/meal-plan sharing at household level is fine. Keep W13 (planning) architecturally separate from W23 (logging) so planning never inherits tracking mechanics.

### W22 Activity — the compulsive-exercise problem
Steps/workouts/streaks are the highest ED-adjacent risk in the fitness domain after nutrition:
1. **Remove consecutive-day streaks for <18.** Streaks punish rest days and gamify compulsion. Replace with "active days this week" (non-consecutive count) and explicit rest-positive messaging ("rest days build strength").
2. **Never display calories burned, and never set weight-loss exercise goals, for <18** (H0 list).
3. **No sibling leaderboards or Fairness-module comparisons** on activity.
4. **Overtraining signal, handled supportively:** very high volume + declining mood/sleep → private supportive check-in with the teen ("noticing a lot of big workout days — how's your energy?"), resources, suggestion to talk to a coach/clinician. Never an achievement badge for extreme volume, never a parent alert outside the crisis pathway.
5. Teen authorizes their own tracker connection (13+); aggregate data only to parents (H1).

### W23 Nutrition — redesign required (🛑 as designed)
"Food logging — protein, balance" for adolescents combines the two strongest iatrogenic elements in youth nutrition products: **self-monitoring of intake** and **macro targets**. NEDA identifies dieting and food-tracking behaviors in adolescence as risk factors for eating-disorder onset; AAP guidance cautions against weight-focused nutrition interventions in youth.
**Redesign:**
1. **No calorie counting, no macro gram targets, no food scores for <18 — ever** (H0). "Protein" becomes pattern language ("include a protein source at meals") with no numbers.
2. **Logging, if it exists for <18, is variety-based only** (food groups, colors across the week) — no quantities, no grades, no streaks. Full detailed logging is an 18+/adult ("just me") feature.
3. **"Balance" must not be a score.** Scores moralize food. If the module assesses anything, it's weekly variety, framed positively.
4. **ED safeguards:** restriction/purge/diet-pill language in logs → Part 5/W8 step-4 protocol (supportive + NEDA resources + trusted-adult encouragement).
5. **W28 wiring:** restaurant "dietary" discovery for <18 excludes weight-loss diets; taste profile shares *preferences* (cuisines, flavors), never diet goals.
6. Any AI-generated nutrition advice carries the medical-information disclaimer and never prescribes restriction.

### Proactive nudges — health (🛑 as designed)
Unconstrained proactive health nudges are blocked. The nudge system may only send health-related nudges when:
- The teen has opted in to that nudge category (opt-in, not opt-out);
- Content never mentions weight, calories, BMI, body shape, appearance, or food restriction;
- Activity nudges are rest-positive and never streak-driven ("a walk could feel good" not "you'll lose your streak");
- Mood nudges are supportive, never diagnostic or shaming ("rough week — want to talk it through?" not "your mood score dropped");
- No nudge is ever sent to a parent *about* the teen's H2/H3 state.

### Muse toggle + health (🛑 as designed)
See Change G. Concretely: the health classifier runs before persona routing; "unfiltered" changes directness of tone, never the safety rails. Health answers always include: no-diagnosis rule, no <18 weight/calorie prescribing, crisis-trigger detection, and escalation to a professional. Log health-topic Muse interactions for safety review.

---

## PART 6 — Metrics NEVER trackable for under-18s (definitive list)

| # | Metric | Rationale |
|---|---|---|
| 1 | Body weight (as a teen-visible tracked metric) | Weight self-monitoring in adolescence → body dissatisfaction & ED risk (NEDA); aligns with Guidance "no weight/BMI numbers to the child, at any tier" |
| 2 | BMI / BMI percentile displayed to the teen | Same; AAP cautions against BMI report cards to youth (stigma, no behavior change) |
| 3 | Body-fat percentage | Aesthetic body-composition tracking; no clinical role in a wellness app |
| 4 | Calorie intake / calorie budgets | Core ED risk vector; dieting behavior in adolescence predicts ED onset |
| 5 | Calories burned / exercise energy expenditure | Couples exercise to food compensation thinking |
| 6 | Macro gram targets (protein/carbs/fat) | Macro fixation; protein *patterns* ok in words, never numbers |
| 7 | Food scores / grades | Moralizes eating; shame-based mechanism |
| 8 | Consecutive-day exercise streaks | Punishes rest; gamifies compulsion |
| 9 | Body measurements for aesthetics (waist etc.) | No wellness purpose for minors |
| 10 | "Ideal weight" projections / weight-loss timelines | Prescriptive weight loss for minors requires clinician supervision, never an app |
| 11 | Menstrual data shared with parents | Always H2; collection only with teen consent |
| 12 | Supplement/diet-pill recommendations | Unregulated, risky; never suggested to <18 |

*Note on #1: clinical weight measured by a pediatrician is outside the app. If a clinician-directed program needs weight visibility, that's a clinician-supervised integration with explicit consent — not a dashboard metric.*

---

## PART 7 — Gaps (missing features)

1. **Crisis protocol** — 988/Crisis Text Line integration, safety-plan flow, and the upfront-disclosure copy (partially addressed by Changes B/F; needs a dedicated build spec with the safety pod).
2. **The health privacy tiers themselves** — undefined (headline finding #1); Part 2 is a proposal awaiting legal + guidance-pod sign-off.
3. **ED / compulsive-exercise safeguards** — detection + supportive-response flows for W22/W23 (Part 5).
4. **Medical disclaimer + no-diagnosis framework** for all AI health answers (Change G is the routing rule; the copy and clinical review process are missing).
5. **Menstrual-health privacy handling** — collection consent, absolute H2 default, no parent inference (e.g., never surface cycle-based "insights" to parents).
6. **Teen-controlled health data retention & deletion** — W8/mood content needs auto-expire options; "check-ins indefinite" is inappropriate for health-adjacent data.
7. **Abuse-disclosure protocol** — if a teen discloses abuse in W8 or chat: mandated-reporting handling, which varies by state — coordinate with safety + legal pods (Georgia mandatory reporting statutes apply to designated reporters; the app's role needs definition).
8. **"Help me tell someone" flow** — guided trusted-adult disclosure (draft a message to a parent/counselor/doctor together) — the evidence-based bridge between teen privacy and getting help.
9. **Break-glass emergency medical info** — allergies/conditions/meds reachable in a true emergency even when teen-private (W19), with audit logging.
10. **Health API authorization spec** — per-scope enforcement for future `/api/v1/children/[childId]/health/*` endpoints (Part 4 §8).
11. **Puberty-development content guardrail** — not currently a feature; state explicitly that Tanner-stage-type tracking will never be built, so a future module doesn't reinvent it.
12. **"Power-up" definition** — undefined daily pull; if it's a supplement/energy product, it needs health-claim review or removal.

---

## PART 8 — Features that shouldn't exist as designed

1. **W23 food logging with protein/macro framing for <18** — redesign per Part 5 (pattern-based, no numbers; full logging is adult-only).
2. **W22 consecutive-day streaks for <18** — remove; replace with non-consecutive active-day counts + rest-positive framing.
3. **Muse "unfiltered" mode applied to health topics** — blocked; Change G.
4. **Unconstrained proactive health nudges** — blocked; opt-in + content constraints per Part 5.
5. **Coarse "health" as a single sharing scope for 13–17** — replaced by H1/H2/H3 (Changes A/E).
6. **Cooling-off + immediate parental notification applied to health-data revocation** — exempted (Change C).
7. **Indefinite retention of mood/health check-ins** — replaced by teen-controlled retention with auto-expire defaults.

---

## PART 9 — Reassessment flags (for other pods)

- **Legal pod:** confirm Georgia minor-consent scope (STI, substance-use, outpatient mental-health statutes) and whether 42 CFR Part 2 attaches to any substance-use data the app would hold; FDA wellness/device boundary if mood screening approaches PHQ-9A/GAD-7 territory (recommend staying firmly on the wellness side: no scored clinical instruments without clinical oversight); Georgia mandatory-reporting interaction with in-app abuse disclosures.
- **Security pod:** per-scope RLS for `child_access_scopes`; audit logging on break-glass emergency access; health-data encryption posture; teen-initiated deletion must propagate to backups/exports.
- **Guidance pod:** sign off on the H0–H3 taxonomy; define the deterministic crisis-trigger phrase list jointly with the safety pod; review nudge copy bank for weight/appearance/diet language.
- **Design pod:** health UI must be shame-free and non-alarmist (no red-flag styling on teen vitals, no celebratory animation on extreme activity); Sharing-screen health section per Change F; collapsed-by-default health detail.
- **Education pod:** peer-tips content moderation (no diet/weight-loss/study-drug tips); teacher-thread health-disclosure handling.
- **Reassessment trigger:** revisit this review when (a) any H0 metric is proposed for <18, (b) health API endpoints are specified, (c) the crisis protocol build spec lands, or (d) jurisdiction expands beyond Georgia.

---

*Review completed 2026-10-12. Standards cited are professional/clinical guidelines, not legal advice — statutory questions are flagged for the legal pod.*
