# Rollback Runbook — Pookie on Cloudflare Pages

If a bad deploy goes out to staging (or, after cutover, production), this is
the recovery path. Read the whole page once before you need it.

## 1. Confirm it's actually broken (2 min)

- Run the smoke test: `python3 smoke-test-staging.py https://pookie-staging.pages.dev`
  (add `--next-dir .next` if you just built locally — it byte-compares the
  live chunk against your build).
- Check the 15-min health check: `python3 health-check.py`.
- Decide: full outage / broken auth / wrong bundle = roll back. Minor visual
  bug = fix forward.

## 2. Find the last-known-good deployment

Two sources, use both:

- `docs/DEPLOY-LOG.md` (newest first): the last row with `Smoke: pass` for
  the env gives you the git SHA and the trigger.
- Cloudflare dashboard → Workers & Pages → `pookie-staging` → **Deployments**:
  every deployment is listed with its commit hash (CI passes
  `--commit-hash`; local deploys use `--commit-dirty=true`). Pick the most
  recent **production** deployment whose smoke passed. Preview deployments
  (branch subdomains) are not valid rollback targets.

## 3. Roll back (fastest: dashboard, ~1 min)

There is **no `wrangler pages rollback` command** (verified 2026-10-12 —
`wrangler pages --help` lists no rollback subcommand). Rollback is
dashboard-only:

1. Cloudflare dashboard → Workers & Pages → `pookie-staging` → Deployments.
2. Find the last-known-good production deployment → its `…` actions menu →
   **Rollback to this deployment**.
3. This re-serves that deployment's exact stored snapshot (worker + assets) —
   no rebuild needed, atomic cutover.

Caveat: a dashboard rollback does **not** change the code in GitHub. The next
push to `staging-build` re-deploys whatever is in the branch, so follow up
with a fix-forward or a `git revert` of the bad commit. Treat the dashboard
rollback as the emergency stop, not the fix.

## 4. If the dashboard is unreachable (fallback: rebuild from SHA)

```bash
git fetch origin
git checkout <last-known-good-sha>   # from DEPLOY-LOG.md
npm run build && npx opennextjs-cloudflare build
python3 scripts/assemble-pages-deploy.py
python3 deploy-staging.py --skip-build   # refuses if .open-next is stale
```

`--skip-build` still runs the staleness guard: if any source file is newer
than `.open-next/worker.js` it refuses to deploy rather than shipping a
mismatched build. Never bypass this guard during a rollback.

## 5. Verify the recovery

- `python3 smoke-test-staging.py https://pookie-staging.pages.dev`
  (no `--next-dir` after a dashboard rollback — there is no local build to
  compare against; route + staleness-marker checks still run).
- Record it: `python3 scripts/record-deploy.py staging <sha> "rollback" pass`
  and commit `docs/DEPLOY-LOG.md`.

## 6. After-action

- Append a BUILD-LOG.md entry: what broke, which deployment was bad, what
  the rollback restored, and what prevents recurrence.
- If the bad deploy was caused by a code bug, the revert/fix still needs to
  land on `staging-build` and go through the normal pipeline.

## Prevention checklist (why bad deploys shouldn't reach users)

- CI gate (`ci.yml`) runs lint + typecheck + build before any deploy.
- `deploy-staging.py` always rebuilds from source; `--skip-build` refuses a
  stale `.open-next/`.
- The workflow greps the fresh build output for staleness markers
  (`NEXT_PUBLIC_DEMO_MODE`, `demoMode`) and fails the run if found.
- The smoke test's bundle-freshness check byte-compares the live chunk
  against the just-made build (`--next-dir .next`).
- Red flag: wrangler uploads **0 files** while source changed. Content-hash
  dedup makes 0 uploads normal for identical content — but if the build was
  supposed to contain new code, 0 uploads means the build didn't pick it up.
  Investigate; do not announce success.
- Canonical staging URL is `https://pookie-staging.pages.dev`. The
  `staging-build.pookie-staging.pages.dev` branch subdomain is a non-canonical
  preview — do not smoke-test against it, do not share it as "staging".
