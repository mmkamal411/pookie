# Attorney 3 — Platform Liability: Gate Drafts (NFR-LEGAL-001/002/003/004/005/006/008)

**Status:** ISSUE-SPOTTING DRAFTS · 2026-10-12 · Fractional Team 1 (Platform Liability Attorney)

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

This document turns the structure outlines in `LEGAL-POLICY-OUTLINES.md` (Outlines 1, 2, 3, 4)
into working drafts for the seven gates owned by the Platform Liability attorney. It is an
**issue-spotting and drafting-assistance product, not legal advice and not a substitute for a
barred attorney.** Nothing below may be published, launched, or relied upon until licensed
counsel drafts or signs off on it, per each gate's clearance status.

**How to use this document**
- The Managing Director uses each per-gate section to brief and scope the licensed
  attorney engagement (what the attorney must do vs. what is already drafted).
- Squads use the "Blocked modules + dependency chain" tables for sequencing only —
  **clearance status governs what may be built or launched**, not the presence of a draft.
- Clearance key: 🔴 blocked (attorney work not begun; nothing ships) · 🟡 in-progress
  (draft advanced; specific attorney/DV-advocate approvals still required; build at own risk
  per gate rules) · 🟢 attorney-signed (cleared).

**Product facts assumed throughout** (from `MD-DECISIONS.md` and `BUILD-SPECIFICATION.md`):
Georgia launch jurisdiction; child-as-access-authority; age tiers <13 / 13–15 / 16–17 / 18+;
D1 contracted crisis-response vendor (2 support agents 9–5 ET); D5 open second-parent signup
with STAY-OUT custody posture and `court_order_restriction` flag; D7 coarse-location-only
architecture; break-glass Path A (teen-configured trusted adult, 12h) + Path B (LE emergency
under SCA §2702(b)(8), 72h); 28-module shell + Support (S1 FAQ, S2 AI chat, S3 tickets).

---

## GATE NFR-LEGAL-001 — Terms of Service + Arbitration + Class Waiver · 🔴 BLOCKED

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🔴 blocked — the agreement must be DRAFTED BY licensed counsel (11th Circuit
post-*Concepcion* practice), not edited from the working draft below.** The working draft
covers structure, clause inventory, acceptance-mechanics spec, and the issue list. It does
**not** cover: enforceable arbitration-clause wording, forum/provider selection, the opt-out
window, fee-allocation language, the delegation clause, the class waiver and its
severability architecture, the minor-voidability analysis under Georgia law, the
parent-as-contracting-party mechanism's interplay with COPPA verifiable parental consent,
the portal-automation (StudentVUE/ParentVUE via Playwright) ToS/CFAA exposure analysis, or
the Privacy Policy itself. **Those are counsel-only.** A barred attorney starts from this
scaffold; the attorney does not "redline my ToS into enforceability."

### What the barred attorney must do (🔴 items — not delegable)
1. Draft the Master Terms from scratch (or fully rewrite this scaffold) as the binding
   agreement, with 11th Circuit clickwrap/arbitration jurisprudence incorporated.
2. Decide and draft: arbitral forum and rules, cost/fee allocation, opt-out window
   duration, delegation-clause scope, small-claims carve-out, class-waiver wording and
   severability, mass-arbitration provisions.
3. Resolve the **minor-voidability** problem under Georgia law: confirm the
   parent-as-contracting-party mechanism (13–17) produces an enforceable agreement;
   advise on capacity, parental consent to arbitration on the minor's behalf, and
   severability if the minor's assent is challenged.
4. Advise on the portal-automation path (StudentVUE/ParentVUE via Playwright):
   CFAA exposure and school-portal ToS implications — the ToS/CFAA brief (sol-legal §16)
   is counsel work, and the ToS's prohibited-uses section must reflect it.
5. Draft or fully review the Privacy Policy (FBPA-enforceable under O.C.G.A.
   § 10-1-393(a)) — every promise in it is binding; the
   `PRIVACY-PROMISES-AUDIT.md` is the pre-publication checklist.
6. Draft the Teen Plain-Language Summary with the non-binding-explainer disclaimer,
   ensuring it cannot be construed as the binding agreement or as contradicting it.
7. Set the re-acceptance trigger standard for material changes and age-tier transitions
   (13 / 16 / 18).

### What this working draft covers (🟢 ready for counsel to consume)
Clause inventory, party model, acceptance-mechanics spec, prohibited-uses list, disclaimer
copy, termination/data-handling rules, and the modular architecture — all below.

---

### WORKING DRAFT — Pookie Master Terms of Service (scaffold for counsel)

**Section 0 — Notices (conspicuous, top of agreement)**
> By creating an account or using Pookie you agree to these Terms. **Disputes are resolved
> by binding individual arbitration** as described in Section 9 — you waive any right to a
> jury trial or to participate in a class action, except as stated in Section 9.
> **Pookie is not an emergency response service. In an emergency, call 911 first.**
> Pookie's AI features (including Pookie tutor and Pookie/Muse chat) are not therapists,
> counselors, or medical professionals.

**Section 1 — Parties; who can contract**
- 1.1 **Adults (18+):** the account holder is the contracting party.
- 1.2 **Teens (13–17):** the **parent or legal guardian is the contracting party**.
  The teen provides a separate plain-language assent (Section 12), which is an
  acknowledgment, **not** the contract. Rationale: a minor may disaffirm a contract under
  Georgia law; the agreement must bind the adult. [ATTORNEY: confirm voidability analysis
  and parental-consent-to-arbitration enforceability.]
- 1.3 **Under-13 parent-managed profiles:** the parent is the contracting party; the
  child has no account and no assent is sought. No typable child-authored fields exist
  (technical ban per `UNDER13-TECHNICAL-BAN-CHECKLIST.md`).
- 1.4 Guardian attestation: at "add children" the adult checks a box affirming
  parent/guardian status; Pookie records checkbox + timestamp + IP/device hash
  (FR-AUTH-003). Misrepresentation of guardianship is grounds for termination and is
  referred to counsel where it implicates the D5 claim flow.

**Section 2 — Agreement architecture (modular)**
- 2.1 **Master Terms** (this document) — the binding contract.
- 2.2 **Privacy Policy** — binding and FBPA-enforceable; incorporated by reference.
- 2.3 **Teen Plain-Language Summary** — clearly labeled **non-binding explainer**,
  ≤8th-grade reading level; in any conflict, the Master Terms control.
  [ATTORNEY: draft disclaimer to survive a "this is what I actually read" challenge.]
