# Attorney Gate Clearance — Synthesis

**Date:** 2026-10-12 · **Coordinator:** legal-gates coordinator (subagent 1b393bc2)
**Attorneys:** Children's Privacy (ATTORNEY-1) · Health Data (ATTORNEY-2) · Platform Liability (ATTORNEY-3)
**Branch:** staging-build · **Docs only — no deploy**

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**
> These three attorneys provided issue-spotting and drafting assistance, NOT legal advice.
> No barred attorney has reviewed any Pookie legal document. Nothing below clears a gate
> for launch; each 🔴/🟡 mark is the attorneys' honest assessment of what remains.

---

## Summary table: 10 gates × status × blocked modules

| Gate | Description | Status | Drafted by | Blocked modules (dependency chain) |
|---|---|---|---|---|
| NFR-LEGAL-001 | Terms of Service + arbitration + class waiver | 🔴 | Attorney 3 | **ALL** — no real-user launch, no real-data staging without the agreement |
| NFR-LEGAL-002 | Mandatory-reporter program | 🔴 designation / 🟡 structure | Attorney 3 | W8 human-read check-ins; S2/S3 human review of teen content; D1 crisis vendor ops; QA sampling of teen content; Pookie tutor oversight |
| NFR-LEGAL-003 | 18+ FERPA consent design | 🟡 | Attorney 3 | 18+ transition flow; W1 adult-student mode; W5 postsecondary prong; 18+ health re-consent (FR-AGE-006) |
| NFR-LEGAL-004 | Cooling-off notification / retaliation matrix | 🟡 | Attorney 3 | Revoke/grant UX (FR-AGE-002/004); W12 + D6 time-boxed grants; D5 second-parent claim flow; W14 Co-parenting; Sharing screen |
| NFR-LEGAL-005 | Retention + litigation hold | 🟡 | Attorney 3 (+ Atty 1 schedule) | All real-data persistence (V-RET-001 release gate); deletion-request flows; DSR pipeline |
| NFR-LEGAL-006 | Law-enforcement / subpoena response | 🟡 policy / 🔴 live handling | Attorney 3 | W19 break-glass tooling (FR-SAFETY-014/015); any LE disclosure feature; legal-process notifications |
| NFR-LEGAL-007 | COPPA 2025 package (retention + infosec + vendor assurances) | 🔴 | Attorney 1 | **All real-data persistence** (onboarding, W1 check-ins, S2/S3 transcripts, W21 mail, notifications); W2/W8/W22/W23 health data |
| NFR-LEGAL-008 | Court-order ingestion workflow | 🟡 | Attorney 3 | D5 claim dispute resolution; W14 custody features; `court_order_restriction` activation |
| NFR-LEGAL-009 | Multi-state (MHMDA + TX/CA/IL/AL) | 🔴 | Attorney 2 | Any non-GA launch of the 31-module shell; WA health data specifically blocked (no distinct policy) |
| NFR-LEGAL-010 | FTC Health Breach Notification Rule determination | 🔴 | Attorney 1 (+ Atty 2 input) | W2/W8/W13/W22/W23 real health data; health-bearing transcripts; W19 break-glass vendor scoping |
| **NFR-LEGAL-011 (proposed)** | 42 CFR Part 2 SUD separation | 🔴 | Attorney 2 | SUD-adjacent features (W8 crisis routing, S2/S3 triage, W19 card, D1 vendor contract); W2 free-text entry |

**Scorecard: 🟢 0 · 🟡 6 (partial) · 🔴 5 (blocked). No gate is fully cleared.**

---

## Per-gate detail

### Gate 001 — Terms of Service 🔴
**Drafted:** Working ToS, 13 sections (Attorney 3, §1 of ATTORNEY-3): parties/contracting authority (parent contracts for 13–17 — minor voidability), modular architecture (Master Terms + Privacy Policy + teen plain-language summary + per-module addenda), arbitration requirements list for counsel (conspicuous, clickwrap evidence, delegation, small-claims carve-out, opt-out window, class waiver with severability), acceptance mechanics (versioned, re-acceptance on tier change at 13/16/18), prohibited uses (<18 purchase bar — FR-TRAVEL-001), limitation of liability ("not an emergency response service — call 911"), AI disclosures, termination + teen data rights.
**What only a barred attorney can do (7 items):** full agreement drafting (not review of this draft), forum/rules/fees selection, minor-voidability analysis under GA law, ToS/CFAA brief for portal automation, Privacy Policy drafting, teen-summary non-binding disclaimer, re-acceptance materiality standard.
**Blocked:** everything. No real-user launch, no real-data staging.

