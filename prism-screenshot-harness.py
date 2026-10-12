#!/usr/bin/env python3
"""
PRISM visual-regression screenshot harness.

Captures full-page PNGs of every Prism verification surface on staging at
both mobile (390x844) and desktop (1440x900) viewports, in a run directory
the coordinator can hand straight to QA (Prism E6) for baseline/regression
comparison.

Usage:
    python3 prism-screenshot-harness.py [--base-url URL] [--slug SLUG]
                                        [--out-dir DIR] [--storage-state FILE]
                                        [--mobile-only | --desktop-only]
                                        [--headed]

  --base-url       Defaults to the ONLY canonical staging URL:
                   https://pookie-staging.pages.dev
                   (never the Cloudflare branch-preview URL).
  --slug           Child slug for tenant routes. Default: dawson.
  --out-dir        Run directory. Default:
                   docs/PRISM-QA/screenshots/<YYYYMMDD-HHMMSS>/
  --storage-state  Playwright storage-state JSON (signed-in session) used for
                   authenticated pages. Without it, only public surfaces are
                   captured and authenticated pages are skipped with a note.
                   To create one: run the browser once with --headed, sign in
                   via Google/magic link, then the script saves the state.
  --save-state     Path to write a fresh storage state after the run
                   (implies --headed + manual sign-in during the run).

Pages captured (order matters for the QA log):
  01-login          /login                          (public)
  02-home           /c/<slug>                       (Home tab)
  03-today          /c/<slug>/today                 (Today tab)
  04-pookie         /c/<slug>/pookie                (Pookie tab)
  05-progress       /c/<slug>/school                (Progress tab)
  06-more           /c/<slug> + More popup open     (More = client-side popup)
  07-module         /c/<slug>/health                (one module page)
  08-sync           /c/<slug>/settings/sync         (Sync Command Center)
  09-village        /village                        (The Village)

Each page: full-page screenshot at 390x844 and 1440x900.
Output: docs/PRISM-QA/screenshots/<run>/NN-name-390x844.png etc. plus
manifest.json (url, viewport, timestamp, page order).

Prereqs: pip install playwright && python3 -m playwright install chromium
"""

import argparse
import datetime
import json
import os
import sys

BASE_DEFAULT = "https://pookie-staging.pages.dev"
VIEWPORTS = [(390, 844), (1440, 900)]

PAGES = [
    # (key, url-template, needs_auth, description)
    ("01-login", "/login", False, "Login / landing page (public)"),
    ("02-home", "/c/{slug}", True, "Home tab — child dashboard"),
    ("03-today", "/c/{slug}/today", True, "Today tab"),
    ("04-pookie", "/c/{slug}/pookie", True, "Pookie tab (AI chat)"),
    ("05-progress", "/c/{slug}/school", True, "Progress tab (school hub)"),
    ("06-more", "/c/{slug}", True, "More — module popup open"),
    ("07-module", "/c/{slug}/health", True, "One module page (health)"),
    ("08-sync", "/c/{slug}/settings/sync", True, "Sync Command Center"),
    ("09-village", "/village", True, "The Village (mentors)"),
]


def banner(msg):
    print(f"\n== {msg} ==")