- 2.4 **Per-module addenda** — binding addenda for regulated surfaces, each presented at
  first use of the module and versioned:
  - (a) **Health addendum** (W2/W8/W22/W23): H0–H3 taxonomy, per-subcategory consent,
    MHMDA disclosures (WA posture), the "never train on your data" commitment, 18+
    opt-in re-consent (FR-AGE-006).
  - (b) **School addendum** (W1/W5/W16): FERPA school-transparency line —
    **"Pookie is Pookie-only; your school still shares grades and records with your
    parents under its own rules."** — parent-credential automation disclosures.
  - (c) **Location addendum** (W26/W27/W29): D7 coarse-only architectural statement —
    **"Pookie stores city/ZIP-level location only. Precise GPS is never collected."**

**Section 3 — The service; what Pookie is and is not**
- 3.1 Pookie is a family life-assistant: organization, tracking, and AI assistance across
  modules. It is **not** an emergency response service (see §8), **not** a medical,
  mental-health, legal, or financial advisor, and **not** a substitute for professional
  advice.
- 3.2 **AI disclosures:** Pookie tutor, Pookie/Muse chat, and S2 AI support chat are AI
  systems. They are not therapists or counselors. Crisis language triggers a crisis-line
  handoff (988; GA Crisis & Access Line) per FR-AI-005 — handoff is a referral, not
  treatment.

**Section 4 — Accounts, age tiers, and access authority**
- 4.1 Age tiers: <13 parent-managed (no child login); 13–15 shared agency; 16–17 teen
  control with instant revoke; 18+ adult. Tier changes at 13/16/18 require parent
  re-acceptance of the Terms (see §10).
- 4.2 **Child-as-access-authority:** for 13–17, the teen controls who sees teen-scoped
  data; a parent grant made by the teen cannot be vetoed or revoked by any parent — only
  the teen (or original granter) can revoke. Every child-access row carries
  `granted_by` for server-side enforcement.
- 4.3 Under-13: the parent manages the profile; no child login exists.

**Section 5 — Acceptable use; prohibited uses**
- 5.1 No account sharing of credentials; no scraping, reverse-engineering access
  controls, or automated collection except through Pookie-provided integrations.
- 5.2 **No <18 account may complete a purchase, booking, or contract flow**
  (FR-TRAVEL-001): W30 Flights, W31 Rental Cars, and any checkout surface are
  hard-gated to 18+ accounts (server-side enforcement, not UI hiding).
- 5.3 School-portal automation: where Pookie connects to school portals
  (StudentVUE/ParentVUE) on the user's behalf, the user authorizes that access; misuse
  may result in suspension. [ATTORNEY: conform to the ToS/CFAA brief.]
- 5.4 No uploading content the user has no right to share; TAKE IT DOWN Act compliance:
  valid reports result in removal ≤48 hours.

**Section 6 — Teen data rights (standalone)**
- 6.1 Grant/revoke rules, visibility scopes, and the school-transparency line from §2.4(b).
- 6.2 **On 18:** FERPA rights transfer to the adult student; school-pulls pause until
  re-auth; the adult chooses keep / private / "hide past too" (deletion ≤30 days);
  health data requires opt-in re-consent (skip = private, unconsented data purged
  ≤30 days). See Gate 003 flow spec.
- 6.3 Teen-authored content (check-ins, reflections, AI chats) follows the **teen's**
  deletion rights, not the account holder's — including on termination (§11).

**Section 7 — Privacy; data retention**
- 7.1 Incorporated Privacy Policy governs collection, use, sharing. Retention follows
  the published per-source schedule (`COPPA-RETENTION-SCHEDULE.md`), incorporated by
  reference; no under-13 personal information is retained indefinitely (COPPA §312.10).
- 7.2 "Never train on your data": Pookie does not use user content to train AI models
  (broad "train" definition: training, fine-tuning, RLHF, evals, embeddings).
  [NOTE: do not publish until Cloudflare/Meta DPA terms are verified with
  zero-retention-for-training clauses — NFR-PRIVACY-010 / D2.]

**Section 8 — Safety; not an emergency service**
- 8.1 **Pookie is not an emergency response service. In an emergency, call 911 first.**
  W19 Emergency is a storage and planning surface, not a response service (FR-SAFETY-008).
- 8.2 Break-glass disclosures (trusted-adult Path A; law-enforcement Path B under SCA
  §2702(b)(8)) occur only under the published safety policies; scope is fixed
  (coarse location + emergency medical card), never requester-defined.
- 8.3 Mandatory reporting: if Pookie personnel are designated mandatory reporters under
  Georgia law (O.C.G.A. § 19-7-5), suspected child abuse will be reported to DFCS
  (1-855-422-4453). See Gate 002.

