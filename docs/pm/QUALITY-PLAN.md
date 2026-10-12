# Pookie Quality Management Plan

**Version 1.0 — 2026-10-12 · PMBOK §8 · Built on Mehedi's standing test protocol (AGENTS.md)**

---

## 1. Quality policy

Nothing is "done" until it is verified. Code written is not tested; tested is not deployed; deployed is not live until a URL is personally loaded and confirmed (trust rule). A 🛑 checklist item's feature does not touch a real family until its fix is built **and** re-verified by the owning expert domain or QA.

## 2. Test protocol mapped to WBS phases

Mehedi's standing protocol has seven areas. Each phase runs the applicable subset; P8 runs all seven.

| Protocol area | P1 Foundation | P2 Access Model | P3 Menu/Onboarding | P4 Health | P5 School | P6 AI/Safety | P8 Release |
|---|---|---|---|---|---|---|---|
| **Functional:** unit (auth math, scope logic), integration (API → RLS → UI), E2E (full user journeys) | Auth unit + RLS integration | Full access-model E2E (invite→verify→grant→revoke→safe-exit→independence→18+) | Onboarding E2E; menu navigation | Tier-enforcement E2E | Provenance + inbox E2E | Crisis-protocol E2E | All journeys |
| **Non-functional:** performance (load, fetch waterfall), load (concurrent), usability (data-shape robustness), cross-browser/device (iOS Safari, Chrome, desktop), accessibility (labels, contrast, keyboard, reduced-motion) | Migration timing | Scope-filter latency | Popup menu perf; a11y | — | Class-page robustness (long titles, missing fields) | — | Full matrix |
| **Daily-update audit** (source → pull → storage → render, zero manual intervention) | — | — | — | Health sources | All 13 school sources; peer-tips; SAT; weather; quote | Nudge sources | Full audit |
| **Production optimization** (app + storage speed, RLS/query efficiency, cache headers, zero-error verification) | RLS efficiency on new policies | Scope-filter query plans | — | — | — | — | Full pass |
| **Housekeeping** (code cleanup, dead code, version hygiene) | Every phase | Every phase — Mehedi's standing rule: no dead code, no console.logs, clean what you touch | | | | | |
| **Security** (RLS verification, no secrets in repo/bundle, XSS audit, pen-style auth-bypass on tables and storage) | RLS on 017–021; `granted_by` bypass attempts | IDOR on child_access; scope-leakage attempts; revoked-parent access attempts | — | Tier-bypass attempts | Counselor-mail leakage attempts | Prompt-injection on AI | Full pen-test |
| **Advanced deep testing** (standing directive): red-team + pen-test attack chains; SAST/DAST; coverage-guided fuzz; property-based (invariants); formal verification of auth/RLS/sync state machine; chaos (kill Supabase mid-sync, drop network mid-pull); massive E2E load | — | Property-based: grant/revoke invariants hold across generated input spaces | — | — | Chaos: kill Supabase mid-sync | Red-team AI guardrails | **All** |

## 3. Definition of Done per phase

A phase exits only when **all** hold:

1. **Code complete:** all work packages in the phase built; `npx tsc --noEmit` clean; no console.logs; no dead code (code-cleanliness rule).
2. **Checklist marks flipped:** every ⚠️/🛑 item the phase addresses is re-verified to ✅ by QA or the owning expert domain.
3. **Security:** RLS policies verified by attempted bypass; no secrets in repo or bundle (grep-verified).
4. **Smoke test:** `deploy-staging.py` post-deploy smoke passes on staging; Mehedi's trust rule satisfied (URL personally loaded).
5. **Logged:** BUILD-LOG.md entry with evidence, not claims.

## 4. Gates

| Gate | Rule |
|---|---|
| Deploy gate | `smoke-test-staging.py` must pass before any "deployed" announcement (AGENTS.md lesson). Wired into `deploy-staging.py`; extend with access-model routes in P2. |
| 🛑 launch gate | A blocked feature does not ship to a real family until its fix is built and verified. No "temporary" exceptions. |
| Counsel gate | P7 exit requires licensed-counsel sign-off on all 10 gates (or Mehedi's written risk acceptance per gate). |
| Design gate | Nothing user-facing ships until Mehedi approves the design direction (Milestone 1 gate, standing). |
| Production gate | Explicit Mehedi go-ahead only; staging verified first; signup toggle OFF. |

## 5. Defect handling

- Defects found in phase N are fixed in phase N — they do not ride into N+1 as known issues unless Mehedi explicitly accepts them as documented tech debt with a remediation phase.
- Security defects (RLS bypass, scope leak, auth bypass) stop the line: the phase does not exit until fixed and re-tested.
- Flaky tests are defects in the test, not "environment issues" — fix or quarantine with a dated ticket.

## 6. Metrics (lightweight — serve the build, not the paperwork)

- Smoke-test pass rate per deploy (target: 100%)
- 🛑 items cleared per phase vs planned
- RLS bypass attempts blocked (pen-test findings closed)
- Time from defect found → fixed (target: within the same phase)
- Mehedi verification lag: deploys awaiting his URL check (flag if >48h — blocks the trust rule)
