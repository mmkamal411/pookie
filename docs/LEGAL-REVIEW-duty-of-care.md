# Legal Review — Duty of Care, Mandatory Reporting, ToS (User-First Access Model)
**Reviewer role:** product-liability / duty-of-care / ToS counsel (subagent e74c2fea, 19-expert panel)
**Date:** 2026-10-12 · **Jurisdiction:** Georgia (launch) · **Spec reviewed:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12)

> **Scope note:** This is issue-spotting legal analysis for product design, not legal advice and not an attorney-client relationship. Every "human counsel mandatory" flag below means: do not ship that item on this memo alone.

---

## 0. Executive summary — the hard question, answered bluntly

**If a teen writes self-harm signals in a daily check-in after revoking parents, who sees it?** Under the spec as written: *nobody but the teen.* Parents lose future access at revoke; the spec has no monitoring, no review, and no escalation path.

**What is our duty?** Under current Georgia law, a non-clinical app operator has **no general duty to rescue, no Tarasoff-style duty to warn** (Georgia's duty-to-warn is common-law, applies to mental-health professionals in a therapeutic relationship, and concerns threats to *identifiable third parties* — not self-harm), and **no freestanding duty to monitor user-generated content**. That is the good news.

The bad news is the three doors through which liability walks in anyway:

1. **Voluntary undertaking.** Georgia recognizes Restatement §§ 323/324A: if you undertake to render services for another's protection and do it negligently, you can be liable. The spec itself doesn't create an undertaking — but the *product around it does*: the design brief says Pookie should feel "heavenly, protective, watched-over-with-love," Pookie is marketed as "an angel," and parents are *notified* of revocation (implying the company stands in a protective posture). Add any AI keyword-scanning of check-ins and a plaintiff's lawyer will argue: you held yourself out as watching, you had the signal, you cut off the parents, you did nothing.
2. **The AI tutor is our speech, not the teen's.** The Character.AI litigation (5 cases, FL/NY/CO/TX; lead case *Garcia v. Character Technologies* re 14-year-old Sewell Setzer; settled Jan 2026; KY and PA AG suits filed 2026; judge denied the First Amendment dismissal bid) proves courts will let "the chatbot encouraged my child's suicide" cases proceed to discovery. Pookie's tutor (llama-3.3-70b) having open-ended conversations with 13–17-year-olds who just cut off their parents is the single highest-severity fact pattern in this product.
3. **Mandatory reporting gray zone.** Operating the app does not *per se* make anyone a mandatory reporter. But O.C.G.A. § 19-7-5(c)(1)(M) covers **"child service organization personnel"** — persons employed by/volunteering at a business providing "care, treatment, education, training, supervision, coaching, counseling, recreational programs, or shelter to children." An app offering AI tutoring + daily check-ins to minors is colorably an "education/coaching" business serving children. The moment any employee (support, QA, trust & safety, training-data review) reads a check-in disclosing abuse with "reasonable cause to believe," the mandatory-report duty arguably attaches — failure to report is a misdemeanor, § 19-7-5(h). Nobody reading check-ins today = duty never triggers. The first moderation hire changes everything.

**Worst case, stated plainly:** A 14-year-old revokes both parents (7-day cooling-off, parents notified, nothing else happens). On day 9 she writes a detailed suicide plan in her check-in. Our AI tutor, in a separate chat the same evening, responds with the kind of prolonged romantic/attachment roleplay the Character.AI complaints allege. She dies. Her parents sue for negligence, wrongful death, and deceptive trade practices, arguing (a) we designed the revocation feature that isolated her, (b) we undertook a protective role via branding + notifications, (c) our AI actively encouraged her, and (d) our staff are mandatory reporters who sat on abuse disclosures in the same check-in history. Settlement value: eight figures. That is the case this spec must be engineered not to lose.

---

## 1. Verdicts per spec section

| Spec § | Exposure | Why (with citations) |
|---|---|---|
| §1 Product principles (child = access authority, no parental veto) | **MEDIUM** | Defensible as a product-design choice: Georgia parents have no constitutional right to a private company's data feed, and the company sets access terms by contract. But "no veto, ever" + teen self-harm is the fact pattern a jury hates. The *policy* is lawful; the *optics + undertaking risk* are not free. |
| §2 Signup & onboarding | **LOW–MEDIUM** | Gap: no parental-consent mechanism for 13–17 ToS assent. Contracts with minors are voidable in Georgia; the arbitration clause and liability waivers are unenforceable against the teen without a bound adult party. Bind the *parent's* account as contracting party for the child profile. |
| §3 Access authority matrix | **MEDIUM** | Server-side enforcement is correct engineering. Legal exposure is the policy itself (§1), not the matrix. One addition needed: audit log of grants/revokes visible to the teen (evidence of informed choice). |
| §4 Age tiers — 13–15 cooling-off | **HIGH** | Two distinct hazards: (a) the 7-day parent-notification window creates a foreseeable retaliation risk if the parent is abusive — you are *telling* the alleged abuser the child is trying to cut them off, then changing nothing for 7 days; (b) post-revoke self-harm with no watcher (see §0). |
| §4 Age tiers — 16–17 instant | **MEDIUM–HIGH** | Same self-harm-after-revoke hazard, minus the notification window. Instant + reversible is otherwise the cleanest design. |
| §4 Age tiers — 18+ continuity default | **MEDIUM** | FERPA problem: at 18, education-record rights transfer to the student (34 CFR § 99.5; 20 U.S.C. § 1232g(d)). "Skip = parents keep seeing grades" discloses education records to a third party without affirmative student consent. A pre-18 grant does not clearly survive the transfer of rights. **Do not ship default-ON; require an affirmative opt-in.** |
| §5 Child linking methods | **LOW** | Consent screen and block list are right. Keep the "I understand" screen's visible-data list exact — it becomes Exhibit A. |
| §6 "Go independent" | **MEDIUM** | Handing a 14-year-old "their own Pookie" creates no custodial duty — apps aren't custodians. But graduation framing + confetti + "protective angel" branding is undertaking kindling. The *ceremony* is the risk, not the feature. |
| §7 "Just me" mode | **LOW** | No child-safety nexus. |
| §8 Database migrations | **LOW** (legal) | But: no retention policy anywhere in the spec. Indefinite retention of teen freeform writing = subpoena/litigation-hold magnet. Set retention + purge now. |
| §9 API surface | **LOW** | RPC list is fine; add `logAccessDecision` audit RPC (see §2 changes). |
| §10 UI screens | **MEDIUM** | The Sharing screen's consequence list ("Your grades will stop updating. Mom and Dad will be notified today.") is good informed-consent design — extend it: add "Pookie does not monitor your check-ins for safety. If you're in crisis, call or text 988." |
| §11 Risks & mitigations | **MEDIUM** (as a table) | The table omits the four largest legal risks entirely: self-harm-after-revoke, voluntary undertaking via branding, mandatory-reporter gray zone, FERPA-at-18. Add rows 9–12 (drafted below). |

---

## 2. Concrete spec / ToS changes (quote → replacement)

### 2A. Spec §4, 13–15 cooling-off — add retaliation safeguard

**Current (spec §4):**
> May grant/revoke freely, **except** revoking a parent triggers a **7-day cooling-off**: scheduled, cancellable anytime, both parents notified immediately (told, not asked).

**Replace with:**
> May grant/revoke freely, **except** revoking a parent triggers a **7-day cooling-off**: scheduled, cancellable anytime. Before the revocation is scheduled, the teen is asked privately: "Is it safe for us to tell [Parent] you're doing this?" — with options (a) notify now (default), (b) delay notification until day 7, (c) notify a different trusted adult instead. If the teen indicates notification may be unsafe, in-app safety resources are shown and the revocation proceeds on the delayed-notification path. The choice is logged to the teen's audit trail, never shown to the parent. **Rationale:** immediate notification to a potentially abusive parent creates a foreseeable retaliation window; a one-question safety check is cheap and defeats the "you knew and did it anyway" negligence argument. Human counsel must approve the exact notification matrix before build.

### 2B. Spec §4, 18+ continuity — require affirmative consent

**Current:**
> **Parents who had access keep access by default.** No birthday disruption. … Skipping = continuity.

**Replace with:**
> **At 18, all parent access to education records pauses** until the young adult affirmatively opts in. First login after the 18th birthday shows: "You're an adult now — your Pookie is fully yours. [Mom] [Dad] used to see your info. Keep sharing with them?" [Keep sharing] / [Not now]. No pre-selected default; dismissing the prompt without choosing = paused, re-grantable anytime in Settings → Sharing. **Rationale:** FERPA rights transfer to the student at 18 (20 U.S.C. § 1232g(d)); default-ON disclosure of grades without affirmative consent is the single clearest statutory violation in this spec.

### 2C. Spec §11 — add missing risk rows

| # | Risk | Mitigation |
|---|---|---|
| 9 | Teen self-harm signals in check-ins after parent access revoked — no watcher | No real-time monitoring (stated in ToS + UI); passive crisis resources (988) surfaced in check-in UI and tutor guardrails; teen-opt-in trusted-adult escalation only; never automated parent alerts (see §3) |
| 10 | Voluntary undertaking via "protective angel" branding + revocation notifications | Brand/marketing review: Pookie is a *helpful companion*, never a safety, monitoring, or protective service; ToS §(a) disclaimer; no safety claims in copy, onboarding, or App Store listing |
| 11 | Mandatory-reporter gray zone (O.C.G.A. § 19-7-5(c)(1)(M) "child service organization personnel") | Designate a compliance owner; train everyone with child-content access; written escalation → GA DFCS (1-855-422-4453); AI tutor never presented as counselor/therapist |
| 12 | FERPA at 18 (see 2B) | Affirmative opt-in; no default continuity for education records |

### 2D. ToS — required clauses (draft language for human counsel to finalize)

**(a) Limits — not a safety/monitoring service.** *Insert as a standalone, conspicuous section (bold heading, not buried):*
> **Pookie is not a safety, monitoring, or emergency service.** We do not monitor your check-ins, messages, or activity in real time, and we do not review them for signs of self-harm, abuse, or other danger. Pookie is not a substitute for parental supervision, professional counseling, or emergency services. **If you are in crisis or thinking about harming yourself, call or text 988 (Suicide and Crisis Lifeline) or text HOME to 741741.** In an emergency, call 911.

**(b) Revocation consequences — acknowledgment at the point of action.** *The Sharing-screen confirmation (spec §4) must include, with a separate checkbox:*
> I understand that revoking access means [Parent] will stop receiving my grade updates and will lose access to my check-ins and health info, that Pookie does not monitor my account for safety, and that this cannot be undone by [Parent] — only by me. [ ] I understand.

**(c) School-portal data accuracy.** *New ToS section:*
> **School data is provided as-is.** Grades, assignments, and schedules shown in Pookie come from third-party school portals (e.g., ParentVUE/StudentVUE) and are not controlled by us. Data may be delayed, incomplete, or inaccurate. We make no warranty about its accuracy or timeliness, and academic decisions should be verified directly with the school.

**(d) Arbitration / class waiver.** Georgia/11th Circuit law is favorable: class waivers are enforceable under the FAA even in adhesion contracts (*AT&T Mobility v. Concepcion*, 563 U.S. 333 (2011); *In re Checking Account Overdraft Litig.*, 11th Cir. 2012 — class waiver "neither procedurally nor substantively unconscionable" under Georgia law). *Requirements for this to hold:*
- True **clickwrap**: unchecked box + hyperlink to terms + cannot proceed without checking + backend record of assent (timestamp, ToS version, user id). The spec's onboarding is skippable at every step — **the ToS/arb
...[truncated 6234 chars]
---

## 7. Feature-by-feature liability review (expanded scope — full feature list)

Mark: ✅ clear · ⚠️ needs change · 🛑 blocked as designed. Citations inline.

### 7.1 Core Platform
- **Google OAuth + email magic link; Supabase session management** — ✅ clear. Standard auth; no child-safety nexus.
- **Onboarding flow (skippable)** — ⚠️ needs change. Skippable-everything conflicts with binding ToS/arbitration assent (see §2D(d)): the ToS checkbox must be non-skippable, with assent logged (timestamp, version, user id). Skipping onboarding must never skip legal assent.
- **5-tab navigation; child switcher; Nebula theme** — ✅ clear, with one engineering note that has legal bite: the child switcher must enforce strict server-side data isolation between siblings — a teen's session must never render a sibling's data, and a revoked parent's cached switcher state must not leak. Test it as a security boundary, not a UX feature.
- **`/verify-invite` public landing (no login)** — ⚠️ needs change. Must not leak PII (child name, photo, school) to unauthenticated viewers; show minimal info until the teen authenticates.

### 7.2 Pookie AI Assistant
- **Pookie AI chat (warm tutor)** — ⚠️ needs change. This is our speech, not user speech (cf. Character.AI litigation: court denied early First Amendment dismissal; cases settled Jan 2026; KY/PA AG suits filed 2026). Required: system-prompt guardrails (no self-harm facilitation, no romantic/attachment roleplay with under-18s, never claim "I am a doctor/therapist" — cf. PA AG's "doctor of psychiatry" allegation), crisis-resource injection on self-harm language, and logging for abuse review.
- **Muse toggle ("direct, unfiltered")** — 🛑 blocked as designed for under-18. Never promise a minor an "unfiltered" AI; the word is a plaintiff's exhibit. Rename (e.g., "Muse — straight-talk mode"), keep identical safety guardrails underneath, and consider age-gating the toggle to 16+. Character.AI's Oct 2025 move (banning open-ended chats for under-18) is the industry baseline to match or beat.
- **Proactive nudges** — ⚠️ needs change. Nudges are outbound AI speech to minors — same guardrail stack as chat. No nudges derived from check-in/Wellbeing content in a way that reveals surveillance of private teen writing.
- **Weekly teacher discussion threads (Muse drafts, parent approves)** — ✅ clear. Human-in-the-loop approval is exactly the right design; keep the approval immutable in the audit log.

### 7.3 Today ritual
- **Morning ritual / tonight's plan assembly** — ✅ clear.
- **Check-in cross-check (self-report vs synced data, curious non-accusatory tone)** — ⚠️ needs change. The curious tone is good and legally protective. Two requirements: (1) passive 988 crisis resources in/near every check-in surface (currently missing — see §4 gaps); (2) never present the cross-check to parents as a lie-detector ("Dawson said X but data shows Y") — reflection prompts for the teen, not evidence for the parent.

### 7.4 The 31 life modules
**Body & Heart**
- **W2 Health (vitals, health-app connections)** — ⚠️ needs change. HIPAA does not apply (not a covered entity), but the **FTC Health Breach Notification Rule** (16 CFR Part 318; enforced against health apps, e.g., GoodRx 2023) likely applies once we hold identifiable health data as a PHR vendor. Need: breach-notification plan, privacy-policy health-data section, teen health privacy tiers enforced server-side.
- **W8 Wellbeing (mood pulse, teenPrivate)** — ⚠️ needs change. Mood data from minors adjacent to self-harm: passive crisis resources required; no automated parent alerting (see §3).
- **W13 Meals** — ✅ clear.
- **W22 Activity** — ✅ clear.
- **W23 Nutrition (food logging)** — ⚠️ needs change. The KY Character.AI filing alleges a chatbot encouraged starving for weight loss. For under-18: no calorie-restriction goals, no weight-loss coaching, ED-aware guardrails; nutrition stays neutral/fuel-focused.

**Home & Family**
- **W21 Mail (photo intake)** — ✅ clear, provided images are encrypted at rest and PII handling is addressed for any AI processing.
- **W20 Shopping List** — ✅ clear.
- **W11 Spending (bank-statement categorization)** — ⚠️ needs change. Requires explicit bank-connection consent (Plaid-style OAuth, never credential harvesting by us); categorization is informational with a no-financial-advice disclaimer.
- **W7 Money & Documents (ledger, vault, bill reminders)** — ⚠️ needs change. Bill reminders must be ToS-defined as **courtesy only** — a missed reminder causing a late fee is a foreseeable claim; disclaim it.
- **W24 Credit (3-bureau monitoring, score coaching)** — 🛑 blocked until FCRA-compliant. Pulling bureau data requires a **permissible purpose** — here, the written instructions of the consumer (15 U.S.C. § 1681b(a)(2)) — with clear consent and disclosures *before* the first pull, per data subject. Score coaching must carry "educational purposes only, not financial advice; we are not a credit counseling agency." Pulling a minor's bureau file has additional furnisher/consent wrinkles — human counsel must design this flow.
- **W14 Co-parenting** — ⚠️ needs change. Intersects the access model and custody disputes: the app must not adjudicate custody. ToS + UI disclaimer: access grants reflect in-app permissions only and do not modify legal custody or visitation; court orders override in-app settings; in case of conflicting court documentation, the company may suspend disputed access pending clarification.
- **W12 Babysitters (trusted sitter directory)** — ⚠️ needs change. Directory = fine; *recommendation* = negligent-referral exposure. Present strictly as a directory with no endorsement, no "trusted" ranking that implies vetting we did not do, background-check disclaimer, and a ToS non-endorsement clause. The word "Trusted" in the feature name should not survive legal review.
- **W10 Fairness lens** — ✅ clear.

**School Days**
- **W1 School (live: grades, path-to-90, teacher inbox, check-ins, uploads)** — ⚠️ needs change. FERPA: parent access to their own child's records via the parent's own credentials is authorized (parental right under 20 U.S.C. § 1232g), and the app acts as the parent's agent — but the ToS must document that agency chain explicitly ("you authorize Pookie to access school portals on your behalf using credentials you provide"). Portal ToS (Cobb/ParentVUE) may prohibit automated access — acknowledge the account-suspension risk in ToS; never present sync as guaranteed (ties to §2D(c)).
- **W16 School Calendar; W4 Activities; W18 Summer** — ✅ clear.
- **W5 College & Future (50-college simulator, HOPE/Zell Miller, essays, aid)** — ⚠️ needs change. Simulator outputs are predictions: label as estimates, not guarantees; essay feedback must not write essays for the student (academic-integrity framing — "feedback, not authorship"); no guarantee of admission/aid outcomes.

**Safe & Sound**
- **W3 Safety (insurance policies, coverage organization)** — ⚠️ needs change. Organizing policies is fine; **never interpret coverage** ("you're covered for X") — that is unlicensed insurance advice and negligent-misrepresentation bait. Labels: "for organization only; confirm coverage with your agent/insurer."
- **W19 Emergency (emergency plan, numbers, document vault)** — ⚠️ needs change (not blocked). As described — passive storage of a plan, numbers, and documents — this does **not** create an undertaking of care; it is a filing cabinet. It *would* create one if the feature promises auto-alerts, location sharing with emergency contacts, or real-time response ("we'll notify your contacts in an emergency"). Keep it storage-only, label it "not an emergency response service — always call 911 first," and re-run this review before adding any alerting behavior.

**Growing Up**
- **W6 Driving & Life Skills** — ⚠️ needs change. General educational info about driving is protected speech and low-risk, but: (1) never present as certified driver instruction or a substitute for Georgia's graduated-licensing requirements (Joshua's Law, O.C.G.A. § 40-5-22 — 40 supervised hours for 16-year-olds); (2) "driving progress" tracking must not certify readiness ("ready for your road test" = undertaking); frame as practice logging. No in-app instruction during actual driving (distracted-driving nexus — no interactive features usable behind the wheel).
- **W15 Screen Time ("screen limits that stick")** — ⚠️ needs change. Do not promise enforcement the OS won't allow (iOS has no third-party enforcement without MDM). "Limits that stick" is a deceptive-claim risk (FTC §5). Promise what the platform can do; label the rest as reminders.
- **W17 Friends (teenPrivate)** — ✅ clear, provided teen consent controls visibility and revoked parents lose access consistently with the access model.

**Out & About**
- **W25 Fuel & Charging** — ✅ clear.
- **W26 Weather (hyperlocal, severe alerts, "decision translation")** — ⚠️ needs change. "Decision translation" ("safe to hike today") is advice based on third-party data: disclaim as informational, not a substitute for National Weather Service guidance; severe-weather alerts must carry "verify with official sources."
- **W27 Events (AI-curated local events)** — ⚠️ needs change. Location-adjacent recommendations for minors: teen location must not be shared with revoked parents through this module (access-model consistency — audit every module that touches location against revocation state); event content needs age-appropriateness filtering.
- **W28 Restaurants (AI discovery, taste-learned)** — ✅ clear.
- **W29 Trails & Parks (difficulty, kid-friendliness, "weather-synthesized conditions")** — ⚠️ needs change. Telling a teen trail conditions are safe when they are not is negligent-misrepresentation exposure. Required: "conditions change; verify with the park authority; difficulty ratings are estimates" disclaimer on every recommendation.
- **W30 Flights (AI fare prediction, family-trip coordination, trip assembly)** — 🛑 blocked as designed for teen-completed booking. Minors cannot form binding travel contracts (voidable), and airlines impose unaccompanied-minor rules and adult-purchaser requirements. **Bookings must be completed by the adult account holder**; teen accounts get browse/plan-only. Fare prediction = informational with "estimates only, prices change" disclaimer.
- **W31 Rental Cars (total-cost ranking, insurance-trap flags)** — 🛑 blocked as designed for teen-completed booking. Renters must be 21+ (usually 25 without young-driver fees); a teen cannot complete a rental. Adult-only checkout. "Insurance-trap flags" must stay general educational info, not personalized insurance advice ("confirm with the rental company and your insurer").

### 7.5 School Intelligence (W1 detail)
- **13-source intelligence model; per-class pages; path-to-90 checkboxes (Supabase-persisted)** — ✅ clear on liability; checkbox persistence is good evidence of teen agency.
- **Teacher inbox merge + AI practice quizzes + unit auto-alignment** — ⚠️ needs change. Quizzes generated from uploaded textbook material must not reproduce copyrighted text verbatim at length, and the peer-tips pipeline (600 AI tips/week) must not redistribute textbook content — keep tips original/paraphrased. DMCA note: the app hosts user uploads (handouts, ebooks), so designate a **DMCA agent** and publish a takedown process (17 U.S.C. § 512) to preserve safe harbor.
- **Peer tips pipeline (600/wk, 4-week expiry)** — ⚠️ needs change. AI-generated content at volume needs moderation (harmful/inappropriate tips reaching minors) and no-PII guarantees; log provenance.
- **SAT prep; lunch/dinner; power-up; notes; news; horoscope pulls** — ✅ clear.
- **Windows/MacBook sync workers (Playwright, queue-based SYNC NOW)** — ⚠️ needs change. Using the credential-holder's own login with their consent is authorized access (cf. *hiQ v. LinkedIn* on authorized access), but portal ToS may prohibit automation — ToS must disclose the account-suspension risk and obtain explicit automation consent; credentials encrypted, never logged in plaintext.

### 7.6 Family & Access Management
Covered in §§1–2 above. Additional flags: **18th-birthday continuity default** is 🛑 blocked as designed for education records (FERPA, see §2B) — change to affirmative opt-in. **Block list (teen permanently blocks adult)** — ✅ clear and good. **Access-request flow ("other parent notified, can't veto")** — ⚠️: the notification itself should be factual and minimal to avoid inflaming custody disputes (see W14).

### 7.7 Settings & Data
- **Credentials vault (school portal logins, "stored encrypted")** — ⚠️ needs change. "Encrypted" must mean: encrypted at rest with a KMS-managed key, never in logs, never in client-accessible fields, rotation story, and explicit user consent acknowledging portal-ToS automation risk. A vault breach containing parent + school credentials is the company's worst data-breach scenario — treat it as the crown jewels in the security review.
- **Data retention ("check-ins indefinite, emails TBD")** — 🛑 blocked as designed. Indefinite retention of teen freeform writing is a litigation magnet (subpoenas, custody fights, the self-harm scenario in §0). Set: check-ins 13 months rolling (or teen-configurable shorter), emails per a published schedule, hard purge (not soft-delete) on expiry, and a litigation-hold procedure. "TBD" is not a policy.
- **Notification preferences; sync console** — ✅ clear.

### 7.8 API Platform
- **REST surface (`/api/v1/...`, tutor, teacher-message approve/send, minutiae ingest)** — ⚠️ needs change. Every child-scoped endpoint must re-enforce the access matrix server-side (never trust client role claims); approve/send actions need immutable audit entries; the tutor endpoint needs rate limiting and abuse monitoring; no endpoint may expose credentials or session tokens. API access to a revoked parent's cached tokens must be invalidated at revoke time, not at token expiry.

---

## 8. Missing features (gaps the list doesn't cover)
1. **Crisis resources** — passive 988 / Crisis Text Line surfacing in check-in, Wellbeing, and tutor guardrails. Absent everywhere; add before any teen-facing launch.
2. **Mandatory-reporter compliance owner + training + DFCS escalation path** (O.C.G.A. § 19-7-5). No owner named anywhere.
3. **DMCA agent + takedown process** (17 U.S.C. § 512) — required once user uploads ship.
4. **FTC Health Breach Notification Rule plan** — required once W2 holds health data.
5. **FCRA consent/disclosure flow** — required before W24 pulls bureau data.
6. **Parental-consent mechanism for 13–17 ToS/arbitration assent** — required for enforceability.
7. **Law-enforcement / subpoena response policy** — especially for check-in text and location-adjacent data.
8. **Litigation-hold procedure** tied to the retention schedule.
9. **Marketing/copy review gate** — no safety/protective claims in copy, onboarding, or store listings (undertaking risk).

## 9. Features that shouldn't exist as designed
1. **Muse "unfiltered" mode for under-18** — rename, guardrail, age-gate (§7.2).
2. **18+ continuity default for education records** — affirmative opt-in only (FERPA, §2B).
3. **Indefinite check-in retention** — rolling retention + hard purge (§7.7).
4. **Teen-completed flight/rental-car booking** — adult-only checkout (W30/W31).
5. **Credit monitoring without FCRA flow** — blocked until compliant (W24).
6. **"Screen limits that stick"** as an enforcement promise — reframe as reminders (W15).
7. **Babysitter "trust" rankings implying vetting** — directory only, no endorsement (W12).
8. **(Do not build)** Automated parent alerts on self-harm keywords — creates the undertaking, fails on false positives/negatives, and the miss is the lawsuit (§3).

## 10. Reassessment flags (expanded)
- Any human or AI review of check-in/Wellbeing content → re-run §§0–3 (mandatory-reporter duty may attach at first read).
- Any emergency-alerting behavior added to W19 → re-run undertaking analysis.
- Any real bureau pull in W24 → FCRA counsel signs off first.
- Any teen-facing checkout in W30/W31 → blocked pending adult-only redesign.
- Expansion beyond Georgia → state-by-state memo (universal-reporting states, state AG AI-companion scrutiny, state insurance/financial-advice rules).
- Any marketing copy touching safety, protection, or supervision → legal review before publish.