**Section 9 — Dispute resolution; binding arbitration; class waiver**
[ATTORNEY-DRAFTED — scaffold only. Requirements counsel must satisfy:]
- (a) **Conspicuousness:** standalone section, bold heading, presented at signup with a
  separate unchecked checkbox ("I agree to the Terms, including the binding arbitration
  clause in Section 9") — clickwrap with mutual-assent evidence, not browsewrap.
- (b) **Delegation clause:** gateway questions of arbitrability decided by the arbitrator.
- (c) **Class-action waiver** with **severability**: if the waiver is held
  unenforceable, [ATTORNEY: draft fallback — e.g., waiver severed and remaining
  arbitration proceeds, or the dispute exits to court; do not leave silent].
- (d) **Small-claims carve-out**; **opt-out window** of [ATTORNEY: set duration, e.g.
  30 days] by written notice to a published address.
- (e) Cost/fee allocation; arbitral forum and rules [ATTORNEY: select].
- (f) **Mass-arbitration provisions** (batching/bellwether mechanics) [ATTORNEY: draft].
- (g) **Minor-specific:** parental consent to arbitration on the minor's behalf;
  capacity acknowledgment; severability if the minor's assent is challenged
  [ATTORNEY: resolve enforceability].
- (h) **Changes to this section:** notice + re-acceptance; no retroactive application
  to accrued claims [ATTORNEY: confirm].

**Section 10 — Acceptance mechanics**
- 10.1 Versioned acceptance records: who (account + role), when, Terms version,
  IP/device hash. Stored in the audit log; retained per the retention schedule.
- 10.2 Material changes require re-acceptance; continued use after notice is not
  acceptance for material changes.
- 10.3 Age-tier transitions (13 / 16 / 18) require **parent re-acceptance** for the
  13–17 contracting-party model, and adult re-acceptance at 18.

**Section 11 — Termination; data on termination**
- 11.1 Grounds: ToS violation, guardianship misrepresentation, fraud, safety threats.
  Appeal path: written appeal to the Compliance Owner within 30 days.
- 11.2 On termination: account data deleted per the retention schedule with a **30-day
  deletion SLA**; legal-hold and safety-record exceptions per Gate 005.
- 11.3 **Teen data rights on termination:** teen-authored content follows the teen's
  deletion rights; a parent's termination of a family account does not extinguish a
  16–17 teen's deletion requests already in flight.

**Section 12 — Teen assent (13–17; non-contract acknowledgment)**
- Plain-language (≤8th grade), presented at teen onboarding: what Pookie does with their
  data, who can see it, how to revoke access, how to delete check-ins, the
  school-transparency line, crisis resources. Explicitly labeled: "This is an
  explanation, not a contract. Your parent/guardian agreed to the actual Terms."

**Section 13 — General provisions** [ATTORNEY: draft — governing law (Georgia),
assignment, severability, entire agreement, notices, force majeure.]

### Blocked modules + dependency chain — Gate 001
| Blocked | Dependency chain |
|---|---|
| **ALL modules (W1–W31, 28-module shell), Pookie AI tab, Support S1/S2/S3** | No real-user launch without a binding agreement → no signup/onboarding → no accounts → no module has a lawful user. Staging with real data is also blocked (no data-processing basis). |
| Onboarding + age-tier flows | Contracting-party model (parent for 13–17) is a signup-flow build input; teen assent copy is a UI input. |
| Privacy Policy publication | Gate 1's Privacy Policy prong; also gated by D2 DPA verification. |
| W30 Flights / W31 Rental Cars | §5.2's <18 purchase/booking bar must be in the enforceable Terms before the 18+ hard gate ships. |
| S2 AI chat / Pookie tutor | §3.2 AI disclosures and §8.2/8.3 safety language are launch copy inputs. |

---

## GATE NFR-LEGAL-002 — Mandatory-Reporter Program · 🔴 BLOCKED (designation) / 🟡 (program structure)

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🔴 for the designation decision memo** (requires a Georgia child-welfare /
mandatory-reporter attorney's sign-off — this is the gate's critical path). **🟡 for the
training program structure and DFCS escalation procedure** (drafted below; attorney sets
the SLA and approves training content). **Nothing ships as designed until the designation
memo is signed: no human (staff or contractor) reads check-in content, and no human
reviews AI flags of check-in content, before then.**

### Verified legal facts (Georgia, checked 2026-10-12)
- O.C.G.A. § 19-7-5(c)(1) lists mandated reporters, including (M) **"child service
  organization personnel"** — persons employed by or volunteering at a business or
  organization that provides care, treatment, education, training, supervision, coaching,
  counseling, recreational programs, or shelter to children. The statute's purpose clause
  directs **liberal construction** in favor of child protection.
- Threshold: **"reasonable cause to believe"** suspected child abuse occurred. Privilege
  or confidentiality does not excuse reporting (clergy-confession exception only).
- **Knowing and willful failure to report = misdemeanor** (§ 19-7-5(h)). Good-faith
  reporters have **civil and criminal immunity** (§ 19-7-5(f)).
- **2026 Georgia HB 1409** (per 2026 session reporting): updates child-abuse reporting
  requirements, **including that reports be made within 24 hours — effective July 1,
  2027.** Pookie's internal SLA should meet the 24-hour statutory floor from day one
  rather than retrofit in 2027. **Counsel must confirm** the bill's final enrolled text
  and effective scope.
- Anyone (mandated or not) *may* report; the duty attaches to the *person in the covered
  role*, not to the company — outsourcing review does not automatically remove exposure.

### 2A. DESIGNATION DECISION MEMO (draft for counsel's decision)

**Roles that will read child (13–17) content under current design:**
| Role | What they read | Coverage analysis (for counsel) |
|---|---|---|
| 2 support agents (9–5 ET, D1) | S2/S3 ticket content, incl. teen-authored text on escalation | Reads teen content as a job duty. If Pookie is a "child service organization," these staff are covered personnel. |
| Contracted crisis-response vendor staff (24/7, D1) | Break-glass Path A/B corroboration material; crisis-adjacent teen content | **D1 question:** vendor staff are employed by the vendor, not Pookie. But if the *vendor* provides counseling/care to children as its business, its staff may be covered in their own right — and Pookie staff who *receive* their escalations re-enter the analysis. The vendor contract must allocate the duty explicitly (see §2D). |
| QA samplers (human QA of teen content, e.g., AI-flag calibration) | Samples of check-ins / AI chats | Any sampling of teen-authored content for abuse signals is the highest-risk activity for attaching the duty. |
| AI-labeling contractors | Labeled teen content for model evals | Same as QA samplers. Note D2 "never train" does not remove the *reading* exposure. |
| Safety-review / trust-&-safety staff | Flagged content queues | Covered if the organization is covered. |

**The pivotal question for counsel:** Is Pookie a business/organization that "provides
care, treatment, education, training, supervision, coaching, counseling, recreational
programs, or shelter to children"? Plausible hooks a regulator or plaintiff's counsel
would cite: **Pookie tutor** (AI tutoring = "education"); **W8 Wellbeing / daily check-ins
/ mood calibration** ("care" or "counseling"-adjacent); **crisis-line handoff + break-glass
human review** ("care"); **W4 Activities / W18 Summer** ("recreational programs").
Counterarguments: Pookie is a general-purpose family organizer; AI features are not
human services; no Pookie employee holds a counseling/teaching credential in that
capacity. **Georgia courts construe the statute liberally** — counsel should assume the
aggressive reading is available to an adversary.

**Two tracks (counsel + founder decide; this memo does not pick):**
- **Track A — Designate and build the program (recommended default posture until counsel
  rules otherwise).** Treat support agents, safety reviewers, QA samplers, and
  labeling contractors as mandatory reporters; train them; run the DFCS escalation path.
  Cost: training, on-call burden (vendor covers 24/7 per D1), hiring filters, report-log
  infrastructure. Benefit: eliminates the criminal-exposure tail (misdemeanor for
  knowing/willful failure) and the civil-reputation tail of a missed report.
- **Track B — Architect away from the duty.** No human reads of check-in content by
  design: teen-facing calibration only (FR-SCHOOL-003); AI flags route to the teen, not
  to a human queue; support agents never see teen-authored content (strict scoping);
  crisis vendor handles only Path A/B corroboration under a contract that makes the
  *vendor* the reporting party. Document the posture in a counsel-signed memo. Residual
  risk: break-glass review inherently involves humans reading teen-adjacent content in
  emergencies — counsel must opine whether the emergency context changes the analysis,
  and whether "architecting away" survives contact with the liberal-construction rule.

**Recommendation to the Managing Director:** hold the **Track A default** — designate,
train, and report — because (1) the "education/counseling" hooks are real given the
tutor + wellbeing features, (2) Georgia construes the statute liberally, (3) the cost of
being wrong is criminal exposure for individual staff plus company-level negligence
exposure, and (4) D1 already puts a trained crisis vendor in the loop, so the marginal
cost of a real program is lower than it looks. **Counsel's designation memo is the
decision document; the founder makes the final call on counsel's advice.**

### 2B. TRAINING PROGRAM STRUCTURE (draft — attorney approves content)
- **Module 1 — Recognizing signs:** physical abuse, neglect, sexual abuse, emotional
  abuse indicators; teen-specific disclosure patterns (minimization, testing language in
  check-ins/AI chats).
- **Module 2 — The legal threshold:** "reasonable cause to believe" (suspicion, not
  proof); the 24-hour report clock (HB 1409, eff. 2027-07-01 — adopt now); privilege
  does not block reporting; good-faith immunity.
- **Module 3 — How to report:** DFCS 1-855-422-4453 (or county DFCS); what DFCS will
  ask (child identity, what happened, observations, timing/location, caregiver capacity,
  other children in the home); **emergency → 911 first, then DFCS.**
- **Module 4 — Documentation:** facts observed, not conclusions; report log fields;
  non-report decisions require a documented rationale (protects against
  failure-to-report claims).
- **Module 5 — Retaliation protections:** no adverse action for good-faith reporting;
  escalation path if pressured not to report.
- **Role-based tiers:** *Reporters* (all five modules + scenario drills); *Adjacent
  staff* (recognize + escalate internally within 1 hour; never investigate themselves).
- **Records:** completion logs (who, date, materials version); annual refresher;
  training materials versioned and retained per the retention schedule (workforce/safety
  record row — add in schedule v0.2).
- **Hiring filter note:** roles with reporter duties are so designated in the job
  description; vendor contract requires equivalent training (see §2D).

### 2C. DFCS ESCALATION PROCEDURE (draft — attorney sets final SLA)
1. **Observe/receive** → the reporter writes facts-only notes immediately (timestamped).
2. **Internal triage** — within **4 hours** of the reasonable-cause determination
   (draft SLA; attorney confirms; statutory floor is 24h from 2027-07-01): the reporter
   notifies the designated internal delegate; **no person in the chain may modify,
   restrain, or dilute the reporter's account** (per § 19-7-5(c)(2) — the delegate may
   add relevant information but not change the report).
