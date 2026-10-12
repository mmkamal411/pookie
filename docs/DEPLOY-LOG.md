# Deploy Log

Newest first. Each row: when, where, what commit, what changed, who/what triggered it, smoke test result.

| Timestamp (EDT) | Env | Git SHA | Commits | Trigger | Smoke |
|-----------------|-----|---------|---------|---------|-------|
| 2026-10-12 06:47 | staging | ed725dd | ed725dd diagnostic: bypass deletion check on / to isolate 500 | deploy-staging.py (local) | fail |
| 2026-10-12 06:42 | staging | b1e3e9a | (no new commits) | deploy-staging.py (local) | fail |
| 2026-10-12 06:31 | staging | b1e3e9a | b1e3e9a fix: dashboard-flagged runtime issues in 060-063 + authenticated smoke tests | deploy-staging.py (local) | pass |
| 2026-10-12 06:29 | staging | 4bab001 | 4bab001 docs: remove stale demo-mode references from design specs | deploy-staging.py (local) | pass |
| 2026-10-12 06:17 | staging | cadb8e4 | cadb8e4 fix: root router 500 for single-child users — cookies().set() throws in Server Components; 38a70b1 feat: self-service deletion with 30-day grace (account + child); bf8a8c6 release: Squad 5 Phase 2 staging release fixes | deploy-staging.py (local) | pass |
| 2026-10-12 06:02 | staging | aefe21d | (no new commits) | Squad5-Phase2 release: fresh build -> opennext -> wrangler --branch=main (production deploy; canonical URL updated) | pass |
| 2026-10-12 05:58 | staging | aefe21d | (no new commits) | deploy-staging.py (local) | fail |
| 2026-10-12 05:57 | staging | aefe21d | aefe21d fix: align 8 call sites with committed RPC contracts; 20bdaaf db: 059-062 close RPC gaps — log_access_event compat, support RPCs, driving school, set_health_grant; 7f1a16b ci: GitHub Actions pipeline — always build from source, verify freshness, log deploys; 6dbf839 Squad 5 Phase 1: build-in | deploy-staging.py (local) | fail |
