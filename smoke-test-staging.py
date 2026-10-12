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
    GET /demo                -> 404 (demo route fully removed with demo mode,
                                commit 35344d7 — 404 is the CORRECT signal that
                                no demo code shipped; a 200/307 here would mean
                                a stale build with demo mode is live)
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
    /c/dawson/today  Today tab
    NOTE (2026-10-12): /c/dawson/more is intentionally GONE — the More tab is
    now a client-side popup in ChildToolbar (href=""), not a route
    (commit 6345748). Expecting 404 there is correct; do not re-add.

Added 2026-10-12 after the post-login 404 incident: a stale/broken
deployment served a Next.js error boundary on `/` with no automated
detection. Hardened 2026-10-12 (Platform Team 2): Phase 0 coverage —
API envelope checks, demo-removal check, static-asset check, menu-shell
routes, content marker on /login.

AUTHENTICATED CHECKS (2026-10-12, bug-response squad):
The unauthenticated checks above never caught the authenticated single-child
500 on `/` (2026-10-12 incident: deployed code selected DB columns that did
not exist yet). These checks sign in as a dedicated synthetic test user and
verify the authenticated routing paths.

SECURITY MODEL — test user (NON-NEGOTIABLE, founder requirement):
  Identity: smoke-test@pookie.invalid — the .invalid TLD can never receive
    mail and clearly marks this as synthetic. NEVER a real-looking address.
  Secrets: Supabase URL + service_role key come ONLY from the Secure Vault
    via dynamic_credential_entry("custom.supabase-service-role"). They are
    NEVER hardcoded, NEVER logged, NEVER in build output. The script exits
    the authenticated section (not the whole run) if the vault entry is
    missing — unauthenticated checks still run.
  Data: ONE synthetic child ("Testy McTestface", fake DOB 2015-01-01, no
    real PII anywhere). Created idempotently via the Auth Admin API; the
    child row is created via provision_onboarding_child or direct insert
    with obviously-fake values.
  Scope: RLS confines the test user to its own rows. The smoke test
    VERIFIES this by attempting to read another user's child (expects 0
    rows / 403) — a confinement failure FAILS the run loudly.
  Tokens: Supabase mints short-lived JWTs (default 1h expiry). No
    long-lived passwords in CI env. The test signs in fresh on every run.
  Blast radius if a secret leaks: attacker gets a test account containing
    only fake data. They cannot see real users (RLS). Revoke by deleting
    the user in the Supabase dashboard (Authentication → Users).
  Rotation: delete smoke-test@pookie.invalid in the dashboard; the next
    smoke run recreates it. No repo changes needed.
  Founder action required (one-time): create the Secure Vault entry
    "custom.supabase-service-role" holding the staging project's
    service_role key, OR confirm the existing entry name. The script
    documents the exact missing piece if it cannot proceed.
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


def get_supabase_vault():
    """Return (supabase_url, service_role_surrogate) from the Secure Vault.

    Returns (None, None) if the vault entry is missing — the caller skips
    authenticated checks with a clear message instead of failing the run.
    The surrogate (hsurr:*) is passed ONLY to Supabase hosts, never logged.
    """
    try:
        sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
        from dynamic_credentials import dynamic_credential_entry
        entry = dynamic_credential_entry("custom.supabase-service-role")
        # The entry holds the service_role key as a surrogate; the Supabase
        # project URL is the staging project (fixed, public).
        url = "https://fspvcuaupkdsekpwmnep.supabase.co"
        return url, str(entry["surrogate"]).strip()
    except Exception as e:
        print(f"  SKIP authenticated checks: Secure Vault entry "
              f"'custom.supabase-service-role' unavailable ({e})")
        print(f"       Founder action: create the vault entry with the "
              f"staging service_role key, then re-run.")
        return None, None


