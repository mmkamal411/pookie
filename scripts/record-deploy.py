#!/usr/bin/env python3
"""Append a deployment record to docs/DEPLOY-LOG.md.

Usage: record-deploy.py <env> <git-sha> <trigger> [smoke-result]

Creates the log with a header row on first use. Keeps newest entries first
so the monitoring dashboard can read the top of the file.
"""
import datetime
import os
import subprocess
import sys

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(APP_DIR, "docs", "DEPLOY-LOG.md")
HEADER = ("# Deploy Log\n\n"
          "Newest first. Each row: when, where, what commit, what changed, "
          "who/what triggered it, smoke test result.\n\n"
          "| Timestamp (EDT) | Env | Git SHA | Commits | Trigger | Smoke |\n"
          "|-----------------|-----|---------|---------|---------|-------|\n")


def git(args):
    return subprocess.run(["git"] + args, cwd=APP_DIR, capture_output=True,
                          text=True).stdout.strip()


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__, file=sys.stderr)
        return 2
    env, sha, trigger = sys.argv[1], sys.argv[2][:8], sys.argv[3]
    smoke = sys.argv[4] if len(sys.argv) > 4 else "pending"

    # Commits since the previous deploy to this env (from the log, if any).
    prev_sha = None
    if os.path.exists(LOG):
        for line in open(LOG):
            parts = [p.strip() for p in line.split("|")]
            if len(parts) > 4 and parts[2].lower() == env.lower():
                prev_sha = parts[3]
                break
    if prev_sha:
        commits = git(["log", "--oneline", f"{prev_sha}..{sha}"])
    else:
        commits = git(["log", "--oneline", "-5", sha])
    commits = "; ".join(commits.splitlines()[:5]) or "(no new commits)"
    # Escape pipes so the markdown table stays intact.
    commits = commits.replace("|", "\\|")[:300]

    now = datetime.datetime.now(
        datetime.timezone(datetime.timedelta(hours=-4))).strftime(
        "%Y-%m-%d %H:%M")
    row = f"| {now} | {env} | {sha} | {commits} | {trigger} | {smoke} |\n"

    if not os.path.exists(LOG):
        with open(LOG, "w") as f:
            f.write(HEADER)
    with open(LOG) as f:
        body = f.read()
    # Insert newest row right after the header block.
    marker = "|-------|\n"
    head, _, tail = body.partition(marker)
    with open(LOG, "w") as f:
        f.write(head + marker + row + tail)
    print(f"Recorded {env} deploy {sha} in docs/DEPLOY-LOG.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