def capture(args, browser, base, slug, out_dir, width, height, context_kwargs):
    ctx = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
        **context_kwargs,
    )
    page = ctx.new_page()
    manifest = []
    captured = []
    skipped = []
    for key, tmpl, needs_auth, desc in PAGES:
        url = base + tmpl.format(slug=slug)
        label = f"{key}-{width}x{height}.png"
        out = os.path.join(out_dir, label)
        if needs_auth and not args.storage_state:
            skipped.append((key, url, desc))
            print(f"  SKIP {key}: needs auth, no --storage-state ({desc})")
            continue
        try:
            page.goto(url, wait_until="networkidle", timeout=45000)
            # Give client-side hydration + neon animations a beat to settle.
            page.wait_for_timeout(2500)
            if key == "06-more":
                # More is a client-side popup, not a route: open it.
                more = page.locator('button:has-text("More")').first
                if more.count() > 0:
                    more.click()
                    page.wait_for_timeout(1200)
                else:
                    print(f"  WARN {key}: More button not found — capturing tab bar as-is")
            # Detect blank-page failures loudly: error boundary / empty body.
            title = page.title() or ""
            body_text = (page.locator("body").inner_text() or "").strip()
            if len(body_text) < 20:
                print(f"  WARN {key}: page body nearly empty ({len(body_text)} chars) — possible blank page")
            page.screenshot(path=out, full_page=True)
            manifest.append({"key": key, "url": url, "viewport": f"{width}x{height}",
                             "file": label, "desc": desc,
                             "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                             "title": title})
            captured.append(key)
            print(f"  OK   {label}  ({url})")
        except Exception as e:  # noqa: BLE001 — harness must survive one bad page
            skipped.append((key, url, f"{desc} — ERROR: {e}"))
            print(f"  FAIL {key}: {e}")
    page.close()
    ctx.close()
    return manifest, captured, skipped


def main():
    ap = argparse.ArgumentParser(description="Prism visual-regression screenshot harness")
    ap.add_argument("--base-url", default=BASE_DEFAULT)
    ap.add_argument("--slug", default="dawson")
    ap.add_argument("--out-dir", default=None)
    ap.add_argument("--storage-state", default=None,
                    help="Playwright storage-state JSON with a signed-in session")
    ap.add_argument("--save-state", default=None,
                    help="Write fresh storage state here after a --headed sign-in run")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--mobile-only", action="store_true")
    ap.add_argument("--desktop-only", action="store_true")
    args = ap.parse_args()

    if "pages.dev" not in args.base_url and "localhost" not in args.base_url:
        print("REFUSING: base-url is not a staging URL. "
              "Canonical staging is https://pookie-staging.pages.dev only.")
        return 2

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed. Run:\n"
              "  pip install playwright && python3 -m playwright install chromium")
        return 2

    run = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = args.out_dir or os.path.join("docs", "PRISM-QA", "screenshots", run)
    os.makedirs(out_dir, exist_ok=True)
    banner(f"Screenshot run -> {out_dir}")

    viewports = VIEWPORTS
    if args.mobile_only:
        viewports = [(390, 844)]
    if args.desktop_only:
        viewports = [(1440, 900)]

    all_manifest, all_captured, all_skipped = [], [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headed)
        for width, height in viewports:
            banner(f"Viewport {width}x{height}")
            kwargs = {}
            if args.storage_state and os.path.isfile(args.storage_state):
                kwargs["storage_state"] = args.storage_state
            man, cap, skp = capture(args, browser, args.base_url, args.slug,
                                    out_dir, width, height, kwargs)
            all_manifest += man
            all_captured += cap
            all_skipped += skp
        if args.save_state:
            ctx = browser.new_context()
            page = ctx.new_page()
            page.goto(args.base_url + "/login")
            print("\nSign in in the opened browser, then press ENTER here...")
            input()
            ctx.storage_state(path=args.save_state)
            print(f"Saved storage state to {args.save_state}")
            ctx.close()
        browser.close()

    with open(os.path.join(out_dir, "manifest.json"), "w") as fh:
        json.dump({"run": run, "base_url": args.base_url, "slug": args.slug,
                   "shots": all_manifest}, fh, indent=2)

    print()
    banner(f"Done: {len(all_captured)} captured, {len(all_skipped)} skipped/failed")
    if all_skipped:
        for key, url, reason in all_skipped:
            print(f"  - {key} {url}: {reason}")
    print(f"\nHand docs/PRISM-QA/screenshots/{run}/ to Prism E6 for the QA pass.")
    print("Checklist: docs/PRISM-QA-CHECKLIST.md")
    return 0 if not all_skipped else 1


if __name__ == "__main__":
    sys.exit(main())
