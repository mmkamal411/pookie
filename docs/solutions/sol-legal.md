# Pookie — Legal & Compliance Solution Outlines

**Status:** DESIGN OUTLINES ONLY · 2026-10-12
**Jurisdiction baseline:** Georgia, USA (state workstreams required before any non-GA launch — see §15 gate 9)

> **NOT LEGAL ADVICE.** This document is a design scaffold for structuring the legal work. It
> does not constitute legal advice, does not create an attorney–client relationship, and may not
> be relied upon for compliance. **Every outline below ends with an attorney sign-off gate, and
> nothing in this package ships without licensed-counsel drafting or review.** Where this document
> cites statutes or rules, citations are issue-spotting anchors only; the attorney verifies text,
> applicability, and currency.

Panel source: `~/workspace/pookie-app/docs/ACCESS-MODEL-REVIEW-CHECKLIST.md` (18-expert panel, 2026-10-12).

---

## 1. G6 — COPPA 2025 Compliance Package (CRITICAL, enforceable now)

**Header note:** COPPA 2025 (the amended Rule, enforceable now) applies to personal information
collected from children under 13. Pookie's app-store rating is 12+; the panel approved an
under-13 parent-managed model (§1.1.4) as viable **only if the under-13 ban is technical**
(§2 below). Under-13 data handling must therefore be locked down even though under-13 users
are not onboarded — e.g., sibling data, accidental DOB entries, under-13 child profiles in
"add children."

### 1a. Written retention policy — per-source schedule structure

**Outline sections:**
1. **Scope & definitions** — defines "child data" (<13), "source," "data class," "deletion,"
   "backup," "disposition"; names the data owner (compliance owner role).
   - Scope note: must cover under-13 child profiles, under-13 data inadvertently collected,
     and mixed-age household data; define "indefinite" as prohibited.
   - Scope note: defines hierarchy: this policy > per-source schedules > litigation-hold
     suspension (§6); states conflicts resolution (hold wins, reinstates purge after release).
2. **Per-source schedule table** — one row per source with columns:
   `source | data class | legal basis | retention period | deletion method | backup handling | purge cadence | owner`.
   - Scope note: minimum sources to schedule: onboarding/DOB entries, child profiles, link
     codes, check-ins/mood (any <13), AI chat transcripts, health syncs, school sync
     snapshots, financial photo intake, location pings, audit logs, support tickets.
   - Scope note: retention periods are *maximums*, not targets; each row carries the
     business justification for the chosen window.
3. **312.10 hard rule encoding** — FTC Rule §312.10 bans indefinite retention of children's
   personal information. Encode as:
   - a policy-level axiom: "No personal information of a child under 13 is retained
     indefinitely; every collection path must name a bounded retention period."
   - a schedule-table validation rule: any row with `retention period = indefinite / TBD`
     **fails policy review and blocks the source's launch** (gated in CI or release checklist).
   - an annual attestation: compliance owner certifies no under-13 data class lacks a
     bounded schedule (align with vendor-assessment cycle).
4. **Deletion method standard** — crypto-shredding vs row deletion vs anonymization;
   requirements per method (who executes, evidence produced).
   - Scope note: define "deletion" vs "de-identification" (FTC-recognized standard); note
     de-identified data drops out of COPPA scope only if it truly can't be re-linked.
5. **Backup & disaster-recovery handling** — backups are not a loophole.
   - Scope note: backup purge window (≤30 days after source deletion per panel Category 7);
     log evidence of purge; cloud retention settings documented per vendor.
6. **Exceptions & overrides** — litigation hold (§6), legal process (§5), safety disclosures
   — each with time-bounds and re-review dates.
7. **Change control** — any schedule change requires compliance-owner + attorney review;
   versioned, dated, append-only change log.

**⚠️ SIGN-OFF GATE — G6 retention policy:** requires licensed attorney (COPPA/FTC practice)
drafting or line-by-line review before publication. Nothing in this policy is legal advice; the
attorney must confirm §312.10 interpretation, deletion-method sufficiency, and backup-window
adequacy. **Ships without it: nothing collecting or storing under-13-adjacent data ships —
including the "add children" flow.**

### 1b. Written infosec program outline

**Outline sections:**
1. **Program charter** — scope (all Pookie systems), accountability (named program owner),
   review cadence (annual + after incidents/material changes).
2. **Administrative safeguards** — risk assessment methodology; workforce security roles;
   security training (all staff + privileged roles); incident-response plan reference;
   vendor-risk management link (§1c); policy-change control.
3. **Technical safeguards** — access control (least privilege, MFA on admin); encryption
   (in transit, at rest — key management shape in §10); authentication/session management;
   logging & monitoring (security-relevant events); vulnerability management & patching;
   change management; data-loss-prevention rules (e.g., never-log-plaintext).
4. **Physical safeguards** — cloud-first model: map physical responsibility to vendors
   (Supabase/AWS, Cloudflare); endpoint security for staff devices (RustDesk-style remote
   admin is in scope); secure disposal of any local media.
5. **Child-data heightened controls** — additional safeguards where under-13 data is in
   play: restricted access lists, purge verification, export controls.
6. **Incident response link** — cross-reference the GIPA breach runbook (§16); define
   what counts as a security event vs a breach.
7. **Testing & assurance** — pen-test cadence, vulnerability scans, config audits;
   evidence retention.

