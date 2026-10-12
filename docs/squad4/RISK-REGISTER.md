# Squad 4 — Risk Register (Top 5)

**Version 1.0 — 2026-10-12 · Squad 4 PM (PMP) · Format aligned with docs/pm/RISK-REGISTER.md**

Escalation path: any squad risk that becomes 🔴 goes to the Managing Director via BUILD-LOG.md within one working session; only Mehedi can accept a 🔴 risk (written, dated, filed in `docs/pm/`).

---

### S4-RISK-001 — Plaid (or equivalent) integration risk 🟠 High / 🟠 High

| Field | Detail |
|---|---|
| Description | W11's core value (automatic transaction sync) depends on a third-party bank aggregator: vendor selection, credential procurement, API reliability, webhook delivery, institution coverage gaps, and the vendor DPA (no-training-on-inputs, breach SLA). Any slip here strands S4-W11-01, the highest-pointed story in the squad. |
| Probability / Impact | 🟠 High / 🟠 High — single-vendor dependency with external procurement. |
| Owner | Squad 4 Tech Lead; procurement by Managing Director. |
| Mitigation | **(1)** Build S4-W11-01 against the spec'd provider interface immediately — no waiting for keys. **(2)** Ship manual transaction entry (real table, real categorization) as the complete interim feature so W11 delivers value with zero vendor dependency. **(3)** MD procures sandbox keys first (build unblocked), prod keys + signed DPA second (real-family unblocked). **(4)** Sync-health monitoring: failed syncs surface a real reconnect path; an unlinked account shows "not connected," never fake data. |
| Contingency | If the vendor falls through, re-target the interface to the backup aggregator — the interface boundary isolates the switch to one adapter. |
| Backlog ref | S4-W11-01; DEPENDENCY-MAP.md D-03. |

### S4-RISK-002 — OCR accuracy on real-world mail photos 🟡 Medium / 🟠 High

| Field | Detail |
|---|---|
| Description | Phone photos of mail are skewed, shadowed, creased, and low-contrast. OCR misses/wrong amounts or due dates become *actionable* errors (missed bill → late fee). The extract-then-mask pipeline (S4-W21-01/02) is only as good as the extraction. |
| Probability / Impact | 🟡 Medium (vendor-dependent) / 🟠 High (wrong amount/due-date has financial consequences). |
| Owner | Squad 4 Tech Lead. |
| Mitigation | **(1)** Every extracted field is user-confirmable before it becomes a record — OCR proposes, the user confirms; nothing auto-files from raw OCR. **(2)** Confidence scores: below-threshold fields are flagged, never silently accepted. **(3)** On-device redaction guidance (S4-W21-01 AC2) doubles as capture guidance (flat, lit, full page) to raise input quality. **(4)** Vendor evaluated on a real-mail test set before selection (Fractional Team 1 assessment). |
| Contingency | If accuracy is unacceptable, W21 degrades to manual entry with photo *attachment* (real feature) while the vendor is swapped — the masking and auto-delete stories are vendor-independent and still ship. |
| Backlog ref | S4-W21-01, S4-W21-02. |

### S4-RISK-003 — FCRA exposure if W24 drifts from the freeze-management scope 🔴 Certain if it happens / 🔴 Critical

| Field | Detail |
|---|---|
| Description | The panel was explicit: 3-bureau monitoring has **no FCRA permissible purpose** and the bureaus won't furnish. Any re-introduction of score tracking, bureau pulls, or "credit monitoring" language — even as a stub or a future-flag — recreates the exact liability the re-scope was designed to kill. This is a scope-creep risk, not a technical risk. |
| Probability / Impact | 🟡 Medium (drift pressure) / 🔴 Critical (FCRA liability). |
| Owner | Squad 4 PM; gate owned by Fractional Team 1. |
| Mitigation | **(1)** Scope lock in code: no bureau-pull integration exists anywhere; grep audit for `bureau|score|monitoring` in W24 paths is part of the review packet. **(2)** The legal-gate plan makes FCRA counsel sign-off a hard gate — W24 does not ship in any form without it (sol-legal §11). **(3)** Disclaimer placement is an acceptance criterion (S4-W24-03 AC1), not copy to be added later. **(4)** Any future request to add bureau data is a scope-change decision for Mehedi + counsel, never a sprint task. |
| Contingency | If counsel rejects the pivot, W24 is cut from launch scope (the menu degrades gracefully — seedlings already exist) rather than shipped in a riskier form. |
| Backlog ref | S4-W24-01…04; LEGAL-GATE-PLAN.md. Panel ref: Cat 4; RISK-012. |

