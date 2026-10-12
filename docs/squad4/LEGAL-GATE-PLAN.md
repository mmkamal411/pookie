# Squad 4 — Legal-Gate Plan: W24 Credit & W14 Co-parenting

**Version 1.0 — 2026-10-12 · Squad 4 PM (PMP)**

**MD directive (Mehedi 2026-10-12): NO PLACEHOLDERS.** W24 and W14 ship as **fully working implementations** — real tables, real endpoints, real UI wired to real data, real RLS, E2E-tested. The "pending legal review" UI state is itself a **real, working state** driven by a `legal_gates` row — the module works; the gate is legal, not technical. Nothing about these modules is stubbed, mocked, or TODO.

---

## What "ready for counsel review" means

A module is **ready for review** when ALL of the following hold (this is the definition; counsel reviews the *working module on staging*, not a document):

### Built (technical completeness — no placeholders)
1. **Real schema**: all tables exist in staging with real columns, constraints, and RLS policies verified by attempted bypass (per QUALITY-PLAN §3).
2. **Real endpoints**: every API route enforces the access matrix + visibility scopes server-side (NFR-SEC-007); no route returns mock data; error paths are real (4xx/5xx with honest copy).
3. **Real UI**: every screen renders from live data; loading, empty, and error states are functional; no "coming soon," no disabled buttons that do nothing, no lorem ipsum.
4. **E2E green**: the module's full user journey passes end-to-end against seeded real data on staging; the smoke test covers its routes.
5. **Clean**: `tsc` clean, zero console.logs, zero dead code, zero TODOs — including zero dead branches of the *cut* designs (see below).

### Gated (legal control — real state, not a stub)
6. **`legal_gates` row** exists (`gate_key`, `module`, `status='pending'`, `reviewer=NULL`, evidence refs to the staging URL + this plan).
7. **Real-user exposure is off**: gated modules are unreachable by real families (route-level gate + menu exclusion). What any internal viewer sees is the real "under counsel review" state — live copy from the gate row, contact path, honest description of what the module will do — not a fake module.
8. **Scope locks enforced in code**:
   - W24: no 3-bureau monitoring code exists anywhere (no stubs, no dead branches — verified by grep audit).
   - W14: no shared-messaging primitive exists anywhere (verified by audit); launch surface is read-only/logistics-only.

### Reviewable (what counsel receives)
9. **Review packet** per module: (a) staging URL + test credentials for the working module; (b) this plan; (c) the exact legal questions (below); (d) the relevant expert-solution sections (sol-legal §11 for W24; R5 + FR-MOD-W14 + FR-SAFETY-011/012 for W14); (e) the audit evidence (RLS bypass tests, scope-lock grep, E2E results).

### After review
10. **Cleared** → `legal_gates.status='cleared'` with reviewer + date + evidence ref → module becomes visible to real families (route gate flips; menu shows it).
11. **Conditional** → required changes become new backlog stories; module stays gated until re-review.
12. **Risk acceptance** → only Mehedi, written, dated, filed in `docs/pm/` (per RISK-REGISTER.md risk process).

---

## W24 Credit — review packet contents

**Built:** S4-W24-01…04 — guided minor freeze placement/lift per bureau (O.C.G.A. §§ 10-1-914/914.1), confirmation tracking, lift reminders, licensed-partner coaching content store, age gating (<16 parent/guardian; 16–17 with guardian; 18+ self-service; hidden <18).

**Stubbed:** nothing. **Cut (no code):** 3-bureau monitoring, score tracking, bureau pulls — grep-audited absent.

**Counsel reviews:**
1. The freeze-management pivot: does guided freeze placement/lift for a minor's credit file avoid FCRA "permissible purpose" exposure, given the app never pulls a file? (sol-legal §11)
2. The licensed-partner contract: data-sharing limits (no child PI without explicit consent), compliance-failure termination, content-review obligations.
3. The disclaimer: "Pookie is not a credit reporting agency; we do not provide credit scores or reports" — placement (feature entry + every coaching surface) and sufficiency.
4. Age-gating: <16 parent/guardian-only freeze actions; is the 16–17 with-guardian model sound under GA law?

**Ships without sign-off:** W24 does not ship in any form to real families (sol-legal §11). The staging build remains reviewable.

## W14 Co-parenting — review packet contents

**Built:** S4-W14-01…06 — parallel-parenting surfaces (separate, no shared messaging), immutable append-only log (UPDATE/DELETE revoked at DB role), custody-order awareness (`court_order_restriction` flag interface + human-review queue; travel-restriction profile), read-only/logistics-only launch surface (handoff scheduler, shared calendar, expense log), neutral teen-facing coaching, no child-as-courier (audited).

**Stubbed:** nothing. **Constrained by design:** launch = read-only/logistics-only (R5); expansion beyond that (any messaging/negotiation) requires a *second* review.

**Counsel (family-law practitioner) reviews:**
1. Parallel-parenting mode: does the separate-surfaces + immutable-log design reduce litigation-exhibit risk vs. shared messaging? Any changes before real-family exposure?
2. The immutable log: evidentiary implications (hash chain/integrity); teen visibility; export-for-court flow.
3. Custody-order awareness: is the "flag + human review, never auto-enforce" posture correct? What must the human reviewer verify (FR-SAFETY-011)?
4. High-conflict misuse: what abuse vectors remain (e.g., log weaponization, expense-log harassment), and what mitigations are required before launch?
5. The R5 launch boundary: is read-only/logistics-only the right launch scope, or should it be narrower?

**Ships without review:** W14 stays at read-only/logistics-only behind the gate; any expansion is blocked until the practitioner clears it.

---

## Gate mechanics (shared)

- `legal_gates` table + route-level enforcement: S4-X-01 (backlog). Owned by Squad 4 (schema + enforcement); Fractional Team 1 tracks the 10 legal gates overall and supplies the review-packet templates.
- Counsel engagement timing: SCHEDULE.md says engage during P2, not P7 — Squad 4's review packets should be *ready* when counsel is engaged so W24/W14 don't idle.
- **No "temporary" exceptions** (QUALITY-PLAN gate rule): a 🛑 item's feature does not touch a real family until its fix is built **and** verified. These modules are the worked example of that rule.
