# Prism QA Regression Log

Owner: **Prism E6 (QA — visual regression)**.
Rule: every Prism deploy that reaches staging gets one entry here.
Each entry diffs the new screenshots against the
[`PRISM-QA-BASELINE.md`](./PRISM-QA-BASELINE.md) reference and records
PASS/FAIL per page.

Status key: **PASS** · **FAIL** (regression) · **SKIP** (not captured — say why)

---

## _(Template — copy for each deploy)_

### Deploy `________` (YYYY-MM-DD HH:MM TZ)

- Deploy commit: `________`
- Screenshot run: `docs/PRISM-QA/screenshots/<run>/`
- Smoke test: PASS / FAIL
- Verdict: **QA PASS** / **QA FAIL**

| Page | 390×844 | 1440×900 | Notes |
|------|---------|----------|-------|
| 01-login | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 02-home | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 03-today | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 04-pookie | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 05-progress | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 06-more | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 07-module | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 08-sync | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |
| 09-village | PASS/FAIL/SKIP | PASS/FAIL/SKIP | |

Regressions flagged: _(page, viewport, defect: broken layout / missing glow /
harsh colors / blank section / Title Case violation / other)_

Fix deploy follow-up: _(commit / status)_

---

_(Entries append below, newest last.)_