3. **Report to DFCS** via **1-855-422-4453** (GA Child Abuse & Neglect Reporting line)
   or county DFCS. Emergency/danger → **911 first**.
4. **Teen-safety communication:** the teen is told, in plain language, that "we shared
   what you told us with people whose job is to keep kids safe" — **after** the report
   is filed, unless telling sooner would endanger the teen (reviewer judgment, logged).
   Never promise confidentiality the program cannot keep.
5. **Report log:** date/time, reporter, facts observed (not conclusions), DFCS reference
   number, follow-ups. Access-restricted; retained per schedule (add row in v0.2).
6. **After-hours:** the contracted crisis vendor (D1) covers 24/7; the vendor contract
   requires vendor-side reporting within the same SLA (see §2D).
7. **Annual program review memo** + re-run triggers (first human read of check-in
   content; first AI-flag human review; launch of human QA sampling; material change in
   check-in visibility; **contracting or changing the crisis vendor** — each logged with
   date, change, and re-analysis outcome).

### 2D. D1 CONTRACTED-VENDOR ALLOCATION (must be in the vendor contract)
Counsel must analyze whether vendor staff attach the duty in their own right; regardless,
the contract must: (a) require the vendor to warrant its staff are trained mandatory
reporters under GA law (or the law of the reporter's jurisdiction); (b) require the
**vendor to report directly to DFCS/law enforcement** within the SLA — not merely pass
suspicions up to Pookie; (c) require contemporaneous notice to Pookie's Compliance Owner
of each report filed (report metadata, not teen content beyond the minimum necessary);
(d) prohibit the vendor from delegating reporting to Pookie; (e) require vendor
maintenance of its own report logs with audit rights for Pookie; (f) allocate
indemnification for failure-to-report exposure arising from vendor-side handling;
(g) survive termination for the retention window of report records. **Outsourcing review
does not outsource Pookie's own exposure for its in-house readers** — the designation
memo must cover both populations.

### Blocked modules + dependency chain — Gate 002
| Blocked | Dependency chain |
|---|---|
| W8 Wellbeing — human-read check-in pipeline | Any pipeline where a person reads teen check-in/mood text (triage, calibration review) requires the designation memo + training complete. **Teen-facing calibration only (no human reads) may proceed** per FR-SCHOOL-003. |
| S2 AI chat / S3 tickets — human review of teen content | Support agents reading escalated teen-authored content are in-scope readers; blocked until Track A program or Track B architecture is signed. |
| D1 crisis vendor operations (break-glass Path A/B) | Vendor contract's reporting-allocation clauses (§2D) must be executed before the vendor touches teen-adjacent content. |
| Pookie tutor — human oversight/QA of teen sessions | QA sampling or labeling of teen AI-chat content is a re-run trigger; blocked until designation memo signs the sampling protocol. |
| W1 School — counselor-mail human review (ASCA B.2 restricted) | If any human reads counselor/teacher mail copies, the reader population expands; include in the designation memo's role table. |

---

## GATE NFR-LEGAL-003 — 18+ FERPA Consent Design · 🟡 IN PROGRESS

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🟡 — consent flow specification drafted below; counsel signs off BEFORE the
18+ flow is built.** FERPA's rights-transfer rule (rights transfer to the student at 18 or
upon postsecondary enrollment) is settled federal law; what needs counsel is the
*implementation*: the pause mechanics, re-auth standard, postsecondary prong, and the
exact school-transparency copy.

