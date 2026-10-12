# Pookie School Schema — single source of truth for Dawson's school data

Owner: Squad Telemetry E4 (Database Architect) · 2026-10-12
Migrations: `066_school_telemetry.sql` ✅ live, `067_class_resources_checkin_uploads.sql` ✅ live,
`068_class_handouts_storage.sql` ⚠️ needs dashboard SQL editor (storage schema).
Built on: 001 (children/child_access), 002 (classes/school_systems), 006 (grades,
grade_snapshots, assignments, teacher_messages, checkins), 026/041 (provenance).

**Rule: extend, don't duplicate.** The pookie project already had a real school
schema. New tables were added only where nothing existed. Existing cron tables
(`sync_requests`, `class_emails`, `parent_sync`, `studentvue_syncs`) are untouched.

## ER overview

```
children 1───* classes 1───* grades                  (UNIQUE child,class,term)
                │       ├───* grade_snapshots        (append-only history)
                │       ├───* assignments             (UNIQUE child,class,source_id)
                │       ├───* class_resources          (seeded + student-added)
                │       └───* checkin_class_details ─┐ (UNIQUE checkin,class)
children 1───* checkins 1───* checkin_uploads ───────┘ (UNIQUE checkin,file_path)
children 1───* school_attendance        (UNIQUE child,date,source)
children 1───* school_calendar          (district events)
children 1───* teacher_messages         (inbound email + outbound drafts)
children 1───* school_sync_health       (UNIQUE child,source,machine) ← dashboard
children 1───* school_sync_runs         (append-only per-run log)

Storage bucket: class-handouts  (private; <child_id>/<class_slug>/<filename>)
```

## Table purposes

| Table | Purpose | Writer |
|---|---|---|
| `classes` | Class roster: name, period, room, teacher, display_order, color, current_unit, grade_weights | sync (service_role); parents may edit display fields |
| `grades` | Current numeric grade per class per term (`term` e.g. `'GP2'`). Numeric only — letters are client-side `letterGrade()` | sync only |
| `grade_snapshots` | Append-only grade history + `category_averages` jsonb per sync (feeds Path-to-90 + the ">3pt drop" trigger) | sync only |
| `assignments` | Due-next source. `assignment_type` ∈ homework/quiz/test/project/lab/final/classwork/other; `source_id` = adapter-stable id (NULL for manual rows, which never collide) | sync upserts; parents may add manual rows |
| `due_next` | View over assignments (security_invoker): upcoming/missing/late, due within −1d…+30d | — |
| `school_attendance` | Per child per day: status ∈ present/tardy/absent/early_dismissal/excused/unexcused + `period_details` jsonb | sync only |
| `teacher_messages` | Teacher/counselor inbox + outbound drafts. `direction` inbound/outbound; `sender_type` teacher/counselor (counselor bodies withheld from parents in the service layer); `external_id` = Gmail msg id (dedupe); `received_at`, `summary`, `thread_key` | E3 inbound via service_role; parents draft/approve/send |
| `school_calendar` | District events: holiday/no_school/early_release/late_start/testing/event/deadline | E3 via service_role |
| `checkins` | Daily check-in, 1 row/child/day: mood/energy/stress 1–5 + child-private `text` (W8: never in parent payloads) | child / parent backfill |
| `checkin_class_details` | Per-class debrief: `covered`, `clicked`, `fuzzy`, `due_next`, `confidence` 1–5 | child / parent backfill |
| `checkin_uploads` | Handout/photo metadata linked to a check-in (+class, auto `unit_tag` from `classes.current_unit`) | uploader |
| `class_resources` | Per-class library: `resource_type` ∈ khan_academy/youtube/cheat_sheet/clever/kahoot/blooket/quizlet/desmos/deltamath/ap_classroom/ebook/game/other; `is_seeded` (Pookie rec) vs student-added; `url` NULL for uploads | any tenant member (created_by bound) |
| `school_sync_health` | **THE status-dashboard contract** — 1 row per (child, source, machine). See below | E1/E2/E3 via `telemetry/health.py` |
| `school_sync_runs` | Append-only per-run log (started/finished/rows/error/success) | pull scripts |

