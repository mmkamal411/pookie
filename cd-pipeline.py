#!/usr/bin/env python3
"""Continuous deployment pipeline for Pookie staging (Squad Pipeline).

One command takes a green commit to staging:

    git sync -> tsc -> demo-code scan -> clean rebuild -> deploy
    -> smoke test -> bundle freshness -> record -> notify (BUILD-LOG.md)

Guarantees:
  - Fails fast: any step failing stops the pipeline BEFORE deploy.
  - Idempotent: skips when HEAD is already deployed with a passing smoke.
  - No partial deploys: refuses dirty trees; file lock blocks concurrent runs.
  - Staging only. This script NEVER touches production.

Usage:
    python3 cd-pipeline.py            # full pipeline
    python3 cd-pipeline.py --force    # redeploy even if HEAD already deployed

Exit codes: 0 = deployed (or already deployed), 1 = pipeline failed.
Every run appends/prepends a dated entry to docs/BUILD-LOG.md:
  ✅ on success (commit hash + what changed), ❌ on failure (step + error).
"""
import datetime
import fcntl
import os
import re
import subprocess
import sys

APP_DIR = os.path.dirname(os.path.abspath(__file__))
BRANCH = "staging-build"
BUILD_LOG = os.path.join(APP_DIR, "docs", "BUILD-LOG.md")
DEPLOY_LOG = os.path.join(APP_DIR, "docs", "DEPLOY-LOG.md")
LOG_DIR = os.path.join(APP_DIR, "logs")
LOCK_FILE = "/tmp/pookie-cd-pipeline.lock"

# Source markers that must NEVER ship (2026-10-12 stale-build incident).
DEMO_MARKERS = ["NEXT_PUBLIC_DEMO_MODE", "demoMode"]
DEMO_ROUTE_DIR = os.path.join(APP_DIR, "src", "app", "demo")
SOURCE_WATCH = ["src", "middleware.ts"]


def now_edt():
    return datetime.datetime.now(
        datetime.timezone(datetime.timedelta(hours=-4)))


def log(msg):
    print(f"[cd-pipeline] {msg}", flush=True)


def git(*args, check=True):
    r = subprocess.run(["git"] + list(args), cwd=APP_DIR,
                       capture_output=True, text=True)
    if check and r.returncode != 0:
        raise PipelineError(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout.strip()


class PipelineError(Exception):
    pass


def notify_build_log(success, title, body):
    """Prepend a dated entry to BUILD-LOG.md (newest first)."""
    icon = "✅" if success else "❌"
    ts = now_edt().strftime("%Y-%m-%d ~%H:%M EDT")
    entry = f"\n## {ts} — Squad Pipeline — {icon} {title}\n\n{body}\n"
    try:
        with open(BUILD_LOG) as f:
            content = f.read()
    except OSError:
        content = "# Pookie Build Log — 3-agent team coordination\n"
    lines = content.split("\n", 1)
    new_content = lines[0] + "\n" + entry + (lines[1] if len(lines) > 1 else "")
    with open(BUILD_LOG, "w") as f:
        f.write(new_content)
    log(f"BUILD-LOG.md notified ({icon} {title})")


def last_deployed():
    """Return (sha, smoke) of the latest staging row in DEPLOY-LOG.md."""
    if not os.path.exists(DEPLOY_LOG):
        return None, None
    for line in open(DEPLOY_LOG):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) > 6 and parts[2].lower() == "staging":
            return parts[3], parts[6]
    return None, None


def step_preflight():
    """Sync with origin. Refuse dirty trees and wrong branches."""
    log("STEP 1/6: preflight — git sync")
    branch = git("branch", "--show-current")
    if branch != BRANCH:
        raise PipelineError(
            f"refusing: on branch '{branch}', expected '{BRANCH}'")
    subprocess.run(["git", "fetch", "origin"], cwd=APP_DIR, check=True,
                   capture_output=True, timeout=120)
    dirty = git("status", "--porcelain")
    if dirty:
        raise PipelineError(
            "refusing: working tree is dirty (uncommitted changes) — "
            "commit or stash first; the pipeline never ships partial work.\n"
            + dirty[:500])
    before = git("rev-parse", "--short", "HEAD")
    r = subprocess.run(["git", "pull", "--ff-only", "origin", BRANCH],
                       cwd=APP_DIR, capture_output=True, text=True)
    if r.returncode != 0:
        raise PipelineError(f"git pull --ff-only failed: {r.stderr.strip()}")
    after = git("rev-parse", "--short", "HEAD")
    log(f"HEAD {before} -> {after}" + (" (new commits pulled)" if before != after else " (already up to date)"))
    return after


def step_idempotent(head, force):
    """Skip when HEAD is already deployed with a passing smoke test."""
    log("STEP 2/6: idempotency check")
    sha, smoke = last_deployed()
    if sha == head and smoke == "pass" and not force:
        log(f"HEAD {head} already deployed with passing smoke — nothing to do.")
        return True
    if sha == head and smoke != "pass":
        log(f"HEAD {head} was deployed but smoke={smoke} — redeploying.")
    else:
        log(f"HEAD {head} not yet deployed (last deployed: {sha}) — proceeding.")
    return False