### Consent flow specification (draft for counsel + build)

**Trigger events:** (a) teen's 18th birthday (computed from verified DOB); (b) detected
or declared postsecondary enrollment (either can trigger first — whichever comes first
transfers the rights).

**T-30 / T-7 / T-0 notification sequence (teen-facing):**
- **T-30 days:** in-app card + email to the teen: *"You're turning 18 soon. Your school
  records belong to you now — here's what changes."*
- **T-7 days:** reminder card.
- **T-0 (18th birthday):** the 18+ consent screen (below) gates the School module; school
  syncs **pause** until the adult student completes it.

**Parent-credential pull pause mechanics:**
1. At T-0, all automated school-portal pulls using parent credentials **pause
   immediately** (server-side job suspension, not UI hiding).
2. The parent sees: *"School syncing is paused while [FirstName] completes their adult
   privacy setup. This is required by federal student-privacy law (FERPA)."*
3. No new snapshots are written during the pause; existing snapshots are access-frozen
   (not deleted — deletion follows the adult's choice below).
4. If the adult does not complete the flow within **1 year**, unclaimed school data is
   purged per the retention schedule (row 8), and the parent is notified of the purge.

**The 18-year-old's consent screen (exact draft copy for counsel review):**

> ### You're 18 — your school records are yours now
> Under a federal law called **FERPA**, when you turn 18 (or start college), the privacy
> rights for your school records transfer **from your parents to you**. Pookie follows
> that rule. Here's what that means here:
>
> **1. School syncing is paused.** Pookie stopped pulling your grades and assignments
> until you decide. Nothing new is being collected right now.
>
> **2. Choose what happens to your past school data in Pookie:**
> - **Keep it** — your school history stays in Pookie, visible per your sharing settings.
> - **Make it private** — it stays stored but only you can see it. Parents and others
>   lose access.
> - **Hide the past too** — Pookie deletes your past school snapshots within 30 days.
>
> **3. Reconnect school access (optional).** To resume syncing, connect with **your own**
> credentials. Pookie will no longer use your parent's school-portal login for your
> records.
>
> **4. Health data needs a separate yes.** Anything Pookie holds about your health
> (H1–H3) stays private until you opt in again. No answer means private.
>
> **The school-transparency line:** *Pookie is Pookie-only. Your school still shares
> grades and records with your parents under its own rules — turning 18 here doesn't
> change what the school itself does.*

**Re-auth requirements:**
- Resumed syncing requires the adult student's **own** portal credentials (or the
  school's delegated-access mechanism where available). Parent credentials are purged
  from the credential store ≤30 days after transfer unless the adult explicitly
  re-authorizes their use (logged, revocable).
- Health re-consent (FR-AGE-006): per-subcategory opt-in; skip = private; unconsented
  health data purged ≤30 days.

**Postsecondary-enrollment prong:**
- If Pookie learns of college enrollment before 18 (W5 College & Future application
  tracking, user declaration), the same flow triggers early — rights transfer on
  enrollment, not just the birthday.
- For 18+ college students, school connections are student-credential-only from the
  start; the parent-credential path is never offered for adult accounts.

**Counsel must confirm:** the pause-vs-delete default (we chose pause + adult choice,
not auto-delete, to avoid destroying records the adult wants); the 1-year unclaimed
purge window; credential-purge SLA; the exact transparency copy; interplay with state
laws that may extend parental access (none identified for GA — counsel confirms).

### Blocked modules + dependency chain — Gate 003
| Blocked | Dependency chain |
|---|---|
| 18+ transition flow (all modules) | The flow spec above is a build input; counsel sign-off is the build gate. |
| W1 School — adult-student mode | Parent-credential pause mechanics + student re-auth are School-module logic. |
| W5 College & Future — postsecondary prong | Enrollment-triggered rights transfer touches application tracking UX. |
| W2/W8/W22/W23 Health — 18+ re-consent | FR-AGE-006 opt-in re-consent is part of the same T-0 screen; health modules can't ship adult mode without it. |

---

## GATE NFR-LEGAL-004 — Cooling-Off Notification / Retaliation Matrix · 🟡 IN PROGRESS (DV-advocate review required)

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🟡 — notification copy matrix drafted below. Every string marked
🟣 needs review by a domestic-violence (DV) advocate / survivor-safety expert — a
separate engagement the Managing Director must commission. Counsel reviews the matrix
for legal risk; the DV advocate reviews it for survivor-safety risk. Neither review has
begun.**

### Design principles (DV-safety lens)
1. **Notifications must never become surveillance tools.** A notice that tells an
   abuser *when* a teen restricted access can trigger retaliation in the cooling-off
   window itself.
2. **Default to the least-informative true statement** that satisfies the legal/policy
   purpose; details go to the affected teen, not the restricted party.
3. **Timing is safety-critical:** "notify now" vs. "notify at effect" is not a UX
   preference — it is a safety decision, per scenario.
4. **Safety-comms carve-out (FR-SAFETY-003) is never disclosed** in notifications and is
   never overridden by access changes.

### Notification copy matrix (exact draft strings — 🟣 = needs DV-advocate review)

**Scenario A — Teen (13–15) revokes a parent's access (7-day cooling-off; revoke takes
effect at day 7):**
| Timing | Recipient | Copy |
|---|---|---|
| At request (T+0) | Teen | "Done. [Parent]'s access to [scope] ends in 7 days. During these 7 days, nothing changes about what they can see. If you feel unsafe at any point, you can reach [crisis resources] — and you can talk to us about it." 🟣 |
| At request (T+0) | Parent | **SILENT — no notification until effect.** Rationale: notifying at T+0 gives a potentially abusive parent a 7-day window to retaliate before the revoke takes effect. 🟣 |
| At effect (T+7) | Parent | "Access update: [Teen's first name] changed their sharing settings. You no longer have access to [scope]. This change was made under Pookie's teen privacy settings." — No timestamp of when the request was made; no appeal path offered in-copy (appeal exists via support, not advertised here). 🟣 |
| At effect (T+7) | Teen | "It's done — [Parent] can no longer see [scope]." 🟣 |

