# Pookie Master Build Checklist

**Compiled 2026-10-12 from:** 18-expert panel review · expert solutions (7 domain designs) · Panel Round 2 (6 proposals) · build specification (FR/NFR) · PMP suite · Mehedi's locked decisions.

**Documents:** `BUILD-SPECIFICATION.md` (requirements) · `EXPERT-SOLUTIONS.md` + `docs/solutions/` (how) · `PANEL-ROUND2-SOLUTIONS.md` (round 2) · `docs/pm/` (PMP: charter, WBS, schedule, risks, stakeholders, quality, comms) · `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked access model) · `ACCESS-MODEL-REVIEW-CHECKLIST.md` (panel findings)

---

## A. LOCKED DECISIONS (Mehedi — do not revisit without his word)

1. Pookie = user's personal assistant; parenting = optional feature
2. Child-as-access-authority: child's grants can't be vetoed/revoked by parents
3. Age tiers: <13 stewardship · 13–15 cooling-off (redesigned) · 16–17 instant · 18+ continuity + full control
4. 6-category popup menu (Health/Home/School/Safety/Travel/Marketplace) + Support; W10 Fairness & W17 Friends REMOVED (28 modules)
5. Support: 2 agents, 9–5 ET daily, AI-first with ticket escalation
6. FAQ: covers ALL features; expandable legal accordions; honest law-vs-choice distinction
7. Break-glass: two paths (teen-configured safety net + LE legal path); no civilian self-serve
8. AI: never train on user data (absolute commitment, no opt-out toggle)

---

## B. DEPENDENCY-ORDERED BUILD SEQUENCE (least → most dependent)

### Phase 0 — Foundation (nothing else builds without these)
- [ ] **Legal gates first:** COPPA 2025 compliance package + Terms of Service → **real attorney sign-off** (NFR-LEGAL)
- [ ] Migrations 015–023 (access model, `granted_by`, audit trail, verification, emergency, time-boxed grants)
- [ ] `profiles` table + onboarding flow (30-sec, skippable, guardian attestation, DOB gate)
- [ ] Popup menu shell (7 collapsed categories, search, recent, age-gating)
- [ ] **BLOCKER:** Mehedi's DB access to apply migrations (external dependency)

### Phase 1 — Standalone modules (no cross-module deps) 🟢🟡
- [ ] W26 Weather (NWS API) · W20 Shopping List · W13 Meals · W3 Safety-insurance · W21 Mail (OCR + auto-delete) · W22 Activity (fitness APIs)

### Phase 2 — Light dependents 🟡🟠
- [ ] W23 Nutrition (age-gated) · W28 Restaurants (allergen blocks) · W29 Trails (vetting required) · W27 Events (curation policy) · W16 School Calendar

### Phase 3 — Financial (compliance-heavy) 🟠🔴
- [ ] W11 Spending (Plaid, GIPA masking) · W7 Money & Documents (encrypted vault) · W24 Credit → **re-scoped to freeze management** (FCRA counsel sign-off)

### Phase 4 — Support 🟠
- [ ] S1 FAQ (~90 articles, legal accordions) · S2 AI chat (escalation tripwires, crisis pattern-interrupt) · S3 Tickets (SLA engine, agent RBAC, teen-privacy API enforcement)

### Phase 5 — Health (compliance-gated) 🟠🔴
- [ ] **H0–H3 taxonomy MUST exist before W2 holds real teen data** (panel 🛑)
- [ ] W8 Wellbeing (teen-private, crisis ladder) · W2 Health (device ingestion, no-diagnosis rule) · W15 Screen Time (co-set flow)

### Phase 6 — Family & access features 🟡🔴
- [ ] W12 Babysitters (time-boxed grants) · W14 Co-parenting (**parallel-parenting mode** for high-conflict) · W6 Driving School (GA DDS/Joshua's Law rules)

### Phase 7 — School (most complex) 🟡🟠🔴
- [ ] W4 Activities · W18 Summer · W5 College (GSFC-exact, HOPE/Zell Miller) · **W1 School rebuild** (provenance rules, inbox segregation, check-in redesign, fail-closed quizzes)

### Phase 8 — Travel rules engines 🟢🟠🔴
- [ ] W25 Fuel & Charging · W30 Flights (**18+ purchaser invariant**, server-side) · W31 Rental Cars (hard age-gate, hidden from teens)

### Phase 9 — Safety & emergency (integrates everything) 🟠
- [ ] W19 Emergency ("call 911 first" posture) + break-glass Path A/B (counsel sign-off before disclosure tooling)

### Critical path
```
COPPA package + ToS → Migrations 015–023 → H0–H3 taxonomy + retention schedule
  → Trusted-adult infra + crisis protocol → W1/W2 → W19 + break-glass → QA & launch gates
```

---

## C. MEHEDI'S OPEN DECISIONS (builders are blocked or guessing without these)

1. **24/7 emergency-review staffing** — contract, rotate, or SLA-only? (Single costliest decision; Proposal 1)
2. **AI training commitment wording** — "never" vs "not today" (FTC implications either way)
3. **Washington state posture** — geofence, comply with MHMDA, or block? (multi-state precedent)
4. **Support scope** — holiday coverage? Agent billing/refund authority?
5. **Second-parent launch** — invite-only v1 vs full claim path? Custody posture: enforce orders or stay out?
6. **Time-boxed grant frequency cap** — is 2/grantee/30d too strict? Teen co-approval threshold for 13–15?
7. **Break-glass Q2** — what location data do we actually hold? (May eliminate need for a disclosure pipeline)

---

## D. LEGAL GATES (licensed attorney sign-off required before build — panel analysis is NOT legal advice)

1. ToS / arbitration / mandatory-reporter program
2. 18+ FERPA consent design
3. Cooling-off notification matrix (with DV-advocate review)
4. Retention schedule + litigation hold
5. Law-enforcement / subpoena policy
6. Break-glass disclosure tooling (NFR-LEGAL-006)
7. Court-order ingestion workflow
8. COPPA 2025 compliance package
9. FCRA (credit module re-scope)
10. FTC Health Breach Rule determination

---

## E. TEAM COMPOSITION (per phase)

- **Platform team (3–4):** auth, API patterns, design system, deploy pipeline, smoke-test gate — *your current 3-agent team maps here*
- **Feature squads (4–5 each):** start with 2 squads — Squad A: access-model/safety track (Phases 0, 6, 9) · Squad B: Health/School (Phases 5, 7). Add a 3rd for parallel module phases.
- **Fractional specialists (as gates, not headcount):** compliance reviewer, security engineer (pen-tests), domain advisors (educator, clinician), licensed counsel (the 10 gates above)

---

## F. NEVER-SHIP LIST (panel 🛑 — recorded so nobody rebuilds these)

Unfiltered Muse for <18 · check-in as parent lie detector · cross-family identifiable peer tips · unverified AI quizzes · under-18 nutrition/calorie logging · 3-bureau credit monitoring · ghostwritten teacher emails · indefinite data retention · teen self-booking flights/rentals · W10 Fairness · W17 Friends · civilian self-serve break-glass · AI-training opt-out toggle (nothing to opt out of)

---

*Next action: Mehedi resolves Section C decisions → legal engages on Section D gates → P0 unblocks the critical path.*
