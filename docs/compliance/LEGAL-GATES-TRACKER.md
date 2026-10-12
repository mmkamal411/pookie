# Legal Gates Tracker

**Status:** LIVING TRACKER · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Reviewed by:** the Managing Director. All 10 NFR-LEGAL gates from
`docs/BUILD-SPECIFICATION.md` §NFR-LEGAL-GATES. Attorney engagement has **not** begun on
any gate — statuses are marked honestly.

> **NOT LEGAL ADVICE.** Issue-spotting scaffold for licensed counsel. Nothing ships without
> attorney drafting/review.

**Status key:** 🔴 blocked · 🟡 in-progress · 🟢 attorney-signed

| Gate | Description | Status | Owner | Evidence |
|---|---|---|---|---|
| NFR-LEGAL-001 | **Terms of Service + arbitration + class waiver** — licensed counsel **drafts** (not reviews) the agreement; 11th Cir. post-*Concepcion*; parent/guardian as contracting party for 13–17 (minor voidability) | 🔴 blocked | Managing Director (attorney engagement) | `docs/compliance/LEGAL-POLICY-OUTLINES.md` Outline 1 (structure only — **not** the agreement) |
| NFR-LEGAL-002 | **Mandatory-reporter program** — designation decision, training, DFCS escalation (1-855-422-4453) — **before any human reads check-in content** | 🔴 blocked | Managing Director (attorney engagement) | `docs/compliance/LEGAL-POLICY-OUTLINES.md` Outline 2; D1 contracted-vendor note |
| NFR-LEGAL-003 | **18+ FERPA consent design** — consent flow + parent-credential pull pause + re-auth mechanics; postsecondary-enrollment prong; **counsel signs off before build** | 🔴 blocked | Managing Director (attorney engagement) | `docs/BUILD-SPECIFICATION.md` FR-AGE-005; sol-legal §7 (structure only) |
| NFR-LEGAL-004 | **Cooling-off notification/retaliation matrix** — DV-advocate review of all revoke/notify user-facing strings | 🔴 blocked | Managing Director (DV-advocate + attorney engagement) | `docs/BUILD-SPECIFICATION.md` FR-AGE-002; copy registry **not yet built** |
| NFR-LEGAL-005 | **Data retention + litigation-hold procedure** — per-source schedule + hold mechanics + conflict rules | 🔴 blocked | Compliance Owner (to be appointed) | `docs/compliance/COPPA-RETENTION-SCHEDULE.md` v0.1 (draft — attorney review pending); `LEGAL-POLICY-OUTLINES.md` §5 reference |
| NFR-LEGAL-006 | **Law-enforcement / subpoena response policy** — intake, verification, scope, notification, documentation; named counsel contact | 🔴 blocked | Managing Director (attorney engagement) | `docs/compliance/LEGAL-POLICY-OUTLINES.md` Outline 3 (structure only) |
| NFR-LEGAL-007 | **COPPA compliance package** — written retention policy + written infosec program + written vendor assurances (2025 Rule, enforceable now) | 🔴 blocked | Compliance Owner (to be appointed) | `docs/compliance/COPPA-RETENTION-SCHEDULE.md`; `docs/compliance/COPPA-INFOSEC-PROGRAM.md`; `docs/compliance/VENDOR-ASSESSMENT-TEMPLATE.md` — all draft; **no DPA executed (V-1)** |
| NFR-LEGAL-008 | **Court-order ingestion workflow** — who verifies, what overrides, teen notification; human review only, no auto-enforcement | 🔴 blocked | Managing Director (attorney engagement) | `docs/compliance/LEGAL-POLICY-OUTLINES.md` Outline 4 (structure only); D5 STAY-OUT posture noted |
| NFR-LEGAL-009 | **Multi-state expansion review** — WA MHMDA, TX SCOPE, CA AB 2246/SB 1119, IL BIPA, AL 2027 law — before any non-GA launch | 🔴 blocked | Managing Director (attorney engagement) | `docs/compliance/MHMDA-COMPLIANCE-MAPPING.md` v0.1 (WA only, draft); vendor template state-law posture column (starting inventory) |
| NFR-LEGAL-010 | **FTC Health Breach Notification Rule applicability** — determination whether Pookie is a PHR vendor / PHR-related entity — **before health modules hold real data** | 🔴 blocked | Managing Director (attorney engagement) | `docs/BUILD-SPECIFICATION.md` NFR-COMPLIANCE-004; no determination memo exists |

## Sequencing (per `docs/solutions/sol-legal.md` §15)

1. **Gate 1 (ToS) first** — it underwrites everything. Blocks every other gate's effectiveness.
2. Gates 2+3 (COPPA package + under-13 technical guarantees) and 5 (retention) run in
   parallel — jointly gate family onboarding and any real-data persistence.
3. Gate 3 (NFR-LEGAL-003, FERPA consent) must clear **before build** of the 18+ flow.
4. Gate 2 (NFR-LEGAL-002, mandatory reporter) must clear before any human touches
   check-in content.
5. Gates 4, 6, 8 clear before teen-revoke, launch-ops, and custody-reality features.
6. Gate 10 clears before health modules hold real data.

## Blocker summary (2026-10-12)

- **Attorney engagement: none begun.** The Managing Director owns engaging counsel for
  gates 1–4, 6, 8–10; the Compliance Owner role (gate 5, 7) is **not yet appointed** —
  appointment is itself a Phase-0 blocker.
- **Compliance drafts exist for gates 5 and 7** (this directory) but are unsigned drafts.
- **No DPA executed** with any vendor (gate 7's vendor-assurance prong is fully open).
- **No Privacy Policy exists** (gate 1's Privacy Policy + MHMDA's distinct
  consumer-health-data policy).

## Change log

| Date | Gate | Old → New | Note |
|---|---|---|---|
| 2026-10-12 | all | — → 🔴 blocked | Initial tracker; attorney engagement not begun |