**Scenario B — Teen (16–17) instant revoke:**
| Timing | Recipient | Copy |
|---|---|---|
| At effect (immediate) | Teen | "Done — [Parent] can no longer see [scope]." |
| At effect (immediate) | Parent | "Access update: [Teen's first name] changed their sharing settings. You no longer have access to [scope]." 🟣 (Why flagged: even truthful minimal notice can be the trigger event — advocate reviews wording, channel, and whether in-app-only vs. push.) |

**Scenario C — Parent revokes a grantee (e.g., babysitter, W12) or a time-boxed grant
expires (D6):**
| Timing | Recipient | Copy |
|---|---|---|
| At effect | Grantee | "Your access to [Family]'s [scope] has ended." (No reason given; no teen involvement disclosed.) |
| At effect | Parent/teen granter | "Access for [Grantee] has ended." |

**Scenario D — Second-parent claim approved/denied (D5 flow):**
| Timing | Recipient | Copy |
|---|---|---|
| On decision | Claimant | Approved: "You're connected. Here's what you can see." Denied: "We couldn't verify this connection. You can try again in 30 days." (Uniform, non-enumerating — never confirms/denies the child's existence to unverified parties.) 🟣 |

**Scenario E — Court-order-driven access change (Gate 008):**
| Timing | Recipient | Copy |
|---|---|---|
| At effect | Teen | "A court order requires us to share [specific scope] with [parent]. This wasn't your choice or ours — the court decided. You can ask our compliance team questions anytime; we won't share your questions with [parent]." 🟣 |

**Scenario F — Safety-comms carve-out activation (FR-SAFETY-003):**
| Timing | Recipient | Copy |
|---|---|---|
| Never | Restricted party | **No notification, ever.** The carve-out's existence is not disclosed to the restricted party. 🟣 |

### Why each 🟣 string needs DV-advocate review
- **A (teen copy):** the crisis-resource offer inside a revoke confirmation could be
  seen by an abuser monitoring the teen's device — advocate reviews safe presentation
  (e.g., disguised entry points, quick-exit).
- **A/B (parent copy):** any notice to a potentially abusive parent is a possible
  retaliation trigger; advocate reviews whether notice should be in-app-only (no push/
  email that appears on a shared device or lock screen), and the exact wording.
- **D:** claim-denial copy must not leak household composition to an abuser probing the
  system (enumeration safety).
- **E:** court-order notice to the teen must be honest without creating a new danger
  vector (e.g., teen confronting the parent).
- **F:** confirming or denying the carve-out's existence is itself a safety decision.

### Blocked modules + dependency chain — Gate 004
| Blocked | Dependency chain |
|---|---|
| Teen revoke / grant flows (all modules — access matrix UI) | Copy strings are UI inputs; DV-advocate review is the launch gate for the revoke UX. |
| W12 Babysitters + D6 time-boxed grants | Grant-expiry and revoke notifications use Scenario C copy. |
| D5 second-parent claim flow (FR-AUTH-011) | Scenario D copy; 30-day re-request lockout notice. |
| W14 Co-parenting | High-conflict co-parenting surfaces are the highest DV-risk area; no launch without the matrix. |
| Sharing screen (child access authority UI) | The "who can see my data" screen is where revokes originate. |

---

## GATE NFR-LEGAL-005 — Retention + Litigation Hold · 🟡 IN PROGRESS

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🟡 — litigation-hold procedure drafted below; integrates with
`COPPA-RETENTION-SCHEDULE.md` v0.1. Requires: (a) licensed-attorney confirmation of hold
mechanics and conflict rules; (b) appointment of the Compliance Owner (not yet
appointed — itself a Phase-0 blocker per `LEGAL-GATES-TRACKER.md`).**

### Litigation-hold procedure (draft)

**1. Authority to place a hold.** Only the **Compliance Owner** or **outside/inside
counsel** may place a litigation hold. Support agents, engineers, squad leads, and the
Managing Director may *request* a hold; they may not place one. Two-person integrity:
the hold notice is countersigned by counsel (or, if counsel is unavailable on an
emergency basis, by the Managing Director with counsel countersignature within 2
business days).

**2. Trigger standard.** Reasonable anticipation of litigation, regulatory investigation,
or a preservation obligation (subpoena, civil investigative demand, law-enforcement
preservation request). The trigger memo states the facts giving rise to anticipation —
"just in case" holds without a stated trigger are prohibited.

**3. Scope — narrow by default.** The hold notice names: the custodians/systems, the
data classes and date ranges, and the matter. **Only in-scope purges suspend;
out-of-scope purges continue on schedule.** A hold is never "preserve everything."

**4. Time bounds.** Every hold carries an **expiration date** (initial max: 1 year;
[ATTORNEY: confirm]). Renewal requires a fresh counsel-signed memo stating the
continuing basis — **never "until further notice."** The hold register is reviewed at
each renewal; expired holds auto-release (system-enforced).

**5. Implementation.** On placement: (a) affected purge jobs are suspended for in-scope
data (job-level scoping, logged); (b) backup-purge propagation pauses for in-scope data;
(c) affected users with pending deletion requests are notified in plain language:
*"We received a legal request that requires us to keep [data type] for now. Your
deletion request is paused — not cancelled — and will complete when the legal hold
ends. [Date of expected review]."* (Teen-deletion-rights conflict, see §7.)

**6. Release mechanics.** On release: (a) counsel signs the release memo; (b) suspended
purges resume at the next scheduled cadence; (c) paused deletion requests complete
within the normal SLA from release; (d) the hold register records release date and
basis. No data retained *solely* under a released hold may be kept — it re-enters the
normal schedule.

**7. Conflict rules.**
- **Hold vs. COPPA §312.10 (no indefinite retention):** a hold does not waive §312.10.
  Because every hold is time-bounded with mandatory renewal, a hold can never become
  the prohibited indefinite retention by another name. If a hold would exceed the
  schedule's maximum for under-13 data, counsel must make a specific written finding
  that the litigation need outweighs the §312.10 interest, with a fixed end date.
- **Hold vs. teen deletion rights:** the teen's deletion right is *paused with notice*,
  not extinguished. The notice (§5(c)) must be honest about what is kept, why, and
  until when. Safety-comms and break-glass records follow the safety-record retention
  (row 11), not the hold.
- **Hold vs. MHMDA consent-bounded retention:** health data held past the
  consent-bounded window requires counsel's written determination that the hold is a
  lawful basis distinct from consent; the determination is logged and time-bounded.
- **Hold vs. legal-process gag orders:** if a gag order prohibits user notification,
  notification is deferred per Gate 006 rules (≤14-day LE deferral, then automatic) —
  the hold's existence is not disclosed, but the *pause of a deletion request* still
  requires the §5(c) notice unless counsel determines the notice itself would violate
  the gag (documented).

**8. Hold register.** Append-only: hold ID, matter, trigger memo, scope, placed-by,
countersigned-by, expiration, renewals, release. Access-restricted (Compliance Owner +
counsel). Retained 7 years after release (litigation-record row — add in schedule v0.2).

### Blocked modules + dependency chain — Gate 005
| Blocked | Dependency chain |
|---|---|
| **Any module persisting real user data** (release-review rule V-RET-001) | Every data source needs a bounded schedule row + hold integration; without the hold procedure, purge jobs cannot lawfully distinguish hold-scoped data. Practically: W2/W22/W23 health syncs, W1 school snapshots, W21 mail intake, Pookie/S2 AI transcripts, W8 check-ins. |
| Teen/user deletion-request flows | Deletion SLAs (§11 of ToS; retention schedule) depend on hold-pause mechanics. |
| Compliance Owner tooling | The hold register and purge-job suspension are Compliance Owner surfaces; the role must exist first. |

---

## GATE NFR-LEGAL-006 — Law-Enforcement / Subpoena Response · 🟡 IN PROGRESS (🔴 for live-request handling)

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🟡 for the operational policy draft below. 🔴 for live-request handling:
until a named counsel contact is engaged and the policy is attorney-signed, every live
request is escalated to outside counsel ad hoc and NO staff takes action on any
request.** Break-glass disclosure tooling, any LE portal, and any approval UI must NOT
be built before counsel signs off (FR-SAFETY-015).

### Operational policy (draft from Outline 3)

**1. Intake — single channel.** All law-enforcement/legal-process contacts go to one
named intake role (**to be designated; backup named**) via a dedicated,
non-public intake address/number. Intake logs on receipt: date/time, requesting agency,
agent name/badge/credentials claimed, contact details provided, instrument type
(emergency request / subpoena / court order / warrant / preservation request /
informal-voluntary). **Triage categories** are assigned at intake; informal/voluntary
requests are flagged for counsel-only handling.

**2. Verification — trust nothing inbound.**
- **Requester:** call back via an **independently sourced, published agency number**
  (never the number on the request). Verify badge/credentials with the agency.
- **Instrument:** valid on its face — issuing court, scope, signature/seal, dates.
  **Attorney confirms validity** before any production. Overbroad instruments are
  narrowed via counsel (motion to quash/limit where appropriate).
- **Voluntary/informal requests are NEVER fulfilled without counsel approval.** No
  exceptions, no "cooperative" disclosures.

**3. Scope limitation.** Produce **only what the valid instrument compels**: the correct
child, the correct date range, the correct data classes. Never "the whole account" on a
narrow order. **D7 architectural note:** location production is coarse-only
(city/ZIP) — precise location does not exist to produce. Log exactly what was produced
(data classes, ranges, record counts).

**4. Teen/parent notification.**
- Default: notify the affected account holder(s) **unless** a valid non-disclosure
  order prohibits it — attorney verifies the gag's validity and scope.
- For teen data: notify **the teen (the access authority)** first, then the parent
  where appropriate — sequenced with a welfare lens (see Gate 004 matrix).
- Break-glass Path B: teen notified via **silent in-app card on next login** (never
  push/SMS/email — lock-screen safety). LE-requested deferral: **≤14 days maximum**,
  then notification is automatic and cannot be re-deferred without a fresh valid order.

**5. Documentation.** Per-request file: instrument copy, verification notes, counsel
communications, scope decision, production log, notification/deferral log.
Access-restricted; retained per schedule (break-glass packages 7 years per
FR-SAFETY-015). Annual tabletop exercise with counsel.

**6. Emergency-disclosure carve-out — SCA §2702(b)(8).**
- Legal spine: provider may divulge contents where there is a **good-faith belief of
  an emergency involving danger of death or serious physical injury requiring
  disclosure without delay** (FR-SAFETY-014).
- Verification under time pressure: callback to an independently sourced agency number
  + written official-channel confirmation within 24h + **two-employee approval**
  (the approvers may not be the intake person alone). Time pressure never lowers the bar.
- **Scope is fixed by policy, never requester-defined:** coarse location (D7) +
  W19 emergency medical card only. **72-hour incident-bounded cap**, renewable only on
  fresh attestation; terminates on case closure.
- **Do NOT build disclosure tooling, an LE portal, or approval UI before counsel
  signs off** (NFR-LEGAL-006; FR-SAFETY-015).

### Named counsel contact (🔴 live-ops blocker)
Mehedi must engage a **named attorney (or firm) as the live-request contact** before any
law-enforcement-facing feature ships. The contact's name, firm, phone, and escalation
SLA must be written into this policy's §1. **Until then: no staff action on any live
request — escalate to outside counsel ad hoc.**

### Blocked modules + dependency chain — Gate 006
| Blocked | Dependency chain |
|---|---|
| W19 Emergency — break-glass disclosure tooling | Path B tooling, approval UI, and any LE-facing surface require the signed policy + named counsel. The W19 planning/storage surface (non-disclosure) is not blocked. |
| FR-SAFETY-014/015 (emergency disclosure + 72h packages) | Legal spine is this policy; engineering against an unsigned policy risks building the wrong verification flow. |
| Teen notification machinery for legal process | Silent in-app card + 14-day deferral logic are policy inputs. |
| Any "export for authorities" feature | No such feature ships without the scope-limitation and documentation rules. |

---

## GATE NFR-LEGAL-008 — Court-Order Ingestion Workflow · 🟡 IN PROGRESS

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Clearance: 🟡 — operational workflow drafted below. Requires a Georgia family-law
attorney to approve the verification standard, override rules, and notification copy
BEFORE the ingestion queue accepts its first order. Until then: the queue stays closed;
orders received ad hoc go straight to outside counsel; no matrix changes from orders.**

### Operational workflow (draft from Outline 4; D5 STAY-OUT posture)

**0. Posture.** Pookie does **not** adjudicate custody (D5 STAY-OUT). The workflow
ingests *verified presented orders* and applies their stated access terms — it does not
decide who "should" have custody. Disputes between parents go to human review
case-by-case; the 14-day human-review process must be operational before the v2 claim
path ships.

**1. Intake.** Dedicated upload queue (closed until this gate clears). Accepted from:
parent/guardian account holder, the teen, an attorney of record, or a GAL. Intake
captures: the order document, issuing court, case number, parties, date, and the
specific access change claimed. Intake SLA: **acknowledged within 1 business day.**

**2. Who verifies (human only).** Named reviewer role (Compliance Owner or designee) +
backup. **Counsel reviews every order before any matrix change.** No engineer, support
agent, or automated rule applies an order — **no auto-enforcement.**

**3. Verification steps** (each documented in a verification memo):
1. **Authenticity:** court seal/signature; docket verification via public records or
   counsel; reject photocopies-of-photocopies without corroboration.
2. **Scope:** exactly what access the order grants/restricts, for which child, for what
   period. Distinguish custody vs. visitation vs. protective/restraining orders — a
   protective order may *restrict* rather than grant access.
3. **Currency:** still in effect? superseded by a later order? expired by its own terms?
4. **Conflict check:** another order on file covering the same child? Escalate to
   counsel; the newest-valid-order rule is set by the attorney, not by intake staff.

**4. Matrix adjustments — additive flags, never edits.** Only the verified scope adjusts
the access matrix: e.g., court-ordered parent access restored despite a teen revoke, or
a court-ordered restriction enforced despite a grant. Adjustments are **additive
`court_order_restriction` / `court_order_grant` flags layered on the matrix — the
teen's underlying grants remain intact and visible as superseded-by-order** (preserves
audit integrity and the child-as-access-authority record). **Safety-comms carve-out
(FR-SAFETY-003) is never overridden by an access order** — attorney confirms this
boundary in writing.

