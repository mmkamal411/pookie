# Prism QA Baseline

Owner: **Prism E6 (QA — visual regression)**.
Purpose: the reference every subsequent Prism deploy is diffed against.
Recorded after the **first Prism deploy** lands on
`https://pookie-staging.pages.dev` and passes the smoke test.

## Baseline provenance

| Field | Value |
|---|---|
| Deploy commit | _(fill: short SHA of the deploy that was screenshotted)_ |
| Smoke test result | _(fill: PASS / commit it ran against)_ |
| Screenshot run dir | `docs/PRISM-QA/screenshots/<YYYYMMDD-HHMMSS>/` |
| Recorded by | Prism E6 |
| Recorded at | _(fill: YYYY-MM-DD HH:MM TZ)_ |

## Screenshot format required

Every baseline page ships as **two full-page PNGs**:
- `NN-name-390x844.png` — mobile viewport (390 × 844, device scale 2)
- `NN-name-1440x900.png` — desktop viewport (1440 × 900, device scale 2)

Naming follows the harness output: `01-login-390x844.png`,
`01-login-1440x900.png`, …, `09-village-1440x900.png`.
See `manifest.json` in the run dir for URL ↔ file mapping.

## Per-page baseline observations

_(One entry per page. Describe: what the hero section looks like, where the
neon glow appears and its color, toolbar state, any collapsed-vs-expanded
sections, and anything quirky-but-correct to remember for regression diffs.)_

### 01 — Login (`/login`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 02 — Home (`/c/dawson`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 03 — Today (`/c/dawson/today`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 04 — Pookie (`/c/dawson/pookie`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 05 — Progress (`/c/dawson/school`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 06 — More (module popup, opened from `/c/dawson`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 07 — Module page (`/c/dawson/health`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 08 — Sync Command Center (`/c/dawson/settings/sync`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

### 09 — Village (`/village`)

- Mobile (390×844): _(describe)_
- Desktop (1440×900): _(describe)_

## Baseline verdict

_(After filling the entries above, record the overall baseline state: e.g.
"Baseline recorded — all 9 pages PASS on first Prism deploy" or note known
issues that are INTENTIONAL at baseline so they are not flagged as
regressions later.)_