**⚠️ SIGN-OFF GATE — G6 infosec program:** requires licensed attorney review of the written
program (FTC Safeguards-style adequacy is a legal judgment, not an engineering one) plus
security leadership sign-off. Nothing here is legal advice. **Ships without it: no production
launch; staging only.**

### 1c. Vendor assessment template

**Outline sections (one assessment per vendor; baseline vendors: Supabase, Cloudflare,
OCR/document-AI vendor, LLM/tutor vendor, email provider, analytics):**
1. **Vendor profile** — what data it touches, where it runs, subprocessors.
2. **Assurances demanded** —
   - written data-processing terms (no sale of data, no advertising use, no training
     models on Pookie inputs — see Category 2 "no-training-on-inputs" requirement);
   - COPPA-relevant commitments (vendor as operator vs service provider; deletion on
     request; breach notification SLA);
   - security commitments (encryption, SOC 2 or equivalent, vuln disclosure);
   - deletion/backup certification (executes and evidences purges within the schedule window);
   - audit right / evidence provision.
3. **Evidence collected** — contracts, certifications, completed questionnaire, pen-test
   summaries; dated; re-verified annually.
4. **Risk rating & decision** — approve / approve-with-conditions / reject; conditions
   recorded with owners and dates.
5. **Continuous monitoring** — change-of-terms detection, annual re-assessment, offboarding
   (data return/destruction).

**⚠️ SIGN-OFF GATE — G6 vendor template:** requires licensed attorney review of the template
and of each executed vendor agreement (contract terms are the compliance artifact). Nothing
here is legal advice. **Ships without it: no vendor touching child, health, education, or
credential data goes live.**

---

## 2. §1.1.4 — Under-13 Technical Guarantees (build checklist)

Panel requirement: the under-13 ban must be a **technical guarantee, not policy**. The
following enforcement points must exist *in code* before any under-13 profile can be created:

1. **Auth hooks (server-side)**
   - Signup/session creation rejects DOB <13 for any self-service path; session tokens
     never minted for an under-13 principal.
   - Parent-managed profiles exist as data rows only — no credentials, no password, no
     magic-link issuance, no OAuth linkage.
   - Server function computes age from verified DOB at write time; client-provided age
     is never trusted.
2. **RLS / database layer**
   - RLS policies assert `age_at_signup >= 13` for any login-capable identity; under-13
     rows are insertable only via the parent-managed-profile path.
   - `legal_status` column on profiles: enum `minor | emancipated | adult` (default
     `minor`; `emancipated` requires documented evidence per O.C.G.A. §§ 15-11-720–727 —
     attorney defines evidentiary standard, §16 brief).
   - Emancipated minors route to the adult track at any age (G11).
3. **API middleware**
   - Every authenticated route re-derives age band from server state; middleware blocks
     session creation, token refresh, and privilege escalation for under-13 principals.
   - Link-code redemption, invite acceptance, and access-request APIs reject under-13
     child principals server-side (not just hidden in UI).