**5. Teen notification (exact draft copy for counsel + DV-advocate review):**
> "A court order requires us to share [specific scope, e.g. 'your school grades'] with
> [parent name]. This wasn't your choice or ours — the court decided. If you have
> questions, you can ask our compliance team anytime; we won't share your questions
> with [parent]."
Timing: at effect; delayed only if the order itself restricts notification (attorney
verifies the restriction). 🟣 DV-advocate review: the notice must be honest without
creating a new danger vector (see Gate 004, Scenario E).

**6. Documentation.** Order file (restricted access), verification memo, counsel
sign-off, matrix change record, notification record — retained per the retention
schedule (litigation-record row).

**7. SLA.** Intake acknowledged ≤1 business day; verification + counsel review ≤5
business days (attorney sets final); emergency protective orders triaged same-day.

### Blocked modules + dependency chain — Gate 008
| Blocked | Dependency chain |
|---|---|
| D5 second-parent claim dispute resolution (FR-AUTH-011) | Disputed claims that invoke court orders need the ingestion workflow; until then, disputes go to outside counsel ad hoc. |
| W14 Co-parenting — custody-adjacent features | Any feature that changes access on the basis of a presented order. |
| `court_order_restriction` flag activation | The flag exists in the schema but must not be set by any path until the workflow is live. |
| V2 claim path (14-day human review) | The review process in §0 must be operational before v2 ships. |

