#!/usr/bin/env python3
"""Deploy Pookie to Cloudflare Pages (pookie-staging)."""
import os, shutil, subprocess, sys, json
sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import dynamic_credential_entry
APP_DIR = os.path.expanduser("~/workspace/pookie-app")
ACCOUNT_ID = "91264b3fa69afffd6ffe57bdb3c545a8"
PROJECT = "pookie-staging"
def rebuild():
    on, pd = os.path.join(APP_DIR, ".open-next"), os.path.join(APP_DIR, ".pages-deploy")
    shutil.rmtree(pd, ignore_errors=True); os.makedirs(pd)
    for i in os.listdir(os.path.join(on, "assets")):
        s, d = os.path.join(on, "assets", i), os.path.join(pd, i)
        shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)
    for s in ("cloudflare", "middleware", "server-functions"):
        shutil.copytree(os.path.join(on, s), os.path.join(pd, s))
    b = os.path.join(on, ".build")
    if os.path.isdir(b): shutil.copytree(b, os.path.join(pd, ".build"))
    shutil.copy2(os.path.join(on, "worker.js"), os.path.join(pd, "_worker.js"))
    # _routes.json: serve /_next/static/* directly from Pages, not via the worker.
    # Without this, the OpenNext worker 404s every static asset (lesson 2026-10-11).
    with open(os.path.join(pd, "_routes.json"), "w") as f:
        json.dump({"version": 1, "include": ["/*"], "exclude": ["/_next/static/*"]}, f)
entry = dynamic_credential_entry("custom.cloudflare")
env = dict(os.environ)
env["CLOUDFLARE_API_TOKEN"] = str(entry["surrogate"]).strip()
env["CLOUDFLARE_ACCOUNT_ID"] = ACCOUNT_ID
rebuild()
r = subprocess.run(["npx","wrangler","pages","deploy",".pages-deploy","--project-name",PROJECT,"--commit-dirty=true"], cwd=APP_DIR, env=env)
if r.returncode != 0:
    sys.exit(r.returncode)
# Post-deploy smoke test (added 2026-10-12 after the post-login 404 incident).
# A stale/broken deployment served a Next.js error boundary on `/` with no
# automated detection. This catches it in ~30s before anyone announces "deployed".
print("\n--- Running post-deploy smoke test ---")
import time
time.sleep(10)  # Give Cloudflare a moment to propagate the deployment
s = subprocess.run([sys.executable, os.path.join(APP_DIR, "smoke-test-staging.py"),
                    "https://pookie-staging.pages.dev"], cwd=APP_DIR)
if s.returncode != 0:
    print("\n*** DEPLOY MAY BE BROKEN — smoke test failed, investigate before announcing ***")
sys.exit(s.returncode)
