# Pookie Project Charter

**Version 1.0 — 2026-10-12 · PMP-aligned · Sponsor-approved direction locked**

---

## 1. Project purpose

Rebuild Pookie as the **user's personal life assistant** — a single app that helps an adult manage and organize their life (health, home, money, school, safety, travel). Parent/child oversight is an **optional added feature** for users who have children, not the product identity.

This charter supersedes the earlier child-centric framing. The course correction (Mehedi, 2026-10-12): *"Pookie acts as the user's assistant. The parent and child relationship and oversight is an added feature for users who have a child."*

## 2. Objectives

| # | Objective | Measurable target |
|---|---|---|
| O1 | Any adult can sign up and reach a working personal dashboard in under 60 seconds | Signup → dashboard, zero dead ends, no invite gate on own account |
| O2 | Parents can add children with verified, lawful consent | 100% of child links via email verification or link code; under-13 = parent-managed only |
| O3 | The child (13+) is the access authority over their own records | `granted_by` enforcement on every access row; zero parent vetoes of child grants |
| O4 | Ship Georgia-compliant before any real family onboard | Zero 🛑 panel items outstanding at launch; all §5 sign-off gates cleared by licensed counsel |
| O5 | Staging is always deployable and verified | Every deploy passes `smoke-test-staging.py`; zero "claimed deployed" without a personally loaded URL |

## 3. Success criteria

- Staging serves the full user-first flow: signup → onboarding → personal dashboard → optional child add → verified link → sharing screens.
- All 5 critical panel findings (RISK-001…RISK-005) remediated and re-verified.
- COPPA compliance package complete (written retention policy, infosec program, vendor assurances).
- Licensed Georgia attorney signs off on the 10 sign-off gates (checklist §5).
- Production cutover only on Mehedi's explicit go-ahead, per the standing staging-first rule.

## 4. High-level scope

### In scope
- Core platform: auth (Google OAuth + magic link), profiles, onboarding, 5-tab navigation, Nebula theme
- 6-category popup menu (Health · Home · School · Safety · Travel · Marketplace), 28 modules (W10 Fairness and W17 Friends removed per Mehedi 2026-10-12)
- Access model: email invites, link codes, grant/revoke matrix, age tiers, visibility scopes, audit trail, trusted-adult designation, safe-exit path, go-independent flow, 18+ transition
- Health privacy tiers H0–H3 taxonomy; W2/W8/W23 gated behind it
- School intelligence (W1): data-provenance rule, inbox redesign (counselor-mail segregation), check-in redesign (teen-facing calibration), AI quiz verification pipeline
- AI safety: crisis protocol, Muse 18+ gate, nudge guardrails, no-training-on-inputs vendor terms
- Compliance package: COPPA docs, retention schedule, ToS, breach runbook, mandatory-reporter program design
- QA: Mehedi's full test protocol (see QUALITY-PLAN.md), pen-test, chaos engineering

### Out of scope (this phase)
- Production cutover (gated separately on Mehedi's approval)
- Multi-state expansion (each new state needs its own law review — R10)
- District/school partnerships (inverts the access model — R11; full re-review required first)
- Native mobile apps (web-first via pages.dev)
- Transactional email provider selection is deferred — invite links are copyable in-app until wired

## 5. Key stakeholders

| Stakeholder | Role | Authority |
|---|---|---|
| Mehedi Kamal | Project sponsor, product owner | Final approval on scope, design direction, production cutover; sole approver for outward-facing commitments |
| Teen users (13–17) | Primary beneficiaries of access-authority model | Access control over own records per age tier |
| Parent users | Buyers; optional child-oversight users | Grant/revoke own grants; never veto child grants |
| Schools / teachers | Data originators (StudentVUE) | No direct integration; portal ToS posture under review |
| Licensed legal counsel (TBD) | Compliance sign-off | Must clear 10 sign-off gates before launch |
| 18-expert panel | Advisory (completed 2026-10-12) | Findings accepted in full by sponsor; checklist is the compliance baseline |

Full register: STAKEHOLDER-REGISTER.md.

## 6. High-level risks (top 5 — see RISK-REGISTER.md)

1. **RISK-001** — Crisis tripwire vs revoke contradiction: a teen who revokes all parents then signals crisis has no alert recipient. *Mitigation: trusted-adult designation required before any revoke.*
2. **RISK-002** — 7-day cooling-off dual-parent notification endangers teens in coercive households ("single most dangerous element in the spec"). *Mitigation: redesigned safe-exit path, teen-chosen notification timing.*
3. **RISK-003** — 18+ health-data continuity default inverts informed consent. *Mitigation: affirmative opt-in re-consent; skip = private.*
4. **RISK-004** — COPPA 2025 Rule enforceable now with no written retention policy, infosec program, or vendor assurances. *Mitigation: compliance package is a launch gate.*
5. **RISK-005** — "Teen health privacy tiers" referenced but undefined; W2 cannot hold real teen data. *Mitigation: H0–H3 taxonomy built before health modules go live.*

## 7. Milestone summary

| Milestone | Exit criteria |
|---|---|
| M1 — Foundation | Migrations 014–021 applied to staging DB; profiles + onboarding live; auth hardened |
| M2 — Access Model | Linking (email + codes), grant/revoke matrix, age tiers, visibility scopes, audit trail, trusted adult, safe-exit — all behind feature-complete E2E tests |
| M3 — Menu & Onboarding UX | 6-category popup menu live; "just me" dashboard; onboarding flow |
| M4 — Health gated launch | H0–H3 taxonomy built; W2/W8/W23 meet panel conditions or stay dark |
| M5 — School hardened | Provenance rule, inbox segregation, check-in redesign, quiz verification pipeline |
| M6 — AI & Safety | Crisis protocol, Muse 18+ gate, nudge guardrails live |
| M7 — Compliance package | COPPA docs, retention schedule, ToS, breach runbook complete; counsel sign-off gates cleared |
| M8 — Release readiness | Full test protocol passed; pen-test clean; staging verified by Mehedi; production cutover approved |

## 8. Approval authority

| Decision | Approver |
|---|---|
| Scope changes | Mehedi |
| Design direction (Milestone 1 gate) | Mehedi — nothing user-facing ships without his approval |
| Production deploy | Mehedi — explicit go-ahead only, staging verified first |
| Compliance sign-off | Licensed counsel (10 gates); panel findings are advisory input, not sign-off |
| Technical approach within scope | Managing Director (Muse) + 3-agent build team |

## 9. Constraints & assumptions

- **External dependency:** all migration application requires Mehedi's Supabase dashboard access (no service_role in sandbox). Nothing in 1.0 proceeds to staging DB without it.
- **Staging-first always.** Production (`pookie` Pages project) untouched without explicit approval.
- **Trust rule:** never claim deployed/done/live without personally loading the URL and confirming.
- **Signup toggle** is ON for testing; flip OFF when done (standing item).
- Assumptions: Georgia as sole launch jurisdiction; Supabase + Cloudflare Pages stack unchanged; Google OAuth client unchanged.