---

## WHAT MUST NOT SHIP AS DESIGNED (cross-gate)

1. **The working ToS above must not be published or launched with real users** — it is
   a scaffold. Launching on it risks unenforceable arbitration, voidable minor
   assent, and FBPA exposure on Privacy Policy promises. 🔴
2. **No human reads check-in content** (support, QA, labeling, vendor) before the Gate
   002 designation memo is signed. Teen-facing calibration only until then. 🔴
3. **No LE disclosure tooling, LE portal, or approval UI** before Gate 006 counsel
   sign-off + named counsel engagement. 🔴
4. **The court-order ingestion queue stays closed** before Gate 008; no matrix changes
   from presented orders until then. 🔴
5. **The 18+ FERPA flow is not built** before Gate 003 counsel sign-off. 🟡
6. **The Privacy Policy is not published** until D2's DPA verification (zero-retention-
   for-training clauses with Cloudflare/Meta) is complete — publishing the "never
   train" promise first is deceptive-trade-practice risk. 🔴
7. **No <18 purchase/booking/contract flow** may be completable (W30/W31 hard-gated
   18+, server-side) — FR-TRAVEL-001 is a design invariant, not a policy preference.
8. **Upload surfaces (W1 class files, W21 mail intake) must not ship without** the
   TAKE IT DOWN ≤48-hour removal workflow operational.
9. **The teen revoke UX must not ship** before the Gate 004 DV-advocate review of the
   notification strings — notification timing is a safety decision, not a UX choice.

---

## OPEN QUESTIONS FOR MEHEDI

1. **Named counsel contact (Gate 006, 🔴 live-ops blocker):** engage a Georgia attorney/
   firm as the standing live-request contact now, or defer until pre-launch? Deferral
   means every live LE request goes to ad-hoc outside counsel at emergency rates.
2. **Attorney engagement scope and budget:** Gates 001 (full ToS drafting), 002 (GA
   child-welfare designation memo + training approval), 003/006/008 (sign-offs), 004
   (matrix legal review) — one firm or several specialists? The Managing Director owns
   the engagement; no gate has begun.
3. **DV-advocate engagement (Gate 004):** commission a survivor-safety expert to review
   all 🟣 notification strings. This is a separate engagement from legal counsel —
   approve it.
4. **Compliance Owner appointment (Gate 005, Phase-0 blocker):** the hold procedure,
   retention schedule, and vendor-assurance prong all need an owner. Appoint now.
5. **Mandatory-reporter posture (Gate 002):** Track A (designate + train, recommended
   default) vs. Track B (architect away from the duty). Counsel writes the designation
   memo; you make the final call on counsel's advice. Note the cost and hiring-filter
   implications of Track A.
6. **HB 1409 (GA, eff. 2027-07-01):** 24-hour DFCS report clock — confirm with counsel
   that the enrolled text matches session reporting, and adopt the 24-hour SLA now
   rather than retrofit.
7. **Arbitration business decisions for counsel to encode:** opt-out window length,
   arbitral forum/rules, fee allocation, mass-arbitration posture — flag any
   preferences before counsel drafts §9.
8. **Privacy Policy timing vs. D2:** the "never train on your data" promise cannot be
   published until Cloudflare/Meta DPA terms are verified — prioritize the DPA review
   on the privacy track.

---

*End of Attorney 3 deliverable. All seven gate drafts carry the required header. No
documents were deployed; docs only.*