`school_events` (pre-existing, unrelated) tracks actionable family events with
reminders — not district calendar dates. Do not confuse with `school_calendar`.

## RLS model

Child-scoped: `child_id = ANY (public.current_child_ids())` (001 pattern).

- **Sync-owned** (grades, grade_snapshots, school_attendance, school_calendar,
  school_sync_health, school_sync_runs): tenant `SELECT`; **no client write
  policies** — writes are service_role-only (006 discipline). Explicit `GRANT SELECT`.
- **Parent-write** (assignments, teacher_messages, classes): parent-role
  INSERT/UPDATE/DELETE + tenant read (002/006 policies).
- **Member-write** (checkins, checkin_class_details): any tenant member may
  INSERT/UPDATE (child writes own; parent may backfill). Raw check-in text stays
  child-confidential at the API layer (W8).
- **Owner-write** (class_resources, checkin_uploads): member INSERT bound to
  `auth.uid()` (`created_by`/`uploaded_by`); UPDATE/DELETE by creator or parent.
- **Storage** (`class-handouts`): SELECT/INSERT scoped to the caller's children's
  folders; UPDATE/DELETE uploader-or-parent.

Provenance tags (026): sync/school-of-record tables → `'school_of_record'`;
app-generated (check-ins, resources, uploads, sync-health, forecasts) →
`'app_generated'`.

## Sync-health contract (Mehedi directive — the system contract)

`school_sync_health`, UNIQUE `(child_id, source_name, machine)`:

| Column | Meaning |
|---|---|
| `source_name` | `'studentvue'` \| `'parentvue'` \| `'gmail-teacher'` \| `'ctls-learn'` \| `'ccsd-calendar'` \| `'checkin-app'` |
| `machine` | `'laptop'` (Dawson's Windows laptop via RustDesk) \| `'macbook'` (Mehedi's) \| `'sandbox'` (this VM/crons) \| `'cloud'` (hosted pipeline) |
| `cadence` | hourly/daily/weekly/manual |
| `expected_freshness` | interval, default `'26 hours'` — staleness threshold |
| `last_run_started` / `last_run_finished` / `last_success_at` | run lifecycle |
| `rows_pulled` | total rows written last run |
| `rows_by_table` | jsonb, e.g. `{"grades":6,"assignments":58}` |
| `error_text` | latest run's error (NULL on success) |
| `consecutive_errors` | increments per failed run, resets on success |
| `next_scheduled_run` | set by the owning worker (E1/E2/E3 know their schedules) |
| `data_freshness_status` | `'fresh'` \| `'stale'` \| `'error'` \| `'never'` |

**Freshness rule** (identical in `telemetry/health.py::compute_freshness` and
SQL `recompute_school_sync_health(child_id)` — keep them in sync):
latest run failed → `error`; never succeeded → `never`;
`now - last_success_at > expected_freshness` → `stale`; else `fresh`.

**Writer library: `telemetry/health.py`** (stdlib only). Pull scripts MUST use it:

```python
from telemetry.health import SyncHealthReporter
r = SyncHealthReporter.from_env(child_id="<uuid>")  # POOKIE_SUPABASE_URL + POOKIE_SERVICE_ROLE_KEY
with r.track("studentvue", machine="laptop", cadence="daily",
             expected_freshness_hours=26, next_scheduled_run="2026-10-13T07:00:00-04:00") as run:
    run.count("grades", 6)          # rows written per table
# clean exit → success row; exception → error row + re-raise
```

The key comes from the Secure Vault — never commit it. The dashboard calls
`recompute_school_sync_health(child_id)` (user JWT) before rendering so `stale`
flips without waiting for the next sync; cron jobs can use
`reporter.refresh_statuses()` (service_role equivalent).

## Data flow

