# Proposal 1 — Break-Glass Emergency Override: Municipal Law-Enforcement Review

**Reviewer posture:** municipal governance / law-enforcement liaison (mayor's-office perspective: missing-child protocols, police data requests)
**Jurisdiction:** Georgia, USA · **Date:** 2026-10-12
**Spec context:** USER-FIRST-ACCESS-MODEL-SPEC.md (child = access authority; teen may revoke both parents) + ACCESS-MODEL-REVIEW-CHECKLIST.md (G15 trusted-adult infrastructure required; §5.9 "Law-enforcement / subpoena response policy" sign-off gate)

---

## 1. Reality check — what the initial solution gets right vs what's fantasy

### What would actually work at 2 AM in a real Georgia missing-child case

**What police actually need from an app, and in what order:**
1. **Last-active timestamp + most recent IP geolocation/device** — almost always the single highest-value item. A missing teen's last-known-alive data point is often their app activity.
2. **Recent location breadcrumbs** — but with a hard caveat (see §2 below): Pookie must NOT retain a location history for minors by default (checklist G14: no retained history <18, coarse default). Whatever location surface exists (last-known coarse location, check-in location) is what LE gets.
3. **Account identifier set** — verified email/phone, linked accounts, profile display name + birthdate on file, the teen's designated trusted adult and emergency contact list.
4. **Trusted-adult list** — the checklist's G15 infrastructure doubles as the LE contact sheet. Police will call the listed adults before they file a data request; make that list easy to reach.
5. **NOT:** grades, check-in text, mood logs, AI chats, health data. A detective at 2 AM does not need reflection data, and requesting it slows everything down (more data = more scope negotiation = more delay). Scope discipline is a speed feature.

**Speed reality:** A detective investigating a missing juvenile is not going to draft a formal data request to a startup in the first hours. The real 2 AM chain is: family calls 911 → patrol takes the report → NCIC/GCIC entry made **immediately** (Georgia rule: missing-minor entries are *immediate*, not the 12-hour adult window; 34 U.S.C. § 41307 / O.C.G.A. § 35-3-36 — I verified the GCIC rule language today) → investigator starts calling everyone in the child's contact set → a data request to an app happens hours later, typically via **phone call to whoever answers**, not a polished form. If your emergency intake is a web form reviewed by a 9–5 support team, it will fail the first real case. The phone must be answered at 2 AM.

### What in the initial solution is fantasy

1. **"Verified law enforcement" as a self-serve step.** There is no real-time badge-verification API. Companies that do this well (Meta, Google, Snap, Apple) use the same concrete mechanisms (§2.4). A startup cannot rely on vibes; it needs a documented call-back procedure, and it needs it written *before* the first call comes in.
2. **A missing-person report number as a gate in the first hours.** This is the most dangerous fantasy in the proposal. Here's the real sequence: a parent calls 911, patrol responds, takes a statement, *creates the incident*, then an NCIC/GCIC entry is made — often within the hour for a minor, but the **complainant is not handed a report number at the door**. The number exists in CAD (computer-aided dispatch), which the responding officer and dispatch can see; the family often can't quote it back to a company that same night. **Gating emergency access on a number the requester cannot produce is a gate that blocks legitimate urgent access.** It is also spoofable if required as a sole token. Use it as a *corroborating* factor, never the sole gate.
3. **The trusted-adult civilian trigger as designed.** A missing-teen's frantic parent (or "trusted adult") is not a reliable emergency classifier. Police departments already have a defined intake for missing children; letting any civilian trigger a full emergency override creates (a) false-alarm load, (b) a stalking vector (abusive partner claiming "emergency" to locate a teen — the checklist's welfare concerns apply directly here), and (c) liability for wrongful disclosure. From a municipal-safety view, **civilian requests must route through law enforcement for validation**, except in the narrow voluntary-disclosure window (§2.5). A trusted-adult request without LE involvement should trigger an offer to help them contact LE, not an account override.
4. **24-hour auto-expiry as sufficient.** 24 hours is a support-team convenience number, not a case-operations number. Missing-juvenile cases have two phases: (a) the first 72 hours (the window where location data is most perishable and the child is most likely recovered), and (b) the longer tail. Voluntary emergency disclosures under 18 U.S.C. § 2702(c)(4) / (b)(8) are incident-bounded, not time-bounded — the provider *may* disclose when it in good faith believes an emergency involving danger of death or serious physical injury requires disclosure without delay. The right design is: **emergency access lasts for the active-emergency window with a 72-hour cap, renewable only on fresh LE attestation, and every access is logged.** The 24-hour number should be abandoned.
5. **"Teen notified after the fact" as a simple line item.** Correct instinct, but operationally: notification must be delayed while the emergency is active if LE requests a delay (standard gag practice — see §2.5), and must never be shown in a way that tips off a suspect (e.g., no push notification text visible on a lock screen that says "police accessed your location"). Also note the intersection with the checklist's safe-exit work: if the teen revoked parents *because* the household is unsafe, the "after the fact" notification copy must be reviewed by the same DV-advocate pass as the revoke copy.

