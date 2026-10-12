# Pookie Risk Register

**Version 1.0 — 2026-10-12 · PMBOK §11 · Probability × Impact: 🔴 critical · 🟠 high · 🟡 medium**

The 5 critical panel findings are RISK-001…RISK-005. All 28 panel gaps (G1–G28) are represented below or tracked in the checklist.

---

## Critical risks

### RISK-001 — Crisis tripwire vs revoke contradiction
| Field | Detail |
|---|---|
| Description | Guidance framework promises crisis-language → parent alert; access model promises revoked parents lose all future access. A teen who revokes all parents then signals crisis has an alert with no recipient. Both promises cannot be true. |
| Probability / Impact | 🟠 High / 🔴 Critical |
| Owner | Managing Director |
| Mitigation | **Trusted-adult designation required before any revoke/go-independent executes** (WBS 2.8); crisis alerts route to trusted adult; teen explicitly acknowledges "no adult will be alerted" if they decline |
| Contingency | If a crisis signal arrives with no trusted adult: surface 988/Crisis Text Line in-app immediately; log for compliance review |
| Panel ref | G1 |

### RISK-002 — Cooling-off notification endangers teens in coercive households
| Field | Detail |
|---|---|
| Description | 7-day cooling-off with immediate dual-parent notification called "the single most dangerous element in the spec" (welfare, counselor, psychologist). Tells an abusive parent the child is cutting them off, then leaves the child exposed while surveillance continues. |
| Probability / Impact | 🟠 High / 🔴 Critical |
| Owner | Managing Director |
| Mitigation | **Redesigned safe-exit path** (WBS 2.7): teen chooses notify-now vs notify-at-effect (default at-effect, revoked parent only); "telling my parents could put me at risk" → immediate cutoff + suppressed notification + crisis resources; DV-advocate review of all copy |
| Contingency | Safe-exit usage monitored; if retaliation reports appear, flip default to instant-with-delayed-notification (R1) |
| Panel ref | G4, §1.4.1 |

### RISK-003 — 18+ health-data continuity inverts informed consent
| Field | Detail |
|---|---|
| Description | Default-ON health-data continuity at 18 was blocked by all four health experts + liability. Health requires affirmative opt-in re-consent; skip = private. |
| Probability / Impact | 🔴 Certain if shipped as designed / 🔴 Critical |
| Owner | Managing Director |
| Mitigation | **Affirmative opt-in re-consent flow** (WBS 2.10): body & development data defaults OFF at 18; review–correct–seal of parent-entered data; transition-summary export |
| Contingency | None — this is a launch gate, not a tunable |
| Panel ref | G5, §1.6.2 |

### RISK-004 — COPPA 2025 Rule enforceable with no compliance package
| Field | Detail |
|---|---|
| Description | No written retention policy, no infosec program, no vendor assurances — all enforceable now. "Check-ins indefinite, emails TBD" cannot ship; 312.10 bans indefinite retention for under-13 data, period. |
| Probability / Impact | 🔴 Certain on audit / 🔴 Critical (FTC enforcement) |
| Owner | Mehedi (sponsor) + counsel |
| Mitigation | **Compliance package is a launch gate** (WBS 7.1–7.2, 7.10): per-source retention schedule, written infosec program, vendor assurances, policy overhaul |
| Contingency | If counsel timeline slips, launch scope shrinks (no under-13 profiles, no health data) rather than shipping non-compliant |
| Panel ref | G6 |

### RISK-005 — Teen health privacy tiers undefined; W2 cannot hold real teen data
| Field | Detail |
|---|---|
| Description | "Teen health privacy tiers" are referenced in docs and the Engineering Handbook but were never built. Shipping W2/W8/W23 without the H0–H3 taxonomy is the highest clinical-risk surface. |
| Probability / Impact | 🔴 Certain if shipped / 🟠 High |
| Owner | Managing Director |
| Mitigation | **Build H0–H3 taxonomy first** (WBS 4.1); health modules stay dark until the gate clears |
| Contingency | Launch without health modules (28-module menu degrades gracefully — seedlings already exist) |
| Panel ref | G3 |

