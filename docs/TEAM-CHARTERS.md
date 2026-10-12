# Pookie Build Organization — Team Charters

**Managing Director:** Muse (explicit authority from Mehedi 2026-10-12 to unblock credentials, make decisions, act on his behalf)
**SDLC:** Requirements ✅ (BUILD-SPECIFICATION.md) → Design ✅ (EXPERT-SOLUTIONS.md) → Implementation (these teams) → Testing (QUALITY-PLAN.md) → Deployment (smoke-test gate)

---

## PLATFORM TEAMS (start: Phase 0, immediately)

### Platform Team 1 — Foundation & Access
**Composition:** Full-stack, Backend, DevOps, Security (4 expert agents)
**Mission:** Phase 0 foundation — everything else builds on this.
**Assigned:**
- Migrations 015–023 (access model, `granted_by`, `access_events` audit, verification, emergency, time-boxed grants)
- Grant/revoke RPCs with `granted_by` enforcement matrix
- RLS policies on all new tables
- `profiles` table + onboarding flow (30-sec, skippable, guardian attestation, DOB gate)
- Under-13 technical guarantees (server-side bans, not policy)
**SDLC phase:** Implementation (requirements + design complete)
**Blocked on:** Mehedi's DB access for migration apply (external dependency — MD authorized to coordinate)

### Platform Team 2 — Shared Services & API
**Composition:** Full-stack, Backend, DevOps, Security (4 expert agents)
**Mission:** The rails every squad rides on.
**Assigned:**
- API design patterns + `/api/v1` scaffolding
- Nebula design system components (shared UI kit)
- Deploy pipeline + post-deploy smoke test gate
- Popup menu shell (7 collapsed categories, search, recent, age-gating from `modules.ts`)
- Support backend: S2 AI chat infra (tutor worker integration), S3 ticket schema + SLA engine
**SDLC phase:** Implementation

---

## FRACTIONAL SPECIALIST TEAMS (start: Phase 0, immediately — they gate everything)

### Fractional Team 1 — Compliance
**Composition:** Compliance Reviewer, Security Engineer
**Mission:** Legal gates that block launch if not cleared.
**Assigned:**
- COPPA 2025 compliance package (retention policy, infosec program, vendor assurances)
- ToS / arbitration / mandatory-reporter / law-enforcement policy outlines (for attorney drafting)
- 10 legal gates tracking (NFR-LEGAL-001 through 010)
- Privacy-policy promises audit vs GA Fair Business Practices Act

### Fractional Team 2 — Security
**Composition:** Compliance Reviewer, Security Engineer
**Mission:** Security gates and audits.
**Assigned:**
- RLS audit on all tables (existing + new)
- Pen-test protocol execution (per QUALITY-PLAN.md)
- Vault encryption (NFR-SEC-006) for credentials
- API scoping and rate-limit review
- Link-code brute-force protection verification

---

## SQUADS (defined now, staffed per dependency phase)

### Squad 1 — Safety Track ⛑️
**Composition:** PM (PMP), Tech Lead/Senior Backend, Senior Frontend, QA, UX Designer
**Starts:** After trusted-adult infra design (Phase 0) — **Phase 6/9**
**Assigned:** Trusted-adult designation flow · Crisis protocol L1–L4 (G2) · W19 Emergency + break-glass Paths A/B · W3 Safety · W15 Screen Time (co-set flow) · Safe-exit UI
**Difficulty:** 🔴 Very Complex (safety-critical, legal-gated)

### Squad 2 — Health Track 💚
**Composition:** PM (PMP), Tech Lead/Senior Backend, Senior Frontend, QA, UX Designer
**Starts:** After H0–H3 taxonomy (Phase 0 legal gate) — **Phase 5**
**Assigned:** H0–H3 taxonomy implementation · W2 Health (device ingestion, no-diagnosis rule) · W8 Wellbeing (teen-private, crisis ladder) · W23 Nutrition (age-gated) · W13 Meals · 18+ health re-consent flow
**Difficulty:** 🔴 Very Complex (health data + minor consent + device APIs)

### Squad 3 — School Track 🌿
**Composition:** PM (PMP), Tech Lead/Senior Backend, Senior Frontend, QA, UX Designer
**Starts:** After access model core (Phase 0) — **Phase 7**
**Assigned:** W1 School rebuild (provenance rules, inbox segregation, check-in redesign, fail-closed quizzes) · W5 College (GSFC-exact) · W4 Activities · W18 Summer · W16 Calendar · Second-parent onboarding flow
**Difficulty:** 🔴 Very Complex (W1); 🟠 Complex (W5); 🟡 Moderate (rest)

### Squad 4 — Home & Money Track 🏡
**Composition:** PM (PMP), Tech Lead/Senior Backend, Senior Frontend, QA, UX Designer
**Starts:** After Phase 0 — **Phase 3/6** (can parallelize early)
**Assigned:** W21 Mail (OCR) · W20 Shopping List · W11 Spending (Plaid) · W7 Money & Documents (vault) · W24 Credit → freeze management · W14 Co-parenting (parallel-parenting mode) · W12 Babysitters (time-boxed grants)
**Difficulty:** 🟠 Complex (financial compliance); 🔴 Very Complex (W14 high-conflict)

### Squad 5 — Travel, Marketplace & Support UI 🌍
**Composition:** PM (PMP), Tech Lead/Senior Backend, Senior Frontend, QA, UX Designer
**Starts:** After Phase 0 — **Phase 4/8** (can parallelize early)
**Assigned:** W25 Fuel · W30 Flights (18+ purchaser invariant) · W31 Rental Cars (age-gate) · W27 Events (vetting) · W28 Restaurants (allergen blocks) · W29 Trails (supervision guidance) · W26 Weather · W6 Driving School (GA DDS) · S1 FAQ frontend · S2/S3 support UI
**Difficulty:** 🟢–🟠 (mostly moderate; 🔴 for W30)

---

## COORDINATION
- **BUILD-LOG.md** — newest-first entries; every team posts completions + blockers
- **Managing Director** (Muse) — unblocks credentials, resolves cross-team conflicts, makes decisions on Mehedi's behalf
- **Mehedi** — 7 open decisions (MASTER-BUILD-CHECKLIST.md §C); DB migration access; final design approval (Milestone 1 gate)
- **Branch:** `staging-build` → PR review → merge → staging deploy (smoke-test gate) → Mehedi approves → production

## STAFFING ORDER (dependency phases first)
1. **Now:** Platform Teams 1+2, Fractional Teams 1+2 (Phase 0)
2. **When Phase 0 core lands:** Squads 4+5 (parallelizable, fewer deps)
3. **When taxonomy + trusted-adult land:** Squads 1+2 (safety/health gates)
4. **When access model lands:** Squad 3 (school rebuild)
