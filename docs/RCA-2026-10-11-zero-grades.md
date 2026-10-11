# Root Cause Analysis — Zero-Grades Data Incident
**Date:** 2026-10-11 17:04 EDT
**Severity:** High (dashboard showed F for all classes)
**Status:** Resolved
**Authors:** DB Emergency Response Team (lead: 1950beab, pipeline: f1e51d04, QA: 0409bfd5)

---

## 1. What Happened (Timeline)

| Time (EDT) | Event |
|---|---|
| 17:03:52 | MacBook worker (`dawson-laptop-sync.py`) runs StudentVUE sweep. Gradebook page doesn't fully render; the `%` regex finds no grades. Line 740 `"grade": grade or 0` silently converts all 6 missing grades to hard `0`. |
| 17:03:52 | Worker pushes all-zero payload to `studentvue_syncs` (row `8f046f39…`, device `macbook`). Same run scraped real assignments (10/15/9/11/16/21 per class) — proving partial page render, not auth failure. |
| 17:03:59 | `smart-merge.py` fires (watermark-driven). Writes 6 zero rows to `grade_history` with `source=smart_merge`. |
| 17:04:xx | Merge writes zeros to `merged_syncs` — then the **uncommitted zero-guard** fires, resolving all classes to parent grades. Final `merged_syncs` row `44b40c52` holds correct grades with `source="parent-override-zero-guard"`. |
| 17:04:xx | `merge_audit_log` write fails with PGRST204 (missing `skipped_fields` column) — silently, as always. |
| 17:07 | Second merge also hits the zero-guard. Dashboard tabs reading raw `student_sync` show zeros; tabs reading `merged_syncs` show correct grades. |
| 17:07–17:35 | Emergency response team investigates, fixes source bug, hardens guard, cleans data, redeploys. |

---

## 2. Why It Happened (Root Cause)

**Primary:** `~/workspace/dawson-checkin-app/laptop-sync/dawson-laptop-sync.py`, line 740:
```python
"grade": grade or 0,
```
inside `parse_gradebook()`. When the StudentVUE gradebook overview page doesn't fully render (slow load, DOM change, partial session), the regex `r'(\d{1,3}(?:\.\d{1,2})?)\s*%'` finds nothing, `grade` stays `None`, and `or 0` converts a **scrape failure** into a **definitive F**. No exception. No warning. Downstream code cannot distinguish "student has 0%" from "we failed to read the page."

**Contributing:**
- No row-level sanity check in the worker (e.g., "all grades zero while assignments found = reject payload").
- The zero-guard in `merge-sync.py` existed but was **uncommitted** — one `git checkout` away from the dashboard showing all F's.
- `merge_audit_log` has been broken since inception (missing column) — no audit trail to catch this.
- `grade_history` had no zero-rejection — it faithfully recorded the bad data.

---

## 3. Why It Wasn't Caught (Detection Gaps)

1. **Silent failure mode:** `or 0` is the worst possible default — it looks like real data.
2. **No payload validation** at any stage: worker → studentvue_syncs → merge → merged_syncs.
3. **Broken audit trail:** `merge_audit_log` PGRST204 on every write meant no one could review merge decisions.
4. **Split data reads:** some dashboard tabs read `merged_syncs` (correct), others read raw `student_sync` (zeros) — inconsistent UX masked the scope.
5. **First occurrence** in 30 sweeps — no prior signal to build defenses against.

---

## 4. What Was Fixed (Code + Data)

### Data
- Deleted 6 spurious zero `grade_history` rows (17:03:59 EDT, `source=smart_merge`) — they were never real measurements.
- `merged_syncs` verified correct: 97.1 / 84.2 / 80.18 / 79 / 79 / 69.5, zero zeros.
- Backups in `/tmp/incident-20261011/`.

### Code (all committed + pushed)
| Commit | Repo | Change |
|---|---|---|
| `ade869a` | dawson-sync-workers | Committed the zero-guard (was uncommitted) |
| `f8061e3` | dawson-sync-workers | Hardened `merge_grades`: student-0 + no parent → carry forward previous merged value (flagged); new plunge-guard (>30pt single-merge drop while parent confirms → parser error, keep parent); `write_grade_history` refuses zero points; 14/14 scenario tests pass |
| `70e60ce` | dawson-sync-workers | Fixed `merge_audit_log`: retries without `skipped_fields` key (audit trail works now) |
| `6ea83b7` | d-dash (phase-1) | **Source fix:** worker emits `None` (not `0`) on scrape failure; row-level sanity gate in `do_sync` rejects payload when class count ≠ 6 or all grades null/zero while assignments found |

### Deployment
- `npx opennextjs-cloudflare build` green, deployed to `pookie-staging.pages.dev`.
- Curl-verified live: all pages 200, 12/12 assets 200, no "Invalid API key", demo grades correct.

### Dawson data load
- `load-sweep.py`: child `dawson-kamal` created, 6 classes / 6 grades / 82 assignments / 6 snapshots. Verified zero zeros.

---

## 5. How We Prevent It (Going Forward)

### Already shipped
- [x] Source bug fixed: `None` instead of `0` on scrape failure
- [x] Worker sanity gate: rejects all-zero payloads before push
- [x] Merge zero-guard: committed, hardened, tested (14/14)
- [x] Plunge-guard: >30pt drops flagged, not trusted
- [x] `grade_history` refuses zero points
- [x] Audit trail repaired

### Still needed
- [ ] **Migration 009** (W5 college prep) — NOT applied. DDL impossible from sandbox; needs key holder via psql or dashboard SQL editor (idempotent).
- [ ] **`merge_audit_log.skipped_fields`** — add column via DDL (same blocker).
- [ ] **M1 `safe_auth_uid()` fix** — 006–008 already applied; must ship as new migration **014**, not file edits.
- [ ] **Guard gap (S5):** both-sides-zero still writes `grade=0` unflagged. Extend guard: carry forward previous merged value.
- [ ] **Monitoring:** alert on any `studentvue_syncs` row with all-zero grades (the incident signature).
- [ ] **Windows worker:** verified clean (no `or 0`), but confirm the deployed copy matches.

---

## 6. Key Lesson

**Never use `0` as a default for missing data.** A scrape failure and a real F look identical downstream. Use `None`, reject the payload, log loudly. The uncommitted zero-guard was the only thing between this bug and a dashboard full of F's — defense in depth saved us, but it was luck, not design. Now it's design.
