# Pookie Communication Plan

**Version 1.0 — 2026-10-12 · PMBOK §10**

---

## 1. Mehedi (sponsor) — primary channel

| Situation | Channel | Cadence / SLA |
|---|---|---|
| Active build in progress | 5-minute status briefing (cron `pookie-build-status-briefing`) | Every 5 min: right now / just finished / up next / needs Mehedi — with agent label IDs. One-liner if nothing changed. |
| Mehedi says "keep me updated" / "status report" / "updates?" | Detailed technical briefing | Immediate: current work, plan, agents × IDs, blockers, anything needed from him |
| Decision needed | Direct message, options with recommendation | Same session — never let a decision sit past the conversation |
| Blocker on Mehedi (DB access, approval, counsel) | Direct message, specific ask | Immediate; re-surface once per day until unblocked, then stop nagging |
| Deploy completed | Direct message with verified URL | After smoke test passes AND URL personally loaded (trust rule) |
| Routine cron output (no action needed) | Suppressed | `muse.nothing_to_do` — never emit filler |

**Rules:** No "done/deployed/live" without personal URL verification. Language discipline: code written ≠ tested ≠ deployed ≠ live. Never re-ask for granted permissions; never expand unprompted action beyond granted authority.

## 2. Build team coordination — BUILD-LOG.md

**File:** `~/workspace/pookie-app/docs/BUILD-LOG.md` · **Convention:** append newest-first.

| Entry must contain | Example |
|---|---|
| Who + branch + timestamp | `2026-10-12 — Senior Backend Developer (staging-build)` |
| What changed (files, commits) | `018_access_authority.sql written; grantAccess RPC enforces matrix` |
| Verification evidence | `tsc exit 0; RLS bypass attempts blocked (3/3); smoke passed` |
| What's blocked | `021 needs DBA review of audit-table RLS` |
| What's next | `2.5 visibility scopes next` |

**Repo-wide git operations MUST be announced in BUILD-LOG.md before running** (2026-10-11 stash incident rule). No exceptions.

## 3. Escalation path

```
Working agent
  → Managing Director (Muse): triage within one working session
    → Mehedi: scope / design / approval / external-dependency decisions
      → Licensed counsel: the 10 sign-off gates (ST-08)
```

- **Technical disputes** (contract mismatches, migration conflicts): Managing Director decides; logged.
- **Scope disputes:** Mehedi decides. Panel recommendations are accepted as baseline; any deviation needs his explicit override.
- **Safety-critical findings** (new 🛑 discovered mid-build): stop the line, notify Mehedi same session, add to RISK-REGISTER.
- **Security incidents** (suspected breach, credential leak): immediate Mehedi notification; rotate credentials; GIPA breach runbook (WBS 7.4) once written.

## 4. Artifacts & where they live

| Artifact | Location | Audience |
|---|---|---|
| This PM suite | `docs/pm/` | Team + Mehedi |
| Build spec (FR/NFR) | `docs/BUILD-SPECIFICATION.md` | Team (requirements engineer) |
| Access-model spec | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` | Team (locked) |
| Panel checklist | `docs/ACCESS-MODEL-REVIEW-CHECKLIST.md` | Team + counsel |
| Feature list | `docs/FEATURE-LIST-FOR-PANEL.md` | Team + panel |
| Expert reviews | `docs/reviews/`, `docs/panel-reviews/`, `docs/audit-findings/` | Counsel + team |
| Build log | `docs/BUILD-LOG.md` | Team (coordination) |
| Memory | `~/MEMORY.md` + `~/memory/` | Managing Director (durable) |

## 5. Meeting rhythm

No standing meetings. The 5-minute briefing cron + BUILD-LOG.md replace status meetings during active builds. Mehedi decides in conversation; decisions are written to MEMORY.md and the relevant spec the same session.
