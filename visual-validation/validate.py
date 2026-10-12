#!/usr/bin/env python3
"""
Squad Prism — visual validation for Pookie staging.

Captures screenshots of key public pages on https://pookie-staging.pages.dev
after each deploy and checks for visual regressions:

  CRITICAL (exit non-zero, rollback suggested):
    - blank/uniform page (std dev ~ 0)           -> render failure / error boundary
    - white error page (mean luminance ~ 255)    -> Next.js error page
    - HTTP 500 on any checked route
    - screenshot capture failure
  WARNING (exit 0, flagged in report):
    - orb missing on /login (bright-core pixel share collapsed)
    - theme drift bright (mean luminance far above dark-cosmos baseline)
    - baseline diff above thresholds (layout changed)

Auth-required pages (home, today, command deck) cannot be screenshotted
without a signed-in session -- they are status-checked only and marked
"needs signed-in validation" for the browser-task pass.

Sandbox networking: the egress proxy drops unauthenticated CONNECTs, so
Chromium is pointed at a local relay (relay.py) that injects
Proxy-Authorization preemptively. Credentials come from HTTPS_PROXY env.

Usage:
    python3 visual-validation/validate.py [--refresh-baseline]

Baseline: first run establishes baseline/ screenshots. Later runs diff
against them. After an intentional redesign, re-run with
--refresh-baseline to approve the new look.
"""

import argparse
import base64
import datetime
import io
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://pookie-staging.pages.dev"
CHROME = "/opt/meta-chromium/chrome"
RELAY_PORT = 18080

# page, viewport, orb_expected, theme
TARGETS = [
    {"name": "login-desktop", "path": "/login", "w": 1440, "h": 900, "orb": True},
    {"name": "login-mobile", "path": "/login", "w": 390, "h": 844, "orb": True},
    {"name": "root-desktop", "path": "/", "w": 1440, "h": 900, "orb": False},
]

# auth-required: status check only (expect redirect to /login, never 404/500)
AUTH_PAGES = ["/select-child", "/c/dawson", "/c/dawson/today"]

# Heuristic thresholds (calibrated 2026-10-12 against live staging)
BLANK_STD_MAX = 3.0        # below -> page rendered nothing
WHITE_MEAN_MIN = 200.0     # above -> white error page
ORB_BRIGHT_MIN_PCT = 0.30  # /login bright-core share below -> orb missing
BRIGHT_THEME_MEAN = 120.0  # above -> dark-cosmos theme drifted bright
DIFF_WARN_PCT = 8.0        # baseline diff above -> minor change
DIFF_FAIL_PCT = 25.0       # baseline diff above -> investigate


def log(msg):
    print(f"[prism] {msg}", flush=True)


# ---------------------------------------------------------------- relay

def relay_running():
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", RELAY_PORT))
        s.close()
        return True
    except OSError:
        return False


