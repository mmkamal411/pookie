#!/usr/bin/env python3
"""Assemble the Cloudflare Pages deploy directory from OpenNext build output.

Extracted from deploy-staging.py's rebuild() so CI and local deploys share
the exact same assembly logic. Always run AFTER a fresh
`opennextjs-cloudflare build` — never reuse a stale .open-next/.
"""
import json
import os
import shutil
import sys

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    src = os.path.join(APP_DIR, ".open-next")
    dst = os.path.join(APP_DIR, ".pages-deploy")
    if not os.path.isdir(src):
        print(f"ERROR: {src} not found — run opennextjs-cloudflare build first",
              file=sys.stderr)
        return 1
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    for item in os.listdir(os.path.join(src, "assets")):
        s, d = os.path.join(src, "assets", item), os.path.join(dst, item)
        shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)
    for sub in ("cloudflare", "middleware", "server-functions"):
        shutil.copytree(os.path.join(src, sub), os.path.join(dst, sub))
    build_dir = os.path.join(src, ".build")
    if os.path.isdir(build_dir):
        shutil.copytree(build_dir, os.path.join(dst, ".build"))
    shutil.copy2(os.path.join(src, "worker.js"), os.path.join(dst, "_worker.js"))
    # Serve /_next/static/* directly from Pages, not via the worker.
    # Without this, the OpenNext worker 404s every static asset (2026-10-11).
    with open(os.path.join(dst, "_routes.json"), "w") as f:
        json.dump({"version": 1, "include": ["/*"],
                   "exclude": ["/_next/static/*"]}, f)
    print(f"Assembled {dst} from fresh .open-next build.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
