#!/usr/bin/env python3
"""Deploy Pookie to Cloudflare Pages (pookie-staging).

Full pipeline: npm run build -> opennextjs-cloudflare build ->
staleness verification -> assemble .pages-deploy -> wrangler deploy ->
post-deploy smoke test -> record in DEPLOY-LOG.md.

Lesson 2026-10-12 (stale-build incident): this script used to assemble and
deploy whatever happened to sit in .open-next/, with no build step. A stale
local build (predating the demo-mode removal) shipped to staging and broke
Google OAuth; wrangler's content-hash dedup uploaded 0 files and reported
success. This script now ALWAYS rebuilds from source first. Use
--skip-build for local iteration only; it still refuses a stale .open-next/.
"""
import argparse
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import dynamic_credential_entry  # noqa: E402

APP_DIR = os.path.expanduser("~/workspace/pookie-app")
ACCOUNT_ID = "91264b3fa69afffd6ffe57bdb3c545a8"
PROJECT = "pookie-staging"
STAGING_URL = "https://pookie-staging.pages.dev"

# Source inputs that must be older than the build output. If any of these is
# newer than .open-next/worker.js, the build output is stale and must not ship.
SOURCE_WATCH_PATHS = ["src", "middleware.ts", "next.config.ts",
                      "open-next.config.ts", "package.json",
                      "package-lock.json"]

# Markers that must NEVER appear in build output (2026-10-12 incident).
STALENESS_MARKERS = ["NEXT_PUBLIC_DEMO_MODE", "demoMode"]


def run(cmd, env=None, check=True):
    print(f"+ {' '.join(cmd)}", flush=True)
    r = subprocess.run(cmd, cwd=APP_DIR, env=env)
    if check and r.returncode != 0:
        sys.exit(f"FAILED (exit {r.returncode}): {' '.join(cmd)}")
    return r


def newest_source_mtime():
    newest = 0.0
    for rel in SOURCE_WATCH_PATHS:
        path = os.path.join(APP_DIR, rel)
        if not os.path.exists(path):
            continue
        if os.path.isfile(path):
            newest = max(newest, os.path.getmtime(path))
        else:
            for root, _dirs, files in os.walk(path):
                for f in files:
                    newest = max(newest,
                                 os.path.getmtime(os.path.join(root, f)))
    return newest


def build_is_stale():
    """True if .open-next/ is missing or older than any source input."""
    marker = os.path.join(APP_DIR, ".open-next", "worker.js")
    if not os.path.isfile(marker):
        return True, ".open-next/worker.js missing — no build output present"
    if newest_source_mtime() > os.path.getmtime(marker):
        return True, "source files are newer than .open-next/worker.js"
    return False, ""


def tutor_url_available():
    """True if NEXT_PUBLIC_POOKIE_TUTOR_URL will reach `npm run build`.

    Next.js reads .env.local automatically, so the value can come from the
    process environment or that file. Without it, the build bakes an empty
    tutor URL and the Pookie chat silently loses its AI backend — a config
    mismatch of exactly the class that caused the 2026-10-12 stale-build
    incident (shipped build != intended build), so we fail loudly instead.
    """
    if os.environ.get("NEXT_PUBLIC_POOKIE_TUTOR_URL"):
        return True
    env_local = os.path.join(APP_DIR, ".env.local")
    try:
        with open(env_local) as f:
            for line in f:
                line = line.strip()
                if line.startswith("NEXT_PUBLIC_POOKIE_TUTOR_URL="):
                    return bool(line.split("=", 1)[1].strip())
    except OSError:
        pass
    return False


def verify_build_output():
    """Fail if staleness markers leaked into the fresh build output."""
    open_next = os.path.join(APP_DIR, ".open-next")
    hits = []
    for root, _dirs, files in os.walk(open_next):
        for f in files:
            if f.endswith(".map"):
                continue
            p = os.path.join(root, f)
            try:
                with open(p, "rb") as fh:
                    chunk = fh.read()
            except OSError:
                continue
            for marker in STALENESS_MARKERS:
                if marker.encode() in chunk:
                    hits.append(f"{os.path.relpath(p, APP_DIR)}: {marker}")
    if hits:
        print("STALE BUILD: forbidden markers found in build output:",
              file=sys.stderr)
        for h in hits:
            print(f"  {h}", file=sys.stderr)
        sys.exit(1)
    print("Build output verified: no staleness markers.", flush=True)


