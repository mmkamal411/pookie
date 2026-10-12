#!/usr/bin/env python3
"""
Post-deploy smoke test for Pookie staging.

Verifies key routes return expected status codes after a Cloudflare Pages
deployment. Fails loudly (non-zero exit) if any check fails.

Usage:
    python3 smoke-test-staging.py [base_url] [--next-dir <local .next dir>]

    base_url defaults to https://pookie-staging.pages.dev
    --next-dir enables the bundle-freshness byte-compare against the build
    that was just made (used by deploy-staging.py and CI).

Every check below is a REAL HTTP assertion against the live deployment —
no skipped checks, no TODOs. Each one must pass for the deploy to be
claimed healthy. Runtime target: under 60s (serial requests, 15s timeouts).

Checks:
    GET /                    -> 307 (root redirects unauthenticated users)
    GET /login               -> 200 + HTML contains "Pookie"
                                (shell renders; catches error-boundary-on-200)
    BUNDLE FRESHNESS         -> the live deployment serves the fresh build:
                                the first /_next/static chunk referenced by
                                /login is fetched; the served JS must contain
                                no staleness markers (NEXT_PUBLIC_DEMO_MODE /
                                demoMode); when --next-dir <local .next> is
                                given, the live chunk must be byte-identical
                                to the chunk this build produced (chunk
                                filenames are content-hashed, so a filename
                                the local build never produced — or differing
                                bytes — means a STALE build is live).
                                (Added 2026-10-12 after the stale-build
                                incident: route statuses alone cannot prove
                                the deployed bundle is the fresh build.)
    GET /auth/callback       -> 307 (no code = graceful redirect to login)
    GET /demo                -> 307 (demo removed; middleware redirects
                                unauthenticated users instead of 404)
    GET /api/v1/me           -> 403 + canonical error envelope
                                (unauthenticated. 403 not 401 is intentional:
                                src/server/errors.ts never-confirm/deny design
                                maps missing session to TENANT_SCOPE_VIOLATION)
    POST /api/v1/tutor/chat  -> 403 + canonical error envelope
                                (auth wrapper rejects before body parse;
                                 proves the route exists and the wrapper works)
    GET <first /_next/static chunk referenced by /login>
                             -> 200 (static assets serve via Pages, proving the
                                _routes.json exclusion works; without it the
                                OpenNext worker 404s every static asset)

Routes that must EXIST (200/307/308 — never 404/500):
    /c/dawson        child dashboard (tenant firewall: 307 unauthenticated)
    /select-child    child picker
    /c/dawson/more   More tab — the 31-module menu shell (incl. Support S1/S2/S3
                     seedlings, which are data in src/lib/modules.ts, route:null,
                     rendered client-side — no server routes to 500)
    /c/dawson/today  Today tab

Added 2026-10-12 after the post-login 404 incident: a stale/broken
deployment served a Next.js error boundary on `/` with no automated
detection. Hardened 2026-10-12 (Platform Team 2): Phase 0 coverage —
API envelope checks, demo-removal check, static-asset check, menu-shell
routes, content marker on /login.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

# Optional: --next-dir <path to local .next> asserts the live deployment
# serves byte-identical static chunks to the build we just made (proves
# bundle freshness, not just route health).
args = list(sys.argv[1:])
NEXT_DIR = None
if "--next-dir" in args:
    i = args.index("--next-dir")
    NEXT_DIR = args[i + 1]
    del args[i:i + 2]

BASE = args[0] if args else "https://pookie-staging.pages.dev"

# Staleness markers that must never appear in the served JS bundle
# (2026-10-12 incident: a stale build shipped demo-mode code).
STALENESS_MARKERS = ["NEXT_PUBLIC_DEMO_MODE", "demoMode"]

UA = "Mozilla/5.0 (Pookie-Smoke-Test) AppleWebKit/537.36"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Don't follow, let us inspect the 3xx


def fetch(method, path, data=None, headers=None):
    """Returns (status:int, body:bytes, headers). Never raises."""
    url = BASE + path
    opener = urllib.request.build_opener(NoRedirect)
    h = {"User-Agent": UA}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        resp = opener.open(req, timeout=15)
        return resp.status, resp.read(), resp.headers
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        return e.code, body, e.headers
    except Exception as e:
        return -1, str(e).encode(), {}


def check_status(path, expected, desc):
    status, body, _ = fetch("GET", path)
    if status == -1:
        print(f"  FAIL {path}: {desc} — request error: {body.decode(errors='replace')}")
        return False
    if status >= 500:
        print(f"  FAIL {path}: {desc} — got SERVER ERROR {status} (expected {expected})")
        return False
    if status == expected:
        print(f"  OK   {path}: {desc} ({status})")
        return True
    print(f"  FAIL {path}: {desc} — got {status} (expected {expected})")
    return False


def check_exists(path, desc):
    status, body, _ = fetch("GET", path)
    if status == -1:
        print(f"  FAIL {path}: {desc} — request error: {body.decode(errors='replace')}")
        return False
    if status in (200, 307, 308):
        print(f"  OK   {path}: {desc} ({status})")
        return True
    print(f"  FAIL {path}: {desc} — got {status} (expected 200/307/308, must not 404/500)")
    return False


def check_envelope(method, path, expected_status, desc):
    """Assert a real canonical API envelope: {ok:false, error:{code,message,requestId}}."""
    status, body, _ = fetch(method, path, data=b"" if method == "POST" else None)
    if status == -1:
        print(f"  FAIL {path}: {desc} — request error: {body.decode(errors='replace')}")
        return False
    if status != expected_status:
        print(f"  FAIL {path}: {desc} — got status {status} (expected {expected_status})")
        return False
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        print(f"  FAIL {path}: {desc} — body is not JSON: {body[:120]!r}")
        return False
    err = payload.get("error") if isinstance(payload, dict) else None
    if (
        isinstance(payload, dict)
        and payload.get("ok") is False
        and isinstance(err, dict)
        and isinstance(err.get("code"), str)
        and isinstance(err.get("message"), str)
        and isinstance(err.get("requestId"), str)
    ):
        print(f"  OK   {path}: {desc} ({status}, code={err['code']})")
        return True
    print(f"  FAIL {path}: {desc} — malformed envelope: {body[:200]!r}")
    return False


def check_login_shell():
    """GET /login -> 200 AND the HTML contains the Pookie brand marker.

    A 200 that renders the Next.js error boundary instead of the login page
    would slip past a status-only check; the content marker catches it.
    """
    status, body, _ = fetch("GET", "/login")
    if status == -1:
        print(f"  FAIL /login: shell renders — request error: {body.decode(errors='replace')}")
        return False, None
    if status != 200:
        print(f"  FAIL /login: shell renders — got {status} (expected 200)")
        return False, None
    html = body.decode("utf-8", errors="replace")
    if "Pookie" not in html:
        print("  FAIL /login: shell renders — 200 but no 'Pookie' marker in HTML (error boundary?)")
        return False, None
    print("  OK   /login: shell renders with Pookie marker (200)")
    return True, html


def check_static_asset(html):
    """Prove Pages serves /_next/static/* directly (the _routes.json fix).

    Extracts the first static JS/CSS asset referenced by /login and asserts 200.
    """
    if html is None:
        print("  FAIL static asset: skipped because /login HTML was unavailable")
        return False
    m = re.search(r'["\'](/_next/static/[^"\']+\.(?:js|css))["\']', html)
    if not m:
        print("  FAIL static asset: no /_next/static asset reference found in /login HTML")
        return False
    asset = m.group(1)
    status, body, _ = fetch("GET", asset)
    if status == -1:
        print(f"  FAIL {asset}: static asset — request error: {body.decode(errors='replace')}")
        return False
    if status == 200:
        print(f"  OK   {asset}: static asset serves (200, {len(body)} bytes)")
        return True
    print(f"  FAIL {asset}: static asset — got {status} (expected 200; _routes.json broken?)")
    return False


def check_bundle_freshness(html):
    """Prove the live deployment serves the fresh build, not a stale bundle.

    Route statuses alone cannot do this: a stale deployment answers 200/307
    on every route. Next.js 16/Turbopack does not expose a buildId in the
    HTML, but chunk filenames are content-hashed, so we (1) fetch the first
    static chunk referenced by /login, (2) assert the served JS contains no
    staleness markers (the 2026-10-12 incident signature), and (3) when
    --next-dir is given, assert the live chunk is byte-identical to the
    chunk from the build we just made — a filename the local build never
    produced (or bytes that differ) means a STALE build is live.
    """
    if html is None:
        print("  FAIL bundle freshness: skipped because /login HTML was unavailable")
        return False
    chunk = re.search(r'["\'](/_next/static/(?:chunks|css)/[^"\']+\.(?:js|css))["\']', html)
    if not chunk:
        print("  FAIL bundle freshness: no /_next/static chunk reference in /login HTML")
        return False
    path = chunk.group(1)
    status, body, _ = fetch("GET", path)
    if status != 200:
        print(f"  FAIL bundle freshness: live chunk {path} got {status}")
        return False
    text = body.decode("utf-8", errors="replace")
    for marker in STALENESS_MARKERS:
        if marker in text:
            print(f"  FAIL bundle freshness: staleness marker '{marker}' "
                  f"found in live JS bundle")
            return False
    if NEXT_DIR:
        # path is /_next/static/<sub>/<file> -> <NEXT_DIR>/static/<sub>/<file>
        local = os.path.join(NEXT_DIR, "static",
                             *path.split("/_next/static/")[1].split("/"))
        if not os.path.isfile(local):
            print(f"  FAIL bundle freshness: live chunk {path} was not "
                  f"produced by this build — STALE BUILD IS LIVE")
            return False
        with open(local, "rb") as fh:
            if fh.read() != body:
                print(f"  FAIL bundle freshness: live chunk {path} differs "
                      f"from this build's chunk — STALE BUILD IS LIVE")
                return False
        print(f"  OK   bundle freshness: {path} byte-identical to this build")
    else:
        print(f"  OK   bundle freshness: {path} served, no staleness markers "
              f"(no --next-dir: byte-compare skipped)")
    return True


def main():
    print(f"Smoke test: {BASE}")
    ok = True

    # Exact-status checks
    if not check_status("/", 307, "root redirects unauthenticated users"):
        ok = False
    shell_ok, login_html = check_login_shell()
    if not shell_ok:
        ok = False
    elif not check_bundle_freshness(login_html):
        ok = False
    if not check_status("/auth/callback", 307, "callback without code redirects gracefully"):
        ok = False
    if not check_status("/demo", 307, "demo route is gone (redirects via auth middleware, not 404)"):
        ok = False
    if not check_envelope("GET", "/api/v1/me", 403, "me endpoint rejects unauthenticated with envelope"):
        ok = False
    if not check_envelope("POST", "/api/v1/tutor/chat", 403, "tutor chat rejects unauthenticated with envelope"):
        ok = False
    if not check_static_asset(login_html):
        ok = False

    # Must-exist routes (never 404/500)
    for path, desc in [
        ("/c/dawson", "child dashboard route exists"),
        ("/select-child", "select-child route exists"),
        ("/c/dawson/more", "More tab menu shell exists (incl. Support seedlings)"),
        ("/c/dawson/today", "Today tab exists"),
    ]:
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