4. **UI gates (defense in depth, never the only control)**
   - DOB gate on signup/onboarding; under-13 DOB routes to parent-managed flow with no
     login affordance.
   - No typable/free-text fields exposed to under-13 profiles (COPPA verifiable-parental-
     consent avoidance: nothing "from the child" is collected).
   - No persistent identifiers set for under-13 sessions (cookies/localStorage scoped to
     the parent's session; analytics disabled for under-13 profile views).
5. **Invite/link-code surface**
   - Link codes and email invites are never issued *to* an under-13 principal; redemption
     binds to the parent's session.
   - `/verify-invite` (§9) carries zero child PI pre-auth regardless of age.
6. **Copy audit — "never label signup as consent"**
   - Audit every onboarding string: signup is *account creation*, not *consent*. For
     under-13: the operative act is the parent's provision of data (FTC FAQ A.8), described
     in plain language; never "the child consents."
   - Audit list: onboarding screens, "add children" step, email invite text, consent
     screen (§1.2.1), Sharing screen, ToS acceptance copy.
   - Deliverable: a copy registry with each string, its location, and the attorney-approved
     consent vocabulary.

**⚠️ SIGN-OFF GATE — §1.1.4:** requires licensed attorney (COPPA) review of the enforcement
design and the copy registry. This is not legal advice. **Ships without it: the "add children"
flow and any under-13 profile creation stay disabled.**

---

## 3. G7 — Mandatory-Reporter Program Outline

Context: O.C.G.A. § 19-7-5 requires certain personnel (including "child service organization
personnel") to report suspected child abuse/neglect. Whether Pookie staff become reporters is a
gray zone that **attaches the moment anyone (human or AI pipeline that a human reads) first
reads check-in content** (R12 trigger). Attaching the duty changes staffing, training, and ops
— it is a business decision, not just a compliance checkbox.

**Outline sections:**
1. **Designation decision framework**
   - Decision tree: which roles read child content today (support, safety review, QA
     sampling, AI-labeling contractors) → does any role plausibly meet "child service
     organization personnel"?
   - Two tracks: (a) designate now and build the program; (b) architect *away* from the
     duty (no human reads of check-in content by design — teen-facing calibration only,
     §1.2 check-in cross-check redesign) and document that posture.
   - Business-implication memo (see §3.5): staffing, training cost, on-call burden,
     hiring filters.
2. **Training program structure**
   - Modules: recognizing signs of abuse/neglect; GA reporting thresholds ("reasonable
     cause"); how to report; documentation; retaliation protections; annual refresher.
   - Role-based: reporters vs. adjacent staff (what adjacent staff must escalate).
   - Records: completion logs, dates, materials version.
3. **DFCS escalation path**
   - Intake → internal triage → DFCS report via **1-855-422-4453** (GA Child Abuse &
     Neglect Reporting line) or county DFCS; emergency → 911 first.
   - SLA: internal triage within **X hours** of reasonable-cause determination (attorney
     sets X; statute requires promptness — treat as hours, not days).
   - After-hours/on-call rotation; teen-safety communication rules (what the teen is and
     isn't told, plain language).
4. **Re-run trigger**
   - The analysis re-runs automatically at: first human read of check-in content; first
     AI-flag review by a human; launch of any human QA sampling of teen content; material
     change in who can view check-ins.
   - Trigger log: date, what changed, outcome of re-analysis.
5. **Documentation requirements**
   - Report log: date/time, reporter, facts observed (not conclusions), DFCS reference
     number, follow-ups; access-restricted, retained per schedule.
   - Non-report decisions: documented rationale (protects against failure-to-report claims).
   - Annual program review memo.
6. **Business implication (surface explicitly)**
   - Attaching the duty converts Pookie into an organization with 24/7-capable reporting
     obligations, mandated training for covered roles, potential hiring constraints, and
     liability for failure to report. The alternative (architecting away from human reads)
     constrains product features (no parent-facing cross-check, no human QA of check-ins)
     but avoids the duty. **This is a founder-level decision; the outline does not pick the
     track — counsel and leadership do.**

**⚠️ SIGN-OFF GATE — G7:** requires licensed Georgia attorney (child-welfare/mandatory-
reporter practice) to decide designation, set the SLA, and approve training content — **before
any human (staff or contractor) reads check-in content, and before any human reviews AI flags
of check-in content.** This is not legal advice. **Ships without it: no human-read or
human-reviewed check-in pipeline; teen-facing calibration only.**

---

## 4. ToS + Arbitration + Class Waiver Outline

**This is the #1 "do not ship on panel analysis alone" item. No version of Pookie ships to a
real family — not even staging-with-real-data — without licensed counsel drafting this
agreement. The outline below structures the work; it is not the agreement.**

**Outline sections:**
1. **Parties & contracting authority**
   - For users 18+: the user is the contracting party.
   - For 13–17: **the parent/guardian must be the contracting party** (minor voidability
     — a minor can disaffirm; the agreement must bind the adult). Teen assent is a
     separate, plain-language acknowledgment, not the contract.
   - For under-13 parent-managed profiles: parent contracts; no child assent sought.
   - Guardian attestation at "add children" (§1.1.2) ties to this section.
2. **Agreement architecture** — modular: Master Terms; Privacy Policy (FBPA-enforceable —
   every promise is binding under O.C.G.A. § 10-1-393(a)); teen plain-language summary
   (non-binding explainer, clearly labeled); per-module addenda (health, school, location).
3. **Dispute resolution**
   - 11th Circuit post-*AT&T Mobility v. Concepcion* requirements: conspicuous arbitration
     clause, mutual assent evidence (clickwrap design, not browsewrap), delegation clause,
     small-claims carve-out, opt-out window (attorney sets duration), cost/fee allocation,
     arbitral forum and rules, class-action waiver with severability.
   - Mass-arbitration provisions; changes-to-terms with notice and re-acceptance.
4. **Minor-specific provisions** — capacity, parental consent to arbitration on the minor's
   behalf, severability if the minor's assent is challenged.
5. **Acceptance mechanics** — versioned acceptance records (who, when, version, IP/device
   hash); re-acceptance on material change; parent re-acceptance when a child ages into a
   new tier.
6. **Prohibited uses & account integrity** — no credential sharing, no scraping, portal
   automation disclosures (ties to §16 Playwright brief).
7. **Limitation of liability / disclaimers** — coordinated with W26/W29 disclaimer work
   (§16); "not an emergency service" language (W19).

**⚠️ SIGN-OFF GATE — ToS/arbitration:** requires licensed attorney (consumer-contracts /
arbitration, 11th Circuit practice) to **draft** the agreement — not review a draft written
from this outline. This is not legal advice. **Ships without it: NOTHING. No real-user launch,
no real-data staging, no marketing claims about the agreement.**

---

## 5. Law-Enforcement / Subpoena Response Policy Outline

**Outline sections:**
1. **Intake**
   - Single intake channel (named role + backup); every request logged on receipt with
     date/time, requesting agency, agent name/badge, contact verification.
   - Triage categories: emergency disclosure request; subpoena; court order; search
     warrant; preservation request; informal/voluntary request.
2. **Verification**
   - Authenticate the requester (call back via published agency number; verify
     credentials); authenticate the instrument (valid subpoena/court order on its face —
     issuing court, scope, signature/seal; attorney confirms).
   - **Voluntary/informal requests are never fulfilled without counsel approval.**
3. **Scope limitation**
   - Produce only what the valid instrument compels; narrow overbroad requests via
     counsel (motion to quash/limit where appropriate).
   - Apply data-minimization: the correct child, the correct date range, the correct
     data classes; never "the whole account" on a narrow order.
   - Log exactly what was produced.
4. **Teen/parent notification rules**
   - Default: notify the affected account holder(s) **unless** a valid non-disclosure
     order (gag order) prohibits it — attorney verifies the gag's validity and scope.
   - For teen data: notify the teen (the access authority) and, where appropriate, the
     parent — sequenced to avoid endangering the teen (welfare lens; see cooling-off
     redesign §1.4.1).
   - Delayed-notification log when disclosure is temporarily prohibited.
5. **Documentation**
   - Request file: instrument copy, verification notes, counsel communications, scope
     decision, production log, notification log; access-restricted; retained per schedule.
   - Annual tabletop exercise.
6. **Emergency-disclosure carve-out**
   - Criteria for voluntary emergency disclosure (imminent death/serious injury);
     two-person approval (on-call + counsel if reachable); documented after the fact.

**⚠️ SIGN-OFF GATE — LE/subpoena policy:** requires licensed attorney review and approval of
the policy plus a named counsel contact for live requests. This is not legal advice.
**Ships without it: any live request is escalated to outside counsel ad hoc — no staff
action on any request until counsel is engaged.**

---

## 6. Data Retention + Litigation-Hold Procedure Outline

**Outline sections:**
1. **Per-source retention schedule** (binds to §1a structure; panel-mandated minimums):
   - Check-ins / mood / teen-generated content: **teen-deletable at any time + rolling
     auto-purge option** (teen sets window; default window set by policy, attorney-
     approved; never indefinite — G17).
   - School emails / teacher comms: **school year + 1** (then purge; litigation hold
     excepted).
   - Raw financial images: **≤30 days** after extraction (extract-then-mask, §12).
   - Backups: **purged ≤30 days after source deletion** (§1a.5).
   - Audit/access logs: bounded window (attorney sets; needed for breach scoping, §1.2.6).
   - Location pings: no retained history for <18 by default (G14); coarse precision.
   - AI chat transcripts: bounded; no indefinite retention of minor transcripts.
2. **Purge mechanics** — automated jobs per source; evidence of execution (counts, dates);
   failure alerting; manual purge path for teen deletion requests (30-day SLA, §1.6.3).
3. **Litigation-hold procedure**
   - Hold authority: who can issue (counsel + compliance owner); written hold notice with
     scope (custodians, data classes, date ranges), effective date.
   - **Suspension mechanics:** automated purges suspend *only* for in-scope data; out-of-
     scope purges continue (holds are not a pretext for indefinite retention).
   - Hold register: active holds, scope, custodian acknowledgments, release dates.
   - Release: written release → purges resume → catch-up purge of data that aged out
     during the hold (unless counsel directs otherwise).
4. **Conflict resolution — retention vs hold vs deletion rights**
   - Rule: a valid litigation hold **suspends** scheduled purges and teen deletion for
     in-scope data only; the teen is told plainly (age-appropriate) that deletion is
     paused for legal reasons, without disclosing privileged detail.
   - Rule: holds are time-bounded and re-authorized (attorney sets cadence); a hold is
     never "until further notice" without re-review.
   - Rule: COPPA 312.10's ban on indefinite retention is not waived by a hold — the hold
     itself must be bounded, or it becomes the prohibited indefinite retention by another
     name.
5. **Teen deletion at 18+** — "hide past too" requests honored within 30 days (§1.6.3);
   interaction with active holds documented.

**⚠️ SIGN-OFF GATE — retention + litigation hold:** requires licensed attorney approval of
the schedule and the hold procedure (spoliation risk makes this a legal document, not an
ops runbook). This is not legal advice. **Ships without it: no real-data retention — which
means no real-data launch.**

---

## 7. §1.6.1 — 18+ FERPA Consent Design

Panel correction to the spec: FERPA rights transfer at **18 OR postsecondary enrollment,
whichever comes first** (spec omits the postsecondary prong — the design must add it).

**Outline sections:**
1. **Transfer-event detection**
   - Events: 18th birthday (DOB-derived); postsecondary enrollment (self-reported +
     school-data signal, e.g., college-domain email or enrollment record); emancipated
     minor → adult track immediately (G11, `legal_status`).
   - Detection runs server-side; the transfer is a legal fact, not a UI preference.
2. **Parent-credential pull pause (mandatory)**
   - On transfer: **all parent-credential school pulls MUST pause immediately** until the
     adult student re-authenticates the credential or grants fresh access (FERPA,
     liability, counselor converge — §1.6.1).
   - Mechanics: sync workers keyed to the credential owner; revoke/pause worker tokens;
     queued pulls drain without executing; audit-log the pause.
   - Revoked parent's credentials must never keep syncing the teen's data (§1.5.2).
3. **Unavoidable keep/review decision**
   - The adult student faces a **non-dismissible** decision screen: keep sharing X with
     parent / make private / decide later (bounded deferral, attorney sets max).
   - Per-scope granularity (Performance / Communications / Reflection / Wellness) —
     school data and health data decided separately.
4. **Consent flow (adult student as authority)**
   - Step 1: "Your education records are now yours" explainer (plain language, FERPA
     rights summarized).
   - Step 2: per-scope keep/private decisions; school-transparency line retained
     ("Pookie-only; your school still shares with whoever the school recognizes").
   - Step 3: credential handoff — re-auth school credentials in own name (§10 at-18
     transfer) or disconnect parent's.
   - Step 4: confirmation + 30-day change window; "make private quietly" option
     (§1.6.4).
5. **Health data track (contrast)**
   - Health requires **affirmative opt-in re-consent; skip = private** (§1.6.2) — stricter
     than the school-data default. The design must not let the school-data "continuity"
     framing leak into health.
   - Body & development: fresh explicit grant, default off; review–correct–seal of
     parent-entered data; transition-summary export; emergency-contact re-designation
     decoupled from access grants.
6. **Re-auth mechanics for school credentials**
   - Credential ownership transfers from parent to adult student via the vault (§10):
     mandatory handoff flow — parent's stored credential is cryptographically retired;
     student adds their own (or re-authorizes) before pulls resume.
   - Until re-auth completes, the dashboard shows school data as paused with a clear
     "reconnect to resume" state — never silently stale data presented as live.

**⚠️ SIGN-OFF GATE — 18+ FERPA consent design:** requires licensed attorney (FERPA/education-
records practice) approval of the consent flow, the pause mechanics, and the transfer-event
definitions — **before build** (panel R3: counsel signs off on the consent design before
build). This is not legal advice. **Ships without it: the 18+ transition flow does not ship;
aging-up users stay on pre-18 rules with parent pulls paused as the safe default.**

---

## 8. Court-Order Ingestion Workflow (G9 support)

Panel rule: **human review only — no auto-enforcement — until counsel signs off**
(R4: build the ingestion path now; do not auto-enforce).

**Outline sections:**
1. **Intake** — dedicated upload queue (`court_order_restriction` flag source); accepted
   from: parent/guardian account holder, teen, attorney of record, GAL.
   - Intake captures: order document, issuing court, case number, parties, date, what
     access change is claimed.
2. **Who verifies (human role)** — named reviewer role (compliance owner or designee);
   backup reviewer; **counsel reviews every order before any matrix change**.
   - No engineer, support agent, or automated rule applies an order.
3. **Verification steps**
   - Authenticity: court seal/signature, docket verification via public records or
     counsel; reject photocopies-of-photocopies without corroboration.
   - Scope: exactly what access the order grants/restricts, for which child, for what
     period; custody vs visitation vs protective order distinguished.
   - Currency: still in effect? superseded? expired?
   - Conflict check: does the order conflict with another order on file? (escalate to
     counsel; newest-valid-order rule set by attorney.)
4. **What overrides (matrix adjustments)**
   - Only the verified scope adjusts the access matrix: e.g., court-ordered parent
     access restored despite teen revoke; or court-ordered restriction enforced despite
     grant.
   - Adjustments are **additive flags on the matrix**, not edits to the teen's grants
     (preserves audit integrity; teen's grants remain visible as superseded-by-order).
   - Safety-comms carve-out (§1.2b.3) is never overridden by an access order (attorney
     confirms boundary).
5. **Teen notification**
   - The teen is told **plainly why** access changed ("a court order requires us to
     share X with [parent]"), in age-appropriate language, with a path to ask questions
     (to counsel/compliance, not to the other parent).
   - Timing: at effect; delayed only if the order itself restricts notification
     (attorney verifies).
6. **Documentation** — order file (restricted access), verification memo, counsel
   sign-off, matrix change record, notification record; retained per schedule.
7. **SLA** — intake acknowledged within 1 business day; verification + counsel review
   within **5 business days** (attorney sets final); emergency protective orders
   expedited (same-day triage).

**⚠️ SIGN-OFF GATE — court-order workflow:** requires licensed attorney (family law, GA
practice) to approve the verification standard, override rules, and notification copy —
**before the ingestion queue accepts its first order.** This is not legal advice.
**Ships without it: the queue stays closed; orders received ad hoc go straight to outside
counsel; no matrix changes from orders.**

---

## 9. `/verify-invite` Hardening

Panel: zero child PI pre-auth; unguessable single-use tokens; no enumeration (GA privacy,
welfare, COPPA).

**Outline sections:**
1. **Zero child PI pre-auth**
   - The public landing page renders with **no child personal information** before the
     visitor authenticates: no child name, photo, school, or age derived from the token.
   - Token lookup pre-auth returns only: validity (yes/no) and the *inviting account's*
     display name (adult), never the child's.
   - Error states are identical for invalid, expired, and consumed tokens.
2. **Token spec (unguessable, single-use)**
   - Entropy: **≥128 bits from a CSPRNG** (e.g., 22+ chars base64url); stored as a
     salted hash server-side, never plaintext.
   - Single-use: consumed on first successful redemption; concurrent redemptions
     serialized (first wins; second sees "already used" — identical to invalid).
   - TTL: 7-day email invites (§1.2.1), 15-min link codes (§1.2.2); expiry enforced
     server-side.
3. **No enumeration**
   - Uniform responses: valid/invalid/expired/consumed are indistinguishable to an
     unauthenticated prober (same status code, same body shape, same timing — constant-
     time comparison on token hashes).
   - Rate limits: per-IP and per-token attempt caps with exponential backoff; lockout
     on brute-force (§1.2.2); abuse alerting.
   - Claim dedupe (§1.2.3) fires only **after** successful email verification — never as
     a standalone lookup.
4. **Redemption binding**
   - Token binds to the authenticated session that redeems it; same-device redemption
     flagged in the audit log (welfare, §1.2.2).
   - Anti-coercion private confirmation at redemption ("Did you choose this or were you
     told to?" — §1.2.2).
5. **Logging** — attempts logged without PI; token hashes only; abuse patterns reviewed.

**⚠️ SIGN-OFF GATE — /verify-invite:** requires security review + licensed attorney (GA
privacy/COPPA) confirmation that the design meets the "no enumeration / zero child PI
pre-auth" bar. This is not legal advice. **Ships without it: the public invite landing page
does not ship; invites are delivered and redeemed in-app only.**

---

## 10. Credentials Vault (GIPA)

Panel: **encrypt before ANY real credentials stored.** Under GIPA, name + password =
"personal information"; a breach is an O.C.G.A. § 10-1-912 notification event.

**Outline sections:**
1. **Encryption architecture**
   - **What is encrypted:** every stored credential (username, password, tokens, session
     cookies from portal automation) — field-level encryption at rest; TLS in transit.
   - **Key management shape:** envelope encryption — per-credential data keys wrapped by
     a KMS-held master key; master key rotation schedule; separation of duties (app
     never holds the master key in code/config).
   - **Precondition:** no real credential is persisted until the encryption path is live
     and verified in staging (gated deploy check).
2. **Never-log-plaintext rule**
   - Enforced at: application logging (redaction filters), error reporting, sync-worker
     logs, support tooling, database query logs.
   - CI check: secret-pattern scanning on log paths; staging test that submits a
     canary credential and asserts it appears nowhere in logs.
3. **Rotation + cryptographic erasure**
   - Rotation: user-initiated and admin-initiated; old data keys destroyed after
     re-wrap; evidence logged.
   - Cryptographic erasure: deleting the data key = rendering the credential
     unrecoverable; used for teen deletion requests and deprovisioning.
   - Worker hygiene: Playwright sessions use short-lived credentials; no credential
     material on worker disk beyond the run.
4. **Consent at vault-add** — credential consent documented at the time each credential
   is added (who added it, whose credential it is, for what purpose — Category 5).
5. **At-18 ownership transfer (mandatory handoff flow)**
   - On FERPA transfer (§7): parent-connected school credentials are **retired, not
     transferred** — the parent's stored credential is cryptographically erased; the
     adult student adds their own credential (or explicitly re-authorizes).
   - Pulls stay paused until the handoff completes (§7.2/§7.6).
   - The parent is notified the credential was retired (fact-only); the teen is told
     plainly.
6. **Breach linkage** — vault compromise = presumed § 10-1-912 event; triggers the GIPA
   breach runbook (§16 brief).

**⚠️ SIGN-OFF GATE — credentials vault:** requires licensed attorney (GA privacy/GIPA)
review of the encryption design and breach-notification linkage, plus security sign-off on
key management. This is not legal advice. **Ships without it: no real credentials are stored
— portal sync features stay disabled.**

---

## 11. W24 Credit Re-scope

Panel: **blocked as designed** — no FCRA permissible purpose for 3-bureau monitoring;
bureaus won't furnish. Pivot:

**Outline sections:**
1. **What is cut** — 3-bureau monitoring, score tracking, bureau pulls: removed from scope
   entirely. No FCRA-covered activity.
2. **Minor security-freeze management (O.C.G.A. §§ 10-1-914/914.1) — lawful, GA-native**
   - Feature: guided freeze placement/lift for a minor's credit file at each bureau
     (parent/guardian as the authorized requester for <16; teen 16–17 with guardian).
   - The app **guides and tracks**; it never pulls the file itself.
   - Per-bureau checklist, document checklist, confirmation tracking, lift-before-
     application reminders (e.g., first job, college).
   - Plain-language explainer: what a freeze does/doesn't do; GA-specific rights.
3. **Credit-hygiene coaching via licensed partner**
   - Partnership requirements: partner is a licensed/credentialed credit-counseling
     entity (e.g., NFCC member); no lead-gen sale; content reviewed by partner's
     compliance; Pookie never gives personalized credit advice.
   - Content: freeze hygiene, identity-theft response steps, what to do at 18, how to
     read a disclosure (not a score).
   - Contract terms: data-sharing limits (partner gets no child PI without explicit
     consent), termination for compliance failure.
4. **Disclaimers** — "Pookie is not a credit reporting agency; we do not provide credit
   scores or reports" — placement specified (feature entry + every coaching surface).
5. **Age gating** — freeze management is a parent/guardian action for <16; 16–17 teen
   participation with guardian; 18+ self-service.

**⚠️ SIGN-OFF GATE — W24 re-scope:** requires licensed attorney (FCRA/consumer-finance)
sign-off on the freeze-management pivot and the licensed-partner contract. This is not legal
advice. **Ships without it: W24 does not ship in any form.**

---

## 12. Financial Document Handling (W21 / W7 / W11)

**Outline sections:**
1. **Extract-then-mask architecture**
   - Pipeline: image intake → OCR/extraction → store **last-4 only** (account numbers,
     card numbers) + extracted metadata (payee, amount, due date) → raw image queued
     for deletion.
   - **Never persist full card/account numbers** (Category 4, W7).
   - Masking verified by automated test (canary full number in → only last-4 out).
2. **Auto-delete raw images ≤30 days**
   - Raw images deleted automatically within 30 days of extraction (sooner if the user
     confirms extraction); deletion evidenced; backups follow §1a.5.
   - User-initiated "delete now" honored immediately.
3. **On-device redaction guidance**
   - Before upload: in-app guidance to cover/photograph selectively (e.g., "cover the
     full account number — we only need the last 4 and the amount").
   - Where feasible, on-device redaction assist (blur full numbers pre-upload).
4. **FTC Disposal Rule on disposal**
   - Disposal of consumer-report-derived information follows the FTC Disposal Rule
     (reasonable measures: shredding/burning/pulverization of paper equivalents;
     secure electronic deletion) — attorney confirms applicability to each holding.
5. **Teen's own purchase detail = teenPrivate**
   - Spending detail belonging to the teen is teen-private by default (W11); parent
     surfaces show aggregates only, within the teen's granted scopes.
6. **Retention linkage** — extracted metadata follows the per-source schedule (§6);
   raw images never enter long-term retention.

**⚠️ SIGN-OFF GATE — financial document handling:** requires licensed attorney (GIPA/consumer-
finance) review of the extract-then-mask design, disposal-rule applicability, and the
teenPrivate treatment. This is not legal advice. **Ships without it: W21/W7/W11 photo intake
stays disabled.**

---

## 13. 42 CFR Part 2 — SUD Content Separation Commitment

Context: 42 CFR Part 2 governs substance-use-disorder patient records — **stricter than
HIPAA**, with its own consent requirements and prohibition on re-disclosure. If Pookie stores
any SUD-related content (check-in text mentioning substance use, AI chat about it, health
notes), Part 2 may attach.

**Outline sections:**
1. **Determination first** (§16 brief) — attorney determines whether any Pookie-held
   content is Part 2-covered; the technical commitment below is built **only if** the
   answer is yes or uncertain.
2. **Technical separation commitment** (if applicable)
   - **Never co-mingle SUD-related content under a general consent**: separate data
     store / separate encryption domain / separate access scope.
   - Part 2 consent is standalone: specific program, specific recipient, specific
     purpose, time-bounded, revocable — tracked independently of the general Sharing
     screen.
   - Re-disclosure prohibition enforced in code: Part 2 data never flows into briefings,
     digests, nudges, exports, or API responses unless the Part 2 consent covers that
     exact disclosure.
   - Audit: every access to Part 2 data logged with consent reference.
3. **Product consequence** — if Part 2 attaches, SUD-related features (screening
   questions, substance-use check-in prompts) are gated behind the Part 2 consent flow;
   crisis resources (988) remain available without consent (safety carve-out, attorney
   confirms).
4. **Vendor flow-down** — any vendor touching Part 2 data signs Part 2-compliant terms
   (QSOA or equivalent); LLM vendors explicitly excluded from training on it.

**⚠️ SIGN-OFF GATE — Part 2:** requires licensed attorney (health-privacy, Part 2 practice)
to make the applicability determination **and** approve the separation design before any
SUD-adjacent content type is stored. This is not legal advice. **Ships without it: no
SUD-related content fields, prompts, or storage — and any inadvertently collected SUD
content is quarantined pending counsel.**

---

## 14. TAKE IT DOWN Act (May 2026) — 48-Hour Removal Path

Applies to W1 uploads (and any user-uploaded content): non-consensual intimate imagery
must be removable within **48 hours** of a valid report.

**Outline sections:**
1. **Intake**
   - Dedicated, always-visible reporting path ("Report intimate image") — reachable
     without login where the reporter is a non-user victim; minimal required fields
     (what, where, reporter contact).
   - Triage queue with timestamp of receipt (SLA clock starts at receipt).
2. **Verify**
   - Human reviewer confirms: the reported content matches the report; the reporter is
     the depicted person or authorized representative (lightweight verification —
     attorney sets the standard; do not over-collect victim PI).
   - Duplicate/abuse-of-process handling (bad-faith reports logged, not auto-honored).
3. **Remove**
   - Removal from all serving surfaces (app, CDN, caches) + deletion from storage +
     backup purge on the §1a cadence; hash-based blocking of re-upload (attorney
     confirms hash-sharing posture, e.g., StopNCII-style).
   - **SLA: complete within 48 hours of the valid report** — tracked per-report with
     timestamps at intake/verify/remove/confirm.
4. **Confirm**
   - Reporter notified of removal with reference number; appeal path if the reporter
     disputes the outcome.
   - Law-enforcement preservation: if a criminal report is indicated, preserve per
     counsel direction (litigation-hold mechanics, §6) while removing from public
     serving.
5. **SLA tracking & reporting**
   - Dashboard: per-report timers, breach-of-SLA alerts, monthly compliance summary;
     annual review of the workflow with counsel.

**⚠️ SIGN-OFF GATE — TAKE IT DOWN:** requires licensed attorney review of the verification
standard, hash-blocking posture, and preservation interplay. This is not legal advice.
**Ships without it: W1 uploads (and any user-upload surface) stay disabled.**

---

## 15. §5 Sign-Off Gate List (definitive, ordered)

Each gate: what it is · what ships without it · sequencing.

| # | Gate | What it is | Ships without it | Sequencing |
|---|---|---|---|---|
| 1 | **ToS + arbitration + class waiver** | Licensed counsel **drafts** the agreement (11th Cir. post-*Concepcion*; parent/guardian as contracting party for 13–17) | **NOTHING.** No real-user launch, no real-data staging | **First.** Blocks every other gate's effectiveness — no agreement, no enforceable program |
| 2 | **COPPA compliance package** (G6) | Written retention policy + infosec program + vendor assurances; 312.10 no-indefinite-retention | Nothing collecting/storing under-13-adjacent data; "add children" disabled | Second. Blocks onboarding/family features; parallel with gate 3 |
| 3 | **Under-13 technical guarantees** (§1.1.4) | Server-side enforcement design + copy registry ("never label signup as consent") | "Add children" / under-13 profiles disabled | With gate 2. Blocks family onboarding |
| 4 | **Mandatory-reporter program** (G7) | Designation decision, training, DFCS path (1-855-422-4453), SLA | No human read or human review of check-in content | Before any check-in content pipeline involving humans; blocks Wellbeing launch |
| 5 | **18+ FERPA consent design** | Consent flow + parent-credential pull pause + re-auth mechanics; postsecondary prong | 18+ transition flow doesn't ship; aging-up users stay paused-safe | Before build of the 18+ transition (panel: counsel signs off **before build**) |
| 6 | **Cooling-off notification/retaliation matrix** | DV-advocate review of all revoke/notify copy + safe-exit design | Revoke/go-independent flows don't ship | Before any teen revoke feature; after gate 1 |
| 7 | **Data retention + litigation-hold procedure** | Per-source schedule + hold mechanics + conflict rules | No real-data retention → no real-data launch | Before production data; parallel with gate 2 |
| 8 | **Law-enforcement / subpoena response policy** | Intake, verification, scope, notification, documentation | Staff take no action on live requests without ad-hoc counsel | Before launch; named counsel contact required |
| 9 | **Court-order ingestion workflow** | Human verification standard + override rules + teen notification | Ingestion queue closed; orders → outside counsel only | Before family-launch (custody orders are day-one reality); after gate 1 |
| 10 | **FTC Health Breach Notification Rule applicability** | Determination whether Pookie is a PHR vendor / PHR-related entity | Health modules (W2/W8/W23) hold no real data | Before any health module holds real data; gates the health taxonomy build |

**Deferred but tracked:** Multi-state expansion gate (fires on any non-GA launch — WA MHMDA,
TX SCOPE, CA AB 2246/SB 1119, IL BIPA, AL 2027 law). Each non-GA launch triggers a
state-law workstream; per-state minor-consent text.

**Sequencing summary:** Gate 1 (ToS) first — it underwrites everything. Gates 2+3 (COPPA +
under-13 guarantees) and 7 (retention) run in parallel and jointly gate family onboarding
and any real-data persistence. Gate 5 (FERPA consent) must clear **before build** of the
18+ flow. Gate 4 (mandatory reporter) must clear before any human touches check-in content.
Gates 6, 8, 9 clear before the teen-revoke, launch-ops, and custody-reality features
respectively. Gate 10 clears before health modules hold real data.

---

## 16. Remaining §5 "Needs Legal Review" Items — 3-Line Briefs

**GIPA breach-notification scoping (O.C.G.A. § 10-1-912)**
The question: exactly which Pookie holdings count as GIPA "personal information"
(name + SSN / account number / password / etc.) triggering breach notification — vault +
financial docs yes, grades/check-ins presumably no.
Why it matters: mis-scoping means either unlawful silence after a breach or
panic-notifying over non-triggering data; both create liability.
The attorney must decide: the definitive PI inventory, the breach runbook, and the FBPA
enforcement hook for the policy's Article 34 promises.

**§ 20-2-667 operator-status boundary documentation**
The question: is Pookie an "operator" under Georgia's student-data law given the
parent-credential-fed, no-school-contract model?
Why it matters: operator status carries deletion, no-ad, and no-sale duties; the legal
theory must be documented *before* a district or the AG asks.
The attorney must decide: the written theory + guardrails (no student ads/data sale,
45-day deletion on school request) and whether any feature pushes Pookie across the line.

**Playwright portal ToS / CFAA posture**
The question: does automated StudentVUE/ParentVUE access via Playwright violate district
portal ToS, and what is the CFAA exposure post-*hiQ Labs v. LinkedIn*?
Why it matters: the entire school-sync architecture rests on this; a wrong call risks
access cutoffs or worse.
The attorney must decide: the ToS/CFAA memo, credential-handling obligations, and whether
any portal requires a different access path.

**Safety carve-out vs § 20-2-786 (Parents' Bill of Rights)**
The question: does the never-revocable safety-comms design satisfy the statute's "timely
safety information" guarantee to parents?
Why it matters: the access model deliberately withholds some data from parents; the
carve-out is the legal bridge.
The attorney must decide: whether the carve-out's scope (permission slips, incident
reports, emergency notices) matches the statute, and approve the non-toggleable UI copy.

**Sex-ed opt-out currency (§ 20-2-143(d))**
The question: what does the *current* text of § 20-2-143(d) require — opt-out or opt-in —
after the 2024 bills that sought to change it?
Why it matters: building opt-out logic against an opt-in statute (or vice versa) is a
day-one compliance failure for any health/sexuality content.
The attorney must decide: the current statutory text and which consent architecture the
product must implement.

**42 CFR Part 2 determination**
The question: does any Pookie-stored content (check-ins, AI chats, health notes mentioning
substance use) constitute Part 2-covered SUD patient records?
Why it matters: Part 2 is stricter than HIPAA — wrong determination means unlawful
disclosure with criminal-adjacent penalties.
The attorney must decide: applicability, and if yes, approve the technical separation
design in §13 before any SUD-adjacent content is stored.

**W26/W29 disclaimer sufficiency**
The question: are the "NWS/NOAA-sourced, not an emergency-alert system" (W26) and trail-
guidance (W29) disclaimers sufficient under Georgia law for AI-translated weather and
official-source trail content?
Why it matters: severe-weather and trail-safety guidance relied upon by families is
high-consequence; disclaimers are the liability shield.
The attorney must decide: disclaimer wording, placement, and whether any content must be
gated or removed rather than disclaimed.

---

*End of legal & compliance solution outlines. This document is design scaffolding, not legal
advice. Every section's sign-off gate requires a licensed attorney; nothing described here
ships on panel analysis or design outlines alone.*
