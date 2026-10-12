# Prism QA Checklist — per-deploy visual verification

Owner: **Prism E6 (QA — visual regression)**, reporting to Squad Prism coordinator.
Scope: every Prism deploy that lands on the **ONLY canonical staging URL**:
`https://pookie-staging.pages.dev` (never the `staging-build.pookie-staging.pages.dev`
branch preview — it serves stale builds).

This checklist runs AFTER the automated gates pass:
1. `python3 smoke-test-staging.py` is green (routes, bundle freshness, envelopes).
2. The deploy commit is pushed to `origin/staging-build`.

## Step 1 — Capture screenshots

Run the harness (the coordinator operates the browser / signs in):

```bash
# First time only: sign in once, save the session for reuse
python3 prism-screenshot-harness.py --headed --save-state /tmp/prism-state.json --mobile-only

# Full run (authenticated pages + public pages, both viewports)
python3 prism-screenshot-harness.py --storage-state /tmp/prism-state.json
```

Output: `docs/PRISM-QA/screenshots/<YYYYMMDD-HHMMSS>/` — 9 pages × 2 viewports
(full-page PNG at **390×844** mobile and **1440×900** desktop) + `manifest.json`.

Page → URL mapping (child slug `dawson` default; swap with `--slug`):

| # | Key | URL | Surface |
|---|-----|-----|---------|
| 01 | 01-login | `/login` | Login / landing |
| 02 | 02-home | `/c/dawson` | Home tab |
| 03 | 03-today | `/c/dawson/today` | Today tab |
| 04 | 04-pookie | `/c/dawson/pookie` | Pookie tab (AI chat) |
| 05 | 05-progress | `/c/dawson/school` | Progress tab (school hub) |
| 06 | 06-more | `/c/dawson` + More popup opened | More module popup |
| 07 | 07-module | `/c/dawson/health` | One module page (health) |
| 08 | 08-sync | `/c/dawson/settings/sync` | Sync Command Center |
| 09 | 09-village | `/village` | The Village (mentors) |

## Step 2 — Per-page visual review (every page, both viewports)

For each screenshot, check and record PASS/FAIL:

1. **No blank pages — ever.** No empty body, no "A server error occurred", no
   Next.js error boundary on a 200. Every error surface must be a graceful UI
   with a recovery path.
2. **Neon consistency.** Glows are soft/diffused (nebula/canopy language), never
   harsh. Home (violet `#a78bfa`) · Today (green `#6ee7b7`) · Pookie (amber
   `#ffd88a`) · Progress (amber `#fbbf24`) · More (violet `#c4b5fd`) tab glows
   match the toolbar spec.
3. **No harsh colors.** Nothing pure-white-on-pure-white, no retina-burning
   solids, no flat sticker/pasted look — visuals must blend with the cosmic
   background.
4. **Title Case.** All headings, tab labels, module names, section titles in
   Title Case (not ALL CAPS, not all-lowercase).
5. **Back buttons present.** Every module/detail page has a visible back/close
   path to the parent surface. The More popup closes cleanly.
6. **No layout breakage at 390px.** No horizontal scroll, no overlapping text,
   no clipped CTAs, no collapsed-but-unexpandable cards. Info is collapsed by
   default and expandable on tap (per Dawson dashboard patterns).
7. **Toolbar intact.** The spaceship-console bottom tab bar renders on every
   authenticated page, all 5 tabs visible, active tab glows.
8. **No stale/dead surfaces.** No "demo" residue, no placeholder "coming soon"
   text on shipped modules, no broken image icons.

## Step 3 — Record the result

- **First Prism deploy on staging:** write baseline observations to
  `docs/PRISM-QA-BASELINE.md` (per page, both viewports) using the format in
  that file.
- **Every subsequent deploy:** diff against the baseline screenshots and log
  PASS/FAIL per page in `docs/PRISM-QA-LOG.md`, flagging regressions:
  broken layout, missing glow, harsh colors, blank sections, Title Case
  violations.

## Step 4 — Gate decision

- All pages PASS → report **QA PASS** to the coordinator; the deploy may be
  presented to Mehedi.
- Any page FAIL → report **QA FAIL** with the page, viewport, and defect;
  block "ready for Mehedi" until a fix deploy re-passes this checklist.

## Standing notes

- Screenshots are visual evidence only — never claim a page "works" without
  loading it in a real browser session.
- Compare desktop against mobile: a page that passes at 1440×900 can still
  break at 390px, and mobile is where Mehedi tests first.
- If the harness skips authenticated pages (no `--storage-state`), say so
  explicitly in the report — do not mark unauthenticated-only coverage as a
  full pass.