### Gate 002 — Mandatory Reporter 🔴 designation / 🟡 structure
**Drafted:** Designation decision memo (Attorney 3, §2): role-by-role coverage table against O.C.G.A. § 19-7-5 "child service organization personnel" (verified via web search — Pookie's tutor = "education" hook, check-ins = "care/counseling"-adjacent). Track A (designate now, build program) vs. Track B (architect away — no human reads by design) analysis; **recommendation: Track A default** given liberal construction + criminal exposure for knowing/willful failure (misdemeanor). Training program structure; DFCS escalation (1-855-422-4453, 911-first, ≤4h internal triage SLA); D1 vendor-contract allocation clauses (does contracted crisis-vendor staff attach the duty? — flagged for counsel).
**Key fact:** 2026 GA HB 1409 requires reports **within 24 hours, effective 2027-07-01** — baked into the draft now.
**Blocked:** any human read of check-in content (W8), S2/S3 human review of teen content, D1 vendor ops, QA sampling, tutor oversight.
**Mehedi decision needed:** Track A vs. B (founder-level — staffing, training cost, hiring filters).

### Gate 003 — 18+ FERPA Consent 🟡
**Drafted:** Full consent flow spec (Attorney 3, §3): T-30/7/0 notification sequence, parent-credential pull pause mechanics, exact 18+ consent screen copy **including the school-transparency line** ("Pookie-only; the school still shares with your parents"), re-auth requirements, postsecondary-enrollment prong, 1-year unclaimed-data purge.
**Blocked:** 18+ transition flow, W1 adult-student mode, W5 postsecondary, 18+ health re-consent.
**Needs:** counsel sign-off before build (per tracker sequencing).

### Gate 004 — Cooling-Off / Retaliation Matrix 🟡
**Drafted:** Notification copy matrix, Scenarios A–F (Attorney 3, §4): exact user-facing strings, notify-now vs. notify-at-effect per scenario, every DV-risk string marked 🟣 with rationale.
**Blocked:** revoke/grant UX, W12 + D6 grants, D5 claim flow, W14, Sharing screen.
**Needs:** DV-advocate review of all 🟣 strings (separate engagement — not yet arranged).

### Gate 005 — Retention + Litigation Hold 🟡
**Drafted:** Litigation-hold procedure (Attorney 3, §5): placement authority (Compliance Owner + counsel), narrow scope, mandatory time bounds (never "until further notice"), release mechanics, conflict rules — hold vs. COPPA §312.10 (no indefinite retention), vs. teen deletion rights, vs. MHMDA, vs. gag orders. Integrates with Attorney 1's finalized retention schedule v1.0.
**Blocked:** all real-data persistence (V-RET-001 release gate), deletion-request flows.
**Needs:** Compliance Owner appointment (can place holds); counsel confirms windows.

### Gate 006 — Law Enforcement / Subpoena 🟡 policy / 🔴 live handling
**Drafted:** Operational policy (Attorney 3, §6): single intake channel, callback-via-published-agency-number verification, D7 coarse-only scope limitation, silent in-app card + ≤14-day deferral teen notification, SCA §2702(b)(8) emergency carve-out with two-employee approval, **no disclosure tooling before counsel sign-off** (FR-SAFETY-015).
**Blocked:** W19 break-glass tooling, FR-SAFETY-014/015, legal-process notifications.
**🔴 Blocker:** Mehedi must engage a **named counsel contact** for live requests. Until then: any live request escalates to outside counsel ad hoc — no staff action.

### Gate 007 — COPPA 2025 Package 🔴
**Drafted (Attorney 1, Part A):**
- **Retention policy v1.0 (finalized draft):** confirmed v0.1 architecture as publishable; confirmed 🟢 nearly every row; adjusted 🟡 rows 2 (add §312.6 parental-rights procedure — missing), 5 (human-review condition for debug logs pre-Gate-2), 7 (MHMDA consent-bounding), 12 (crisis-ticket vs. mandatory-reporter recordkeeping tension); flagged 🔴 row 11 (3-year audit-log window for under-13-adjacent data — needs barred attorney justification); added rows 16 (break-glass 7-year disclosure packages) and 17 (workforce/training records). Cross-cutting: vendor deletion flow-down SLA (FBPA exposure if Privacy Policy promises what Supabase isn't contractually bound to).
- **Infosec program v1.0:** per-data-class adequacy table — safeguards adequate as designed for all classes (under-13, teen check-ins, H0–H3, education records, credentials vault, financial images, transcripts, audit logs), with HBR "secured" caveat. Required: appoint Compliance Owner, add D1 crisis vendor to program + inventory, create RISK-REGISTER-INFOSEC.md.
- **Vendor assurances:** 10 mandatory DPA terms drafted (no-sale/secondary-use, broad D2 no-training definition with flow-down, ≤30-day certified deletion, ≤72h breach SLA, audit rights, ≥30-day subprocessor notice, residency docs, minor-data confidentiality, D7 location prohibition flow-down, regulatory cooperation). Prioritized: P0 Supabase/Cloudflare/Workers AI → P1 crisis vendor + Google OAuth → P2 OCR/notifications.
**Blocked:** all real-data persistence.
**🔴 Blockers:** Compliance Owner appointment; P0 DPA execution (V-1 — no DPA executed with any vendor); attorney sign-off.

### Gate 008 — Court-Order Workflow 🟡
**Drafted:** Operational workflow (Attorney 3, §7): STAY-OUT posture (D5), human-only verification (authenticity/scope/currency/conflict — no engineer, agent, or automated rule applies an order), additive-flag matrix adjustments (never edits to teen grants — audit integrity), teen notification copy, 1-day ack / 5-day verification SLA.
**Blocked:** D5 claim dispute resolution, W14 custody features, `court_order_restriction` activation.
**Needs:** counsel approves verification standard before queue opens.

### Gate 009 — Multi-State 🔴
**Drafted (Attorney 2):**
- **MHMDA finalized at 14 requirements** (added row 14: inference = collection). Drafted the **distinct consumer-health-data privacy policy structure + key copy** (§3.4) — the single biggest MHMDA blocker. Second blocker: no executed DPAs.
- **DSR pipeline as proposed new FR-ACCESS-010:** intake → verify → execute → confirm, 45-day SLA proposal, teen-specific rules.
- **Consent-withdrawal parity:** same screen, same taps, immediate tombstone (MHMDA requires withdrawal as easy as consent).
- **Per-state briefs (verified 2026-10-12):** WA 🟡 (policy + DPA) | TX 🟡 (SCOPE parental-consent vs. teen-authority model needs reconciliation memo) | CA 🟡 (**SB 1119's independent AI-chatbot audit is the long pole**; AB 2246 profiling analysis needed) | IL 🟡→🟢 conditional (no biometrics today — gate biometric-adjacent features) | AL 🟡 (25k-consumer threshold monitoring; effective 2027-05-01).
**Blocked:** any non-GA launch of the 31-module shell.
**Attorney 2 recommendation:** launch sequencing GA → WA → TX → CA → IL/AL.

### Gate 010 — FTC Health Breach Rule 🔴
**Drafted (Attorney 1, Part B — with Attorney 2 input):** Determination memo as **applicable**. Pookie meets all three PHR elements for 13+ health data: electronic record of broadly-defined health info; multi-source draws by design (FTC's 2024 exemplar fact pattern); child-as-access-authority = individual control. "Life app, not health app" and "wellness vs. health" counterarguments rejected with documented reasoning. Obligations: ≤60-day individual notice, 500+ FTC notice contemporaneous ≤60 days, <500 annual log, vendor ≤60-day flow-down, expanded notice content (third-party identity + 2 contact methods), email-first if preferred contact. Build-before-data checklist included (discovery-date logging, runbook, templates, SDK audit, encryption-as-"secured"-control).
**Blocked:** W2/W8/W13/W22/W23 real health data; health-bearing transcripts; W19 vendor scoping.
**🔴 Needs:** formal counsel opinion + breach-response build before health modules hold real data. (MHMDA private right of action compounds breach exposure — Attorney 2.)

### Gate 011 (proposed) — 42 CFR Part 2 SUD Separation 🔴
**Drafted (Attorney 2):** Reviewed `030_sud_separation.sql`'s automated check — **inadequate as a compliance control**: misses RLS policies (`pg_policy`), triggers, FK/`pg_depend` edges, `pg_cron` jobs; name-based allowlist is a bypass vector; runs only at migration-apply time; **service_role bypasses RLS** — the only thing protecting SUD rows from the generic purge was a magic string in an array literal (now excluded, but the control is fragile). Recommended: separate `part2` schema/role, body-hash allowlist, full catalog scans, CI job + nightly canary, unique migration prefix.
**Honest flag:** Pookie is very likely **not** a Part 2 "program" — the design voluntarily holds SUD records to Part 2 standards. Counsel must decide public-claim language ("to Part 2 standards" vs. "compliant with Part 2") and the open §2.51 medical-emergency deviation (current design: no break-glass for SUD).
**Delivered:** full SUD handling policy (separate purge `purge_tombstoned_sud()`, stricter-than-H3 access, separate audit log), Part 2 §2.31 consent-instrument elements + draft teen-facing consent language, §2.32 re-disclosure prohibition notice.
**Blocked:** SUD-adjacent features (W8 crisis routing, S2/S3 triage, W19 card, D1 vendor contract), W2 free-text entry.

---

## H0–H3 taxonomy sign-off 🟡 (Attorney 2)
Tiering maps to real legal distinctions (H3 ≈ Part 2 + GA minor-consent carve-outs; H2 ≈ mature-minor doctrine; H1 ≈ COPPA/FERPA stewardship; H0 ≈ company refusal). **Found an H0 definition inconsistency** across BUILD-SPECIFICATION / sol-health / retention schedule — counsel must resolve. Also: missing 18+ H0 row in retention schedule.
Delivered: per-subcategory consent language per tier (FR-HEALTH-007), ≤8th-grade plain language with legal-precision layers; FR-AGE-006 transfer notice + "skip = private" mechanics. **30-day purge window defensible only with immediate tombstoning** (read-block during window) — counsel to confirm.

## Teen-privacy review (Attorney 1, Part C)
- FR-AGE-006 "skip = private": **legally strongest default** 🟢.
- 30-day grace exposure: parent cut at 18th birthday (not end of window); breach/HBR during window; dark-pattern UX risk → 🟡 Mehedi decision.
- 13–15 co-consent: no COPPA issue. **Hard invariant: SUD/42 CFR Part 2 and GA minor-consent confidential categories must be teen-consent-only, never parent-visible.**
- Child-as-access-authority lawful for 13–17. TX SCOPE 16–17 flagged for Gate 9.
- FR-AGE-007 ≤30-day deletion adequate 🟢 but needs vendor flow-down (V-4).

---

## Merged must-not-ship list

1. ToS scaffold must never launch with real users (Gate 1).
2. No real health data in W2/W8/W22/W23 before Gates 7 + 10 clear.
3. No W23 calorie/weight-loss tracking for <18 (panel invariant).
4. No D2 "never train" promise published before P0 DPA verification (FTC deceptive-practice risk).
5. No human reads of teen check-in content before Gate 2 clears (W8, S2/S3, QA sampling).
6. No parent visibility into SUD / 42 CFR Part 2 / GA minor-consent confidential teen health categories — ever.
7. No LE/break-glass disclosure tooling before Gate 6 counsel sign-off (FR-SAFETY-015).
8. Court-order queue stays closed before Gate 8; no matrix changes from orders.
9. No WA health data before the distinct MHMDA consumer-health-data privacy policy exists.
10. No pre-checked consent boxes anywhere (MHMDA dark-pattern prohibition).
11. TAKE IT DOWN ≤48h workflow required before any upload surface ships.
12. Revoke/grant UX held for DV-advocate review (Gate 4).
13. No SUD consent RPC without §2.31 element validation; no SUD disclosures without §2.32 re-disclosure notices.
14. No biometric-adjacent feature without BIPA review (Gate 9).
15. No precise-location collection without new privacy review (D7).
16. Resolve the H0 definition inconsistency before taxonomy ships.
17. No duplicate migration prefixes in the compliance chain (030 defect noted).

---

## Merged open questions for Mehedi

**Highest leverage (do these first):**
1. **Appoint the Compliance Owner** — Phase-0 blocker; owns Gates 5/7, retention/infosec programs, hold placement. (All 3 attorneys.)
2. **Engage licensed counsel** — no gate has begun attorney engagement. Minimum viable: GA business attorney (Gates 1/6/8), GA child-welfare attorney (Gate 2), health-privacy attorney (Gates 7/9/10/11). (All 3.)
3. **Authorize P0 DPA execution** — Supabase, Cloudflare, Workers AI model layer. Nothing contractual exists today. (Attorneys 1+2.)

**Founder decisions:**
4. Mandatory-reporter Track A vs. B (Attorney 3).
5. 18+ 30-day grace UX — confirm "skip = private" presentation isn't a dark pattern (Attorney 1).
6. Named counsel contact for live LE requests (Attorney 3, Gate 6 🔴).
7. DV-advocate engagement for Gate 4 copy review (Attorney 3).
8. SUD medical-emergency preference — §2.51 deviation or no break-glass for SUD (Attorney 2).
9. Part 2 public-claim wording — "to Part 2 standards" vs. "compliant with Part 2" (Attorney 2).
10. Whether Pookie will ever refer to SUD treatment programs (reopens Part 2 applicability) (Attorney 2).
11. Launch sequencing — Attorney 2 recommends GA → WA → TX → CA → IL/AL.
12. SB 1119 independent AI-chatbot audit procurement timing (CA long pole) (Attorney 2).
13. Arbitration business preferences for the ToS (Attorney 3).
14. Privacy Policy vs. D2 timing — publish order (Attorney 3).
15. P0 DPA authorization + crisis-ticket recordkeeping posture (Attorney 1).
16. AL 25k-consumer threshold alert ownership (Attorney 2).

---

## What genuinely needs a barred attorney (honest assessment)

| Item | Why a non-attorney cannot do it |
|---|---|
| ToS + arbitration agreement (Gate 1) | Only counsel can draft an enforceable 11th-Circuit arbitration clause; minor-voidability analysis is legal conclusion |
| Mandatory-reporter designation (Gate 2) | Whether O.C.G.A. § 19-7-5 attaches is a legal determination with criminal exposure |
| FTC HBR applicability opinion (Gate 10) | Formal opinion letter; reliance defense |
| Part 2 program determination + claim language (Gate 11) | Applicability is a legal conclusion; public claims create liability |
| 3-year audit-log retention justification (Gate 7, row 11) | Balancing COPPA minimization against litigation needs requires counsel's judgment |
| Live LE request handling (Gate 6) | Real-time legal judgment on instrument validity; named counsel required |
| Court-order verification standard (Gate 8) | Family-law judgment on authenticity, scope, conflicts |
| MHMDA applicability confirmation + exemptions (Gate 9) | Regulated-entity analysis; exemption claims |
| H0 definition resolution (taxonomy) | Definitional inconsistency has legal consequences for consent validity |
| Privacy Policy publication (all gates) | FBPA-enforceable promises; every sentence is a binding commitment |

**What the drafts DO accomplish:** they convert 10 red gates into 6 yellows + 4 reds-with-clear-paths, give counsel a running start (estimated 60–70% of drafting done), name every remaining decision and its owner, and — critically — define the must-not-ship list so engineering cannot accidentally create liability while building.

---

## Document control
- Attorney 1: `docs/compliance/ATTORNEY-1-CHILDRENS-PRIVACY.md` (~46KB)
- Attorney 2: `docs/compliance/ATTORNEY-2-HEALTH-DATA.md`
- Attorney 3: `docs/compliance/ATTORNEY-3-PLATFORM-LIABILITY.md` (831 lines)
- This synthesis: `docs/compliance/ATTORNEY-GATE-CLEARANCE.md`
- Downstream trackers needing update: `LEGAL-GATES-TRACKER.md`, `COPPA-RETENTION-SCHEDULE.md` (v1.0), `COPPA-INFOSEC-PROGRAM.md` (v1.0), `MHMDA-COMPLIANCE-MAPPING.md` (14 rows), `MASTER-BUILD-CHECKLIST.md` §D

*End of synthesis. All attorney reports on file. Counsel sign-off gates unchanged — these drafts do not clear any NFR-LEGAL gate for launch.*
