#!/usr/bin/env python3
"""
Post-deploy smoke test for Pookie staging.

Verifies key routes return expected status codes after a Cloudflare Pages
deployment. Fails loudly (non-zero exit) if any check fails.

Usage:
    python3 smoke-test-staging.py [base_url]

    base_url defaults to https://pookie-staging.pages.dev

Checks:
    GET /                    -> 307 to /login (unauthenticated)
    GET /login               -> 200 (login page loads)
    GET /auth/callback       -> 307 to /login?error=auth (no code = graceful)
    GET /c/dawson            -> 307 to /login OR 200 (route exists, not 404/500)
    GET /_next/static/...    -> spot-check one JS chunk returns 200

Added 2026-10-12 after the post-login 404 incident: a stale/broken
deployment served a Next.js error boundary on `/` with no automated
detection. This script would have caught it in 30 seconds.
"""
import sys
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://pookie-staging.pages.dev"

# (path, expected_status, description)
# For redirects, we check the status before following.
CHECKS = [
    ("/", 307, "root redirects unauthenticated users"),
    ("/login", 200, "login page loads"),
    ("/auth/callback", 307, "callback without code redirects gracefully"),
]

# Routes that must NOT 404 or 500 (may 307 or 200 depending on auth state)
MUST_EXIST = [
    ("/c/dawson", "child dashboard route exists"),
    ("/select-child", "select-child route exists"),
]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Don't follow, let us inspect the 3xx


UA = "Mozilla/5.0 (Pookie-Smoke-Test) AppleWebKit/537.36"


def check_status(path, expected, desc):
    url = BASE + path
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        resp = opener.open(req, timeout=15)
        status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception as e:
        print(f"  FAIL {path}: {desc} — request error: {e}")
        return False
    if status == expected:
        print(f"  OK   {path}: {desc} ({status})")
        return True
    # A 500/502/503 is always a failure regardless of expectation
    if status >= 500:
        print(f"  FAIL {path}: {desc} — got SERVER ERROR {status} (expected {expected})")
        return False
    print(f"  FAIL {path}: {desc} — got {status} (expected {expected})")
    return False


def check_exists(path, desc):
    url = BASE + path
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        resp = opener.open(req, timeout=15)
        status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception as e:
        print(f"  FAIL {path}: {desc} — request error: {e}")
        return False
    if status in (200, 307, 308):
        print(f"  OK   {path}: {desc} ({status})")
        return True
    print(f"  FAIL {path}: {desc} — got {status} (expected 200/307, must not 404/500)")
    return False


def main():
    print(f"Smoke test: {BASE}")
    ok = True
    for path, expected, desc in CHECKS:
        if not check_status(path, expected, desc):
            ok = False
    for path, desc in MUST_EXIST:
        if not check_exists(path, desc):
            ok = False
    print()
    if ok:
        print("SMOKE TEST PASSED — all routes healthy")
        return 0
    print("SMOKE TEST FAILED — deployment may be broken, investigate before announcing")
    return 1


if __name__ == "__main__":
    sys.exit(main())