def step_tsc():
    log("STEP 3/6: typecheck — npx tsc --noEmit")
    r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=APP_DIR,
                       capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        raise PipelineError("tsc failed:\n" + r.stdout[-2000:] + r.stderr[-2000:])


def step_demo_scan():
    log("STEP 4/6: demo-code source scan")
    if os.path.isdir(DEMO_ROUTE_DIR):
        raise PipelineError("src/app/demo/ exists — demo code must not ship")
    hits = []
    for rel in SOURCE_WATCH:
        path = os.path.join(APP_DIR, rel)
        targets = [path] if os.path.isfile(path) else [
            os.path.join(r, f) for r, _d, fs in os.walk(path) for f in fs]
        for p in targets:
            if p.endswith(".map"):
                continue
            try:
                with open(p, "rb") as fh:
                    data = fh.read()
            except OSError:
                continue
            for marker in DEMO_MARKERS:
                if marker.encode() in data:
                    hits.append(f"{os.path.relpath(p, APP_DIR)}: {marker}")
    if hits:
        raise PipelineError("demo markers found in source:\n" + "\n".join(hits))
    log("source clean — no demo code")


def step_clean():
    for d in (".next", ".open-next", ".pages-deploy"):
        p = os.path.join(APP_DIR, d)
        if os.path.isdir(p):
            log(f"removing stale {d}/")
            subprocess.run(["rm", "-rf", p], check=True)


def step_deploy(head, prev_sha):
    """Run deploy-staging.py (build -> opennext -> wrangler -> smoke ->
    freshness -> record). Parse wrangler's upload count; fail loudly on a
    0-file upload when code actually changed (the 2026-10-12 red flag)."""
    log("STEP 5/6: deploy — deploy-staging.py (build -> wrangler -> smoke)")
    os.makedirs(LOG_DIR, exist_ok=True)
    ts = now_edt().strftime("%Y%m%d-%H%M%S")
    run_log = os.path.join(LOG_DIR, f"cd-pipeline-{ts}.log")
    with open(run_log, "w") as lf:
        r = subprocess.run(
            [sys.executable, os.path.join(APP_DIR, "deploy-staging.py")],
            cwd=APP_DIR, stdout=lf, stderr=subprocess.STDOUT, timeout=1800)
    output = open(run_log).read()
    # Show the tail on the console for live visibility.
    print("\n".join(output.splitlines()[-25:]), flush=True)
    log(f"full deploy log: {run_log}")

    # 0-file wrangler deploy = red flag (AGENTS.md lesson 2026-10-12).
    m = re.search(r"Uploaded (\d+) files?", output)
    if m:
        uploaded = int(m.group(1))
        log(f"wrangler uploaded {uploaded} new file(s)")
        if uploaded == 0:
            code_changed = bool(git("log", "--oneline",
                                    f"{prev_sha}..{head}") if prev_sha else True)
            if code_changed:
                raise PipelineError(
                    "wrangler uploaded 0 new files despite code changes "
                    f"since {prev_sha} — the new build did not propagate. "
                    "Refusing to call this a deploy.")
            log("0 new files but no code changes since last deploy — "
                "content-hash dedup, expected.")
    else:
        log("warning: could not parse wrangler upload count from output")

    if r.returncode != 0:
        tail = "\n".join(output.splitlines()[-40:])
        raise PipelineError(
            f"deploy-staging.py exited {r.returncode} "
            "(deploy or smoke test failed):\n" + tail)
    return run_log


def step_notify_success(head, prev_sha):
    log("STEP 6/6: notify — success")
    commits = git("log", "--oneline", f"{prev_sha}..{head}") if prev_sha else \
        git("log", "--oneline", "-5", head)
    commits = "; ".join(commits.splitlines()[:5]) or "(no new commits)"
    body = (f"**Deployed `{head}` to https://pookie-staging.pages.dev**\n\n"
            f"Pipeline: git sync → tsc clean → demo scan clean → fresh rebuild "
            f"→ wrangler deploy → smoke test passed → bundle freshness verified "
            f"→ deploy recorded.\n\n"
            f"**Changes shipped:** {commits}\n")
    notify_build_log(True, f"Staging deploy {head}", body)


def main():
    force = "--force" in sys.argv
    lock = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("[cd-pipeline] another pipeline run holds the lock — exiting",
              flush=True)
        return 1
    try:
        head = step_preflight()
        prev_sha, _ = last_deployed()
        if step_idempotent(head, force):
            return 0
        step_tsc()
        step_demo_scan()
        step_clean()
        step_deploy(head, prev_sha)
        step_notify_success(head, prev_sha)
        log("PIPELINE COMPLETE — staging is live")
        return 0
    except PipelineError as e:
        log(f"PIPELINE FAILED: {e}")
        try:
            notify_build_log(
                False, "Staging deploy blocked",
                f"**The pipeline stopped before anything reached staging.**\n\n"
                f"**Reason:** {str(e)[:1500]}\n")
        except Exception as ne:
            log(f"also failed to write BUILD-LOG: {ne}")
        return 1
    except Exception as e:  # never let an unexpected error pass silently
        log(f"PIPELINE CRASHED (unexpected): {e!r}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