```
StudentVUE (Dawson's login, laptop via RustDesk — Cobb blocks sandbox)
  └─▶ E2 student pull ─┬─▶ classes / grades / grade_snapshots / assignments
ParentVUE (Mehedi's login, sandbox cron)                        ├─▶ school_attendance
  └─▶ E1 parent pull ───────────────────────────────────────────┘
Gmail (teacher/counselor, Family/Dawson label)
  └─▶ E3 email pull ──▶ teacher_messages (external_id dedupe, summary)
CCSD district calendar site
  └─▶ E3 calendar pull ──▶ school_calendar
Check-in app
  └─▶ checkin pipeline ──▶ checkins + checkin_class_details + checkin_uploads
        (class-handouts bucket)

Every pull ──▶ telemetry/health.py ──▶ school_sync_health + school_sync_runs
        ──▶ Status dashboard: recompute_school_sync_health() → render

Tables ──▶ API routes (tenant RLS) ──▶ School pages:
  Academics tab (grades, due_next view), class pages (grade hero,
  category_averages → Path-to-90), teacher inbox, calendar, check-in debrief (E5).
```

## Retention policies

| Table | Policy |
|---|---|
| `grades` (current) | Keep — one row per (child,class,term), upserted |
| `grade_snapshots` | **Keep all** (history is the product: trends, drop alerts, forecasts) |
| `assignments` | **Keep all** (past/graded rows feed trends; `due_next` view filters) |
| `school_attendance` | **Keep all** (school-year history) |
| `teacher_messages` | **Keep all** (compliance + thread continuity) |
| `school_calendar` | **Rolling 2 years** — `purge_old_school_calendar()` (scheduled job, service_role) |
| `school_sync_runs` | **90 days** — `purge_old_school_sync_runs()` |
| `school_sync_health` | Keep — one current row per (child,source,machine), upserted |
| `checkins` / `checkin_class_details` / `checkin_uploads` | Keep all — **Mehedi decision on check-in retention still pending** |
| `class_resources` | Keep; `is_active=false` soft-hides instead of deleting |

## Backfill & idempotency strategy

- **One natural unique key per table**; every writer upserts on it:
  `classes(child,slug)`, `grades(child,class,term)`,
  `assignments(child,class,source_id)`, `school_attendance(child,date,source)`,
  `teacher_messages(child,external_id)` (partial index, NULL-safe),
  `school_sync_health(child,source,machine)`, `checkin_class_details(checkin,class)`.
  Manual assignment rows use `source_id IS NULL` — Postgres NULL semantics mean
  they never collide with sync rows.
- **Backfill script** `telemetry/backfill_school_066.py` → generates idempotent
  `telemetry/backfill_066.sql` (re-runnable; verified live 2026-10-12: 6 classes,
  6 GP2 grades, 6 snapshots, 58 assignments, health row `stale` — honest, the
  dump is 7 days old). Quirks handled: Lit's assignments was a note string;
  Lit/Geometry categories were descriptive strings (weights not captured).
- **History is append-only** (`grade_snapshots`, `school_sync_runs`): never
  UPDATE/DELETE from pull scripts; retention purges only.
- **Sync writes never touch** `sync_requests`, `class_emails`, `parent_sync`,
  `studentvue_syncs` (old-pipeline tables the crons still depend on).
- **Migrations** follow `check.sh`: `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
  guarded renames / `DROP POLICY IF EXISTS` / `OR REPLACE`; safe to re-run.

## Known gaps / follow-ups for the coordinator

1. **068 needs a dashboard apply** (storage schema not writable via mgmt API) —
   `supabase/migrations/068_class_handouts_storage.sql`.
2. E2 owns `next_scheduled_run` for the laptop worker; backfill left it NULL.
3. Lit & Geometry `grade_weights` are `{}` — the 2026-10-05 sweep didn't capture
   weights; E2's detail pull should fill `classes.grade_weights`.
4. Check-in retention policy awaits Mehedi's decision.
5. `068`'s bucket is referenced by `checkin_uploads.file_path` convention
   `<child_id>/<class_slug>/<filename>` — E5 must create the folder implicitly
   on first upload (Supabase creates folders on upload).
