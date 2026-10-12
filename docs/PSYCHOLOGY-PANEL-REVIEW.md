# Psychology Panel Review — Pookie Access Model + Feature List

**Reviewer role:** child/adolescent developmental psychologist
**Date:** 2026-10-12
**Scope:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (access model) + `FEATURE-LIST-FOR-PANEL.md` (31 modules, 8 categories). Starting jurisdiction: Georgia.
**Verdict key:** ✅ clear · ⚠️ needs change · 🛑 blocked (as designed)

**Headline:** The access model's core bet — *the child is the access authority* — is developmentally sound and unusually brave. The empirical literature on parental monitoring (Stattin & Kerr, 2000) says the knowledge parents actually get comes overwhelmingly from adolescent *voluntary disclosure*, not surveillance; surveillance-heavy designs purchase the illusion of oversight at the price of the disclosure that makes oversight real. This spec mostly gets that. But several features smuggle surveillance back in through side doors (mood pulse, friends tracking, check-in "gotcha"), the Muse unfiltered toggle is unsafe for minors as designed, and unilateral teen authority has three red-flag scenarios the spec does not handle. Details below.

---

## PART A — Access model verdicts (per spec section)

| § | Section | Verdict | One-line rationale |
|---|---|---|---|
| 1 | Product principles | ✅ | Child-as-authority + graduation framing align with autonomy development (Erikson; Deci & Ryan, 2000). Server-side enforcement is correct. |
| 2 | Signup & onboarding | ⚠️ | Missing: distinct teen onboarding path; agency-escape hatch for parent-managed 13+ profiles (see change C3). |
| 3 | Authority matrix | ⚠️ | Coercion/custody/grooming scenarios unhandled; no imminent-harm safety hold; non-parent adult grants need an age gate (see C1). |
| 4 | Age tiers | ⚠️ | Tier structure is right; 13 is the legal floor not a developmental line (see §B). Cooling-off is sound psychology but immediate parent notification is a pressure channel (see C2). 18+ continuity ✅ — matches emerging-adulthood evidence (Arnett, 2000). |
| 5 | Child linking | ⚠️ | Link codes + hardened invites are good. Claim dedupe ✅. Missing: teen-side "this wasn't me" repudiation path. |
| 6 | Go independent | ⚠️ | Confetti framing is fine, but graduation must be *genuine* — the teen must gain real utility, not just lose oversight (see C5). |
| 7 | Just me mode | ✅ | Correct; non-parents are real users, not failed parents. |
| 8 | Migrations | ✅ | No psych objection. |
| 9 | API surface | ⚠️ | `revokeAccess` needs a safety-hold path; `grantAccess` needs the non-parent-adult age gate (see C6). |
| 10 | UI screens | ⚠️ | Sharing screen needs a "what they see right now" live preview; revocation copy and parent-notification copy need dignity-preserving language (see C7). |
| 11 | Risks & mitigations | ⚠️ | Four missing risks: coerced grant/revocation, crisis self-isolation, grooming via request-access, the parent-managed-13+ loophole (see C8). |

### On the 13-year line specifically

13 is the right *legal* line (COPPA) and a defensible *product* line, but the panel should not mistake it for a developmental one. The capacity literature finds adult-like decision-making in "cold" (low-arousal, unhurried) contexts emerging around 15–16, with "hot" contexts (peer presence, emotional arousal, parent conflict — i.e., exactly when a teen revokes access) lagging behind (Steinberg et al., 2009; Casey, Jones & Hare, 2008). That gradient is precisely why the spec's 13–15 *shared agency with cooling-off* tier is the most psychologically literate part of the document: it treats 13–15 as a zone of *supported* autonomy rather than full autonomy. Keep the tiers; do not market 13 as "old enough to decide alone." Where science is unsettled: the exact age boundaries of decision-making capacity are contested (Icenogle et al. note wide individual variation), so the tier cutoffs are reasonable conventions, not findings.

### Surveillance vs. autonomy: the governing principle

Stattin & Kerr's (2000) reinterpretation of parental monitoring is the single most relevant finding for this product: most of what parents know about teens' lives comes from what teens *tell* them. Parental knowledge obtained through control and surveillance predicts *worse* outcomes than knowledge obtained through disclosure (Kerr, Stattin & Burk, 2010). Barber (1996) and Soenens & Vansteenkiste (2010) further distinguish *behavioral* control (supervision, structure — helpful) from *psychological* control (guilt induction, love withdrawal, invalidating feelings — harmful). Design rule that falls out of this: **every feature should be scored on whether it increases voluntary teen disclosure or replaces it.** Features that replace disclosure with detection (check-in cross-check shown to the teen, mood dashboards for parents, friends tracking) buy short-term parental comfort at the cost of the disclosure channel the parent actually needs. The spec's access model mostly honors this; several modules don't (Part C).

### Cooling-off psychology

