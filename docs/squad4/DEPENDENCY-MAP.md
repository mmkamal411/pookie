# Squad 4 — Dependency Map

**Version 1.0 — 2026-10-12 · Squad 4 PM (PMP)**

Every dependency names its owner, current status, and the squad's fallback. "Fallback" never means a placeholder — it means a *different complete feature* ships first.

---

## D-01 — Migration for time-boxed-grant columns on `child_access` (W12)

| Field | Detail |
|---|---|
| **What** | `child_access` needs `expires_at`, `grant_kind` ('one_time'│'recurring'│'indefinite' — 018 uses `'occasion'` for time-boxed), `grant_purpose` (NOT NULL for non-indefinite), `recurrence_rule`. Implements FR-ACCESS-011 (Proposal 2, time-boxed grants). |
| **Owner** | **Platform Team 1 — Backend Developer** (charter: "Migrations 015–023 … time-boxed grants"). NOT Squad 4. |
| **Status (2026-10-12 ~04:00 EDT) — ⚠️ NUMBERING COLLISION FOUND** | Proposal 2's "migration 023" was claimed by the health track: `023_health_reconsent.sql` (18+ re-consent) does **not** add the time-boxed columns. Meanwhile `018_access_authority.sql` already implements **D6 tiered caps** in `grant_access()` (trusted 8/30d, new 2/30d → `grant_cap_exceeded`; parent→new-grantee creates `pending_coapproval` for 13–15; teen-only approve/decline) but its function bodies reference `expires_at`/`grant_kind`/`grant_purpose` "added by 023" — **no migration in the tree actually adds those columns**. Fix needed: Platform Team 1 adds the columns in a new migration (e.g., `029_timeboxed_grants.sql`) and corrects the stale "023" comment in 018. 018's functions resolve at execution time, so ordering is safe once the columns land. |
| **Open nuance for MD** | 018 defines "trusted" as *any prior grant history* for the child; D6 says *previously approved, no blocks on record*. The block-history check is not in the RPC. Squad 4's backlog (S4-W12-03) follows D6's wording; MD/Platform Team 1 to confirm whether the RPC needs the block-history check. |
| **Squad 4 needs** | The four columns + RLS coverage + the D6-cap RPCs (already in 018, pending column migration). |
| **Fallback if late** | **S4-W12-F**: W12 ships directory + indefinite grants + one-tap manual revoke as a *complete, working feature*. Time-boxed stories (S4-W12-02…06) are code-complete behind the migration and unlock the moment the column migration is applied. No sitter-access feature is half-built: manual revoke works fully on day one. |
| **Signal** | Platform Team 1 posts the column migration + staging apply to BUILD-LOG.md; Squad 4 QA then runs S4-W12-02…06 E2E. |

## D-02 — Vault encryption / key management (NFR-SEC-006)

| Field | Detail |
|---|---|
| **What** | Envelope-encryption shape: per-credential data keys wrapped by a KMS-held master key, rotation schedule, separation of duties (app never holds the master key). |
| **Owner** | **Fractional Team 2 — Security** (charter: "Vault encryption (NFR-SEC-006) for credentials"). |
| **Status** | Assigned; design pending. |
| **Squad 4 needs** | The key-management API/contract before W7 stores anything real. **Hard precondition (sol-legal §10): no real credential persists until the encryption path is live and verified in staging** — a gated deploy check, not a policy. |
| **Fallback if late** | W7 UI + tables build against the spec'd interface (S4-W7-02) but the credential-store path stays disabled behind the real `legal_gates`-style encryption-readiness flag until Fractional Team 2's path verifies. Documents (non-credential) can still use the encrypted store once verified. |

## D-03 — Plaid (or equivalent) credentials + vendor DPA

| Field | Detail |
|---|---|
| **What** | Sandbox + production API keys for the bank-integration provider; vendor DPA covering no-training-on-inputs and breach-notification SLA (COPPA vendor assurances, sol-legal §1c). |
| **Owner** | **Managing Director** (credential procurement is MD authority). |
| **Status** | Not yet procured. |
| **Squad 4 needs** | Sandbox keys to build S4-W11-01 E2E; prod keys + DPA before any real family links a bank. |
| **Fallback if late** | Build S4-W11-01…05 against the spec'd provider interface with the sandbox contract; manual transaction entry (real table, real categorization) ships as the complete interim feature. Bank-link UI shows a real "provider connecting soon" state only after MD confirms the vendor — never a fake connected state. |

## D-04 — OCR vendor selection + assessment

