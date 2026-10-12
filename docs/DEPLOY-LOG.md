# Deploy Log

Newest first. Each row: when, where, what commit, what changed, who/what triggered it, smoke test result.

| Timestamp (EDT) | Env | Git SHA | Commits | Trigger | Smoke |
|-----------------|-----|---------|---------|---------|-------|
| 2026-10-12 06:02 | staging | aefe21d | (no new commits) | Squad5-Phase2 release: fresh build -> opennext -> wrangler --branch=main (production deploy; canonical URL updated) | pass |
| 2026-10-12 05:58 | staging | aefe21d | (no new commits) | deploy-staging.py (local) | fail |
| 2026-10-12 05:57 | staging | aefe21d | aefe21d fix: align 8 call sites with committed RPC contracts; 20bdaaf db: 059-062 close RPC gaps — log_access_event compat, support RPCs, driving school, set_health_grant; 7f1a16b ci: GitHub Actions pipeline — always build from source, verify freshness, log deploys; 6dbf839 Squad 5 Phase 1: build-in | deploy-staging.py (local) | fail |