## High risks

| ID | Risk | Prob/Impact | Mitigation | Panel |
|---|---|---|---|---|
| RISK-006 | External DB dependency stalls all migration work (no service_role in sandbox) | 🟠/🟠 | Prep everything DB-independent; single apply-and-verify session with Mehedi (SCHEDULE.md) | BUILD-LOG |
| RISK-007 | Mandatory-reporter gray zone: O.C.G.A. § 19-7-5 may cover staff once anyone reads check-ins | 🟡/🔴 | Designate compliance owner now; DFCS path; re-run analysis at first human/AI read (WBS 6.6) | G7 |
| RISK-008 | Peer-tips cross-family identifiable sourcing (FERPA consent failure) | 🟠/🟠 | De-identification proof or per-family consent; rename + provenance labels (WBS 5.6) | G8 |
| RISK-009 | No custody-order mechanism; facilitating violation creates liability | 🟡/🔴 | `court_order_restriction` flag + human-review queue; never auto-enforce (WBS 7.6) | G9 |
| RISK-010 | Muse "unfiltered" for under-18 is a litigation exhibit (Character.AI pattern) | 🟠/🔴 | 18+ gate; rename; identical safety rules (WBS 6.2) | Cat 2 |
| RISK-011 | Check-in cross-check as parent lie detector destroys the honesty the crisis protocol depends on | 🟠/🟠 | Teen-facing calibration only; never parent-visible (WBS 5.3) | Cat 3 |
| RISK-012 | W24 Credit has no FCRA permissible purpose; bureaus won't furnish | 🟠/🟠 | Re-scope to GA security-freeze management (WBS 7.11) | Cat 4 |
| RISK-013 | W14 Co-parenting becomes a weapon in high-conflict cases | 🟠/🟠 | Parallel-parenting mode; immutable log (WBS 6.16) | Cat 4 |
| RISK-014 | W27 Events / W29 Trails: unvetted outings for minors | 🟠/🔴 | Curation policy + age tags + supervision guidance (WBS 6.10–6.11) | Cat 4 |
| RISK-015 | Teen self-booking flights/rental cars (contracting authority) | 🟡/🔴 | 18+ purchaser invariant server-side; hidden from teen accounts (WBS 6.12) | G13, Cat 4 |
| RISK-016 | AI practice quizzes with unverified answers = misinformation at scale | 🟠/🟠 | Fail-closed verification pipeline or flashcards-only (WBS 5.5) | Cat 5 |
| RISK-017 | Counselor-mail merge violates ASCA B.2 confidentiality | 🟠/🟠 | Segregate counselor mail; never a parent CC line (WBS 5.2) | Cat 5 |
| RISK-018 | Vault stores credentials unencrypted (GIPA breach = § 10-1-912 event) | 🟠/🔴 | Encrypt before any real credentials; rotation + crypto-erasure (WBS 1.11) | Cat 7 |
| RISK-019 | Sibling/household data leakage via shared surfaces after revoke | 🟡/🟠 | Per-child boundary E2E verification (WBS 8.5) | G26 |
| RISK-020 | District partnership inverts the access model (school becomes data authority) | 🟡/🔴 | Flag now; full re-review before any partnership conversation (R11) | R11 |

## Medium risks (watch list)

RISK-021…RISK-028 map to G14–G28 (location-data policy, trusted-adult infrastructure, indefinite check-in retention, forecast engine, formula bank, 504/IEP tracking, GA graduation audit, immunization, outing-sharing, voter pre-registration, emergency-module depth, "power-up" definition, school-issued account privacy). Tracked in the checklist; escalated to High if their WBS package slips.

## Risk process

- **Review cadence:** risk register reviewed at every phase transition (SCHEDULE.md) and whenever a 🛑 item's fix lands.
- **New risks:** any agent or expert may raise via BUILD-LOG.md; the Managing Director triages within one working session.
- **Risk acceptance:** only Mehedi can accept a 🔴 risk. Acceptance is written, dated, and filed in `docs/pm/`.