| Field | Detail |
|---|---|
| **What** | OCR vendor for W21 photo intake: data-processing terms, no-training-on-inputs, breach-notification SLA (sol-legal §1c). |
| **Owner** | **Fractional Team 1 — Compliance** (vendor assurances) + **Managing Director** (vendor choice). |
| **Status** | Not yet selected. |
| **Squad 4 needs** | Vendor API contract to build S4-W21-01 E2E. |
| **Fallback if late** | W21 intake UI + extraction/masking pipeline built against the spec'd OCR interface; the *photo-capture* path stays behind the W21 `legal_gates` row until the vendor clears compliance review. Extract-then-mask (S4-W21-02) and auto-delete (S4-W21-03) are vendor-independent and proceed. |

## D-05 — Licensed counsel: FCRA sign-off (W24)

| Field | Detail |
|---|---|
| **What** | Licensed attorney (FCRA/consumer-finance) signs off on the freeze-management pivot + licensed-partner contract (sol-legal §11). |
| **Owner** | **Fractional Team 1 — Compliance** (10 legal gates tracking); engagement by **Managing Director/Mehedi**. |
| **Status** | Counsel not yet engaged (SCHEDULE.md: engage during P2, not P7). |
| **Squad 4 plan** | Build S4-W24-01…04 fully; E2E in staging; gate real-family exposure on the `legal_gates` row. See LEGAL-GATE-PLAN.md. |

## D-06 — Family-law practitioner review (W14)

| Field | Detail |
|---|---|
| **What** | Family-law practitioner reviews the parallel-parenting design (R5) before launch beyond read-only/logistics-only. |
| **Owner** | **Fractional Team 1 — Compliance**; practitioner engaged by **Managing Director/Mehedi**. |
| **Status** | Not yet engaged. |
| **Squad 4 plan** | Build S4-W14-01…06 fully; E2E in staging; launch surface = read-only/logistics-only; expansion past that requires the review gate. See LEGAL-GATE-PLAN.md. |

## D-07 — GIPA/consumer-finance counsel review (W21/W7/W11 photo intake + vault)

| Field | Detail |
|---|---|
| **What** | Licensed attorney reviews extract-then-mask design, FTC Disposal Rule applicability, teenPrivate treatment (sol-legal §12), and the vault encryption design + breach-notification linkage (sol-legal §10). |
| **Owner** | **Fractional Team 1 — Compliance**. |
| **Status** | Not yet engaged. |
| **Squad 4 plan** | Photo intake (W21) and credential storage (W7) stay behind their `legal_gates` rows until review clears. Masking, auto-delete, and retention jobs are built regardless — they are the compliance posture itself. |

## D-08 — `court_order_restriction` flag + human-review queue (FR-SAFETY-011/012)

| Field | Detail |
|---|---|
| **What** | Court-order ingestion workflow: `court_order_restriction` flag, human-review queue (WBS 7.6). W14 custody-order awareness (S4-W14-03) reads this flag. |
| **Owner** | **Platform Team 1** (access model; WBS 7.6 sits in the compliance package — confirm owner with MD if unclear). |
| **Status** | Spec'd (FR-SAFETY-011/012), not built. |
| **Fallback if late** | S4-W14-03 builds against the spec'd flag interface; W14 launch treats *all* claimed custody orders as "pending verification" (fail-closed: no auto-enforcement, human review required) until the workflow lands. |

## D-09 — Menu age-gating (Credit hidden <18)

| Field | Detail |
|---|---|
| **What** | Popup menu age-gating from `modules.ts` (WBS 3.5): W24 Credit hidden from teen accounts. |
| **Owner** | **Platform Team 2** (popup menu shell). |
| **Status** | Assigned; in build. |
| **Fallback if late** | S4-W24-04 enforces the same age rule server-side in W24's own routes — the menu hiding is presentation; the enforcement never depends on it. |

---

## Dependency graph (Squad 4 view)

```
P0 DB access (Mehedi) ──► time-boxed columns migration, e.g. 029 (Platform T1) ──► S4-W12-02…06 (time-boxed grants)
        │                        │
        │                        └──► grant/revoke RPCs w/ D6 caps (018, Platform T1 — DONE, pending columns)
        │
        ├──► vault key mgmt (Fractional T2) ──► S4-W7-01…05 (encrypted vault)
        │
        ├──► Plaid keys+DPA (MD) ──► S4-W11-01 (bank sync)
        │
        ├──► OCR vendor+DPA (MD/Fractional T1) ──► S4-W21-01 (photo intake)
        │
        └──► counsel engagement (MD/Mehedi) ──► legal_gates cleared ──► W24/W14/W21-photo/W7-creds to real families
```

**Squad 4 rule:** we never block on another team when a complete-feature fallback exists. We build against the spec'd interface, mark the integration point, and ship the fallback as a real feature.