def build(env):
    run(["npm", "run", "build"], env=env)
    run(["npx", "opennextjs-cloudflare", "build"], env=env)
    verify_build_output()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--skip-build", action="store_true",
                    help="reuse the existing .open-next/ instead of "
                         "rebuilding (local iteration only; still refuses "
                         "a stale build)")
    args = ap.parse_args()

    # Build-time config integrity: NEXT_PUBLIC_POOKIE_TUTOR_URL is baked into
    # the bundle. Shipping without it degrades the Pookie chat to its local
    # fallback — a build that does not match the intended staging config.
    # (CI always sets it from the POOKIE_TUTOR_URL secret; locally it must
    # come from .env.local or the shell environment.)
    if not tutor_url_available():
        sys.exit("REFUSING TO DEPLOY: NEXT_PUBLIC_POOKIE_TUTOR_URL is not "
                 "set in the environment or .env.local — the build would bake "
                 "an empty tutor URL. Add it to .env.local and retry.")

    if args.skip_build:
        stale, reason = build_is_stale()
        if stale:
            sys.exit(f"REFUSING TO DEPLOY: {reason}. "
                     f"Run without --skip-build to rebuild from source.")
        print("Reusing existing .open-next/ (--skip-build); "
              "staleness check passed.", flush=True)
    else:
        env = dict(os.environ)
        # Staging default; an explicit env value always wins.
        env.setdefault("NEXT_PUBLIC_APP_URL", STAGING_URL)
        build(env)

    # Assemble via the shared script (same logic CI uses).
    run([sys.executable, os.path.join(APP_DIR, "scripts",
                                      "assemble-pages-deploy.py")])

    entry = dynamic_credential_entry("custom.cloudflare")
    env = dict(os.environ)
    env["CLOUDFLARE_API_TOKEN"] = str(entry["surrogate"]).strip()
    env["CLOUDFLARE_ACCOUNT_ID"] = ACCOUNT_ID
    # --branch=main is REQUIRED, not optional (2026-10-12 Squad 5 Phase 2):
    # pookie-staging's production_branch is "main" (verified via Cloudflare
    # API), and Cloudflare treats a --branch deploy as the PRODUCTION
    # deployment exactly when branch == production_branch. Without the flag,
    # wrangler auto-detects the local git branch (e.g. staging-build) and
    # makes a PREVIEW-ONLY deploy to <branch>.pookie-staging.pages.dev —
    # the canonical https://pookie-staging.pages.dev keeps serving the old
    # build. Squad 2 dropped --branch believing no-flag = production; that
    # only holds in CI (detached HEAD, no branch to detect).
    r = run(["npx", "wrangler", "pages", "deploy", ".pages-deploy",
             "--project-name", PROJECT, "--branch=main", "--commit-dirty=true"],
            env=env, check=False)
    if r.returncode != 0:
        sys.exit(r.returncode)

    # Post-deploy smoke test (added 2026-10-12 after the post-login 404
    # incident). A stale/broken deployment served a Next.js error boundary
    # on `/` with no automated detection. This catches it in ~30s before
    # anyone announces "deployed".
    print("\n--- Running post-deploy smoke test ---", flush=True)
    time.sleep(10)  # Give Cloudflare a moment to propagate the deployment
    smoke_cmd = [sys.executable, os.path.join(APP_DIR, "smoke-test-staging.py"),
                 STAGING_URL]
    next_dir = os.path.join(APP_DIR, ".next")
    if os.path.isdir(next_dir):
        # Bundle-freshness gate: the live chunks must be byte-identical to
        # the build this script just produced.
        smoke_cmd += ["--next-dir", next_dir]
    s = subprocess.run(smoke_cmd, cwd=APP_DIR)
    smoke = "pass" if s.returncode == 0 else "fail"
    if s.returncode != 0:
        print("\n*** DEPLOY MAY BE BROKEN — smoke test failed, "
              "investigate before announcing ***")

    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=APP_DIR,
                         capture_output=True, text=True).stdout.strip()
    run([sys.executable, os.path.join(APP_DIR, "scripts", "record-deploy.py"),
         "staging", sha, "deploy-staging.py (local)", smoke])
    sys.exit(s.returncode)


if __name__ == "__main__":
    main()
