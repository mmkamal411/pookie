# Pookie Stakeholder Register

**Version 1.0 — 2026-10-12 · PMBOK §13**

---

| ID | Stakeholder | Category | Interest / stake | Influence | Engagement strategy |
|---|---|---|---|---|---|
| ST-01 | **Mehedi Kamal** | Sponsor / Product Owner | Project success; product direction; his son Dawson is the reference teen user | Very high | **Manage closely.** Sole approver for scope, design, production cutover. 5-min briefing cadence during active builds (COMMUNICATION-PLAN.md). Nothing user-facing ships without his design approval (Milestone 1 gate). |
| ST-02 | Teen users (13–17) | Primary beneficiary | Privacy, agency, safety; the access-authority model exists for them | High (design authority, not contractual) | **Empower.** Sharing screen, consent screens, safe-exit path, block list — all designed teen-first. Panel psychologist + welfare specialist own their interests. |
| ST-03 | Parent users | Buyer / optional oversight user | Tracking and guiding their children; paying customers | High | **Collaborate.** Grant/revoke own grants; transparent consequences; never promised veto power they don't have (honest marketing per spec §6). |
| ST-04 | Children under 13 | Protected class | COPPA protections; parent-managed only | Low (represented) | **Protect.** Technical guarantee of no direct collection (WBS 1.8); pediatrician + COPPA counsel own their interests. |
| ST-05 | Young adults (18+) | User | Full ownership; continuity choices | Medium | **Inform + empower.** One-time ownership prompt; Sharing screen control. |
| ST-06 | Other parent / co-parent | Secondary user | Access to shared child; parallel-parenting needs | Medium | **Accommodate.** Request-access flow; parallel-parenting mode (WBS 6.16); custody-order carve-outs. |
| ST-07 | Schools / teachers / counselors | Data originators | Grade data accuracy; counselor confidentiality (ASCA B.2); no added liability | Medium | **Consult.** Panel teachers + counselor reviewed; portal ToS posture under review (WBS 5.13). No direct integration this phase. |
| ST-08 | Licensed legal counsel (TBD) | Compliance authority | 10 sign-off gates (checklist §5) | Very high (gate) | **Engage early.** Preliminary review during P2, not at P7. Panel findings are input, not sign-off. |
| ST-09 | 18-expert panel | Advisory (completed) | Findings accepted in full by sponsor | Low (delivered) | **Reference.** Checklist is the compliance baseline; individual reviews in `docs/reviews/`, `docs/panel-reviews/`, `docs/audit-findings/`. |
| ST-10 | Build team (3 agents) | Delivery | Senior Full-Stack · Senior Backend · DevOps; coordinated via BUILD-LOG.md | Medium | **Direct.** Managing Director assigns; newest-first log entries; code-cleanliness rule on every touch. |
| ST-11 | DV / child-welfare advocates | Safety reviewers | Safe-exit copy review; retaliation-matrix review | Medium | **Consult before launch.** Required review of all revoke/notify strings (WBS 2.7). |
| ST-12 | Regulators (FTC, GA AG) | Compliance enforcers | COPPA 2025 Rule; FBPA (policy promises enforceable) | High (latent) | **Preempt.** Compliance package as launch gate (WBS 7.1). |

## Stakeholder notes

- **Dawson Kamal** (Mehedi's son, 15) is the reference teen user for school-module design but is not a formal stakeholder — all design decisions generalize beyond him per the multi-tenant direction.
- **ST-08 is the critical vacancy.** The schedule assumes counsel engagement during P2; every week without counsel compresses P7.
- Power/interest: ST-01 and ST-08 can stop the project; ST-02/ST-03 determine whether it succeeds; ST-12 determines whether it survives.
