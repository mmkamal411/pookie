# Attorney-1 (Children's Privacy / COPPA-Teen Privacy) — Gate Deliverables

**REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Role:** Expert consultant (children's privacy attorney persona) supporting NFR-LEGAL-007
(COPPA 2025 compliance package) and NFR-LEGAL-010 (FTC Health Breach Notification Rule
determination), plus teen-privacy review of FR-AGE-005/006/007.

**Date:** 2026-10-12 · **Founder authorization:** Mehedi Kamal.

**Scope of this document.** This is *issue-spotting and legal drafting assistance*, not
legal advice and not an attorney-client relationship. Every clearance mark below reflects
what careful drafting can advance versus what requires a barred attorney's judgment.
Citations are to the controlling authorities; counsel must confirm all interpretations.

**Authorities relied on:** COPPA, 15 U.S.C. §§ 6501–6506, as amended by the FTC's 2025
COPPA Rule (final rule published April 2025; full compliance required as of April 22,
2026 — enforceable now); FTC Health Breach Notification Rule, 16 CFR Part 318, as
revised 2024 (effective 2024); GA Fair Business Practices Act (O.C.G.A. § 10-1-393(a));
GA Personal Identity Protection Act / GIPA breach statute (O.C.G.A. § 10-1-912);
WA My Health My Data Act (MHMDA); TX SCOPE Act; 42 CFR Part 2; TAKE IT DOWN Act;
GA minor health-consent statutes.

**Documents reviewed:** `LEGAL-GATES-TRACKER.md`, `COPPA-RETENTION-SCHEDULE.md` (v0.1),
`COPPA-INFOSEC-PROGRAM.md` (v0.1), `VENDOR-ASSESSMENT-TEMPLATE.md` (v0.1),
`MHMDA-COMPLIANCE-MAPPING.md` (v0.1), `MASTER-BUILD-CHECKLIST.md` §D,
`MD-DECISIONS.md` (D1–D7), `BUILD-SPECIFICATION.md` (FR-AGE-005/006/007,
FR-HEALTH-001/007, NFR-COMPLIANCE-004).

---

## TABLE OF CONTENTS

- [Part A — Gate NFR-LEGAL-007: COPPA 2025 Compliance Package](#part-a--gate-nfr-legal-007-coppa-2025-compliance-package)
  - [A1. Written retention policy (finalized draft, v1.0)](#a1-written-retention-policy-finalized-draft-v10)
  - [A2. Written information security program (finalized draft, v1.0)](#a2-written-information-security-program-finalized-draft-v10)
  - [A3. Vendor assurances — DPA requirements draft](#a3-vendor-assurances--dpa-requirements-draft)
  - [A4. Gate 7 status summary + module impact](#a4-gate-7-status-summary--module-impact)
- [Part B — Gate NFR-LEGAL-010: FTC Health Breach Notification Rule determination memo](#part-b--gate-nfr-legal-010-ftc-health-breach-notification-rule-determination-memo)
- [Part C — Teen-privacy review (FR-AGE-005/006/007)](#part-c--teen-privacy-review-fr-age-005006007)
- [Part D — Must NOT ship as designed](#part-d--must-not-ship-as-designed)
- [Part E — Open questions for Mehedi](#part-e--open-questions-for-mehedi)

---

# PART A — GATE NFR-LEGAL-007: COPPA 2025 COMPLIANCE PACKAGE

The 2025 COPPA Rule expressly requires operators to (i) establish, implement, and
maintain a **written data-retention policy** specifying the purposes for collection and
the timeframes for deletion (16 CFR § 312.10), (ii) establish, implement, and maintain a
**written information security program** appropriate to the sensitivity of children's
data (16 CFR § 312.8), and (iii) exercise reasonable oversight of service providers and
third parties with access to children's data. All three prongs were on the delayed
compliance date of **April 22, 2026** — they are enforceable today.

---

## A1. Written retention policy (finalized draft, v1.0)

### A1.1 Confirmation: the v0.1 draft is publishable in structure, with adjustments

The `COPPA-RETENTION-SCHEDULE.md` v0.1 draft is unusually well-constructed for an
issue-spotting draft: every source carries a bounded maximum, purposes are named, no
row is indefinite/TBD/blank (the § 312.10 non-negotiable), under-13 rows carry the
shortest windows, and the backup-purge ≤30-day rule closes the most common COPPA
enforcement loophole (deletion from the app but not from backups). I confirm the
**architecture** of the schedule. I adjust or flag specific rows below.

### A1.2 Per-row confirmation and adjustments

| Row | Window (max) | Verdict | Reasoning / required change |
|---|---|---|---|
| 1 — DOB, rejected <13 self-signup (purge ≤30d) | 🟢 confirmed | Bounded; stated purpose (rejection + fraud-pattern analysis) is legitimate. Counsel to confirm the secondary-use framing under §312.10's purpose limitation in final review. |
| 1 — DOB, 13–17 / 18+ (while active; purge ≤30d of deletion) | 🟢 confirmed | DOB is reasonably necessary for age-tier enforcement — the core COPPA compliance function. |
| 2 — Child profiles, <13 parent-managed (while profile exists; purge ≤30d) | 🟡 adjusted — **add COPPA § 312.6 parental-rights mechanics** | The window is defensible. But COPPA's retention rule is not the only obligation: the parent is entitled to (a) direct notice, (b) review of the child's data, (c) direct the operator to delete it, and (d) refuse further use/collection while permitting continued use of the service. **The schedule must reference the parental-rights procedure (build it: review/delete/refuse-further-use controls in the parent dashboard).** Mehedi decision on UX; counsel confirms sufficiency. |
| 2 — Teen profiles 13–17 | 🟢 confirmed | |
| 3 — Link codes (15-min TTL; purge ≤24h) | 🟢 confirmed | Exemplary minimization. |
| 4 — Check-ins <13: not collected; inadvertent → quarantine, purge ≤7d | 🟢 confirmed | Aligns with UNDER13-TECHNICAL-BAN-CHECKLIST. |
| 4 — Check-ins 13–17: teen-deletable; default 90d rolling; bounded max 1 yr | 🟢 confirmed | Teen-settable window with a hard ceiling is the right shape. |
| 4 — Check-ins 18+ | 🟢 confirmed | |
| 5 — AI tutor: transient default; saved ≤1 yr (13–17) / ≤2 yr (18+); debug ≤30d | 🟡 adjusted — **add human-review condition** | Windows confirmed. **Add:** debug logs (which may contain teen-authored content) are not subject to human review before Gate 2 (mandatory-reporter program) clears, and support agents may not read AI-tutor debug content under FR-SUPPORT-005's scoping. This closes a cross-gate hole. |
| 6 — S2 support transcripts (≤30d; on escalation inherits ticket) | 🟢 confirmed | Inheritance rule is correct — prevents a deletion loophole. |
| 7 — Health <13: not collected; inadvertent → quarantine ≤7d | 🟢 confirmed | |
| 7 — Health 13–17: rolling ≤2 yrs; 18+ re-consent per FR-AGE-006 | 🟡 counsel confirms MHMDA interplay | 2-year rolling is defensible as a maximum, but under MHMDA retention must be consent-bounded (the mapping doc flags this). **Do not publish this row until counsel confirms the MHMDA consent-bounding language.** See Part B for the HBR overlay. |
| 7 — Health 18+ (opt-in; rolling ≤2 yrs) | 🟢 confirmed | Affirmative opt-in is the correct legal basis. |
| 8 — School syncs: 13–17 "school year + 1", purge ≤90d; 18+ unclaimed ≤1 yr | 🟢 confirmed | Bounded, purpose-tied. FERPA-transfer pause mechanics correctly referenced. |
| 9 — Financial raw images (auto-delete ≤30d post-extraction) | 🟢 confirmed | Good minimization; FTC Disposal Rule alignment flagged for counsel confirm. |
| 9 — Financial metadata 18+: ≤7 yrs or user deletion | 🟢 confirmed | Bounded; tax-record purpose is legitimate. Note: if the user deletes at year 3, the tax purpose does not override a deletion right absent a legal obligation to retain — counsel to confirm the hold wording. |
| 10 — Location coarse-only: <18 no history, purge ≤24h; 18+ ≤90d | 🟢 confirmed | D7 makes this easy. **Add:** the policy must prohibit any vendor/SDK from reintroducing precise location (flow-down in §A3). |
| 11 — `access_events` audit log: hot ≤1 yr, cold +2 yrs, purge ≤3 yrs total | 🔴 counsel must confirm | This is the highest-risk window in the schedule. Retaining *any* data class adjacent to under-13 children for 3 years must be justified as "reasonably necessary" under § 312.10. The security/legal-defense basis is arguable but it is a legal conclusion, not a drafting one. **Do not publish this row until a barred attorney signs the justification.** Structural note is fine (metadata-only, no content PI — keep that). |
| 12 — Support tickets: closed ≤2 yrs; crisis ≤1 yr; deletion SLA ≤30d | 🟡 adjusted | Windows defensible, but: (a) **crisis tickets may implicate mandatory-reporter recordkeeping** — counsel must confirm whether GA DFCS reporting obligations require retaining referral records longer than 1 year, and if so, for which fields (metadata vs. content); (b) the teen deletion right (§1.6.3 SLA ≤30d) is correctly stated. Mehedi decision: crisis-ticket retention posture once counsel advises. |
| 13 — Notification payloads (≤30d; metadata ≤90d) | 🟢 confirmed | |
| 14 — Peer tips (4-wk active; purge ≤7d after deactivation) | 🟢 confirmed | |
| 15 — Uploaded class files; TAKE IT DOWN ≤48h | 🟢 confirmed | 48-hour removal path correctly stated. |
| **NEW row 16 — Break-glass disclosure packages: 7 yrs** | 🟡 add row | `COPPA-INFOSEC-PROGRAM.md` §5 cites FR-SAFETY-015 (7-year retention of break-glass disclosure packages) but the schedule has no row for it. **Add row 16** with the 7-year window, litigation-hold mechanics, and the spoliation guard — a schedule missing a real data class fails V-RET-001. |
| **NEW row 17 — Workforce/training records** | 🟡 add row | The infosec program's open question #1 asks for this. Training completion logs are workforce data, not child data, but the schedule should still bound them (proposed: duration of employment + 3 yrs; counsel confirms). |

### A1.3 Cross-cutting adjustments (apply to the policy as a whole)

1. **Deletion flow-down SLA.** Every row's "purge ≤30 days" must be mirrored in vendor
   DPAs (§A3): the vendor must certify source deletion ≤30 days and backup purge ≤30
   days. Without the contract term, the schedule's promise is unenforceable against the
   party actually holding the bytes. (FBPA risk: the Privacy Policy will reference this
   schedule — a promise Pookie cannot enforce on Supabase is a deceptive-practice
   exposure under O.C.G.A. § 10-1-393(a).)
2. **Litigation-hold interaction.** The hard constraint in §5 ("a hold that is itself
   unbounded *is* the prohibited indefinite retention") is correct and should stay
   verbatim in the published policy — it is the strongest § 312.10 evidence in the
   draft. Counsel sets the re-authorization cadence.
3. **§ 312.6 parental rights.** Add a policy section (not just a schedule row) stating
   the parent's rights to notice, review, deletion, and refusal of further use for
   under-13 profile data, and where in the product each right is exercised. This is a
   freestanding COPPA obligation the v0.1 draft omits.
4. **Annual attestation (V-RET-003).** Keep. The Compliance Owner role must be filled
   before the first attestation means anything — see §A2.

**Prong verdict: 🟡 needs Mehedi decision + 🔴 needs barred attorney.**
Drafting is advanced as far as it can go: the schedule is structurally publishable with
the adjustments above. Mehedi must (a) appoint the Compliance Owner, (b) decide the
crisis-ticket posture and parental-rights UX, (c) approve adding rows 16–17. A barred
attorney must confirm rows 7 (MHMDA), 11 (audit log), 12 (crisis/mandatory-reporter),
the backup-purge standard, and the § 312.6 procedure before publication.

---

## A2. Written information security program (finalized draft, v1.0)

### A2.1 Confirmation: structure is sound; safeguards are adequate *as designed*

I confirm the program's architecture (administrative / technical / physical /
incident-response / testing / annual review) maps correctly to what § 312.8 requires:
a written program, appropriate to the sensitivity of the data, with a designated
coordinator, risk assessment, safeguards, service-provider oversight, and evaluation.
Per-data-class adequacy assessment:

| Data class | Safeguards named | Adequacy verdict |
|---|---|---|
| Under-13 profile data (parent-managed) | RLS, least privilege, restricted access lists, purge verification, no sessions/tokens, export controls | 🟢 adequate as designed — *provided the technical bans are actually enforced* (UNDER13-TECHNICAL-BAN-CHECKLIST is the evidence artifact; the program correctly assigns verification to the Security Engineer) |
| Teen check-ins / mood text | Teen-scoped RLS, never-log-plaintext, DLP on AI/support pipelines, support RBAC with in-thread consent | 🟢 adequate as designed; add the §A1 human-review condition for debug logs |
| Health H0–H3 (13+) | Field-level treatment: crypto-shredding for H3 at deletion, export controls, teen-private scoping, per-subcategory consent gates | 🟢 adequate as designed, with two caveats: (1) **HBR "secured" status** — data must be encrypted to a standard the FTC recognizes as rendering it "unsecured"-negative (see Part B); confirm the at-rest + in-transit + field-level vault design meets that bar; (2) **H3 access surface** — every human and vendor path to H3 must be inventoried in the vendor assessments |
| Education records (grades, mail) | RLS, access-events audit, snapshot lifecycle | 🟢 adequate as designed |
| Credentials vault | Envelope encryption, per-credential data keys, KMS-held master, app never holds master in code/config | 🟢 adequate as designed — this is the correct pattern; counsel confirms the adequacy judgment |
| Financial images (GIPA data) | Auto-delete ≤30d, secure electronic deletion, never persist full account numbers | 🟢 adequate as designed |
| Support transcripts | RBAC, teen-privacy flag, ≤30d transient default | 🟢 adequate as designed, pending Gate 2 for human review of teen content |
| Audit logs | Append-only, access-reviewed | 🟢 adequate; retention window is the open legal question (row 11), not a safeguard question |

### A2.2 Required adjustments before the program is publishable

1. **Appoint the Information Security Program Owner (Compliance Owner).** A written
   program with no designated implementer is weak compliance evidence and, under
   § 312.8's "designate an employee" logic, arguably not a program at all. This is a
   **Phase-0 blocker** the Managing Director already owns. → 🟡 Mehedi decision
   (appointment), immediately.
2. **Add the contracted crisis-review vendor (D1) to §2.2.** Break-glass Path A gives a
   third party coarse location + W19 medical card on a 24/7 basis. That vendor needs
   a row in the workforce/vendor table *and* a completed assessment + DPA before it
   touches data — it is currently absent from `VENDOR-ASSESSMENT-TEMPLATE.md` §3.
   Scope: minimum-necessary, no secondary use, deletion on contract end, breach SLA.
   → 🟡 Mehedi decision (vendor selection/contracting); 🔴 counsel (DPA).
3. **Create `docs/compliance/RISK-REGISTER-INFOSEC.md`.** The program references a
   register that does not exist; a risk assessment with no register is not auditable.
   → 🟡 (operational; Compliance Owner creates).
4. **Add rows 16–17 linkage** (break-glass 7-year retention; workforce records) so the
   program and the schedule agree on what exists. → 🟡 (drafting; done in this memo).
5. **Confirm the adequacy judgment with counsel.** Whether these safeguards are
   "reasonable and appropriate" for children's health and education data is ultimately
   a legal conclusion (FTC § 312.8; GA FBPA). → 🔴 barred attorney sign-off per the
   program's own §8 gate.

**Prong verdict: 🟡 needs Mehedi decision + 🔴 needs barred attorney.**
The program is draft-complete. It becomes a real program when (a) an owner is
appointed, (b) the risk register exists, (c) the crisis vendor is assessed, and
(d) counsel signs the adequacy judgment. Nothing in the safeguard set is
under-designed for the data classes; the gaps are ownership, evidence, and legal
sign-off — not architecture.

---

## A3. Vendor assurances — DPA requirements draft

### A3.1 Minimum mandatory terms for EVERY vendor DPA / data-processing addendum

Counsel drafts or reviews each executed agreement, but the requirements below are the
non-negotiable floor the Compliance Owner enforces before any vendor goes live:

1. **No sale; no sharing for advertising or cross-context behavioral purposes; no
   secondary use** beyond the contracted processing purpose. (COPPA, MHMDA D3 posture.)
2. **No training on Pookie inputs — broad "train" definition** (D2 /
   NFR-PRIVACY-010): training, fine-tuning, RLHF, human-feedback loops, eval
   datasets, embedding stores, or any model-improvement use of prompts, responses,
   uploads, or derived data. Zero-retention-for-training. **Flow-down required** to
   subprocessors and model providers. This term is what allows the D2 "NEVER train"
   commitment to be published at all.
3. **Deletion on request and on termination:** certified deletion of all Pookie data
   (including derived data and logs containing it) within **≤30 days** of request or
   contract end; backup/media purge within **≤30 days** after source deletion; written
   certification of destruction. Mirrors the retention schedule (§A1, item 1).
4. **Breach-notification SLA:** vendor notifies Pookie **≤72 hours** of discovering a
   suspected breach (attorney confirms the final figure; must be tighter than the
   downstream statutory clocks in Part B). Vendor cooperates with forensic scoping.
5. **Audit and evidence rights:** annual SOC 2 Type II (or equivalent) evidence;
   right to security questionnaire; right to audit on material change or suspected
   incident; pen-test summary on request.
6. **Subprocessor change notice:** **≥30 days advance written notice** before any new
   subprocessor — and specifically any new AI/model subprocessor — touches Pookie
   data; right to object and terminate. (NFR-PRIVACY-010.)
7. **Data-residency and processing-region documentation** (named regions; notice of
   change).
8. **Confidentiality of minor/child data:** vendor personnel access on
   least-privilege, logged basis; no access to check-in content, mood text, or AI-chat
   transcripts without Pookie's written authorization per incident.
9. **Location prohibition flow-down:** vendor/SDK components must not collect precise
   geolocation (D7 architectural constraint survives the vendor boundary).
10. **Regulatory cooperation:** vendor preserves and produces records as required for
    Pookie's legal obligations (litigation holds, TAKE IT DOWN preservation orders);
    vendor does not notify data subjects directly except as Pookie directs.

### A3.2 Prioritized vendor execution order

| Priority | Vendor | Why this order | Status |
|---|---|---|---|
| P0 | **Supabase** | Holds *all* app data: auth identities, under-13 profiles, health H1–H3, credentials vault, education records, audit logs. The single highest-blast-radius vendor. | 🔴 No DPA executed (V-1). Execute Supabase DPA + confirm backup/PITR alignment with ≤30-day purge (V-5) + collect SOC 2 evidence (V-6) + agree breach SLA (V-3) + deletion-on-termination (V-4). |
| P0 | **Cloudflare (Pages + Workers + Workers AI)** | Serves the app; **pookie-tutor prompts/responses flow through Workers AI** — the D2 commitment lives or dies here. Requires explicit zero-retention-for-training + no-secondary-use + subprocessor flow-down + AI-specific terms. **Do not publish "NEVER train" until this is contractual.** | 🔴 No DPA executed (V-1, V-2). |
| P0 | **Model layer (Meta Llama 3.3 70B via Workers AI)** | Tracked separately because the no-training commitment attaches to the model provider, not just the infrastructure. Confirm binding never-train terms and documented processing regions. | 🔴 Terms unverified (V-2). |
| P1 | **Crisis-review vendor (D1, contracted)** | Will receive break-glass disclosures (coarse location + W19 medical card) on a 24/7 basis. Not yet in the vendor inventory — add §3.x row and assess before contracting. | 🔴 Not assessed; DPA required before any disclosure. |
| P1 | **Google (OAuth)** | Identity only, inbound direction; lower risk. Verify OAuth data-use terms (no secondary use of profile data). | 🟡 Verify terms (V-7). |
| P2 | **OCR / document-AI vendor (TBD)** | Future W21 images are GIPA personal information. No image may flow to any OCR vendor before assessment + DPA (extract-then-mask, no vendor retention beyond processing). | 🟡 Assess at selection (V-8). Blocks W21. |
| P2 | **Email/push provider (TBD)** | Notification payloads; health-content push prohibited by design. Assess before go-live. | 🟡 Assess at selection (V-9). |

### A3.3 Vendor-assurance prong verdict

**🔴 needs barred attorney.** The requirements are drafted and the prioritization is
set, but **no DPA has been executed with any vendor (gap V-1)** — the assurance prong
is entirely open. Counsel must draft/review each executed DPA; the Compliance Owner
(Mehdi decision: appoint) drives execution. Mehedi decision needed: authorize immediate
DPA execution with Supabase and Cloudflare (P0), and confirm the "NEVER train" promise
stays unpublished until the P0 AI terms are contractual (D2 gate — already decided,
restated here as a hard dependency).

---

## A4. Gate 7 status summary + module impact

### Status

| Prong | Deliverable | Status |
|---|---|---|
| Written retention policy | Finalized draft v1.0 (§A1; deltas to `COPPA-RETENTION-SCHEDULE.md`) | 🟡 Mehedi decisions (owner, crisis posture, parental-rights UX, rows 16–17) → 🔴 attorney confirms rows 7/11/12, backup standard, §312.6 procedure |
| Written infosec program | Finalized draft v1.0 (§A2; deltas to `COPPA-INFOSEC-PROGRAM.md`) | 🟡 Mehedi decisions (appoint owner, risk register, crisis vendor) → 🔴 attorney adequacy sign-off |
| Vendor assurances | DPA requirements drafted (§A3); execution prioritized | 🔴 attorney (draft/review each DPA); V-1 fully open |

**Gate NFR-LEGAL-007 overall: 🔴 blocked.** Drafting is complete to the limit of what
non-counsel drafting can do. The gate clears when: (1) Compliance Owner appointed,
(2) adjustments in §§A1–A2 adopted, (3) P0 DPAs executed with counsel review,
(4) barred attorney signs the retention policy, infosec program, and vendor terms.

### Blocked modules + dependency chain

Gate 7 blocks **all real-data persistence** — not just child/health modules:

- **W2 Health, W8 Wellbeing, W22 Activity, W23 Nutrition, W13** (health data): blocked
  on all three prongs (retention windows for health rows; infosec safeguards for H0–H3;
  vendor DPAs covering health data at rest/inference). Chain:
  `FR-HEALTH-001 taxonomy → Gate 7 → Gate 10 (HBR obligations built) → real health data`.
- **W1 check-in text / mood** (teen-authored content): blocked on retention row 4 +
  infosec human-review condition + Gate 2 (mandatory reporter) for any human read.
- **S2 AI support chat / S3 tickets** (transcripts): blocked on rows 6/12 + support
  RBAC + Gate 2.
- **Family onboarding / child profiles** (<13 and 13–17): blocked on row 2 +
  § 312.6 parental-rights procedure + under-13 technical bans verified.
- **W21 financial photo intake**: blocked on row 9 + OCR vendor DPA (P2).
- **W12 / W6 / time-boxed grants** (access events): blocked on row 11's legal
  confirmation (the audit log is the enforcement evidence for grant disputes).
- **Notifications (all modules)**: blocked on row 13 + provider DPA (P2).

Sequencing (per `LEGAL-GATES-TRACKER.md`): **Gate 1 (ToS) first** — it underwrites the
privacy policy that references the retention schedule; then Gate 7's three prongs and
Gate 5 (retention/litigation hold) run in parallel; Gate 7 + Gate 10 jointly gate any
health module holding real data.

---

# PART B — GATE NFR-LEGAL-010: FTC HEALTH BREACH NOTIFICATION RULE DETERMINATION MEMO

**REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

## B1. Question presented

Is Pookie a "vendor of personal health records" (or PHR-related entity) under the FTC's
Health Breach Notification Rule, 16 CFR Part 318 (2024 revision), such that the Rule's
breach-notification obligations attach **before the health modules hold real data**?

## B2. Short answer

**Yes — Pookie is most reasonably classified as a PHR vendor for users 13+ once W2
(and the health-adjacent modules W8/W22/W23/W13) hold real data.** The determination
should be treated as *applicable* for build planning; counsel gives the formal opinion.
The under-13 tier is out of scope only because Pookie collects no health data for
<13 by design (FR-HEALTH-001: H0 prohibited <18) — if that design ever changes, the
analysis changes. **Do not hold real health data in any module until the §B5 build
checklist is complete.**

## B3. Applicable law

- **Who is covered (16 CFR § 318.2):** (a) *vendors of personal health records* —
  businesses that "offer or maintain a personal health record"; (b) *PHR related
  entities* — entities that offer products/services through a vendor's PHR and access
  or send unsecured PHR-identifiable health information to it; (c) *third-party service
  providers* to vendors/related entities. **HIPAA-covered entities are excluded**;
  Pookie is not a HIPAA covered entity (no covered functions), so the exclusion does
  not apply.
- **"Personal health record" (§ 318.2):** "an electronic record of PHR identifiable
  health information on an individual **that has the ability to draw information from
  multiple sources and that is managed, shared, and controlled by or primarily for the
  individual**."
- **"PHR identifiable health information" (§ 318.2, 2024 revision):** individually
  identifiable health information (broadly construed) relating to an identified or
  reasonably identifiable individual. The 2024 revision makes explicit that this is
  *not* limited to clinical data.
- **"Breach of security" (§ 318.2, 2024 revision):** unauthorized **acquisition** of
  unsecured PHR-identifiable health information — and the FTC's enforcement posture
  treats unauthorized **disclosure** the same way (e.g., voluntary sharing with
  advertisers/analytics contrary to privacy promises and without consent).
- **2024 revision scope clarification:** the FTC expressly stated the Rule covers
  **developers of health apps and similar technology products** — an app that pulls
  health information from multiple sources *is* a PHR. (Enforcement to date: GoodRx,
  $1.5M civil penalty (2023); BetterHelp, $7.8M (2023); Easy Healthcare/Premom —
  all for sharing health data without consent / HBR violations.)

## B4. Analysis — the three PHR elements applied to Pookie

| Element | Pookie facts | Conclusion |
|---|---|---|
| (1) Electronic record of PHR-identifiable health information | W2 stores device vitals, activity, sleep; W8 mood; W22 activity; W23 nutrition; W13 per FR-HEALTH-004 — tied to identified/identifiable individuals (account identities). H2/H3 include mental-health, SUD, and reproductive-adjacent data — squarely health information under the FTC's broad construction. | **Met.** Do not rest the analysis on a narrow "wellness vs. health" distinction — the 2024 revision and enforcement history (Flo, Premom) reject it. |
| (2) Ability to draw information from multiple sources | W2 draws from **device syncs** (wearables/phone health APIs) **plus manual user entries**; school/health modules may later ingest provider exports. Multiple sources by design. | **Met.** This is the exact fact pattern the FTC's 2024 commentary uses as the PHR-vendor example. |
| (3) Managed, shared, and controlled by or primarily for the individual | Pookie's locked design principle is **child-as-access-authority**: the teen/adult user controls grants, scopes, and revocation. For 18+ users the individual is unambiguously the controller. For 13–17 the teen holds grant/revoke authority. | **Met for 13+.** For <13, no health data is collected, so no PHR exists for that tier. |

**Counterarguments considered and rejected:**
- *"Pookie is a life app, not a health app."* — The Rule turns on the data and its
  sourcing/control, not the app's marketing category. Health modules that meet the
  three elements make the vendor a PHR vendor for that data.
- *"Mood (W8) and activity (W22) are wellness, not health information."* — The 2024
  definition is deliberately broad; the FTC has treated fertility, mood-adjacent, and
  activity data as covered. Counsel should not be asked to defend a narrow reading.
- *"Parents manage the account, so the individual doesn't control it."* — True only
  for <13 (no health data); for 13+ the access-authority design affirmatively puts
  control with the individual, which *strengthens* the PHR classification.

## B5. If applicable (the planning assumption): obligations and what must be built

### Notification obligations (16 CFR § 318.3–318.6, 2024 revision)

1. **Notice to each affected individual:** without unreasonable delay and **≤60
   calendar days after discovery** of the breach. May be sent by email in the first
   instance where the individual has specified email as the preferred contact —
   design implication: **capture contact-preference at onboarding**.
2. **Notice to the FTC:** for breaches affecting **500+ individuals**, contemporaneously
   with individual notice, **≤60 calendar days after discovery** (extended from the old
   10-business-day rule). For breaches affecting **<500 individuals**, maintain a log
   and submit it to the FTC **≤60 days after the end of the calendar year**.
3. **Third-party service providers** (Supabase, Cloudflare — the §A3 DPA terms must
   say this): notify Pookie without unreasonable delay and **≤60 calendar days after
   discovery**. Contract a tighter SLA (proposed ≤72h, §A3 item 4).
4. **Notice content must include:** what happened; the types of unsecured PHR-
   identifiable health information involved; **the name/identity (or description) of
   any third party that acquired the information**; what Pookie is doing to protect
   affected individuals; and **two or more contact methods** (toll-free number,
   email, website, in-app mechanism, or postal address). The FTC publishes exemplar
   notices — adopt their structure.
5. **"Unsecured" is the trigger.** Information rendered unreadable/unusable under FTC
   guidance (strong encryption at rest and in transit, keys properly managed) is not
   "unsecured" — **the §A2 encryption design is therefore also the HBR scoping
   control.** Conversely, application-layer compromise (stolen service-role key,
   RLS bypass, unauthorized employee/vendor access) *is* a breach even if the disks
   are encrypted.
6. **Voluntary disclosures count.** Sharing health data with ad/analytics SDKs or
   vendors contrary to the privacy policy and without consent is an unauthorized
   disclosure — **audit every third-party SDK and data flow touching health modules
   before they hold real data** (this is also the D2 no-training enforcement point).
7. **Penalties:** violations are enforceable as FTC Act violations with **civil
   penalties per violation per day** (adjusted annually — counsel to state the current
   figure). GoodRx ($1.5M) and BetterHelp ($7.8M) show the FTC prices these
   significantly.

### Build-before-data checklist (health modules)

- [ ] Breach-detection and security-event logging scoped to health data stores (builds
      on `access_events`; discovery date must be determinable — the 60-day clock runs
      from *discovery*).
- [ ] Incident runbook with HBR-specific branch: scoping, "unsecured" determination,
      individual-notice drafting, FTC submission process, <500/year-end log procedure.
- [ ] Named breach-notification owner (Compliance Owner) + backup.
- [ ] Notice templates (individual + FTC) pre-drafted; contact-preference capture at
      onboarding (email-preferred enables email-first notice).
- [ ] Vendor DPA flow-down: ≤72h vendor→Pookie notice, cooperation, no direct
      subject notification except as directed (§A3).
- [ ] Third-party SDK/data-flow audit for health modules: no ad/analytics SDK
      receives PHR-identifiable health information (unauthorized-disclosure risk).
- [ ] Encryption posture documented as the "secured" determination (ties §A2 to §B5).
- [ ] Workforce training on the 60-day clock and the discovery definition.

### B6. If not applicable — the documented fallback reasoning

If counsel ultimately concludes Pookie is *not* a PHR vendor, the reasoning must
affirmatively address: (a) why the multi-source + individual-control elements fail on
Pookie's facts (unlikely given §B4); (b) the 2024 revision's health-app-developer
language; and (c) the enforcement record. **A "we're a life app" memo that does not
engage the three-element test will not survive scrutiny** — document the test, not the
label. Even under a not-applicable determination, the §B5 checklist remains good
practice and overlaps with GIPA and MHMDA obligations.

### B7. Gate 10 status

| Item | Status |
|---|---|
| Applicability determination (this memo) | 🟢 drafted — planning assumption: **applicable** for 13+ health data |
| Formal legal opinion | 🔴 barred attorney (must address the three-element test, the 2024 health-app-developer language, 42 CFR Part 2 interplay for H3/SUD data, and state-AG enforcement exposure) |
| Build-before-data checklist (§B5) | 🟡 Mehedi decision: proceed with health modules **as HBR-covered** (fund the build) or descope health data |

**Gate NFR-LEGAL-010 overall: 🔴 blocked** until (1) counsel issues the formal
opinion and (2) the §B5 obligations are built. The gate is *not* cleared by this memo.

### Blocked modules + dependency chain — Gate 10

- **W2 Health, W8 Wellbeing, W22 Activity, W23 Nutrition, W13**: no real data until
  Gate 10 clears. Chain:
  `FR-HEALTH-001 taxonomy ships → Gate 7 (retention/infosec/vendor) →
   Gate 10 formal opinion + §B5 breach-notification build → real health data`.
  UI shells/placeholders may ship; **any sync, import, or manual entry of real health
  data is blocked**.
- **S2/S3 transcripts that contain health content**: counsel must scope whether
  support transcripts holding H1–H3 content are PHR-identifiable health information
  in a PHR — if yes, they inherit the HBR obligations (deletion + breach clocks).
- **W19 medical card (break-glass)**: coarse location + medical card disclosed to the
  D1 crisis vendor — counsel confirms whether the vendor becomes a PHR-related
  entity / service provider (DPA must say so either way).

---

# PART C — TEEN-PRIVACY REVIEW (FR-AGE-005/006/007)

## C1. FR-AGE-006 — 18+ health re-consent: "skip = private" + 30-day purge

**Is "skip = private" the right default? Yes — it is the legally strongest design.**

At 18 the data subject becomes an adult. Data collected during minority (under teen
and/or parental consent) needs a fresh legal basis for continued *adult* processing.
"Skip = private" implements **affirmative opt-in consent** with a restrictive default —
the posture the FTC, MHMDA (D3), and every state comprehensive-privacy law reward, and
the posture GA's FBPA makes enforceable once promised. The alternatives (skip = keep,
or silent carryover) would process an adult's health data without that adult's consent:
a clear UDAP/FBPA and MHMDA exposure. **Keep the default. Do not soften it.**

**The 30-day grace period — exposure analysis:**

1. **During the 30 days the data is private, not shared.** Parent access must cut at
   the 18th birthday (or postsecondary-enrollment trigger, FR-AGE-005), not at the
   end of the grace period. The grace period is a *decision window*, not a continued-
   sharing window. Confirm the build does this.
2. **Breach during the window:** the data remains PHR-identifiable health information
   held by a PHR vendor — HBR obligations apply during the grace period. The runbook
   (§B5) must cover un-consented adult data explicitly.
3. **Litigation holds:** a hold may suspend an in-scope purge, but per §A1 the hold
   must be bounded and counsel-authorized — it cannot convert the 30-day commitment
   into indefinite retention.
4. **Dark-pattern risk:** the "unavoidable" keep/review decision (FR-AGE-005) is good
   for consent validity, but the choice architecture must present **private/delete
   with equal prominence** to keep. A flow that nags toward "keep" is a dark pattern
   under FTC §5 policy and several state laws. → 🟡 Mehedi decision (UX review of the
   transition flow).
5. **Review–correct–seal + transition-summary export (FR-AGE-006):** correct as
   designed — accuracy and portability rights. Emergency-contact re-designation
   decoupled from access grants is also correct (safety function ≠ data-access grant).

**Verdict: 🟢 sound by drafting** (the default and the purge are right) **→ 🔴 counsel
confirms** grace-period mechanics (cut-off timing, hold interaction, breach coverage)
and reviews the transition UX for dark patterns.

## C2. The 13–15 shared-agency model — COPPA and state-law issues with teen+parent co-consent

**COPPA: no issue.** COPPA applies to children under 13. The 13–15 tier is outside
federal COPPA entirely. (Do not let anyone cite COPPA as a reason to weaken the
13–15 design — it doesn't apply.)

**State law — three points:**

1. **GA minor health-consent statutes cut toward teen confidentiality, not parental
   access.** Georgia law permits minors to consent to certain care (STI, substance
   abuse, and mental-health treatment at 16+) with statutory confidentiality. The
   build already reflects this (FR-HEALTH-008: confidential teen health data in those
   categories is *never parent-visible regardless of scope grants*). **The co-consent
   model must therefore be category-sensitive:** teen+parent co-consent is fine for
   non-confidential wellness data (W22 activity, H1), but **SUD data (42 CFR Part 2 /
   FR-HEALTH-009) and statutorily confidential mental-health/sexual-health data must
   be teen-consent-only — a parent must never be able to co-approve or view them.**
   Any design where a parent grant can surface H3 content is a must-not-ship (Part D).
2. **The child-as-access-authority principle (teen grants can't be vetoed by parents)
   is lawful for 13–17.** No federal law gives parents a right of access to a private
   app's data about their 13–17-year-old (COPPA's parental rights end at 13; GA's
   Parents' Bill of Rights, O.C.G.A. § 20-2-786, governs schools, not private apps).
   A private service may set its own access rules. Counsel confirms, and the ToS
   (Gate 1) must state the rule plainly. Note the custody overlay: D5's STAY-OUT
   posture means teen grants to one parent over the other's objection are a
   foreseeable support/crisis vector — the design accepts this; support scripts
   should be ready.
3. **TX SCOPE and the 16–17 tier.** Texas SCOPE requires parental consent for
   processing a known minor's data (<18) — the 16–17 "teen control" model needs
   SCOPE review in Gate 9 (multi-state). The 13–15 co-consent model is actually
   *helpful* for SCOPE. Flag for Gate 9; do not redesign now. Similarly CA's <16
   opt-in consent rules (CCPA as amended) need Gate-9 treatment for the 13–15 tier.

**Verdict: 🟢 sound by drafting** with the H3 carve-out stated as a hard invariant
**→ 🔴 counsel confirms** the minor-consent category boundaries and the Gate-9
multi-state implications (TX SCOPE, CA <16 opt-in).

## C3. FR-AGE-007 — "hide past too," deletion honored ≤30 days

**Adequate — with one flow-down requirement.** "Parent keeps what they already saw"
is inherent (no technology un-sees). The 30-day grace-then-auto-restrict for health
data and the ≤30-day deletion SLA for "hide past too" are reasonable, match common
state-law deletion timelines (typically 45 days), and satisfy COPPA § 312.6's
"without unreasonable delay" standard. **The gap is vendors:** a teen's deletion
request must propagate to Supabase, Cloudflare, and any subprocessor within the same
30 days — which requires the §A3 deletion-on-request DPA term. Without it, Pookie
promises a deletion it cannot fully perform (FBPA exposure again). Tie FR-AGE-007's
SLA to V-4 explicitly.

**Verdict: 🟢 sound by drafting → 🟡 Mehedi decision** (fund the vendor deletion
flow-down; it's part of V-4) **→ 🔴 counsel confirms** the SLA against the final ToS
and privacy policy language.

---

# PART D — MUST NOT SHIP AS DESIGNED

Consolidated prohibitions from this review. Each is a hard gate, not a suggestion.

1. **No real health data in any module (W2/W8/W13/W22/W23) before:** FR-HEALTH-001
   taxonomy ships **and** Gate 7 clears **and** Gate 10's §B5 build is complete.
   Shells/seedlings may ship; syncs, imports, and manual health entries may not.
2. **W23 Nutrition for <18:** no calorie counting, no weight-loss features, no
   calorie-burn display — ever, without the clinician gate (FR-HEALTH-006/005). This
   is already 🛑 in the spec; restated here as a legal prohibition (state AG UDAP
   exposure + youth-safety enforcement trends).
3. **No human reads teen check-in content, mood text, or AI-chat debug logs before
   Gate 2 (mandatory-reporter program) clears** — including support agents and
   contractors. The §A1 human-review condition applies.
4. **No parent visibility into, or co-consent over, statutorily confidential teen
   health categories** (SUD under 42 CFR Part 2; GA minor-consent mental-health /
   sexual-health categories). FR-HEALTH-008/009 are hard invariants, not preferences.
5. **Do not publish the D2 "NEVER train on your data" commitment** until the
   Cloudflare/Workers AI no-training terms are contractual (P0, §A3). Publishing
   early is a deceptive-practice exposure under FTC precedent.
6. **No vendor touching child, health, education, or credential data goes live
   without an executed DPA containing the §A3 terms** — especially the contracted
   crisis vendor (D1), which is not yet in the vendor inventory.
7. **No precise location collection by Pookie or any vendor/SDK** (D7). Audit SDKs
   for location reintroduction.
8. **No OCR vendor receives W21 images before assessment + DPA** (extract-then-mask,
   no vendor retention beyond processing).
9. **W24 as a credit-monitoring/coaching product** — FCRA re-scope required first
   (NFR-COMPLIANCE-002; already gated, restated for completeness).
10. **W29 (trails solo-minor), W30 (teen flight self-booking), W31 (rental-car teen
    initiation)** as currently specified — transportation-of-minors and minor
    contractual-capacity issues; already 🛑 in the spec.
11. **AI-generated practice quizzes** must not ship as authoritative without
    verification labeling and the FR-SCHOOL-005 guardrails.
12. **The 18+ transition flow must not use dark patterns** — keep/private/delete
    presented with equal prominence (§C1).

---

# PART E — OPEN QUESTIONS FOR MEHEDI

1. **Appoint the Compliance Owner** (owns Gates 5/7, the infosec program, vendor
   DPAs, annual attestations). This is the single highest-leverage Phase-0 action —
   every gate in this memo is waiting on an owner, not on more drafting. Internal
   hire, fractional, or Managing-Director-as-interim?
2. **Engage barred counsel** for Gates 1–4, 6–10. Which firm, and on what timeline?
   The 🔴 items in this memo cannot advance without it. (Recommendation: engage one
   firm for the COPPA/HBR/ToS cluster — Gates 1, 7, 10 — to avoid fragmented advice.)
3. **Authorize immediate P0 DPA execution** with Supabase and Cloudflare (terms per
   §A3). Who signs, and is the Managing Director's authority sufficient for contract
   execution, or do you sign personally?
4. **Crisis-ticket retention posture** (§A1, row 12): if counsel advises that
   mandatory-reporter recordkeeping requires retaining crisis-referral records beyond
   1 year, do you accept a longer, metadata-only retention for crisis tickets?
5. **Parental-rights UX** (§A1, row 2): where in the parent dashboard do § 312.6
   rights (review / delete / refuse-further-use of under-13 data) live? Design input
   needed before counsel reviews.
6. **Health-module strategy under HBR** (§B7): proceed building W2/W8/W22/W23 as
   HBR-covered (fund the §B5 breach-notification build), or descope real health data
   from v1? The determination memo assumes "applicable" — confirm that's the
   planning basis.
7. **18+ transition UX review** (§C1): will you personally review the keep/private/
   delete choice architecture for dark patterns before counsel's final pass?
8. **D1 crisis vendor selection**: which vendor, and do you approve adding the
   break-glass disclosure DPA requirements (§A2 item 2, §A3 P1) to the procurement
   criteria now, before contracting?

---

## Document control

| Version | Date | Change | Author |
|---|---|---|---|
| 1.0 | 2026-10-12 | Initial issue-spotting deliverable: Gate 7 (retention, infosec, vendor assurances), Gate 10 (HBR determination memo), teen-privacy review (FR-AGE-005/006/007), must-not-ship list, open questions for Mehedi | Attorney-1 (children's privacy consultant — issue-spotting, not legal advice) |

**Downstream updates required on gate clearance:** `LEGAL-GATES-TRACKER.md` (Gates 7,
10), `COPPA-RETENTION-SCHEDULE.md` (adopt §A1 deltas → v1.0), `COPPA-INFOSEC-PROGRAM.md`
(adopt §A2 deltas → v1.0), `VENDOR-ASSESSMENT-TEMPLATE.md` (add crisis-vendor row;
record executed DPAs), `MASTER-BUILD-CHECKLIST.md` §D.