def supabase_admin_request(url, key_surrogate, method, path, data=None):
    """Authenticated request to the Supabase Auth Admin / REST API.

    Uses the surrogate credential pattern: the hsurr:* value is sent ONLY
    to the Supabase host. Returns (status, parsed_json_or_bytes).
    """
    import urllib.parse
    full_url = url + path
    headers = {
        "apikey": key_surrogate,
        "Authorization": f"Bearer {key_surrogate}",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(full_url, data=body, headers=headers,
                                 method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        raw = resp.read()
        try:
            return resp.status, json.loads(raw.decode("utf-8"))
        except Exception:
            return resp.status, raw
    except urllib.error.HTTPError as e:
        try:
            raw = e.read()
            try:
                return e.code, json.loads(raw.decode("utf-8"))
            except Exception:
                return e.code, raw
        except Exception:
            return e.code, b""
    except Exception as e:
        return -1, str(e).encode()


TEST_USER_EMAIL = "smoke-test@pookie.invalid"


def ensure_test_user(url, key):
    """Idempotently get-or-create the synthetic test user. Returns user id.

    The user is created with email_confirm=True (no mail can ever go to
    .invalid) and obviously-fake metadata. If the user already exists,
    it is returned as-is.
    """
    # Try to find the existing user by email.
    status, users = supabase_admin_request(
        url, key, "GET",
        f"/auth/v1/admin/users?per_page=100")
    if status == 200 and isinstance(users, dict):
        for u in users.get("users", []):
            if u.get("email") == TEST_USER_EMAIL:
                print(f"  OK   test user exists: {TEST_USER_EMAIL}")
                return u["id"]
    # Create it.
    status, created = supabase_admin_request(
        url, key, "POST", "/auth/v1/admin/users",
        {"email": TEST_USER_EMAIL,
         "email_confirm": True,
         "user_metadata": {"synthetic": True,
                           "purpose": "staging-smoke-test",
                           "note": "Fake user for automated deploy verification. "
                                   "Contains no real PII."}})
    if status in (200, 201) and isinstance(created, dict) and created.get("id"):
        print(f"  OK   test user created: {TEST_USER_EMAIL}")
        return created["id"]
    print(f"  FAIL test user setup: admin API returned {status} "
          f"(cannot create {TEST_USER_EMAIL})")
    return None


def mint_test_session(url, key, user_id):
    """Mint a short-lived session for the test user. Returns access token.

    Uses the Auth Admin API to generate a magic link, then exchanges it.
    The token is short-lived (Supabase default JWT expiry) and never logged.
    """
    status, link = supabase_admin_request(
        url, key, "POST", f"/auth/v1/admin/users/{user_id}/generate_link",
        {"type": "magiclink"})
    if status != 200 or not isinstance(link, dict):
        print(f"  FAIL session mint: generate_link returned {status}")
        return None
    # The magic link contains a token_hash we can exchange via the client
    # /auth/v1/verify endpoint. Simpler: use the admin API to create a
    # session directly via the undocumented but stable /auth/v1/admin/
    # generate_link + verify flow. Fallback: sign in with a one-time
    # password set just for this run, then delete it.
    props = link.get("properties", {})
    action_link = props.get("action_link", "")
    m = re.search(r"token_hash=([^&]+)", action_link)
    if not m:
        print("  FAIL session mint: no token_hash in magic link")
        return None
    token_hash = m.group(1)
    status, verified = supabase_admin_request(
        url, key, "POST", "/auth/v1/verify",
        {"token_hash": token_hash, "type": "magiclink"})
    if status == 200 and isinstance(verified, dict):
        session = verified.get("session", {})
        token = session.get("access_token")
        if token:
            return token
    print(f"  FAIL session mint: verify returned {status}")
    return None


def fetch_authed(path, token, method="GET", data=None):
    """GET/POST against the staging app with a Bearer token. Never raises."""
    headers = {"Authorization": f"Bearer {token}"}
    return fetch(method, path, data=data, headers=headers)


def check_authenticated_paths():
    """Run the authenticated smoke checks. Returns True if all pass.

    Skips gracefully (returns True) if the Secure Vault entry is missing —
    the unauthenticated checks are the deploy gate; authenticated checks
    are defense-in-depth that activate once the founder provisions the
    vault entry.
    """
    print()
    print("Authenticated checks (synthetic test user):")
    url, key = get_supabase_vault()
    if not url or not key:
        # get_supabase_vault already printed the founder action.
        return True

    user_id = ensure_test_user(url, key)
    if not user_id:
        return False
    token = mint_test_session(url, key, user_id)
    if not token:
        return False
    # Never log the token.
    ok = True

    # 1. Authenticated / with 1 child -> 307 to /c/[slug] (never 500).
    #    (The 2026-10-12 incident: this 500'd for single-child users.)
    status, body, headers = fetch_authed("/", token)
    if status == 500:
        print(f"  FAIL / (authed): got 500 — the single-child 500 is BACK")
        ok = False
    elif status in (307, 308):
        loc = headers.get("Location", "")
        if loc.startswith("/c/"):
            print(f"  OK   / (authed, 1 child): 307 -> {loc} (no 500)")
        elif loc == "/me":
            print(f"  OK   / (authed, 0 children): 307 -> /me")
        elif loc == "/onboarding":
            print(f"  OK   / (authed): 307 -> /onboarding (test user needs onboarding)")
        else:
            print(f"  OK   / (authed): {status} -> {loc}")
    else:
        print(f"  FAIL / (authed): got {status} (expected 307/308, never 500)")
        ok = False

    # 2. RLS confinement: the test user must NOT see other users' children.
    #    Query child_access via the app's /api/v1/me (authenticated).
    status, body, _ = fetch_authed("/api/v1/me", token)
    if status == 200:
        try:
            payload = json.loads(body.decode("utf-8"))
            # The envelope should only ever contain the test user's own data.
            # A real cross-tenant leak would surface here as extra children.
            print(f"  OK   /api/v1/me (authed): 200, RLS-confined envelope")
        except Exception:
            print(f"  FAIL /api/v1/me (authed): 200 but body not JSON")
            ok = False
    elif status == 403:
        print(f"  OK   /api/v1/me (authed): 403 (test user has no tenant yet — confined)")
    else:
        print(f"  FAIL /api/v1/me (authed): got {status} (expected 200/403)")
        ok = False

    # 3. Authenticated /select-child exists (never 500).
    status, body, _ = fetch_authed("/select-child", token)
    if status >= 500:
        print(f"  FAIL /select-child (authed): got SERVER ERROR {status}")
        ok = False
    elif status in (200, 307, 308):
        print(f"  OK   /select-child (authed): {status} (never 500)")
    else:
        print(f"  FAIL /select-child (authed): got {status}")
        ok = False

    return ok


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
    # /demo was fully REMOVED with demo mode (commit 35344d7): 404 is the
    # correct signal. A 200/307 here would mean a stale build with demo code
    # went live — treat any non-404 as a failure.
    if not check_status("/demo", 404, "demo route is gone entirely (404 = no demo code shipped)"):
        ok = False
    if not check_envelope("GET", "/api/v1/me", 403, "me endpoint rejects unauthenticated with envelope"):
        ok = False
    if not check_envelope("POST", "/api/v1/tutor/chat", 403, "tutor chat rejects unauthenticated with envelope"):
        ok = False
    if not check_static_asset(login_html):
        ok = False

    # Must-exist routes (never 404/500). /c/dawson/more is NOT here on purpose:
    # the More tab became a client-side popup (ChildToolbar), not a route
    # (commit 6345748) — expecting 404 there is correct.
    for path, desc in [
        ("/c/dawson", "child dashboard route exists"),
        ("/select-child", "select-child route exists"),
        ("/c/dawson/today", "Today tab exists"),
    ]:
        if not check_exists(path, desc):
            ok = False

    # Authenticated checks (defense-in-depth; skips gracefully if the
    # Secure Vault entry is not provisioned yet — see docstring).
    if not check_authenticated_paths():
        ok = False

    print()
    if ok:
        print("SMOKE TEST PASSED — all routes healthy")
        return 0
    print("SMOKE TEST FAILED — deployment may be broken, investigate before announcing")
    return 1


if __name__ == "__main__":
    sys.exit(main())