### S4-RISK-004 — High-conflict misuse of W14 (weaponization) 🟠 High / 🔴 Critical

| Field | Detail |
|---|---|
| Description | In high-conflict separations, *any* co-parenting surface can become a weapon: the immutable log as a litigation exhibit factory, expense logging as harassment, handoff scheduling as control. The panel blocked the original design for exactly this reason (G16). Building parallel-parenting mode wrong is worse than not building it — it gives conflict a Pookie-branded venue. |
| Probability / Impact | 🟠 High (adversarial users are the expected users) / 🔴 Critical (real family harm + liability). |
| Owner | Squad 4 PM; design review by family-law practitioner. |
| Mitigation | **(1)** Parallel-parenting mode is the *only* design: separate surfaces, no shared messaging primitive in the codebase (S4-W14-01 AC1), no child-as-courier (S4-W14-06). **(2)** Launch is read-only/logistics-only (R5) — the smallest surface that can be misused. **(3)** Family-law practitioner reviews the *working module* before any real-family exposure; expansion requires a second review (LEGAL-GATE-PLAN.md). **(4)** Custody-order awareness fails closed: claimed orders are "pending verification," never auto-enforced (D-08 fallback). **(5)** Teen-facing copy is neutral and bilateral; pattern flags are factual (S4-W14-05). |
| Contingency | If the practitioner finds the design unsafe even in logistics-only form, W14 is cut from launch and the squad's capacity redirects to W12/W21 hardening. |
| Backlog ref | S4-W14-01…06; LEGAL-GATE-PLAN.md. Panel ref: G16; RISK-013; R5. |

### S4-RISK-005 — Teen purchase-detail privacy failure in W11 🟡 Medium / 🔴 Critical

| Field | Detail |
|---|---|
| Description | FR-MOD-W11 requires the teen's own purchase detail to be teen-private; parent surfaces show aggregates only within granted scopes. A filtering bug (client-side hiding instead of server-side filtering, a digest that includes line items, an export that leaks) exposes a teen's private purchases to a parent — a trust-destroying event that inverts the child-as-access-authority model (Charter O3). |
| Probability / Impact | 🟡 Medium (filtering bugs are common) / 🔴 Critical (privacy violation against a minor; model-inverting). |
| Owner | Squad 4 Tech Lead + QA. |
| Mitigation | **(1)** Scope filtering is server-side only (NFR-PRIVACY-004) — S4-W11-04 AC1 requires bypass attempts to return 403, tested and documented. **(2)** The rule is verified across *every* surface: UI, digests, nudges, API responses, exports (S4-W11-04 AC3) — one surface missed is a finding. **(3)** Property-based test: for generated scope matrices, parent-visible transaction sets never contain teen-private line items. **(4)** QA includes a dedicated teen-privacy pass in the W11 milestone exit (QUALITY-PLAN §3). |
| Contingency | Any leak found in testing stops the W11 milestone (security defects stop the line — QUALITY-PLAN §5) until fixed and re-tested. |
| Backlog ref | S4-W11-04. Spec ref: FR-MOD-W11; NFR-PRIVACY-004; Charter O3. |

---

## Watch list (not top 5, tracked)

- **S4-RISK-006** — Vault key-management delay (Fractional Team 2) stalls W7 credential storage → fallback in D-02 (documents-first, credentials behind readiness flag).
- **S4-RISK-007** — Time-boxed-grant column migration lateness (Platform Team 1; numbering collision found — see D-01) strands W12 time-boxed grants → fallback S4-W12-F (manual revoke ships as complete feature).
- **S4-RISK-008** — Counsel engagement timeline (P7 unbounded) → MD engages during P2; review packets pre-built so W24/W14 don't idle.
- **S4-RISK-009** — Installment-detection false positives annoy legitimate weekly sitters → D6 tiered caps (8/30d trusted) already absorb the real-world case; detection thresholds tunable post-launch with teen-visibility intact.
