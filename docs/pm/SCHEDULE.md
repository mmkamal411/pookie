# Pookie Project Schedule

**Version 1.0 — 2026-10-12 · PMBOK §6 · Dependency-driven (no false precision on dates)**

Mehedi works in intense bursts; the schedule is phase-gated, not calendar-driven. A phase exits only when its exit criteria are met. Durations are relative (S/M/L) to avoid committing to dates the build can't keep.

---

## Phase map & dependencies

```
P0  DB Access (external) ──┐
                           ▼
P1  Foundation (1.0) ──► P2  Access Model (2.0) ──► P3  Menu & Onboarding (3.0)
       │                         │                           │
       │                         ▼                           ▼
       │                    P4  Health (4.0)            P5  School (5.0)
       │                         │                           │
       └─────────────────────────┴─────────────► P6  AI & Safety (6.0)
                                                     │
                                                     ▼
                                                P7  Compliance (7.0)
                                                     │
                                                     ▼
                                                P8  QA & Release (8.0)
```

**Dependency logic:**
- **P0 → P1:** nothing touches the staging DB until Mehedi verifies `schema_migrations` and applies (or authorizes) the migration chain. This is the single external dependency and the top schedule risk.
- **P1 → P2:** access-model RPCs need the 017–021 schema in place.
- **P1 → P4/P5:** health and school work needs profiles + the under-13 technical guarantee + vault encryption.
- **P2 → P6:** crisis routing and trusted-adult infrastructure must exist before AI guardrails are verifiable.
- **P2 + P4 → P7:** the compliance package needs the access model and health tiers built to document them accurately.
- **P7 → P8:** no release-readiness testing until counsel gates are cleared — testing an unlawful design is rework.

## Critical path

**P0 → P1 → P2 → P6 → P7 → P8**

The longest chain runs through the database, the access model, AI/safety, compliance, and release. P3 (menu), P4 (health), and P5 (school) have float — they can parallelize once P1 lands, but P4's H0–H3 taxonomy (4.1) is itself a predecessor for any health module going live.

**Near-critical:** 4.1 (H0–H3 taxonomy) — RISK-005. If it slips, W2/W8/W23 stay dark and the Health category ships hollow.

## Phase exit criteria

| Phase | Exit criteria (all must hold) |
|---|---|
| P0 DB Access | `schema_migrations` verified; Mehedi confirms which of 001–016 are applied; written runbook for the remainder |
| P1 Foundation | 014–021 applied to staging DB; profiles + onboarding rows creatable; under-13 ban tested (attempted login rejected server-side); vault encryption on |
| P2 Access Model | Full E2E passes: invite → verify → consent → link → grant → revoke → cooling-off → safe-exit → independence → 18+ prompt; audit trail queryable; trusted-adult flow blocks revoke without designation |
| P3 Menu & Onboarding | Popup menu live with 6 categories; onboarding completable and skippable; "just me" dashboard renders with zero parenting upsells; Mehedi approves UX (Milestone 1 gate) |
| P4 Health | H0–H3 taxonomy built and enforced; W2/W8/W23 meet panel conditions or remain dark by explicit decision |
| P5 School | Provenance rule enforced; counselor mail segregated; check-ins teen-only; quiz pipeline verified or flashcards-only |
| P6 AI & Safety | Crisis protocol live; Muse 18+ gated; nudge guardrails verified; mandatory-reporter decision documented |
| P7 Compliance | COPPA package complete; retention schedule implemented; ToS live; all 10 counsel gates signed (or formally deferred with risk acceptance by Mehedi) |
| P8 QA & Release | Full test protocol passed per QUALITY-PLAN; pen-test clean; Mehedi personally verifies staging; production cutover approved in writing |

## Milestone alignment

| Charter milestone | Schedule phase |
|---|---|
| M1 Foundation | P1 |
| M2 Access Model | P2 |
| M3 Menu & Onboarding UX | P3 |
| M4 Health gated launch | P4 |
| M5 School hardened | P5 |
| M6 AI & Safety | P6 |
| M7 Compliance package | P7 |
| M8 Release readiness | P8 |

## Schedule risks & reserves

- **P0 is the dominant risk.** Every downstream phase queues behind Mehedi's dashboard session. Mitigation: prepare everything that doesn't need the DB (code, migrations 017–021 written and syntax-checked, UI built against the contract) so P0→P1 is a single apply-and-verify session.
- **Counsel gates (P7) have unbounded duration.** Mitigation: engage counsel during P2, not at P7 — send the access-model spec and checklist for preliminary review while building.
- **No schedule compression on 🛑 items.** A blocked feature does not ship "temporarily" — the panel was explicit, and the sponsor accepted all recommendations.

## Tracking

Phase status lives in BUILD-LOG.md (newest-first entries). Phase transitions are announced there with exit-criteria evidence, not claims.