A 7-day revocable cooling-off for 13–15 is well-grounded: it targets the hot-cold empathy gap (Loewenstein, 2005) — decisions made in the heat of a parent-teen fight feel different a week later — and converts an irreversible rupture into a reversible pause, which is autonomy-*supportive* rather than autonomy-restricting (Grolnick & Ryan, 1989). Two refinements needed: (1) the cooling-off must include a teen-side check-in ("still want this? here's what changes"), not just a parent notification, or it functions as a parental veto by delay; (2) immediate notification of *both* parents creates a live pressure channel during the exact 7 days the teen is supposed to be deciding freely — the notification copy must be neutral, and the product should establish a norm (and ideally a mechanism: no reply-to-the-teen about the revocation for 48h) against lobbying. Waiting periods have mixed evidence in other policy domains; in families the mechanism that matters is *reversibility + time*, not the waiting per se — science here is suggestive, not settled.

### How revocation should FEEL

Apply procedural justice (Tyler, 2006): people accept outcomes they dislike when they had *voice*, the process was *neutral*, they were treated with *respect*, and the authority seemed *trustworthy*. For the teen: private, calm, no guilt screens (spec already bans these — keep the ban absolute), plain-language consequence list, one explicit reassurance ("this changes what Mom can see, not whether she loves you" — the app cannot promise the parent's reaction, so word it as what the *app* does, not what the parent feels), and instant confirmation that it worked. For the parent: notification must preserve dignity — never "your child cut you off." Frame as a *pause the teen controls*, list what it does and doesn't mean, and offer a repair path (conversation prompts, "what to say tonight" coaching) rather than surveillance workarounds. Critically: **do not show the parent a countdown or the teen's cancellation status during cooling-off** — a visible "3 days left, she hasn't cancelled" ticker converts the parent into a lobbyist and the teen's week into a siege. Also give the teen an optional free-text note to the parent ("I need space about grades, I'm fine") — voice reduces retaliation risk.

### "Graduation with confetti" framing

Good instinct, one caveat. Rites of passage work when the transition is *real* (Arnett, 2000, on emerging adulthood as identity exploration). Confetti over a screen that just *removes* parental access is decoration over loss — for the parent it reads as celebration of their exclusion, which fuels the "cut you off" narrative the marketing rule forbids. Graduation must *add*: the teen's Pookie visibly gains capabilities at independence (full personal modules unlocked, data-source handoff completed, a "your assistant, your rules" setup moment). Then the confetti is honest. Also: the parent needs their own transition ritual — a "your job here changed, here's what's still yours" screen — or the product manufactures the exact parental grief it claims to avoid.

### Red flags in unilateral teen power (must be addressed)

1. **Coerced revocation/grant.** In high-conflict custody cases, a parent coaches the teen to revoke the other parent's access. The spec blocks Parent A from revoking Parent B's grant but hands the same power to a pressured child. W14 (Co-parenting) sits directly on this fault line.
2. **Crisis self-isolation.** A teen in a depressive episode or crisis revokes all adult access — the moment they most need a safety net, the product removes it. There must be an imminent-harm safety hold (see C1/C6), narrowly drawn and transparent.
3. **Unsafe grants.** A 13-year-old can grant access to *any* adult, and any non-parent adult can request access with only the child's approval. That is a grooming vector wearing a consent costume. Under-16 grants to non-parent adults need a parent co-approval (or at minimum a parent notification + 48h delay), and request-access from non-parent adults to 13–15s should require it.
4. **The parent-managed 13+ loophole.** A 13+ profile with no email stays parent-managed *indefinitely* — a controlling parent can simply never add the email, and the teen never gets the agency the spec promises. Age must trigger agency: at 13, parent-managed profiles become teen-claimable with periodic prompts (see C3).

---

## PART B — Concrete spec changes (quote → replacement)

**C1. §3 matrix — add safety override + non-parent-adult grant gate.**
> Quote: "| Revoke access the child granted | ✅ | ❌ | ❌ |"
> Add two rows below the matrix:
> "| Revoke access the child granted | ✅ | ❌ | ❌ |"
> "| **Safety hold (imminent harm)** | — | — | — | *Narrowly-drawn, time-boxed safety hold (see §3a): when the system detects a credible imminent-harm signal (teen-authored crisis disclosure in chat/check-in, or a parent report with corroboration), revocation of the notifying parent is paused up to 72h and a crisis-resource flow is offered to the teen. The teen is told plainly what is happening and why. Not a parental veto: it expires automatically, cannot be extended by a parent, and is logged for audit.* |"
> "| Grant access to a non-parent adult (child under 16) | ⚠️ teen initiates, **parent co-approves** | ✅ co-approves | ❌ |"

**C2. §4 (13–15) — defuse the notification pressure channel.**
> Quote: "both parents notified immediately (told, not asked)."
> Replacement: "both parents notified immediately (told, not asked) with neutral, dignity-preserving copy — e.g. 'Dawson paused grade sharing. This is reversible for 7 days. Here's what this means, and a guide for talking about it tonight.' The notification contains no countdown, no cancellation status, and no reply channel to the teen about the revocation for 48 hours. The teen receives a parallel check-in on day 3: 'Still want this? Here's what changes.' Cancellation is one tap, always."

**C3. §2/§4 — close the parent-managed 13+ loophole (new subsection 4.5).**
> Quote: "→ birthdate ≥ 13y, no email: parent-managed, email addable later"
> Replacement: "→ birthdate ≥ 13y, no email: parent-managed *provisionally*. At age 13 the profile becomes teen-claimable: the teen is prompted (via any session, link code, or email added later) to claim their login, and the creating parent receives periodic, non-dismissible reminders that the profile is awaiting the teen's claim. A parent-managed profile for a 13+ teen must show a persistent banner: 'This profile belongs to [name], 14. Add their email so they can claim it.' Agency delayed is agency denied."

**C4. §2 — teen onboarding path.**
> Quote: "Step 2: 'Do you want to track children in Pookie?' [Yes / Skip for now]"
> Add: "When the *signing-in user* is 13–17 (verified teen session via invite/link-code redeem), onboarding is a separate teen path: (1) 'Here's what [parent] can currently see' — explicit, itemized; (2) the 'I understand' consent screen from §4; (3) 'Who can see my stuff?' preview. A teen must never land in the parental 'add children' flow."

**C5. §6 — graduation must add, not just remove.**
> Quote: "- Positioned as graduation: confetti, 'your own Pookie' — the teen gains a full personal assistant, not just loses oversight."
> Replacement: "- Positioned as graduation: confetti, 'your own Pookie' — and graduation must be *substantive*: at independence the teen's Pookie unlocks the full personal module set, completes the data-source handoff (§4), and runs a 'your assistant, your rules' setup. The parent simultaneously receives a transition screen: 'Your role changed. Here's what stays yours, and how to stay close without the dashboard.' Celebration without new capability is decoration over exclusion."

**C6. §9 — API safety paths.**
> Quote: "`revokeAccess(childId, adultUserId)` → enforces matrix; 13–15 parent-revoke schedules cooling-off"
> Replacement: "`revokeAccess(childId, adultUserId)` → enforces matrix; 13–15 parent-revoke schedules cooling-off; checks safety-hold status (§3a) before executing. `grantAccess(childId, adultUserId)` → child or parent; sets `granted_by`; **if grantee is a non-parent adult and child is under 16, creates a pending grant requiring parent co-approval (48h expiry).**"

**C7. §10 — sharing screen transparency requirement.**
> Quote: "3. Child Sharing screen — 'Who can see my stuff?', per-person toggles, what's-visible list, approve/deny access requests, block adult"
> Replacement: "3. Child Sharing screen — 'Who can see my stuff?', per-person toggles, a **live 'what they see right now' preview per person** (the teen can view their own record exactly as Mom sees it — transparency is the difference between consent and fine print), what's-visible list, approve/deny access requests, block adult. Revocation confirmations use teen-plain language and state reversibility up front."

**C8. §11 — add the four missing risks.**
> Add rows: "9. Coerced grant/revocation in custody conflict → §3a safety rules; W14 co-parenting norms; audit log of grant/revoke events visible to both parents. 10. Crisis self-isolation → imminent-harm safety hold (72h, auto-expiry, teen-informed) + crisis-resource flow; see gap G1. 11. Grooming via request-access → under-16 non-parent grants require parent co-approval; block list; rate limits. 12. Parent-managed 13+ indefinite → teen-claimable at 13 with persistent prompts (§4.5)."

---

## PART C — Feature verdicts (every feature, with citations)

### 1. Core platform

| Feature | Verdict | Notes |
|---|---|---|
| Google OAuth + magic link, Supabase sessions | ✅ | Low-friction auth is correct for teen adoption. |
| Onboarding (planned) | ⚠️ | Per C4: needs a distinct teen path; the parental "add children" flow must never be a teen's landing. |
| 5-tab plain-English nav | ✅ | Plain language reduces cognitive load; the metaphor-name correction was the right call. |
| Child switcher | ⚠️ | Fine functionally, but never render children comparatively (no side-by-side grades). Sibling comparison fuels perceived differential treatment (McHale, Updegraff & Whiteman, 2012). |
| Nebula theme | ✅ | Aesthetic engagement supports the "morning ritual" habit loop; no psych objection. |
| `/verify-invite` public landing | ✅ | |

### 2. Pookie AI assistant

| Feature | Verdict | Notes |
|---|---|---|
| Pookie warm-tutor chat | ✅ | Warmth + tutoring is the right persona blend; tutor rapport predicts engagement. |
| **Muse toggle (direct, unfiltered)** | 🛑 **blocked for under-18 as designed** | "Unfiltered" and "minor" are incompatible. Teens form parasocial bonds with AI companions and disclose mental-health, sexual, and relationship content to them (Common Sense Media, 2025). An unfiltered mode risks unsafe advice in exactly the crises this app's other modules (W8 mood, W1 grade stress) surface. **Change:** Muse toggle is 18+ only. Teens get a bounded-direct persona: honest and straight-talking *within* safety guardrails (no graphic sexual content, self-harm protocol always on, no manipulation tactics). Market the teen version as "Muse Jr." energy without the "unfiltered" promise — do not promise teens something safety requires you to break. |
| Proactive nudges | ⚠️ | Nudges are autonomy-relevant interventions (cf. JITAI literature, Nahum-Shani et al., 2018): effective when *wanted*, manipulative when imposed. **Changes:** (a) nudges about the teen's life are configured by the teen (or co-configured), never silently by the parent; (b) any parent-authored nudge is labeled as from the parent; (c) frequency caps + quiet hours + one-tap "stop nudging me about this"; (d) never nudge the teen about data the teen revoked — that converts revocation into a lie. |
| Weekly teacher discussion threads (Muse drafts, parent approves) | ⚠️ | Drafting a parent's message to a teacher *about the teen* without the teen's voice is agency theft at the exact age identity formation requires voice (Erikson). **Change:** age-graded authorship — 13–15: teen reviews/co-signs before parent approves; 16+: teen is the author, parent is CC'd only if the teen opts in. |

### 3. Today (daily ritual)

| Feature | Verdict | Notes |
|---|---|---|
| Morning ritual view | ✅ | Ritual + glanceables build habit without surveillance. |
| Tonight's plan assembly | ✅ | Planning support scaffolds executive function — genuinely autonomy-supportive. |
| **Check-in cross-check** (self-report vs synced data) | ⚠️ | The highest trust-risk feature in the product. Being "caught" by a system reliably reduces future disclosure (Jensen et al., 2004, on adolescent lying; Finkenauer et al., 2002, on secrecy; Stattin & Kerr, 2000). **Changes:** (a) cross-check output is **parent-facing only**, framed as calibration data, never shown to the teen as a "lie detected" state; (b) the product must coach the parent to *never confront* — provide curious-question prompts instead ("The portal shows the study guide missing — want help finding it?"); (c) log whether parents use confrontational language? (out of scope — but the briefings should model curiosity every time); (d) if discrepancy is shown to the teen at all, show it as *their own* data side-by-side ("you said X, portal says Y — fix either one") with no accusation state. The "curious non-accusatory tone" requirement is correct — enforce it in copy review, not just intent. |

### 4. The 31 modules

**Grove: Body & Heart**

| ID | Module | Verdict | Notes |
|---|---|---|---|
| W2 | Health | ⚠️ | Vitals/trends fine. **Teen health privacy tiers must reflect minor-consent law**, not just product preference: in Georgia, minors can independently consent to certain care (e.g., STI testing/treatment, substance-abuse treatment), and the confidentiality of that care is legally protected — a parent dashboard that ingests everything the health app sees can silently violate it. Defer specifics to the legal panelist, but the tiering rule must be: *data arising from care the teen consented to independently defaults to teen-only*. Also: weight/BMI glanceables for teens need eating-disorder-safe presentation (no red-flag coloring on a number). |
| W8 | Wellbeing — daily mood pulse (**teenPrivate**) | ⚠️ | teenPrivate default is correct — emotional surveillance ("Dad watches my mood graph") reliably produces *performative* reporting and then *no* reporting, corrupting the data and the relationship. **Changes:** (a) parents never see daily entries; at most, teen-opted-in *trend* sharing (" rough week" aggregates, never day-level); (b) any parental nudge like "you seemed sad Tuesday" drawn from this module must be impossible by design; (c) note unsettled science: EMA reactivity effects (does daily mood tracking amplify rumination?) are not resolved — keep the pulse to one tap, no journaling requirement, and watch the literature. Pair with gap G1 (crisis protocol): a low-mood streak should offer *the teen* resources, not alert the parent — unless the teen opts into a "tell Mom if I'm low 5 days" pact, which is a beautiful autonomy-preserving design if genuinely teen-authored. |
| W13 | Meals | ✅ | "Planned not panicked" reduces household friction; no objection. |
| W22 | Activity | ⚠️ | Steps/streaks fine, but streak-break design matters: broken streaks presented punitively (lost flame, red states) punish the exact teens who need re-entry. **Change:** streaks framed as "keep going" with grace days; never show streak loss to parents as a concern flag. |
| W23 | Nutrition — food logging | ⚠️ | Food logging in adolescents is the module most likely to cause iatrogenic harm: self-monitoring of intake is associated with disordered-eating onset in vulnerable teens, and "protein, balance" framing doesn't neutralize it. **Changes:** (a) no calorie counting for under-18 accounts, ever; (b) no red/amber/green moralizing of foods; (c) an eating-concern screen-in (SCOFF-brief style) before enabling logging for 13–17, with a soft off-ramp; (d) parent visibility: none by default. The Restaurants taste-profile wiring (W28) is fine — preference learning isn't intake surveillance. |

**Grove: Home & Family**

| ID | Module | Verdict | Notes |
|---|---|---|---|
| W21 | Mail | ✅ | Genuinely useful; no developmental concern. |
| W20 | Shopping list | ✅ | Shared household coordination; fine. |
| W11 | Spending | ✅ | Adult/household finance; fine. |
| W7 | Money & Documents | ✅ | Fine. |
| W24 | Credit | ✅ | Adult module; fine in "just me" mode. |
| W14 | Co-parenting | ⚠️ | Two-household coordination is a real need, but this module sits on the custody-conflict fault line identified in red flag #1. **Changes:** (a) grant/revoke events are audit-logged and visible to *both* parents (transparency deters coaching); (b) no feature that lets one household message *about* the teen to the other household without the teen's awareness at 13+; (c) in-app copy must never take sides ("primary parent" language). Recommend a family-therapy-informed review of this module's copy before build. |
| W12 | Babysitters | ✅ | Fine. |
| W10 | Fairness — equity lens across children | ⚠️ (parent-only) / 🛑 (any child-visible form) | The intent (noticing neglected needs) is good; the mechanism (quantified comparison across siblings) is hazardous. Perceived differential treatment predicts sibling conflict and poorer adjustment (McHale et al., 2012), and social-comparison theory (Festinger, 1954) predicts the compared-against child internalizes the deficit. **Change:** parent-only, framed as "attention check" prompts ("it's been 3 weeks since 1:1 time with Maya"), never scores, never rankings, never shown to children in any form. If it can't be built without a score, don't build it. |

**Grove: School Days**

| ID | Module | Verdict | Notes |
|---|---|---|---|
| W1 | School (live) | ⚠️ overall | See sub-features. The 13-source intelligence model is impressive; the risk is that comprehensiveness becomes comprehensiveness-of-surveillance. Hold the line: intelligence *for* the teen and parent-as-coach, not intelligence *about* the teen for the parent-as-auditor. |
| — | Path-to-90 / gap-to-90 hero | ⚠️ | The shame-free, gap-framed, top-3-actions design reflects good instincts (effort attribution per Weiner, 1985; proximal action steps). But a fixed 90%-in-every-class goal for a teen sitting at 69 in Geometry violates goal-setting basics: goals must be perceived as attainable or they produce withdrawal, not effort (Locke & Latham, 2002), and pure performance-goal framing ("hit 90") predicts anxiety and avoidance relative to mastery framing ("understand quadratics") (Elliot & McGregor, 2001; Ames, 1992). **Changes:** (a) per-class *proximal* goals auto-derived from the gap ("Geometry: 69 → 75 by Nov 1" as the displayed mission; 90 stays as the horizon); (b) trajectory framing ("+6 this month") alongside gap framing; (c) keep the top-3 actions but tag each with the *skill* it builds, not just the points it earns; (d) a perfectionism guard: if the gap is large and effort is high, the copy must normalize ("this is a climb, not a failure"). |
| — | Per-class pages, collapsed cards | ✅ | Collapsed-by-default respects autonomy; good. |
| — | Daily check-in per class | ✅ | Teen-authored data is the disclosure channel — protect it (see cross-check). |
| — | Teacher inbox merge | ⚠️ | See teacher-threads verdict: teen co-authorship, age-graded. Also: merging counselor mail into per-class inboxes risks the teen never seeing counselor communications as *their* relationship — keep a distinct counselor thread visible to the teen. |
| — | AI practice quizzes, unit alignment | ✅ | Mastery-oriented, teen-controlled; exemplary. |
| — | Peer tips pipeline (600/wk) | ✅ | Peer modeling is developmentally potent; 4-week expiry keeps it fresh. Vet tip content for comparison/shame language. |
| — | SAT prep, lunch/dinner, power-up, notes, news | ✅ | |
| — | **Horoscope daily pull** | ⚠️ (remove from School) | Not a safety issue — a credibility one. A school-intelligence module that pulls horoscopes teaches the teen that the product doesn't distinguish evidence from entertainment. Move it to an entertainment corner or drop it; don't spend the panel's seriousness capital defending it. (Minor.) |
| W16 | School calendar | ✅ | |
| W5 | College & Future | ⚠️ | Simulators are excellent for making abstract futures concrete (possible-selves literature). **Watch:** for a 15-year-old with a 69 in Geometry, a 12-year anesthesiologist pathway can read as a verdict rather than a vision. **Change:** gate the long-pathway visualization behind exploration ("curious about medicine?") rather than default display; always pair reach schools with match/safety framing; add "many paths" normalization. |
| W4 | Activities | ✅ | |
| W18 | Summer | ✅ | |

**Grove: Safe & Sound**

| ID | Module | Verdict | Notes |
|---|---|---|---|
| W3 | Safety (insurance) | ✅ | |
| W19 | Emergency | ⚠️ | Emergency plan + documents ✅. **Must** house the crisis protocol (gap G1): 988, Crisis Text Line, and the in-app self-harm/abuse disclosure flow. An app with teen mood tracking and an AI chat companion that lacks a crisis flow is a 🛑 at launch — treat G1 as launch-blocking. |

**Grove: Growing Up**

| ID | Module | Verdict | Notes |
|---|---|---|---|
| W6 | Driving & Life Skills | ✅ | The best-placed module in the grove: independence steps and life-skills checklists are autonomy-supportive by construction (competence-building per SDT). **Notes:** (a) licensing content must be state-specific (GA: Class D at 16 with Joshua's Law requirements — verify with legal/current sources, don't hardcode); (b) let the teen check off skills themselves — parent verification optional, not required; (c) expand "life skills" beyond driving (laundry, cooking, budgeting basics, medical appointments) — the independence-steps framing is the product's thesis, give it room. |
| W15 | Screen Time — "screen limits that stick" | ⚠️ | **Who sets the limits is the entire psychology of this module.** Imposed limits trigger reactance (Brehm, 1966; Dillard & Shen, 2005), circumvention, and secrecy — the teen literature finds adolescents actively defeat parental control tools they experience as illegitimate (Wisniewski et al., 2017), while collaborative mediation predicts better outcomes (Livingstone & Helsper, 2008; Wisniewski et al., 2015). **Changes:** (a) default: the *teen* sets their own limits with the app as coach ("you wanted <2h TikTok on school nights — you're at 1h40"); parent sees aggregates, not app-by-app surveillance; (b) 13–15: co-set limits (both sign); 16–17: teen sets, parent can *propose*; (c) "limits that stick" must mean stickiness through buy-in, not through lockout strength — design the re-entry, not the wall; (d) never report screen-time data as a parent concern flag. Where science is unsettled: the screen-time/well-being effect sizes are small and contested (Orben & Przybylski, 2019; Przybylski & Weinstein, 2019) — the module should not pathologize normal use. |
| W17 | Friends — social world tracking | 🛑 **as parent-visible social tracking; rebuild as teen-owned** | Peer relationships are the central developmental task of adolescence (Brown & Larson, 2009); a parent-facing "social world tracking" module is surveillance of the exact domain where autonomy matters most, and it will be experienced as such. It also creates novel harms: parents judging friendships from data traces, intervening in peer conflict with partial information, and teens maintaining a sanitized shadow social life. **Change:** W17 becomes a *teen-owned* social module — their people, their plans, their contact management — with **no parent view by default**. The only parent-facing element is teen-opted-in ("share my weekend plans with Mom") or a narrow safety exception (see C1 safety hold). If the module can't survive without a parent view, cut it. |

**Grove: Out & About (W25–W31)**

| Module | Verdict | Notes |
|---|---|---|
| W25 Fuel & Charging, W26 Weather, W27 Events, W28 Restaurants, W29 Trails & Parks | ✅ | Life-module territory; no developmental concerns. W27/W28 "family-fit"/taste learning fine. |
| W30 Flights, W31 Rental Cars | ✅ with note | Note minor-traveler and driver-age rules in UX (unaccompanied-minor policies; rental age 21/25 surcharges) so the AI doesn't plan impossible trips. |

### 5. School intelligence (W1 detail) — covered above; one addition

| Feature | Verdict | Notes |
|---|---|---|
| Path-to-90 checkboxes → Supabase | ✅ | Persistence supports cross-device agency; fine. |
| Check-in retention: indefinite | ⚠️ | A permanent archive of a 14-year-old's daily self-reports is a privacy time bomb (future college, future employer, future parent conflict). **Change:** teen-controlled retention with a default (e.g., rolling 12 months for check-in *text*; aggregates longer), and a "forget this semester" control. Indefinite retention of minor-authored emotional data needs the teen's ongoing consent, not a default. |

### 6. Family & access management — see Part A/B. One addition:

| Feature | Verdict | Notes |
|---|---|---|
| Block list (teen permanently blocks an adult from requesting) | ✅ | Genuinely protective; keep. Ensure blocking is quiet (no notification to the blocked adult that names the teen's action — "requests are closed" rather than "Dawson blocked you"). |

### 7. Settings & data management

| Feature | Verdict | Notes |
|---|---|---|
| Sync console, credentials vault (encrypted), notification prefs | ✅ | |
| Data retention policies (per-source; "emails TBD") | ⚠️ | "TBD" on email retention for minors' data is not acceptable at launch. Decide before ship; default to teen/family control with plain-language policy. See check-in retention above. |

### 8. API platform

| Feature | Verdict | Notes |
|---|---|---|
| Planned REST surface | ✅ technically | Every `children/[childId]` endpoint must enforce the sharing model server-side per §1.5 (client never derives roles). Add audit logging on all child-record reads — the teen's "who looked at my stuff" log (Part D) depends on it. |

---

## PART D — Feature improvements (priority order)

1. **Crisis protocol first (launch-blocking).** W19 must include: in-app self-harm disclosure flow in Pookie chat and W8 (always-on, non-alarmist: "I'm here, here's 988, here's Crisis Text Line, want me to tell [trusted adult]?"), abuse/neglect disclosure routing with GA mandatory-reporting realities handled per legal panelist's guidance, and a parent-facing "your teen asked for help" playbook. The product cannot hold teen mood data and an AI companion without this.
2. **"What Mom sees" preview.** The Sharing screen's live preview (C7) is the single highest-leverage trust feature: it converts consent from a checkbox into comprehension.
3. **"Who looked" audit log for teens.** Every parental view of teen data logged and teen-visible ("Dad viewed your grades Tue 8pm"). Transparency disciplines surveillance into legitimate interest. This is the practical enforcement of the Stattin & Kerr principle.
4. **Proximal goals engine** for path-to-90 (Part C): auto-derive the next attainable step per class; celebrate trajectory, not just threshold.
5. **Parent coaching cards.** The product's theory of change depends on parents behaving like autonomy-supportive coaches. Give them the lines: curious-question prompts for cross-check discrepancies, repair scripts post-revocation, "what not to say" guards. This is arguably a missing module (gap G3) but start as cards in Today.
6. **Teen-authored safety pacts.** "Tell Mom if my mood is low 5 days in a row" — teen-configured, teen-revocable. Converts surveillance into chosen support; the template for how every sensitive module should work.
7. **Annual re-consent.** Sharing grants get a yearly "still good?" moment for the teen — consent decays, especially consent given at 13. Lightweight, one screen, skippable only by active confirmation.
8. **W6 expansion** into full life-skills (cooking, laundry, appointments, budgeting) — the independence thesis deserves more than driving.
9. **W15 re-entry design:** the module's success metric should be "teen returns to their own limit after a break," not "lockout held."
10. **W10 rebuild** as parent-only attention prompts, no scores.

## PART E — Gaps (missing features)

- **G1. Crisis/safety protocol** — see above; launch-blocking. (Self-harm, abuse disclosure, 988/Crisis Text Line integration, parent playbook.)
- **G2. Sleep module.** Adolescent sleep is the highest-leverage health behavior in this age group (Carskadon and the adolescent sleep phase-delay literature; AAP guidance). Health-app data can feed it. Its absence in Body & Heart is conspicuous.
- **G3. Parent coaching module.** Autonomy-supportive parenting is a *skill*; the product assumes it. A "for parents" track — short, scenario-based (grounding without rupture, the revocation conversation, homework without hovering) — would do more for outcomes than another dashboard.
- **G4. Teen transparency center.** "What they see" preview + "who looked" log (D2, D3) deserve a first-class home, not a settings corner.
- **G5. Bullying/cyberbullying path.** A reporting + coping flow for the teen, distinct from parental surveillance of messages. (Do not build message-content surveillance for parents — it destroys the disclosure channel.)
- **G6. Repair kit for post-revocation.** Conversation guides, cooling-off activities, and a "re-grant when ready" path for *both* sides. Revocation without repair is just rupture with confetti.
- **G7. Media literacy / digital citizenship.** If the product nudges, tracks screens, and chats via AI, it should teach critical engagement with all three. Fits the Grow tab.
- **G8. Sibling-relationship support.** W10 watches fairness *across* children; nothing supports the sibling relationship itself (shared activities, conflict repair). Optional but aligned.
- **G9. Transition-off planning.** Beyond "go independent": college departure, data portability, the 18+ handoff of school credentials — the product should plan its own obsolescence gracefully per child.
- **G10. Assent for under-13s.** COPPA requires parental consent, but developmental best practice adds *child assent* in age-appropriate form as the child approaches 13. A 12-year-old's data deserves a "here's what we keep" conversation, not just a parent's signature.

## PART F — Features that shouldn't exist as designed

1. **Muse "unfiltered" for under-18** — rebuild as bounded-direct, 18+ only for true unfiltered. (Part C)
2. **W17 Friends as parent-visible tracking** — rebuild as teen-owned or cut. (Part C)
3. **Parent-visible daily mood entries (W8)** — teen-private with opt-in trend sharing only. (Part C)
4. **Teen-facing check-in "gotcha"** — cross-check stays parent-side, confrontation never. (Part C)
5. **W10 Fairness as scores/rankings or child-visible** — parent-only attention prompts or cut. (Part C)
6. **Non-parent adult requesting access to 13–15s on child's sole approval** — parent co-approval required. (C1)
7. **Horoscope in School intelligence** — move or drop. (Part C, minor)
8. **Calorie counting / food moralizing for under-18 (W23)** — remove; keep preference learning. (Part C)

## PART G — Reassessment flags (watch over time)

1. **Cooling-off efficacy.** The 7-day mechanism is theoretically sound but unstudied in this exact form. Instrument it: revocation completion vs. cancellation rates, teen-reported pressure during the window, parent-teen conflict markers. If cancellation correlates with reported parental lobbying, the notification design failed.
2. **Mood-pulse reactivity.** Whether daily mood self-report amplifies rumination in adolescents is unresolved — track engagement vs. well-being signals; be prepared to reduce frequency.
3. **AI companion effects.** The teen-AI-companion literature is months old (Common Sense Media, 2025, is the landmark). Treat all persona decisions as provisional; re-review annually.
4. **Screen-time effect sizes.** Small and contested — do not let W15 drift into pathologizing normal use as the literature moves.
5. **"Who looked" log behavioral effects.** Transparency logs may reduce legitimate parental checking (chilling) or become a new conflict surface ("you checked 4 times!"). Watch and tune.
6. **Fairness-lens effects.** Even parent-only, equity analytics can distort parenting (optimizing the metric, not the child). Qualitative review after 6 months.
7. **Age-tier cutoffs.** Individual variation in decision-making capacity is wide; treat 13/16/18 as conventions and re-examine against outcomes data, not as settled science.
8. **Revocation in custody disputes.** Track grant/revoke event clustering around custody transitions; if coaching patterns emerge, the audit-log deterrent (C8) may need strengthening into active flagging (with legal review).

---

## References (selected)

- Ames, C. (1992). Classrooms: Goals, structures, and student motivation. *Journal of Educational Psychology, 84*(3), 261–271.
- Arnett, J. J. (2000). Emerging adulthood: A theory of development from the late teens through the twenties. *American Psychologist, 55*(5), 469–480.
- Barber, B. K. (1996). Parental psychological control: Revisiting a neglected construct. *Child Development, 67*(6), 3296–3319.
- Brehm, J. W. (1966). *A theory of psychological reactance.* Academic Press.
- Brown, B. B., & Larson, J. (2009). Peer relationships in adolescence. In R. M. Lerner & L. Steinberg (Eds.), *Handbook of adolescent psychology* (3rd ed.).
- Casey, B. J., Jones, R. M., & Hare, T. A. (2008). The adolescent brain. *Annals of the New York Academy of Sciences, 1124*, 111–126.
- Common Sense Media (2025). *Talk, Trust, and Trade-Offs: How and Why Teens Use AI Companions.*
- Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal pursuits. *Psychological Inquiry, 11*(4), 227–268.
- Dillard, J. P., & Shen, L. (2005). On the nature of reactance and its role in persuasive health communication. *Communication Monographs, 72*(2), 144–168.
- Dweck, C. S. (2006). *Mindset.* Random House.
- Elliot, A. J., & McGregor, H. A. (2001). A 2×2 achievement goal framework. *Journal of Personality and Social Psychology, 80*(3), 501–519.
- Festinger, L. (1954). A theory of social comparison processes. *Human Relations, 7*, 117–140.
- Finkenauer, C., Engels, R. C. M. E., & Meeus, W. (2002). Keeping secrets from parents: Advantages and disadvantages of secrecy in adolescence. *Journal of Youth and Adolescence, 31*(2), 123–136.
- Grolnick, W. S., & Ryan, R. M. (1989). Parent styles associated with children's self-regulation and competence in school. *Journal of Educational Psychology, 81*(2), 143–154.
- Jensen, L. A., Arnett, J. J., Feldman, S. S., & Cauffman, E. (2004). The right to do wrong: Lying to parents among adolescents and emerging adults. *Journal of Youth and Adolescence, 33*(2), 101–112.
- Kerr, M., Stattin, H., & Burk, W. J. (2010). A reinterpretation of parental monitoring in longitudinal perspective. *Journal of Research on Adolescence, 20*(1), 39–64.
- Livingstone, S., & Helsper, E. J. (2008). Parental mediation of children's internet use. *Journal of Broadcasting & Electronic Media, 52*(4), 581–599.
- Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation. *American Psychologist, 57*(9), 705–717.
- Loewenstein, G. (2005). Hot-cold empathy gaps and medical decision making. *Health Psychology, 24*(4S), S49–S56.
- McHale, S. M., Updegraff, K. A., & Whiteman, S. D. (2012). Sibling relationship and influences in childhood and adolescence. *Journal of Marriage and Family, 74*(5), 913–930.
- Nahum-Shani, I., et al. (2018). Just-in-time adaptive interventions (JITAIs) in mobile health. *Annals of Behavioral Medicine, 52*(6), 446–462.
- Orben, A., & Przybylski, A. K. (2019). The association between adolescent well-being and digital technology use. *Nature Human Behaviour, 3*, 173–182.
- Przybylski, A. K., & Weinstein, N. (2019). Digital screen time limits and young children's psychological well-being. *Nature Human Behaviour, 3*, 173–175.
- Soenens, B., & Vansteenkiste, M. (2010). A theoretical upgrade of the concept of parental psychological control. *Developmental Review, 30*(1), 74–99.
- Stattin, H., & Kerr, M. (2000). Parental monitoring: A reinterpretation. *Child Development, 71*(4), 1072–1085.
- Steinberg, L. (2014). *Age of Opportunity.* Houghton Mifflin Harcourt.
- Steinberg, L., Cauffman, E., Woolard, J., Graham, S., & Banich, M. (2009). Are adolescents less mature than adults? *American Psychologist, 64*(7), 583–594.
- Tyler, T. R. (2006). *Why People Obey the Law.* Princeton University Press.
- Weiner, B. (1985). An attributional theory of achievement motivation and emotion. *Psychological Review, 92*(4), 548–573.
- Wisniewski, P., Xu, H., Rosson, M. B., & Carroll, J. M. (2017). Parents just don't understand: Why teens don't talk to parents about their online privacy concerns. *Proc. CSCW.*
- Wisniewski, P., et al. (2015). Parental control vs. teen self-regulation: Is there a middle ground for mobile online safety? *Proc. CSCW.*

*Note: GA minor-consent and mandatory-reporting specifics are deferred to the legal panelist; the flags above mark where product design must conform to them.*
