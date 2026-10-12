# COPPA Written Information Security Program — Outline

**Status:** ISSUE-SPOTTING DRAFT · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Gates:** NFR-PRIVACY-001 (G6 COPPA package) · NFR-LEGAL-007. Builds on
`docs/solutions/sol-legal.md` §1b. Does not redo the solution — it operationalizes it.
**Applies to:** all Pookie systems (app, sync workers, support tooling, analytics).

> **NOT LEGAL ADVICE.** Issue-spotting scaffold for licensed counsel. Nothing ships without
> attorney drafting/review. **Coordination note:** this document owns the *program structure*.
> The parallel **Security Engineer** (Fractional Security team) owns the *technical
> verification details* (pen-test results, config audits, RLS verification). Their evidence
> feeds this program; this program does not duplicate their work.

## 1. Program charter

| Element | Statement |
|---|---|
| Scope | All Pookie information systems: production and staging app, Supabase project(s), Cloudflare Pages/Workers, sync workers (incl. portal automation), support tooling (S2/S3), notification providers, and any vendor touching user data |
| Purpose | Protect the confidentiality, integrity, and availability of user data — with heightened controls for under-13 and teen data — and provide the written program COPPA 2025 compliance requires |
| Owner | **Compliance Owner — Information Security Program Owner (to be appointed in Phase 0).** Until appointed, the Managing Director owns the appointment as a Phase-0 blocker |
| Authority | Program owner may halt any launch that fails the program's controls; reports to the Managing Director |
| Review cadence | **Annual** formal review + review after any security incident, material architecture change, or new vendor touching child/health/education/credential data |
| Versioning | Versioned, dated, append-only change log (see §9) |

## 2. Administrative safeguards

### 2.1 Risk assessment
- Methodology: annual risk assessment covering all in-scope systems; threat-model
  refresh on material changes (new module, new vendor, new data class).
- Risk register: `docs/compliance/RISK-REGISTER-INFOSEC.md` (to be created) — risk,
  owner, mitigation, residual rating, review date.
- Child-data lens: every assessment explicitly scores risks to under-13 and 13–17 data
  separately from adult data.

### 2.2 Workforce security roles
| Role | Access principle |
|---|---|
| Compliance Owner (program owner) | Full program authority; cannot self-approve exceptions |
| Engineering (Platform teams) | Least-privilege; production data access only via break-glass-with-audit |
| Support agents (2, 9–5 ET) | Least-privilege RBAC per FR-SUPPORT-005: ticket content + contact + module context only; **never health/grades without in-thread teen consent**; all agent access audited and teen-visible |
| Crisis-review vendor (contracted, D1) | Break-glass Path A scope only (coarse location + W19 card); 24/7 contract |
| Contractors / labelers | No access to check-in content, mood text, or AI-chat transcripts by default |

### 2.3 Security training
- All staff: annual security awareness (phishing, secrets handling, incident reporting).
- Privileged roles (admin console, Supabase dashboard, Cloudflare): additional training
  on key management, MFA discipline, and the never-log-plaintext rule.
- Support agents: RBAC boundaries, teen-privacy rules, crisis-keyword handling.
- Training records: completion logs with dates and material versions; retained per
  `COPPA-RETENTION-SCHEDULE.md` (workforce records — add row in v0.2).

### 2.4 Vendor-risk management
- Bound to `VENDOR-ASSESSMENT-TEMPLATE.md`: no vendor touching child, health,
  education, or credential data goes live without a completed assessment.
- Annual re-assessment; change-of-terms detection; offboarding (data return/destruction).

### 2.5 Policy change control
- Program changes require Compliance Owner + (for control changes) licensed-attorney
  review. Versioned, dated, append-only.

## 3. Technical safeguards

> Structure owned here; technical verification evidence owned by the Security Engineer.
> Each control names the evidence artifact the Security Engineer must produce.

