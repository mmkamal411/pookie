# Legal Policy Outlines — Structure Only

**Status:** STRUCTURE OUTLINES ONLY · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Gates:** NFR-LEGAL-001/002/006/008. Builds on `docs/solutions/sol-legal.md` §§3–5, §8
(design scaffolds — operationalized here, not redone).
**MD updates incorporated:** D5 (second-parent v1 = invite-only; custody posture STAY OUT
for v1 — reflected in the court-order outline); D1 (contracted crisis-review vendor —
referenced in the mandatory-reporter outline's staffing section).

> **NOT LEGAL ADVICE.** Issue-spotting scaffold for licensed counsel. Nothing ships without
> attorney drafting/review. **These are structure outlines, not drafted law — counsel fills
> the substance.** Every outline below ends with its drafting gate.

---

## Outline 1 — Terms of Service (incl. arbitration + class waiver)

**Gate:** NFR-LEGAL-001. **Licensed counsel DRAFTS the agreement** (11th Circuit
post-*Concepcion* practice) — not reviews a draft written from this outline.
**Ships without it: NOTHING. No real-user launch, no real-data staging.**

### 1.1 Parties & contracting authority
- 18+: the user is the contracting party.
- 13–17: **the parent/guardian must be the contracting party** (minor voidability — a
  minor can disaffirm; the agreement must bind the adult). Teen assent is a separate,
  plain-language acknowledgment, **not** the contract.
- Under-13 parent-managed profiles: parent contracts; no child assent sought.
- Guardian attestation at "add children" (FR-AUTH-003: checkbox + timestamp + IP hash)
  ties to this section.

### 1.2 Agreement architecture (modular)
- Master Terms.
- Privacy Policy — **FBPA-enforceable** (O.C.G.A. § 10-1-393(a)): every promise in it is
  binding on Pookie; the promises audit (`PRIVACY-PROMISES-AUDIT.md`) is the
  pre-publication checklist.
- Teen plain-language summary — clearly labeled **non-binding explainer**, ≤8th-grade
  reading level.
- Per-module addenda: health (H0–H3 taxonomy, MHMDA disclosures), school (FERPA
  school-transparency line), location (D7 coarse-only architectural statement).

### 1.3 Dispute resolution
- 11th Circuit post-*AT&T Mobility v. Concepcion* requirements: conspicuous arbitration
  clause; mutual-assent evidence (**clickwrap design, not browsewrap**); delegation
  clause; small-claims carve-out; opt-out window (attorney sets duration); cost/fee
  allocation; arbitral forum and rules; **class-action waiver with severability**;
  mass-arbitration provisions; changes-to-terms with notice and re-acceptance.
- Minor-specific: capacity; parental consent to arbitration on the minor's behalf;
  severability if the minor's assent is challenged.

### 1.4 Acceptance mechanics
- Versioned acceptance records: who, when, version, IP/device hash.
- Re-acceptance on material change; parent re-acceptance when a child ages into a new
  tier (13 / 16 / 18).

### 1.5 Prohibited uses & account integrity
- No credential sharing; no scraping; **portal-automation disclosures** (StudentVUE/
  ParentVUE via Playwright — ties to the ToS/CFAA brief, sol-legal §16); no purchase,
  booking, or contract flow completable by a <18 account (FR-TRAVEL-001).

### 1.6 Limitation of liability / disclaimers
- Coordinated with W26/W29 disclaimer work (NWS/NOAA-sourced weather; official-source
  trail content).
- **"Pookie is not an emergency response service — call 911 first"** (W19, FR-SAFETY-008).
- AI disclosures: Pookie/Muse are not therapists; crisis-line handoff language (FR-AI-005).

### 1.7 Account termination
- Grounds for termination/suspension; appeal path.
- Data handling on termination: what is deleted, what is retained per the retention
  schedule (`COPPA-RETENTION-SCHEDULE.md`), and the 30-day deletion SLA.
- **Teen data rights on termination:** teen-authored content (check-ins, reflections, AI
  chats) follows the teen's deletion rights, not the account holder's.

### 1.8 Teen data rights (standalone section)
- Child-as-access-authority restated in plain terms; grant/revoke rules; visibility
  scopes; the school-transparency line ("Pookie-only; the school still shares with your
  parents"); 18+ transition rights (FERPA transfer, health opt-in re-consent, "hide past
  too").

**REQUIRES LICENSED ATTORNEY DRAFTING — DO NOT PUBLISH AS-IS.**

---

## Outline 2 — Mandatory-Reporter Program

**Gate:** NFR-LEGAL-002. Requires licensed **Georgia** attorney (child-welfare /
mandatory-reporter practice) to decide designation, set the SLA, and approve training
content — **before any human (staff or contractor) reads check-in content, and before any
human reviews AI flags of check-in content.**
**Ships without it: no human-read or human-reviewed check-in pipeline; teen-facing
calibration only.**

### 2.1 Designation decision framework
- Decision tree: which roles read child content today (support agents, crisis-review
  vendor staff, safety-review, QA sampling, AI-labeling contractors) → does any role
  plausibly meet O.C.G.A. § 19-7-5 "child service organization personnel"?
- **Two tracks:** (a) designate now and build the program; (b) architect *away* from the
  duty (no human reads of check-in content by design — teen-facing calibration only,
  FR-SCHOOL-003) and document that posture.
- **MD D1 note:** 24/7 break-glass human review is a **contracted crisis-response
  vendor**, not in-house staff — counsel must analyze whether vendor staff attach the
  duty and how the vendor contract allocates reporting obligations.
- Business-implication memo: staffing, training cost, on-call burden, hiring filters —
  **founder-level decision; the outline does not pick the track — counsel and
  leadership do.**

### 2.2 Training program structure
- Modules: recognizing signs of abuse/neglect; GA reporting thresholds ("reasonable
  cause"); how to report; documentation; retaliation protections; annual refresher.
- Role-based: reporters vs. adjacent staff (what adjacent staff must escalate).
- Records: completion logs, dates, materials version.

### 2.3 DFCS escalation path
- Intake → internal triage → DFCS report via **1-855-422-4453** (GA Child Abuse &
  Neglect Reporting line) or county DFCS; **emergency → 911 first.**
- SLA: internal triage within **X hours** of reasonable-cause determination (attorney
  sets X; statute requires promptness — treat as hours, not days).
- After-hours/on-call rotation (contracted vendor covers 24/7 per D1); teen-safety
  communication rules (what the teen is and isn't told, plain language).

### 2.4 Re-run triggers (automatic)
- First human read of check-in content; first AI-flag review by a human; launch of any
  human QA sampling of teen content; material change in who can view check-ins;
  **contracting or changing the crisis-review vendor.**
- Trigger log: date, what changed, outcome of re-analysis.

### 2.5 Documentation requirements
- Report log: date/time, reporter, facts observed (not conclusions), DFCS reference
  number, follow-ups; access-restricted; retained per schedule (add workforce/safety
  record row in schedule v0.2).
- Non-report decisions: documented rationale (protects against failure-to-report claims).
- Annual program review memo.

**REQUIRES LICENSED ATTORNEY DRAFTING — DO NOT PUBLISH AS-IS.**

---

## Outline 3 — Law-Enforcement / Subpoena Response Policy

**Gate:** NFR-LEGAL-006. Requires licensed-attorney review and approval plus a **named
counsel contact for live requests.**
**Ships without it: any live request is escalated to outside counsel ad hoc — no staff
action on any request until counsel is engaged.**

### 3.1 Intake
- Single intake channel (named role + backup); every request logged on receipt:
  date/time, requesting agency, agent name/badge, contact verification.
- Triage categories: emergency disclosure request; subpoena; court order; search
  warrant; preservation request; informal/voluntary request.

### 3.2 Verification
- Authenticate the requester: **call back via a published agency number**; verify
  credentials. Authenticate the instrument: valid on its face (issuing court, scope,
  signature/seal) — **attorney confirms.**
- **Voluntary/informal requests are never fulfilled without counsel approval.**

### 3.3 Scope limitation
- Produce only what the valid instrument compels; narrow overbroad requests via counsel
  (motion to quash/limit where appropriate).
- Data minimization: the correct child, the correct date range, the correct data
  classes; **never "the whole account" on a narrow order.** D7 note: location scope is
  coarse-only by architecture.
- Log exactly what was produced.

### 3.4 Teen/parent notification rules
- Default: notify the affected account holder(s) **unless** a valid non-disclosure
  order (gag order) prohibits it — attorney verifies the gag's validity and scope.
- For teen data: notify **the teen (the access authority)** and, where appropriate, the
  parent — sequenced to avoid endangering the teen (welfare lens; cooling-off redesign
  FR-AGE-002).
- Break-glass Path B (FR-SAFETY-014/015): teen notified via silent in-app card on next
  login (never push/SMS); LE-requested deferral **≤14 days max**, then automatic.
- Delayed-notification log when disclosure is temporarily prohibited.

### 3.5 Documentation
- Request file: instrument copy, verification notes, counsel communications, scope
  decision, production log, notification log; access-restricted; retained per schedule
  (row 11 window; break-glass packages 7 years per FR-SAFETY-015).
- Annual tabletop exercise.

### 3.6 Emergency-disclosure carve-out
- Legal spine: **SCA §2702(b)(8)** — good-faith belief of emergency involving danger of
  death/serious physical injury requiring disclosure without delay (FR-SAFETY-014).
- Verification: callback to independently-sourced agency number + written
  official-channel confirmation within 24h + **two-employee approval**; time pressure
  never lowers the bar.
- Scope: **coarse location only** (D7) + W19 emergency medical card — fixed in policy;
  requester never chooses scope. 72-hour incident-bounded cap, renewable on fresh
  attestation; terminate on case closure.
- **Do NOT build disclosure tooling, LE portal, or approval UI before counsel signs off**
  (NFR-LEGAL-006; FR-SAFETY-015).

**REQUIRES LICENSED ATTORNEY DRAFTING — DO NOT PUBLISH AS-IS.**

---

## Outline 4 — Court-Order Ingestion Workflow

**Gate:** NFR-LEGAL-008. Requires licensed attorney (family law, GA practice) to approve
the verification standard, override rules, and notification copy — **before the ingestion
queue accepts its first order.**
**Ships without it: the queue stays closed; orders received ad hoc go straight to outside
counsel; no matrix changes from orders.**
**MD D5 note:** v1 custody posture is **STAY OUT** — Pookie does not adjudicate custody.
The `court_order_restriction` flag exists for *verified presented orders*; disputes go to
human review case-by-case. The 14-day human-review process must be operational before the
v2 claim path ships.

### 4.1 Intake
- Dedicated upload queue; `court_order_restriction` flag source.
- Accepted from: parent/guardian account holder, teen, attorney of record, GAL.
- Intake captures: order document, issuing court, case number, parties, date, what
  access change is claimed.

### 4.2 Who verifies (human role)
- Named reviewer role (Compliance Owner or designee) + backup reviewer.
- **Counsel reviews every order before any matrix change.**
- **No engineer, support agent, or automated rule applies an order** (human review only —
  no auto-enforcement until counsel signs off).

### 4.3 Verification steps
1. **Authenticity:** court seal/signature; docket verification via public records or
   counsel; reject photocopies-of-photocopies without corroboration.
2. **Scope:** exactly what access the order grants/restricts, for which child, for what
   period; custody vs visitation vs protective order distinguished.
3. **Currency:** still in effect? superseded? expired?
4. **Conflict check:** does the order conflict with another order on file? (Escalate to
   counsel; newest-valid-order rule set by attorney.)

### 4.4 What overrides (matrix adjustments)
- Only the verified scope adjusts the access matrix: e.g., court-ordered parent access
  restored despite teen revoke; or court-ordered restriction enforced despite grant.
- Adjustments are **additive flags on the matrix, not edits to the teen's grants**
  (preserves audit integrity; teen's grants remain visible as superseded-by-order).
- **Safety-comms carve-out (FR-SAFETY-003) is never overridden by an access order**
  (attorney confirms boundary).

### 4.5 Teen notification
- The teen is told **plainly why** access changed ("a court order requires us to share X
  with [parent]"), in age-appropriate language, with a path to ask questions (to
  counsel/compliance, **not** to the other parent).
- Timing: at effect; delayed only if the order itself restricts notification (attorney
  verifies).

### 4.6 Documentation
- Order file (restricted access), verification memo, counsel sign-off, matrix change
  record, notification record; retained per schedule.

### 4.7 SLA
- Intake acknowledged within **1 business day**; verification + counsel review within
  **5 business days** (attorney sets final); emergency protective orders expedited
  (same-day triage).

**REQUIRES LICENSED ATTORNEY DRAFTING — DO NOT PUBLISH AS-IS.**