### The one thing the initial solution gets fundamentally right
Separate, audited, narrowly-scoped, expiring emergency access *outside* the normal access model — yes. This is exactly how mature companies treat it: emergency disclosure is a standalone policy path that bypasses the access matrix but not the law.

---

## 2. Revised solution — concrete operational mechanics

### 2.1 Legal frame (voluntary vs compelled — what the policy must say)

The app policy must draw three bright lines. Get these verbatim into the Law Enforcement Guide:

1. **Preservation requests (18 U.S.C. § 2705(f)):** accepted from any LE agency on signed request; we preserve specified records for 90 days, extendable once. This is the cheapest, lowest-friction thing we can do and we should say yes instantly.
2. **Voluntary emergency disclosure (18 U.S.C. § 2702(c)(4) for records; § 2702(b)(8) for contents):** we *may* — and policy says we *will, when the standard is met* — disclose without legal process when, in good faith, we believe an emergency involving danger of death or serious physical injury requires disclosure without delay. **Voluntary means voluntary:** nobody can compel it, and our policy must say so — "we disclose emergency information at our discretion when the exigent-circumstances standard is met; we do not require a warrant or subpoena in that window."
3. **Compelled disclosure:** anything outside the emergency window requires valid legal process — Georgia subpoena, court order, search warrant, or federal equivalents — reviewed by counsel. Police *cannot* compel disclosure under exigent circumstances; exigency is a **shield for voluntary disclosure**, not a sword for compulsion. This distinction is the #1 thing startups get wrong, and the policy must state it plainly.

**Spoliation note (answers Q6):** auto-expiry must expire *access*, never *records*. Deleting or degrading the data itself on expiry is evidence spoliation once the company has reason to know of an investigation — and an emergency-disclosure request is notice. Design: `emergency_grants` rows hold `granted_at / expires_at / revoked_at`; the data plane never self-deletes on expiry. All access events go to the append-only `access_events` log (checklist §1.3.6), and the emergency-request package (request, verification artifacts, what was disclosed, to whom, when) is retained per the litigation-hold procedure the checklist already requires at §5.5.

### 2.2 Gating — what actually works (answers Q2, Q5)

Drop the report-number-as-gate design. Replace with a **two-channel verification** requirement, both of which are real 2 AM operations:

**Channel A — requester identity (call-back).** This is how every major tech company's LE team does it, and it's the only thing that works in the middle of the night:
- The requester submits through the published Law Enforcement Guide intake (form + a **24/7 emergency phone line** — more on staffing in §4).
- We verify by calling back a **published, non-spoofable agency number**: the precinct/dispatch desk number listed on the agency's official website, or the number returned by the jurisdiction's 911 center for that agency — never the number the caller provides.
- Accept a signed **emergency disclosure certification** (department letterhead or signed PDF from a `.gov` / agency-domain email, or via the NCMEC CyberTipline referral when NCMEC is engaged — NCMEC is the standard missing-children coordination point and companies already accept its referrals).
- Cross-check the stated NCIC/GCIC missing-person entry: we cannot query NCIC (private companies can't), but we can ask for the entering agency + case/OCA number and verify it back through the same call-back. For a juvenile missing entry the agency of jurisdiction is known by the time any data request exists.

**Channel B — emergency fact pattern.** Require *two of three*, not one gate:
- (i) Stated missing-juvenile case with entering agency and case identifier (not necessarily in the requester's hand — we verify via call-back);
- (ii) Corroboration from the teen's designated trusted adult (G15 list) or NCMEC referral;
- (iii) Detective-level attestation of exigency (immediate danger of death or serious physical injury, per § 2702).

A single-channel request (one caller, no corroboration, no identifier) gets: preservation hold + offer to escalate + referral to NCMEC, not data disclosure. This is the false-alarm/abuse defense.

### 2.3 Scope — minimal by default (answers Q1)

Emergency access discloses **only the missing-person locating set**, tiered:

| Tier | Contents | Default |
|---|---|---|
| T1 — Always | Last-active timestamp; coarse last-known location (city/ZIP-level, never precise breadcrumbs for <18, consistent with G14); account contact identifiers; trusted-adult list | Included |
| T2 — On specific request | Recent session metadata (IP/device/app-version), precise last check-in location if the teen enabled it, recent contacts/interactions list | Case-by-case, documented justification required |
| T3 — Excluded from emergency path | Contents of check-ins, mood/wellness data, health data, grades, AI chats, reflection data | Never via emergency disclosure; requires court order |

T2/T3 exclusions matter operationally: a detective will ask for everything ("give me the account"). A documented tier table gives the on-call responder the ability to say yes to T1 immediately and push T2 through the attestation, instead of improvising scope at 2 AM.

### 2.4 Duration and renewal (answers Q1 on the 24/72 question)

- **Emergency access is incident-bounded with a 72-hour hard cap.** Rationale: matches the high-perishability recovery window of a missing juvenile and mirrors how investigators actually work the case (front-loaded). 24 hours is arbitrary and forces a renewal fight at the exact moment investigators are busiest.
- **Renewal:** requires fresh written LE attestation that the emergency persists; each renewal capped at 72 hours; every renewal separately logged.
- **Automatic termination:** case closure (verified via call-back), teen located (account activity shows safe sign-in + corroboration), or the 72-hour cap — whichever comes first. No silent extensions.
- **LE-requested delay of teen notification:** honored up to 7 days on written request (standard investigative-delay practice), then the notification goes out unless a court order extends the delay. This must be in the written policy so responders aren't negotiating First Amendment / ECPA § 2705 delay rules at 2 AM.

### 2.5 The trusted-adult path — revised (answers Q4)

The civilian trigger stays, but as a **routing** function, not an override function:

1. A trusted adult reports the teen missing via the in-app / public safety contact path.
2. We do **not** grant them access to the teen's account. We (a) confirm we have a preservation hold on the data, (b) give them the concrete next step — "call 911 / your local police now; ask them to file a missing-person report and contact us; here's our 24/7 LE number and a reference code", (c) log the report and flag it for the compliance owner.
3. When LE arrives (usually within hours for a missing juvenile — patrol + NCIC entry are immediate), LE's verified request proceeds under §2.2.
4. **The only exception:** if the trusted adult *is* the teen's custodial parent with a valid custody order *and* the teen's age tier makes them the appropriate requester under the existing access model, the normal (non-emergency) access rules apply — this is not an emergency path at all.

Why not let the trusted adult trigger the override directly? Two words: **stalking vector**. Any civilian-triggered location disclosure without LE validation is a gift to abusive ex-partners, controlling parents in unsafe households (the checklist's G4 scenario), and kidnappers posing as family. The municipal-safety view is unambiguous: civilian intake routes to law enforcement; law enforcement validates; the company discloses.

### 2.6 After the emergency — records (answers Q6)

- **Preserve the full emergency package:** the request as received, verification artifacts (call-back log, certification, corroboration notes), exactly what was disclosed (data-tier log), to whom (named recipient, agency), timestamps, and the termination reason. Minimum retention: **7 years** or the litigation-hold procedure's period, whichever is longer — this is the standard for LE-request records at mature companies.
- **Spoliation guard:** the emergency package is placed on litigation hold the moment the request is validated. Auto-expiry revokes *access grants only*. Normal retention schedules (the checklist's G6 per-source schedule) are **suspended for the package** during the hold. Document this in the retention policy itself so nobody "helpfully" purges on schedule.
- **Teen notification:** sent after the fact (or after an LE-requested delay), with DV-advocate-reviewed copy. Logged as an access event. The notification states what was disclosed, to which agency, and why — the teen has a right to know, and the company's liability position is better with a documented notification than without.

---

## 3. What a 9–5 support team cannot do (blunt)

- **Cannot staff a 2 AM emergency phone line.** This requires a real 24/7 on-call rotation — minimum one trained responder reachable within ~30 minutes, with a documented escalation to counsel. For a startup, that is a contracted third-party legal/LE-response service or a rotating duty shared with counsel, not the support queue.
- **Cannot verify LE identity.** Support agents cannot perform call-back verification, evaluate a certification, or assess exigency. This is a **compliance-owner function** (the role the checklist already requires at G7). The job description: designated LE-response owner, trained on § 2702/2703/2705, with a runbook.
- **Cannot make scope calls.** The T1/T2/T3 tier table (§2.3) exists precisely so the responder doesn't improvise. Without it, every case becomes a judgment call by an untrained person.
- **Cannot preserve forensically.** Preservation must suspend normal deletion *across the stack* (primary DB, backups, logs, worker queues) for the affected records. A support ticket cannot do this; it needs an engineered preservation-hold mechanism (a row-level `legal_hold` flag + backup-exclusion from purge jobs).

---

## 4. Implementation notes — what the company must staff and process

**Staffing (minimum viable):**
1. **Designated LE-response / compliance owner** (named human, part-time acceptable at this scale — this is the checklist's G7 owner). Authority: validate requests, approve emergency disclosures, order preservation holds, maintain the access log. Backup owner designated in writing.
2. **24/7 emergency contact path** — phone + dedicated intake email. Contract an after-hours answering/escalation service if the team is sub-10. The published SLA is "acknowledge within 1 hour, verify and respond within 4" — do not publish what you cannot staff.
3. **Counsel on retainer** for the first several cases. Emergency-disclosure judgment at 2 AM is legal judgment; the runbook covers the routine 80%.

**Process artifacts (build before launch):**
1. **Published Law Enforcement Guide** (public page): what we disclose under what process, the three tracks (preservation / emergency voluntary / compelled), intake contact, required request elements, our non-compulsion position, teen-notification practice. This is the industry-standard artifact (every major platform has one) and it doubles as the liability paper trail.
2. **Emergency-disclosure runbook** (internal): the two-channel verification procedure, call-back scripts, the tier table, renewal/termination steps, documentation checklist. Review quarterly; tabletop-exercise it once a year.
3. **`emergency_grants` + litigation-hold plumbing:** grants table with expiry, append-only disclosure log (feeds the checklist's `access_events`), `legal_hold` flag that suspends scheduled purges.
4. **NCMEC coordination:** establish the relationship *before* you need it — NCMEC is the standard missing-children referral channel, and its caseworkers know how to talk to companies. One intro call now saves hours in the first case.
5. **G15 trusted-adult list shipping first:** the emergency design leans on the trusted-adult infrastructure the checklist already requires. Ship it before any teen onboarding (checklist already says this — G1 resolution).

**Sequencing note:** this whole design depends on the checklist's open items — the append-only audit log (§1.3.6), the retention/litigation-hold procedure (§5.5), and the G15 trusted-adult infrastructure. The break-glass design should be built in that order: audit log → retention + hold plumbing → trusted-adult list → LE guide + runbook → on-call staffing.

---

## 5. Open questions for Mehedi

1. **24/7 staffing model:** Will you contract an after-hours escalation service, designate a rotating internal on-call (with counsel backup), or accept a published acknowledgment SLA without a live phone line? This is the single costliest decision in the proposal — everything else is paperwork and schema.
2. **Emergency-phone presence:** Are you willing to publish a 24/7 emergency LE phone number on the Law Enforcement Guide? A form-only intake fails the real 2 AM case (detectives call, they don't fill out forms at a scene). This also means the number rings to a human.
3. **Scope appetite:** Is the T1/T2/T3 tiering acceptable — specifically, are you comfortable with a policy that *refuses* to hand over check-in contents and mood/wellness data in an emergency without a court order? This is the right call legally and ethically, but you should make it deliberately because a detective will push on it.
4. **Civilian-path strictness:** Confirm the hard line — no trusted-adult-triggered account override without LE validation, ever. The alternative (civilian triggers location disclosure) is a stalking vector; I recommend against it, but it materially changes the feature's marketing ("we can help find your child" is a claim you cannot make safely).
5. **Teen-notification delay policy:** Accept the 7-day LE-requested delay default, or shorter? And confirm the DV-advocate copy review extends to the emergency notification (it should — same household-safety dynamics as the revoke notification).
6. **Retention budget:** 7-year retention of LE-request packages — acceptable? This is above the product's per-source retention norms and needs to be in the retention policy as an explicit carve-out.
7. **NCMEC engagement:** Approve a pre-launch intro/coordination call with NCMEC? Free, standard practice, and it gives you a referral channel that bypasses the entire verification problem in the cases that matter most.
8. **Runbook rehearsal:** Will you fund one tabletop exercise (half-day, counsel + compliance owner + one engineer) before the first teen onboarding? Paper runbooks fail on first contact; a dry run is the difference.

---

*Review prepared as Proposal 1 of the municipal law-enforcement pass, 2026-10-12. This is operational-policy analysis, not legal advice — the Law Enforcement Guide and runbook need a licensed attorney's sign-off before publication (checklist §5.6, §5.9).*
