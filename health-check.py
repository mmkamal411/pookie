#!/usr/bin/env python3
"""
Pookie health check — staging + production endpoint monitor.

Checks critical endpoints on each environment, writes docs/health-status.json,
prints a human-readable summary, and exits 0 only if every check passes.

Read-only: makes GET requests only. Deploys nothing, modifies nothing except
docs/health-status.json (the status file this script owns).

Usage:
    python3 health-check.py

Environment layout (see docs/handbook-sections/05-cicd-pipeline.md):
    staging         https://pookie-staging.pages.dev
                    CANONICAL staging URL. Both deploy paths (CI
                    deploy-staging.yml and local deploy-staging.py) deploy
                    with `wrangler pages deploy` WITHOUT --branch, which
                    publishes to the project's production alias — this URL.
    staging_branch_preview
                    https://staging-build.pookie-staging.pages.dev
                    Deprecated branch-preview subdomain. Goes stale after
                    every deploy (not a deploy target since 2026-10-12);
                    checked for liveness only, never for freshness.
    production      https://pookie.pages.dev
                    Production. Deploys only on Mehedi's explicit go-ahead.
                    NOTE: the live `pookie` Pages project's assigned
                    subdomain is pookie-2ey.pages.dev; pookie.pages.dev
                    currently serves an unrelated page. Verify the intended
                    production domain before the first prod deploy.

Checks per environment:
    GET /                    -> 307 (root redirects unauthenticated users;
                                a 500 here = broken Pages function)
    GET /login               -> 200 + HTML contains "Pookie"
                                (shell renders; catches error-boundary-on-200)
    GET /auth/callback       -> 307 (no code = graceful redirect)
    GET /api/v1/me           -> 403 + canonical envelope with
                                error.code == TENANT_SCOPE_VIOLATION
                                (tenant firewall rejects unauthenticated)
    GET <first /_next/static chunk referenced by /login>
                             -> 200 (static assets serve via Pages; catches
                                stale/broken bundles and _routes.json regressions)

Patterns reused from smoke-test-staging.py (NoRedirect opener, UA, envelope
assertion). Runtime target: under 90s (serial requests, 15s timeouts).
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
STATUS_FILE = os.path.join(ROOT, "docs", "health-status.json")

UA = "Mozilla/5.0 (Pookie-Health-Check) AppleWebKit/537.36"
TIMEOUT = 15

ENVIRONMENTS = [
    {
        "name": "staging",
        "base_url": "https://pookie-staging.pages.dev",
        "canonical": True,
        "notes": "Canonical staging — the actual deploy target (CI + deploy-staging.py).",
    },
    {
        "name": "staging_branch_preview",
        "base_url": "https://staging-build.pookie-staging.pages.dev",
        "canonical": False,
        "notes": "Deprecated branch-preview subdomain — goes stale after each deploy; liveness only, not a deploy target.",
    },
    {
        "name": "production",
        "base_url": "https://pookie.pages.dev",
        "canonical": True,
        "notes": "Production. Deploys only on Mehedi's explicit go-ahead. (Live project subdomain is pookie-2ey.pages.dev — verify intended production domain before first prod deploy.)",
    },
]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Don't follow; let us inspect the 3xx


def fetch(base, path):
    """GET base+path. Returns (status:int, body:bytes, headers). Never raises."""
    url = base + path
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
    t0 = time.perf_counter()
    try:
        resp = opener.open(req, timeout=TIMEOUT)
        body = resp.read()
        ms = int((time.perf_counter() - t0) * 1000)
        return resp.status, body, resp.headers, ms, None
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        ms = int((time.perf_counter() - t0) * 1000)
        return e.code, body, e.headers, ms, None
    except Exception as e:
        ms = int((time.perf_counter() - t0) * 1000)
        return -1, b"", {}, ms, str(e)[:160]


def result(name, url, expected, actual, ok, ms, detail=""):
    return {
        "name": name,
        "url": url,
        "expected": expected,
        "actual": actual,
        "ok": ok,
        "ms": ms,
        "detail": detail,
    }


def check_root(env):
    base = env["base_url"]
    status, body, headers, ms, err = fetch(base, "/")
    if err:
        return result("root", base + "/", 307, -1, False, ms, f"request error: {err}")
    loc = ""
    try:
        loc = headers.get("Location", "")
    except Exception:
        pass
    ok = status == 307
    detail = f"Location: {loc}" if loc else ("SERVER ERROR" if status >= 500 else f"got {status}")
    return result("root", base + "/", 307, status, ok, ms, detail)


def check_login(env):
    base = env["base_url"]
    status, body, _, ms, err = fetch(base, "/login")
    if err:
        return result("login", base + "/login", 200, -1, False, ms, f"request error: {err}"), None
    if status != 200:
        note = "SERVER ERROR — possible error boundary" if status >= 500 else f"got {status}"
        return result("login", base + "/login", 200, status, False, ms, note), None
    html = body.decode("utf-8", errors="replace")
    if "Pookie" not in html:
        return result("login", base + "/login", 200, status, False, ms,
                      "200 but no 'Pookie' marker — error boundary?"), None
    return result("login", base + "/login", 200, status, True, ms,
                  f"shell renders ({len(body)} bytes)"), html


def check_callback(env):
    base = env["base_url"]
    status, _, _, ms, err = fetch(base, "/auth/callback")
    if err:
        return result("callback", base + "/auth/callback", 307, -1, False, ms, f"request error: {err}")
    ok = status == 307
    return result("callback", base + "/auth/callback", 307, status, ok, ms,
                  "graceful redirect" if ok else f"got {status}")


def check_me(env):
    base = env["base_url"]
    status, body, _, ms, err = fetch(base, "/api/v1/me")
    url = base + "/api/v1/me"
    if err:
        return result("me", url, 403, -1, False, ms, f"request error: {err}")
    if status != 403:
        return result("me", url, 403, status, False, ms, f"got {status}")
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        return result("me", url, 403, status, False, ms, "body is not JSON")
    err_obj = payload.get("error") if isinstance(payload, dict) else None
    code = err_obj.get("code") if isinstance(err_obj, dict) else None
    if payload.get("ok") is False and code == "TENANT_SCOPE_VIOLATION":
        return result("me", url, 403, status, True, ms, f"envelope ok, code={code}")
    return result("me", url, 403, status, False, ms, f"bad envelope, code={code!r}")


def check_static_asset(env, login_html):
    base = env["base_url"]
    name = "static_asset"
    if not login_html:
        return result(name, base + "/_next/static/*", 200, -1, False, 0,
                      "skipped: /login HTML unavailable")
    m = re.search(r'["\'](/_next/static/[^"\']+\.(?:js|css))["\']', login_html)
    if not m:
        return result(name, base + "/_next/static/*", 200, -1, False, 0,
                      "no /_next/static asset reference in /login HTML")
    asset = m.group(1)
    status, body, _, ms, err = fetch(base, asset)
    if err:
        return result(name, base + asset, 200, -1, False, ms, f"request error: {err}")
    ok = status == 200
    return result(name, base + asset, 200, status, ok, ms,
                  f"{len(body)} bytes" if ok else f"got {status} — stale bundle or _routes.json broken?")


def detect_app_presence(env):
    """Probe whether base_url serves the Pookie app at all.

    Returns (is_app: bool, note: str). Production may be documented but not
    yet deployed — e.g. pookie.pages.dev currently serves an unrelated
    Cloud Drive page. In that case we report not_deployed instead of FAIL.
    """
    base = env["base_url"]
    status, body, _, ms, err = fetch(base, "/login")
    if err:
        return False, f"/login unreachable: {err}"
    html = body.decode("utf-8", errors="replace")
    if status == 200 and "Pookie" in html:
        return True, "Pookie app detected"
    title = ""
    m = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip()[:80]
    # Second opinion: the app's / redirects unauthenticated users to /login.
    s2, _, headers2, _, _ = fetch(base, "/")
    loc = ""
    try:
        loc = headers2.get("Location", "")
    except Exception:
        pass
    if s2 == 307 and loc == "/login":
        return True, "Pookie app detected (root redirect)"
    return False, (
        f"not the Pookie app (GET /login -> {status}"
        + (f", title: {title!r}" if title else "")
        + ")"
    )


def check_environment(env):
    is_app, presence_note = detect_app_presence(env)
    if not is_app:
        return {
            "name": env["name"],
            "base_url": env["base_url"],
            "canonical": env["canonical"],
            "notes": env["notes"],
            "status": "not_deployed",
            "ok": None,
            "presence": presence_note,
            "endpoints": [],
        }
    endpoints = []
    endpoints.append(check_root(env))
    login_res, login_html = check_login(env)
    endpoints.append(login_res)
    endpoints.append(check_callback(env))
    endpoints.append(check_me(env))
    endpoints.append(check_static_asset(env, login_html))
    ok = all(e["ok"] for e in endpoints)
    return {
        "name": env["name"],
        "base_url": env["base_url"],
        "canonical": env["canonical"],
        "notes": env["notes"],
        "status": "healthy" if ok else "unhealthy",
        "ok": ok,
        "presence": presence_note,
        "endpoints": endpoints,
    }


def main():
    checked_at = datetime.now(timezone.utc).isoformat()
    print(f"Pookie health check — {checked_at}")
    print()

    env_results = {}
    for env in ENVIRONMENTS:
        label = env["name"] + ("" if env["canonical"] else "  (non-canonical alias)")
        print(f"[{label}] {env['base_url']}")
        res = check_environment(env)
        env_results[env["name"]] = res
        if res["status"] == "not_deployed":
            print(f"  -- NOT DEPLOYED: {res['presence']}")
            print(f"  -- {env['notes']}")
            print()
            continue
        for e in res["endpoints"]:
            mark = "OK  " if e["ok"] else "FAIL"
            status_txt = str(e["actual"]) if e["actual"] != -1 else "ERR"
            print(f"  {mark} {e['name']:13s} {status_txt:4s} {e['ms']:5d}ms  {e['detail']}")
        print(f"  -> {'HEALTHY' if res['ok'] else 'UNHEALTHY'}")
        print()

    live = {n: r for n, r in env_results.items() if r["status"] != "not_deployed"}
    skipped = [n for n, r in env_results.items() if r["status"] == "not_deployed"]
    overall_ok = all(r["ok"] for r in live.values())
    payload = {
        "checked_at": checked_at,
        "ok": overall_ok,
        "environments": env_results,
    }
    os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote {os.path.relpath(STATUS_FILE, ROOT)}")

    print()
    if overall_ok:
        print("HEALTH CHECK PASSED — all live environments healthy", end="")
        if skipped:
            print(f" (not deployed yet: {', '.join(skipped)})")
        else:
            print()
        return 0
    bad = [n for n, r in live.items() if not r["ok"]]
    print(f"HEALTH CHECK FAILED — unhealthy: {', '.join(bad)}", end="")
    if skipped:
        print(f" (not deployed yet: {', '.join(skipped)})")
    else:
        print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