| Control | Requirement | Evidence (Security Engineer) |
|---|---|---|
| Least privilege | Role-based access; default-deny; quarterly access reviews | Access-review reports; IAM inventory |
| MFA on admin | MFA required on **all** admin surfaces: Supabase dashboard, Cloudflare dashboard, GitHub org, email/DNS, support tooling | MFA enrollment attestation per admin |
| Encryption in transit | TLS 1.2+ on all connections; HSTS; no plaintext credential transport | Config audit; staging TLS scan |
| Encryption at rest | Supabase-managed AES-256 for DB/storage; **field-level encryption for the credentials vault** (envelope encryption — per-credential data keys wrapped by KMS-held master key; app never holds the master key in code/config) | Key-management design doc; encryption verification test |
| Authentication / session | Supabase Auth; middleware refresh every request; child-switch purges prior child's client state (FR-AUTH-008); under-13: **no sessions, no tokens, server-side ban** (FR-AGE-001) | Session-lifecycle test results; under-13 ban test |
| Security logging | `access_events` audit table (append-only; grant/revoke/request/block/safe-exit with timestamps, `granted_by`, reason codes, device/IP hashes) + security-event logging (auth failures, brute-force lockouts, purge-job outcomes) | Log coverage review; sample log inspection |
| Vulnerability management | Dependency scanning; patching cadence (critical ≤7 days, high ≤30 days — attorney/security set final); staging pen-test before production | Scan reports; patch SLAs tracked |
| Change management | Code cleanliness rule (no dead code/secrets); secret-pattern scanning in CI; no secrets in repo or client bundle (NFR-SEC-002) | CI scan evidence; pre-merge checklist |
| Never-log-plaintext | Redaction filters at: application logging, error reporting, sync-worker logs, support tooling, DB query logs. Staging canary test: submit a canary credential and assert it appears nowhere in logs | Canary-test results per release |
| Data-loss prevention | Outbound data-flow controls on AI/chat and support pipelines (no Reflection/Wellness/H2/H3 exfiltration paths) | DLP rule inventory; test evidence |

### 3.1 Child-data heightened controls
- Restricted access lists for any store holding under-13 data (row 2 of the retention
  schedule); purge verification sampled per release.
- Export controls: under-13 and H3 data never exportable without Compliance-Owner approval.

## 4. Physical safeguards (cloud-first mapping)

| Responsibility | Maps to | Evidence |
|---|---|---|
| Data-center physical security | Supabase (AWS) — inherited | Supabase SOC 2 report (via vendor assessment) |
| Edge physical security | Cloudflare — inherited | Cloudflare SOC 2 report (via vendor assessment) |
| Staff endpoints | Company-managed devices; disk encryption; remote-wipe capability; RustDesk-style remote admin in scope | Endpoint inventory + encryption attestation |
| Local media disposal | Secure disposal of any local media (NIST 800-88); no production data on staff laptops by default | Disposal log (when applicable) |

## 5. Incident response plan (reference)

- **GIPA breach runbook** (O.C.G.A. § 10-1-912): scoping (which holdings are GIPA "personal
  information" — vault + financial docs yes; grades/check-ins no — counsel confirms),
  notification decisions, FBPA enforcement hook. **Full runbook is a separate deliverable
  (Security team / counsel); this program references it and requires its existence.**
- **Security event vs breach:** a *security event* is any anomalous activity logged for
  triage; a *breach* is a confirmed unauthorized acquisition of personal information
  triggering the runbook. Triage SLA: events triaged within 24 hours (attorney confirms).
- Break-glass incidents: disclosure packages retained 7 years per FR-SAFETY-015
  (litigation-hold mechanics; spoliation guard).
- Tabletop exercise: annual; after-action report filed with the program owner.

## 6. Testing & assurance

Per Mehedi's standing test protocol (AGENTS.md) and NFR-SEC-004:
- Red teaming + penetration testing (annual; before production launch).
- SAST/DAST on every release; coverage-guided fuzz on auth/access paths; property-based
  tests on grade math and the access matrix; chaos engineering on sync workers;
  E2E load testing before launch.
- Config audits (quarterly): RLS policies, storage policies, CORS, CSP headers.
- Evidence retention: test reports retained 3 years (audit-log window).

## 7. Annual review cadence

1. Program owner conducts the annual review: control effectiveness, incident lessons,
   vendor changes, regulatory changes (COPPA, MHMDA, TX SCOPE, CA AB 2246/SB 1119, IL
   BIPA, GA horizon), and attests in writing.
2. Attorney reviews the written program annually (FTC Safeguards-style adequacy is a
   legal judgment).
3. Security leadership signs off on the technical control state.
4. Review memo filed; version bumped; change log appended.

## 8. Sign-off gate

**Requires:** licensed-attorney review of the written program + security-leadership
sign-off. **Ships without it: no production launch; staging only.**
(NFR-LEGAL-007; `docs/solutions/sol-legal.md` §1b sign-off gate.)

## 9. Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-12 | Initial issue-spotting outline | — (attorney review pending) |

## 10. Open questions for counsel

1. Confirm the workforce-records retention row to add to the schedule (v0.2).
2. Confirm triage-SLA and breach-notification linkage language.
3. Confirm the training-content standard for support agents handling teen data.
4. Confirm whether the program must be published (user-facing summary) or internal-only.
