# FERPA Legal Audit — Pookie User-First Access Model

**Reviewer role:** Expert FERPA counsel (subagent review, 2026-10-12)
**Spec reviewed:** `~/workspace/pookie-app/docs/USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12)
**Jurisdiction:** Georgia, USA. Federal law: FERPA, 20 U.S.C. § 1232g; 34 C.F.R. Part 99.
**Scope note:** This is a legal-issue-spotting review, not legal advice and not a substitute for licensed counsel. Ambiguities requiring human counsel are flagged at the end.

---

## 0. Foundational framing (read this first — it decides every verdict below)

**FERPA binds educational agencies and institutions that receive federal education funds. It does not bind Pookie.**

- FERPA's duties (consent before disclosure, inspection rights, redisclosure limits) run against the *school*, 20 U.S.C. § 1232g(a)(1), (b)(1); enforcement is loss of federal funds, § 1232g(f). There is no private right of action (*Gonzaga Univ. v. Doe*, 536 U.S. 273 (2002)).
- Pookie is a consumer app that holds *copies* of records the parent lawfully obtained through the parent's own portal credentials, plus parent/teen-supplied content. The app is not an "educational agency or institution" under 34 C.F.R. § 99.1, and — critically — it is **not** operating as a "school official" under contract with any school (34 C.F.R. § 99.31(a)(1)(i)(B)). Therefore FERPA imposes **no direct obligations** on Pookie's access-control design.
- Consequence: the entire child-as-access-authority model, the cooling-off periods, the instant revokes, and continuity-by-default at 18 are **FERPA-neutral product choices**. They neither violate FERPA nor are they required by it.
- The real FERPA-adjacent risks are **(a)** misleading users about the legal effect of in-app revocation (consumer-protection exposure, not FERPA exposure), **(b)** continued school-portal ingestion after the parent's underlying right lapses at 18/postsecondary (a school-authorization and contract problem, not a FERPA problem for the app — but FERPA is what extinguishes the parent's right), and **(c)** the spec's §4 one-line FERPA claim, which is correct but materially incomplete.

---

## 1. Compliance verdicts per spec section

### §1 Product principles — **COMPLIANT WITH CHANGES**
- Principle 2 ("child is the access authority; a grant made by the child cannot be vetoed or revoked by any parent") is lawful as an *in-app* access rule. FERPA does not regulate private access controls on copies held outside the school.
- **Required change:** the absolute phrasing invites users to believe revocation has legal force against the school. Add an in-app-only qualifier plus the disclosure in §1-A below. Without it, the design risks deceptive-practice exposure (FTC Act § 5; Georgia Fair Business Practices Act, O.C.G.A. § 10-1-390 et seq.) — a teen or parent could reasonably conclude "revoked in Pookie" = "parent has no right to my records."

### §2 Signup & onboarding — **COMPLIANT WITH CHANGES**
- Flow is lawful. **Change:** when a parent adds a child (Step 2 → "Yes"), show a one-time plain-language disclosure that the teen's later Sharing-screen choices govern *Pookie only* and do not affect anyone's legal rights at the school. (Copy in §2-A.)

### §3 Access authority matrix — **COMPLIANT WITH CHANGES**
- The matrix, `granted_by` enforcement, and server-side role assignment are sound and FERPA-neutral.
- **Change:** append a footnote to the matrix table: *"This matrix governs access to data inside Pookie. It does not alter any person's rights under FERPA or other law to obtain education records directly from the school."*

### §4 Age tiers — verdicts by tier
- **Under 13 (Stewardship): COMPLIANT.** Parent-managed, no child login — consistent with FERPA (parents hold all rights pre-18, 20 U.S.C. § 1232g(a)(1)(A); 34 C.F.R. § 99.10) and COPPA posture.
- **13–15 (Shared agency, 7-day cooling-off): COMPLIANT.** A 14-year-old revoking a parent's *in-app* access does **not** collide with the parent's federal right, because the federal right is a right **against the school** (inspect and review education records, § 99.10), not a right against a private app. The app may lawfully stop syncing and hide data from that parent inside Pookie. **This is the single most important distinction in this review: app access control ≠ underlying FERPA right.** The parent can still walk into Walton High and request the records; Pookie cannot and does not stop that.
- **16–17 (Full agency, instant revoke): COMPLIANT**, same reasoning.
- **18+ (Ownership with continuity): COMPLIANT WITH CHANGES.**
  - FERPA: "Whenever a student has attained eighteen years of age, or is attending an institution of postsecondary education, the permission or consent required of and the rights accorded to the parents … shall thereafter only be required of and accorded to the student." 20 U.S.C. § 1232g(d); 34 C.F.R. § 99.5(a).
  - **Continuity-by-default for data already in Pookie is FERPA-compliant.** FERPA imposes nothing on the app's historical copies, and it does not require a purge or an affirmative re-consent moment for stored data. The skippable one-time prompt is adequate *for the stored-data question*.
  - **But the spec's FERPA line is incomplete and the model has a live gap on *future* data:** after 18 (or postsecondary enrollment), the *parent's* underlying right to pull from ParentVUE is extinguished (subject to exceptions below). Continued ingestion via the parent's credentials after that point is no longer parent-authorized *as a matter of school authorization* — the school's portal ToS and authorized-user provisions govern, and the adult student is now the rights holder. **FERPA does not require the app's re-consent moment, but the end of the parent's FERPA right makes a data-source re-authorization by the adult student practically necessary.** The spec's "Data-source handoff: … guide the young adult to connect their own" is directionally right but too soft — it should be a required re-auth step, not guidance.
  - **Also incomplete:** the transfer has statutory exceptions the disclosure copy must not contradict — e.g., schools *may* still disclose to parents of tax-dependent students, 34 C.F.R. § 99.31(a)(8); health/safety emergencies, § 99.36; etc. Copy must not promise "your school can no longer share with your parents, period."

### §5 Child linking — **COMPLIANT WITH CHANGES**
- Email-invite hardening, link codes, and claim dedupe are good. **Change:** the teen's "I understand" consent screen must list (a) what data is visible, (b) that sharing in Pookie ≠ sharing with the school, and (c) the revocation-limits disclosure (copy in §2-A).

### §6 "Go independent" — **COMPLIANT**
- Graduation framing is lawful and, from a deception-risk standpoint, better than the alternative. Keep the marketing rule. Recommend the flow's final screen include the one-line legal-reality disclosure.

### §7 "Just me" mode — **COMPLIANT** (no FERPA surface).

### §8 Migrations — **COMPLIANT WITH CHANGES**
- Schema is fine. **Add:** an append-only `access_audit_log` (who granted/revoked what, when, `granted_by`, consent artifact IDs) — not FERPA-required, but it is the evidence you will want when a parent disputes a teen's revoke or a school asks what happened. Also store timestamped consent artifacts for the teen "I understand" screens.

### §9 API surface — **COMPLIANT WITH CHANGES**
- Server-side enforcement is correct. **Add:** `recordConsent(childId, kind, artifactHash)` persisting the teen consent screens; and make `graduateAt18` trigger a **required** data-source re-authorization (not merely a prompt) before any further school-portal pulls under parent credentials.

### §10 UI screens — **COMPLIANT WITH CHANGES**
- Add the disclosure placements specified in §2-A (Sharing screen, onboarding child-add, 18th-birthday prompt, go-independent final screen).

### §11 Risks & mitigations — **COMPLIANT WITH CHANGES**
- Add three rows (see §2-A, risk table additions):
  - **R9.** Users mistake in-app revocation for legal revocation → legal-reality disclosure at four touchpoints.
  - **R10.** Post-18/postsecondary parent-credential pulls → required adult-student re-auth of data sources at 18; dual-enrollment detection.
  - **R11.** Custody orders restricting a parent's record access → manual override path honoring court orders (FERPA defers to court orders; app should too).

---

## 2. Concrete spec changes (quote → replacement)

### 2-A. New disclosure copy (insert at §2 onboarding child-add, §5 teen consent screen, §10 Sharing screen, §6 go-independent final screen)

> **What removing access does (and doesn't) do.** Removing someone's access in Pookie only stops them from seeing your information *inside Pookie*. It does not change any legal right they may have to get your school records *directly from your school* — for example, federal law (FERPA) gives parents the right to see their child's school records until the student turns 18 or starts college, and Pookie can't take that right away. Likewise, giving someone access in Pookie doesn't give them any new legal rights at your school.

Parent-facing variant (onboarding child-add, first line): prepend *"Pookie is not your school. Choices you and your child make here control Pookie only."*

18th-birthday prompt addition: append *"Note: after 18, your school generally needs your permission — not your parents' — to share your records (with some exceptions, e.g., if you're their tax dependent). To keep grades flowing into Pookie, reconnect your school login below."*

### 2-B. §1, Principle 2 — quote → replacement

- **Quote:** "2. The **child is the access authority** over their own records. A grant made by the child cannot be vetoed or revoked by any parent."
- **Replacement:** "2. The **child is the access authority** over their own records **inside Pookie**. A grant made by the child cannot be vetoed or revoked by any parent **within the app**. In-app access decisions do not alter any person's rights under FERPA or other law to obtain education records directly from the school (see disclosure copy, §2-A)."

### 2-C. §4, 18+ block, FERPA bullet — quote → replacement

- **Quote:** "- FERPA: rights transfer to the student at 18; student-in-control model is compliant."
- **Replacement:**
  "- FERPA: rights transfer from parent to student at 18 **or upon postsecondary enrollment, whichever comes first** (20 U.S.C. § 1232g(d); 34 C.F.R. § 99.5(a)). FERPA binds the school, not Pookie; continuity of *stored* data is compliant without an affirmative re-consent moment. **However:** the parent's underlying right to pull records from the school ends at transfer (subject to exceptions, e.g., tax-dependent students, 34 C.F.R. § 99.31(a)(8)). `graduateAt18` must therefore **require** the adult student to re-authorize school data sources in their own name before any further portal ingestion; parent-credential pulls must pause at 18 until re-authorized. Disclosure copy per §2-A."

### 2-D. §4, 13–15 confirmation copy — quote → replacement

- **Quote:** "Confirmation lists consequences: "Your grades will stop updating. Mom and Dad will be notified today.""
- **Replacement:** "Confirmation lists consequences: "Your grades will stop updating in Pookie. Mom and Dad will be notified today. **This doesn't change their legal right to get your records from your school directly.**""

### 2-E. §3 matrix — add footnote (quote → replacement)

- **Quote:** "| Request access (→ child approves) | — | — | ✅ |"
- **Replacement:** same row, plus new line after the table: "*The matrix governs access to data inside Pookie only. It does not grant, limit, or revoke any person's rights under FERPA (20 U.S.C. § 1232g) or other law to obtain education records directly from the school.*"

### 2-F. §8 migrations — add row

| Migration | Contents |
|---|---|
| `021_consent_audit.sql` | `consent_artifacts` (id, child_id, user_id, kind, artifact_hash, created_at) + `access_audit_log` (append-only: actor, action, target, granted_by, at). RLS: service-role write; user reads own rows. |

### 2-G. §11 risks — append rows

| # | Risk | Mitigation |
|---|---|---|
| 9 | In-app revocation mistaken for legal revocation (deception exposure) | Legal-reality disclosure at onboarding child-add, teen consent screen, Sharing screen, go-independent final screen (§2-A) |
| 10 | Parent-credential portal pulls continue after FERPA rights transfer (18/postsecondary) | `graduateAt18` requires adult-student re-auth of data sources; pause parent-credential ingestion at 18; dual-enrollment flag on child profile |
| 11 | Custody order restricts a parent's record access | Manual support override honoring court orders; FERPA defers to judicial orders |

---

## 3. Analysis of the five assigned questions

**Q1. Does a 14-year-old's in-app revoke collide with the parent's FERPA right?**
No. The parent's FERPA right is the right to *inspect and review* education records *maintained by the school*, 20 U.S.C. § 1232g(a)(1)(A); 34 C.F.R. § 99.10. Pookie's access control governs Pookie's private copies, which are not education records under 34 C.F.R. § 99.3 (Pookie is not an educational agency/institution or its agent). Revoking in-app access is legally equivalent to the teen asking the parent to delete a photocopy of a report card — it cannot diminish the federal right exercisable at the school. The 7-day cooling-off is therefore a product-safety feature, not a FERPA compliance mechanism, and instant revoke at 16–17 is equally fine.

**Q2. Ingestion via parent credentials — disclosing party and redisclosure limits?**
The *disclosing party* under FERPA is the school, disclosing to the parent under the parent's own inspection right — not under a § 99.31 consent exception. Redisclosure limits (34 C.F.R. § 99.33) attach to recipients who receive records *under an exception to the consent requirement*; a parent exercising their own right is a rights-holder, not a § 99.31 recipient, so **FERPA imposes no redisclosure restriction on the parent** (or on the teen, or on Pookie as the parent's/teen's chosen repository). When the teen then shares with another adult in-app, that is a private sharing decision governed by the app's terms/privacy policy and state law — not by FERPA. Practical consequence: the spec does not need FERPA redisclosure machinery; it needs clear contractual consent for in-app sharing (which the grant/request/consent flows provide).

**Q3. Teacher messages stored in-app — FERPA record implications?**
None for the app. "Education records" are records *directly related to a student and maintained by an educational agency or institution or by a party acting for the agency or institution*, 34 C.F.R. § 99.3. Copies sitting in Pookie's Supabase tables are not maintained by or for the school. The school's originals remain education records subject to FERPA at the school; the app's copies are outside FERPA's scope (like emails already in the parent's Gmail inbox). Two cautions: (a) do not describe or contract Pookie as a "school official" (§ 99.31(a)(1)(i)(B)) — that status would *import* FERPA redisclosure duties; the current parent-directed-consumer framing correctly avoids it; (b) a teacher's truly private "sole possession" notes (§ 99.3 exclusion) are not education records at all, but the moment they are shared with the parent they lose that character — either way, no app-side FERPA duty arises.

**Q4. What must the app disclose about the limits of in-app revocation?**
See §2-A copy. Minimum viable disclosure, shown *before* the revoke is confirmed and at onboarding: (1) in-app revoke ≠ legal revoke; (2) parents keep their school-direct FERPA right until 18/postsecondary; (3) granting access in Pookie creates no school-side rights. This is not strictly FERPA-mandated (FERPA mandates nothing of the app) — it is mandated by honesty-in-design: without it, the absolute language of Principle 2 is arguably deceptive.

**Q5. At 18, is continuity-by-default compliant, or is affirmative re-consent required?**
Continuity-by-default for *stored* data is compliant — FERPA requires nothing of the app here, and the transfer of rights *to* the student affirmatively supports a student-in-control model. No affirmative re-consent moment is required by FERPA for historical in-app data; the skippable prompt plus persistent Settings line is adequate. **But**: for *ongoing ingestion*, the parent's portal pulls lose their FERPA footing at transfer, so the adult student must re-authorize the data source — treat this as a required step in `graduateAt18`, with parent-credential pulls paused until completed. Also note the transfer is not absolute even at the school: exceptions (dependent students § 99.31(a)(8), emergencies § 99.36, etc.) mean the disclosure copy must not overpromise.

---

## 4. Feature improvements within the law (beyond the required changes)

1. **Dual-enrollment / postsecondary flag** on the child profile (self-reported at onboarding/linking, editable). A 17-year-old attending college is an "eligible student" under § 99.3/§ 99.5(a) *now*, not at 18 — the spec's pure age tiers miss this. Treat flag = 18-equivalent for school-sourced data (parent-credential pulls require student re-auth; Sharing screen shows the transfer notice early).
2. **"School records vs. Pookie records" explainer** — a one-screen visual in the Sharing screen distinguishing the two buckets. This is the highest-leverage confusion-killer in the product.
3. **Consent receipts** — exportable, timestamped records of each grant/consent ("On 2026-10-12, Dawson (15) granted Mom access to grades…"). Useful in blended-family disputes; cheap to build on `consent_artifacts`.
4. **Custody-order override path** — support tool honoring a court order that restricts a parent's access, applied server-side above the matrix. FERPA yields to judicial order; the app should too.
5. **Emancipated-minor handling** — treat court-emancipated minors as 18-equivalent (flag for counsel on Georgia specifics).
6. **School-ToS hygiene prompt** — when a parent connects portal credentials, a line noting they should only connect accounts they are authorized to use, and that authorization may lapse at 18/postsecondary. (Not FERPA — contract/authorization hygiene.)
7. **Data-retention schedule on revoke** — the spec keeps historical data visible to the revoked parent; consider a teen-selectable option ("also hide past data") since FERPA doesn't require retention either way. Pure product choice; offering it strengthens the agency story.

---

## 5. Gaps in the spec

1. **Postsecondary prong absent.** Rights transfer at 18 *or* postsecondary attendance (§ 99.5(a)). Dual-enrolled 16/17-year-olds are unaddressed.
2. **No state-law survey.** FERPA is federal; Georgia may add student-data, breach-notification, or minor-privacy duties. None assessed in the spec.
3. **Credential authorization after transfer.** The spec never addresses *whose authority* a portal pull rests on after 18 — this is the highest-risk operational gap (school ToS / authorized-use provisions, not FERPA per se, but triggered by the FERPA transfer).
4. **No retention/deletion schedule** for revoked-access historical data or for aged-out child profiles.
5. **Under-13 → 13 transition** unaddressed: when a parent-managed child turns 13 and links, whose historical data does the new teen account see, and can the teen revoke the creating parent's access to pre-13 data? (Recommend: yes, with the standard tier rules.)
6. **"Parent" definition edge cases** — FERPA's "parent" (§ 99.3) includes guardians and persons acting as parent; step-parents/grandparents with educational-decision authority vary by state/custody order. The request-access flow mitigates this; the custody-order override (improvement 4) closes it.

---

## 6. Reassessment flags (revisit when…)

- …Pookie signs any agreement with a school/district or seeks "school official" status → FERPA duties (including § 99.33 redisclosure limits) would attach; full re-review required.
- …expansion beyond Georgia → 50-state student-privacy survey (e.g., state laws modeled on SOPIPA/CPRA-style minor protections).
- …Georgia enacts K-12 student data privacy legislation → immediate review.
- …the product adds under-13 child logins or child-prompted collection → COPPA + state review.
- …annual cadence regardless: FERPA regulatory guidance evolves (FPCO FAQs, Dept. of Ed. guidance).

---

## 7. Ambiguity — flag for human counsel (do not treat as resolved)

1. Whether any Georgia statute imposes student-data duties beyond FERPA/PPRA (no comprehensive Georgia K-12 student privacy statute is in this reviewer's training data, but the survey was not performed).
2. Whether continued use of a parent's ParentVUE/StudentVUE credentials after the FERPA transfer (or after the student revokes in-app) violates the portal's Terms of Service or Georgia computer-crime law (O.C.G.A. § 16-9-90 et seq.) — fact- and ToS-dependent.
3. Whether marketing Pookie as "FERPA-compliant" creates an implied representation about school-side effects; recommend the narrower, accurate claim: "Pookie is designed to respect FERPA rights — your school choices and Pookie choices are separate."
4. Emancipated-minor recognition standards under Georgia law for the improvement-5 flag.
5. Custody-order intake: what verification the support override should require before restricting a parent's in-app access.

---

## 8. Bottom line

The user-first access model is **FERPA-compliant as a product design** — FERPA regulates schools, not Pookie, so the child-as-authority model, cooling-off revokes, and continuity-by-default all clear. The spec's one-line FERPA justification (§4) is correct but incomplete, and three changes are needed before build: **(a)** the legal-reality disclosure at four touchpoints (§2-A) so in-app revocation is never mistaken for legal revocation; **(b)** required adult-student re-authorization of school data sources at 18/postsecondary with parent-credential pulls paused until completed; and **(c)** the postsecondary-enrollment prong added to the age tiers. Everything else is compliant, compliant-with-changes as noted, or a recommended improvement.

---

# PART II — Feature-by-feature FERPA / education-records review

**Source:** `docs/FEATURE-LIST-FOR-PANEL.md` (8 categories). **Method:** each feature marked ✅ clear · ⚠️ needs change · 🛑 blocked *in its current form*, with citations. Standing premise from Part I: FERPA (20 U.S.C. § 1232g; 34 C.F.R. Part 99) binds educational agencies/institutions, not Pookie; Pookie holds private copies plus user-supplied content and is not a § 99.31(a)(1)(i)(B) "school official." Marks below reflect (i) genuine FERPA touchpoints, (ii) adjacent authorization/contract issues triggered by FERPA's transfer rules, and (iii) deception-risk where the feature could misstate legal effect.

## Category 1 — Core Platform

| Feature | Mark | Notes |
|---|---|---|
| Google OAuth sign-in + email magic link | ✅ | No education-records nexus. |
| Session management (Supabase Auth, middleware refresh) | ✅ | — |
| Onboarding flow (welcome → name → add children → dashboard) | ⚠️ | Add the §2-A legal-reality disclosure at the "add children" step: parent must understand the teen's later Sharing choices govern Pookie only. |
| 5-tab navigation (Home · Today · Pookie · Progress · More) | ✅ | — |
| Child switcher, active-child persistence | ✅ | Ensure switcher never leaks one child's school data into another child's view (per-child scoping; test with blended-family fixtures). |
| Nebula theme | ✅ | — |
| `/verify-invite` public landing (no login to view) | ⚠️ | A no-login page must never render education-record content or directory-style child info. Token-gated, minimal display (first name only), no grade/school/teacher data, anti-enumeration on tokens. Not a FERPA violation (app not bound) but a privacy-by-design requirement. |

## Category 2 — Pookie AI Assistant

| Feature | Mark | Notes |
|---|---|---|
| Pookie AI chat (warm tutor) + Muse toggle | ⚠️ | Chat will ingest education-record copies. FERPA imposes no duty on the app, but: (1) obtain/keep a contractual **no-training-on-inputs** commitment from the AI provider (Cloudflare Worker → Llama); (2) disclose in-chat that messages are processed by a third-party AI provider; (3) data-minimize — don't stuff full gradebook dumps into prompts when a summary suffices. Do **not** claim "school official" status to justify processing — that would import § 99.33 redisclosure duties. |
| Instant-respond routing | ✅ | — |
| Weekly teacher discussion threads (Muse drafts, parent approves) | ⚠️ | Parent-approval gate is correct — keep it unbypassable. Drafts must be strictly per-child scoped (a draft about Dawson must never render in another child's thread or to another parent). No FERPA issue: parent acting on their own lawfully obtained copies. |
| Proactive nudges | ⚠️ | Nudge fan-out (push/email) must respect the `child_access` matrix: a parent whose in-app access the teen revoked must not receive nudges containing that teen's school data. Enforce server-side, same as the API. |

## Category 3 — Today (Daily Ritual)

| Feature | Mark | Notes |
|---|---|---|
| Morning ritual view (attention items, quote, weather, due-next, schedule) | ✅ | Same matrix-scoping caveat for any shared/household display surface. |
| "Tonight's plan" assembly | ✅ | — |
| Check-in cross-check (child self-report vs synced data, curious tone) | ✅ | No FERPA issue; comparing teen statements against parent-pulled copies is a private product function. Keep the non-accusatory tone as specified. |

## Category 4 — The 31 Life Modules

Grove School Days first (the FERPA surface), then the rest.

| ID | Module | Mark | Notes |
|---|---|---|---|
| W1 | School (grades, assignments, path-to-90, class pages, teacher inbox, check-ins, uploads, minutiae) | ⚠️ | Core FERPA-adjacent module. (1) Label synced content as copies ("synced from ParentVUE on …"), never as official school records. (2) Ingestion via parent credentials is authorized only while the parent holds the underlying right — implement the 18/postsecondary re-auth (§2-C). (3) After a teen revokes a parent in-app, stop that parent's school-data sync, not just hide it (spec's "grades will stop updating" — enforce at the worker level). |
| W16 | School Calendar | ✅ | — |
| W5 | College & Future (simulator, HOPE/Zell Miller, essays, aid, visit log) | ✅ | No FERPA issue. Note: if the app ever pulls from GA Student Finance Commission systems, that's a state-agency authorization question — flag for counsel then, not now. |
| W4 | Activities | ✅ | — |
| W18 | Summer | ✅ | — |
| W2 | Health (vitals, trends, health-app connections) | ⚠️ | In-app health data is user-supplied, not FERPA. But **if W1/W2 ever ingest school health records (nurse visits, IEP/504 documents via portal)** — those are education records at the school and the most sensitive copies the app could hold: require explicit teen consent (13+) for any sharing beyond the creating parent, and never include in peer-tip generation or AI training context. Add this as a standing rule now. |
| W8 | Wellbeing (teenPrivate mood pulse) | ✅ | Correctly flagged teenPrivate. Recommend: teenPrivate modules are also excluded from AI-training context and from parent notification content unless the teen opts in. |
| W17 | Friends (teenPrivate) | ✅ | Same recommendation as W8. |
| W14 | Co-parenting (two-household coordination) | ⚠️ | Aligns with FERPA's both-parents default: schools must give full FERPA rights to *either* parent absent a court order, statute, or binding document specifically revoking them (34 C.F.R. § 99.4). The app's "parent A can't veto parent B's child-grant" matches. **Needs:** custody-order override path (Part I improvement 4) — without it, the app cannot honor a court order that FERPA itself would honor. |
| W13 | Meals | ✅ | — |
| W22 | Activity | ✅ | — |
| W23 | Nutrition | ✅ | — |
| W21 | Mail (photo intake) | ✅ | — |
| W20 | Shopping List | ✅ | — |
| W11 | Spending | ✅ | — |
| W7 | Money & Documents (ledger, vault, bills, subscriptions, properties) | ✅ | — |
| W24 | Credit (3-bureau monitoring) | ✅ | — |
| W12 | Babysitters | ✅ | Directory only; no records nexus. |
| W10 | Fairness (equity lens across children) | ✅ | Ensure its comparisons never expose one child's school data to another household adult lacking access — per-child scoping. |
| W3 | Safety (insurance) | ✅ | — |
| W19 | Emergency (plan, vault) | ✅ | — |
| W6 | Driving & Life Skills | ✅ | — |
| W15 | Screen Time | ✅ | — |
| W25 | Fuel & Charging | ✅ | — |
| W26 | Weather | ✅ | — |
| W27 | Events | ✅ | — |
| W28 | Restaurants | ✅ | — |
| W29 | Trails & Parks | ✅ | — |
| W30 | Flights | ✅ | Minor-traveler rules are airline/TSA domain, not FERPA. |
| W31 | Rental Cars | ✅ | Driver-age rules are contract/state-law domain, not FERPA. |

## Category 5 — School Intelligence (W1 detail)

| Feature | Mark | Notes |
|---|---|---|
| 13 data sources with named owners (Muse/parent/child) | ⚠️ | Add a **rights-basis tag** per source (parent-FERPA-right pull / teen-provided / public). The 18/postsecondary transition must be able to pause exactly the parent-right pulls. "Owner" alone is insufficient. |
| Per-class pages (gap-to-90 hero, top-3 actions, checkboxes in Supabase) | ✅ | — |
| Daily check-in per class + handout uploads | ✅ | User-supplied content. (Handout uploads: school-copyrighted materials — copyright question for counsel, not FERPA.) |
| Teacher inbox per class (teacher + counselor + Outlook 365 + Synergy merge) | ⚠️ | Copies in-app are not FERPA records (Part I Q3). Requirements: strict per-child scoping (counselor emails especially); after 18/postsecondary, school-email ingestion needs the adult student's re-auth like any other school source. |
| AI practice quizzes from uploads; unit auto-alignment | ✅ | — |
| **Peer tips pipeline** (600/wk from grades, check-ins, curriculum) | 🛑 | **Blocked in current form.** Tips "generated from grades [and] check-ins" and distributed to other families are the closest thing in this product to a redisclosure event. FERPA doesn't bind the app, but distributing one student's record-derived insights to another family without consent is a consent/contract failure and a trust catastrophe. **Fix required:** tips must be provably non-identifiable and non-traceable to any individual student's records (aggregate across many students, no small-cell outputs), or be generated only from curriculum/public sources, or be consent-gated per contributing family. Do not ship cross-family tips derived from identifiable student data. |
| SAT prep (words, formulas) | ✅ | — |
| Daily pulls (lunch/dinner, power-up, notes, news, horoscope) | ✅ | — |
| Windows/MacBook sync workers (Playwright StudentVUE, queue SYNC NOW) | ⚠️ | Two requirements: (1) review Synergy/ParentVUE Terms of Service for automation/credential-sharing prohibitions — credentialed scraping at the user's direction is typically authorized use, but ToS may say otherwise; (2) student-credential workers need the 13+ student's consent; parent-credential workers pause at 18/postsecondary per §2-C. |
| ParentVUE/CTLS Parent/teacher Gmail pulls | ✅ | Parent's own accounts, parent's own copies. Same 18+ re-auth rule for continued pulls. |

## Category 6 — Family & Access Management

Covered in Part I §§1–3; consolidated marks:

| Feature | Mark | Notes |
|---|---|---|
| Email invite (7-day token, matching-login verify) | ⚠️ | Keep matching-email verification mandatory; add §2-A disclosure to the teen consent screen. |
| 6-digit link codes (15-min, single-use) | ✅ | — |
| Child access authority + `granted_by` enforcement | ✅ | Add the §2-E matrix footnote. |
| Age tiers (<13 · 13–15 · 16–17 · 18+) | ✅ / ⚠️ | Tiers lawful (Part I §1). 18+ needs the re-auth requirement (§2-C), not just the prompt. |
| "Who can see my stuff?" Sharing screen | ⚠️ | Add §2-A disclosure + "school records vs. Pookie records" explainer (Part I improvement 2). |
| Access request flow (non-parent adult → child approves; other parent notified, can't veto) | ✅ | Consistent with § 99.4 both-parents default. |
| Block list (teen blocks adult from requesting) | ✅ | — |
| "Go independent" graduation flow | ✅ | Add the one-line §2-A disclosure to the final screen. |
| 18th-birthday ownership prompt | ⚠️ | Skippable prompt is fine for *stored* data; add required data-source re-auth and the exceptions caveat (§2-A 18+ variant). |
| `graduate_child_access` RPC | ✅ | — |
| Claim dedupe (fuzzy match → link vs duplicate) | ✅ | Keep matching-email verification mandatory so fuzzy match alone can never claim a profile. |

## Category 7 — Settings & Data Management

| Feature | Mark | Notes |
|---|---|---|
| Credentials vault (school portal logins, encrypted) | ⚠️ | (1) Credentials must be user-deletable; never logged. (2) A parent's stored credentials for a child's portal must be **disabled/purged at 18/postsecondary** until the adult student re-provides their own — this is the operational teeth of §2-C. (3) Disclose whose credentials may be stored (only accounts the user is authorized to use). |
| Sync console (manual SYNC NOW, worker health, queue) | ✅ | — |
| Notification preferences | ✅ | Preferences UI must not allow re-enabling school-data notifications to an access-revoked adult (enforce matrix server-side regardless of prefs). |
| Data retention policies (per-source; check-ins indefinite, emails TBD) | ⚠️ | "Emails TBD" must be decided before launch: set and disclose a retention period for teacher/counselor email copies. Also disclose that a revoked parent keeps historical in-app data (spec §4) — or offer the teen a "hide past data too" option (Part I improvement 7). Under-13 data aging into teen-linked accounts needs a rule (Part I gap 5). |

## Category 8 — API Platform

| Feature | Mark | Notes |
|---|---|---|
| `GET /api/v1/me` | ✅ | — |
| `/api/v1/children/[childId]/school/*` (assignments, checkins, classes, uploads, due-next, overview, plans, teacher-messages +approve/send, minutiae +ingest) | ⚠️ | Every endpoint must enforce the §3 matrix (a revoked parent's token gets nothing) and write to the audit log (migration 021). The **approve/send** on teacher-messages must not bypass the parent-approval gate — API-sent teacher emails are the parent's own legal act; ensure the approver identity is the authorized parent, not a stale/revoked token. |
| `/api/v1/children/[childId]/college/*` (deadlines, essays +feedback) | ✅ | — |
| `/api/v1/household/*`, `/api/v1/invites/*` | ✅ | Matrix-enforced as above. |
| `/api/v1/tutor/*` | ⚠️ | Inherits the Category 2 AI-processing requirements (no-training commitment, disclosure, minimization). |
| Notifications API (planned) | ⚠️ | Fan-out must respect the access matrix (same as nudges, Category 2). |

---

## PART II(a) — Features NOT in the list that should exist (FERPA domain)

1. **Rights-basis tagging + transition manager** — per-source rights basis and an 18/postsecondary re-authorization flow (operationalizes §2-C). The spec's "guide the young adult to connect their own" is not a feature; make it one.
2. **Dual-enrollment / postsecondary flag** on the child profile (Part I improvement 1) — a 17-year-old in college is an eligible student *now* (§ 99.5(a)).
3. **Consent artifacts + append-only access audit log** (migration 021, §2-F).
4. **Legal-reality disclosure surfaces** with the §2-A copy (four touchpoints).
5. **Custody-order override tool** for support (Part I improvement 4; § 99.4 alignment).
6. **"Your school rights" explainer** — a plain-language FERPA-rights page for parents/teens (education, not advice). Most parents don't know § 99.10 inspection rights; teaching it reinforces that Pookie ≠ school and reduces the deception risk in §2-A.
7. **Adult-child data portability** at 18 ("take your Pookie with you" export) — matches the independence framing; no FERPA duty, but the right product move at the rights-transfer moment.
8. **Breach-notification runbook** covering education-record copies (Georgia breach law, O.C.G.A. § 10-1-912, is the operative regime — FERPA has no breach-notification rule for the app).

## PART II(b) — Features that should NOT exist in current form

1. **Peer tips pipeline (Category 5) — 🛑 blocked as specified.** Cross-family tips derived from identifiable students' grades/check-ins must not ship. Ship only with provable de-identification/aggregation, curriculum-only sourcing, or per-family consent.
2. **Unqualified "FERPA-compliant" marketing** — not in the feature list, but preempt it: any claim must be the narrow accurate form ("designed to respect FERPA rights — your school choices and Pookie choices are separate"), never implying Pookie controls school disclosures.
3. **API teacher-message send without an unbypassable approval gate** — the "+approve/send" endpoint must structurally require the authorized parent's approval; a flag the client can set is insufficient.
4. **Indefinite "emails TBD" retention** — not a feature to keep; decide the retention period pre-launch (Category 7).

## Reassessment flags — extended (Part I §6 plus feature-driven triggers)

- …peer-tips pipeline design changes (any move from aggregate to identifiable sourcing) → re-review before ship.
- …any new AI provider or model behind `pookie-tutor` → re-verify no-training commitment and data-processing terms.
- …any school/district agreement or "school official" designation → full FERPA re-review (§ 99.31(a)(1)(i)(B), § 99.33 attach).
- …ingestion of IEP/504/school-health records begins → consent-gating review.
- …expansion beyond Georgia; Georgia student-privacy legislation; under-13 login features; annual cadence (unchanged from Part I).