def start_relay():
    if relay_running():
        log("proxy relay already running")
        return None
    p = subprocess.Popen(
        [sys.executable, os.path.join(HERE, "relay.py")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        if relay_running():
            log("proxy relay started")
            return p
        time.sleep(0.2)
    raise RuntimeError("proxy relay failed to start")


# ---------------------------------------------------------------- capture

def http_status(path):
    req = urllib.request.Request(BASE_URL + path, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.url
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, f"error: {e}"


def capture(targets, run_dir):
    """Screenshot each target with Playwright + system Chromium. Returns dict."""
    from playwright.sync_api import sync_playwright

    results = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=CHROME,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--ignore-certificate-errors",  # sandbox proxy MITMs TLS
                f"--proxy-server=http://127.0.0.1:{RELAY_PORT}",
            ],
        )
        for t in targets:
            out = os.path.join(run_dir, t["name"] + ".png")
            try:
                page = browser.new_page(viewport={"width": t["w"], "height": t["h"]})
                resp = page.goto(BASE_URL + t["path"], wait_until="domcontentloaded",
                                 timeout=45000)
                status = resp.status if resp else 0
                page.wait_for_timeout(6000)  # let orb/cosmos animations settle
                page.screenshot(path=out)
                page.close()
                results[t["name"]] = {"ok": True, "http": status,
                                      "final_url": page.url if False else "",
                                      "png": out}
            except Exception as e:
                results[t["name"]] = {"ok": False, "error": str(e)[:200]}
        browser.close()
    return results


# ---------------------------------------------------------------- analysis

def analyze(png_path):
    """Return luminance stats for regression heuristics."""
    from PIL import Image
    import numpy as np

    img = Image.open(png_path).convert("RGB")
    g = np.asarray(img.convert("L"), dtype=np.float32)
    return {
        "size": img.size,
        "mean_lum": float(g.mean()),
        "std": float(g.std()),
        "bright_pct": float(100 * (g > 235).mean()),
    }


def baseline_diff(cur_png, base_png):
    """Mean abs diff (%) on downscaled grayscale. Animation-tolerant."""
    from PIL import Image
    import numpy as np

    a = np.asarray(Image.open(cur_png).convert("L").resize((320, 200)),
                   dtype=np.float32)
    b = np.asarray(Image.open(base_png).convert("L").resize((320, 200)),
                   dtype=np.float32)
    return float(np.abs(a - b).mean() / 255 * 100)


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh-baseline", action="store_true",
                    help="approve current captures as the new baseline")
    args = ap.parse_args()

    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = os.path.join(HERE, "runs", ts)
    os.makedirs(run_dir, exist_ok=True)
    baseline_dir = os.path.join(HERE, "baseline")

    relay_proc = start_relay()
    critical, warnings, rows = [], [], []

    try:
        # 1. public pages: screenshot + analyze
        caps = capture(TARGETS, run_dir)
        for t in TARGETS:
            name = t["name"]
            cap = caps[name]
            base_png = os.path.join(baseline_dir, name + ".png")

            if not cap.get("ok"):
                critical.append(f"{name}: capture failed ({cap.get('error')})")
                rows.append((name, "CRITICAL", "capture failed"))
                continue
            if cap["http"] >= 500:
                critical.append(f"{name}: HTTP {cap['http']}")
                rows.append((name, "CRITICAL", f"HTTP {cap['http']}"))
                continue

            stats = analyze(cap["png"])
            verdict, notes = "PASS", []

            if stats["std"] < BLANK_STD_MAX:
                critical.append(f"{name}: BLANK page (std={stats['std']:.2f})")
                verdict = "CRITICAL"
            elif stats["mean_lum"] > WHITE_MEAN_MIN:
                critical.append(f"{name}: white error page (mean={stats['mean_lum']:.1f})")
                verdict = "CRITICAL"

            if verdict == "PASS":
                if t["orb"] and stats["bright_pct"] < ORB_BRIGHT_MIN_PCT:
                    warnings.append(f"{name}: orb possibly missing "
                                    f"(bright={stats['bright_pct']:.2f}%)")
                    notes.append("orb?")
                if stats["mean_lum"] > BRIGHT_THEME_MEAN:
                    warnings.append(f"{name}: theme drifted bright "
                                    f"(mean={stats['mean_lum']:.1f})")
                    notes.append("bright-theme")

                if os.path.exists(base_png) and not args.refresh_baseline:
                    d = baseline_diff(cap["png"], base_png)
                    notes.append(f"diff={d:.1f}%")
                    if d > DIFF_FAIL_PCT:
                        warnings.append(f"{name}: large baseline diff {d:.1f}% "
                                        f"-> investigate")
                        verdict = "WARN"
                    elif d > DIFF_WARN_PCT:
                        warnings.append(f"{name}: minor baseline diff {d:.1f}% "
                                        f"(likely animation)")
                        if verdict == "PASS":
                            verdict = "WARN"
                elif args.refresh_baseline or not os.path.exists(base_png):
                    shutil.copy(cap["png"], base_png)
                    notes.append("baseline set")

            rows.append((name, verdict,
                         f"http={cap['http']} mean={stats['mean_lum']:.1f} "
                         f"std={stats['std']:.1f} bright={stats['bright_pct']:.2f}% "
                         + " ".join(notes)))
            log(f"{name}: {verdict} ({rows[-1][2]})")

        # 2. auth pages: status only
        for path in AUTH_PAGES:
            status, final = http_status(path)
            if status >= 500 or status == 0:
                critical.append(f"{path}: HTTP {status} (auth page)")
                rows.append((path, "CRITICAL", f"HTTP {status}"))
            elif status == 404:
                critical.append(f"{path}: 404 (auth page should exist)")
                rows.append((path, "CRITICAL", "404"))
            else:
                rows.append((path, "PASS",
                             f"HTTP {status} -> needs signed-in validation"))
            log(f"{path}: {rows[-1][1]} ({rows[-1][2]})")

    finally:
        if relay_proc:
            relay_proc.terminate()

    # 3. report
    report = {
        "ts": ts, "base_url": BASE_URL,
        "critical": critical, "warnings": warnings,
        "rows": [{"page": r[0], "verdict": r[1], "detail": r[2]} for r in rows],
    }
    with open(os.path.join(run_dir, "report.json"), "w") as f:
        json.dump(report, f, indent=2)

    append_build_log(ts, rows, critical, warnings)
    log(f"report: {run_dir}/report.json")

    if critical:
        print("\nCRITICAL ISSUES:")
        for c in critical:
            print(f"  !! {c}")
        print("SUGGESTION: consider rollback of the latest staging deploy.")
        return 2
    if warnings:
        print("\nWARNINGS:")
        for w in warnings:
            print(f"  ! {w}")
    print("\nNo critical issues.")
    return 0


def append_build_log(ts, rows, critical, warnings):
    dt = datetime.datetime.now().strftime("%Y-%m-%d ~%H:%M EDT")
    lines = [f"\n## {dt} — Squad Prism — visual validation ({ts})\n"]
    for name, verdict, detail in rows:
        icon = {"PASS": "✅", "WARN": "⚠️", "CRITICAL": "❌"}.get(verdict, "❓")
        lines.append(f"- {icon} `{name}` — {verdict} — {detail}")
    if critical:
        lines.append("\n**CRITICAL:** " + "; ".join(critical))
        lines.append("**Suggested action:** roll back the latest staging deploy "
                     "and re-validate.")
    elif warnings:
        lines.append("\nWarnings: " + "; ".join(warnings))
    else:
        lines.append("\nNo critical issues. Baseline diffs within animation noise.")
    lines.append("")
    with open(os.path.expanduser("~/workspace/pookie-app/docs/BUILD-LOG.md"),
              "a") as f:
        f.write("\n".join(lines))
    log("BUILD-LOG.md updated")


if __name__ == "__main__":
    sys.exit(main())
